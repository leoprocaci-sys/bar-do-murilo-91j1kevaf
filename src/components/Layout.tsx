import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type LayoutProps = {
  children: ReactNode
  backTo?: string
  backLabel?: string
  className?: string
}

export const Layout = ({ children, backTo, backLabel = 'VOLTAR', className }: LayoutProps) => {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0B0F0C] text-[#F3EAD3]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-7">
        {backTo && (
          <header className="mb-3 flex min-h-12 items-center">
            <Button
              type="button"
              variant="ghost"
              className="-ml-3 h-12 gap-1 px-3 text-base font-bold text-[#F3EAD3] hover:bg-[#141B15] hover:text-white"
              onClick={() => navigate(backTo)}
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              {backLabel}
            </Button>
          </header>
        )}
        <main className={cn('flex min-w-0 flex-1 flex-col', className)}>{children}</main>
      </div>
    </div>
  )
}

export default Layout
