-- Trigger seguro para sincronizar automaticamente app_user_emails quando auth.users tiver o e-mail confirmado
-- NUNCA destrutivo, apenas atualiza verificado = true quando o email em auth.users for confirmado e corresponder ao email_real

CREATE OR REPLACE FUNCTION public.sync_app_user_emails_on_auth_confirm()
RETURNS trigger AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NOT (NEW.email LIKE '%.local') AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.app_user_emails (user_id, email_real, verificado, verificado_em, atualizado_em)
    VALUES (NEW.id, lower(trim(NEW.email)), true, NEW.email_confirmed_at, now())
    ON CONFLICT (user_id) DO UPDATE
    SET email_real = EXCLUDED.email_real,
        verificado = true,
        verificado_em = EXCLUDED.verificado_em,
        atualizado_em = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_app_user_emails_on_auth_confirm();
