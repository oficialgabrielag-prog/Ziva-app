import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Wand, ImagePlus, Video, RefreshCw, CircleCheck,
  XCircle, Clock, Play, Trash,
} from 'lucide-react-native';
import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { fetch as expoFetch } from 'expo/fetch';

// ─── Types ───────────────────────────────────────────────────────────────────
interface VideoJob {
  id: string;
  task_id: string;
  status: 'submitted' | 'processing' | 'succeed' | 'failed';
  prompt: string | null;
  image_url: string | null;
  video_url: string | null;
  duration: string | null;
  aspect_ratio: string | null;
  error_msg: string | null;
  created_at: string;
}

const ASPECT_OPTIONS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1', value: '1:1' },
];
const DURATION_OPTIONS = ['5', '8', '10'];

// ─── Cartão de job ────────────────────────────────────────────────────────────
function JobCard({ job, onRefresh, onDelete }: {
  job: VideoJob;
  onRefresh: (job: VideoJob) => void;
  onDelete: (id: string) => void;
}) {
  const statusColor = job.status === 'succeed' ? '#10B981'
    : job.status === 'failed' ? '#EF4444'
    : '#7B3FF2';
  const StatusIcon = job.status === 'succeed' ? CircleCheck
    : job.status === 'failed' ? XCircle
    : Clock;
  const statusLabel: Record<VideoJob['status'], string> = {
    submitted: 'Na fila',
    processing: 'A gerar…',
    succeed: 'Concluído',
    failed: 'Falhou',
  };

  return (
    <View style={{
      backgroundColor: '#111115', borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 12,
    }}>
      {/* Imagem de referência */}
      {job.image_url ? (
        <Image source={{ uri: job.image_url }}
          style={{ width: '100%', height: 160 }} contentFit="cover" />
      ) : null}

      <View style={{ padding: 14, gap: 8 }}>
        {/* Status */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <StatusIcon size={15} color={statusColor} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: statusColor }}>
            {statusLabel[job.status]}
          </Text>
          {(job.status === 'submitted' || job.status === 'processing') && (
            <ActivityIndicator size="small" color="#7B3FF2" style={{ marginLeft: 4 }} />
          )}
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 11, color: '#6B7280' }}>
            {job.aspect_ratio} · {job.duration ?? '5'}s
          </Text>
        </View>

        {/* Prompt */}
        {job.prompt ? (
          <Text style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 17 }} numberOfLines={2}>
            {job.prompt}
          </Text>
        ) : null}

        {/* Vídeo gerado — pressable para abrir o vídeo */}
        {job.status === 'succeed' && job.video_url ? (
          <Pressable
            onPress={() => Linking.openURL(job.video_url!)}
            className="active:opacity-70"
            style={{
              backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 10,
              padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8,
              borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
            }}>
            <Play size={16} color="#10B981" />
            <Text style={{ flex: 1, fontSize: 11, color: '#10B981' }} numberOfLines={1}>
              Vídeo pronto — toca aqui para ver ▶
            </Text>
          </Pressable>
        ) : null}

        {/* Erro */}
        {job.status === 'failed' && job.error_msg ? (
          <Text style={{ fontSize: 11, color: '#EF4444' }} numberOfLines={2}>{job.error_msg}</Text>
        ) : null}

        {/* Ações */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          {(job.status === 'submitted' || job.status === 'processing') && (
            <Pressable onPress={() => onRefresh(job)}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 5, backgroundColor: 'rgba(123,63,242,0.15)', borderRadius: 10,
                paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)',
              }}
              className="active:opacity-70">
              <RefreshCw size={14} color="#A78BFA" />
              <Text style={{ fontSize: 12, color: '#A78BFA', fontWeight: '600' }}>Atualizar</Text>
            </Pressable>
          )}
          <Pressable onPress={() => onDelete(job.id)}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 5, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10,
              paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
            }}
            className="active:opacity-70">
            <Trash size={14} color="#EF4444" />
            <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '600' }}>Remover</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Ecrã principal ───────────────────────────────────────────────────────────
