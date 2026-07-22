import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, ScrollView,
  TextInput, KeyboardAvoidingView, Animated, Share, Linking, Modal, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { fetch } from 'expo/fetch';
import {
  Settings, LogOut, Pencil, Check, X as XIcon, Camera,
  BarChart, Users, MapPin, Cake, Link, Play, Globe,
  Heart, Bookmark, MessageCircle, Grid, Film, Brain,
  Share as ShareIcon, Calendar, Sparkles, Eye, Star, ChevronRight,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { RelativePathString } from 'expo-router';

import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useZivaTheme } from '@/lib/theme-context';

// ─── Types ────────────────────────────────────────────────────────────────────
type ProfileTab = 'todos' | 'posts' | 'reels' | 'fotos' | 'videos' | 'ia' | 'eventos' | 'curtidos' | 'salvos';

interface TabDef { key: ProfileTab; label: string; icon: any }
const PROFILE_TABS: TabDef[] = [
  { key: 'todos',       label: 'Todos',       icon: Grid  },
  { key: 'posts',       label: 'Posts',       icon: Sparkles },
  { key: 'reels',       label: 'Reels',       icon: Film     },
  { key: 'fotos',       label: 'Fotos',       icon: Camera   },
  { key: 'videos',      label: 'Vídeos',      icon: Play     },
  { key: 'ia',          label: 'IA',          icon: Brain    },
  { key: 'eventos',     label: 'Eventos',     icon: Calendar },
  { key: 'curtidos',    label: 'Curtidos',    icon: Heart    },
  { key: 'salvos',      label: 'Salvos',      icon: Bookmark },
];

const GRID_TABS: ProfileTab[] = ['reels', 'fotos', 'videos'];
const PAGE_SIZE = 18;

interface Profile {
  id: string; username: string; full_name: string; bio: string;
  avatar_url: string; cover_url: string; created_at: string;
  followers_count: number; following_count: number; posts_count: number;
  location: string | null; birth_date: string | null;
  website: string | null; mood_status: string | null; is_verified: boolean;
}
interface FeedPost {
  id: string; image_url: string; image_urls?: string[];
  caption: string; likes_count: number; comments_count: number;
  video_url?: string | null; ai_generated?: boolean; created_at: string;
  post_type?: string;
  profiles?: { id: string; username: string; avatar_url: string; is_verified: boolean };
}
interface ProfileStats {
  postsCount: number; reelsCount: number; photosCount: number;
  videosCount: number;
  totalLikes: number; profileViews: number;
}
interface TabState { data: FeedPost[]; page: number; hasMore: boolean; loaded: boolean; loading: boolean; }

