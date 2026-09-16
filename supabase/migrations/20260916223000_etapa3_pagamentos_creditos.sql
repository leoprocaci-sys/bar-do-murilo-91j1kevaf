-- Bar do Murilo — Etapa 3: Pagamentos / Recebimentos e Créditos do Fiado
-- Funções RPC transacionais para integridade atômica e livro-razão financeiro do fiado.

-- Função auxiliar: obter situação financeira calculada no banco (dívida, créditos e saldo devedor)
CREATE OR REPLACE FUNCTION public.calcular_posicao_cliente(
  p_cliente_id UUID
)
RETURNS TABLE (
  total_divida BIGINT,
  total_pago BIGINT,
  saldo_devedor BIGINT,
  credito_origem BIGINT,
  credito_utilizado BIGINT,
  credito_devolvido BIGINT,
  credito_disponivel BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_divida BIGINT := 0;
  v_pago BIGINT := 0;
  v_cred_origem BIGINT := 0;
  v_cred_utilizado BIGINT := 0;
  v_cred_devolvido BIGINT := 0;
  v_saldo_devedor BIGINT := 0;
  v_cred_disp BIGINT := 0;
BEGIN
  -- Total consumos ativos
  SELECT COALESCE(SUM(valor_centavos), 0)
  INTO v_divida
  FROM public.consumos
  WHERE cliente_id = p_cliente_id AND status = 'ativo';

  -- Total pagamentos ativos
  SELECT COALESCE(SUM(valor_centavos), 0)
  INTO v_pago
  FROM public.pagamentos
  WHERE cliente_id = p_cliente_id AND status = 'ativo';

  -- Créditos ativos por tipo
  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'origem' THEN valor_centavos ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'utilizacao' THEN valor_centavos ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'devolucao' THEN valor_centavos ELSE 0 END), 0)
  INTO v_cred_origem, v_cred_utilizado, v_cred_devolvido
  FROM public.creditos
  WHERE cliente_id = p_cliente_id AND status = 'ativo';

  -- A dívida bruta é v_divida.
  -- A porção amortizada por pagamentos é v_pago (menos a parcela que virou crédito excedente v_cred_origem).
  -- Portanto o saldo devedor atual é v_divida - (v_pago - v_cred_origem).
  v_saldo_devedor := GREATEST(0, v_divida - (v_pago - v_cred_origem));

  -- Crédito disponível líquido
  v_cred_disp := GREATEST(0, v_cred_origem - v_cred_utilizado - v_cred_devolvido);

  RETURN QUERY SELECT
    v_divida,
    v_pago,
    v_saldo_devedor,
    v_cred_origem,
    v_cred_utilizado,
    v_cred_devolvido,
    v_cred_disp;
END;
$$;

