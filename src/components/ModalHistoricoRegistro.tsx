import React from 'react'
import { History, Calendar, Clock, User, ArrowRight, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { formatCentavos, formatDateTimeBR, formatDateBR } from '@/lib/formatters'
import type { HistoricoAuditoria } from '@/types/fiado'

interface ModalHistoricoRegistroProps {
  aberto: boolean
  onClose: () => void
  titulo: string
  subtitulo?: string
  historico: HistoricoAuditoria[]
  isLoading?: boolean
}

const FORMAS_NOMES: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Cartão de Débito',
  cartao_credito: 'Cartão de Crédito',
}

const ORIGENS_NOMES: Record<string, string> = {
  gaveta: 'Dinheiro da Gaveta',
  conta_pix: 'Conta Bancária / Pix',
}

function formatarValorLegivel(chave: string, valor: any): string {
  if (valor === null || valor === undefined) return 'Não informado'
  if (chave.includes('centavos') || chave === 'valor') {
    return formatCentavos(Number(valor))
  }
  if (chave.includes('data_movimento') || chave === 'data') {
    return formatDateBR(String(valor))
  }
  if (chave === 'forma') {
    return FORMAS_NOMES[String(valor)] || String(valor)
  }
  if (chave === 'origem') {
    return ORIGENS_NOMES[String(valor)] || String(valor)
  }
  if (chave === 'status') {
    if (valor === 'ativo') return 'Ativo'
    if (valor === 'cancelado') return 'Cancelado'
    return String(valor)
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sim' : 'Não'
  }
  return String(valor)
}

function descreverDiferencas(antigos: Record<string, any>, novos: Record<string, any>) {
  const mudancas: Array<{ campo: string; de: string; para: string }> = []

  const chavesRelevantes: Record<string, string> = {
    valor_centavos: 'Valor',
    descricao: 'Descrição / Motivo',
    forma: 'Forma de Pagamento',
    origem: 'Origem do Recurso',
    data_movimento: 'Data do Movimento',
    consumidor: 'Consumidor / Responsável',
    status: 'Situação',
    cliente_id: 'Cliente',
    limite_centavos: 'Limite de Crédito',
    restricao_ativa: 'Restrição "Não Vender Fiado"',
    restricao_motivo: 'Motivo da Restrição',
    nome: 'Nome',
    telefone: 'Telefone',
    endereco: 'Endereço',
  }

  const todasChaves = new Set([...Object.keys(antigos || {}), ...Object.keys(novos || {})])

  for (const k of todasChaves) {
    if (chavesRelevantes[k]) {
      const vAntigo = antigos?.[k]
      const vNovo = novos?.[k]

      if (vAntigo !== vNovo) {
        mudancas.push({
          campo: chavesRelevantes[k],
          de: formatarValorLegivel(k, vAntigo),
          para: formatarValorLegivel(k, vNovo),
        })
      }
    }
  }

  return mudancas
}

export function ModalHistoricoRegistro({
  aberto,
  onClose,
  titulo,
  subtitulo,
  historico,
  isLoading,
}: ModalHistoricoRegistroProps) {
  return (
    <Dialog open={aberto} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#1E6B3A]/20 p-2 text-[#1E6B3A] border border-[#1E6B3A]/40">
              <History className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-[#F3EAD3]">
                Histórico de Alterações
              </DialogTitle>
              <DialogDescription className="text-xs text-[#A8B3A6]">
                {titulo} {subtitulo ? `• ${subtitulo}` : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-[#A8B3A6]">
              <Loader2 className="inline mr-1.5 h-4 w-4 animate-spin text-[#1E6B3A]" />
              Consultando auditoria do registro...
            </div>
          ) : historico.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#26332A] bg-[#0B0F0C] p-6 text-center text-xs text-[#879689]">
              <p>Nenhuma alteração ou cancelamento registrado para esta operação.</p>
              <p className="mt-1 text-[11px] text-[#6E7B70]">
                O registro permanece exatamente como foi lançado originalmente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map((log, idx) => {
                const antigos = (log.dados_anteriores || {}) as Record<string, any>
                const novos = (log.dados_novos || {}) as Record<string, any>
                const mudancas = descreverDiferencas(antigos, novos)
                const isCancelamento =
                  novos.status === 'cancelado' && antigos.status !== 'cancelado'

                return (
                  <div
                    key={log.id}
                    className={`rounded-xl border p-3 text-xs space-y-2 ${
                      isCancelamento
                        ? 'border-red-900/60 bg-[#191111]'
                        : 'border-[#26332A] bg-[#0B0F0C]'
                    }`}
                  >
                    {/* Cabeçalho do log: data, responsável e tipo de ação */}
                    <div className="flex items-start justify-between gap-2 border-b border-[#1C271E] pb-2">
                      <div>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            isCancelamento
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : 'bg-[#1C271E] text-emerald-300 border border-[#1E6B3A]/40'
                          }`}
                        >
                          {isCancelamento ? 'Cancelamento de Registro' : 'Edição / Correção'}
                        </span>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#A8B3A6]">
                          <User className="h-3 w-3 text-[#1E6B3A]" />
                          <span>
                            Por: <strong className="text-[#F3EAD3]">{log.alterado_por_nome}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-[#879689]">
                        <div className="flex items-center gap-1 justify-end">
                          <Calendar className="h-3 w-3 text-[#A8B3A6]" />
                          <span>{formatDateTimeBR(log.alterado_em)}</span>
                        </div>
                        <span className="text-[10px] text-[#6E7B70]">
                          Versão #{historico.length - idx}
                        </span>
                      </div>
                    </div>

                    {/* Comparação Before / After legível */}
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6E7B70]">
                        Campos Modificados:
                      </p>
                      {mudancas.length === 0 ? (
                        <p className="text-[11px] text-[#879689] italic">
                          Registro atualizado sem modificação de valores principais.
                        </p>
                      ) : (
                        mudancas.map((m, mIdx) => (
                          <div
                            key={mIdx}
                            className="rounded-lg bg-[#141B15] p-2 text-[11px] border border-[#1C271E]"
                          >
                            <span className="font-semibold text-[#A8B3A6] block mb-1">
                              • {m.campo}:
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="rounded bg-[#0B0F0C] px-2 py-0.5 text-yellow-300 font-medium line-through">
                                {m.de}
                              </span>
                              <ArrowRight className="h-3 w-3 text-[#A8B3A6] shrink-0" />
                              <span className="rounded bg-[#1C271E] px-2 py-0.5 text-emerald-300 font-bold">
                                {m.para}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Rodapé informativo: aviso de leitura pura */}
        <div className="mt-3 border-t border-[#1C271E] pt-2 text-center text-[10px] text-[#6E7B70]">
          Visualização exclusivamente informativa • Não altera saldos nem recalcula valores
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default ModalHistoricoRegistro
