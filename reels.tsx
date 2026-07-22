import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  Modal, TextInput, useWindowDimensions, KeyboardAvoidingView,
  ScrollView, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Heart, MessageCircle, Share, Bookmark,
  X, Send, ChevronDown, Search,
  Play, Pause, Volume, VolumeX, Radio, Plus,
  Home, Users, Upload, Film, Inbox, User,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { fetch as expoFetch } from 'expo/fetch';
import { MEDO_BADGE_CLEARANCE } from '@/lib/constants';
import { VerifiedBadge } from '@/components/VerifiedBadge';

/* ─── Upload de vídeo multiplataforma ────────────────────────────────────────
 *  Web  : lê o blob via fetch + arrayBuffer, faz upload pelo Supabase client
 *  Nativo: globalThis.fetch com FormData { uri, name, type } (padrão RN nativo) */
async function uploadVideoFormData(
  uri: string,
  mimeType: string,
  bucket: string,
  storagePath: string,
  accessToken: string,
): Promise<string> {
  if (process.env.EXPO_OS === 'web') {
    const resp = await fetch(uri);
    const buf = await resp.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buf, { contentType: mimeType, upsert: false });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);
  } else {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const mimeToExt: Record<string, string> = {
      'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv',
      'video/webm': 'webm', 'video/3gpp': '3gp',
    };
    const ext = mimeToExt[mimeType] ?? 'mp4';
    const filename = storagePath.split('/').pop() ?? `video.${ext}`;
    const formData = new FormData();
    formData.append('', { uri, name: filename, type: mimeType } as any);
    const endpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`;
    const nativeResp = await globalThis.fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'x-upsert': 'false' },
      body: formData,
    });
    if (!nativeResp.ok) {
      const body = await nativeResp.text();
      throw new Error(`Upload falhou (${nativeResp.status}): ${body}`);
    }
  }
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return urlData.publicUrl;
}

// VideoView — importado estaticamente, activado apenas em native em runtime
import { VideoView as NativeVideoView, useVideoPlayer as useNativeVideoPlayer } from 'expo-video';

/* ─── Tipos ──────────────────────────────────────────────────────────────── */
interface Video {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  shares_count: number;
  created_at: string;
  profiles: { username: string; avatar_url: string; full_name: string; is_verified?: boolean };
  liked?: boolean;
  disliked?: boolean;
  subscribed?: boolean;
}

interface VideoComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string;
  avatar_url: string;
}

/* ─── Utilitários ────────────────────────────────────────────────────────── */
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/* ─── Sub-componente nativo — hooks sempre chamados ao nível de topo ────── */
function NativeVideoPlayer({ video, active, muted, paused }: { video: Video; active: boolean; muted: boolean; paused: boolean }) {
  const { width, height } = useWindowDimensions();
  const [buffering, setBuffering] = useState(true);

  const player = (useNativeVideoPlayer as typeof useNativeVideoPlayer)(video.video_url, (p: any) => {
    p.loop = true;
    p.muted = muted;
    // Não chama play() aqui — aguarda o evento 'readyToPlay' no listener abaixo
  });

  // Sincronizar mudo
  useEffect(() => { if (player) player.muted = muted; }, [muted, player]);

  // Ouvir mudanças de estado: só toca quando o player está pronto
  useEffect(() => {
    if (!player) return;
    const sub = (player as any).addListener?.('statusChange', ({ status }: any) => {
      if (status === 'readyToPlay') {
        setBuffering(false);
        if (active && !paused) player.play();
      } else if (status === 'loading' || status === 'idle') {
        setBuffering(true);
      }
    });
    return () => sub?.remove?.();
  }, [player, active, paused]);

  // Reagir a mudanças de active/paused após o player já estar pronto
  useEffect(() => {
    if (!player) return;
    try {
      if (active && !paused) player.play();
      else player.pause();
    } catch { /* ignora se o player ainda não está pronto */ }
  }, [active, paused, player]);

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {/* Thumbnail visível enquanto o vídeo está a carregar */}
      {(buffering && video.thumbnail_url) ? (
        <Image
          source={{ uri: video.thumbnail_url }}
          style={{ position: 'absolute', width, height }}
          contentFit="cover"
        />
      ) : null}
      <NativeVideoView style={{ flex: 1 }} player={player} contentFit="cover" />
      {/* Indicador de buffering */}
      {buffering && (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.7)" />
        </View>
      )}
    </View>
  );
}

/* ─── Componente de vídeo (native vs web) ───────────────────────────────── */
function ShortVideo({ video, active, muted, paused, onTogglePause }: {
  video: Video; active: boolean; muted: boolean; paused: boolean; onTogglePause: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const webVideoRef = useRef<any>(null);
  const [webPlaying, setWebPlaying] = useState(false);
  const [webBuffering, setWebBuffering] = useState(false);

  // Arrancar play() imperativo quando o elemento <video> montar (evita bloqueio de autoplay do browser)
  useEffect(() => {
    if (process.env.EXPO_OS !== 'web' || !webPlaying || !webVideoRef.current) return;
    const el = webVideoRef.current;
    el.muted = muted;
    const tryPlay = () => {
      el.play().catch(() => {
        // Se falhar sem mudo, tenta com mudo (política de autoplay do browser)
        el.muted = true;
        el.play().catch(() => {});
      });
    };
    if (el.readyState >= 3) tryPlay();
    else el.addEventListener('canplay', tryPlay, { once: true });
    return () => el.removeEventListener('canplay', tryPlay);
  }, [webPlaying, muted]);

  // Sincronizar paused/muted com o elemento <video> em runtime
  useEffect(() => {
    if (process.env.EXPO_OS !== 'web' || !webVideoRef.current || !webPlaying) return;
    webVideoRef.current.muted = muted;
    if (paused) webVideoRef.current.pause();
    else webVideoRef.current.play().catch(() => {});
  }, [paused, muted, webPlaying]);

  if (process.env.EXPO_OS === 'web') {
    return (
      <View style={{ width, height, backgroundColor: '#000' }}>
        {/* Thumbnail sempre visível como fundo */}
        {video.thumbnail_url ? (
          <Image source={{ uri: video.thumbnail_url }} style={{ position: 'absolute', width, height }} contentFit="cover" />
        ) : null}

        {!webPlaying ? (
          /* Ecrã de pré-visualização — toque para iniciar */
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center',
            backgroundColor: video.thumbnail_url ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.75)' }}>
            <Pressable onPress={() => { setWebPlaying(true); setWebBuffering(true); }}
              style={{ width: 76, height: 76, borderRadius: 38,
                backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.5, shadowRadius: 12 }}>
              <Play size={34} color="#000" fill="#000" />
            </Pressable>
          </View>
        ) : (
          /* Vídeo a reproduzir */
          <Pressable onPress={onTogglePause} style={{ position: 'absolute', inset: 0 }}>
            <video
              ref={webVideoRef}
              src={video.video_url}
              loop
              playsInline
              muted={muted}
              onCanPlay={() => setWebBuffering(false)}
              onWaiting={() => setWebBuffering(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
            />
            {webBuffering && (
              <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="rgba(255,255,255,0.7)" />
              </View>
            )}
          </Pressable>
        )}
      </View>
    );
  }

  // Native: sub-componente dedicado para cumprir Rules of Hooks
  return <NativeVideoPlayer video={video} active={active} muted={muted} paused={paused} />;
}

/* ─── Modal de comentários ───────────────────────────────────────────────── */
function CommentsSheet({
  video, visible, onClose, userId,
}: { video: Video; visible: boolean; onClose: () => void; userId: string }) {
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('reel_comments_with_profiles').select('*')
        .eq('reel_id', video.id).order('created_at', { ascending: false }).limit(80);
      setComments((data ?? []) as VideoComment[]);
      setLoading(false);
    })();
  }, [visible, video.id]);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    await supabase.from('reel_comments').insert({ reel_id: video.id, user_id: userId, content: text.trim() });
    setText('');
    setSubmitting(false);
    const { data } = await supabase
      .from('reel_comments_with_profiles').select('*')
      .eq('reel_id', video.id).order('created_at', { ascending: false }).limit(80);
    setComments((data ?? []) as VideoComment[]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        style={{
          backgroundColor: '#1c1c1e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
          maxHeight: '72%',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#2c2c2e' }}>
          <Text style={{ flex: 1, fontWeight: '700', fontSize: 16, color: '#fff' }}>
            {fmtCount(video.comments_count)} comentários
          </Text>
          <Pressable onPress={onClose}><X size={20} color="#9ca3af" /></Pressable>
        </View>

        {loading
          ? <ActivityIndicator color="#ff0000" style={{ margin: 24 }} />
          : (
            <ScrollView style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              {comments.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                  <Text style={{ fontSize: 30 }}>💬</Text>
                  <Text style={{ color: '#9ca3af', marginTop: 8 }}>Sem comentários ainda.</Text>
                </View>
              )}
              {comments.map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  <Image source={c.avatar_url ? { uri: c.avatar_url } : undefined}
                    style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#a3a3a3', fontSize: 12, fontWeight: '600', marginBottom: 3 }}>@{c.username}</Text>
                    <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>{c.content}</Text>
                    <Text style={{ color: '#666', fontSize: 11, marginTop: 4 }}>{timeAgo(c.created_at)}</Text>
                  </View>
                </View>
              ))}
              <View style={{ height: 16 }} />
            </ScrollView>
          )}

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
          borderTopWidth: 1, borderTopColor: '#2c2c2e',
          paddingBottom: Math.max(insets.bottom, 16),
        }}>
          <TextInput
            value={text} onChangeText={setText}
            placeholder="Adiciona um comentário..."
            placeholderTextColor="#666"
            style={{
              flex: 1, backgroundColor: '#2c2c2e', borderRadius: 24,
              paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 14,
            }}
            returnKeyType="send" onSubmitEditing={submit}
          />
          <Pressable onPress={submit} disabled={!text.trim() || submitting}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: text.trim() ? '#ff0000' : '#2c2c2e',
              alignItems: 'center', justifyContent: 'center',
            }}>
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Send size={16} color={text.trim() ? '#fff' : '#555'} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── Item de vídeo (YouTube Shorts style) ──────────────────────────────── */
function VideoItem({
  video, active, muted, onToggleMute, onLike, onDislike, onOpenComments, onOpenShare, onUserPress,
}: {
  video: Video; active: boolean; muted: boolean;
  onToggleMute: () => void;
  onLike: (id: string, liked: boolean) => void;
  onDislike: (id: string, disliked: boolean) => void;
  onOpenComments: (v: Video) => void;
  onOpenShare: (v: Video) => void;
  onUserPress: (uid: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const pauseIconOpacity = useRef(new Animated.Value(0)).current;
  const likeScale = useRef(new Animated.Value(1)).current;

  // Repõe paused=false quando o item deixa de estar activo
  useEffect(() => { if (!active) setPaused(false); }, [active]);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    // Flash do ícone ▶/⏸ no centro do ecrã
    Animated.sequence([
      Animated.timing(pauseIconOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(pauseIconOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const animateLike = () => {
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.35, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }),
    ]).start();
  };

  // Sombra para ícones (simula text-shadow do TikTok)
  const iconShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 6,
  };

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {/* Vídeo — tela cheia + toque para pausar/retomar */}
      <ShortVideo video={video} active={active} muted={muted} paused={paused} onTogglePause={togglePause} />

      {/* Ícone de pausa/play — flash central ao tocar */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
          opacity: pauseIconOpacity,
        }}>
        <View style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {paused
            ? <Play size={32} color="#fff" fill="#fff" />
            : <Pause size={32} color="#fff" fill="#fff" />}
        </View>
      </Animated.View>

      {/* Degradê preto de baixo para cima atrás da legenda */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: height * 0.45,
        // degradê simulado com Views empilhadas
      }} pointerEvents="none">
        <View style={{ flex: 1, backgroundColor: 'transparent' }} />
        <View style={{ height: '60%', backgroundColor: 'rgba(0,0,0,0.55)' }} />
      </View>

      {/* ── AÇÕES DIREITA — estilo TikTok puro ──────────────── */}
      <View style={{
        position: 'absolute',
        right: 12,
        bottom: 120 + MEDO_BADGE_CLEARANCE,
        alignItems: 'center',
        gap: 20,
        zIndex: 999,
      }}>
        {/* Avatar + botão seguir */}
        <Pressable onPress={() => onUserPress(video.user_id)} style={{ alignItems: 'center' }}>
          {/* Círculo com borda colorida (TikTok gradient effect) */}
          <View style={{
            width: 52, height: 52, borderRadius: 26,
            borderWidth: 2, borderColor: '#fff', overflow: 'hidden',
            ...iconShadow,
          }}>
            <Image
              source={video.profiles?.avatar_url ? { uri: video.profiles.avatar_url } : undefined}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          </View>
          {/* Botão + vermelho centrado */}
          <View style={{
            position: 'absolute', bottom: -9,
            width: 22, height: 22, borderRadius: 4,
            backgroundColor: '#fe2c55',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.5, borderColor: '#fff',
          }}>
            <Plus size={13} color="#fff" strokeWidth={3} />
          </View>
        </Pressable>

        {/* Coração — Curtir */}
        <Pressable
          onPress={() => { animateLike(); onLike(video.id, !!video.liked); }}
          style={{ alignItems: 'center', gap: 5 }}
        >
          <Animated.View style={[{ transform: [{ scale: likeScale }] }, iconShadow]}>
            <Heart
              size={36}
              color={video.liked ? '#fe2c55' : '#fff'}
              fill={video.liked ? '#fe2c55' : 'transparent'}
              strokeWidth={1.6}
            />
          </Animated.View>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', ...iconShadow }}>
            {fmtCount(video.likes_count)}
          </Text>
        </Pressable>

        {/* Balão de fala — Comentários */}
        <Pressable onPress={() => onOpenComments(video)} style={{ alignItems: 'center', gap: 5 }}>
          <View style={iconShadow}>
            <MessageCircle size={36} color="#fff" strokeWidth={1.6} />
          </View>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', ...iconShadow }}>
            {fmtCount(video.comments_count)}
          </Text>
        </Pressable>

        {/* Marcador — Guardar */}
        <Pressable onPress={() => onDislike(video.id, !!video.disliked)} style={{ alignItems: 'center', gap: 5 }}>
          <View style={iconShadow}>
            <Bookmark
              size={34}
              color={video.disliked ? '#f5d442' : '#fff'}
              fill={video.disliked ? '#f5d442' : 'transparent'}
              strokeWidth={1.6}
            />
          </View>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', ...iconShadow }}>
            {fmtCount(video.shares_count ?? 0)}
          </Text>
        </Pressable>

        {/* Seta — Compartilhar */}
        <Pressable onPress={() => onOpenShare(video)} style={{ alignItems: 'center', gap: 5 }}>
          <View style={iconShadow}>
            <Share size={34} color="#fff" strokeWidth={1.6} />
          </View>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', ...iconShadow }}>
            {fmtCount(video.shares_count ?? 0)}
          </Text>
        </Pressable>

        {/* Silenciar — botão discreto */}
        <Pressable onPress={onToggleMute} style={iconShadow}>
          {muted
            ? <VolumeX size={26} color="rgba(255,255,255,0.75)" strokeWidth={1.6} />
            : <Volume size={26} color="rgba(255,255,255,0.75)" strokeWidth={1.6} />}
        </Pressable>
      </View>

      {/* ── LEGENDA BAIXO ESQUERDA — estilo TikTok ──────────── */}
      <View style={{
        position: 'absolute',
        bottom: 90 + MEDO_BADGE_CLEARANCE,
        left: 16, right: 80,
        zIndex: 999,
      }}>
        {/* Nome do utilizador */}
        <Pressable onPress={() => onUserPress(video.user_id)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <Text style={{
              color: '#fff', fontWeight: '800', fontSize: 16,
              ...iconShadow,
            }}>
              @{video.profiles?.username}
            </Text>
            {video.profiles?.is_verified && <VerifiedBadge size={15} />}
          </View>
        </Pressable>

        {/* Descrição + hashtags */}
        {video.caption ? (
          <Pressable onPress={() => setExpanded((v) => !v)}>
            <Text
              style={{ color: '#fff', fontSize: 14, lineHeight: 21, ...iconShadow }}
              numberOfLines={expanded ? 0 : 2}
            >
              {/* Destaca hashtags em negrito branco-brilhante */}
              {video.caption.split(' ').map((word, i) =>
                word.startsWith('#') ? (
                  <Text key={i} style={{ fontWeight: '700', color: '#fff' }}>{word} </Text>
                ) : (
                  <Text key={i}>{word} </Text>
                )
              )}
            </Text>
            {!expanded && video.caption.length > 80 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>mais</Text>
                <ChevronDown size={13} color="rgba(255,255,255,0.75)" />
              </View>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ─── Modal de upload de vídeo ───────────────────────────────────────────── */
function UploadReelModal({
  visible, onClose, userId, onUploaded,
}: { visible: boolean; onClose: () => void; userId: string; onUploaded: () => void }) {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState<string>('video/mp4');
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  const reset = () => {
    setVideoUri(null); setThumbnailUri(null);
    setCaption(''); setUploading(false); setProgress(''); setError('');
  };

  const pickVideo = async () => {
    setError('');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Permissão negada. Activa nas definições.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.9,
      videoMaxDuration: 120,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
      setVideoMime(result.assets[0].mimeType ?? 'video/mp4');
      setError('');
    }
  };

  const uploadVideo = async () => {
    if (!videoUri || !userId) return;
    setUploading(true);
    setError('');
    try {
      setProgress('A enviar para o servidor... ⏳');
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token ?? '';
      const mimeToExt: Record<string, string> = {
        'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv',
        'video/webm': 'webm', 'video/3gpp': '3gp',
      };
      const ext = mimeToExt[videoMime] ?? 'mp4';
      const videoPath = `${userId}/${Date.now()}.${ext}`;
      const publicVideoUrl = await uploadVideoFormData(videoUri, videoMime, 'reels_videos', videoPath, token);

      // Thumbnail (opcional — imagem pequena, ArrayBuffer OK)
      let thumbUrl = '';
      if (thumbnailUri) {
        try {
          setProgress('A processar miniatura...');
          const tResp = await expoFetch(thumbnailUri);
          const tBuf = await tResp.arrayBuffer();
          const thumbPath = `thumbnails/${userId}/${Date.now()}.jpg`;
          await supabase.storage.from('ziva_images').upload(thumbPath, tBuf, { contentType: 'image/jpeg' });
          const { data: tu } = supabase.storage.from('ziva_images').getPublicUrl(thumbPath);
          thumbUrl = tu.publicUrl;
        } catch { /* thumbnail é opcional */ }
      }

      setProgress('A publicar reel...');
      // Inserir na tabela reels (ecrã de Reels dedicado)
      const { data: reelRow, error: insertErr } = await supabase.from('reels').insert({
        user_id: userId,
        video_url: publicVideoUrl,
        thumbnail_url: thumbUrl || null,
        caption: caption.trim() || '',
        likes_count: 0,
        comments_count: 0,
        views_count: 0,
        shares_count: 0,
      }).select('id').single();
      if (insertErr) throw new Error(`Erro ao publicar: ${insertErr.message}`);

      // Dual-write: inserir também em posts para aparecer no Feed, Perfil e Pesquisa
      if (reelRow?.id) {
        await supabase.from('posts').insert({
          user_id: userId,
          caption: caption.trim() || '',
          image_url: thumbUrl || '',
          image_urls: thumbUrl ? [thumbUrl] : [],
          video_url: publicVideoUrl,
          post_type: 'reel',
          likes_count: 0,
          comments_count: 0,
        });
      }

      setProgress('');
      reset();
      onUploaded();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Erro ao fazer upload do vídeo.');
      setProgress('');
    }
    setUploading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}
      onRequestClose={() => { if (!uploading) { reset(); onClose(); } }}>
      <View style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
        <StatusBar style="light" backgroundColor="#0f0f0f" />
        {/* Header */}
        <View style={{
          paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 16,
          borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <Pressable onPress={() => { if (!uploading) { reset(); onClose(); } }}
            style={{ width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color="#fff" />
          </Pressable>
          <Text style={{ flex: 1, color: '#fff', fontWeight: '800', fontSize: 18 }}>Publicar Reel</Text>
          <Pressable onPress={uploadVideo} disabled={!videoUri || uploading}
            style={{
              paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20,
              backgroundColor: videoUri && !uploading ? '#7B3FF2' : 'rgba(123,63,242,0.3)',
            }}>
            {uploading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Publicar</Text>}
          </Pressable>
        </View>

        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">

            {/* Área de selecção de vídeo */}
            <Pressable onPress={!uploading ? pickVideo : undefined}
              style={{
                height: 220, borderRadius: 20, overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 2, borderColor: videoUri ? 'rgba(123,63,242,0.5)' : 'rgba(255,255,255,0.1)',
                borderStyle: videoUri ? 'solid' : 'dashed',
                alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
              {videoUri ? (
                thumbnailUri
                  ? <Image source={{ uri: thumbnailUri }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" />
                  : <View style={{ position: 'absolute', inset: 0, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }}>
                      <Film size={64} color="#7B3FF2" />
                    </View>
              ) : null}

              {/* Overlay sempre visível */}
              <View style={{
                position: videoUri ? 'absolute' : 'relative',
                bottom: videoUri ? 0 : undefined,
                left: videoUri ? 0 : undefined,
                right: videoUri ? 0 : undefined,
                padding: 16,
                backgroundColor: videoUri ? 'rgba(0,0,0,0.55)' : 'transparent',
                alignItems: 'center', gap: 8,
              }}>
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: videoUri ? 'rgba(123,63,242,0.8)' : 'rgba(123,63,242,0.2)',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: videoUri ? '#7B3FF2' : 'rgba(123,63,242,0.4)',
                }}>
                  <Upload size={24} color="#fff" />
                </View>
                <Text style={{ color: videoUri ? '#fff' : '#9CA3AF', fontWeight: '700', fontSize: 15, textAlign: 'center' }}>
                  {videoUri ? 'Vídeo seleccionado — toca para trocar' : 'Seleccionar vídeo da galeria'}
                </Text>
                {!videoUri && (
                  <Text style={{ color: '#4B5563', fontSize: 12, textAlign: 'center' }}>
                    MP4, MOV ou WebM · Máx. 500 MB · Até 2 minutos
                  </Text>
                )}
              </View>
            </Pressable>

            {/* Progresso */}
            {progress ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: 'rgba(123,63,242,0.1)', borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: 'rgba(123,63,242,0.2)' }}>
                <ActivityIndicator size="small" color="#7B3FF2" />
                <Text style={{ color: '#A78BFA', fontWeight: '600', fontSize: 13 }}>{progress}</Text>
              </View>
            ) : null}

            {/* Erro */}
            {error ? (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}>
                <Text style={{ color: '#F87171', fontSize: 13 }}>{error}</Text>
              </View>
            ) : null}

            {/* Legenda */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 }}>
                Legenda (opcional)
              </Text>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Descreve o teu vídeo, adiciona #hashtags..."
                placeholderTextColor="#4B5563"
                multiline
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 16, padding: 14, color: '#F9FAFB',
                  fontSize: 15, minHeight: 100, textAlignVertical: 'top',
                }}
                editable={!uploading}
              />
            </View>

            {/* Dicas */}
            <View style={{ backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 14, padding: 14, gap: 6,
              borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)' }}>
              <Text style={{ color: '#60A5FA', fontWeight: '700', fontSize: 13 }}>💡 Dicas para mais visualizações</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12, lineHeight: 18 }}>
                • Usa o formato vertical (9:16){'\n'}
                • Os primeiros 3 segundos são decisivos{'\n'}
                • Adiciona hashtags relevantes na legenda{'\n'}
                • Publica entre as 18h–21h para maior alcance
              </Text>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
function ShareSheet({
  video, visible, onClose, userId,
}: { video: Video; visible: boolean; onClose: () => void; userId: string }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentConvos, setSentConvos] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    setSentConvos(new Set());
    (async () => {
      const { data } = await supabase.from('conversations')
        .select('id, participant_one, participant_two')
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
        .order('last_message_at', { ascending: false }).limit(20);
      if (!data) { setLoading(false); return; }
      const otherIds = data.map((c) => c.participant_one === userId ? c.participant_two : c.participant_one);
      const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', otherIds);
      const pm = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      setConversations(data.map((c) => ({
        id: c.id,
        other: pm[c.participant_one === userId ? c.participant_two : c.participant_one] ?? { id: '', username: '?', avatar_url: '' },
      })));
      setLoading(false);
    })();
  }, [visible, userId]);

  const send = async (convId: string) => {
    await supabase.from('messages').insert({ conversation_id: convId, sender_id: userId, content: `🎬 ${video.caption || 'Vídeo Ziva'}\n${video.video_url}` });
    setSentConvos((p) => new Set([...p, convId]));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={onClose} />
      <View style={{
        backgroundColor: '#1c1c1e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingBottom: Math.max(insets.bottom, 20), maxHeight: '60%',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#2c2c2e' }}>
          <Text style={{ flex: 1, color: '#fff', fontWeight: '700', fontSize: 16 }}>Enviar por Chat</Text>
          <Pressable onPress={onClose}><X size={20} color="#9ca3af" /></Pressable>
        </View>
        <ScrollView style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {loading && <ActivityIndicator color="#ff0000" style={{ marginVertical: 16 }} />}
          {!loading && conversations.length === 0 && (
            <Text style={{ color: '#666', paddingVertical: 16, textAlign: 'center' }}>Sem conversas ainda.</Text>
          )}
          {conversations.map((conv) => {
            const sent = sentConvos.has(conv.id);
            return (
              <View key={conv.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2c2c2e' }}>
                <Image source={conv.other.avatar_url ? { uri: conv.other.avatar_url } : undefined}
                  style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
                <Text style={{ flex: 1, color: '#fff', fontWeight: '600' }}>@{conv.other.username}</Text>
                <Pressable onPress={() => !sent && send(conv.id)} disabled={sent}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: sent ? '#333' : '#ff0000' }}>
                  <Text style={{ color: sent ? '#888' : '#fff', fontWeight: '700', fontSize: 13 }}>
                    {sent ? 'Enviado ✓' : 'Enviar'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─── Ecrã principal ─────────────────────────────────────────────────────── */
export default function ShortsScreen() {
  const { session } = useSession();
  const router = useRouter();
  const userId = session?.user?.id ?? '';
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [commentsVideo, setCommentsVideo] = useState<Video | null>(null);
  const [shareVideo, setShareVideo] = useState<Video | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const viewedRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [videosRes, likesRes] = await Promise.all([
      supabase.from('reels')
        .select('id, user_id, video_url, thumbnail_url, caption, likes_count, comments_count, views_count, shares_count, created_at, profiles(username, avatar_url, full_name, is_verified)')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase.from('reel_likes').select('reel_id').eq('user_id', userId),
    ]);
    const likedIds = new Set((likesRes.data ?? []).map((l) => l.reel_id));
    // Filtrar URLs malformadas — só aceitar URLs que apontem para ficheiros de vídeo válidos
    const validVideoExts = /\.(mp4|mov|webm|3gp|mkv|m4v)(\?|$)/i;
    const isValidUrl = (url: string) => url && url.startsWith('http') && validVideoExts.test(url);
    setVideos(((videosRes.data ?? []) as any[])
      .filter((r) => isValidUrl(r.video_url))
      .map((r) => ({
        ...r,
        profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
        liked: likedIds.has(r.id),
        // thumbnail_url vazio string → null para evitar Image source vazia
        thumbnail_url: r.thumbnail_url || null,
      })) as Video[]);
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    load();
    return () => { setScreenFocused(false); };
  }, [load]));

  // Contabilizar visualização ao focar
  useEffect(() => {
    const v = videos[activeIndex];
    if (!v || viewedRef.current.has(v.id)) return;
    viewedRef.current.add(v.id);
    supabase.rpc('increment_reel_views', { reel_id_arg: v.id }).then(() => {});
  }, [activeIndex, videos]);

  const handleLike = async (videoId: string, liked: boolean) => {
    setVideos((prev) => prev.map((v) =>
      v.id === videoId ? { ...v, liked: !liked, likes_count: liked ? v.likes_count - 1 : v.likes_count + 1 } : v
    ));
    if (liked) await supabase.from('reel_likes').delete().eq('reel_id', videoId).eq('user_id', userId);
    else await supabase.from('reel_likes').insert({ reel_id: videoId, user_id: userId });
  };

  const handleDislike = (videoId: string, disliked: boolean) => {
    setVideos((prev) => prev.map((v) =>
      v.id === videoId ? { ...v, disliked: !disliked, liked: !disliked ? false : v.liked } : v
    ));
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  // viewabilityConfig também deve ser estável (ref), nunca inline
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 60 });

  /* ── Loading ── */
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f0f', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" backgroundColor="#0f0f0f" />
        <ActivityIndicator size="large" color="#ff0000" />
      </View>
    );
  }

  /* ── Vazio ── */
  if (videos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f0f', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 }}>
        <StatusBar style="light" backgroundColor="#0f0f0f" />
        <Text style={{ fontSize: 52 }}>🎬</Text>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' }}>Sem vídeos ainda</Text>
        <Text style={{ color: '#666', textAlign: 'center', lineHeight: 22 }}>
          Sê o primeiro a publicar um vídeo curto na Ziva!
        </Text>
        <Pressable onPress={() => setShowUpload(true)} style={{
          marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: '#7B3FF2', borderRadius: 20,
          paddingHorizontal: 24, paddingVertical: 12,
        }}>
          <Upload size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Publicar primeiro vídeo</Text>
        </Pressable>
        <UploadReelModal visible={showUpload} onClose={() => setShowUpload(false)}
          userId={userId} onUploaded={load} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" backgroundColor="transparent" translucent />

      {/* Feed vertical — ocupa tela toda */}
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={process.env.EXPO_OS === 'web' ? undefined : onViewableItemsChanged}
        viewabilityConfig={process.env.EXPO_OS === 'web' ? undefined : viewabilityConfigRef.current}
        renderItem={({ item, index }) => (
          <VideoItem
            video={item}
            active={index === activeIndex && screenFocused}
            muted={muted}
            onToggleMute={() => setMuted((v) => !v)}
            onLike={handleLike}
            onDislike={handleDislike}
            onOpenComments={setCommentsVideo}
            onOpenShare={setShareVideo}
            onUserPress={(uid) => router.push(`/(app)/user/${uid}` as any)}
          />
        )}
        getItemLayout={(_data, index) => ({ length: height, offset: height * index, index })}
      />

      {/* ── HEADER TIKTOK — transparente, fixo no topo ─────── */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        paddingTop: insets.top + 6, paddingBottom: 10, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'transparent',
      }}>
        {/* Esquerda: LIVE */}
        <Pressable
          onPress={() => router.push('/(app)/live' as any)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
        >
          <Radio size={18} color="#fff" strokeWidth={2} />
          <Text style={{
            color: '#fff', fontWeight: '800', fontSize: 15,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.8, shadowRadius: 3,
          }}>
            LIVE
          </Text>
        </Pressable>

        {/* Centro: título fixo */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{
            color: '#fff', fontWeight: '800', fontSize: 17,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.9, shadowRadius: 3,
          }}>
            Para Ti
          </Text>
        </View>

        {/* Direita: pesquisa */}
        <Pressable onPress={() => router.push('/(app)/(tabs)/search' as any)}>
          <Search size={22} color="#fff" strokeWidth={2}
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.9, shadowRadius: 3 } as any} />
        </Pressable>
      </View>

      {commentsVideo && (
        <CommentsSheet video={commentsVideo} visible={!!commentsVideo}
          onClose={() => setCommentsVideo(null)} userId={userId} />
      )}
      {shareVideo && (
        <ShareSheet video={shareVideo} visible={!!shareVideo}
          onClose={() => setShareVideo(null)} userId={userId} />
      )}
      <UploadReelModal visible={showUpload} onClose={() => setShowUpload(false)}
        userId={userId} onUploaded={load} />
    </View>
  );
}

