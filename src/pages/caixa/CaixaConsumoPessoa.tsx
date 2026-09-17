import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users, Calendar, Loader2, ShoppingBag, User, Filter } from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listRetiradasDetalhadas } from '@/services/caixa'
import { formatCentavos, formatDateBR, formatDateTimeBR, getTodayDateInput } from '@/lib/formatters'

export const CaixaConsumoPessoa = () => {
  const [searchParams] = useSearchParams()
  const inicioQuery = searchParams.get('inicio')
  const fimQuery = searchParams.get('fim')

  const navigate = useNavigate()
  const today = getTodayDateInput()
  const [dataInicio, setDataInicio] = useState(inicioQuery || today)
  const [dataFim, setDataFim] = useState(fimQuery || today)
  const [pessoaFiltro, setPessoaFiltro] = useState<string>('todos')

  const {
    data: retiradas = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['caixa-retiradas-detalhadas', dataInicio, dataFim, pessoaFiltro],
    queryFn: () => listRetiradasDetalhadas(dataInicio, dataFim, pessoaFiltro),
  })

  // Agrupamento por pessoa para resumo rápido
  const resumoPorPessoa = retiradas.reduce(
    (acc, curr) => {
      const p = curr.consumidor.trim()
      if (!acc[p]) {
        acc[p] = { total: 0, count: 0 }
      }
      acc[p].total += curr.valor_centavos
      acc[p].count += 1
      return acc
    },
    {} as Record<string, { total: number; count: number }>,
  )

  const totalGeralCentavos = retiradas.reduce((sum, r) => sum + r.valor_centavos, 0)
  const pessoasUnicas = Array.from(new Set(retiradas.map((r) => r.consumidor.trim()))).sort()

  return (
    <Layout backTo="/caixa/relatorios" backLabel="RELATÓRIOS" className="pb-12">
      {/* Cabeçalho */}
      <div>
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-[#F2B705]" />
          <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">Consumo por Pessoa</h1>
        </div>
        <p className="text-sm text-[#A8B3A6] mt-0.5">
          Detalhamento das retiradas em mercadoria para controle e acerto dos responsáveis
        </p>
      </div>

      {/* Filtros de Data */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
        <div>
          <Label htmlFor="dataInicio" className="text-xs text-[#A8B3A6]">
            Data Inicial
          </Label>
          <div className="relative mt-1">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A8B3A6]" />
            <Input
              id="dataInicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-10 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-9 text-xs text-[#F3EAD3]"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="dataFim" className="text-xs text-[#A8B3A6]">
            Data Final
          </Label>
          <div className="relative mt-1">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A8B3A6]" />
            <Input
              id="dataFim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-10 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-9 text-xs text-[#F3EAD3]"
            />
          </div>
        </div>
      </div>

      {/* Resumo Consolidado do Período */}
      <div className="mt-4 rounded-2xl border border-[#26332A] bg-gradient-to-br from-[#141B15] to-[#0B0F0C] p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A8B3A6]">
              Total de Mercadoria Retirada
            </span>
            <p className="text-2xl font-black text-yellow-300">
              {formatCentavos(totalGeralCentavos)}
            </p>
          </div>
          <span className="text-xs text-[#A8B3A6]">
            {retiradas.length} {retiradas.length === 1 ? 'retirada' : 'retiradas'}
          </span>
        </div>

        {/* Cards por Pessoa */}
        {Object.keys(resumoPorPessoa).length > 0 && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-[#1C271E] pt-3">
            {Object.entries(resumoPorPessoa).map(([pessoa, d]) => (
              <div
                key={pessoa}
                className="rounded-xl border border-[#26332A] bg-[#0B0F0C] p-2.5 text-center"
              >
                <span className="text-xs font-bold text-[#F3EAD3] block truncate">{pessoa}</span>
                <span className="text-sm font-extrabold text-yellow-300 block mt-0.5">
                  {formatCentavos(d.total)}
                </span>
                <span className="text-[10px] text-[#6E7B70]">
                  {d.count} {d.count === 1 ? 'retirada' : 'retiradas'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filtro por Pessoa */}
      {pessoasUnicas.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setPessoaFiltro('todos')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              pessoaFiltro === 'todos'
                ? 'bg-yellow-600 text-[#0B0F0C]'
                : 'border border-[#26332A] bg-[#141B15] text-[#A8B3A6] hover:bg-[#1C271E]'
            }`}
          >
            Todos ({retiradas.length})
          </button>
          {pessoasUnicas.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPessoaFiltro(p)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                pessoaFiltro === p
                  ? 'bg-yellow-600 text-[#0B0F0C]'
                  : 'border border-[#26332A] bg-[#141B15] text-[#A8B3A6] hover:bg-[#1C271E]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Lista Detalhada */}
      <div className="mt-4 space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#A8B3A6]">
          Detalhamento Cronológico
        </h2>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
            <p className="mt-3 text-sm text-[#A8B3A6]">Carregando detalhamento...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-4 text-center text-sm text-red-200">
            Erro ao carregar retiradas.
          </div>
        ) : retiradas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#26332A] p-8 text-center text-xs text-[#A8B3A6]">
            Nenhuma retirada em mercadoria encontrada para o filtro selecionado.
          </div>
        ) : (
          retiradas.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-[#26332A] bg-[#141B15] p-3.5 transition-all hover:border-[#334637]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#F3EAD3] text-sm">{r.consumidor}</span>
                    <span className="text-[10px] rounded-md bg-[#0B0F0C] border border-[#26332A] px-1.5 py-0.5 text-[#A8B3A6]">
                      {formatDateBR(r.data_movimento)}
                    </span>
                  </div>
                  <p className="text-xs text-[#A8B3A6] mt-1 break-words">{r.descricao}</p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base font-black text-yellow-300 block">
                    {formatCentavos(r.valor_centavos)}
                  </span>
                  <span className="text-[10px] text-[#6E7B70] block mt-0.5">
                    {formatDateTimeBR(r.data_registro).split(' ')[1] || ''}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-[#1C271E] pt-2 text-[10px] text-[#6E7B70]">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3 text-[#1E6B3A]" />
                  <span>Registrado por: {r.registrado_por_nome}</span>
                </div>
                <span>Reg: {formatDateTimeBR(r.data_registro)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}

export default CaixaConsumoPessoa
