import { useEffect, useMemo, useState } from 'react'
import { KeyRound, LoaderCircle, Plus, Power, PowerOff, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import { ProvisionalPasswordDialog } from '@/components/ProvisionalPasswordDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { invokeAdminOperation, listAppUsers } from '@/services/app-users'
import type { AppUser } from '@/types/app'

const Usuarios = () => {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [statusTarget, setStatusTarget] = useState<AppUser | null>(null)
  const [passwordTarget, setPasswordTarget] = useState<AppUser | null>(null)
  const [provisionalPassword, setProvisionalPassword] = useState('')
  const { appUser } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const activeCount = useMemo(() => users.filter((user) => user.ativo).length, [users])

  const [mostrarTecnicos, setMostrarTecnicos] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      // B02: listAppUsers(mostrarTecnicos) oculta contas técnicas da listagem operacional padrão
      setUsers(await listAppUsers(mostrarTecnicos))
    } catch {
      toast({
        title: 'Não foi possível carregar os usuários',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [mostrarTecnicos])

  const changeStatus = async () => {
    if (!statusTarget) return
    const target = statusTarget
    setStatusTarget(null)
    setBusyUserId(target.id)

    try {
      await invokeAdminOperation({
        operation: target.ativo ? 'deactivate' : 'reactivate',
        targetUserId: target.id,
      })
      await load()
      toast({
        title: target.ativo ? 'Usuário desativado' : 'Usuário reativado',
        description: target.ativo
          ? 'O acesso aos dados foi bloqueado e o histórico foi preservado.'
          : 'O usuário já pode voltar a acessar o aplicativo.',
      })
    } catch (error) {
      toast({
        title: 'Não foi possível alterar a situação',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      })
      await load()
    } finally {
      setBusyUserId(null)
    }
  }

  const resetPassword = async (target: AppUser) => {
    setBusyUserId(target.id)
    try {
      const result = await invokeAdminOperation({
        operation: 'reset-password',
        targetUserId: target.id,
      })
      if (!result.provisionalPassword)
        throw new Error('O servidor não retornou a senha provisória.')
      setPasswordTarget(target)
      setProvisionalPassword(result.provisionalPassword)
      await load()
    } catch (error) {
      toast({
        title: 'Não foi possível redefinir a senha',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <Layout backTo="/" className="pb-4">
      <header className="mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E6B3A]/30 text-[#F2B705]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold leading-tight">Usuários</h1>
            <p className="text-[#A8B3A6]">Administradores do bar</p>
          </div>
        </div>
        <Button
          type="button"
          className="mt-5 h-14 w-full rounded-2xl bg-[#1E6B3A] text-base font-bold hover:bg-[#25814A]"
          onClick={() => navigate('/usuarios/novo')}
        >
          <Plus className="mr-2 h-5 w-5" />
          CADASTRAR USUÁRIO
        </Button>

        {/* B02: Alternador discreto para contas técnicas / de teste */}
        <div className="mt-3 flex items-center justify-between text-xs text-[#879689]">
          <span>Exibindo administradores operacionais do bar</span>
          <button
            type="button"
            onClick={() => setMostrarTecnicos(!mostrarTecnicos)}
            className="text-[11px] text-[#A8B3A6] hover:text-[#F3EAD3] underline"
          >
            {mostrarTecnicos ? 'Ocultar contas técnicas' : 'Mostrar contas técnicas'}
          </button>
        </div>
      </header>

      {loading && users.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-14" role="status">
          <LoaderCircle className="h-8 w-8 animate-spin text-[#F2B705]" />
          <span className="ml-3 text-[#A8B3A6]">Carregando usuários...</span>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Lista de usuários">
          {users.map((user) => {
            const isBusy = busyUserId === user.id
            const isLastActive = user.ativo && activeCount <= 1
            return (
              <li key={user.id} className="rounded-2xl border border-[#26332A] bg-[#141B15] p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#26332A] text-[#F3EAD3]">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-bold">{user.nome}</h2>
                      {user.id === appUser?.id && (
                        <span className="text-xs font-bold text-[#F2B705]">VOCÊ</span>
                      )}
                    </div>
                    <p className="truncate text-base text-[#A8B3A6]">@{user.username}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      user.ativo
                        ? 'border-[#3DD68C]/60 bg-[#3DD68C]/10 text-[#79E8B2]'
                        : 'border-[#718078]/60 bg-[#718078]/10 text-[#C0C8C2]'
                    }
                  >
                    {user.ativo ? 'ATIVO' : 'INATIVO'}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 border-[#36513E] bg-transparent font-bold text-[#F3EAD3] hover:bg-[#26332A] hover:text-white"
                    onClick={() => void resetPassword(user)}
                    disabled={isBusy || !user.ativo}
                  >
                    {isBusy ? (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-2 h-4 w-4 text-[#F2B705]" />
                    )}
                    REDEFINIR SENHA
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={
                      user.ativo
                        ? 'h-12 border-[#E5484D]/50 bg-transparent font-bold text-[#FF9295] hover:bg-[#E5484D]/10 hover:text-[#FFB2B4]'
                        : 'h-12 border-[#3DD68C]/50 bg-transparent font-bold text-[#79E8B2] hover:bg-[#3DD68C]/10 hover:text-[#A0F2C9]'
                    }
                    onClick={() => setStatusTarget(user)}
                    disabled={isBusy || isLastActive}
                    title={
                      isLastActive
                        ? 'Não é possível desativar o último administrador ativo.'
                        : undefined
                    }
                  >
                    {user.ativo ? (
                      <PowerOff className="mr-2 h-4 w-4" />
                    ) : (
                      <Power className="mr-2 h-4 w-4" />
                    )}
                    {user.ativo ? 'DESATIVAR' : 'REATIVAR'}
                  </Button>
                </div>
                {isLastActive && (
                  <p className="mt-2 text-sm text-[#A8B3A6]">
                    O último administrador ativo não pode ser desativado.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <AlertDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => !open && setStatusTarget(null)}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-3xl border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">
              {statusTarget?.ativo ? 'Desativar usuário?' : 'Reativar usuário?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-[#A8B3A6]">
              {statusTarget?.ativo
                ? `${statusTarget.nome} perderá o acesso na próxima consulta. Seus registros e histórico serão preservados.`
                : `${statusTarget?.nome} voltará a ter acesso aos dados do bar.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12 border-[#36513E] bg-transparent hover:bg-[#26332A]">
              CANCELAR
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-12 bg-[#1E6B3A] font-bold hover:bg-[#25814A]"
              onClick={() => void changeStatus()}
            >
              CONFIRMAR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProvisionalPasswordDialog
        open={Boolean(provisionalPassword)}
        password={provisionalPassword}
        userName={passwordTarget?.nome}
        onClose={() => {
          setProvisionalPassword('')
          setPasswordTarget(null)
        }}
      />
    </Layout>
  )
}

export default Usuarios
