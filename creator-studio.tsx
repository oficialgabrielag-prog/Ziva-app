import { useState, useCallback } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, TrendingUp, Eye, Heart, MessageCircle,
  Users, Film, BarChart, Star, Wand,
} from 'lucide-react-native';
import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { VerifiedBadge } from '@/components/VerifiedBadge';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CreatorStats {
  total_posts: number;
  total_likes: number;
  total_comments: number;
  total_views: number;
  total_reels: number;
  reel_views: number;
  followers: number;
  top_post: {
    id: string;
    caption: string;
    image_url: string;
    likes_count: number;
    comments_count: number;
  } | null;
}

// ─── Cartão de estatística ────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, color = '#7c3aed',
}: { icon: React.ComponentType<any>; label: string; value: string | number; color?: string }) {
  return (
    <View className="flex-1 bg-card border border-border rounded-2xl p-4 items-center gap-1.5" style={{ borderCurve: 'continuous' }}>
      <View style={{ backgroundColor: color + '22', borderRadius: 999, padding: 10 }}>
        <Icon size={20} color={color} strokeWidth={1.8} />
      </View>
      <Text className="text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-muted-foreground text-xs text-center">{label}</Text>
    </View>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ─── Ecrã ────────────────────────────────────────────────────────────────────
export default function CreatorStudioScreen() {
  const { session } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id ?? '';

  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ username: string; avatar_url: string; is_verified: boolean; full_name: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        const [statsRes, profRes] = await Promise.all([
          supabase.rpc('get_creator_stats', { creator_id: userId }),
          supabase.from('profiles').select('username, avatar_url, is_verified, full_name').eq('id', userId).single(),
        ]);
        setStats(statsRes.data as CreatorStats ?? null);
        setProfile(profRes.data);
        setLoading(false);
      })();
    }, [userId])
  );

  const engagementRate = stats && stats.total_views > 0
    ? (((stats.total_likes + stats.total_comments) / stats.total_views) * 100).toFixed(1)
    : '0';

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="dark" />
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 border-b border-border pb-3" style={{ paddingTop: insets.top + 8 }}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/home' as any)} className="active:opacity-60">
          <ArrowLeft size={22} color="#7c3aed" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground">Creator Studio</Text>
          <Text className="text-muted-foreground text-xs">Análise do teu desempenho</Text>
        </View>
        <BarChart size={22} color="#7c3aed" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color="#7c3aed" size="large" />
          <Text className="text-muted-foreground text-sm">A carregar analytics...</Text>
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: insets.bottom + 24 }}
        >
          {/* Perfil resumo */}
          {profile && (
            <View className="bg-card border border-border rounded-2xl p-4 flex-row items-center gap-4" style={{ borderCurve: 'continuous' }}>
              <Image source={profile.avatar_url ? { uri: profile.avatar_url } : undefined}
                style={{ width: 56, height: 56, borderRadius: 28 }} contentFit="cover" />
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-foreground font-bold text-lg">{profile.full_name || profile.username}</Text>
                  {profile.is_verified && <VerifiedBadge size={16} />}
                </View>
                <Text className="text-muted-foreground text-sm">@{profile.username}</Text>
              </View>
              <View className="items-center">
                <Text className="text-primary text-xl font-bold">{fmt(stats?.followers ?? 0)}</Text>
                <Text className="text-muted-foreground text-xs">seguidores</Text>
              </View>
            </View>
          )}

          {/* Secção: Publicações */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <TrendingUp size={16} color="#7c3aed" />
              <Text className="text-foreground font-bold text-base">Publicações</Text>
            </View>
            <View className="flex-row gap-3">
              <StatCard icon={Eye} label="Visualizações" value={fmt(stats?.total_views ?? 0)} color="#3b82f6" />
              <StatCard icon={Heart} label="Curtidas" value={fmt(stats?.total_likes ?? 0)} color="#ef4444" />
            </View>
            <View className="flex-row gap-3">
              <StatCard icon={MessageCircle} label="Comentários" value={fmt(stats?.total_comments ?? 0)} color="#f59e0b" />
              <StatCard icon={Star} label="Posts totais" value={fmt(stats?.total_posts ?? 0)} color="#8b5cf6" />
            </View>
          </View>

          {/* Taxa de engajamento */}
          <View className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex-row items-center gap-4" style={{ borderCurve: 'continuous' }}>
            <View className="bg-primary rounded-full p-3">
              <TrendingUp size={20} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-bold text-base">Taxa de Engajamento</Text>
              <Text className="text-muted-foreground text-sm mt-0.5">
                Curtidas + comentários por visualização
              </Text>
            </View>
            <Text className="text-primary text-2xl font-bold">{engagementRate}%</Text>
          </View>

          {/* Reels */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Film size={16} color="#ff6b6b" />
              <Text className="text-foreground font-bold text-base">Reels</Text>
            </View>
            <View className="flex-row gap-3">
              <StatCard icon={Film} label="Reels" value={fmt(stats?.total_reels ?? 0)} color="#ff6b6b" />
              <StatCard icon={Eye} label="Views Reels" value={fmt(stats?.reel_views ?? 0)} color="#06b6d4" />
            </View>
          </View>

          {/* Audiência */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Users size={16} color="#10b981" />
              <Text className="text-foreground font-bold text-base">Audiência</Text>
            </View>
            <View className="bg-card border border-border rounded-2xl p-5 flex-row items-center justify-around" style={{ borderCurve: 'continuous' }}>
              <View className="items-center gap-1">
                <Text className="text-foreground text-2xl font-bold">{fmt(stats?.followers ?? 0)}</Text>
                <Text className="text-muted-foreground text-xs">Seguidores</Text>
              </View>
              <View className="w-px h-10 bg-border" />
              <View className="items-center gap-1">
                <Text className="text-foreground text-2xl font-bold">{fmt(stats?.total_posts ?? 0)}</Text>
                <Text className="text-muted-foreground text-xs">Publicações</Text>
              </View>
              <View className="w-px h-10 bg-border" />
              <View className="items-center gap-1">
                <Text className="text-foreground text-2xl font-bold">{fmt(stats?.total_reels ?? 0)}</Text>
                <Text className="text-muted-foreground text-xs">Reels</Text>
              </View>
            </View>
          </View>

          {/* Top publicação */}
          {stats?.top_post && (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <Star size={16} color="#f59e0b" />
                <Text className="text-foreground font-bold text-base">Melhor Publicação</Text>
              </View>
              <Pressable
                className="bg-card border border-border rounded-2xl overflow-hidden active:opacity-80"
                style={{ borderCurve: 'continuous' }}
                onPress={() => router.push(`/(app)/post/${stats.top_post!.id}` as any)}
              >
                {stats.top_post.image_url && (
                  <Image source={{ uri: stats.top_post.image_url }}
                    style={{ width: '100%', height: 160 }} contentFit="cover" />
                )}
                <View className="p-4 gap-2">
                  {stats.top_post.caption
                    ? <Text className="text-foreground text-sm" numberOfLines={2}>{stats.top_post.caption}</Text>
                    : <Text className="text-muted-foreground text-sm italic">Sem legenda</Text>}
                  <View className="flex-row gap-4">
                    <View className="flex-row items-center gap-1.5">
                      <Heart size={14} color="#ef4444" />
                      <Text className="text-muted-foreground text-xs">{fmt(stats.top_post.likes_count)}</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <MessageCircle size={14} color="#6b7280" />
                      <Text className="text-muted-foreground text-xs">{fmt(stats.top_post.comments_count)}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </View>
          )}

          {/* Ferramentas IA */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Wand size={16} color="#7B3FF2" />
              <Text className="text-foreground font-bold text-base">Ferramentas IA</Text>
            </View>
            <Pressable
              onPress={() => router.push('/(app)/photo-to-video' as any)}
              className="active:opacity-80"
              style={{
                backgroundColor: '#111115', borderRadius: 16, overflow: 'hidden',
                borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)',
                padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
              }}>
              <View style={{
                width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(123,63,242,0.15)',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1.5, borderColor: 'rgba(123,63,242,0.4)',
              }}>
                <Film size={22} color="#7B3FF2" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: '#F9FAFB', fontSize: 15 }}>Foto → Vídeo IA</Text>
                <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                  Anima qualquer foto com inteligência artificial
                </Text>
              </View>
              <View style={{
                backgroundColor: 'rgba(123,63,242,0.2)', borderRadius: 20,
                paddingHorizontal: 10, paddingVertical: 4,
              }}>
                <Text style={{ fontSize: 10, color: '#A78BFA', fontWeight: '800' }}>NOVO</Text>
              </View>
            </Pressable>
          </View>

          {/* Dicas */}
          <View className="bg-card border border-border rounded-2xl p-4 gap-3" style={{ borderCurve: 'continuous' }}>
            <Text className="text-foreground font-bold">💡 Dicas para crescer</Text>
            {[
              'Publica Reels regularmente para aumentar o alcance',
              'Usa o Assistente de IA para legendas e hashtags',
              'Responde aos comentários para aumentar o engajamento',
              'Experimenta a ferramenta Foto → Vídeo IA para conteúdo único',
            ].map((tip, i) => (
              <View key={i} className="flex-row items-start gap-2">
                <Text className="text-primary text-sm">→</Text>
                <Text className="text-muted-foreground text-sm flex-1">{tip}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
