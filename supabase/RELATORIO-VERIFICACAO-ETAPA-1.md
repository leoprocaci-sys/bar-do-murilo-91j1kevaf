# Relatório de verificação — Etapa 1 de 6

Data técnica da execução: 16/09/2026.

## 1. Implementado efetivamente

- Migração aplicada com dez tabelas públicas, vínculos, validações, índices, RLS, auditoria e RPCs administrativas.
- Edge function `admin-users` implantada para cadastro, redefinição, desativação e reativação.
- Autenticação única com Supabase Auth, entrada por nome de usuário e conversão interna para o domínio técnico.
- Primeiro acesso obrigatório, gestão de usuários, proteção de rotas, saída, tela principal e páginas reais `/login`, `/primeiro-acesso`, `/`, `/fiado`, `/caixa`, `/usuarios` e `/usuarios/novo`.
- Logo anexada usada diretamente. Fiado e Caixa não possuem operações nem dados demonstrativos.

## 2. Supabase e vinculação

Confirmado por execução no backend conectado:

- Banco PostgreSQL acessível para inspeção e migração; migração aplicada e esquema relido no mesmo destino.
- Auth por e-mail habilitado.
- Schema público estava vazio antes da etapa; agora contém as dez tabelas previstas.
- Há event trigger ativo `ensure_rls`, executando `rls_auto_enable` após DDL.
- Não existiam migrações, usuários Auth ou funções implantadas antes desta execução.

Não verificável pelas interfaces técnicas disponíveis nesta execução:

- O nome exibido da organização **Bar do Murilo**, o nome exibido do projeto **Bar-do-murilo**, a região São Paulo, o project ref e a URL pública não foram expostos por SQL nem pelo cliente gerado (que lê variáveis de ambiente sem valores legíveis por esta ferramenta). Portanto, esses metadados **não são declarados como confirmados**.
- A opção de painel “Data API ativada” e o seletor de “exposição automática de novas tabelas” não são expostos pelas ferramentas. O banco foi protegido adicionalmente com revogação de privilégios padrão para `anon` e `authenticated`, impedindo acesso automático a novas tabelas, mas a opção visual do painel segue pendente de conferência.

Procedimento manual obrigatório: no Dashboard Supabase, abrir a organização Bar do Murilo e o projeto Bar-do-murilo; conferir em General Settings o project ref e a região South America (São Paulo); conferir em API Settings a URL usada pelo app, a Data API e os schemas expostos; conferir o fluxo de criação de tabelas/RLS. Comparar a URL com `VITE_SUPABASE_URL` da implantação sem publicar chaves.

## 3. Segurança e permissões

Inspeção executada após a migração:

- RLS ativo em todas as dez tabelas.
- 26 políticas explícitas no total: somente leitura de `app_users` e histórico; leitura/inserção/atualização nas tabelas de dados; nenhuma política DELETE.
- `anon` sem SELECT nem INSERT em todas as tabelas; `authenticated` sem DELETE em todas.
- A condição central exige JWT autenticado e linha `app_users` ativa com perfil administrador.
- Usuário Auth sem linha operacional e usuário inativo não satisfazem RLS.
- Escrita direta do navegador em `app_users` e `historico_alteracoes` não é concedida.
- Triggers de atualização guardam OLD/NEW e obtêm o responsável de `auth.uid()`.
- Proteção do último administrador usa advisory transaction lock antes de contar e alterar.
- Service role somente na edge function; nenhuma credencial privilegiada foi escrita no front-end.

## 4. Estrutura de dados

- `app_users` referencia exatamente `auth.users`; username único/minúsculo, nome, ativo, flag de senha, perfil único administrador e timestamps.
- `clientes` diferencia limite nulo, zero e positivo; inclui restrição completa, responsável/data e favorito compartilhado.
- `consumos`, `pagamentos`, `creditos`, `vendas_diretas`, `saidas`, `retiradas_mercadoria` e `dinheiro_inicial` usam centavos inteiros, datas distintas do registro, autoria, `request_id` único e `seq` para desempate estável.
- Pagamentos distinguem dinheiro, Pix, débito e crédito. Crédito permanece separado da dívida e vincula origem/uso/devolução a movimentos reais. Saída pode referenciar devolução de crédito.
- Histórico é append-only para o cliente e preserva dados anteriores/novos e autor.

## 5. Acesso, primeiro acesso e recuperação

