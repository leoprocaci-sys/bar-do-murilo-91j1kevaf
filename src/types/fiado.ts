export type Cliente = {
  id: string
  nome: string
  apelido: string | null
  telefone: string | null
  endereco: string | null
  limite_centavos: number | null
  restricao_ativa: boolean
  restricao_motivo: string | null
  restricao_por: string | null
  restricao_em: string | null
  favorito: boolean
  criado_por: string
  criado_em: string
  atualizado_em: string
  // Dados populados em consultas agregadas
  criado_por_nome?: string
  restricao_por_nome?: string
}

export type Consumo = {
  id: string
  cliente_id: string
  valor_centavos: number
  descricao: string | null
  data_movimento: string // YYYY-MM-DD
  data_registro: string // ISO timestamp
  registrado_por: string
  status: 'ativo' | 'cancelado'
  request_id: string
  seq: number
  registrado_por_nome?: string
}

export type Credito = {
  id: string
  cliente_id: string
  tipo: 'origem' | 'utilizacao' | 'devolucao'
  valor_centavos: number
  origem_pagamento_id: string | null
  movimento_vinculado_id: string | null
  data_movimento: string
  data_registro: string
  registrado_por: string
  status: 'ativo' | 'cancelado'
  request_id: string
  seq: number
  registrado_por_nome?: string
}

export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito'

export type Pagamento = {
  id: string
  cliente_id: string
  valor_centavos: number
  forma: FormaPagamento
  data_movimento: string
  data_registro: string
  registrado_por: string
  status: 'ativo' | 'cancelado'
  request_id: string
  seq: number
  credito_id: string | null
  registrado_por_nome?: string
}

export type MovimentacaoHistorico = {
  id: string
  tipo: 'consumo' | 'credito' | 'pagamento'
  origem: string // 'Consumo Fiado' | 'Pagamento' | 'Crédito Adicionado' etc.
  valor_centavos: number
  descricao: string | null
  forma?: FormaPagamento | null
  data_movimento: string
  data_registro: string
  registrado_por: string
  registrado_por_nome?: string
  status: 'ativo' | 'cancelado'
  credito_id?: string | null
}

export type SituacaoFinanceiraCliente = {
  totalDividaCentavos: number // soma dos consumos ativos
  totalPagoCentavos: number // soma dos pagamentos ativos
  saldoDevedorCentavos: number // dívida real não paga nem coberta por crédito: max(0, divida - amortizado_pagos - credito_utilizado)
  totalCreditoDisponivelCentavos: number // crédito líquido: (origem - utilizacao - devolucao) ou 0 se negativo
  totalCreditoOrigemCentavos: number
  totalCreditoUtilizadoCentavos: number
  posicaoLiquidaCentavos: number // saldoDevedor - totalCreditoDisponivelCentavos
  limiteCentavos: number | null // null = sem limite; 0 = sem autorização; > 0 = valor
  temRestricao: boolean
  restricaoMotivo: string | null
  restricaoPorNome?: string
  restricaoEm?: string | null
  disponivelParaFiadoCentavos: number | null
}

export type HistoricoAuditoria = {
  id: string
  tabela: string
  registro_id: string
  dados_anteriores: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
  alterado_por: string
  alterado_por_nome?: string
  alterado_em: string
}

export type PeriodoRelatorioFiado = 'mes' | 'ano'

export type EvolucaoClienteFiado = {
  cliente_id: string
  nome: string
  apelido: string | null
  telefone: string | null
  // Dívidas
  dividaInicialCentavos: number
  consumosPeriodoCentavos: number
  pagamentosAmortizadosPeriodoCentavos: number
  creditoUtilizadoPeriodoCentavos: number
  dividaFinalCentavos: number
  // Pagamentos totais recebidos no período
  pagamentosRecebidosPeriodoCentavos: number
  // Créditos
  creditoInicialCentavos: number
  creditoGeradoPeriodoCentavos: number
  creditoDevolvidoPeriodoCentavos: number
  creditoFinalCentavos: number
}

export type DetalhamentoClientePeriodo = {
  cliente: Cliente
  consumos: Array<{
    id: string
    data_movimento: string
    descricao: string | null
    valor_centavos: number
    status: string
  }>
  pagamentos: Array<{
    id: string
    data_movimento: string
    forma: FormaPagamento
    valor_centavos: number
    status: string
  }>
  operacoesCredito: Array<{
    id: string
    tipo: 'origem' | 'utilizacao' | 'devolucao'
    data_movimento: string
    valor_centavos: number
    status: string
  }>
}

export type RelatorioFiadoPeriodo = {
  tipo: PeriodoRelatorioFiado
  ano: number
  mes?: number // 1 a 12 para mensal
  dataInicio: string
  dataFim: string
  tituloPeriodo: string
  clientes: EvolucaoClienteFiado[]
  totais: {
    totalClientes: number
    dividaInicialCentavos: number
    consumosPeriodoCentavos: number
    pagamentosRecebidosPeriodoCentavos: number
    dividaFinalCentavos: number
    creditoInicialCentavos: number
    creditoGeradoPeriodoCentavos: number
    creditoUtilizadoPeriodoCentavos: number
    creditoDevolvidoPeriodoCentavos: number
    creditoFinalCentavos: number
  }
}
