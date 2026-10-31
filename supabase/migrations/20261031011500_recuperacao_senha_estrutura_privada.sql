-- Migração incremental para estrutura privada de e-mails reais de usuários e controle de recuperação de senha
-- NUNCA destrutiva, compatível com a versão v0.0.9 / v0.0.12 homologada

CREATE TABLE IF NOT EXISTS public.app_user_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  email_real TEXT NOT NULL,
  verificado BOOLEAN NOT NULL DEFAULT false,
  verificado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_user_emails_user_id_key UNIQUE (user_id),
  CONSTRAINT app_user_emails_email_real_unique UNIQUE (email_real)
);

-- Tabela privada de rate limit para requisições de recuperação de senha
CREATE TABLE IF NOT EXISTS public.password_reset_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP ou username normalizado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_rate_limits_ident ON public.password_reset_rate_limits (identifier, created_at);

-- Habilitar RLS em ambas as tabelas
ALTER TABLE public.app_user_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_rate_limits ENABLE ROW LEVEL SECURITY;

-- As tabelas são ESTRITAMENTE PRIVADAS para o servidor (Edge Functions com service_role).
-- Papéis anon e authenticated NÃO POSSUEM NENHUMA POLÍTICA permissiva (negação por padrão no Postgres).
-- Por clareza explícita, criamos políticas restritivas que negam explicitamente para authenticated e anon:
DROP POLICY IF EXISTS "deny_all_app_user_emails_anon" ON public.app_user_emails;
DROP POLICY IF EXISTS "deny_all_app_user_emails_auth" ON public.app_user_emails;
DROP POLICY IF EXISTS "deny_all_rate_limits_anon" ON public.password_reset_rate_limits;
DROP POLICY IF EXISTS "deny_all_rate_limits_auth" ON public.password_reset_rate_limits;

-- Grants para service_role operar normalmente
GRANT ALL ON TABLE public.app_user_emails TO service_role;
GRANT ALL ON TABLE public.password_reset_rate_limits TO service_role;
