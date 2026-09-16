import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  User,
  ArrowRight,
} from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import {
  getCliente,
  getSituacaoFinanceiraCliente,
  validarAutorizacaoConsumo,
  registrarConsumo,
} from '@/services/fiado'
import { formatCentavos, parseBRLToCentavos, getTodayDateInput } from '@/lib/formatters'
import type { ValidacaoConsumoResult } from '@/services/fiado'

export const FiadoConsumoForm = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { appUser } = useAuth()
  const queryClient = useQueryClient()

  // Form states
  const [dataMovimento, setDataMovimento] = useState(getTodayDateInput())
  const [valorInput, setValorInput] = useState('')
  const [descricao, setDescricao] = useState('')

  // Estado de bloqueio / validação antes de confirmar
  const [, setErroValidacao] = useState<Extract<
    ValidacaoConsumoResult,
    { permitido: false }
  > | null>(null)

  // Consulta cliente
  const { data: cliente, isLoading: isLoadingCliente } = useQuery({
    queryKey: ['fiado-cliente', id],
    queryFn: () => (id ? getCliente(id) : null),
    enabled: Boolean(id),
  })

  // Consulta situação financeira atual
  const { data: situacao, isLoading: isLoadingSituacao } = useQuery({
    queryKey: ['fiado-situacao', id],
    queryFn: () => (cliente ? getSituacaoFinanceiraCliente(cliente) : null),
    enabled: Boolean(cliente),
  })

  const registrarMutation = useMutation({
    mutationFn: async () => {
      if (!appUser?.id) throw new Error('Usuário autenticado não encontrado.')
      if (!cliente || !situacao) throw new Error('Dados do cliente não carregados.')

      const valorCentavos = parseBRLToCentavos(valorInput)
      if (valorCentavos <= 0) {
        throw new Error('Informe um valor de consumo válido e maior que zero.')
      }

      if (!dataMovimento) {
        throw new Error('Informe a data do consumo.')
      }

      // Validação estrita de autorização
      const validacao = validarAutorizacaoConsumo(situacao, valorCentavos)
      if (!validacao.permitido) {
        const erroInvalido = validacao as Extract<ValidacaoConsumoResult, { permitido: false }>
        setErroValidacao(erroInvalido)
        throw new Error(erroInvalido.mensagem)
      }

      // Se passou na validação, executa o registro
      return await registrarConsumo(
        {
          cliente_id: cliente.id,
          valor_centavos: valorCentavos,
          data_movimento: dataMovimento,
          descricao,
        },
        appUser.id,
      )
    },
    onSuccess: (novoConsumo) => {
      queryClient.invalidateQueries({ queryKey: ['fiado-situacao', id] })
      queryClient.invalidateQueries({ queryKey: ['fiado-historico', id] })
      queryClient.invalidateQueries({ queryKey: ['fiado-clientes'] })

      toast({
        title: 'Consumo registrado!',
        description: `Lançado ${formatCentavos(novoConsumo.valor_centavos)} para ${cliente?.nome}.`,
      })
      navigate(`/fiado/cliente/${id}`, { replace: true })
    },
    onError: (err: any) => {
      toast({
        title: 'Lançamento não autorizado',
        description: err.message || 'Verifique as regras de limite e restrição.',
        variant: 'destructive',
      })
    },
  })

  // Atalhos rápidos para descrição no balcão
  const sugestoesDescricao = [
    '3 cervejas lata',
    'Cerveja 600ml + porção',
    'Dose + refrigerante',
    'Almoço / Refeição',
    'Consumo do dia',
  ]

  if (isLoadingCliente || isLoadingSituacao || !cliente) {
    return (
      <Layout
        backTo={`/fiado/cliente/${id}`}
        backLabel="VOLTAR"
        className="items-center justify-center py-20"
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
        <p className="mt-3 text-sm text-[#A8B3A6]">Carregando dados do cliente...</p>
      </Layout>
    )
  }

  // Atalho para testar valor em tempo real
  const valorDigitadoCentavos = parseBRLToCentavos(valorInput)
  const previewValidacao =
    situacao && valorDigitadoCentavos > 0
      ? validarAutorizacaoConsumo(situacao, valorDigitadoCentavos)
      : null

  return (
    <Layout backTo={`/fiado/cliente/${cliente.id}`} backLabel="CANCELAR" className="pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">Registrar Consumo</h1>
          <p className="text-sm font-semibold text-[#1E6B3A]">
            Cliente: {cliente.nome} {cliente.apelido ? `("${cliente.apelido}")` : ''}
          </p>
        </div>
      </div>

      {/* BLOCO DE REGRAS PREVENTIVAS / SITUAÇÃO DO CLIENTE */}
      {cliente.restricao_ativa ? (
        <div className="mt-4 rounded-2xl border-2 border-red-700 bg-red-950/40 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-base font-extrabold uppercase text-red-100">
                Cliente com Restrição "Não Vender Fiado"
              </p>
              <p className="mt-1 text-xs text-red-300">
                A restrição manual ativa impede qualquer novo lançamento fiado.
              </p>
              {cliente.restricao_motivo && (
                <div className="mt-2 rounded-xl bg-red-950/80 p-2.5 text-xs text-red-200 border border-red-800">
                  <span className="font-bold text-red-400">Motivo informado: </span>"
                  {cliente.restricao_motivo}"
                </div>
              )}
            </div>
          </div>
        </div>
      ) : cliente.limite_centavos === 0 ? (
        <div className="mt-4 rounded-2xl border border-yellow-800 bg-yellow-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold uppercase text-yellow-200">
                Limite R$ 0,00 — Não Autorizado
              </p>
              <p className="mt-1 text-xs text-yellow-300/80">
                Este cliente está cadastrado com limite R$ 0,00 e não pode fazer compras fiadas.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Resumo rápido do saldo e limite para quem está no balcão */
        <div className="mt-4 rounded-2xl border border-[#26332A] bg-[#141B15] p-3 text-xs">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[#0B0F0C] p-2">
              <span className="text-[10px] text-[#A8B3A6] block">Dívida Atual</span>
              <span className="font-bold text-red-300">
                {formatCentavos(situacao?.totalDividaCentavos)}
              </span>
            </div>
            <div className="rounded-xl bg-[#0B0F0C] p-2">
              <span className="text-[10px] text-[#A8B3A6] block">Crédito Disponível</span>
              <span className="font-bold text-emerald-300">
                {formatCentavos(situacao?.totalCreditoDisponivelCentavos)}
              </span>
            </div>
            <div className="rounded-xl bg-[#0B0F0C] p-2">
              <span className="text-[10px] text-[#A8B3A6] block">Limite Restante</span>
              <span className="font-bold text-[#F3EAD3]">
                {situacao?.limiteCentavos === null
                  ? 'Sem limite'
                  : formatCentavos(situacao?.disponivelParaFiadoCentavos)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* FORMULÁRIO RÁPIDO DE CONSUMO */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          registrarMutation.mutate()
        }}
        className="mt-5 space-y-5"
      >
        {/* Campo de Valor em Centavos / Reais */}
        <div className="space-y-1.5 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <Label htmlFor="valorConsumo" className="text-sm font-bold text-[#F3EAD3]">
            Valor do Consumo (R$) *
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-extrabold text-[#1E6B3A]">
              R$
            </span>
            <Input
              id="valorConsumo"
              type="text"
              inputMode="decimal"
              required
              autoFocus
              value={valorInput}
              onChange={(e) => {
                setValorInput(e.target.value)
                setErroValidacao(null)
              }}
              placeholder="0,00"
              className="h-16 rounded-2xl border-[#26332A] bg-[#0B0F0C] pl-14 text-3xl font-extrabold text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
            />
          </div>

          {/* Feedback em tempo real do limite */}
          {previewValidacao &&
            !previewValidacao.permitido &&
            (() => {
              const invalidResult = previewValidacao as Extract<
                ValidacaoConsumoResult,
                { permitido: false }
              >
              return (
                <div className="mt-3 rounded-xl border border-red-900/80 bg-red-950/50 p-3 text-xs text-red-200">
                  <div className="flex items-center gap-1.5 font-bold text-red-300">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <span>Bloqueio de autorização:</span>
                  </div>
                  <p className="mt-1 font-medium">{invalidResult.mensagem}</p>

                  {invalidResult.detalhes && (
                    <div className="mt-2 space-y-0.5 border-t border-red-900/60 pt-2 text-[11px] text-red-300/90">
                      <div className="flex justify-between">
                        <span>Limite total do cliente:</span>
                        <strong className="text-white">
                          {formatCentavos(invalidResult.detalhes.limiteCentavos)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Dívida comprometendo limite:</span>
                        <span>{formatCentavos(invalidResult.detalhes.comprometidoCentavos)}</span>
                      </div>
                      {invalidResult.detalhes.creditoCentavos > 0 && (
                        <div className="flex justify-between text-emerald-300">
                          <span>Crédito amortizado antes do limite:</span>
                          <span>- {formatCentavos(invalidResult.detalhes.creditoCentavos)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-red-200 pt-1 border-t border-red-900/40">
                        <span>Valor que ultrapassa:</span>
                        <span className="text-red-400">
                          + {formatCentavos(invalidResult.detalhes.excedenteCentavos)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
        </div>

        {/* Data do Consumo (Movimento) x Data do Registro */}
        <div className="space-y-1.5 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dataConsumo" className="text-sm font-semibold text-[#F3EAD3]">
              Data do Consumo *
            </Label>
            <span className="text-[11px] text-[#A8B3A6]">Permite retroativo</span>
          </div>

          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B3A6]" />
            <Input
              id="dataConsumo"
              type="date"
              required
              value={dataMovimento}
              onChange={(e) => setDataMovimento(e.target.value)}
              className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
            />
          </div>
          <p className="text-[11px] text-[#6E7B70]">
            A data real do registro será salva automaticamente com data/hora do sistema.
          </p>
        </div>

        {/* Descrição do que foi consumido */}
        <div className="space-y-2 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <Label htmlFor="descricaoConsumo" className="text-sm font-semibold text-[#F3EAD3]">
            Descrição do Consumo (opcional)
          </Label>
          <div className="relative">
            <FileText className="absolute left-3.5 top-3.5 h-4 w-4 text-[#A8B3A6]" />
            <Input
              id="descricaoConsumo"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: 3 cervejas, porção, almoço..."
              className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
            />
          </div>

          {/* Atalhos com 1 toque */}
          <div className="pt-1">
            <p className="text-[11px] text-[#879689] mb-1.5">Atalhos rápidos para o balcão:</p>
            <div className="flex flex-wrap gap-1.5">
              {sugestoesDescricao.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => setDescricao(sugestao)}
                  className="rounded-lg border border-[#26332A] bg-[#0B0F0C] px-2.5 py-1 text-xs text-[#A8B3A6] transition-colors hover:border-[#1E6B3A] hover:text-[#F3EAD3]"
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Responsável pelo Registro (Preenchimento automático do usuário logado) */}
        <div className="flex items-center justify-between rounded-xl border border-[#26332A] bg-[#0B0F0C] px-4 py-3 text-xs text-[#A8B3A6]">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#1E6B3A]" />
            <span>Responsável pelo lançamento:</span>
          </div>
          <strong className="text-[#F3EAD3] font-semibold">
            {appUser?.nome} ({appUser?.username})
          </strong>
        </div>

        {/* Botão de Confirmação */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={
              registrarMutation.isPending ||
              cliente.restricao_ativa ||
              cliente.limite_centavos === 0 ||
              (previewValidacao !== null && !previewValidacao.permitido)
            }
            className="h-16 w-full rounded-2xl bg-[#1E6B3A] text-xl font-bold tracking-wide text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.98] shadow-lg shadow-[#1E6B3A]/25 disabled:bg-[#1C271E] disabled:text-[#6E7B70] disabled:cursor-not-allowed"
          >
            {registrarMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                CONFIRMANDO...
              </>
            ) : (
              <>
                CONFIRMAR CONSUMO FIADO
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </Layout>
  )
}

export default FiadoConsumoForm
