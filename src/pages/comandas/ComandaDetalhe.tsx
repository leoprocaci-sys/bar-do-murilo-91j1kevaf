import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Minus, Loader2, Receipt, Pencil, X, AlertTriangle, Tag } from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
  getComanda,
  getItensComanda,
  getPagamentosComanda,
  lancarItemComanda,
  cancelarItemComanda,
  alterarPrecoExcepcionalItem,
  identificacaoComandaTexto,
} from '@/services/comandas'
import { listProdutos } from '@/services/produtos'
import { listClientes } from '@/services/fiado'
import { formatCentavos, parseBRLToCentavos, formatDateTimeBR } from '@/lib/formatters'
import type { Produto } from '@/types/comandas'
import type { Cliente } from '@/types/fiado'

const ProdutoPicker = ({ onSelect }: { onSelect: (p: Produto) => void }) => {
  const [busca, setBusca] = useState('')
  const { data: produtos = [], isFetching } = useQuery({
    queryKey: ['produtos-ativos'],
    queryFn: () => listProdutos(undefined, false),
  })

  const termo = busca.trim().toLowerCase()
  const filtrados = useMemo(() => {
    if (!termo) return produtos
    return produtos.filter(
      (p) => p.nome.toLowerCase().includes(termo) || p.categoria.toLowerCase().includes(termo),
    )
  }, [produtos, termo])

  return (
    <div className="rounded-2xl border border-[#26332A] bg-[#141B15] p-3">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B3A6]" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar produto para lançar..."
          className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-[#F3EAD3]"
        />
      </div>
      {isFetching && (
        <div className="mt-2 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-[#1E6B3A]" />
        </div>
      )}
      <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
        {filtrados.length === 0 && (
          <p className="py-4 text-center text-sm text-[#A8B3A6]">
            {termo
              ? 'Nenhum produto encontrado. Cadastre-o em PRODUTOS.'
              : 'Cadastre produtos em PRODUTOS para lançar aqui.'}
          </p>
        )}
        {filtrados.map((p) => (
          <button
            key={p.id}
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-[#26332A] bg-[#0B0F0C] px-3 py-2.5 text-left active:scale-[0.98]"
            onClick={() => onSelect(p)}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#F3EAD3]">{p.nome}</p>
              <p className="text-[11px] text-[#A8B3A6]">{p.categoria}</p>
            </div>
            <span className="ml-2 shrink-0 font-extrabold text-[#1E6B3A]">
              {formatCentavos(p.preco_atual_centavos)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export const ComandaDetalhe = () => {
  const params = useParams<{ id: string }>()
  const comandaId = params.id!
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [produtoSel, setProdutoSel] = useState<Produto | null>(null)
  const [quantidade, setQuantidade] = useState(1)

  const [itemParaCancelar, setItemParaCancelar] = useState<string | null>(null)
  const [itemParaPreco, setItemParaPreco] = useState<string | null>(null)
  const [novoPrecoInput, setNovoPrecoInput] = useState('')
  const [justificativa, setJustificativa] = useState('')

  const comandaQuery = useQuery({
    queryKey: ['comanda', comandaId],
    queryFn: () => getComanda(comandaId),
  })
  const itensQuery = useQuery({
    queryKey: ['comanda-itens', comandaId],
    queryFn: () => getItensComanda(comandaId),
  })
  const pagamentosQuery = useQuery({
    queryKey: ['comanda-pagamentos', comandaId],
    queryFn: () => getPagamentosComanda(comandaId),
  })

  const comanda = comandaQuery.data
  const itens = (itensQuery.data ?? []).filter((i) => i.status === 'ativo')
  const totalCentavos = itens.reduce((acc, i) => acc + i.subtotal_centavos, 0)

  const lancarMutation = useMutation({
    mutationFn: async () => {
      if (!produtoSel) throw new Error('Selecione um produto.')
      return await lancarItemComanda(comandaId, produtoSel.id, quantidade)
    },
    onSuccess: (res) => {
      if (res.idempotente) {
        toast({
          title: 'Item já registrado',
          description: 'Operação repetida ignorada com segurança.',
        })
      } else {
        toast({
          title: 'Item lançado',
          description: `${res.produto_nome} — ${formatCentavos(res.subtotal_centavos ?? 0)}`,
        })
      }
      setProdutoSel(null)
      setQuantidade(1)
      queryClient.invalidateQueries({ queryKey: ['comanda-itens', comandaId] })
      queryClient.invalidateQueries({ queryKey: ['comandas-abertas'] })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao lançar item',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    },
  })

  const cancelarItemMutation = useMutation({
    mutationFn: (itemId: string) => cancelarItemComanda(itemId, 'Cancelado pelo operador'),
    onSuccess: () => {
      toast({ title: 'Item cancelado' })
      setItemParaCancelar(null)
      queryClient.invalidateQueries({ queryKey: ['comanda-itens', comandaId] })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao cancelar item',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    },
  })

  const precoExcepcionalMutation = useMutation({
    mutationFn: async () => {
      const centavos = parseBRLToCentavos(novoPrecoInput)
      if (!justificativa.trim()) throw new Error('A justificativa é obrigatória.')
      if (centavos < 0) throw new Error('Preço não pode ser negativo.')
      return await alterarPrecoExcepcionalItem(itemParaPreco!, centavos, justificativa)
    },
    onSuccess: (res) => {
      toast({
        title: 'Preço alterado com registro',
        description: `De ${formatCentavos(res.preco_anterior_centavos)} para ${formatCentavos(res.preco_novo_centavos)} — justificativa registrada no histórico.`,
      })
      setItemParaPreco(null)
      setNovoPrecoInput('')
      setJustificativa('')
      queryClient.invalidateQueries({ queryKey: ['comanda-itens', comandaId] })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro na alteração de preço',
        description: err.message || 'Tente novamente.',
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

  if (comanda.status === 'fechada') {
    return (
      <Layout backTo="/comandas" backLabel="COMANDAS">
        <div className="rounded-2xl border border-[#26332A] bg-[#141B15] p-6 text-center">
          <Receipt className="mx-auto h-10 w-10 text-[#1E6B3A]" />
          <h2 className="mt-3 text-lg font-bold text-[#F3EAD3]">
            {identificacaoComandaTexto(comanda)}
          </h2>
          <p className="mt-1 text-sm text-[#A8B3A6]">
            Comanda já fechada em {formatDateTimeBR(comanda.data_fechamento)}.
          </p>
          <Button
            type="button"
            className="mt-5 w-full rounded-xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
            onClick={() => navigate('/comandas')}
          >
            VOLTAR PARA COMANDAS
          </Button>
        </div>
      </Layout>
    )
  }

  const totalPago = (pagamentosQuery.data ?? [])
    .filter((pg) => pg.status === 'ativo')
    .reduce((acc, pg) => acc + pg.valor_centavos, 0)

  return (
    <Layout backTo="/comandas" backLabel="COMANDAS" className="pb-14">
      <header>
        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight text-[#F3EAD3]">
            {identificacaoComandaTexto(comanda)}
          </h1>
          <Badge className="shrink-0 bg-[#1E6B3A] text-[10px] text-[#F3EAD3]">ABERTA</Badge>
        </div>
        <p className="text-xs text-[#A8B3A6]">
          Comanda nº {comanda.numero} · aberta às {formatDateTimeBR(comanda.data_abertura)}
        </p>
      </header>

      {/* Lançamento rápido */}
      <section className="mt-4">
        <ProdutoPicker onSelect={(p) => setProdutoSel(p)} />
        {produtoSel && (
          <div className="mt-3 rounded-2xl border border-[#1E6B3A] bg-[#1C271E] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold text-[#F3EAD3]">{produtoSel.nome}</p>
                <p className="text-xs text-[#A8B3A6]">
                  {formatCentavos(produtoSel.preco_atual_centavos)} cada · o sistema calcula o valor
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0 text-[#A8B3A6]"
                onClick={() => setProdutoSel(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-12 w-12 shrink-0 rounded-xl border-[#26332A]"
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                disabled={quantidade <= 1}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <div className="flex-1 text-center">
                <p className="text-3xl font-extrabold text-[#F3EAD3]">{quantidade}</p>
                <p className="text-[11px] text-[#A8B3A6]">
                  Total: {formatCentavos(produtoSel.preco_atual_centavos * quantidade)}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-12 w-12 shrink-0 rounded-xl border-[#26332A]"
                onClick={() => setQuantidade((q) => q + 1)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <Button
              type="button"
              disabled={lancarMutation.isPending}
              onClick={() => lancarMutation.mutate()}
              className="mt-3 h-14 w-full rounded-xl bg-[#1E6B3A] text-lg font-bold text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.98]"
            >
              {lancarMutation.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Plus className="mr-2 h-5 w-5" />
              )}
              ADICIONAR
            </Button>
          </div>
        )}
      </section>

      {/* Itens lançados */}
      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6E7B70]">
          Itens da comanda
        </h2>
        {itens.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#26332A] p-4 text-center text-sm text-[#A8B3A6]">
            Nenhum item lançado ainda.
          </p>
        )}
        <div className="space-y-2">
          {itens.map((item) => (
            <div key={item.id} className="rounded-xl border border-[#26332A] bg-[#141B15] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-[#F3EAD3]">{item.produto_nome}</p>
                    {item.preco_excepcional && (
                      <Badge className="bg-[#F2B705] text-[10px] text-black">
                        <Tag className="mr-1 h-3 w-3" /> preço excepcional
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#A8B3A6]">
                    {item.quantidade} × {formatCentavos(item.preco_unitario_centavos)}
                    {item.justificativa_excecao ? ` · ${item.justificativa_excecao}` : ''}
                  </p>
                </div>
                <p className="shrink-0 font-extrabold text-[#F3EAD3]">
                  {formatCentavos(item.subtotal_centavos)}
                </p>
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg border-[#26332A] text-xs"
                  onClick={() => {
                    setItemParaPreco(item.id)
                    setNovoPrecoInput(
                      (item.preco_unitario_centavos / 100).toFixed(2).replace('.', ','),
                    )
                    setJustificativa('')
                  }}
                >
                  <Pencil className="mr-1 h-3 w-3" /> Preço
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg border-[#26332A] text-xs text-red-300"
                  onClick={() => setItemParaCancelar(item.id)}
                >
                  <X className="mr-1 h-3 w-3" /> Cancelar item
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Total e ações */}
      <section className="mt-5 space-y-3">
        <div className="flex items-center justify-between rounded-2xl border border-[#1E6B3A] bg-[#1C271E] px-4 py-3">
          <span className="text-sm font-bold text-[#A8B3A6]">Total consumido</span>
          <span className="text-2xl font-extrabold text-[#F3EAD3]">
            {formatCentavos(totalCentavos)}
          </span>
        </div>
        {totalPago > 0 && (
          <p className="text-center text-xs text-[#A8B3A6]">
            Pagamentos anteriores nesta abertura: {formatCentavos(totalPago)}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-14 rounded-2xl border-[#26332A] bg-[#141B15] font-bold text-[#F3EAD3] hover:bg-[#1A251C]"
            onClick={() => navigate(`/comandas/${comandaId}/previa`)}
          >
            <Receipt className="mr-2 h-5 w-5" /> PRÉVIA
          </Button>
          <Button
            type="button"
            className="h-14 rounded-2xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.98]"
            onClick={() => navigate(`/comandas/${comandaId}/fechamento`)}
            disabled={totalCentavos <= 0}
          >
            FECHAR COMANDA
          </Button>
        </div>
        <p className="text-center text-xs text-[#A8B3A6]">
          A comanda continua aberta para novos consumos.
        </p>
      </section>

      {/* Cancelar item */}
      <Dialog open={!!itemParaCancelar} onOpenChange={(o) => !o && setItemParaCancelar(null)}>
        <DialogContent className="max-w-[400px] rounded-2xl border-[#26332A] bg-[#141B15] text-[#F3EAD3]">
          <DialogHeader>
            <DialogTitle>Cancelar item?</DialogTitle>
            <DialogDescription className="text-[#A8B3A6]">
              O item sai do total da comanda. O registro permanece no histórico (cancelamento
              lógico, nada é apagado).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setItemParaCancelar(null)}
              className="rounded-xl"
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={cancelarItemMutation.isPending}
              onClick={() => cancelarItemMutation.mutate(itemParaCancelar!)}
              className="rounded-xl"
            >
              {cancelarItemMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              CANCELAR ITEM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preço excepcional */}
      <Dialog
        open={!!itemParaPreco}
        onOpenChange={(o) => {
          if (!o) {
            setItemParaPreco(null)
            setNovoPrecoInput('')
            setJustificativa('')
          }
        }}
      >
        <DialogContent className="max-w-[420px] rounded-2xl border-[#26332A] bg-[#141B15] text-[#F3EAD3]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#F2B705]" /> Alteração excepcional de preço
            </DialogTitle>
            <DialogDescription className="text-[#A8B3A6]">
              Correção excepcional deste item. Confirmação + justificativa obrigatória; a operação
              fica registrada no histórico (antes/depois, operador e data/hora). O preço do cadastro
              não é alterado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-bold">Novo preço unitário (R$)</Label>
              <Input
                value={novoPrecoInput}
                onChange={(e) => setNovoPrecoInput(e.target.value)}
                inputMode="decimal"
                className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] text-xl font-extrabold text-[#F3EAD3]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-bold">Justificativa *</Label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Ex.: cliente pediu dose dupla com preço promocional combinado"
                className="min-h-20 rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setItemParaPreco(null)} className="rounded-xl">
              Voltar
            </Button>
            <Button
              disabled={precoExcepcionalMutation.isPending || !justificativa.trim()}
              onClick={() => precoExcepcionalMutation.mutate()}
              className="rounded-xl bg-[#F2B705] font-bold text-black hover:bg-[#d9a504]"
            >
              {precoExcepcionalMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              CONFIRMAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default ComandaDetalhe
