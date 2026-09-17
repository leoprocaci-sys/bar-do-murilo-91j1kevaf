/**
 * Utilitários para compartilhamento via WhatsApp e Web Share API
 * Regras da Frente 3:
 * - O app NÃO realiza envio automático — o usuário confirma o envio no WhatsApp.
 * - O lançamento deve estar salvo antes do compartilhamento.
 * - Compartilhamento de consumo: prepara texto com data, descrição, valor e foto (quando disponível).
 * - Compartilhamento pela ficha do cliente: resumo compreensível da dívida com elementos que explicam saldo e pagamentos. NÃO incluir observações internas, motivo de restrição ou informações administrativas.
 * - Cancelar/repetir o compartilhamento NÃO cria outro consumo nem duplica operação.
 * - Foto: NÃO armazenar permanentemente. Usar Web Share API com arquivos se suportado pelo navegador/dispositivo, ou fallback para texto e download/cópia local da foto.
 */

import { formatCentavos, formatDateBR } from '@/lib/formatters'
import type { Cliente, SituacaoFinanceiraCliente } from '@/types/fiado'

export function limparTelefoneParaWhatsApp(telefone: string | null | undefined): string {
  if (!telefone) return ''
  const apenasNumeros = telefone.replace(/\D/g, '')
  if (!apenasNumeros) return ''
  // Se não tem DDI 55 (Brasil) e tem 10 ou 11 dígitos
  if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
    return `55${apenasNumeros}`
  }
  return apenasNumeros
}

export function gerarTextoConsumoFiado({
  clienteNome,
  dataMovimento,
  descricao,
  valorCentavos,
}: {
  clienteNome: string
  dataMovimento: string
  descricao?: string | null
  valorCentavos: number
}): string {
  const dataFmt = formatDateBR(dataMovimento)
  const valorFmt = formatCentavos(valorCentavos)
  const descFmt = descricao?.trim() ? `\n• Itens: ${descricao.trim()}` : ''

  return (
    `*Bar do Murilo — Comprovante de Consumo Fiado*\n\n` +
    `Olá, ${clienteNome}!\n` +
    `Confirmamos o lançamento no seu caderno:\n` +
    `• Data: ${dataFmt}\n` +
    `• Valor: *${valorFmt}*${descFmt}\n\n` +
    `Agradecemos a preferência!`
  )
}

export function gerarTextoResumoFichaCliente({
  cliente,
  situacao,
}: {
  cliente: Cliente
  situacao: SituacaoFinanceiraCliente
}): string {
  const dataHoje = formatDateBR(new Date().toISOString().split('T')[0])
  const saldoDevedorFmt = formatCentavos(situacao.saldoDevedorCentavos)
  const creditoFmt = formatCentavos(situacao.totalCreditoDisponivelCentavos)
  const totalPagoFmt = formatCentavos(situacao.totalPagoCentavos)

  let texto =
    `*Bar do Murilo — Resumo de Conta Fiado*\n` +
    `Data da consulta: ${dataHoje}\n\n` +
    `Olá, ${cliente.nome}!\n` +
    `Aqui está a posição atualizada do seu caderno no bar:\n\n` +
    `• *Dívida em aberto:* ${saldoDevedorFmt}\n`

  if (situacao.totalCreditoDisponivelCentavos > 0) {
    texto += `• *Crédito a seu favor:* ${creditoFmt}\n`
  }

  if (situacao.totalPagoCentavos > 0) {
    texto += `• Total já amortizado em pagamentos: ${totalPagoFmt}\n`
  }

  texto +=
    `\nQualquer dúvida ou para conferência de itens, estamos à disposição no balcão.\n` +
    `Bar do Murilo agradece!`

  return texto
}

export function abrirWhatsAppComTexto(telefone: string | null | undefined, texto: string) {
  const numLimpo = limparTelefoneParaWhatsApp(telefone)
  const textoCodificado = encodeURIComponent(texto)
  let url = ''

  if (numLimpo) {
    url = `https://wa.me/${numLimpo}?text=${textoCodificado}`
  } else {
    url = `https://api.whatsapp.com/send?text=${textoCodificado}`
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

export type CompartilharResultado = {
  sucesso: boolean
  metodo: 'web-share-com-arquivo' | 'web-share-texto' | 'whatsapp-link' | 'copiado'
  mensagem?: string
}

/**
 * Tenta compartilhar usando navigator.share (com imagem e texto se suportado)
 * Caso não haja suporte nativo a compartilhamento com arquivo, faz fallback seguro abrindo WhatsApp com texto.
 */
export async function compartilharDados({
  telefone,
  texto,
  arquivoFoto,
  titulo = 'Bar do Murilo',
}: {
  telefone?: string | null
  texto: string
  arquivoFoto?: File | null
  titulo?: string
}): Promise<CompartilharResultado> {
  // 1. Tenta Web Share API se disponível
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (arquivoFoto && navigator.canShare && navigator.canShare({ files: [arquivoFoto] })) {
        await navigator.share({
          title: titulo,
          text: texto,
          files: [arquivoFoto],
        })
        return { sucesso: true, metodo: 'web-share-com-arquivo' }
      }

      // Se não tem arquivo ou navegador não permite compartilhar arquivos via Share API
      await navigator.share({
        title: titulo,
        text: texto,
      })
      return { sucesso: true, metodo: 'web-share-texto' }
    } catch (err: any) {
      // Se usuário cancelou o diálogo de compartilhamento, não é erro do sistema
      if (err.name === 'AbortError') {
        return {
          sucesso: false,
          metodo: 'web-share-texto',
          mensagem: 'Compartilhamento cancelado.',
        }
      }
      // Se deu erro real de permissão, cai para o fallback do link do WhatsApp
      console.warn('Web Share falhou, usando fallback direto WhatsApp', err)
    }
  }

  // 2. Fallback: Abrir WhatsApp Web / App diretamente com o texto
  abrirWhatsAppComTexto(telefone, texto)
  return { sucesso: true, metodo: 'whatsapp-link' }
}
