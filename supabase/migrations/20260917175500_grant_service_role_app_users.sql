-- Concede permissões necessárias para o service_role em public.app_users e public.historico_alteracoes
-- Na etapa 1 (20260916151000), o REVOKE ALL removeu SELECT, INSERT, UPDATE do service_role nessas tabelas,
-- fazendo com que chamadas de backend usando service_role falhassem com erro 42501 (permission denied for table app_users).
-- Além disso, a policy de SELECT em app_users só permitia a role authenticated, bloqueando leituras via RLS.

GRANT ALL ON TABLE public.app_users TO service_role;
GRANT ALL ON TABLE public.historico_alteracoes TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
