import { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import {
  Search as SearchIcon, UserPlus, UserCheck, Hash, FileText, Radio, X,
  TrendingUp, Sparkles, Users, Film, Star,
} from 'lucide-react-native';
import type { RelativePathString } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useZivaTheme } from '@/lib/theme-context';

interface UserResult {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  followers_count: number;
  is_verified?: boolean;
  isFollowing?: boolean;
}

interface PostResult {
  id: string;
  caption: string;
  image_url: string;
  likes_count: number;
  created_at: string;
  profiles: { username: string; avatar_url: string };
}

interface ReelResult {
  id: string;
  caption: string;
  video_url: string;
  likes_count: number;
  views_count: number;
  profiles: { username: string; avatar_url: string; is_verified?: boolean };
}

interface CreatorResult {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  followers_count: number;
  is_verified: boolean;
  posts_count: number;
  recent_engagement: number;
}

interface TrendingPost {
  id: string;
  caption: string;
  image_url: string;
  video_url: string;
  post_type: string;
  likes_count: number;
  trending_score: number;
  username: string;
  avatar_url: string;
}

interface TrendingTag { tag: string; post_count: number; }

interface LiveResult {
  id: string;
  title: string;
  status: string;
  viewer_count: number;
  host: { username: string; avatar_url: string };
}

type SearchTab = 'pessoas' | 'posts' | 'lives' | 'hashtags';

interface DiscoverData {
  trending:    TrendingPost[];
  creators:    CreatorResult[];
  hashtags:    TrendingTag[];
  reels:       ReelResult[];
}

const POPULAR_TAGS = ['#angola', '#luanda', '#ziva', '#amor', '#lifestyle', '#musica', '#kizomba', '#africa', '#moda', '#arte'];

