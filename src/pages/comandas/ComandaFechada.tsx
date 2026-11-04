import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, CheckCircle2, Undo2, Ban, AlertTriangle } from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
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
  getComanda,
  getItensComanda,
  getPagamentosComanda,
  cancelarFechamentoComanda,
  identificacaoComandaTexto,
} from '@/services/comandas'
import { formatCentavos, formatDateTimeBR } from '@/lib/formatters'

export const ComandaFechada = () => {
  const { id: comandaId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [confirmar, setConfirmar] = useState(false)

  const comandaQuery = useQuery({
    queryKey: ['comanda', comandaId],
    queryFn: () => getComanda(comandaId!),
  })
  const itensQuery = useQuery({
    queryKey: ['comanda-itens', comandaId],
    queryFn: () => getItensComanda(comandaId!),
  })
  const pagamentosQuery = useQuery({
    queryKey: ['comanda-pagamentos', comandaId],
    queryFn: () => getPagamentosComanda(comandaId!),
  })

  const comanda = comandaQuery.data
  const itens = (itensQuery.data ?? []).filter((i) => i.status === 'ativo')
  const pagamentos = (pagamentosQuery.data ?? []).filter((p) => p.status === 'ativo')
  const total = itens.reduce((acc, i) => acc + i.subtotal_centavos, 0)
  const fiadoTotal = pagamentos
    .filter((p) => p.forma === 'fiado')
    .reduce((acc, p) => acc + p.valor_centavos, 0)

  const cancelarMutation = useMutation({
    mutationFn: () => cancelarFechamentoComanda(comandaId!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['comanda', comandaId] })
      queryClient.invalidateQueries({ queryKey: ['comanda-itens', comandaId] })
      queryClient.invalidateQueries({ queryKey: ['comanda-pagamentos', comandaId] })
      queryClient.invalidateQueries({ queryKey: ['comandas-abertas'] })
      queryClient.invalidateQueries({ queryKey: ['caixa'] })
      queryClient.invalidateQueries({ queryKey: ['fiado'] })
      toast({ title: 'Fechamento cancelado', description: res.motivo })
      navigate(`/comandas/${comandaId}`)
    },
    onError: (err: any) => {
      setConfirmar(false)
      toast({
        title: 'Cancelamento bloqueado',
        description: err.message || 'Regularize pelo módulo FIADO antes de cancelar.',
        variant: 'destructive',
      })
    },
  })

  if (comandaQuery.isLoading) {
    return (
      <Layout backTo="/comandas" backLabel="COMANDAS">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
        </div>
      </Layout>
    )
  }

  if (!comanda) {
    return (
      <Layout backTo="/comandas" backLabel="COMANDAS">
        <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-6 text-center text-sm text-red-300">
          Comanda não encontrada.
        </div>
      </Layout>
    )
  }

  return (
    <Layout backTo="/comandas" backLabel="COMANDAS" className="pb-14">
      <header className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#1E6B3A]" />
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#F3EAD3]">Comanda fechada</h1>
        <p className="text-sm text-[#A8B3A6]">{identificacaoComandaTexto(comanda)}</p>
        <p className="text-xs text-[#A8B3A6]">
          Fechada às {formatDateTimeBR(comanda.data_fechamento)}
        </p>
      </header>

      <section className="mt-5 space-y-2 rounded-2xl border border-[#26332A] bg-[#141B15] p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-[#A8B3A6]">Total consumido</span>
          <span className="font-bold text-[#F3EAD3]">{formatCentavos(total)}</span>
        </div>
        {pagamentos.map((p) => (
          <div key={p.id} className="flex justify-between">
            <span className="text-[#A8B3A6]">
              {p.forma === 'fiado' ? 'Fiado (cliente)' : p.forma}
            </span>
            <span className="font-bold text-[#1E6B3A]">{formatCentavos(p.valor_centavos)}</span>
          </div>
        ))}
        {fiadoTotal > 0 && (
          <p className="pt-1 text-xs text-[#A8B3A6]">
            A parcela no Fiado ficou registrada na ficha do cliente. A quitação segue pelo módulo
            FIADO, como de costume.
          </p>
        )}
      </section>

      <div className="mt-5 space-y-3">
        <Button
          type="button"
          className="h-14 w-full rounded-2xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
          onClick={() => navigate('/comandas')}
        >
          VOLTAR PARA COMANDAS
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full rounded-xl border-[#26332A] bg-[#141B15] text-sm text-[#F2B705] hover:bg-[#1A251C]"
          onClick={() => setConfirmar(true)}
        >
          <Undo2 className="mr-2 h-4 w-4" /> CANCELAR FECHAMENTO
        </Button>
        <p className="text-center text-xs text-[#A8B3A6]">
          O cancelamento reverte os lançamentos gerados pelo fechamento. Se a dívida do Fiado já
          recebeu pagamento, o cancelamento é bloqueado — regularize pelo módulo FIADO.
        </p>
      </div>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent className="max-w-[420px] rounded-2xl border-[#26332A] bg-[#141B15] text-[#F3EAD3]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#F2B705]" /> Cancelar fechamento?
            </DialogTitle>
            <DialogDescription className="text-[#A8B3A6]">
              A comanda volta a ficar aberta e os lançamentos gerados pelo fechamento são revertidos
              (venda(s) direta(s) no Caixa e, se houver, a dívida no Fiado — desde que ainda sem
              pagamento). Nada é apagado fisicamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmar(false)} className="rounded-xl">
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={cancelarMutation.isPending}
              onClick={() => cancelarMutation.mutate()}
              className="rounded-xl"
            >
              {cancelarMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-1 h-4 w-4" />
              )}
              CANCELAR FECHAMENTO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default ComandaFechada
