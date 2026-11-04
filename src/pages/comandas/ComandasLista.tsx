import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus, Loader2, ChevronRight, Clock, Archive } from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import {
  listComandasAbertas,
  listComandasFechadasRecentes,
  abrirComanda,
  identificacaoComandaTexto,
} from '@/services/comandas'
import { formatDateTimeBR } from '@/lib/formatters'

export const ComandasLista = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { appUser } = useAuth()
  const queryClient = useQueryClient()

  const [modalNova, setModalNova] = useState(false)
  const [nome, setNome] = useState('')
  const [mesa, setMesa] = useState('')
  const [localRef, setLocalRef] = useState('')

  const abertasQuery = useQuery({
    queryKey: ['comandas-abertas'],
    queryFn: listComandasAbertas,
    refetchInterval: 20_000,
  })

  const fechadasQuery = useQuery({
    queryKey: ['comandas-fechadas-recentes'],
    queryFn: listComandasFechadasRecentes,
  })

  const abrirMutation = useMutation({
    mutationFn: async () => {
      if (!appUser?.id) throw new Error('Usuário autenticado não encontrado.')
      if (!nome.trim() && !mesa.trim()) {
        throw new Error('Informe ao menos o nome do cliente ou a mesa.')
      }
      return await abrirComanda(
        {
          identificacao: nome.trim() || null,
          mesa: mesa.trim() || null,
          local_referencia: localRef.trim() || null,
        },
        appUser.id,
      )
    },
    onSuccess: (comanda) => {
      queryClient.invalidateQueries({ queryKey: ['comandas-abertas'] })
      setModalNova(false)
      setNome('')
      setMesa('')
      setLocalRef('')
      toast({ title: `Comanda ${comanda.numero} aberta`, description: 'Lance o primeiro consumo.' })
      navigate(`/comandas/${comanda.id}`)
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao abrir comanda',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    },
  })

  const abertas = abertasQuery.data ?? []
  const fechadas = fechadasQuery.data ?? []

  return (
    <Layout backTo="/" backLabel="INÍCIO" className="pb-14">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">Comandas</h1>
        <p className="text-sm text-[#A8B3A6]">Mesas e clientes no consumo</p>
      </header>

      <Button
        type="button"
        onClick={() => setModalNova(true)}
        className="mt-4 h-14 w-full rounded-2xl bg-[#1E6B3A] text-lg font-bold text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.98]"
      >
        <Plus className="mr-2 h-6 w-6" /> NOVA COMANDA
      </Button>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6E7B70]">
          Abertas ({abertas.length})
        </h2>

        {abertasQuery.isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-7 w-7 animate-spin text-[#1E6B3A]" />
          </div>
        )}

        {!abertasQuery.isLoading && abertas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#26332A] p-8 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-[#334637]" />
            <p className="mt-3 text-sm text-[#A8B3A6]">Nenhuma comanda aberta agora.</p>
          </div>
        )}

        <div className="space-y-2">
          {abertas.map((c) => (
            <Button
              key={c.id}
              type="button"
              variant="outline"
              className="h-auto w-full justify-between rounded-xl border-[#26332A] bg-[#141B15] px-4 py-3 text-left hover:bg-[#1A251C]"
              onClick={() => navigate(`/comandas/${c.id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-[#F3EAD3]">
                  {identificacaoComandaTexto(c)}
                </p>
                <p className="text-xs text-[#A8B3A6]">
                  Aberta às {formatDateTimeBR(c.data_abertura)}
                </p>
              </div>
              <ChevronRight className="ml-2 h-5 w-5 shrink-0 text-[#6E7B70]" />
            </Button>
          ))}
        </div>
      </section>

      {fechadas.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#6E7B70]">
            <Archive className="h-3.5 w-3.5" /> Fechadas recentes
          </h2>
          <div className="space-y-1.5">
            {fechadas.slice(0, 8).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-[#26332A] bg-[#0B0F0C] px-3 py-2 text-xs"
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-[#6E7B70]" />
                <span className="min-w-0 flex-1 truncate text-[#A8B3A6]">
                  {identificacaoComandaTexto(c)}
                </span>
                <Badge
                  variant="outline"
                  className="shrink-0 border-[#26332A] text-[10px] text-[#6E7B70]"
                >
                  {formatDateTimeBR(c.data_fechamento)}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={modalNova} onOpenChange={setModalNova}>
        <DialogContent className="max-w-[440px] rounded-2xl border-[#26332A] bg-[#141B15] text-[#F3EAD3]">
          <DialogHeader>
            <DialogTitle>Nova Comanda</DialogTitle>
            <DialogDescription className="text-[#A8B3A6]">
              Identificação flexível: informe nome, mesa, local ou a combinação que preferir. O
              número da comanda é gerado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-bold">Nome do cliente (avulso ou cadastrado)</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Marcelo"
                className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-bold">Mesa (opcional)</Label>
              <Input
                value={mesa}
                onChange={(e) => setMesa(e.target.value)}
                placeholder="Ex.: 01"
                className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-bold">Local / referência (opcional)</Label>
              <Input
                value={localRef}
                onChange={(e) => setLocalRef(e.target.value)}
                placeholder="Ex.: Calçada, Balcão, Área externa"
                className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] text-[#F3EAD3]"
              />
            </div>
            {!nome.trim() && !mesa.trim() && (
              <p className="text-xs text-[#F2B705]">
                Informe pelo menos o nome ou a mesa para abrir a comanda.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalNova(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={abrirMutation.isPending}
              onClick={() => abrirMutation.mutate()}
              className="rounded-xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
            >
              {abrirMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              ABRIR COMANDA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}

export default ComandasLista
