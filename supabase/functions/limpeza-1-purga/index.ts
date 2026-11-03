import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

// =====================================================================
// FUNÇÃO TEMPORÁRIA DESATIVADA — LIMPEZA 1.
// A execução pontual foi concluída em 2026-11-03 (purga + exclusão das
// identidades danny e teste.local via API administrativa oficial).
// A função responde 410 para qualquer chamada e NÃO contém credenciais
// nem lógica executável. Padrão já usado por migrar-emails-gestores.
// =====================================================================

Deno.serve((_req: Request) => {
  return new Response(
    JSON.stringify({
      error: 'Função desativada.',
      message: 'A limpeza pontual de dados já foi concluída e esta função foi desativada.',
    }),
    {
      status: 410,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  )
})
