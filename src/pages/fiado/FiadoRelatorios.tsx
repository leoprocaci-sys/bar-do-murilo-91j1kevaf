import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar,
  ChevronRight,
  TrendingDown,
  Gift,
  ArrowDownCircle,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  Info,
  Printer,
} from 'lucide-react'
import { Layout } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCentavos, formatDateBR } from '@/lib/formatters'
import { getRelatorioFiado, getDetalhamentoClientePeriodo } from '@/services/fiado'
import type {
  PeriodoRelatorioFiado,
  EvolucaoClienteFiado,
  DetalhamentoClientePeriodo,
} from '@/types/fiado'

const MESES = [
  { valor: 1, rotulo: 'Janeiro' },
  { valor: 2, rotulo: 'Fevereiro' },
  { valor: 3, rotulo: 'Março' },
  { valor: 4, rotulo: 'Abril' },
  { valor: 5, rotulo: 'Maio' },
  { valor: 6, rotulo: 'Junho' },
  { valor: 7, rotulo: 'Julho' },
  { valor: 8, rotulo: 'Agosto' },
  { valor: 9, rotulo: 'Setembro' },
  { valor: 10, rotulo: 'Outubro' },
  { valor: 11, rotulo: 'Novembro' },
  { valor: 12, rotulo: 'Dezembro' },
]

