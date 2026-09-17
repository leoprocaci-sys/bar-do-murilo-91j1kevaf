-- Bar do Murilo — Etapa 4: Caixa
-- Implementação da devolução de crédito atômica e suporte transacional ao Caixa

-- 1. Função atômica para devolução de crédito do cliente
-- Garante que:
-- - Usuário é administrador ativo autenticado;
-- - Valor > 0;
-- - Origem da devolução é 'gaveta' ou 'conta_pix';
-- - Cliente possui crédito disponível suficiente no momento da operação;
-- - Nunca produz crédito negativo;
-- - Bloqueio FOR UPDATE no cliente para proteção contra concorrência;
-- - Insere em creditos (tipo = 'devolucao');
-- - Insere a saída correspondente em saidas (origem = 'gaveta' ou 'conta_pix', com vinculo_credito_id apontando para o crédito);
-- - Atualiza movimento_vinculado_id no crédito com o id da saída criada;
-- - Ambas as inserções disparam os triggers de integridade, session_actor e RLS existentes;
-- - Retorna JSON com os ids e dados da operação.

CREATE OR REPLACE FUNCTION public.registrar_devolucao_credito(
  p_cliente_id UUID,
  p_valor_centavos BIGINT,
  p_forma_devolucao TEXT, -- 'dinheiro' ou 'conta_pix'
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
  v_posicao RECORD;
  v_credito_disp BIGINT;
  v_origem_saida TEXT;
  v_credito_id UUID := gen_random_uuid();
  v_saida_id UUID := gen_random_uuid();
  v_novo_credito public.creditos%ROWTYPE;
  v_nova_saida public.saidas%ROWTYPE;
  v_descricao_saida TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  IF p_valor_centavos IS NULL OR p_valor_centavos <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'O valor da devolução deve ser maior que zero.';
  END IF;

  IF p_data_movimento IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data do movimento é obrigatória.';
  END IF;

  -- Formas permitidas: 'dinheiro' (gaveta) ou 'conta_pix' (fora da gaveta)
  IF p_forma_devolucao = 'dinheiro' THEN
    v_origem_saida := 'gaveta';
  ELSIF p_forma_devolucao IN ('pix', 'conta_pix') THEN
    v_origem_saida := 'conta_pix';
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Forma de devolução inválida. Permitido apenas Dinheiro ou Conta/Pix.';
  END IF;

  -- Bloqueio pessimista do cliente
  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Cliente não encontrado.';
  END IF;

  -- Idempotência por request_id em saidas
  SELECT * INTO v_nova_saida
  FROM public.saidas
  WHERE request_id = p_request_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'saida_id', v_nova_saida.id,
      'credito_id', v_nova_saida.vinculo_credito_id,
      'valor_centavos', v_nova_saida.valor_centavos,
      'origem', v_nova_saida.origem,
      'idempotente', true
    );
  END IF;

  -- Obter posição de crédito atual do cliente
  SELECT credito_disponivel INTO v_credito_disp
  FROM public.calcular_posicao_cliente(p_cliente_id);

  IF v_credito_disp IS NULL OR v_credito_disp < p_valor_centavos THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = format('O valor da devolução (R$ %s) não pode exceder o crédito disponível do cliente (R$ %s).',
        TO_CHAR(p_valor_centavos / 100.0, 'FM999G999D00'),
        TO_CHAR(COALESCE(v_credito_disp, 0) / 100.0, 'FM999G999D00'));
  END IF;

  -- Monta descrição da saída
  v_descricao_saida := format('Devolução de crédito ao cliente: %s', v_cliente.nome);
  IF v_cliente.apelido IS NOT NULL AND BTRIM(v_cliente.apelido) <> '' THEN
    v_descricao_saida := format('%s (%s)', v_descricao_saida, v_cliente.apelido);
  END IF;

  -- 1. Insere o crédito do tipo 'devolucao' (redução do crédito disponível)
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
    'devolucao',
    p_valor_centavos,
    NULL,
    v_saida_id,
    p_data_movimento,
    NOW(),
    v_actor,
    'ativo',
    gen_random_uuid()
  ) RETURNING * INTO v_novo_credito;

  -- 2. Insere a saída financeira correspondente com vinculo_credito_id
  INSERT INTO public.saidas (
    id,
    origem,
    descricao,
    valor_centavos,
    vinculo_credito_id,
    data_movimento,
    data_registro,
    registrado_por,
    status,
    request_id
  ) VALUES (
    v_saida_id,
    v_origem_saida,
    v_descricao_saida,
    p_valor_centavos,
    v_credito_id,
    p_data_movimento,
    NOW(),
    v_actor,
    'ativo',
    p_request_id
  ) RETURNING * INTO v_nova_saida;

  -- 3. Garante que movimento_vinculado_id no crédito aponte para a saída recém-criada
  UPDATE public.creditos
  SET movimento_vinculado_id = v_saida_id
  WHERE id = v_credito_id;

  RETURN jsonb_build_object(
    'saida_id', v_saida_id,
    'credito_id', v_credito_id,
    'cliente_id', p_cliente_id,
    'cliente_nome', v_cliente.nome,
    'valor_centavos', p_valor_centavos,
    'origem', v_origem_saida,
    'forma_devolucao', p_forma_devolucao,
    'data_movimento', p_data_movimento,
    'credito_restante_centavos', v_credito_disp - p_valor_centavos,
    'idempotente', false
  );
END;
$$;

-- Permissão de execução para authenticated
GRANT EXECUTE ON FUNCTION public.registrar_devolucao_credito(UUID, BIGINT, TEXT, DATE, UUID) TO authenticated;
