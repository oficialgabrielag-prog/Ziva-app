/**
 * Painel de Administração do Ziva
 * Acessível apenas para a conta officialantoniogabriel@gmail.com (is_admin = true)
 */
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, FlatList,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  ArrowLeft, Users, FileText, Heart, MessageCircle,
  Film, Search, CheckCircle, Circle, RefreshCw,
  TrendingUp, UserCheck, Calendar, Shield,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { useZivaTheme } from '@/lib/theme-context';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface AdminStats {
  total_users: number;
  active_today: number;
  total_posts: number;
  total_reels: number;
  total_comments: number;
  total_likes: number;
  total_communities: number;
  new_users_week: number;
  new_posts_today: number;
}

interface AdminUser {
  id: string;
  username: string;
  full_name: string;
  email: string;
  avatar_url: string;
  created_at: string;
  followers_count: number;
  posts_count: number;
  is_verified: boolean;
  is_admin: boolean;
  last_seen_at: string | null;
}

// ── Componente de estatística ─────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number | string; color: string;
}) {
  const { colors } = useZivaTheme();
  return (
    <View style={{
      flex: 1, minWidth: 140, backgroundColor: colors.card,
      borderRadius: 16, padding: 14, gap: 8,
      borderWidth: 1, borderColor: colors.cardBorder,
    }}>
      <View style={{ width: 36, height: 36, borderRadius: 12,
        backgroundColor: `${color}20`, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>
        {typeof value === 'number' ? value.toLocaleString('pt') : value}
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// ── Linha de utilizador ───────────────────────────────────────────────────────
function UserRow({ user, onToggleVerified, colors }: {
  user: AdminUser;
  onToggleVerified: (id: string, current: boolean) => void;
  colors: ReturnType<typeof useZivaTheme>['colors'];
}) {
  const joined = new Date(user.created_at).toLocaleDateString('pt', { day: '2-digit', month: 'short', year: '2-digit' });
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder,
      backgroundColor: colors.card,
    }}>
      {/* Avatar */}
      {user.avatar_url
        ? <Image source={{ uri: user.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
        : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.input,
            alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 18 }}>👤</Text>
          </View>}
      {/* Info */}
      <View style={{ flex: 1, gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={1}>
            {user.full_name || user.username}
          </Text>
          {user.is_verified && <Text style={{ fontSize: 12 }}>✓</Text>}
          {user.is_admin && (
            <View style={{ backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: '#F59E0B' }}>ADMIN</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>@{user.username} · {user.email}</Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>
          {user.posts_count} posts · {user.followers_count} seguidores · entrou {joined}
        </Text>
      </View>
      {/* Toggle verificado */}
      <Pressable
        onPress={() => onToggleVerified(user.id, user.is_verified)}
        style={{ padding: 6, borderRadius: 10, backgroundColor: user.is_verified ? 'rgba(123,63,242,0.12)' : colors.input }}>
        {user.is_verified
          ? <CheckCircle size={20} color="#7B3FF2" />
          : <Circle size={20} color={colors.muted} />}
      </Pressable>
    </View>
  );
}

// ── Ecrã principal ────────────────────────────────────────────────────────────
export default function AdminScreen() {
  const { session } = useSession();
  const router = useRouter();
  const { colors } = useZivaTheme();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id ?? '';

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Verificar se é admin e carregar dados
  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        // Verificar is_admin
        const { data: prof } = await supabase
          .from('profiles').select('is_admin').eq('id', userId).single();
        if (!prof?.is_admin) { setIsAdmin(false); setLoading(false); return; }
        setIsAdmin(true);

        // Carregar estatísticas via RPC segura
        const { data: statsData } = await supabase.rpc('get_admin_stats');
        if (statsData?.[0]) setStats(statsData[0] as AdminStats);

        // Carregar utilizadores
        await loadUsers('');
        setLoading(false);
      })();
    }, [userId])
  );

  const loadUsers = async (q: string) => {
    setUsersLoading(true);
    const { data } = await supabase.rpc('get_all_users', {
      p_limit: 50, p_offset: 0, p_search: q,
    });
    setUsers((data ?? []) as AdminUser[]);
    setUsersLoading(false);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    loadUsers(q);
  };

  const handleToggleVerified = async (targetId: string, current: boolean) => {
    const { data } = await supabase.rpc('admin_toggle_verified', { target_user_id: targetId });
    if (data !== null) {
      setUsers((prev) => prev.map((u) => u.id === targetId ? { ...u, is_verified: data as boolean } : u));
    }
  };

  const PURPLE = colors.purple;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />
        <ActivityIndicator size="large" color={PURPLE} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />
        <Text style={{ fontSize: 52, marginBottom: 16 }}>🚫</Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }}>Acesso Negado</Text>
        <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 8 }}>
          Esta área é reservada para administradores do Ziva.
        </Text>
        <Pressable onPress={() => router.back()}
          style={{ marginTop: 24, backgroundColor: PURPLE, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />

      {/* ── Cabeçalho ── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12,
        borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder,
        backgroundColor: colors.bg,
      }}>
        <Pressable onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.input }}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Painel Admin</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>Ziva Omega · Administração</Text>
        </View>
        <View style={{ backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#F59E0B' }}>👑 ADMIN</Text>
        </View>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <UserRow user={item} onToggleVerified={handleToggleVerified} colors={colors} />
        )}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={() => (
          <View style={{ backgroundColor: colors.bg }}>
            {/* ── Estatísticas ── */}
            {stats && (
              <View style={{ padding: 16, gap: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Estatísticas Globais
                </Text>
                {/* Linha 1 */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatCard icon={<Users size={18} color="#7B3FF2" />} label="Total de Utilizadores"
                    value={stats.total_users} color="#7B3FF2" />
                  <StatCard icon={<TrendingUp size={18} color="#10B981" />} label="Ativos Hoje"
                    value={stats.active_today} color="#10B981" />
                </View>
                {/* Linha 2 */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatCard icon={<FileText size={18} color="#3B82F6" />} label="Publicações"
                    value={stats.total_posts} color="#3B82F6" />
                  <StatCard icon={<Film size={18} color="#EF4444" />} label="Reels"
                    value={stats.total_reels} color="#EF4444" />
                </View>
                {/* Linha 3 */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatCard icon={<Heart size={18} color="#EC4899" />} label="Curtidas"
                    value={stats.total_likes} color="#EC4899" />
                  <StatCard icon={<MessageCircle size={18} color="#F59E0B" />} label="Comentários"
                    value={stats.total_comments} color="#F59E0B" />
                </View>
                {/* Linha 4 */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatCard icon={<UserCheck size={18} color="#6366F1" />} label="Novos (7 dias)"
                    value={stats.new_users_week} color="#6366F1" />
                  <StatCard icon={<Calendar size={18} color="#0EA5E9" />} label="Posts Hoje"
                    value={stats.new_posts_today} color="#0EA5E9" />
                </View>
              </View>
            )}

            {/* ── Gestão de Utilizadores ── */}
            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Utilizadores ({users.length})
                </Text>
                <Pressable onPress={() => loadUsers(search)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.input,
                    alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={14} color={colors.muted} />
                </Pressable>
              </View>
              {/* Search */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: colors.input, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
                borderWidth: 1, borderColor: colors.inputBorder }}>
                <Search size={16} color={colors.muted} />
                <TextInput
                  value={search}
                  onChangeText={handleSearch}
                  placeholder="Pesquisar por nome, username ou email…"
                  placeholderTextColor={colors.placeholder}
                  style={{ flex: 1, fontSize: 14, color: colors.text }}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                Toca em ✓ para verificar / des-verificar uma conta
              </Text>
            </View>

            {usersLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <ActivityIndicator color={PURPLE} />
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          !usersLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 48, gap: 8 }}>
              <Text style={{ fontSize: 36 }}>🔍</Text>
              <Text style={{ color: colors.muted, fontSize: 14 }}>Nenhum utilizador encontrado</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      />
    </View>
  );
}
