import { LoaderCircle } from 'lucide-react'

export const LoadingScreen = ({ label = 'Carregando...' }: { label?: string }) => (
  <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <LoaderCircle className="h-8 w-8 animate-spin text-[#F2B705]" aria-hidden="true" />
      <p className="text-lg text-muted-foreground">{label}</p>
    </div>
  </div>
)
