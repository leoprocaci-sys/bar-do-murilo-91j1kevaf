-- Bar do Murilo — Módulos Cadastro de Produtos e Comandas (Mesa/Cliente)
-- Migration ÚNICA e ADITIVA. NÃO altera nem remove estruturas, funções, políticas ou dados existentes.
--
-- Padrões herdados do sistema:
-- - valores em inteiros de centavos (bigint);
-- - status 'ativo'/'cancelado' em todo lançamento;
-- - data_movimento (dia do fato) + data_registro (momento do lançamento);
-- - registrado_por → app_users (id);
-- - seq bigint para ordenação estável;
-- - request_id uuid ÚNICO por tabela (idempotência de reenvio pós-falha);
-- - RLS com is_active_admin;
-- - gatilhos de auditoria (audit_business_update → historico_alteracoes);
-- - proteção de campos imutáveis (protect_immutable_fields);
-- - eventos que auto-ativam RLS nas tabelas novas (rls_auto_enable).
-- Nenhum dado existente é lido, alterado ou apagado por esta migration.

-- =================================================================================================
-- 1. TABELA produtos
-- =================================================================================================
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL CHECK (BTRIM(nome) <> ''),
  categoria TEXT NOT NULL DEFAULT 'Diversos' CHECK (BTRIM(categoria) <> ''),
  preco_atual_centavos BIGINT NOT NULL CHECK (preco_atual_centavos >= 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por UUID REFERENCES public.app_users(id),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por UUID REFERENCES public.app_users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS produtos_nome_unico_idx ON public.produtos (LOWER(BTRIM(nome)));
CREATE INDEX IF NOT EXISTS produtos_categoria_idx ON public.produtos (categoria);
CREATE INDEX IF NOT EXISTS produtos_ativo_idx ON public.produtos (ativo);

COMMENT ON TABLE public.produtos IS
  'Cadastro de produtos do Bar do Murilo. preço em centavos (bigint). Preparado para Estoque futuro via produto_id (sem implementar estoque nesta etapa).';

-- =================================================================================================
-- 2. TABELA comandas
-- =================================================================================================
CREATE TABLE IF NOT EXISTS public.comandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  identificacao TEXT, -- nome avulso/identificação livre, editável (ex.: "Marcelo", "Mesa 01 — Carlos")
  cliente_id UUID REFERENCES public.clientes(id),
  mesa TEXT,
  local_referencia TEXT, -- balcão, calçada, área externa...
  data_abertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aberto_por UUID REFERENCES public.app_users(id),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada')),
  data_fechamento TIMESTAMPTZ,
  fechado_por UUID REFERENCES public.app_users(id),
  data_movimento DATE NOT NULL DEFAULT (CURRENT_DATE),
  data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registrado_por UUID REFERENCES public.app_users(id),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por UUID REFERENCES public.app_users(id)
);

CREATE INDEX IF NOT EXISTS comandas_status_idx ON public.comandas (status, data_abertura DESC);
CREATE INDEX IF NOT EXISTS comandas_cliente_idx ON public.comandas (cliente_id);

COMMENT ON TABLE public.comandas IS
  'Comandas de consumo (mesa/avulso). Número interno automático. Cliente cadastrado é obrigatório somente quando houver parcela no Fiado.';

-- =================================================================================================
-- 3. TABELA comanda_itens
-- =================================================================================================
CREATE TABLE IF NOT EXISTS public.comanda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID NOT NULL REFERENCES public.comandas(id),
  produto_id UUID REFERENCES public.produtos(id),
  produto_nome TEXT NOT NULL CHECK (BTRIM(produto_nome) <> ''),
  preco_unitario_centavos BIGINT NOT NULL CHECK (preco_unitario_centavos >= 0),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  subtotal_centavos BIGINT NOT NULL GENERATED ALWAYS AS
    (preco_unitario_centavos * quantidade) STORED,
  preco_excepcional BOOLEAN NOT NULL DEFAULT FALSE,
  justificativa_excecao TEXT,
  data_movimento DATE NOT NULL DEFAULT (CURRENT_DATE),
  data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registrado_por UUID REFERENCES public.app_users(id),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  request_id UUID NOT NULL,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por UUID REFERENCES public.app_users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS comanda_itens_request_id_unico_idx
  ON public.comanda_itens (request_id);
