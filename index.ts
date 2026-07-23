import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Não autorizado" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // ════════════════════════════════════════════════════════════════════════
    // GET  conversations — lista de conversas com unread + perfil do outro
    // ════════════════════════════════════════════════════════════════════════
    if (req.method === "GET" && action === "conversations") {
      const limit = parseInt(url.searchParams.get("limit") ?? "30");
      const offset = parseInt(url.searchParams.get("offset") ?? "0");

      const { data, error } = await admin
        .from("conversations")
        .select(`
          id, participant_one, participant_two,
          last_message, last_message_at,
          unread_one, unread_two, created_at
        `)
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .order("last_message_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      if (!data?.length) return json({ conversations: [] });

      // Carregar perfis dos outros participantes
      const otherIds = data.map((c) =>
        c.participant_one === user.id ? c.participant_two : c.participant_one
      );
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, username, full_name, avatar_url, is_verified")
        .in("id", otherIds);

      const profMap: Record<string, unknown> = {};
      for (const p of profiles ?? []) profMap[(p as Record<string,string>).id] = p;

      const conversations = data.map((c) => {
        const otherId = c.participant_one === user.id ? c.participant_two : c.participant_one;
        const unread = c.participant_one === user.id ? c.unread_one : c.unread_two;
        return { ...c, other: profMap[otherId], unread_count: unread ?? 0 };
      });

      return json({ conversations });
    }

    // ════════════════════════════════════════════════════════════════════════
    // GET  messages — histórico paginado de uma conversa
    // ════════════════════════════════════════════════════════════════════════
    if (req.method === "GET" && action === "messages") {
      const convId = url.searchParams.get("conversation_id");
      if (!convId) return json({ error: "Parâmetro conversation_id obrigatório" }, 400);

      const limit = parseInt(url.searchParams.get("limit") ?? "50");
      const before = url.searchParams.get("before"); // cursor de paginação (created_at)

      // Verificar acesso à conversa
      const { data: conv } = await admin
        .from("conversations")
        .select("participant_one, participant_two")
        .eq("id", convId)
        .single();
      if (!conv || (conv.participant_one !== user.id && conv.participant_two !== user.id)) {
        return json({ error: "Acesso negado" }, 403);
      }

      let q = admin
        .from("messages")
        .select(`
          id, conversation_id, sender_id, content, message_type,
          is_read, delivered_at, read_at, deleted_at, created_at,
          reply_to_id,
          reply_to:reply_to_id(id, content, sender_id, message_type),
          reactions:message_reactions(emoji, user_id)
        `)
        .eq("conversation_id", convId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (before) q = q.lt("created_at", before);

      const { data: messages, error } = await q;
      if (error) throw error;

      return json({ messages: (messages ?? []).reverse() });
    }

    // ════════════════════════════════════════════════════════════════════════
    // POST start-conversation — obter ou criar conversa
    // ════════════════════════════════════════════════════════════════════════
    if (req.method === "POST" && action === "start-conversation") {
      const body = await req.json();
      const { other_user_id } = body as { other_user_id: string };
      if (!other_user_id) return json({ error: "other_user_id obrigatório" }, 400);
      if (other_user_id === user.id) return json({ error: "Não podes conversar contigo mesmo" }, 400);

      const { data: convId, error } = await admin.rpc("get_or_create_conversation", {
        other_user_id,
      });
      if (error) throw error;

      // Retornar conversa completa + perfil do outro
      const { data: conv } = await admin
        .from("conversations")
        .select("id, participant_one, participant_two, last_message, last_message_at, unread_one, unread_two")
        .eq("id", convId)
        .single();
      const { data: otherProfile } = await admin
        .from("profiles")
        .select("id, username, full_name, avatar_url, is_verified")
        .eq("id", other_user_id)
        .single();

      return json({ conversation: { ...conv, other: otherProfile } });
    }

    // ════════════════════════════════════════════════════════════════════════
    // POST send-message — enviar mensagem (texto ou media)
    // ════════════════════════════════════════════════════════════════════════
    if (req.method === "POST" && action === "send-message") {
      const body = await req.json();
      const {
        conversation_id, content, message_type = "text", reply_to_id = null, media_url = null,
      } = body as {
        conversation_id: string; content: string; message_type?: string;
        reply_to_id?: string | null; media_url?: string | null;
      };

      if (!conversation_id) return json({ error: "conversation_id obrigatório" }, 400);
      if (!content?.trim() && !media_url) return json({ error: "Conteúdo vazio" }, 400);

      // Verificar acesso
      const { data: conv } = await admin
        .from("conversations")
        .select("participant_one, participant_two")
        .eq("id", conversation_id)
        .single();
      if (!conv || (conv.participant_one !== user.id && conv.participant_two !== user.id)) {
        return json({ error: "Acesso negado" }, 403);
      }

      // Moderação de conteúdo para mensagens de texto (assíncrona, não bloqueante)
      if (message_type === "text" && content?.trim()) {
        (async () => {
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ziva-ai-safety`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: req.headers.get("Authorization") ?? "",
              },
              body: JSON.stringify({ content, content_type: "comment" }),
            });
          } catch { /* não bloquear envio */ }
        })();
      }

      const { data: message, error: msgErr } = await admin
        .from("messages")
        .insert({
          conversation_id,
          sender_id: user.id,
          content: content?.trim() ?? "",
          message_type,
          reply_to_id,
          media_url,
          delivered_at: new Date().toISOString(),
        })
        .select(`
          id, conversation_id, sender_id, content, message_type,
          is_read, delivered_at, read_at, deleted_at, created_at,
          reply_to_id, media_url
        `)
        .single();

      if (msgErr) throw msgErr;

      // Inserir notificação para o destinatário
      const recipientId = conv.participant_one === user.id ? conv.participant_two : conv.participant_one;
      await admin.from("notifications").insert({
        user_id: recipientId,
        actor_id: user.id,
        type: "message",
        post_id: null,
        message: content?.slice(0, 100) ?? "📎 Média",
      }).maybeSingle();

      return json({ message });
    }

    // ════════════════════════════════════════════════════════════════════════
    // POST mark-read — marcar conversa como lida
    // ════════════════════════════════════════════════════════════════════════
    if (req.method === "POST" && action === "mark-read") {
      const body = await req.json();
      const { conversation_id } = body as { conversation_id: string };
      if (!conversation_id) return json({ error: "conversation_id obrigatório" }, 400);

      const { error } = await admin.rpc("mark_conversation_read", { conv_id: conversation_id });
      if (error) throw error;
      return json({ success: true });
    }

    // ════════════════════════════════════════════════════════════════════════
    // DELETE delete-message — apagar mensagem (soft delete)
    // ════════════════════════════════════════════════════════════════════════
    if (req.method === "DELETE" && action === "delete-message") {
      const body = await req.json();
      const { message_id } = body as { message_id: string };
      if (!message_id) return json({ error: "message_id obrigatório" }, 400);

      const { error } = await admin.rpc("delete_message", { msg_id: message_id });
      if (error) throw error;
      return json({ success: true });
    }

    // ════════════════════════════════════════════════════════════════════════
    // POST react — adicionar/remover reação a mensagem
    // ════════════════════════════════════════════════════════════════════════
    if (req.method === "POST" && action === "react") {
      const body = await req.json();
      const { message_id, emoji } = body as { message_id: string; emoji: string };
      if (!message_id || !emoji) return json({ error: "message_id e emoji obrigatórios" }, 400);

      const { data: added, error } = await admin.rpc("toggle_message_reaction", {
        msg_id: message_id, reaction_emoji: emoji,
      });
      if (error) throw error;
      return json({ added, emoji, message_id });
    }

    // ════════════════════════════════════════════════════════════════════════
    // GET  search-conversations — pesquisar conversas por username
    // ════════════════════════════════════════════════════════════════════════
    if (req.method === "GET" && action === "search") {
      const q = url.searchParams.get("q") ?? "";
      if (!q.trim()) return json({ results: [] });

      const { data: profiles } = await admin
        .from("profiles")
        .select("id, username, full_name, avatar_url, is_verified")
        .ilike("username", `%${q}%`)
        .neq("id", user.id)
        .limit(20);

      return json({ results: profiles ?? [] });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 404);

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
