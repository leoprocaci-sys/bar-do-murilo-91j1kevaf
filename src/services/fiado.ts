import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import type {
  Cliente,
  Consumo,
  Credito,
  DetalhamentoClientePeriodo,
  EvolucaoClienteFiado,
  FormaPagamento,
  HistoricoAuditoria,
  MovimentacaoHistorico,
  Pagamento,
  PeriodoRelatorioFiado,
  RelatorioFiadoPeriodo,
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
  // Executa a função RPC calcular_posicao_cliente para integridade contábil idêntica
  const { data: posData, error: posError } = await database.rpc('calcular_posicao_cliente', {
    p_cliente_id: cliente.id,
  })

  if (posError) {
    // Fallback caso RPC falhe
    console.error('Erro ao chamar calcular_posicao_cliente:', posError)
  }

  const pos = Array.isArray(posData) && posData[0] ? posData[0] : null

  const totalDividaCentavos = pos ? Number(pos.total_divida) : 0
  const totalPagoCentavos = pos ? Number(pos.total_pago) : 0
  const saldoDevedorCentavos = pos ? Number(pos.saldo_devedor) : 0
  const totalCreditoOrigemCentavos = pos ? Number(pos.credito_origem) : 0
  const totalCreditoUtilizadoCentavos = pos ? Number(pos.credito_utilizado) : 0
  const totalCreditoDisponivelCentavos = pos ? Number(pos.credito_disponivel) : 0

  const posicaoLiquidaCentavos = saldoDevedorCentavos - totalCreditoDisponivelCentavos

  // 3. Cálculo da capacidade de fiado
  let disponivelParaFiadoCentavos: number | null = null
  if (cliente.limite_centavos === null) {
    disponivelParaFiadoCentavos = null
  } else if (cliente.limite_centavos === 0) {
    disponivelParaFiadoCentavos = 0
  } else {
    // Limite positivo
    // Capacidade restante no limite = Math.max(0, limite_centavos - saldoDevedorCentavos)
    disponivelParaFiadoCentavos = Math.max(0, cliente.limite_centavos - saldoDevedorCentavos)
  }

  return {
    totalDividaCentavos,
    totalPagoCentavos,
    saldoDevedorCentavos,
    totalCreditoDisponivelCentavos,
    totalCreditoOrigemCentavos,
    totalCreditoUtilizadoCentavos,
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

  // Pagamentos
  const { data: pagamentosData, error: errPagamentos } = await database
    .from('pagamentos')
    .select(`
      id, valor_centavos, forma, data_movimento, data_registro, status, registrado_por, credito_id,
      registrado_por_user:app_users!pagamentos_registrado_por_fkey (nome)
    `)
    .eq('cliente_id', clienteId)
    .order('data_movimento', { ascending: false })
    .order('data_registro', { ascending: false })

  if (errPagamentos) throw errPagamentos

  // Créditos
  const { data: creditosData, error: errCreditos } = await database
    .from('creditos')
    .select(`
      id, tipo, valor_centavos, data_movimento, data_registro, status, registrado_por, origem_pagamento_id, movimento_vinculado_id,
      registrado_por_user:app_users!creditos_registrado_por_fkey (nome)
    `)
    .eq('cliente_id', clienteId)
    .order('data_movimento', { ascending: false })
    .order('data_registro', { ascending: false })

  if (errCreditos) throw errCreditos

  const lista: MovimentacaoHistorico[] = []

  // Mapeia consumos
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

  // Mapeia pagamentos
  for (const p of (pagamentosData as any[]) ?? []) {
    const nomeResp = Array.isArray(p.registrado_por_user)
      ? p.registrado_por_user[0]?.nome
      : p.registrado_por_user?.nome

    let formaLabel = p.forma
    if (p.forma === 'dinheiro') formaLabel = 'Dinheiro'
    else if (p.forma === 'pix') formaLabel = 'Pix'
    else if (p.forma === 'cartao_debito') formaLabel = 'Cartão de Débito'
    else if (p.forma === 'cartao_credito') formaLabel = 'Cartão de Crédito'

    lista.push({
      id: p.id,
      tipo: 'pagamento',
      origem: `Pagamento (${formaLabel})`,
      valor_centavos: Number(p.valor_centavos),
      descricao: p.credito_id ? `Recebimento fiado (gerou crédito excedente)` : `Recebimento fiado`,
      forma: p.forma,
      data_movimento: p.data_movimento,
      data_registro: p.data_registro,
      registrado_por: p.registrado_por,
      registrado_por_nome: nomeResp || 'Administrador',
      status: p.status,
      credito_id: p.credito_id,
    })
  }

  // Mapeia créditos
  for (const cr of (creditosData as any[]) ?? []) {
    let origemLabel = 'Crédito'
    let desc = 'Operação de crédito'
    if (cr.tipo === 'origem') {
      origemLabel = 'Crédito Gerado (Excedente)'
      desc = 'Crédito originado por pagamento superior à dívida'
    } else if (cr.tipo === 'utilizacao') {
      origemLabel = 'Crédito Utilizado em Consumo'
      desc = 'Abatimento automático em consumo fiado'
    } else if (cr.tipo === 'devolucao') {
      origemLabel = 'Crédito Devolvido'
      desc = 'Devolução de crédito ao cliente'
    }

    const nomeResp = Array.isArray(cr.registrado_por_user)
      ? cr.registrado_por_user[0]?.nome
      : cr.registrado_por_user?.nome

    lista.push({
      id: cr.id,
      tipo: 'credito',
      origem: origemLabel,
      valor_centavos: Number(cr.valor_centavos),
      descricao: desc,
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
 * Consulta o histórico de alterações (before/after) de um registro específico (venda, saída, retirada, consumo, pagamento)
 * Exclusivamente para leitura/consulta informativa.
 */
export const getHistoricoRegistro = async (
  registroId: string,
  tabela?: string,
): Promise<HistoricoAuditoria[]> => {
  let query = database
    .from('historico_alteracoes')
    .select(`
      id, tabela, registro_id, dados_anteriores, dados_novos, alterado_por, alterado_em,
      alterado_por_user:app_users!historico_alteracoes_alterado_por_fkey (nome)
    `)
    .eq('registro_id', registroId)
    .order('alterado_em', { ascending: false })

  if (tabela) {
    query = query.eq('tabela', tabela)
  }

  const { data, error } = await query
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
  // Parcela coberta por crédito:
  const cobertoPorCredito = Math.min(situacao.totalCreditoDisponivelCentavos, novoConsumoCentavos)
  const novaDividaLiquida = novoConsumoCentavos - cobertoPorCredito

  // Saldo devedor atual que já consome limite
  const saldoDevedorAtual =
    situacao.saldoDevedorCentavos ??
    Math.max(0, situacao.totalDividaCentavos - situacao.totalCreditoDisponivelCentavos)
  const capacidadeDisponivel = Math.max(0, situacao.limiteCentavos - saldoDevedorAtual)

  if (novaDividaLiquida > capacidadeDisponivel) {
    const excedente = novaDividaLiquida - capacidadeDisponivel
    return {
      permitido: false,
      motivo: 'limite_excedido',
      mensagem: `O consumo excede a capacidade de limite do cliente em R$ ${(excedente / 100).toFixed(2).replace('.', ',')}.`,
      detalhes: {
        limiteCentavos: situacao.limiteCentavos,
        comprometidoCentavos: saldoDevedorAtual,
        creditoCentavos: situacao.totalCreditoDisponivelCentavos,
        novoConsumoCentavos,
        excedenteCentavos: excedente,
      },
    }
  }

  return { permitido: true }
}

/**
 * Cria o consumo com request_id (idempotência) e utiliza crédito disponível via RPC atômica
 */
export const registrarConsumo = async (
  input: RegistrarConsumoInput,
  _userId: string,
): Promise<Consumo> => {
  const requestId = crypto.randomUUID()

  const { data, error } = await database.rpc('registrar_consumo_com_credito', {
    p_cliente_id: input.cliente_id,
    p_valor_centavos: input.valor_centavos,
    p_data_movimento: input.data_movimento,
    p_descricao: input.descricao?.trim() || null,
    p_request_id: requestId,
  })

  if (error) throw error

  // Busca o consumo recém-criado
  const consumoId = data?.consumo_id
  if (consumoId) {
    const { data: rec, error: getErr } = await database
      .from('consumos')
      .select('*')
      .eq('id', consumoId)
      .single()
    if (!getErr && rec) return rec as Consumo
  }

  return {
    id: consumoId || requestId,
    cliente_id: input.cliente_id,
    valor_centavos: input.valor_centavos,
    descricao: input.descricao?.trim() || null,
    data_movimento: input.data_movimento,
    data_registro: new Date().toISOString(),
    registrado_por: _userId,
    status: 'ativo',
    request_id: requestId,
    seq: 0,
  }
}

/**
 * Registra pagamento atômico do fiado com verificação de excedente e geração de crédito
 */
export type RegistrarPagamentoInput = {
  cliente_id: string
  valor_centavos: number
  forma: FormaPagamento
  data_movimento: string
}

export type RegistrarPagamentoResult = {
  pagamento_id: string
  credito_id: string | null
  valor_centavos: number
  credito_gerado_centavos: number
  saldo_devedor_anterior: number
  saldo_devedor_atual: number
  idempotente: boolean
}

export const registrarPagamentoFiado = async (
  input: RegistrarPagamentoInput,
): Promise<RegistrarPagamentoResult> => {
  const requestId = crypto.randomUUID()

  const { data, error } = await database.rpc('registrar_pagamento_fiado', {
    p_cliente_id: input.cliente_id,
    p_valor_centavos: input.valor_centavos,
    p_forma: input.forma,
    p_data_movimento: input.data_movimento,
    p_request_id: requestId,
  })

  if (error) throw error
  return data as RegistrarPagamentoResult
}

/**
 * Edita pagamento fiado recalculando dívida, crédito vinculado e histórico
 */
export type EditarPagamentoInput = {
  pagamento_id: string
  novo_valor_centavos: number
  nova_forma: FormaPagamento
  nova_data_movimento: string
}

export const editarPagamentoFiado = async (input: EditarPagamentoInput): Promise<any> => {
  const { data, error } = await database.rpc('editar_pagamento_fiado', {
    p_pagamento_id: input.pagamento_id,
    p_novo_valor_centavos: input.novo_valor_centavos,
    p_nova_forma: input.nova_forma,
    p_nova_data_movimento: input.nova_data_movimento,
  })

  if (error) throw error
  return data
}

/**
 * Cancela pagamento fiado desfazendo efeitos sobre dívida/crédito
 */
export const cancelarPagamentoFiado = async (
  pagamentoId: string,
  motivo?: string,
): Promise<any> => {
  const { data, error } = await database.rpc('cancelar_pagamento_fiado', {
    p_pagamento_id: pagamentoId,
    p_motivo: motivo || 'Cancelamento de pagamento',
  })

  if (error) throw error
  return data
}

/**
 * Edita consumo fiado com suporte a correção de valor, descrição, data e troca de cliente
 */
export type EditarConsumoInput = {
  consumo_id: string
  novo_valor_centavos: number
  nova_descricao?: string | null
  nova_data_movimento: string
  novo_cliente_id?: string | null
}

export const editarConsumoFiado = async (input: EditarConsumoInput): Promise<any> => {
  const { data, error } = await database.rpc('editar_consumo_fiado', {
    p_consumo_id: input.consumo_id,
    p_novo_valor_centavos: input.novo_valor_centavos,
    p_nova_descricao: input.nova_descricao?.trim() || null,
    p_nova_data_movimento: input.nova_data_movimento,
    p_novo_cliente_id: input.novo_cliente_id || null,
  })

  if (error) throw error
  return data
}

/**
 * Cancela consumo fiado logicamente e recalcula cronologicamente
 */
export const cancelarConsumoFiado = async (consumoId: string, motivo?: string): Promise<any> => {
  const { data, error } = await database.rpc('cancelar_consumo_fiado', {
    p_consumo_id: consumoId,
    p_motivo: motivo || 'Cancelamento de consumo',
  })

  if (error) throw error
  return data
}

/**
 * Força recálculo cronológico completo da conta do cliente
 */
export const recalcularClienteCronologico = async (clienteId: string): Promise<any> => {
  const { data, error } = await database.rpc('recalcular_cliente_cronologico', {
    p_cliente_id: clienteId,
  })

  if (error) throw error
  return data
}

/**
 * 14. RELATÓRIOS DO FIADO (MENSAL E ANUAL)
 * Calcula a evolução cronológica real dos saldos de cada cliente no período:
 * dívida inicial, crédito inicial, consumos do período, pagamentos do período,
 * crédito gerado, crédito utilizado, crédito devolvido, dívida final e crédito final.
 * Temporalidade estrita: mostra a posição correspondente ao FINAL do período selecionado.
 */
export const getRelatorioFiado = async (
  tipo: PeriodoRelatorioFiado,
  ano: number,
  mes?: number, // 1-12
): Promise<RelatorioFiadoPeriodo> => {
  let dataInicio: string
  let dataFim: string
  let tituloPeriodo: string

  const mesesNomes = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]

  if (tipo === 'mes') {
    const m = mes || new Date().getMonth() + 1
    const ultimoDia = new Date(ano, m, 0).getDate()
    dataInicio = `${ano}-${String(m).padStart(2, '0')}-01`
    dataFim = `${ano}-${String(m).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
    tituloPeriodo = `${mesesNomes[m - 1]} de ${ano}`
  } else {
    dataInicio = `${ano}-01-01`
    dataFim = `${ano}-12-31`
    tituloPeriodo = `Ano de ${ano}`
  }

  // 1. Busca todos os clientes cadastrados
  const { data: clientesData, error: errClientes } = await database
    .from('clientes')
    .select('id, nome, apelido, telefone, criado_em')
    .order('nome', { ascending: true })

  if (errClientes) throw errClientes

  // 2. Busca todos os consumos, pagamentos e créditos ativos até dataFim
  const [consumosRes, pagamentosRes, creditosRes] = await Promise.all([
    database
      .from('consumos')
      .select('id, cliente_id, valor_centavos, data_movimento, data_registro, seq')
      .eq('status', 'ativo')
      .lte('data_movimento', dataFim)
      .order('data_movimento', { ascending: true })
      .order('seq', { ascending: true })
      .order('data_registro', { ascending: true }),

    database
      .from('pagamentos')
      .select(
        'id, cliente_id, valor_centavos, forma, credito_id, data_movimento, data_registro, seq',
      )
      .eq('status', 'ativo')
      .lte('data_movimento', dataFim)
      .order('data_movimento', { ascending: true })
      .order('seq', { ascending: true })
      .order('data_registro', { ascending: true }),

    database
      .from('creditos')
      .select(
        'id, cliente_id, tipo, valor_centavos, origem_pagamento_id, movimento_vinculado_id, data_movimento, data_registro, seq',
      )
      .eq('status', 'ativo')
      .lte('data_movimento', dataFim)
      .order('data_movimento', { ascending: true })
      .order('seq', { ascending: true })
      .order('data_registro', { ascending: true }),
  ])

  if (consumosRes.error) throw consumosRes.error
  if (pagamentosRes.error) throw pagamentosRes.error
  if (creditosRes.error) throw creditosRes.error

  const todosConsumos = consumosRes.data || []
  const todosPagamentos = pagamentosRes.data || []
  const todosCreditos = creditosRes.data || []

  // Agrupa eventos por cliente
  type EventoSimulacao = {
    tipo: 'consumo' | 'pagamento' | 'devolucao'
    id: string
    valor_centavos: number
    data_movimento: string
    data_registro: string
    seq: number
  }

  const eventosPorCliente = new Map<string, EventoSimulacao[]>()

  for (const c of todosConsumos) {
    if (!eventosPorCliente.has(c.cliente_id)) eventosPorCliente.set(c.cliente_id, [])
    eventosPorCliente.get(c.cliente_id)!.push({
      tipo: 'consumo',
      id: c.id,
      valor_centavos: Number(c.valor_centavos),
      data_movimento: c.data_movimento,
      data_registro: c.data_registro,
      seq: c.seq,
    })
  }

  for (const p of todosPagamentos) {
    if (!eventosPorCliente.has(p.cliente_id)) eventosPorCliente.set(p.cliente_id, [])
    eventosPorCliente.get(p.cliente_id)!.push({
      tipo: 'pagamento',
      id: p.id,
      valor_centavos: Number(p.valor_centavos),
      data_movimento: p.data_movimento,
      data_registro: p.data_registro,
      seq: p.seq,
    })
  }

  for (const cr of todosCreditos) {
    if (cr.tipo === 'devolucao') {
      if (!eventosPorCliente.has(cr.cliente_id)) eventosPorCliente.set(cr.cliente_id, [])
      eventosPorCliente.get(cr.cliente_id)!.push({
        tipo: 'devolucao',
        id: cr.id,
        valor_centavos: Number(cr.valor_centavos),
        data_movimento: cr.data_movimento,
        data_registro: cr.data_registro,
        seq: cr.seq,
      })
    }
  }

  const clientesEvolucao: EvolucaoClienteFiado[] = []

  let totalBarDividaInicial = 0
  let totalBarConsumos = 0
  let totalBarPagamentos = 0
  let totalBarDividaFinal = 0
  let totalBarCreditoInicial = 0
  let totalBarCreditoGerado = 0
  let totalBarCreditoUtilizado = 0
  let totalBarCreditoDevolvido = 0
  let totalBarCreditoFinal = 0

  for (const c of clientesData || []) {
    const rawEventos = eventosPorCliente.get(c.id) || []
    // Ordena cronologicamente
    const eventos = rawEventos.slice().sort((a, b) => {
      if (a.data_movimento !== b.data_movimento) {
        return a.data_movimento.localeCompare(b.data_movimento)
      }
      if (a.seq !== b.seq) {
        return a.seq - b.seq
      }
      return a.data_registro.localeCompare(b.data_registro)
    })

    // Simula a evolução cronológica
    let dividaAcum = 0
    let creditoAcum = 0

    let dividaInicioPeriodo = 0
    let creditoInicioPeriodo = 0

    let consumosPeriodo = 0
    let pagamentosRecebidosPeriodo = 0
    let pagamentosAmortizadosPeriodo = 0
    let creditoGeradoPeriodo = 0
    let creditoUtilizadoPeriodo = 0
    let creditoDevolvidoPeriodo = 0

    let processouInicio = false

    for (const ev of eventos) {
      const antesDoPeriodo = ev.data_movimento < dataInicio
      const noPeriodo = ev.data_movimento >= dataInicio && ev.data_movimento <= dataFim

      if (noPeriodo && !processouInicio) {
        dividaInicioPeriodo = dividaAcum
        creditoInicioPeriodo = creditoAcum
        processouInicio = true
      }

      if (ev.tipo === 'consumo') {
        const credUsar = creditoAcum > 0 ? Math.min(creditoAcum, ev.valor_centavos) : 0
        creditoAcum -= credUsar
        const novaDivida = ev.valor_centavos - credUsar
        dividaAcum += novaDivida

        if (noPeriodo) {
          consumosPeriodo += ev.valor_centavos
          creditoUtilizadoPeriodo += credUsar
        }
      } else if (ev.tipo === 'pagamento') {
        let amortizacao = 0
        let excedente = 0

        if (ev.valor_centavos > dividaAcum) {
          amortizacao = dividaAcum
          excedente = ev.valor_centavos - dividaAcum
          dividaAcum = 0
        } else {
          amortizacao = ev.valor_centavos
          excedente = 0
          dividaAcum -= amortizacao
        }
        creditoAcum += excedente

        if (noPeriodo) {
          pagamentosRecebidosPeriodo += ev.valor_centavos
          pagamentosAmortizadosPeriodo += amortizacao
          creditoGeradoPeriodo += excedente
        }
      } else if (ev.tipo === 'devolucao') {
        if (ev.valor_centavos > creditoAcum) {
          creditoAcum = 0
        } else {
          creditoAcum -= ev.valor_centavos
        }

        if (noPeriodo) {
          creditoDevolvidoPeriodo += ev.valor_centavos
        }
      }
    }

    if (!processouInicio) {
      // Se todos os eventos foram antes do período, a dívida inicial é a final acumulada até então
      dividaInicioPeriodo = dividaAcum
      creditoInicioPeriodo = creditoAcum
    }

    const dividaFinal = dividaAcum
    const creditoFinal = creditoAcum

    // Filtra clientes que tiveram movimentação OU saldo no início/final do período
    const teveAtividadeOuSaldo =
      dividaInicioPeriodo > 0 ||
      creditoInicioPeriodo > 0 ||
      consumosPeriodo > 0 ||
      pagamentosRecebidosPeriodo > 0 ||
      creditoDevolvidoPeriodo > 0 ||
      dividaFinal > 0 ||
      creditoFinal > 0

    if (teveAtividadeOuSaldo) {
      clientesEvolucao.push({
        cliente_id: c.id,
        nome: c.nome,
        apelido: c.apelido,
        telefone: c.telefone,
        dividaInicialCentavos: dividaInicioPeriodo,
        consumosPeriodoCentavos: consumosPeriodo,
        pagamentosAmortizadosPeriodoCentavos: pagamentosAmortizadosPeriodo,
        creditoUtilizadoPeriodoCentavos: creditoUtilizadoPeriodo,
        dividaFinalCentavos: dividaFinal,
        pagamentosRecebidosPeriodoCentavos: pagamentosRecebidosPeriodo,
        creditoInicialCentavos: creditoInicioPeriodo,
        creditoGeradoPeriodoCentavos: creditoGeradoPeriodo,
        creditoDevolvidoPeriodoCentavos: creditoDevolvidoPeriodo,
        creditoFinalCentavos: creditoFinal,
      })

      totalBarDividaInicial += dividaInicioPeriodo
      totalBarConsumos += consumosPeriodo
      totalBarPagamentos += pagamentosRecebidosPeriodo
      totalBarDividaFinal += dividaFinal
      totalBarCreditoInicial += creditoInicioPeriodo
      totalBarCreditoGerado += creditoGeradoPeriodo
      totalBarCreditoUtilizado += creditoUtilizadoPeriodo
      totalBarCreditoDevolvido += creditoDevolvidoPeriodo
      totalBarCreditoFinal += creditoFinal
    }
  }

  // Ordena clientes por dívida final decrescente, depois por nome
  clientesEvolucao.sort((a, b) => {
    if (b.dividaFinalCentavos !== a.dividaFinalCentavos) {
      return b.dividaFinalCentavos - a.dividaFinalCentavos
    }
    return a.nome.localeCompare(b.nome)
  })

  return {
    tipo,
    ano,
    mes,
    dataInicio,
    dataFim,
    tituloPeriodo,
    clientes: clientesEvolucao,
    totais: {
      totalClientes: clientesEvolucao.length,
      dividaInicialCentavos: totalBarDividaInicial,
      consumosPeriodoCentavos: totalBarConsumos,
      pagamentosRecebidosPeriodoCentavos: totalBarPagamentos,
      dividaFinalCentavos: totalBarDividaFinal,
      creditoInicialCentavos: totalBarCreditoInicial,
      creditoGeradoPeriodoCentavos: totalBarCreditoGerado,
      creditoUtilizadoPeriodoCentavos: totalBarCreditoUtilizado,
      creditoDevolvidoPeriodoCentavos: totalBarCreditoDevolvido,
      creditoFinalCentavos: totalBarCreditoFinal,
    },
  }
}

/**
 * 15. DETALHAMENTO DE CLIENTE NO PERÍODO DO FIADO
 */
export const getDetalhamentoClientePeriodo = async (
  clienteId: string,
  dataInicio: string,
  dataFim: string,
): Promise<DetalhamentoClientePeriodo> => {
  const [clienteRes, consumosRes, pagamentosRes, creditosRes] = await Promise.all([
    database.from('clientes').select('*').eq('id', clienteId).single(),
    database
      .from('consumos')
      .select('id, data_movimento, descricao, valor_centavos, status')
      .eq('cliente_id', clienteId)
      .gte('data_movimento', dataInicio)
      .lte('data_movimento', dataFim)
      .order('data_movimento', { ascending: false })
      .order('seq', { ascending: false }),
    database
      .from('pagamentos')
      .select('id, data_movimento, forma, valor_centavos, status')
      .eq('cliente_id', clienteId)
      .gte('data_movimento', dataInicio)
      .lte('data_movimento', dataFim)
      .order('data_movimento', { ascending: false })
      .order('seq', { ascending: false }),
    database
      .from('creditos')
      .select('id, tipo, data_movimento, valor_centavos, status')
      .eq('cliente_id', clienteId)
      .gte('data_movimento', dataInicio)
      .lte('data_movimento', dataFim)
      .order('data_movimento', { ascending: false })
      .order('seq', { ascending: false }),
  ])

  if (clienteRes.error) throw clienteRes.error
  if (consumosRes.error) throw consumosRes.error
  if (pagamentosRes.error) throw pagamentosRes.error
  if (creditosRes.error) throw creditosRes.error

  return {
    cliente: clienteRes.data as Cliente,
    consumos: (consumosRes.data || []).map((c: any) => ({
      ...c,
      valor_centavos: Number(c.valor_centavos),
    })),
    pagamentos: (pagamentosRes.data || []).map((p: any) => ({
      ...p,
      valor_centavos: Number(p.valor_centavos),
    })),
    operacoesCredito: (creditosRes.data || []).map((cr: any) => ({
      ...cr,
      valor_centavos: Number(cr.valor_centavos),
    })),
  }
}
