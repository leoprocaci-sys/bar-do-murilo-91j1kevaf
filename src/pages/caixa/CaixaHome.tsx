import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  RotateCcw,
  History,
  FileText,
  Calendar,
  AlertCircle,
  Loader2,
  Edit3,
  TrendingUp,
} from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { getResumoCaixaDia, salvarDinheiroInicial } from '@/services/caixa'
import { formatCentavos, parseBRLToCentavos, getTodayDateInput } from '@/lib/formatters'

export const CaixaHome = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { appUser } = useAuth()
  const queryClient = useQueryClient()

  // Data operacional do Caixa
  const [dataOperacional, setDataOperacional] = useState<string>(getTodayDateInput())

  // Modal de informação / edição de dinheiro inicial
  const [modalDinheiroAberto, setModalDinheiroAberto] = useState(false)
  const [valorDinheiroInput, setValorDinheiroInput] = useState('')

  // Consulta do resumo do dia
  const {
    data: resumo,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['caixa-resumo-dia', dataOperacional],
    queryFn: () => getResumoCaixaDia(dataOperacional),
  })

  // Mutation para salvar / corrigir dinheiro inicial
  const dinheiroMutation = useMutation({
    mutationFn: async () => {
      if (!appUser?.id) throw new Error('Usuário autenticado não encontrado.')
      const centavos = parseBRLToCentavos(valorDinheiroInput)
      if (centavos < 0) {
        throw new Error('O dinheiro inicial não pode ser negativo.')
      }
      return await salvarDinheiroInicial(dataOperacional, centavos, appUser.id)
    },
    onSuccess: (res) => {
      setModalDinheiroAberto(false)
      queryClient.invalidateQueries({ queryKey: ['caixa-resumo-dia', dataOperacional] })
      toast({
        title: 'Dinheiro inicial salvo',
        description: `Fundo de gaveta definido para ${formatCentavos(res.valor_centavos)}.`,
      })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao salvar dinheiro inicial',
        description: err.message || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    },
  })

  const abrirModalDinheiroInicial = () => {
    const atual = resumo?.dinheiroInicialCentavos ?? 0
    setValorDinheiroInput(atual > 0 ? (atual / 100).toFixed(2).replace('.', ',') : '')
    setModalDinheiroAberto(true)
  }

  const handleSalvarDinheiroInicial = (e: React.FormEvent) => {
    e.preventDefault()
    dinheiroMutation.mutate()
  }

  return (
    <Layout backTo="/" backLabel="INÍCIO" className="pb-14">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1E6B3A] text-[#F3EAD3]">
              <Banknote className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#F2B705]">
                MÓDULO FINANCEIRO
              </span>
              <h1 className="text-2xl font-bold leading-tight text-[#F3EAD3]">Caixa Operacional</h1>
            </div>
          </div>
        </div>

        {/* Seletor de Data Operacional */}
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
      </header>

      {/* Alerta de Dinheiro Inicial Não Informado */}
      {resumo && !resumo.dinheiroInicialInformado && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-yellow-800/80 bg-yellow-950/30 p-3.5 text-xs text-yellow-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0" />
            <span>
              Dinheiro inicial do dia não informado (considerando <strong>R$ 0,00</strong>).
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={abrirModalDinheiroInicial}
            className="h-8 shrink-0 rounded-xl bg-yellow-500 font-bold text-[#0B0F0C] hover:bg-yellow-400"
          >
            INFORMAR
          </Button>
        </div>
      )}

      {/* Indicadores Principais */}
      {isLoading ? (
        <div className="mt-8 flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
          <p className="mt-3 text-sm text-[#A8B3A6]">Calculando posição operacional do dia...</p>
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-4 text-center text-sm text-red-200">
          Não foi possível carregar a posição do Caixa.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* 1. DINHEIRO EM CAIXA (Destaque Principal) */}
          <div className="relative overflow-hidden rounded-[24px] border border-[#26332A] bg-gradient-to-br from-[#141B15] via-[#101712] to-[#0D130E] p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#F2B705]">
                  INDICADOR PRINCIPAL • FÍSICO
                </span>
                <h2 className="text-base font-bold text-[#F3EAD3]">DINHEIRO EM CAIXA</h2>
                <p className="text-xs font-semibold text-[#A8B3A6] mt-0.5">
                  SALDO ESPERADO NA GAVETA
                </p>
              </div>
              <button
                type="button"
                onClick={abrirModalDinheiroInicial}
                className="flex items-center gap-1 rounded-xl border border-[#26332A] bg-[#0B0F0C] px-2.5 py-1 text-[11px] font-semibold text-[#A8B3A6] hover:border-[#1E6B3A] hover:text-[#F3EAD3]"
                title="Editar ou informar dinheiro inicial"
              >
                <Edit3 className="h-3.5 w-3.5 text-[#1E6B3A]" />
                <span>Inicial: {formatCentavos(resumo?.dinheiroInicialCentavos ?? 0)}</span>
              </button>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-[#F3EAD3]">
                {formatCentavos(resumo?.dinheiroEmCaixaCentavos ?? 0)}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#26332A]/80 bg-[#0B0F0C]/70 px-3 py-2 text-[11px] text-[#A8B3A6]">
              <span className="font-semibold text-yellow-300">VALOR CALCULADO:</span>
              <span>
                Entradas em dinheiro (+{formatCentavos(resumo?.entradasFisicasCentavos.total ?? 0)})
                − Saídas da gaveta (−{formatCentavos(resumo?.saidasFisicasCentavos.total ?? 0)}).
                Não substitui conferência física das notas.
              </span>
            </div>
          </div>

          {/* Grid de 3 Indicadores Secundários */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 2. VENDAS E CONSUMOS */}
            <div className="rounded-2xl border border-[#26332A] bg-[#141B15] p-4 text-left">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#1E6B3A]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A8B3A6]">
                  VENDAS E CONSUMOS
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-[#F3EAD3]">
                {formatCentavos(resumo?.vendasEConsumosCentavos ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-[#6E7B70]">
                Diretas + Fiadas + Retiradas mercadoria
              </p>
            </div>

            {/* 3. SAÍDAS EM DINHEIRO / CONTA */}
            <div className="rounded-2xl border border-[#26332A] bg-[#141B15] p-4 text-left">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-red-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A8B3A6]">
                  SAÍDAS EM DINHEIRO / CONTA
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-red-300">
                {formatCentavos(resumo?.saidasDinheiroContaCentavos ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-[#6E7B70]">Gaveta + Conta/Pix + Devoluções</p>
            </div>

            {/* 4. RETIRADAS EM MERCADORIA */}
            <div className="rounded-2xl border border-[#26332A] bg-[#141B15] p-4 text-left">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-[#F2B705]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A8B3A6]">
                  RETIRADAS MERCADORIA
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-yellow-300">
                {formatCentavos(resumo?.retiradasMercadoriaCentavos ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-[#6E7B70]">Consumo próprio dos responsáveis</p>
            </div>
          </div>
        </div>
      )}

      {/* Botões de Ações Operacionais */}
      <nav className="mt-6 space-y-3" aria-label="Ações do Caixa">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            type="button"
            className="h-16 justify-start rounded-2xl bg-[#1E6B3A] px-5 text-base font-bold tracking-wide text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.98] shadow-md shadow-[#1E6B3A]/20"
            onClick={() => navigate(`/caixa/venda?data=${dataOperacional}`)}
          >
            <ArrowDownRight className="mr-3 h-6 w-6 text-[#F2B705]" />
            REGISTRAR VENDA DIRETA
          </Button>

          <Button
            type="button"
            className="h-16 justify-start rounded-2xl border border-[#26332A] bg-[#141B15] px-5 text-base font-bold tracking-wide text-[#F3EAD3] hover:bg-[#1C271E] active:scale-[0.98]"
            onClick={() => navigate(`/caixa/saida?data=${dataOperacional}`)}
          >
            <ArrowUpRight className="mr-3 h-6 w-6 text-red-400" />
            REGISTRAR SAÍDA
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-14 justify-start rounded-2xl border-[#26332A] bg-[#141B15] px-4 text-sm font-bold text-[#F3EAD3] hover:bg-[#1C271E] active:scale-[0.98]"
            onClick={() => navigate(`/caixa/retirada?data=${dataOperacional}`)}
          >
            <ShoppingBag className="mr-3 h-5 w-5 text-[#F2B705]" />
            RETIRADA EM MERCADORIA
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-14 justify-start rounded-2xl border-[#26332A] bg-[#141B15] px-4 text-sm font-bold text-[#F3EAD3] hover:bg-[#1C271E] active:scale-[0.98]"
            onClick={() => navigate(`/caixa/devolucao-credito?data=${dataOperacional}`)}
          >
            <RotateCcw className="mr-3 h-5 w-5 text-cyan-400" />
            DEVOLVER CRÉDITO AO CLIENTE
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="h-14 justify-start rounded-2xl border border-[#26332A] bg-[#0B0F0C] px-4 text-sm font-bold text-[#F3EAD3] hover:bg-[#141B15]"
            onClick={() => navigate(`/caixa/movimentacao?data=${dataOperacional}`)}
          >
            <History className="mr-3 h-5 w-5 text-[#1E6B3A]" />
            MOVIMENTAÇÃO DO DIA
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="h-14 justify-start rounded-2xl border border-[#26332A] bg-[#0B0F0C] px-4 text-sm font-bold text-[#F3EAD3] hover:bg-[#141B15]"
            onClick={() => navigate(`/caixa/relatorios?data=${dataOperacional}`)}
          >
            <FileText className="mr-3 h-5 w-5 text-[#F2B705]" />
            RELATÓRIOS & CONSUMO
          </Button>
        </div>
      </nav>

      {/* Modal de Dinheiro Inicial */}
      <Dialog open={modalDinheiroAberto} onOpenChange={setModalDinheiroAberto}>
        <DialogContent className="border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-md">
          <form onSubmit={handleSalvarDinheiroInicial}>
            <DialogHeader>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E6B3A]/20 text-[#1E6B3A] border border-[#1E6B3A]/40">
                <Banknote className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center text-lg font-bold text-[#F3EAD3] mt-2">
                Dinheiro Inicial do Dia
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-[#A8B3A6]">
                Fundo de gaveta disponível no início do expediente ({dataOperacional}).
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 space-y-3">
              <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-xs text-[#A8B3A6]">
                <p>
                  • <strong>Não é venda</strong> e <strong>não é receita</strong>.
                </p>
                <p className="mt-1">
                  • Saldo do dia anterior <strong>não é transportado</strong> automaticamente.
                </p>
                <p className="mt-1">
                  • Se nenhum valor for informado, o padrão é <strong>R$ 0,00</strong>.
                </p>
              </div>

              <div>
                <Label htmlFor="valorDinheiroInicial" className="text-xs font-bold text-[#F3EAD3]">
                  Valor do Dinheiro Inicial (R$) *
                </Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-[#1E6B3A]">
                    R$
                  </span>
                  <Input
                    id="valorDinheiroInicial"
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    required
                    value={valorDinheiroInput}
                    onChange={(e) => setValorDinheiroInput(e.target.value)}
                    placeholder="0,00"
                    className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-11 text-xl font-bold text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalDinheiroAberto(false)}
                className="rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3] hover:bg-[#1A251C]"
              >
                CANCELAR
              </Button>
              <Button
                type="submit"
                disabled={dinheiroMutation.isPending}
                className="rounded-xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
              >
                {dinheiroMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'SALVAR DINHEIRO INICIAL'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default CaixaHome
