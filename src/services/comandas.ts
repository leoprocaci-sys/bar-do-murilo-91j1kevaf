import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import type {
  Comanda,
  ComandaItem,
  ComandaPagamento,
  ParcelaFechamento,
  FechamentoComandaResult,
  CancelamentoFechamentoResult,
} from '@/types/comandas'

const database = supabase as unknown as SupabaseClient

/** Texto de exibição: "Marcelo / Calçada", "Mesa 01 — Carlos", "Mesa 03", "Comanda 7" */
export const identificacaoComandaTexto = (comanda: {
  numero: number
  identificacao: string | null
  mesa: string | null
  local_referencia: string | null
  cliente_nome?: string | null
}): string => {
  const partes: string[] = []
  const nome = (comanda.identificacao || comanda.cliente_nome || '').trim()
  if (nome) partes.push(nome)
  if (comanda.mesa && comanda.mesa.trim()) partes.push(`Mesa ${comanda.mesa.trim()}`)
  let texto = partes.join(' — ')
  if (!texto) texto = `Comanda ${comanda.numero}`
  if (comanda.local_referencia && comanda.local_referencia.trim()) {
    texto = `${texto} / ${comanda.local_referencia.trim()}`
  }
  return texto
}

export const listComandasAbertas = async (): Promise<Comanda[]> => {
  const { data, error } = await database
    .from('comandas')
    .select(
      `
      *,
      cliente_nome:clientes (nome)
    `,
    )
    .eq('status', 'aberta')
    .order('data_abertura', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    cliente_nome: row.cliente_nome?.nome ?? null,
  })) as Comanda[]
}

/** Histórico recente de comandas fechadas (últimas 30) */
export const listComandasFechadasRecentes = async (): Promise<Comanda[]> => {
  const { data, error } = await database
    .from('comandas')
    .select(
      `
      *,
      cliente_nome:clientes (nome)
    `,
    )
    .eq('status', 'fechada')
    .order('data_fechamento', { ascending: false })
    .limit(30)

  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    cliente_nome: row.cliente_nome?.nome ?? null,
  })) as Comanda[]
}