CREATE INDEX IF NOT EXISTS comanda_itens_comanda_idx ON public.comanda_itens (comanda_id, seq);
CREATE INDEX IF NOT EXISTS comanda_itens_produto_idx ON public.comanda_itens (produto_id);

COMMENT ON TABLE public.comanda_itens IS
  'Itens lançados na comanda. produto_nome e preco_unitario_centavos são SNAPSHOT do momento do lançamento (preço histórico garantido). Subtotal derivado.';

-- =================================================================================================
-- 4. TABELA comanda_pagamentos
-- =================================================================================================
CREATE TABLE IF NOT EXISTS public.comanda_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID NOT NULL REFERENCES public.comandas(id),
  parcela_index SMALLINT,
  forma TEXT NOT NULL CHECK (forma IN ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'fiado')),
  valor_centavos BIGINT NOT NULL CHECK (valor_centavos > 0),
  cliente_id UUID REFERENCES public.clientes(id), -- obrigatório quando forma = 'fiado'
  venda_direta_id UUID, -- forma != fiado: venda direta gerada no Caixa
  consumo_id UUID,      -- forma = fiado: consumo (dívida) gerado no Fiado
  pago_posteriormente BOOLEAN NOT NULL DEFAULT FALSE,
  data_movimento DATE NOT NULL DEFAULT (CURRENT_DATE),
  data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registrado_por UUID REFERENCES public.app_users(id),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  request_id UUID NOT NULL,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por UUID REFERENCES public.app_users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS comanda_pagamentos_request_id_unico_idx
  ON public.comanda_pagamentos (request_id);
CREATE INDEX IF NOT EXISTS comanda_pagamentos_comanda_idx ON public.comanda_pagamentos (comanda_id, seq);

COMMENT ON TABLE public.comanda_pagamentos IS
  'Parcelas do fechamento da comanda e vínculo com os lançamentos financeiros gerados (venda_direta_id no Caixa; consumo_id no Fiado). Base confiável para o cancelamento do fechamento.';

-- =================================================================================================
-- 5. PROTEÇÃO: campos imutáveis nas tabelas novas
-- =================================================================================================
CREATE OR REPLACE FUNCTION public.protect_comanda_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- comanda_itens: snapshot de nome/preço é imutável (corrige-se via cancelamento + novo lançamento);
  -- comanda_pagamentos: vínculos financeiros gerados são imutáveis.
  IF TG_TABLE_NAME = 'comanda_itens' THEN
    IF NEW.produto_nome IS DISTINCT FROM OLD.produto_nome
       OR NEW.comanda_id IS DISTINCT FROM OLD.comanda_id
       OR NEW.produto_id IS DISTINCT FROM OLD.produto_id
       OR NEW.request_id IS DISTINCT FROM OLD.request_id
       OR NEW.seq IS DISTINCT FROM OLD.seq
       OR NEW.data_movimento IS DISTINCT FROM OLD.data_movimento THEN
      RAISE EXCEPTION USING ERRCODE = '23506',
        MESSAGE = 'Campos de identificação e snapshot do item da comanda são imutáveis. Use cancelamento + novo lançamento.';
    END IF;
  ELSIF TG_TABLE_NAME = 'comanda_pagamentos' THEN
    IF NEW.comanda_id IS DISTINCT FROM OLD.comanda_id
       OR NEW.forma IS DISTINCT FROM OLD.forma
       OR NEW.valor_centavos IS DISTINCT FROM OLD.valor_centavos
       OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
       OR NEW.venda_direta_id IS DISTINCT FROM OLD.venda_direta_id
       OR NEW.consumo_id IS DISTINCT FROM OLD.consumo_id
       OR NEW.request_id IS DISTINCT FROM OLD.request_id
       OR NEW.seq IS DISTINCT FROM OLD.seq
       OR NEW.data_movimento IS DISTINCT FROM OLD.data_movimento THEN
      RAISE EXCEPTION USING ERRCODE = '23506',
        MESSAGE = 'Campos da parcela da comanda são imutáveis. Use cancelamento pelo fluxo de fechamento.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comanda_itens_immutable ON public.comanda_itens;
