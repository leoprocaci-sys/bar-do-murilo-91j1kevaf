import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { getAppUser } from '@/services/app-users'
import type { AppUser } from '@/types/app'

type AuthContextValue = {
  user: User | null
  session: Session | null
  appUser: AppUser | null
  loading: boolean
  validating: boolean
  signIn: (username: string, password: string) => Promise<AppUser>
  signOut: () => Promise<void>
  refreshAppUser: () => Promise<AppUser | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const technicalEmail = (username: string) =>
  `${username.trim().toLocaleLowerCase('pt-BR')}@bar-do-murilo.local`

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    let active = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (!nextSession) setAppUser(null)
    })

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const refreshAppUser = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const currentSession = sessionData.session
    if (!currentSession?.user) {
      setSession(null)
      setUser(null)
      setAppUser(null)
      return null
    }

    setValidating(true)
    try {
      const profile = await getAppUser(currentSession.user.id)
      if (!profile?.ativo || profile.perfil !== 'administrador') {
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        setAppUser(null)
        return null
      }
      setSession(currentSession)
      setUser(currentSession.user)
      setAppUser(profile)
      return profile
    } catch (error) {
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setAppUser(null)
      throw error
    } finally {
      setValidating(false)
    }
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: technicalEmail(username),
      password,
    })
    if (error || !data.user) throw error ?? new Error('Sessão não iniciada.')

    try {
      const profile = await getAppUser(data.user.id)
      if (!profile?.ativo || profile.perfil !== 'administrador') {
        await supabase.auth.signOut()
        throw new Error('unauthorized_app_user')
      }
      setAppUser(profile)
      return profile
    } catch (profileError) {
      await supabase.auth.signOut()
      throw profileError
    }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    setAppUser(null)
    if (error) throw error
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      appUser,
      loading,
      validating,
      signIn,
      signOut,
      refreshAppUser,
    }),
    [appUser, loading, refreshAppUser, session, signIn, signOut, user, validating],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return context
}
