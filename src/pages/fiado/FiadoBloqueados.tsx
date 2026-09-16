import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, AlertTriangle, ChevronRight, User, Clock, Phone } from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { listClientesComRestricao } from '@/services/fiado'
import { formatDateTimeBR } from '@/lib/formatters'
import type { Cliente } from '@/types/fiado'

export const FiadoBloqueados = () => {
  const navigate = useNavigate()

  const {
    data: clientesBloqueados = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['fiado-bloqueados-detalhes'],
    queryFn: () => listClientesComRestricao(),
  })

  return (
    <Layout backTo="/fiado" backLabel="VOLTAR AO FIADO" className="pb-8">
      {/* Cabeçalho de Alerta */}
      <div className="flex items-start gap-3 rounded-2xl border border-red-900/80 bg-red-950/40 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-900/60 text-red-300">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-red-100">Alerta "Não Vender Fiado"</h1>
          <p className="mt-1 text-xs text-red-300/90 leading-relaxed">
            Clientes listados abaixo têm restrição manual ativa com prioridade operacional. Novos
            consumos fiados estão expressamente bloqueados no sistema.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs font-bold tracking-wider text-[#A8B3A6] uppercase">
          Total com restrição ({clientesBloqueados.length})
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="h-8 text-xs text-[#A8B3A6] hover:bg-[#141B15] hover:text-[#F3EAD3]"
        >
          Atualizar
        </Button>
      </div>

      <div className="mt-3 flex-1">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-[#A8B3A6]">Carregando restrições...</div>
        ) : clientesBloqueados.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#26332A] p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#141B15] text-[#1E6B3A]">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="mt-3 text-base font-semibold text-[#F3EAD3]">Nenhum cliente bloqueado</p>
            <p className="mt-1 text-xs text-[#A8B3A6]">
              Todos os clientes cadastrados estão sem restrição manual ativa.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientesBloqueados.map((cliente: Cliente) => (
              <button
                key={cliente.id}
                type="button"
                onClick={() => navigate(`/fiado/cliente/${cliente.id}`)}
                className="group w-full rounded-2xl border border-red-900/60 bg-[#160E0E] p-4 text-left transition-all hover:border-red-700/80 hover:bg-[#1E1111]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-bold text-red-200">{cliente.nome}</p>
                      {cliente.apelido && (
                        <span className="shrink-0 rounded bg-red-950 px-1.5 py-0.5 text-xs text-red-300 border border-red-900/50">
                          "{cliente.apelido}"
                        </span>
                      )}
                    </div>
                    {cliente.telefone && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[#879689]">
                        <Phone className="h-3 w-3" />
                        {cliente.telefone}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-red-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>

                {/* Bloco de Justificativa / Motivo */}
                <div className="mt-3 rounded-xl border border-red-900/40 bg-red-950/50 p-2.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Motivo da restrição:</span>
                  </div>
                  <p className="mt-1 font-medium text-red-100 italic">
                    "{cliente.restricao_motivo || 'Sem motivo detalhado informado.'}"
                  </p>
                </div>

                {/* Metadados: quem bloqueou e quando */}
                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-[#879689]">
                  {cliente.restricao_por_nome && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Por: {cliente.restricao_por_nome}
                    </span>
                  )}
                  {cliente.restricao_em && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Em: {formatDateTimeBR(cliente.restricao_em)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default FiadoBloqueados
