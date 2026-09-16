import { Home, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <Layout className="items-center justify-center pb-16 text-center">
      <TriangleAlert className="h-12 w-12 text-[#F2B705]" />
      <p className="mt-4 text-sm font-bold tracking-[0.2em] text-[#A8B3A6]">ERRO 404</p>
      <h1 className="mt-2 text-3xl font-bold">Página não encontrada</h1>
      <Button
        className="mt-7 h-14 rounded-2xl bg-[#1E6B3A] px-6 text-base font-bold hover:bg-[#25814A]"
        onClick={() => navigate('/')}
      >
        <Home className="mr-2 h-5 w-5" />
        IR PARA O INÍCIO
      </Button>
    </Layout>
  )
}

export default NotFound
