import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, Dimensions, ActivityIndicator, Modal,
  TextInput, KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { X, Eye, Heart, Send } from 'lucide-react-native';
import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { VerifiedBadge } from '@/components/VerifiedBadge';

const { width: W, height: H } = Dimensions.get('window');
const STORY_DURATION = 5000; // ms por story de imagem

interface Story {
  story_id: string;
  story_user_id: string;
  media_url: string;
  media_type: string;
  text_overlay?: string;
  text_color?: string;
  expires_at: string;
  created_at: string;
  duration: number;
  username: string;
  full_name: string;
  avatar_url: string;
  is_verified: boolean;
  viewed: boolean;
}

/** Barra de progresso de um story */
function ProgressBar({ active, completed, duration }: { active: boolean; completed: boolean; duration: number }) {
  const progress = useSharedValue(completed ? 1 : 0);

  useEffect(() => {
    if (active) {
      progress.value = 0;
      progress.value = withTiming(1, { duration });
    } else if (completed) {
      progress.value = 1;
    } else {
      progress.value = 0;
    }
  }, [active, completed, duration]);

  const style = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
  }));

  return (
    <View style={{ flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', backgroundColor: '#fff', borderRadius: 2 }, style]} />
    </View>
  );
}

function VideoStory({ url, playing }: { url: string; playing: boolean }) {
  if (process.env.EXPO_OS === 'web') {
    // Web: usa elemento <video> nativo para evitar crash do useVideoPlayer
    return (
      <View style={{ width: W, height: H, backgroundColor: '#000' }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={url}
          autoPlay={playing}
          loop={false}
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </View>
    );
  }
  return <NativeVideoStory url={url} playing={playing} />;
}

function NativeVideoStory({ url, playing }: { url: string; playing: boolean }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = false;
  });
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing]);
  return (
    <View style={{ width: W, height: H }}>
      <VideoView style={{ flex: 1 }} player={player} nativeControls={false} contentFit="cover" />
    </View>
  );
}