- Login mostra somente nome de usuário/senha e usa Supabase Auth; o e-mail técnico não aparece.
- Credencial inválida usa exatamente “Nome de usuário ou senha incorretos. Tente novamente.”; falha técnica recebe mensagem distinta e neutra.
- Senha provisória gerada criptograficamente no servidor, exibida uma vez e não registrada em logs/código. O usuário deve definir senha de no mínimo oito caracteres antes de navegar.
- Cadastro via Auth Admin cria e-mail confirmado e compensa falha posterior removendo a identidade; falha dessa remoção bloqueia a identidade e sinaliza revisão.
- Redefinição exige administrador ativo; sem administrador disponível, a recuperação depende do responsável técnico pelo painel/API. Não existe “esqueci minha senha” por e-mail.

## 6. Testes executados, resultados e limitações

Executados e aprovados:

- Aplicação da migração e releitura das tabelas/constraints/triggers/policies no backend.
- Inspeção dos privilégios: visitante sem leitura/gravação; autenticado sem exclusão; RLS em 100% das tabelas.
- Confirmação do event trigger de RLS automático ativo.
- Implantação da edge function.
- QA automatizado completo: configuração, análise estática, TypeScript, build e testes, sem falhas.
- Inspeção de estado confirmou zero contas e zero dados fictícios antes da entrega; não há resíduos para retirada.
- Revisão estrutural mobile-first: coluna limitada a 480 px, alvos de pelo menos 48 px e sem overflow horizontal.

Não executados de forma confiável, portanto **não considerados validados por teste de ponta a ponta**:

- Teste de aceitação do domínio `.local`, login válido/incorreto, primeiro acesso e persistência após recarga: não havia conta operacional nem um canal seguro para entregar senha provisória. Criar conta com senha conhecida no chat/migração violaria o requisito de segurança.
- Cadastro/repetição, redefinição, desativação/reativação e compensação induzida: dependem do primeiro administrador autenticado e de falha controlada de Auth/banco.
- Proteção do último administrador em operação normal e sob chamadas simultâneas: implementada e inspecionada, mas não marcada como testada sem contas operacionais.
- Bloqueio do visitante e de autenticado sem autorização foi validado por privilégios/políticas, não por requisição HTTP externa.
- Navegação visual em dispositivo real não foi testada; conformidade foi revisada no código/build.

## 7. Dependências e ações manuais

1. Confirmar manualmente organização, projeto, região, ref/URL, Data API e opções de exposição no Dashboard conforme seção 2.
2. Pela API administrativa, criar uma identidade temporária `.local` com e-mail confirmado e senha aleatória; testar o login; remover imediatamente a identidade. Se o Auth rejeitar `.local`, interromper a criação das contas e ajustar a política de e-mail do projeto — não trocar o domínio por conta própria.
3. Após aceitação, inicializar com segurança o primeiro administrador e usar a interface/função para cadastrar `murilo`, `esther` e `dani`, cada qual com senha provisória única entregue fora do chat. A bootstrap inicial precisa ser realizado pelo responsável técnico via Auth Admin e inserção controlada correspondente em `app_users`, pois a função corretamente exige um administrador operacional já ativo.
4. Executar o roteiro E2E pendente acima, usando dados fictícios claramente identificados, e removê-los de forma controlada ao final.
5. Definir e documentar titularidade do projeto do app, hospedagem e domínio. Titularidade do Supabase não transfere automaticamente esses ativos.
6. A futura entrega/controle da conta administrativa do bar ao Murilo **não foi realizada**. Planejar separadamente, com MFA, troca de credenciais, códigos de recuperação e revisão de membros.
7. Verificar “Esconder Selo Skip” somente na versão publicada; permanece pendente.

## 8. Problemas concretos antes da Etapa 2

- Metadados do projeto Supabase e configurações de painel ainda precisam de confirmação manual.
- Falta o bootstrap seguro do primeiro administrador e o teste obrigatório de aceitação `.local`.
- Falta executar todo o roteiro E2E autenticado e concorrente com credenciais entregues fora do chat.
- Recálculo encadeado e o cenário R$ 80 / R$ 100 / R$ 30 / correção para R$ 100 pertencem às etapas financeiras e permanecem pendentes, sem implementação antecipada.

## 9. Necessidade de nova execução

Será necessária uma execução de configuração/verificação com acesso ao Dashboard/API administrativa e canal seguro de credenciais antes de considerar a integração operacional integralmente validada. A base e o aplicativo da Etapa 1 estão implementados; não se deve iniciar a Etapa 2 até concluir os itens concretos da seção 8.
