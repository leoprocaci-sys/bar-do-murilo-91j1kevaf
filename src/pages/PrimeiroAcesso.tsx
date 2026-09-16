import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import Layout from '@/components/Layout'
import { PasswordField } from '@/components/PasswordField'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { completeFirstAccess } from '@/services/app-users'
import { supabase } from '@/lib/supabase/client'

const PrimeiroAcesso = () => {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { appUser, refreshAppUser } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

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

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      await completeFirstAccess()
      await refreshAppUser()
      toast({
        title: 'Senha definida com sucesso',
        description: 'Seu acesso está pronto.',
      })
      navigate('/', { replace: true })
    } catch {
      toast({
        title: 'Não foi possível salvar a senha',
        description: 'Tente novamente. Se o erro continuar, procure um administrador.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout backTo="/login" backLabel="SAIR" className="justify-center py-5">
      <section className="w-full" aria-labelledby="first-access-title">
        <BrandLogo compact />
        <div className="mb-6 mt-4 text-center">
          <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-[#F2B705]" aria-hidden="true" />
          <h1 id="first-access-title" className="text-2xl font-bold">
            Olá, {appUser?.nome}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-[#A8B3A6]">
            Defina sua senha pessoal para continuar. Ela não será exibida nem armazenada pelo
            aplicativo.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <PasswordField
            id="new-password"
            label="NOVA SENHA"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={passwordError}
          />
          <PasswordField
            id="confirm-password"
            label="CONFIRMAR SENHA"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            error={confirmationError}
          />
          <div className="flex items-center gap-2 text-sm text-[#A8B3A6]">
            <CheckCircle2
              className={`h-5 w-5 ${password.length >= 8 ? 'text-[#3DD68C]' : 'text-[#647067]'}`}
            />
            Pelo menos 8 caracteres
          </div>
          <Button
            type="submit"
            className="h-14 w-full rounded-2xl bg-[#1E6B3A] text-lg font-bold hover:bg-[#25814A]"
            disabled={!valid || submitting}
          >
            {submitting ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}
          </Button>
        </form>
      </section>
    </Layout>
  )
}

export default PrimeiroAcesso
