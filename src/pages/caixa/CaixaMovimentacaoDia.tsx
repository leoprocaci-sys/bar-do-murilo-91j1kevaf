import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  History,
  Calendar,
  Loader2,
  TrendingUp,
  ArrowUpRight,
  Banknote,
  QrCode,
  CreditCard,
  ShoppingBag,
  RotateCcw,
  BookOpenText,
  User,
  Filter,
} from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { getMovimentacaoDia } from '@/services/caixa'
import { formatCentavos, formatDateTimeBR, getTodayDateInput } from '@/lib/formatters'
import type { MovimentacaoCaixaItem, TipoMovimentacaoCaixa } from '@/types/caixa'

export const CaixaMovimentacaoDia = () => {
  const [searchParams] = useSearchParams()
  const dataFromQuery = searchParams.get('data')

  const navigate = useNavigate()
  const [dataOperacional, setDataOperacional] = useState<string>(
    dataFromQuery || getTodayDateInput(),
  )
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  const {
    data: movimentacoes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['caixa-movimentacao', dataOperacional],
    queryFn: () => getMovimentacaoDia(dataOperacional),
  })

  // Filtro local
  const filtrados = movimentacoes.filter((m) => {
    if (filtroTipo === 'todos') return true
    if (filtroTipo === 'vendas') return m.tipo === 'venda_direta' || m.tipo === 'venda_fiada'
    if (filtroTipo === 'recebimentos') return m.tipo === 'recebimento_fiado'
    if (filtroTipo === 'saidas') return m.tipo === 'saida' || m.tipo === 'devolucao_credito'
    if (filtroTipo === 'retiradas') return m.tipo === 'retirada_mercadoria'
    if (filtroTipo === 'gaveta') return m.impacta_gaveta !== 'nenhum'
    return true
  })

  const renderIconeTipo = (tipo: TipoMovimentacaoCaixa) => {
    switch (tipo) {
      case 'dinheiro_inicial':
        return <Banknote className="h-5 w-5 text-[#1E6B3A]" />
      case 'venda_direta':
        return <TrendingUp className="h-5 w-5 text-emerald-400" />
      case 'venda_fiada':
        return <BookOpenText className="h-5 w-5 text-amber-400" />
      case 'recebimento_fiado':
        return <Banknote className="h-5 w-5 text-green-400" />
      case 'saida':
        return <ArrowUpRight className="h-5 w-5 text-red-400" />
      case 'devolucao_credito':
        return <RotateCcw className="h-5 w-5 text-cyan-400" />
      case 'retirada_mercadoria':
        return <ShoppingBag className="h-5 w-5 text-yellow-400" />
      default:
        return <History className="h-5 w-5 text-[#A8B3A6]" />
    }
  }

  const renderBadgeImpactoGaveta = (impacto?: 'positivo' | 'negativo' | 'nenhum') => {
    if (impacto === 'positivo') {
      return (
        <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px] font-semibold">
          + Entra na gaveta
        </Badge>
      )
    }
    if (impacto === 'negativo') {
      return (
        <Badge className="bg-red-950 text-red-300 border-red-800 text-[10px] font-semibold">
          − Sai da gaveta
        </Badge>
      )
    }
    return (
      <Badge className="bg-[#141B15] text-[#6E7B70] border-[#26332A] text-[10px]">
        Fora da gaveta
      </Badge>
    )
  }

  return (
    <Layout backTo={`/caixa?data=${dataOperacional}`} backLabel="CAIXA" className="pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-[#1E6B3A]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">
              Movimentação do Dia
            </h1>
          </div>
          <p className="text-sm text-[#A8B3A6] mt-0.5">
            Visão cronológica integrada das operações (sem duplicação de dados)
          </p>
        </div>

        {/* Seletor de Data */}
        <div className="flex items-center gap-2 rounded-2xl border border-[#26332A] bg-[#141B15] px-3 py-2">
          <Calendar className="h-4 w-4 text-[#A8B3A6]" />
          <Label htmlFor="dataOperacional" className="text-xs text-[#A8B3A6] shrink-0">
            Data:
          </Label>
          <Input
            id="dataOperacional"
            type="date"
            value={dataOperacional}
            onChange={(e) => setDataOperacional(e.target.value)}
            className="h-8 border-none bg-transparent p-0 text-xs font-bold text-[#F3EAD3] focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Filtros Rápidos */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'vendas', label: 'Vendas e Fiados' },
          { id: 'recebimentos', label: 'Recebimentos' },
          { id: 'saidas', label: 'Saídas & Devoluções' },
          { id: 'retiradas', label: 'Retiradas Mercadoria' },
          { id: 'gaveta', label: 'Afetam Gaveta' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltroTipo(f.id)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              filtroTipo === f.id
                ? 'bg-[#1E6B3A] text-[#F3EAD3]'
                : 'border border-[#26332A] bg-[#141B15] text-[#A8B3A6] hover:bg-[#1C271E]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da Timeline */}
      <div className="mt-5 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
            <p className="mt-3 text-sm text-[#A8B3A6]">Carregando movimentações do dia...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-4 text-center text-sm text-red-200">
            Erro ao carregar movimentações.
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#26332A] p-8 text-center text-sm text-[#A8B3A6]">
            Nenhuma movimentação encontrada para a data selecionada.
          </div>
        ) : (
          filtrados.map((item) => (
            <div
              key={`${item.tipo}-${item.id}`}
              className="rounded-2xl border border-[#26332A] bg-[#141B15] p-4 transition-all hover:border-[#334637]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B0F0C] border border-[#26332A]">
                    {renderIconeTipo(item.tipo)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-[#F3EAD3] truncate">{item.titulo}</h3>
                      {renderBadgeImpactoGaveta(item.impacta_gaveta)}
                    </div>

                    {item.subtitulo && (
                      <p className="text-xs font-semibold text-[#A8B3A6] mt-0.5">
                        {item.subtitulo}
                      </p>
                    )}

                    {item.descricao && (
                      <p className="text-xs text-[#6E7B70] mt-1 break-words">{item.descricao}</p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-lg font-black block ${
                      item.tipo === 'saida' || item.tipo === 'devolucao_credito'
                        ? 'text-red-300'
                        : item.tipo === 'retirada_mercadoria'
                          ? 'text-yellow-300'
                          : 'text-[#F3EAD3]'
                    }`}
                  >
                    {item.tipo === 'saida' || item.tipo === 'devolucao_credito' ? '− ' : '+ '}
                    {formatCentavos(item.valor_centavos)}
                  </span>
                  <span className="text-[11px] text-[#A8B3A6] block mt-0.5 font-medium">
                    {formatDateTimeBR(item.data_registro).split(' ')[1] || ''}
                  </span>
                </div>
              </div>

              {/* Rastreabilidade por usuário */}
              <div className="mt-3 flex items-center justify-between border-t border-[#1C271E] pt-2 text-[11px] text-[#6E7B70]">
                <div className="flex items-center gap-1.5 truncate">
                  <User className="h-3 w-3 text-[#1E6B3A] shrink-0" />
                  <span>Por: {item.registrado_por_nome}</span>
                </div>
                <span>Data reg: {formatDateTimeBR(item.data_registro)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}

export default CaixaMovimentacaoDia
