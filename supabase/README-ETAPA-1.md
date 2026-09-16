# Bar do Murilo — registro técnico da Etapa 1

## Escopo

Esta etapa entrega autenticação, gestão de usuários, base de dados e telas principais. **Não há operação financeira disponível**. Fiado e Caixa são apenas entradas de navegação com a mensagem "Disponível na próxima etapa".

## Autenticação e contas iniciais

A fonte única de autenticação é Supabase Auth (e-mail e senha). O navegador recebe somente a chave pública. O e-mail técnico `{username}@bar-do-murilo.local` é montado no login e nunca aparece na interface.

As contas operacionais `murilo`, `esther` e `dani` **não foram inseridas por SQL com senha fixa**. Antes da criação em produção é obrigatório executar, pela API administrativa do Supabase, um teste isolado com endereço `.local`, confirmar que o Auth o aceita e remover a identidade de teste. Depois, um administrador técnico deve criar as três contas com senhas provisórias únicas por meio da função protegida `admin-users`, entregando cada senha fora do chat por canal seguro. Cada identidade é criada com e-mail confirmado e `deve_alterar_senha = true`.

A conta técnica de Leonardo não é uma conta operacional e não recebe linha em `app_users`. Nenhuma senha ou segredo é mantido neste repositório. Se nenhum administrador operacional estiver disponível para recuperar acesso, o responsável técnico deverá usar o painel ou a API administrativa do Supabase; não existe recuperação por e-mail nesta versão.

## Operações administrativas

`admin-users` valida o JWT e consulta `app_users` para exigir administrador ativo antes de usar a service role. A service role existe somente no ambiente da função.

- Criação: unicidade de `username`; repetição devolve o cadastro existente sem criar duplicidade. Se Auth for criado e a linha de `app_users` falhar, a identidade é removida. Se a remoção falhar, ela é banida e a resposta exige limpeza técnica. É compensação segura, não transação distribuída atômica.
- Situação: a RPC `admin_change_user_status` usa `pg_advisory_xact_lock` e bloqueio de linha. A contagem e a mudança são uma única transação, protegendo o último administrador inclusive em solicitações simultâneas. O estado do Auth é sincronizado; falha tenta restaurar o estado de banco anterior.
- Redefinição: senha aleatória é gerada no servidor, retornada uma vez e nunca registrada em logs. A flag força primeiro acesso. Se a flag falhar após mudar o Auth, a identidade é banida para impedir acesso incoerente e requer revisão técnica.

## Dados financeiros preparados, não implementados

Dinheiro usa `bigint` em centavos. Movimentos têm `request_id` único e `seq` identity; `seq` é apenas desempate cronológico estável, não horário real. A data do movimento é distinta do registro. Dívida e crédito têm livros separados; formas de pagamento distinguem dinheiro, Pix, débito e crédito; devolução de crédito pode vincular uma saída real. `dinheiro_inicial` é independente por dia, começa em zero, não herda saldo e não é receita. `retiradas_mercadoria` distingue consumidor de registrador e não movimenta dinheiro nem gera fiado.

Permanecem para as etapas financeiras: regras completas de crédito antes do limite e restrição, recebimento único entre Caixa e Fiado, recálculo encadeado após correções/cancelamentos e o cenário de validação R$ 80 / R$ 100 / R$ 30 / correção para R$ 100. Nada disso é apresentado como saldo funcional nesta etapa.

## Segurança

Todas as dez tabelas têm RLS. `anon` não possui privilégios de tabela. Usuários autenticados só passam pelas políticas se existir `app_users` ativo e administrador para `auth.uid()`. `app_users` não pode ser alterada diretamente pelo navegador. Histórico é append-only para o cliente, e os gatilhos obtêm o responsável de `auth.uid()`, nunca do corpo enviado. Não há DELETE concedido ao cliente.

As concessões automáticas futuras de tabelas e funções no schema `public` foram revogadas para os papéis de navegador; cada novo objeto deve receber privilégios explícitos. O event trigger `ensure_rls` do ambiente também habilita RLS automaticamente em novas tabelas públicas.

## Itens externos que exigem confirmação manual

- Confirmar no painel da organização **Bar do Murilo** que o projeto conectado se chama **Bar-do-murilo**, sua região é São Paulo e anotar o project ref/URL. A integração de banco confirmou o banco conectado, mas metadados de organização/nome/região não são expostos por SQL.
- Confirmar no painel em API Settings que a Data API está ativada. O acesso de migração não expõe esse seletor. A exposição automática foi restringida no banco por privilégios padrão, mas o seletor de painel também deve ser conferido.
- Realizar o teste de aceitação `.local` antes de criar Murilo, Esther e Dani; criar suas contas e entregar senhas por canal seguro.
- A futura entrega/controle da conta administrativa do bar ao Murilo **não foi realizada**. Deve ser planejada com troca segura de credenciais, MFA, códigos de recuperação e revisão de membros.
- Titularidade do projeto do app, hospedagem e domínio não é comprovada pela titularidade do Supabase e não pôde ser transferida nesta etapa. Definir responsáveis e registrar a entrega separadamente.
- Na versão publicada, verificar a configuração oficial **Esconder Selo Skip**. Está pendente até existir publicação verificável.
