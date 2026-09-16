import { useEffect, useRef, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { LoadingScreen } from '@/components/LoadingScreen'

export const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { session, appUser, loading, validating, refreshAppUser } = useAuth()
  const { toast } = useToast()
  const location = useLocation()
  const validatedSession = useRef<string | null>(null)

  useEffect(() => {
    if (loading || !session) return
    if (validatedSession.current === session.access_token && appUser) return

    validatedSession.current = session.access_token
    refreshAppUser().catch(() => {
      toast({
        title: 'Acesso encerrado',
        description: 'Não foi possível validar seu acesso. Entre novamente.',
        variant: 'destructive',
      })
    })
  }, [appUser, loading, refreshAppUser, session, toast])

  if (loading || (session && (!appUser || validating))) {
    return <LoadingScreen label="Validando acesso..." />
  }
  if (!session || !appUser) return <Navigate to="/login" replace />

  if (appUser.deve_alterar_senha && location.pathname !== '/primeiro-acesso') {
    return <Navigate to="/primeiro-acesso" replace />
  }
  if (!appUser.deve_alterar_senha && location.pathname === '/primeiro-acesso') {
    return <Navigate to="/" replace />
  }

  return children
}