-- 1. REGISTRAR PAGAMENTO ATÔMICO COM EVENTUAL CRÉDITO
CREATE OR REPLACE FUNCTION public.registrar_pagamento_fiado(
  p_cliente_id UUID,
  p_valor_centavos BIGINT,
  p_forma TEXT,
  p_data_movimento DATE,
  p_request_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_cliente public.clientes%ROWTYPE;
  v_saldo_devedor BIGINT;
  v_excedente BIGINT := 0;
  v_novo_pagamento public.pagamentos%ROWTYPE;
  v_novo_credito public.creditos%ROWTYPE;
  v_pagamento_id UUID := gen_random_uuid();
  v_credito_id UUID := NULL;
  v_posicao RECORD;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  IF p_valor_centavos IS NULL OR p_valor_centavos <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'O valor do pagamento deve ser maior que zero.';
  END IF;

  IF p_forma NOT IN ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Forma de pagamento inválida.';
  END IF;

  IF p_data_movimento IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data do recebimento é obrigatória.';
  END IF;

  -- Bloqueio pessimista do cliente para garantir atomicidade sob concorrência
  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Cliente não encontrado.';
  END IF;

  -- Idempotência por request_id
  SELECT * INTO v_novo_pagamento
  FROM public.pagamentos
  WHERE request_id = p_request_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'pagamento_id', v_novo_pagamento.id,
      'credito_id', v_novo_pagamento.credito_id,
      'valor_centavos', v_novo_pagamento.valor_centavos,
      'credito_gerado_centavos', COALESCE((SELECT valor_centavos FROM public.creditos WHERE id = v_novo_pagamento.credito_id), 0),
      'idempotente', true
    );
  END IF;

  -- Calcular a posição atual do cliente
  SELECT saldo_devedor INTO v_saldo_devedor
  FROM public.calcular_posicao_cliente(p_cliente_id);

  IF p_valor_centavos > v_saldo_devedor THEN
    v_excedente := p_valor_centavos - v_saldo_devedor;
  ELSE
    v_excedente := 0;
  END IF;

  -- Se houver excedente, cria o crédito correspondente vinculado ao pagamento
  IF v_excedente > 0 THEN
    v_credito_id := gen_random_uuid();
    INSERT INTO public.creditos (
      id,
      cliente_id,
      tipo,
      valor_centavos,
      origem_pagamento_id,
      movimento_vinculado_id,
      data_movimento,
      data_registro,
      registrado_por,
      status,
      request_id
    ) VALUES (
      v_credito_id,
      p_cliente_id,
      'origem',
      v_excedente,
      v_pagamento_id,
      NULL,
      p_data_movimento,
      NOW(),
      v_actor,
      'ativo',
      gen_random_uuid()
    ) RETURNING * INTO v_novo_credito;
  END IF;

  -- Registra o pagamento com vínculo ao crédito gerado se houver
  INSERT INTO public.pagamentos (
    id,
    cliente_id,
    valor_centavos,
    forma,
    data_movimento,
    data_registro,
    registrado_por,
    status,
    request_id,
    credito_id
  ) VALUES (
    v_pagamento_id,
    p_cliente_id,
    p_valor_centavos,
    p_forma,
    p_data_movimento,
    NOW(),
    v_actor,
    'ativo',
    p_request_id,
    v_credito_id
  ) RETURNING * INTO v_novo_pagamento;

  -- Atualiza o crédito com origem_pagamento_id caso ainda não estivesse fixado
  IF v_credito_id IS NOT NULL THEN
    UPDATE public.creditos
    SET origem_pagamento_id = v_pagamento_id
    WHERE id = v_credito_id;
  END IF;

  RETURN jsonb_build_object(
    'pagamento_id', v_novo_pagamento.id,
    'credito_id', v_credito_id,
    'valor_centavos', v_novo_pagamento.valor_centavos,
    'credito_gerado_centavos', v_excedente,
    'saldo_devedor_anterior', v_saldo_devedor,
    'saldo_devedor_atual', GREATEST(0, v_saldo_devedor - (p_valor_centavos - v_excedente)),
    'idempotente', false
  );
END;
$$;