export function FiadoRelatorios() {
  const navigate = useNavigate()
  const hoje = new Date()
  const [tipoPeriodo, setTipoPeriodo] = useState<PeriodoRelatorioFiado>('mes')
  const [ano, setAno] = useState<number>(hoje.getFullYear())
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1)
  const [clienteExpandidoId, setClienteExpandidoId] = useState<string | null>(null)

  // Query do relatório geral de evolução
  const {
    data: relatorio,
    isLoading,
    isRefetching,
    error,
  } = useQuery({
    queryKey: ['fiado-relatorio', tipoPeriodo, ano, mes],
    queryFn: () => getRelatorioFiado(tipoPeriodo, ano, mes),
  })

  // Anos disponíveis para seleção (ano atual e 3 anos anteriores/posteriores)
  const anosDisponiveis = [
    hoje.getFullYear() - 2,
    hoje.getFullYear() - 1,
    hoje.getFullYear(),
    hoje.getFullYear() + 1,
  ]

  const alternarExpandirCliente = (clienteId: string) => {
    if (clienteExpandidoId === clienteId) {
      setClienteExpandidoId(null)
    } else {
      setClienteExpandidoId(clienteId)
    }
  }

  return (
    <Layout backTo="/fiado" backLabel="VOLTAR AO CADERNO" className="max-w-4xl pb-16">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#1E6B3A]/20 p-2 text-[#1E6B3A] border border-[#1E6B3A]/40">
              <FileText className="h-5 w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F3EAD3]">
              Relatórios do Fiado
            </h1>
          </div>
          <p className="mt-1 text-xs text-[#A8B3A6]">
            Evolução real de dívidas e créditos por cliente no período selecionado.
          </p>
        </div>

        {relatorio && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="no-print self-start sm:self-auto h-10 border-[#26332A] bg-[#141B15] text-xs font-bold text-[#F3EAD3] hover:bg-[#1E6B3A]"
          >
            <Printer className="mr-1.5 h-4 w-4" />
            IMPRIMIR / PDF
          </Button>
        )}
      </div>

      {/* Cabeçalho impresso oficial */}
      {relatorio && (
        <div className="hidden print:block my-4 border-b border-black pb-2 text-black">
          <h2 className="text-lg font-bold">Bar do Murilo — Relatório do Fiado</h2>
          <p className="text-xs">
            Período: {relatorio.tituloPeriodo} ({formatDateBR(relatorio.dataInicio)} a{' '}
            {formatDateBR(relatorio.dataFim)}) | Emissão: {new Date().toLocaleDateString('pt-BR')}{' '}
            às {new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>
      )}

      {/* Controles de Filtro de Período (Mensal / Anual) */}
      <div className="mt-4 rounded-2xl border border-[#26332A] bg-[#141B15] p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Alternar Mês / Ano */}
          <div className="grid grid-cols-2 rounded-xl bg-[#0B0F0C] p-1 border border-[#26332A]">
            <button
              type="button"
              onClick={() => setTipoPeriodo('mes')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                tipoPeriodo === 'mes'
                  ? 'bg-[#1E6B3A] text-[#F3EAD3]'
                  : 'text-[#A8B3A6] hover:text-[#F3EAD3]'
              }`}
            >
              MENSAL
            </button>
            <button
              type="button"
              onClick={() => setTipoPeriodo('ano')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                tipoPeriodo === 'ano'
                  ? 'bg-[#1E6B3A] text-[#F3EAD3]'
                  : 'text-[#A8B3A6] hover:text-[#F3EAD3]'
              }`}
            >
              ANUAL
            </button>
          </div>

          {/* Seleção do Mês (apenas se mensal) */}
          {tipoPeriodo === 'mes' && (
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="h-9 rounded-xl border border-[#26332A] bg-[#0B0F0C] px-3 text-xs font-bold text-[#F3EAD3] focus:outline-none focus:ring-1 focus:ring-[#1E6B3A]"
            >
              {MESES.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </select>
          )}

          {/* Seleção do Ano */}
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="h-9 rounded-xl border border-[#26332A] bg-[#0B0F0C] px-3 text-xs font-bold text-[#F3EAD3] focus:outline-none focus:ring-1 focus:ring-[#1E6B3A]"
          >
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#879689] pt-1 border-t border-[#1C271E]">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#1E6B3A]" />
            <span>Período considerado:</span>
            <strong className="text-[#F3EAD3]">{relatorio?.tituloPeriodo}</strong>
            {relatorio && (
              <span className="text-[#6E7B70]">
                ({formatDateBR(relatorio.dataInicio)} a {formatDateBR(relatorio.dataFim)})
              </span>
            )}
          </div>
          {(isLoading || isRefetching) && (
            <div className="flex items-center gap-1 text-[#1E6B3A]">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Calculando...</span>
            </div>
          )}
        </div>
      </div>

      {/* Regra de Temporalidade Explicada */}
      <div className="mt-2 rounded-xl border border-[#1C271E] bg-[#0B0F0C]/60 p-2.5 text-[11px] text-[#879689] flex items-start gap-2">
        <Info className="h-4 w-4 text-[#1E6B3A] shrink-0 mt-0.5" />
        <p>
          <strong>Temporalidade contábil:</strong> os valores refletem estritamente a posição no{' '}
          <span className="text-[#F3EAD3] font-semibold">final do período selecionado</span>.
          Consumos pertencem à data do consumo e pagamentos à data do recebimento. Dívidas e
          créditos são mantidos separados.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
          <p className="mt-3 text-sm text-[#A8B3A6]">
            Processando evolução cronológica dos clientes...
          </p>
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-red-900 bg-red-950/40 p-4 text-xs text-red-300">
          Erro ao gerar relatório do fiado: {(error as any)?.message}
        </div>
      ) : !relatorio || relatorio.clientes.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#26332A] p-8 text-center text-xs text-[#A8B3A6]">
          Nenhuma movimentação ou saldo fiado registrado para o período de{' '}
          <strong className="text-[#F3EAD3]">{relatorio?.tituloPeriodo}</strong>.
        </div>
      ) : (
        <>
          {/* TOTAIS CONSOLIDADOS DO BAR NO PERÍODO */}
          <div className="mt-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#A8B3A6]">
              Consolidado Geral do Bar ({relatorio.tituloPeriodo})
            </h2>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {/* Dívida Inicial */}
              <div className="rounded-xl border border-[#26332A] bg-[#141B15] p-3">
                <span className="text-[11px] text-[#A8B3A6]">Dívida no Início</span>
                <p className="mt-1 text-base sm:text-lg font-bold text-[#F3EAD3]">
                  {formatCentavos(relatorio.totais.dividaInicialCentavos)}
                </p>
                <span className="text-[10px] text-[#6E7B70]">Saldo pendente de entrada</span>
              </div>

              {/* Consumos no Período */}
              <div className="rounded-xl border border-[#26332A] bg-[#141B15] p-3">
                <div className="flex items-center gap-1 text-[11px] text-red-300">
                  <TrendingDown className="h-3 w-3" />
                  <span>Consumos Fiados (+)</span>
                </div>
                <p className="mt-1 text-base sm:text-lg font-bold text-red-300">
                  + {formatCentavos(relatorio.totais.consumosPeriodoCentavos)}
                </p>
                <span className="text-[10px] text-[#6E7B70]">Novas vendas a prazo</span>
              </div>

              {/* Pagamentos Recebidos */}
              <div className="rounded-xl border border-[#26332A] bg-[#141B15] p-3">
                <div className="flex items-center gap-1 text-[11px] text-emerald-300">
                  <ArrowDownCircle className="h-3 w-3" />
                  <span>Pagamentos (-)</span>
                </div>
                <p className="mt-1 text-base sm:text-lg font-bold text-emerald-300">
                  - {formatCentavos(relatorio.totais.pagamentosRecebidosPeriodoCentavos)}
                </p>
                <span className="text-[10px] text-[#6E7B70]">Recebidos de fiado</span>
              </div>

              {/* Dívida Final */}
              <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-3">
                <span className="text-[11px] font-bold text-red-200">Dívida no Final</span>
                <p className="mt-1 text-lg sm:text-xl font-black text-red-300">
                  {formatCentavos(relatorio.totais.dividaFinalCentavos)}
                </p>
                <span className="text-[10px] text-red-300/80">
                  Saldo a receber ao fim do período
                </span>
              </div>
            </div>

            {/* Linha complementar de créditos do período */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-xs">
              <div>
                <span className="text-[10px] text-[#879689]">Crédito Inicial:</span>
                <p className="font-semibold text-emerald-400">
                  {formatCentavos(relatorio.totais.creditoInicialCentavos)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-[#879689]">Crédito Gerado (Sobras):</span>
                <p className="font-semibold text-emerald-300">
                  + {formatCentavos(relatorio.totais.creditoGeradoPeriodoCentavos)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-[#879689]">Crédito Utilizado / Devolvido:</span>
                <p className="font-semibold text-amber-300">
                  -{' '}
                  {formatCentavos(
                    relatorio.totais.creditoUtilizadoPeriodoCentavos +
                      relatorio.totais.creditoDevolvidoPeriodoCentavos,
                  )}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-[#879689]">Crédito no Final do Período:</span>
                <p className="font-bold text-emerald-300">
                  {formatCentavos(relatorio.totais.creditoFinalCentavos)}
                </p>
              </div>
            </div>
          </div>

          {/* LISTA GERAL DE CLIENTES COM DÍVIDAS E CRÉDITOS */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#A8B3A6]">
                Clientes com Atividade ou Saldo ({relatorio.clientes.length})
              </h2>
              <span className="text-[11px] text-[#6E7B70]">Toque no cliente para detalhamento</span>
            </div>

            <div className="space-y-2.5">
              {relatorio.clientes.map((c) => {
                const isExpandido = clienteExpandidoId === c.cliente_id

                return (
                  <div
                    key={c.cliente_id}
                    className="overflow-hidden rounded-2xl border border-[#26332A] bg-[#141B15] transition-colors hover:border-[#334637]"
                  >
                    {/* Linha Enxuta Principal (Resumo Claro) */}
                    <button
                      type="button"
                      onClick={() => alternarExpandirCliente(c.cliente_id)}
                      className="w-full p-3.5 text-left flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-[#1E6B3A] shrink-0" />
                          <span className="truncate text-sm font-bold text-[#F3EAD3]">
                            {c.nome}
                          </span>
                          {c.apelido && (
                            <span className="text-xs text-[#879689]">"{c.apelido}"</span>
                          )}
                        </div>

                        {/* Indicadores resumidos inline */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#A8B3A6]">
                          <span>
                            Início: <strong>{formatCentavos(c.dividaInicialCentavos)}</strong>
                          </span>
                          <span className="text-red-300">
                            Consumos: +{formatCentavos(c.consumosPeriodoCentavos)}
                          </span>
                          <span className="text-emerald-300">
                            Pagos: -{formatCentavos(c.pagamentosRecebidosPeriodoCentavos)}
                          </span>
                        </div>
                      </div>

                      {/* Dívida Final e Crédito Final */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1C271E]">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-[#6E7B70] block">Dívida Final</span>
                          <span
                            className={`text-base font-extrabold ${
                              c.dividaFinalCentavos > 0 ? 'text-red-300' : 'text-[#A8B3A6]'
                            }`}
                          >
                            {formatCentavos(c.dividaFinalCentavos)}
                          </span>
                        </div>

                        {c.creditoFinalCentavos > 0 && (
                          <div className="text-left sm:text-right pl-2 border-l border-[#26332A]">
                            <span className="text-[10px] text-[#6E7B70] block">Crédito Final</span>
                            <span className="text-xs font-bold text-emerald-400">
                              {formatCentavos(c.creditoFinalCentavos)}
                            </span>
                          </div>
                        )}

                        <div className="text-[#A8B3A6]">
                          {isExpandido ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* DETALHAMENTO SOB DEMANDA */}
                    {isExpandido && (
                      <div className="border-t border-[#1C271E] bg-[#0B0F0C] p-4 text-xs space-y-4">
                        {/* Painel Explicativo da Evolução dos Saldos */}
                        <div>
                          <p className="font-bold text-[#F3EAD3] text-xs mb-2">
                            Evolução Completa dos Saldos no Período
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-xl border border-[#26332A] bg-[#141B15] p-3">
                            <div>
                              <span className="text-[10px] text-[#879689] block">
                                Dívida Inicial
                              </span>
                              <strong className="text-white">
                                {formatCentavos(c.dividaInicialCentavos)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-red-400 block">+ Consumos</span>
                              <strong className="text-red-300">
                                {formatCentavos(c.consumosPeriodoCentavos)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-emerald-400 block">
                                - Pagamentos Recebidos
                              </span>
                              <strong className="text-emerald-300">
                                {formatCentavos(c.pagamentosRecebidosPeriodoCentavos)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-red-400 block font-bold">
                                = Dívida Final
                              </span>
                              <strong className="text-red-200 text-sm">
                                {formatCentavos(c.dividaFinalCentavos)}
                              </strong>
                            </div>
                          </div>

                          {/* Seção de Créditos do Cliente */}
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-xl border border-[#1E6B3A]/30 bg-[#121c15] p-2.5 text-[11px]">
                            <div>
                              <span className="text-[#879689] block">Crédito Inicial:</span>
                              <span className="font-semibold text-emerald-400">
                                {formatCentavos(c.creditoInicialCentavos)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#879689] block">+ Crédito Gerado:</span>
                              <span className="font-semibold text-emerald-300">
                                {formatCentavos(c.creditoGeradoPeriodoCentavos)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#879689] block">- Usado / Devolvido:</span>
                              <span className="font-semibold text-amber-300">
                                {formatCentavos(
                                  c.creditoUtilizadoPeriodoCentavos +
                                    c.creditoDevolvidoPeriodoCentavos,
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#879689] block font-bold">
                                = Crédito Final:
                              </span>
                              <span className="font-bold text-emerald-300">
                                {formatCentavos(c.creditoFinalCentavos)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Consulta dos Itens e Movimentos no Período */}
                        <SubDetalhamentoCliente
                          clienteId={c.cliente_id}
                          dataInicio={relatorio.dataInicio}
                          dataFim={relatorio.dataFim}
                          onVerFicha={() => navigate(`/fiado/cliente/${c.cliente_id}`)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}

function SubDetalhamentoCliente({
  clienteId,
  dataInicio,
  dataFim,
  onVerFicha,
}: {
  clienteId: string
  dataInicio: string
  dataFim: string
  onVerFicha: () => void
}) {
  const { data, isLoading } = useQuery<DetalhamentoClientePeriodo>({
    queryKey: ['fiado-detalhe-cliente-periodo', clienteId, dataInicio, dataFim],
    queryFn: () => getDetalhamentoClientePeriodo(clienteId, dataInicio, dataFim),
  })

  if (isLoading) {
    return (
      <div className="py-4 text-center text-xs text-[#A8B3A6]">
        <Loader2 className="inline mr-1 h-3.5 w-3.5 animate-spin" />
        Carregando itens do período...
      </div>
    )
  }

  if (!data) return null

  const consumos = data.consumos || []
  const pagamentos = data.pagamentos || []
  const creditos = data.operacoesCredito || []

  return (
    <div className="space-y-3 pt-2 border-t border-[#1C271E]">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[#F3EAD3] text-xs">Lançamentos do Cliente no Período</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onVerFicha}
          className="h-7 text-[11px] rounded-lg border-[#26332A] bg-[#141B15] text-[#F3EAD3] hover:bg-[#1E6B3A]"
        >
          Ver Ficha Completa
          <ChevronRight className="ml-1 h-3 w-3" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Consumos */}
        <div className="rounded-xl border border-[#26332A] bg-[#141B15] p-3">
          <p className="font-bold text-red-300 text-[11px] uppercase mb-2">
            Consumos no Período ({consumos.length})
          </p>
          {consumos.length === 0 ? (
            <p className="text-[11px] text-[#6E7B70]">Nenhum consumo neste período.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {consumos.map((cs) => (
                <div
                  key={cs.id}
                  className="flex items-center justify-between py-1 border-b border-[#1C271E] last:border-b-0 text-[11px]"
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-[#A8B3A6]">{formatDateBR(cs.data_movimento)}</span>
                    <p className="truncate text-[#F3EAD3]">{cs.descricao || 'Consumo fiado'}</p>
                  </div>
                  <strong className="text-red-300 shrink-0">
                    {formatCentavos(cs.valor_centavos)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagamentos */}
        <div className="rounded-xl border border-[#26332A] bg-[#141B15] p-3">
          <p className="font-bold text-emerald-300 text-[11px] uppercase mb-2">
            Pagamentos no Período ({pagamentos.length})
          </p>
          {pagamentos.length === 0 ? (
            <p className="text-[11px] text-[#6E7B70]">Nenhum pagamento neste período.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {pagamentos.map((pg) => (
                <div
                  key={pg.id}
                  className="flex items-center justify-between py-1 border-b border-[#1C271E] last:border-b-0 text-[11px]"
                >
                  <div>
                    <span className="text-[#A8B3A6]">{formatDateBR(pg.data_movimento)}</span>
                    <p className="text-xs text-[#879689] uppercase">{pg.forma}</p>
                  </div>
                  <strong className="text-emerald-300 shrink-0">
                    {formatCentavos(pg.valor_centavos)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Operações de crédito se houver */}
      {creditos.length > 0 && (
        <div className="rounded-xl border border-amber-900/50 bg-[#181611] p-3 text-xs">
          <p className="font-bold text-amber-300 text-[11px] uppercase mb-1.5">
            Movimentações de Crédito ({creditos.length})
          </p>
          <div className="space-y-1">
            {creditos.map((cr) => (
              <div
                key={cr.id}
                className="flex items-center justify-between text-[11px] text-[#A8B3A6]"
              >
                <span>
                  {formatDateBR(cr.data_movimento)} -{' '}
                  <strong className="text-amber-200 uppercase">
                    {cr.tipo === 'origem'
                      ? 'Crédito gerado'
                      : cr.tipo === 'utilizacao'
                        ? 'Crédito utilizado'
                        : 'Devolução de crédito'}
                  </strong>
                </span>
                <span className="font-semibold text-white">
                  {formatCentavos(cr.valor_centavos)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FiadoRelatorios
