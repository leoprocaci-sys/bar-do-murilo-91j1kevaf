-- LIMPEZA 1 — ETAPA 1: BACKUP (somente leitura dos dados atuais; nada é apagado aqui)
--
-- Cria o schema interno backup_limpeza_1 com cópia integral das 9 tabelas operacionais
-- com dados fictícios. O schema fica FORA do alcance da Data API do aplicativo:
--  * não está na lista de schemas expostos do PostgREST;
--  * USAGE/CREATE revogados de anon/authenticated;
--  * RLS habilitado nas cópias, sem política nenhuma (ninguém lê via API).
--
-- Restauração (ordem inversa das dependências), TODA em uma única transação:
--   BEGIN;
--   -- 1) tabelas sem dependência entre si:
--   INSERT INTO public.clientes OVERRIDING SYSTEM VALUE SELECT * FROM backup_limpeza_1.clientes;
--   INSERT INTO public.vendas_diretas  OVERRIDING SYSTEM VALUE SELECT * FROM backup_limpeza_1.vendas_diretas;
--   INSERT INTO public.retiradas_mercadoria OVERRIDING SYSTEM VALUE SELECT * FROM backup_limpeza_1.retiradas_mercadoria;
--   INSERT INTO public.dinheiro_inicial OVERRIDING SYSTEM VALUE SELECT * FROM backup_limpeza_1.dinheiro_inicial;
--   -- 2) ciclo pagamentos<->creditos: insere com as colunas de vínculo nulas...
--   INSERT INTO public.pagamentos (id, cliente_id, valor_centavos, forma, data_movimento, data_registro,
--                                  registrado_por, status, request_id, seq)
--     OVERRIDING SYSTEM VALUE
--     SELECT id, cliente_id, valor_centavos, forma, data_movimento, data_registro,
--            registrado_por, status, request_id, seq FROM backup_limpeza_1.pagamentos;
--   INSERT INTO public.creditos (id, cliente_id, tipo, valor_centavos, origem_pagamento_id, movimento_vinculado_id,
--                                data_movimento, data_registro, registrado_por, status, request_id, seq)
--     OVERRIDING SYSTEM VALUE
--     SELECT id, cliente_id, tipo, valor_centavos, NULL, movimento_vinculado_id,
--            data_movimento, data_registro, registrado_por, status, request_id, seq FROM backup_limpeza_1.creditos;
--   -- 3) demais dependentes:
--   INSERT INTO public.saidas (id, origem, descricao, valor_centavos, vinculo_credito_id, data_movimento,
--                              data_registro, registrado_por, status, request_id, seq)
--     OVERRIDING SYSTEM VALUE
--     SELECT id, origem, descricao, valor_centavos, vinculo_credito_id, data_movimento,
--            data_registro, registrado_por, status, request_id, seq FROM backup_limpeza_1.saidas;
--   INSERT INTO public.consumos OVERRIDING SYSTEM VALUE SELECT * FROM backup_limpeza_1.consumos;
--   INSERT INTO public.historico_alteracoes OVERRIDING SYSTEM VALUE SELECT * FROM backup_limpeza_1.historico_alteracoes;
--   -- 4) religa o ciclo pagamentos<->creditos e confere:
--   UPDATE public.creditos c SET origem_pagamento_id = b.origem_pagamento_id
--     FROM backup_limpeza_1.creditos b WHERE c.id = b.id AND b.origem_pagamento_id IS NOT NULL;
--   UPDATE public.pagamentos p SET credito_id = b.credito_id
--     FROM backup_limpeza_1.pagamentos b WHERE p.id = b.id AND b.credito_id IS NOT NULL;
--   -- 5) realinha as sequências identity (GENERATED ALWAYS):
--   SELECT setval(pg_get_serial_sequence('public.consumos','seq'), (SELECT max(seq) FROM public.consumos));
--   SELECT setval(pg_get_serial_sequence('public.pagamentos','seq'), (SELECT max(seq) FROM public.pagamentos));
--   SELECT setval(pg_get_serial_sequence('public.creditos','seq'), (SELECT max(seq) FROM public.creditos));
--   SELECT setval(pg_get_serial_sequence('public.vendas_diretas','seq'), (SELECT max(seq) FROM public.vendas_diretas));
--   SELECT setval(pg_get_serial_sequence('public.saidas','seq'), (SELECT max(seq) FROM public.saidas));
--   SELECT setval(pg_get_serial_sequence('public.retiradas_mercadoria','seq'), (SELECT max(seq) FROM public.retiradas_mercadoria));
--   SELECT setval(pg_get_serial_sequence('public.dinheiro_inicial','seq'), (SELECT max(seq) FROM public.dinheiro_inicial));
--   COMMIT;
--
-- Idempotente: se as cópias já existirem com registros, a etapa é pulada (nunca sobrescreve um backup bom).
-- A migração SÓ é aplicada se as contagens do backup conferirem com as originais no momento da cópia;
-- qualquer divergência levanta exceção e a migração inteira falha, sem excluir nada.

