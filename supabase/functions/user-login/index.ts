import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type LoginRequestBody = {
  username?: string
  password?: string
  senha?: string
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  })

const normalizeUsername = (value: string) => value.trim().toLocaleLowerCase('pt-BR')

// Resposta genérica de falha para NUNCA distinguir inexistente / desativado / senha incorreta
const GENERIC_INVALID_CREDENTIALS = {
  ok: false,
  error: 'Usuário ou senha inválidos.',
  code: 'invalid_credentials',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.', code: 'method_not_allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('Configuração do servidor ausente (SUPABASE_URL, SERVICE_ROLE_KEY ou ANON_KEY)')
      return jsonResponse(GENERIC_INVALID_CREDENTIALS, 400)
    }

    const body = (await req.json().catch(() => ({}))) as LoginRequestBody
    const rawUsername = body.username ?? ''
    const password = body.senha ?? body.password ?? ''
    const username = normalizeUsername(rawUsername)

    // Rate limiting antes de qualquer consulta ou verificação
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Chaves de rate limiting: por username (se fornecido) e por IP
    const usernameLimitKey = username ? `login_user_${username}` : null
    const ipLimitKey = `login_ip_${clientIp}`
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    // 1. Checagem de rate limit por IP (limite de 30 tentativas em 15 minutos)
    const { count: ipAttempts } = await adminClient
      .from('password_reset_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', ipLimitKey)
      .gte('created_at', fifteenMinutesAgo)

    if ((ipAttempts ?? 0) >= 30) {
      return jsonResponse(
        {
          ok: false,
          error:
            'Muitas tentativas a partir deste dispositivo. Aguarde 15 minutos e tente novamente.',
          code: 'rate_limited',
        },
        429,
      )
    }

    // 2. Checagem de rate limit por username (limite de 10 tentativas em 15 minutos)
    if (usernameLimitKey) {
      const { count: userAttempts } = await adminClient
        .from('password_reset_rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('identifier', usernameLimitKey)
        .gte('created_at', fifteenMinutesAgo)

      if ((userAttempts ?? 0) >= 10) {
        return jsonResponse(
          {
            ok: false,
            error: 'Muitas tentativas para este usuário. Aguarde 15 minutos e tente novamente.',
            code: 'rate_limited',
          },
          429,
        )
      }
    }

    // Registra a tentativa para rate limiting (IP e username se válido)
    const rateLimitInserts = [{ identifier: ipLimitKey }]
    if (usernameLimitKey) {
      rateLimitInserts.push({ identifier: usernameLimitKey })
    }
    await adminClient.from('password_reset_rate_limits').insert(rateLimitInserts)

    // Validações básicas de formato
    if (!username || username.length < 2 || username.length > 50 || !password) {
      return jsonResponse(GENERIC_INVALID_CREDENTIALS, 400)
    }

    // 3. Resolve identidade do usuário no banco:
    // Primeiro tenta via app_users diretamente por username
    const { data: appUser, error: appUserError } = await adminClient
      .from('app_users')
      .select('id, username, nome, ativo, perfil, deve_alterar_senha')
      .eq('username', username)
      .maybeSingle()

    if (appUserError || !appUser) {
      return jsonResponse(GENERIC_INVALID_CREDENTIALS, 400)
    }

    // Se o usuário estiver inativo ou sem perfil de administrador, recusa com a mesma falha genérica
    if (!appUser.ativo || appUser.perfil !== 'administrador') {
      return jsonResponse(GENERIC_INVALID_CREDENTIALS, 400)
    }

    // 4. Lê o e-mail EFETIVO da identidade em auth.users pelo ID (Admin API, só no servidor)
    // O e-mail pode ser .local ou real — o Auth é a autoridade sobre o endereço de login
    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(
      appUser.id,
    )

    if (authUserError || !authUserData?.user?.email) {
      return jsonResponse(GENERIC_INVALID_CREDENTIALS, 400)
    }

    const effectiveEmail = authUserData.user.email

    // 5. Valida a senha com cliente ANÔNIMO (signInWithPassword).
    // NUNCA usar service_role para validar senha!
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: effectiveEmail,
      password,
    })

    if (signInError || !signInData.session || !signInData.user) {
      return jsonResponse(GENERIC_INVALID_CREDENTIALS, 400)
    }

    // Sucesso: retorna os tokens de sessão para o frontend instalá-los com supabase.auth.setSession
    return jsonResponse(
      {
        ok: true,
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
          expires_in: signInData.session.expires_in,
          token_type: signInData.session.token_type,
          user: signInData.session.user,
        },
        appUser: {
          id: appUser.id,
          username: appUser.username,
          nome: appUser.nome,
          ativo: appUser.ativo,
          deve_alterar_senha: appUser.deve_alterar_senha,
          perfil: appUser.perfil,
        },
      },
      200,
    )
  } catch (err) {
    console.error('Erro na função user-login:', err instanceof Error ? err.message : String(err))
    return jsonResponse(GENERIC_INVALID_CREDENTIALS, 400)
  }
})
