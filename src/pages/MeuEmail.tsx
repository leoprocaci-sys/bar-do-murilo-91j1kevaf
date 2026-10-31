import { useState, type FormEvent } from 'react'
import { ArrowLeft, Mail, AlertCircle, Info, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'

/**
 * Interface de gestão do próprio e-mail (usuário logado informa o SEU endereço real).
 *
 * STATUS NESTA VERSÃO: PREPARADA, NÃO ATIVA (DESABILITADA).
 *
 * MOTIVOS E DECISÃO ADMINISTRATIVA PENDENTE:
 * 1. O Supabase do projeto está SEM provedor SMTP próprio configurado e o serviço de envio padrão
 *    não entrega mensagens a destinatários externos à equipe.
 * 2. Decisão administrativa PENDENTE sobre "Secure Email Change": por padrão, o Supabase Auth exige
 *    confirmação enviada tanto ao novo e-mail quanto ao e-mail ANTIGO. Como o e-mail antigo de todas
 *    as contas atuais é fictício (.local), a confirmação do e-mail antigo não é viável sem desabilitar
 *    previamente a opção "Secure Email Change" no painel do Supabase Auth ou realizar migração assistida.
 *    Portanto, nenhuma alteração de e-mail é disparada nesta rodada.
 */
export const MeuEmail = () => {
  const { user, appUser } = useAuth()
  const [novoEmail, setNovoEmail] = useState('')

  // Chamada preparada para uso futuro quando SMTP e decisão administrativa forem homologados:
  // const handleSubmit = async (e: FormEvent) => {
  //   e.preventDefault()
  //   const { error } = await supabase.auth.updateUser({ email: novoEmail.trim() })
  //   ...
  // }

  const handleBlockedSubmit = (e: FormEvent) => {
    e.preventDefault()
  }

  const emailAtual = user?.email ?? ''
  const isEmailTecnico = emailAtual.endsWith('.local')

  return (
    <Layout backTo="/usuarios" className="pb-6">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E6B3A]/30 text-[#F2B705]">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold leading-tight">Meu E-mail</h1>
            <p className="text-[#A8B3A6]">Configuração para recuperação de senha</p>
          </div>
        </div>
      </header>

      <section className="space-y-6">
        {/* Situação Atual da Conta */}
        <div className="rounded-2xl border border-[#26332A] bg-[#141B15] p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#A8B3A6]">
            Situação Atual
          </h2>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-base">
              <span className="text-[#879689]">Usuário:</span>
              <span className="font-bold text-[#F3EAD3]">@{appUser?.username}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-[#879689]">Nome:</span>
              <span className="font-semibold text-[#F3EAD3]">{appUser?.nome}</span>
            </div>
            <div className="flex flex-col gap-1 pt-2 sm:flex-row sm:justify-between sm:items-center">
              <span className="text-[#879689]">E-mail de autenticação:</span>
              <span className="font-mono text-sm text-[#A8B3A6] break-all">{emailAtual}</span>
            </div>
            <div className="pt-2">
              <span
                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${
                  isEmailTecnico
                    ? 'bg-[#F2B705]/10 text-[#F2B705] border border-[#F2B705]/30'
                    : 'bg-[#3DD68C]/10 text-[#3DD68C] border border-[#3DD68C]/30'
                }`}
              >
                {isEmailTecnico ? 'E-MAIL TÉCNICO LOCAL' : 'E-MAIL PESSOAL VINCULADO'}
              </span>
            </div>
          </div>
        </div>

        {/* Aviso de Recurso Preparado e Temporariamente Bloqueado */}
        <div className="rounded-2xl border border-[#F2B705]/40 bg-[#F2B705]/10 p-5 text-sm text-[#F2D06B]">
          <div className="mb-2 flex items-center gap-2 font-bold text-[#F3EAD3]">
            <AlertCircle className="h-5 w-5 text-[#F2B705]" />
            <span>Recurso em Preparação (Disponível em Breve)</span>
          </div>
          <p className="leading-relaxed">
            A vinculação do seu e-mail pessoal para recuperação automática está estruturada e será
            ativada após a homologação do provedor de envio SMTP do bar.
          </p>
          <p className="mt-2 text-xs text-[#E3C368]">
            Enquanto isso, a redefinição de senhas continua sendo feita com segurança diretamente
            pelos administradores do bar na tela de Usuários.
          </p>
        </div>

        {/* Formulário Preparado (com inputs visíveis e botão desabilitado) */}
        <form onSubmit={handleBlockedSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <label htmlFor="novo-email" className="field-label">
              SEU E-MAIL REAL (PESSOAL OU COMERCIAL)
            </label>
            <Input
              id="novo-email"
              type="email"
              placeholder="exemplo@gmail.com"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              className="h-14 rounded-[14px] border-[#26332A] bg-[#141B15] text-lg text-[#F3EAD3] placeholder:text-[#4A574C]"
              disabled
            />
            <p className="text-xs text-[#879689] flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Este endereço será usado no futuro para envio de links de recuperação de senha.
            </p>
          </div>

          <Button
            type="submit"
            className="h-15 w-full rounded-2xl bg-[#26332A] text-base font-bold text-[#879689] cursor-not-allowed"
            disabled
          >
            <Lock className="mr-2 h-5 w-5" />
            VINCULAR E-MAIL (DISPONÍVEL EM BREVE)
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