CREATE SCHEMA IF NOT EXISTS backup_limpeza_1;

REVOKE ALL ON SCHEMA backup_limpeza_1 FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS backup_limpeza_1._controles (
  tabela text PRIMARY KEY,
  contagem_origem bigint NOT NULL,
  contagem_backup bigint NOT NULL,
  conferido_em timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  t text;
  n_origem bigint;
  n_backup bigint;
BEGIN
  -- Cópias integrais (somente se ainda não existirem)
  IF to_regclass('backup_limpeza_1.clientes') IS NULL THEN
    CREATE TABLE backup_limpeza_1.clientes AS SELECT * FROM public.clientes ORDER BY id;
  END IF;
  IF to_regclass('backup_limpeza_1.consumos') IS NULL THEN
    CREATE TABLE backup_limpeza_1.consumos AS SELECT * FROM public.consumos ORDER BY id;
  END IF;
  IF to_regclass('backup_limpeza_1.pagamentos') IS NULL THEN
    CREATE TABLE backup_limpeza_1.pagamentos AS SELECT * FROM public.pagamentos ORDER BY id;
  END IF;
  IF to_regclass('backup_limpeza_1.creditos') IS NULL THEN
    CREATE TABLE backup_limpeza_1.creditos AS SELECT * FROM public.creditos ORDER BY id;
  END IF;
  IF to_regclass('backup_limpeza_1.vendas_diretas') IS NULL THEN
    CREATE TABLE backup_limpeza_1.vendas_diretas AS SELECT * FROM public.vendas_diretas ORDER BY id;
  END IF;
  IF to_regclass('backup_limpeza_1.saidas') IS NULL THEN
    CREATE TABLE backup_limpeza_1.saidas AS SELECT * FROM public.saidas ORDER BY id;
  END IF;
  IF to_regclass('backup_limpeza_1.retiradas_mercadoria') IS NULL THEN
    CREATE TABLE backup_limpeza_1.retiradas_mercadoria AS SELECT * FROM public.retiradas_mercadoria ORDER BY id;
  END IF;
  IF to_regclass('backup_limpeza_1.dinheiro_inicial') IS NULL THEN
    CREATE TABLE backup_limpeza_1.dinheiro_inicial AS SELECT * FROM public.dinheiro_inicial ORDER BY id;
  END IF;
  IF to_regclass('backup_limpeza_1.historico_alteracoes') IS NULL THEN
    CREATE TABLE backup_limpeza_1.historico_alteracoes AS SELECT * FROM public.historico_alteracoes ORDER BY id;
  END IF;

  -- Verificação EFETIVA: contagem de cada backup tem que bater com a origem AGORA.
  FOREACH t IN ARRAY ARRAY[
    'clientes','consumos','pagamentos','creditos','vendas_diretas',
    'saidas','retiradas_mercadoria','dinheiro_inicial','historico_alteracoes'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n_origem;
    EXECUTE format('SELECT count(*) FROM backup_limpeza_1.%I', t) INTO n_backup;
    IF n_backup <> n_origem THEN
      RAISE EXCEPTION 'BACKUP DIVERGENTE em %: origem=% backup=% — migração abortada, nada foi excluído', t, n_origem, n_backup;
    END IF;
    INSERT INTO backup_limpeza_1._controles (tabela, contagem_origem, contagem_backup)
    VALUES (t, n_origem, n_backup)
    ON CONFLICT (tabela) DO NOTHING;
  END LOOP;

  -- Fora do alcance da Data API, em camada dupla: RLS sem políticas + revogação no schema.
  FOREACH t IN ARRAY ARRAY[
    'clientes','consumos','pagamentos','creditos','vendas_diretas',
    'saidas','retiradas_mercadoria','dinheiro_inicial','historico_alteracoes','_controles'
  ] LOOP
    EXECUTE format('ALTER TABLE backup_limpeza_1.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON backup_limpeza_1.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

COMMENT ON SCHEMA backup_limpeza_1 IS
  'Backup integral da LIMPEZA 1 (dados fictícios), 2026-11-03. Restauração: INSERT ... OVERRIDING SYSTEM VALUE em ordem inversa de dependência (clientes -> vendas_diretas/retiradas/dinheiro_inicial -> pagamentos+creditos com vínculos nulos -> saidas -> consumos -> historico_alteracoes -> UPDATE religa pagamentos/creditos -> setval das sequences identity). Veja o cabeçalho da migração 20261103_backup_limpeza_1.sql.';
