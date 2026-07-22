import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, Pressable,
  ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  MessageCircle, PlusSquare, Search, Play,
  TrendingUp, Sparkles, Brain,
  Film, Video, LayoutList, Radio, Plus, UserPlus, RefreshCw, ShoppingBag,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import type { RelativePathString } from 'expo-router';

import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { PostCard, PostCardSkeleton, type Post } from '@/components/PostCard';
import { type ReactionType } from '@/components/ReactionPicker';
import { useZivaTheme } from '@/lib/theme-context';

interface StoryGroup {
  userId: string;
  username: string;
  avatar_url: string;
  is_verified: boolean;
  hasUnviewed: boolean;
  latestStoryId: string;
}

type FeedFilter = 'todos' | 'ia' | 'tecnologia' | 'reels' | 'seguindo';

const FEED_TABS: { key: FeedFilter; label: string }[] = [
  { key: 'todos',      label: 'Todos'      },
  { key: 'ia',         label: 'IA'         },
  { key: 'tecnologia', label: 'Tecnologia' },
  { key: 'reels',      label: 'Reels'      },
  { key: 'seguindo',   label: 'Seguindo'   },
];

// Hashtags populares estáticas como fallback
const FALLBACK_TAGS = ['angola', 'luanda', 'kizomba', 'africa', 'musica', 'amor', 'lifestyle', 'moda'];

interface LiveStrip {
  id: string;
  title: string;
  viewer_count: number;
  host: { username: string; avatar_url: string };
}

interface TrendingTag { tag: string; post_count: number; }

// Tipo de item do feed: post real ou card especial
type FeedItem =
  | { kind: 'post'; data: Post }
  | { kind: 'ai-card'; id: string }
  | { kind: 'trending'; id: string; tags: TrendingTag[] }
  | { kind: 'marketplace'; id: string; products: MarketplaceProduct[] };

interface MarketplaceProduct {
  id: string; title: string; price: number; currency: string;
  images: string[]; location: string | null;
  profiles?: { username: string; avatar_url: string | null };
}

