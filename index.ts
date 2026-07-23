// Edge Function: ziva-trending
// Busca notícias/tendências sobre Angola em tempo real via The News API
// Devolve artigos em cache por 30 minutos para reduzir custos de API
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOP_STORIES_URL = "https://app-cuwiuhind9fl-api-wL1zlEdVM6DY.gateway.appmedo.com/v1/news/top";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verifica cache — evita chamadas redundantes à API paga
  const cacheKey = "angola_trending_v1";
  const { data: cached } = await supabase
    .from("trending_cache")
    .select("data, cached_at")
    .eq("cache_key", cacheKey)
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.cached_at).getTime();
    if (age < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  // Busca notícias sobre Angola/África em português e inglês
  const params = new URLSearchParams({
    search: "Angola OR Luanda OR Africa",
    language: "pt,en",
    limit: "8",
    sort: "published_on",
  });

  try {
    const newsRes = await fetch(`${TOP_STORIES_URL}?${params}`, {
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!newsRes.ok) {
      throw new Error(`News API error: ${newsRes.status}`);
    }

    const newsJson = await newsRes.json();
    const articles = (newsJson.data ?? []).map((a: Record<string, unknown>) => ({
      uuid: a.uuid,
      title: a.title,
      description: a.description,
      snippet: a.snippet,
      url: a.url,
      image_url: a.image_url,
      source: a.source,
      published_at: a.published_at,
      categories: a.categories,
    }));

    const result = { articles, fetched_at: new Date().toISOString() };

    // Actualiza cache
    await supabase
      .from("trending_cache")
      .upsert({ cache_key: cacheKey, data: result, cached_at: new Date().toISOString() });

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