-- 2. EDITAR PAGAMENTO ATÔMICO
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
  v_cliente public.clientes%ROWTYPE;
  v_credito_antigo public.creditos%ROWTYPE;
  v_tem_credito_antigo BOOLEAN := FALSE;
  v_total_divida BIGINT;
  v_total_outros_pagos BIGINT;
  v_total_outros_creditos_origem BIGINT;
  v_saldo_devedor_sem_este BIGINT;
  v_novo_excedente BIGINT := 0;
  v_total_credito_utilizado BIGINT := 0;
  v_total_credito_devolvido BIGINT := 0;
  v_total_outros_creditos_origem_ativos BIGINT := 0;
  v_novo_credito_id UUID := NULL;
  v_novo_total_credito_origem BIGINT := 0;
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

  -- Busca o pagamento
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

  -- Bloqueio pessimista do cliente
  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = v_pagamento.cliente_id
  FOR UPDATE;

  -- Verifica se havia crédito gerado originalmente por este pagamento
  IF v_pagamento.credito_id IS NOT NULL THEN
    SELECT * INTO v_credito_antigo
    FROM public.creditos
    WHERE id = v_pagamento.credito_id
    FOR UPDATE;
    IF FOUND THEN
      v_tem_credito_antigo := TRUE;
    END IF;
  END IF;

  -- Consumos ativos totais
  SELECT COALESCE(SUM(valor_centavos), 0)
  INTO v_total_divida
  FROM public.consumos
  WHERE cliente_id = v_pagamento.cliente_id AND status = 'ativo';

  -- Pagamentos ativos exceto o atual
  SELECT COALESCE(SUM(valor_centavos), 0)
  INTO v_total_outros_pagos
  FROM public.pagamentos
  WHERE cliente_id = v_pagamento.cliente_id AND status = 'ativo' AND id <> p_pagamento_id;

  -- Créditos de origem ativos exceto o vinculado ao pagamento atual
  SELECT COALESCE(SUM(valor_centavos), 0)
  INTO v_total_outros_creditos_origem
  FROM public.creditos
  WHERE cliente_id = v_pagamento.cliente_id AND status = 'ativo'
    AND (v_pagamento.credito_id IS NULL OR id <> v_pagamento.credito_id)
    AND tipo = 'origem';

  -- Saldo devedor que existiria sem este pagamento
  -- A porção amortizada pelos outros pagamentos é (v_total_outros_pagos - v_total_outros_creditos_origem)
  v_saldo_devedor_sem_este := GREATEST(0, v_total_divida - (v_total_outros_pagos - v_total_outros_creditos_origem));

  -- Novo excedente calculado com o novo valor
  IF p_novo_valor_centavos > v_saldo_devedor_sem_este THEN
    v_novo_excedente := p_novo_valor_centavos - v_saldo_devedor_sem_este;
  ELSE
    v_novo_excedente := 0;
  END IF;

  -- Validação de consistência do crédito:
  -- Verifica se os créditos já utilizados pelo cliente caberão no novo total de crédito de origem
  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'utilizacao' THEN valor_centavos ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'devolucao' THEN valor_centavos ELSE 0 END), 0)
  INTO v_total_credito_utilizado, v_total_credito_devolvido
  FROM public.creditos
  WHERE cliente_id = v_pagamento.cliente_id AND status = 'ativo';

  v_novo_total_credito_origem := v_total_outros_creditos_origem + v_novo_excedente;

  -- Se o cliente já consumiu mais crédito do que o que restaria após esta redução,
  -- a conta do cliente ficaria com crédito líquido negativo sem amparo.
  -- Exigimos que o valor do pagamento não reduza crédito já consumido em compras reais
  -- sem que a dívida seja consistente. Na verdade, pela regra 16:
  -- "recalcular a posição do cliente consistentemente (consumos realizados, pagamentos, crédito gerado, crédito utilizado, dívida resultante), preservando movimentos reais."
  -- Como crédito de consumo vira débito na conta global (v_total_divida), se v_novo_total_credito_origem < v_total_credito_utilizado,
  -- isso significa que foi utilizado crédito acima da nova origem. Porém, na regra do sistema, o consumo foi real!
  -- Logo, se o usuário diminuir o pagamento, esse crédito que falta vira dívida em aberto.
  -- Mas para manter a tabela creditos íntegra (onde origem >= utilizacao + devolucao),
  -- se o novo excedente for menor que o necessário para cobrir os créditos já utilizados que dependiam dele,
  -- podemos ajustar o crédito de origem para o novo_excedente.
  -- Se novo_excedente < valor que foi utilizado desse crédito especificamente:
  -- Não bloqueamos a correção de erro de digitação, apenas garantimos que a tabela creditos represente a origem real (v_novo_excedente).
  -- Se v_novo_excedente == 0 e havia crédito: cancelamos o crédito vinculado.
  
  IF v_tem_credito_antigo THEN
    IF v_novo_excedente > 0 THEN
      -- Atualiza o crédito existente com o novo valor excedente e nova data
      UPDATE public.creditos
      SET valor_centavos = v_novo_excedente,
          data_movimento = p_nova_data_movimento
      WHERE id = v_credito_antigo.id;
      v_novo_credito_id := v_credito_antigo.id;
    ELSE
      -- Desvincula do pagamento primeiro para evitar violação de FK
      UPDATE public.pagamentos
      SET credito_id = NULL
      WHERE id = p_pagamento_id;

      -- Cancela o crédito que não existe mais por erro de digitação
      UPDATE public.creditos
      SET status = 'cancelado'
      WHERE id = v_credito_antigo.id;
      v_novo_credito_id := NULL;
    END IF;
  ELSE
    -- Não tinha crédito antes, mas agora gerou excedente
    IF v_novo_excedente > 0 THEN
      v_novo_credito_id := gen_random_uuid();
      INSERT INTO public.creditos (
        id,
        cliente_id,
        tipo,
        valor_centavos,
        origem_pagamento_id,
        movimento_vinculado_id,
        data_movimento,
        data_registro,
        registrado_por,
        status,
        request_id
      ) VALUES (
        v_novo_credito_id,
        v_pagamento.cliente_id,
        'origem',
        v_novo_excedente,
        p_pagamento_id,
        NULL,
        p_nova_data_movimento,
        NOW(),
        v_actor,
        'ativo',
        gen_random_uuid()
      );
    END IF;
  END IF;

  -- Atualiza o pagamento existente
  UPDATE public.pagamentos
  SET valor_centavos = p_novo_valor_centavos,
      forma = p_nova_forma,
      data_movimento = p_nova_data_movimento,
      credito_id = v_novo_credito_id
  WHERE id = p_pagamento_id;

  RETURN jsonb_build_object(
    'pagamento_id', p_pagamento_id,
    'novo_valor_centavos', p_novo_valor_centavos,
    'nova_forma', p_nova_forma,
    'nova_data_movimento', p_nova_data_movimento,
    'credito_id', v_novo_credito_id,
    'credito_gerado_centavos', v_novo_excedente
  );
