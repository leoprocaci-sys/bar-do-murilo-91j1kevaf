-- Bar do Murilo — Correções da rodada de conclusão dos módulos Produtos/Comandas (v0.0.23)
-- Migration ADITIVA e pontual: não altera estruturas financeiras homologadas.
--
-- (1) fechar_comanda: usa o consumo_id RETORNADO por registrar_consumo_com_credito
--     (fim da associação por coincidência de cliente/valor/descrição/data).
-- (2) cancelar_fechamento_comanda: critérios temporalmente consistentes
--     (data_movimento + data_registro + id como desempate total) e bloqueio conservador
--     para pagamentos posteriores do mesmo cliente; créditos de utilização vinculados
--     ao consumo são cancelados apenas quando a dívida não recebeu pagamento posterior.
-- (3) EXECUTE das 6 RPCs novas: revoke do anon/público, mantendo authenticated.
-- Nenhum dado existente é lido, alterado ou apagado. Nada destrutivo.

-- =================================================================================================
-- 1. RPC FECHAR_COMANDA — consumo_id direto (CREATE OR REPLACE FUNCTION, assinatura inalterada)
-- =================================================================================================
CREATE OR REPLACE FUNCTION public.fechar_comanda(
  p_comanda_id UUID,
  p_parcelas JSONB,
  p_request_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_comanda public.comandas%ROWTYPE;
  v_total_centavos BIGINT := 0;
  v_soma_parcelas BIGINT := 0;
  v_parcela JSONB;
  v_forma TEXT;
  v_valor BIGINT;
  v_cliente_id UUID;
  v_cliente_fiado public.clientes%ROWTYPE;
  v_posicao RECORD;
  v_venda_id UUID;
  v_consumo_id UUID;
  v_credito_usado BIGINT := 0;
  v_pagamento_id UUID;
  v_idx SMALLINT := 0;
  v_descricao_venda TEXT;
  v_ident TEXT;
  v_result JSONB := '[]'::jsonb;
  v_consumo_result JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  IF p_parcelas IS NULL OR jsonb_typeof(p_parcelas) <> 'array' OR jsonb_array_length(p_parcelas) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe ao menos uma parcela para o fechamento.';
  END IF;

  -- Bloqueio pessimista: dois fechamentos simultâneos da mesma comanda se serializam aqui
  SELECT * INTO v_comanda
  FROM public.comandas
  WHERE id = p_comanda_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Comanda não encontrada.';
  END IF;

  IF v_comanda.status <> 'aberta' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Esta comanda já foi fechada por outro operador. Atualize a tela para ver a situação atual.';
  END IF;

  -- Total consumido (itens ativos, preços históricos/snapshots)
  SELECT COALESCE(SUM(subtotal_centavos), 0) INTO v_total_centavos
  FROM public.comanda_itens
  WHERE comanda_id = p_comanda_id AND status = 'ativo';

  IF v_total_centavos <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A comanda não possui consumo para fechar.';
  END IF;

  -- Valida parcelas antes de qualquer escrita financeira
  FOR v_parcela IN SELECT * FROM jsonb_array_elements(p_parcelas)
  LOOP
    v_idx := v_idx + 1;
    v_forma := v_parcela->>'forma';
    v_valor := (v_parcela->>'valor_centavos')::BIGINT;
    v_cliente_id := NULLIF(v_parcela->>'cliente_id', '')::UUID;

    IF v_forma NOT IN ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('Parcela %s: forma de pagamento inválida.', v_idx);
    END IF;

    IF v_valor IS NULL OR v_valor <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('Parcela %s: valor deve ser maior que zero (proibido negativo).', v_idx);
    END IF;

    v_soma_parcelas := v_soma_parcelas + v_valor;

    IF v_forma = 'fiado' THEN
      IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = format('Parcela %s: a parcela no Fiado exige cliente cadastrado (nome avulso não gera dívida).', v_idx);
      END IF;
      SELECT * INTO v_cliente_fiado FROM public.clientes WHERE id = v_cliente_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = format('Parcela %s: cliente do Fiado não encontrado.', v_idx);
      END IF;
      SELECT * INTO v_posicao FROM public.calcular_posicao_cliente(v_cliente_id);
      IF v_cliente_fiado.restricao_ativa THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = format('Parcela %s: cliente %s está com "Não vender fiado" ativa.', v_idx, v_cliente_fiado.nome);
      END IF;
      IF v_cliente_fiado.limite_centavos = 0 THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = format('Parcela %s: cliente %s não possui autorização de limite para fiado.', v_idx, v_cliente_fiado.nome);
      ELSIF v_cliente_fiado.limite_centavos IS NOT NULL THEN
        IF (v_valor - LEAST(v_posicao.credito_disponivel, v_valor)) > GREATEST(0, v_cliente_fiado.limite_centavos - v_posicao.saldo_devedor) THEN
          RAISE EXCEPTION USING ERRCODE = '22023',
            MESSAGE = format('Parcela %s: consumo no Fiado de %s excede o limite disponível.',
              v_idx, v_cliente_fiado.nome);
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF v_soma_parcelas <> v_total_centavos THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = format('A soma das parcelas (R$ %s) deve ser exatamente o total consumido (R$ %s).',
        TO_CHAR(v_soma_parcelas / 100.0, 'FM999G999D00'),
        TO_CHAR(v_total_centavos / 100.0, 'FM999G999D00'));
  END IF;

  -- Identificação para a descrição da venda direta: "Comanda — Marcelo / Calçada"
  v_ident := '';
  IF v_comanda.identificacao IS NOT NULL AND BTRIM(v_comanda.identificacao) <> '' THEN
    v_ident := BTRIM(v_comanda.identificacao);
  END IF;
  IF v_comanda.mesa IS NOT NULL AND BTRIM(v_comanda.mesa) <> '' THEN
    v_ident := CASE WHEN v_ident = '' THEN '' ELSE v_ident || ' — ' END || 'Mesa ' || BTRIM(v_comanda.mesa);
  END IF;
  IF (v_ident = '') THEN
    v_ident := 'Comanda ' || v_comanda.numero::TEXT;
  END IF;
  IF v_comanda.local_referencia IS NOT NULL AND BTRIM(v_comanda.local_referencia) <> '' THEN
    v_ident := v_ident || ' / ' || BTRIM(v_comanda.local_referencia);
  END IF;
  v_descricao_venda := 'Comanda — ' || v_ident;

  -- Executa as parcelas (mesma transação: qualquer erro reverte tudo)
  v_idx := 0;
  FOR v_parcela IN SELECT * FROM jsonb_array_elements(p_parcelas)
  LOOP
    v_idx := v_idx + 1;
    v_forma := v_parcela->>'forma';
    v_valor := (v_parcela->>'valor_centavos')::BIGINT;
    v_cliente_id := NULLIF(v_parcela->>'cliente_id', '')::UUID;

    IF v_forma = 'fiado' THEN
      -- Dívida no Fiado pelo mecanismo existente (não é dinheiro recebido; não movimenta gaveta)
      -- v_consumo_result.consumo_id é o identificador EXATO do consumo criado nesta transação.
      v_consumo_result := public.registrar_consumo_com_credito(
        v_cliente_id,
        v_valor,
        v_comanda.data_movimento,
        'Comanda — ' || v_ident,
        gen_random_uuid()
      );
      v_consumo_id := (v_consumo_result->>'consumo_id')::UUID;
      v_credito_usado := COALESCE((v_consumo_result->>'credito_usado_centavos')::BIGINT, 0);

      IF v_consumo_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Falha ao criar a dívida no Fiado: consumo não identificado.';
      END IF;

      INSERT INTO public.comanda_pagamentos (
        comanda_id, parcela_index, forma, valor_centavos, cliente_id, consumo_id,
        data_movimento, data_registro, registrado_por, status, request_id
      ) VALUES (
        p_comanda_id, v_idx, 'fiado', v_valor, v_cliente_id, v_consumo_id,
        v_comanda.data_movimento, NOW(), v_actor, 'ativo', gen_random_uuid()
      ) RETURNING id INTO v_pagamento_id;

      v_result := v_result || jsonb_build_object(
        'parcela', v_idx, 'forma', 'fiado', 'valor_centavos', v_valor,
        'cliente_id', v_cliente_id, 'consumo_id', v_consumo_id,
        'credito_usado_centavos', v_credito_usado
      );
    ELSE
      -- Recebimento integra o Caixa como VENDA DIRETA, preservando a modalidade
      INSERT INTO public.vendas_diretas (
        descricao, valor_centavos, forma, data_movimento, data_registro,
        registrado_por, status, request_id
      ) VALUES (
        v_descricao_venda, v_valor, v_forma, v_comanda.data_movimento, NOW(),
        v_actor, 'ativo', gen_random_uuid()
      ) RETURNING id INTO v_venda_id;

      INSERT INTO public.comanda_pagamentos (
        comanda_id, parcela_index, forma, valor_centavos, venda_direta_id,
        data_movimento, data_registro, registrado_por, status, request_id
      ) VALUES (
        p_comanda_id, v_idx, v_forma, v_valor, v_venda_id,
        v_comanda.data_movimento, NOW(), v_actor, 'ativo', gen_random_uuid()
      ) RETURNING id INTO v_pagamento_id;

      v_result := v_result || jsonb_build_object(
        'parcela', v_idx, 'forma', v_forma, 'valor_centavos', v_valor,
        'venda_direta_id', v_venda_id
      );
    END IF;
  END LOOP;

  -- Fecha a comanda (mesma transação)
  UPDATE public.comandas
  SET status = 'fechada',
      data_fechamento = NOW(),
      fechado_por = v_actor
  WHERE id = p_comanda_id;

  RETURN jsonb_build_object(
    'comanda_id', p_comanda_id,
    'status', 'fechada',
    'total_centavos', v_total_centavos,
    'parcelas', v_result,
    'idempotente', false
  );
END;
$$;

-- =================================================================================================
-- 2. RPC CANCELAR_FECHAMENTO_COMANDA — critérios temporalmente consistentes
--    (fim da comparação de seq entre tabelas independentes)
-- =================================================================================================
CREATE OR REPLACE FUNCTION public.cancelar_fechamento_comanda(
  p_comanda_id UUID,
  p_motivo TEXT DEFAULT 'Cancelamento de fechamento de comanda'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_comanda public.comandas%ROWTYPE;
  v_parcela RECORD;
  v_consumo public.consumos%ROWTYPE;
  v_consumo_cancelado BOOLEAN;
  v_pagamentos_depois BIGINT;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  SELECT * INTO v_comanda
  FROM public.comandas
  WHERE id = p_comanda_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Comanda não encontrada.';
  END IF;

  IF v_comanda.status <> 'fechada' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Esta comanda não está fechada.';
  END IF;

  -- Verifica cada parcela registrada no fechamento (apenas ativas)
  FOR v_parcela IN
    SELECT * FROM public.comanda_pagamentos
    WHERE comanda_id = p_comanda_id AND status = 'ativo'
    ORDER BY seq
  LOOP
    IF v_parcela.forma = 'fiado' THEN
      -- Dívida gerada pelo fechamento, identificada com PRECISÃO por consumo_id
      -- (gravado na própria parcela — nada de associação por coincidência).
      IF v_parcela.consumo_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = 'Parcela no Fiado sem vínculo confiável de consumo. Regularize pelo módulo Fiado antes de cancelar o fechamento.';
      END IF;

      SELECT * INTO v_consumo
      FROM public.consumos
      WHERE id = v_parcela.consumo_id
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = 'A dívida no Fiado desta comanda não foi encontrada. Regularize pelo módulo Fiado antes de cancelar o fechamento.';
      END IF;

      v_consumo_cancelado := (v_consumo.status = 'cancelado');

      -- BLOQUEIO CONSERVADOR: qualquer recebimento do MESMO cliente posterior ao consumo
--      (data_movimento + data_registro; id como desempate total em registros simultâneos)
      -- é tratado como potencialmente vinculado — nunca se presume que pertence a essa dívida.
      SELECT COUNT(*) INTO v_pagamentos_depois
      FROM public.pagamentos
      WHERE cliente_id = v_parcela.cliente_id
        AND status = 'ativo'
        AND (
          data_movimento > v_consumo.data_movimento
          OR (data_movimento = v_consumo.data_movimento AND data_registro > v_consumo.data_registro)
          OR (data_movimento = v_consumo.data_movimento
              AND data_registro = v_consumo.data_registro
              AND id > v_consumo.id)
        );

      IF v_consumo_cancelado THEN
        -- Dívida já encerrada fora do fluxo: bloqueia (conservador), sem apagar nada.
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = 'CANCELAMENTO BLOQUEADO: a dívida desta comanda já foi liquidada ou encerrada no módulo Fiado. Regularize pelo fluxo do Fiado antes de tentar cancelar o fechamento.';
      END IF;

      IF v_pagamentos_depois > 0 THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = format('CANCELAMENTO BLOQUEADO: o cliente %s já possui recebimento no Fiado posterior à dívida gerada por esta comanda. Regularize pelo fluxo do Fiado antes de tentar cancelar o fechamento.',
            (SELECT nome FROM public.clientes WHERE id = v_parcela.cliente_id));
      END IF;

      -- Sem pagamento posterior: cancela o consumo (reversão consistente pelo recálculo)
      UPDATE public.consumos
      SET status = 'cancelado'
      WHERE id = v_parcela.consumo_id;

      -- Créditos de utilização vinculados ao consumo cancelado (mesma transação)
      UPDATE public.creditos
      SET status = 'cancelado'
      WHERE movimento_vinculado_id = v_parcela.consumo_id AND tipo = 'utilizacao';

      PERFORM public.recalcular_cliente_cronologico(v_parcela.cliente_id);
    ELSE
      -- Venda direta do Caixa: cancela-a logicamente (nunca apagar)
      UPDATE public.vendas_diretas
      SET status = 'cancelado'
      WHERE id = v_parcela.venda_direta_id;
    END IF;

    -- Cancela a parcela da comanda
    UPDATE public.comanda_pagamentos
    SET status = 'cancelado'
    WHERE id = v_parcela.id;
  END LOOP;

  -- Reabre a comanda e limpa itens para novo fechamento
  UPDATE public.comandas
  SET status = 'aberta',
      data_fechamento = NULL,
      fechado_por = NULL
  WHERE id = p_comanda_id;

  RETURN jsonb_build_object(
    'comanda_id', p_comanda_id,
    'status', 'aberta',
    'motivo', p_motivo,
    'parcelas_canceladas', true
  );
END;
$$;

-- =================================================================================================
-- 3. PERMISSÕES: EXECUTE das 6 RPCs novas — revoke do anon, preserva authenticated
-- =================================================================================================
REVOKE EXECUTE ON FUNCTION public.lancar_item_comanda(UUID, UUID, INTEGER, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lancar_item_comanda(UUID, UUID, INTEGER, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.lancar_item_comanda(UUID, UUID, INTEGER, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancelar_item_comanda(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancelar_item_comanda(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cancelar_item_comanda(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.alterar_preco_excepcional_item(UUID, BIGINT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.alterar_preco_excepcional_item(UUID, BIGINT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.alterar_preco_excepcional_item(UUID, BIGINT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.atualizar_comanda_identificacao(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atualizar_comanda_identificacao(UUID, TEXT, TEXT, TEXT, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.atualizar_comanda_identificacao(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fechar_comanda(UUID, JSONB, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fechar_comanda(UUID, JSONB, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.fechar_comanda(UUID, JSONB, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancelar_fechamento_comanda(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancelar_fechamento_comanda(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cancelar_fechamento_comanda(UUID, TEXT) TO authenticated;
