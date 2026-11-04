import type { FormaPagamento } from './fiado'

export type FormaParcela = FormaPagamento | 'fiado'

export type Produto = {
  id: string
  nome: string
  categoria: string
  preco_atual_centavos: number
  ativo: boolean
  criado_em: string
  criado_por: string | null
  atualizado_em: string
  atualizado_por: string | null
}

export type Comanda = {
  id: string
  numero: number
  identificacao: string | null
  cliente_id: string | null
  mesa: string | null
  local_referencia: string | null
  data_abertura: string
  aberto_por: string | null
  status: 'aberta' | 'fechada'
  data_fechamento: string | null
  fechado_por: string | null
  data_movimento: string // YYYY-MM-DD
  data_registro: string
  registrado_por: string | null
  atualizado_em: string
  atualizado_por: string | null
  cliente_nome?: string | null
}

export type ComandaItem = {
  id: string
  comanda_id: string
  produto_id: string | null
  produto_nome: string
  preco_unitario_centavos: number
  quantidade: number
  subtotal_centavos: number
  preco_excepcional: boolean
  justificativa_excecao: string | null
  data_movimento: string
  data_registro: string
  registrado_por: string | null
  status: 'ativo' | 'cancelado'
  request_id: string
  seq: number
  atualizado_em: string
  atualizado_por: string | null
}

export type ComandaPagamento = {
  id: string
  comanda_id: string
  parcela_index: number | null
  forma: FormaParcela
  valor_centavos: number
  cliente_id: string | null
  venda_direta_id: string | null
  consumo_id: string | null
  pago_posteriormente: boolean
  data_movimento: string
  data_registro: string
  registrado_por: string | null
  status: 'ativo' | 'cancelado'
  request_id: string
  seq: number
  atualizado_em: string
  atualizado_por: string | null
}

export type ParcelaFechamento = {
  forma: FormaParcela
  valor_centavos: number
  cliente_id?: string | null
}

export type FechamentoComandaResult = {
  comanda_id: string
  status: 'fechada'
  total_centavos: number
  parcelas: Array<{
    parcela: number
    forma: FormaParcela
    valor_centavos: number
    venda_direta_id?: string
    cliente_id?: string
    consumo_id?: string
  }>
  idempotente: boolean
}

export type CancelamentoFechamentoResult = {
  comanda_id: string
  status: 'aberta'
  motivo: string
  parcelas_canceladas: boolean
}
