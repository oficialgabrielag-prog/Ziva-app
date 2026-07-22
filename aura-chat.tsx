/**
 * aura-chat.tsx — Tela full-screen de chat com a Aura (estilo ChatGPT)
 * Rota Stack independente: sem tab bar, teclado não cobre o input.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  KeyboardAvoidingView, ActivityIndicator, Platform, Modal, Share, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import { fetch } from 'expo/fetch';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  ArrowLeft, MoreVertical, CircleCheck, Paperclip,
  Camera, Mic, Send, Copy, Check, RefreshCw, Volume,
  ThumbsUp, ThumbsDown, Trash, Share as ShareIcon, Info, MessageSquarePlus,
  TrendingUp, ImageIcon, Video, PhoneCall, MicOff, PhoneOff, X as XIcon,
} from 'lucide-react-native';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';

import { supabase } from '@/client/supabase';
import { useZivaTheme } from '@/lib/theme-context';
import { useSession } from '@/ctx';
import { MarkdownText } from '@/components/MarkdownText';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  loading?: boolean;
  feedback?: 'up' | 'down' | null;
  isError?: boolean;
  retryFn?: () => void;
  copied?: boolean;
}

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

// ─── Constants ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Aura IA ∞ — Template de Prompt com Injecção de Data + Agente ─────────────
const SYSTEM_PROMPT_TEMPLATE = `Você é AURA, a IA da Ziva para Angola. Siga RIGOROSAMENTE estas regras:

## 1. IDENTIDADE E DATA
- Data atual: {{DATA_ATUAL}}. Fuso: Africa/Luanda.
- Se perguntarem a data, hora ou dia da semana, use SEMPRE esta data.
- Você é especialista em pt-AO e cultura angolana.

## 2. AGENTE ESPECÍFICO
- Você está atuando como: {{NOME_DO_AGENTE}} — {{DESCRICAO_DO_AGENTE}}
- Use APENAS o conhecimento e tom deste agente. Não misture papéis.
- Responda APENAS com base no histórico desta conversa. Ignore conversas de outros agentes.

## 3. ANÁLISE DE IMAGEM — REGRA DE OURO
- Analise APENAS a imagem que foi enviada nesta mensagem atual.
- Se não receber nenhuma imagem, responda: "Não consegui visualizar a imagem. Pode enviar novamente por favor?"
- PROIBIDO inventar, alucinar, assumir contexto angolano, ou descrever imagens de conversas anteriores.
- OBRIGATÓRIO: descreva EXCLUSIVAMENTE o que está visualmente presente na imagem. NÃO projete cultura angolana nem africana na análise — descreva a realidade exacta da imagem.
- Se a imagem mostrar pessoas asiáticas, europeias ou de qualquer outra origem, descreva-as correctamente. NÃO as substitua por contexto angolano.
- Quando receber uma imagem, responda EXCLUSIVAMENTE neste formato JSON (sem nenhum texto fora do JSON, sem markdown):
{"analise_imagem":{"descricao":"Descrição objectiva e precisa do que está na imagem","elementos_chave":["elemento visual 1","elemento visual 2"],"tom_emocional":"tom emocional real da imagem"},"feedback_aura":"Comentário útil e honesto para o utilizador"}

## 4. TOM E SEGURANÇA
- Seja direto, útil e com calor humano de Angola.
- Nunca invente informações. Se não souber, diga "Não tenho essa informação".
- Não compartilhe dados de outros usuários.

## 5. MÓDULOS COGNITIVOS ACTIVOS
Língua Natural · Raciocínio Avançado · Planeamento Estratégico · Pesquisa Inteligente
Memória · Visão Computacional · Áudio · Voz · Programação · Matemática · Tradução

## 6. TRANSPARÊNCIA
- Indica quando não tem informação suficiente. Distingue factos de hipóteses.
- Para código usa blocos com indicação de linguagem. Para respostas longas usa títulos e listas.

INSTRUÇÃO FINAL: Antes de responder confirme: 1. Estou usando a data certa? 2. Estou analisando a imagem desta mensagem? 3. Estou no papel do agente correto?`;

// ─── Construtor de prompt com data + agente injectados ────────────────────────
function buildSystemPrompt(agent: { name: string; description: string }): string {
  const now = new Date();
  const luandaDate = now.toLocaleDateString('pt-AO', {
    timeZone: 'Africa/Luanda',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return SYSTEM_PROMPT_TEMPLATE
    .replace('{{DATA_ATUAL}}', luandaDate)
    .replace('{{NOME_DO_AGENTE}}', agent.name)
    .replace('{{DESCRICAO_DO_AGENTE}}', agent.description);
}

// ─── Agentes Especializados ───────────────────────────────────────────────────
interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
}

const AGENTS: Agent[] = [
  { id: 'general',    name: 'Aura Geral',  emoji: '⚡',  color: '#7B3FF2', description: 'Assistente completa multimodal' },
  { id: 'programmer', name: 'Programador', emoji: '💻',  color: '#06B6D4', description: 'Código, APIs e tecnologia' },
  { id: 'designer',   name: 'Designer',    emoji: '🎨',  color: '#EC4899', description: 'Design visual, UX/UI e branding' },
  { id: 'researcher', name: 'Investigador',emoji: '🔬',  color: '#F59E0B', description: 'Pesquisa aprofundada e análise crítica' },
  { id: 'writer',     name: 'Escritor',    emoji: '✍️',  color: '#10B981', description: 'Escrita criativa e profissional' },
  { id: 'analyst',    name: 'Analista',    emoji: '📊',  color: '#3B82F6', description: 'Dados, métricas e negócios' },
  { id: 'translator', name: 'Tradutor',    emoji: '🌍',  color: '#8B5CF6', description: 'Tradução e idiomas africanos' },
  { id: 'content',    name: 'Conteúdo',    emoji: '🎬',  color: '#F97316', description: 'Redes sociais e media digital' },
  { id: 'marketing',  name: 'Marketing',   emoji: '📣',  color: '#EF4444', description: 'Estratégia e campanhas de marca' },
  { id: 'support',    name: 'Atendimento', emoji: '🤝',  color: '#22C55E', description: 'Apoio ao cliente com empatia' },
  { id: 'planner',    name: 'Planeador',   emoji: '🗓️', color: '#A78BFA', description: 'Planos, roadmaps e projectos' },
  { id: 'projects',   name: 'Gestor',      emoji: '🏗️', color: '#64748B', description: 'Gestão de equipas e entregas' },
];

// ─── Ícone Z (lightning bolt) ─────────────────────────────────────────────────
function AuraAvatar({ size = 36 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#7B3FF2', alignItems: 'center', justifyContent: 'center',
      shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
    }}>
      <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <Path
          d="M13 2L4.5 13.5H11L9 22L19.5 10H13L13 2Z"
          fill="#fff"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// ─── Stream Gemini via ziva-ai edge function ──────────────────────────────────
async function streamAura(
  contents: GeminiContent[],
  systemInstruction: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
  onRetry?: (attempt: number) => void,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON_KEY;

  const DELAYS = [1500, 3000, 5000, 8000];
  for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
    if (signal?.aborted) return;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ziva-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ contents, systemInstruction }),
      signal,
    });

    if (res.status === 503 && attempt < DELAYS.length) {
      await res.text().catch(() => '');
      onRetry?.(attempt + 1);
      await new Promise((r) => setTimeout(r, DELAYS[attempt]));
      continue;
    }
    if (!res.ok) {
      try { const b = await res.json(); throw new Error(b?.error ?? `Erro ${res.status}`); }
      catch { throw new Error(`Erro ${res.status}`); }
    }
    if (!res.body) { onDone(); return; }

    const reader = (res.body as any).getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read() as { done: boolean; value?: Uint8Array };
      if (done) break;
      if (value) buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const frame = JSON.parse(data);
          const chunk: string = frame?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          if (chunk) onChunk(chunk);
        } catch { /* frame incompleto */ }
      }
    }
    onDone();
    return;
  }
}

