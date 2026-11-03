import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve((_req: Request) => {
  return new Response(
    JSON.stringify({
      error: 'Função desativada.',
      message: 'A migração pontual de e-mails já foi concluída e esta função foi desativada.',
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
