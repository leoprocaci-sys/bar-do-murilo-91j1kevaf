import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, UserRound } from 'lucide-react'
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
import { getComanda, atualizarIdentificacaoComanda } from '@/services/comandas'
import { listClientes } from '@/services/fiado'
import { formatDateTimeBR } from '@/lib/formatters'

export const ComandaIdentificacao = () => {
  const { id: comandaId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const comandaQuery = useQuery({
    queryKey: ['comanda', comandaId],
    queryFn: () => getComanda(comandaId!),
  })
  const clientesQuery = useQuery({ queryKey: ['clientes-fiado'], queryFn: () => listClientes() })

  const comanda = comandaQuery.data
  const [nome, setNome] = useState('')
  const [mesa, setMesa] = useState('')
  const [localRef, setLocalRef] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [carregado, setCarregado] = useState(false)
  const [salvando, setSalvando] = useState(false)

  if (comanda && !carregado) {
    setNome(comanda.identificacao ?? '')
    setMesa(comanda.mesa ?? '')
    setLocalRef(comanda.local_referencia ?? '')
    setClienteId(comanda.cliente_id ?? '')
    setCarregado(true)
  }

  const salvarMutation = useMutation({
    mutationFn: async () => {
      await atualizarIdentificacaoComanda(comandaId!, {
        identificacao: nome.trim() || null,
        mesa: mesa.trim() || null,
        local_referencia: localRef.trim() || null,
        cliente_id: clienteId || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comanda', comandaId] })
      queryClient.invalidateQueries({ queryKey: ['comandas-abertas'] })
      toast({ title: 'Identificação atualizada' })
      navigate(`/comandas/${comandaId}`)
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Tente novamente.',
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
    <Layout backTo={`/comandas/${comandaId}`} backLabel="COMANDA" className="pb-14">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">Identificação</h1>
        <p className="text-sm text-[#A8B3A6]">
          Comanda nº {comanda.numero} · aberta às {formatDateTimeBR(comanda.data_abertura)}
        </p>
      </header>

      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-bold">Nome / apelido</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Marcelo"
            className="h-12 rounded-xl border-[#26332A] bg-[#141B15] text-[#F3EAD3]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-bold">Mesa (opcional)</Label>
          <Input
            value={mesa}
            onChange={(e) => setMesa(e.target.value)}
            placeholder="Ex.: 01"
            className="h-12 rounded-xl border-[#26332A] bg-[#141B15] text-[#F3EAD3]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-bold">Local / referência (opcional)</Label>
          <Input
            value={localRef}
            onChange={(e) => setLocalRef(e.target.value)}
            placeholder="Ex.: Calçada, Balcão"
            className="h-12 rounded-xl border-[#26332A] bg-[#141B15] text-[#F3EAD3]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 text-sm font-bold">
            <UserRound className="h-4 w-4 text-[#A8B3A6]" /> Cliente cadastrado (usado no Fiado)
          </Label>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="h-12 w-full rounded-xl border border-[#26332A] bg-[#141B15] px-3 text-sm text-[#F3EAD3]"
          >
            <option value="">— sem cliente cadastrado (nome avulso) —</option>
            {(clientesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <p className="text-xs text-[#A8B3A6]">
            Obrigatório apenas se o fechamento tiver parcela no Fiado.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-14 rounded-2xl border-[#26332A] bg-[#141B15] font-bold text-[#F3EAD3]"
          onClick={() => navigate(`/comandas/${comandaId}`)}
        >
          VOLTAR
        </Button>
        <Button
          type="button"
          disabled={salvarMutation.isPending}
          onClick={async () => {
            setSalvando(true)
            await salvarMutation.mutateAsync()
            setSalvando(false)
          }}
          className="h-14 rounded-2xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
        >
          {salvarMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          SALVAR
        </Button>
      </div>
    </Layout>
  )
}

export default ComandaIdentificacao