END;
$$;

-- 3. CANCELAR PAGAMENTO ATÔMICO
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
  v_cliente public.clientes%ROWTYPE;
  v_credito public.creditos%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  -- Busca o pagamento
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

  -- Bloqueio pessimista do cliente
  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = v_pagamento.cliente_id
  FOR UPDATE;

  -- Se houver crédito originado por este pagamento, cancela-o também
  IF v_pagamento.credito_id IS NOT NULL THEN
    UPDATE public.creditos
    SET status = 'cancelado'
    WHERE id = v_pagamento.credito_id;
  END IF;

  -- Marca o pagamento como cancelado
  UPDATE public.pagamentos
  SET status = 'cancelado'
  WHERE id = p_pagamento_id;

  RETURN jsonb_build_object(
    'pagamento_id', p_pagamento_id,
    'status', 'cancelado',
    'cliente_id', v_pagamento.cliente_id,
    'valor_centavos', v_pagamento.valor_centavos
  );
END;
$$;

-- 4. REGISTRAR CONSUMO ATÔMICO COM UTILIZAÇÃO AUTOMÁTICA DE CRÉDITO
-- Quando o cliente tem crédito disponível, o crédito abate primeiro o consumo.
-- Ex: Crédito R$30, Consumo R$50 -> Cria registro de utilizacao de crédito de R$30 vinculado ao consumo,
-- e o consumo em si é registrado por R$20 (a parcela líquida não coberta que gera dívida e compromete o limite),
-- ou o consumo é registrado integralmente?
-- ATENÇÃO À ESPECIFICAÇÃO (Regras 12, 13 e 15):
-- "Em consumo posterior: usar crédito primeiro, reduzi-lo, só a parcela não coberta gera dívida,
-- e só essa dívida compromete o limite. Ex: crédito R$30, limite R$100, consumo R$50 → venda R$50,
-- crédito usado R$30, dívida nova R$20, nenhuma entrada financeira pelo uso do crédito."
-- Como a tabela `consumos` representa a dívida fiado do cliente (cada linha soma em totalDividaCentavos),
-- se inseríssemos R$50 em `consumos` e não criássemos abatimento, a dívida bruta aumentaria R$50.
-- Mas na tabela `creditos`, temos `tipo = 'utilizacao'` com `valor_centavos = 3000` e `movimento_vinculado_id = consumo.id`.
-- Assim:
-- Dívida bruta consumos: R$50 (representando a venda fiada integral de R$50)
-- Crédito utilizado: R$30
-- Crédito disponível cai em R$30 (pois crédito líquido = origem - utilizacao - devolucao)
-- E quanto à dívida líquida do cliente?
-- Com o saldo devedor calculado como:
-- saldo devedor = total_divida - (total_pago - total_credito_origem) - total_credito_utilizado?
-- NÃO! Vamos verificar a matemática contábil:
-- Inicial: Cliente pagou R$100 sobre dívida R$0 -> Pagamento R$100, Crédito Origem R$100.
-- Saldo devedor: 0 - (100 - 100) = 0. Crédito disponível: 100.
-- Novo consumo de R$50:
-- Se consumo for R$50 e criamos `utilizacao` de R$50:
-- Crédito disponível passa a: 100 - 50 = R$50.
-- Saldo devedor: se a dívida do consumo for R$50, e o crédito já foi utilizado,
-- ele DEVE ser abatido da dívida!
-- Se v_divida = 50, e v_pago = 100 (origem 100), se não abatermos o crédito usado da dívida, a fórmula daria:
-- 50 - (100 - 100) = 50 de dívida! Mas o consumo FOI PAGO com o crédito!
-- Portanto, o crédito utilizado ABATE a dívida de consumo:
-- Saldo devedor = MAX(0, total_divida - total_credito_utilizado - (total_pago - total_credito_origem))!
-- Vamos conferir com o exemplo da regra 12:
-- Exemplo: crédito R$30, limite R$100, consumo R$50.
-- Consumo registrado: R$50 (venda R$50 integral preservada).
-- Crédito utilizado registrado: R$30 (vinculado ao consumo).
-- Crédito disponível: R$30 - R$30 = R$0.
-- Dívida nova líquida resultante: R$50 - R$30 = R$20!
-- Só essa dívida nova de R$20 compromete o limite (limite restante = 100 - 20 = R$80).
-- E se o consumo for R$20 com crédito de R$30 (Regra 13: limite 0):
-- Consumo registrado: R$20.
-- Crédito utilizado: R$20.
-- Crédito restante: R$30 - R$20 = R$10.
-- Dívida líquida resultante: R$20 - R$20 = R$0!
-- Permitido mesmo com limite zero, pois a dívida nova resultante é R$0!
-- Essa matemática é perfeita, limpa e elegante.