export default function PhotoToVideoScreen() {
  const { session } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id ?? '';

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageStorageUrl, setImageStorageUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState('9:16');
  const [duration, setDuration] = useState('5');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Atualizar status de um job (definido antes do useEffect de polling) ──────
  const handleRefreshJob = useCallback(async (job: VideoJob) => {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('kling-omni-video-query', {
        body: { task_id: job.task_id },
      });
      if (fnErr) throw fnErr;
      if (data?.code !== 0) throw new Error(data?.message);

      const taskData = data.data;
      const videoUrl = taskData.task_result?.videos?.[0]?.url ?? null;
      const videoDuration = taskData.task_result?.videos?.[0]?.duration ?? null;
      const updates: Partial<VideoJob> = {
        status: taskData.task_status,
        video_url: videoUrl,
        duration: videoDuration ?? job.duration,
        error_msg: taskData.task_status === 'failed' ? (taskData.task_status_msg ?? 'Falhou') : null,
      };
      await supabase.from('ai_video_jobs').update(updates).eq('id', job.id);
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, ...updates } : j));
    } catch { /* silencia erros de polling */ }
  }, []);

  // ── Auto-polling: verifica jobs pendentes a cada 5s automaticamente ──────────
  useEffect(() => {
    const pending = jobs.filter(
      (j) => j.status === 'submitted' || j.status === 'processing',
    );
    if (pending.length > 0) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => {
          setJobs((prev) => {
            prev
              .filter((j) => j.status === 'submitted' || j.status === 'processing')
              .forEach((j) => handleRefreshJob(j));
            return prev;
          });
        }, 5000);
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [jobs, handleRefreshJob]);

  // ── Carregar jobs do utilizador ─────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      (async () => {
        setLoadingJobs(true);
        const { data } = await supabase
          .from('ai_video_jobs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);
        setJobs((data ?? []) as VideoJob[]);
        setLoadingJobs(false);
      })();
    }, [userId])
  );

  // ── Escolher imagem ─────────────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.85,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setSelectedImage(uri);
    setImageStorageUrl(null);
    setUploadingImg(true);
    try {
      const resp = await expoFetch(uri);
      const buf = await resp.arrayBuffer();
      const path = `photo-to-video/${userId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('ziva_images').upload(path, buf, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('ziva_images').getPublicUrl(path);
      setImageStorageUrl(urlData.publicUrl);
    } catch {
      setError('Falha ao carregar imagem. Tenta novamente.');
    }
    setUploadingImg(false);
  };

  // ── Submeter job de geração ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!imageStorageUrl) { setError('Seleciona uma imagem primeiro.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('kling-omni-video-submit', {
        body: {
          prompt: prompt.trim() || 'Animate this photo into a smooth, cinematic video',
          image_list: [{ image_url: imageStorageUrl }],
          aspect_ratio: aspect,
          duration,
          mode: 'pro',
          sound: 'on',
        },
      });
      if (fnErr) throw fnErr;
      if (data?.code !== 0) throw new Error(data?.message ?? 'Erro ao submeter tarefa');

      const taskId: string = data.data.task_id;
      const { data: jobRow, error: dbErr } = await supabase
        .from('ai_video_jobs')
        .insert({
          task_id: taskId,
          status: 'submitted',
          prompt: prompt.trim() || null,
          image_url: imageStorageUrl,
          aspect_ratio: aspect,
          duration,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;
      setJobs((prev) => [jobRow as VideoJob, ...prev]);
      setSelectedImage(null);
      setImageStorageUrl(null);
      setPrompt('');
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao gerar vídeo.');
    }
    setSubmitting(false);
  };

  // ── Eliminar job ─────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await supabase.from('ai_video_jobs').delete().eq('id', id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#09090B' }}>
      <StatusBar style="light" backgroundColor="#09090B" />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingTop: insets.top + 8, paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)',
      }}>
        <Pressable onPress={() => router.back()} className="active:opacity-70"
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <ArrowLeft size={20} color="#F9FAFB" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#F9FAFB' }}>
            Foto → Vídeo IA
          </Text>
          <Text style={{ fontSize: 11, color: '#6B7280' }}>Animação por inteligência artificial</Text>
        </View>
        <View style={{
          backgroundColor: 'rgba(123,63,242,0.2)', borderRadius: 20,
          paddingHorizontal: 10, paddingVertical: 4,
        }}>
          <Text style={{ fontSize: 10, color: '#A78BFA', fontWeight: '800' }}>IA</Text>
        </View>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>

        {/* Selecionar imagem */}
        <Pressable onPress={pickImage} disabled={uploadingImg}
          style={{
            height: 200, borderRadius: 20, overflow: 'hidden',
            backgroundColor: '#111115', borderWidth: 2,
            borderStyle: selectedImage ? 'solid' : 'dashed',
            borderColor: selectedImage ? '#7B3FF2' : 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center',
          }}
          className="active:opacity-80">
          {selectedImage ? (
            <>
              <Image source={{ uri: selectedImage }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              {uploadingImg && (
                <View style={{
                  ...StyleSheet.absoluteFillObject,
                  backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ActivityIndicator color="#7B3FF2" size="large" />
                  <Text style={{ color: '#A78BFA', marginTop: 8, fontSize: 13 }}>A carregar…</Text>
                </View>
              )}
            </>
          ) : (
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 60, height: 60, borderRadius: 30,
                backgroundColor: 'rgba(123,63,242,0.15)', alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: 'rgba(123,63,242,0.4)',
              }}>
                <ImagePlus size={26} color="#7B3FF2" />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#F9FAFB' }}>Escolhe uma foto</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', paddingHorizontal: 20 }}>
                Seleciona qualquer imagem da galeria para animar com IA
              </Text>
            </View>
          )}
        </Pressable>

        {/* Prompt */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#F9FAFB' }}>
            Descrição (opcional)
          </Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Ex: pessoa dançando em câmara lenta, vento suave…"
            placeholderTextColor="#4B5563"
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: '#111115', borderRadius: 14, borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)', color: '#F9FAFB',
              paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
              textAlignVertical: 'top', minHeight: 80,
            }}
          />
        </View>

        {/* Proporção */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#F9FAFB' }}>Proporção</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {ASPECT_OPTIONS.map((opt) => {
              const active = aspect === opt.value;
              return (
                <Pressable key={opt.value} onPress={() => setAspect(opt.value)}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                    backgroundColor: active ? '#7B3FF2' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1.5, borderColor: active ? '#7B3FF2' : 'rgba(255,255,255,0.1)',
                  }}
                  className="active:opacity-70">
                  <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : '#9CA3AF' }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Duração */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#F9FAFB' }}>Duração (segundos)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {DURATION_OPTIONS.map((d) => {
              const active = duration === d;
              return (
                <Pressable key={d} onPress={() => setDuration(d)}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                    backgroundColor: active ? 'rgba(123,63,242,0.25)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1.5, borderColor: active ? '#7B3FF2' : 'rgba(255,255,255,0.1)',
                  }}
                  className="active:opacity-70">
                  <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#A78BFA' : '#9CA3AF' }}>
                    {d}s
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Erro */}
        {error ? (
          <View style={{
            backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12,
            borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', flexDirection: 'row', gap: 8,
          }}>
            <XCircle size={16} color="#EF4444" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 13, color: '#EF4444', lineHeight: 18 }}>{error}</Text>
          </View>
        ) : null}

        {/* Botão gerar */}
        <Pressable
          onPress={handleGenerate}
          disabled={submitting || uploadingImg || !imageStorageUrl}
          style={{
            backgroundColor: '#7B3FF2', borderRadius: 16, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: (submitting || uploadingImg || !imageStorageUrl) ? 0.5 : 1,
            shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
          }}
          className="active:opacity-80">
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Wand size={20} color="#fff" />}
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>
            {submitting ? 'A submeter…' : 'Gerar Vídeo'}
          </Text>
        </Pressable>

        {/* Jobs existentes */}
        {(jobs.length > 0 || loadingJobs) && (
          <View style={{ gap: 10, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Video size={16} color="#7B3FF2" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#F9FAFB' }}>
                Os teus vídeos
              </Text>
            </View>
            {loadingJobs
              ? <ActivityIndicator color="#7B3FF2" style={{ marginVertical: 20 }} />
              : jobs.map((job) => (
                  <JobCard key={job.id} job={job} onRefresh={handleRefreshJob} onDelete={handleDelete} />
                ))
            }
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Shim para StyleSheet.absoluteFillObject (usado no overlay de upload)
const StyleSheet = {
  absoluteFillObject: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
};
