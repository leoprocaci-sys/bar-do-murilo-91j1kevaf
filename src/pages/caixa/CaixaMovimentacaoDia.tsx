import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  History,
  Calendar,
  Loader2,
  TrendingUp,
  ArrowUpRight,
  Banknote,
  QrCode,
  CreditCard,
  ShoppingBag,
  RotateCcw,
  BookOpenText,
  User,
  Filter,
  Pencil,
  Ban,
  AlertTriangle,
} from 'lucide-react'
import { ModalHistoricoRegistro } from '@/components/ModalHistoricoRegistro'
import { getHistoricoRegistro } from '@/services/fiado'
import type { HistoricoAuditoria } from '@/types/fiado'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  getMovimentacaoDia,
  editarVendaDireta,
  cancelarVendaDireta,
  editarSaida,
  cancelarSaida,
  editarRetiradaMercadoria,
  cancelarRetiradaMercadoria,
  cancelarDevolucaoCredito,
  salvarDinheiroInicial,
} from '@/services/caixa'
import {
  editarPagamentoFiado,
  cancelarPagamentoFiado,
  editarConsumoFiado,
  cancelarConsumoFiado,
} from '@/services/fiado'
import {
  formatCentavos,
  formatDateBR,
  formatDateTimeBR,
  getTodayDateInput,
  parseBRLToCentavos,
} from '@/lib/formatters'
import type { MovimentacaoCaixaItem, TipoMovimentacaoCaixa, VendaForma } from '@/types/caixa'
import type { FormaPagamento } from '@/types/fiado'

