import { Banknote, BookOpenText, ClipboardList, LogOut, Package, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

const Index = () => {
  const { appUser, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const leave = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      toast({
        title: 'Não foi possível sair',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Layout className="py-5">
      <header className="text-center">
        <BrandLogo />
        <h1 className="mt-3 text-[28px] font-bold leading-tight">Gerenciamento do bar</h1>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#26332A] bg-[#141B15] px-4 py-3 text-left">
          <p className="min-w-0 truncate text-lg font-semibold">Olá, {appUser?.nome}</p>
          <Button
            type="button"
            variant="ghost"
            className="h-12 shrink-0 px-3 font-bold text-[#F3EAD3] hover:bg-[#26332A]"
            onClick={leave}
          >
            <LogOut className="mr-2 h-5 w-5" />
            SAIR
          </Button>
        </div>
      </header>

      <nav className="mt-6 space-y-4" aria-label="Módulos do bar">
        <Button
          type="button"
          className="module-button pour-in h-24 w-full justify-start rounded-[28px] bg-[#1E6B3A] px-7 text-2xl font-bold tracking-[0.08em] text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.97]"
          onClick={() => navigate('/fiado')}
        >
          <BookOpenText className="mr-5 h-8 w-8" aria-hidden="true" />
          FIADO
        </Button>
        <Button
          type="button"
          className="module-button pour-in pour-in-delay h-24 w-full justify-start rounded-[28px] bg-[#1E6B3A] px-7 text-2xl font-bold tracking-[0.08em] text-[#F3EAD3] hover:bg-[#25814A] active:scale-[0.97]"
          onClick={() => navigate('/caixa')}
        >
          <Banknote className="mr-5 h-8 w-8" aria-hidden="true" />
          CAIXA
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-16 w-full justify-start rounded-2xl border-[#26332A] bg-[#141B15] px-6 text-lg font-bold tracking-wide text-[#F3EAD3] hover:bg-[#1A251C] hover:text-white active:scale-[0.98]"
          onClick={() => navigate('/comandas')}
        >
          <ClipboardList className="mr-4 h-6 w-6 text-[#F2B705]" aria-hidden="true" />
          COMANDAS
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-16 w-full justify-start rounded-2xl border-[#26332A] bg-[#141B15] px-6 text-lg font-bold tracking-wide text-[#F3EAD3] hover:bg-[#1A251C] hover:text-white active:scale-[0.98]"
          onClick={() => navigate('/produtos')}
        >
          <Package className="mr-4 h-6 w-6 text-[#F2B705]" aria-hidden="true" />
          PRODUTOS
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-16 w-full justify-start rounded-2xl border-[#26332A] bg-[#141B15] px-6 text-lg font-bold tracking-wide text-[#F3EAD3] hover:bg-[#1A251C] hover:text-white active:scale-[0.98]"
          onClick={() => navigate('/usuarios')}
        >
          <Users className="mr-4 h-6 w-6 text-[#F2B705]" aria-hidden="true" />
          USUÁRIOS
        </Button>
      </nav>
    </Layout>
  )
}

export default Index
