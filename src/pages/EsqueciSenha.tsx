import { useState, type FormEvent } from 'react'
import { ArrowLeft, KeyRound, Mail, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'

export const EsqueciSenha = () => {
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [isAlert, setIsAlert] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = username.trim().toLocaleLowerCase('pt-BR')
    if (!trimmed || submitting) return

    setSubmitting(true)
    setResultMessage(null)
    setIsAlert(false)

    try {
      const { data, error } = await supabase.functions.invoke<{
        ok?: boolean
        message?: string
        code?: string
      }>('request-password-reset', {
        body: { username: trimmed },
      })

      if (error) {
        setResultMessage(
          'Se o nome de usuário estiver cadastrado e tiver um e-mail configurado, as instruções de recuperação serão enviadas.',
        )
      } else if (data?.code === 'rate_limited') {
        setIsAlert(true)
        setResultMessage(
          data.message || 'Muitas tentativas recentes. Aguarde 15 minutos e tente novamente.',
        )
      } else {
        setResultMessage(
          data?.message ||
            'Se o nome de usuário estiver cadastrado e tiver um e-mail configurado, as instruções de recuperação serão enviadas.',
        )
      }
    } catch {
      setResultMessage(
        'Se o nome de usuário estiver cadastrado e tiver um e-mail configurado, as instruções de recuperação serão enviadas.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout className="justify-center py-7">
      <section className="w-full" aria-labelledby="forgot-password-title">
        <BrandLogo compact />
        <div className="mb-7 mt-5 text-center">
          <KeyRound className="mx-auto mb-2 h-8 w-8 text-[#F2B705]" aria-hidden="true" />
          <h1 id="forgot-password-title" className="text-2xl font-bold">
            Recuperação de Senha
          </h1>
          <p className="mt-2 text-base text-[#A8B3A6]">
            Informe seu nome de usuário habitual do bar para receber o link de recuperação.
          </p>
          <p className="mt-2 text-xs text-[#879689]">
            Caso sua conta ainda não possua e-mail configurado para recuperação automática, procure
            um administrador do bar para redefinição manual.
          </p>
        </div>

        {resultMessage ? (
          <div className="space-y-6">
            <div
              className={`rounded-2xl border p-5 text-sm leading-relaxed ${
                isAlert
                  ? 'border-[#F2B705]/40 bg-[#F2B705]/10 text-[#F2D06B]'
                  : 'border-[#1E6B3A]/60 bg-[#1E6B3A]/15 text-[#E0EEDD]'
              }`}
              role="alert"
            >
              <div className="mb-2 flex items-center gap-2 font-bold text-[#F3EAD3]">
                {isAlert ? (
                  <AlertCircle className="h-5 w-5 text-[#F2B705]" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-[#3DD68C]" />
                )}
                <span>{isAlert ? 'Aviso' : 'Solicitação Recebida'}</span>
              </div>
              <p>{resultMessage}</p>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="h-14 w-full rounded-2xl border-[#26332A] bg-[#141B15] text-base font-bold text-[#F3EAD3] hover:bg-[#1C261E]"
                onClick={() => {
                  setResultMessage(null)
                  setUsername('')
                  setIsAlert(false)
                }}
              >
                Fazer Outra Solicitação
              </Button>

              <Link to="/login" className="block text-center">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 w-full text-base font-bold text-[#A8B3A6] hover:text-[#F3EAD3]"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar ao Login
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <label htmlFor="username-recovery" className="field-label">
                NOME DE USUÁRIO
              </label>
              <Input
                id="username-recovery"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Ex.: murilo, esther, leo"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLocaleLowerCase('pt-BR'))}
                className="h-14 rounded-[14px] border-[#26332A] bg-[#141B15] text-lg text-[#F3EAD3] placeholder:text-[#4A574C]"
                required
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="h-15 w-full rounded-2xl bg-[#1E6B3A] text-lg font-bold text-[#F3EAD3] shadow-[0_8px_26px_rgba(30,107,58,0.25)] hover:bg-[#25814A]"
              disabled={submitting || !username.trim()}
            >
              <Mail className="mr-2 h-5 w-5" />
              {submitting ? 'PROCESSANDO...' : 'ENVIAR INSTRUÇÕES'}
            </Button>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center text-sm font-semibold text-[#A8B3A6] hover:text-[#F3EAD3]"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Lembrou a senha? Voltar para o Login
              </Link>
            </div>
          </form>
        )}
      </section>
    </Layout>
  )
}

export default EsqueciSenha
