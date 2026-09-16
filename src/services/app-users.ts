import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import type { AdminOperation, AdminOperationResult, AppUser } from '@/types/app'

// Os tipos gerados são atualizados pela integração depois da migração;
// o adaptador evita qualquer edição manual no arquivo gerado.
const database = supabase as unknown as SupabaseClient

const unwrapFunctionError = async (error: unknown) => {
  const functionError = error as {
    message?: string
    context?: { json?: () => Promise<{ error?: string }> }
  }

  try {
    const payload = await functionError.context?.json?.()
    if (payload?.error) return payload.error
  } catch {
    // A resposta não tinha corpo JSON; usa a mensagem neutra abaixo.
  }

  return functionError.message || 'Não foi possível concluir a operação.'
}

export const getAppUser = async (userId: string): Promise<AppUser | null> => {
  const { data, error } = await database
    .from('app_users')
    .select('id, username, nome, ativo, deve_alterar_senha, perfil, criado_em, atualizado_em')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data as AppUser | null
}

export const listAppUsers = async (): Promise<AppUser[]> => {
  const { data, error } = await database
    .from('app_users')
    .select('id, username, nome, ativo, deve_alterar_senha, perfil, criado_em, atualizado_em')
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as AppUser[]
}

export const completeFirstAccess = async () => {
  const { error } = await database.rpc('complete_first_access')
  if (error) throw error
}

export const invokeAdminOperation = async (
  operation: AdminOperation,
): Promise<AdminOperationResult> => {
  const { data, error } = await supabase.functions.invoke<AdminOperationResult>('admin-users', {
    body: operation,
  })

  if (error) {
    throw new Error(await unwrapFunctionError(error))
  }

  return data ?? {}
}
