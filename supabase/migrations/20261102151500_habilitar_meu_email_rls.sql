-- Migração incremental para RLS de app_user_emails permitindo cada usuário consultar e gerenciar SOMENTE o seu próprio registro
-- Não destrutiva, preserva a estrutura da v0.0.14 e o compartilhamento entre preview e produção

-- 1. Permite ao usuário autenticado consultar apenas o seu próprio registro
DROP POLICY IF EXISTS "app_user_emails_select_own" ON public.app_user_emails;
CREATE POLICY "app_user_emails_select_own" ON public.app_user_emails
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Permite ao usuário autenticado inserir apenas o seu próprio registro
DROP POLICY IF EXISTS "app_user_emails_insert_own" ON public.app_user_emails;
CREATE POLICY "app_user_emails_insert_own" ON public.app_user_emails
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND verificado = false);

-- 3. Permite ao usuário autenticado atualizar apenas o seu próprio registro
-- (não permite auto-marcar verificado = true via client; verificação permanece restrita ou sincronizada)
DROP POLICY IF EXISTS "app_user_emails_update_own" ON public.app_user_emails;
CREATE POLICY "app_user_emails_update_own" ON public.app_user_emails
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND verificado = false);

-- 4. Função segura e restrita para checar disponibilidade de e-mail (retorna apenas booleano, sem expor quem é o dono)
CREATE OR REPLACE FUNCTION public.check_email_disponivel(p_email text)
RETURNS boolean AS $$
DECLARE
  v_normalized text;
  v_exists boolean;
BEGIN
  v_normalized := lower(trim(p_email));
  IF v_normalized IS NULL OR v_normalized = '' THEN
    RETURN false;
  END IF;

  -- Checa se já existe em app_user_emails para OUTRO usuário
  SELECT EXISTS (
    SELECT 1 FROM public.app_user_emails
    WHERE lower(email_real) = v_normalized
      AND user_id != auth.uid()
  ) INTO v_exists;

  IF v_exists THEN
    RETURN false;
  END IF;

  -- Checa também se já existe em auth.users para OUTRO usuário
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = v_normalized
      AND id != auth.uid()
  ) INTO v_exists;

  IF v_exists THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_email_disponivel(text) TO authenticated;