-- Atualizamos a função de cálculo da posição para refletir perfeitamente o abatimento do crédito utilizado:
CREATE OR REPLACE FUNCTION public.calcular_posicao_cliente(
  p_cliente_id UUID
)
RETURNS TABLE (
  total_divida BIGINT,
  total_pago BIGINT,
  saldo_devedor BIGINT,
  credito_origem BIGINT,
  credito_utilizado BIGINT,
  credito_devolvido BIGINT,
  credito_disponivel BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_divida BIGINT := 0;
  v_pago BIGINT := 0;
  v_cred_origem BIGINT := 0;
  v_cred_utilizado BIGINT := 0;
  v_cred_devolvido BIGINT := 0;
  v_pagamento_amortizado BIGINT := 0;
  v_saldo_devedor BIGINT := 0;
  v_cred_disp BIGINT := 0;
BEGIN
  SELECT COALESCE(SUM(valor_centavos), 0)
  INTO v_divida
  FROM public.consumos
  WHERE cliente_id = p_cliente_id AND status = 'ativo';

  SELECT COALESCE(SUM(valor_centavos), 0)
  INTO v_pago
  FROM public.pagamentos
  WHERE cliente_id = p_cliente_id AND status = 'ativo';

  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'origem' THEN valor_centavos ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'utilizacao' THEN valor_centavos ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'devolucao' THEN valor_centavos ELSE 0 END), 0)
  INTO v_cred_origem, v_cred_utilizado, v_cred_devolvido
  FROM public.creditos
  WHERE cliente_id = p_cliente_id AND status = 'ativo';

  -- A porção amortizada dos pagamentos que cobriu fiado diretamente:
  v_pagamento_amortizado := GREATEST(0, v_pago - v_cred_origem);

  -- O saldo devedor real é a soma dos consumos ativos deduzida dos pagamentos diretos e dos créditos utilizados
  v_saldo_devedor := GREATEST(0, v_divida - v_pagamento_amortizado - v_cred_utilizado);

  -- Crédito disponível líquido
  v_cred_disp := GREATEST(0, v_cred_origem - v_cred_utilizado - v_cred_devolvido);

  RETURN QUERY SELECT
    v_divida,
    v_pago,
    v_saldo_devedor,
    v_cred_origem,
    v_cred_utilizado,
    v_cred_devolvido,
    v_cred_disp;
END;
$$;