export const getComanda = async (id: string): Promise<Comanda | null> => {
  const { data, error } = await database
    .from('comandas')
    .select(
      `
      *,
      cliente_nome:clientes (nome)
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return {
    ...data,
    cliente_nome: (data as any).cliente_nome?.nome ?? null,
  } as Comanda
}

export const getItensComanda = async (comandaId: string): Promise<ComandaItem[]> => {
  const { data, error } = await database
    .from('comanda_itens')
    .select('*')
    .eq('comanda_id', comandaId)
    .order('seq', { ascending: true })

  if (error) throw error
  return (data ?? []) as ComandaItem[]
}

export const getPagamentosComanda = async (comandaId: string): Promise<ComandaPagamento[]> => {
  const { data, error } = await database
    .from('comanda_pagamentos')
    .select('*')
    .eq('comanda_id', comandaId)
    .order('seq', { ascending: true })

  if (error) throw error
  return (data ?? []) as ComandaPagamento[]
}

export type AbrirComandaInput = {
  identificacao?: string | null
  mesa?: string | null
  local_referencia?: string | null
  cliente_id?: string | null
}

export const abrirComanda = async (input: AbrirComandaInput, userId: string): Promise<Comanda> => {
  const { data, error } = await database
    .from('comandas')
    .insert({
      identificacao: input.identificacao?.trim() || null,
      mesa: input.mesa?.trim() || null,
      local_referencia: input.local_referencia?.trim() || null,
      cliente_id: input.cliente_id || null,
      aberto_por: userId,
      registrado_por: userId,
      atualizado_por: userId,
    })
    .select()
    .single()

  if (error) throw error
  return data as Comanda
}

/**
 * Lança item com validação de preço NO SERVIDOR (snapshot do cadastro no momento).
 * request_id garante idempotência em reenvio pós-falha de conexão.
 */
export type LancarItemResult = {
  item_id: string | null
  produto_id?: string
  produto_nome?: string
  preco_unitario_centavos?: number
  quantidade?: number
  subtotal_centavos?: number
  idempotente: boolean
}

export const lancarItemComanda = async (
  comandaId: string,
  produtoId: string,
  quantidade: number,
): Promise<LancarItemResult> => {
  const requestId = crypto.randomUUID()

  const { data, error } = await database.rpc('lancar_item_comanda', {
    p_comanda_id: comandaId,
    p_produto_id: produtoId,
    p_quantidade: quantidade,
    p_request_id: requestId,
  })

  if (error) throw error
  return data as LancarItemResult
}

export const cancelarItemComanda = async (
  itemId: string,
  motivo?: string,
): Promise<{ item_id: string; status: string }> => {
  const { data, error } = await database.rpc('cancelar_item_comanda', {
    p_item_id: itemId,
    p_motivo: motivo || 'Cancelamento de item da comanda',
  })
  if (error) throw error
  return data as { item_id: string; status: string }
}

/**
 * Alteração excepcional de preço de item lançado (comanda aberta):
 * exige justificativa; auditoria antes/depois gravada pelo gatilho do banco.
 */
export type PrecoExcepcionalResult = {
  item_id: string
  preco_anterior_centavos: number
  preco_novo_centavos: number
  quantidade: number
  subtotal_novo_centavos: number
  justificativa: string
}

export const alterarPrecoExcepcionalItem = async (
  itemId: string,
  novoPrecoCentavos: number,
  justificativa: string,
): Promise<PrecoExcepcionalResult> => {
  const { data, error } = await database.rpc('alterar_preco_excepcional_item', {
    p_item_id: itemId,
    p_novo_preco_centavos: novoPrecoCentavos,
    p_justificativa: justificativa.trim(),
  })
  if (error) throw error
  return data as PrecoExcepcionalResult
}

export type AtualizarIdentificacaoInput = {
  identificacao?: string | null
  mesa?: string | null
  local_referencia?: string | null
  cliente_id?: string | null
}

export const atualizarIdentificacaoComanda = async (
  comandaId: string,
  input: AtualizarIdentificacaoInput,
): Promise<void> => {
  const { error } = await database.rpc('atualizar_comanda_identificacao', {
    p_comanda_id: comandaId,
    p_identificacao: input.identificacao ?? null,
    p_mesa: input.mesa ?? null,
    p_local_referencia: input.local_referencia ?? null,
    p_cliente_id: input.cliente_id || null,
  })
  if (error) throw error
}

/**
 * Fechamento ATÔMICO no servidor: valida 100% do valor distribuído, gera 1 venda direta
 * por parcela recebida e 1 consumo por parcela Fiado, grava comanda_pagamentos e fecha.
 * Falha em qualquer ponto = rollback total.
 */
export const fecharComanda = async (
  comandaId: string,
  parcelas: ParcelaFechamento[],
): Promise<FechamentoComandaResult> => {
  const requestId = crypto.randomUUID()

  const payload = parcelas.map((p) => ({
    forma: p.forma,
    valor_centavos: p.valor_centavos,
    cliente_id: p.forma === 'fiado' ? p.cliente_id || null : null,
  }))

  const { data, error } = await database.rpc('fechar_comanda', {
    p_comanda_id: comandaId,
    p_parcelas: payload,
    p_request_id: requestId,
  })

  if (error) throw error
  return data as FechamentoComandaResult
}

/**
 * Cancela o fechamento (regra aprovada): bloqueado quando a dívida do Fiado
 * já recebeu pagamento posterior; permitido (reversão atômica) caso contrário.
 */
export const cancelarFechamentoComanda = async (
  comandaId: string,
  motivo?: string,
): Promise<CancelamentoFechamentoResult> => {
  const { data, error } = await database.rpc('cancelar_fechamento_comanda', {
    p_comanda_id: comandaId,
    p_motivo: motivo || 'Cancelamento de fechamento de comanda',
  })
  if (error) throw error
  return data as CancelamentoFechamentoResult
}
