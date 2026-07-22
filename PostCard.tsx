import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions, Modal } from 'react-native';
import { Image } from 'expo-image';
// expo-video: stubbed on web by devkit — import é seguro; hook isolado em NativeVideoBlock
import { useVideoPlayer, VideoView } from 'expo-video';
import { MessageCircle, Share, Bookmark, BookmarkCheck, MoreHorizontal, Flag, Trash, Eye, Users, Play, Pause, Volume, VolumeX, Maximize } from 'lucide-react-native';
import { useRouter, type RelativePathString } from 'expo-router';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { supabase } from '@/client/supabase';
import {
  QuickReaction, ReactionPicker, type ReactionType, getReactionEmoji,
} from './ReactionPicker';
import { ReportModal } from './ReportModal';
import { VerifiedBadge } from './VerifiedBadge';
import { useZivaTheme } from '@/lib/theme-context';

const SCREEN_W = Dimensions.get('window').width;

export interface Post {
  id: string;
  user_id: string;
  caption: string;
  image_url: string;
  image_urls?: string[];
  video_url?: string;
  post_type?: string;
  views_count?: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
    is_verified?: boolean;
  };
  liked?: boolean;
  my_reaction?: ReactionType | null;
  saved?: boolean;
  top_reactions?: { type: string; count: number }[];
  community_id?: string | null;
  community_name?: string | null;
  is_resurging?: boolean;
}

interface PostCardProps {
  post: Post;
  currentUserId: string;
  onLikeToggle: (postId: string, liked: boolean, reaction?: ReactionType) => void;
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/** Native-only: hook sempre no topo do componente, nunca montado no web */
function NativeVideoBlock({ videoUrl, thumbnailUrl, onOpenFullscreen }: {
  videoUrl: string;
  thumbnailUrl?: string;
  onOpenFullscreen: () => void;
}) {
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false); // true quando o vídeo está carregado

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => { player.muted = muted; }, [muted, player]);

  // Detecta quando o vídeo está pronto para reprodução
  useEffect(() => {
    const sub = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay') setReady(true);
    });
    return () => sub.remove();
  }, [player]);

  return (
    <View style={{ width: SCREEN_W - 24, aspectRatio: 16 / 9, backgroundColor: '#111', overflow: 'hidden' }}>
      {/* Miniatura visível enquanto o vídeo não está pronto ou está pausado */}
      {(thumbnailUrl || !ready) && paused && (
        <Image
          source={{ uri: thumbnailUrl ?? '' }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="cover"
          transition={200}
        />
      )}

      {/* Vídeo real — só renderiza quando ready para evitar flash preto */}
      {ready && (
        <VideoView style={{ flex: 1 }} player={player} nativeControls={false} contentFit="cover" />
      )}

      {/* Overlay: tap para pausar/reproduzir */}
      <Pressable
        onPress={() => {
          if (paused) { player.play(); setPaused(false); }
          else { player.pause(); setPaused(true); }
        }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {paused && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.65)',
              alignItems: 'center', justifyContent: 'center' }}>
              <Play size={26} color="#fff" fill="#fff" />
            </View>
          </View>
        )}
      </Pressable>

      {/* Botão de mudo */}
      <Pressable
        onPress={() => setMuted((m) => !m)}
        style={{ position: 'absolute', bottom: 8, left: 10, width: 32, height: 32, borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
      >
        {muted ? <VolumeX size={15} color="#fff" /> : <Volume size={15} color="#fff" />}
      </Pressable>

      {/* Botão ecrã completo */}
      <Pressable
        onPress={onOpenFullscreen}
        style={{ position: 'absolute', bottom: 8, right: 10, width: 32, height: 32, borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Maximize size={15} color="#fff" />
      </Pressable>
    </View>
  );
}

/** Bloco de vídeo inline — web usa <video> HTML5, native usa NativeVideoBlock.
 *  Isola useVideoPlayer para que o hook nunca seja chamado no web. */
function VideoBlock({ videoUrl, thumbnailUrl, onOpenFullscreen }: {
  videoUrl: string;
  thumbnailUrl?: string;
  onOpenFullscreen: () => void;
}) {
  if (process.env.EXPO_OS === 'web') {
    return (
      <View style={{ width: SCREEN_W - 24, aspectRatio: 16 / 9, backgroundColor: '#111', position: 'relative', overflow: 'hidden' }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={videoUrl} loop playsInline controls
          poster={thumbnailUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </View>
    );
  }
  return <NativeVideoBlock videoUrl={videoUrl} thumbnailUrl={thumbnailUrl} onOpenFullscreen={onOpenFullscreen} />;
}

/** Skeleton para PostCard */
export function PostCardSkeleton() {
  const { colors } = useZivaTheme();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 20, marginHorizontal: 12, marginBottom: 12, overflow: 'hidden',
      borderWidth: 1, borderColor: colors.cardBorder }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.input }} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ width: 120, height: 11, borderRadius: 6, backgroundColor: colors.input }} />
          <View style={{ width: 80, height: 9, borderRadius: 5, backgroundColor: colors.border }} />
        </View>
      </View>
      <View style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.input }} />
      <View style={{ padding: 14, gap: 8 }}>
        <View style={{ width: 100, height: 11, borderRadius: 6, backgroundColor: colors.input }} />
        <View style={{ width: '70%', height: 9, borderRadius: 5, backgroundColor: colors.border }} />
      </View>
    </View>
  );
}

