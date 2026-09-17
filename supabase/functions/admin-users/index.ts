import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type Operation = 'create' | 'reset-password' | 'deactivate' | 'reactivate'

type RequestBody = {
  operation?: Operation
  targetUserId?: string
  username?: string
  nome?: string
}

type AppUser = {
  id: string
  username: string
  nome: string
  ativo: boolean
  deve_alterar_senha: boolean
  perfil: 'administrador'
}

class HttpError extends Error {
  status: number
  code: string

  constructor(status: number, message: string, code = 'request_failed') {
    super(message)
    this.status = status
    this.code = code
  }
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

const isValidUsername = (value: string) => /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value)

const generateProvisionalPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  const password = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
  return `M${password}7!`
}

const getBearerToken = (req: Request) => {
  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) {
    throw new HttpError(401, 'Sessão inválida. Entre novamente.', 'unauthorized')
  }
  return authorization.slice(7)
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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new HttpError(503, 'Configuração do servidor indisponível.', 'server_configuration')
    }

    const jwt = getBearerToken(req)
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: authData, error: authError } = await authClient.auth.getUser(jwt)
    if (authError || !authData.user) {
      throw new HttpError(401, 'Sessão inválida. Entre novamente.', 'unauthorized')
    }

    const { data: requester, error: requesterError } = await authClient
      .from('app_users')
      .select('id, ativo, perfil')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (requesterError || !requester || !requester.ativo || requester.perfil !== 'administrador') {
      // Fallback usando o adminClient caso o contexto do usuário apresente divergência
      const { data: adminRequester, error: adminRequesterError } = await adminClient
        .from('app_users')
        .select('id, ativo, perfil')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (
        adminRequesterError ||
        !adminRequester ||
        !adminRequester.ativo ||
        adminRequester.perfil !== 'administrador'
      ) {
        console.error('Falha na autorização administrativa:', {
          userId: authData.user.id,
          requesterError,
          adminRequesterError,
        })
        throw new HttpError(403, 'Acesso administrativo não autorizado.', 'forbidden')
      }
    }

    const body = (await req.json()) as RequestBody
    if (!body.operation) {
      throw new HttpError(400, 'Operação administrativa não informada.', 'invalid_request')
    }

    if (body.operation === 'create') {
      const username = normalizeUsername(body.username ?? '')
      const nome = (body.nome ?? '').trim().replace(/\s+/g, ' ')

      if (!isValidUsername(username)) {
        throw new HttpError(
          400,
          'Use de 3 a 32 caracteres minúsculos: letras sem acento, números, ponto, hífen ou sublinhado.',
          'invalid_username',
        )
      }
      if (nome.length < 2 || nome.length > 80) {
        throw new HttpError(400, 'Informe um nome entre 2 e 80 caracteres.', 'invalid_name')
      }

      const { data: existing, error: existingError } = await adminClient
        .from('app_users')
        .select('id, username, nome, ativo, deve_alterar_senha, perfil')
        .eq('username', username)
        .maybeSingle()

      if (existingError) {
        throw new HttpError(500, 'Não foi possível verificar o nome de usuário.', 'database_error')
      }
      if (existing) {
        return jsonResponse({ user: existing, alreadyExists: true })
      }

      const email = `${username}@bar-do-murilo.local`
      const provisionalPassword = generateProvisionalPassword()
      const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser(
        {
          email,
          password: provisionalPassword,
          email_confirm: true,
          user_metadata: { nome },
        },
      )

      if (createAuthError || !createdAuth.user) {
        const message = createAuthError?.message?.toLocaleLowerCase('pt-BR') ?? ''
        if (message.includes('already') || message.includes('registered')) {
          throw new HttpError(409, 'Este nome de usuário já está cadastrado.', 'username_taken')
        }
        throw new HttpError(
          502,
          'Não foi possível criar a identidade de acesso.',
          'auth_create_failed',
        )
      }

      const newAppUser: AppUser = {
        id: createdAuth.user.id,
        username,
        nome,
        ativo: true,
        deve_alterar_senha: true,
        perfil: 'administrador',
      }
      const { data: inserted, error: insertError } = await adminClient
        .from('app_users')
        .insert(newAppUser)
        .select('id, username, nome, ativo, deve_alterar_senha, perfil')
        .single()

      if (insertError || !inserted) {
        const { error: compensationError } = await adminClient.auth.admin.deleteUser(
          createdAuth.user.id,
        )
        if (compensationError) {
          await adminClient.auth.admin.updateUserById(createdAuth.user.id, {
            ban_duration: '876000h',
          })
          throw new HttpError(
            500,
            'O cadastro falhou e a identidade foi bloqueada. O responsável técnico deve concluir a limpeza.',
            'compensation_blocked',
          )
        }
        throw new HttpError(
          insertError?.code === '23505' ? 409 : 500,
          insertError?.code === '23505'
            ? 'Este nome de usuário já está cadastrado.'
            : 'O cadastro não foi concluído; a identidade criada foi removida com segurança.',
          insertError?.code === '23505' ? 'username_taken' : 'app_user_create_failed',
        )
      }

      return jsonResponse(
        {
          user: inserted,
          provisionalPassword,
          alreadyExists: false,
        },
        201,
      )
    }

    const targetUserId = body.targetUserId ?? ''
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        targetUserId,
      )
    ) {
      throw new HttpError(400, 'Usuário de destino inválido.', 'invalid_target')
    }

    if (body.operation === 'deactivate' || body.operation === 'reactivate') {
      const ativo = body.operation === 'reactivate'
      const { data, error } = await authClient.rpc('admin_change_user_status', {
        p_target_user_id: targetUserId,
        p_ativo: ativo,
      })

      if (error) {
        if (error.message.includes('último administrador')) {
          throw new HttpError(
            409,
            'Não é possível desativar o último administrador ativo.',
            'last_admin',
          )
        }
        if (error.message.includes('não encontrado')) {
          throw new HttpError(404, 'Usuário não encontrado.', 'not_found')
        }
        throw new HttpError(
          400,
          'Não foi possível alterar a situação do usuário.',
          'status_change_failed',
        )
      }

      if (!ativo) {
        const { error: banError } = await adminClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: '876000h',
        })
        if (banError) {
          const { error: rollbackError } = await authClient.rpc('admin_change_user_status', {
            p_target_user_id: targetUserId,
            p_ativo: true,
          })
          if (rollbackError) {
            throw new HttpError(
              500,
              'A identidade permaneceu bloqueada pelos dados, mas a sincronização do Auth exige revisão técnica.',
              'status_compensation_failed',
            )
          }
          throw new HttpError(
            502,
            'A desativação não foi concluída e a situação anterior foi restaurada.',
            'auth_ban_failed',
          )
        }
      } else {
        const { error: unbanError } = await adminClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: 'none',
        })
        if (unbanError) {
          const { error: rollbackError } = await authClient.rpc('admin_change_user_status', {
            p_target_user_id: targetUserId,
            p_ativo: false,
          })
          if (rollbackError) {
            throw new HttpError(
              500,
              'A reativação exige revisão técnica para sincronizar os estados.',
              'status_compensation_failed',
            )
          }
          throw new HttpError(
            502,
            'A reativação não foi concluída e a situação anterior foi restaurada.',
            'auth_unban_failed',
          )
        }
      }

      return jsonResponse({ user: data })
    }

    if (body.operation === 'reset-password') {
      const provisionalPassword = generateProvisionalPassword()
      const { data: target, error: targetError } = await adminClient
        .from('app_users')
        .select('id, ativo')
        .eq('id', targetUserId)
        .maybeSingle()

      if (targetError || !target) {
        throw new HttpError(404, 'Usuário não encontrado.', 'not_found')
      }
      if (!target.ativo) {
        throw new HttpError(409, 'Reative o usuário antes de redefinir a senha.', 'inactive_user')
      }

      const { error: passwordError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: provisionalPassword,
      })
      if (passwordError) {
        throw new HttpError(
          502,
          'Não foi possível gerar a nova senha provisória.',
          'auth_update_failed',
        )
      }

      const { error: flagError } = await authClient.rpc('admin_mark_password_reset', {
        p_target_user_id: targetUserId,
      })
      if (flagError) {
        // A senha já foi alterada no Auth; bloqueia a identidade para impedir acesso sem a obrigação registrada.
        await adminClient.auth.admin.updateUserById(targetUserId, { ban_duration: '876000h' })
        throw new HttpError(
          500,
          'A redefinição foi bloqueada por segurança e requer revisão do responsável técnico.',
          'reset_compensation_blocked',
        )
      }

      return jsonResponse({ provisionalPassword })
    }

    throw new HttpError(400, 'Operação administrativa desconhecida.', 'invalid_operation')
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message, code: error.code }, error.status)
    }
    return jsonResponse({ error: 'Erro interno do servidor.', code: 'internal_error' }, 500)
  }
})
