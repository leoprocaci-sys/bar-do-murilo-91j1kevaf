# Procedimento Operacional Seguro — Limpeza de Dados de Teste

**Sistema:** Bar do Murilo — Gestão de Fiado e Caixa  
**Ambiente de Banco:** Supabase Postgres (`ztklopvxewgftacxvive.supabase.co`)  
**Data do Documento:** 31 de Outubro de 2026  
**Status:** HOMOLOGAÇÃO / PREPARAÇÃO PARA OPERAÇÃO REAL  
**Atenção:** ESTE DOCUMENTO É ESTRITAMENTE INFORMATIVO E DE PLANEJAMENTO. **NENHUM DADO FOI APAGADO NESTA ETAPA.**

---

## 1. Objetivo

Definir a sequência controlada e segura para expurgar registros fictícios/gerados durante as baterias de testes de desenvolvimento e homologação (movimentações de caixa, vendas diretas, despesas, consumos fiados, pagamentos e créditos de teste), preservando integralmente:

1. Contas de usuários administradores homologados (`app_users` e `auth.users`).
2. Configurações de acesso, permissões e estrutura RLS.
3. Clientes legítimos cadastrados (ou permitir limpeza seletiva caso o cliente seja meramente um mock de teste).
4. Integridade relacional de Foreign Keys e integridade contábil das tabelas de auditoria.

---

## 2. Inventário de Tabelas e Mapeamento de Dependências (FKs)

O modelo relacional do Bar do Murilo possui regras de integridade estritas. A exclusão de registros deve respeitar a ordem inversa de dependência para evitar violação de constraints (`violates foreign key constraint`).

### 2.1. Tabelas Operacionais Financeiras

- **`consumos`**: Registros de consumo a prazo (fiado).
  - _FKs:_ `cliente_id` → `clientes(id)`, `registrado_por` → `app_users(id)`
- **`pagamentos`**: Quitações de fiado.
  - _FKs:_ `cliente_id` → `clientes(id)`, `registrado_por` → `app_users(id)`, `credito_id` → `creditos(id)`
- **`creditos`**: Créditos excedentes gerados e utilizados.
  - _FKs:_ `cliente_id` → `clientes(id)`, `origem_pagamento_id` → `pagamentos(id)`, `registrado_por` → `app_users(id)`
  - _Atenção:_ Existe dependência cruzada entre `pagamentos` e `creditos`.
- **`saidas`**: Despesas da gaveta ou conta/Pix e devoluções em dinheiro/Pix.
  - _FKs:_ `vinculo_credito_id` → `creditos(id)`, `registrado_por` → `app_users(id)`
- **`vendas_diretas`**: Vendas à vista no balcão (Dinheiro, Pix, Cartão).
  - _FKs:_ `registrado_por` → `app_users(id)`
- **`retiradas_mercadoria`**: Consumos internos dos responsáveis (Murilo, Esther, Danny, etc.).
  - _FKs:_ `registrado_por` → `app_users(id)`
- **`dinheiro_inicial`**: Valor de abertura do dia no caixa físico.
  - _FKs:_ `editado_por` → `app_users(id)`

### 2.2. Tabelas de Cadastro e Suporte

- **`clientes`**: Cadastros de clientes do bar.
  - _FKs:_ `criado_por` → `app_users(id)`, `restricao_por` → `app_users(id)`
- **`historico_alteracoes`**: Log de auditoria disparado por triggers (`audit_business_update`).
  - _FKs:_ `alterado_por` → `app_users(id)`, `registro_id` (UUID genérico).

### 2.3. Tabelas de Usuários e Segurança (NÃO TOCAR)

- **`app_users`**: Perfis de administradores (Murilo, Esther, Leo, Danny).
- **`auth.users`**: Identidades GoTrue no Supabase.
- **`app_user_emails`**: Tabela privada de e-mails reais de recuperação.
- **`password_reset_rate_limits`**: Tabela privada de controle de taxa de requisições.

---

## 3. Estratégia de Backup Prévio Obrigatório

