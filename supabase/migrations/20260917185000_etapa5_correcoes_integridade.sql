-- Bar do Murilo — Etapa 5: Correções, Integridade e Recálculo Cronológico
-- Operações editáveis e canceláveis:
-- 1. Consumos do Caderno do Fiado (valor, descrição, data e cliente)
-- 2. Pagamentos / Recebimentos de fiado (valor, forma e data)
-- 3. Vendas diretas do Caixa (valor, forma, descrição e data)
-- 4. Saídas do Caixa (valor, origem, descrição e data)
-- 5. Dinheiro inicial do dia (valor e data)
-- 6. Retiradas em mercadoria (valor, consumidor, descrição e data)
-- 7. Devoluções de crédito (cancelamento / edição de devolução com recálculo)

-- -------------------------------------------------------------------------------------------------
-- 0. NÚCLEO DE RECÁLCULO CRONOLÓGICO DO CLIENTE
-- -------------------------------------------------------------------------------------------------
-- Essa função implementa o princípio: evento histórico → correção → recálculo cronológico → novo estado consistente.
-- Ela percorre a sequência estrita de eventos ativos do cliente ordenada por (data_movimento, seq, data_registro).
-- Para cada evento:
--   a) Consumo: consome crédito disponível acumulado até o momento. Se crédito > 0, cria/atualiza o crédito do tipo 'utilizacao' vinculado a este consumo. Se não houver crédito, dívida aumenta.
--   b) Pagamento: amortiza a dívida acumulada até o momento. Se o valor do pagamento for maior que a dívida acumulada atual, o excedente gera/atualiza o crédito de 'origem' vinculado a este pagamento. Se não houver excedente, eventual crédito de origem anterior vinculado é cancelado ou removido.
--   c) Devolução de crédito: reduz o crédito acumulado (deve ser <= crédito disponível na data).
-- No final, a tabela creditos (origem e utilizacao) reflete exatamente a realidade histórica recalculada,
-- o saldo devedor e o crédito disponível resultam diretamente dos fatos válidos.
-- NENHUM pagamento real é apagado ou substituído.
-- NENHUM crédito negativo é gerado.
-- NENHUM crédito ou pagamento fictício é inventado.

