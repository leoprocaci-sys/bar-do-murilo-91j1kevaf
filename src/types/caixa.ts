import type { FormaPagamento } from './fiado'

export type VendaForma = FormaPagamento // 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito'

export type VendaDireta = {
  id: string
  descricao: string
  valor_centavos: number
  forma: VendaForma
  data_movimento: string // YYYY-MM-DD
  data_registro: string // ISO timestamp
  registrado_por: string
  registrado_por_nome?: string
  status: 'ativo' | 'cancelado'
  request_id: string
  seq: number
}

export type SaidaOrigem = 'gaveta' | 'conta_pix'

export type Saida = {
  id: string
  origem: SaidaOrigem
  descricao: string
  valor_centavos: number
  vinculo_credito_id: string | null
  data_movimento: string // YYYY-MM-DD
  data_registro: string // ISO timestamp
  registrado_por: string
  registrado_por_nome?: string
  status: 'ativo' | 'cancelado'
  request_id: string
  seq: number
}

export type RetiradaMercadoria = {
  id: string
  descricao: string
  valor_centavos: number
  consumidor: string
  registrado_por: string
  registrado_por_nome?: string
  data_movimento: string // YYYY-MM-DD
  data_registro: string // ISO timestamp
  status: 'ativo' | 'cancelado'
  request_id: string
  seq: number
}

export type DinheiroInicial = {
  id: string
  data: string // YYYY-MM-DD
  valor_centavos: number
  editado_por: string
  editado_por_nome?: string
  data_registro: string
  atualizado_em: string
  request_id: string
  seq: number
}

export type TipoMovimentacaoCaixa =
  | 'venda_direta'
  | 'venda_fiada'
  | 'recebimento_fiado'
  | 'saida'
  | 'retirada_mercadoria'
  | 'devolucao_credito'
  | 'dinheiro_inicial'

export type MovimentacaoCaixaItem = {
  id: string
  tipo: TipoMovimentacaoCaixa
  titulo: string
  subtitulo?: string | null
  descricao?: string | null
  valor_centavos: number
  forma_ou_meio?: string | null
  forma_raw?: string | null
  origem_raw?: string | null
  cliente_id?: string | null
  cliente_ou_pessoa?: string | null
  data_movimento: string // YYYY-MM-DD
  data_registro: string // ISO timestamp
  registrado_por: string
  registrado_por_nome: string
  status: 'ativo' | 'cancelado'
  impacta_gaveta?: 'positivo' | 'negativo' | 'nenhum'
  origem_id?: string
  vinculo_credito_id?: string | null
}

export type ResumoCaixaDia = {
  data: string
  dinheiroInicialCentavos: number
  dinheiroInicialInformado: boolean
  // Indicadores principais
  dinheiroEmCaixaCentavos: number // SALDO ESPERADO NA GAVETA
  vendasEConsumosCentavos: number
  saidasDinheiroContaCentavos: number
  retiradasMercadoriaCentavos: number
  // Detalhamento de apoio
  entradasFisicasCentavos: {
    dinheiroInicial: number
    vendasDiretasDinheiro: number
    recebimentosFiadoDinheiro: number
    total: number
  }
  saidasFisicasCentavos: {
    saidasGaveta: number
    devolucoesGaveta: number
    total: number
  }
  recebimentosFiadoTotalCentavos: number
  vendasDiretasTotalCentavos: number
  vendasFiadasTotalCentavos: number
  creditoUtilizadoCentavos: number // informativo complementar
}

export type PeriodoRelatorio = 'dia' | 'semana' | 'mes'

export type RelatorioCaixa = {
  periodo: PeriodoRelatorio
  dataInicio: string // YYYY-MM-DD
  dataFim: string // YYYY-MM-DD
  tituloPeriodo: string

  // Vendas e Consumos segregadas
  vendasEConsumos: {
    total: number
    vendasDiretasDinheiro: number
    vendasDiretasPix: number
    vendasDiretasDebito: number
    vendasDiretasCredito: number
    totalVendasDiretas: number
    vendasFiadas: number
    retiradasMercadoria: number
  }

  // Recebimentos de fiado (separados de vendas)
  recebimentosFiado: {
    total: number
    dinheiro: number
    pix: number
    cartaoDebito: number
    cartaoCredito: number
  }

  // Saídas em Dinheiro / Conta
  saidasFinanceiras: {
    total: number
    gaveta: number
    contaPix: number
    devolucaoGaveta: number
    devolucaoContaPix: number
  }

  // Retiradas em mercadoria
  retiradasMercadoria: {
    total: number
    porPessoa: Array<{
      consumidor: string
      totalCentavos: number
      quantidade: number
    }>
  }

  // Informação complementar (não somada aos outros totais)
  creditoUtilizadoCentavos: number
}
