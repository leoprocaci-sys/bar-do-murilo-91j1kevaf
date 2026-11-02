import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  Mail,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  LoaderCircle,
  ShieldCheck,
  Send,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import {
  checkEmailDisponivel,
  getMeuEmailRecord,
  registrarIntencaoEmail,
  type AppUserEmailRecord,
} from '@/services/meu-email'

export const MeuEmail = () => {
  const { user, appUser } = useAuth()
  const { toast } = useToast()

  const [emailRecord, setEmailRecord] = useState<AppUserEmailRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('')
  const [erroEmail, setErroEmail] = useState('')
  const [erroSenha, setErroSenha] = useState('')
  const [sucessoSolicitacao, setSucessoSolicitacao] = useState<string | null>(null)

  const emailAuth = user?.email ?? ''
  const isAuthTecnico = emailAuth.endsWith('.local')
  const isAuthConfirmado = Boolean(user?.email_confirmed_at) && !isAuthTecnico

  // Determinação dos 3 estados explícitos:
  // 1. E-mail confirmado (identidade no Auth confirmada e não .local, ou app_user_emails verificado = true)
  // 2. Confirmação pendente (há e-mail real registrado aguardando clique de confirmação)
  // 3. E-mail técnico (.local ativo, nenhum e-mail real ainda cadastrado ou confirmado)
  const isConfirmado = isAuthConfirmado || Boolean(emailRecord?.verificado)
  const isPendente =
    !isConfirmado &&
    (Boolean(emailRecord?.email_real && !emailRecord.verificado) || Boolean(sucessoSolicitacao))
  const isTecnicoApenas = !isConfirmado && !isPendente

  const loadData = async () => {
    try {
      setLoading(true)
      const record = await getMeuEmailRecord()
      setEmailRecord(record)
      if (record?.email_real && !record.verificado) {
        setNovoEmail(record.email_real)
      } else if (record?.email_real && record.verificado) {
        setNovoEmail(record.email_real)
      }
    } catch (err) {
      console.error('Erro ao carregar dados do e-mail:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      void loadData()
    }
  }, [user?.id])

  const validateEmailFormat = (value: string): boolean => {
    const trimmed = value.trim()
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(trimmed) && !trimmed.endsWith('.local')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErroEmail('')
    setErroSenha('')
    setSucessoSolicitacao(null)

    const emailLimpo = novoEmail.trim().toLowerCase()

    // 1. Validação de formato
    if (!emailLimpo) {
      setErroEmail('Informe um endereço de e-mail.')
      return
    }

    if (!validateEmailFormat(emailLimpo)) {
      setErroEmail('Informe um endereço de e-mail real válido (exemplo: usuario@gmail.com).')
      return
    }

    // Não permitir e-mail técnico .local
    if (emailLimpo.endsWith('.local') || emailLimpo.includes('bar-do-murilo.local')) {
      setErroEmail(
        'Endereços técnicos internos (.local) não podem ser usados como e-mail de recuperação.',
      )
      return
    }

    // 2. Exigir senha recente para proteção contra sequestro de sessão
    if (!senhaConfirmacao) {
      setErroSenha('Informe sua senha atual para autorizar a solicitação.')
      return
    }

    setSubmitting(true)

    try {
      // 3. Validação de disponibilidade (não pertencer a outro usuário)
      const disponivel = await checkEmailDisponivel(emailLimpo)
      if (!disponivel) {
        setErroEmail('Este endereço de e-mail já está sendo utilizado por outra conta.')
        setSubmitting(false)
        return
      }

      // 4. Validação da senha atual do usuário (reautenticação local segura)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailAuth,
        password: senhaConfirmacao,
      })

      if (signInError) {
        setErroSenha('Senha atual incorreta. Confirme a senha que você utilizou para entrar.')
        setSubmitting(false)
        return
      }

      // 5. Primeiro solicita a mudança de e-mail ao Supabase Auth.
      // Só depois registra a intenção no banco: não marcar como pendente
      // uma solicitação recusada por SMTP, URL ou configuração de Auth.
      const { error: updateError } = await supabase.auth.updateUser(
        {
          email: emailLimpo,
        },
        {
          emailRedirectTo: 'https://bar-do-murilo-d9d01.goskip.app/usuarios/meu-email',
        },
      )

      if (updateError) {
        throw new Error(
          `O Supabase não aceitou a solicitação: ${updateError.message}. Verifique as configurações de envio de e-mails e redirecionamento.`,
        )
      }

      // 6. A confirmação ainda depende do clique no link do e-mail.
      // Um erro de gravação aqui não desfaz a solicitação já aceita no Auth.
      if (user?.id) {
        try {
          await registrarIntencaoEmail(user.id, emailLimpo)
        } catch (recordError) {
          console.error('Falha ao registrar estado pendente após solicitação aceita:', recordError)
          setSenhaConfirmacao('')
          toast({
            title: 'Solicitação aceita pelo Supabase',
            description:
              'Não foi possível atualizar o status interno. Se receber o e-mail, confirme pelo link e entre novamente; caso contrário, procure o administrador.',
            variant: 'destructive',
          })
          return
        }
      }

      setSucessoSolicitacao(emailLimpo)
      setSenhaConfirmacao('')
      await loadData()

      toast({
        title: 'Solicitação aceita pelo Supabase',
        description:
          'Se o e-mail for entregue, clique no link para confirmar o endereço. O cadastro só estará concluído após a confirmação.',
      })
    } catch (err) {
      console.error('Falha no fluxo de vinculação de e-mail:', err)
      toast({
        title: 'Não foi possível registrar o e-mail',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout backTo="/usuarios" className="pb-6">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E6B3A]/30 text-[#F2B705]">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold leading-tight">Meu E-mail</h1>
            <p className="text-[#A8B3A6]">E-mail pessoal para recuperação de senha</p>
          </div>
        </div>
      </header>

      <section className="space-y-6">
        {/* Situação Atual da Conta com os Três Estados Claros */}
        <div className="rounded-2xl border border-[#26332A] bg-[#141B15] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#A8B3A6]">
            Situação da Sua Conta
          </h2>
          <div className="mt-3 space-y-2.5">
            <div className="flex justify-between text-base">
              <span className="text-[#879689]">Usuário:</span>
              <span className="font-bold text-[#F3EAD3]">@{appUser?.username}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-[#879689]">Nome:</span>
              <span className="font-semibold text-[#F3EAD3]">{appUser?.nome}</span>
            </div>
            <div className="flex flex-col gap-1 pt-1 sm:flex-row sm:justify-between sm:items-center">
              <span className="text-[#879689]">E-mail de autenticação:</span>
              <span className="font-mono text-sm text-[#A8B3A6] break-all">{emailAuth}</span>
            </div>

            {/* Badge de Estado: 1) E-MAIL TÉCNICO, 2) CONFIRMAÇÃO PENDENTE, 3) E-MAIL CONFIRMADO */}
            <div className="pt-2">
              {isConfirmado && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#3DD68C]/40 bg-[#3DD68C]/10 px-3 py-1.5 text-xs font-bold text-[#3DD68C]">
                  <CheckCircle2 className="h-4 w-4" />
                  E-MAIL CONFIRMADO E VINCULADO
                </div>
              )}

              {isPendente && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#F2B705]/40 bg-[#F2B705]/10 px-3 py-1.5 text-xs font-bold text-[#F2B705]">
                  <Clock className="h-4 w-4 animate-pulse" />
                  CONFIRMAÇÃO PENDENTE DE VERIFICAÇÃO
                </div>
              )}

              {isTecnicoApenas && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#718078]/40 bg-[#718078]/10 px-3 py-1.5 text-xs font-bold text-[#A8B3A6]">
                  <Info className="h-4 w-4" />
                  E-MAIL TÉCNICO LOCAL (SEM RECUPERAÇÃO AUTOMÁTICA)
                </div>
              )}
            </div>

            {/* Detalhe do e-mail cadastrado quando confirmado ou pendente */}
            {emailRecord?.email_real && (
              <div className="mt-2 rounded-xl bg-[#0B0F0C] p-3 text-xs">
                <span className="text-[#879689]">E-mail informado: </span>
                <span className="font-mono font-bold text-[#F3EAD3] break-all">
                  {emailRecord.email_real}
                </span>
                {emailRecord.verificado ? (
                  <span className="ml-2 text-[#3DD68C] font-semibold">
                    (Validado em{' '}
                    {new Date(
                      emailRecord.verificado_em || emailRecord.atualizado_em,
                    ).toLocaleDateString('pt-BR')}
                    )
                  </span>
                ) : (
                  <span className="ml-2 text-[#F2B705] font-semibold">
                    (Aguardando confirmação)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Aviso de Transparência sobre o Envio e Dependência de SMTP do Bar */}
        <div className="rounded-2xl border border-[#F2B705]/30 bg-[#F2B705]/10 p-5 text-sm text-[#F2D06B]">
          <div className="mb-2 flex items-center gap-2 font-bold text-[#F3EAD3]">
            <AlertCircle className="h-5 w-5 text-[#F2B705]" />
            <span>Confirmação Depende do Envio de E-mail (SMTP)</span>
          </div>
          <p className="leading-relaxed">
            Ao informar seu endereço, o sistema solicita a confirmação de titularidade enviando um
            link seguro.{' '}
            <strong>
              O e-mail só será considerado vinculado após o clique no link de confirmação
            </strong>
            .
          </p>
          <p className="mt-2 text-xs text-[#E3C368]">
            Enquanto o provedor de e-mail (SMTP) não estiver ativo no servidor, ou enquanto a
            mensagem não for confirmada, sua senha continuará protegida e poderá ser redefinida
            normalmente pelos administradores na tela de Usuários.
          </p>
        </div>

        {/* Formulário de Cadastro Individual e Seguro */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <label htmlFor="novo-email" className="field-label">
              SEU E-MAIL REAL (PESSOAL OU COMERCIAL)
            </label>
            <Input
              id="novo-email"
              type="email"
              placeholder="exemplo@gmail.com"
              value={novoEmail}
              onChange={(e) => {
                setNovoEmail(e.target.value)
                setErroEmail('')
              }}
              className="h-14 rounded-[14px] border-[#26332A] bg-[#141B15] text-lg text-[#F3EAD3] placeholder:text-[#4A574C]"
              disabled={submitting}
              autoComplete="email"
              required
            />
            {erroEmail ? (
              <p className="text-xs font-semibold text-[#FF9295]">{erroEmail}</p>
            ) : (
              <p className="text-xs text-[#879689] flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Cada usuário edita somente o seu próprio endereço. Não é permitido reutilizar
                e-mails de outros usuários.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="senha-confirmacao" className="field-label">
              SUA SENHA ATUAL DE ENTRADA
            </label>
            <Input
              id="senha-confirmacao"
              type="password"
              placeholder="Digite sua senha atual"
              value={senhaConfirmacao}
              onChange={(e) => {
                setSenhaConfirmacao(e.target.value)
                setErroSenha('')
              }}
              className="h-14 rounded-[14px] border-[#26332A] bg-[#141B15] text-lg text-[#F3EAD3] placeholder:text-[#4A574C]"
              disabled={submitting}
              autoComplete="current-password"
              required
            />
            {erroSenha ? (
              <p className="text-xs font-semibold text-[#FF9295]">{erroSenha}</p>
            ) : (
              <p className="text-xs text-[#879689] flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Exigido para garantir que apenas você altere o e-mail da sua conta.
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="h-15 w-full rounded-2xl bg-[#1E6B3A] text-base font-bold text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.99] transition-all"
            disabled={submitting || loading}
          >
            {submitting ? (
              <>
                <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                SOLICITANDO CONFIRMAÇÃO...
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5 text-[#F2B705]" />
                SOLICITAR CONFIRMAÇÃO DE E-MAIL
              </>
            )}
          </Button>
        </form>

        <div className="pt-2 text-center">
          <Link
            to="/usuarios"
            className="inline-flex items-center text-sm font-semibold text-[#A8B3A6] hover:text-[#F3EAD3]"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar para Usuários
          </Link>
        </div>
      </section>
    </Layout>
  )
}

export default MeuEmail