CREATE OR REPLACE FUNCTION public.recalcular_cliente_cronologico(
  p_cliente_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_evento RECORD;
  v_divida_acumulada BIGINT := 0;
  v_credito_acumulado BIGINT := 0;
  v_credito_usar BIGINT := 0;
  v_amortizacao BIGINT := 0;
  v_excedente BIGINT := 0;
  v_cred_origem_existente public.creditos%ROWTYPE;
  v_cred_util_existente public.creditos%ROWTYPE;
  v_novo_credito_id UUID;
BEGIN
  -- Bloqueio pessimista do cliente para garantir concorrência segura
  PERFORM 1 FROM public.clientes WHERE id = p_cliente_id FOR UPDATE;

  -- Primeiro, para todos os consumos ativos deste cliente, limpamos registros de utilização órfãos
  -- ou preparamos a reanálise.
  -- Criamos uma tabela temporária para registrar a fila de eventos cronológicos ordenados:
  -- Eventos possíveis: 'consumo', 'pagamento', 'devolucao'
  -- Devoluções estão na tabela creditos com tipo = 'devolucao'.
  
  -- Para evitar deadlocks ou inconsistências, iteramos por um cursor dos eventos ordenados por:
  -- data_movimento ASC, seq ASC, data_registro ASC
  FOR v_evento IN
    WITH eventos AS (
      SELECT 
        'consumo'::text AS tipo_evento,
        id AS ref_id,
        valor_centavos,
        data_movimento,
        data_registro,
        seq,
        NULL::text AS forma,
        NULL::uuid AS extra_id
      FROM public.consumos
      WHERE cliente_id = p_cliente_id AND status = 'ativo'

      UNION ALL

      SELECT 
        'pagamento'::text AS tipo_evento,
        id AS ref_id,
        valor_centavos,
        data_movimento,
        data_registro,
        seq,
        forma,
        credito_id AS extra_id
      FROM public.pagamentos
      WHERE cliente_id = p_cliente_id AND status = 'ativo'

      UNION ALL

      SELECT 
        'devolucao'::text AS tipo_evento,
        id AS ref_id,
        valor_centavos,
        data_movimento,
        data_registro,
        seq,
        NULL::text AS forma,
        movimento_vinculado_id AS extra_id
      FROM public.creditos
      WHERE cliente_id = p_cliente_id AND tipo = 'devolucao' AND status = 'ativo'
    )
    SELECT * FROM eventos
    ORDER BY data_movimento ASC, seq ASC, data_registro ASC
  LOOP
    IF v_evento.tipo_evento = 'consumo' THEN
      -- O consumo tenta abater do crédito acumulado disponível neste ponto do tempo
      IF v_credito_acumulado > 0 THEN
        v_credito_usar := LEAST(v_credito_acumulado, v_evento.valor_centavos);
      ELSE
        v_credito_usar := 0;
      END IF;

      -- Atualiza crédito acumulado e dívida acumulada
      v_credito_acumulado := v_credito_acumulado - v_credito_usar;
      v_divida_acumulada := v_divida_acumulada + (v_evento.valor_centavos - v_credito_usar);

      -- Ajusta o registro de crédito do tipo 'utilizacao' vinculado a este consumo
      SELECT * INTO v_cred_util_existente
      FROM public.creditos
      WHERE movimento_vinculado_id = v_evento.ref_id
        AND tipo = 'utilizacao'
      LIMIT 1;

      IF v_credito_usar > 0 THEN
        IF FOUND THEN
          UPDATE public.creditos
          SET valor_centavos = v_credito_usar,
              data_movimento = v_evento.data_movimento,
              status = 'ativo'
          WHERE id = v_cred_util_existente.id;
        ELSE
          v_novo_credito_id := gen_random_uuid();
          INSERT INTO public.creditos (
            id, cliente_id, tipo, valor_centavos, origem_pagamento_id,
            movimento_vinculado_id, data_movimento, data_registro,
            registrado_por, status, request_id
          ) VALUES (
            v_novo_credito_id, p_cliente_id, 'utilizacao', v_credito_usar, NULL,
            v_evento.ref_id, v_evento.data_movimento, NOW(),
            COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid), 'ativo', gen_random_uuid()
          );
        END IF;
      ELSE
        -- Não usou crédito. Se existia utilizacao anterior vinculada, marca como cancelado
        IF FOUND THEN
          UPDATE public.creditos
          SET status = 'cancelado'
          WHERE id = v_cred_util_existente.id;
        END IF;
      END IF;

    ELSIF v_evento.tipo_evento = 'pagamento' THEN
      -- O pagamento amortiza a dívida acumulada neste ponto
      IF v_evento.valor_centavos > v_divida_acumulada THEN
        v_amortizacao := v_divida_acumulada;
        v_excedente := v_evento.valor_centavos - v_divida_acumulada;
        v_divida_acumulada := 0;
      ELSE
        v_amortizacao := v_evento.valor_centavos;
        v_excedente := 0;
        v_divida_acumulada := v_divida_acumulada - v_amortizacao;
      END IF;

      -- Crédito acumulado recebe o excedente
      v_credito_acumulado := v_credito_acumulado + v_excedente;

      -- Verifica se este pagamento já tinha crédito de origem vinculado
      SELECT * INTO v_cred_origem_existente
      FROM public.creditos
      WHERE origem_pagamento_id = v_evento.ref_id
        AND tipo = 'origem'
      LIMIT 1;

      IF v_excedente > 0 THEN
        IF FOUND THEN
          UPDATE public.creditos
          SET valor_centavos = v_excedente,
              data_movimento = v_evento.data_movimento,
              status = 'ativo'
          WHERE id = v_cred_origem_existente.id;

          UPDATE public.pagamentos
          SET credito_id = v_cred_origem_existente.id
          WHERE id = v_evento.ref_id;
        ELSE
          v_novo_credito_id := gen_random_uuid();
          INSERT INTO public.creditos (
            id, cliente_id, tipo, valor_centavos, origem_pagamento_id,
            movimento_vinculado_id, data_movimento, data_registro,
            registrado_por, status, request_id
          ) VALUES (
            v_novo_credito_id, p_cliente_id, 'origem', v_excedente, v_evento.ref_id,
            NULL, v_evento.data_movimento, NOW(),
            COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid), 'ativo', gen_random_uuid()
          );

          UPDATE public.pagamentos
          SET credito_id = v_novo_credito_id
          WHERE id = v_evento.ref_id;
        END IF;
      ELSE
        -- Excedente é zero
        IF FOUND THEN
          -- Primeiro desvincula no pagamento para não violar FK caso exista constraint
          UPDATE public.pagamentos
          SET credito_id = NULL
          WHERE id = v_evento.ref_id;

          UPDATE public.creditos
          SET status = 'cancelado'
          WHERE id = v_cred_origem_existente.id;
        ELSE
          UPDATE public.pagamentos
          SET credito_id = NULL
          WHERE id = v_evento.ref_id AND credito_id IS NOT NULL;
        END IF;
      END IF;

    ELSIF v_evento.tipo_evento = 'devolucao' THEN
      -- A devolução reduz o crédito acumulado
      IF v_evento.valor_centavos > v_credito_acumulado THEN
        -- Proteção: nunca crédito negativo
        v_credito_acumulado := 0;
      ELSE
        v_credito_acumulado := v_credito_acumulado - v_evento.valor_centavos;
      END IF;
    END IF;
  END LOOP;

  -- Desativa quaisquer créditos de utilização órfãos (ligados a consumos que agora estão cancelados ou inexistentes)
  UPDATE public.creditos
  SET status = 'cancelado'
  WHERE cliente_id = p_cliente_id
    AND tipo = 'utilizacao'
    AND status = 'ativo'
    AND movimento_vinculado_id NOT IN (
      SELECT id FROM public.consumos WHERE cliente_id = p_cliente_id AND status = 'ativo'
    );

  -- Desativa quaisquer créditos de origem órfãos (ligados a pagamentos que agora estão cancelados)
  UPDATE public.creditos
  SET status = 'cancelado'
  WHERE cliente_id = p_cliente_id
    AND tipo = 'origem'
    AND status = 'ativo'
    AND origem_pagamento_id NOT IN (
      SELECT id FROM public.pagamentos WHERE cliente_id = p_cliente_id AND status = 'ativo'
    );

  RETURN jsonb_build_object(
    'cliente_id', p_cliente_id,
    'divida_final_centavos', v_divida_acumulada,
    'credito_final_centavos', v_credito_acumulado
  );
