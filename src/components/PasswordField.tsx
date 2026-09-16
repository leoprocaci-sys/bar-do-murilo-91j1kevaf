import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  error?: string
}

export const PasswordField = ({ label, error, id, className, ...props }: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false)
  const fieldId = id ?? props.name
  const errorId = error && fieldId ? `${fieldId}-erro` : undefined

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="field-label">
        {label}
      </label>
      <div className="relative">
        <Input
          {...props}
          id={fieldId}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={cn(
            'h-14 rounded-[14px] border-[#26332A] bg-[#141B15] pr-14 text-lg text-[#F3EAD3]',
            className,
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 h-12 w-12 text-[#A8B3A6] hover:bg-[#26332A] hover:text-[#F3EAD3]"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </Button>
      </div>
      {error && (
        <p id={errorId} className="text-sm font-medium text-[#E5484D]">
          {error}
        </p>
      )}
    </div>
  )
}
