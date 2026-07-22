import { useState } from 'react';
import {
  View, Text, Pressable, TextInput,
  ScrollView, KeyboardAvoidingView, ActivityIndicator, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { fetch } from 'expo/fetch';
import { useRouter } from 'expo-router';
import {
  ImagePlus, X, Camera, PlusCircle, CircleCheck, Sparkles,
  Film, Video, BookOpen, ArrowLeft,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { MentionInput, resolveMentions } from '@/components/MentionInput';
import { useZivaTheme } from '@/lib/theme-context';

/* ─── Upload de vídeo multiplataforma ────────────────────────────────────────
 *  Web  : lê o blob via expoFetch + arrayBuffer, faz upload pelo Supabase client
 *  Nativo: globalThis.fetch com FormData { uri, name, type } (padrão RN nativo) */
async function uploadVideoFormData(
  uri: string,
  mimeType: string,
  bucket: string,
  storagePath: string,
  accessToken: string,
): Promise<string> {
  if (process.env.EXPO_OS === 'web') {
    // Web: expo-image-picker devolve blob: URI — lemos como ArrayBuffer
    const resp = await fetch(uri);
    const buf = await resp.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buf, { contentType: mimeType, upsert: false });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);
  } else {
    // Nativo (iOS/Android): globalThis.fetch converte { uri, name, type } para multipart
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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// ── Assistente de IA para legendas e hashtags ─────────────────────────────────
async function getAiSuggestions(currentCaption: string, hasImages: boolean, userId: string): Promise<{ caption: string; hashtags: string }> {
  const prompt = `És o assistente de publicação da Ziva, rede social angolana.
O utilizador quer publicar ${hasImages ? 'com imagem(ns)' : 'um texto'} na rede social.
Legenda actual: "${currentCaption || '(sem legenda)'}"

Sugere:
1. Uma legenda melhorada, cativante, em português de Angola (máx 150 caracteres)
2. 5-8 hashtags relevantes e populares (em português ou inglês, sem espaços)

Responde APENAS neste formato JSON (sem mais nada):
{"caption":"legenda aqui","hashtags":"#tag1 #tag2 #tag3"}`;

  const { data: settingsData } = await supabase
    .from('user_settings').select('gemini_api_key').eq('user_id', userId).maybeSingle();
  const userGeminiKey = settingsData?.gemini_api_key ?? '';

  const { data, error } = await supabase.functions.invoke('large-language-model', {
    body: {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(userGeminiKey ? { user_gemini_key: userGeminiKey } : {}),
    },
  });
  if (error) throw error;

  let raw = '';
  if (data instanceof Response) {
    raw = await data.text();
  } else if (typeof data === 'string') {
    raw = data;
  } else {
    raw = JSON.stringify(data ?? '');
  }

  let fullText = '';
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const d = line.slice(5).trim();
    if (!d || d === '[DONE]') continue;
    try { const f = JSON.parse(d); fullText += f?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''; } catch { /* skip */ }
  }
  if (!fullText) fullText = raw;

  const match = fullText.match(/\{[\s\S]*?\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fallthrough */ }
  }
  return { caption: currentCaption || fullText.slice(0, 150), hashtags: '' };
}

interface PickedImage { uri: string; uploaded?: string; }

type CreateTab = 'publicacao' | 'reel' | 'story';

// ── Separador de abas ─────────────────────────────────────────────────────────
function CreateTabBar({ active, onChange }: { active: CreateTab; onChange: (t: CreateTab) => void }) {
  const { colors } = useZivaTheme();
  return (
    <View style={{
      flexDirection: 'row', borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      backgroundColor: colors.bg,
    }}>
      {([
        { key: 'publicacao', label: 'Publicação', Icon: ImagePlus },
        { key: 'reel', label: 'Reel', Icon: Film },
        { key: 'story', label: 'Story', Icon: BookOpen },
      ] as { key: CreateTab; label: string; Icon: any }[]).map(({ key, label, Icon }) => {
        const on = active === key;
        return (
          <Pressable key={key} onPress={() => onChange(key)} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 }}>
            <Icon size={18} color={on ? colors.purple : colors.muted} strokeWidth={on ? 2.2 : 1.6} />
            <Text style={{ fontSize: 12, fontWeight: on ? '700' : '500', color: on ? colors.purple : colors.muted }}>{label}</Text>
            {on && <View style={{ position: 'absolute', bottom: 0, left: 24, right: 24, height: 2, borderRadius: 2, backgroundColor: colors.purple }} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Aba: Publicação (fotos/texto) ─────────────────────────────────────────────
function PostTab() {
  const { session } = useSession();
  const router = useRouter();
  const { colors } = useZivaTheme();
  const [caption, setCaption] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [video, setVideo] = useState<{ uri: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const pickImages = async (source: 'gallery' | 'camera') => {
    setError('');
    if (source === 'gallery') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { setPermissionDenied(true); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 0.9, selectionLimit: 10,
      });
      if (!result.canceled) {
        const vids = result.assets.filter((a) => a.type === 'video');
        const imgs = result.assets.filter((a) => a.type !== 'video');
        if (vids.length > 0) { setVideo({ uri: vids[0].uri, mimeType: vids[0].mimeType ?? 'video/mp4' }); setImages([]); }
        else setImages((prev) => [...prev, ...imgs.slice(0, 10 - prev.length).map((a) => ({ uri: a.uri }))]);
      }
    } else {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { setPermissionDenied(true); return; }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
      if (!result.canceled && images.length < 10) setImages((prev) => [...prev, { uri: result.assets[0].uri }]);
    }
  };

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  const uploadImage = async (uri: string, userId: string): Promise<string> => {
    let uploadUri = uri;
    if (process.env.EXPO_OS !== 'web') {
      const compressed = await manipulateAsync(uri, [{ resize: { width: 1080 } }], { compress: 0.7, format: SaveFormat.JPEG });
      uploadUri = compressed.uri;
    }
    const response = await fetch(uploadUri);
    if (!response.ok) throw new Error('Não foi possível ler a imagem.');
    const arrayBuffer = await response.arrayBuffer();
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const { error: uploadError } = await supabase.storage.from('ziva_images').upload(path, arrayBuffer, { contentType: 'image/jpeg' });
    if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);
    const { data: urlData } = supabase.storage.from('ziva_images').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const uploadVideo = async (uri: string, mimeType: string, userId: string): Promise<string> => {
    const { data: { session: sess } } = await supabase.auth.getSession();
    const token = sess?.access_token ?? '';
    const mimeToExt: Record<string, string> = {
      'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv',
      'video/webm': 'webm', 'video/3gpp': '3gp',
    };
    const ext = mimeToExt[mimeType] ?? 'mp4';
    const path = `posts/${userId}/${Date.now()}.${ext}`;
    return uploadVideoFormData(uri, mimeType, 'reels_videos', path, token);
  };

  const handleAiSuggest = async () => {
    setAiLoading(true); setAiError('');
    try {
      const s = await getAiSuggestions(caption, images.length > 0 || !!video, session?.user?.id ?? '');
      setCaption(s.hashtags ? `${s.caption}\n\n${s.hashtags}` : s.caption);
    } catch { setAiError('Não foi possível obter sugestões. Tenta novamente.'); }
    setAiLoading(false);
  };

  const handlePost = async () => {
    if (!caption.trim() && images.length === 0 && !video) { setError('Adiciona uma legenda, imagem ou vídeo para publicar'); return; }
    setLoading(true); setError('');
    const userId = session?.user?.id;
    if (!userId) { setError('Sessão expirada. Fecha a app e volta a entrar.'); setLoading(false); return; }
    try {
      let videoUrl: string | undefined;
      const uploadedUrls: string[] = [];
      if (video) {
        videoUrl = await uploadVideo(video.uri, video.mimeType, userId);
      } else {
        for (const img of images) uploadedUrls.push(await uploadImage(img.uri, userId));
      }
      const mentionedIds = await resolveMentions(caption);
      const { data: postData, error: postError } = await supabase.from('posts').insert({
        user_id: userId, caption: caption.trim(),
        image_url: uploadedUrls[0] ?? '',
        image_urls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        video_url: videoUrl ?? undefined,
        post_type: videoUrl ? 'video' : 'post',
        status: 'published',
        is_deleted: false,
      }).select('id').single();
      if (postError || !postData) throw new Error(postError?.message ?? 'Erro ao publicar');
      if (mentionedIds.length > 0) {
        await supabase.from('mentions').insert(mentionedIds.map((mid) => ({ post_id: postData.id, mentioned_user_id: mid, mentioner_id: userId })));
        await supabase.from('notifications').insert(mentionedIds.map((mid) => ({ user_id: mid, type: 'mention', actor_id: userId, post_id: postData.id })));
      }
      setCaption(''); setImages([]); setVideo(null);
      router.navigate('/(app)/(tabs)/home' as any);
    } catch (e: any) { setError(e.message ?? 'Erro ao publicar. Tenta novamente.'); }
    setLoading(false);
  };

  const canPost = caption.trim().length > 0 || images.length > 0 || !!video;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}
      keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
      {/* Acções topo */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable
          style={{
            paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20,
            backgroundColor: canPost ? colors.purple : colors.input,
            opacity: loading ? 0.6 : 1,
          }}
          onPress={handlePost} disabled={loading || !canPost}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> :
            <Text style={{ color: canPost ? '#fff' : colors.muted, fontWeight: '700', fontSize: 14 }}>Publicar</Text>}
        </Pressable>
      </View>

      {/* Preview de vídeo selecionado */}
      {video && (
        <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(123,63,242,0.2)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(123,63,242,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Film size={22} color={colors.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{video.uri.split('/').pop()}</Text>
              <Text style={{ color: colors.success, fontSize: 11 }}>✓ Vídeo selecionado para o feed</Text>
            </View>
            <Pressable onPress={() => setVideo(null)} style={{ padding: 6 }}>
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Grelha de imagens */}
      {!video && images.length > 0 && (
        <View>
          <FlatList data={images} horizontal showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)} contentContainerStyle={{ gap: 8 }}
            renderItem={({ item, index }) => (
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: item.uri }} style={{ width: 140, height: 140, borderRadius: 12 }} contentFit="cover" />
                <Pressable style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => removeImage(index)}>
                  <X size={13} color="#fff" />
                </Pressable>
                {index === 0 && (
                  <View style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(123,63,242,0.9)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Principal</Text>
                  </View>
                )}
              </View>
            )}
            ListFooterComponent={images.length < 10 ? (
              <Pressable style={{ width: 140, height: 140, borderRadius: 12, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.inputBorder }}
                onPress={() => pickImages('gallery')}>
                <PlusCircle size={28} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>Adicionar</Text>
              </Pressable>
            ) : null}
          />
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{images.length}/10 imagens</Text>
        </View>
      )}

      {/* Botões de selecção de media */}
      {!video && images.length === 0 && (
        <View style={{ gap: 10 }}>
          <Pressable style={{ backgroundColor: colors.input, borderRadius: 20, height: 160, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.inputBorder }}
            onPress={() => pickImages('gallery')}>
            <ImagePlus size={36} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8, fontWeight: '500' }}>Foto, vídeo (MP4/MOV/MKV/WebM)</Text>
          </Pressable>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(123,63,242,0.1)', borderRadius: 16, paddingVertical: 12, gap: 8, borderWidth: 1, borderColor: 'rgba(123,63,242,0.25)' }}
            onPress={() => pickImages('camera')}>
            <Camera size={18} color="#A78BFA" />
            <Text style={{ color: '#A78BFA', fontWeight: '600', fontSize: 14 }}>Tirar foto</Text>
          </Pressable>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Legenda</Text>
          <Pressable onPress={handleAiSuggest} disabled={aiLoading}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(123,63,242,0.12)', borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
            {aiLoading ? <ActivityIndicator size={12} color="#A78BFA" /> : <Sparkles size={13} color="#A78BFA" />}
            <Text style={{ color: '#A78BFA', fontSize: 12, fontWeight: '600' }}>IA sugere</Text>
          </Pressable>
        </View>
        {aiError ? <Text style={{ color: colors.danger, fontSize: 12 }}>{aiError}</Text> : null}
        <MentionInput value={caption} onChangeText={setCaption}
          placeholder="O que estás a pensar? Use @nome para mencionar"
          multiline maxLength={500} textAlignVertical="top"
          style={{ backgroundColor: colors.input, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, color: colors.text, minHeight: 100, fontSize: 15, borderWidth: 1, borderColor: colors.inputBorder }} />
        <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'right' }}>{caption.length}/500</Text>
      </View>

      {permissionDenied && <Text style={{ color: colors.danger, fontSize: 13, textAlign: 'center' }}>Permissão negada. Ativa nas definições do dispositivo.</Text>}
      {error ? <Text style={{ color: colors.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text> : null}
      {!video && images.length > 1 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(123,63,242,0.1)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(123,63,242,0.2)' }}>
          <CircleCheck size={15} color="#A78BFA" />
          <Text style={{ color: '#A78BFA', fontSize: 12, flex: 1 }}>Publicação com {images.length} imagens — carrossel no feed.</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Aba: Reel (vídeo) ─────────────────────────────────────────────────────────
function ReelTab() {
  const { session } = useSession();
  const router = useRouter();
  const { colors } = useZivaTheme();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState<string>('video/mp4');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const userId = session?.user?.id ?? '';

  const pickVideo = async () => {
    setError('');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Permissão de galeria negada.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'], quality: 0.9, videoMaxDuration: 120, allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
      setVideoMime(result.assets[0].mimeType ?? 'video/mp4');
      setError('');
    }
  };

  const handleAiCaption = async () => {
    setAiLoading(true);
    try {
      const s = await getAiSuggestions(caption, false, userId);
      setCaption(s.hashtags ? `${s.caption}\n\n${s.hashtags}` : s.caption);
    } catch { /* silencioso */ }
    setAiLoading(false);
  };

  const handlePublish = async () => {
    if (!videoUri) { setError('Seleciona um vídeo primeiro.'); return; }
    setUploading(true); setError('');
    try {
      setProgress('A enviar para o servidor... ⏳');
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token ?? '';
      const mimeToExt: Record<string, string> = {
        'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv',
        'video/webm': 'webm', 'video/3gpp': '3gp',
      };
      const ext = mimeToExt[videoMime] ?? 'mp4';
      const path = `reels/${userId}/${Date.now()}.${ext}`;
      const videoUrl = await uploadVideoFormData(videoUri, videoMime, 'reels_videos', path, token);
      setProgress('A publicar Reel... 🎬');

      // Dual-write: reels table (for Reels tab) + posts table (for Feed/Profile/Search)
      const { data: reelData, error: insertErr } = await supabase.from('reels').insert({
        user_id: userId,
        video_url: videoUrl,
        caption: caption.trim(),
      }).select('id').single();
      if (insertErr) throw new Error(insertErr.message);

      // Write to posts table so the reel appears in Feed, Profile, and Search
      await supabase.from('posts').insert({
        user_id: userId,
        caption: caption.trim(),
        video_url: videoUrl,
        post_type: 'reel',
        image_url: '',
        status: 'published',
        is_deleted: false,
      });

      setVideoUri(null); setCaption(''); setProgress('');
      router.navigate('/(app)/(tabs)/reels' as any);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao publicar Reel. Tenta novamente.');
      setProgress('');
    }
    setUploading(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      {/* Zona de seleção de vídeo */}
      {!videoUri ? (
        <Pressable onPress={pickVideo} style={{
          backgroundColor: colors.input, borderRadius: 20, height: 220,
          alignItems: 'center', justifyContent: 'center', gap: 12,
          borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(123,63,242,0.35)',
        }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(123,63,242,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Video size={28} color={colors.purple} strokeWidth={1.6} />
          </View>
          <Text style={{ color: '#A78BFA', fontSize: 15, fontWeight: '700' }}>Selecionar vídeo</Text>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>MP4, MOV • máx. 120 seg</Text>
        </Pressable>
      ) : (
        <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(123,63,242,0.2)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(123,63,242,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Film size={22} color={colors.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                {videoUri.split('/').pop()}
              </Text>
              <Text style={{ color: colors.success, fontSize: 11 }}>✓ Vídeo selecionado</Text>
            </View>
            <Pressable onPress={() => setVideoUri(null)} style={{ padding: 6 }}>
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
          <Pressable onPress={pickVideo} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: colors.purple, fontSize: 12, fontWeight: '600' }}>Trocar vídeo</Text>
          </Pressable>
        </View>
      )}

      {/* Legenda do Reel */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Legenda</Text>
          <Pressable onPress={handleAiCaption} disabled={aiLoading}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(123,63,242,0.12)', borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
            {aiLoading ? <ActivityIndicator size={12} color="#A78BFA" /> : <Sparkles size={13} color="#A78BFA" />}
            <Text style={{ color: '#A78BFA', fontSize: 12, fontWeight: '600' }}>IA sugere</Text>
          </Pressable>
        </View>
        <MentionInput value={caption} onChangeText={setCaption}
          placeholder="Descreve o teu Reel... #hashtags @menções"
          multiline maxLength={300} textAlignVertical="top"
          style={{ backgroundColor: colors.input, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, minHeight: 80, fontSize: 15, borderWidth: 1, borderColor: colors.inputBorder }} />
        <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'right' }}>{caption.length}/300</Text>
      </View>

      {/* Progresso */}
      {progress ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(123,63,242,0.1)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
          <ActivityIndicator size="small" color={colors.purple} />
          <Text style={{ color: '#A78BFA', fontSize: 13, flex: 1 }}>{progress}</Text>
        </View>
      ) : null}
      {error ? <Text style={{ color: colors.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text> : null}

      {/* Botão publicar */}
      <Pressable onPress={handlePublish} disabled={uploading || !videoUri}
        style={{
          backgroundColor: videoUri ? colors.purple : colors.input,
          borderRadius: 16, paddingVertical: 16, alignItems: 'center',
          shadowColor: colors.purple, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: videoUri ? 0.4 : 0, shadowRadius: 12, elevation: videoUri ? 6 : 0,
        }}>
        {uploading ? <ActivityIndicator color="#fff" /> :
          <Text style={{ color: videoUri ? '#fff' : colors.muted, fontWeight: '800', fontSize: 16 }}>
            🎬 Publicar Reel
          </Text>}
      </Pressable>
    </ScrollView>
  );
}
// ── Aba: Story (24h) ──────────────────────────────────────────────────────────
function StoryTab() {
  const { session } = useSession();
  const router = useRouter();
  const { colors } = useZivaTheme();
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [mediaMime, setMediaMime] = useState<string>('image/jpeg');
  const [textOverlay, setTextOverlay] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const userId = session?.user?.id ?? '';

  const TEXT_COLORS = ['#FFFFFF', '#FFD700', '#FF6B6B', '#4ADE80', '#60A5FA', '#F472B6', '#A78BFA'];

  const pickMedia = async () => {
    setError('');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Permissão de galeria negada.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'], quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      setMediaUri(asset.uri);
      setMediaType(isVideo ? 'video' : 'image');
      setMediaMime(asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'));
    }
  };

  const handlePublish = async () => {
    if (!mediaUri) { setError('Seleciona uma imagem ou vídeo.'); return; }
    setUploading(true); setError('');
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token ?? '';
      const mimeToExt: Record<string, string> = {
        'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv',
        'video/webm': 'webm', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      };
      const ext = mimeToExt[mediaMime] ?? (mediaType === 'video' ? 'mp4' : 'jpg');
      const bucket = mediaType === 'video' ? 'reels_videos' : 'ziva_images';
      const path = `stories/${userId}/${Date.now()}.${ext}`;
      let publicUrl: string;
      if (mediaType === 'video') {
        publicUrl = await uploadVideoFormData(mediaUri, mediaMime, bucket, path, token);
      } else {
        const { fetch: ef } = await import('expo/fetch');
        const resp = await ef(mediaUri);
        if (!resp.ok) throw new Error('Não foi possível ler a imagem.');
        const buf = await resp.arrayBuffer();
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, buf, { contentType: mediaMime });
        if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        publicUrl = urlData.publicUrl;
      }
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: insertErr } = await supabase.from('stories').insert({
        user_id: userId,
        media_url: publicUrl,
        media_type: mediaType,
        text_overlay: textOverlay.trim() || null,
        text_color: textColor,
        expires_at: expiresAt,
        duration: mediaType === 'video' ? 15 : 5,
      });
      if (insertErr) throw new Error(insertErr.message);
      setMediaUri(null); setTextOverlay('');
      router.navigate('/(app)/(tabs)/home' as any);
    } catch (e: any) { setError(e.message ?? 'Erro ao publicar story.'); }
    setUploading(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      {/* Preview/seleção de media */}
      <Pressable onPress={pickMedia} style={{
        backgroundColor: colors.input, borderRadius: 24, height: 300,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        borderWidth: 1.5, borderStyle: mediaUri ? 'solid' : 'dashed',
        borderColor: mediaUri ? colors.purple : colors.inputBorder,
      }}>
        {mediaUri && mediaType === 'image' ? (
          <Image source={{ uri: mediaUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : mediaUri && mediaType === 'video' ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(123,63,242,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Film size={28} color={colors.purple} />
            </View>
            <Text style={{ color: '#A78BFA', fontWeight: '700' }}>Vídeo selecionado</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{mediaUri.split('/').pop()}</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(123,63,242,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={28} color={colors.purple} />
            </View>
            <Text style={{ color: '#A78BFA', fontSize: 15, fontWeight: '700' }}>Selecionar foto ou vídeo</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>O story desaparece após 24h</Text>
          </View>
        )}
        {mediaUri && textOverlay.trim() ? (
          <View style={{ position: 'absolute', bottom: 20, left: 16, right: 16, alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: textColor, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{textOverlay}</Text>
            </View>
          </View>
        ) : null}
      </Pressable>

      {mediaUri && (
        <Pressable onPress={() => setMediaUri(null)} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <X size={14} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Remover</Text>
        </Pressable>
      )}

      {/* Texto overlay */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Texto no story (opcional)</Text>
        <TextInput
          value={textOverlay}
          onChangeText={setTextOverlay}
          placeholder="Escreve algo inspirador..."
          placeholderTextColor={colors.placeholder}
          maxLength={80}
          style={{
            backgroundColor: colors.input, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
            color: textColor, fontSize: 15, borderWidth: 1, borderColor: colors.inputBorder,
          }}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {TEXT_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setTextColor(c)} style={{
              width: 28, height: 28, borderRadius: 14, backgroundColor: c,
              borderWidth: textColor === c ? 3 : 1.5,
              borderColor: textColor === c ? '#fff' : 'rgba(255,255,255,0.2)',
            }} />
          ))}
        </View>
      </View>

      {error ? <Text style={{ color: colors.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text> : null}

      <Pressable onPress={handlePublish} disabled={uploading || !mediaUri} style={{
        backgroundColor: mediaUri ? colors.purple : colors.input,
        borderRadius: 16, paddingVertical: 16, alignItems: 'center',
        shadowColor: colors.purple, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: mediaUri ? 0.45 : 0, shadowRadius: 12, elevation: mediaUri ? 6 : 0,
      }}>
        {uploading ? <ActivityIndicator color="#fff" /> :
          <Text style={{ color: mediaUri ? '#fff' : colors.muted, fontWeight: '800', fontSize: 16 }}>📖 Partilhar Story</Text>}
      </Pressable>

      <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>
        O story será visível para os teus seguidores durante 24 horas.
      </Text>
    </ScrollView>
  );
}
// ── Ecrã principal de criação ─────────────────────────────────────────────────
export default function CreateScreen() {
  const [activeTab, setActiveTab] = useState<CreateTab>('publicacao');
  const { colors } = useZivaTheme();
  const router = useRouter();

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <StatusBar style={colors.statusBar} />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder,
      }}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/home' as any)}
          style={{ marginRight: 12, padding: 4 }}
          className="active:opacity-70"
        >
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Nova publicação</Text>
      </View>

      {/* Selector de aba */}
      <CreateTabBar active={activeTab} onChange={setActiveTab} />

      {/* Conteúdo */}
      {activeTab === 'publicacao' ? <PostTab /> : activeTab === 'reel' ? <ReelTab /> : <StoryTab />}
    </KeyboardAvoidingView>
  );
}

