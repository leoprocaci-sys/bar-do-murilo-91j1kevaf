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

// Mensagem padronizada sempre neutra para proteger contra enumeração
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

    // Rate limiting simples por identificador (username ou IP do cliente)
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
      // Bloqueio por abuso temporário: retorna mensagem de limite
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

    // 2. Verifica se há e-mail real cadastrado na tabela privada
    const { data: emailRecord } = await adminClient
      .from('app_user_emails')
      .select('email_real, verificado')
      .eq('user_id', appUser.id)
      .maybeSingle()

    const emailReal = emailRecord?.email_real?.trim()

    // Se NÃO houver e-mail real, a conta possui apenas e-mail técnico .local
    // Conforme especificação 1.4:
    // (a) usar e-mail real quando houver;
    // (b) enquanto não houver, o fluxo deve detectar que a conta só tem e-mail técnico .local
    // e orientar o usuário a procurar o administrador (redefinição administrativa).
    if (!emailReal) {
      return jsonResponse(
        {
          ok: false,
          hasRealEmail: false,
          code: 'only_technical_email',
          message:
            'Esta conta ainda não possui e-mail cadastrado para recuperação automática. Procure um administrador do bar para redefinir sua senha.',
        },
        200,
      )
    }

    // 3. Há e-mail real! Disparar resetPasswordForEmail oficial
    // URL oficial de produção: https://bar-do-murilo-d9d01.goskip.app/redefinir-senha
    const redirectTo = 'https://bar-do-murilo-d9d01.goskip.app/redefinir-senha'

    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(emailReal, {
      redirectTo,
    })

    if (resetError) {
      console.error('Erro ao chamar resetPasswordForEmail:', resetError.message)
      // Não vaza detalhes de infraestrutura
      return jsonResponse(NEUTRAL_RESPONSE, 200)
    }

    return jsonResponse(NEUTRAL_RESPONSE, 200)
  } catch (err) {
    console.error('Erro na função request-password-reset:', err)
    return jsonResponse(NEUTRAL_RESPONSE, 200)
  }
})