function makeTabState(): TabState { return { data: [], page: 0, hasMore: true, loaded: false, loading: false }; }

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}
function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}
function joinedDate(iso: string): string {
  const d = new Date(iso);
  return `Entrou em ${d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}`;
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
// Rendered OUTSIDE FlatList header → keyboard never dismisses on state change.
interface EditModalProps {
  visible: boolean;
  profile: Profile | null;
  colors: any;
  onClose: () => void;
  onSave: (updates: Partial<Profile>) => Promise<void>;
}
function EditProfileModal({ visible, profile, colors, onClose, onSave }: EditModalProps) {
  const [name,     setName]     = useState('');
  const [bio,      setBio]      = useState('');
  const [location, setLocation] = useState('');
  const [birth,    setBirth]    = useState('');
  const [website,  setWebsite]  = useState('');
  const [mood,     setMood]     = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (visible && profile) {
      setName(profile.full_name ?? '');
      setBio(profile.bio ?? '');
      setLocation(profile.location ?? '');
      setBirth(profile.birth_date ?? '');
      setWebsite(profile.website ?? '');
      setMood(profile.mood_status ?? '');
    }
  }, [visible, profile]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      full_name:   name.trim(),
      bio:         bio.trim(),
      location:    location.trim() || null,
      birth_date:  birth.trim() || null,
      website:     website.trim() || null,
      mood_status: mood.trim() || null,
    } as Partial<Profile>);
    setSaving(false);
  };

  const inputStyle = {
    borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: colors.text, backgroundColor: colors.input,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Editar Perfil</Text>
            <Pressable onPress={onClose}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.input,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: colors.inputBorder }}>
              <XIcon size={16} color={colors.muted} />
            </Pressable>
          </View>

          <View style={{ gap: 12 }}>
            {[
              { val: name,     set: setName,     ph: 'Nome completo'                      },
              { val: mood,     set: setMood,     ph: '✨ Estado de espírito'               },
              { val: location, set: setLocation, ph: '📍 Localização'                      },
              { val: birth,    set: setBirth,    ph: '🎂 Data de nascimento (AAAA-MM-DD)'  },
              { val: website,  set: setWebsite,  ph: '🔗 Website / Link'                   },
            ].map((f) => (
              <TextInput
                key={f.ph}
                value={f.val}
                onChangeText={f.set}
                placeholder={f.ph}
                placeholderTextColor={colors.placeholder}
                style={inputStyle}
              />
            ))}
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Bio..."
              multiline
              placeholderTextColor={colors.placeholder}
              style={[inputStyle, { minHeight: 88, textAlignVertical: 'top' }]}
            />
            <Pressable onPress={handleSave} disabled={saving}
              style={{ marginTop: 8, paddingVertical: 14, borderRadius: 14,
                backgroundColor: colors.purple, alignItems: 'center',
                flexDirection: 'row', gap: 8, justifyContent: 'center',
                shadowColor: colors.purple, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Check size={16} color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Guardar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function ProfileSkeleton() {
  const { colors } = useZivaTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: 200, backgroundColor: colors.input }} />
      <View style={{ paddingHorizontal: 16, marginTop: -44 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48,
          backgroundColor: colors.card, borderWidth: 3, borderColor: colors.bg }} />
        <View style={{ marginTop: 16, gap: 10 }}>
          {[160, 100, 220].map((w) => (
            <View key={w} style={{ width: w, height: 12, borderRadius: 6, backgroundColor: colors.input }} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Grid Row ─────────────────────────────────────────────────────────────────
function GridRow({ items, colors, router }: { items: FeedPost[]; colors: any; router: any }) {
  const colW = `${100 / 3}%`;
  return (
    <View style={{ flexDirection: 'row', gap: 2, paddingHorizontal: 2, marginBottom: 2 }}>
      {items.map((item) => (
        <Pressable key={item.id}
          onPress={() => router.push(`/(app)/post/${item.id}` as RelativePathString)}
          style={{ flex: 1, aspectRatio: 1, borderRadius: 6, overflow: 'hidden',
            backgroundColor: colors.input, maxWidth: colW }}>
          {item.image_url
            ? <Image source={{ uri: item.image_url }} style={{ flex: 1 }} contentFit="cover" />
            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                {item.video_url
                  ? <Play size={22} color={colors.muted} />
                  : <Sparkles size={22} color={colors.muted} />}
              </View>}
          {item.video_url && (
            <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22,
              borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)',
              alignItems: 'center', justifyContent: 'center' }}>
              <Play size={10} color="#fff" fill="#fff" />
            </View>
          )}
        </Pressable>
      ))}
      {items.length < 3 && Array(3 - items.length).fill(0).map((_, i) => (
        <View key={`ph-${i}`} style={{ flex: 1, maxWidth: colW }} />
      ))}
    </View>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function ProfilePostCard({ item, colors, isDark, router }: {
  item: FeedPost; colors: any; isDark: boolean; router: any;
}) {
  return (
    <Pressable onPress={() => router.push(`/(app)/post/${item.id}` as RelativePathString)}
      style={{ marginHorizontal: 12, marginBottom: 12, borderRadius: 20,
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.35 : 0.07, shadowRadius: 8, elevation: 3 }}>
      {item.caption ? (
        <View style={{ padding: 14, paddingBottom: item.image_url ? 8 : 14 }}>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21 }} numberOfLines={3}>
            {item.caption}
          </Text>
        </View>
      ) : null}
      {item.image_url && (
        <Image source={{ uri: item.image_url }}
          style={{ width: '100%', aspectRatio: item.video_url ? 16 / 9 : 4 / 3 }}
          contentFit="cover" />
      )}
      <View style={{ paddingHorizontal: 14, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Heart size={14} color={colors.muted} strokeWidth={1.6} />
          <Text style={{ fontSize: 12, color: colors.muted }}>{formatCount(item.likes_count ?? 0)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MessageCircle size={14} color={colors.muted} strokeWidth={1.6} />
          <Text style={{ fontSize: 12, color: colors.muted }}>{formatCount(item.comments_count ?? 0)}</Text>
        </View>
        <Text style={{ fontSize: 11, color: colors.placeholder, marginLeft: 'auto' as any }}>
          {relativeTime(item.created_at) ?? ''}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { session } = useSession();
  const router      = useRouter();
  const { colors, isDark } = useZivaTheme();
  const userId = session?.user?.id ?? '';

  // ── State ─────────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({
    postsCount: 0, reelsCount: 0, photosCount: 0,
    videosCount: 0, totalLikes: 0, profileViews: 0,
  });
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingCover,  setSavingCover]  = useState(false);
  const [editVisible,  setEditVisible]  = useState(false);

  // ── Modal lista de seguidores/seguindo ────────────────────────────────────
  type FollowModalMode = 'followers' | 'following';
  const [followModal, setFollowModal]       = useState<FollowModalMode | null>(null);
  const [followList,  setFollowList]        = useState<Array<{ id: string; username: string; full_name: string; avatar_url: string | null; is_verified?: boolean }>>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const openFollowModal = useCallback(async (mode: FollowModalMode) => {
    setFollowModal(mode);
    setFollowList([]);
    setFollowListLoading(true);
    try {
      if (mode === 'followers') {
        const { data } = await supabase
          .from('follows')
          .select('follower:profiles!follows_follower_id_fkey(id, username, full_name, avatar_url, is_verified)')
          .eq('following_id', userId)
          .limit(100);
        setFollowList(((data ?? []) as any[]).map((r) => r.follower).filter(Boolean));
      } else {
        const { data } = await supabase
          .from('follows')
          .select('following:profiles!follows_following_id_fkey(id, username, full_name, avatar_url, is_verified)')
          .eq('follower_id', userId)
          .limit(100);
        setFollowList(((data ?? []) as any[]).map((r) => r.following).filter(Boolean));
      }
    } catch { /* silencia */ }
    setFollowListLoading(false);
  }, [userId]);

  const initTabStates = (): Record<ProfileTab, TabState> => ({
    todos: makeTabState(), posts: makeTabState(), reels: makeTabState(),
    fotos: makeTabState(), videos: makeTabState(), ia: makeTabState(),
    eventos: makeTabState(),
    curtidos: makeTabState(), salvos: makeTabState(),
  });
  const [tabStates, setTabStates] = useState<Record<ProfileTab, TabState>>(initTabStates);
  const [activeTab,   setActiveTab]  = useState<ProfileTab>('todos');
  const tabAnim = useRef(new Animated.Value(1)).current;
  const flatRef = useRef<FlatList>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const queryForTab = useCallback(async (tab: ProfileTab, page: number): Promise<FeedPost[]> => {
    if (!userId) return [];
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    const base = supabase.from('posts')
      .select('id, image_url, image_urls, caption, likes_count, comments_count, video_url, ai_generated, created_at, post_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    let res: any;
    switch (tab) {
      case 'todos':
        res = await base;
        return (res.data ?? []) as FeedPost[];
      case 'posts':
        res = await base.in('post_type', ['post', 'photo', 'reel']).is('video_url', null);
        return (res.data ?? []) as FeedPost[];
      case 'reels':
        res = await base.eq('post_type', 'reel');
        return (res.data ?? []) as FeedPost[];
      case 'fotos':
        res = await base.not('image_url', 'is', null).is('video_url', null);
        return (res.data ?? []) as FeedPost[];
      case 'videos':
        res = await supabase.from('posts')
          .select('id, image_url, caption, likes_count, comments_count, video_url, created_at, post_type')
          .eq('user_id', userId)
          .not('video_url', 'is', null)
          .order('created_at', { ascending: false })
          .range(from, to);
        return (res.data ?? []) as FeedPost[];
      case 'ia':
        res = await base.eq('ai_generated', true);
        return (res.data ?? []) as FeedPost[];
      case 'eventos':
        return [];
      case 'curtidos':
        res = await supabase.from('likes')
          .select('posts!inner(id, image_url, caption, likes_count, comments_count, video_url, created_at, post_type, status, is_deleted, profiles(id, username, avatar_url, is_verified))')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return ((res.data ?? []) as any[])
          .map((l: any) => {
            const p = Array.isArray(l.posts) ? l.posts[0] : l.posts;
            if (!p || p.status !== 'published' || p.is_deleted) return null;
            return { ...p, profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles };
          }).filter(Boolean) as FeedPost[];
      case 'salvos':
        res = await supabase.from('saved_posts')
          .select('posts!inner(id, image_url, caption, likes_count, comments_count, video_url, created_at, post_type, status, is_deleted, profiles(id, username, avatar_url, is_verified))')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return ((res.data ?? []) as any[])
          .map((s: any) => {
            const p = Array.isArray(s.posts) ? s.posts[0] : s.posts;
            if (!p || p.status !== 'published' || p.is_deleted) return null;
            return { ...p, profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles };
          }).filter(Boolean) as FeedPost[];
      default:
        return [];
    }
  }, [userId]);

  const loadTab = useCallback(async (tab: ProfileTab, reset = false) => {
    setTabStates((prev) => {
      const cur = prev[tab];
      if (!reset && (cur.loading || cur.loaded)) return prev;
      return { ...prev, [tab]: { ...cur, loading: true } };
    });
    try {
      const data = await queryForTab(tab, 0);
      setTabStates((prev) => ({
        ...prev,
        [tab]: { data, page: 0, hasMore: data.length === PAGE_SIZE, loaded: true, loading: false },
      }));
    } catch {
      setTabStates((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: false, loaded: true } }));
    }
  }, [queryForTab]);

  const loadMore = useCallback(async (tab: ProfileTab) => {
    const cur = tabStates[tab];
    if (cur.loading || !cur.hasMore) return;
    setTabStates((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
    try {
      const nextPage = cur.page + 1;
      const more = await queryForTab(tab, nextPage);
      setTabStates((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], data: [...prev[tab].data, ...more], page: nextPage, hasMore: more.length === PAGE_SIZE, loading: false },
      }));
    } catch {
      setTabStates((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
    }
  }, [tabStates, queryForTab]);

  const loadProfile = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const [profRes, statsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('posts')
          .select('post_type, video_url, image_url, likes_count, ai_generated')
          .eq('user_id', userId),
      ]);
      setProfile(profRes.data as Profile ?? null);
      const allPosts = (statsRes.data ?? []) as any[];
      setStats({
        postsCount:        allPosts.length,
        reelsCount:        allPosts.filter((p) => p.post_type === 'reel').length,
        photosCount:       allPosts.filter((p) => p.image_url && !p.video_url && p.post_type !== 'reel').length,
        videosCount:       allPosts.filter((p) => !!p.video_url).length,
        totalLikes:        allPosts.reduce((s: number, p: any) => s + (p.likes_count ?? 0), 0),
        profileViews:      0,
      });
    } catch { /* silencia */ }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      await loadProfile();
      await loadTab('todos', true);
      setLoading(false);
    })();
  }, [loadProfile, loadTab]));

  // Re-load when userId becomes available (session late-hydration)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      await loadProfile();
      await loadTab('todos', true);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Realtime — actualizar contadores e tab activa quando surgir novo post
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profile-posts:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'posts',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const p = payload.new as any;
        if (p.status !== 'published' || p.is_deleted) return;
        // Actualizar contadores sem re-query completa
        setStats((prev) => ({
          ...prev,
          postsCount:  prev.postsCount + 1,
          reelsCount:  p.post_type === 'reel'                        ? prev.reelsCount + 1  : prev.reelsCount,
          photosCount: (p.image_url && !p.video_url && p.post_type !== 'reel') ? prev.photosCount + 1 : prev.photosCount,
          videosCount: p.video_url                                   ? prev.videosCount + 1 : prev.videosCount,
        }));
        // Injectar no topo da tab activa
        const newPost: FeedPost = {
          id: p.id, image_url: p.image_url, image_urls: p.image_urls,
          caption: p.caption, likes_count: 0, comments_count: 0,
          video_url: p.video_url, ai_generated: p.ai_generated,
          created_at: p.created_at, post_type: p.post_type,
        };
        setTabStates((prev) => {
          const updated: typeof prev = {} as typeof prev;
          (Object.keys(prev) as ProfileTab[]).forEach((tab) => {
            const cur = prev[tab];
            if (!cur.loaded) { updated[tab] = cur; return; }
            // Verificar se o novo post deve aparecer na tab
            const fits =
              tab === 'todos' ||
              (tab === 'posts'        && !p.video_url && p.post_type !== 'reel') ||
              (tab === 'reels'        && p.post_type === 'reel') ||
              (tab === 'fotos'        && p.image_url && !p.video_url) ||
              (tab === 'videos'       && !!p.video_url) ||
              (tab === 'ia'           && p.ai_generated);
            updated[tab] = fits
              ? { ...cur, data: [newPost, ...cur.data] }
              : cur;
          });
          return updated;
        });
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'posts',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const deletedId = (payload.old as any).id;
        setStats((prev) => ({ ...prev, postsCount: Math.max(0, prev.postsCount - 1) }));
        setTabStates((prev) => {
          const updated: typeof prev = {} as typeof prev;
          (Object.keys(prev) as ProfileTab[]).forEach((tab) => {
            updated[tab] = { ...prev[tab], data: prev[tab].data.filter((p) => p.id !== deletedId) };
          });
          return updated;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleTabChange = useCallback((tab: ProfileTab) => {
    if (tab === activeTab) return;
    Animated.sequence([
      Animated.timing(tabAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(tabAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setActiveTab(tab);
    loadTab(tab);
    setTimeout(() => flatRef.current?.scrollToOffset({ offset: 0, animated: false }), 50);
  }, [activeTab, tabAnim, loadTab]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    await loadTab(activeTab, true);
    setRefreshing(false);
  }, [loadProfile, loadTab, activeTab]);

  const handleSaveProfile = useCallback(async (updates: Partial<Profile>) => {
    await supabase.from('profiles').update(updates).eq('id', userId);
    setProfile((p) => p ? { ...p, ...updates } : p);
    setEditVisible(false);
  }, [userId]);

  const pickAndUpload = useCallback(async (type: 'avatar' | 'cover') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9], quality: 0.85,
    });
    if (result.canceled) return;
    type === 'avatar' ? setSavingAvatar(true) : setSavingCover(true);
    try {
      let uri = result.assets[0].uri;
      if (process.env.EXPO_OS !== 'web') {
        const c = await manipulateAsync(uri, [{ resize: { width: type === 'avatar' ? 400 : 1200 } }],
          { compress: 0.8, format: SaveFormat.JPEG });
        uri = c.uri;
      }
      const buf = await (await fetch(uri)).arrayBuffer();
      const path = `${type === 'avatar' ? 'avatars' : 'covers'}/${userId}_${Date.now()}.jpg`;
      await supabase.storage.from('ziva_images').upload(path, buf, { contentType: 'image/jpeg', upsert: true });
      const { data: u } = supabase.storage.from('ziva_images').getPublicUrl(path);
      const field = type === 'avatar' ? 'avatar_url' : 'cover_url';
      await supabase.from('profiles').update({ [field]: u.publicUrl }).eq('id', userId);
      setProfile((p) => p ? { ...p, [field]: u.publicUrl } : p);
    } catch { /* silencia */ }
    type === 'avatar' ? setSavingAvatar(false) : setSavingCover(false);
  }, [userId]);

  // ── Stats grid ────────────────────────────────────────────────────────────
  const statsGrid = useMemo(() => [
    { label: 'Posts',        value: stats.postsCount,              icon: Sparkles },
    { label: 'Reels',        value: stats.reelsCount,              icon: Film     },
    { label: 'Fotos',        value: stats.photosCount,             icon: Camera   },
    { label: 'Vídeos',       value: stats.videosCount,             icon: Play     },
    { label: 'Seguidores',   value: profile?.followers_count ?? 0, icon: Star     },
    { label: 'Seguindo',     value: profile?.following_count ?? 0, icon: Globe    },
    { label: 'Curtidas',     value: stats.totalLikes,              icon: Heart    },
    { label: 'Perfil Views', value: stats.profileViews,            icon: Eye      },
  ], [stats, profile]);

  // ── FlatList data ─────────────────────────────────────────────────────────
  const curTab = tabStates[activeTab];
  const isGrid = GRID_TABS.includes(activeTab);
  const gridRows = useMemo(() => {
    if (!isGrid) return [];
    const rows: FeedPost[][] = [];
    for (let i = 0; i < curTab.data.length; i += 3) rows.push(curTab.data.slice(i, i + 3));
    return rows;
  }, [isGrid, curTab.data]);
  const flatData: (FeedPost | FeedPost[])[] = isGrid ? gridRows : curTab.data;

  // ── Stable renderHeader — NO editing state in deps ────────────────────────
  const renderHeader = useCallback(() => (
    <View style={{ backgroundColor: colors.bg }}>
      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>
            {profile?.username ?? 'Perfil'}
          </Text>
          {profile?.is_verified && <VerifiedBadge size={17} />}
        </View>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Pressable onPress={() => Share.share({ title: 'Perfil Ziva', message: `@${profile?.username} no Ziva` })}
            style={{ padding: 4 }}>
            <ShareIcon size={21} color={colors.muted} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={() => router.push('/(app)/settings' as any)} style={{ padding: 4 }}>
            <Settings size={21} color={colors.muted} strokeWidth={1.8} />
          </Pressable>
        </View>
      </View>

      {/* Cover */}
      <Pressable onPress={() => pickAndUpload('cover')}>
        <View style={{ width: '100%', height: 200, backgroundColor: colors.input }}>
          {profile?.cover_url
            ? <Image source={{ uri: profile.cover_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24,
                  backgroundColor: 'rgba(123,63,242,0.15)', alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)' }}>
                  <Camera size={22} color={colors.purple} />
                </View>
                <Text style={{ color: colors.placeholder, fontSize: 12 }}>Adicionar foto de capa</Text>
              </View>}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
            backgroundColor: isDark ? 'rgba(9,9,11,0.55)' : 'rgba(0,0,0,0.15)' }} />
          {savingCover
            ? <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.overlay,
                alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.purple} size="large" />
              </View>
            : <View style={{ position: 'absolute', bottom: 10, right: 12,
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14,
                paddingHorizontal: 10, paddingVertical: 5,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                <Camera size={12} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Editar capa</Text>
              </View>}
        </View>
      </Pressable>

      {/* Avatar + buttons */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end',
          justifyContent: 'space-between', marginTop: -50 }}>
          <Pressable onPress={() => pickAndUpload('avatar')} style={{ position: 'relative' }}>
            <View style={{ borderRadius: 54, padding: 3,
              borderWidth: 3, borderColor: colors.bg, backgroundColor: colors.bg,
              shadowColor: colors.purple, shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.5, shadowRadius: 18, elevation: 12 }}>
              <Image source={profile?.avatar_url ? { uri: profile.avatar_url } : undefined}
                style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.input }}
                contentFit="cover"
                placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }} />
            </View>
            <View style={{ position: 'absolute', inset: -2, borderRadius: 58,
              borderWidth: 2, borderColor: colors.purple, opacity: 0.65 }} />
            <View style={{ position: 'absolute', bottom: 4, right: 4, width: 30, height: 30,
              borderRadius: 15, backgroundColor: colors.purple, alignItems: 'center',
              justifyContent: 'center', borderWidth: 2.5, borderColor: colors.bg }}>
              {savingAvatar
                ? <ActivityIndicator size="small" color="#fff" />
                : <Camera size={13} color="#fff" strokeWidth={2.5} />}
            </View>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 6 }}>
            <Pressable onPress={() => setEditVisible(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: colors.input, borderRadius: 20,
                paddingHorizontal: 16, paddingVertical: 9,
                borderWidth: 1, borderColor: colors.inputBorder }}>
              <Pencil size={14} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Editar</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(app)/creator-studio' as any)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: colors.purple, borderRadius: 20,
                paddingHorizontal: 16, paddingVertical: 9,
                shadowColor: colors.purple, shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.45, shadowRadius: 10, elevation: 5 }}>
              <BarChart size={14} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Painel</Text>
            </Pressable>
            <Pressable onPress={() => supabase.auth.signOut()}
              style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center',
                justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.1)',
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)' }}>
              <LogOut size={15} color={colors.danger} />
            </Pressable>
          </View>
        </View>

        {/* Name + bio (read-only — edit is in Modal) */}
        <View style={{ marginTop: 14, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>
              {profile?.full_name || profile?.username}
            </Text>
            {profile?.is_verified && <VerifiedBadge size={18} />}
          </View>
          <Text style={{ fontSize: 14, color: colors.muted, fontWeight: '500' }}>
            @{profile?.username}
          </Text>
          {profile?.mood_status ? (
            <View style={{ alignSelf: 'flex-start', marginTop: 4,
              backgroundColor: 'rgba(123,63,242,0.1)', borderRadius: 20,
              paddingHorizontal: 12, paddingVertical: 5,
              borderWidth: 1, borderColor: 'rgba(123,63,242,0.18)' }}>
              <Text style={{ fontSize: 12, color: '#A78BFA', fontWeight: '600' }}>
                ✨ {profile.mood_status}
              </Text>
            </View>
          ) : null}
          {profile?.bio ? (
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 21, marginTop: 6 }}>
              {profile.bio}
            </Text>
          ) : null}
          <View style={{ marginTop: 8, gap: 5 }}>
            {profile?.location && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={13} color={colors.muted} />
                <Text style={{ fontSize: 13, color: colors.muted }}>{profile.location}</Text>
              </View>
            )}
            {profile?.website && (
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => Linking.openURL(profile.website!.startsWith('http') ? profile.website! : `https://${profile.website}`)}>
                <Link size={13} color={colors.purple} />
                <Text style={{ fontSize: 13, color: colors.purple, fontWeight: '600' }} numberOfLines={1}>
                  {profile.website}
                </Text>
              </Pressable>
            )}
            {profile?.birth_date && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Cake size={13} color={colors.muted} />
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  {new Date(profile.birth_date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                </Text>
              </View>
            )}
            {profile?.created_at && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Globe size={13} color={colors.muted} />
                <Text style={{ fontSize: 13, color: colors.muted }}>{joinedDate(profile.created_at)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={{ marginTop: 20, marginHorizontal: 12, marginBottom: 4 }}>
        <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder,
          paddingVertical: 16, paddingHorizontal: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 0 }}>
            {statsGrid.map((s, i) => {
              const Icon = s.icon;
              const isFollowersStat  = s.label === 'Seguidores';
              const isFollowingStat  = s.label === 'Seguindo';
              const tappable = isFollowersStat || isFollowingStat;
              return (
                <TouchableOpacity
                  key={s.label}
                  activeOpacity={tappable ? 0.65 : 1}
                  onPress={tappable ? () => openFollowModal(isFollowersStat ? 'followers' : 'following') : undefined}
                  style={{ alignItems: 'center', minWidth: 72, paddingHorizontal: 8,
                    borderRightWidth: i < statsGrid.length - 1 ? 0.5 : 0,
                    borderRightColor: colors.cardBorder }}>
                  <Icon size={16} color={tappable ? colors.purple : colors.purple} strokeWidth={2} />
                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text,
                    marginTop: 4, letterSpacing: -0.5 }}>
                    {formatCount(s.value)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={{ fontSize: 10, color: tappable ? colors.purple : colors.muted, textAlign: 'center', lineHeight: 13, fontWeight: tappable ? '700' : '400' }}>
                      {s.label}
                    </Text>
                    {tappable && <ChevronRight size={9} color={colors.purple} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Tab bar */}
      <View style={{ marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 4 }}>
          {PROFILE_TABS.map((tab) => {
            const active = activeTab === tab.key;
            const Icon   = tab.icon;
            return (
              <Pressable key={tab.key} onPress={() => handleTabChange(tab.key)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 2,
                  borderRadius: 20,
                  backgroundColor: active
                    ? (isDark ? 'rgba(123,63,242,0.18)' : 'rgba(123,63,242,0.1)')
                    : 'transparent',
                  borderWidth: active ? 1 : 0,
                  borderColor: active ? 'rgba(123,63,242,0.35)' : 'transparent' }}>
                <Icon size={14} color={active ? colors.purple : colors.muted}
                  strokeWidth={active ? 2.2 : 1.6} />
                <Text style={{ fontSize: 13, fontWeight: active ? '800' : '500',
                  color: active ? colors.purple : colors.muted }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [profile, statsGrid, activeTab, savingAvatar, savingCover, colors, isDark]);

  // ── Skeletons / empty ─────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <View style={{ gap: 12, paddingTop: 12 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ marginHorizontal: 12, borderRadius: 20, overflow: 'hidden',
          backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
          <View style={{ height: 160, backgroundColor: colors.input }} />
          <View style={{ padding: 12, gap: 8 }}>
            <View style={{ width: '60%', height: 12, borderRadius: 6, backgroundColor: colors.input }} />
            <View style={{ width: '40%', height: 10, borderRadius: 5, backgroundColor: colors.border }} />
          </View>
        </View>
      ))}
    </View>
  );

  const emojis: Record<ProfileTab, string> = {
    todos: '📸', posts: '✍️', reels: '🎬', fotos: '🖼️', videos: '🎥',
    ia: '🤖', eventos: '📅', curtidos: '❤️', salvos: '🔖',
  };
  const msgs: Record<ProfileTab, string> = {
    todos: 'Ainda não fizeste publicações', posts: 'Sem posts ainda',
    reels: 'Sem reels ainda', fotos: 'Sem fotos ainda', videos: 'Sem vídeos ainda',
    ia: 'Sem conteúdo IA ainda',
    eventos: 'Sem eventos ainda', curtidos: 'Ainda não curtiste nada', salvos: 'Nada guardado ainda',
  };
  const renderEmpty = () => (
    <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32, gap: 12 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40,
        backgroundColor: 'rgba(123,63,242,0.1)', alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(123,63,242,0.18)' }}>
        <Text style={{ fontSize: 36 }}>{emojis[activeTab]}</Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
        {msgs[activeTab]}
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 }}>
        O teu conteúdo irá aparecer aqui
      </Text>
    </View>
  );

  // ── Render item ───────────────────────────────────────────────────────────
  type ListItem = FeedPost | FeedPost[];
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (Array.isArray(item)) return <GridRow items={item} colors={colors} router={router} />;
    return <ProfilePostCard item={item} colors={colors} isDark={isDark} router={router} />;
  }, [colors, isDark, router]);

  if (loading) return <ProfileSkeleton />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />

      {/* Edit modal — lives OUTSIDE FlatList, keyboard never dismissed by FlatList re-renders */}
      <EditProfileModal
        visible={editVisible}
        profile={profile}
        colors={colors}
        onClose={() => setEditVisible(false)}
        onSave={handleSaveProfile}
      />

      <Animated.View style={{ flex: 1, opacity: tabAnim }}>
        <FlatList<ListItem>
          ref={flatRef}
          data={flatData}
          keyExtractor={(item, i) => Array.isArray(item) ? `row-${i}` : item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={curTab.loading ? renderSkeleton : renderEmpty}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: colors.bg }}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={() => !isGrid && loadMore(activeTab)}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            curTab.loading && curTab.loaded
              ? <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.purple} size="small" />
                </View>
              : null
          }
          removeClippedSubviews
          maxToRenderPerBatch={8}
          windowSize={7}
          initialNumToRender={5}
        />
      </Animated.View>

      {/* ── Modal: lista de seguidores / seguindo ────────────────────────── */}
      <Modal
        visible={!!followModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFollowModal(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          {/* Cabeçalho do modal */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
              {followModal === 'followers' ? 'Seguidores' : 'A seguir'}
            </Text>
            <Pressable onPress={() => setFollowModal(null)} style={{ padding: 4 }}>
              <XIcon size={22} color={colors.muted} />
            </Pressable>
          </View>

          {followListLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.purple} size="large" />
            </View>
          ) : followList.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Text style={{ fontSize: 44 }}>👥</Text>
              <Text style={{ color: colors.muted, fontSize: 15 }}>
                {followModal === 'followers' ? 'Nenhum seguidor ainda' : 'Não está a seguir ninguém'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={followList}
              keyExtractor={(item) => item.id}
              contentInsetAdjustmentBehavior="automatic"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setFollowModal(null); router.push(`/(app)/user/${item.id}` as any); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingHorizontal: 20, paddingVertical: 12,
                    borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder }}
                >
                  <Image
                    source={item.avatar_url ? { uri: item.avatar_url } : undefined}
                    style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.input }}
                    contentFit="cover"
                    placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>
                      {item.username}
                    </Text>
                    {item.full_name ? (
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{item.full_name}</Text>
                    ) : null}
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
