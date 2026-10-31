import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  Calendar,
  Loader2,
  TrendingUp,
  ArrowUpRight,
  Banknote,
  QrCode,
  CreditCard,
  ShoppingBag,
  Info,
  Users,
  Printer,
} from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getRelatorioCaixa } from '@/services/caixa'
import { formatCentavos, getTodayDateInput } from '@/lib/formatters'
import type { PeriodoRelatorio } from '@/types/caixa'

export const CaixaRelatorios = () => {
  const [searchParams] = useSearchParams()
  const dataFromQuery = searchParams.get('data')

  const navigate = useNavigate()
  const [dataBase, setDataBase] = useState<string>(dataFromQuery || getTodayDateInput())
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>('dia')

  const {
    data: relatorio,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['caixa-relatorios', periodo, dataBase],
    queryFn: () => getRelatorioCaixa(periodo, dataBase),
  })

  return (
    <Layout backTo={`/caixa?data=${dataBase}`} backLabel="CAIXA" className="pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#F2B705]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">
              Relatórios Financeiros
            </h1>
          </div>
          <p className="text-sm text-[#A8B3A6] mt-0.5">
            Consolidação por fontes transacionais (Dia, Semana seg-dom, Mês)
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

        {/* Seletor de Data Base */}
        <div className="flex items-center gap-2 rounded-2xl border border-[#26332A] bg-[#141B15] px-3 py-2">
          <Calendar className="h-4 w-4 text-[#A8B3A6]" />
          <Label htmlFor="dataBase" className="text-xs text-[#A8B3A6] shrink-0">
            Referência:
          </Label>
          <Input
            id="dataBase"
            type="date"
            value={dataBase}
            onChange={(e) => setDataBase(e.target.value)}
            className="h-8 border-none bg-transparent p-0 text-xs font-bold text-[#F3EAD3] focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Seletor de Período (Dia, Semana, Mês) */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setPeriodo('dia')}
          className={`h-12 rounded-2xl font-bold text-sm transition-all ${
            periodo === 'dia'
              ? 'bg-[#1E6B3A] text-[#F3EAD3] shadow-md shadow-[#1E6B3A]/20'
              : 'border border-[#26332A] bg-[#141B15] text-[#A8B3A6] hover:bg-[#1C271E]'
          }`}
        >
          DIA
        </button>
        <button
          type="button"
          onClick={() => setPeriodo('semana')}
          className={`h-12 rounded-2xl font-bold text-sm transition-all ${
            periodo === 'semana'
              ? 'bg-[#1E6B3A] text-[#F3EAD3] shadow-md shadow-[#1E6B3A]/20'
              : 'border border-[#26332A] bg-[#141B15] text-[#A8B3A6] hover:bg-[#1C271E]'
          }`}
        >
          SEMANA
        </button>
        <button
          type="button"
          onClick={() => setPeriodo('mes')}
          className={`h-12 rounded-2xl font-bold text-sm transition-all ${
            periodo === 'mes'
              ? 'bg-[#1E6B3A] text-[#F3EAD3] shadow-md shadow-[#1E6B3A]/20'
              : 'border border-[#26332A] bg-[#141B15] text-[#A8B3A6] hover:bg-[#1C271E]'
          }`}
        >
          MÊS
        </button>
      </div>

      {/* Título do Intervalo */}
      {relatorio && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-[#26332A] bg-[#0B0F0C] px-4 py-2.5 text-xs">
          <span className="text-[#A8B3A6]">Período consultado:</span>
          <strong className="text-[#F2B705] font-bold">{relatorio.tituloPeriodo}</strong>
        </div>
      )}

      {/* Cabeçalho impresso oficial */}
      {relatorio && (
        <div className="hidden print:block my-4 border-b border-black pb-2 text-black">
          <h2 className="text-lg font-bold">Bar do Murilo — Relatório de Caixa</h2>
          <p className="text-xs">
            Período: {relatorio.tituloPeriodo} | Emissão: {new Date().toLocaleDateString('pt-BR')}{' '}
            às {new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>
      )}

      {/* Conteúdo do Relatório */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
          <p className="mt-3 text-sm text-[#A8B3A6]">Processando dados do período...</p>
        </div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-red-900/60 bg-red-950/30 p-4 text-center text-sm text-red-200">
          Erro ao processar relatório.
        </div>
      ) : !relatorio ? null : (
        <div className="mt-5 space-y-4">
          {/* SEÇÃO 1: VENDAS E CONSUMOS */}
          <div className="rounded-[24px] border border-[#26332A] bg-[#141B15] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <h2 className="text-base font-bold text-[#F3EAD3]">VENDAS E CONSUMOS</h2>
              </div>
              <span className="text-xl font-black text-emerald-300">
                {formatCentavos(relatorio.vendasEConsumos.total)}
              </span>
            </div>
            <p className="text-xs text-[#A8B3A6] mt-1">
              Movimento econômico total de produtos vendidos e mercadorias consumidas
            </p>

            <div className="mt-4 space-y-2 border-t border-[#1C271E] pt-3 text-xs">
              <div className="flex justify-between text-[#F3EAD3] font-semibold">
                <span>Vendas Diretas no Balcão:</span>
                <span>{formatCentavos(relatorio.vendasEConsumos.totalVendasDiretas)}</span>
              </div>
              <div className="pl-3 space-y-1 text-[11px] text-[#A8B3A6]">
                <div className="flex justify-between">
                  <span>• Dinheiro:</span>
                  <span>{formatCentavos(relatorio.vendasEConsumos.vendasDiretasDinheiro)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Pix:</span>
                  <span>{formatCentavos(relatorio.vendasEConsumos.vendasDiretasPix)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Cartão Débito:</span>
                  <span>{formatCentavos(relatorio.vendasEConsumos.vendasDiretasDebito)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Cartão Crédito:</span>
                  <span>{formatCentavos(relatorio.vendasEConsumos.vendasDiretasCredito)}</span>
                </div>
              </div>

              <div className="flex justify-between text-[#F3EAD3] font-semibold pt-1 border-t border-[#1C271E]/60">
                <span>Vendas Fiadas Realizadas (Caderno):</span>
                <span className="text-amber-300">
                  {formatCentavos(relatorio.vendasEConsumos.vendasFiadas)}
                </span>
              </div>

              <div className="flex justify-between text-[#F3EAD3] font-semibold pt-1 border-t border-[#1C271E]/60">
                <span>Retiradas / Consumos dos Responsáveis:</span>
                <span className="text-yellow-300">
                  {formatCentavos(relatorio.vendasEConsumos.retiradasMercadoria)}
                </span>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: RECEBIMENTOS DE FIADO (SEPARADOS DE VENDAS) */}
          <div className="rounded-[24px] border border-[#26332A] bg-[#141B15] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-400" />
                <h2 className="text-base font-bold text-[#F3EAD3]">RECEBIMENTOS DE FIADO</h2>
              </div>
              <span className="text-xl font-black text-green-300">
                {formatCentavos(relatorio.recebimentosFiado.total)}
              </span>
            </div>
            <p className="text-xs text-[#A8B3A6] mt-1">
              Quitações de fiados anteriores (não somam em vendas para evitar duplicidade)
            </p>

            <div className="mt-4 space-y-1.5 border-t border-[#1C271E] pt-3 text-xs">
              <div className="flex justify-between text-[#A8B3A6]">
                <span>Dinheiro (entrou na gaveta):</span>
                <strong className="text-[#F3EAD3]">
                  {formatCentavos(relatorio.recebimentosFiado.dinheiro)}
                </strong>
              </div>
              <div className="flex justify-between text-[#A8B3A6]">
                <span>Pix:</span>
                <strong className="text-[#F3EAD3]">
                  {formatCentavos(relatorio.recebimentosFiado.pix)}
                </strong>
              </div>
              <div className="flex justify-between text-[#A8B3A6]">
                <span>Cartão de Débito:</span>
                <strong className="text-[#F3EAD3]">
                  {formatCentavos(relatorio.recebimentosFiado.cartaoDebito)}
                </strong>
              </div>
              <div className="flex justify-between text-[#A8B3A6]">
                <span>Cartão de Crédito:</span>
                <strong className="text-[#F3EAD3]">
                  {formatCentavos(relatorio.recebimentosFiado.cartaoCredito)}
                </strong>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: SAÍDAS EM DINHEIRO / CONTA */}
          <div className="rounded-[24px] border border-[#26332A] bg-[#141B15] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-red-400" />
                <h2 className="text-base font-bold text-[#F3EAD3]">SAÍDAS EM DINHEIRO / CONTA</h2>
              </div>
              <span className="text-xl font-black text-red-300">
                {formatCentavos(relatorio.saidasFinanceiras.total)}
              </span>
            </div>
            <p className="text-xs text-[#A8B3A6] mt-1">
              Despesas operacionais e devoluções de crédito realizadas
            </p>

            <div className="mt-4 space-y-2 border-t border-[#1C271E] pt-3 text-xs">
              <div className="flex justify-between text-[#A8B3A6]">
                <span>Saídas da Gaveta (dinheiro físico):</span>
                <strong className="text-red-300">
                  {formatCentavos(relatorio.saidasFinanceiras.gaveta)}
                </strong>
              </div>
              <div className="flex justify-between text-[#A8B3A6]">
                <span>Saídas por Conta / Pix:</span>
                <strong className="text-[#F3EAD3]">
                  {formatCentavos(relatorio.saidasFinanceiras.contaPix)}
                </strong>
              </div>
              <div className="flex justify-between text-[#A8B3A6]">
                <span>Devoluções de Crédito em Dinheiro:</span>
                <strong className="text-red-300">
                  {formatCentavos(relatorio.saidasFinanceiras.devolucaoGaveta)}
                </strong>
              </div>
              <div className="flex justify-between text-[#A8B3A6]">
                <span>Devoluções de Crédito por Conta / Pix:</span>
                <strong className="text-[#F3EAD3]">
                  {formatCentavos(relatorio.saidasFinanceiras.devolucaoContaPix)}
                </strong>
              </div>
            </div>
          </div>

          {/* SEÇÃO 4: RETIRADAS EM MERCADORIA POR PESSOA */}
          <div className="rounded-[24px] border border-[#26332A] bg-[#141B15] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#F2B705]" />
                <h2 className="text-base font-bold text-[#F3EAD3]">
                  RETIRADAS EM MERCADORIA POR PESSOA
                </h2>
              </div>
              <span className="text-xl font-black text-yellow-300">
                {formatCentavos(relatorio.retiradasMercadoria.total)}
              </span>
            </div>
            <p className="text-xs text-[#A8B3A6] mt-1">
              Acompanhamento e acerto entre os responsáveis (Murilo, Esther, Danny, etc.)
            </p>

            {relatorio.retiradasMercadoria.porPessoa.length === 0 ? (
              <p className="mt-4 border-t border-[#1C271E] pt-3 text-xs text-[#6E7B70] text-center">
                Nenhuma retirada registrada no período.
              </p>
            ) : (
              <div className="mt-4 space-y-2 border-t border-[#1C271E] pt-3">
                {relatorio.retiradasMercadoria.porPessoa.map((p) => (
                  <div
                    key={p.consumidor}
                    className="flex items-center justify-between rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#F3EAD3]">{p.consumidor}</p>
                      <p className="text-[10px] text-[#A8B3A6]">
                        {p.quantidade} {p.quantidade === 1 ? 'retirada' : 'retiradas'}
                      </p>
                    </div>
                    <span className="font-black text-yellow-300 text-sm">
                      {formatCentavos(p.totalCentavos)}
                    </span>
                  </div>
                ))}

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      navigate(
                        `/caixa/consumo-pessoa?inicio=${relatorio.dataInicio}&fim=${relatorio.dataFim}`,
                      )
                    }
                    className="w-full text-xs font-bold text-[#F2B705] hover:bg-[#1C271E]"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    VER DETALHAMENTO COMPLETO POR PESSOA
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO 5: INFORMAÇÃO COMPLEMENTAR — CRÉDITO UTILIZADO */}
          <div className="rounded-2xl border border-[#26332A] bg-[#0B0F0C] p-4 text-xs text-[#A8B3A6]">
            <div className="flex items-center gap-2 font-bold text-[#F3EAD3]">
              <Info className="h-4 w-4 text-cyan-400 shrink-0" />
              <span>INFORMAÇÃO COMPLEMENTAR (NÃO DUPLICADA)</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Crédito interno utilizado por clientes em consumos fiados:</span>
              <strong className="text-cyan-300 font-bold text-sm">
                {formatCentavos(relatorio.creditoUtilizadoCentavos)}
              </strong>
            </div>
            <p className="mt-1 text-[11px] text-[#6E7B70]">
              * Nota metodológica: este valor já abateu dívida de consumo original; não é somado
              novamente a vendas, recebimentos ou dinheiro em caixa para garantir rigor contábil.
            </p>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default CaixaRelatorios
