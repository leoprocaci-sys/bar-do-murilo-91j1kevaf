import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const targets = {
  leo: {
    id: "303124ed-7e6e-46f6-bbe3-c33c793aaf7b",
    oldEmail: "leo@bar-do-murilo.local",
    newEmail: "leoprocaci@gmail.com",
  },
  murilo: {
    id: "2756b93f-788f-4f8e-98e8-28b02cf4c434",
    oldEmail: "murilo@bar-do-murilo.local",
    newEmail: "bardomulio@gmail.com",
  },
} as const;

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

const sameSecret = async (one: string, two: string) => {
  const h1 = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(one)));
  const h2 = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(two)));
  let difference = 0;
  for (let i = 0; i < h1.length; i++) difference |= h1[i] ^ h2[i];
  return difference === 0;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return respond({ error: "Método não permitido." }, 405);

  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!key || !url || !token || !(await sameSecret(token, key))) {
    return respond({ error: "Acesso administrativo não autorizado." }, 403);
  }

  try {
    const body = await req.json();
    const targetName = body?.target;
    if (targetName !== "leo" && targetName !== "murilo") {
      return respond({ error: "Somente as contas leo e murilo são elegíveis." }, 400);
    }
    const t = targets[targetName as keyof typeof targets];
    const requested = String(body.expected_email ?? "").trim().toLowerCase();
    if (requested !== t.newEmail) {
      return respond({ error: "E-mail de destino diferente do aprovado." }, 409);
    }

    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: account, error: accountError } = await client.auth.admin.getUserById(t.id);
    if (accountError || !account.user) {
      return respond({ error: "Conta Auth não encontrada; nada alterado." }, 404);
    }
    const currentEmail = String(account.user.email ?? "").toLowerCase();
    const { data: profile, error: profileError } = await client.from("app_users")
      .select("id, username, ativo, perfil").eq("id", t.id).single();
    if (profileError || !profile || profile.username !== targetName || !profile.ativo || profile.perfil !== "administrador") {
      return respond({ error: "Identidade administrativa divergente; nada alterado." }, 409);
    }
    const { data: staged, error: stagedError } = await client.from("app_user_emails")
      .select("email_real, verificado").eq("user_id", t.id).single();
    if (stagedError || !staged || staged.email_real.trim().toLowerCase() !== t.newEmail) {
      return respond({ error: "O e-mail pendente não corresponde ao aprovado; nada alterado." }, 409);
    }

    if (currentEmail === t.newEmail && account.user.email_confirmed_at) {
      return respond({ status: "already_migrated", username: targetName, email: t.newEmail, confirmed: true });
    }
    if (currentEmail !== t.oldEmail) {
      return respond({ error: "O e-mail atual mudou em relação ao inventário; nada alterado." }, 409);
    }

    if (body.operation !== "migrate" || body.acknowledge_mailbox_control !== true) {
      return respond({
        status: "ready",
        username: targetName,
        current_email: t.oldEmail,
        requested_email: t.newEmail,
        message: "Nenhuma alteração executada. Para migrar, confirme controle da caixa postal e envie operation=migrate.",
      });
    }

    // Única alteração: endereço da identidade Auth. O administrador atesta
    // o controle da caixa postal; a senha e o UUID permanecem inalterados.
    const { error: changeError } = await client.auth.admin.updateUserById(t.id, {
      email: t.newEmail,
      email_confirm: true,
    });
    if (changeError) {
      return respond({ error: "Supabase Auth recusou a migração.", detail: changeError.message }, 502);
    }

    const { data: readback, error: readbackError } = await client.auth.admin.getUserById(t.id);
    if (readbackError || readback.user?.email?.toLowerCase() !== t.newEmail || !readback.user.email_confirmed_at) {
      return respond({ status: "verification_required", username: targetName, message: "Alteração enviada, mas a leitura final exige revisão; não repetir a operação." }, 202);
    }
    return respond({ status: "migrated", username: targetName, email: t.newEmail, confirmed: true, id_preserved: readback.user.id === t.id });
  } catch (_) {
    return respond({ error: "Requisição inválida; nenhuma confirmação de alteração." }, 400);
  }
});
