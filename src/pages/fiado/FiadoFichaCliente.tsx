import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User,
  Phone,
  MapPin,
  Star,
  Edit,
  PlusCircle,
  AlertTriangle,
  ShieldAlert,
  Clock,
  History,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  Gift,
  Scale,
  RefreshCw,
  Loader2,
  ShieldCheck,
  CreditCard,
  Ban,
  Pencil,
  ArrowDownCircle,
  Check,
  MessageCircle,
} from 'lucide-react'
import { ModalHistoricoRegistro } from '@/components/ModalHistoricoRegistro'
import { getHistoricoRegistro } from '@/services/fiado'
import { gerarTextoResumoFichaCliente, compartilharDados } from '@/lib/whatsapp'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import {
  getCliente,
  listClientes,
  getSituacaoFinanceiraCliente,
  getHistoricoCliente,
  getAuditoriaCliente,
  toggleFavoritoCliente,
  editarPagamentoFiado,
  cancelarPagamentoFiado,
  editarConsumoFiado,
  cancelarConsumoFiado,
  recalcularClienteCronologico,
} from '@/services/fiado'
import {
  formatCentavos,
  formatDateBR,
  formatDateTimeBR,
  parseBRLToCentavos,
} from '@/lib/formatters'
import type {
  Cliente,
  FormaPagamento,
  HistoricoAuditoria,
  MovimentacaoHistorico,
} from '@/types/fiado'

