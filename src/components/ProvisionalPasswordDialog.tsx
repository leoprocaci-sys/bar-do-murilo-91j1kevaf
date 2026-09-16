import { useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

type ProvisionalPasswordDialogProps = {
  open: boolean
  password: string
  userName?: string
  onClose: () => void
}

export const ProvisionalPasswordDialog = ({
  open,
  password,
  userName,
  onClose,
}: ProvisionalPasswordDialogProps) => {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      toast({ title: 'Senha copiada' })
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'Selecione a senha e copie manualmente.',
        variant: 'destructive',
      })
    }
  }

  const close = () => {
    setCopied(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] rounded-3xl border-[#26332A] bg-[#141B15] text-[#F3EAD3] sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#1E6B3A]/30 text-[#F2B705]">
            <KeyRound className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl">Senha provisória</DialogTitle>
          <DialogDescription className="text-base text-[#A8B3A6]">
            {userName ? `Entregue esta senha a ${userName}` : 'Entregue esta senha ao usuário'} por
            um canal seguro. Ela aparece somente agora e deverá ser trocada no próximo acesso.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-[#F2B705]/40 bg-[#0B0F0C] p-4">
          <code className="block select-all break-all text-center text-lg font-bold tracking-wider text-[#F3EAD3]">
            {password}
          </code>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 border-[#36513E] bg-transparent"
            onClick={copy}
          >
            {copied ? <Check className="mr-2 h-5 w-5" /> : <Copy className="mr-2 h-5 w-5" />}
            {copied ? 'COPIADA' : 'COPIAR'}
          </Button>
          <Button type="button" className="h-12 bg-[#1E6B3A] hover:bg-[#25814A]" onClick={close}>
            ENTENDI, FECHAR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