// ─── Upload para Supabase Storage ────────────────────────────────────────────
async function uploadImg(uri: string): Promise<string> {
  const resp = await fetch(uri);
  if (!resp.ok) throw new Error('Não foi possível ler a imagem.');
  const buf = await resp.arrayBuffer();
  const path = `chat-images/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('ziva_images').upload(path, buf, { contentType: 'image/jpeg' });
  if (error) throw new Error(`Upload falhou: ${error.message}`);
  return supabase.storage.from('ziva_images').getPublicUrl(path).data.publicUrl;
}

// ─── Helper: tenta fazer parse de JSON de análise de imagem ──────────────────
function tryParseImageAnalysis(content: string): {
  analise_imagem: { descricao: string; elementos_chave: string[]; tom_emocional: string };
  feedback_aura: string;
} | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.analise_imagem?.descricao) return parsed;
  } catch { /* não é JSON completo ainda */ }
  return null;
}

// ─── Card de análise de imagem ────────────────────────────────────────────────
function ImageAnalysisCard({ data, colors }: {
  data: { analise_imagem: { descricao: string; elementos_chave: string[]; tom_emocional: string }; feedback_aura: string };
  colors: any;
}) {
  return (
    <View style={{ gap: 10 }}>
      {/* Cabeçalho */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(123,63,242,0.3)' }}>
        <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: 'rgba(123,63,242,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 13 }}>🔍</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#C4B5FD', letterSpacing: 0.3 }}>ANÁLISE DA IMAGEM</Text>
      </View>

      {/* Descrição */}
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(196,181,253,0.7)', letterSpacing: 0.5 }}>DESCRIÇÃO</Text>
        <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{data.analise_imagem.descricao}</Text>
      </View>

      {/* Elementos-chave */}
      {data.analise_imagem.elementos_chave?.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(196,181,253,0.7)', letterSpacing: 0.5 }}>ELEMENTOS-CHAVE</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {data.analise_imagem.elementos_chave.map((el, i) => (
              <View key={i} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(123,63,242,0.15)', borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)' }}>
                <Text style={{ fontSize: 12, color: '#C4B5FD', fontWeight: '600' }}>{el}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tom emocional */}
      {data.analise_imagem.tom_emocional && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Text style={{ fontSize: 16 }}>🎭</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(196,181,253,0.7)', letterSpacing: 0.3 }}>TOM EMOCIONAL</Text>
            <Text style={{ fontSize: 13, color: colors.text, marginTop: 2 }}>{data.analise_imagem.tom_emocional}</Text>
          </View>
        </View>
      )}

      {/* Feedback Aura */}
      {data.feedback_aura && (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: 'rgba(123,63,242,0.1)', borderWidth: 1, borderColor: 'rgba(123,63,242,0.25)', gap: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#A78BFA', letterSpacing: 0.3 }}>💬 AURA DIZ</Text>
          <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{data.feedback_aura}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Bolha de chat ────────────────────────────────────────────────────────────
function Bubble({
  msg,
  onFeedback,
  onCopy,
  onRetry,
}: {
  msg: ChatMessage;
  onFeedback?: (id: string, r: 'up' | 'down') => void;
  onCopy?: (id: string, text: string) => void;
  onRetry?: () => void;
}) {
  const { colors } = useZivaTheme();
  const isUser = msg.role === 'user';
  // Tenta parse de análise de imagem (só para mensagens completas da Aura)
  const imageAnalysis = (!isUser && !msg.loading) ? tryParseImageAnalysis(msg.content) : null;

  return (
    <View style={{
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginVertical: 4,
      paddingHorizontal: 12,
    }}>
      {/* Avatar Aura */}
      {!isUser && <AuraAvatar size={28} />}

      <View style={{ maxWidth: '82%' }}>
        {/* Bolha */}
        <View style={{
          backgroundColor: isUser ? '#7B3FF2' : colors.card,
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        }}>
          {/* Imagem opcional */}
          {msg.imageUrl && (
            <Image
              source={{ uri: msg.imageUrl }}
              style={{ width: 200, height: 150, borderRadius: 10, marginBottom: 6 }}
              contentFit="cover"
            />
          )}

          {/* Indicador de carregamento */}
          {msg.loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={isUser ? '#fff' : '#7B3FF2'} />
              <Text style={{ fontSize: 14, color: isUser ? 'rgba(255,255,255,0.7)' : colors.muted }}>
                A analisar…
              </Text>
            </View>
          ) : imageAnalysis ? (
            /* Card bonito de análise de imagem */
            <ImageAnalysisCard data={imageAnalysis} colors={colors} />
          ) : (
            <MarkdownText
              content={msg.content}
              color={isUser ? '#fff' : colors.text}
            />
          )}
        </View>

        {/* Acções — só para respostas da Aura */}
        {!isUser && !msg.loading && msg.content && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5, paddingLeft: 4 }}>
            {/* Copiar */}
            <Pressable
              onPress={() => onCopy?.(msg.id, msg.content)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
                backgroundColor: msg.copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                borderWidth: 1, borderColor: msg.copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)',
              }}
            >
              {msg.copied
                ? <Check size={11} color="#4ADE80" />
                : <Copy size={11} color={colors.muted} />}
              <Text style={{ fontSize: 11, color: msg.copied ? '#4ADE80' : colors.muted, fontWeight: '600' }}>
                {msg.copied ? 'Copiado!' : 'Copiar'}
              </Text>
            </Pressable>

            {/* Retry em caso de erro */}
            {msg.isError && onRetry && (
              <Pressable
                onPress={onRetry}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 3,
                  paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
                  backgroundColor: 'rgba(123,63,242,0.1)',
                  borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)',
                }}
              >
                <RefreshCw size={11} color="#A78BFA" />
                <Text style={{ fontSize: 11, color: '#A78BFA', fontWeight: '600' }}>Tentar novamente</Text>
              </Pressable>
            )}

            {/* Feedback útil / melhorar */}
            {onFeedback && !msg.isError && (
              <>
                <Pressable
                  onPress={() => onFeedback(msg.id, 'up')}
                  style={{
                    padding: 4, borderRadius: 10,
                    backgroundColor: msg.feedback === 'up' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1, borderColor: msg.feedback === 'up' ? '#22C55E' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <ThumbsUp size={12} color={msg.feedback === 'up' ? '#22C55E' : colors.muted} />
                </Pressable>
                <Pressable
                  onPress={() => onFeedback(msg.id, 'down')}
                  style={{
                    padding: 4, borderRadius: 10,
                    backgroundColor: msg.feedback === 'down' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1, borderColor: msg.feedback === 'down' ? '#EF4444' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <ThumbsDown size={12} color={msg.feedback === 'down' ? '#EF4444' : colors.muted} />
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function AuraChatScreen() {
  const { colors } = useZivaTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Olá! 👋 Sou a Aura, a tua IA angolana.\nComo posso ajudar-te hoje?',
    },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [callVisible, setCallVisible] = useState(false);
  const [callRecording, setCallRecording] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [callTranscript, setCallTranscript] = useState('');
  const [callResponse, setCallResponse] = useState('');
  const [trends, setTrends] = useState<string[]>([]);
  const [trendsVisible, setTrendsVisible] = useState(false);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const callDurationRef = useRef(0);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  // Agente activo
  const [activeAgent, setActiveAgent] = useState<Agent>(AGENTS[0]);
  const [agentVisible, setAgentVisible] = useState(false);

  const flatRef = useRef<FlatList>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Carregar histórico ao entrar na tela ─────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!userId || historyLoaded) return;
      (async () => {
        const { data } = await supabase
          .from('ziva_conversations')
          .select('id, role, content, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(60);
        if (data && data.length > 0) {
          const history: ChatMessage[] = data
            .reverse()
            .map((r) => ({ id: r.id, role: r.role as 'user' | 'assistant', content: r.content }));
          setMessages((prev) => [...history, ...prev.filter((m) => m.id === '0' && history.length === 0)]);
        }
        setHistoryLoaded(true);
      })();
    }, [userId, historyLoaded])
  );

  // ── Guardar na memória ───────────────────────────────────────────────────
  const saveMsg = (role: 'user' | 'assistant', content: string) => {
    if (!userId || !content.trim()) return;
    supabase.from('ziva_conversations').insert({ user_id: userId, role, content: content.slice(0, 2000) });
  };

  // ── Actualizar ou adicionar mensagem ─────────────────────────────────────
  const upsert = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = msg; return next; }
      return [...prev, msg];
    });
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  // ── Feedback ─────────────────────────────────────────────────────────────
  const handleFeedback = (msgId: string, r: 'up' | 'down') => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, feedback: r } : m));
  };

  // ── Copiar texto ─────────────────────────────────────────────────────────
  const handleCopy = async (msgId: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, copied: true } : m));
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, copied: false } : m));
    }, 2000);
  };

  // ── Seleccionar imagem ───────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled) setAttachedImage(r.assets[0].uri);
  };

  // ── Câmera ───────────────────────────────────────────────────────────────
  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!r.canceled) setAttachedImage(r.assets[0].uri);
  };

  // ── Microfone (toggle) ───────────────────────────────────────────────────
  const toggleRecording = async () => {
    if (isRecording) {
      await recorder.stop();
      setIsRecording(false);
      const uri = recorder.uri;
      if (uri) setInput((prev) => `${prev}🎤 [áudio gravado]`.trim());
    } else {
      await AudioModule.requestRecordingPermissionsAsync();
      await recorder.record();
      setIsRecording(true);
    }
  };

  // ── Enviar mensagem ──────────────────────────────────────────────────────
  const sendChat = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && !attachedImage) || streaming) return;
    setInput('');
    const imgUri = attachedImage;
    setAttachedImage(null);

    const userMsgId = Date.now().toString();
    let uploadedImg: string | undefined;
    if (imgUri) {
      try { uploadedImg = await uploadImg(imgUri); } catch { /* continua sem imagem */ }
    }

    upsert({ id: userMsgId, role: 'user', content: text || '📷 Imagem enviada', imageUrl: uploadedImg });
    saveMsg('user', text || '[imagem enviada]');

    setStreaming(true);
    abortRef.current = new AbortController();

    const aiMsgId = (Date.now() + 1).toString();
    upsert({ id: aiMsgId, role: 'assistant', content: '', loading: true });

    // Histórico para contexto (últimas 12 trocas reais)
    const history: GeminiContent[] = messages
      .filter((m) => !m.loading && m.content && m.id !== '0')
      .slice(-12)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    const userParts: GeminiPart[] = [];
    if (uploadedImg) {
      try {
        const imgRes = await fetch(uploadedImg);
        const buf = await imgRes.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        userParts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } });
      } catch { /* ignora */ }
    }
    if (text) userParts.push({ text });
    if (userParts.length === 0) userParts.push({ text: '[utilizador enviou uma imagem]' });

    const contents: GeminiContent[] = [
      ...history,
      { role: 'user', parts: userParts },
    ];

    let accumulated = '';
    try {
      await streamAura(
        contents,
        buildSystemPrompt(activeAgent),
        (chunk) => {
          accumulated += chunk;
          upsert({ id: aiMsgId, role: 'assistant', content: accumulated, loading: false });
        },
        () => {
          upsert({ id: aiMsgId, role: 'assistant', content: accumulated, loading: false });
          saveMsg('assistant', accumulated);
        },
        abortRef.current.signal,
        (attempt) => {
          const dots = '.'.repeat((attempt % 3) + 1);
          upsert({ id: aiMsgId, role: 'assistant', content: `A pensar${dots}`, loading: true });
        },
      );
    } catch (e: any) {
      if (!abortRef.current?.signal.aborted) {
        upsert({
          id: aiMsgId, role: 'assistant',
          content: '⏳ A Aura está ocupada. Toca em "Tentar novamente".',
          loading: false, isError: true,
          retryFn: () => sendChat(text),
        });
      }
    } finally {
      setStreaming(false);
    }
  };

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // ── Nova conversa ────────────────────────────────────────────────────────
  const handleNewConversation = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setInput('');
    setAttachedImage(null);
    setMessages([{
      id: '0',
      role: 'assistant',
      content: 'Olá! 👋 Sou a Aura, a tua IA angolana.\nComo posso ajudar-te hoje?',
    }]);
    if (userId) {
      supabase.from('ziva_conversations').delete().eq('user_id', userId);
    }
    setMenuVisible(false);
  }, [userId]);

  // ── Partilhar conversa ───────────────────────────────────────────────────
  const handleShareConversation = useCallback(async () => {
    const text = messages
      .filter((m) => m.content && !m.loading)
      .map((m) => `${m.role === 'user' ? 'Eu' : 'Aura'}: ${m.content}`)
      .join('\n\n');
    setMenuVisible(false);
    await Share.share({ title: 'Conversa com a Aura', message: text });
  }, [messages]);

  // ── Copiar toda a conversa ───────────────────────────────────────────────
  const handleCopyAll = useCallback(async () => {
    const text = messages
      .filter((m) => m.content && !m.loading)
      .map((m) => `${m.role === 'user' ? 'Eu' : 'Aura'}: ${m.content}`)
      .join('\n\n');
    await Clipboard.setStringAsync(text);
    setMenuVisible(false);
  }, [messages]);

  // ── Tendências em tempo real ─────────────────────────────────────────────
  const handleTrends = useCallback(async () => {
    setMenuVisible(false);
    setTrendsVisible(true);
    setTrendsLoading(true);
    try {
      const { data } = await supabase
        .from('posts')
        .select('hashtags')
        .order('created_at', { ascending: false })
        .limit(200);
      const freq: Record<string, number> = {};
      (data ?? []).forEach((p: any) => {
        if (Array.isArray(p.hashtags)) {
          p.hashtags.forEach((h: string) => {
            const tag = h.startsWith('#') ? h : `#${h}`;
            freq[tag] = (freq[tag] ?? 0) + 1;
          });
        }
      });
      const sorted = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([tag]) => tag);
      setTrends(sorted.length ? sorted : ['#angola', '#ziva', '#luanda', '#africa', '#cultura']);
    } catch {
      setTrends(['#angola', '#ziva', '#luanda', '#africa', '#cultura']);
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  // ── Navegar: Gerar Imagem ────────────────────────────────────────────────
  const handleGoGenerateImage = useCallback(() => {
    setMenuVisible(false);
    router.push('/(app)/(tabs)/ziva-ia' as RelativePathString);
  }, [router]);

  // ── Navegar: Gerar Vídeo ─────────────────────────────────────────────────
  const handleGoGenerateVideo = useCallback(() => {
    setMenuVisible(false);
    router.push('/(app)/(tabs)/ziva-ia' as RelativePathString);
  }, [router]);

  // ── Abrir seletor de agentes ─────────────────────────────────────────────
  const handleOpenAgents = useCallback(() => {
    setMenuVisible(false);
    setAgentVisible(true);
  }, []);

  // ── Chamada de voz com Aura ──────────────────────────────────────────────
  const startCall = useCallback(async () => {
    setMenuVisible(false);
    setCallVisible(true);
    setCallStatus('idle');
    setCallTranscript('');
    setCallResponse('');
    setCallSeconds(0);
    callDurationRef.current = 0;
    callTimerRef.current = setInterval(() => {
      callDurationRef.current += 1;
      setCallSeconds((s) => s + 1);
    }, 1000);
  }, []);

  const startCallRecording = useCallback(async () => {
    try {
      await AudioModule.requestRecordingPermissionsAsync();
      await recorder.record();
      setCallRecording(true);
      setCallStatus('listening');
      setCallTranscript('');
    } catch { /* sem permissão */ }
  }, [recorder]);

  const stopCallRecording = useCallback(async () => {
    if (!callRecording) return;
    await recorder.stop();
    setCallRecording(false);
    setCallStatus('thinking');
    const transcript = `[mensagem de voz do utilizador]`;
    setCallTranscript('A processar a tua voz…');
    // Envia para a Aura como mensagem de voz
    const aiMsgId = `call-${Date.now()}`;
    let accumulated = '';
    try {
      await streamAura(
        [{ role: 'user', parts: [{ text: 'O utilizador enviou uma mensagem de voz. Responde de forma concisa e natural, como numa chamada telefónica. Seja breve.' }] }],
        buildSystemPrompt(activeAgent),
        (chunk) => { accumulated += chunk; },
        () => {
          setCallResponse(accumulated);
          setCallStatus('speaking');
          Speech.speak(accumulated, {
            language: 'pt-PT',
            pitch: 1.0,
            rate: 0.95,
            onDone: () => setCallStatus('idle'),
          });
          // Também adiciona ao chat principal
          upsert({ id: `call-user-${Date.now()}`, role: 'user', content: transcript });
          upsert({ id: aiMsgId, role: 'assistant', content: accumulated });
          saveMsg('user', transcript);
          saveMsg('assistant', accumulated);
        },
      );
    } catch {
      setCallStatus('idle');
      setCallTranscript('Erro na chamada. Tenta de novo.');
    }
  }, [callRecording, recorder, upsert, saveMsg]);

  const endCall = useCallback(() => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (callRecording) recorder.stop().catch(() => {});
    Speech.stop();
    setCallRecording(false);
    setCallStatus('idle');
    setCallVisible(false);
    setCallSeconds(0);
  }, [callRecording, recorder]);

  const formatCallTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const canSend = (input.trim().length > 0 || !!attachedImage) && !streaming;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={colors.statusBar as any} backgroundColor={colors.bg} />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 12,
        backgroundColor: colors.bg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.07)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}>
        {/* Seta voltar */}
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/home' as any)}
          style={{
            width: 38, height: 38, borderRadius: 19,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
        </Pressable>

        {/* Avatar + info */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <AuraAvatar size={42} />
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Aura IA ∞</Text>
              <View style={{
                width: 16, height: 16, borderRadius: 8,
                backgroundColor: '#7B3FF2', alignItems: 'center', justifyContent: 'center',
              }}>
                <CircleCheck size={11} color="#fff" fill="#fff" strokeWidth={0} />
              </View>
              <View style={{
                paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                backgroundColor: `${activeAgent.color}22`,
                borderWidth: 1, borderColor: `${activeAgent.color}66`,
              }}>
                <Text style={{ fontSize: 9, color: activeAgent.color, fontWeight: '800', letterSpacing: 0.5 }}>
                  {activeAgent.id === 'general' ? 'PREMIUM' : activeAgent.name.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 11, color: activeAgent.color }}>{activeAgent.emoji}</Text>
              <Text style={{ fontSize: 11, color: activeAgent.color, fontWeight: '700' }}>
                {activeAgent.id === 'general' ? 'Raciocínio Avançado · Online' : activeAgent.description}
              </Text>
            </View>
          </View>
        </View>

        {/* 3 pontos — menu de opções */}
        <Pressable
          onPress={() => setMenuVisible(true)}
          style={{
            width: 38, height: 38, borderRadius: 19,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <MoreVertical size={20} color={colors.muted} strokeWidth={2} />
        </Pressable>
      </View>

      {/* ── ÁREA DE CHAT ────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Bubble
              msg={item}
              onFeedback={handleFeedback}
              onCopy={handleCopy}
              onRetry={item.retryFn}
            />
          )}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Chips de acções rápidas — só quando chat vazio */}
        {messages.length <= 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}
          >
            {[
              { label: '💻 Escrever código', text: 'Preciso de ajuda com código. ' },
              { label: '📊 Analisar dados', text: 'Analisa estes dados para mim: ' },
              { label: '✍️ Criar artigo', text: 'Escreve um artigo sobre ' },
              { label: '🌍 Traduzir', text: 'Traduz para inglês: ' },
              { label: '📣 Marketing', text: 'Cria uma campanha de marketing para ' },
              { label: '📋 Resumir', text: 'Resume este texto: ' },
              { label: '🔬 Pesquisar', text: 'Pesquisa e explica sobre ' },
              { label: '🗓️ Planear', text: 'Cria um plano detalhado para ' },
            ].map((chip) => (
              <Pressable
                key={chip.label}
                className="active:opacity-70"
                onPress={() => setInput(chip.text)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: 'rgba(123,63,242,0.12)',
                  borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)',
                }}
              >
                <Text style={{ fontSize: 13, color: '#C4B5FD', fontWeight: '600' }}>{chip.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Pré-visualização imagem anexada */}
        {attachedImage && (
          <View style={{
            marginHorizontal: 12, marginBottom: 6,
            backgroundColor: colors.card, borderRadius: 12,
            padding: 8, flexDirection: 'row', alignItems: 'center', gap: 10,
          }}>
            <Image source={{ uri: attachedImage }} style={{ width: 48, height: 48, borderRadius: 8 }} contentFit="cover" />
            <Text style={{ fontSize: 13, color: colors.muted, flex: 1 }}>Imagem de referência adicionada</Text>
            <Pressable onPress={() => setAttachedImage(null)}>
              <Text style={{ fontSize: 18, color: colors.muted }}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* ── INPUT BAR ─────────────────────────────────────────────────── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: insets.bottom + 10,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.07)',
        }}>
          {/* Clip — anexar imagem */}
          <Pressable
            onPress={pickImage}
            style={{
              width: 40, height: 40, borderRadius: 20,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <Paperclip size={18} color={colors.muted} />
          </Pressable>

          {/* Campo de texto */}
          <View style={{
            flex: 1,
            backgroundColor: colors.card,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            paddingHorizontal: 14,
            paddingVertical: 8,
            maxHeight: 120,
          }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Fala com a Aura..."
              placeholderTextColor={colors.muted}
              multiline
              returnKeyType="default"
              style={{ fontSize: 15, color: colors.text, lineHeight: 21 }}
              onSubmitEditing={() => sendChat()}
              blurOnSubmit={false}
            />
          </View>

          {/* Câmera */}
          <Pressable
            onPress={openCamera}
            style={{
              width: 40, height: 40, borderRadius: 20,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <Camera size={18} color={colors.muted} />
          </Pressable>

          {/* Microfone */}
          <Pressable
            onPress={toggleRecording}
            style={{
              width: 40, height: 40, borderRadius: 20,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: isRecording ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: isRecording ? '#EF4444' : 'transparent',
            }}
          >
            <Mic size={18} color={isRecording ? '#EF4444' : colors.muted} />
          </Pressable>

          {/* Enviar */}
          <Pressable
            onPress={() => sendChat()}
            disabled={!canSend}
            style={{
              width: 40, height: 40, borderRadius: 20,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: canSend ? '#7B3FF2' : 'rgba(123,63,242,0.2)',
            }}
          >
            {streaming
              ? <ActivityIndicator size="small" color="#fff" />
              : <Send size={18} color={canSend ? '#fff' : 'rgba(255,255,255,0.35)'} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ── MENU 3 PONTOS ───────────────────────────────────────────────── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: insets.bottom + 12,
              paddingTop: 8,
            }}
          >
            {/* Puxador */}
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignSelf: 'center', marginBottom: 16,
            }} />

            {/* Título */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 12,
              borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)', marginBottom: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Opções do chat</Text>
            </View>

            {/* Opção: Nova conversa */}
            {[
              {
                icon: <MessageSquarePlus size={20} color="#7B3FF2" />,
                label: 'Nova conversa',
                sub: 'Apaga o histórico e começa do zero',
                onPress: handleNewConversation,
                danger: false,
              },
              {
                icon: <TrendingUp size={20} color="#F59E0B" />,
                label: 'Tendências',
                sub: 'Vê os tópicos mais populares agora',
                onPress: handleTrends,
                danger: false,
              },
              {
                icon: <Text style={{ fontSize: 18 }}>🤖</Text>,
                label: 'Agentes IA',
                sub: 'Escolhe um especialista (12 modos)',
                onPress: handleOpenAgents,
                danger: false,
              },
              {
                icon: <ImageIcon size={20} color="#EC4899" />,
                label: 'Gerar imagem',
                sub: 'Cria imagens com IA em segundos',
                onPress: handleGoGenerateImage,
                danger: false,
              },
              {
                icon: <Video size={20} color="#06B6D4" />,
                label: 'Gerar vídeo',
                sub: 'Transforma texto em vídeo com IA',
                onPress: handleGoGenerateVideo,
                danger: false,
              },
              {
                icon: <PhoneCall size={20} color="#22C55E" />,
                label: 'Chamada com a Aura',
                sub: 'Fala com a Aura em tempo real',
                onPress: startCall,
                danger: false,
              },
              {
                icon: <ShareIcon size={20} color="#60A5FA" />,
                label: 'Partilhar conversa',
                sub: 'Envia o chat para outra app',
                onPress: handleShareConversation,
                danger: false,
              },
              {
                icon: <Copy size={20} color="#94A3B8" />,
                label: 'Copiar conversa',
                sub: 'Copia todo o texto para a área de transferência',
                onPress: handleCopyAll,
                danger: false,
              },
              {
                icon: <Trash size={20} color="#EF4444" />,
                label: 'Limpar memória',
                sub: 'Remove todas as mensagens guardadas',
                onPress: handleNewConversation,
                danger: true,
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                className="active:opacity-60"
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  paddingHorizontal: 20, paddingVertical: 14,
                }}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: item.danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.icon}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700',
                    color: item.danger ? '#EF4444' : colors.text }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                    {item.sub}
                  </Text>
                </View>
              </Pressable>
            ))}

            {/* Sobre a Aura */}
            <Pressable
              onPress={() => setMenuVisible(false)}
              className="active:opacity-60"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                paddingHorizontal: 20, paddingVertical: 14,
                marginTop: 4, borderTopWidth: 0.5,
                borderTopColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: 'rgba(123,63,242,0.12)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Info size={20} color="#C4B5FD" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Sobre a Aura</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  IA angolana da Ziva · Versão Premium
                </Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── MODAL SELETOR DE AGENTES ────────────────────────────────────── */}
      <Modal
        visible={agentVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAgentVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
          onPress={() => setAgentVisible(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingBottom: insets.bottom + 16, paddingTop: 8,
            maxHeight: '75%',
          }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>🤖 Agentes IA</Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Escolhe um especialista para esta conversa</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, gap: 8 }}>
              {AGENTS.map((agent) => {
                const isActive = activeAgent.id === agent.id;
                return (
                  <Pressable
                    key={agent.id}
                    className="active:opacity-70"
                    onPress={() => {
                      setActiveAgent(agent);
                      setAgentVisible(false);
                      // Abre novo chat adaptado ao agente seleccionado
                      abortRef.current?.abort();
                      setStreaming(false);
                      setInput('');
                      setAttachedImage(null);
                      const welcomes: Record<string, string> = {
                        general:    `Olá! 👋 Sou a Aura, a tua assistente IA completa.\nComo posso ajudar-te hoje?`,
                        programmer: `💻 Modo Programador activado!\nColoca aqui o teu código, erro ou desafio técnico. Vamos resolver juntos!`,
                        designer:   `🎨 Modo Designer activado!\nFala-me sobre o teu projecto — cores, marca, layout ou UX. Estou pronta para criar!`,
                        researcher: `🔬 Modo Investigador activado!\nQual é o tema que queres explorar? Faço pesquisa aprofundada com rigor e factos.`,
                        writer:     `✍️ Modo Escritor activado!\nQue tipo de texto precisas? Artigo, história, guião, carta? Diz-me o objectivo e começo já.`,
                        analyst:    `📊 Modo Analista activado!\nPartilha os teus dados, métricas ou relatório. Transformo números em insights accionáveis.`,
                        translator: `🌍 Modo Tradutor activado!\nEnvia o texto que precisas traduzir e indica o idioma de destino. Conheço português, inglês, francês, Kimbundu e muito mais.`,
                        content:    `🎬 Modo Conteúdo activado!\nPara que plataforma criamos? Instagram, TikTok, YouTube? Qual é a marca ou o tema?`,
                        marketing:  `📣 Modo Marketing activado!\nQual é o produto ou serviço? Vamos criar uma estratégia de comunicação que converte!`,
                        support:    `🤝 Modo Atendimento activado!\nOlá! Em que posso ajudar-te hoje? Estou aqui para resolver qualquer situação com calma e atenção.`,
                        planner:    `🗓️ Modo Planeador activado!\nQual é o objectivo ou projecto a planear? Crio roadmaps, cronogramas e listas de prioridades.`,
                        projects:   `🏗️ Modo Gestor de Projectos activado!\nDescreve o teu projecto — equipa, prazo, âmbito. Organizo tudo com metodologia e clareza.`,
                      };
                      const welcome = welcomes[agent.id] ?? `${agent.emoji} Modo ${agent.name} activado!\n${agent.description}. Como posso ajudar?`;
                      setMessages([{ id: '0', role: 'assistant', content: welcome }]);
                      if (userId) {
                        supabase.from('ziva_conversations').delete().eq('user_id', userId);
                      }
                    }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      padding: 14, borderRadius: 16,
                      backgroundColor: isActive ? `${agent.color}18` : 'rgba(255,255,255,0.04)',
                      borderWidth: 1.5,
                      borderColor: isActive ? `${agent.color}66` : 'rgba(255,255,255,0.07)',
                    }}
                  >
                    <View style={{
                      width: 46, height: 46, borderRadius: 14,
                      backgroundColor: `${agent.color}22`,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 22 }}>{agent.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: isActive ? agent.color : colors.text }}>{agent.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{agent.description}</Text>
                    </View>
                    {isActive && (
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: agent.color, alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={13} color="#fff" strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── MODAL TENDÊNCIAS ────────────────────────────────────────────── */}
      <Modal
        visible={trendsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTrendsVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setTrendsVisible(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingBottom: insets.bottom + 16, paddingTop: 8,
            maxHeight: '60%',
          }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
              <TrendingUp size={20} color="#F59E0B" />
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Tendências agora</Text>
            </View>
            {trendsLoading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ActivityIndicator color="#F59E0B" />
                <Text style={{ color: colors.muted, marginTop: 10, fontSize: 13 }}>A carregar tendências…</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 10 }}>
                {trends.map((tag, i) => (
                  <Pressable
                    key={tag}
                    className="active:opacity-60"
                    onPress={() => {
                      setTrendsVisible(false);
                      setInput(`Diz-me mais sobre o tópico ${tag} em Angola`);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)' }}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#F59E0B' }}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{tag}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Toca para perguntar à Aura</Text>
                    </View>
                    <Send size={14} color={colors.muted} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── MODAL CHAMADA DE VOZ ─────────────────────────────────────────── */}
      <Modal
        visible={callVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={endCall}
      >
        <View style={{ flex: 1, backgroundColor: '#0D0D1A', alignItems: 'center', justifyContent: 'space-between', paddingBottom: insets.bottom + 32, paddingTop: insets.top + 24 }}>
          {/* Header */}
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600', letterSpacing: 1 }}>CHAMADA COM A AURA</Text>
            <Text style={{ fontSize: 22, color: '#fff', fontWeight: '400' }}>{formatCallTime(callSeconds)}</Text>
          </View>

          {/* Avatar */}
          <View style={{ alignItems: 'center', gap: 20 }}>
            <View style={{
              width: 130, height: 130, borderRadius: 65,
              backgroundColor: '#7B3FF2',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 40, elevation: 20,
            }}>
              <Svg width={70} height={70} viewBox="0 0 24 24" fill="none">
                <Path d="M13 2L4.5 13.5H11L9 22L19.5 10H13L13 2Z" fill="#fff" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>

            {/* Status */}
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff' }}>Aura</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {callStatus === 'idle' && <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Toca no microfone para falar</Text>}
                {callStatus === 'listening' && (
                  <>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
                    <Text style={{ fontSize: 14, color: '#22C55E', fontWeight: '700' }}>A ouvir…</Text>
                  </>
                )}
                {callStatus === 'thinking' && (
                  <>
                    <ActivityIndicator size="small" color="#C4B5FD" />
                    <Text style={{ fontSize: 14, color: '#C4B5FD' }}>A pensar…</Text>
                  </>
                )}
                {callStatus === 'speaking' && (
                  <>
                    <Volume size={16} color="#7B3FF2" />
                    <Text style={{ fontSize: 14, color: '#C4B5FD', fontWeight: '700' }}>A falar…</Text>
                  </>
                )}
              </View>

              {/* Resposta da Aura */}
              {callResponse !== '' && (
                <View style={{ marginTop: 12, maxWidth: 300, backgroundColor: 'rgba(123,63,242,0.15)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)' }}>
                  <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 }} numberOfLines={5}>{callResponse}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Controlos */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 28 }}>
            <Pressable
              className="active:opacity-70"
              onPress={callRecording ? stopCallRecording : startCallRecording}
              disabled={callStatus === 'thinking' || callStatus === 'speaking'}
              style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: callRecording ? '#22C55E' : 'rgba(255,255,255,0.12)',
                alignItems: 'center', justifyContent: 'center',
                opacity: (callStatus === 'thinking' || callStatus === 'speaking') ? 0.4 : 1,
              }}
            >
              {callRecording ? <MicOff size={28} color="#fff" /> : <Mic size={28} color="#fff" />}
            </Pressable>

            <Pressable
              className="active:opacity-70"
              onPress={endCall}
              style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}
            >
              <PhoneOff size={32} color="#fff" />
            </Pressable>

            <Pressable
              className="active:opacity-70"
              onPress={endCall}
              style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
            >
              <XIcon size={28} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
