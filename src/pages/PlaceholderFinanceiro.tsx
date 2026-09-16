import { Banknote, BookOpenText, Construction } from 'lucide-react'
import Layout from '@/components/Layout'

type PlaceholderFinanceiroProps = {
  modulo: 'FIADO' | 'CAIXA'
}

const PlaceholderFinanceiro = ({ modulo }: PlaceholderFinanceiroProps) => {
  const ModuleIcon = modulo === 'FIADO' ? BookOpenText : Banknote

  return (
    <Layout backTo="/" className="items-center justify-center text-center pb-16">
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#1E6B3A] text-[#F3EAD3] shadow-[0_10px_30px_rgba(30,107,58,0.25)]">
        <ModuleIcon className="h-10 w-10" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-bold tracking-[0.18em] text-[#F2B705]">{modulo}</p>
      <Construction className="mt-8 h-8 w-8 text-[#A8B3A6]" aria-hidden="true" />
      <h1 className="mt-4 max-w-xs text-3xl font-bold leading-tight">
        Disponível na próxima etapa
      </h1>
      <p className="mt-3 max-w-sm text-lg text-[#A8B3A6]">
        Nenhuma operação financeira está disponível nesta versão.
      </p>
    </Layout>
  )
}

export default PlaceholderFinanceiro
