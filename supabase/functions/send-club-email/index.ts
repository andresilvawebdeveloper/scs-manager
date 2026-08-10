import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const email = body.email || body.to;
    const athleteName = body.athleteName || "Atleta";
    const status = body.status;
    const accessCode = body.accessCode || "";

    if (!email) {
      return new Response(
        JSON.stringify({ error: "O campo de email é obrigatório e está vazio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let subject = "Sport Clube Sanjoanense - Estado da Inscrição";

    const headerHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 20px; border-radius: 12px;">
        <div style="background-color: #dc2626; padding: 24px; border-top-left-radius: 12px; border-top-right-radius: 12px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">
            SPORT CLUBE SANJOANENSE
          </h1>
          <p style="color: #fca5a5; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
            Plataforma de Gestão do Atleta
          </p>
        </div>
        <div style="background-color: #ffffff; padding: 32px 24px; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; border: 1px solid #e2e8f0; border-top: none;">
    `;

    const footerHtml = `
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
            Este é um email automático enviado pelo sistema de gestão do <strong>Sport Clube Sanjoanense</strong>.<br />
            Por favor, não responda diretamente a esta mensagem.
          </p>
        </div>
      </div>
    `;

    let contentInnerHtml = "";

    if (status === "accepted") {
      subject = `Inscrição Aceite - ${athleteName}`;
      contentInnerHtml = `
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="background-color: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; padding: 6px 16px; border-radius: 9999px; display: inline-block;">
            ✓ INSCRIÇÃO ACEITE
          </span>
        </div>

        <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-align: center;">
          Bem-vindo(a) ao Clube, ${athleteName}!
        </h2>

        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          A ficha de inscrição foi validada com sucesso pela direção do Sport Clube Sanjoanense. A partir de agora, já pode aceder à Área Pessoal para acompanhar dados e presenças.
        </p>

        <div style="background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">
            O Seu Código de Acesso
          </span>
          <span style="color: #dc2626; font-size: 32px; font-weight: 800; font-family: monospace; letter-spacing: 4px; display: block;">
            ${accessCode}
          </span>
          <span style="color: #94a3b8; font-size: 11px; display: block; margin-top: 8px;">
            Guarde este código para fazer login na plataforma.
          </span>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
          Obrigado por fazer parte da nossa família desportiva!
        </p>
      `;
    } else {
      subject = `Revisão Necessária - Inscrição de ${athleteName}`;
      contentInnerHtml = `
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; padding: 6px 16px; border-radius: 9999px; display: inline-block;">
            ⚠️ AÇÃO NECESSÁRIA
          </span>
        </div>

        <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-align: center;">
          Revisão da Inscrição de ${athleteName}
        </h2>

        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
          A ficha de inscrição do(a) atleta foi analisada pela direção, mas é necessário corrigir ou atualizar alguns dados inseridos.
        </p>

        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
          Por favor, aceda à plataforma do clube para efetuar as correções necessárias e submeter novamente.
        </p>
      `;
    }

    const htmlContent = `${headerHtml}${contentInnerHtml}${footerHtml}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SCS Manager <onboarding@resend.dev>",
        to: email,
        subject: subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Erro devolvido pelo Resend:", data);
      return new Response(
        JSON.stringify({ error: data.message || "Erro de validação no Resend", resendDetails: data }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});