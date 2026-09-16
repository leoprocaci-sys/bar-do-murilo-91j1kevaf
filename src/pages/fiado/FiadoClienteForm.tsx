import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User,
  Phone,
  MapPin,
  ShieldAlert,
  AlertTriangle,
  Save,
  Loader2,
  DollarSign,
  Star,
  Info,
} from 'lucide-react'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { createCliente, getCliente, updateCliente } from '@/services/fiado'
import { formatCentavos, parseBRLToCentavos } from '@/lib/formatters'
import type { CreateClienteInput, UpdateClienteInput } from '@/services/fiado'

export const FiadoClienteForm = () => {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { appUser } = useAuth()
  const queryClient = useQueryClient()

  // Form states
  const [nome, setNome] = useState('')
  const [apelido, setApelido] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [favorito, setFavorito] = useState(false)

  // Modos de limite: 'sem_limite' (null), 'bloqueado' (0), 'com_limite' (> 0)
  const [modoLimite, setModoLimite] = useState<'sem_limite' | 'bloqueado' | 'com_limite'>(
    'sem_limite',
  )
  const [limiteValorInput, setLimiteValorInput] = useState('')

  // Restrição "Não vender fiado"
  const [restricaoAtiva, setRestricaoAtiva] = useState(false)
  const [restricaoMotivo, setRestricaoMotivo] = useState('')

  // Carrega dados se estiver editando
  const { data: clienteExistente, isLoading: isLoadingCliente } = useQuery({
    queryKey: ['fiado-cliente', id],
    queryFn: () => (id ? getCliente(id) : null),
    enabled: isEditing,
  })

  useEffect(() => {
    if (clienteExistente) {
      setNome(clienteExistente.nome || '')
      setApelido(clienteExistente.apelido || '')
      setTelefone(clienteExistente.telefone || '')
      setEndereco(clienteExistente.endereco || '')
      setFavorito(clienteExistente.favorito || false)

      if (clienteExistente.limite_centavos === null) {
        setModoLimite('sem_limite')
        setLimiteValorInput('')
      } else if (clienteExistente.limite_centavos === 0) {
        setModoLimite('bloqueado')
        setLimiteValorInput('0,00')
      } else {
        setModoLimite('com_limite')
        setLimiteValorInput((clienteExistente.limite_centavos / 100).toFixed(2).replace('.', ','))
      }

      setRestricaoAtiva(clienteExistente.restricao_ativa)
      setRestricaoMotivo(clienteExistente.restricao_motivo || '')
    }
  }, [clienteExistente])

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!appUser?.id) throw new Error('Usuário autenticado não encontrado.')
      if (!nome.trim()) throw new Error('O nome do cliente é obrigatório.')

      // Cálculo rigoroso do limite
      let limiteCentavos: number | null = null
      if (modoLimite === 'sem_limite') {
        limiteCentavos = null
      } else if (modoLimite === 'bloqueado') {
        limiteCentavos = 0
      } else {
        const parsed = parseBRLToCentavos(limiteValorInput)
        if (parsed <= 0) {
          throw new Error(
            'Informe um valor de limite positivo ou selecione "R$ 0,00 (Sem autorização)".',
          )
        }
        limiteCentavos = parsed
      }

      // Validação da restrição: se ativa, motivo é obrigatório
      if (restricaoAtiva && !restricaoMotivo.trim()) {
        throw new Error('Informe o motivo/justificativa ao ativar a restrição "Não vender fiado".')
      }

      if (isEditing && id) {
        const payload: UpdateClienteInput = {
          nome,
          apelido,
          telefone,
          endereco,
          limite_centavos: limiteCentavos,
          restricao_ativa: restricaoAtiva,
          restricao_motivo: restricaoMotivo,
          favorito,
        }
        return await updateCliente(id, payload, appUser.id)
      } else {
        const payload: CreateClienteInput = {
          nome,
          apelido,
          telefone,
          endereco,
          limite_centavos: limiteCentavos,
          restricao_ativa: restricaoAtiva,
          restricao_motivo: restricaoMotivo,
          favorito,
        }
        return await createCliente(payload, appUser.id)
      }
    },
    onSuccess: (clienteSalvo) => {
      queryClient.invalidateQueries({ queryKey: ['fiado-clientes'] })
      queryClient.invalidateQueries({ queryKey: ['fiado-bloqueados'] })
      queryClient.invalidateQueries({ queryKey: ['fiado-cliente', clienteSalvo.id] })

      toast({
        title: isEditing ? 'Cliente atualizado' : 'Cliente cadastrado com sucesso',
        description: `${clienteSalvo.nome} foi ${isEditing ? 'atualizado' : 'adicionado'} no caderno.`,
      })
      navigate(`/fiado/cliente/${clienteSalvo.id}`, { replace: true })
    },
    onError: (err: any) => {
      toast({
        title: 'Não foi possível salvar',
        description: err.message || 'Erro inesperado ao salvar cliente.',
        variant: 'destructive',
      })
    },
  })

  if (isEditing && isLoadingCliente) {
    return (
      <Layout backTo="/fiado" backLabel="VOLTAR" className="items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E6B3A]" />
        <p className="mt-3 text-sm text-[#A8B3A6]">Carregando ficha do cliente...</p>
      </Layout>
    )
  }

  return (
    <Layout
      backTo={isEditing && id ? `/fiado/cliente/${id}` : '/fiado'}
      backLabel="VOLTAR"
      className="pb-10"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-[#F3EAD3]">
          {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
        </h1>
        <button
          type="button"
          onClick={() => setFavorito(!favorito)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
            favorito
              ? 'border-yellow-600 bg-yellow-950/40 text-yellow-300'
              : 'border-[#26332A] bg-[#141B15] text-[#A8B3A6] hover:text-[#F3EAD3]'
          }`}
        >
          <Star className={`h-4 w-4 ${favorito ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          {favorito ? 'FAVORITO' : 'FAVORITAR'}
        </button>
      </div>
      <p className="mt-1 text-xs text-[#A8B3A6]">
        {isEditing
          ? 'Altere os dados cadastrais, limites ou restrições do cliente.'
          : 'Preencha os dados para abrir a ficha no balcão.'}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          salvarMutation.mutate()
        }}
        className="mt-6 space-y-6"
      >
        {/* Seção 1: Dados Pessoais */}
        <div className="space-y-4 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <p className="text-xs font-bold tracking-wider text-[#1E6B3A] uppercase">Identificação</p>

          <div className="space-y-1.5">
            <Label htmlFor="nome" className="text-sm font-semibold text-[#F3EAD3]">
              Nome do Cliente *
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B3A6]" />
              <Input
                id="nome"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: João da Silva"
                className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apelido" className="text-sm font-semibold text-[#F3EAD3]">
              Apelido (opcional)
            </Label>
            <Input
              id="apelido"
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              placeholder="Ex.: Zeca, Tião, Alemão"
              className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] px-3.5 text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefone" className="text-sm font-semibold text-[#F3EAD3]">
              Telefone / WhatsApp (opcional)
            </Label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B3A6]" />
              <Input
                id="telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Ex.: (11) 98765-4321"
                className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endereco" className="text-sm font-semibold text-[#F3EAD3]">
              Endereço / Referência (opcional)
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-[#A8B3A6]" />
              <Input
                id="endereco"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Ex.: Rua das Flores, 123 (ao lado da praça)"
                className="h-12 rounded-xl border-[#26332A] bg-[#0B0F0C] pl-10 text-base text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
              />
            </div>
          </div>
        </div>

        {/* Seção 2: Regras Rigorosas de Limite */}
        <div className="space-y-4 rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-[#1E6B3A] uppercase">
              Limite de Fiado
            </p>
            <span className="text-[11px] text-[#A8B3A6] italic">Rigor: NULL ≠ 0 ≠ Valor</span>
          </div>

          <RadioGroup
            value={modoLimite}
            onValueChange={(val: any) => setModoLimite(val)}
            className="space-y-2.5 pt-1"
          >
            {/* Opção A: Sem limite definido (NULL) */}
            <label
              htmlFor="radio-sem-limite"
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                modoLimite === 'sem_limite'
                  ? 'border-[#1E6B3A] bg-[#16251A]'
                  : 'border-[#26332A] bg-[#0B0F0C] hover:bg-[#121A14]'
              }`}
            >
              <RadioGroupItem value="sem_limite" id="radio-sem-limite" className="mt-1" />
              <div className="flex-1 text-sm">
                <span className="font-bold text-[#F3EAD3]">Sem limite definido (Livre)</span>
                <p className="text-xs text-[#A8B3A6]">
                  Não impõe teto monetário no fiado. As restrições manuais continuam prevalecendo.
                </p>
              </div>
            </label>

            {/* Opção B: R$ 0,00 (Bloqueado) */}
            <label
              htmlFor="radio-bloqueado"
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                modoLimite === 'bloqueado'
                  ? 'border-yellow-700 bg-yellow-950/30'
                  : 'border-[#26332A] bg-[#0B0F0C] hover:bg-[#121A14]'
              }`}
            >
              <RadioGroupItem value="bloqueado" id="radio-bloqueado" className="mt-1" />
              <div className="flex-1 text-sm">
                <span className="font-bold text-yellow-300">R$ 0,00 — Sem autorização</span>
                <p className="text-xs text-[#A8B3A6]">
                  Cliente explicitamente impedido de fazer compras fiadas por política de limite
                  zero.
                </p>
              </div>
            </label>

            {/* Opção C: Limite Máximo Positivo */}
            <label
              htmlFor="radio-com-limite"
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                modoLimite === 'com_limite'
                  ? 'border-[#1E6B3A] bg-[#16251A]'
                  : 'border-[#26332A] bg-[#0B0F0C] hover:bg-[#121A14]'
              }`}
            >
              <RadioGroupItem value="com_limite" id="radio-com-limite" className="mt-1" />
              <div className="flex-1 text-sm">
                <span className="font-bold text-[#F3EAD3]">Limite com valor máximo (R$)</span>
                <p className="text-xs text-[#A8B3A6]">
                  O sistema valida e bloqueia automaticamente ao atingir o teto, considerando
                  créditos.
                </p>
              </div>
            </label>
          </RadioGroup>

          {/* Campo de valor quando "com_limite" selecionado */}
          {modoLimite === 'com_limite' && (
            <div className="mt-3 space-y-1.5 rounded-xl border border-[#26332A] bg-[#0B0F0C] p-3">
              <Label htmlFor="limiteValor" className="text-xs font-semibold text-[#F3EAD3]">
                Valor Máximo Autorizado (R$)
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#A8B3A6]">
                  R$
                </span>
                <Input
                  id="limiteValor"
                  type="text"
                  inputMode="decimal"
                  value={limiteValorInput}
                  onChange={(e) => setLimiteValorInput(e.target.value)}
                  placeholder="Ex.: 150,00"
                  className="h-12 rounded-xl border-[#26332A] bg-[#141B15] pl-10 text-lg font-bold text-[#F3EAD3] focus-visible:ring-[#1E6B3A]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Seção 3: Restrição Operacional "NÃO VENDER FIADO" */}
        <div
          className={`space-y-4 rounded-2xl border p-4 transition-all ${
            restricaoAtiva ? 'border-red-800 bg-red-950/25' : 'border-[#26332A] bg-[#141B15]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert
                className={`h-5 w-5 ${restricaoAtiva ? 'text-red-400' : 'text-[#A8B3A6]'}`}
              />
              <span className="text-xs font-bold tracking-wider uppercase text-red-400">
                Prioridade Operacional
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#F3EAD3]">
                {restricaoAtiva ? 'BLOQUEADO' : 'LIBERADO'}
              </span>
              <Switch
                checked={restricaoAtiva}
                onCheckedChange={setRestricaoAtiva}
                className="data-[state=checked]:bg-red-600"
              />
            </div>
          </div>

          <div className="text-xs text-[#A8B3A6] leading-relaxed">
            Quando ativada a restrição <strong className="text-red-300">"Não vender fiado"</strong>,
            o cliente é destacado em toda a aplicação e bloqueado imediatamente no balcão,
            prevalecendo sobre qualquer limite cadastrado.
          </div>

          {restricaoAtiva && (
            <div className="space-y-2 pt-2 border-t border-red-900/50">
              <Label
                htmlFor="restricaoMotivo"
                className="text-xs font-bold text-red-200 flex items-center gap-1.5"
              >
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Motivo / Justificativa da Restrição *
              </Label>
              <Textarea
                id="restricaoMotivo"
                required
                rows={3}
                value={restricaoMotivo}
                onChange={(e) => setRestricaoMotivo(e.target.value)}
                placeholder="Ex.: Não vender fiado até conversar com Murilo / Acerto pendente"
                className="rounded-xl border-red-900/60 bg-[#0B0F0C] text-sm text-red-100 placeholder:text-red-300/40 focus-visible:ring-red-600"
              />
              <p className="text-[11px] text-red-300/80">
                Esta justificativa será exibida no alerta e no balcão caso tentem registrar um
                consumo.
              </p>
            </div>
          )}
        </div>

        {/* Botão de Enviar */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={salvarMutation.isPending}
            className="h-14 w-full rounded-2xl bg-[#1E6B3A] text-lg font-bold tracking-wide text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.98] shadow-lg shadow-[#1E6B3A]/20"
          >
            {salvarMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                SALVANDO...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                {isEditing ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR CLIENTE'}
              </>
            )}
          </Button>
        </div>
      </form>
    </Layout>
  )
}

export default FiadoClienteForm
