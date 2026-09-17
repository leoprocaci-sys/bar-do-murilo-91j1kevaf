-- Bar do Murilo — Correção de Bug de Integridade em registrar_pagamento_fiado
-- Corrige a ordem de inserção na transação quando há excedente gerando crédito:
-- O pagamento é inserido primeiro com o ID real (e credito_id = NULL inicialmente),
-- em seguida o crédito é inserido com origem_pagamento_id apontando para o ID real do pagamento,
-- satisfazendo imediatamente a foreign key creditos_origem_pagamento_id_fkey,
-- e por fim o pagamento é atualizado com o credito_id gerado.
-- Tudo executado atomicamente na mesma transação.

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
  v_pagamento_id UUID;
  v_credito_id UUID := NULL;
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

  -- 1. Insere o pagamento PRIMEIRO para que seu id exista fisicamente na tabela pagamentos
  -- e atenda à foreign key constraint creditos_origem_pagamento_id_fkey
  INSERT INTO public.pagamentos (
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
    p_cliente_id,
    p_valor_centavos,
    p_forma,
    p_data_movimento,
    NOW(),
    v_actor,
    'ativo',
    p_request_id,
    NULL
  ) RETURNING * INTO v_novo_pagamento;

  v_pagamento_id := v_novo_pagamento.id;

  -- 2. Se houver excedente, cria o crédito correspondente vinculado ao pagamento recém-inserido
  IF v_excedente > 0 THEN
    INSERT INTO public.creditos (
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

    v_credito_id := v_novo_credito.id;

    -- 3. Atualiza o pagamento com o credito_id gerado
    UPDATE public.pagamentos
    SET credito_id = v_credito_id
    WHERE id = v_pagamento_id;
  END IF;

  RETURN jsonb_build_object(
    'pagamento_id', v_pagamento_id,
    'credito_id', v_credito_id,
    'valor_centavos', v_novo_pagamento.valor_centavos,
    'credito_gerado_centavos', v_excedente,
    'saldo_devedor_anterior', v_saldo_devedor,
    'saldo_devedor_atual', GREATEST(0, v_saldo_devedor - (p_valor_centavos - v_excedente)),
    'idempotente', false
  );
END;
$$;

-- Mantém permissão de execução idêntica
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_fiado(UUID, BIGINT, TEXT, DATE, UUID) TO authenticated;