export function PostCard({ post, currentUserId, onLikeToggle }: PostCardProps) {
  const router = useRouter();
  const { colors } = useZivaTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [saved, setSaved] = useState(post.saved ?? false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [showOwnMenu, setShowOwnMenu] = useState(false);
  const [deleted, setDeleted] = useState(false);

  // Vídeo inline no feed — renderizado via VideoBlock (hook isolado lá)
  const isVideo = !!post.video_url;

  // animação de curtida
  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

  const handleDeletePost = async () => {
    setShowOwnMenu(false);
    await supabase.from('posts').delete().eq('id', post.id).eq('user_id', currentUserId);
    setDeleted(true);
  };

  if (deleted) return null;

  const images: string[] = (() => {
    if (post.image_urls && post.image_urls.length > 0) return post.image_urls;
    if (post.image_url) return [post.image_url];
    return [];
  })();
  const hasMultiple = images.length > 1;

  const handleQuickReact = async () => {
    const wasReacted = !!post.my_reaction;
    heartScale.value = withSequence(withSpring(1.4), withSpring(1));
    onLikeToggle(post.id, !wasReacted, 'love');
    if (wasReacted) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
    } else {
      await supabase.from('likes').upsert({ post_id: post.id, user_id: currentUserId, reaction_type: 'love' });
    }
  };

  const handlePickReaction = async (type: ReactionType) => {
    onLikeToggle(post.id, true, type);
    await supabase.from('likes').upsert({ post_id: post.id, user_id: currentUserId, reaction_type: type });
  };

  const handleSave = async () => {
    const nowSaved = !saved;
    setSaved(nowSaved);
    if (!nowSaved) {
      await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', currentUserId);
    } else {
      await supabase.from('saved_posts').insert({ post_id: post.id, user_id: currentUserId });
    }
  };

  const goToProfile = () => {
    if (post.profiles.id === currentUserId) router.push('/(app)/(tabs)/profile');
    else router.push(`/(app)/user/${post.profiles.id}` as any);
  };

  const goToPost = () => router.push(`/(app)/post/${post.id}` as any);
  const topReactions = post.top_reactions?.slice(0, 3) ?? [];

  return (
    <Animated.View entering={FadeIn.duration(300)}
      style={{
        backgroundColor: colors.card,
        borderRadius: 20,
        marginHorizontal: 12, marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1, borderColor: colors.cardBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
      }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
        <Pressable onPress={goToProfile} className="active:opacity-70">
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            borderWidth: 2, borderColor: colors.purple,
            padding: 2,
          }}>
            <Image
              source={post.profiles.avatar_url ? { uri: post.profiles.avatar_url } : undefined}
              style={{ width: '100%', height: '100%', borderRadius: 18 }}
              contentFit="cover"
              placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
            />
          </View>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={goToProfile} className="active:opacity-70">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontWeight: '800', color: colors.text, fontSize: 14 }}>{post.profiles.username}</Text>
            {post.profiles.is_verified && <VerifiedBadge size={14} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            {post.community_name ? (
              <Pressable
                onPress={() => router.push(`/(app)/communities/${post.community_id}` as any)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 3,
                  backgroundColor: 'rgba(123,63,242,0.18)',
                  borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                  borderWidth: 1, borderColor: 'rgba(123,63,242,0.35)',
                }}
                className="active:opacity-70"
              >
                <Users size={10} color="#A78BFA" strokeWidth={2} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#A78BFA' }} numberOfLines={1}>
                  {post.community_name}
                </Text>
              </Pressable>
            ) : null}
            <Text style={{ color: colors.muted, fontSize: 11 }}>{timeAgo(post.created_at)}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => post.user_id !== currentUserId ? setShowReport(true) : setShowOwnMenu(true)}
          style={{ padding: 6 }}
          className="active:opacity-70"
        >
          {post.user_id !== currentUserId
            ? <Flag size={17} color={colors.muted} strokeWidth={1.6} />
            : <MoreHorizontal size={19} color={colors.muted} strokeWidth={1.6} />}
        </Pressable>
      </View>

      {/* Modal de opções próprias */}
      <Modal visible={showOwnMenu} transparent animationType="fade" onRequestClose={() => setShowOwnMenu(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setShowOwnMenu(false)}>
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: colors.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingBottom: 32,
            borderTopWidth: 1, borderColor: colors.cardBorder,
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.inputBorder,
              alignSelf: 'center', marginTop: 10, marginBottom: 10 }} />
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 }}
              onPress={() => { setShowOwnMenu(false); goToPost(); }}>
              <Eye size={20} color="#A78BFA" />
              <Text style={{ fontSize: 15, color: colors.text }}>Ver publicação</Text>
            </Pressable>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 }}
              onPress={handleDeletePost}>
              <Trash size={20} color="#EF4444" />
              <Text style={{ fontSize: 15, color: '#EF4444' }}>Eliminar publicação</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <ReportModal visible={showReport} targetType="post" targetId={post.id} onClose={() => setShowReport(false)} />

      {/* Vídeo inline */}
      {/* Vídeo inline — VideoBlock isola o hook useVideoPlayer do web */}
      {isVideo && (
        <VideoBlock
          videoUrl={post.video_url!}
          thumbnailUrl={post.image_url || post.image_urls?.[0]}
          onOpenFullscreen={() => router.push(`/(app)/post/${post.id}` as RelativePathString)}
        />
      )}

      {/* Imagem(s) — só para posts sem vídeo */}
      {!isVideo && images.length > 0 && (
        <Pressable onPress={goToPost} className="active:opacity-97">
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            scrollEnabled={hasMultiple}
            onScroll={(e) => setCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
            scrollEventThrottle={16}>
            {images.map((uri, i) => (
              <Image key={i} source={{ uri }}
                style={{ width: SCREEN_W - 24, aspectRatio: 1, borderRadius: 0 }}
                contentFit="cover"
                placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }} />
            ))}
          </ScrollView>
          {hasMultiple && (
            <View style={{ position: 'absolute', bottom: 10, left: 0, right: 0,
              flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
              {images.map((_, i) => (
                <View key={i} style={{
                  width: i === carouselIndex ? 18 : 6, height: 6, borderRadius: 3,
                  backgroundColor: i === carouselIndex ? colors.purple : 'rgba(255,255,255,0.4)',
                }} />
              ))}
            </View>
          )}
        </Pressable>
      )}

      {/* Ações */}
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <Animated.View style={heartStyle}>
              <QuickReaction
                currentReaction={post.my_reaction ?? null}
                count={post.likes_count}
                onTap={handleQuickReact}
                onLongPress={() => setShowPicker(true)}
              />
            </Animated.View>
            <Pressable onPress={goToPost} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              className="active:opacity-70">
              <MessageCircle size={21} color={colors.muted} strokeWidth={1.6} />
              {post.comments_count > 0 && (
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted }}>{post.comments_count}</Text>
              )}
            </Pressable>
            <Pressable className="active:opacity-70" onPress={() => {}}>
              <Share size={20} color={colors.muted} strokeWidth={1.6} />
            </Pressable>
          </View>
          <Pressable onPress={handleSave} className="active:opacity-70">
            {saved
              ? <BookmarkCheck size={21} color={colors.purple} strokeWidth={2} />
              : <Bookmark size={21} color={colors.muted} strokeWidth={1.6} />}
          </Pressable>
        </View>

        {topReactions.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
            {topReactions.map((r) => (
              <Text key={r.type} style={{ fontSize: 13 }}>{getReactionEmoji(r.type)}</Text>
            ))}
            <Text style={{ fontSize: 12, color: colors.muted, marginLeft: 2 }}>{post.likes_count}</Text>
          </View>
        )}

        {post.caption ? (
          <Pressable onPress={goToPost} style={{ marginTop: 8 }} className="active:opacity-70">
            <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
              <Text style={{ fontWeight: '800', color: colors.text }}>{post.profiles.username} </Text>
              {post.caption}
            </Text>
          </Pressable>
        ) : null}

        {post.comments_count > 0 && (
          <Pressable onPress={goToPost} style={{ marginTop: 4 }} className="active:opacity-70">
            <Text style={{ color: colors.placeholder, fontSize: 12 }}>
              Ver todos os {post.comments_count} comentários
            </Text>
          </Pressable>
        )}
      </View>

      <ReactionPicker visible={showPicker} onSelect={handlePickReaction} onClose={() => setShowPicker(false)} />
    </Animated.View>
  );
}
