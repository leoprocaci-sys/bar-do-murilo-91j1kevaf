-- Bar do Murilo — Etapa 1 de 6
-- Estrutura relacional, RLS, auditoria e operações administrativas atômicas.
-- Nenhum saldo é calculado nesta etapa.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  username TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  deve_alterar_senha BOOLEAN NOT NULL DEFAULT TRUE,
  perfil TEXT NOT NULL DEFAULT 'administrador',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_users_username_formato CHECK (
    username = LOWER(username)
    AND username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
  ),
  CONSTRAINT app_users_nome_preenchido CHECK (BTRIM(nome) <> ''),
  CONSTRAINT app_users_perfil_valido CHECK (perfil = 'administrador')
);

CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  apelido TEXT,
  telefone TEXT,
  endereco TEXT,
  limite_centavos BIGINT,
  restricao_ativa BOOLEAN NOT NULL DEFAULT FALSE,
  restricao_motivo TEXT,
  restricao_por UUID REFERENCES public.app_users(id) ON DELETE RESTRICT,
  restricao_em TIMESTAMPTZ,
  favorito BOOLEAN NOT NULL DEFAULT FALSE,
  criado_por UUID NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clientes_nome_preenchido CHECK (BTRIM(nome) <> ''),
  CONSTRAINT clientes_limite_nao_negativo CHECK (limite_centavos IS NULL OR limite_centavos >= 0),
  CONSTRAINT clientes_restricao_completa CHECK (
    NOT restricao_ativa OR (
      NULLIF(BTRIM(restricao_motivo), '') IS NOT NULL
      AND restricao_por IS NOT NULL
      AND restricao_em IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS public.consumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  valor_centavos BIGINT NOT NULL,
  descricao TEXT,
  data_movimento DATE NOT NULL,
  data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registrado_por UUID NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ativo',
  request_id UUID NOT NULL UNIQUE,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT consumos_valor_positivo CHECK (valor_centavos > 0),
  CONSTRAINT consumos_status_valido CHECK (status IN ('ativo', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  valor_centavos BIGINT NOT NULL,
  forma TEXT NOT NULL,
  data_movimento DATE NOT NULL,
  data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registrado_por UUID NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ativo',
  request_id UUID NOT NULL UNIQUE,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT pagamentos_valor_positivo CHECK (valor_centavos > 0),
  CONSTRAINT pagamentos_forma_valida CHECK (forma IN ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito')),
  CONSTRAINT pagamentos_status_valido CHECK (status IN ('ativo', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS public.creditos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL,
  valor_centavos BIGINT NOT NULL,
  origem_pagamento_id UUID REFERENCES public.pagamentos(id) ON DELETE RESTRICT,
  movimento_vinculado_id UUID,
  data_movimento DATE NOT NULL,
  data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registrado_por UUID NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ativo',
  request_id UUID NOT NULL UNIQUE,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT creditos_tipo_valido CHECK (tipo IN ('origem', 'utilizacao', 'devolucao')),
  CONSTRAINT creditos_valor_positivo CHECK (valor_centavos > 0),
  CONSTRAINT creditos_status_valido CHECK (status IN ('ativo', 'cancelado'))
);

ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS credito_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pagamentos_credito_id_fkey'
      AND conrelid = 'public.pagamentos'::regclass
  ) THEN
    ALTER TABLE public.pagamentos
      ADD CONSTRAINT pagamentos_credito_id_fkey
      FOREIGN KEY (credito_id) REFERENCES public.creditos(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.vendas_diretas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor_centavos BIGINT NOT NULL,
  forma TEXT NOT NULL,
  data_movimento DATE NOT NULL,
  data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registrado_por UUID NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ativo',
  request_id UUID NOT NULL UNIQUE,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT vendas_diretas_descricao_preenchida CHECK (BTRIM(descricao) <> ''),
  CONSTRAINT vendas_diretas_valor_positivo CHECK (valor_centavos > 0),
  CONSTRAINT vendas_diretas_forma_valida CHECK (forma IN ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito')),
  CONSTRAINT vendas_diretas_status_valido CHECK (status IN ('ativo', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS public.saidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor_centavos BIGINT NOT NULL,
  vinculo_credito_id UUID REFERENCES public.creditos(id) ON DELETE RESTRICT,
  data_movimento DATE NOT NULL,
  data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registrado_por UUID NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ativo',
  request_id UUID NOT NULL UNIQUE,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT saidas_origem_valida CHECK (origem IN ('gaveta', 'conta_pix')),
  CONSTRAINT saidas_descricao_preenchida CHECK (BTRIM(descricao) <> ''),
  CONSTRAINT saidas_valor_positivo CHECK (valor_centavos > 0),
  CONSTRAINT saidas_status_valido CHECK (status IN ('ativo', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS public.retiradas_mercadoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor_centavos BIGINT NOT NULL,
  consumidor TEXT NOT NULL,
  registrado_por UUID NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  data_movimento DATE NOT NULL,
  data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ativo',
  request_id UUID NOT NULL UNIQUE,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT retiradas_descricao_preenchida CHECK (BTRIM(descricao) <> ''),
  CONSTRAINT retiradas_consumidor_preenchido CHECK (BTRIM(consumidor) <> ''),
  CONSTRAINT retiradas_valor_positivo CHECK (valor_centavos > 0),
  CONSTRAINT retiradas_status_valido CHECK (status IN ('ativo', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS public.dinheiro_inicial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  valor_centavos BIGINT NOT NULL DEFAULT 0,
  editado_por UUID NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id UUID NOT NULL UNIQUE,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT dinheiro_inicial_valor_nao_negativo CHECK (valor_centavos >= 0)
);

CREATE TABLE IF NOT EXISTS public.historico_alteracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela TEXT NOT NULL,
  registro_id UUID NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  alterado_por UUID NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  alterado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clientes_nome_idx ON public.clientes (LOWER(nome));
CREATE INDEX IF NOT EXISTS consumos_cliente_data_idx ON public.consumos (cliente_id, data_movimento, seq);
CREATE INDEX IF NOT EXISTS pagamentos_cliente_data_idx ON public.pagamentos (cliente_id, data_movimento, seq);
CREATE INDEX IF NOT EXISTS creditos_cliente_data_idx ON public.creditos (cliente_id, data_movimento, seq);
CREATE INDEX IF NOT EXISTS historico_registro_idx ON public.historico_alteracoes (tabela, registro_id, alterado_em);

COMMENT ON COLUMN public.clientes.limite_centavos IS 'NULL significa sem limite definido; zero e valores positivos são estados distintos.';
COMMENT ON COLUMN public.consumos.seq IS 'Desempate cronológico estável; não representa horário real.';
COMMENT ON COLUMN public.pagamentos.seq IS 'Desempate cronológico estável; não representa horário real.';
COMMENT ON COLUMN public.creditos.seq IS 'Desempate cronológico estável; não representa horário real.';
COMMENT ON COLUMN public.vendas_diretas.seq IS 'Desempate cronológico estável; não representa horário real.';
COMMENT ON COLUMN public.saidas.seq IS 'Desempate cronológico estável; não representa horário real.';
COMMENT ON COLUMN public.retiradas_mercadoria.seq IS 'Desempate cronológico estável; não representa horário real.';
COMMENT ON COLUMN public.dinheiro_inicial.seq IS 'Desempate cronológico estável; não representa horário real.';
COMMENT ON TABLE public.creditos IS 'Livro separado de crédito: origem, utilização e devolução permanecem vinculadas a movimentos reais.';
COMMENT ON TABLE public.retiradas_mercadoria IS 'Não movimenta dinheiro e não gera fiado; consumidor e responsável pelo registro são distintos.';
COMMENT ON TABLE public.dinheiro_inicial IS 'Valor independente por dia, inicia em zero, não herda saldo e não é venda nem receita.';
COMMENT ON TABLE public.historico_alteracoes IS 'Auditoria append-only; escrita exclusiva por funções e gatilhos protegidos.';

CREATE OR REPLACE FUNCTION public.is_active_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    auth.role() = 'authenticated'
    AND p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.app_users AS u
      WHERE u.id = p_user_id
        AND u.ativo = TRUE
        AND u.perfil = 'administrador'
    );
$$;

CREATE OR REPLACE FUNCTION public.touch_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_session_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Usuário não autorizado para registrar dados.';
  END IF;

  NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], v_actor));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_field TEXT;
BEGIN
  FOREACH v_field IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(OLD) -> v_field) IS DISTINCT FROM (to_jsonb(NEW) -> v_field) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = format('O campo de integridade %s não pode ser alterado.', v_field);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_business_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL OR NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Alteração sem responsável autenticado não permitida.';
  END IF;

  INSERT INTO public.historico_alteracoes (
    tabela,
    registro_id,
    dados_anteriores,
    dados_novos,
    alterado_por
  ) VALUES (
    TG_TABLE_NAME,
    OLD.id,
    to_jsonb(OLD),
    to_jsonb(NEW),
    v_actor
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_users_touch_atualizado_em ON public.app_users;
CREATE TRIGGER app_users_touch_atualizado_em
BEFORE UPDATE ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

DROP TRIGGER IF EXISTS clientes_touch_atualizado_em ON public.clientes;
CREATE TRIGGER clientes_touch_atualizado_em
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

DROP TRIGGER IF EXISTS dinheiro_inicial_touch_atualizado_em ON public.dinheiro_inicial;
CREATE TRIGGER dinheiro_inicial_touch_atualizado_em
BEFORE UPDATE ON public.dinheiro_inicial
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

DROP TRIGGER IF EXISTS clientes_set_actor ON public.clientes;
CREATE TRIGGER clientes_set_actor
BEFORE INSERT ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.set_session_actor('criado_por');

DROP TRIGGER IF EXISTS consumos_set_actor ON public.consumos;
CREATE TRIGGER consumos_set_actor
BEFORE INSERT ON public.consumos
FOR EACH ROW EXECUTE FUNCTION public.set_session_actor('registrado_por');

DROP TRIGGER IF EXISTS pagamentos_set_actor ON public.pagamentos;
CREATE TRIGGER pagamentos_set_actor
BEFORE INSERT ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.set_session_actor('registrado_por');

DROP TRIGGER IF EXISTS creditos_set_actor ON public.creditos;
CREATE TRIGGER creditos_set_actor
BEFORE INSERT ON public.creditos
FOR EACH ROW EXECUTE FUNCTION public.set_session_actor('registrado_por');

DROP TRIGGER IF EXISTS vendas_diretas_set_actor ON public.vendas_diretas;
CREATE TRIGGER vendas_diretas_set_actor
BEFORE INSERT ON public.vendas_diretas
FOR EACH ROW EXECUTE FUNCTION public.set_session_actor('registrado_por');

DROP TRIGGER IF EXISTS saidas_set_actor ON public.saidas;
CREATE TRIGGER saidas_set_actor
BEFORE INSERT ON public.saidas
FOR EACH ROW EXECUTE FUNCTION public.set_session_actor('registrado_por');

DROP TRIGGER IF EXISTS retiradas_set_actor ON public.retiradas_mercadoria;
CREATE TRIGGER retiradas_set_actor
BEFORE INSERT ON public.retiradas_mercadoria
FOR EACH ROW EXECUTE FUNCTION public.set_session_actor('registrado_por');

DROP TRIGGER IF EXISTS dinheiro_inicial_set_actor ON public.dinheiro_inicial;
CREATE TRIGGER dinheiro_inicial_set_actor
BEFORE INSERT ON public.dinheiro_inicial
FOR EACH ROW EXECUTE FUNCTION public.set_session_actor('editado_por');

DROP TRIGGER IF EXISTS clientes_protect_integrity ON public.clientes;
CREATE TRIGGER clientes_protect_integrity
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_fields('id', 'criado_por', 'criado_em');

DROP TRIGGER IF EXISTS consumos_protect_integrity ON public.consumos;
CREATE TRIGGER consumos_protect_integrity
BEFORE UPDATE ON public.consumos
FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_fields('id', 'request_id', 'seq', 'registrado_por', 'data_registro');

DROP TRIGGER IF EXISTS pagamentos_protect_integrity ON public.pagamentos;
CREATE TRIGGER pagamentos_protect_integrity
BEFORE UPDATE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_fields('id', 'request_id', 'seq', 'registrado_por', 'data_registro');

DROP TRIGGER IF EXISTS creditos_protect_integrity ON public.creditos;
CREATE TRIGGER creditos_protect_integrity
BEFORE UPDATE ON public.creditos
FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_fields('id', 'request_id', 'seq', 'registrado_por', 'data_registro');

DROP TRIGGER IF EXISTS vendas_diretas_protect_integrity ON public.vendas_diretas;
CREATE TRIGGER vendas_diretas_protect_integrity
BEFORE UPDATE ON public.vendas_diretas
FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_fields('id', 'request_id', 'seq', 'registrado_por', 'data_registro');

DROP TRIGGER IF EXISTS saidas_protect_integrity ON public.saidas;
CREATE TRIGGER saidas_protect_integrity
BEFORE UPDATE ON public.saidas
FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_fields('id', 'request_id', 'seq', 'registrado_por', 'data_registro');

DROP TRIGGER IF EXISTS retiradas_protect_integrity ON public.retiradas_mercadoria;
CREATE TRIGGER retiradas_protect_integrity
BEFORE UPDATE ON public.retiradas_mercadoria
FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_fields('id', 'request_id', 'seq', 'registrado_por', 'data_registro');

DROP TRIGGER IF EXISTS dinheiro_inicial_protect_integrity ON public.dinheiro_inicial;
CREATE TRIGGER dinheiro_inicial_protect_integrity
BEFORE UPDATE ON public.dinheiro_inicial
FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_fields('id', 'data', 'request_id', 'seq', 'data_registro');

DROP TRIGGER IF EXISTS clientes_audit_update ON public.clientes;
CREATE TRIGGER clientes_audit_update
AFTER UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.audit_business_update();

DROP TRIGGER IF EXISTS consumos_audit_update ON public.consumos;
CREATE TRIGGER consumos_audit_update
AFTER UPDATE ON public.consumos
FOR EACH ROW EXECUTE FUNCTION public.audit_business_update();

DROP TRIGGER IF EXISTS pagamentos_audit_update ON public.pagamentos;
CREATE TRIGGER pagamentos_audit_update
AFTER UPDATE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.audit_business_update();

DROP TRIGGER IF EXISTS creditos_audit_update ON public.creditos;
CREATE TRIGGER creditos_audit_update
AFTER UPDATE ON public.creditos
FOR EACH ROW EXECUTE FUNCTION public.audit_business_update();

DROP TRIGGER IF EXISTS vendas_diretas_audit_update ON public.vendas_diretas;
CREATE TRIGGER vendas_diretas_audit_update
AFTER UPDATE ON public.vendas_diretas
FOR EACH ROW EXECUTE FUNCTION public.audit_business_update();

DROP TRIGGER IF EXISTS saidas_audit_update ON public.saidas;
CREATE TRIGGER saidas_audit_update
AFTER UPDATE ON public.saidas
FOR EACH ROW EXECUTE FUNCTION public.audit_business_update();

DROP TRIGGER IF EXISTS retiradas_audit_update ON public.retiradas_mercadoria;
CREATE TRIGGER retiradas_audit_update
AFTER UPDATE ON public.retiradas_mercadoria
FOR EACH ROW EXECUTE FUNCTION public.audit_business_update();

DROP TRIGGER IF EXISTS dinheiro_inicial_audit_update ON public.dinheiro_inicial;
CREATE TRIGGER dinheiro_inicial_audit_update
AFTER UPDATE ON public.dinheiro_inicial
FOR EACH ROW EXECUTE FUNCTION public.audit_business_update();

CREATE OR REPLACE FUNCTION public.admin_change_user_status(
  p_target_user_id UUID,
  p_ativo BOOLEAN
)
RETURNS public.app_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_before public.app_users%ROWTYPE;
  v_after public.app_users%ROWTYPE;
  v_active_count BIGINT;
BEGIN
  IF NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  -- Serializa todas as mudanças de situação. Assim, duas tentativas simultâneas
  -- não conseguem desativar administradores diferentes quando só restariam zero.
  PERFORM pg_advisory_xact_lock(hashtextextended('bar-do-murilo:active-admins', 0));

  SELECT * INTO v_before
  FROM public.app_users
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Usuário não encontrado.';
  END IF;

  IF v_before.ativo = p_ativo THEN
    RETURN v_before;
  END IF;

  IF p_ativo = FALSE AND v_before.ativo = TRUE THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.app_users
    WHERE ativo = TRUE AND perfil = 'administrador';

    IF v_active_count <= 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Não é possível desativar o último administrador ativo.';
    END IF;
  END IF;

  UPDATE public.app_users
  SET ativo = p_ativo
  WHERE id = p_target_user_id
  RETURNING * INTO v_after;

  INSERT INTO public.historico_alteracoes (
    tabela, registro_id, dados_anteriores, dados_novos, alterado_por
  ) VALUES (
    'app_users', p_target_user_id, to_jsonb(v_before), to_jsonb(v_after), v_actor
  );

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_password_reset(p_target_user_id UUID)
RETURNS public.app_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_before public.app_users%ROWTYPE;
  v_after public.app_users%ROWTYPE;
BEGIN
  IF NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo não autorizado.';
  END IF;

  SELECT * INTO v_before
  FROM public.app_users
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Usuário não encontrado.';
  END IF;

  UPDATE public.app_users
  SET deve_alterar_senha = TRUE
  WHERE id = p_target_user_id
  RETURNING * INTO v_after;

  IF to_jsonb(v_before) IS DISTINCT FROM to_jsonb(v_after) THEN
    INSERT INTO public.historico_alteracoes (
      tabela, registro_id, dados_anteriores, dados_novos, alterado_por
    ) VALUES (
      'app_users', p_target_user_id, to_jsonb(v_before), to_jsonb(v_after), v_actor
    );
  END IF;

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_first_access()
RETURNS public.app_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_before public.app_users%ROWTYPE;
  v_after public.app_users%ROWTYPE;
BEGIN
  IF NOT public.is_active_admin(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Usuário não autorizado.';
  END IF;

  SELECT * INTO v_before
  FROM public.app_users
  WHERE id = v_actor AND ativo = TRUE
  FOR UPDATE;

  UPDATE public.app_users
  SET deve_alterar_senha = FALSE
  WHERE id = v_actor
  RETURNING * INTO v_after;

  IF to_jsonb(v_before) IS DISTINCT FROM to_jsonb(v_after) THEN
    INSERT INTO public.historico_alteracoes (
      tabela, registro_id, dados_anteriores, dados_novos, alterado_por
    ) VALUES (
      'app_users', v_actor, to_jsonb(v_before), to_jsonb(v_after), v_actor
    );
  END IF;

  RETURN v_after;
END;
$$;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas_diretas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retiradas_mercadoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dinheiro_inicial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_alteracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_users_select_active_admin ON public.app_users;
CREATE POLICY app_users_select_active_admin ON public.app_users
FOR SELECT TO authenticated
USING (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS clientes_select_active_admin ON public.clientes;
CREATE POLICY clientes_select_active_admin ON public.clientes
FOR SELECT TO authenticated
USING (public.is_active_admin(auth.uid()));
DROP POLICY IF EXISTS clientes_insert_active_admin ON public.clientes;
CREATE POLICY clientes_insert_active_admin ON public.clientes
FOR INSERT TO authenticated
WITH CHECK (public.is_active_admin(auth.uid()) AND criado_por = auth.uid());
DROP POLICY IF EXISTS clientes_update_active_admin ON public.clientes;
CREATE POLICY clientes_update_active_admin ON public.clientes
FOR UPDATE TO authenticated
USING (public.is_active_admin(auth.uid()))
WITH CHECK (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS consumos_select_active_admin ON public.consumos;
CREATE POLICY consumos_select_active_admin ON public.consumos
FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));
DROP POLICY IF EXISTS consumos_insert_active_admin ON public.consumos;
CREATE POLICY consumos_insert_active_admin ON public.consumos
FOR INSERT TO authenticated WITH CHECK (public.is_active_admin(auth.uid()) AND registrado_por = auth.uid());
DROP POLICY IF EXISTS consumos_update_active_admin ON public.consumos;
CREATE POLICY consumos_update_active_admin ON public.consumos
FOR UPDATE TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS pagamentos_select_active_admin ON public.pagamentos;
CREATE POLICY pagamentos_select_active_admin ON public.pagamentos
FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));
DROP POLICY IF EXISTS pagamentos_insert_active_admin ON public.pagamentos;
CREATE POLICY pagamentos_insert_active_admin ON public.pagamentos
FOR INSERT TO authenticated WITH CHECK (public.is_active_admin(auth.uid()) AND registrado_por = auth.uid());
DROP POLICY IF EXISTS pagamentos_update_active_admin ON public.pagamentos;
CREATE POLICY pagamentos_update_active_admin ON public.pagamentos
FOR UPDATE TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS creditos_select_active_admin ON public.creditos;
CREATE POLICY creditos_select_active_admin ON public.creditos
FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));
DROP POLICY IF EXISTS creditos_insert_active_admin ON public.creditos;
CREATE POLICY creditos_insert_active_admin ON public.creditos
FOR INSERT TO authenticated WITH CHECK (public.is_active_admin(auth.uid()) AND registrado_por = auth.uid());
DROP POLICY IF EXISTS creditos_update_active_admin ON public.creditos;
CREATE POLICY creditos_update_active_admin ON public.creditos
FOR UPDATE TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS vendas_diretas_select_active_admin ON public.vendas_diretas;
CREATE POLICY vendas_diretas_select_active_admin ON public.vendas_diretas
FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));
DROP POLICY IF EXISTS vendas_diretas_insert_active_admin ON public.vendas_diretas;
CREATE POLICY vendas_diretas_insert_active_admin ON public.vendas_diretas
FOR INSERT TO authenticated WITH CHECK (public.is_active_admin(auth.uid()) AND registrado_por = auth.uid());
DROP POLICY IF EXISTS vendas_diretas_update_active_admin ON public.vendas_diretas;
CREATE POLICY vendas_diretas_update_active_admin ON public.vendas_diretas
FOR UPDATE TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS saidas_select_active_admin ON public.saidas;
CREATE POLICY saidas_select_active_admin ON public.saidas
FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));
DROP POLICY IF EXISTS saidas_insert_active_admin ON public.saidas;
CREATE POLICY saidas_insert_active_admin ON public.saidas
FOR INSERT TO authenticated WITH CHECK (public.is_active_admin(auth.uid()) AND registrado_por = auth.uid());
DROP POLICY IF EXISTS saidas_update_active_admin ON public.saidas;
CREATE POLICY saidas_update_active_admin ON public.saidas
FOR UPDATE TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS retiradas_select_active_admin ON public.retiradas_mercadoria;
CREATE POLICY retiradas_select_active_admin ON public.retiradas_mercadoria
FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));
DROP POLICY IF EXISTS retiradas_insert_active_admin ON public.retiradas_mercadoria;
CREATE POLICY retiradas_insert_active_admin ON public.retiradas_mercadoria
FOR INSERT TO authenticated WITH CHECK (public.is_active_admin(auth.uid()) AND registrado_por = auth.uid());
DROP POLICY IF EXISTS retiradas_update_active_admin ON public.retiradas_mercadoria;
CREATE POLICY retiradas_update_active_admin ON public.retiradas_mercadoria
FOR UPDATE TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS dinheiro_inicial_select_active_admin ON public.dinheiro_inicial;
CREATE POLICY dinheiro_inicial_select_active_admin ON public.dinheiro_inicial
FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));
DROP POLICY IF EXISTS dinheiro_inicial_insert_active_admin ON public.dinheiro_inicial;
CREATE POLICY dinheiro_inicial_insert_active_admin ON public.dinheiro_inicial
FOR INSERT TO authenticated WITH CHECK (public.is_active_admin(auth.uid()) AND editado_por = auth.uid());
DROP POLICY IF EXISTS dinheiro_inicial_update_active_admin ON public.dinheiro_inicial;
CREATE POLICY dinheiro_inicial_update_active_admin ON public.dinheiro_inicial
FOR UPDATE TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));

