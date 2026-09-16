import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User,
  Phone,
  MapPin,
  Star,
  Edit,
  PlusCircle,
  AlertTriangle,
  ShieldAlert,
  Clock,
  History,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  Gift,
  Scale,
  RefreshCw,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  getCliente,
  getSituacaoFinanceiraCliente,
  getHistoricoCliente,
  getAuditoriaCliente,
  toggleFavoritoCliente,
} from '@/services/fiado'
import { formatCentavos, formatDateBR, formatDateTimeBR } from '@/lib/formatters'
import type { Cliente } from '@/types/fiado'

export const FiadoFichaCliente = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [tabAtiva, setTabAtiva] = useState<'movimentacoes' | 'auditoria'>('movimentacoes')

  // 1. Dados cadastrais do cliente
  const {
    data: cliente,
    isLoading: isLoadingCliente,
    refetch: refetchCliente,
  } = useQuery({
    queryKey: ['fiado-cliente', id],
    queryFn: () => (id ? getCliente(id) : null),
    enabled: Boolean(id),
  })

  // 2. Situação financeira em tempo real (dívida, crédito disponível, posição líquida e limite)
  const {
    data: situacao,
    isLoading: isLoadingSituacao,
    refetch: refetchSituacao,
  } = useQuery({
    queryKey: ['fiado-situacao', id],
    queryFn: () => (cliente ? getSituacaoFinanceiraCliente(cliente) : null),
    enabled: Boolean(cliente),
  })

  // 3. Histórico de movimentações (consumos e créditos)
  const {
    data: historico = [],
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useQuery({
    queryKey: ['fiado-historico', id],
    queryFn: () => (id ? getHistoricoCliente(id) : []),
    enabled: Boolean(id),
  })

  // 4. Histórico de auditoria do cliente (cadastros, alterações de limite/restrição)
  const {
    data: auditoria = [],
    isLoading: isLoadingAuditoria,
    refetch: refetchAuditoria,
  } = useQuery({
    queryKey: ['fiado-auditoria', id],
    queryFn: () => (id ? getAuditoriaCliente(id) : []),
    enabled: Boolean(id) && tabAtiva === 'auditoria',
  })

  // Mutation de favorito
  const toggleFavoritoMutation = useMutation({
    mutationFn: ({ novoStatus }: { novoStatus: boolean }) => toggleFavoritoCliente(id!, novoStatus),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fiado-cliente', id] })
      queryClient.invalidateQueries({ queryKey: ['fiado-clientes'] })
      toast({
        title: variables.novoStatus ? 'Favorito adicionado' : 'Favorito removido',
      })
    },
  })

  const recarregarTudo = () => {
    refetchCliente()
    refetchSituacao()
    refetchHistorico()
    if (tabAtiva === 'auditoria') refetchAuditoria()
  }

  if (isLoadingCliente || !cliente) {
    return (
      <Layout backTo="/fiado" backLabel="VOLTAR" className="items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
        <p className="mt-3 text-sm text-[#A8B3A6]">Carregando ficha do cliente...</p>
      </Layout>
    )
  }

  // Análise rápida para o atendente no balcão: pode ou não comprar fiado?
  const podeComprarFiado = (() => {
    if (cliente.restricao_ativa) return false
    if (cliente.limite_centavos === 0) return false
    if (cliente.limite_centavos === null) return true
    if (situacao && situacao.disponivelParaFiadoCentavos !== null) {
      return situacao.disponivelParaFiadoCentavos > 0
    }
    return true
  })()

  return (
    <Layout backTo="/fiado" backLabel="VOLTAR AO FIADO" className="pb-10">
      {/* Cabeçalho do Cliente */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight text-[#F3EAD3]">
              {cliente.nome}
            </h1>
            <button
              type="button"
              onClick={() => toggleFavoritoMutation.mutate({ novoStatus: !cliente.favorito })}
              className="text-[#4B5E4F] transition-colors hover:text-[#F2B705]"
              title={cliente.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Star
                className={`h-5 w-5 ${cliente.favorito ? 'fill-[#F2B705] text-[#F2B705]' : ''}`}
              />
            </button>
          </div>
          {cliente.apelido && (
            <p className="text-sm font-semibold text-[#1E6B3A]">Apelido: "{cliente.apelido}"</p>
          )}
        </div>

        {/* Botão de Editar */}
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(`/fiado/cliente/${cliente.id}/editar`)}
          className="h-10 rounded-xl border-[#26332A] bg-[#141B15] px-3 font-semibold text-[#F3EAD3] hover:bg-[#1A251C]"
        >
          <Edit className="mr-1.5 h-4 w-4 text-[#A8B3A6]" />
          EDITAR
        </Button>
      </div>

      {/* Contatos e Endereço */}
      {(cliente.telefone || cliente.endereco) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#879689]">
          {cliente.telefone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-[#1E6B3A]" />
              {cliente.telefone}
            </span>
          )}
          {cliente.endereco && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#1E6B3A]" />
              {cliente.endereco}
            </span>
          )}
        </div>
      )}

      {/* BANNER DE SITUAÇÃO OPERACIONAL NO BALCÃO (Poucos toques, visão imediata) */}
      <div className="mt-4">
        {cliente.restricao_ativa ? (
          <div className="rounded-2xl border-2 border-red-700 bg-red-950/40 p-4 shadow-lg shadow-red-950/40">
            <div className="flex items-center gap-2 text-red-200">
              <ShieldAlert className="h-6 w-6 text-red-400 shrink-0" />
              <div>
                <p className="text-base font-extrabold tracking-wide uppercase">
                  BLOQUEADO — NÃO VENDER FIADO
                </p>
                <p className="text-xs text-red-300">
                  Restrição manual ativa. Proibido registrar novos consumos fiados.
                </p>
              </div>
            </div>
            {cliente.restricao_motivo && (
              <div className="mt-2.5 rounded-xl border border-red-800/60 bg-red-950/70 p-2.5 text-xs text-red-100">
                <span className="font-bold text-red-300">Motivo: </span>"{cliente.restricao_motivo}"
              </div>
            )}
          </div>
        ) : cliente.limite_centavos === 0 ? (
          <div className="rounded-2xl border border-yellow-700/80 bg-yellow-950/30 p-4">
            <div className="flex items-center gap-2 text-yellow-200">
              <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
              <div>
                <p className="text-sm font-bold uppercase tracking-wide">
                  Limite R$ 0,00 — Sem autorização para fiado
                </p>
                <p className="text-xs text-yellow-300/80">
                  O cliente não possui margem autorizada para compras fiadas.
                </p>
              </div>
            </div>
          </div>
        ) : podeComprarFiado ? (
          <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">
                  Liberado para compra fiada
                </p>
                <p className="text-[11px] text-[#A8B3A6]">
                  {cliente.limite_centavos === null
                    ? 'Sem teto de limite configurado'
                    : `Disponível no limite: ${formatCentavos(situacao?.disponivelParaFiadoCentavos)}`}
                </p>
              </div>
            </div>
            <Badge className="bg-[#1E6B3A] text-[#F3EAD3] font-bold">AUTORIZADO</Badge>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-800/80 bg-amber-950/30 p-4">
            <div className="flex items-center gap-2 text-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-bold uppercase tracking-wide">
                  Capacidade de Limite Esgotada
                </p>
                <p className="text-xs text-amber-300/80">
                  A dívida atual já atinge ou ultrapassa o limite permitido.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AÇÃO PRINCIPAL DESTACADA: REGISTRAR CONSUMO */}
      <div className="mt-4">
        <Button
          type="button"
          disabled={!podeComprarFiado}
          onClick={() => navigate(`/fiado/cliente/${cliente.id}/consumo`)}
          className={`h-16 w-full rounded-2xl text-xl font-bold tracking-wider shadow-lg active:scale-[0.98] transition-all ${
            podeComprarFiado
              ? 'bg-[#1E6B3A] text-[#F3EAD3] hover:bg-[#25814A] shadow-[#1E6B3A]/25'
              : 'bg-[#1C271E] text-[#6E7B70] cursor-not-allowed border border-[#26332A]'
          }`}
        >
          <PlusCircle className="mr-3 h-6 w-6" />
          REGISTRAR CONSUMO FIADO
        </Button>
        {!podeComprarFiado && (
          <p className="mt-1.5 text-center text-[11px] text-red-400">
            {cliente.restricao_ativa
              ? 'Bloqueado por restrição operacional "Não vender fiado".'
              : 'Bloqueado por política de limite.'}
          </p>
        )}
      </div>

      {/* PAINEL DE SITUAÇÃO FINANCEIRA: Dívida, Crédito, Posição Líquida e Limite */}
      <div className="mt-5 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#26332A]">
          <p className="text-xs font-bold tracking-wider text-[#A8B3A6] uppercase">
            Posição Financeira
          </p>
          <button
            type="button"
            onClick={recarregarTudo}
            className="text-xs text-[#1E6B3A] hover:underline flex items-center gap-1 font-semibold"
          >
            <RefreshCw className="h-3 w-3" />
            Atualizar
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {/* Card: Total Dívida */}
          <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3">
            <div className="flex items-center gap-1.5 text-[#A8B3A6] text-xs">
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              <span>Dívida Consumos</span>
            </div>
            <p className="mt-1 text-lg font-bold text-red-300">
              {formatCentavos(situacao?.totalDividaCentavos ?? 0)}
            </p>
            <span className="text-[10px] text-[#6E7B70]">Soma dos fiados em aberto</span>
          </div>

          {/* Card: Crédito Disponível */}
          <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3">
            <div className="flex items-center gap-1.5 text-[#A8B3A6] text-xs">
              <Gift className="h-3.5 w-3.5 text-emerald-400" />
              <span>Crédito Disponível</span>
            </div>
            <p className="mt-1 text-lg font-bold text-emerald-300">
              {formatCentavos(situacao?.totalCreditoDisponivelCentavos ?? 0)}
            </p>
            <span className="text-[10px] text-[#6E7B70]">Adiantamentos e sobras</span>
          </div>

          {/* Card: Posição Líquida */}
          <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3">
            <div className="flex items-center gap-1.5 text-[#A8B3A6] text-xs">
              <Scale className="h-3.5 w-3.5 text-[#F2B705]" />
              <span>Posição Líquida</span>
            </div>
            <p
              className={`mt-1 text-lg font-bold ${
                (situacao?.posicaoLiquidaCentavos ?? 0) > 0
                  ? 'text-[#F3EAD3]'
                  : (situacao?.posicaoLiquidaCentavos ?? 0) < 0
                    ? 'text-emerald-400'
                    : 'text-[#A8B3A6]'
              }`}
            >
              {formatCentavos(situacao?.posicaoLiquidaCentavos ?? 0)}
            </p>
            <span className="text-[10px] text-[#6E7B70]">
              {(situacao?.posicaoLiquidaCentavos ?? 0) > 0
                ? 'Saldo devedor líquido'
                : (situacao?.posicaoLiquidaCentavos ?? 0) < 0
                  ? 'Crédito líquido a favor'
                  : 'Zerado'}
            </span>
          </div>

          {/* Card: Limite e Capacidade */}
          <div className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3">
            <div className="flex items-center gap-1.5 text-[#A8B3A6] text-xs">
              <DollarSign className="h-3.5 w-3.5 text-[#1E6B3A]" />
              <span>Limite de Fiado</span>
            </div>
            <p className="mt-1 text-base font-bold text-[#F3EAD3]">
              {cliente.limite_centavos === null
                ? 'Sem limite'
                : formatCentavos(cliente.limite_centavos)}
            </p>
            <span className="text-[10px] text-[#6E7B70]">
              {cliente.limite_centavos === null
                ? 'Livre para compras'
                : cliente.limite_centavos === 0
                  ? 'Não autorizado'
                  : `Resta: ${formatCentavos(situacao?.disponivelParaFiadoCentavos)}`}
            </span>
          </div>
        </div>
      </div>

      {/* ABAS: HISTÓRICO DE MOVIMENTAÇÕES E AUDITORIA */}
      <div className="mt-6">
        <Tabs value={tabAtiva} onValueChange={(val: any) => setTabAtiva(val)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-[#141B15] p-1 border border-[#26332A]">
            <TabsTrigger
              value="movimentacoes"
              className="rounded-lg font-bold text-xs data-[state=active]:bg-[#1E6B3A] data-[state=active]:text-[#F3EAD3]"
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              MOVIMENTAÇÕES ({historico.length})
            </TabsTrigger>
            <TabsTrigger
              value="auditoria"
              className="rounded-lg font-bold text-xs data-[state=active]:bg-[#1E6B3A] data-[state=active]:text-[#F3EAD3]"
            >
              <History className="mr-1.5 h-3.5 w-3.5" />
              AUDITORIA
            </TabsTrigger>
          </TabsList>

          {/* Conteúdo da Aba 1: Movimentações */}
          <TabsContent value="movimentacoes" className="mt-4 space-y-3">
            {isLoadingHistorico ? (
              <div className="py-8 text-center text-xs text-[#A8B3A6]">
                Carregando movimentações...
              </div>
            ) : historico.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#26332A] p-6 text-center text-xs text-[#A8B3A6]">
                Nenhuma movimentação registrada para este cliente.
              </div>
            ) : (
              <div className="space-y-2.5">
                {historico.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#26332A] bg-[#141B15] p-3 transition-colors hover:border-[#334637]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              item.tipo === 'consumo'
                                ? 'bg-red-950/80 text-red-300 border border-red-900/60'
                                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-900/60'
                            }`}
                          >
                            {item.origem}
                          </span>
                          <span className="text-xs font-semibold text-[#A8B3A6]">
                            Data: {formatDateBR(item.data_movimento)}
                          </span>
                        </div>

                        {item.descricao && (
                          <p className="mt-1.5 text-sm font-medium text-[#F3EAD3]">
                            {item.descricao}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-base font-bold ${
                            item.tipo === 'consumo' ? 'text-red-300' : 'text-emerald-300'
                          }`}
                        >
                          {item.tipo === 'consumo' ? '+ ' : '- '}
                          {formatCentavos(item.valor_centavos)}
                        </p>
                      </div>
                    </div>

                    {/* Metadados: quem registrou e data/hora do registro */}
                    <div className="mt-2 flex flex-wrap items-center justify-between border-t border-[#1C271E] pt-2 text-[11px] text-[#6E7B70]">
                      <span>
                        Lançado por:{' '}
                        <strong className="text-[#A8B3A6]">{item.registrado_por_nome}</strong>
                      </span>
                      <span>Registro: {formatDateTimeBR(item.data_registro)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Conteúdo da Aba 2: Auditoria (historico_alteracoes) */}
          <TabsContent value="auditoria" className="mt-4 space-y-3">
            {isLoadingAuditoria ? (
              <div className="py-8 text-center text-xs text-[#A8B3A6]">
                Carregando registros de auditoria...
              </div>
            ) : auditoria.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#26332A] p-6 text-center text-xs text-[#A8B3A6]">
                Nenhuma alteração cadastral registrada na auditoria até o momento.
              </div>
            ) : (
              <div className="space-y-2.5">
                {auditoria.map((log) => {
                  const novos = log.dados_novos || {}
                  const antigos = log.dados_anteriores || {}

                  return (
                    <div
                      key={log.id}
                      className="rounded-xl border border-[#26332A] bg-[#141B15] p-3 text-xs"
                    >
                      <div className="flex items-center justify-between text-[#A8B3A6]">
                        <span className="font-bold text-[#F3EAD3]">Alteração Cadastral</span>
                        <span>{formatDateTimeBR(log.alterado_em)}</span>
                      </div>

                      <p className="mt-1 text-[#879689]">
                        Realizada por:{' '}
                        <strong className="text-[#F3EAD3]">{log.alterado_por_nome}</strong>
                      </p>

                      {/* Resumo das alterações de limite ou restrição */}
                      <div className="mt-2 space-y-1 rounded-lg bg-[#0B0F0C] p-2 text-[11px]">
                        {antigos.limite_centavos !== novos.limite_centavos && (
                          <p className="text-[#A8B3A6]">
                            • Limite alterado de{' '}
                            <span className="font-semibold text-yellow-400">
                              {antigos.limite_centavos === null
                                ? 'Sem limite'
                                : formatCentavos(antigos.limite_centavos as number)}
                            </span>{' '}
                            para{' '}
                            <span className="font-semibold text-emerald-400">
                              {novos.limite_centavos === null
                                ? 'Sem limite'
                                : formatCentavos(novos.limite_centavos as number)}
                            </span>
                          </p>
                        )}

                        {antigos.restricao_ativa !== novos.restricao_ativa && (
                          <p className="text-[#A8B3A6]">
                            • Restrição "Não vender fiado":{' '}
                            <span
                              className={`font-semibold ${
                                novos.restricao_ativa ? 'text-red-400' : 'text-emerald-400'
                              }`}
                            >
                              {novos.restricao_ativa ? 'ATIVADA' : 'DESATIVADA'}
                            </span>
                            {novos.restricao_motivo && (
                              <span> (Motivo: "{String(novos.restricao_motivo)}")</span>
                            )}
                          </p>
                        )}

                        {antigos.nome !== novos.nome && (
                          <p className="text-[#A8B3A6]">
                            • Nome: "{String(antigos.nome)}" → "{String(novos.nome)}"
                          </p>
                        )}

                        {antigos.telefone !== novos.telefone && (
                          <p className="text-[#A8B3A6]">
                            • Telefone: {String(antigos.telefone || 'Vazio')} →{' '}
                            {String(novos.telefone || 'Vazio')}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}

export default FiadoFichaCliente
