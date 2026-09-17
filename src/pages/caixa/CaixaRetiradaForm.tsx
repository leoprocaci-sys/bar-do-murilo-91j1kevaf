import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingBag, Calendar, User, ArrowRight, Loader2, Check, Plus } from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { listAppUsers } from '@/services/app-users'
import { registrarRetiradaMercadoria } from '@/services/caixa'
import { formatCentavos, parseBRLToCentavos, getTodayDateInput } from '@/lib/formatters'

export const CaixaRetiradaForm = () => {
  const [searchParams] = useSearchParams()
  const dataFromQuery = searchParams.get('data')

  const navigate = useNavigate()
  const { toast } = useToast()
  const { appUser } = useAuth()
  const queryClient = useQueryClient()

  const [dataMovimento, setDataMovimento] = useState(dataFromQuery || getTodayDateInput())
  const [valorInput, setValorInput] = useState('')
  const [consumidor, setConsumidor] = useState('')
  const [outroNome, setOutroNome] = useState('')
  const [usarOutro, setUsarOutro] = useState(false)
  const [descricao, setDescricao] = useState('')

  const valorCentavos = parseBRLToCentavos(valorInput)

  // Lista de usuários autorizados do sistema para sugestão dinâmica
  const { data: usuarios = [] } = useQuery({
    queryKey: ['app-users-retiradas'],
    queryFn: () => listAppUsers(),
  })

  // Consumidores autorizados frequentes do bar
  const sugestoesResponsaveis = usuarios.filter((u) => u.ativo).map((u) => u.nome)

  const consumidorFinal = usarOutro ? outroNome.trim() : consumidor.trim()

  const retiradaMutation = useMutation({
    mutationFn: async () => {
      if (!appUser?.id) throw new Error('Usuário autenticado não encontrado.')
      if (valorCentavos <= 0) {
        throw new Error('Informe um valor maior que zero.')
      }
      if (!consumidorFinal) {
        throw new Error('Selecione ou informe quem consumiu a mercadoria.')
      }
      if (!descricao.trim()) {
        throw new Error('A descrição da mercadoria é obrigatória.')
      }

      return await registrarRetiradaMercadoria(
        {
          valor_centavos: valorCentavos,
          consumidor: consumidorFinal,
          descricao: descricao.trim(),
          data_movimento: dataMovimento,
        },
        appUser.id,
      )
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['caixa-resumo-dia', dataMovimento] })
      queryClient.invalidateQueries({ queryKey: ['caixa-movimentacao', dataMovimento] })
      queryClient.invalidateQueries({ queryKey: ['caixa-relatorios'] })

      toast({
        title: 'Retirada em Mercadoria Registrada',
        description: `Consumo de ${formatCentavos(res.valor_centavos)} para ${res.consumidor}. Não movimenta dinheiro; integra Vendas e Consumos.`,
      })

      navigate(`/caixa?data=${dataMovimento}`, { replace: true })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao registrar retirada',
        description: err.message || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (valorCentavos <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor maior que zero.',
        variant: 'destructive',
      })
      return
    }
    if (!consumidorFinal) {
      toast({
        title: 'Consumidor obrigatório',
        description: 'Informe quem consumiu a mercadoria.',
        variant: 'destructive',
      })
      return
    }
    if (!descricao.trim()) {
      toast({
        title: 'Descrição obrigatória',
        description: 'Informe o que foi consumido.',
        variant: 'destructive',
      })
      return
    }
    retiradaMutation.mutate()
  }

  return (
    <Layout backTo={`/caixa?data=${dataMovimento}`} backLabel="CANCELAR" className="pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">Retirada em Mercadoria</h1>
        <p className="text-sm text-[#A8B3A6]">
          Consumo próprio dos responsáveis (Murilo, Esther, Danny ou outros autorizados)
        </p>
      </div>

      {/* Regra financeira informativa */}
      <div className="mt-4 rounded-2xl border border-yellow-800/60 bg-yellow-950/20 p-3.5 text-xs text-yellow-200">
        <p className="font-bold text-yellow-300">REGRA FINANCEIRA:</p>
        <p className="mt-1">
          • <strong>Não movimenta dinheiro:</strong> não entra nem sai da gaveta, não gera Pix nem
          cartão.
        </p>
        <p className="mt-0.5">
          • <strong>Não gera dívida no fiado:</strong> não entra no caderno dos clientes.
        </p>
        <p className="mt-0.5">
          • Integra <strong>Vendas e Consumos</strong> e o indicador específico de{' '}
          <strong>Retiradas em Mercadoria</strong>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        {/* Campo: Valor */}
        <div className="space-y-2 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <Label htmlFor="valorRetirada" className="text-sm font-bold text-[#F3EAD3]">
            Valor da Mercadoria Retirada (R$) *
          </Label>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-extrabold text-[#F2B705]">
              R$
            </span>
            <Input
              id="valorRetirada"
              type="text"
              inputMode="decimal"
              required
              autoFocus
              value={valorInput}
              onChange={(e) => setValorInput(e.target.value)}
              placeholder="0,00"
              className="h-16 rounded-2xl border-[#26332A] bg-[#0B0F0C] pl-14 text-3xl font-extrabold text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
            />
          </div>

          {valorCentavos > 0 && (
            <p className="text-xs text-[#A8B3A6]">
              Consumo econômico:{' '}
              <strong className="text-yellow-300">{formatCentavos(valorCentavos)}</strong>
            </p>
          )}
        </div>

        {/* Campo: Quem Consumiu (Pessoa) */}
        <div className="space-y-2 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <Label className="text-sm font-bold text-[#F3EAD3]">Quem Consumiu / Retirou? *</Label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {sugestoesResponsaveis.map((nome) => {
              const isSelected = !usarOutro && consumidor === nome
              return (
                <button
                  key={nome}
                  type="button"
                  onClick={() => {
                    setConsumidor(nome)
                    setUsarOutro(false)
                  }}
                  className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                      : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
                  }`}
                >
                  <span className="text-sm font-bold truncate">{nome}</span>
                  {isSelected && <Check className="h-4 w-4 text-[#1E6B3A] shrink-0" />}
                </button>
              )
            })}

            {/* Opção Outro */}
            <button
              type="button"
              onClick={() => {
                setUsarOutro(true)
                setConsumidor('')
              }}
              className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                usarOutro
                  ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                  : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Plus className="h-4 w-4 text-[#1E6B3A] shrink-0" />
                <span className="text-sm font-bold">Outro...</span>
              </div>
              {usarOutro && <Check className="h-4 w-4 text-[#1E6B3A] shrink-0" />}
            </button>
          </div>

          {usarOutro && (
            <div className="mt-3">
              <Input
                type="text"
                required
                autoFocus
                value={outroNome}
                onChange={(e) => setOutroNome(e.target.value)}
                placeholder="Digite o nome da pessoa responsável..."
                className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
              />
            </div>
          )}
        </div>

        {/* Campo: Descrição da Mercadoria (Obrigatória) */}
        <div className="space-y-1.5 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <Label htmlFor="descricaoRetirada" className="text-sm font-semibold text-[#F3EAD3]">
            O que foi retirado / consumido? *
          </Label>
          <Input
            id="descricaoRetirada"
            type="text"
            required
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: 2 cervejas Heineken, 1 porção de batata, refrigerante..."
            className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
          />
        </div>

        {/* Data do Movimento */}
        <div className="space-y-1.5 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dataRetirada" className="text-sm font-semibold text-[#F3EAD3]">
              Data da Retirada *
            </Label>
            <span className="text-[11px] text-[#A8B3A6]">Data operacional</span>
          </div>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B3A6]" />
            <Input
              id="dataRetirada"
              type="date"
              required
              value={dataMovimento}
              onChange={(e) => setDataMovimento(e.target.value)}
              className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
            />
          </div>
        </div>

        {/* Responsável pelo Registro */}
        <div className="flex items-center justify-between rounded-xl border border-[#26332A] bg-[#0B0F0C] px-4 py-3 text-xs text-[#A8B3A6]">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#1E6B3A]" />
            <span>Responsável pelo registro:</span>
          </div>
          <strong className="text-[#F3EAD3] font-semibold">
            {appUser?.nome} ({appUser?.username})
          </strong>
        </div>

        {/* Botão de Envio */}
        <Button
          type="submit"
          disabled={
            retiradaMutation.isPending ||
            valorCentavos <= 0 ||
            !consumidorFinal ||
            !descricao.trim()
          }
          className="h-16 w-full rounded-2xl bg-yellow-600 text-xl font-bold tracking-wide text-[#0B0F0C] hover:bg-yellow-500 active:scale-[0.98] shadow-lg shadow-yellow-900/25 disabled:bg-[#1C271E] disabled:text-[#6E7B70]"
        >
          {retiradaMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              REGISTRANDO RETIRADA...
            </>
          ) : (
            <>
              SALVAR RETIRADA EM MERCADORIA
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </form>
    </Layout>
  )
}

export default CaixaRetiradaForm
