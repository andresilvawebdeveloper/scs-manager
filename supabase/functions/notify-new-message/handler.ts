// Envia as notificações (push no telemóvel e email) de uma mensagem nova do chat.
// A lógica está aqui, separada do servidor (index.ts), para poder ser testada.

export interface Deps {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  // deno-lint-ignore no-explicit-any
  createClient: (url: string, key: string, options?: any) => any;
  now?: () => Date;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export const escapeHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function buildTexts(message: { sender: string; sender_name?: string; family_email?: string; text?: string }) {
  const fromCoach = message.sender === "Coach";
  const who = message.sender_name || (fromCoach ? "Treinador" : "Encarregado");
  const title = fromCoach && message.family_email === "all"
    ? `📢 Comunicado do clube (${who})`
    : `💬 Nova mensagem de ${who}`;
  const body = truncate(String(message.text || ""), 140);
  return { title, body, who };
}

export function buildEmailHtml(title: string, who: string, text: string, appUrl?: string) {
  const link = appUrl
    ? `<p style="text-align:center;margin:24px 0 0"><a href="${escapeHtml(appUrl)}" style="background:#dc2626;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:14px">Abrir o SCS Manager</a></p>`
    : "";
  return `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f8fafc;padding:20px;border-radius:12px">
  <div style="background:#dc2626;padding:20px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:18px">SPORT CLUBE SANJOANENSE</h1>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
    <h2 style="color:#0f172a;font-size:16px;margin:0 0 12px">${escapeHtml(title)}</h2>
    <div style="background:#f1f5f9;border-left:4px solid #dc2626;padding:12px 16px;border-radius:6px;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(text)}</div>
    <p style="color:#64748b;font-size:12px;margin:12px 0 0">Enviada por ${escapeHtml(who)}. Responda pela aplicação.</p>
    ${link}
  </div>
</div>`;
}

export async function handleNotify(req: Request, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Método não permitido" });

  const env = deps.env;
  const url = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json(500, { error: "Configuração do Supabase em falta" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Sem sessão" });

  let messageId: string;
  try {
    const body = await req.json();
    messageId = String(body?.message_id ?? "");
  } catch {
    return json(400, { error: "Pedido inválido" });
  }
  if (!messageId) return json(400, { error: "message_id em falta" });

  // 1. Quem pede tem de conseguir ver a mensagem (as regras RLS decidem)
  const userClient = deps.createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: visible, error: visErr } = await userClient.from("messages").select("id").eq("id", messageId).maybeSingle();
  if (visErr || !visible) return json(403, { error: "Sem acesso a esta mensagem" });

  // 2. Marca como notificada (só uma vez por mensagem) e lê-a com privilégios de servidor
  const admin = deps.createClient(url, serviceKey);
  const { data: claimed, error: claimErr } = await admin
    .from("messages")
    .update({ notified_at: (deps.now?.() ?? new Date()).toISOString() })
    .eq("id", messageId)
    .is("notified_at", null)
    .select("*");
  if (claimErr) return json(500, { error: claimErr.message });
  const message = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!message) return json(200, { skipped: "já notificada" });

  const created = message.created_at ? new Date(message.created_at).getTime() : Date.now();
  if ((deps.now?.() ?? new Date()).getTime() - created > 15 * 60 * 1000) {
    return json(200, { skipped: "mensagem antiga" });
  }

  // 3. Destinatários
  const { data: recipients, error: recErr } = await admin.rpc("scs_message_recipients", { p_message_id: messageId });
  if (recErr) return json(500, { error: recErr.message });
  // deno-lint-ignore no-explicit-any
  const list = (recipients || []) as any[];
  const userIds = [...new Set(list.filter((r) => r.user_id && r.kind !== "email").map((r) => String(r.user_id)))];
  const emails = [...new Set(list.filter((r) => r.email && r.kind !== "push").map((r) => String(r.email).toLowerCase()))];

  const { title, body, who } = buildTexts(message);
  const result: Record<string, unknown> = { push: 0, email: 0 };

  // 4. Push (OneSignal) — os utilizadores ficam identificados pelo id da conta (OneSignal.login no browser)
  const osApp = env("ONESIGNAL_APP_ID");
  const osKey = env("ONESIGNAL_REST_API_KEY");
  if (osApp && osKey && userIds.length) {
    for (let i = 0; i < userIds.length; i += 2000) {
      const chunk = userIds.slice(i, i + 2000);
      const res = await deps.fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Key ${osKey}` },
        body: JSON.stringify({
          app_id: osApp,
          target_channel: "push",
          include_aliases: { external_id: chunk },
          headings: { en: title, pt: title },
          contents: { en: body || " ", pt: body || " " },
          ...(env("APP_URL") ? { url: env("APP_URL") } : {}),
        }),
      });
      if (res.ok) result.push = (result.push as number) + chunk.length;
      else result.pushError = await res.text();
    }
  } else if (!osApp || !osKey) {
    result.pushSkipped = "ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY não configurados";
  }

  // 5. Email (Resend), em lotes de 100
  const resendKey = env("RESEND_API_KEY");
  const emailOn = (env("NOTIFY_EMAIL") ?? "on") !== "off";
  if (resendKey && emailOn && emails.length) {
    const from = env("CLUB_EMAIL_FROM") || "SCS Manager <onboarding@resend.dev>";
    const html = buildEmailHtml(title, who, String(message.text || ""), env("APP_URL"));
    for (let i = 0; i < emails.length; i += 100) {
      const batch = emails.slice(i, i + 100).map((to) => ({ from, to, subject: title, html }));
      const res = await deps.fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify(batch),
      });
      if (res.ok) result.email = (result.email as number) + batch.length;
      else result.emailError = await res.text();
    }
  }

  return json(200, result);
}
