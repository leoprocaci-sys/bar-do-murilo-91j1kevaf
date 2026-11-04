import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, FileText, CheckCircle2 } from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  getComanda,
  getItensComanda,
  getPagamentosComanda,
  identificacaoComandaTexto,
} from '@/services/comandas'
import { formatCentavos, formatDateTimeBR } from '@/lib/formatters'
import type { FormaParcela } from '@/types/comandas'

const LABEL_FORMA: Record<FormaParcela, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  fiado: 'Fiado',
}

export const ComandaPrevia = () => {
  const { id: comandaId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const comandaQuery = useQuery({
    queryKey: ['comanda', comandaId],
    queryFn: () => getComanda(comandaId!),
  })
  const itensQuery = useQuery({
    queryKey: ['comanda-itens', comandaId],
    queryFn: () => getItensComanda(comandaId!),
  })
  const pagamentosQuery = useQuery({
    queryKey: ['comanda-pagamentos', comandaId],
    queryFn: () => getPagamentosComanda(comandaId!),
  })

  const comanda = comandaQuery.data
  const itens = (itensQuery.data ?? []).filter((i) => i.status === 'ativo')
  const pagamentos = (pagamentosQuery.data ?? []).filter((p) => p.status === 'ativo')

  const totalConsumido = itens.reduce((acc, i) => acc + i.subtotal_centavos, 0)
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor_centavos, 0)
  const saldo = totalConsumido - totalPago

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
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[#F3EAD3]">
          <FileText className="h-6 w-6 text-[#1E6B3A]" /> PRÉVIA
        </h1>
        <p className="text-sm text-[#A8B3A6]">{identificacaoComandaTexto(comanda)}</p>
      </header>

      <div className="mt-4 rounded-2xl border border-[#26332A] bg-[#0B0F0C] p-4 font-mono text-sm">
        <p className="mb-3 text-center font-bold tracking-widest text-[#F3EAD3]">
          COMANDA — {identificacaoComandaTexto(comanda).toUpperCase()}
        </p>
        <div className="space-y-2">
          {itens.length === 0 && <p className="text-center text-[#A8B3A6]">Sem itens lançados.</p>}
          {itens.map((i) => (
            <div key={i.id} className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[#F3EAD3]">
                {i.quantidade} {i.produto_nome}
              </span>
              <span className="shrink-0 text-[#F3EAD3]">
                {'.'.repeat(Math.max(2, 24 - i.produto_nome.length - String(i.quantidade).length))}
              </span>
              <span className="shrink-0 font-bold text-[#F3EAD3]">
                {formatCentavos(i.subtotal_centavos)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-dashed border-[#334637] pt-3">
          <div className="flex justify-between font-bold">
            <span className="text-[#F3EAD3]">TOTAL</span>
            <span className="text-[#F3EAD3]">{formatCentavos(totalConsumido)}</span>
          </div>
        </div>
      </div>

      {pagamentos.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6E7B70]">
            Pagamentos já registrados nesta abertura
          </h2>
          <div className="space-y-1.5">
            {pagamentos.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-[#26332A] bg-[#141B15] px-3 py-2 text-sm"
              >
                <span className="text-[#A8B3A6]">{LABEL_FORMA[p.forma]}</span>
                <span className="font-bold text-[#1E6B3A]">{formatCentavos(p.valor_centavos)}</span>
              </div>
            ))}
            <div className="flex justify-between px-3 pt-1 text-sm font-bold">
              <span className="text-[#A8B3A6]">Total pago</span>
              <span className="text-[#1E6B3A]">{formatCentavos(totalPago)}</span>
            </div>
          </div>
        </section>
      )}

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#F2B705]/40 bg-[#F2B705]/10 px-4 py-3">
        <span className="font-bold text-[#F2B705]">Saldo ainda não acertado</span>
        <span className="text-2xl font-extrabold text-[#F2B705]">{formatCentavos(saldo)}</span>
      </div>

      <div className="mt-3 rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3 text-xs text-[#A8B3A6]">
        <p>
          • A PRÉVIA é apenas leitura: não fecha a comanda, não registra recebimento, não cria
          dívida nem altera Caixa/Fiado.
        </p>
        <p>• Pode ser consultada quantas vezes quiser.</p>
        <p>
          • Comanda nº {comanda.numero} · {formatDateTimeBR(comanda.data_abertura)}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-14 rounded-2xl border-[#26332A] bg-[#141B15] font-bold text-[#F3EAD3]"
          onClick={() => navigate(`/comandas/${comandaId}`)}
        >
          VOLTAR / CONTINUAR CONSUMO
        </Button>
        <Button
          type="button"
          className="h-14 rounded-2xl bg-[#1E6B3A] font-bold text-[#F3EAD3] hover:bg-[#25814A]"
          onClick={() => navigate(`/comandas/${comandaId}/fechamento`)}
          disabled={comanda.status !== 'aberta' || totalConsumido <= 0}
        >
          FECHAR COMANDA
        </Button>
      </div>
    </Layout>
  )
}

export default ComandaPrevia
