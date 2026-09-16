import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import type {
  Cliente,
  Consumo,
  Credito,
  HistoricoAuditoria,
  MovimentacaoHistorico,
  SituacaoFinanceiraCliente,
} from '@/types/fiado'

const database = supabase as unknown as SupabaseClient

/**
 * Lista todos os clientes ordenados por favorito (desc) e nome (asc)
 */
export const listClientes = async (busca?: string): Promise<Cliente[]> => {
  let query = database
    .from('clientes')
    .select('*')
    .order('favorito', { ascending: false })
    .order('nome', { ascending: true })

  if (busca && busca.trim()) {
    const termo = busca.trim()
    // ilike em nome ou apelido
    query = query.or(`nome.ilike.%${termo}%,apelido.ilike.%${termo}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Cliente[]
}

/**
 * Lista somente clientes com restrição "Não vender fiado" ativa
 */
export const listClientesComRestricao = async (): Promise<Cliente[]> => {
  const { data, error } = await database
    .from('clientes')
    .select(`
      *,
      restricao_por_user:app_users!clientes_restricao_por_fkey (nome)
    `)
    .eq('restricao_ativa', true)
    .order('restricao_em', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    ...row,
    restricao_por_nome: row.restricao_por_user?.nome || null,
  })) as Cliente[]
}

/**
 * Obtém detalhes de um único cliente
 */
export const getCliente = async (id: string): Promise<Cliente | null> => {
  const { data, error } = await database
    .from('clientes')
    .select(`
      *,
      criado_por_user:app_users!clientes_criado_por_fkey (nome),
      restricao_por_user:app_users!clientes_restricao_por_fkey (nome)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
    criado_por_nome: data.criado_por_user?.nome || null,
    restricao_por_nome: data.restricao_por_user?.nome || null,
  } as Cliente
}

/**
 * Criação de um novo cliente
 */
export type CreateClienteInput = {
  nome: string
  apelido?: string | null
  telefone?: string | null
  endereco?: string | null
  limite_centavos: number | null
  restricao_ativa: boolean
  restricao_motivo?: string | null
  favorito?: boolean
}

export const createCliente = async (
  input: CreateClienteInput,
  userId: string,
): Promise<Cliente> => {
  const payload: Record<string, any> = {
    nome: input.nome.trim(),
    apelido: input.apelido?.trim() || null,
    telefone: input.telefone?.trim() || null,
    endereco: input.endereco?.trim() || null,
    limite_centavos: input.limite_centavos,
    favorito: input.favorito ?? false,
    criado_por: userId,
  }

  if (input.restricao_ativa) {
    payload.restricao_ativa = true
    payload.restricao_motivo = input.restricao_motivo?.trim() || 'Não vender fiado'
    payload.restricao_por = userId
    payload.restricao_em = new Date().toISOString()
  } else {
    payload.restricao_ativa = false
    payload.restricao_motivo = null
    payload.restricao_por = null
    payload.restricao_em = null
  }

  const { data, error } = await database.from('clientes').insert(payload).select().single()

  if (error) throw error
  return data as Cliente
}

/**
 * Atualização cadastral do cliente
 */
export type UpdateClienteInput = {
  nome: string
  apelido?: string | null
  telefone?: string | null
  endereco?: string | null
  limite_centavos: number | null
  restricao_ativa: boolean
  restricao_motivo?: string | null
  favorito?: boolean
}

export const updateCliente = async (
  id: string,
  input: UpdateClienteInput,
  userId: string,
): Promise<Cliente> => {
  const payload: Record<string, any> = {
    nome: input.nome.trim(),
    apelido: input.apelido?.trim() || null,
    telefone: input.telefone?.trim() || null,
    endereco: input.endereco?.trim() || null,
    limite_centavos: input.limite_centavos,
  }

  if (input.favorito !== undefined) {
    payload.favorito = input.favorito
  }

  if (input.restricao_ativa) {
    payload.restricao_ativa = true
    payload.restricao_motivo = input.restricao_motivo?.trim() || 'Não vender fiado'
    payload.restricao_por = userId
    payload.restricao_em = new Date().toISOString()
  } else {
    payload.restricao_ativa = false
    payload.restricao_motivo = null
    payload.restricao_por = null
    payload.restricao_em = null
  }

  const { data, error } = await database
    .from('clientes')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Cliente
}

/**
 * Alterna favorito do cliente (compartilhado entre todos os administradores)
 */
export const toggleFavoritoCliente = async (
  clienteId: string,
  novoStatus: boolean,
): Promise<void> => {
  const { error } = await database
    .from('clientes')
    .update({ favorito: novoStatus })
    .eq('id', clienteId)

  if (error) throw error
}

/**
 * Calcula a situação financeira do cliente (dívida ativa, crédito disponível, posição líquida e limite)
 */
export const getSituacaoFinanceiraCliente = async (
  cliente: Cliente,
): Promise<SituacaoFinanceiraCliente> => {
  // 1. Busca todos os consumos ativos do cliente
  const { data: consumosData, error: consumosError } = await database
    .from('consumos')
    .select('valor_centavos')
    .eq('cliente_id', cliente.id)
    .eq('status', 'ativo')

  if (consumosError) throw consumosError

  const totalDividaCentavos = (consumosData ?? []).reduce(
    (acc: number, curr: { valor_centavos: number }) => acc + Number(curr.valor_centavos),
    0,
  )

  // 2. Busca créditos do cliente
  const { data: creditosData, error: creditosError } = await database
    .from('creditos')
    .select('tipo, valor_centavos')
    .eq('cliente_id', cliente.id)
    .eq('status', 'ativo')

  if (creditosError) throw creditosError

  let creditosOrigem = 0
  let creditosUtilizacao = 0
  let creditosDevolucao = 0

  for (const c of creditosData ?? []) {
    const val = Number(c.valor_centavos)
    if (c.tipo === 'origem') creditosOrigem += val
    else if (c.tipo === 'utilizacao') creditosUtilizacao += val
    else if (c.tipo === 'devolucao') creditosDevolucao += val
  }

  const totalCreditoDisponivelCentavos = Math.max(
    0,
    creditosOrigem - creditosUtilizacao - creditosDevolucao,
  )

  const posicaoLiquidaCentavos = totalDividaCentavos - totalCreditoDisponivelCentavos

  // 3. Cálculo da capacidade de fiado
  let disponivelParaFiadoCentavos: number | null = null
  if (cliente.limite_centavos === null) {
    disponivelParaFiadoCentavos = null
  } else if (cliente.limite_centavos === 0) {
    disponivelParaFiadoCentavos = 0
  } else {
    // Limite positivo
    // A regra: quando houver crédito disponível, ele é considerado ANTES da incidência do limite.
    // Dívida líquida que consome limite = Math.max(0, totalDividaCentavos - totalCreditoDisponivelCentavos)
    const dividaQueConsomeLimite = Math.max(0, totalDividaCentavos - totalCreditoDisponivelCentavos)
    disponivelParaFiadoCentavos = Math.max(0, cliente.limite_centavos - dividaQueConsomeLimite)
  }

  return {
    totalDividaCentavos,
    totalCreditoDisponivelCentavos,
    posicaoLiquidaCentavos,
    limiteCentavos: cliente.limite_centavos,
    temRestricao: cliente.restricao_ativa,
    restricaoMotivo: cliente.restricao_motivo,
    restricaoPorNome: cliente.restricao_por_nome,
    restricaoEm: cliente.restricao_em,
    disponivelParaFiadoCentavos,
  }
}

/**
 * Lista histórico combinado cronológico de consumos e créditos do cliente
 */
export const getHistoricoCliente = async (clienteId: string): Promise<MovimentacaoHistorico[]> => {
  // Consumos
  const { data: consumosData, error: errConsumos } = await database
    .from('consumos')
    .select(`
      id, valor_centavos, descricao, data_movimento, data_registro, status, registrado_por,
      registrado_por_user:app_users!consumos_registrado_por_fkey (nome)
    `)
    .eq('cliente_id', clienteId)
    .order('data_movimento', { ascending: false })
    .order('data_registro', { ascending: false })

  if (errConsumos) throw errConsumos

  // Créditos
  const { data: creditosData, error: errCreditos } = await database
    .from('creditos')
    .select(`
      id, tipo, valor_centavos, data_movimento, data_registro, status, registrado_por,
      registrado_por_user:app_users!creditos_registrado_por_fkey (nome)
    `)
    .eq('cliente_id', clienteId)
    .order('data_movimento', { ascending: false })
    .order('data_registro', { ascending: false })

  if (errCreditos) throw errCreditos

  const lista: MovimentacaoHistorico[] = []

  for (const c of (consumosData as any[]) ?? []) {
    const nomeResp = Array.isArray(c.registrado_por_user)
      ? c.registrado_por_user[0]?.nome
      : c.registrado_por_user?.nome
    lista.push({
      id: c.id,
      tipo: 'consumo',
      origem: 'Consumo Fiado',
      valor_centavos: Number(c.valor_centavos),
      descricao: c.descricao,
      data_movimento: c.data_movimento,
      data_registro: c.data_registro,
      registrado_por: c.registrado_por,
      registrado_por_nome: nomeResp || 'Administrador',
      status: c.status,
    })
  }

  for (const cr of (creditosData as any[]) ?? []) {
    let origemLabel = 'Crédito'
    if (cr.tipo === 'origem') origemLabel = 'Crédito Adicionado'
    else if (cr.tipo === 'utilizacao') origemLabel = 'Crédito Utilizado'
    else if (cr.tipo === 'devolucao') origemLabel = 'Crédito Devolvido'

    const nomeResp = Array.isArray(cr.registrado_por_user)
      ? cr.registrado_por_user[0]?.nome
      : cr.registrado_por_user?.nome

    lista.push({
      id: cr.id,
      tipo: 'credito',
      origem: origemLabel,
      valor_centavos: Number(cr.valor_centavos),
      descricao: `Operação de crédito: ${cr.tipo}`,
      data_movimento: cr.data_movimento,
      data_registro: cr.data_registro,
      registrado_por: cr.registrado_por,
      registrado_por_nome: nomeResp || 'Administrador',
      status: cr.status,
    })
  }

  // Ordena por data_movimento DESC, depois data_registro DESC
  lista.sort((a, b) => {
    if (a.data_movimento !== b.data_movimento) {
      return b.data_movimento.localeCompare(a.data_movimento)
    }
    return b.data_registro.localeCompare(a.data_registro)
  })

  return lista
}

/**
 * Consulta de auditoria do cliente na tabela historico_alteracoes
 */
export const getAuditoriaCliente = async (clienteId: string): Promise<HistoricoAuditoria[]> => {
  const { data, error } = await database
    .from('historico_alteracoes')
    .select(`
      id, tabela, registro_id, dados_anteriores, dados_novos, alterado_por, alterado_em,
      alterado_por_user:app_users!historico_alteracoes_alterado_por_fkey (nome)
    `)
    .eq('registro_id', clienteId)
    .order('alterado_em', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    ...row,
    alterado_por_nome: row.alterado_por_user?.nome || 'Administrador',
  })) as HistoricoAuditoria[]
}