Antes de disparar qualquer instrução DDL ou DML de exclusão:

1. **Snapshot Completo do Banco via Supabase Dashboard / CLI:**
   - Acessar o projeto `ztklopvxewgftacxvive`.
   - Gerar dump lógico do schema e dados:
     ```bash
     supabase db dump --project-ref ztklopvxewgftacxvive -f backup_pre_limpeza_$(date +%Y%m%d_%H%M%S).sql
     ```
2. **Exportação de Tabelas Críticas em CSV/JSON:**
   - Salvar cópia local de `app_users`, `clientes`, `consumos`, `pagamentos`, `creditos`, `vendas_diretas`, `saidas`, `retiradas_mercadoria`, `dinheiro_inicial`.

---

## 4. Roteiro de Exclusão Passo a Passo (Ordem de Dependências)

Quando for autorizada a limpeza dos dados fictícios, a execução deve ser feita em um bloco transacional (`BEGIN ... COMMIT`) via SQL direto no Supabase SQL Editor:

```sql
BEGIN;

-- 1. Remover dependências circulares entre pagamentos e créditos
UPDATE public.pagamentos SET credito_id = NULL WHERE credito_id IS NOT NULL;
UPDATE public.saidas SET vinculo_credito_id = NULL WHERE vinculo_credito_id IS NOT NULL;

-- 2. Limpeza das movimentações financeiras de caixa
DELETE FROM public.vendas_diretas;
DELETE FROM public.saidas;
DELETE FROM public.retiradas_mercadoria;
DELETE FROM public.dinheiro_inicial;

-- 3. Limpeza das movimentações do fiado
DELETE FROM public.consumos;
DELETE FROM public.creditos;
DELETE FROM public.pagamentos;

-- 4. Limpeza opcional do histórico de auditoria gerado nos testes
DELETE FROM public.historico_alteracoes;

-- 5. Limpeza de clientes fictícios de teste (caso deseje remover apenas clientes de teste)
-- Exemplo: manter apenas clientes reais se houver, ou remover todos para reiniciar o balcão do zero:
-- DELETE FROM public.clientes;

-- 6. Limpeza de logs de rate limit de recuperação de senha gerados em testes
DELETE FROM public.password_reset_rate_limits;

COMMIT;
```

---

## 5. Controles de Preservação Estrutural

- **NÃO EXECUTAR `DROP TABLE` ou `TRUNCATE TABLE ... CASCADE`** que atinja `app_users` ou `auth.users`.
- Manter intocados os registros de:
  - `murilo` (`2756b93f-788f-4f8e-98e8-28b02cf4c434`)
  - `esther` (`debeb632-d928-495a-9d25-260275543973`)
  - `leo` (`303124ed-7e6e-46f6-bbe3-c33c793aaf7b`)
  - `danny` (`de325633-a9ee-4923-a105-66837d93945d`)
- Garantir que as funções PL/pgSQL e triggers de auditoria permaneçam íntegras.

---

## 6. Bateria de Testes Pós-Limpeza (Validação de Operação)

Após a limpeza ser executada em etapa futura, o operador deverá realizar os seguintes testes de conferência:

1. **Autenticação:**
   - Logar com usuário `murilo`, `esther` e `leo`.
   - Confirmar que as senhas e perfis continuam válidos.
2. **Caixa do Dia:**
   - Acessar `/caixa`.
   - Definir dinheiro inicial da gaveta (ex.: R$ 100,00).
   - Registrar uma venda no balcão em dinheiro e uma em Pix.
   - Confirmar que o saldo da gaveta é calculado com precisão e sem resíduos anteriores.
3. **Fiado:**
   - Cadastrar um novo cliente no balcão.
   - Registrar um consumo fiado.
   - Registrar um pagamento total com quitação.
   - Acessar `/fiado/relatorios` e confirmar que o consolidado inicializa em R$ 0,00.
4. **Relatórios Financeiros:**
   - Conferir `/caixa/relatorios` para dia, semana e mês: todos os totais devem refletir estritamente as novas operações.
