import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import {
  ArrowLeft, MessageCircle, UserPlus, UserCheck, ChevronRight,
  X as XIcon, Grid, Film, Camera, Play, Sparkles, Heart, MessageSquare,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import type { RelativePathString } from 'expo-router';

import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useZivaTheme } from '@/lib/theme-context';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
  id: string; username: string; full_name: string; bio: string;
  avatar_url: string; cover_url?: string | null;
  followers_count: number; following_count: number; posts_count: number;
  location?: string | null; is_verified?: boolean;
}
interface Post {
  id: string; image_url: string | null; caption: string;
  video_url?: string | null; post_type?: string;
  likes_count: number; comments_count: number;
}
type UserTab = 'todos' | 'posts' | 'fotos' | 'videos' | 'reels';

const TABS: { key: UserTab; label: string; Icon: any }[] = [
  { key: 'todos',  label: 'Todos',  Icon: Grid  },
  { key: 'posts',  label: 'Posts',  Icon: Sparkles },
  { key: 'fotos',  label: 'Fotos',  Icon: Camera   },
  { key: 'videos', label: 'Vídeos', Icon: Play      },
  { key: 'reels',  label: 'Reels',  Icon: Film      },
];

// ─── Grid cell ────────────────────────────────────────────────────────────────
function GridCell({ item, router, colors }: { item: Post; router: any; colors: any }) {
  return (
    <Pressable
      onPress={() => router.push(`/(app)/post/${item.id}` as RelativePathString)}
      style={{ width: '33.33%', aspectRatio: 1, padding: 1 }}
      className="active:opacity-80"
    >
      {item.image_url
        ? <Image source={{ uri: item.image_url }} style={{ flex: 1 }} contentFit="cover" />
        : <View style={{ flex: 1, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            {item.video_url ? <Play size={22} color={colors.muted} /> : <Sparkles size={22} color={colors.muted} />}
          </View>}
      {item.video_url && (
        <View style={{
          position: 'absolute', top: 5, right: 5, width: 20, height: 20,
          borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Play size={9} color="#fff" fill="#fff" />
        </View>
      )}
    </Pressable>
  );
}

// ─── Post list card ───────────────────────────────────────────────────────────
function PostCard({ item, router, colors }: { item: Post; router: any; colors: any }) {
  return (
    <Pressable
      onPress={() => router.push(`/(app)/post/${item.id}` as RelativePathString)}
      style={{
        marginHorizontal: 12, marginBottom: 10, borderRadius: 16,
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
        overflow: 'hidden',
      }}
      className="active:opacity-80"
    >
      {item.caption ? (
        <View style={{ padding: 12, paddingBottom: item.image_url ? 6 : 12 }}>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>{item.caption}</Text>
        </View>
      ) : null}
      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="cover" />
      )}
      <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Heart size={13} color={colors.muted} strokeWidth={1.6} />
          <Text style={{ fontSize: 12, color: colors.muted }}>{item.likes_count ?? 0}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MessageSquare size={13} color={colors.muted} strokeWidth={1.6} />
          <Text style={{ fontSize: 12, color: colors.muted }}>{item.comments_count ?? 0}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const router = useRouter();
  const { colors, isDark } = useZivaTheme();
  const currentUserId = session?.user?.id ?? '';

  const [profile, setProfile]         = useState<Profile | null>(null);
  const [allPosts, setAllPosts]       = useState<Post[]>([]);
  const [loading, setLoading]         = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab]     = useState<UserTab>('todos');

  // ── Modal seguidores/seguindo ─────────────────────────────────────────────
  type FollowMode = 'followers' | 'following';
  const [followModal, setFollowModal]             = useState<FollowMode | null>(null);
  const [followList, setFollowList]               = useState<Array<{ id: string; username: string; full_name: string; avatar_url: string | null }>>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const openFollowModal = useCallback(async (mode: FollowMode) => {
    if (!profile) return;
    setFollowModal(mode);
    setFollowList([]);
    setFollowListLoading(true);
    try {
      if (mode === 'followers') {
        const { data } = await supabase
          .from('follows')
          .select('follower:profiles!follows_follower_id_fkey(id, username, full_name, avatar_url)')
          .eq('following_id', profile.id).limit(100);
        setFollowList(((data ?? []) as any[]).map((r) => r.follower).filter(Boolean));
      } else {
        const { data } = await supabase
          .from('follows')
          .select('following:profiles!follows_following_id_fkey(id, username, full_name, avatar_url)')
          .eq('follower_id', profile.id).limit(100);
        setFollowList(((data ?? []) as any[]).map((r) => r.following).filter(Boolean));
      }
    } catch { /* silencia */ }
    setFollowListLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const load = async () => {
        try {
          setLoading(true);
          // Carrega perfil + posts em paralelo
          const [{ data: prof }, { data: postsData, error: postsError }, { data: followData }] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', id).single(),
            supabase.from('posts')
              .select('id, image_url, caption, video_url, post_type, likes_count, comments_count')
              .eq('user_id', id)
              .eq('status', 'published')
              .eq('is_deleted', false)
              .order('created_at', { ascending: false })
              .limit(60),
            currentUserId
              ? supabase.from('follows').select('follower_id')
                  .eq('follower_id', currentUserId).eq('following_id', id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          setProfile(prof);
          // Se a query falhou (coluna inexistente), busca sem filtros como fallback
          const loadedPosts = postsData ?? (postsError ? await supabase
            .from('posts')
            .select('id, image_url, caption, video_url, post_type, likes_count, comments_count')
            .eq('user_id', id)
            .order('created_at', { ascending: false })
            .limit(60)
            .then((r) => r.data ?? []) : []);
          setAllPosts(Array.isArray(loadedPosts) ? loadedPosts : []);
          // Sincroniza posts_count com o número real de publicações carregadas
          if (prof) {
            const realCount = Array.isArray(loadedPosts) ? loadedPosts.length : 0;
            setProfile({ ...prof, posts_count: realCount });
          }
          setIsFollowing(!!followData);
        } catch { /* erro de rede */ } finally {
          setLoading(false);
        }
      };
      load();
    }, [id, currentUserId])
  );

  // ── Filtro de tab ─────────────────────────────────────────────────────────
  const filteredPosts = useCallback((tab: UserTab): Post[] => {
    switch (tab) {
      case 'todos':  return allPosts;
      case 'posts':  return allPosts.filter((p) => !p.video_url && p.post_type !== 'reel');
      case 'fotos':  return allPosts.filter((p) => !!p.image_url && !p.video_url);
      case 'videos': return allPosts.filter((p) => !!p.video_url && p.post_type !== 'reel');
      case 'reels':  return allPosts.filter((p) => p.post_type === 'reel');
      default:       return allPosts;
    }
  }, [allPosts]);

  const handleFollow = async () => {
    if (!profile || !currentUserId) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', id);
      setIsFollowing(false);
      setProfile((p) => p ? { ...p, followers_count: Math.max(0, p.followers_count - 1) } : p);
    } else {
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: id });
      setIsFollowing(true);
      setProfile((p) => p ? { ...p, followers_count: p.followers_count + 1 } : p);
    }
    setFollowLoading(false);
  };

  const handleMessage = async () => {
    if (!profile || !currentUserId) return;
    const [a, b] = [currentUserId, id].sort();
    const { data: existing } = await supabase
      .from('conversations').select('id').eq('participant_one', a).eq('participant_two', b).maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data: newConv } = await supabase
        .from('conversations').insert({ participant_one: a, participant_two: b }).select('id').single();
      convId = newConv?.id;
    }
    if (convId) router.push(`/(app)/messages/${convId}` as RelativePathString);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#7B3FF2" />
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.muted }}>Perfil não encontrado</Text>
      </View>
    );
  }

  const isOwnProfile = id === currentUserId;
  const COVER_H = 180;
  const AVATAR_SIZE = 88;
  const posts = filteredPosts(activeTab);
  const isGrid = activeTab === 'fotos' || activeTab === 'reels' || activeTab === 'videos';

  const ListHeader = (
    <View>
      {/* ── Banner ── */}
      <View style={{ height: COVER_H, backgroundColor: colors.card }}>
        {profile.cover_url
          ? <Image source={{ uri: profile.cover_url }} style={{ flex: 1 }} contentFit="cover" />
          : <View style={{ flex: 1, backgroundColor: isDark ? '#1a0533' : '#ede9fe' }} />}
      </View>

      {/* ── Avatar + actions ── */}
      <View style={{ paddingHorizontal: 16, marginTop: -(AVATAR_SIZE / 2) }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          {/* Avatar */}
          <View style={{
            width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
            borderWidth: 3, borderColor: colors.bg, overflow: 'hidden',
            backgroundColor: colors.card,
          }}>
            <Image
              source={profile.avatar_url ? { uri: profile.avatar_url } : undefined}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
            />
          </View>

          {/* Botões */}
          {!isOwnProfile && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
              <Pressable
                onPress={handleFollow} disabled={followLoading}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22,
                  backgroundColor: isFollowing ? colors.card : '#7B3FF2',
                  borderWidth: 1.5,
                  borderColor: isFollowing ? colors.cardBorder : '#7B3FF2',
                }}
                className="active:opacity-75"
              >
                {followLoading
                  ? <ActivityIndicator size="small" color={isFollowing ? colors.text : '#fff'} />
                  : isFollowing
                    ? <UserCheck size={15} color={colors.text} />
                    : <UserPlus size={15} color="#fff" />}
                <Text style={{ color: isFollowing ? colors.text : '#fff', fontWeight: '700', fontSize: 13 }}>
                  {isFollowing ? 'Seguindo' : 'Seguir'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleMessage}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22,
                  backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.cardBorder,
                }}
                className="active:opacity-75"
              >
                <MessageCircle size={15} color="#7B3FF2" />
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Mensagem</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Info ── */}
        <View style={{ marginTop: 12, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
              {profile.full_name || profile.username}
            </Text>
            {profile.is_verified && <VerifiedBadge size={18} />}
          </View>
          <Text style={{ fontSize: 13, color: colors.muted }}>@{profile.username}</Text>
          {profile.bio ? (
            <Text style={{ fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 19 }}>
              {profile.bio}
            </Text>
          ) : null}
          {profile.location ? (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>📍 {profile.location}</Text>
          ) : null}
        </View>

        {/* ── Stats ── */}
        <View style={{
          flexDirection: 'row', marginTop: 16, paddingVertical: 12,
          borderRadius: 16, backgroundColor: colors.card,
          borderWidth: 1, borderColor: colors.cardBorder,
        }}>
          {[
            { label: 'Posts',      value: profile.posts_count,     mode: null           },
            { label: 'Seguidores', value: profile.followers_count, mode: 'followers' as FollowMode },
            { label: 'Seguindo',   value: profile.following_count, mode: 'following' as FollowMode },
          ].map((stat, idx) => (
            <Pressable
              key={stat.label}
              onPress={stat.mode ? () => openFollowModal(stat.mode!) : undefined}
              style={{ flex: 1, alignItems: 'center', borderRightWidth: idx < 2 ? 1 : 0, borderRightColor: colors.cardBorder }}
              className={stat.mode ? 'active:opacity-70' : undefined}
            >
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{stat.value ?? 0}</Text>
              <Text style={{ fontSize: 11, color: stat.mode ? '#7B3FF2' : colors.muted, fontWeight: stat.mode ? '600' : '400', marginTop: 2 }}>
                {stat.label}
              </Text>
              {stat.mode ? <ChevronRight size={10} color="#7B3FF2" style={{ marginTop: 1 }} /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Tabs ── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={{ marginTop: 14, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 12, paddingVertical: 12,
                borderBottomWidth: active ? 2 : 0, borderBottomColor: '#7B3FF2',
              }}
              className="active:opacity-70"
            >
              <tab.Icon size={14} color={active ? '#7B3FF2' : colors.muted} strokeWidth={active ? 2.2 : 1.8} />
              <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? '#7B3FF2' : colors.muted }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const EmptyState = (
    <View style={{ alignItems: 'center', paddingVertical: 48, gap: 8 }}>
      <Text style={{ fontSize: 40 }}>📷</Text>
      <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 14 }}>
        Nenhuma publicação nesta categoria
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />

      {/* ── Botão voltar flutuante sobre o banner ── */}
      <View style={{
        position: 'absolute', top: 48, left: 16, zIndex: 10,
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
      }}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/home' as RelativePathString)}
          className="active:opacity-70"
        >
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={isGrid ? posts : posts}
        key={isGrid ? `grid-${activeTab}` : `list-${activeTab}`}
        numColumns={isGrid ? 3 : 1}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyState}
        renderItem={isGrid
          ? ({ item }) => <GridCell item={item} router={router} colors={colors} />
          : ({ item }) => <PostCard item={item} router={router} colors={colors} />}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: isGrid ? 2 : 10 }}
      />

      {/* ── Modal: seguidores/seguindo ── */}
      <Modal
        visible={!!followModal} animationType="slide"
        presentationStyle="pageSheet" onRequestClose={() => setFollowModal(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingVertical: 16,
            borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
          }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
              {followModal === 'followers' ? 'Seguidores' : 'A seguir'}
            </Text>
            <Pressable onPress={() => setFollowModal(null)} className="p-1 active:opacity-70">
              <XIcon size={22} color={colors.muted} />
            </Pressable>
          </View>
          {followListLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#7B3FF2" />
            </View>
          ) : followList.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Text style={{ fontSize: 44 }}>👥</Text>
              <Text style={{ color: colors.muted, fontSize: 15 }}>
                {followModal === 'followers' ? 'Nenhum seguidor ainda' : 'Não segue ninguém ainda'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={followList}
              keyExtractor={(item) => item.id}
              contentInsetAdjustmentBehavior="automatic"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setFollowModal(null); router.push(`/(app)/user/${item.id}` as RelativePathString); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingHorizontal: 20, paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
                  }}
                  className="active:bg-muted"
                >
                  <Image
                    source={item.avatar_url ? { uri: item.avatar_url } : undefined}
                    style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card }}
                    contentFit="cover"
                    placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>{item.username}</Text>
                    {item.full_name ? <Text style={{ color: colors.muted, fontSize: 12 }}>{item.full_name}</Text> : null}
                  </View>
                  <ChevronRight size={16} color={colors.muted} />
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