CREATE TRIGGER comanda_itens_immutable
BEFORE UPDATE ON public.comanda_itens
FOR EACH ROW EXECUTE FUNCTION public.protect_comanda_immutable_fields();

DROP TRIGGER IF EXISTS comanda_pagamentos_immutable ON public.comanda_pagamentos;
CREATE TRIGGER comanda_pagamentos_immutable
BEFORE UPDATE ON public.comanda_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.protect_comanda_immutable_fields();

-- =================================================================================================
-- 6. AUDITORIA: plug audit_business_update nas tabelas novas
-- =================================================================================================
DROP TRIGGER IF EXISTS produtos_audit ON public.produtos;
CREATE TRIGGER produtos_audit
AFTER UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.audit_business_update();

DROP TRIGGER IF EXISTS comandas_audit ON public.comandas;
CREATE TRIGGER comandas_audit
AFTER UPDATE ON public.comandas
FOR EACH ROW EXECUTE FUNCTION public.audit_business_update();

DROP TRIGGER IF EXISTS comanda_itens_audit ON public.comanda_itens;
CREATE TRIGGER comanda_itens_audit
AFTER UPDATE ON public.comanda_itens
FOR EACH ROW EXECUTE FUNCTION public.audit_business_update();

-- =================================================================================================
-- 7. UPDATED_AT / ATUALIZADO_POR nas tabelas novas
-- =================================================================================================
DROP TRIGGER IF EXISTS produtos_touch ON public.produtos;
CREATE TRIGGER produtos_touch
BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

DROP TRIGGER IF EXISTS comandas_touch ON public.comandas;
CREATE TRIGGER comandas_touch
BEFORE UPDATE ON public.comandas
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

DROP TRIGGER IF EXISTS comanda_itens_touch ON public.comanda_itens;
CREATE TRIGGER comanda_itens_touch
BEFORE UPDATE ON public.comanda_itens
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

DROP TRIGGER IF EXISTS comanda_pagamentos_touch ON public.comanda_pagamentos;
CREATE TRIGGER comanda_pagamentos_touch
BEFORE UPDATE ON public.comanda_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

-- =================================================================================================
-- 8/9. RLS (o mecanismo de auto-ativação do projeto já mantém RLS ligado; ativado explicitamente aqui)
-- =================================================================================================
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_pagamentos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['produtos', 'comandas', 'comanda_itens', 'comanda_pagamentos']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_total ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY admin_total ON public.%I
        FOR ALL TO authenticated
        USING (public.is_active_admin(auth.uid()))
        WITH CHECK (public.is_active_admin(auth.uid()))
    $f$, t);
  END LOOP;
END $$;