/** Faixa de sugestões de utilizadores — aparece abaixo dos botões rápidos do feed */
function SuggestedUsersStrip({ currentUserId }: { currentUserId: string }) {
  const { colors } = useZivaTheme();
  const router = useRouter();
  const [users, setUsers] = useState<Array<{
    id: string; username: string; full_name: string;
    avatar_url: string | null; followers_count: number; is_verified: boolean;
  }>>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current || !currentUserId) return;
    fetchedRef.current = true;
    (async () => {
      setLoading(true);
      // Chamar edge function ziva-recommendations para obter sugestões
      const { data, error } = await supabase.functions.invoke('ziva-recommendations', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!error && data?.data?.length > 0) {
        setUsers(data.data.slice(0, 12));
      } else {
        // Fallback: query directa de utilizadores com mais seguidores não seguidos
        const { data: follows } = await supabase
          .from('follows').select('following_id').eq('follower_id', currentUserId);
        const followingIds = (follows ?? []).map((f: any) => f.following_id);
        followingIds.push(currentUserId);
        const { data: suggested } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, followers_count, is_verified')
          .not('id', 'in', `(${followingIds.join(',')})`)
          .order('followers_count', { ascending: false })
          .limit(12);
        setUsers(suggested ?? []);
      }
      setLoading(false);
    })();
  }, [currentUserId]);

  const handleFollow = async (targetId: string) => {
    setFollowed((prev) => new Set([...prev, targetId]));
    await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetId });
  };

  if (loading || users.length === 0) return null;

  return (
    <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder, backgroundColor: colors.bg }}>
      {/* Título */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>✨ Sugestões para ti</Text>
        <Pressable onPress={() => router.push('/(app)/(tabs)/search' as RelativePathString)}>
          <Text style={{ fontSize: 12, color: colors.purple, fontWeight: '600' }}>Ver mais</Text>
        </Pressable>
      </View>
      {/* Lista horizontal */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
        {users.map((u) => {
          const isFollowed = followed.has(u.id);
          return (
            <Pressable key={u.id}
              onPress={() => router.push(`/(app)/user/${u.id}` as RelativePathString)}
              style={{
                width: 120, backgroundColor: colors.card, borderRadius: 16,
                padding: 12, alignItems: 'center', gap: 6,
                borderWidth: 1, borderColor: colors.cardBorder,
              }}>
              {/* Avatar */}
              {u.avatar_url
                ? <Image source={{ uri: u.avatar_url }}
                    style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: colors.purple }}
                    contentFit="cover" />
                : <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.input,
                    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.inputBorder }}>
                    <Text style={{ fontSize: 22 }}>👤</Text>
                  </View>}
              {/* Nome */}
              <View style={{ alignItems: 'center', gap: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                    {u.full_name || u.username}
                  </Text>
                  {u.is_verified && <Text style={{ fontSize: 10 }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 10, color: colors.muted }} numberOfLines={1}>@{u.username}</Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>
                  {(u.followers_count ?? 0).toLocaleString('pt')} seg.
                </Text>
              </View>
              {/* Botão seguir */}
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); handleFollow(u.id); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                  backgroundColor: isFollowed ? colors.input : colors.purple,
                  borderWidth: 1, borderColor: isFollowed ? colors.inputBorder : colors.purple,
                }}>
                <UserPlus size={11} color={isFollowed ? colors.muted : '#fff'} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: isFollowed ? colors.muted : '#fff' }}>
                  {isFollowed ? 'Seguindo' : 'Seguir'}
                </Text>
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Skeleton do stories bar */
function FeedSkeleton() {
  const { colors } = useZivaTheme();
  return (
    <View style={{ backgroundColor: colors.bg, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder, paddingVertical: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ alignItems: 'center', gap: 6, width: 64 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.input }} />
            <View style={{ width: 40, height: 8, borderRadius: 4, backgroundColor: colors.card }} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Cartão "Ziva sugere 🧠" injectado no feed a cada 6 posts */
function ZivaSuggestsCard({ onPress }: { onPress: () => void }) {
  const { colors, isDark } = useZivaTheme();
  const SUGGESTIONS = [
    { emoji: '🔥', text: 'Descobre os Reels em tendência' },
    { emoji: '👥', text: 'Encontra pessoas com os mesmos interesses' },
    { emoji: '🎵', text: 'Conteúdo musical angolano para ti' },
  ];
  return (
    <View style={{
      marginHorizontal: 12, marginVertical: 4,
      backgroundColor: isDark ? '#0D0D1A' : colors.card,
      borderRadius: 20, borderWidth: 1,
      borderColor: 'rgba(123,63,242,0.25)',
      overflow: 'hidden',
    }}>
      {/* Cabeçalho */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
        borderBottomWidth: 0.5, borderBottomColor: 'rgba(123,63,242,0.15)',
      }}>
        <View style={{
          width: 34, height: 34, borderRadius: 17,
          backgroundColor: 'rgba(123,63,242,0.2)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Brain size={17} color="#A78BFA" strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>Ziva sugere 🧠</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Com base nos teus interesses</Text>
        </View>
        <Pressable onPress={onPress}
          style={{ backgroundColor: 'rgba(123,63,242,0.15)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: '#A78BFA', fontSize: 12, fontWeight: '700' }}>Explorar</Text>
        </Pressable>
      </View>
      {/* Sugestões */}
      {SUGGESTIONS.map((s, i) => (
        <Pressable key={i} onPress={onPress}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            paddingHorizontal: 14, paddingVertical: 10,
            borderBottomWidth: i < SUGGESTIONS.length - 1 ? 0.5 : 0,
            borderBottomColor: 'rgba(255,255,255,0.04)',
          }}>
          <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
          <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{s.text}</Text>
          <Sparkles size={14} color={colors.purple} strokeWidth={1.6} />
        </Pressable>
      ))}
    </View>
  );
}

/** Faixa de hashtags em tendência */
function TrendingStrip({ tags }: { tags: TrendingTag[] }) {
  const router = useRouter();
  const { colors, isDark } = useZivaTheme();
  if (tags.length === 0) return null;
  return (
    <View style={{
      marginHorizontal: 12, marginVertical: 4,
      backgroundColor: isDark ? '#0D0D1A' : colors.card,
      borderRadius: 16, borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingVertical: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, marginBottom: 8 }}>
        <TrendingUp size={14} color="#F59E0B" strokeWidth={2} />
        <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 }}>EM TENDÊNCIA</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {tags.map((t) => (
          <Pressable key={t.tag}
            onPress={() => router.push('/(app)/(tabs)/search' as RelativePathString)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: 'rgba(245,158,11,0.1)',
              borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
              borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
            }}>
            <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '700' }}>#{t.tag}</Text>
            {t.post_count > 1 && (
              <Text style={{ color: '#92400E', fontSize: 10 }}>{t.post_count}</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const { session } = useSession();
  const router = useRouter();
  const { colors } = useZivaTheme();
  // resetNotif não é necessário aqui — o badge de notificações zera no ecrã de Alertas
  const [posts, setPosts] = useState<Post[]>([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState<MarketplaceProduct[]>([]);
  const [activeLives, setActiveLives] = useState<LiveStrip[]>([]);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myProfile, setMyProfile] = useState<{ avatar_url: string; username: string; full_name: string } | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('todos');
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);

  const userId = session?.user?.id ?? '';

  // ─── Rastreamento de tempo de visualização ────────────────────────────────
  const viewTimersRef = useRef<Record<string, number>>({});
  // Ref estável para userId — evita recriar o callback onViewableItemsChanged
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // CRÍTICO: onViewableItemsChanged DEVE ser uma ref estável (nunca mudar).
  // Passar uma função que muda (useCallback com deps) causa crash no FlatList web.
  const handleViewableItemsChanged = useRef(
    ({ viewableItems, changed }: { viewableItems: any[]; changed: any[] }) => {
      if (!userIdRef.current) return;
      const now = Date.now();

      changed.forEach(({ item, isViewable }) => {
        if (item.kind !== 'post') return;
        const postId = item.data.id;
        if (!isViewable) {
          const startTime = viewTimersRef.current[postId];
          if (startTime) {
            const durationMs = Math.round(now - startTime);
            delete viewTimersRef.current[postId];
            if (durationMs >= 1000) {
              supabase.functions.invoke('ziva-track-interaction', {
                body: { post_id: postId, type: 'view', duration_ms: durationMs },
              }).catch(() => {});
            }
          }
        } else {
          viewTimersRef.current[postId] = now;
        }
      });
    }
  ).current;

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 500,
  });

  // ─── Registar interacção explícita (like, save, share, click) ────────────
  const trackInteraction = useCallback(
    (postId: string, type: 'like' | 'comment' | 'share' | 'save' | 'click') => {
      if (!userId) return;
      supabase.functions.invoke('ziva-track-interaction', {
        body: { post_id: postId, type },
      }).catch(() => {});
    },
    [userId]
  );

  // ─── Carregar dados ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data: prof } = await supabase
        .from('profiles').select('avatar_url, username, full_name').eq('id', userId).single();
      setMyProfile(prof);

      const { data: followData } = await supabase
        .from('follows').select('following_id').eq('follower_id', userId);
      const followingIds = followData?.map((f) => f.following_id) ?? [];
      const feedIds = [...followingIds, userId];

      // Carregar stories — usa RPC; se falhar, faz query directa de fallback
      const { data: storiesData, error: storiesErr } = await supabase
        .rpc('get_stories_feed', { viewer_id: userId });

      let rawStories: any[] = storiesData ?? [];

      // Fallback: query directa caso a RPC falhe (ex: função ainda não deployada)
      if (storiesErr || rawStories.length === 0) {
        const { data: directData } = await supabase
          .from('stories')
          .select('id, user_id, media_url, media_type, text_overlay, text_color, expires_at, created_at, duration, profiles(username, full_name, avatar_url, is_verified)')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(50);
        rawStories = (directData ?? []).map((s: any) => ({
          story_id: s.id,
          story_user_id: s.user_id,
          media_url: s.media_url,
          media_type: s.media_type,
          text_overlay: s.text_overlay,
          text_color: s.text_color,
          expires_at: s.expires_at,
          created_at: s.created_at,
          duration: s.duration ?? 5,
          username: s.profiles?.username ?? '',
          full_name: s.profiles?.full_name ?? '',
          avatar_url: s.profiles?.avatar_url ?? '',
          is_verified: s.profiles?.is_verified ?? false,
          viewed: false,
        }));
      }

      if (rawStories.length > 0) {
        const groupMap = new Map<string, StoryGroup>();
        for (const s of rawStories) {
          if (!groupMap.has(s.story_user_id)) {
            groupMap.set(s.story_user_id, {
              userId: s.story_user_id,
              username: s.username,
              avatar_url: s.avatar_url,
              is_verified: s.is_verified,
              hasUnviewed: !s.viewed,
              latestStoryId: s.story_id,
            });
          } else if (!s.viewed) {
            groupMap.get(s.story_user_id)!.hasUnviewed = true;
          }
        }
        const groups = Array.from(groupMap.values());
        const mine = groups.filter((g) => g.userId === userId);
        const others = groups.filter((g) => g.userId !== userId);
        setStoryGroups([...mine, ...others]);
      }

      // Feed inteligente V2: afinidade + interesses + diversidade + ressurgimento
      const [postsRes, likesRes, savedRes, tagsRes, mktRes] = await Promise.all([
        supabase.rpc('get_smart_feed', { viewer_id: userId, feed_user_ids: feedIds, lim: 30 }),
        supabase.from('likes').select('post_id, reaction_type').eq('user_id', userId),
        supabase.from('saved_posts').select('post_id').eq('user_id', userId),
        supabase.rpc('get_trending_hashtags', { lim: 10 }),
        supabase.from('marketplace_products')
          .select('id, title, price, currency, images, location, profiles(username, avatar_url)')
          .eq('is_available', true)
          .order('created_at', { ascending: false })
          .limit(12),
      ]);
      setMarketplaceProducts(
        ((mktRes.data ?? []) as any[]).map((p: any) => ({
          ...p,
          profiles: Array.isArray(p.profiles) ? p.profiles[0] ?? null : p.profiles ?? null,
        })) as MarketplaceProduct[]
      );
      const likedMap = new Map(
        (likesRes.data ?? []).map((l) => [l.post_id, l.reaction_type as string])
      );
      const savedIds = new Set((savedRes.data ?? []).map((s) => s.post_id));

      // Hashtags em tendência (fallback para estáticas se DB vazio)
      const rawTags: TrendingTag[] = (tagsRes.data ?? []) as TrendingTag[];
      setTrendingTags(
        rawTags.length > 0
          ? rawTags
          : FALLBACK_TAGS.map((tag) => ({ tag, post_count: 0 }))
      );

      setPosts(
        ((postsRes.data ?? []) as any[]).map((p: Record<string, any>): Post => ({
          id: p.id,
          user_id: p.user_id,
          caption: p.caption ?? '',
          image_url: p.image_url ?? '',
          likes_count: p.likes_count ?? 0,
          comments_count: p.comments_count ?? 0,
          created_at: p.created_at,
          post_type: p.post_type,
          video_url: p.video_url,
          views_count: p.views_count,
          profiles: {
            id: p.profile_id ?? p.user_id,
            username: p.username ?? '',
            full_name: p.full_name ?? '',
            avatar_url: p.avatar_url ?? '',
            is_verified: p.is_verified ?? false,
          },
          liked: likedMap.has(p.id),
          my_reaction: (likedMap.get(p.id) as any) ?? null,
          saved: savedIds.has(p.id),
          image_urls: p.image_urls ?? [],
          community_id: p.community_id ?? null,
          community_name: p.community_name ?? null,
          is_resurging: p.is_resurging ?? false,
        }))
      );

      // Carregar lives ativas
      const { data: livesData } = await supabase
        .from('lives')
        .select('id, title, viewer_count, host:profiles!lives_host_id_fkey(username, avatar_url)')
        .in('status', ['waiting', 'live'])
        .order('viewer_count', { ascending: false })
        .limit(8);
      setActiveLives(
        (livesData ?? []).map((l) => ({ ...l, host: Array.isArray(l.host) ? l.host[0] : l.host })) as LiveStrip[]
      );
    } catch { /* erros de rede não bloqueiam a UI */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
      // O badge de notificações é zerado no ecrã de Alertas, não aqui
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Realtime — novos posts aparecem automaticamente
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const newPost = payload.new as any;
          // Só mostra publicações efectivamente publicadas e não eliminadas
          if (newPost.status !== 'published' || newPost.is_deleted) return;
          const { data: profData } = await supabase
            .from('profiles').select('id, username, full_name, avatar_url')
            .eq('id', newPost.user_id).single();
          const { data: followCheck } = await supabase
            .from('follows').select('follower_id')
            .eq('follower_id', userId).eq('following_id', newPost.user_id).maybeSingle();
          if (newPost.user_id === userId || followCheck) {
            setPosts((prev) => [{
              ...newPost,
              profiles: profData,
              liked: false, my_reaction: null, saved: false, image_urls: newPost.image_urls ?? [],
            }, ...prev]);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleLikeToggle = (postId: string, liked: boolean, reaction?: ReactionType) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked, my_reaction: liked ? (reaction ?? 'love') : null,
              likes_count: liked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1) }
          : p
      )
    );
    // Registar interacção de like para aprendizagem de interesses
    if (liked) trackInteraction(postId, 'like');
  };

  // ── Filtro do feed (corresponde às abas da referência) ─────────────────────
  const filteredPosts = posts.filter((p) => {
    if (feedFilter === 'todos')      return true;
    if (feedFilter === 'ia')         return !!(p as any).ai_generated || (p.caption ?? '').toLowerCase().includes('ia') || (p.caption ?? '').toLowerCase().includes('inteligência');
    if (feedFilter === 'tecnologia') return (p.caption ?? '').toLowerCase().includes('tecnologia') || (p.caption ?? '').toLowerCase().includes('tech') || (p.caption ?? '').toLowerCase().includes('ai');
    // Reels: posts cujo post_type seja 'reel' OU que tenham video_url
    if (feedFilter === 'reels')      return (p as any).post_type === 'reel' || !!(p as any).video_url;
    if (feedFilter === 'seguindo')   return true; // feed já filtrado por follows
    return true;
  });

  // ── Construir lista de itens do feed com cards inteligentes ──────────────
  const feedItems: FeedItem[] = [];
  filteredPosts.forEach((post, i) => {
    // Injectar trending strip após o 2.º post (uma vez)
    if (i === 2 && trendingTags.length > 0) {
      feedItems.push({ kind: 'trending', id: 'trending-strip', tags: trendingTags });
    }
    // Injectar card Marketplace a cada 5 posts (máximo 2 vezes)
    if (marketplaceProducts.length > 0 && (i === 4 || i === 10)) {
      const slice = i === 4
        ? marketplaceProducts.slice(0, 4)
        : marketplaceProducts.slice(4, 8);
      if (slice.length > 0) {
        feedItems.push({ kind: 'marketplace', id: `mkt-${i}`, products: slice });
      }
    }
    // Injectar card Ziva sugere a cada 6 posts
    if (i > 0 && i % 6 === 0) {
      feedItems.push({ kind: 'ai-card', id: `ai-card-${i}` });
    }
    feedItems.push({ kind: 'post', data: post });
  });

  const TopBar = () => {
    const { colors } = useZivaTheme();
    return (
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: colors.bg,
        borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder,
      }}>
        {/* Logo Ziva neon */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center',
          }}>
            <View style={{ position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: '#7B3FF2', opacity: 0.65 }} />
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff', includeFontPadding: false, zIndex: 1 }}>Z</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.5,
            textShadowColor: 'rgba(123,63,242,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 }}>
            Ziva
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            onPress={() => router.push('/(app)/(tabs)/reels' as RelativePathString)}>
            <Play size={17} color="#EF4444" fill="#EF4444" strokeWidth={0} />
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#EF4444', letterSpacing: 0.5 }}>REELS</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(app)/(tabs)/marketplace' as RelativePathString)}>
            <ShoppingBag size={22} color={colors.muted} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={() => router.push('/(app)/(tabs)/search' as RelativePathString)}>
            <Search size={22} color={colors.muted} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={() => router.push('/(app)/(tabs)/create' as RelativePathString)}>
            <PlusSquare size={22} color={colors.muted} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={() => router.push('/(app)/messages' as RelativePathString)}>
            <MessageCircle size={22} color={colors.muted} strokeWidth={1.8} />
          </Pressable>
        </View>
      </View>
    );
  };

  const FeedHeader = () => {
    const { colors } = useZivaTheme();
    return (
      <View style={{ backgroundColor: colors.bg }}>
        {/* ── Barra de criar publicação ─────────────────────────────── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingHorizontal: 14, paddingVertical: 10,
          borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder,
        }}>
          <Pressable onPress={() => router.push('/(app)/(tabs)/profile' as RelativePathString)}>
            {myProfile?.avatar_url
              ? <Image source={{ uri: myProfile.avatar_url }}
                  style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.purple }} contentFit="cover" />
              : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.input,
                  alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.inputBorder }}>
                  <Text style={{ color: colors.muted, fontSize: 18 }}>👤</Text>
                </View>}
          </Pressable>
          <Pressable
            style={{ flex: 1, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 24,
              paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.input }}
            onPress={() => router.push('/(app)/(tabs)/create' as RelativePathString)}>
            <Text style={{ color: colors.placeholder, fontSize: 14 }}>Em que estás a pensar?</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(app)/(tabs)/create' as RelativePathString)}>
            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.input,
              alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.inputBorder }}>
              <Text style={{ fontSize: 18 }}>🖼️</Text>
            </View>
          </Pressable>
        </View>

        {/* ── Botões rápidos ─────── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingHorizontal: 14, paddingVertical: 8,
          borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder,
        }}>
          <Pressable
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 20, paddingVertical: 8,
              borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}
            onPress={() => router.push('/(app)/(tabs)/create' as RelativePathString)}>
            <Film size={16} color="#EF4444" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#EF4444' }}>Reel</Text>
          </Pressable>
          <Pressable
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 20, paddingVertical: 8,
              borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}
            onPress={() => router.push('/(app)/live' as RelativePathString)}>
            <Video size={16} color="#EF4444" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#EF4444' }}>Direto</Text>
          </Pressable>
          <Pressable
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6, backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 20, paddingVertical: 8,
              borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}
            onPress={() => router.push('/(app)/creator-studio' as RelativePathString)}>
            <LayoutList size={16} color="#3B82F6" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#3B82F6' }}>Gerir IA</Text>
          </Pressable>
        </View>

        {/* ── Sugestões de utilizadores ── */}
        <SuggestedUsersStrip currentUserId={userId} />
      </View>
    );
  };

  const StoriesBar = () => {
    const { colors } = useZivaTheme();
    return (
      <View style={{ backgroundColor: colors.bg }}>
        {/* ── Stories bar ─────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 14 }}>

          {/* Botão "Adicionar story" ou VER story próprio */}
          <Pressable style={{ alignItems: 'center', gap: 5, width: 62 }}
            onPress={() => {
              const myStory = storyGroups.find((g) => g.userId === userId);
              if (myStory) {
                router.push(`/(app)/story/${userId}` as RelativePathString);
              } else {
                router.push('/(app)/(tabs)/create' as RelativePathString);
              }
            }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, position: 'relative' }}>
              {storyGroups.some((g) => g.userId === userId) ? (
                <View style={{ width: 60, height: 60, borderRadius: 30, padding: 2.5,
                  borderWidth: 2.5, borderColor: colors.purple }}>
                  {myProfile?.avatar_url
                    ? <Image source={{ uri: myProfile.avatar_url }}
                        style={{ width: '100%', height: '100%', borderRadius: 26 }} contentFit="cover" />
                    : <View style={{ flex: 1, borderRadius: 26, backgroundColor: colors.input,
                        alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={22} color={colors.purple} />
                      </View>}
                </View>
              ) : (
                <>
                  {myProfile?.avatar_url ? (
                    <Image source={{ uri: myProfile.avatar_url }}
                      style={{ width: 56, height: 56, borderRadius: 28 }} contentFit="cover" />
                  ) : (
                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.input,
                      alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={22} color={colors.purple} />
                    </View>
                  )}
                  <View style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2, borderColor: colors.bg,
                  }}>
                    <Plus size={11} color="#fff" strokeWidth={3} />
                  </View>
                </>
              )}
            </View>
            <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '600' }} numberOfLines={1}>Seu story</Text>
          </Pressable>

          {storyGroups.filter((g) => g.userId !== userId).map((group) => (
            <Pressable key={group.userId} style={{ alignItems: 'center', gap: 5, width: 62 }}
              onPress={() => router.push(`/(app)/story/${group.userId}` as RelativePathString)}>
              <View style={{
                width: 60, height: 60, borderRadius: 30, padding: 2.5,
                borderWidth: 2.5,
                borderColor: group.hasUnviewed ? colors.purple : colors.inputBorder,
              }}>
                <Image source={group.avatar_url ? { uri: group.avatar_url } : undefined}
                  style={{ width: '100%', height: '100%', borderRadius: 26 }}
                  contentFit="cover"
                  placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }} />
              </View>
              <Text style={{ fontSize: 10, color: group.hasUnviewed ? colors.text : colors.muted,
                fontWeight: group.hasUnviewed ? '700' : '400' }}
                numberOfLines={1}>{group.username}</Text>
            </Pressable>
          ))}

          {activeLives.length > 0 && (
            <Pressable style={{ alignItems: 'center', gap: 5, width: 62 }}
              onPress={() => router.push('/(app)/live' as RelativePathString)}>
              <View style={{ width: 60, height: 60, borderRadius: 30, padding: 2.5,
                borderWidth: 2.5, borderColor: '#EF4444' }}>
                <View style={{ flex: 1, borderRadius: 26, backgroundColor: 'rgba(239,68,68,0.18)',
                  alignItems: 'center', justifyContent: 'center' }}>
                  <Radio size={20} color="#EF4444" />
                </View>
              </View>
              <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: '800' }} numberOfLines={1}>Lives</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Divisória */}
        <View style={{ height: 0.5, backgroundColor: colors.cardBorder }} />

        {/* ── Filtros do feed ──────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 4, paddingVertical: 8 }}>
          {FEED_TABS.map((tab) => {
            const active = feedFilter === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => setFeedFilter(tab.key)}
                style={{
                  paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: active ? colors.purple : colors.input,
                  borderWidth: 1.5, borderColor: active ? colors.purple : colors.inputBorder,
                  shadowColor: active ? colors.purple : 'transparent',
                  shadowOffset: { width: 0, height: 2 }, shadowOpacity: active ? 0.4 : 0, shadowRadius: 8,
                  elevation: active ? 4 : 0,
                }}>
                <Text style={{ fontSize: 13, fontWeight: '700',
                  color: active ? '#fff' : colors.muted }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ height: 0.5, backgroundColor: colors.cardBorder }} />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <PostCardSkeleton />}
          ListHeaderComponent={<><TopBar /><FeedSkeleton /></>}
          contentInsetAdjustmentBehavior="automatic"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />
      <FlatList
        data={feedItems}
        keyExtractor={(item) => item.kind === 'post' ? item.data.id : item.id}
        renderItem={({ item }) => {
          if (item.kind === 'ai-card') {
            return (
              <ZivaSuggestsCard
                onPress={() => router.push('/(app)/(tabs)/ziva-ia' as RelativePathString)}
              />
            );
          }
          if (item.kind === 'trending') {
            return <TrendingStrip tags={item.tags} />;
          }
          if (item.kind === 'marketplace') {
            return (
              <View style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <ShoppingBag size={16} color="#7B3FF2" />
                    <Text style={{ fontWeight: '800', color: colors.text, fontSize: 15 }}>Marketplace Ziva</Text>
                  </View>
                  <Pressable onPress={() => router.push('/(app)/(tabs)/marketplace' as RelativePathString)}>
                    <Text style={{ fontSize: 12, color: '#7B3FF2', fontWeight: '700' }}>Ver tudo →</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {item.products.map((prod) => (
                    <Pressable key={prod.id} onPress={() => router.push('/(app)/(tabs)/marketplace' as RelativePathString)}
                      style={{ width: 140, backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.cardBorder }}>
                      {prod.images?.[0] ? (
                        <Image source={{ uri: prod.images[0] }} style={{ width: 140, height: 100 }} contentFit="cover" />
                      ) : (
                        <View style={{ width: 140, height: 100, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' }}>
                          <ShoppingBag size={28} color={colors.muted} />
                        </View>
                      )}
                      <View style={{ padding: 8, gap: 3 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }} numberOfLines={2}>{prod.title}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: '#7B3FF2' }}>
                          {prod.currency === 'AOA' ? `${prod.price.toLocaleString()} Kz` : prod.currency === 'USD' ? `$${prod.price}` : `€${prod.price}`}
                        </Text>
                        {prod.location && (
                          <Text style={{ fontSize: 10, color: colors.muted }} numberOfLines={1}>📍 {prod.location}</Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                  <Pressable onPress={() => router.push('/(app)/(tabs)/marketplace' as RelativePathString)}
                    style={{ width: 80, backgroundColor: 'rgba(123,63,242,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(123,63,242,0.2)', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <ShoppingBag size={22} color="#7B3FF2" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#7B3FF2', textAlign: 'center' }}>Ver mais</Text>
                  </Pressable>
                </ScrollView>
              </View>
            );
          }
          const post = item.data;
          return (
            <View>
              {/* Crachá "A ressurgir" para posts antigos com nova actividade */}
              {(post as any).is_resurging && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2,
                }}>
                  <RefreshCw size={13} color="#F59E0B" strokeWidth={2.5} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B', letterSpacing: 0.3 }}>
                    A RESSURGIR · Voltou a ser popular
                  </Text>
                </View>
              )}
              <PostCard
                post={post}
                currentUserId={userId}
                onLikeToggle={handleLikeToggle}
              />
            </View>
          );
        }}
        onViewableItemsChanged={process.env.EXPO_OS === 'web' ? undefined : handleViewableItemsChanged}
        viewabilityConfig={process.env.EXPO_OS === 'web' ? undefined : viewabilityConfigRef.current}
        ListHeaderComponent={<><TopBar /><FeedHeader /><StoriesBar /></>}
        ItemSeparatorComponent={() => <View style={{ height: 8, backgroundColor: colors.bg }} />}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.purple} />
        }
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 16 }}>
            <Text style={{ fontSize: 52 }}>
              {feedFilter === 'reels' ? '🎬' : feedFilter === 'ia' ? '🤖' : feedFilter === 'tecnologia' ? '💻' : feedFilter === 'seguindo' ? '👥' : '✨'}
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
              {feedFilter === 'todos' ? 'Sê o primeiro a publicar!' : `Sem ${FEED_TABS.find(t => t.key === feedFilter)?.label ?? ''} ainda`}
            </Text>
            <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 22 }}>
              {feedFilter === 'todos'
                ? 'Partilha um momento, uma ideia ou uma conquista. A tua audiência está à espera!'
                : 'Ainda não há conteúdo nesta categoria. Cria o primeiro!'}
            </Text>
            <View style={{ gap: 10, width: '100%' }}>
              <Pressable style={{ backgroundColor: colors.purple, borderRadius: 20, paddingVertical: 14, alignItems: 'center',
                shadowColor: colors.purple, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 }}
                onPress={() => router.push('/(app)/(tabs)/create' as RelativePathString)}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>✍️ Criar Publicação</Text>
              </Pressable>
              {feedFilter === 'todos' && (
                <Pressable style={{ backgroundColor: colors.card, borderRadius: 20, paddingVertical: 13, alignItems: 'center',
                  borderWidth: 1, borderColor: colors.cardBorder }}
                  onPress={() => router.push('/(app)/(tabs)/search' as RelativePathString)}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>🔍 Encontrar pessoas</Text>
                </Pressable>
              )}
            </View>
          </View>
        }
      />
    </View>
  );
}