export default function SearchScreen() {
  const { session } = useSession();
  const router = useRouter();
  const { colors } = useZivaTheme();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('pessoas');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [lives, setLives] = useState<LiveResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState<UserResult[]>([]);
  const [discoverData, setDiscoverData] = useState<DiscoverData | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [hashtagQuery, setHashtagQuery] = useState('');
  const [hashtagPosts, setHashtagPosts] = useState<PostResult[]>([]);
  const [hashtagLoading, setHashtagLoading] = useState(false);
  const userId = session?.user?.id ?? '';

  const loadSuggested = useCallback(async () => {
    if (!userId) return;
    const { data: followData } = await supabase
      .from('follows').select('following_id').eq('follower_id', userId);
    const followingIds = new Set([...(followData?.map((f) => f.following_id) ?? []), userId]);
    const { data } = await supabase
      .from('profiles').select('id, username, full_name, avatar_url, followers_count, is_verified')
      .order('followers_count', { ascending: false }).limit(20);
    setSuggested((data ?? []).filter((u) => !followingIds.has(u.id)).map((u) => ({ ...u, isFollowing: false })));
  }, [userId]);

  // Descoberta inteligente: tendências, criadores, comunidades, reels
  const loadDiscover = useCallback(async () => {
    if (!userId) return;
    setDiscoverLoading(true);
    try {
      const { data } = await supabase.functions.invoke('ziva-recommendations', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // @ts-ignore — querystring passada via URL param
        query: { type: 'discover', limit: '12' },
      });
      if (data && !data.error) {
        setDiscoverData({
          trending:    data.trending    ?? [],
          creators:    data.creators    ?? [],
          hashtags:    data.hashtags    ?? [],
          
          reels:       data.reels       ?? [],
        });
      } else {
        
        const [trendingRes, tagsRes] = await Promise.all([
          supabase.rpc('get_trending_posts', { lim: 10 }),
          supabase.rpc('get_trending_hashtags', { lim: 12 }),
        ]);
        setDiscoverData({
          trending:    (trendingRes.data ?? []) as TrendingPost[],
          creators:    [],
          hashtags:    (tagsRes.data ?? []) as TrendingTag[],
          
          reels:       [],
        });
      }
    } catch {
      setDiscoverData({ trending: [], creators: [], hashtags: [],  reels: [] });
    } finally {
      setDiscoverLoading(false);
    }
  }, [userId]);

  const loadHashtagPosts = useCallback(async (tag: string) => {
    const clean = tag.replace(/^#/, '').trim();
    if (!clean) return;
    setHashtagQuery(clean);
    setHashtagLoading(true);
    setHashtagPosts([]);
    const { data } = await supabase
      .from('posts')
      .select('id, caption, image_url, likes_count, created_at, profiles(username, avatar_url)')
      .ilike('caption', `%#${clean}%`)
      .eq('status', 'published')
      .eq('is_deleted', false)
      .order('likes_count', { ascending: false })
      .limit(40);
    setHashtagPosts(
      (data ?? []).map((p: any) => ({
        ...p,
        profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
      }))
    );
    setHashtagLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSuggested();
      loadDiscover();
    }, [loadSuggested, loadDiscover])
  );

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim()) { setUsers([]); setPosts([]); return; }
    setLoading(true);
    const trimmed = text.trim().replace(/^#/, '');

    const [followRes, usersRes, postsRes, livesRes] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', userId),
      supabase.from('profiles')
        .select('id, username, full_name, avatar_url, followers_count, is_verified')
        .or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
        .neq('id', userId).limit(20),
      supabase.from('posts')
        .select('id, caption, image_url, likes_count, created_at, profiles(username, avatar_url)')
        .ilike('caption', `%${trimmed}%`)
        .eq('status', 'published')
        .eq('is_deleted', false)
        .order('likes_count', { ascending: false }).limit(20),
      supabase.from('lives')
        .select('id, title, status, viewer_count, host:profiles!lives_host_id_fkey(username, avatar_url)')
        .ilike('title', `%${trimmed}%`).in('status', ['waiting', 'live']).limit(10),
    ]);

    const followingIds = new Set(followRes.data?.map((f) => f.following_id) ?? []);
    setUsers((usersRes.data ?? []).map((u) => ({ ...u, isFollowing: followingIds.has(u.id) })));
    setPosts((postsRes.data ?? []).map((p) => ({ ...p, profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles })));
    setLives((livesRes.data ?? []).map((l) => ({ ...l, host: Array.isArray(l.host) ? l.host[0] : l.host })) as LiveResult[]);
    setLoading(false);
  };

  const handleFollow = async (targetId: string, currentlyFollowing: boolean) => {
    const update = (list: UserResult[]) =>
      list.map((u) => u.id === targetId ? { ...u, isFollowing: !currentlyFollowing } : u);
    setUsers(update); setSuggested(update);
    if (currentlyFollowing) {
      await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId);
    } else {
      await supabase.from('follows').insert({ follower_id: userId, following_id: targetId });
    }
  };

  const TABS: { key: SearchTab; label: string; Icon: any }[] = [
    { key: 'pessoas',  label: 'Pessoas',  Icon: UserPlus },
    { key: 'posts',    label: 'Posts',    Icon: FileText },
    { key: 'lives',    label: 'Lives',    Icon: Radio    },
    { key: 'hashtags', label: 'Hashtags', Icon: Hash     },
  ];

  const renderUser = ({ item }: { item: UserResult }) => (
    <Pressable
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
        gap: 12, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder }}
      onPress={() => router.push(`/(app)/user/${item.id}` as any)}>
      <Image source={item.avatar_url ? { uri: item.avatar_url } : undefined}
        style={{ width: 50, height: 50, borderRadius: 25 }} contentFit="cover"
        placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>{item.username}</Text>
          {item.is_verified && <VerifiedBadge size={14} />}
        </View>
        {item.full_name ? <Text style={{ color: colors.muted, fontSize: 12 }}>{item.full_name}</Text> : null}
        <Text style={{ color: colors.muted, fontSize: 12 }}>{item.followers_count ?? 0} seguidores</Text>
      </View>
      <Pressable
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16,
          paddingVertical: 8, borderRadius: 20,
          backgroundColor: item.isFollowing ? colors.input : colors.purple,
          borderWidth: item.isFollowing ? 1 : 0, borderColor: colors.inputBorder,
        }}
        onPress={() => handleFollow(item.id, !!item.isFollowing)}>
        {item.isFollowing
          ? <UserCheck size={14} color={colors.muted} />
          : <UserPlus size={14} color="#fff" />}
        <Text style={{ fontSize: 12, fontWeight: '700',
          color: item.isFollowing ? colors.muted : '#fff' }}>
          {item.isFollowing ? 'A seguir' : 'Seguir'}
        </Text>
      </Pressable>
    </Pressable>
  );

  const renderPost = ({ item }: { item: PostResult }) => (
    <Pressable
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
        gap: 12, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder }}
      onPress={() => router.push(`/(app)/post/${item.id}` as any)}>
      {item.image_url
        ? <Image source={{ uri: item.image_url }} style={{ width: 56, height: 56, borderRadius: 10 }} contentFit="cover" />
        : <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: 'rgba(123,63,242,0.12)',
            alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={22} color={colors.purple} />
          </View>}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
          {item.caption || '(sem legenda)'}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>@{item.profiles?.username} · ❤️ {item.likes_count}</Text>
      </View>
    </Pressable>
  );

  const renderLive = ({ item }: { item: LiveResult }) => (
    <Pressable
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
        gap: 12, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder }}
      onPress={() => router.push(`/(app)/live/${item.id}` as RelativePathString)}>
      <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: '#1a0a2e',
        alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {item.host?.avatar_url
          ? <Image source={{ uri: item.host.avatar_url }} style={{ width: 56, height: 56, borderRadius: 10 }} contentFit="cover" />
          : <Radio size={22} color={colors.purple} />}
        <View style={{ position: 'absolute', top: 3, left: 3, backgroundColor: '#ef4444',
          borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 }}>
          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>AO VIVO</Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
          {item.title || 'Live sem título'}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>@{item.host?.username} · 👁 {item.viewer_count} a ver</Text>
      </View>
    </Pressable>
  );

  const currentList = activeTab === 'pessoas'
    ? (query.trim() ? users : suggested)
    : activeTab === 'posts' ? posts
    : activeTab === 'lives' ? lives
    : [];

  // ── Painel Hashtags ───────────────────────────────────────────────────────
  const HashtagPanel = (
    <ScrollView contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 12 }}>
      {/* Hashtags populares */}
      <Text style={{ fontWeight: '800', color: colors.text, fontSize: 15 }}>Hashtags populares</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
        {POPULAR_TAGS.map((tag) => (
          <Pressable key={tag} onPress={() => loadHashtagPosts(tag)}
            style={{ backgroundColor: 'rgba(123,63,242,0.12)', borderRadius: 20,
              paddingVertical: 8, paddingHorizontal: 16,
              borderWidth: 1, borderColor: 'rgba(123,63,242,0.25)' }}>
            <Text style={{ color: colors.purple, fontWeight: '700', fontSize: 14 }}>{tag}</Text>
          </Pressable>
        ))}
      </View>

      {/* Tendências do algoritmo */}
      {discoverData?.hashtags && discoverData.hashtags.length > 0 && (
        <>
          <Text style={{ fontWeight: '800', color: colors.text, fontSize: 15, marginTop: 8 }}>
            📈 Em alta agora
          </Text>
          {discoverData.hashtags.slice(0, 8).map((h) => (
            <Pressable key={h.tag}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
                borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder }}
              onPress={() => loadHashtagPosts(h.tag)}>
              <View style={{ width: 44, height: 44, borderRadius: 22,
                backgroundColor: 'rgba(123,63,242,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Hash size={20} color={colors.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>#{h.tag}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {h.post_count} {h.post_count === 1 ? 'publicação' : 'publicações'}
                </Text>
              </View>
              <TrendingUp size={16} color="#22C55E" />
            </Pressable>
          ))}
        </>
      )}

      {/* Posts da hashtag seleccionada */}
      {hashtagQuery ? (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontWeight: '800', color: colors.text, fontSize: 15 }}>#{hashtagQuery}</Text>
            <Pressable onPress={() => { setHashtagQuery(''); setHashtagPosts([]); }}>
              <X size={16} color={colors.muted} />
            </Pressable>
          </View>
          {hashtagLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator color={colors.purple} />
            </View>
          ) : hashtagPosts.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
              <Text style={{ fontSize: 36 }}>🏷️</Text>
              <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 14 }}>
                Seja o primeiro a usar #{hashtagQuery}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -1 }}>
              {hashtagPosts.map((p) => (
                <Pressable key={p.id}
                  onPress={() => router.push(`/(app)/post/${p.id}` as RelativePathString)}
                  style={{ width: '33.33%', aspectRatio: 1, padding: 1 }}>
                  {p.image_url
                    ? <Image source={{ uri: p.image_url }} style={{ flex: 1 }} contentFit="cover" />
                    : <View style={{ flex: 1, backgroundColor: 'rgba(123,63,242,0.12)',
                        alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} color={colors.purple} />
                      </View>}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </ScrollView>
  );

  // ── Painel Descoberta (tab posts sem pesquisa) ─────────────────────────────
  const DiscoverPanel = (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      {discoverLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <ActivityIndicator color={colors.purple} size="large" />
          <Text style={{ color: colors.muted, marginTop: 12, fontSize: 14 }}>
            A personalizar a descoberta…
          </Text>
        </View>
      ) : (
        <>
          {/* ── Em Alta ───────────────────────────────────────────── */}
          {(discoverData?.trending?.length ?? 0) > 0 && (
            <View style={{ paddingTop: 16, paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 16, marginBottom: 12 }}>
                <TrendingUp size={18} color="#EF4444" />
                <Text style={{ fontWeight: '800', color: colors.text, fontSize: 16 }}>Em Alta</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                {discoverData!.trending.map((p) => (
                  <Pressable key={p.id}
                    onPress={() => router.push(`/(app)/post/${p.id}` as RelativePathString)}
                    style={{ width: 130, borderRadius: 14, overflow: 'hidden',
                      borderWidth: 0.5, borderColor: colors.cardBorder }}>
                    <View style={{ width: 130, height: 130, backgroundColor: 'rgba(123,63,242,0.08)' }}>
                      {p.image_url
                        ? <Image source={{ uri: p.image_url }} style={{ flex: 1 }} contentFit="cover" />
                        : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={28} color={colors.purple} />
                          </View>}
                      {p.post_type === 'reel' && (
                        <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)',
                          borderRadius: 8, padding: 3 }}>
                          <Film size={14} color="#fff" />
                        </View>
                      )}
                    </View>
                    <View style={{ padding: 8, backgroundColor: colors.card }}>
                      <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                        {p.caption || '…'}
                      </Text>
                      <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '700', marginTop: 2 }}>
                        ❤️ {p.likes_count}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Criadores em Destaque ─────────────────────────────── */}
          {(discoverData?.creators?.length ?? 0) > 0 && (
            <View style={{ paddingVertical: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 16, marginBottom: 12 }}>
                <Star size={18} color="#F59E0B" />
                <Text style={{ fontWeight: '800', color: colors.text, fontSize: 16 }}>
                  Criadores em Destaque
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
                {discoverData!.creators.map((c) => (
                  <Pressable key={c.id}
                    onPress={() => router.push(`/(app)/user/${c.id}` as RelativePathString)}
                    style={{ alignItems: 'center', width: 84, gap: 6 }}>
                    <View style={{ width: 68, height: 68, borderRadius: 34,
                      borderWidth: 2, borderColor: colors.purple, padding: 2 }}>
                      <Image source={c.avatar_url ? { uri: c.avatar_url } : undefined}
                        style={{ flex: 1, borderRadius: 30 }} contentFit="cover"
                        placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }} />
                    </View>
                    <View style={{ alignItems: 'center', gap: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}
                          numberOfLines={1}>{c.username}</Text>
                        {c.is_verified && <VerifiedBadge size={11} />}
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 10 }}>
                        {c.followers_count >= 1000
                          ? `${(c.followers_count / 1000).toFixed(1)}k`
                          : c.followers_count} seg.
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Reels Recomendados ────────────────────────────────── */}
          {(discoverData?.reels?.length ?? 0) > 0 && (
            <View style={{ paddingVertical: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 16, marginBottom: 12 }}>
                <Film size={18} color="#EF4444" />
                <Text style={{ fontWeight: '800', color: colors.text, fontSize: 16 }}>Reels</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 2 }}>
                {discoverData!.reels.map((r) => (
                  <Pressable key={r.id}
                    onPress={() => router.push(`/(app)/post/${r.id}` as RelativePathString)}
                    style={{ width: '33.33%', aspectRatio: 9 / 16, padding: 1 }}>
                    <View style={{ flex: 1, backgroundColor: '#1a0a2e', overflow: 'hidden' }}>
                      {r.video_url
                        ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: 'rgba(239,68,68,0.08)' }}>
                            <Film size={28} color="#EF4444" />
                          </View>
                        : null}
                      <View style={{ position: 'absolute', bottom: 4, left: 4, right: 4,
                        flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Image source={r.profiles?.avatar_url ? { uri: r.profiles.avatar_url } : undefined}
                          style={{ width: 18, height: 18, borderRadius: 9 }} contentFit="cover" />
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', flex: 1 }}
                          numberOfLines={1}>@{r.profiles?.username}</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Grelha de posts em destaque (fallback se sem discover) */}
          {(discoverData?.trending?.length ?? 0) === 0 && (
            <View style={{ padding: 16 }}>
              <Text style={{ fontWeight: '800', color: colors.text, fontSize: 15, marginBottom: 12 }}>
                📸 Explorar publicações
              </Text>
              <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 32, fontSize: 14 }}>
                Publica conteúdo para aparecer na descoberta!
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />

      {/* Barra de pesquisa */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder,
        backgroundColor: colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input,
          borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11, gap: 10,
          borderWidth: 1, borderColor: colors.inputBorder }}>
          <SearchIcon size={18} color={colors.muted} />
          <TextInput
            style={{ flex: 1, color: colors.text, fontSize: 14 }}
            placeholder="Buscar pessoas, posts, lives, #hashtags…"
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none" autoCorrect={false} returnKeyType="search"
          />
          {loading && <ActivityIndicator size="small" color={colors.purple} />}
          {query.length > 0 && !loading && (
            <Pressable onPress={() => { setQuery(''); setUsers([]); setPosts([]); }}>
              <X size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 8 }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                paddingHorizontal: 12, gap: 5,
                borderBottomWidth: active ? 2 : 0, borderBottomColor: colors.purple }}>
              <tab.Icon size={15} color={active ? colors.purple : colors.muted}
                strokeWidth={active ? 2.2 : 1.8} />
              <Text style={{ fontSize: 13, fontWeight: '600',
                color: active ? colors.purple : colors.muted }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Conteúdo */}
      {activeTab === 'hashtags' ? HashtagPanel
        : !query.trim() && activeTab === 'posts' ? DiscoverPanel
        : (
          <FlatList
            data={currentList as any}
            keyExtractor={(item: any) => item.id}
            renderItem={
              activeTab === 'lives' ? renderLive as any
              : activeTab === 'posts' ? renderPost as any
              : renderUser as any
            }
            contentInsetAdjustmentBehavior="automatic"
            ListHeaderComponent={!query.trim() && activeTab === 'pessoas' ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
                flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color={colors.purple} />
                <Text style={{ fontWeight: '700', color: colors.muted, fontSize: 13 }}>
                  Sugeridos para ti
                </Text>
              </View>
            ) : null}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 80, gap: 10 }}>
                <Text style={{ fontSize: 44 }}>🔍</Text>
                <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 15 }}>
                  {query.trim() ? 'Nenhum resultado encontrado' : 'Começa a escrever para pesquisar'}
                </Text>
              </View>
            }
          />
        )}
    </View>
  );
}

