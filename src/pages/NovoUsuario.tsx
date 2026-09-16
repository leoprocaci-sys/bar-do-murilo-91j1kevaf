import { useMemo, useState, type FormEvent } from 'react'
import { LoaderCircle, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import { ProvisionalPasswordDialog } from '@/components/ProvisionalPasswordDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { invokeAdminOperation } from '@/services/app-users'

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/

const NovoUsuario = () => {
  const [nome, setNome] = useState('')
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [provisionalPassword, setProvisionalPassword] = useState('')
  const [createdName, setCreatedName] = useState('')
  const { toast } = useToast()
  const navigate = useNavigate()

  const usernameError = useMemo(() => {
    if (!username) return ''
    if (!USERNAME_PATTERN.test(username)) {
      return 'Use 3 a 32 caracteres: letras minúsculas sem acento, números, ponto, hífen ou sublinhado.'
    }
    return ''
  }, [username])
  const nomeError = nome && nome.trim().length < 2 ? 'Informe pelo menos 2 caracteres.' : ''
  const valid = nome.trim().length >= 2 && USERNAME_PATTERN.test(username)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)

    try {
      const result = await invokeAdminOperation({ operation: 'create', nome, username })
      if (result.alreadyExists) {
        toast({
          title: 'Usuário já cadastrado',
          description: 'A repetição foi reconhecida e nenhuma duplicidade foi criada.',
        })
        navigate('/usuarios', { replace: true })
        return
      }
      if (!result.provisionalPassword) {
        throw new Error(
          'O cadastro foi criado, mas a senha provisória não foi retornada. Redefina-a na lista de usuários.',
        )
      }
      setCreatedName(result.user?.nome ?? nome.trim())
      setProvisionalPassword(result.provisionalPassword)
      toast({ title: 'Usuário cadastrado com sucesso' })
    } catch (error) {
      toast({
        title: 'Não foi possível cadastrar',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout backTo="/usuarios" className="pb-5">
      <header className="mb-7">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E6B3A]/30 text-[#F2B705]">
          <UserPlus className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-3xl font-bold">Novo usuário</h1>
        <p className="mt-1 text-lg text-[#A8B3A6]">
          Todos os usuários são administradores nesta versão.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <label htmlFor="nome" className="field-label">
            NOME
          </label>
          <Input
            id="nome"
            autoComplete="off"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            aria-invalid={Boolean(nomeError)}
            aria-describedby={nomeError ? 'nome-erro' : undefined}
            className="h-14 rounded-[14px] border-[#26332A] bg-[#141B15] text-lg text-[#F3EAD3]"
            maxLength={80}
          />
          {nomeError && (
            <p id="nome-erro" className="text-sm font-medium text-[#E5484D]">
              {nomeError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="new-username" className="field-label">
            NOME DE USUÁRIO
          </label>
          <Input
            id="new-username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) =>
              setUsername(event.target.value.toLocaleLowerCase('pt-BR').replace(/\s/g, ''))
            }
            aria-invalid={Boolean(usernameError)}
            aria-describedby="username-ajuda"
            className="h-14 rounded-[14px] border-[#26332A] bg-[#141B15] text-lg text-[#F3EAD3]"
            maxLength={32}
          />
          <p
            id="username-ajuda"
            className={
              usernameError ? 'text-sm font-medium text-[#E5484D]' : 'text-sm text-[#A8B3A6]'
            }
          >
            {usernameError || 'Será usado somente para entrar no aplicativo.'}
          </p>
        </div>

        <div className="rounded-2xl border border-[#F2B705]/25 bg-[#F2B705]/5 p-4 text-sm leading-relaxed text-[#D8CEB5]">
          O sistema criará uma senha provisória única. Ela será mostrada uma vez e deverá ser
          entregue por canal seguro.
        </div>

        <Button
          type="submit"
          className="h-14 w-full rounded-2xl bg-[#1E6B3A] text-base font-bold hover:bg-[#25814A]"
          disabled={!valid || submitting}
        >
          {submitting ? (
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-5 w-5" />
          )}
          {submitting ? 'CADASTRANDO...' : 'CADASTRAR USUÁRIO'}
        </Button>
      </form>

      <ProvisionalPasswordDialog
        open={Boolean(provisionalPassword)}
        password={provisionalPassword}
        userName={createdName}
        onClose={() => {
          setProvisionalPassword('')
          navigate('/usuarios', { replace: true })
        }}
      />
    </Layout>
  )
}

export default NovoUsuario
