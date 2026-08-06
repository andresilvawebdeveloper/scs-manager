import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  try {
    const { email, athleteName, status, accessCode } = await req.json();

    let subject = "Sport Clube Sanjoanense - Estado da Inscrição";
    let htmlContent = "";

    if (status === "accepted") {
      subject = `Inscrição Aceite - ${athleteName}`;
      htmlContent = `
        <h2>Parabéns! A inscrição do(a) atleta ${athleteName} foi aceite.</h2>
        <p>O Sport Clube Sanjoanense já validou a ficha de inscrição.</p>
        <p>Pode aceder à sua Área Pessoal utilizando o seguinte <strong>Código de Acesso</strong>:</p>
        <h3 style="color: #e53e3e; font-size: 20px;">${accessCode}</h3>
        <p>Obrigado por fazer parte do nosso clube!</p>
      `;
    } else {
      subject = `Revisão Necessária - Inscrição de ${athleteName}`;
      htmlContent = `
        <h2>Aviso do Sport Clube Sanjoanense</h2>
        <p>A ficha de inscrição do(a) atleta ${athleteName} foi revista, mas é necessário alterar ou corrigir alguns dados inseridos.</p>
        <p>Por favor, aceda à plataforma do clube para rever e atualizar a informação.</p>
      `;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SCS Manager <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
});