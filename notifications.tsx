import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { MessageCircle, UserPlus, AtSign, Share, Bell, Radio } from 'lucide-react-native';
import type { RelativePathString } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { getReactionEmoji } from '@/components/ReactionPicker';
import { useUnread } from '@/lib/unread-context';
import { useZivaTheme } from '@/lib/theme-context';

interface Notification {
  id: string;
  type: string;
  is_read: boolean;
  created_at: string;
  post_id: string | null;
  live_id: string | null;
  message: string | null;
  actor: { id: string; username: string; avatar_url: string } | null;
  actor_count?: number;
}

function buildGroupedMessage(g: {
  notif_type: string; last_actor_username: string; second_actor_username?: string;
  actor_count: number; message?: string;
}): string {
  const { notif_type, last_actor_username, second_actor_username, actor_count, message } = g;
  if (message) return message;
  const verb = notif_type === 'comment'  ? 'comentaram no teu post'
              : notif_type === 'follow'  ? 'começaram a seguir-te'
              : notif_type === 'mention' ? 'mencionaram-te'
              : notif_type === 'share'   ? 'partilharam o teu post'
              : 'reagiram ao teu post';
  if (actor_count === 1) {
    if (notif_type === 'follow')  return `${last_actor_username} começou a seguir-te`;
    if (notif_type === 'comment') return `${last_actor_username} comentou no teu post`;
    if (notif_type === 'mention') return `${last_actor_username} mencionou-te`;
    if (notif_type === 'share')   return `${last_actor_username} partilhou o teu post`;
    return `${last_actor_username} reagiu ao teu post`;
  }
  if (actor_count === 2 && second_actor_username) {
    return `${last_actor_username} e ${second_actor_username} ${verb}`;
  }
  const others = actor_count - 1;
  return `${last_actor_username} e mais ${others} ${others === 1 ? 'pessoa' : 'pessoas'} ${verb}`;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function NotifIcon({ type }: { type: string }) {
  const style = { width: 24, height: 24, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (type === 'love' || type === 'like' || type === 'haha' || type === 'wow' || type === 'sad' || type === 'angry' || type === 'clap' || type === 'fire' || type === 'ziva') {
    return <Text style={{ fontSize: 16 }}>{getReactionEmoji(type)}</Text>;
  }
  if (type === 'comment')   return <View style={{ ...style, backgroundColor: 'rgba(123,63,242,0.2)' }}><MessageCircle size={14} color="#A78BFA" /></View>;
  if (type === 'follow')    return <View style={{ ...style, backgroundColor: 'rgba(34,197,94,0.15)' }}><UserPlus size={14} color="#34D399" /></View>;
  if (type === 'mention')   return <View style={{ ...style, backgroundColor: 'rgba(251,191,36,0.15)' }}><AtSign size={14} color="#FBBF24" /></View>;
  if (type === 'share')     return <View style={{ ...style, backgroundColor: 'rgba(59,130,246,0.15)' }}><Share size={14} color="#60A5FA" /></View>;
  if (type === 'live')      return <View style={{ ...style, backgroundColor: 'rgba(239,68,68,0.15)' }}><Radio size={14} color="#F87171" /></View>;
  return <View style={{ ...style, backgroundColor: 'rgba(123,63,242,0.2)' }}><Bell size={14} color="#A78BFA" /></View>;
}

function notifText(type: string, username: string, message: string | null): string {
  if (message) return message;
  if (type === 'comment') return `${username} comentou no teu post`;
  if (type === 'follow')  return `${username} começou a seguir-te`;
  if (type === 'mention') return `${username} mencionou-te num comentário`;
  if (type === 'share')   return `${username} partilhou o teu post`;
  if (type === 'live')    return message ?? `${username} está ao vivo agora! 🔴`;
  return `${username} reagiu ao teu post ${getReactionEmoji(type)}`;
}

export default function NotificationsScreen() {
  const { colors } = useZivaTheme();
  const { session } = useSession();
  const router = useRouter();
  const { resetNotif } = useUnread();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = session?.user?.id ?? '';

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      // Usar grupos de notificações para evitar excesso de notificações repetidas
      const { data: grouped } = await supabase
        .rpc('get_grouped_notifications', { uid: userId, lim: 50 });

      if (grouped && grouped.length > 0) {
        // Mapear grupos para formato de notificação compatível com UI
        setNotifications(
          grouped.map((g: any) => ({
            id: g.group_key,
            type: g.notif_type,
            is_read: g.is_read,
            created_at: g.latest_at,
            post_id: g.post_id,
            live_id: g.live_id,
            // Mensagem agrupada: "João e Maria curtiram" ou "João, Maria e 3 outros curtiram"
            message: buildGroupedMessage(g),
            actor: {
              id: g.last_actor_id,
              username: g.last_actor_username ?? 'Alguém',
              avatar_url: g.last_actor_avatar,
            },
            actor_count: g.actor_count,
          }))
        );
      } else {
        // Fallback: query directa sem agrupamento
        const { data } = await supabase
          .from('notifications')
          .select('*, actor:actor_id(id, username, avatar_url)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(60);
        setNotifications(
          (data ?? []).map((n) => ({
            ...n,
            actor: Array.isArray(n.actor) ? n.actor[0] : n.actor,
          }))
        );
      }
      // Marca tudo como lido
      await supabase.from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId).eq('is_read', false);
    } catch { /* erros de rede não bloqueiam a UI */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    loadNotifications();
    resetNotif(); // zera badge ao entrar no ecrã de alertas
  }, [loadNotifications, resetNotif]));

  // Realtime: novas notificações aparecem no topo
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel('notifs-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        async (payload) => {
          const n = payload.new as any;
          const { data: actor } = await supabase.from('profiles')
            .select('id, username, avatar_url').eq('id', n.actor_id).single();
          setNotifications((prev) => [{ ...n, actor }, ...prev]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const handlePress = (n: Notification) => {
    if (n.type === 'follow' && n.actor) {
      router.push(`/(app)/user/${n.actor.id}` as RelativePathString);
    } else if (n.type === 'live' && n.live_id) {
      router.push(`/(app)/live/${n.live_id}` as RelativePathString);
    } else if (n.post_id) {
      router.push(`/(app)/post/${n.post_id}` as RelativePathString);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />
      <View style={{ paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.bg }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Alertas</Text>
        {notifications.some((n) => !n.is_read) && (
          <View style={{ backgroundColor: '#7B3FF2', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
            shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
              {notifications.filter((n) => !n.is_read).length}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
          <ActivityIndicator size="large" color="#7B3FF2" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: colors.bg }}
          renderItem={({ item }) => (
            <Pressable
              style={{
                flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
                gap: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)',
                backgroundColor: !item.is_read ? 'rgba(123,63,242,0.06)' : 'transparent',
              }}
              onPress={() => handlePress(item)}
            >
              <View style={{ position: 'relative' }}>
                {item.actor?.avatar_url ? (
                  <Image
                    source={{ uri: item.actor.avatar_url }}
                    style={{ width: 48, height: 48, borderRadius: 24,
                      borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(123,63,242,0.15)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: 'rgba(123,63,242,0.25)' }}>
                    <Bell size={22} color="#7B3FF2" />
                  </View>
                )}
                <View style={{ position: 'absolute', bottom: -2, right: -2 }}>
                  <NotifIcon type={item.type} />
                </View>
                {/* Crachá de grupo: "+N" quando há vários actores */}
                {(item.actor_count ?? 0) > 1 && (
                  <View style={{
                    position: 'absolute', top: -4, left: -4,
                    backgroundColor: '#7B3FF2', borderRadius: 10,
                    paddingHorizontal: 5, paddingVertical: 1,
                    borderWidth: 1.5, borderColor: colors.bg,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                      +{(item.actor_count ?? 1) - 1}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: !item.is_read ? '600' : '400' }}>
                  {notifText(item.type, item.actor?.username ?? 'Alguém', item.message)}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{timeAgo(item.created_at)}</Text>
              </View>
              {!item.is_read && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7B3FF2',
                  shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 }} />
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12, backgroundColor: colors.bg }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(123,63,242,0.12)',
                alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(123,63,242,0.2)' }}>
                <Text style={{ fontSize: 40 }}>🔔</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Sem notificações</Text>
              <Text style={{ color: colors.muted, textAlign: 'center', paddingHorizontal: 32, fontSize: 14, lineHeight: 21 }}>
                Quando alguém reagir, comentar ou seguir-te, verás aqui.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

