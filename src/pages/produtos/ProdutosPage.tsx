import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Package, Plus, Pencil, Power, Loader2, Check, X } from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { listProdutos, createProduto, updateProduto, setProdutoAtivo } from '@/services/produtos'
import type { Produto } from '@/types/comandas'
import { formatCentavos, parseBRLToCentavos } from '@/lib/formatters'

const CATEGORIAS_SUGERIDAS = ['Bebidas', 'Cervejas', 'Destilados', 'Petiscos', 'Diversos']

const ProdutoFormDialog = ({
  aberto,
  produto,
  onClose,
}: {
  aberto: boolean
  produto: Produto | null
  onClose: () => void
}) => {
  const { toast } = useToast()
  const { appUser } = useAuth()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState(produto?.nome ?? '')
  const [categoria, setCategoria] = useState(produto?.categoria ?? 'Diversos')
  const [precoInput, setPrecoInput] = useState(
    produto ? (produto.preco_atual_centavos / 100).toFixed(2).replace('.', ',') : '',
  )

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!appUser?.id) throw new Error('Usuário autenticado não encontrado.')
      const centavos = parseBRLToCentavos(precoInput)
      if (!nome.trim()) throw new Error('Informe o nome do produto.')
      if (centavos <= 0) throw new Error('Informe um preço maior que zero.')
      if (produto) {
        return await updateProduto(
          produto.id,
          {
            nome: nome.trim(),
            categoria: categoria.trim() || 'Diversos',
            preco_centavos: centavos,
          },
          appUser.id,
        )
      }
      return await createProduto(
        { nome: nome.trim(), categoria: categoria.trim() || 'Diversos', preco_centavos: centavos },
        appUser.id,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      toast({
        title: produto ? 'Produto atualizado' : 'Produto cadastrado',
        description: produto
          ? 'Itens já lançados nas comandas mantêm o preço com que foram registrados.'
          : 'Pronto para lançar nas comandas.',
      })
      onClose()
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao salvar produto',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    },
  })

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[440px] rounded-2xl border-[#26332A] bg-[#141B15] text-[#F3EAD3]">
        <DialogHeader>
          <DialogTitle>{produto ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          <DialogDescription className="text-[#A8B3A6]">
            {produto
              ? 'A mudança de preço vale para os próximos lançamentos; itens já lançados mantêm o preço com que foram registrados.'
              : 'Cadastre o produto com o preço atual do balcão.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Nome *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Cerveja long neck"
              className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Categoria</Label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              list="categorias-sugeridas"
              placeholder="Ex.: Cervejas"
              className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3]"
            />
            <datalist id="categorias-sugeridas">
              {CATEGORIAS_SUGERIDAS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Preço atual (R$) *</Label>
            <Input
              value={precoInput}
              onChange={(e) => setPrecoInput(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="h-14 rounded-xl border-[#26332A] bg-[#0B0F0C] text-2xl font-extrabold text-[#F3EAD3]"
            />
            <p className="text-xs text-[#A8B3A6]">
              {produto
                ? 'Preço no cadastro (válido para novos lançamentos).'
                : 'Preço inicial do produto.'}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
            <X className="mr-1 h-4 w-4" /> Cancelar
          </Button>
          <Button
            type="button"
            disabled={salvarMutation.isPending}
            onClick={() => salvarMutation.mutate()}
            className="rounded-xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
          >
            {salvarMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1 h-4 w-4" />
            )}
            SALVAR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const ProdutosPage = () => {
  const navigate = useNavigate()
  const params = useParams()
  const { toast } = useToast()
  const { appUser } = useAuth()
  const queryClient = useQueryClient()

  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null)

  const {
    data: produtos = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['produtos', mostrarInativos],
    queryFn: () => listProdutos(undefined, mostrarInativos),
  })

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return produtos
    return produtos.filter(
      (p) => p.nome.toLowerCase().includes(termo) || p.categoria.toLowerCase().includes(termo),
    )
  }, [produtos, busca])

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, Produto[]>()
    for (const p of filtrados) {
      const lista = mapa.get(p.categoria) ?? []
      lista.push(p)
      mapa.set(p.categoria, lista)
    }
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtrados])

  const ativarInativarMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      if (!appUser?.id) throw new Error('Usuário autenticado não encontrado.')
      return await setProdutoAtivo(id, ativo, appUser.id)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] })
      toast({
        title: res.ativo ? 'Produto ativado' : 'Produto inativado',
        description: res.ativo
          ? 'Volta a aparecer como opção nas comandas.'
          : 'Deixa de aparecer como opção para novos lançamentos; permanece nos históricos.',
      })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    },
  })

  return (
    <Layout backTo="/" backLabel="INÍCIO" className="pb-14">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">Produtos</h1>
        <p className="text-sm text-[#A8B3A6]">Cadastro e preços do balcão</p>
      </header>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B3A6]" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar produto..."
            className="h-12 rounded-xl border-[#26332A] bg-[#141B15] pl-10 text-[#F3EAD3]"
          />
        </div>
        <Button
          type="button"
          onClick={() => {
            setProdutoEditando(null)
            setFormAberto(true)
          }}
          className="h-12 shrink-0 rounded-xl bg-[#1E6B3A] px-4 font-bold text-[#F3EAD3] hover:bg-[#25814A]"
        >
          <Plus className="mr-1 h-5 w-5" /> NOVO
        </Button>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-[#A8B3A6]">
        <input
          type="checkbox"
          checked={mostrarInativos}
          onChange={(e) => setMostrarInativos(e.target.checked)}
          className="h-4 w-4 accent-[#1E6B3A]"
        />
        Mostrar inativos
      </label>

      {isLoading && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
          Erro ao carregar produtos. Tente novamente.
        </div>
      )}

      {!isLoading && !error && porCategoria.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-[#26332A] p-8 text-center">
          <Package className="mx-auto h-10 w-10 text-[#334637]" />
          <p className="mt-3 text-sm text-[#A8B3A6]">
            Nenhum produto encontrado. Toque em NOVO para cadastrar o primeiro.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-5">
        {porCategoria.map(([categoria, lista]) => (
          <section key={categoria}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6E7B70]">
              {categoria}
            </h2>
            <div className="space-y-2">
              {lista.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-xl border border-[#26332A] bg-[#141B15] p-3 ${
                    p.ativo ? '' : 'opacity-55'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold text-[#F3EAD3]">{p.nome}</p>
                      {!p.ativo && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-[#26332A] text-[10px] text-[#A8B3A6]"
                        >
                          inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-lg font-extrabold text-[#1E6B3A]">
                      {formatCentavos(p.preco_atual_centavos)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="shrink-0 rounded-lg border-[#26332A]"
                    onClick={() => {
                      setProdutoEditando(p)
                      setFormAberto(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="shrink-0 rounded-lg border-[#26332A]"
                    disabled={ativarInativarMutation.isPending}
                    onClick={() => ativarInativarMutation.mutate({ id: p.id, ativo: !p.ativo })}
                  >
                    <Power className={`h-4 w-4 ${p.ativo ? 'text-[#F2B705]' : 'text-[#1E6B3A]'}`} />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <ProdutoFormDialog
        key={produtoEditando?.id ?? 'novo'}
        aberto={formAberto}
        produto={produtoEditando}
        onClose={() => setFormAberto(false)}
      />
    </Layout>
  )
}

export default ProdutosPage
