import logo from '@/assets/3c364cd8-f441-4821-a401-f59cc918d577-7e9fb.png'
import { cn } from '@/lib/utils'

export const BrandLogo = ({ compact = false }: { compact?: boolean }) => (
  <img
    src={logo}
    alt="Bar do Murilo"
    className={cn(
      'logo-enter mx-auto aspect-square object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.5)]',
      compact ? 'w-24 sm:w-28' : 'w-36 sm:w-40',
    )}
  />
)