/**
 * Registrar novo consumo fiado
 */
export type RegistrarConsumoInput = {
  cliente_id: string
  valor_centavos: number
  data_movimento: string // YYYY-MM-DD
  descricao?: string | null
}

export type ValidacaoConsumoResult =
  | { permitido: true }
  | {
      permitido: false
      motivo:
        | 'restricao_ativa'
        | 'limite_zero'
        | 'limite_excedido'
        | 'valor_invalido'
        | 'data_invalida'
      mensagem: string
      detalhes?: {
        limiteCentavos: number
        comprometidoCentavos: number
        creditoCentavos: number
        novoConsumoCentavos: number
        excedenteCentavos: number
        restricaoMotivo?: string | null
      }
    }

/**
 * Validação de autorização antes de salvar consumo fiado
 */
export const validarAutorizacaoConsumo = (
  situacao: SituacaoFinanceiraCliente,
  novoConsumoCentavos: number,
): ValidacaoConsumoResult => {
  if (novoConsumoCentavos <= 0) {
    return {
      permitido: false,
      motivo: 'valor_invalido',
      mensagem: 'O valor do consumo deve ser maior que zero.',
    }
  }

  // CASO A — "Não vender fiado" ativo
  if (situacao.temRestricao) {
    const motivoText = situacao.restricaoMotivo
      ? ` Motivo informado: "${situacao.restricaoMotivo}".`
      : ''
    return {
      permitido: false,
      motivo: 'restricao_ativa',
      mensagem: `Cliente com restrição de "Não vender fiado" ativa.${motivoText}`,
      detalhes: {
        limiteCentavos: situacao.limiteCentavos ?? 0,
        comprometidoCentavos: situacao.totalDividaCentavos,
        creditoCentavos: situacao.totalCreditoDisponivelCentavos,
        novoConsumoCentavos,
        excedenteCentavos: 0,
        restricaoMotivo: situacao.restricaoMotivo,
      },
    }
  }

  // CASO B — limite = R$ 0,00
  if (situacao.limiteCentavos === 0) {
    return {
      permitido: false,
      motivo: 'limite_zero',
      mensagem: 'Cliente não possui autorização de limite para compras fiadas (limite R$ 0,00).',
      detalhes: {
        limiteCentavos: 0,
        comprometidoCentavos: situacao.totalDividaCentavos,
        creditoCentavos: situacao.totalCreditoDisponivelCentavos,
        novoConsumoCentavos,
        excedenteCentavos: novoConsumoCentavos,
      },
    }
  }

  // CASO C — limite = NULL/vazio: sem limite monetário definido
  if (situacao.limiteCentavos === null) {
    return { permitido: true }
  }

  // CASO D — limite positivo:
  // Considera crédito disponível ANTES da incidência do limite
  // Dívida líquida atual que consome limite:
  const dividaComprometida = Math.max(
    0,
    situacao.totalDividaCentavos - situacao.totalCreditoDisponivelCentavos,
  )
  const capacidadeDisponivel = Math.max(0, situacao.limiteCentavos - dividaComprometida)

  if (novoConsumoCentavos > capacidadeDisponivel) {
    const excedente = novoConsumoCentavos - capacidadeDisponivel
    return {
      permitido: false,
      motivo: 'limite_excedido',
      mensagem: `O consumo excede a capacidade de limite do cliente em R$ ${(excedente / 100).toFixed(2).replace('.', ',')}.`,
      detalhes: {
        limiteCentavos: situacao.limiteCentavos,
        comprometidoCentavos: dividaComprometida,
        creditoCentavos: situacao.totalCreditoDisponivelCentavos,
        novoConsumoCentavos,
        excedenteCentavos: excedente,
      },
    }
  }

  return { permitido: true }
}

/**
 * Cria o consumo com request_id (idempotência) e registrado_por
 */
export const registrarConsumo = async (
  input: RegistrarConsumoInput,
  userId: string,
): Promise<Consumo> => {
  const requestId = crypto.randomUUID()

  const payload = {
    cliente_id: input.cliente_id,
    valor_centavos: input.valor_centavos,
    descricao: input.descricao?.trim() || null,
    data_movimento: input.data_movimento,
    registrado_por: userId,
    request_id: requestId,
    status: 'ativo',
  }

  const { data, error } = await database.from('consumos').insert(payload).select().single()

  if (error) throw error
  return data as Consumo
}