export const CaixaMovimentacaoDia = () => {
  const [searchParams] = useSearchParams()
  const dataFromQuery = searchParams.get('data')

  const navigate = useNavigate()
  const [dataOperacional, setDataOperacional] = useState<string>(
    dataFromQuery || getTodayDateInput(),
  )
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const {
    data: movimentacoes = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['caixa-movimentacao', dataOperacional],
    queryFn: () => getMovimentacaoDia(dataOperacional),
  })

  // Estados dos modais de edição e cancelamento
  const [itemParaEditar, setItemParaEditar] = useState<MovimentacaoCaixaItem | null>(null)
  const [itemParaCancelar, setItemParaCancelar] = useState<MovimentacaoCaixaItem | null>(null)
  const [itemParaVerHistorico, setItemParaVerHistorico] = useState<MovimentacaoCaixaItem | null>(
    null,
  )
  const [historicoLogs, setHistoricoLogs] = useState<HistoricoAuditoria[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState<boolean>(false)

  // Campos do formulário de edição
  const [editValorInput, setEditValorInput] = useState('')
  const [editDescricao, setEditDescricao] = useState('')
  const [editForma, setEditForma] = useState<string>('dinheiro')
  const [editOrigem, setEditOrigem] = useState<'gaveta' | 'conta_pix'>('gaveta')
  const [editConsumidor, setEditConsumidor] = useState('')
  const [editDataMovimento, setEditDataMovimento] = useState('')

  // Função para abrir o modal de edição correspondente
  const abrirHistorico = async (item: MovimentacaoCaixaItem) => {
    setItemParaVerHistorico(item)
    setCarregandoHistorico(true)
    try {
      const logs = await getHistoricoRegistro(item.id)
      setHistoricoLogs(logs)
    } catch (e) {
      console.error(e)
      setHistoricoLogs([])
    } finally {
      setCarregandoHistorico(false)
    }
  }

  const abrirEdicao = (item: MovimentacaoCaixaItem) => {
    setItemParaEditar(item)
    setEditValorInput((item.valor_centavos / 100).toFixed(2).replace('.', ','))
    setEditDescricao(item.descricao || '')
    setEditDataMovimento(item.data_movimento)

    if (item.tipo === 'venda_direta' || item.tipo === 'recebimento_fiado') {
      setEditForma(item.forma_raw || 'dinheiro')
    }
    if (item.tipo === 'saida') {
      setEditOrigem((item.origem_raw as any) || 'gaveta')
    }
    if (item.tipo === 'retirada_mercadoria') {
      setEditConsumidor(item.cliente_ou_pessoa || '')
    }
  }

  // Mutation para salvar a edição
  const editarMutation = useMutation({
    mutationFn: async () => {
      if (!itemParaEditar) return
      const valorCentavos = parseBRLToCentavos(editValorInput)
      if (valorCentavos <= 0 && itemParaEditar.tipo !== 'dinheiro_inicial') {
        throw new Error('O valor corrigido deve ser maior que zero.')
      }

      if (itemParaEditar.tipo === 'venda_direta') {
        return await editarVendaDireta({
          venda_id: itemParaEditar.id,
          novo_valor_centavos: valorCentavos,
          nova_forma: editForma as VendaForma,
          nova_descricao: editDescricao,
          nova_data_movimento: editDataMovimento,
        })
      }

      if (itemParaEditar.tipo === 'saida') {
        return await editarSaida({
          saida_id: itemParaEditar.id,
          novo_valor_centavos: valorCentavos,
          nova_origem: editOrigem,
          nova_descricao: editDescricao,
          nova_data_movimento: editDataMovimento,
        })
      }

      if (itemParaEditar.tipo === 'retirada_mercadoria') {
        return await editarRetiradaMercadoria({
          retirada_id: itemParaEditar.id,
          novo_valor_centavos: valorCentavos,
          novo_consumidor: editConsumidor,
          nova_descricao: editDescricao,
          nova_data_movimento: editDataMovimento,
        })
      }

      if (itemParaEditar.tipo === 'recebimento_fiado') {
        return await editarPagamentoFiado({
          pagamento_id: itemParaEditar.id,
          novo_valor_centavos: valorCentavos,
          nova_forma: editForma as FormaPagamento,
          nova_data_movimento: editDataMovimento,
        })
      }

      if (itemParaEditar.tipo === 'venda_fiada') {
        return await editarConsumoFiado({
          consumo_id: itemParaEditar.id,
          novo_valor_centavos: valorCentavos,
          nova_descricao: editDescricao,
          nova_data_movimento: editDataMovimento,
        })
      }
    },
    onSuccess: () => {
      setItemParaEditar(null)
      refetch()
      queryClient.invalidateQueries({ queryKey: ['caixa-resumo'] })
      queryClient.invalidateQueries({ queryKey: ['caixa-relatorio'] })
      toast({
        title: 'Operação corrigida com sucesso!',
        description: 'Os saldos do Caixa, gaveta e relatórios foram recalculados.',
      })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao editar operação',
        description: err.message || 'Não foi possível salvar a alteração.',
        variant: 'destructive',
      })
    },
  })

  // Mutation para cancelar a operação
  const cancelarMutation = useMutation({
    mutationFn: async () => {
      if (!itemParaCancelar) return

      if (itemParaCancelar.tipo === 'venda_direta') {
        return await cancelarVendaDireta(itemParaCancelar.id)
      }
      if (itemParaCancelar.tipo === 'saida') {
        return await cancelarSaida(itemParaCancelar.id)
      }
      if (itemParaCancelar.tipo === 'devolucao_credito') {
        // Se for devolução de crédito, cancela via cancelarDevolucaoCredito usando vinculo_credito_id
        if (itemParaCancelar.vinculo_credito_id) {
          return await cancelarDevolucaoCredito(itemParaCancelar.vinculo_credito_id)
        }
        return await cancelarSaida(itemParaCancelar.id)
      }
      if (itemParaCancelar.tipo === 'retirada_mercadoria') {
        return await cancelarRetiradaMercadoria(itemParaCancelar.id)
      }
      if (itemParaCancelar.tipo === 'recebimento_fiado') {
        return await cancelarPagamentoFiado(itemParaCancelar.id)
      }
      if (itemParaCancelar.tipo === 'venda_fiada') {
        return await cancelarConsumoFiado(itemParaCancelar.id)
      }
    },
    onSuccess: () => {
      setItemParaCancelar(null)
      refetch()
      queryClient.invalidateQueries({ queryKey: ['caixa-resumo'] })
      queryClient.invalidateQueries({ queryKey: ['caixa-relatorio'] })
      toast({
        title: 'Operação cancelada com sucesso!',
        description: 'Os efeitos sobre o Caixa, gaveta e dívidas foram retirados e recalculados.',
      })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao cancelar operação',
        description: err.message || 'Não foi possível cancelar a operação.',
        variant: 'destructive',
      })
    },
  })

  // Filtro local
  const filtrados = movimentacoes.filter((m) => {
    if (filtroTipo === 'todos') return true
    if (filtroTipo === 'vendas') return m.tipo === 'venda_direta' || m.tipo === 'venda_fiada'
    if (filtroTipo === 'recebimentos') return m.tipo === 'recebimento_fiado'
    if (filtroTipo === 'saidas') return m.tipo === 'saida' || m.tipo === 'devolucao_credito'
    if (filtroTipo === 'retiradas') return m.tipo === 'retirada_mercadoria'
    if (filtroTipo === 'gaveta') return m.impacta_gaveta !== 'nenhum'
    return true
  })

  const renderIconeTipo = (tipo: TipoMovimentacaoCaixa) => {
    switch (tipo) {
      case 'dinheiro_inicial':
        return <Banknote className="h-5 w-5 text-[#1E6B3A]" />
      case 'venda_direta':
        return <TrendingUp className="h-5 w-5 text-emerald-400" />
      case 'venda_fiada':
        return <BookOpenText className="h-5 w-5 text-amber-400" />
      case 'recebimento_fiado':
        return <Banknote className="h-5 w-5 text-green-400" />
      case 'saida':
        return <ArrowUpRight className="h-5 w-5 text-red-400" />
      case 'devolucao_credito':
        return <RotateCcw className="h-5 w-5 text-cyan-400" />
      case 'retirada_mercadoria':
        return <ShoppingBag className="h-5 w-5 text-yellow-400" />
      default:
        return <History className="h-5 w-5 text-[#A8B3A6]" />
    }
  }

  const renderBadgeImpactoGaveta = (impacto?: 'positivo' | 'negativo' | 'nenhum') => {
    if (impacto === 'positivo') {
      return (
        <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px] font-semibold">
          + Entra na gaveta
        </Badge>
      )
    }
    if (impacto === 'negativo') {
      return (
        <Badge className="bg-red-950 text-red-300 border-red-800 text-[10px] font-semibold">
          − Sai da gaveta
        </Badge>
      )
    }
    return (
      <Badge className="bg-[#141B15] text-[#6E7B70] border-[#26332A] text-[10px]">
        Fora da gaveta
      </Badge>
    )
  }

  return (
    <Layout backTo={`/caixa?data=${dataOperacional}`} backLabel="CAIXA" className="pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-[#1E6B3A]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">
              Movimentação do Dia
            </h1>
          </div>
          <p className="text-sm text-[#A8B3A6] mt-0.5">
            Visão cronológica integrada das operações (sem duplicação de dados)
          </p>
        </div>

        {/* Seletor de Data */}
        <div className="flex items-center gap-2 rounded-2xl border border-[#26332A] bg-[#141B15] px-3 py-2">
          <Calendar className="h-4 w-4 text-[#A8B3A6]" />
          <Label htmlFor="dataOperacional" className="text-xs text-[#A8B3A6] shrink-0">
            Data:
          </Label>
          <Input
            id="dataOperacional"
            type="date"
            value={dataOperacional}
            onChange={(e) => setDataOperacional(e.target.value)}
            className="h-8 border-none bg-transparent p-0 text-xs font-bold text-[#F3EAD3] focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Filtros Rápidos */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'vendas', label: 'Vendas e Fiados' },
          { id: 'recebimentos', label: 'Recebimentos' },
          { id: 'saidas', label: 'Saídas & Devoluções' },
          { id: 'retiradas', label: 'Retiradas Mercadoria' },
          { id: 'gaveta', label: 'Afetam Gaveta' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltroTipo(f.id)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              filtroTipo === f.id
                ? 'bg-[#1E6B3A] text-[#F3EAD3]'
                : 'border border-[#26332A] bg-[#141B15] text-[#A8B3A6] hover:bg-[#1C271E]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da Timeline */}
      <div className="mt-5 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
            <p className="mt-3 text-sm text-[#A8B3A6]">Carregando movimentações do dia...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-4 text-center text-sm text-red-200">
            Erro ao carregar movimentações.
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#26332A] p-8 text-center text-sm text-[#A8B3A6]">
            Nenhuma movimentação encontrada para a data selecionada.
          </div>
        ) : (
          filtrados.map((item) => (
            <div
              key={`${item.tipo}-${item.id}`}
              className="rounded-2xl border border-[#26332A] bg-[#141B15] p-4 transition-all hover:border-[#334637]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B0F0C] border border-[#26332A]">
                    {renderIconeTipo(item.tipo)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-sm font-bold truncate ${item.status === 'cancelado' ? 'text-gray-400 line-through' : 'text-[#F3EAD3]'}`}
                      >
                        {item.titulo}
                      </h3>
                      {item.status === 'cancelado' ? (
                        <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                          CANCELADO
                        </Badge>
                      ) : (
                        renderBadgeImpactoGaveta(item.impacta_gaveta)
                      )}
                    </div>

                    {item.subtitulo && (
                      <p className="text-xs font-semibold text-[#A8B3A6] mt-0.5">
                        {item.subtitulo}
                      </p>
                    )}

                    {item.descricao && (
                      <p className="text-xs text-[#6E7B70] mt-1 break-words">{item.descricao}</p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-lg font-black block ${
                      item.status === 'cancelado'
                        ? 'text-gray-500 line-through'
                        : item.tipo === 'saida' || item.tipo === 'devolucao_credito'
                          ? 'text-red-300'
                          : item.tipo === 'retirada_mercadoria'
                            ? 'text-yellow-300'
                            : 'text-[#F3EAD3]'
                    }`}
                  >
                    {item.tipo === 'saida' || item.tipo === 'devolucao_credito' ? '− ' : '+ '}
                    {formatCentavos(item.valor_centavos)}
                  </span>
                  <span className="text-[11px] text-[#A8B3A6] block mt-0.5 font-medium">
                    {formatDateTimeBR(item.data_registro).split(' ')[1] || ''}
                  </span>
                </div>
              </div>

              {/* Ações: Histórico (para qualquer item), Edição e Cancelamento */}
              {item.tipo !== 'dinheiro_inicial' && (
                <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-[#1C271E] pt-2 flex-wrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => abrirHistorico(item)}
                    className="h-7 px-2 text-[11px] font-semibold text-[#879689] hover:bg-[#1C271E] hover:text-[#F3EAD3]"
                    title="Ver histórico de alterações"
                  >
                    <History className="mr-1 h-3.5 w-3.5 text-[#1E6B3A]" />
                    Ver histórico
                  </Button>

                  {item.status === 'ativo' && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirEdicao(item)}
                        className="h-7 px-2.5 text-xs font-semibold text-[#A8B3A6] hover:bg-[#1C271E] hover:text-[#F3EAD3]"
                        title="Editar registro"
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setItemParaCancelar(item)}
                        className="h-7 px-2.5 text-xs font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300"
                        title="Cancelar operação"
                      >
                        <Ban className="mr-1 h-3.5 w-3.5" />
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Rastreabilidade por usuário */}
              <div className="mt-2 flex items-center justify-between border-t border-[#1C271E]/50 pt-2 text-[11px] text-[#6E7B70]">
                <div className="flex items-center gap-1.5 truncate">
                  <User className="h-3 w-3 text-[#1E6B3A] shrink-0" />
                  <span>Por: {item.registrado_por_nome}</span>
                </div>
                <span>Data reg: {formatDateTimeBR(item.data_registro)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DE EDIÇÃO DE OPERAÇÃO DO CAIXA */}
      <Dialog
        open={Boolean(itemParaEditar)}
        onOpenChange={(aberto) => !aberto && setItemParaEditar(null)}
      >
        <DialogContent className="border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F3EAD3]">
              Editar Operação: {itemParaEditar?.titulo}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#A8B3A6]">
              Permite corrigir valor, descrição, forma ou data da operação. O Caixa, gaveta e
              relatórios serão recalculados automaticamente.
            </DialogDescription>
          </DialogHeader>

          {itemParaEditar && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                editarMutation.mutate()
              }}
              className="space-y-3.5 text-xs"
            >
              <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#A8B3A6]">Valor registrado anteriormente:</span>
                  <strong className="text-white">
                    {formatCentavos(itemParaEditar.valor_centavos)}
                  </strong>
                </div>
                {itemParaEditar.cliente_ou_pessoa && (
                  <div className="flex justify-between">
                    <span className="text-[#A8B3A6]">Pessoa / Cliente:</span>
                    <span className="font-semibold text-white">
                      {itemParaEditar.cliente_ou_pessoa}
                    </span>
                  </div>
                )}
              </div>

              {/* Valor */}
              <div className="space-y-1">
                <Label htmlFor="caixaEditValor" className="text-xs font-bold text-[#F3EAD3]">
                  Novo Valor (R$) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#1E6B3A]">
                    R$
                  </span>
                  <Input
                    id="caixaEditValor"
                    type="text"
                    inputMode="decimal"
                    required
                    value={editValorInput}
                    onChange={(e) => setEditValorInput(e.target.value)}
                    className="h-11 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-base font-bold text-[#F3EAD3]"
                  />
                </div>
              </div>

              {/* Descrição (quando aplicável) */}
              {itemParaEditar.tipo !== 'dinheiro_inicial' && (
                <div className="space-y-1">
                  <Label htmlFor="caixaEditDesc" className="text-xs font-bold text-[#F3EAD3]">
                    Descrição / Observação *
                  </Label>
                  <Input
                    id="caixaEditDesc"
                    type="text"
                    required
                    value={editDescricao}
                    onChange={(e) => setEditDescricao(e.target.value)}
                    className="h-10 rounded-xl border-[#26332A] bg-[#0B0F0C] text-sm text-[#F3EAD3]"
                  />
                </div>
              )}

              {/* Consumidor (apenas para retirada em mercadoria) */}
              {itemParaEditar.tipo === 'retirada_mercadoria' && (
                <div className="space-y-1">
                  <Label htmlFor="caixaEditConsumidor" className="text-xs font-bold text-[#F3EAD3]">
                    Consumidor (Quem retirou) *
                  </Label>
                  <Input
                    id="caixaEditConsumidor"
                    type="text"
                    required
                    value={editConsumidor}
                    onChange={(e) => setEditConsumidor(e.target.value)}
                    className="h-10 rounded-xl border-[#26332A] bg-[#0B0F0C] text-sm text-[#F3EAD3]"
                  />
                </div>
              )}

              {/* Forma de Pagamento (para vendas diretas e recebimentos) */}
              {(itemParaEditar.tipo === 'venda_direta' ||
                itemParaEditar.tipo === 'recebimento_fiado') && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#F3EAD3]">Forma de Pagamento *</Label>
                  <RadioGroup
                    value={editForma}
                    onValueChange={(val) => setEditForma(val)}
                    className="grid grid-cols-2 gap-2"
                  >
                    <label
                      className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer ${
                        editForma === 'dinheiro'
                          ? 'border-[#1E6B3A] bg-[#1C271E] text-white'
                          : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6]'
                      }`}
                    >
                      <RadioGroupItem value="dinheiro" className="sr-only" />
                      <span>Dinheiro (Gaveta)</span>
                    </label>
                    <label
                      className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer ${
                        editForma === 'pix'
                          ? 'border-[#1E6B3A] bg-[#1C271E] text-white'
                          : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6]'
                      }`}
                    >
                      <RadioGroupItem value="pix" className="sr-only" />
                      <span>Pix</span>
                    </label>
                    <label
                      className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer ${
                        editForma === 'cartao_debito'
                          ? 'border-[#1E6B3A] bg-[#1C271E] text-white'
                          : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6]'
                      }`}
                    >
                      <RadioGroupItem value="cartao_debito" className="sr-only" />
                      <span>Cartão Débito</span>
                    </label>
                    <label
                      className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer ${
                        editForma === 'cartao_credito'
                          ? 'border-[#1E6B3A] bg-[#1C271E] text-white'
                          : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6]'
                      }`}
                    >
                      <RadioGroupItem value="cartao_credito" className="sr-only" />
                      <span>Cartão Crédito</span>
                    </label>
                  </RadioGroup>
                </div>
              )}

              {/* Origem da Saída (para saídas normais) */}
              {itemParaEditar.tipo === 'saida' && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#F3EAD3]">Origem da Saída *</Label>
                  <RadioGroup
                    value={editOrigem}
                    onValueChange={(val: any) => setEditOrigem(val)}
                    className="grid grid-cols-2 gap-2"
                  >
                    <label
                      className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer ${
                        editOrigem === 'gaveta'
                          ? 'border-[#1E6B3A] bg-[#1C271E] text-white'
                          : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6]'
                      }`}
                    >
                      <RadioGroupItem value="gaveta" className="sr-only" />
                      <span>Dinheiro da Gaveta</span>
                    </label>
                    <label
                      className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer ${
                        editOrigem === 'conta_pix'
                          ? 'border-[#1E6B3A] bg-[#1C271E] text-white'
                          : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6]'
                      }`}
                    >
                      <RadioGroupItem value="conta_pix" className="sr-only" />
                      <span>Conta / Pix</span>
                    </label>
                  </RadioGroup>
                </div>
              )}

              {/* Data do Movimento */}
              <div className="space-y-1">
                <Label htmlFor="caixaEditData" className="text-xs font-bold text-[#F3EAD3]">
                  Data do Movimento *
                </Label>
                <Input
                  id="caixaEditData"
                  type="date"
                  required
                  value={editDataMovimento}
                  onChange={(e) => setEditDataMovimento(e.target.value)}
                  className="h-10 rounded-xl border-[#26332A] bg-[#0B0F0C] text-sm text-[#F3EAD3]"
                />
              </div>

              {/* Alerta de impacto se o valor estiver aumentando */}
              {parseBRLToCentavos(editValorInput) > itemParaEditar.valor_centavos && (
                <div className="rounded-xl border border-yellow-800/80 bg-yellow-950/30 p-2 text-[11px] text-yellow-200">
                  <span className="font-bold text-yellow-300">Aumento de valor: </span>
                  O valor será alterado com acréscimo de{' '}
                  <strong>
                    {formatCentavos(
                      parseBRLToCentavos(editValorInput) - itemParaEditar.valor_centavos,
                    )}
                  </strong>
                  .
                </div>
              )}

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setItemParaEditar(null)}
                  className="rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3]"
                >
                  CANCELAR
                </Button>
                <Button
                  type="submit"
                  disabled={editarMutation.isPending}
                  className="rounded-xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
                >
                  {editarMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'CONFIRMAR CORREÇÃO'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE CANCELAMENTO DE OPERAÇÃO DO CAIXA */}
      <Dialog
        open={Boolean(itemParaCancelar)}
        onOpenChange={(aberto) => !aberto && setItemParaCancelar(null)}
      >
        <DialogContent className="border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-950/60 text-red-400 border border-red-800">
              <Ban className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-[#F3EAD3] mt-2">
              Cancelar Operação?
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-[#A8B3A6]">
              A operação selecionada será marcada como cancelada logicamente. Seus efeitos sobre o
              saldo da gaveta, vendas ou saídas serão desfeitos e recalculados. O histórico
              permanece registrado para auditoria.
            </DialogDescription>
          </DialogHeader>

          {itemParaCancelar && (
            <div className="space-y-2 rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-xs">
              <div className="flex justify-between py-1 border-b border-[#1C271E]">
                <span className="text-[#A8B3A6]">Tipo da operação:</span>
                <strong className="text-[#F3EAD3]">{itemParaCancelar.titulo}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1C271E]">
                <span className="text-[#A8B3A6]">Valor:</span>
                <strong className="text-red-300">
                  {formatCentavos(itemParaCancelar.valor_centavos)}
                </strong>
              </div>
              {itemParaCancelar.descricao && (
                <div className="flex justify-between py-1 border-b border-[#1C271E]">
                  <span className="text-[#A8B3A6]">Descrição:</span>
                  <span>{itemParaCancelar.descricao}</span>
                </div>
              )}
              {itemParaCancelar.cliente_ou_pessoa && (
                <div className="flex justify-between py-1 border-b border-[#1C271E]">
                  <span className="text-[#A8B3A6]">Cliente / Consumidor:</span>
                  <span className="font-semibold text-white">
                    {itemParaCancelar.cliente_ou_pessoa}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-[#A8B3A6]">Data do movimento:</span>
                <span>{formatDateBR(itemParaCancelar.data_movimento)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setItemParaCancelar(null)}
              className="rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3]"
            >
              NÃO, MANTER OPERAÇÃO
            </Button>
            <Button
              type="button"
              onClick={() => cancelarMutation.mutate()}
              disabled={cancelarMutation.isPending}
              className="rounded-xl bg-red-700 font-bold text-white hover:bg-red-600"
            >
              {cancelarMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'SIM, CANCELAR OPERAÇÃO'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: CONSULTA DE HISTÓRICO (BEFORE/AFTER) */}
      <ModalHistoricoRegistro
        aberto={Boolean(itemParaVerHistorico)}
        onClose={() => setItemParaVerHistorico(null)}
        titulo={itemParaVerHistorico?.titulo || 'Operação do Caixa'}
        subtitulo={
          itemParaVerHistorico
            ? `${formatCentavos(itemParaVerHistorico.valor_centavos)} • ${formatDateBR(
                itemParaVerHistorico.data_movimento,
              )}`
            : undefined
        }
        historico={historicoLogs}
        isLoading={carregandoHistorico}
      />
    </Layout>
  )
}

export default CaixaMovimentacaoDia
