import { useState, type FormEvent } from 'react'
import { LogIn } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import { PasswordField } from '@/components/PasswordField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import Layout from '@/components/Layout'

const INVALID_CREDENTIALS = 'Nome de usuário ou senha incorretos. Tente novamente.'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const { session, appUser, signIn } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  if (session && appUser) {
    return <Navigate to={appUser.deve_alterar_senha ? '/primeiro-acesso' : '/'} replace />
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setFormError('')
    setSubmitting(true)

    try {
      const profile = await signIn(username, password)
      navigate(profile.deve_alterar_senha ? '/primeiro-acesso' : '/', { replace: true })
    } catch (error) {
      const authError = error as { status?: number; message?: string }
      const message = authError.message?.toLocaleLowerCase('pt-BR') ?? ''
      const invalid =
        authError.status === 400 ||
        message.includes('invalid login credentials') ||
        message.includes('email not confirmed') ||
        message.includes('unauthorized_app_user')

      if (invalid) {
        setFormError(INVALID_CREDENTIALS)
      } else {
        toast({
          title: 'Erro de conexão. Tente novamente.',
          description: 'Não foi possível acessar o servidor agora.',
          variant: 'destructive',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout className="justify-center py-7">
      <section className="w-full" aria-labelledby="login-title">
        <BrandLogo />
        <div className="mb-7 mt-5 text-center">
          <h1 id="login-title" className="text-3xl font-bold">
            Bem-vindo
          </h1>
          <p className="mt-1 text-lg text-[#A8B3A6]">Entre para gerenciar o bar</p>
        </div>
        <form
          onSubmit={submit}
          className={formError ? 'form-shake space-y-5' : 'space-y-5'}
          noValidate
        >
          <div className="space-y-2">
            <label htmlFor="username" className="field-label">
              NOME DE USUÁRIO
            </label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value.toLocaleLowerCase('pt-BR'))}
              className="h-14 rounded-[14px] border-[#26332A] bg-[#141B15] text-lg text-[#F3EAD3]"
              required
            />
          </div>
          <PasswordField
            id="password"
            name="password"
            label="SENHA"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/esqueci-senha')}
              className="text-sm font-semibold text-[#A8B3A6] transition-colors hover:text-[#F3EAD3] hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-[#E5484D]/50 bg-[#E5484D]/10 px-4 py-3 text-sm font-semibold text-[#FF8A8E]"
            >
              {formError}
            </div>
          )}
          <Button
            type="submit"
            className="h-15 w-full rounded-2xl bg-[#1E6B3A] text-lg font-bold text-[#F3EAD3] shadow-[0_8px_26px_rgba(30,107,58,0.25)] hover:bg-[#25814A]"
            disabled={submitting || !username.trim() || !password}
          >
            <LogIn className="mr-2 h-5 w-5" />
            {submitting ? 'ENTRANDO...' : 'ENTRAR'}
          </Button>
        </form>
      </section>
    </Layout>
  )
}

export default Login