export default function StoryViewer() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const myId = session?.user?.id ?? '';

  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = stories[currentIndex];

  // Carregar stories deste utilizador
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .rpc('get_stories_feed', { viewer_id: myId });
      let userStories = (data ?? []).filter((s: Story) => s.story_user_id === userId);

      // Fallback: se a RPC não devolver stories do próprio utilizador, query directa
      if (userStories.length === 0) {
        const { data: direct } = await supabase
          .from('stories')
          .select('id, user_id, media_url, media_type, text_overlay, text_color, expires_at, created_at, duration, profiles(username, full_name, avatar_url, is_verified)')
          .eq('user_id', userId)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });
        userStories = (direct ?? []).map((s: any) => ({
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

      setStories(userStories as Story[]);
      setLoading(false);
    })();
  }, [userId, myId]);

  // Auto-avançar
  useEffect(() => {
    if (!current || paused || showReply) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const dur = current.media_type === 'video'
      ? (current.duration ?? 10) * 1000
      : STORY_DURATION;
    timerRef.current = setTimeout(() => {
      advance();
    }, dur);
    // Registar visualização
    supabase.rpc('view_story', { p_story_id: current.story_id });
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentIndex, current, paused, showReply]);

  // Carregar contagem de visualizações (só para as minhas stories)
  useEffect(() => {
    if (!current || current.story_user_id !== myId) return;
    (async () => {
      const { count } = await supabase
        .from('story_views').select('*', { count: 'exact', head: true })
        .eq('story_id', current.story_id);
      setViewerCount(count ?? 0);
    })();
  }, [currentIndex, current, myId]);

  const advance = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev + 1 >= stories.length) {
        router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/home' as any);
        return prev;
      }
      return prev + 1;
    });
  }, [stories.length, router]);

  const goBack = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !current) return;
    // Iniciar conversa e enviar mensagem
    const { data: convId } = await supabase.rpc('get_or_create_conversation', {
      other_user_id: current.story_user_id,
    });
    if (convId) {
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: myId,
        content: `💬 Sobre o teu story: ${replyText.trim()}`,
        message_type: 'text',
      });
    }
    setReplyText('');
    setShowReply(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#7B3FF2" />
      </View>
    );
  }

  if (!current) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" backgroundColor="#000" />

      {/* Conteúdo */}
      {current.media_type === 'video' ? (
        <VideoStory url={current.media_url} playing={!paused && !showReply} />
      ) : (
        <Image
          source={{ uri: current.media_url }}
          style={{ width: W, height: H }}
          contentFit="cover"
        />
      )}

      {/* Overlay escurecimento topo/baixo */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 180,
        backgroundColor: 'transparent',
      }}>
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.35)',
        }} />
      </View>

      {/* Barras de progresso */}
      <View style={{
        position: 'absolute', top: insets.top + 8, left: 12, right: 12,
        flexDirection: 'row', gap: 4,
      }}>
        {stories.map((_, i) => (
          <ProgressBar
            key={i}
            active={i === currentIndex}
            completed={i < currentIndex}
            duration={
              current.media_type === 'video'
                ? (current.duration ?? 10) * 1000
                : STORY_DURATION
            }
          />
        ))}
      </View>

      {/* Header */}
      <View style={{
        position: 'absolute',
        top: insets.top + 20,
        left: 12, right: 12,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <Image
          source={current.avatar_url ? { uri: current.avatar_url } : undefined}
          style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#7B3FF2' }}
          contentFit="cover"
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{current.username}</Text>
            {current.is_verified && <VerifiedBadge size={12} />}
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
            {new Date(current.created_at).toLocaleTimeString('pt', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {/* Visualizações (só para minhas stories) */}
        {current.story_user_id === myId && viewerCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Eye size={14} color="rgba(255,255,255,0.7)" />
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{viewerCount}</Text>
          </View>
        )}
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/home' as any)}
          style={{ padding: 4 }}
        >
          <X size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Text overlay */}
      {current.text_overlay ? (
        <View style={{
          position: 'absolute', bottom: 180, left: 16, right: 16,
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12,
            paddingHorizontal: 14, paddingVertical: 8,
          }}>
            <Text style={{
              color: current.text_color ?? '#fff',
              fontSize: 18, fontWeight: '700', textAlign: 'center', lineHeight: 24,
            }}>
              {current.text_overlay}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Controlos de toque: esquerda/direita */}
      <Pressable
        onPress={goBack}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        style={{ position: 'absolute', top: 100, left: 0, width: W * 0.35, bottom: 140 }}
      />
      <Pressable
        onPress={advance}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        style={{ position: 'absolute', top: 100, right: 0, width: W * 0.65, bottom: 140 }}
      />

      {/* Barra inferior: responder / reagir */}
      {current.story_user_id !== myId && (
        <View style={{
          position: 'absolute', bottom: insets.bottom + 12, left: 12, right: 12,
          flexDirection: 'row', alignItems: 'center', gap: 10,
        }}>
          <Pressable
            onPress={() => setShowReply(true)}
            style={{
              flex: 1, borderRadius: 24, borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.4)',
              paddingHorizontal: 16, paddingVertical: 10,
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Responder...</Text>
          </Pressable>
          <Pressable
            style={{
              width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
            }}
            onPress={() => {/* like story */ }}
          >
            <Heart size={20} color="#fff" />
          </Pressable>
          <Pressable
            style={{
              width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
            }}
            onPress={() => setShowReply(true)}
          >
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      )}

      {/* Modal de resposta */}
      <Modal visible={showReply} transparent animationType="slide"
        onRequestClose={() => setShowReply(false)}>
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <View style={{
            backgroundColor: '#111115', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 20, paddingBottom: insets.bottom + 12, gap: 14,
            borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <Text style={{ color: '#F9FAFB', fontWeight: '700', fontSize: 15 }}>
              Responder ao story de {current.username}
            </Text>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Escreve uma resposta..."
              placeholderTextColor="#4B5563"
              style={{
                backgroundColor: '#1E1E24', borderRadius: 16, paddingHorizontal: 16,
                paddingVertical: 12, color: '#F9FAFB', fontSize: 15,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', minHeight: 50,
              }}
              autoFocus
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setShowReply(false)}
                style={{ flex: 1, borderRadius: 14, padding: 14, alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <Text style={{ color: '#9CA3AF', fontWeight: '600' }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSendReply}
                disabled={!replyText.trim()}
                style={{ flex: 1, borderRadius: 14, padding: 14, alignItems: 'center',
                  backgroundColor: replyText.trim() ? '#7B3FF2' : '#1F1F23' }}
              >
                <Text style={{ color: replyText.trim() ? '#fff' : '#4B5563', fontWeight: '700' }}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
