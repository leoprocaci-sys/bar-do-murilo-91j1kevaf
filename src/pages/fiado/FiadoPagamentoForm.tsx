import { useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  User,
  ArrowRight,
  Search,
  Check,
  Gift,
  HelpCircle,
} from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useAuth } from '@/hooks/use-auth'
import {
  listClientes,
  getCliente,
  getSituacaoFinanceiraCliente,
  registrarPagamentoFiado,
} from '@/services/fiado'
import { formatCentavos, parseBRLToCentavos, getTodayDateInput } from '@/lib/formatters'
import type { Cliente, FormaPagamento, SituacaoFinanceiraCliente } from '@/types/fiado'

export const FiadoPagamentoForm = () => {
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const clienteIdFromQuery = searchParams.get('clienteId')
  const clienteId = id || clienteIdFromQuery || ''

  const navigate = useNavigate()
  const { toast } = useToast()
  const { appUser } = useAuth()
  const queryClient = useQueryClient()

  // Estados de seleção de cliente quando acessado da tela inicial do Caderno do Fiado sem cliente fixo
  const [selectedClienteId, setSelectedClienteId] = useState<string>(clienteId)
  const [buscaCliente, setBuscaCliente] = useState('')

  // Estados do formulário de pagamento
  const [dataMovimento, setDataMovimento] = useState(getTodayDateInput())
  const [valorInput, setValorInput] = useState('')
  const [forma, setForma] = useState<FormaPagamento>('dinheiro')

  // Modal de confirmação explícita de crédito excedente
  const [modalExcedenteAberto, setModalExcedenteAberto] = useState(false)

  // 1. Carrega lista de clientes para busca / seleção se clienteId não foi passado
  const { data: todosClientes = [], isLoading: isLoadingClientes } = useQuery({
    queryKey: ['fiado-clientes', buscaCliente],
    queryFn: () => listClientes(buscaCliente),
    enabled: !selectedClienteId,
  })

  // 2. Carrega dados do cliente selecionado
  const activeClienteId = selectedClienteId || clienteId
  const { data: cliente, isLoading: isLoadingCliente } = useQuery({
    queryKey: ['fiado-cliente', activeClienteId],
    queryFn: () => (activeClienteId ? getCliente(activeClienteId) : null),
    enabled: Boolean(activeClienteId),
  })

  // 3. Carrega situação financeira do cliente selecionado
  const { data: situacao, isLoading: isLoadingSituacao } = useQuery({
    queryKey: ['fiado-situacao', activeClienteId],
    queryFn: () => (cliente ? getSituacaoFinanceiraCliente(cliente) : null),
    enabled: Boolean(cliente),
  })

  // Cálculos em tempo real
  const valorDigitadoCentavos = parseBRLToCentavos(valorInput)
  const saldoDevedorCentavos = situacao?.saldoDevedorCentavos ?? 0
  const creditoDisponivelCentavos = situacao?.totalCreditoDisponivelCentavos ?? 0

  // Análise se o valor digitado excede a dívida real do cliente
  const excedeDivida = valorDigitadoCentavos > saldoDevedorCentavos
  const excedenteCentavos = excedeDivida ? valorDigitadoCentavos - saldoDevedorCentavos : 0

  // Mutation para registrar pagamento
  const registrarMutation = useMutation({
    mutationFn: async () => {
      if (!appUser?.id) throw new Error('Usuário autenticado não encontrado.')
      if (!cliente) throw new Error('Selecione o cliente.')
      if (valorDigitadoCentavos <= 0) {
        throw new Error('Informe um valor de pagamento maior que zero.')
      }
      if (!forma) {
        throw new Error('Selecione uma forma de pagamento válida.')
      }
      if (!dataMovimento) {
        throw new Error('Informe a data do recebimento.')
      }

      return await registrarPagamentoFiado({
        cliente_id: cliente.id,
        valor_centavos: valorDigitadoCentavos,
        forma,
        data_movimento: dataMovimento,
      })
    },
    onSuccess: (res) => {
      setModalExcedenteAberto(false)
      queryClient.invalidateQueries({ queryKey: ['fiado-situacao', activeClienteId] })
      queryClient.invalidateQueries({ queryKey: ['fiado-historico', activeClienteId] })
      queryClient.invalidateQueries({ queryKey: ['fiado-clientes'] })

      let msg = `Recebimento de ${formatCentavos(res.valor_centavos)} registrado com sucesso!`
      if (res.credito_gerado_centavos > 0) {
        msg += ` Gerado crédito de ${formatCentavos(res.credito_gerado_centavos)} para ${cliente?.nome}.`
      }

      toast({
        title: 'Pagamento recebido!',
        description: msg,
      })

      navigate(`/fiado/cliente/${activeClienteId}`, { replace: true })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao registrar pagamento',
        description: err.message || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    },
  })

  // Disparo do formulário com validação de excedente
  const handleTentarSalvar = (e: React.FormEvent) => {
    e.preventDefault()

    if (valorDigitadoCentavos <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor maior que zero.',
        variant: 'destructive',
      })
      return
    }

    // Se o valor excede a dívida, exige confirmação explícita
    if (excedeDivida) {
      setModalExcedenteAberto(true)
    } else {
      registrarMutation.mutate()
    }
  }

  // Preenchimento com botão rápido de quitar dívida total
  const preencherDividaTotal = () => {
    if (saldoDevedorCentavos > 0) {
      setValorInput((saldoDevedorCentavos / 100).toFixed(2).replace('.', ','))
    }
  }

  return (
    <Layout
      backTo={cliente ? `/fiado/cliente/${cliente.id}` : '/fiado'}
      backLabel="CANCELAR"
      className="pb-12"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">Receber Pagamento</h1>
          <p className="text-sm text-[#A8B3A6]">
            Amortização ou quitação de fiado (não gera nova venda)
          </p>
        </div>
      </div>

      {/* ETAPA DE SELEÇÃO DE CLIENTE (Caso aberto pela tela inicial sem cliente fixo) */}
      {!activeClienteId ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
            <Label className="text-sm font-bold text-[#F3EAD3]">
              1. Selecione o Cliente para o Recebimento
            </Label>
            <div className="relative mt-2">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A8B3A6]" />
              <Input
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                placeholder="Buscar cliente por nome ou apelido..."
                className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-11 pr-4 text-base text-[#F3EAD3]"
              />
            </div>

            <div className="mt-3 max-h-72 overflow-y-auto space-y-2">
              {isLoadingClientes ? (
                <div className="py-8 text-center text-xs text-[#A8B3A6]">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#1E6B3A]" />
                  <p className="mt-2">Carregando clientes...</p>
                </div>
              ) : todosClientes.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6E7B70]">
                  Nenhum cliente encontrado.
                </div>
              ) : (
                todosClientes.map((c: Cliente) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClienteId(c.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-left transition-all hover:border-[#1E6B3A] hover:bg-[#141B15]"
                  >
                    <div>
                      <p className="font-bold text-[#F3EAD3]">{c.nome}</p>
                      {c.apelido && (
                        <p className="text-xs text-[#1E6B3A]">Apelido: "{c.apelido}"</p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-[#A8B3A6]">Selecionar</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : isLoadingCliente || isLoadingSituacao ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
          <p className="mt-3 text-sm text-[#A8B3A6]">
            Carregando situação financeira do cliente...
          </p>
        </div>
      ) : !cliente ? (
        <div className="mt-6 rounded-2xl border border-dashed border-red-900/60 p-6 text-center text-sm text-red-300">
          Cliente não encontrado.
        </div>
      ) : (
        /* CLIENTE SELECIONADO: FORMULÁRIO DE PAGAMENTO */
        <div className="mt-5 space-y-5">
          {/* Ficha rápida do cliente selecionado */}
          <div className="rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#A8B3A6]">
                  Cliente Selecionado
                </span>
                <h2 className="text-xl font-bold text-[#F3EAD3]">
                  {cliente.nome} {cliente.apelido ? `("${cliente.apelido}")` : ''}
                </h2>
              </div>
              {!id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClienteId('')}
                  className="text-xs text-[#1E6B3A] hover:bg-[#1C271E]"
                >
                  Trocar Cliente
                </Button>
              )}
            </div>

            {/* Painel financeiro do cliente: Dívida atual e Crédito disponível */}
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3">
                <span className="text-[10px] text-[#A8B3A6] block uppercase tracking-wide">
                  Dívida Atual
                </span>
                <span className="text-xl font-extrabold text-red-300">
                  {formatCentavos(saldoDevedorCentavos)}
                </span>
                <span className="text-[10px] text-[#6E7B70] block mt-0.5">Fiado em aberto</span>
              </div>

              <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3">
                <span className="text-[10px] text-[#A8B3A6] block uppercase tracking-wide">
                  Crédito Disponível
                </span>
                <span className="text-xl font-extrabold text-emerald-300">
                  {formatCentavos(creditoDisponivelCentavos)}
                </span>
                <span className="text-[10px] text-[#6E7B70] block mt-0.5">
                  Adiantamento / sobra
                </span>
              </div>
            </div>

            {/* Aviso se cliente tem restrição "Não vender fiado", mas lembrando que pagamento É PERMITIDO */}
            {cliente.restricao_ativa && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-900/60 bg-amber-950/30 p-2.5 text-xs text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>
                  Cliente com restrição de "Não vender fiado". Recebimentos são autorizados para
                  quitação.
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleTentarSalvar} className="space-y-5">
            {/* Campo: Valor Recebido */}
            <div className="space-y-2 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="valorPagamento" className="text-sm font-bold text-[#F3EAD3]">
                  Valor Recebido (R$) *
                </Label>
                {saldoDevedorCentavos > 0 && (
                  <button
                    type="button"
                    onClick={preencherDividaTotal}
                    className="text-xs font-semibold text-[#1E6B3A] hover:underline"
                  >
                    Quitar total ({formatCentavos(saldoDevedorCentavos)})
                  </button>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-extrabold text-[#1E6B3A]">
                  R$
                </span>
                <Input
                  id="valorPagamento"
                  type="text"
                  inputMode="decimal"
                  required
                  autoFocus
                  value={valorInput}
                  onChange={(e) => setValorInput(e.target.value)}
                  placeholder="0,00"
                  className="h-16 rounded-2xl border-[#26332A] bg-[#0B0F0C] pl-14 text-3xl font-extrabold text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
                />
              </div>

              {/* Feedback em tempo real sobre o tipo de recebimento */}
              {valorDigitadoCentavos > 0 && (
                <div className="mt-2 text-xs">
                  {valorDigitadoCentavos < saldoDevedorCentavos ? (
                    <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-2.5 text-[#A8B3A6]">
                      <span className="font-bold text-[#F3EAD3]">Recebimento parcial:</span> Restará
                      uma dívida de{' '}
                      <strong className="text-red-300">
                        {formatCentavos(saldoDevedorCentavos - valorDigitadoCentavos)}
                      </strong>
                      .
                    </div>
                  ) : valorDigitadoCentavos === saldoDevedorCentavos ? (
                    <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/40 p-2.5 text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>
                        <strong>Quitação integral:</strong> A dívida do cliente será totalmente
                        zerada.
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-yellow-800/80 bg-yellow-950/40 p-2.5 text-yellow-200">
                      <div className="flex items-center gap-1.5 font-bold text-yellow-300">
                        <Gift className="h-4 w-4" />
                        <span>Pagamento superior à dívida:</span>
                      </div>
                      <p className="mt-1">
                        Dívida quitada: <strong>{formatCentavos(saldoDevedorCentavos)}</strong>.
                        Excedente a virar crédito:{' '}
                        <strong className="text-emerald-300">
                          {formatCentavos(excedenteCentavos)}
                        </strong>
                        .
                      </p>
                      <p className="mt-0.5 text-[11px] text-yellow-300/80">
                        Exigirá confirmação antes de gravar para evitar erros de digitação.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Campo: Forma de Pagamento */}
            <div className="space-y-2 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
              <Label className="text-sm font-bold text-[#F3EAD3]">Forma de Pagamento *</Label>
              <RadioGroup
                value={forma}
                onValueChange={(val: FormaPagamento) => setForma(val)}
                className="grid grid-cols-2 gap-2.5 pt-1"
              >
                {/* Opção Dinheiro */}
                <label
                  htmlFor="forma-dinheiro"
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                    forma === 'dinheiro'
                      ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                      : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
                  }`}
                >
                  <RadioGroupItem value="dinheiro" id="forma-dinheiro" className="sr-only" />
                  <Banknote className="h-5 w-5 text-[#1E6B3A] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Dinheiro</p>
                    <p className="text-[10px] opacity-75">Espécie no caixa</p>
                  </div>
                  {forma === 'dinheiro' && <Check className="h-4 w-4 text-[#1E6B3A]" />}
                </label>

                {/* Opção Pix */}
                <label
                  htmlFor="forma-pix"
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                    forma === 'pix'
                      ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                      : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
                  }`}
                >
                  <RadioGroupItem value="pix" id="forma-pix" className="sr-only" />
                  <QrCode className="h-5 w-5 text-[#1E6B3A] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Pix</p>
                    <p className="text-[10px] opacity-75">Transferência / QR</p>
                  </div>
                  {forma === 'pix' && <Check className="h-4 w-4 text-[#1E6B3A]" />}
                </label>

                {/* Opção Cartão de Débito */}
                <label
                  htmlFor="forma-debito"
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                    forma === 'cartao_debito'
                      ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                      : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
                  }`}
                >
                  <RadioGroupItem value="cartao_debito" id="forma-debito" className="sr-only" />
                  <CreditCard className="h-5 w-5 text-[#1E6B3A] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Cartão Débito</p>
                    <p className="text-[10px] opacity-75">Maquininha</p>
                  </div>
                  {forma === 'cartao_debito' && <Check className="h-4 w-4 text-[#1E6B3A]" />}
                </label>

                {/* Opção Cartão de Crédito */}
                <label
                  htmlFor="forma-credito"
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                    forma === 'cartao_credito'
                      ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                      : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
                  }`}
                >
                  <RadioGroupItem value="cartao_credito" id="forma-credito" className="sr-only" />
                  <CreditCard className="h-5 w-5 text-[#1E6B3A] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Cartão Crédito</p>
                    <p className="text-[10px] opacity-75">Maquininha</p>
                  </div>
                  {forma === 'cartao_credito' && <Check className="h-4 w-4 text-[#1E6B3A]" />}
                </label>
              </RadioGroup>
            </div>

            {/* Data do Recebimento (Movimento) x Data do Registro */}
            <div className="space-y-1.5 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="dataPagamento" className="text-sm font-semibold text-[#F3EAD3]">
                  Data do Recebimento *
                </Label>
                <span className="text-[11px] text-[#A8B3A6]">Permite retroativo</span>
              </div>

              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B3A6]" />
                <Input
                  id="dataPagamento"
                  type="date"
                  required
                  value={dataMovimento}
                  onChange={(e) => setDataMovimento(e.target.value)}
                  className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
                />
              </div>
              <p className="text-[11px] text-[#6E7B70]">
                Preservamos separadamente a data informada e a data/hora exata do registro.
              </p>
            </div>

            {/* Responsável pelo Registro */}
            <div className="flex items-center justify-between rounded-xl border border-[#26332A] bg-[#0B0F0C] px-4 py-3 text-xs text-[#A8B3A6]">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[#1E6B3A]" />
                <span>Responsável pelo recebimento:</span>
              </div>
              <strong className="text-[#F3EAD3] font-semibold">
                {appUser?.nome} ({appUser?.username})
              </strong>
            </div>

            {/* Botão de Envio */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={registrarMutation.isPending || valorDigitadoCentavos <= 0}
                className="h-16 w-full rounded-2xl bg-[#1E6B3A] text-xl font-bold tracking-wide text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.98] shadow-lg shadow-[#1E6B3A]/25 disabled:bg-[#1C271E] disabled:text-[#6E7B70]"
              >
                {registrarMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    REGISTRANDO RECEBIMENTO...
                  </>
                ) : (
                  <>
                    SALVAR RECEBIMENTO
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* MODAL DE CONFIRMAÇÃO EXPLÍCITA DE CRÉDITO EXCEDENTE (Regra 8-10 e 22) */}
          <Dialog open={modalExcedenteAberto} onOpenChange={setModalExcedenteAberto}>
            <DialogContent className="border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-md">
              <DialogHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-950/60 text-yellow-400 border border-yellow-800">
                  <Gift className="h-6 w-6" />
                </div>
                <DialogTitle className="text-center text-lg font-bold text-[#F3EAD3] mt-2">
                  Pagamento Superior à Dívida
                </DialogTitle>
                <DialogDescription className="text-center text-xs text-[#A8B3A6]">
                  O valor informado é maior do que o total devedor do cliente.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2.5 rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1C271E]">
                  <span className="text-[#A8B3A6]">Cliente:</span>
                  <strong className="text-[#F3EAD3]">{cliente.nome}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1C271E]">
                  <span className="text-[#A8B3A6]">Dívida atual:</span>
                  <span className="font-semibold text-red-300">
                    {formatCentavos(saldoDevedorCentavos)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1C271E]">
                  <span className="text-[#A8B3A6]">Valor recebido digitado:</span>
                  <span className="font-bold text-[#F3EAD3]">
                    {formatCentavos(valorDigitadoCentavos)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1C271E]">
                  <span className="text-[#A8B3A6]">Valor para quitar dívida:</span>
                  <span className="font-semibold text-white">
                    {formatCentavos(saldoDevedorCentavos)}
                  </span>
                </div>
                <div className="flex justify-between py-1 pt-1.5 text-sm font-bold text-emerald-300">
                  <span>Excedente que virará crédito:</span>
                  <span>+ {formatCentavos(excedenteCentavos)}</span>
                </div>
              </div>

              <p className="text-[11px] text-[#A8B3A6] text-center">
                Se foi um erro de digitação, clique em <strong>CORRIGIR VALOR</strong>. Se o cliente
                realmente pagou adiantado a mais, confirme para gerar o crédito.
              </p>

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalExcedenteAberto(false)}
                  className="rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3] hover:bg-[#1A251C]"
                >
                  CORRIGIR VALOR
                </Button>
                <Button
                  type="button"
                  onClick={() => registrarMutation.mutate()}
                  disabled={registrarMutation.isPending}
                  className="rounded-xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
                >
                  {registrarMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'CONFIRMAR E GERAR CRÉDITO'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </Layout>
  )
}

export default FiadoPagamentoForm
