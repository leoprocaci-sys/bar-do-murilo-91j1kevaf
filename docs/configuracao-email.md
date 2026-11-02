# Configuração de E-mail Transacional e URLs — Bar do Murilo

Este documento fornece as instruções exatas e sem riscos para o Administrador configurar o envio real de mensagens de recuperação e confirmação de e-mail no painel do Supabase.

---

## 1. Contexto e Segurança

- **Situação Atual das Contas:** Todas as contas atuais (`murilo`, `esther`, `leo`) utilizam e-mails técnicos `@bar-do-murilo.local`.
- **Login por Usuário e Senha:** A autenticação do bar continua sendo feita normalmente por nome de usuário e senha através da Edge Function `user-login`.
- **Fonte de Verdade:** O Supabase Auth (`auth.users`) é a autoridade de autenticação. A vinculação de e-mail só é considerada efetiva quando o endereço for confirmado legitimamente (`email_confirmed_at`).
- **Redefinição Administrativa:** Enquanto o e-mail real não for confirmado ou o SMTP não estiver ativo, os administradores continuam podendo redefinir senhas provisórias na tela **/usuarios** sem nenhum bloqueio de acesso.

---

## 2. Dependência de "Secure Email Change" no Supabase Auth

Por padrão, a opção **Secure Email Change** vem habilitada no Supabase.

### O que acontece exatamente:

Quando um usuário logado solicita a troca de e-mail através de `supabase.auth.updateUser({ email })`:

1. Com **Secure Email Change HABILITADO**:
   - O Supabase envia um link de confirmação para o **NOVO** e-mail informado E TAMBÉM um link de confirmação para o **E-MAIL ANTIGO**.
   - Como o e-mail antigo das contas atuais é `@bar-do-murilo.local` (um domínio fictício interno inalcançável), **a mensagem enviada para o e-mail antigo nunca será recebida nem clicada**.
   - Consequência: A alteração permanece pendente indefinidamente no Auth e o e-mail da conta permanece sendo o `.local`.
   - **Nenhum usuário perde acesso**, pois o login por username continua consultando o e-mail efetivo `.local` cadastrado.

### Decisão Administrativa e Impacto de Segurança:

Para que o usuário consiga concluir o primeiro vínculo do e-mail real a partir de uma conta `.local`, o administrador precisará optar por uma das alternativas:

1. **Opção A (Recomendada para o primeiro cadastro de e-mail):**
   - No Supabase Dashboard, ir em **Authentication → Providers → Email**.
   - Desmarcar temporariamente a opção **"Confirm email change"** / **"Secure email change"** (ou configurar para exigir confirmação apenas do novo endereço).
   - **Impacto de Segurança:** O Supabase enviará o link de confirmação **exclusivamente para o novo endereço real** informado pelo usuário logado. Como a tela exige senha antes de enviar e o usuário precisa estar logado, o risco de sequestro é mitigado. Assim que o novo e-mail for confirmado no link recebido, o Supabase substitui o `.local` pelo e-mail real verificado.
   - Após a migração dos administradores, a opção pode ser reativada caso desejado.

2. **Opção B (Manter Secure Email Change ativado):**
   - O fluxo `updateUser` não conseguirá finalizar a troca de contas `.local` de forma automática.
   - Apenas contas já migradas para e-mails reais acessíveis poderiam trocar de endereço.

---

## 3. Configuração de Provedor SMTP Transacional

O Supabase NÃO inclui serviço próprio de envio de e-mails para destinatários arbitrários. É necessário conectar um provedor SMTP transacional compatível (exemplo: **Resend** ou **Brevo**, ambos com planos gratuitos adequados para o volume do bar).

### Passos no Supabase Dashboard:

1. Acesse o projeto Supabase: `https://supabase.com/dashboard/project/ztklopvxewgftacxvive`
2. No menu lateral esquerdo, vá em **Authentication** → **SMTP Settings** (ou **Providers** → **SMTP**).
3. Habilite a opção **"Enable Custom SMTP"**.
4. Preencha os campos fornecidos pelo seu provedor:
   - **Sender email:** e-mail remetente autenticado no seu domínio ou do serviço (ex.: `contato@seudominio.com` ou `notificacoes@bar-do-murilo.com`).
   - **Sender name:** `Bar do Murilo`
   - **Host:**
     - Resend: `smtp.resend.com`
     - Brevo: `smtp-relay.brevo.com`
   - **Port:** `587` (ou `465` com SSL/TLS)
   - **Username:**
     - Resend: `resend`
     - Brevo: seu e-mail de login na Brevo
   - **Password:** chave de API gerada no painel do provedor (NUNCA coloque no frontend nem no GitHub).
5. Clique em **Save**.

---

## 4. Configuração de URLs e Redirects

No Supabase Dashboard, em **Authentication** → **URL Configuration**:

1. **Site URL:**
   - Atualmente configurado como: `http://localhost:3000` (padrão de desenvolvimento).
   - **Alterar para:** `https://bar-do-murilo-d9d01.goskip.app`
2. **Redirect URLs:**
   - Adicionar os seguintes caminhos autorizados:
     - `https://bar-do-murilo-d9d01.goskip.app`
     - `https://bar-do-murilo-d9d01.goskip.app/*`
     - `https://bar-do-murilo-d9d01.goskip.app/redefinir-senha`
3. Salve as alterações.

---

## 5. Procedimento Seguro para Cadastro e Homologação Piloto

Recomenda-se realizar o teste piloto com o usuário **leo** ou **murilo**:

1. Configure o SMTP e as URLs no painel do Supabase conforme as Seções 3 e 4.
2. Defina a política de Secure Email Change conforme a Seção 2.
3. Entre no app publicado com o usuário piloto (`leo`) e sua senha habitual.
4. Acesse o menu **Usuários** → **Meu E-mail**.
5. Informe o e-mail real pessoal e a senha de confirmação.
6. Clique em **SOLICITAR CONFIRMAÇÃO DE E-MAIL**.
7. Abra a caixa de entrada do e-mail informado, localize a mensagem do Supabase e clique no link de confirmação.
8. Ao abrir a página no app, o e-mail passa a ser reconhecido como verificado.
9. Faça logout e teste a recuperação de senha na tela **Esqueci minha senha**:
   - Digite `leo`.
   - Verifique que o link de redefinição de senha chega na caixa de entrada.
   - Abra o link e defina uma nova senha em `/redefinir-senha`.
   - Entre com o username `leo` e a nova senha.
