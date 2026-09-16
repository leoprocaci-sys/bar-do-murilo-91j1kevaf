import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  UserPlus,
  Star,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Phone,
  ShieldAlert,
} from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { listClientes, listClientesComRestricao, toggleFavoritoCliente } from '@/services/fiado'
import { formatCentavos } from '@/lib/formatters'
import type { Cliente } from '@/types/fiado'

export const FiadoLista = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [apenasFavoritos, setApenasFavoritos] = useState(false)

  // Consulta lista de clientes
  const {
    data: clientes = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['fiado-clientes', busca],
    queryFn: () => listClientes(busca),
  })

  // Consulta quantidade de clientes bloqueados
  const { data: bloqueados = [] } = useQuery({
    queryKey: ['fiado-bloqueados'],
    queryFn: () => listClientesComRestricao(),
  })

  // Mutation de favorito
  const toggleFavoritoMutation = useMutation({
    mutationFn: ({ clienteId, novoStatus }: { clienteId: string; novoStatus: boolean }) =>
      toggleFavoritoCliente(clienteId, novoStatus),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fiado-clientes'] })
      toast({
        title: variables.novoStatus ? 'Favorito adicionado' : 'Favorito removido',
        description: 'Status de favorito atualizado para todos os administradores.',
      })
    },
    onError: () => {
      toast({
        title: 'Erro ao alterar favorito',
        description: 'Não foi possível atualizar o cliente.',
        variant: 'destructive',
      })
    },
  })

  const clientesFiltrados = clientes.filter((c) => {
    if (apenasFavoritos && !c.favorito) return false
    return true
  })

  const totalBloqueados = bloqueados.length

  return (
    <Layout backTo="/" backLabel="INÍCIO" className="pb-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">Caderno do Fiado</h1>
          <p className="text-sm text-[#A8B3A6]">Controle de clientes e consumos</p>
        </div>
        <Button
          type="button"
          onClick={() => navigate('/fiado/novo')}
          className="h-11 rounded-xl bg-[#1E6B3A] px-4 font-bold text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.98]"
        >
          <UserPlus className="mr-2 h-5 w-5" />
          NOVO
        </Button>
      </div>

      {/* Alerta de Não Vender Fiado (caso haja clientes bloqueados ou acesso rápido) */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => navigate('/fiado/bloqueados')}
          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
            totalBloqueados > 0
              ? 'border-red-900/60 bg-red-950/30 text-red-200 hover:bg-red-950/50 hover:border-red-700'
              : 'border-[#26332A] bg-[#141B15] text-[#A8B3A6] hover:bg-[#1A251C]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                totalBloqueados > 0 ? 'bg-red-900/50 text-red-400' : 'bg-[#1C271E] text-[#A8B3A6]'
              }`}
            >
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide">LISTA "NÃO VENDER FIADO"</p>
              <p className="text-xs opacity-80">
                {totalBloqueados === 0
                  ? 'Nenhum cliente bloqueado no momento'
                  : `${totalBloqueados} cliente${totalBloqueados > 1 ? 's' : ''} com restrição ativa`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalBloqueados > 0 && (
              <Badge variant="destructive" className="bg-red-600 font-bold px-2.5 py-0.5">
                {totalBloqueados}
              </Badge>
            )}
            <ChevronRight className="h-5 w-5 opacity-70" />
          </div>
        </button>
      </div>

      {/* Barra de busca e filtros */}
      <div className="mt-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A8B3A6]" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou apelido..."
            className="h-12 rounded-xl border-[#26332A] bg-[#141B15] pl-11 pr-4 text-base text-[#F3EAD3] placeholder:text-[#6E7B70] focus-visible:ring-[#1E6B3A]"
          />
        </div>

        {/* Botão de filtro rápidos: Todos / Apenas Favoritos */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setApenasFavoritos(false)}
              className={`h-9 rounded-lg px-3 text-xs font-bold tracking-wide transition-all ${
                !apenasFavoritos
                  ? 'bg-[#1E6B3A] text-[#F3EAD3]'
                  : 'bg-[#141B15] text-[#A8B3A6] border border-[#26332A]'
              }`}
            >
              TODOS ({clientes.length})
            </button>
            <button
              type="button"
              onClick={() => setApenasFavoritos(true)}
              className={`flex items-center gap-1.5 h-9 rounded-lg px-3 text-xs font-bold tracking-wide transition-all ${
                apenasFavoritos
                  ? 'bg-[#F2B705] text-[#0B0F0C]'
                  : 'bg-[#141B15] text-[#A8B3A6] border border-[#26332A]'
              }`}
            >
              <Star className="h-3.5 w-3.5 fill-current" />
              FAVORITOS ({clientes.filter((c) => c.favorito).length})
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-9 w-9 text-[#A8B3A6] hover:bg-[#141B15] hover:text-[#F3EAD3]"
            title="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Lista de clientes */}
      <div className="mt-4 flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-[#1E6B3A]" />
            <p className="mt-3 text-sm text-[#A8B3A6]">Carregando clientes...</p>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#26332A] p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141B15] text-[#A8B3A6]">
              <Search className="h-7 w-7" />
            </div>
            <p className="mt-4 text-base font-semibold text-[#F3EAD3]">
              {busca
                ? 'Nenhum cliente encontrado com esse termo'
                : apenasFavoritos
                  ? 'Nenhum cliente marcado como favorito ainda'
                  : 'Nenhum cliente cadastrado'}
            </p>
            <p className="mt-1 text-sm text-[#A8B3A6]">
              {busca
                ? 'Tente pesquisar por outro nome ou apelido.'
                : 'Cadastre o primeiro cliente para iniciar o caderno do fiado.'}
            </p>
            {!busca && !apenasFavoritos && (
              <Button
                type="button"
                onClick={() => navigate('/fiado/novo')}
                className="mt-4 rounded-xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                CADASTRAR PRIMEIRO CLIENTE
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {clientesFiltrados.map((cliente: Cliente) => (
              <div
                key={cliente.id}
                className={`group relative flex items-center justify-between rounded-2xl border transition-all ${
                  cliente.restricao_ativa
                    ? 'border-red-900/60 bg-[#160E0E] hover:border-red-700/80 hover:bg-[#1E1111]'
                    : 'border-[#26332A] bg-[#141B15] hover:border-[#334637] hover:bg-[#18221A]'
                }`}
              >
                {/* Botão de favorito */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavoritoMutation.mutate({
                      clienteId: cliente.id,
                      novoStatus: !cliente.favorito,
                    })
                  }}
                  className="flex h-full min-h-[72px] w-12 shrink-0 items-center justify-center text-[#4B5E4F] transition-colors hover:text-[#F2B705]"
                  aria-label={cliente.favorito ? 'Remover dos favoritos' : 'Marcar como favorito'}
                >
                  <Star
                    className={`h-5 w-5 ${
                      cliente.favorito ? 'fill-[#F2B705] text-[#F2B705]' : 'hover:fill-[#F2B705]/40'
                    }`}
                  />
                </button>

                {/* Área clicável principal da ficha */}
                <button
                  type="button"
                  onClick={() => navigate(`/fiado/cliente/${cliente.id}`)}
                  className="flex flex-1 items-center justify-between py-3.5 pr-4 text-left"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-bold text-[#F3EAD3]">{cliente.nome}</p>
                      {cliente.apelido && (
                        <span className="shrink-0 rounded-md bg-[#222E24] px-1.5 py-0.5 text-xs text-[#A8B3A6]">
                          "{cliente.apelido}"
                        </span>
                      )}
                    </div>

                    {/* Sub-informações: telefone e status de limite / restrição */}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {cliente.telefone && (
                        <span className="flex items-center gap-1 text-[#879689]">
                          <Phone className="h-3 w-3" />
                          {cliente.telefone}
                        </span>
                      )}

                      {/* Badge de restrição ou limite */}
                      {cliente.restricao_ativa ? (
                        <span className="inline-flex items-center gap-1 rounded bg-red-950/80 px-2 py-0.5 font-bold text-red-300 border border-red-800/60">
                          <AlertTriangle className="h-3 w-3 text-red-400" />
                          NÃO VENDER FIADO
                        </span>
                      ) : cliente.limite_centavos === 0 ? (
                        <span className="rounded bg-yellow-950/60 px-2 py-0.5 font-semibold text-yellow-300 border border-yellow-800/40">
                          Limite R$ 0,00 (bloqueado)
                        </span>
                      ) : cliente.limite_centavos !== null ? (
                        <span className="text-[#A8B3A6]">
                          Limite: {formatCentavos(cliente.limite_centavos)}
                        </span>
                      ) : (
                        <span className="text-[#6E7B70]">Sem limite definido</span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 shrink-0 text-[#6E7B70] group-hover:text-[#F3EAD3] transition-colors" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default FiadoLista
