import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  QrCode,
  Calendar,
  User,
  ArrowRight,
  Loader2,
  Check,
  Search,
  RotateCcw,
  AlertTriangle,
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
import { listClientes, getCliente, getSituacaoFinanceiraCliente } from '@/services/fiado'
import { registrarDevolucaoCredito } from '@/services/caixa'
import { formatCentavos, parseBRLToCentavos, getTodayDateInput } from '@/lib/formatters'
import type { Cliente } from '@/types/fiado'

export const CaixaDevolucaoCreditoForm = () => {
  const [searchParams] = useSearchParams()
  const dataFromQuery = searchParams.get('data')
  const clienteIdFromQuery = searchParams.get('clienteId')

  const navigate = useNavigate()
  const { toast } = useToast()
  const { appUser } = useAuth()
  const queryClient = useQueryClient()

  // Estados
  const [selectedClienteId, setSelectedClienteId] = useState<string>(clienteIdFromQuery || '')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [dataMovimento, setDataMovimento] = useState(dataFromQuery || getTodayDateInput())
  const [valorInput, setValorInput] = useState('')
  const [forma, setForma] = useState<'dinheiro' | 'conta_pix'>('dinheiro')

  // Modal de confirmação
  const [modalConfirmacaoAberto, setModalConfirmacaoAberto] = useState(false)

  // 1. Lista de clientes para busca / seleção
  const { data: todosClientes = [], isLoading: isLoadingClientes } = useQuery({
    queryKey: ['caixa-clientes-devolucao', buscaCliente],
    queryFn: () => listClientes(buscaCliente),
    enabled: !selectedClienteId,
  })

  // 2. Cliente selecionado
  const { data: cliente, isLoading: isLoadingCliente } = useQuery({
    queryKey: ['caixa-cliente', selectedClienteId],
    queryFn: () => (selectedClienteId ? getCliente(selectedClienteId) : null),
    enabled: Boolean(selectedClienteId),
  })

  // 3. Situação financeira real do cliente
  const { data: situacao, isLoading: isLoadingSituacao } = useQuery({
    queryKey: ['caixa-situacao-cliente', selectedClienteId],
    queryFn: () => (cliente ? getSituacaoFinanceiraCliente(cliente) : null),
    enabled: Boolean(cliente),
  })

  const valorCentavos = parseBRLToCentavos(valorInput)
  const creditoDisponivelCentavos = situacao?.totalCreditoDisponivelCentavos ?? 0

  // Validação: valor não pode exceder o crédito disponível válido
  const excedeCredito = valorCentavos > creditoDisponivelCentavos
  const semCredito = creditoDisponivelCentavos <= 0

  const devolucaoMutation = useMutation({
    mutationFn: async () => {
      if (!appUser?.id) throw new Error('Usuário autenticado não encontrado.')
      if (!cliente) throw new Error('Selecione o cliente.')
      if (valorCentavos <= 0) {
        throw new Error('Informe um valor de devolução maior que zero.')
      }
      if (valorCentavos > creditoDisponivelCentavos) {
        throw new Error(
          `O valor não pode exceder o crédito disponível (${formatCentavos(creditoDisponivelCentavos)}).`,
        )
      }

      return await registrarDevolucaoCredito({
        cliente_id: cliente.id,
        valor_centavos: valorCentavos,
        forma_devolucao: forma,
        data_movimento: dataMovimento,
      })
    },
    onSuccess: (res) => {
      setModalConfirmacaoAberto(false)
      queryClient.invalidateQueries({ queryKey: ['caixa-resumo-dia', dataMovimento] })
      queryClient.invalidateQueries({ queryKey: ['caixa-movimentacao', dataMovimento] })
      queryClient.invalidateQueries({ queryKey: ['fiado-situacao', selectedClienteId] })
      queryClient.invalidateQueries({ queryKey: ['fiado-historico', selectedClienteId] })

      let descEfeito = ''
      if (res.origem === 'gaveta') {
        descEfeito = 'Crédito reduzido e saldo da gaveta reduzido.'
      } else {
        descEfeito = 'Crédito reduzido e saída registrada em Conta/Pix (gaveta intocada).'
      }

      toast({
        title: 'Devolução de Crédito Concluída',
        description: `Devolução de ${formatCentavos(res.valor_centavos)} ao cliente ${cliente?.nome}. ${descEfeito}`,
      })

      navigate(`/caixa?data=${dataMovimento}`, { replace: true })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao devolver crédito',
        description: err.message || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    },
  })

  const handleTentarSalvar = (e: React.FormEvent) => {
    e.preventDefault()

    if (valorCentavos <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor maior que zero.',
        variant: 'destructive',
      })
      return
    }

    if (excedeCredito) {
      toast({
        title: 'Valor não permitido',
        description: `O valor não pode exceder o crédito disponível de ${formatCentavos(creditoDisponivelCentavos)}.`,
        variant: 'destructive',
      })
      return
    }

    setModalConfirmacaoAberto(true)
  }

  const preencherCreditoTotal = () => {
    if (creditoDisponivelCentavos > 0) {
      setValorInput((creditoDisponivelCentavos / 100).toFixed(2).replace('.', ','))
    }
  }

  return (
    <Layout backTo={`/caixa?data=${dataMovimento}`} backLabel="CANCELAR" className="pb-12">
      <div>
        <div className="flex items-center gap-2">
          <RotateCcw className="h-6 w-6 text-cyan-400" />
          <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">Devolução de Crédito</h1>
        </div>
        <p className="text-sm text-[#A8B3A6] mt-0.5">
          Devolução financeira de crédito real e disponível ao cliente (reduz crédito e registra
          saída)
        </p>
      </div>

      {/* SELEÇÃO DO CLIENTE */}
      {!selectedClienteId ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
            <Label className="text-sm font-bold text-[#F3EAD3]">
              1. Selecione o Cliente para a Devolução
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
          <p className="mt-3 text-sm text-[#A8B3A6]">Consultando crédito do cliente...</p>
        </div>
      ) : !cliente ? (
        <div className="mt-6 rounded-2xl border border-dashed border-red-900/60 p-6 text-center text-sm text-red-300">
          Cliente não encontrado.
        </div>
      ) : (
        /* CLIENTE SELECIONADO: FORMULÁRIO DE DEVOLUÇÃO */
        <div className="mt-5 space-y-5">
          {/* Card do Cliente */}
          <div className="rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#A8B3A6]">
                  Cliente
                </span>
                <h2 className="text-xl font-bold text-[#F3EAD3]">
                  {cliente.nome} {cliente.apelido ? `("${cliente.apelido}")` : ''}
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedClienteId('')}
                className="text-xs text-[#1E6B3A] hover:bg-[#1C271E]"
              >
                Trocar Cliente
              </Button>
            </div>

            {/* Crédito Disponível */}
            <div className="mt-3 rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-3 text-center">
              <span className="text-[10px] text-cyan-300 block uppercase tracking-wide">
                Crédito Disponível Válido
              </span>
              <span className="text-3xl font-black text-cyan-200">
                {formatCentavos(creditoDisponivelCentavos)}
              </span>
              <span className="text-[11px] text-[#A8B3A6] block mt-1">
                Limite máximo permitido para devolução
              </span>
            </div>

            {semCredito && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-900/60 bg-red-950/30 p-2.5 text-xs text-red-200">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <span>
                  Este cliente não possui crédito disponível para devolução (saldo R$ 0,00).
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleTentarSalvar} className="space-y-5">
            {/* Campo: Valor */}
            <div className="space-y-2 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="valorDevolucao" className="text-sm font-bold text-[#F3EAD3]">
                  Valor a Devolver (R$) *
                </Label>
                {creditoDisponivelCentavos > 0 && (
                  <button
                    type="button"
                    onClick={preencherCreditoTotal}
                    className="text-xs font-semibold text-cyan-400 hover:underline"
                  >
                    Devolver tudo ({formatCentavos(creditoDisponivelCentavos)})
                  </button>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-extrabold text-cyan-400">
                  R$
                </span>
                <Input
                  id="valorDevolucao"
                  type="text"
                  inputMode="decimal"
                  required
                  autoFocus
                  disabled={semCredito}
                  value={valorInput}
                  onChange={(e) => setValorInput(e.target.value)}
                  placeholder="0,00"
                  className="h-16 rounded-2xl border-[#26332A] bg-[#0B0F0C] pl-14 text-3xl font-extrabold text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
                />
              </div>

              {excedeCredito && (
                <p className="text-xs font-semibold text-red-400">
                  Bloqueado: o valor não pode exceder o crédito disponível de{' '}
                  {formatCentavos(creditoDisponivelCentavos)}.
                </p>
              )}
            </div>

            {/* Campo: Forma de Devolução (Apenas Dinheiro ou Conta/Pix) */}
            <div className="space-y-2 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
              <Label className="text-sm font-bold text-[#F3EAD3]">Forma de Devolução *</Label>
              <RadioGroup
                value={forma}
                onValueChange={(val: 'dinheiro' | 'conta_pix') => setForma(val)}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1"
              >
                {/* Dinheiro (Gaveta) */}
                <label
                  htmlFor="devolucao-dinheiro"
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                    forma === 'dinheiro'
                      ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                      : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
                  }`}
                >
                  <RadioGroupItem value="dinheiro" id="devolucao-dinheiro" className="sr-only" />
                  <Banknote className="h-5 w-5 text-red-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Dinheiro (Gaveta)</p>
                    <p className="text-[10px] opacity-75">Reduz o Saldo Esperado na Gaveta</p>
                  </div>
                  {forma === 'dinheiro' && <Check className="h-4 w-4 text-[#1E6B3A]" />}
                </label>

                {/* Conta / Pix */}
                <label
                  htmlFor="devolucao-pix"
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                    forma === 'conta_pix'
                      ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                      : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
                  }`}
                >
                  <RadioGroupItem value="conta_pix" id="devolucao-pix" className="sr-only" />
                  <QrCode className="h-5 w-5 text-cyan-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Conta / Pix</p>
                    <p className="text-[10px] opacity-75">Saída financeira (NÃO altera a gaveta)</p>
                  </div>
                  {forma === 'conta_pix' && <Check className="h-4 w-4 text-[#1E6B3A]" />}
                </label>
              </RadioGroup>
            </div>

            {/* Data do Movimento */}
            <div className="space-y-1.5 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="dataDevolucao" className="text-sm font-semibold text-[#F3EAD3]">
                  Data da Devolução *
                </Label>
                <span className="text-[11px] text-[#A8B3A6]">Data operacional</span>
              </div>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B3A6]" />
                <Input
                  id="dataDevolucao"
                  type="date"
                  required
                  value={dataMovimento}
                  onChange={(e) => setDataMovimento(e.target.value)}
                  className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
                />
              </div>
            </div>

            {/* Responsável pelo Registro */}
            <div className="flex items-center justify-between rounded-xl border border-[#26332A] bg-[#0B0F0C] px-4 py-3 text-xs text-[#A8B3A6]">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[#1E6B3A]" />
                <span>Responsável pela operação:</span>
              </div>
              <strong className="text-[#F3EAD3] font-semibold">
                {appUser?.nome} ({appUser?.username})
              </strong>
            </div>

            {/* Botão de Envio */}
            <Button
              type="submit"
              disabled={
                devolucaoMutation.isPending || valorCentavos <= 0 || excedeCredito || semCredito
              }
              className="h-16 w-full rounded-2xl bg-cyan-700 text-xl font-bold tracking-wide text-white hover:bg-cyan-600 active:scale-[0.98] shadow-lg shadow-cyan-900/25 disabled:bg-[#1C271E] disabled:text-[#6E7B70]"
            >
              {devolucaoMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  PROCESSANDO DEVOLUÇÃO...
                </>
              ) : (
                <>
                  CONCLUIR DEVOLUÇÃO DE CRÉDITO
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          {/* Modal de Confirmação */}
          <Dialog open={modalConfirmacaoAberto} onOpenChange={setModalConfirmacaoAberto}>
            <DialogContent className="border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-md">
              <DialogHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                  <RotateCcw className="h-6 w-6" />
                </div>
                <DialogTitle className="text-center text-lg font-bold text-[#F3EAD3] mt-2">
                  Confirmar Devolução de Crédito
                </DialogTitle>
                <DialogDescription className="text-center text-xs text-[#A8B3A6]">
                  A operação reduzirá o saldo de crédito e registrará a saída financeira
                  correspondente.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1C271E]">
                  <span className="text-[#A8B3A6]">Cliente:</span>
                  <strong className="text-[#F3EAD3]">{cliente.nome}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1C271E]">
                  <span className="text-[#A8B3A6]">Crédito atual:</span>
                  <span className="font-semibold text-cyan-300">
                    {formatCentavos(creditoDisponivelCentavos)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1C271E]">
                  <span className="text-[#A8B3A6]">Valor a devolver:</span>
                  <strong className="text-white">{formatCentavos(valorCentavos)}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1C271E]">
                  <span className="text-[#A8B3A6]">Forma de devolução:</span>
                  <span className="font-semibold text-[#F3EAD3]">
                    {forma === 'dinheiro' ? 'Dinheiro (Gaveta)' : 'Conta / Pix'}
                  </span>
                </div>
                <div className="flex justify-between py-1 pt-1.5 text-sm font-bold text-cyan-300">
                  <span>Crédito restante do cliente:</span>
                  <span>{formatCentavos(creditoDisponivelCentavos - valorCentavos)}</span>
                </div>
              </div>

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalConfirmacaoAberto(false)}
                  className="rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3] hover:bg-[#1A251C]"
                >
                  CANCELAR
                </Button>
                <Button
                  type="button"
                  onClick={() => devolucaoMutation.mutate()}
                  disabled={devolucaoMutation.isPending}
                  className="rounded-xl bg-cyan-700 font-bold text-white hover:bg-cyan-600"
                >
                  {devolucaoMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'CONFIRMAR DEVOLUÇÃO'
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

export default CaixaDevolucaoCreditoForm