-- 5. REGISTRAR CONSUMO FIADO COM UTILIZAÇÃO DE CRÉDITO ATÔMICA
CREATE OR REPLACE FUNCTION public.registrar_consumo_com_credito(
  p_cliente_id UUID,
  p_valor_centavos BIGINT,
  p_data_movimento DATE,
  p_descricao TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_cliente public.clientes%ROWTYPE;
  v_posicao RECORD;
  v_credito_a_usar BIGINT := 0;
  v_divida_nova_resultante BIGINT := 0;
  v_capacidade_disponivel BIGINT;
  v_novo_consumo public.consumos%ROWTYPE;
  v_consumo_id UUID := gen_random_uuid();
  v_credito_utilizacao_id UUID := NULL;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  IF p_valor_centavos IS NULL OR p_valor_centavos <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'O valor do consumo deve ser maior que zero.';
  END IF;

  IF p_data_movimento IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data do movimento é obrigatória.';
  END IF;

  -- Bloqueio pessimista do cliente
  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Cliente não encontrado.';
  END IF;

  -- Idempotência por request_id
  SELECT * INTO v_novo_consumo
  FROM public.consumos
  WHERE request_id = p_request_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'consumo_id', v_novo_consumo.id,
      'valor_centavos', v_novo_consumo.valor_centavos,
      'credito_usado_centavos', 0,
      'idempotente', true
    );
  END IF;

  -- 1. Regra "Não vender fiado"
  IF v_cliente.restricao_ativa THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = COALESCE('Cliente com restrição de "Não vender fiado" ativa. ' || v_cliente.restricao_motivo, 'Cliente com restrição de "Não vender fiado" ativa.');
  END IF;

  -- 2. Obter posição financeira atual
  SELECT * INTO v_posicao
  FROM public.calcular_posicao_cliente(p_cliente_id);

  -- Quanto do consumo pode ser coberto pelo crédito disponível
  IF v_posicao.credito_disponivel > 0 THEN
    v_credito_a_usar := LEAST(v_posicao.credito_disponivel, p_valor_centavos);
  ELSE
    v_credito_a_usar := 0;
  END IF;

  -- Parcela do consumo que excede o crédito e virará dívida nova líquida
  v_divida_nova_resultante := p_valor_centavos - v_credito_a_usar;

  -- 3. Validação de Limite
  IF v_divida_nova_resultante > 0 THEN
    -- Há dívida nova que precisa de limite
    IF v_cliente.limite_centavos = 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'Cliente não possui autorização de limite para fiado (limite R$ 0,00). O valor ultrapassa o crédito disponível.';
    ELSIF v_cliente.limite_centavos IS NOT NULL THEN
      -- Limite positivo
      -- Capacidade restante no limite = GREATEST(0, limite_centavos - saldo_devedor_atual)
      v_capacidade_disponivel := GREATEST(0, v_cliente.limite_centavos - v_posicao.saldo_devedor);
      IF v_divida_nova_resultante > v_capacidade_disponivel THEN
        RAISE EXCEPTION USING
          ERRCODE = '22023',
          MESSAGE = format('O consumo excede o limite disponível em R$ %s.',
            TO_CHAR((v_divida_nova_resultante - v_capacidade_disponivel) / 100.0, 'FM999G999D00'));
      END IF;
    END IF;
    -- Se limite for NULL, é ilimitado
  ELSE
    -- O consumo é integralmente coberto pelo crédito!
    -- Mesmo se limite for R$ 0,00, a Regra 13 autoriza:
    -- "Limite R$0 + crédito disponível + sem restrição manual → consumo permitido até o montante coberto pelo crédito, sem gerar dívida"
    NULL;
  END IF;

  -- 4. Registrar o consumo integral (venda integral de R$50 preservada)
  INSERT INTO public.consumos (
    id,
    cliente_id,
    valor_centavos,
    descricao,
    data_movimento,
    data_registro,
    registrado_por,
    status,
    request_id
  ) VALUES (
    v_consumo_id,
    p_cliente_id,
    p_valor_centavos,
    NULLIF(BTRIM(p_descricao), ''),
    p_data_movimento,
    NOW(),
    v_actor,
    'ativo',
    p_request_id
  ) RETURNING * INTO v_novo_consumo;

  -- 5. Se usou crédito, registrar o abatimento em creditos (tipo = 'utilizacao')
  IF v_credito_a_usar > 0 THEN
    v_credito_utilizacao_id := gen_random_uuid();
    INSERT INTO public.creditos (
      id,
      cliente_id,
      tipo,
      valor_centavos,
      origem_pagamento_id,
      movimento_vinculado_id,
      data_movimento,
      data_registro,
      registrado_por,
      status,
      request_id
    ) VALUES (
      v_credito_utilizacao_id,
      p_cliente_id,
      'utilizacao',
      v_credito_a_usar,
      NULL,
      v_consumo_id,
      p_data_movimento,
      NOW(),
      v_actor,
      'ativo',
      gen_random_uuid()
    );
  END IF;

  RETURN jsonb_build_object(
    'consumo_id', v_novo_consumo.id,
    'valor_total_centavos', p_valor_centavos,
    'credito_usado_centavos', v_credito_a_usar,
    'divida_nova_centavos', v_divida_nova_resultante,
    'credito_restante_centavos', v_posicao.credito_disponivel - v_credito_a_usar,
    'idempotente', false
  );
END;
$$;

-- Permissões de execução para authenticated
GRANT EXECUTE ON FUNCTION public.calcular_posicao_cliente(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_fiado(UUID, BIGINT, TEXT, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_pagamento_fiado(UUID, BIGINT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_pagamento_fiado(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_consumo_com_credito(UUID, BIGINT, DATE, TEXT, UUID) TO authenticated;