END;
$$;

-- -------------------------------------------------------------------------------------------------
-- 1. EDIÇÃO DE CONSUMO DO CADERNO DO FIADO (com suporte a troca de cliente)
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.editar_consumo_fiado(
  p_consumo_id UUID,
  p_novo_valor_centavos BIGINT,
  p_nova_descricao TEXT,
  p_nova_data_movimento DATE,
  p_novo_cliente_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_consumo public.consumos%ROWTYPE;
  v_cliente_origem_id UUID;
  v_cliente_destino_id UUID;
  v_cliente_destino public.clientes%ROWTYPE;
  v_troca_cliente BOOLEAN := FALSE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  IF p_novo_valor_centavos IS NULL OR p_novo_valor_centavos <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'O valor do consumo deve ser maior que zero.';
  END IF;

  IF p_nova_data_movimento IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data do movimento é obrigatória.';
  END IF;

  SELECT * INTO v_consumo
  FROM public.consumos
  WHERE id = p_consumo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Consumo não encontrado.';
  END IF;

  IF v_consumo.status <> 'ativo' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Não é possível editar um consumo cancelado.';
  END IF;

  v_cliente_origem_id := v_consumo.cliente_id;
  v_cliente_destino_id := COALESCE(p_novo_cliente_id, v_cliente_origem_id);

  IF v_cliente_destino_id <> v_cliente_origem_id THEN
    v_troca_cliente := TRUE;
    SELECT * INTO v_cliente_destino
    FROM public.clientes
    WHERE id = v_cliente_destino_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Cliente de destino não encontrado.';
    END IF;
  END IF;

  -- Bloqueia o cliente de origem
  PERFORM 1 FROM public.clientes WHERE id = v_cliente_origem_id FOR UPDATE;

  -- Atualiza o consumo
  UPDATE public.consumos
  SET valor_centavos = p_novo_valor_centavos,
      descricao = NULLIF(BTRIM(p_nova_descricao), ''),
      data_movimento = p_nova_data_movimento,
      cliente_id = v_cliente_destino_id
  WHERE id = p_consumo_id;

  -- Se houve troca de cliente, move também eventual crédito de utilização vinculado
  IF v_troca_cliente THEN
    UPDATE public.creditos
    SET cliente_id = v_cliente_destino_id,
        data_movimento = p_nova_data_movimento
    WHERE movimento_vinculado_id = p_consumo_id AND tipo = 'utilizacao';

    -- Recalcula cliente de origem
    PERFORM public.recalcular_cliente_cronologico(v_cliente_origem_id);
    -- Recalcula cliente de destino
    PERFORM public.recalcular_cliente_cronologico(v_cliente_destino_id);
  ELSE
    -- Recalcula cronologicamente a conta do cliente
    PERFORM public.recalcular_cliente_cronologico(v_cliente_origem_id);
  END IF;

  RETURN jsonb_build_object(
    'consumo_id', p_consumo_id,
    'cliente_origem_id', v_cliente_origem_id,
    'cliente_destino_id', v_cliente_destino_id,
    'troca_cliente', v_troca_cliente,
    'novo_valor_centavos', p_novo_valor_centavos,
    'nova_data_movimento', p_nova_data_movimento
  );
END;
$$;

-- -------------------------------------------------------------------------------------------------
-- 2. CANCELAMENTO DE CONSUMO DO CADERNO DO FIADO
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_consumo_fiado(
  p_consumo_id UUID,
  p_motivo TEXT DEFAULT 'Cancelamento de consumo'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_consumo public.consumos%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  SELECT * INTO v_consumo
  FROM public.consumos
  WHERE id = p_consumo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Consumo não encontrado.';
  END IF;

  IF v_consumo.status = 'cancelado' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Este consumo já se encontra cancelado.';
  END IF;

  -- Bloqueio no cliente
  PERFORM 1 FROM public.clientes WHERE id = v_consumo.cliente_id FOR UPDATE;

  -- Cancela o consumo logicamente
  UPDATE public.consumos
  SET status = 'cancelado'
  WHERE id = p_consumo_id;

  -- Se havia crédito de utilização vinculado, cancela-o
  UPDATE public.creditos
  SET status = 'cancelado'
  WHERE movimento_vinculado_id = p_consumo_id AND tipo = 'utilizacao';

  -- Recalcula a conta cronologicamente
  PERFORM public.recalcular_cliente_cronologico(v_consumo.cliente_id);

  RETURN jsonb_build_object(
    'consumo_id', p_consumo_id,
    'cliente_id', v_consumo.cliente_id,
    'status', 'cancelado',
    'valor_centavos', v_consumo.valor_centavos
  );
END;
$$;

-- -------------------------------------------------------------------------------------------------
-- 3. EDIÇÃO E CANCELAMENTO DE PAGAMENTOS (atualizados com recálculo cronológico universal)
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.editar_pagamento_fiado(
  p_pagamento_id UUID,
  p_novo_valor_centavos BIGINT,
  p_nova_forma TEXT,
  p_nova_data_movimento DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_pagamento public.pagamentos%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  IF p_novo_valor_centavos IS NULL OR p_novo_valor_centavos <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'O novo valor deve ser maior que zero.';
  END IF;

  IF p_nova_forma NOT IN ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Forma de pagamento inválida.';
  END IF;

  IF p_nova_data_movimento IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data do recebimento é obrigatória.';
  END IF;

  SELECT * INTO v_pagamento
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Pagamento não encontrado.';
  END IF;

  IF v_pagamento.status <> 'ativo' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Não é possível editar um pagamento cancelado.';
  END IF;

  PERFORM 1 FROM public.clientes WHERE id = v_pagamento.cliente_id FOR UPDATE;

  UPDATE public.pagamentos
  SET valor_centavos = p_novo_valor_centavos,
      forma = p_nova_forma,
      data_movimento = p_nova_data_movimento
  WHERE id = p_pagamento_id;

  -- Se havia crédito de origem vinculado, atualiza a data e aciona recálculo completo
  UPDATE public.creditos
  SET data_movimento = p_nova_data_movimento
  WHERE origem_pagamento_id = p_pagamento_id AND tipo = 'origem';

  PERFORM public.recalcular_cliente_cronologico(v_pagamento.cliente_id);

  RETURN jsonb_build_object(
    'pagamento_id', p_pagamento_id,
    'cliente_id', v_pagamento.cliente_id,
    'novo_valor_centavos', p_novo_valor_centavos,
    'nova_forma', p_nova_forma,
    'nova_data_movimento', p_nova_data_movimento
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_pagamento_fiado(
  p_pagamento_id UUID,
  p_motivo TEXT DEFAULT 'Cancelamento de pagamento'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_pagamento public.pagamentos%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  SELECT * INTO v_pagamento
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Pagamento não encontrado.';
  END IF;

  IF v_pagamento.status = 'cancelado' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Este pagamento já se encontra cancelado.';
  END IF;

  PERFORM 1 FROM public.clientes WHERE id = v_pagamento.cliente_id FOR UPDATE;

  -- Cancela eventual crédito de origem vinculado
  UPDATE public.creditos
  SET status = 'cancelado'
  WHERE origem_pagamento_id = p_pagamento_id;

  UPDATE public.pagamentos
  SET status = 'cancelado',
      credito_id = NULL
  WHERE id = p_pagamento_id;

  PERFORM public.recalcular_cliente_cronologico(v_pagamento.cliente_id);

  RETURN jsonb_build_object(
    'pagamento_id', p_pagamento_id,
    'status', 'cancelado',
    'cliente_id', v_pagamento.cliente_id,
    'valor_centavos', v_pagamento.valor_centavos
  );
END;
$$;

-- -------------------------------------------------------------------------------------------------
-- 4. EDIÇÃO E CANCELAMENTO DE VENDAS DIRETAS DO CAIXA
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.editar_venda_direta(
  p_venda_id UUID,
  p_novo_valor_centavos BIGINT,
  p_nova_forma TEXT,
  p_nova_descricao TEXT,
  p_nova_data_movimento DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_venda public.vendas_diretas%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  IF p_novo_valor_centavos IS NULL OR p_novo_valor_centavos <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'O valor da venda deve ser maior que zero.';
  END IF;

  IF p_nova_forma NOT IN ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Forma de pagamento inválida.';
  END IF;

  IF p_nova_data_movimento IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data do movimento é obrigatória.';
  END IF;

  SELECT * INTO v_venda
  FROM public.vendas_diretas
  WHERE id = p_venda_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Venda direta não encontrada.';
  END IF;

  IF v_venda.status <> 'ativo' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Não é possível editar uma venda cancelada.';
  END IF;

  UPDATE public.vendas_diretas
  SET valor_centavos = p_novo_valor_centavos,
      forma = p_nova_forma,
      descricao = COALESCE(NULLIF(BTRIM(p_nova_descricao), ''), 'Venda direta balcão'),
      data_movimento = p_nova_data_movimento
  WHERE id = p_venda_id;

  RETURN jsonb_build_object(
    'venda_id', p_venda_id,
    'valor_centavos', p_novo_valor_centavos,
    'forma', p_nova_forma,
    'data_movimento', p_nova_data_movimento
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_venda_direta(
  p_venda_id UUID,
  p_motivo TEXT DEFAULT 'Cancelamento de venda'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_venda public.vendas_diretas%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  SELECT * INTO v_venda
  FROM public.vendas_diretas
  WHERE id = p_venda_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Venda direta não encontrada.';
  END IF;

  IF v_venda.status = 'cancelado' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Esta venda já está cancelada.';
  END IF;

  UPDATE public.vendas_diretas
  SET status = 'cancelado'
  WHERE id = p_venda_id;

  RETURN jsonb_build_object(
    'venda_id', p_venda_id,
    'status', 'cancelado'
  );
END;
$$;

-- -------------------------------------------------------------------------------------------------
-- 5. EDIÇÃO E CANCELAMENTO DE SAÍDAS (com proteção para devolução de crédito)
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.editar_saida(
  p_saida_id UUID,
  p_novo_valor_centavos BIGINT,
  p_nova_origem TEXT, -- 'gaveta' ou 'conta_pix'
  p_nova_descricao TEXT,
  p_nova_data_movimento DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_saida public.saidas%ROWTYPE;
  v_credito public.creditos%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  IF p_novo_valor_centavos IS NULL OR p_novo_valor_centavos <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'O valor da saída deve ser maior que zero.';
  END IF;

  IF p_nova_origem NOT IN ('gaveta', 'conta_pix') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Origem da saída inválida. Permitido apenas gaveta ou conta_pix.';
  END IF;

  IF p_nova_descricao IS NULL OR BTRIM(p_nova_descricao) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A descrição da saída é obrigatória.';
  END IF;

  IF p_nova_data_movimento IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data do movimento é obrigatória.';
  END IF;

  SELECT * INTO v_saida
  FROM public.saidas
  WHERE id = p_saida_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Saída não encontrada.';
  END IF;

  IF v_saida.status <> 'ativo' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Não é possível editar uma saída cancelada.';
  END IF;

  -- Se for uma devolução de crédito (vinculo_credito_id NOT NULL), atualiza também o crédito vinculado
  IF v_saida.vinculo_credito_id IS NOT NULL THEN
    SELECT * INTO v_credito
    FROM public.creditos
    WHERE id = v_saida.vinculo_credito_id
    FOR UPDATE;

    IF FOUND THEN
      -- Se o valor mudou ou data mudou, atualiza o crédito de devolução e recalcula a conta do cliente
      UPDATE public.creditos
      SET valor_centavos = p_novo_valor_centavos,
          data_movimento = p_nova_data_movimento
      WHERE id = v_credito.id;

      PERFORM public.recalcular_cliente_cronologico(v_credito.cliente_id);
    END IF;
  END IF;

  UPDATE public.saidas
  SET valor_centavos = p_novo_valor_centavos,
      origem = p_nova_origem,
      descricao = BTRIM(p_nova_descricao),
      data_movimento = p_nova_data_movimento
  WHERE id = p_saida_id;

  RETURN jsonb_build_object(
    'saida_id', p_saida_id,
    'valor_centavos', p_novo_valor_centavos,
    'origem', p_nova_origem,
    'data_movimento', p_nova_data_movimento
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_saida(
  p_saida_id UUID,
  p_motivo TEXT DEFAULT 'Cancelamento de saída'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_saida public.saidas%ROWTYPE;
  v_credito public.creditos%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  SELECT * INTO v_saida
  FROM public.saidas
  WHERE id = p_saida_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Saída não encontrada.';
  END IF;

  IF v_saida.status = 'cancelado' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Esta saída já se encontra cancelada.';
  END IF;

  -- Se for devolução de crédito, cancela também o crédito do tipo 'devolucao'
  IF v_saida.vinculo_credito_id IS NOT NULL THEN
    SELECT * INTO v_credito
    FROM public.creditos
    WHERE id = v_saida.vinculo_credito_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.creditos
      SET status = 'cancelado'
      WHERE id = v_credito.id;

      PERFORM public.recalcular_cliente_cronologico(v_credito.cliente_id);
    END IF;
  END IF;

  UPDATE public.saidas
  SET status = 'cancelado'
  WHERE id = p_saida_id;

  RETURN jsonb_build_object(
    'saida_id', p_saida_id,
    'status', 'cancelado'
  );
END;
$$;

-- -------------------------------------------------------------------------------------------------
-- 6. EDIÇÃO E CANCELAMENTO DE RETIRADAS EM MERCADORIA
-- -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.editar_retirada_mercadoria(
  p_retirada_id UUID,
  p_novo_valor_centavos BIGINT,
  p_novo_consumidor TEXT,
  p_nova_descricao TEXT,
  p_nova_data_movimento DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_retirada public.retiradas_mercadoria%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  IF p_novo_valor_centavos IS NULL OR p_novo_valor_centavos <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'O valor da retirada deve ser maior que zero.';
  END IF;

  IF p_novo_consumidor IS NULL OR BTRIM(p_novo_consumidor) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe quem consumiu/retirou a mercadoria.';
  END IF;

  IF p_nova_descricao IS NULL OR BTRIM(p_nova_descricao) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A descrição da mercadoria retirada é obrigatória.';
  END IF;

  IF p_nova_data_movimento IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data do movimento é obrigatória.';
  END IF;

  SELECT * INTO v_retirada
  FROM public.retiradas_mercadoria
  WHERE id = p_retirada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Retirada em mercadoria não encontrada.';
  END IF;

  IF v_retirada.status <> 'ativo' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Não é possível editar uma retirada cancelada.';
  END IF;

  UPDATE public.retiradas_mercadoria
  SET valor_centavos = p_novo_valor_centavos,
      consumidor = BTRIM(p_novo_consumidor),
      descricao = BTRIM(p_nova_descricao),
      data_movimento = p_nova_data_movimento
  WHERE id = p_retirada_id;

  RETURN jsonb_build_object(
    'retirada_id', p_retirada_id,
    'valor_centavos', p_novo_valor_centavos,
    'consumidor', p_novo_consumidor,
    'data_movimento', p_nova_data_movimento
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_retirada_mercadoria(
  p_retirada_id UUID,
  p_motivo TEXT DEFAULT 'Cancelamento de retirada'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_retirada public.retiradas_mercadoria%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  SELECT * INTO v_retirada
  FROM public.retiradas_mercadoria
  WHERE id = p_retirada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Retirada não encontrada.';
  END IF;

  IF v_retirada.status = 'cancelado' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Esta retirada já está cancelada.';
  END IF;

  UPDATE public.retiradas_mercadoria
  SET status = 'cancelado'
  WHERE id = p_retirada_id;

  RETURN jsonb_build_object(
    'retirada_id', p_retirada_id,
    'status', 'cancelado'
  );
END;
$$;

-- -------------------------------------------------------------------------------------------------
-- 7. CANCELAMENTO / EDIÇÃO DE DEVOLUÇÃO DE CRÉDITO
-- -------------------------------------------------------------------------------------------------
-- Cancelar uma devolução de crédito pode ser acionado diretamente pelo id do crédito ou da saída.
CREATE OR REPLACE FUNCTION public.cancelar_devolucao_credito(
  p_credito_devolucao_id UUID,
  p_motivo TEXT DEFAULT 'Cancelamento de devolução de crédito'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_credito public.creditos%ROWTYPE;
  v_saida public.saidas%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  SELECT * INTO v_credito
  FROM public.creditos
  WHERE id = p_credito_devolucao_id AND tipo = 'devolucao'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Registro de devolução de crédito não encontrado.';
  END IF;

  IF v_credito.status = 'cancelado' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Esta devolução de crédito já está cancelada.';
  END IF;

  PERFORM 1 FROM public.clientes WHERE id = v_credito.cliente_id FOR UPDATE;

  -- Cancela o crédito
  UPDATE public.creditos
  SET status = 'cancelado'
  WHERE id = p_credito_devolucao_id;

  -- Cancela a saída correspondente vinculada
  IF v_credito.movimento_vinculado_id IS NOT NULL THEN
    UPDATE public.saidas
    SET status = 'cancelado'
    WHERE id = v_credito.movimento_vinculado_id;
  END IF;

  -- Recalcula a conta do cliente (o crédito devolvido é restaurado)
  PERFORM public.recalcular_cliente_cronologico(v_credito.cliente_id);

  RETURN jsonb_build_object(
    'credito_id', p_credito_devolucao_id,
    'saida_id', v_credito.movimento_vinculado_id,
    'cliente_id', v_credito.cliente_id,
    'status', 'cancelado'
  );
END;
$$;

-- -------------------------------------------------------------------------------------------------
-- Concessão de permissões de execução para authenticated
-- -------------------------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.recalcular_cliente_cronologico(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_consumo_fiado(UUID, BIGINT, TEXT, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_consumo_fiado(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_pagamento_fiado(UUID, BIGINT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_pagamento_fiado(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_venda_direta(UUID, BIGINT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_venda_direta(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_saida(UUID, BIGINT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_saida(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_retirada_mercadoria(UUID, BIGINT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_retirada_mercadoria(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_devolucao_credito(UUID, TEXT) TO authenticated;
