import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

const database = supabase as unknown as SupabaseClient

export interface AppUserEmailRecord {
  id: string
  user_id: string
  email_real: string
  verificado: boolean
  verificado_em: string | null
  criado_em: string
  atualizado_em: string
}

/**
 * Consulta o registro de e-mail de recuperação cadastrado pelo usuário logado.
 * Graças à política RLS (user_id = auth.uid()), cada usuário só lê o seu.
 */
export const getMeuEmailRecord = async (): Promise<AppUserEmailRecord | null> => {
  const { data, error } = await database
    .from('app_user_emails')
    .select('id, user_id, email_real, verificado, verificado_em, criado_em, atualizado_em')
    .maybeSingle()

  if (error) {
    console.error('Erro ao consultar registro de e-mail do usuário:', error)
    return null
  }

  return (data as AppUserEmailRecord) ?? null
}

/**
 * Checa de forma neutra e segura se um e-mail já está em uso por outra conta,
 * sem expor dados de nenhum usuário.
 */
export const checkEmailDisponivel = async (email: string): Promise<boolean> => {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false

  const { data, error } = await database.rpc('check_email_disponivel', {
    p_email: normalized,
  })

  if (error) {
    console.error('Erro ao verificar disponibilidade de e-mail:', error)
    return true // Fallback neutro
  }

  return Boolean(data)
}

/**
 * Registra ou atualiza a intenção de e-mail real pendente na tabela app_user_emails.
 * O campo verificado SEMPRE inicia/permanece false até a confirmação legítima.
 */
export const registrarIntencaoEmail = async (userId: string, emailReal: string): Promise<void> => {
  const normalized = emailReal.trim().toLowerCase()

  const { error } = await database.from('app_user_emails').upsert(
    {
      user_id: userId,
      email_real: normalized,
      verificado: false,
      verificado_em: null,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    console.error('Erro ao registrar intenção de e-mail:', error)
    throw new Error('Não foi possível salvar o e-mail informado no seu cadastro.')
  }
}