DROP POLICY IF EXISTS historico_select_active_admin ON public.historico_alteracoes;
CREATE POLICY historico_select_active_admin ON public.historico_alteracoes
FOR SELECT TO authenticated
USING (public.is_active_admin(auth.uid()));

-- Desativa concessões automáticas para tabelas e rotinas futuras no schema public.
-- Cada objeto desta etapa recebe abaixo somente o privilégio explicitamente necessário.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated;

REVOKE ALL ON TABLE public.app_users, public.clientes, public.consumos, public.pagamentos,
  public.creditos, public.vendas_diretas, public.saidas, public.retiradas_mercadoria,
  public.dinheiro_inicial, public.historico_alteracoes FROM anon;

REVOKE ALL ON TABLE public.app_users, public.clientes, public.consumos, public.pagamentos,
  public.creditos, public.vendas_diretas, public.saidas, public.retiradas_mercadoria,
  public.dinheiro_inicial, public.historico_alteracoes FROM authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.app_users, public.historico_alteracoes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.clientes, public.consumos, public.pagamentos,
  public.creditos, public.vendas_diretas, public.saidas, public.retiradas_mercadoria,
  public.dinheiro_inicial TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

REVOKE ALL ON FUNCTION public.is_active_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.touch_atualizado_em() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_session_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_immutable_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_business_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_change_user_status(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mark_password_reset(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_first_access() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_active_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_user_status(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_password_reset(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_first_access() TO authenticated;
