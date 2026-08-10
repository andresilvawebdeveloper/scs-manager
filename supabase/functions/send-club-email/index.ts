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

    // Chamada ao Resend
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

    // SE O RESEND DEVOLVER ERRO, LANÇA EXCEÇÃO PARA O FRONTEND MOSTRAR
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