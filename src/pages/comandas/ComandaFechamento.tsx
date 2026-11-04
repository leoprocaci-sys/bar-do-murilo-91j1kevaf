import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, ChevronLeft, AlertTriangle, CheckCircle2 } from 'lucide-react'
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
import {
  getComanda,
  getItensComanda,
  getPagamentosComanda,
  identificacaoComandaTexto,
} from '@/services/comandas'
import { listClientes } from '@/services/fiado'
import { formatCentavos, parseBRLToCentavos } from '@/lib/formatters'
import type { FormaParcela, ParcelaFechamento } from '@/types/comandas'

const FORMAS: Array<{ forma: FormaParcela; label: string }> = [
  { forma: 'dinheiro', label: 'Dinheiro' },
  { forma: 'pix', label: 'PIX' },
  { forma: 'cartao_debito', label: 'Cartão de débito' },
  { forma: 'cartao_credito', label: 'Cartão de crédito' },
  { forma: 'fiado', label: 'Fiado' },
]

type Linha = { forma: FormaParcela; valor: string }

export const ComandaFechamento = () => {
  const { id: comandaId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [linhas, setLinhas] = useState<Linha[]>([{ forma: 'dinheiro', valor: '' }])
  const [clienteIdFiado, setClienteIdFiado] = useState('')
  const [confirmarDialog, setConfirmarDialog] = useState(false)

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
  const clientesQuery = useQuery({
    queryKey: ['clientes-fiado'],
    queryFn: () => listClientes(),
  })

  const comanda = comandaQuery.data
  const itens = (itensQuery.data ?? []).filter((i) => i.status === 'ativo')
  const pagosAnteriores = (pagamentosQuery.data ?? [])
    .filter((pg) => pg.status === 'ativo')
    .reduce((acc, pg) => acc + pg.valor_centavos, 0)

  const totalConsumido = itens.reduce((acc, i) => acc + i.subtotal_centavos, 0)
  const pendente = totalConsumido - pagosAnteriores

  const totalDistribuido = linhas.reduce((acc, l) => acc + (parseBRLToCentavos(l.valor) || 0), 0)
  const diferenca = pendente - totalDistribuido
  const temFiado = linhas.some((l) => l.forma === 'fiado' && (parseBRLToCentavos(l.valor) || 0) > 0)
  const fiadoSemCliente = temFiado && !clienteIdFiado

  const validacaoErro = (() => {
    if (pendente <= 0) return 'Não há valor pendente para receber nesta comanda.'
    for (const l of linhas) {
      const v = parseBRLToCentavos(l.valor)
      if (l.valor.trim() && v < 0) return 'Valor não pode ser negativo.'
    }
    if (totalDistribuido > pendente) return 'A soma das parcelas é maior que o valor devido.'
    if (totalDistribuido < pendente && temFiado) {
      return 'Com parcela no Fiado, 100% do valor devido deve estar distribuído (sem diferença).'
    }
    if (totalDistribuido !== pendente && !temFiado) {
      return 'A soma das parcelas deve cobrir exatamente o valor devido (ou usar Fiado).'
    }
    if (fiadoSemCliente) return 'Selecione o cliente cadastrado para a parcela no Fiado.'
    return null
  })()

  const fecharMutation = useMutation({
    mutationFn: async () => {
      const parcelas: ParcelaFechamento[] = linhas
        .map((l) => ({ forma: l.forma, valor_centavos: parseBRLToCentavos(l.valor) }))
        .filter((p) => p.valor_centavos > 0)
        .map((p) => ({ ...p, cliente_id: p.forma === 'fiado' ? clienteIdFiado : null }))
      const { fecharComanda } = await import('@/services/comandas')
      return await fecharComanda(comandaId!, parcelas)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['comanda', comandaId] })
      queryClient.invalidateQueries({ queryKey: ['comanda-itens', comandaId] })
      queryClient.invalidateQueries({ queryKey: ['comanda-pagamentos', comandaId] })
      queryClient.invalidateQueries({ queryKey: ['comandas-abertas'] })
      queryClient.invalidateQueries({ queryKey: ['caixa'] })
      queryClient.invalidateQueries({ queryKey: ['fiado'] })
      toast({
        title: 'Comanda fechada',
        description: res.idempotente
          ? 'Fechamento já registrado anteriormente (operação repetida ignorada).'
          : 'Recebimentos lançados no Caixa e dívida no Fiado quando houver.',
      })
      navigate(`/comandas/${comandaId}/fechado`)
    },
    onError: (err: any) => {
      setConfirmarDialog(false)
      toast({
        title: 'Erro no fechamento',
        description: err.message || 'Tente novamente. Nenhum lançamento parcial foi gravado.',
        variant: 'destructive',
      })
    },
  })

  if (comandaQuery.isLoading) {
    return (
      <Layout backTo={`/comandas/${comandaId}`} backLabel="COMANDA">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
        </div>
      </Layout>
    )
  }

  if (!comanda || comanda.status !== 'aberta') {
    return (
      <Layout backTo="/comandas" backLabel="COMANDAS">
        <div className="rounded-2xl border border-[#F2B705]/40 bg-[#F2B705]/10 p-6 text-center text-sm text-[#F2B705]">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8" />
          Esta comanda já foi fechada ou modificada por outro operador. Toque em VOLTAR para
          atualizar a lista e continuar com segurança.
        </div>
      </Layout>
    )
  }

  const totalPagoAgora = totalDistribuido
  const dinheiroAgora = linhas
    .filter((l) => l.forma === 'dinheiro')
    .reduce((acc, l) => acc + (parseBRLToCentavos(l.valor) || 0), 0)

  return (
    <Layout backTo={`/comandas/${comandaId}`} backLabel="COMANDA" className="pb-14">
      <header>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 text-[#A8B3A6]"
          onClick={() => navigate(`/comandas/${comandaId}`)}
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">Fechar Comanda</h1>
        <p className="text-sm text-[#A8B3A6]">{identificacaoComandaTexto(comanda)}</p>
      </header>

      <section className="mt-4 space-y-1.5 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
        <div className="flex justify-between text-sm">
          <span className="text-[#A8B3A6]">Total consumido</span>
          <span className="font-bold text-[#F3EAD3]">{formatCentavos(totalConsumido)}</span>
        </div>
        {pagosAnteriores > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-[#A8B3A6]">Já pago nesta abertura</span>
            <span className="font-bold text-[#1E6B3A]">{formatCentavos(pagosAnteriores)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-[#26332A] pt-2">
          <span className="font-bold text-[#F3EAD3]">Valor a acertar</span>
          <span className="text-2xl font-extrabold text-[#F3EAD3]">{formatCentavos(pendente)}</span>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6E7B70]">
          Recebimento (pode ser misto)
        </h2>
        <div className="space-y-2">
          {linhas.map((linha, idx) => (
            <div key={idx} className="rounded-xl border border-[#26332A] bg-[#141B15] p-3">
              <div className="flex items-center gap-2">
                <select
                  value={linha.forma}
                  onChange={(e) =>
                    setLinhas((ls) =>
                      ls.map((l, i) =>
                        i === idx ? { ...l, forma: e.target.value as FormaParcela } : l,
                      ),
                    )
                  }
                  className="h-12 flex-1 rounded-xl border border-[#26332A] bg-[#0B0F0C] px-3 text-sm font-bold text-[#F3EAD3]"
                >
                  {FORMAS.map((f) => (
                    <option key={f.forma} value={f.forma}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={linha.valor}
                  onChange={(e) =>
                    setLinhas((ls) =>
                      ls.map((l, i) => (i === idx ? { ...l, valor: e.target.value } : l)),
                    )
                  }
                  inputMode="decimal"
                  placeholder="0,00"
                  className="h-12 w-32 rounded-xl border-[#26332A] bg-[#0B0F0C] text-lg font-extrabold text-[#F3EAD3]"
                />
                {linhas.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="shrink-0 rounded-lg border-[#26332A] text-red-300"
                    onClick={() => setLinhas((ls) => ls.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-2 w-full rounded-xl border-[#26332A] bg-[#141B15] text-sm text-[#A8B3A6]"
          onClick={() => setLinhas((ls) => [...ls, { forma: 'pix', valor: '' }])}
        >
          + Adicionar parcela
        </Button>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-[#26332A] bg-[#0B0F0C] px-4 py-2.5 text-sm">
          <span className="text-[#A8B3A6]">Distribuído</span>
          <span
            className={`font-extrabold ${diferenca === 0 ? 'text-[#1E6B3A]' : 'text-[#F2B705]'}`}
          >
            {formatCentavos(totalDistribuido)} / {formatCentavos(pendente)}
          </span>
        </div>

        {temFiado && (
          <div className="mt-3 rounded-xl border border-[#F2B705]/40 bg-[#F2B705]/10 p-3">
            <Label className="text-sm font-bold text-[#F2B705]">
              Cliente do Fiado (obrigatório)
            </Label>
            <select
              value={clienteIdFiado}
              onChange={(e) => setClienteIdFiado(e.target.value)}
              className="mt-1.5 h-12 w-full rounded-xl border border-[#26332A] bg-[#0B0F0C] px-3 text-sm text-[#F3EAD3]"
            >
              <option value="">Selecione o cliente cadastrado...</option>
              {(clientesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {comanda.cliente_id && !clienteIdFiado && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-1 h-8 text-xs text-[#A8B3A6]"
                onClick={() => setClienteIdFiado(comanda.cliente_id!)}
              >
                Usar cliente vinculado à comanda
              </Button>
            )}
            {(clientesQuery.data ?? []).length === 0 && (
              <p className="mt-1.5 text-xs text-[#F2B705]">
                Nenhum cliente cadastrado. Cadastre no módulo FIADO antes de concluir a parcela no
                Fiado.
              </p>
            )}
          </div>
        )}

        <div className="mt-3 space-y-1 rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-xs text-[#A8B3A6]">
          <p>• Dinheiro movimenta a gaveta; PIX e cartões registram recebimento sem gaveta.</p>
          <p>• Parcela no Fiado gera dívida no cliente — não é dinheiro recebido.</p>
          <p>• O fechamento é atômico: ou tudo grava, ou nada grava.</p>
        </div>
      </section>

      {validacaoErro && (
        <p className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
          {validacaoErro}
        </p>
      )}

      <Button
        type="button"
        disabled={!!validacaoErro || fecharMutation.isPending}
        onClick={() => setConfirmarDialog(true)}
        className="mt-4 h-14 w-full rounded-2xl bg-[#1E6B3A] text-lg font-bold text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.98] disabled:opacity-50"
      >
        CONCLUIR FECHAMENTO
      </Button>

      {/* Confirmação */}
      <Dialog open={confirmarDialog} onOpenChange={setConfirmarDialog}>
        <DialogContent className="max-w-[420px] rounded-2xl border-[#26332A] bg-[#141B15] text-[#F3EAD3]">
          <DialogHeader>
            <DialogTitle>Confirmar fechamento</DialogTitle>
            <DialogDescription className="text-[#A8B3A6]">
              Revise as parcelas. Após confirmar, a comanda é fechada e os recebimentos entram no
              Caixa / Fiado em uma única operação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-sm">
            {linhas
              .filter((l) => (parseBRLToCentavos(l.valor) || 0) > 0)
              .map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[#A8B3A6]">
                    {FORMAS.find((f) => f.forma === l.forma)?.label}
                    {l.forma === 'fiado' ? ' (cliente selecionado)' : ''}
                  </span>
                  <span className="font-bold text-[#F3EAD3]">
                    {formatCentavos(parseBRLToCentavos(l.valor))}
                  </span>
                </div>
              ))}
            {dinheiroAgora > 0 && (
              <div className="flex justify-between border-t border-[#26332A] pt-1.5 text-xs">
                <span className="text-[#A8B3A6]">Gaveta recebe agora</span>
                <span className="font-bold text-[#1E6B3A]">{formatCentavos(dinheiroAgora)}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmarDialog(false)}
              className="rounded-xl"
            >
              Voltar
            </Button>
            <Button
              disabled={fecharMutation.isPending}
              onClick={() => fecharMutation.mutate()}
              className="rounded-xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
            >
              {fecharMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 h-4 w-4" />
              )}
              CONFIRMAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default ComandaFechamento
