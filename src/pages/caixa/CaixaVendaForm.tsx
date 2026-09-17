import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  QrCode,
  CreditCard,
  Calendar,
  User,
  ArrowRight,
  Loader2,
  Check,
} from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { registrarVendaDireta } from '@/services/caixa'
import { formatCentavos, parseBRLToCentavos, getTodayDateInput } from '@/lib/formatters'
import type { VendaForma } from '@/types/caixa'

export const CaixaVendaForm = () => {
  const [searchParams] = useSearchParams()
  const dataFromQuery = searchParams.get('data')

  const navigate = useNavigate()
  const { toast } = useToast()
  const { appUser } = useAuth()
  const queryClient = useQueryClient()

  const [dataMovimento, setDataMovimento] = useState(dataFromQuery || getTodayDateInput())
  const [valorInput, setValorInput] = useState('')
  const [forma, setForma] = useState<VendaForma>('dinheiro')
  const [descricao, setDescricao] = useState('')

  const valorCentavos = parseBRLToCentavos(valorInput)

  const vendaMutation = useMutation({
    mutationFn: async () => {
      if (!appUser?.id) throw new Error('Usuário autenticado não encontrado.')
      if (valorCentavos <= 0) {
        throw new Error('Informe um valor de venda maior que zero.')
      }
      return await registrarVendaDireta(
        {
          valor_centavos: valorCentavos,
          forma,
          descricao: descricao.trim() || 'Venda direta balcão',
          data_movimento: dataMovimento,
        },
        appUser.id,
      )
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['caixa-resumo-dia', dataMovimento] })
      queryClient.invalidateQueries({ queryKey: ['caixa-movimentacao', dataMovimento] })

      let msg = `Venda de ${formatCentavos(res.valor_centavos)} registrada!`
      if (res.forma === 'dinheiro') {
        msg += ' Valor adicionado ao saldo esperado na gaveta.'
      } else {
        msg += ' Recebimento eletrônico (gaveta intocada).'
      }

      toast({
        title: 'Venda Direta Registrada',
        description: msg,
      })

      navigate(`/caixa?data=${dataMovimento}`, { replace: true })
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao registrar venda',
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
    vendaMutation.mutate()
  }

  return (
    <Layout backTo={`/caixa?data=${dataMovimento}`} backLabel="CANCELAR" className="pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">Registrar Venda Direta</h1>
        <p className="text-sm text-[#A8B3A6]">
          Venda à vista de balcão (para fiado, utilize o Caderno do Fiado)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        {/* Campo: Valor */}
        <div className="space-y-2 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <Label htmlFor="valorVenda" className="text-sm font-bold text-[#F3EAD3]">
            Valor da Venda (R$) *
          </Label>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-extrabold text-[#1E6B3A]">
              R$
            </span>
            <Input
              id="valorVenda"
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
              Valor a registrar:{' '}
              <strong className="text-[#F3EAD3]">{formatCentavos(valorCentavos)}</strong>
            </p>
          )}
        </div>

        {/* Campo: Forma de Pagamento */}
        <div className="space-y-2 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <Label className="text-sm font-bold text-[#F3EAD3]">Forma de Pagamento *</Label>
          <RadioGroup
            value={forma}
            onValueChange={(val: VendaForma) => setForma(val)}
            className="grid grid-cols-2 gap-2.5 pt-1"
          >
            {/* Dinheiro */}
            <label
              htmlFor="forma-dinheiro"
              className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                forma === 'dinheiro'
                  ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                  : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
              }`}
            >
              <RadioGroupItem value="dinheiro" id="forma-dinheiro" className="sr-only" />
              <Banknote className="h-5 w-5 text-[#1E6B3A] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Dinheiro</p>
                <p className="text-[10px] opacity-75">Entra na gaveta</p>
              </div>
              {forma === 'dinheiro' && <Check className="h-4 w-4 text-[#1E6B3A]" />}
            </label>

            {/* Pix */}
            <label
              htmlFor="forma-pix"
              className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                forma === 'pix'
                  ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                  : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
              }`}
            >
              <RadioGroupItem value="pix" id="forma-pix" className="sr-only" />
              <QrCode className="h-5 w-5 text-[#1E6B3A] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Pix</p>
                <p className="text-[10px] opacity-75">Fora da gaveta</p>
              </div>
              {forma === 'pix' && <Check className="h-4 w-4 text-[#1E6B3A]" />}
            </label>

            {/* Cartão de Débito */}
            <label
              htmlFor="forma-debito"
              className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                forma === 'cartao_debito'
                  ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                  : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
              }`}
            >
              <RadioGroupItem value="cartao_debito" id="forma-debito" className="sr-only" />
              <CreditCard className="h-5 w-5 text-[#1E6B3A] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Cartão Débito</p>
                <p className="text-[10px] opacity-75">Fora da gaveta</p>
              </div>
              {forma === 'cartao_debito' && <Check className="h-4 w-4 text-[#1E6B3A]" />}
            </label>

            {/* Cartão de Crédito */}
            <label
              htmlFor="forma-credito"
              className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                forma === 'cartao_credito'
                  ? 'border-[#1E6B3A] bg-[#1C271E] text-[#F3EAD3]'
                  : 'border-[#26332A] bg-[#0B0F0C] text-[#A8B3A6] hover:border-[#334637]'
              }`}
            >
              <RadioGroupItem value="cartao_credito" id="forma-credito" className="sr-only" />
              <CreditCard className="h-5 w-5 text-[#1E6B3A] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Cartão Crédito</p>
                <p className="text-[10px] opacity-75">Fora da gaveta</p>
              </div>
              {forma === 'cartao_credito' && <Check className="h-4 w-4 text-[#1E6B3A]" />}
            </label>
          </RadioGroup>
        </div>

        {/* Campo: Descrição (Opcional) */}
        <div className="space-y-1.5 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <Label htmlFor="descricaoVenda" className="text-sm font-semibold text-[#F3EAD3]">
            Descrição / Observação <span className="text-xs text-[#A8B3A6]">(opcional)</span>
          </Label>
          <Input
            id="descricaoVenda"
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Cervejas, porção, refrigerante..."
            className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
          />
        </div>

        {/* Data do Movimento */}
        <div className="space-y-1.5 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dataVenda" className="text-sm font-semibold text-[#F3EAD3]">
              Data da Venda *
            </Label>
            <span className="text-[11px] text-[#A8B3A6]">Data operacional</span>
          </div>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B3A6]" />
            <Input
              id="dataVenda"
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
            <span>Responsável pelo lançamento:</span>
          </div>
          <strong className="text-[#F3EAD3] font-semibold">
            {appUser?.nome} ({appUser?.username})
          </strong>
        </div>

        {/* Botão de Envio */}
        <Button
          type="submit"
          disabled={vendaMutation.isPending || valorCentavos <= 0}
          className="h-16 w-full rounded-2xl bg-[#1E6B3A] text-xl font-bold tracking-wide text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.98] shadow-lg shadow-[#1E6B3A]/25 disabled:bg-[#1C271E] disabled:text-[#6E7B70]"
        >
          {vendaMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              REGISTRANDO VENDA...
            </>
          ) : (
            <>
              SALVAR VENDA DIRETA
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </form>
    </Layout>
  )
}

export default CaixaVendaForm