export const FiadoFichaCliente = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [tabAtiva, setTabAtiva] = useState<'movimentacoes' | 'auditoria'>('movimentacoes')

  // Estados para modais de Edição e Cancelamento de Pagamento
  const [pagamentoParaEditar, setPagamentoParaEditar] = useState<MovimentacaoHistorico | null>(null)
  const [editValorInput, setEditValorInput] = useState('')
  const [editForma, setEditForma] = useState<FormaPagamento>('dinheiro')
  const [editDataMovimento, setEditDataMovimento] = useState('')
  const [pagamentoParaCancelar, setPagamentoParaCancelar] = useState<MovimentacaoHistorico | null>(
    null,
  )

  // Estados para modais de Edição e Cancelamento de Consumo (com Troca de Cliente)
  const [consumoParaEditar, setConsumoParaEditar] = useState<MovimentacaoHistorico | null>(null)
  const [editConsumoValorInput, setEditConsumoValorInput] = useState('')
  const [editConsumoDescricao, setEditConsumoDescricao] = useState('')
  const [editConsumoData, setEditConsumoData] = useState('')
  const [editConsumoClienteDestinoId, setEditConsumoClienteDestinoId] = useState<string>('')
  const [consumoParaCancelar, setConsumoParaCancelar] = useState<MovimentacaoHistorico | null>(null)

  // Estados para consulta de histórico pontual de consumo/pagamento
  const [movimentoParaHistorico, setMovimentoParaHistorico] =
    useState<MovimentacaoHistorico | null>(null)
  const [logsMovimento, setLogsMovimento] = useState<HistoricoAuditoria[]>([])
  const [carregandoLogsMovimento, setCarregandoLogsMovimento] = useState(false)

  // 1. Dados cadastrais do cliente
  const {
    data: cliente,
    isLoading: isLoadingCliente,
    refetch: refetchCliente,
  } = useQuery({
    queryKey: ['fiado-cliente', id],
    queryFn: () => (id ? getCliente(id) : null),
    enabled: Boolean(id),
  })

  // 2. Situação financeira em tempo real (dívida, crédito disponível, posição líquida e limite)
  const {
    data: situacao,
    isLoading: isLoadingSituacao,
    refetch: refetchSituacao,
  } = useQuery({
    queryKey: ['fiado-situacao', id],
    queryFn: () => (cliente ? getSituacaoFinanceiraCliente(cliente) : null),
    enabled: Boolean(cliente),
  })

  // 3. Histórico de movimentações (consumos, pagamentos e créditos)
  const {
    data: historico = [],
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useQuery({
    queryKey: ['fiado-historico', id],
    queryFn: () => (id ? getHistoricoCliente(id) : []),
    enabled: Boolean(id),
  })

  // 4. Histórico de auditoria do cliente (cadastros, alterações de limite/restrição)
  const {
    data: auditoria = [],
    isLoading: isLoadingAuditoria,
    refetch: refetchAuditoria,
  } = useQuery({
    queryKey: ['fiado-auditoria', id],
    queryFn: () => (id ? getAuditoriaCliente(id) : []),
    enabled: Boolean(id) && tabAtiva === 'auditoria',
  })

  // Lista de outros clientes para a funcionalidade de Troca de Cliente em Consumo
  const { data: todosClientes = [] } = useQuery({
    queryKey: ['todos-clientes-troca'],
    queryFn: () => listClientes(),
    enabled: Boolean(consumoParaEditar),
  })

  // Mutation de favorito
  const toggleFavoritoMutation = useMutation({
    mutationFn: ({ novoStatus }: { novoStatus: boolean }) => toggleFavoritoCliente(id!, novoStatus),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fiado-cliente', id] })
      queryClient.invalidateQueries({ queryKey: ['fiado-clientes'] })
      toast({
        title: variables.novoStatus ? 'Favorito adicionado' : 'Favorito removido',
      })
    },
  })

  // Mutations para Edição e Cancelamento de Pagamento
  const editarMutation = useMutation({
    mutationFn: async () => {
      if (!pagamentoParaEditar) return
      const novoCentavos = parseBRLToCentavos(editValorInput)
      if (novoCentavos <= 0) {
        throw new Error('O valor corrigido deve ser maior que zero.')
      }
      return await editarPagamentoFiado({
        pagamento_id: pagamentoParaEditar.id,
        novo_valor_centavos: novoCentavos,
        nova_forma: editForma,
        nova_data_movimento: editDataMovimento,
      })
    },
    onSuccess: () => {
      setPagamentoParaEditar(null)
      recarregarTudo()
      toast({
        title: 'Pagamento atualizado!',
        description: 'Dívida, crédito e registro financeiro recalculados com sucesso.',
      })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao editar pagamento',
        description: err.message || 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      })
    },
  })

  const cancelarMutation = useMutation({
    mutationFn: async () => {
      if (!pagamentoParaCancelar) return
      return await cancelarPagamentoFiado(pagamentoParaCancelar.id)
    },
    onSuccess: () => {
      setPagamentoParaCancelar(null)
      recarregarTudo()
      toast({
        title: 'Pagamento cancelado!',
        description: 'Efeitos sobre dívida e crédito desfeitos com sucesso.',
      })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao cancelar pagamento',
        description: err.message || 'Não foi possível cancelar o pagamento.',
        variant: 'destructive',
      })
    },
  })

  // Mutations para Edição e Cancelamento de Consumo
  const editarConsumoMutation = useMutation({
    mutationFn: async () => {
      if (!consumoParaEditar) return
      const novoCentavos = parseBRLToCentavos(editConsumoValorInput)
      if (novoCentavos <= 0) {
        throw new Error('O valor do consumo deve ser maior que zero.')
      }

      return await editarConsumoFiado({
        consumo_id: consumoParaEditar.id,
        novo_valor_centavos: novoCentavos,
        nova_descricao: editConsumoDescricao,
        nova_data_movimento: editConsumoData,
        novo_cliente_id: editConsumoClienteDestinoId || undefined,
      })
    },
    onSuccess: (res) => {
      setConsumoParaEditar(null)
      recarregarTudo()
      if (res?.troca_cliente) {
        toast({
          title: 'Consumo transferido com sucesso!',
          description:
            'A dívida e os efeitos foram retirados desta conta e aplicados ao novo cliente com recálculo cronológico.',
        })
      } else {
        toast({
          title: 'Consumo atualizado!',
          description: 'Valor, descrição e recálculo cronológico concluídos com sucesso.',
        })
      }
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao editar consumo',
        description: err.message || 'Não foi possível salvar as alterações do consumo.',
        variant: 'destructive',
      })
    },
  })

  const cancelarConsumoMutation = useMutation({
    mutationFn: async () => {
      if (!consumoParaCancelar) return
      return await cancelarConsumoFiado(consumoParaCancelar.id)
    },
    onSuccess: () => {
      setConsumoParaCancelar(null)
      recarregarTudo()
      toast({
        title: 'Consumo cancelado!',
        description:
          'Efeitos do consumo cancelados e saldo do cliente recalculado cronologicamente.',
      })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao cancelar consumo',
        description: err.message || 'Não foi possível cancelar o consumo.',
        variant: 'destructive',
      })
    },
  })

  const abrirEdicaoPagamento = (pag: MovimentacaoHistorico) => {
    setPagamentoParaEditar(pag)
    setEditValorInput((pag.valor_centavos / 100).toFixed(2).replace('.', ','))
    setEditForma((pag.forma as FormaPagamento) || 'dinheiro')
    setEditDataMovimento(pag.data_movimento)
  }

  const abrirEdicaoConsumo = (cons: MovimentacaoHistorico) => {
    setConsumoParaEditar(cons)
    setEditConsumoValorInput((cons.valor_centavos / 100).toFixed(2).replace('.', ','))
    setEditConsumoDescricao(cons.descricao || '')
    setEditConsumoData(cons.data_movimento)
    setEditConsumoClienteDestinoId(id || '')
  }

  const abrirHistoricoMovimento = async (item: MovimentacaoHistorico) => {
    setMovimentoParaHistorico(item)
    setCarregandoLogsMovimento(true)
    try {
      const logs = await getHistoricoRegistro(item.id)
      setLogsMovimento(logs)
    } catch (e) {
      console.error(e)
      setLogsMovimento([])
    } finally {
      setCarregandoLogsMovimento(false)
    }
  }

  const recarregarTudo = () => {
    refetchCliente()
    refetchSituacao()
    refetchHistorico()
    if (tabAtiva === 'auditoria') refetchAuditoria()
  }

  if (isLoadingCliente || !cliente) {
    return (
      <Layout backTo="/fiado" backLabel="VOLTAR" className="items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
        <p className="mt-3 text-sm text-[#A8B3A6]">Carregando ficha do cliente...</p>
      </Layout>
    )
  }

  // Análise rápida para o atendente no balcão: pode ou não comprar fiado?
  const podeComprarFiado = (() => {
    if (cliente.restricao_ativa) return false
    if (cliente.limite_centavos === 0) return false
    if (cliente.limite_centavos === null) return true
    if (situacao && situacao.disponivelParaFiadoCentavos !== null) {
      return situacao.disponivelParaFiadoCentavos > 0
    }
    return true
  })()

  return (
    <Layout backTo="/fiado" backLabel="VOLTAR AO FIADO" className="pb-10">
      {/* Cabeçalho do Cliente */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight text-[#F3EAD3]">
              {cliente.nome}
            </h1>
            <button
              type="button"
              onClick={() => toggleFavoritoMutation.mutate({ novoStatus: !cliente.favorito })}
              className="text-[#4B5E4F] transition-colors hover:text-[#F2B705]"
              title={cliente.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Star
                className={`h-5 w-5 ${cliente.favorito ? 'fill-[#F2B705] text-[#F2B705]' : ''}`}
              />
            </button>
          </div>
          {cliente.apelido && (
            <p className="text-sm font-semibold text-[#1E6B3A]">Apelido: "{cliente.apelido}"</p>
          )}
        </div>

        {/* Botão de Editar */}
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(`/fiado/cliente/${cliente.id}/editar`)}
          className="h-10 rounded-xl border-[#26332A] bg-[#141B15] px-3 font-semibold text-[#F3EAD3] hover:bg-[#1A251C]"
        >
          <Edit className="mr-1.5 h-4 w-4 text-[#A8B3A6]" />
          EDITAR
        </Button>
      </div>

      {/* Contatos e Endereço */}
      {(cliente.telefone || cliente.endereco) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#879689]">
          {cliente.telefone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-[#1E6B3A]" />
              {cliente.telefone}
            </span>
          )}
          {cliente.endereco && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#1E6B3A]" />
              {cliente.endereco}
            </span>
          )}
        </div>
      )}

      {/* BANNER DE SITUAÇÃO OPERACIONAL NO BALCÃO (Poucos toques, visão imediata) */}
      <div className="mt-4">
        {cliente.restricao_ativa ? (
          <div className="rounded-2xl border-2 border-red-700 bg-red-950/40 p-4 shadow-lg shadow-red-950/40">
            <div className="flex items-center gap-2 text-red-200">
              <ShieldAlert className="h-6 w-6 text-red-400 shrink-0" />
              <div>
                <p className="text-base font-extrabold tracking-wide uppercase">
                  BLOQUEADO — NÃO VENDER FIADO
                </p>
                <p className="text-xs text-red-300">
                  Restrição manual ativa. Proibido registrar novos consumos fiados.
                </p>
              </div>
            </div>
            {cliente.restricao_motivo && (
              <div className="mt-2.5 rounded-xl border border-red-800/60 bg-red-950/70 p-2.5 text-xs text-red-100">
                <span className="font-bold text-red-300">Motivo: </span>"{cliente.restricao_motivo}"
              </div>
            )}
          </div>
        ) : cliente.limite_centavos === 0 ? (
          <div className="rounded-2xl border border-yellow-700/80 bg-yellow-950/30 p-4">
            <div className="flex items-center gap-2 text-yellow-200">
              <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
              <div>
                <p className="text-sm font-bold uppercase tracking-wide">
                  Limite R$ 0,00 — Sem autorização para fiado
                </p>
                <p className="text-xs text-yellow-300/80">
                  O cliente não possui margem autorizada para compras fiadas.
                </p>
              </div>
            </div>
          </div>
        ) : podeComprarFiado ? (
          <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">
                  Liberado para compra fiada
                </p>
                <p className="text-[11px] text-[#A8B3A6]">
                  {cliente.limite_centavos === null
                    ? 'Sem teto de limite configurado'
                    : `Disponível no limite: ${formatCentavos(situacao?.disponivelParaFiadoCentavos)}`}
                </p>
              </div>
            </div>
            <Badge className="bg-[#1E6B3A] text-[#F3EAD3] font-bold">AUTORIZADO</Badge>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-800/80 bg-amber-950/30 p-4">
            <div className="flex items-center gap-2 text-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-bold uppercase tracking-wide">
                  Capacidade de Limite Esgotada
                </p>
                <p className="text-xs text-amber-300/80">
                  A dívida atual já atinge ou ultrapassa o limite permitido.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AÇÕES PRINCIPAIS NO BALCÃO: RECEBER PAGAMENTO E REGISTRAR CONSUMO */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {/* Ação 1: Receber Pagamento Fiado (Regra 6: Acesso obrigatório na ficha do cliente) */}
        <Button
          type="button"
          onClick={() => navigate(`/fiado/cliente/${cliente.id}/pagamento`)}
          className="h-16 w-full rounded-2xl bg-emerald-800 text-lg font-bold tracking-wide text-[#F3EAD3] hover:bg-emerald-700 active:scale-[0.98] shadow-lg shadow-emerald-950/40 transition-all border border-emerald-600/60"
        >
          <CreditCard className="mr-2.5 h-6 w-6 text-emerald-300" />
          RECEBER PAGAMENTO
        </Button>

        {/* Ação 2: Registrar Consumo Fiado */}
        <Button
          type="button"
          disabled={!podeComprarFiado}
          onClick={() => navigate(`/fiado/cliente/${cliente.id}/consumo`)}
          className={`h-16 w-full rounded-2xl text-lg font-bold tracking-wide shadow-lg active:scale-[0.98] transition-all ${
            podeComprarFiado
              ? 'bg-[#1E6B3A] text-[#F3EAD3] hover:bg-[#25814A] shadow-[#1E6B3A]/25'
              : 'bg-[#1C271E] text-[#6E7B70] cursor-not-allowed border border-[#26332A]'
          }`}
        >
          <PlusCircle className="mr-2.5 h-6 w-6" />
          REGISTRAR CONSUMO
        </Button>
      </div>

      {/* Compartilhar Resumo da Ficha via WhatsApp (Frente 3) */}
      <div className="mt-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            if (!cliente || !situacao) return
            const texto = gerarTextoResumoFichaCliente({ cliente, situacao })
            await compartilharDados({
              telefone: cliente.telefone,
              texto,
              titulo: `Extrato Fiado - ${cliente.nome}`,
            })
          }}
          className="h-11 w-full justify-center rounded-xl border-[#26332A] bg-[#141B15] text-xs font-bold text-[#F3EAD3] hover:bg-[#1E6B3A]/20 hover:border-[#1E6B3A] active:scale-[0.98] transition-all"
        >
          <MessageCircle className="mr-2 h-4 w-4 text-[#25D366]" />
          COMPARTILHAR EXTRATO NO WHATSAPP
        </Button>
      </div>

      {!podeComprarFiado && (
        <p className="mt-1.5 text-center text-[11px] text-red-400">
          {cliente.restricao_ativa
            ? 'Consumo bloqueado por "Não vender fiado". Recebimento de pagamento liberado.'
            : 'Consumo bloqueado por política de limite. Recebimento de pagamento liberado.'}
        </p>
      )}

      {/* PAINEL DE SITUAÇÃO FINANCEIRA: Dívida, Crédito, Posição Líquida e Limite */}
      <div className="mt-5 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#26332A]">
          <p className="text-xs font-bold tracking-wider text-[#A8B3A6] uppercase">
            Posição Financeira
          </p>
          <button
            type="button"
            onClick={recarregarTudo}
            className="text-xs text-[#1E6B3A] hover:underline flex items-center gap-1 font-semibold"
          >
            <RefreshCw className="h-3 w-3" />
            Atualizar
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {/* Card: Total Dívida */}
          <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3">
            <div className="flex items-center gap-1.5 text-[#A8B3A6] text-xs">
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              <span>Dívida em Aberto</span>
            </div>
            <p className="mt-1 text-lg font-bold text-red-300">
              {formatCentavos(situacao?.saldoDevedorCentavos ?? 0)}
            </p>
            <span className="text-[10px] text-[#6E7B70]">Fiado pendente de quitação</span>
          </div>

          {/* Card: Crédito Disponível */}
          <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3">
            <div className="flex items-center gap-1.5 text-[#A8B3A6] text-xs">
              <Gift className="h-3.5 w-3.5 text-emerald-400" />
              <span>Crédito Disponível</span>
            </div>
            <p className="mt-1 text-lg font-bold text-emerald-300">
              {formatCentavos(situacao?.totalCreditoDisponivelCentavos ?? 0)}
            </p>
            <span className="text-[10px] text-[#6E7B70]">Sobras de pagamentos</span>
          </div>

          {/* Card: Total Já Pago */}
          <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3">
            <div className="flex items-center gap-1.5 text-[#A8B3A6] text-xs">
              <ArrowDownCircle className="h-3.5 w-3.5 text-blue-400" />
              <span>Total Pago</span>
            </div>
            <p className="mt-1 text-lg font-bold text-blue-200">
              {formatCentavos(situacao?.totalPagoCentavos ?? 0)}
            </p>
            <span className="text-[10px] text-[#6E7B70]">Soma de recebimentos ativos</span>
          </div>

          {/* Card: Limite e Capacidade */}
          <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3">
            <div className="flex items-center gap-1.5 text-[#A8B3A6] text-xs">
              <DollarSign className="h-3.5 w-3.5 text-[#1E6B3A]" />
              <span>Limite de Fiado</span>
            </div>
            <p className="mt-1 text-base font-bold text-[#F3EAD3]">
              {cliente.limite_centavos === null
                ? 'Sem limite'
                : formatCentavos(cliente.limite_centavos)}
            </p>
            <span className="text-[10px] text-[#6E7B70]">
              {cliente.limite_centavos === null
                ? 'Livre para compras'
                : cliente.limite_centavos === 0
                  ? 'Não autorizado'
                  : `Disponível: ${formatCentavos(situacao?.disponivelParaFiadoCentavos)}`}
            </span>
          </div>
        </div>
      </div>

      {/* ABAS: HISTÓRICO DE MOVIMENTAÇÕES E AUDITORIA */}
      <div className="mt-6">
        <Tabs value={tabAtiva} onValueChange={(val: any) => setTabAtiva(val)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-[#141B15] p-1 border border-[#26332A]">
            <TabsTrigger
              value="movimentacoes"
              className="rounded-lg font-bold text-xs data-[state=active]:bg-[#1E6B3A] data-[state=active]:text-[#F3EAD3]"
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              MOVIMENTAÇÕES ({historico.length})
            </TabsTrigger>
            <TabsTrigger
              value="auditoria"
              className="rounded-lg font-bold text-xs data-[state=active]:bg-[#1E6B3A] data-[state=active]:text-[#F3EAD3]"
            >
              <History className="mr-1.5 h-3.5 w-3.5" />
              AUDITORIA
            </TabsTrigger>
          </TabsList>

          {/* Conteúdo da Aba 1: Movimentações */}
          <TabsContent value="movimentacoes" className="mt-4 space-y-3">
            {isLoadingHistorico ? (
              <div className="py-8 text-center text-xs text-[#A8B3A6]">
                Carregando movimentações...
              </div>
            ) : historico.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#26332A] p-6 text-center text-xs text-[#A8B3A6]">
                Nenhuma movimentação registrada para este cliente.
              </div>
            ) : (
              <div className="space-y-2.5">
                {historico.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      item.status === 'cancelado'
                        ? 'border-gray-800 bg-[#101311] opacity-60'
                        : item.tipo === 'pagamento'
                          ? 'border-emerald-900/70 bg-[#121c15] hover:border-emerald-700/80'
                          : item.tipo === 'credito'
                            ? 'border-amber-900/50 bg-[#181611]'
                            : 'border-[#26332A] bg-[#141B15] hover:border-[#334637]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              item.status === 'cancelado'
                                ? 'bg-gray-800 text-gray-400 line-through'
                                : item.tipo === 'consumo'
                                  ? 'bg-red-950/80 text-red-300 border border-red-900/60'
                                  : item.tipo === 'pagamento'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {item.origem}
                          </span>
                          <span className="text-xs font-semibold text-[#A8B3A6]">
                            Data: {formatDateBR(item.data_movimento)}
                          </span>
                          {item.status === 'cancelado' && (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                              CANCELADO
                            </Badge>
                          )}
                        </div>

                        {item.descricao && (
                          <p className="mt-1.5 text-sm font-medium text-[#F3EAD3]">
                            {item.descricao}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-base font-bold ${
                            item.status === 'cancelado'
                              ? 'text-gray-400 line-through'
                              : item.tipo === 'consumo'
                                ? 'text-red-300'
                                : item.tipo === 'pagamento'
                                  ? 'text-emerald-300'
                                  : 'text-amber-300'
                          }`}
                        >
                          {item.tipo === 'consumo' ? '+ ' : item.tipo === 'pagamento' ? '- ' : ''}
                          {formatCentavos(item.valor_centavos)}
                        </p>

                        {/* Ações para itens: Ver Histórico, Editar e Cancelar */}
                        <div className="mt-1.5 flex items-center justify-end gap-1 flex-wrap">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirHistoricoMovimento(item)}
                            className="h-7 px-2 text-[11px] font-semibold text-[#879689] hover:bg-[#1C271E] hover:text-[#F3EAD3]"
                            title="Ver histórico de alterações"
                          >
                            <History className="mr-1 h-3 w-3 text-[#1E6B3A]" />
                            Ver histórico
                          </Button>

                          {item.tipo === 'pagamento' && item.status === 'ativo' && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirEdicaoPagamento(item)}
                                className="h-7 px-2 text-[11px] font-semibold text-[#A8B3A6] hover:bg-[#1C271E] hover:text-[#F3EAD3]"
                                title="Corrigir valor, forma ou data"
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setPagamentoParaCancelar(item)}
                                className="h-7 px-2 text-[11px] font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300"
                                title="Cancelar pagamento"
                              >
                                <Ban className="mr-1 h-3 w-3" />
                                Cancelar
                              </Button>
                            </>
                          )}

                          {item.tipo === 'consumo' && item.status === 'ativo' && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirEdicaoConsumo(item)}
                                className="h-7 px-2 text-[11px] font-semibold text-[#A8B3A6] hover:bg-[#1C271E] hover:text-[#F3EAD3]"
                                title="Corrigir valor, data, descrição ou cliente"
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setConsumoParaCancelar(item)}
                                className="h-7 px-2 text-[11px] font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300"
                                title="Cancelar consumo"
                              >
                                <Ban className="mr-1 h-3 w-3" />
                                Cancelar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadados: quem registrou e data/hora do registro */}
                    <div className="mt-2 flex flex-wrap items-center justify-between border-t border-[#1C271E] pt-2 text-[11px] text-[#6E7B70]">
                      <span>
                        Lançado por:{' '}
                        <strong className="text-[#A8B3A6]">{item.registrado_por_nome}</strong>
                      </span>
                      <span>Registro: {formatDateTimeBR(item.data_registro)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Conteúdo da Aba 2: Auditoria (historico_alteracoes) */}
          <TabsContent value="auditoria" className="mt-4 space-y-3">
            {isLoadingAuditoria ? (
              <div className="py-8 text-center text-xs text-[#A8B3A6]">
                Carregando registros de auditoria...
              </div>
            ) : auditoria.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#26332A] p-6 text-center text-xs text-[#A8B3A6]">
                Nenhuma alteração cadastral registrada na auditoria até o momento.
              </div>
            ) : (
              <div className="space-y-2.5">
                {auditoria.map((log) => {
                  const novos = log.dados_novos || {}
                  const antigos = log.dados_anteriores || {}

                  return (
                    <div
                      key={log.id}
                      className="rounded-xl border border-[#26332A] bg-[#141B15] p-3 text-xs"
                    >
                      <div className="flex items-center justify-between text-[#A8B3A6]">
                        <span className="font-bold text-[#F3EAD3]">Alteração Cadastral</span>
                        <span>{formatDateTimeBR(log.alterado_em)}</span>
                      </div>

                      <p className="mt-1 text-[#879689]">
                        Realizada por:{' '}
                        <strong className="text-[#F3EAD3]">{log.alterado_por_nome}</strong>
                      </p>

                      {/* Resumo das alterações */}
                      <div className="mt-2 space-y-1 rounded-lg bg-[#0B0F0C] p-2 text-[11px]">
                        {antigos.limite_centavos !== novos.limite_centavos && (
                          <p className="text-[#A8B3A6]">
                            • Limite alterado de{' '}
                            <span className="font-semibold text-yellow-400">
                              {antigos.limite_centavos === null
                                ? 'Sem limite'
                                : formatCentavos(antigos.limite_centavos as number)}
                            </span>{' '}
                            para{' '}
                            <span className="font-semibold text-emerald-400">
                              {novos.limite_centavos === null
                                ? 'Sem limite'
                                : formatCentavos(novos.limite_centavos as number)}
                            </span>
                          </p>
                        )}

                        {antigos.restricao_ativa !== novos.restricao_ativa && (
                          <p className="text-[#A8B3A6]">
                            • Restrição "Não vender fiado":{' '}
                            <span
                              className={`font-semibold ${
                                novos.restricao_ativa ? 'text-red-400' : 'text-emerald-400'
                              }`}
                            >
                              {novos.restricao_ativa ? 'ATIVADA' : 'DESATIVADA'}
                            </span>
                            {novos.restricao_motivo && (
                              <span> (Motivo: "{String(novos.restricao_motivo)}")</span>
                            )}
                          </p>
                        )}

                        {antigos.valor_centavos !== novos.valor_centavos && (
                          <p className="text-[#A8B3A6]">
                            • Valor alterado de{' '}
                            <span className="font-semibold text-yellow-400">
                              {formatCentavos(antigos.valor_centavos as number)}
                            </span>{' '}
                            para{' '}
                            <span className="font-semibold text-emerald-400">
                              {formatCentavos(novos.valor_centavos as number)}
                            </span>
                          </p>
                        )}

                        {antigos.status !== novos.status && (
                          <p className="text-[#A8B3A6]">
                            • Status alterado de "{String(antigos.status)}" para{' '}
                            <span className="font-semibold text-red-400">
                              "{String(novos.status)}"
                            </span>
                          </p>
                        )}

                        {antigos.forma !== novos.forma && (
                          <p className="text-[#A8B3A6]">
                            • Forma de pagamento: {String(antigos.forma)} → {String(novos.forma)}
                          </p>
                        )}

                        {antigos.nome !== novos.nome && (
                          <p className="text-[#A8B3A6]">
                            • Nome: "{String(antigos.nome)}" → "{String(novos.nome)}"
                          </p>
                        )}

                        {antigos.telefone !== novos.telefone && (
                          <p className="text-[#A8B3A6]">
                            • Telefone: {String(antigos.telefone || 'Vazio')} →{' '}
                            {String(novos.telefone || 'Vazio')}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* MODAL 1: EDIÇÃO DE PAGAMENTO (Regra 16) */}
      <Dialog
        open={Boolean(pagamentoParaEditar)}
        onOpenChange={(aberto) => !aberto && setPagamentoParaEditar(null)}
      >
        <DialogContent className="border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F3EAD3]">
              Editar Pagamento do Fiado
            </DialogTitle>
            <DialogDescription className="text-xs text-[#A8B3A6]">
              Permite corrigir valor digitado incorretamente, forma ou data do recebimento. Não cria
              novo pagamento; atualiza o registro existente e preserva histórico.
            </DialogDescription>
          </DialogHeader>

          {pagamentoParaEditar && (
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
                    {formatCentavos(pagamentoParaEditar.valor_centavos)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A8B3A6]">Forma original:</span>
                  <span>{pagamentoParaEditar.forma || 'Não especificada'}</span>
                </div>
              </div>

              {/* Novo Valor */}
              <div className="space-y-1">
                <Label htmlFor="editValor" className="text-xs font-bold text-[#F3EAD3]">
                  Novo Valor Recebido (R$) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#1E6B3A]">
                    R$
                  </span>
                  <Input
                    id="editValor"
                    type="text"
                    inputMode="decimal"
                    required
                    value={editValorInput}
                    onChange={(e) => setEditValorInput(e.target.value)}
                    className="h-11 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-base font-bold text-[#F3EAD3]"
                  />
                </div>
              </div>

              {/* Nova Forma */}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#F3EAD3]">Forma de Pagamento *</Label>
                <RadioGroup
                  value={editForma}
                  onValueChange={(val: FormaPagamento) => setEditForma(val)}
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
                    <span>Dinheiro</span>
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

              {/* Nova Data de Movimento */}
              <div className="space-y-1">
                <Label htmlFor="editData" className="text-xs font-bold text-[#F3EAD3]">
                  Data do Recebimento *
                </Label>
                <Input
                  id="editData"
                  type="date"
                  required
                  value={editDataMovimento}
                  onChange={(e) => setEditDataMovimento(e.target.value)}
                  className="h-10 rounded-xl border-[#26332A] bg-[#0B0F0C] text-sm text-[#F3EAD3]"
                />
              </div>

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPagamentoParaEditar(null)}
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

      {/* MODAL 2: CANCELAMENTO DE PAGAMENTO (Regra 17) */}
      <Dialog
        open={Boolean(pagamentoParaCancelar)}
        onOpenChange={(aberto) => !aberto && setPagamentoParaCancelar(null)}
      >
        <DialogContent className="border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-950/60 text-red-400 border border-red-800">
              <Ban className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-[#F3EAD3] mt-2">
              Cancelar Pagamento?
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-[#A8B3A6]">
              A dívida quitada por este pagamento será restaurada e o recebimento financeiro será
              desfeito. O registro histórico é preservado na auditoria.
            </DialogDescription>
          </DialogHeader>

          {pagamentoParaCancelar && (
            <div className="space-y-2 rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-xs">
              <div className="flex justify-between py-1 border-b border-[#1C271E]">
                <span className="text-[#A8B3A6]">Cliente:</span>
                <strong className="text-[#F3EAD3]">{cliente.nome}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1C271E]">
                <span className="text-[#A8B3A6]">Valor do pagamento:</span>
                <strong className="text-red-300">
                  {formatCentavos(pagamentoParaCancelar.valor_centavos)}
                </strong>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1C271E]">
                <span className="text-[#A8B3A6]">Forma:</span>
                <span>{pagamentoParaCancelar.forma || 'Não especificada'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#A8B3A6]">Data do recebimento:</span>
                <span>{formatDateBR(pagamentoParaCancelar.data_movimento)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPagamentoParaCancelar(null)}
              className="rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3]"
            >
              NÃO, MANTER PAGAMENTO
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
                'SIM, CANCELAR PAGAMENTO'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: EDIÇÃO DE CONSUMO (com Troca de Cliente e Alerta de Impacto) */}
      <Dialog
        open={Boolean(consumoParaEditar)}
        onOpenChange={(aberto) => !aberto && setConsumoParaEditar(null)}
      >
        <DialogContent className="border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F3EAD3]">
              Editar Consumo do Fiado
            </DialogTitle>
            <DialogDescription className="text-xs text-[#A8B3A6]">
              Permite corrigir o valor lançado, descrição, data ou corrigir lançamento na conta
              errada transferindo para outro cliente.
            </DialogDescription>
          </DialogHeader>

          {consumoParaEditar && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                editarConsumoMutation.mutate()
              }}
              className="space-y-3.5 text-xs"
            >
              <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#A8B3A6]">Valor registrado anteriormente:</span>
                  <strong className="text-white">
                    {formatCentavos(consumoParaEditar.valor_centavos)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A8B3A6]">Cliente atual:</span>
                  <span className="font-semibold text-white">{cliente.nome}</span>
                </div>
              </div>

              {/* Novo Valor */}
              <div className="space-y-1">
                <Label htmlFor="editConsumoValor" className="text-xs font-bold text-[#F3EAD3]">
                  Novo Valor do Consumo (R$) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#1E6B3A]">
                    R$
                  </span>
                  <Input
                    id="editConsumoValor"
                    type="text"
                    inputMode="decimal"
                    required
                    value={editConsumoValorInput}
                    onChange={(e) => setEditConsumoValorInput(e.target.value)}
                    className="h-11 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-base font-bold text-[#F3EAD3]"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-1">
                <Label htmlFor="editConsumoDesc" className="text-xs font-bold text-[#F3EAD3]">
                  Descrição / Itens
                </Label>
                <Input
                  id="editConsumoDesc"
                  type="text"
                  placeholder="Ex: 2 cervejas, 1 porção..."
                  value={editConsumoDescricao}
                  onChange={(e) => setEditConsumoDescricao(e.target.value)}
                  className="h-10 rounded-xl border-[#26332A] bg-[#0B0F0C] text-sm text-[#F3EAD3]"
                />
              </div>

              {/* Data do Movimento */}
              <div className="space-y-1">
                <Label htmlFor="editConsumoData" className="text-xs font-bold text-[#F3EAD3]">
                  Data do Consumo *
                </Label>
                <Input
                  id="editConsumoData"
                  type="date"
                  required
                  value={editConsumoData}
                  onChange={(e) => setEditConsumoData(e.target.value)}
                  className="h-10 rounded-xl border-[#26332A] bg-[#0B0F0C] text-sm text-[#F3EAD3]"
                />
              </div>

              {/* Troca de Cliente (Conta Errada) */}
              <div className="space-y-1 pt-2 border-t border-[#26332A]">
                <Label
                  htmlFor="editConsumoCliente"
                  className="text-xs font-bold text-[#F3EAD3] flex items-center justify-between"
                >
                  <span>Atribuir a outro Cliente (Troca de Conta)</span>
                  {editConsumoClienteDestinoId && editConsumoClienteDestinoId !== id && (
                    <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px]">
                      Transferência de conta
                    </Badge>
                  )}
                </Label>
                <select
                  id="editConsumoCliente"
                  value={editConsumoClienteDestinoId}
                  onChange={(e) => setEditConsumoClienteDestinoId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-[#26332A] bg-[#0B0F0C] px-3 text-xs text-[#F3EAD3] focus:outline-none focus:ring-1 focus:ring-[#1E6B3A]"
                >
                  <option value={id}>{cliente.nome} (Manter neste cliente)</option>
                  {todosClientes
                    .filter((c) => c.id !== id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.apelido ? `(${c.apelido})` : ''}
                      </option>
                    ))}
                </select>

                {editConsumoClienteDestinoId && editConsumoClienteDestinoId !== id && (
                  <div className="mt-2 rounded-xl border border-amber-800/80 bg-amber-950/30 p-2.5 text-[11px] text-amber-200">
                    <p className="font-bold flex items-center gap-1 text-amber-300">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Atenção: Ação de Alto Impacto
                    </p>
                    <p className="mt-1 text-amber-200/90 leading-relaxed">
                      Este consumo será removido da conta de <strong>{cliente.nome}</strong> e
                      transferido para o novo cliente. Ambas as contas terão seus saldos, créditos e
                      históricos recalculados cronologicamente. Pagamentos reais realizados serão
                      preservados.
                    </p>
                  </div>
                )}
              </div>

              {/* Alerta se o valor estiver aumentando */}
              {parseBRLToCentavos(editConsumoValorInput) > consumoParaEditar.valor_centavos && (
                <div className="rounded-xl border border-yellow-800/80 bg-yellow-950/30 p-2 text-[11px] text-yellow-200">
                  <span className="font-bold text-yellow-300">Aumento de valor: </span>
                  O saldo devedor aumentará em{' '}
                  <strong>
                    {formatCentavos(
                      parseBRLToCentavos(editConsumoValorInput) - consumoParaEditar.valor_centavos,
                    )}
                  </strong>
                  .
                </div>
              )}

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConsumoParaEditar(null)}
                  className="rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3]"
                >
                  CANCELAR
                </Button>
                <Button
                  type="submit"
                  disabled={editarConsumoMutation.isPending}
                  className="rounded-xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
                >
                  {editarConsumoMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'CONFIRMAR ALTERAÇÃO'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 4: CANCELAMENTO DE CONSUMO */}
      <Dialog
        open={Boolean(consumoParaCancelar)}
        onOpenChange={(aberto) => !aberto && setConsumoParaCancelar(null)}
      >
        <DialogContent className="border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-950/60 text-red-400 border border-red-800">
              <Ban className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-[#F3EAD3] mt-2">
              Cancelar Consumo Fiado?
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-[#A8B3A6]">
              A dívida deste consumo será removida da conta do cliente e o saldo será recalculado
              cronologicamente. O registro histórico permanece arquivado para auditoria.
            </DialogDescription>
          </DialogHeader>

          {consumoParaCancelar && (
            <div className="space-y-2 rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-xs">
              <div className="flex justify-between py-1 border-b border-[#1C271E]">
                <span className="text-[#A8B3A6]">Cliente:</span>
                <strong className="text-[#F3EAD3]">{cliente.nome}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1C271E]">
                <span className="text-[#A8B3A6]">Valor do consumo:</span>
                <strong className="text-red-300">
                  {formatCentavos(consumoParaCancelar.valor_centavos)}
                </strong>
              </div>
              {consumoParaCancelar.descricao && (
                <div className="flex justify-between py-1 border-b border-[#1C271E]">
                  <span className="text-[#A8B3A6]">Descrição:</span>
                  <span>{consumoParaCancelar.descricao}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-[#A8B3A6]">Data do consumo:</span>
                <span>{formatDateBR(consumoParaCancelar.data_movimento)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConsumoParaCancelar(null)}
              className="rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3]"
            >
              NÃO, MANTER CONSUMO
            </Button>
            <Button
              type="button"
              onClick={() => cancelarConsumoMutation.mutate()}
              disabled={cancelarConsumoMutation.isPending}
              className="rounded-xl bg-red-700 font-bold text-white hover:bg-red-600"
            >
              {cancelarConsumoMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'SIM, CANCELAR CONSUMO'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: CONSULTA DE HISTÓRICO PONTUAL DE MOVIMENTO (BEFORE/AFTER) */}
      <ModalHistoricoRegistro
        aberto={Boolean(movimentoParaHistorico)}
        onClose={() => setMovimentoParaHistorico(null)}
        titulo={movimentoParaHistorico?.origem || 'Lançamento do Fiado'}
        subtitulo={
          movimentoParaHistorico
            ? `${formatCentavos(movimentoParaHistorico.valor_centavos)} • ${formatDateBR(
                movimentoParaHistorico.data_movimento,
              )}`
            : undefined
        }
        historico={logsMovimento}
        isLoading={carregandoLogsMovimento}
      />
    </Layout>
  )
}

export default FiadoFichaCliente
