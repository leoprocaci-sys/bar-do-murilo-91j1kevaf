import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import type { Produto } from '@/types/comandas'

const database = supabase as unknown as SupabaseClient

/**
 * Lista produtos. Por padrão somente ativos (opções para novos lançamentos);
 * incluirInativos = true traz também inativos (histórico/gerenciamento).
 */
export const listProdutos = async (busca?: string, incluirInativos = false): Promise<Produto[]> => {
  let query = database
    .from('produtos')
    .select('*')
    .order('categoria', { ascending: true })
    .order('nome', { ascending: true })

  if (!incluirInativos) {
    query = query.eq('ativo', true)
  }

  if (busca && busca.trim()) {
    query = query.ilike('nome', `%${busca.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Produto[]
}

export type CreateProdutoInput = {
  nome: string
  categoria: string
  preco_centavos: number
}

export const createProduto = async (
  input: CreateProdutoInput,
  userId: string,
): Promise<Produto> => {
  const { data, error } = await database
    .from('produtos')
    .insert({
      nome: input.nome.trim(),
      categoria: input.categoria.trim() || 'Diversos',
      preco_atual_centavos: input.preco_centavos,
      ativo: true,
      criado_por: userId,
      atualizado_por: userId,
    })
    .select()
    .single()

  if (error) throw error
  return data as Produto
}

export type UpdateProdutoInput = {
  nome: string
  categoria: string
  preco_centavos: number
}

/**
 * Edição cadastral. Mudança de preço NÃO recalcula itens anteriores:
 * comanda_itens guarda snapshot de nome/preço no momento do lançamento.
 */
export const updateProduto = async (
  id: string,
  input: UpdateProdutoInput,
  userId: string,
): Promise<Produto> => {
  const { data, error } = await database
    .from('produtos')
    .update({
      nome: input.nome.trim(),
      categoria: input.categoria.trim() || 'Diversos',
      preco_atual_centavos: input.preco_centavos,
      atualizado_por: userId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Produto
}

/** Ativa / inativa produto. Inativos não aparecem como opção para novos lançamentos. */
export const setProdutoAtivo = async (
  id: string,
  ativo: boolean,
  userId: string,
): Promise<Produto> => {
  const { data, error } = await database
    .from('produtos')
    .update({ ativo, atualizado_por: userId })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Produto
}
