export const formatCentavos = (centavos: number | null | undefined): string => {
  if (centavos === null || centavos === undefined) return 'R$ 0,00'
  const valor = centavos / 100
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export const parseBRLToCentavos = (valueStr: string): number => {
  // Remove R$, espaços e caracteres não numéricos exceto vírgula e ponto
  const clean = valueStr.replace(/[^\d,.]/g, '').trim()
  if (!clean) return 0

  // Se tiver vírgula, tratamos como separador decimal pt-BR
  if (clean.includes(',')) {
    const semPontos = clean.replace(/\./g, '')
    const comPontoDecimal = semPontos.replace(',', '.')
    const parsed = parseFloat(comPontoDecimal)
    return isNaN(parsed) ? 0 : Math.round(parsed * 100)
  }

  // Se só tiver pontos: se houver mais de um ponto ou ponto seguido de 2 dígitos no final
  const parsed = parseFloat(clean)
  return isNaN(parsed) ? 0 : Math.round(parsed * 100)
}

export const formatDateBR = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-'
  // Suporta YYYY-MM-DD ou ISO string
  const cleanDate = dateStr.split('T')[0]
  const parts = cleanDate.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

export const formatDateTimeBR = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export const getTodayDateInput = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
