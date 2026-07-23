// Edge Function: large-language-model
// Proxies requests to Gemini 2.5 Flash, streaming SSE response
// Suporta chave API pessoal do utilizador via campo "user_gemini_key" no body
import { serve } from "https://deno.land/std/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let contents: unknown[];
  let userGeminiKey: string | undefined;
  try {
    const body = await req.json();
    contents = body.contents;
    userGeminiKey = typeof body.user_gemini_key === "string" && body.user_gemini_key.trim()
      ? body.user_gemini_key.trim()
      : undefined;
    if (!Array.isArray(contents) || contents.length === 0) throw new Error("empty");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Usa a chave pessoal do utilizador se fornecida; caso contrário usa a chave da plataforma
  let apiUrl: string;
  let authHeader: Record<string, string>;

  if (userGeminiKey) {
    // Chave pessoal Google AI Studio — chama diretamente a API Gemini
    apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${userGeminiKey}`;
    authHeader = {};
  } else {
    const platformKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!platformKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    apiUrl = "https://app-cuwiuhind9fl-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse";
    authHeader = { "X-Gateway-Authorization": `Bearer ${platformKey}` };
  }

  const upstream = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ contents }),
  });

  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: `Upstream error: ${upstream.status}` }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    headers: {
      ...CORS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
