import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type RequestBody = {
  username?: string
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

// Mensagem padronizada sempre neutra e IDÊNTICA para todo username
// (inexistente, desativado, sem e-mail real e com e-mail real recebem exatamente a mesma resposta)
const NEUTRAL_RESPONSE = {
  ok: true,
  message:
    'Se o nome de usuário estiver cadastrado e tiver um e-mail configurado, as instruções de recuperação serão enviadas.',
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

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Configuração do servidor ausente (SUPABASE_URL ou SERVICE_ROLE_KEY)')
      return jsonResponse(NEUTRAL_RESPONSE, 200)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const body = (await req.json().catch(() => ({}))) as RequestBody
    const rawUsername = body.username ?? ''
    const username = normalizeUsername(rawUsername)

    if (!username || username.length < 2 || username.length > 50) {
      // Entrada inválida: ainda assim retorna a resposta neutra
      return jsonResponse(NEUTRAL_RESPONSE, 200)
    }

    // Rate limiting por identificador (username ou IP do cliente)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimitKey = `${username}_${clientIp}`
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    const { count: attemptsCount, error: countError } = await adminClient
      .from('password_reset_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', rateLimitKey)
      .gte('created_at', fifteenMinutesAgo)

    if (countError) {
      console.error('Erro ao verificar rate limit:', countError)
    } else if ((attemptsCount ?? 0) >= 5) {
      return jsonResponse(
        {
          ok: false,
          code: 'rate_limited',
          message: 'Muitas tentativas recentes. Aguarde 15 minutos e tente novamente.',
        },
        429,
      )
    }

    // Registra a tentativa para rate limiting
    await adminClient
      .from('password_reset_rate_limits')
      .insert({ identifier: rateLimitKey })
      .select('id')
      .maybeSingle()

    // 1. Busca o app_user correspondente
    const { data: appUser, error: userError } = await adminClient
      .from('app_users')
      .select('id, username, nome, ativo, perfil')
      .eq('username', username)
      .maybeSingle()

    if (userError || !appUser || !appUser.ativo) {
      // Usuário não existe ou está inativo: NUNCA revelar; retorna neutro
      return jsonResponse(NEUTRAL_RESPONSE, 200)
    }

    // 2. Consulta o e-mail CONFIRMADO da identidade em auth.users (Admin API por UUID)
    // Conforme especificação 3(b): "consultar somente o e-mail CONFIRMADO da identidade em auth.users
    // (Admin API por UUID via app_user_emails) — não usar o campo verificado de app_user_emails como fonte"
    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(
      appUser.id,
    )

    if (authUserError || !authUserData?.user) {
      return jsonResponse(NEUTRAL_RESPONSE, 200)
    }

    const authUser = authUserData.user
    const emailFromAuth = authUser.email?.trim() || ''
    const isEmailConfirmed = Boolean(authUser.email_confirmed_at)

    // 3. NÃO chamar resetPasswordForEmail para endereços .local
    // Se o e-mail for .local ou se NÃO estiver confirmado, não envia nada e responde neutro
    const isLocalEmail = emailFromAuth.endsWith('.local')

    if (!emailFromAuth || isLocalEmail || !isEmailConfirmed) {
      // E-mail fictício ou não confirmado: não dispara envio
      // Resposta rigorosamente uniforme para proteger contra enumeração
      return jsonResponse(NEUTRAL_RESPONSE, 200)
    }

    // 4. Há e-mail real confirmado em auth.users! Disparar resetPasswordForEmail oficial
    const redirectTo = 'https://bar-do-murilo-d9d01.goskip.app/redefinir-senha'

    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(emailFromAuth, {
      redirectTo,
    })

    if (resetError) {
      console.error('Erro ao chamar resetPasswordForEmail:', resetError.message)
      return jsonResponse(NEUTRAL_RESPONSE, 200)
    }

    return jsonResponse(NEUTRAL_RESPONSE, 200)
  } catch (err) {
    console.error(
      'Erro na função request-password-reset:',
      err instanceof Error ? err.message : String(err),
    )
    return jsonResponse(NEUTRAL_RESPONSE, 200)
  }
})
