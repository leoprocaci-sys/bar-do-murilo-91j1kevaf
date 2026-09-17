import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import type {
  DinheiroInicial,
  MovimentacaoCaixaItem,
  PeriodoRelatorio,
  RelatorioCaixa,
  ResumoCaixaDia,
  RetiradaMercadoria,
  Saida,
  VendaDireta,
  VendaForma,
} from '@/types/caixa'

const database = supabase as unknown as SupabaseClient

/**
 * Utilitário: calcula intervalo de datas ISO (YYYY-MM-DD)
 * SEMANA = segunda-feira a domingo
 */
export const calcularIntervaloPeriodo = (
  periodo: PeriodoRelatorio,
  dataBaseStr: string,
): { dataInicio: string; dataFim: string; tituloPeriodo: string } => {
  const [y, m, d] = dataBaseStr.split('-').map(Number)
  const base = new Date(y, m - 1, d)

  if (periodo === 'dia') {
    return {
      dataInicio: dataBaseStr,
      dataFim: dataBaseStr,
      tituloPeriodo: `Dia ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
    }
  }

  if (periodo === 'semana') {
    // Segunda-feira como primeiro dia da semana
    const dayOfWeek = base.getDay() // 0 = Domingo, 1 = Segunda...
    // Diferença até a segunda-feira anterior (ou ela mesma)
    // Se domingo (0), diff = -6; se seg (1), diff = 0; se ter (2), diff = -1...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    const monday = new Date(base)
    monday.setDate(base.getDate() + diffToMonday)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const fMonday = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
    const fSunday = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`

    return {
      dataInicio: fMonday,
      dataFim: fSunday,
      tituloPeriodo: `Semana de ${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')} a ${String(sunday.getDate()).padStart(2, '0')}/${String(sunday.getMonth() + 1).padStart(2, '0')}/${sunday.getFullYear()}`,
    }
  }

  // periodo === 'mes'
  const firstDay = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0) // último dia do mês

  const fStart = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`
  const fEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

  const meses = [
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
  const nomeMes = meses[m - 1]

  return {
    dataInicio: fStart,
    dataFim: fEnd,
    tituloPeriodo: `${nomeMes} de ${y}`,
  }
}

/**
 * 1. DINHEIRO INICIAL DO DIA
 * - Se nenhum informado: R$ 0,00 (dinheiroInicialInformado = false)
 * - Pode ser cadastrado ou editado no mesmo registro lógico
 */
export const getDinheiroInicialDia = async (dataStr: string): Promise<DinheiroInicial | null> => {
  const { data, error } = await database
    .from('dinheiro_inicial')
    .select(`
      *,
      editado_por_user:app_users!dinheiro_inicial_editado_por_fkey (nome)
    `)
    .eq('data', dataStr)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
    valor_centavos: Number(data.valor_centavos),
    editado_por_nome: (data.editado_por_user as any)?.nome || 'Administrador',
  } as DinheiroInicial
}

export const salvarDinheiroInicial = async (
  dataStr: string,
  valorCentavos: number,
  userId: string,
): Promise<DinheiroInicial> => {
  if (valorCentavos < 0) {
    throw new Error('O dinheiro inicial não pode ser negativo.')
  }

  // Verifica se já existe registro para a data
  const existente = await getDinheiroInicialDia(dataStr)

  if (existente) {
    // Atualiza o mesmo registro lógico
    const { data, error } = await database
      .from('dinheiro_inicial')
      .update({
        valor_centavos: valorCentavos,
        editado_por: userId,
      })
      .eq('id', existente.id)
      .select()
      .single()

    if (error) throw error
    return {
      ...data,
      valor_centavos: Number(data.valor_centavos),
    } as DinheiroInicial
  }

  // Cria novo registro com request_id
  const requestId = crypto.randomUUID()
  const { data, error } = await database
    .from('dinheiro_inicial')
    .insert({
      data: dataStr,
      valor_centavos: valorCentavos,
      editado_por: userId,
      request_id: requestId,
    })
    .select()
    .single()

  if (error) throw error
  return {
    ...data,
    valor_centavos: Number(data.valor_centavos),
  } as DinheiroInicial
}

/**
 * 2. REGISTRAR VENDA DIRETA
 */
export type RegistrarVendaDiretaInput = {
  valor_centavos: number
  forma: VendaForma
  descricao?: string | null
  data_movimento: string // YYYY-MM-DD
}

export const registrarVendaDireta = async (
  input: RegistrarVendaDiretaInput,
  userId: string,
): Promise<VendaDireta> => {
  if (!input.valor_centavos || input.valor_centavos <= 0) {
    throw new Error('O valor da venda deve ser maior que zero.')
  }

  const requestId = crypto.randomUUID()
  const desc = input.descricao?.trim() || 'Venda direta balcão'

  const { data, error } = await database
    .from('vendas_diretas')
    .insert({
      descricao: desc,
      valor_centavos: input.valor_centavos,
      forma: input.forma,
      data_movimento: input.data_movimento,
      registrado_por: userId,
      status: 'ativo',
      request_id: requestId,
    })
    .select()
    .single()

  if (error) throw error
  return {
    ...data,
    valor_centavos: Number(data.valor_centavos),
  } as VendaDireta
}

/**
 * 3. REGISTRAR SAÍDA
 */
export type RegistrarSaidaInput = {
  valor_centavos: number
  origem: 'gaveta' | 'conta_pix'
  descricao: string
  data_movimento: string // YYYY-MM-DD
}

export const registrarSaida = async (
  input: RegistrarSaidaInput,
  userId: string,
): Promise<Saida> => {
  if (!input.valor_centavos || input.valor_centavos <= 0) {
    throw new Error('O valor da saída deve ser maior que zero.')
  }
  if (!input.descricao || !input.descricao.trim()) {
    throw new Error('A descrição da saída é obrigatória.')
  }

  const requestId = crypto.randomUUID()

  const { data, error } = await database
    .from('saidas')
    .insert({
      descricao: input.descricao.trim(),
      valor_centavos: input.valor_centavos,
      origem: input.origem,
      data_movimento: input.data_movimento,
      registrado_por: userId,
      status: 'ativo',
      request_id: requestId,
    })
    .select()
    .single()

  if (error) throw error
  return {
    ...data,
    valor_centavos: Number(data.valor_centavos),
  } as Saida
}

/**
 * 4. REGISTRAR RETIRADA EM MERCADORIA
 */
export type RegistrarRetiradaMercadoriaInput = {
  valor_centavos: number
  consumidor: string
  descricao: string
  data_movimento: string // YYYY-MM-DD
}

/**
 * Edita uma venda direta existente recalculando os efeitos no Caixa
 */
export type EditarVendaDiretaInput = {
  venda_id: string
  novo_valor_centavos: number
  nova_forma: VendaForma
  nova_descricao?: string | null
  nova_data_movimento: string
}

export const editarVendaDireta = async (input: EditarVendaDiretaInput): Promise<any> => {
  const { data, error } = await database.rpc('editar_venda_direta', {
    p_venda_id: input.venda_id,
    p_novo_valor_centavos: input.novo_valor_centavos,
    p_nova_forma: input.nova_forma,
    p_nova_descricao: input.nova_descricao?.trim() || 'Venda direta balcão',
    p_nova_data_movimento: input.nova_data_movimento,
  })

  if (error) throw error
  return data
}

/**
 * Cancela venda direta logicamente
 */
export const cancelarVendaDireta = async (vendaId: string, motivo?: string): Promise<any> => {
  const { data, error } = await database.rpc('cancelar_venda_direta', {
    p_venda_id: vendaId,
    p_motivo: motivo || 'Cancelamento de venda',
  })

  if (error) throw error
  return data
}

/**
 * Edita uma saída do Caixa (gaveta ou conta_pix)
 */
export type EditarSaidaInput = {
  saida_id: string
  novo_valor_centavos: number
  nova_origem: 'gaveta' | 'conta_pix'
  nova_descricao: string
  nova_data_movimento: string
}

export const editarSaida = async (input: EditarSaidaInput): Promise<any> => {
  const { data, error } = await database.rpc('editar_saida', {
    p_saida_id: input.saida_id,
    p_novo_valor_centavos: input.novo_valor_centavos,
    p_nova_origem: input.nova_origem,
    p_nova_descricao: input.nova_descricao.trim(),
    p_nova_data_movimento: input.nova_data_movimento,
  })

  if (error) throw error
  return data
}

/**
 * Cancela saída do Caixa
 */
export const cancelarSaida = async (saidaId: string, motivo?: string): Promise<any> => {
  const { data, error } = await database.rpc('cancelar_saida', {
    p_saida_id: saidaId,
    p_motivo: motivo || 'Cancelamento de saída',
  })

  if (error) throw error
  return data
}

export const registrarRetiradaMercadoria = async (
  input: RegistrarRetiradaMercadoriaInput,
  userId: string,
): Promise<RetiradaMercadoria> => {
  if (!input.valor_centavos || input.valor_centavos <= 0) {
    throw new Error('O valor da retirada deve ser maior que zero.')
  }
  if (!input.consumidor || !input.consumidor.trim()) {
    throw new Error('Informe quem consumiu/retirou a mercadoria.')
  }
  if (!input.descricao || !input.descricao.trim()) {
    throw new Error('A descrição da mercadoria retirada é obrigatória.')
  }

  const requestId = crypto.randomUUID()

  const { data, error } = await database
    .from('retiradas_mercadoria')
    .insert({
      descricao: input.descricao.trim(),
      consumidor: input.consumidor.trim(),
      valor_centavos: input.valor_centavos,
      data_movimento: input.data_movimento,
      registrado_por: userId,
      status: 'ativo',
      request_id: requestId,
    })
    .select()
    .single()

  if (error) throw error
  return {
    ...data,
    valor_centavos: Number(data.valor_centavos),
  } as RetiradaMercadoria
}

/**
 * 5. DEVOLUÇÃO DE CRÉDITO ATÔMICA
 */
export type RegistrarDevolucaoCreditoInput = {
  cliente_id: string
  valor_centavos: number
  forma_devolucao: 'dinheiro' | 'conta_pix'
  data_movimento: string // YYYY-MM-DD
}

export const registrarDevolucaoCredito = async (
  input: RegistrarDevolucaoCreditoInput,
): Promise<{
  saida_id: string
  credito_id: string
  cliente_id: string
  valor_centavos: number
  origem: string
  forma_devolucao: string
}> => {
  const requestId = crypto.randomUUID()

  const { data, error } = await database.rpc('registrar_devolucao_credito', {
    p_cliente_id: input.cliente_id,
    p_valor_centavos: input.valor_centavos,
    p_forma_devolucao: input.forma_devolucao,
    p_data_movimento: input.data_movimento,
    p_request_id: requestId,
  })

  if (error) throw error
  return data
}

/**
 * Edita retirada em mercadoria
 */
export type EditarRetiradaMercadoriaInput = {
  retirada_id: string
  novo_valor_centavos: number
  novo_consumidor: string
  nova_descricao: string
  nova_data_movimento: string
}

export const editarRetiradaMercadoria = async (
  input: EditarRetiradaMercadoriaInput,
): Promise<any> => {
  const { data, error } = await database.rpc('editar_retirada_mercadoria', {
    p_retirada_id: input.retirada_id,
    p_novo_valor_centavos: input.novo_valor_centavos,
    p_novo_consumidor: input.novo_consumidor.trim(),
    p_nova_descricao: input.nova_descricao.trim(),
    p_nova_data_movimento: input.nova_data_movimento,
  })

  if (error) throw error
  return data
}

/**
 * Cancela retirada em mercadoria
 */
export const cancelarRetiradaMercadoria = async (
  retiradaId: string,
  motivo?: string,
): Promise<any> => {
  const { data, error } = await database.rpc('cancelar_retirada_mercadoria', {
    p_retirada_id: retiradaId,
    p_motivo: motivo || 'Cancelamento de retirada',
  })

  if (error) throw error
  return data
}

/**
 * Cancela devolução de crédito (restaura crédito do cliente e cancela saída vinculada)
 */
export const cancelarDevolucaoCredito = async (
  creditoDevolucaoId: string,
  motivo?: string,
): Promise<any> => {
  const { data, error } = await database.rpc('cancelar_devolucao_credito', {
    p_credito_devolucao_id: creditoDevolucaoId,
    p_motivo: motivo || 'Cancelamento de devolução de crédito',
  })

  if (error) throw error
  return data
}

/**
 * 6. RESUMO DO CAIXA DO DIA
 * Deriva os 4 indicadores principais a partir das fontes transacionais:
 * 1. DINHEIRO EM CAIXA (Saldo esperado na gaveta - calculado)
 * 2. VENDAS E CONSUMOS
 * 3. SAÍDAS EM DINHEIRO / CONTA
 * 4. RETIRADAS EM MERCADORIA
 */
export const getResumoCaixaDia = async (dataStr: string): Promise<ResumoCaixaDia> => {
  // A. Dinheiro Inicial do dia
  const dinheiroInicialRec = await getDinheiroInicialDia(dataStr)
  const dinheiroInicialCentavos = dinheiroInicialRec ? dinheiroInicialRec.valor_centavos : 0
  const dinheiroInicialInformado = Boolean(dinheiroInicialRec)

  // Consultas paralelas para as tabelas transacionais na data
  const [
    vendasDiretasRes,
    consumosRes,
    pagamentosRes,
    saidasRes,
    retiradasRes,
    creditosUtilizadosRes,
  ] = await Promise.all([
    // Vendas diretas
    database
      .from('vendas_diretas')
      .select('valor_centavos, forma, status')
      .eq('data_movimento', dataStr)
      .eq('status', 'ativo'),

    // Consumos fiados
    database
      .from('consumos')
      .select('valor_centavos, status')
      .eq('data_movimento', dataStr)
      .eq('status', 'ativo'),

    // Pagamentos fiado (recebimentos)
    database
      .from('pagamentos')
      .select('valor_centavos, forma, status')
      .eq('data_movimento', dataStr)
      .eq('status', 'ativo'),

    // Saídas (inclui saídas de devolução de crédito)
    database
      .from('saidas')
      .select('valor_centavos, origem, vinculo_credito_id, status')
      .eq('data_movimento', dataStr)
      .eq('status', 'ativo'),

    // Retiradas em mercadoria
    database
      .from('retiradas_mercadoria')
      .select('valor_centavos, consumidor, status')
      .eq('data_movimento', dataStr)
      .eq('status', 'ativo'),

    // Créditos utilizados em compras fiadas
    database
      .from('creditos')
      .select('valor_centavos, tipo, status')
      .eq('data_movimento', dataStr)
      .eq('tipo', 'utilizacao')
      .eq('status', 'ativo'),
  ])

  if (vendasDiretasRes.error) throw vendasDiretasRes.error
  if (consumosRes.error) throw consumosRes.error
  if (pagamentosRes.error) throw pagamentosRes.error
  if (saidasRes.error) throw saidasRes.error
  if (retiradasRes.error) throw retiradasRes.error
  if (creditosUtilizadosRes.error) throw creditosUtilizadosRes.error

  const vendasDiretas = vendasDiretasRes.data ?? []
  const consumos = consumosRes.data ?? []
  const pagamentos = pagamentosRes.data ?? []
  const saidas = saidasRes.data ?? []
  const retiradas = retiradasRes.data ?? []
  const creditosUtilizados = creditosUtilizadosRes.data ?? []

  // Vendas diretas totais e por forma
  let vendasDiretasTotal = 0
  let vendasDiretasDinheiro = 0
  for (const v of vendasDiretas) {
    const val = Number(v.valor_centavos)
    vendasDiretasTotal += val
    if (v.forma === 'dinheiro') {
      vendasDiretasDinheiro += val
    }
  }

  // Consumos fiados (Vendas fiadas realizadas)
  let vendasFiadasTotal = 0
  for (const c of consumos) {
    vendasFiadasTotal += Number(c.valor_centavos)
  }

  // Retiradas em mercadoria
  let retiradasTotal = 0
  for (const r of retiradas) {
    retiradasTotal += Number(r.valor_centavos)
  }

  // Recebimentos de fiado totais e em dinheiro
  let pagamentosTotal = 0
  let pagamentosDinheiro = 0
  for (const p of pagamentos) {
    const val = Number(p.valor_centavos)
    pagamentosTotal += val
    if (p.forma === 'dinheiro') {
      pagamentosDinheiro += val
    }
  }

  // Saídas financeiras
  let saidasTotal = 0
  let saidasGaveta = 0
  let devolucoesGaveta = 0
  for (const s of saidas) {
    const val = Number(s.valor_centavos)
    saidasTotal += val
    if (s.origem === 'gaveta') {
      if (s.vinculo_credito_id) {
        devolucoesGaveta += val
      } else {
        saidasGaveta += val
      }
    }
  }

  // Crédito utilizado (informativo)
  let creditoUtilizadoTotal = 0
  for (const cu of creditosUtilizados) {
    creditoUtilizadoTotal += Number(cu.valor_centavos)
  }

  // Indicador 1: DINHEIRO EM CAIXA (Saldo esperado na gaveta)
  // Entradas físicas: Dinheiro inicial + Vendas diretas em dinheiro + Recebimentos de fiado em dinheiro
  // Saídas físicas: Saídas classificadas como gaveta + Devoluções de crédito em dinheiro (gaveta)
  const entradasFisicasTotal = dinheiroInicialCentavos + vendasDiretasDinheiro + pagamentosDinheiro
  const saidasFisicasTotal = saidasGaveta + devolucoesGaveta
  const saldoEsperadoGaveta = entradasFisicasTotal - saidasFisicasTotal

  // Indicador 2: VENDAS E CONSUMOS
  // Vendas diretas (todas) + Vendas fiadas + Retiradas em mercadoria
  const vendasEConsumosTotal = vendasDiretasTotal + vendasFiadasTotal + retiradasTotal

  // Indicador 3: SAÍDAS EM DINHEIRO / CONTA
  // Todas as saídas registradas (gaveta + conta_pix + devoluções de crédito em ambas)
  const saidasDinheiroContaTotal = saidasTotal

  // Indicador 4: RETIRADAS EM MERCADORIA
  const retiradasMercadoriaTotal = retiradasTotal

  return {
    data: dataStr,
    dinheiroInicialCentavos,
    dinheiroInicialInformado,
    dinheiroEmCaixaCentavos: saldoEsperadoGaveta,
    vendasEConsumosCentavos: vendasEConsumosTotal,
    saidasDinheiroContaCentavos: saidasDinheiroContaTotal,
    retiradasMercadoriaCentavos: retiradasMercadoriaTotal,
    entradasFisicasCentavos: {
      dinheiroInicial: dinheiroInicialCentavos,
      vendasDiretasDinheiro,
      recebimentosFiadoDinheiro: pagamentosDinheiro,
      total: entradasFisicasTotal,
    },
    saidasFisicasCentavos: {
      saidasGaveta,
      devolucoesGaveta,
      total: saidasFisicasTotal,
    },
    recebimentosFiadoTotalCentavos: pagamentosTotal,
    vendasDiretasTotalCentavos: vendasDiretasTotal,
    vendasFiadasTotalCentavos: vendasFiadasTotal,
    creditoUtilizadoCentavos: creditoUtilizadoTotal,
  }
}

/**
 * 7. MOVIMENTAÇÃO DO DIA (Visão cronológica dos eventos do dia)
 * Não duplica dados no banco: reúne transações do dia com ordenação temporal coerente.
 */
export const getMovimentacaoDia = async (dataStr: string): Promise<MovimentacaoCaixaItem[]> => {
  const [vendasRes, consumosRes, pagamentosRes, saidasRes, retiradasRes, dinheiroInicialRec] =
    await Promise.all([
      database
        .from('vendas_diretas')
        .select(`
        *,
        registrado_por_user:app_users!vendas_diretas_registrado_por_fkey (nome)
      `)
        .eq('data_movimento', dataStr)
        .order('data_registro', { ascending: false }),

      database
        .from('consumos')
        .select(`
        *,
        cliente:clientes!consumos_cliente_id_fkey (nome, apelido),
        registrado_por_user:app_users!consumos_registrado_por_fkey (nome)
      `)
        .eq('data_movimento', dataStr)
        .order('data_registro', { ascending: false }),

      database
        .from('pagamentos')
        .select(`
        *,
        cliente:clientes!pagamentos_cliente_id_fkey (nome, apelido),
        registrado_por_user:app_users!pagamentos_registrado_por_fkey (nome)
      `)
        .eq('data_movimento', dataStr)
        .order('data_registro', { ascending: false }),

      database
        .from('saidas')
        .select(`
        *,
        credito:creditos!saidas_vinculo_credito_id_fkey (cliente_id, cliente:clientes!creditos_cliente_id_fkey (nome, apelido)),
        registrado_por_user:app_users!saidas_registrado_por_fkey (nome)
      `)
        .eq('data_movimento', dataStr)
        .order('data_registro', { ascending: false }),

      database
        .from('retiradas_mercadoria')
        .select(`
        *,
        registrado_por_user:app_users!retiradas_mercadoria_registrado_por_fkey (nome)
      `)
        .eq('data_movimento', dataStr)
        .order('data_registro', { ascending: false }),

      getDinheiroInicialDia(dataStr),
    ])

  if (vendasRes.error) throw vendasRes.error
  if (consumosRes.error) throw consumosRes.error
  if (pagamentosRes.error) throw pagamentosRes.error
  if (saidasRes.error) throw saidasRes.error
  if (retiradasRes.error) throw retiradasRes.error

  const itens: MovimentacaoCaixaItem[] = []

  // Dinheiro Inicial (se registrado e > 0)
  if (dinheiroInicialRec && dinheiroInicialRec.valor_centavos > 0) {
    itens.push({
      id: dinheiroInicialRec.id,
      tipo: 'dinheiro_inicial',
      titulo: 'Dinheiro Inicial do Dia',
      subtitulo: 'Fundo de gaveta informado',
      descricao: 'Dinheiro físico disponível no início do expediente',
      valor_centavos: dinheiroInicialRec.valor_centavos,
      forma_ou_meio: 'Dinheiro',
      cliente_ou_pessoa: null,
      data_movimento: dinheiroInicialRec.data,
      data_registro: dinheiroInicialRec.data_registro,
      registrado_por: dinheiroInicialRec.editado_por,
      registrado_por_nome: dinheiroInicialRec.editado_por_nome || 'Administrador',
      status: 'ativo',
      impacta_gaveta: 'positivo',
    })
  }

  // Vendas Diretas
  for (const v of vendasRes.data ?? []) {
    const nomeResp = (v.registrado_por_user as any)?.nome || 'Administrador'
    let formaLabel = 'Dinheiro'
    let impactaGaveta: 'positivo' | 'nenhum' = 'nenhum'
    if (v.forma === 'dinheiro') {
      formaLabel = 'Dinheiro'
      impactaGaveta = 'positivo'
    } else if (v.forma === 'pix') {
      formaLabel = 'Pix'
    } else if (v.forma === 'cartao_debito') {
      formaLabel = 'Cartão de Débito'
    } else if (v.forma === 'cartao_credito') {
      formaLabel = 'Cartão de Crédito'
    }

    itens.push({
      id: v.id,
      tipo: 'venda_direta',
      titulo: 'Venda Direta',
      subtitulo: formaLabel,
      descricao: v.descricao,
      valor_centavos: Number(v.valor_centavos),
      forma_ou_meio: formaLabel,
      forma_raw: v.forma,
      cliente_ou_pessoa: null,
      data_movimento: v.data_movimento,
      data_registro: v.data_registro,
      registrado_por: v.registrado_por,
      registrado_por_nome: nomeResp,
      status: v.status,
      impacta_gaveta: v.status === 'ativo' ? impactaGaveta : 'nenhum',
      origem_id: v.id,
    })
  }

  // Vendas Fiadas (Consumos)
  for (const c of consumosRes.data ?? []) {
    const nomeResp = (c.registrado_por_user as any)?.nome || 'Administrador'
    const clienteNome = (c.cliente as any)?.nome || 'Cliente'
    const apelido = (c.cliente as any)?.apelido
    const clienteLabel = apelido ? `${clienteNome} (${apelido})` : clienteNome

    itens.push({
      id: c.id,
      tipo: 'venda_fiada',
      titulo: 'Consumo Fiado (Venda)',
      subtitulo: `Cliente: ${clienteLabel}`,
      descricao: c.descricao || 'Consumo registrado no caderno do fiado',
      valor_centavos: Number(c.valor_centavos),
      forma_ou_meio: 'Caderno do Fiado',
      cliente_id: c.cliente_id,
      cliente_ou_pessoa: clienteLabel,
      data_movimento: c.data_movimento,
      data_registro: c.data_registro,
      registrado_por: c.registrado_por,
      registrado_por_nome: nomeResp,
      status: c.status,
      impacta_gaveta: 'nenhum', // Fiado não altera a gaveta no momento do consumo
      origem_id: c.id,
    })
  }

  // Recebimentos de Fiado (Pagamentos)
  for (const p of pagamentosRes.data ?? []) {
    const nomeResp = (p.registrado_por_user as any)?.nome || 'Administrador'
    const clienteNome = (p.cliente as any)?.nome || 'Cliente'
    const apelido = (p.cliente as any)?.apelido
    const clienteLabel = apelido ? `${clienteNome} (${apelido})` : clienteNome

    let formaLabel = 'Dinheiro'
    let impactaGaveta: 'positivo' | 'nenhum' = 'nenhum'
    if (p.forma === 'dinheiro') {
      formaLabel = 'Dinheiro'
      impactaGaveta = 'positivo'
    } else if (p.forma === 'pix') {
      formaLabel = 'Pix'
    } else if (p.forma === 'cartao_debito') {
      formaLabel = 'Cartão de Débito'
    } else if (p.forma === 'cartao_credito') {
      formaLabel = 'Cartão de Crédito'
    }

    itens.push({
      id: p.id,
      tipo: 'recebimento_fiado',
      titulo: 'Recebimento de Fiado',
      subtitulo: `${formaLabel} • ${clienteLabel}`,
      descricao: p.credito_id
        ? 'Pagamento recebido (gerou crédito excedente)'
        : 'Pagamento recebido de fiado',
      valor_centavos: Number(p.valor_centavos),
      forma_ou_meio: formaLabel,
      forma_raw: p.forma,
      cliente_id: p.cliente_id,
      cliente_ou_pessoa: clienteLabel,
      data_movimento: p.data_movimento,
      data_registro: p.data_registro,
      registrado_por: p.registrado_por,
      registrado_por_nome: nomeResp,
      status: p.status,
      impacta_gaveta: p.status === 'ativo' ? impactaGaveta : 'nenhum',
      origem_id: p.id,
    })
  }

  // Saídas (inclui devoluções de crédito)
  for (const s of saidasRes.data ?? []) {
    const nomeResp = (s.registrado_por_user as any)?.nome || 'Administrador'
    const isDevolucao = Boolean(s.vinculo_credito_id)
    const clienteCredito = (s.credito as any)?.cliente
    const clienteLabel = clienteCredito
      ? clienteCredito.apelido
        ? `${clienteCredito.nome} (${clienteCredito.apelido})`
        : clienteCredito.nome
      : null

    const origemLabel = s.origem === 'gaveta' ? 'Dinheiro da Gaveta' : 'Conta / Pix'
    const impactaGaveta: 'negativo' | 'nenhum' = s.origem === 'gaveta' ? 'negativo' : 'nenhum'

    itens.push({
      id: s.id,
      tipo: isDevolucao ? 'devolucao_credito' : 'saida',
      titulo: isDevolucao ? 'Devolução de Crédito' : 'Saída Financeira',
      subtitulo: origemLabel,
      descricao: s.descricao,
      valor_centavos: Number(s.valor_centavos),
      forma_ou_meio: origemLabel,
      origem_raw: s.origem,
      cliente_id: (s.credito as any)?.cliente_id || null,
      cliente_ou_pessoa: clienteLabel,
      data_movimento: s.data_movimento,
      data_registro: s.data_registro,
      registrado_por: s.registrado_por,
      registrado_por_nome: nomeResp,
      status: s.status,
      impacta_gaveta: s.status === 'ativo' ? impactaGaveta : 'nenhum',
      origem_id: s.id,
      vinculo_credito_id: s.vinculo_credito_id,
    })
  }

  // Retiradas em mercadoria
  for (const r of retiradasRes.data ?? []) {
    const nomeResp = (r.registrado_por_user as any)?.nome || 'Administrador'

    itens.push({
      id: r.id,
      tipo: 'retirada_mercadoria',
      titulo: 'Retirada em Mercadoria',
      subtitulo: `Consumo: ${r.consumidor}`,
      descricao: r.descricao,
      valor_centavos: Number(r.valor_centavos),
      forma_ou_meio: 'Consumo Próprio',
      cliente_ou_pessoa: r.consumidor,
      data_movimento: r.data_movimento,
      data_registro: r.data_registro,
      registrado_por: r.registrado_por,
      registrado_por_nome: nomeResp,
      status: r.status,
      impacta_gaveta: 'nenhum', // Não movimenta dinheiro
      origem_id: r.id,
    })
  }

  // Ordenação temporal mais recente primeiro
  itens.sort((a, b) => {
    if (a.data_registro !== b.data_registro) {
      return b.data_registro.localeCompare(a.data_registro)
    }
    return 0
  })

  return itens
}

/**
 * 8. RELATÓRIOS DO CAIXA POR PERÍODO (Dia, Semana, Mês)
 */
export const getRelatorioCaixa = async (
  periodo: PeriodoRelatorio,
  dataBaseStr: string,
): Promise<RelatorioCaixa> => {
  const { dataInicio, dataFim, tituloPeriodo } = calcularIntervaloPeriodo(periodo, dataBaseStr)

  const [
    vendasDiretasRes,
    consumosRes,
    pagamentosRes,
    saidasRes,
    retiradasRes,
    creditosUtilizadosRes,
  ] = await Promise.all([
    database
      .from('vendas_diretas')
      .select('valor_centavos, forma, status, data_movimento')
      .gte('data_movimento', dataInicio)
      .lte('data_movimento', dataFim)
      .eq('status', 'ativo'),

    database
      .from('consumos')
      .select('valor_centavos, status, data_movimento')
      .gte('data_movimento', dataInicio)
      .lte('data_movimento', dataFim)
      .eq('status', 'ativo'),

    database
      .from('pagamentos')
      .select('valor_centavos, forma, status, data_movimento')
      .gte('data_movimento', dataInicio)
      .lte('data_movimento', dataFim)
      .eq('status', 'ativo'),

    database
      .from('saidas')
      .select('valor_centavos, origem, vinculo_credito_id, status, data_movimento')
      .gte('data_movimento', dataInicio)
      .lte('data_movimento', dataFim)
      .eq('status', 'ativo'),

    database
      .from('retiradas_mercadoria')
      .select('valor_centavos, consumidor, status, data_movimento')
      .gte('data_movimento', dataInicio)
      .lte('data_movimento', dataFim)
      .eq('status', 'ativo'),

    database
      .from('creditos')
      .select('valor_centavos, tipo, status, data_movimento')
      .gte('data_movimento', dataInicio)
      .lte('data_movimento', dataFim)
      .eq('tipo', 'utilizacao')
      .eq('status', 'ativo'),
  ])

  if (vendasDiretasRes.error) throw vendasDiretasRes.error
  if (consumosRes.error) throw consumosRes.error
  if (pagamentosRes.error) throw pagamentosRes.error
  if (saidasRes.error) throw saidasRes.error
  if (retiradasRes.error) throw retiradasRes.error
  if (creditosUtilizadosRes.error) throw creditosUtilizadosRes.error

  const vendasDiretas = vendasDiretasRes.data ?? []
  const consumos = consumosRes.data ?? []
  const pagamentos = pagamentosRes.data ?? []
  const saidas = saidasRes.data ?? []
  const retiradas = retiradasRes.data ?? []
  const creditosUtilizados = creditosUtilizadosRes.data ?? []

  // Vendas Diretas segregadas por forma
  let vdDinheiro = 0
  let vdPix = 0
  let vdDebito = 0
  let vdCredito = 0
  let vdTotal = 0

  for (const v of vendasDiretas) {
    const val = Number(v.valor_centavos)
    vdTotal += val
    if (v.forma === 'dinheiro') vdDinheiro += val
    else if (v.forma === 'pix') vdPix += val
    else if (v.forma === 'cartao_debito') vdDebito += val
    else if (v.forma === 'cartao_credito') vdCredito += val
  }

  // Consumos fiados
  let fiadoTotal = 0
  for (const c of consumos) {
    fiadoTotal += Number(c.valor_centavos)
  }

  // Retiradas em mercadoria e agregação por pessoa
  let retiradasTotal = 0
  const mapaPorPessoa: Record<string, { totalCentavos: number; quantidade: number }> = {}

  for (const r of retiradas) {
    const val = Number(r.valor_centavos)
    retiradasTotal += val
    const pessoa = r.consumidor.trim()
    if (!mapaPorPessoa[pessoa]) {
      mapaPorPessoa[pessoa] = { totalCentavos: 0, quantidade: 0 }
    }
    mapaPorPessoa[pessoa].totalCentavos += val
    mapaPorPessoa[pessoa].quantidade += 1
  }

  const retiradasPorPessoa = Object.entries(mapaPorPessoa)
    .map(([consumidor, d]) => ({
      consumidor,
      totalCentavos: d.totalCentavos,
      quantidade: d.quantidade,
    }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos)

  // Recebimentos de fiado segregados
  let recTotal = 0
  let recDinheiro = 0
  let recPix = 0
  let recDebito = 0
  let recCredito = 0

  for (const p of pagamentos) {
    const val = Number(p.valor_centavos)
    recTotal += val
    if (p.forma === 'dinheiro') recDinheiro += val
    else if (p.forma === 'pix') recPix += val
    else if (p.forma === 'cartao_debito') recDebito += val
    else if (p.forma === 'cartao_credito') recCredito += val
  }

  // Saídas financeiras
  let saidasTotal = 0
  let saidasGaveta = 0
  let saidasContaPix = 0
  let devGaveta = 0
  let devContaPix = 0

  for (const s of saidas) {
    const val = Number(s.valor_centavos)
    saidasTotal += val
    const isDev = Boolean(s.vinculo_credito_id)
    if (s.origem === 'gaveta') {
      if (isDev) devGaveta += val
      else saidasGaveta += val
    } else {
      if (isDev) devContaPix += val
      else saidasContaPix += val
    }
  }

  // Crédito utilizado (informativo complementar)
  let credUtilizadoTotal = 0
  for (const cu of creditosUtilizados) {
    credUtilizadoTotal += Number(cu.valor_centavos)
  }

  const vendasEConsumosTotal = vdTotal + fiadoTotal + retiradasTotal

  return {
    periodo,
    dataInicio,
    dataFim,
    tituloPeriodo,
    vendasEConsumos: {
      total: vendasEConsumosTotal,
      vendasDiretasDinheiro: vdDinheiro,
      vendasDiretasPix: vdPix,
      vendasDiretasDebito: vdDebito,
      vendasDiretasCredito: vdCredito,
      totalVendasDiretas: vdTotal,
      vendasFiadas: fiadoTotal,
      retiradasMercadoria: retiradasTotal,
    },
    recebimentosFiado: {
      total: recTotal,
      dinheiro: recDinheiro,
      pix: recPix,
      cartaoDebito: recDebito,
      cartaoCredito: recCredito,
    },
    saidasFinanceiras: {
      total: saidasTotal,
      gaveta: saidasGaveta,
      contaPix: saidasContaPix,
      devolucaoGaveta: devGaveta,
      devolucaoContaPix: devContaPix,
    },
    retiradasMercadoria: {
      total: retiradasTotal,
      porPessoa: retiradasPorPessoa,
    },
    creditoUtilizadoCentavos: credUtilizadoTotal,
  }
}

/**
 * 9. LISTAGEM DETALHADA DE RETIRADAS/CONSUMOS POR PESSOA
 */
export const listRetiradasDetalhadas = async (
  dataInicio: string,
  dataFim: string,
  consumidorFiltro?: string,
): Promise<RetiradaMercadoria[]> => {
  let query = database
    .from('retiradas_mercadoria')
    .select(`
      *,
      registrado_por_user:app_users!retiradas_mercadoria_registrado_por_fkey (nome)
    `)
    .gte('data_movimento', dataInicio)
    .lte('data_movimento', dataFim)
    .eq('status', 'ativo')
    .order('data_movimento', { ascending: false })
    .order('data_registro', { ascending: false })

  if (consumidorFiltro && consumidorFiltro !== 'todos') {
    query = query.eq('consumidor', consumidorFiltro)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row: any) => ({
    ...row,
    valor_centavos: Number(row.valor_centavos),
    registrado_por_nome: row.registrado_por_user?.nome || 'Administrador',
  })) as RetiradaMercadoria[]
}