-- =================================================================================================
-- 10. RPC: LANÇAMENTO DE ITEM (validação de preço no SERVIDOR, snapshot garantido)
-- =================================================================================================
CREATE OR REPLACE FUNCTION public.lancar_item_comanda(
  p_comanda_id UUID,
  p_produto_id UUID,
  p_quantidade INTEGER,
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
  v_produto public.produtos%ROWTYPE;
  v_item_id UUID := gen_random_uuid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'Quantidade deve ser maior que zero.';
  END IF;

  -- Bloqueio pessimista da comanda (concurrença: item durante fechamento, dois lançamentos simultâneos)
  SELECT * INTO v_comanda
  FROM public.comandas
  WHERE id = p_comanda_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Comanda não encontrada.';
  END IF;

  -- Reenvio pós-falha de conexão: idempotência por request_id
  IF EXISTS (SELECT 1 FROM public.comanda_itens WHERE request_id = p_request_id) THEN
    RETURN jsonb_build_object('item_id', NULL, 'idempotente', true);
  END IF;

  IF v_comanda.status <> 'aberta' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Comanda já está fechada por outro operador. Atualize a tela antes de continuar.';
  END IF;

  -- Preço vem EXCLUSIVAMENTE do cadastro no momento do registro (nunca da interface)
  SELECT * INTO v_produto
  FROM public.produtos
  WHERE id = p_produto_id AND ativo = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002',
      MESSAGE = 'Produto não encontrado ou inativo. Atualize a lista de produtos.';
  END IF;

  INSERT INTO public.comanda_itens (
    id, comanda_id, produto_id, produto_nome, preco_unitario_centavos,
    quantidade, data_movimento, data_registro, registrado_por, status, request_id
  ) VALUES (
    v_item_id, p_comanda_id, v_produto.id, v_produto.nome, v_produto.preco_atual_centavos,
    p_quantidade, v_comanda.data_movimento, NOW(), v_actor, 'ativo', p_request_id
  );

  RETURN jsonb_build_object(
    'item_id', v_item_id,
    'produto_id', v_produto.id,
    'produto_nome', v_produto.nome,
    'preco_unitario_centavos', v_produto.preco_atual_centavos,
    'quantidade', p_quantidade,
    'subtotal_centavos', v_produto.preco_atual_centavos * p_quantidade,
    'idempotente', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lancar_item_comanda(UUID, UUID, INTEGER, UUID) TO authenticated;

-- =================================================================================================
-- 11. RPC: CANCELAR ITEM DA COMANDA (aberta; correções pós-fechamento seguem procedimento próprio)
-- =================================================================================================
CREATE OR REPLACE FUNCTION public.cancelar_item_comanda(
  p_item_id UUID,
  p_motivo TEXT DEFAULT 'Cancelamento de item da comanda'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_item public.comanda_itens%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  SELECT * INTO v_item
  FROM public.comanda_itens
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Item não encontrado.';
  END IF;

  IF v_item.status = 'cancelado' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Este item já está cancelado.';
  END IF;

  -- Bloqueio pessimista da comanda
  PERFORM 1 FROM public.comandas WHERE id = v_item.comanda_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.comandas WHERE id = v_item.comanda_id AND status <> 'aberta') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'A comanda já foi fechada por outro operador. Correções financeiras pós-fechamento seguem procedimento próprio.';
  END IF;

  UPDATE public.comanda_itens
  SET status = 'cancelado'
  WHERE id = p_item_id;

  RETURN jsonb_build_object('item_id', p_item_id, 'status', 'cancelado', 'motivo', p_motivo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_item_comanda(UUID, TEXT) TO authenticated;

-- =================================================================================================
-- 12. RPC: ALTERAÇÃO EXCEPCIONAL DE PREÇO DE ITEM (comanda aberta; confirmada pela interface)
-- =================================================================================================
CREATE OR REPLACE FUNCTION public.alterar_preco_excepcional_item(
  p_item_id UUID,
  p_novo_preco_centavos BIGINT,
  p_justificativa TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_item public.comanda_itens%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  IF p_novo_preco_centavos IS NULL OR p_novo_preco_centavos < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'Preço do item deve ser maior ou igual a zero.';
  END IF;

  IF p_justificativa IS NULL OR BTRIM(p_justificativa) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Justificativa é obrigatória para alteração excepcional de preço.';
  END IF;

  SELECT * INTO v_item
  FROM public.comanda_itens
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Item não encontrado.';
  END IF;

  IF v_item.status = 'cancelado' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Não é possível alterar preço de item cancelado.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.comandas WHERE id = v_item.comanda_id AND status <> 'aberta') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'A comanda já foi fechada por outro operador. Correções financeiras pós-fechamento seguem procedimento próprio.';
  END IF;

  -- Altera preço e justificativa; auditoria antes/depois gravada por audit_business_update
  UPDATE public.comanda_itens
  SET preco_unitario_centavos = p_novo_preco_centavos,
      preco_excepcional = TRUE,
      justificativa_excecao = BTRIM(p_justificativa)
  WHERE id = p_item_id;

  RETURN jsonb_build_object(
    'item_id', p_item_id,
    'preco_anterior_centavos', v_item.preco_unitario_centavos,
    'preco_novo_centavos', p_novo_preco_centavos,
    'quantidade', v_item.quantidade,
    'subtotal_novo_centavos', p_novo_preco_centavos * v_item.quantidade,
    'justificativa', BTRIM(p_justificativa)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.alterar_preco_excepcional_item(UUID, BIGINT, TEXT) TO authenticated;

-- =================================================================================================
-- 13. RPC: ATUALIZAR IDENTIFICAÇÃO DA COMANDA (flexível; não compromete histórico financeiro)
-- =================================================================================================
CREATE OR REPLACE FUNCTION public.atualizar_comanda_identificacao(
  p_comanda_id UUID,
  p_identificacao TEXT,
  p_mesa TEXT,
  p_local_referencia TEXT,
  p_cliente_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_comanda public.comandas%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  SELECT * INTO v_comanda FROM public.comandas WHERE id = p_comanda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Comanda não encontrada.';
  END IF;

  -- Cliente cadastrado só é aceito quando coerente com a comanda aberta;
  -- vínculo obrigatório é checado no fechamento (parcela fiado).
  IF p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Cliente não encontrado.';
    END IF;
  END IF;

  UPDATE public.comandas
  SET identificacao = NULLIF(BTRIM(p_identificacao), ''),
      mesa = NULLIF(BTRIM(p_mesa), ''),
      local_referencia = NULLIF(BTRIM(p_local_referencia), ''),
      cliente_id = p_cliente_id
  WHERE id = p_comanda_id;

  RETURN jsonb_build_object(
    'comanda_id', p_comanda_id,
    'identificacao', p_identificacao,
    'mesa', p_mesa,
    'local_referencia', p_local_referencia,
    'cliente_id', p_cliente_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_comanda_identificacao(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- =================================================================================================
-- 14. RPC: FECHAMENTO ATÔMICO DA COMANDA
-- =================================================================================================
-- Uma única transação: trava a comanda, valida distribuição 100% do valor entre parcelas,
-- gera venda direta (Caixa) para cada parcela não-Fiado, gera consumo (Fiado) para parcela Fiado
-- com vínculo obrigatório de cliente cadastrado, grava comanda_pagamentos e fecha a comanda.
-- Falha em qualquer ponto = rollback total (nenhum registro parcial).
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
  v_pagamento_id UUID;
  v_idx SMALLINT := 0;
  v_descricao_venda TEXT;
  v_ident TEXT;
  v_result JSONB := '[]'::jsonb;
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
      PERFORM public.registrar_consumo_com_credito(
        v_cliente_id,
        v_valor,
        v_comanda.data_movimento,
        'Comanda — ' || v_ident,
        gen_random_uuid()
      );

      SELECT id INTO v_consumo_id
      FROM public.consumos
      WHERE cliente_id = v_cliente_id
        AND valor_centavos = v_valor
        AND descricao = 'Comanda — ' || v_ident
        AND data_movimento = v_comanda.data_movimento
        AND status = 'ativo'
      ORDER BY data_registro DESC
      LIMIT 1;

      INSERT INTO public.comanda_pagamentos (
        comanda_id, parcela_index, forma, valor_centavos, cliente_id, consumo_id,
        data_movimento, data_registro, registrado_por, status, request_id
      ) VALUES (
        p_comanda_id, v_idx, 'fiado', v_valor, v_cliente_id, v_consumo_id,
        v_comanda.data_movimento, NOW(), v_actor, 'ativo', gen_random_uuid()
      ) RETURNING id INTO v_pagamento_id;

      v_result := v_result || jsonb_build_object(
        'parcela', v_idx, 'forma', 'fiado', 'valor_centavos', v_valor,
        'cliente_id', v_cliente_id, 'consumo_id', v_consumo_id
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

GRANT EXECUTE ON FUNCTION public.fechar_comanda(UUID, JSONB, UUID) TO authenticated;

-- =================================================================================================
-- 15. RPC: CANCELAMENTO DE FECHAMENTO DA COMANDA
-- =================================================================================================
-- Regra aprovada:
-- (a) parcelas SEM pagamento posterior no Fiado → cancelamento permitido com reversão consistente;
-- (b) parcela Fiado que JÁ recebeu pagamento posterior → cancelamento automático BLOQUEADO com
--     mensagem clara orientando regularização pelo fluxo do Fiado.
-- Vínculo confiável: comanda_pagamentos.consumo_id aponta para o consumo exato criado no fechamento;
-- um pagamento do cliente posterior a esse consumo é considerado potencialmente vinculado e,
-- adotando BLOQUEIO CONSERVADOR, bloqueia o cancelamento (nunca presuma pertencimento).
-- Nenhuma movimentação é apagada fisicamente: usa-se cancelamento lógico (status) já existente.
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
  v_consumo RECORD;
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

  -- Verifica cada parcela registrada no fechamento
  FOR v_parcela IN
    SELECT * FROM public.comanda_pagamentos
    WHERE comanda_id = p_comanda_id AND status = 'ativo'
    ORDER BY seq
  LOOP
    IF v_parcela.forma = 'fiado' THEN
      -- Dívida gerada no fechamento: pagamentos posteriores do MESMO cliente
      -- ao consumo vinculado (ou qualquer pagamento do cliente depois do consumo,
      -- por BLOQUEIO CONSERVADOR: não presuma que um pagamento pertence a essa dívida)
      SELECT * INTO v_consumo
      FROM public.consumos
      WHERE id = v_parcela.consumo_id
      LIMIT 1;

      IF v_consumo.id IS NULL OR v_consumo.status <> 'ativo' THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = 'A dívida no Fiado desta comanda foi alterada fora do fluxo da comanda. Regularize pelo módulo Fiado antes de cancelar o fechamento.';
      END IF;

      SELECT COUNT(*) INTO v_pagamentos_depois
      FROM public.pagamentos
      WHERE cliente_id = v_parcela.cliente_id
        AND status = 'ativo'
        AND (
          data_movimento > v_consumo.data_movimento
          OR (data_movimento = v_consumo.data_movimento AND seq > v_consumo.seq)
          OR (data_movimento = v_consumo.data_movimento AND seq = v_consumo.seq AND data_registro > v_consumo.data_registro)
        );

      IF v_pagamentos_depois > 0 THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = format('CANCELAMENTO BLOQUEADO: o cliente %s já possui recebimento no Fiado posterior à dívida gerada por esta comanda. Regularize pelo fluxo do Fiado (estorno/correção lá) antes de tentar cancelar o fechamento da comanda.',
            (SELECT nome FROM public.clientes WHERE id = v_parcela.cliente_id));
      END IF;

      -- (a) Sem pagamento posterior: cancela o consumo (reversão consistente pelo recálculo)
      UPDATE public.consumos
      SET status = 'cancelado'
      WHERE id = v_parcela.consumo_id;

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

GRANT EXECUTE ON FUNCTION public.cancelar_fechamento_comanda(UUID, TEXT) TO authenticated;

-- =================================================================================================
-- 16. GRANTS de leitura/escrita nas tabelas novas para authenticated
-- =================================================================================================
GRANT SELECT, INSERT, UPDATE ON public.produtos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.comandas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.comanda_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.comanda_pagamentos TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
