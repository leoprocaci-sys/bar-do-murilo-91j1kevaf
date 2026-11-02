import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, KeyRound, AlertTriangle, ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import Layout from '@/components/Layout'
import { PasswordField } from '@/components/PasswordField'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

export const RedefinirSenha = () => {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sessionValid, setSessionValid] = useState<boolean | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [success, setSuccess] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    // A troca de senha SÓ É PERMITIDA com confirmação válida do fluxo oficial de RECUPERAÇÃO do Supabase.
    // O link de recuperação do Supabase traz tokens no hash (#access_token=...&type=recovery).
    // O evento oficial disparado é PASSWORD_RECOVERY.
    // Uma sessão comum de login (ou abertura direta sem hash de recovery) NÃO comprova recuperação e deve ser bloqueada.
    const hash = window.location.hash
    const search = window.location.search

    // Suporta tokens no fragmento de hash (#type=recovery, #access_token=...)
    // bem como em query params (?type=recovery, etc.)
    const isRecoveryParams =
      hash.includes('type=recovery') ||
      hash.includes('access_token=') ||
      search.includes('type=recovery')

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') {
        setSessionValid(true)
        setCheckingSession(false)
      }
    })

    // Dá um breve tempo para o cliente Supabase processar a sessão de recovery
    const timer = setTimeout(async () => {
      if (!active) return

      // Se já foi validado pelo evento PASSWORD_RECOVERY, nada mais a fazer
      // Caso contrário, verifica se já existe uma sessão ativa originada de recovery
      if (isRecoveryParams) {
        const { data } = await supabase.auth.getSession()
        if (!active) return
        if (data.session) {
          setSessionValid(true)
          setCheckingSession(false)
          return
        }
      }

      setSessionValid((prev) => (prev === true ? true : false))
      setCheckingSession(false)
    }, 1200)

    return () => {
      active = false
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  const passwordError = useMemo(() => {
    if (!password) return ''
    if (password.length < 8) return 'Use pelo menos 8 caracteres.'
    return ''
  }, [password])

  const confirmationError = useMemo(() => {
    if (!confirmation) return ''
    if (confirmation !== password) return 'As senhas não coincidem.'
    return ''
  }, [confirmation, password])

  const valid = password.length >= 8 && confirmation === password

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || submitting || !sessionValid) return

    setSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      // Encerra a sessão de recuperação para exigir login limpo e consciente
      await supabase.auth.signOut().catch(() => {})

      setSuccess(true)
      toast({
        title: 'Senha redefinida com sucesso!',
        description: 'Agora entre com seu nome de usuário e a nova senha.',
      })
    } catch (err: any) {
      toast({
        title: 'Não foi possível alterar a senha',
        description:
          err?.message ||
          'O link pode ter expirado ou se tornado inválido. Faça um novo pedido de recuperação.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingSession) {
    return (
      <Layout className="justify-center py-7">
        <div className="text-center">
          <BrandLogo compact />
          <p className="mt-6 text-base text-[#A8B3A6]">Verificando link de recuperação...</p>
        </div>
      </Layout>
    )
  }

  if (sessionValid === false) {
    return (
      <Layout className="justify-center py-7">
        <section className="w-full text-center" aria-labelledby="recovery-invalid-title">
          <BrandLogo compact />
          <div className="my-6 rounded-2xl border border-[#E5484D]/40 bg-[#E5484D]/10 p-6 text-left">
            <div className="mb-2 flex items-center gap-2 font-bold text-[#FF8A8E]">
              <AlertTriangle className="h-6 w-6" />
              <h1 id="recovery-invalid-title" className="text-lg">
                Link Inválido ou Expirado
              </h1>
            </div>
            <p className="text-sm leading-relaxed text-[#F3EAD3]">
              O link de recuperação de senha não é válido, já foi utilizado ou expirou por tempo.
              Por segurança, solicite um novo link de recuperação.
            </p>
          </div>

          <div className="space-y-3">
            <Link to="/esqueci-senha" className="block">
              <Button
                type="button"
                className="h-14 w-full rounded-2xl bg-[#1E6B3A] text-base font-bold text-[#F3EAD3] hover:bg-[#25814A]"
              >
                Solicitar Novo Link
              </Button>
            </Link>
            <Link to="/login" className="block">
              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full text-base font-bold text-[#A8B3A6] hover:text-[#F3EAD3]"
              >
                Voltar ao Login
              </Button>
            </Link>
          </div>
        </section>
      </Layout>
    )
  }

  if (success) {
    return (
      <Layout className="justify-center py-7">
        <section className="w-full text-center" aria-labelledby="recovery-success-title">
          <BrandLogo compact />
          <div className="my-6 rounded-2xl border border-[#1E6B3A]/60 bg-[#1E6B3A]/20 p-6 text-left">
            <div className="mb-2 flex items-center gap-2 font-bold text-[#3DD68C]">
              <CheckCircle2 className="h-6 w-6" />
              <h1 id="recovery-success-title" className="text-lg text-[#F3EAD3]">
                Senha Alterada com Sucesso
              </h1>
            </div>
            <p className="text-sm leading-relaxed text-[#E0EEDD]">
              Sua nova senha foi salva com segurança. Entre agora com seu{' '}
              <strong className="text-[#F3EAD3]">nome de usuário habitual</strong> e a senha
              recém-definida.
            </p>
          </div>

          <Button
            type="button"
            className="h-14 w-full rounded-2xl bg-[#1E6B3A] text-lg font-bold text-[#F3EAD3] hover:bg-[#25814A]"
            onClick={() => navigate('/login', { replace: true })}
          >
            IR PARA O LOGIN
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </section>
      </Layout>
    )
  }

  return (
    <Layout className="justify-center py-7">
      <section className="w-full" aria-labelledby="reset-password-title">
        <BrandLogo compact />
        <div className="mb-6 mt-4 text-center">
          <KeyRound className="mx-auto mb-2 h-8 w-8 text-[#3DD68C]" aria-hidden="true" />
          <h1 id="reset-password-title" className="text-2xl font-bold">
            Definir Nova Senha
          </h1>
          <p className="mt-2 text-base text-[#A8B3A6]">
            Crie sua nova senha pessoal para acessar o Bar do Murilo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <PasswordField
            id="new-password"
            label="NOVA SENHA"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError}
            required
            autoFocus
          />

          <PasswordField
            id="confirm-password"
            label="CONFIRMAR NOVA SENHA"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            error={confirmationError}
            required
          />

          <div className="flex items-center gap-2 text-sm text-[#A8B3A6]">
            <CheckCircle2
              className={`h-5 w-5 ${password.length >= 8 ? 'text-[#3DD68C]' : 'text-[#647067]'}`}
            />
            Pelo menos 8 caracteres
          </div>

          <Button
            type="submit"
            className="h-15 w-full rounded-2xl bg-[#1E6B3A] text-lg font-bold text-[#F3EAD3] shadow-[0_8px_26px_rgba(30,107,58,0.25)] hover:bg-[#25814A]"
            disabled={!valid || submitting}
          >
            {submitting ? 'SALVANDO...' : 'SALVAR E CONCLUIR'}
          </Button>

          <div className="pt-2 text-center">
            <Link to="/login" className="text-sm font-semibold text-[#A8B3A6] hover:text-[#F3EAD3]">
              Cancelar e voltar ao Login
            </Link>
          </div>
        </form>
      </section>
    </Layout>
  )
}

export default RedefinirSenha
