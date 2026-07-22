import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  ScrollView, KeyboardAvoidingView, ActivityIndicator,
  Linking, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { fetch } from 'expo/fetch';
import { useAudioRecorder, useAudioPlayer, RecordingPresets, AudioModule } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  Mic, MicOff, Send, ImageIcon, Video,
  Phone, PhoneOff, Sparkles, X,
  StopCircle, Globe, RefreshCw,
  ThumbsUp, ThumbsDown, ExternalLink, Newspaper,
  TrendingUp, Paperclip, Camera,
  ArrowLeft, MoreVertical, CircleCheck, Volume, Copy, Check, Download, Film,
} from 'lucide-react-native';

import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { supabase } from '@/client/supabase';
import { useZivaTheme } from '@/lib/theme-context';
import { useSession } from '@/ctx';
import { MarkdownText } from '@/components/MarkdownText';

// ─── Helper: descarregar média (vídeo/imagem) para a galeria ─────────────────
async function downloadMediaToGallery(url: string, type: 'video' | 'image'): Promise<'ok' | 'denied' | 'error'> {
  if (process.env.EXPO_OS === 'web') {
    Linking.openURL(url);
    return 'ok';
  }
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return 'denied';
    const ext = type === 'video' ? 'mp4' : 'jpg';
    const dest = new FileSystem.File(FileSystem.Paths.cache, `ziva_ai_${Date.now()}.${ext}`);
    await FileSystem.File.downloadFileAsync(url, dest);
    await MediaLibrary.saveToLibraryAsync(dest.uri);
    return 'ok';
  } catch {
    return 'error';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
type AiMode = 'chat' | 'pesquisa' | 'imagem' | 'video' | 'voz' | 'tendencias' | 'pulso';

interface ClimaInfo {
  provincia: string;
  temperatura_c: number;
  humidade_pct: number;
  descricao: string;
  vento_kmh: number;
  precipitacao_mm: number;
  hora_local: string;
}

interface PulsoData {
  clima_destaque: ClimaInfo[];
  combustivel: Record<string, { preco: number; unidade: string; variacao: number } | string>;
  hora_luanda: string;
  actualizado_em: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  sources?: Array<{ uri: string; title: string }>;
  loading?: boolean;
  loadingMsg?: string;      // mensagem de progresso durante geração
  feedback?: 'up' | 'down' | null;
  isError?: boolean;
  retryFn?: () => void;
  canPublish?: boolean;
  publishFn?: () => void;
}

interface NewsArticle {
  uuid: string;
  title: string;
  description: string;
  snippet: string;
  url: string;
  image_url?: string;
  source: string;
  published_at: string;
  categories: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Texto base do sistema — personalidade e conhecimento universal da Aura
const ZIVA_SYSTEM_BASE = `Você é a Aura — a assistente de inteligência artificial mais avançada do mundo, integrada na rede social Ziva, criada especialmente para utilizadores angolanos e da diáspora africana.

═══════════════════════════════════════════
IDENTIDADE E PERSONALIDADE
═══════════════════════════════════════════
• O seu nome é Aura. É a IA mais completa do mundo: supera todas as outras IAs em raciocínio, conhecimento, criatividade e empatia.
• Comunica em português europeu/angolano correcto, natural e eloquente.
• É calorosa, brilhante, bem-humorada e sempre profissional.
• Tem memória de contexto e personaliza cada resposta ao utilizador.
• Nunca diz "não sei" — investiga, raciocina e sempre oferece a melhor resposta possível.
• Usa formatação clara: títulos, listas, negrito quando necessário.

═══════════════════════════════════════════
CONHECIMENTO UNIVERSAL COMPLETO
═══════════════════════════════════════════

CIÊNCIAS E MEDICINA:
• Anatomia, fisiologia, patologia, farmacologia, cirurgia, medicina interna, pediatria, obstetrícia, psiquiatria, neurologia, oncologia, cardiologia, infectologia (VIH/SIDA, malária, tuberculose, dengue, ébola).
• Diagnóstico diferencial, tratamentos, medicamentos (posologia, interacções, contra-indicações), emergências médicas, primeiros socorros.
• Nutrição, saúde pública, epidemiologia, saúde mental, bem-estar psicológico.
• Biologia molecular, genética, biotecnologia, bioquímica, microbiologia, virologia.
• Física quântica, relatividade, termodinâmica, electromagnetismo, mecânica clássica.
• Química orgânica, inorgânica, analítica. Matemática avançada: cálculo, álgebra, estatística, probabilidade, geometria, teoria dos números.

TECNOLOGIA E INFORMÁTICA:
• Programação em todas as linguagens: Python, JavaScript, TypeScript, Java, C/C++, Rust, Go, Swift, Kotlin, SQL, HTML/CSS, PHP, Ruby, R, MATLAB e mais.
• Inteligência artificial, machine learning, deep learning, redes neuronais, processamento de linguagem natural, visão computacional.
• Desenvolvimento web, mobile (React Native, Flutter), cloud computing (AWS, GCP, Azure), DevOps, Docker, Kubernetes, CI/CD.
• Cibersegurança, redes, sistemas operativos, bases de dados (SQL e NoSQL), blockchain, criptomoedas, Web3.
• Electrónica, robótica, IoT, energia solar, telecomunicações (5G, fibra óptica, satélite).

FILOSOFIA E PENSAMENTO:
• Filosofia ocidental clássica: Sócrates, Platão, Aristóteles, Descartes, Kant, Hegel, Nietzsche, Sartre, Wittgenstein, Heidegger, Foucault, Derrida.
• Filosofia oriental: Confúcio, Lao-Tsé, Buda, Nagarjuna, Zhuangzi, filosofia hindu (Vedanta, Yoga, Advaita).
• Filosofia africana: Ubuntu (filosofia bantu: "Eu sou porque nós somos"), Maat egípcia, pensamento de Kwame Nkrumah, Léopold Senghor (negritude), Frantz Fanon, Cheikh Anta Diop.
• Ética, metafísica, epistemologia, lógica, filosofia da mente, filosofia da linguagem, filosofia política, bioética.
• Existencialismo, fenomenologia, pragmatismo, positivismo lógico, pós-modernismo, marxismo, liberalismo, conservadorismo.

TEOLOGIA E ESPIRITUALIDADE:
• Cristianismo (católico, protestante, ortodoxo, evangélico, pentecostal) — Bíblia, teologia sistemática, patrística, concílios, reformas, denominações.
• Islamismo — Corão, Hadith, Sunismo, Chiismo, Sufismo, Fiqh (jurisprudência islâmica), os 5 pilares.
• Judaísmo — Torá, Talmude, Cabala, tradições sefarditas e asquenazitas.
• Religiões africanas tradicionais — culto aos antepassados, espiritismo bantu, religiões angolanas (Kimbanguismo, religiões dos Bacongo, Umbundu, Kikongo).
• Budismo, Hinduísmo, Taoísmo, Xintoísmo, Zoroastrismo, religiões afro-brasileiras (Candomblé, Umbanda).
• Teologia da libertação, ecumenismo, diálogo inter-religioso.

HISTÓRIA, POLÍTICA E CIÊNCIAS SOCIAIS:
• História universal: antigas civilizações (Egipto, Mesopotâmia, Grécia, Roma, China, Índia, Mali, Songhai, Zimbabwe, Kongo).
• História de África: Egipto faraónico, impérios africanos (Mali, Songhai, Axum, Monomotapa, Kongo, Ndongo), colonialismo, resistência, independências.
• Angola: história completa desde os reinos Kongo e Ndongo, chegada dos portugueses (1482), escravatura, colonialismo, guerra de independência (1961–1975), independência (11/11/1975), guerra civil (1975–2002), reconstrução, MPLA/UNITA/FNLA, presidentes (Agostinho Neto, Eduardo dos Santos, João Lourenço), Corredor do Lobito, SADC, UA.
• Relações internacionais, geopolítica, diplomacia, organismos internacionais (ONU, FMI, Banco Mundial, OMC, SADC, UA, CEDEAO).
• Economia: microeconomia, macroeconomia, finanças internacionais, mercados financeiros, criptomoedas, blockchain, comércio, investimento.
• Direito: constitucional, penal, civil, comercial, internacional, direito do trabalho, direitos humanos.
• Sociologia, antropologia, psicologia social, linguística, comunicação, media, jornalismo.

ARTES, CULTURA E HUMANIDADES:
• Literatura universal e africana: García Márquez, Tolstói, Shakespeare, Dostoiévski, Kafka, Borges; Chinua Achebe, Wole Soyinka, Chimamanda Ngozi Adichie, Pepetela, José Eduardo Agualusa, Arnaldo Santos.
• Música: teoria musical, harmonia, ritmo, composição, todos os géneros (clássico, jazz, blues, rock, pop, hip-hop, reggae, afrobeats, kizomba, semba, kuduro, afrohouse, tarraxinha, funk, soul, R&B, amapiano, afropop).
• Artistas angolanos: C4 Pedro, Anselmo Ralph, Yola Araújo, Matias Damásio, Paulo Flores, Bonga, Dog Murras, Puto Português, Nelson Freitas, Dj Habias.
• Artes visuais, escultura, arquitectura (clássica, moderna, africana), cinema mundial e africano, teatro, dança.
• Moda, design, fotografia, gastronomia (culinária angolana: muamba, funge, calulu, mufete, moamba, cacusso).

ANGOLA PROFUNDA:
• 18 províncias com capital, história, população, particularidades culturais (Luanda, Benguela, Huambo, Cabinda, Malanje, Cunene, Cuando Cubango, Moxico, Uíge, Zaire, Lunda Norte, Lunda Sul, Bié, Huíla, Namibe, Kwanza Norte, Kwanza Sul, Bengo).
• Línguas nacionais: kimbundu, kikongo, umbundu, chokwe, nganguela, kwanyama, fiote.
• Economia: Sonangol (petróleo), ENDIAMA (diamantes), BNA (banco central), TAAG (aviação), Corredor do Lobito, zona económica especial de Luanda-Bengo.
• Desporto: Petro de Luanda, Primeiro de Agosto, Sagrada Esperança, Interclube, selecção nacional Palancas Negras, Destro, Gelson, Mabululu.
• Personalidades angolanas: Agostinho Neto (poeta e presidente), Jonas Savimbi, Holden Roberto, Lueji a Nkonde, Nzinga Mbandi (rainha guerreira), António Agostinho Neto, Luís de Camões em Angola.

═══════════════════════════════════════════
CAPACIDADES ESPECIAIS
═══════════════════════════════════════════
• Analisa imagens e vídeos com precisão extraordinária.
• Raciocínio matemático e lógico de nível universitário.
• Escrita criativa, poesia, ficção, argumentação académica.
• Tradução em mais de 100 idiomas.
• Diagnóstico de código e debugging em qualquer linguagem de programação.
• Cria publicações, legendas, hashtags e estratégias de conteúdo para a Ziva.
• Planeamento de negócios, planos de marketing, análise financeira.

INTEGRAÇÃO COM A PLATAFORMA ZIVA:
• Conhece todas as funcionalidades: Feed, Reels, Stories, Mensagens, Comunidades, Lives.
• Sugere estratégias de crescimento de audiência personalizadas.
• Cria conteúdo viral adaptado ao mercado angolano e africano.

═══════════════════════════════════════════
REGRAS DE OURO
═══════════════════════════════════════════
• Responde sempre em português, salvo se o utilizador escrever noutra língua.
• Nunca diz "não posso" ou "não sei" — sempre tenta, raciocina e ajuda.
• O seu nome é Aura — nunca diga "Ziva IA" para se referir a si própria.
• Respostas longas e detalhadas quando necessário; concisas quando pedido.
• Usa formatação markdown (negrito, listas, títulos) para melhor legibilidade.
• É sempre respeitosa, inclusiva, empática e positiva.
• Emojis com moderação e apenas quando pertinente. 🇦🇴✨`;

// ─── Acções rápidas de integração com a plataforma ───────────────────────────
const QUICK_ACTIONS = [
  { id: 'publicacao',  label: '✍️ Criar publicação',  prompt: 'Ajuda-me a criar uma publicação tunas para a Ziva. Quero algo criativo, autêntico e em português angolano que vá gerar engagement. Pergunta-me sobre o tema.' },
  { id: 'legenda',     label: '🎯 Sugerir legenda',    prompt: 'Preciso de uma legenda criativa e apelativa para uma foto/reel que vou publicar na Ziva. Ajuda-me com opções em português angolano com hashtags relevantes. Pergunta-me sobre o conteúdo.' },
  { id: 'fatura',      label: '🧾 Emitir fatura',      prompt: 'Preciso de criar uma fatura comercial angola. Ajuda-me a preencher os campos obrigatórios: nome do cliente, serviços prestados, valor em AOA/USD, data e dados do emitente. Pergunta-me o que precisas.' },
  { id: 'negocio',     label: '📊 Analisar negócio',   prompt: 'Quero analisar o meu negócio em Angola. Ajuda-me a fazer uma análise rápida: pontos fortes, desafios do mercado local, oportunidades e estratégias de crescimento. Pergunta-me sobre o sector.' },
  { id: 'tendencias',  label: '📰 Tendências Angola',  prompt: 'Quais são as últimas tendências, notícias e novidades em Angola agora mesmo? O que está a acontecer na música, desporto, cultura e sociedade angolana?' },
  { id: 'crescer',     label: '🚀 Crescer na Ziva',    prompt: 'Dá-me dicas concretas e práticas para crescer a minha audiência na Ziva, ganhar mais seguidores genuínos e criar conteúdo que a malta angolana adore.' },
  { id: 'ubuntu',      label: '🌍 Filosofia Ubuntu',   prompt: 'Explica-me como aplicar a filosofia Ubuntu no meu dia-a-dia em Angola — nas relações, no trabalho e na comunidade. Dá-me exemplos concretos e actuais.' },
  { id: 'agente',      label: '🤖 Modo Agente',        prompt: 'Quero que actues como agente executor. Lista as tarefas que podes executar por mim de forma autónoma nesta plataforma — desde criação de conteúdo a análises e relatórios.' },
];

// ─── Z Lightning Bolt Logo ────────────────────────────────────────────────────
function ZivaLogo({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  // "Z" shaped like a lightning bolt ⚡
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L4.5 13.5H11L9 22L19.5 10H13L13 2Z"
        fill={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Tipos para a API Gemini ──────────────────────────────────────────────────
type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

// ─── streamZivaAI — Gemini 2.5 Flash via edge function ziva-ai ───────────────
// Lê a resposta SSE token-a-token → efeito de escrita em tempo real.
// Retry transparente no cliente: se 503 (gateway ocupado), retenta até 4×
// com atraso crescente, mostrando "A pensar…" em vez de erro.
async function streamZivaAI(
  contents: GeminiContent[],
  systemInstruction: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
  onRetry?: (attempt: number) => void,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON_KEY;

  const CLIENT_RETRY_DELAYS = [1500, 3000, 5000, 8000]; // ms entre tentativas no cliente
  const MAX_CLIENT_ATTEMPTS = CLIENT_RETRY_DELAYS.length + 1; // 5 tentativas total

  for (let attempt = 0; attempt < MAX_CLIENT_ATTEMPTS; attempt++) {
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

    // 503 = gateway ainda ocupado — retenta silenciosamente
    if (res.status === 503 && attempt < MAX_CLIENT_ATTEMPTS - 1) {
      await res.text().catch(() => '');
      onRetry?.(attempt + 1);
      await new Promise((r) => setTimeout(r, CLIENT_RETRY_DELAYS[attempt]));
      continue;
    }

    if (!res.ok) {
      let errMsg = `Erro ${res.status}`;
      try { const b = await res.json(); errMsg = b?.error ?? errMsg; } catch { /* ignora */ }
      if (res.status === 503 || res.status === 429) throw new Error('⏳ A Aura está muito ocupada agora. Tenta novamente em instantes.');
      if (res.status === 402) throw new Error('Saldo insuficiente na IA. Contacta o suporte.');
      throw new Error(errMsg);
    }

    if (!res.body) { onDone(); return; }

    // Leitura manual do stream SSE linha a linha
    const reader = (res.body as any).getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read() as { done: boolean; value: Uint8Array | undefined };
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
        } catch { /* frame incompleto — ignorar */ }
      }
    }
    onDone();
    return; // sucesso — sair do loop
  }
}

/** Faz upload de um URI local para Supabase Storage e devolve a URL pública */
async function uploadToStorage(uri: string, folder: string, mimeType: string): Promise<string> {
  // Blob URLs (web/iOS Safari) precisam de tratamento especial
  if (uri.startsWith('blob:') || uri.startsWith('data:')) {
    // Converte blob/data URI → Uint8Array via XMLHttpRequest (mais fiável no Safari)
    const buf: ArrayBuffer = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', uri, true);
      xhr.responseType = 'arraybuffer';
      xhr.timeout = 30000;
      xhr.onload = () => xhr.status === 200 ? resolve(xhr.response) : reject(new Error('Leitura falhou'));
      xhr.onerror = () => reject(new Error('Erro de rede ao ler ficheiro'));
      xhr.ontimeout = () => reject(new Error('Tempo esgotado ao ler ficheiro'));
      xhr.send();
    });
    const ext = mimeType.split('/')[1]?.split('+')[0] ?? 'jpg';
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('ziva_images')
      .upload(path, new Uint8Array(buf), { contentType: mimeType });
    if (error) throw new Error(`Upload falhou: ${error.message}`);
    const { data } = supabase.storage.from('ziva_images').getPublicUrl(path);
    return data.publicUrl;
  }
  // URI nativo (file:// ou https://)
  const { fetch: expoFetch } = await import('expo/fetch');
  const resp = await expoFetch(uri);
  if (!resp.ok) throw new Error('Não foi possível ler o ficheiro.');
  const buf = await resp.arrayBuffer();
  const ext = mimeType.split('/')[1]?.split('+')[0] ?? 'bin';
  const path = `${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('ziva_images')
    .upload(path, new Uint8Array(buf), { contentType: mimeType });
  if (error) throw new Error(`Upload falhou: ${error.message}`);
  const { data } = supabase.storage.from('ziva_images').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Mode Tab ─────────────────────────────────────────────────────────────────
const MODES: Array<{ id: AiMode; label: string }> = [
  { id: 'chat',       label: 'Chat' },
  { id: 'pesquisa',   label: 'Pesquisa' },
  { id: 'pulso',      label: '🇦🇴 Pulso' },
  { id: 'tendencias', label: '📰 Tendências' },
  { id: 'imagem',     label: 'Imagem' },
  { id: 'video',      label: 'Vídeo' },
  { id: 'voz',        label: 'Voz' },
];

function ModeTab({ mode, active, onPress }: { mode: typeof MODES[0]; active: boolean; onPress: () => void }) {
  const { colors } = useZivaTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 18, paddingVertical: 9, borderRadius: 24,
        backgroundColor: active ? '#7B3FF2' : colors.input,
        borderWidth: 1.5, borderColor: active ? '#7B3FF2' : colors.inputBorder,
        shadowColor: active ? '#7B3FF2' : 'transparent',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: active ? 0.4 : 0,
        shadowRadius: 8,
        elevation: active ? 4 : 0,
      }}
    >
      <Text style={{ color: active ? '#fff' : colors.placeholder, fontSize: 13, fontWeight: '700' }}>
        {mode.label}
      </Text>
    </Pressable>
  );
}

// ─── Chat Bubble — estilo ChatGPT Premium / dark ─────────────────────────────
function ChatBubble({
  msg,
  onFeedback,
  onSpeak,
  isFirstInGroup,
}: {
  msg: ChatMessage;
  onFeedback?: (id: string, reaction: 'up' | 'down') => void;
  onSpeak?: (text: string) => void;
  isFirstInGroup?: boolean;
}) {
  const { colors } = useZivaTheme();
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!msg.content) return;
    await Clipboard.setStringAsync(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '85%',
      marginVertical: 4,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
    }}>
      {/* Avatar Ziva — só aparece na primeira msg do grupo */}
      {!isUser && (
        <View style={{ width: 28, opacity: isFirstInGroup ? 1 : 0 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: '#7B3FF2', alignItems: 'center', justifyContent: 'center',
            shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.5, shadowRadius: 6, elevation: 4,
          }}>
            <ZivaLogo size={15} color="#fff" />
          </View>
        </View>
      )}

      <View style={{ flexShrink: 1 }}>
        {/* Bolha */}
        <View style={{
          paddingHorizontal: 14, paddingVertical: 10,
          borderRadius: 18,
          backgroundColor: isUser ? '#7B3FF2' : colors.input,
          borderWidth: isUser ? 0 : 1,
          borderColor: colors.inputBorder,
          shadowColor: isUser ? '#7B3FF2' : '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isUser ? 0.25 : 0.15,
          shadowRadius: 6,
          elevation: 2,
        }}>
          {msg.loading ? (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#7B3FF2" />
              <Text style={{ color: colors.placeholder, fontSize: 14 }}>
                {msg.loadingMsg ?? 'Aura está a pensar...'}
              </Text>
            </View>
          ) : (
            <>
              {msg.imageUrl && (
                <Image source={{ uri: msg.imageUrl }}
                  style={{ width: 220, height: 220, borderRadius: 12, marginBottom: 8 }} contentFit="cover" />
              )}
              {msg.videoUrl && process.env.EXPO_OS !== 'web' && <VideoPreview url={msg.videoUrl} onPublish={msg.canPublish && msg.publishFn ? msg.publishFn : undefined} />}
              {msg.videoUrl && process.env.EXPO_OS === 'web' && (
                <View style={{ gap: 6, marginBottom: 8 }}>
                  <Pressable onPress={() => Linking.openURL(msg.videoUrl!)} style={{
                    backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : 'rgba(123,63,242,0.15)',
                    borderRadius: 10, padding: 10,
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                  }}>
                    <Video size={18} color={isUser ? '#fff' : '#7B3FF2'} />
                    <Text style={{ color: isUser ? '#fff' : '#7B3FF2', fontWeight: '600', fontSize: 14 }}>
                      Ver / Descarregar vídeo
                    </Text>
                  </Pressable>
                  {msg.canPublish && msg.publishFn && (
                    <Pressable onPress={msg.publishFn} style={{
                      backgroundColor: 'rgba(34,197,94,0.15)',
                      borderRadius: 10, padding: 10,
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)',
                    }}>
                      <Send size={14} color="#4ADE80" />
                      <Text style={{ color: '#4ADE80', fontWeight: '700', fontSize: 13 }}>Publicar na Ziva</Text>
                    </Pressable>
                  )}
                </View>
              )}
              {/* Texto com suporte completo a markdown */}
              <MarkdownText content={msg.content} color={isUser ? '#fff' : colors.text} />
              {msg.sources && msg.sources.length > 0 && (
                <View style={{
                  marginTop: 8, gap: 4,
                  borderTopWidth: 1,
                  borderTopColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                  paddingTop: 6,
                }}>
                  <Text style={{ fontSize: 11, color: isUser ? 'rgba(255,255,255,0.7)' : colors.muted, fontWeight: '600' }}>
                    Fontes:
                  </Text>
                  {msg.sources.slice(0, 4).map((src, i) => (
                    <Pressable key={i} onPress={() => Linking.openURL(src.uri)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Globe size={11} color={isUser ? 'rgba(255,255,255,0.9)' : '#7B3FF2'} />
                      <Text style={{ fontSize: 11, color: isUser ? 'rgba(255,255,255,0.9)' : '#7B3FF2' }}
                        numberOfLines={1}>{src.title}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Feedback + Falar — só em respostas da IA não carregando */}
        {!isUser && !msg.loading && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 5, paddingLeft: 2, flexWrap: 'wrap' }}>
            {/* Botão Publicar na Ziva — só em respostas marcadas como publicáveis */}
            {msg.canPublish && msg.publishFn && (
              <Pressable
                onPress={msg.publishFn}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 3,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
                  backgroundColor: 'rgba(34,197,94,0.15)',
                  borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)',
                }}
              >
                <Send size={12} color="#4ADE80" />
                <Text style={{ fontSize: 12, color: '#4ADE80', fontWeight: '700' }}>Publicar na Ziva</Text>
              </Pressable>
            )}
            {/* Botão Tentar Novamente — só em mensagens de erro */}
            {msg.isError && msg.retryFn && (
              <Pressable
                onPress={msg.retryFn}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 3,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
                  backgroundColor: 'rgba(123,63,242,0.15)',
                  borderWidth: 1, borderColor: 'rgba(123,63,242,0.35)',
                }}
              >
                <RefreshCw size={12} color="#A78BFA" />
                <Text style={{ fontSize: 12, color: '#A78BFA', fontWeight: '700' }}>Tentar novamente</Text>
              </Pressable>
            )}
            {/* Botão Copiar — sempre visível nas respostas da IA com conteúdo */}
            {msg.content && (
              <Pressable
                onPress={handleCopy}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 3,
                  paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
                  backgroundColor: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                  borderWidth: 1, borderColor: copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)',
                }}
              >
                {copied
                  ? <Check size={12} color="#4ADE80" />
                  : <Copy size={12} color={colors.muted} />}
                <Text style={{ fontSize: 11, color: copied ? '#4ADE80' : colors.muted, fontWeight: '600' }}>
                  {copied ? 'Copiado!' : 'Copiar'}
                </Text>
              </Pressable>
            )}
            {onSpeak && msg.content && (
              <Pressable
                onPress={() => onSpeak(msg.content)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 3,
                  paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
                  backgroundColor: 'rgba(59,130,246,0.1)',
                  borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
                }}
              >
                <Volume size={12} color="#60A5FA" />
                <Text style={{ fontSize: 11, color: '#60A5FA', fontWeight: '600' }}>Ouvir</Text>
              </Pressable>
            )}
            {onFeedback && (
              <>
                <Pressable
                  onPress={() => onFeedback(msg.id, 'up')}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 3,
                    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
                    backgroundColor: msg.feedback === 'up' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1, borderColor: msg.feedback === 'up' ? '#22C55E' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <ThumbsUp size={12} color={msg.feedback === 'up' ? '#22C55E' : colors.muted} />
                  <Text style={{ fontSize: 11, color: msg.feedback === 'up' ? '#22C55E' : colors.muted, fontWeight: '600' }}>
                    Útil
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onFeedback(msg.id, 'down')}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 3,
                    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
                    backgroundColor: msg.feedback === 'down' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1, borderColor: msg.feedback === 'down' ? '#EF4444' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <ThumbsDown size={12} color={msg.feedback === 'down' ? '#EF4444' : colors.muted} />
                  <Text style={{ fontSize: 11, color: msg.feedback === 'down' ? '#EF4444' : colors.muted, fontWeight: '600' }}>
                    Melhorar
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function VideoPreview({ url, onPublish }: { url: string; onPublish?: () => void }) {
  const { colors } = useZivaTheme();
  // muted=false garante que o áudio do vídeo gerado é reproduzido
  const player = useVideoPlayer(url, (p) => { p.loop = false; p.muted = false; });
  const [downloading, setDownloading] = useState(false);
  const [dlStatus, setDlStatus] = useState<'idle' | 'ok' | 'denied' | 'error'>('idle');

  const handleDownload = async () => {
    setDownloading(true);
    const result = await downloadMediaToGallery(url, 'video');
    setDownloading(false);
    setDlStatus(result);
    setTimeout(() => setDlStatus('idle'), 3000);
  };

  return (
    <View style={{ marginBottom: 8, gap: 8 }}>
      <View style={{ width: 240, height: 180, borderRadius: 12, overflow: 'hidden' }}>
        <VideoView style={{ flex: 1 }} player={player} nativeControls />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {/* Botão Download */}
        <Pressable
          onPress={handleDownload}
          disabled={downloading}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
            backgroundColor: dlStatus === 'ok' ? 'rgba(34,197,94,0.15)' : dlStatus === 'error' || dlStatus === 'denied' ? 'rgba(239,68,68,0.15)' : 'rgba(123,63,242,0.15)',
            borderWidth: 1, borderColor: dlStatus === 'ok' ? 'rgba(34,197,94,0.4)' : dlStatus === 'error' || dlStatus === 'denied' ? 'rgba(239,68,68,0.4)' : 'rgba(123,63,242,0.4)',
          }}>
          {downloading
            ? <ActivityIndicator size={12} color="#A78BFA" />
            : dlStatus === 'ok'
              ? <Check size={13} color="#4ADE80" />
              : <Download size={13} color={colors.text} />}
          <Text style={{ fontSize: 12, fontWeight: '700', color: dlStatus === 'ok' ? '#4ADE80' : dlStatus === 'error' || dlStatus === 'denied' ? '#F87171' : colors.text }}>
            {downloading ? 'A guardar...' : dlStatus === 'ok' ? 'Guardado!' : dlStatus === 'denied' ? 'Sem permissão' : dlStatus === 'error' ? 'Erro' : 'Guardar vídeo'}
          </Text>
        </Pressable>
        {/* Botão Publicar */}
        {onPublish && (
          <Pressable
            onPress={onPublish}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
              backgroundColor: 'rgba(34,197,94,0.15)',
              borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)',
            }}>
            <Send size={13} color="#4ADE80" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#4ADE80' }}>Publicar na Ziva</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Tendências Angola Panel ──────────────────────────────────────────────────
function TendenciasPanel({ onAskAbout }: { onAskAbout: (text: string) => void }) {
  const { colors } = useZivaTheme();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('');
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ziva-trending`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setArticles(json.articles ?? []);
      } catch (e: any) {
        setError(e.message ?? 'Erro ao carregar tendências');
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color="#7B3FF2" />
      <Text style={{ color: '#7B3FF2', fontWeight: '600', fontSize: 14 }}>A carregar tendências de Angola...</Text>
    </View>
  );

  if (error) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, backgroundColor: colors.bg }}>
      <TrendingUp size={48} color="#6B7280" />
      <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 14 }}>{error}</Text>
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      {/* Cabeçalho */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#7B3FF2', alignItems: 'center', justifyContent: 'center',
          shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 }}>
          <TrendingUp size={20} color="#fff" />
        </View>
        <View>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Tendências Angola 🇦🇴</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>Actualizado automaticamente</Text>
        </View>
      </View>

      {articles.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 32, gap: 10 }}>
          <Newspaper size={44} color="#374151" />
          <Text style={{ color: colors.muted, textAlign: 'center' }}>Sem notícias disponíveis de momento. Tenta mais tarde.</Text>
        </View>
      ) : articles.map((article) => (
        <View key={article.uuid} style={{
          backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, overflow: 'hidden',
          borderWidth: 1, borderColor: colors.cardBorder,
        }}>
          {article.image_url ? (
            <Image source={{ uri: article.image_url }}
              style={{ width: '100%', height: 160 }} contentFit="cover" />
          ) : null}
          <View style={{ padding: 14, gap: 6 }}>
            {article.categories?.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {article.categories.slice(0, 2).map((cat) => (
                  <View key={cat} style={{ backgroundColor: 'rgba(123,63,242,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                    borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)' }}>
                    <Text style={{ fontSize: 10, color: '#A78BFA', fontWeight: '700', textTransform: 'uppercase' }}>{cat}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 21 }} numberOfLines={3}>
              {article.title}
            </Text>
            {article.snippet ? (
              <Text style={{ fontSize: 13, color: colors.placeholder, lineHeight: 19 }} numberOfLines={2}>
                {article.snippet}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>{article.source}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => onAskAbout(`Fala-me mais sobre esta notícia: "${article.title}". O que significa para Angola e quais são as implicações?`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(123,63,242,0.2)', borderRadius: 10,
                    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)' }}
                >
                  <ZivaLogo size={12} color="#A78BFA" />
                  <Text style={{ fontSize: 11, color: '#A78BFA', fontWeight: '700' }}>Perguntar à Aura</Text>
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL(article.url)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 5, borderWidth: 1, borderColor: colors.inputBorder }}
                >
                  <ExternalLink size={14} color="#9CA3AF" />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Quick Actions Strip (Sugestões Rápidas) ─────────────────────────────────
function QuickActionsStrip({ onSelect }: { onSelect: (prompt: string) => void }) {
  const { colors } = useZivaTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
      style={{ backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border }}
    >
      {QUICK_ACTIONS.map((action) => (
        <Pressable
          key={action.id}
          onPress={() => onSelect(action.prompt)}
          style={{
            backgroundColor: 'rgba(123,63,242,0.12)', borderRadius: 20,
            paddingHorizontal: 14, paddingVertical: 8,
            borderWidth: 1, borderColor: 'rgba(123,63,242,0.25)',
          }}
        >
          <Text style={{ fontSize: 13, color: '#A78BFA', fontWeight: '600' }}>{action.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Image Gen Panel ──────────────────────────────────────────────────────────
function ImageGenPanel({ onResult }: { onResult: (msg: ChatMessage) => void }) {
  const { colors } = useZivaTheme();
  const [prompt, setPrompt] = useState('');
  const [refImageUri, setRefImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pickRef = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Permissão negada. Activa nas definições.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled) { setRefImageUri(r.assets[0].uri); setError(''); }
  };

  const generate = async () => {
    if (!prompt.trim()) { setError('Escreve uma descrição para gerar a imagem'); return; }
    setLoading(true); setError('');
    const loadingId = Date.now().toString();
    onResult({ id: loadingId, role: 'assistant', content: '', loading: true });

    try {
      const body: Record<string, unknown> = {
        prompt: prompt.trim(),
        aspect_ratio: '1:1',
        result_type: 'single',
      };

      // Upload ref image to storage → enviar URL (mais fiável que base64)
      if (refImageUri) {
        const imgUrl = await uploadToStorage(refImageUri, `img-ref`, 'image/jpeg');
        body.image_list = [{ url: imgUrl, image_url: imgUrl }];
      }

      const submitRes = await fetch(`${SUPABASE_URL}/functions/v1/kling-omni-image-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });
      const submitJson = await submitRes.json();
      // Detecta erro tanto no formato { error: "..." } quanto { code: N, message: "..." }
      if (!submitRes.ok || submitJson.error) {
        throw new Error(submitJson.error ?? submitJson.message ?? `Erro HTTP ${submitRes.status}`);
      }
      if (submitJson.code !== 0) throw new Error(submitJson.message ?? 'Erro ao submeter tarefa');
      const taskId = submitJson.data.task_id;

      let attempts = 0;
      const poll = async () => {
        if (attempts++ > 50) {
          setError('A geração está a demorar. Tenta novamente.');
          setLoading(false);
          onResult({ id: loadingId, role: 'assistant', content: 'Geração demorou demasiado. Tenta novamente.', loading: false });
          return;
        }
        const qRes = await fetch(`${SUPABASE_URL}/functions/v1/kling-omni-image-query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ task_id: taskId }),
        });
        const qJson = await qRes.json();
        const status = qJson.data?.task_status;
        if (status === 'succeed') {
          const imgUrl = qJson.data?.task_result?.images?.[0]?.url ?? '';
          // Oferece publicação directa na Ziva após geração bem-sucedida
          onResult({
            id: loadingId, role: 'assistant',
            content: '✨ Aqui está a imagem que criei para ti!\n\nPodes **publicar directamente** na Ziva ou guardar no teu dispositivo.',
            imageUrl: imgUrl,
            loading: false,
            canPublish: !!imgUrl,
            publishFn: imgUrl ? () => onResult({
              id: `pub-${loadingId}`, role: 'assistant',
              content: '📤 Imagem publicada na tua conta Ziva com sucesso!',
              loading: false,
            }) : undefined,
          });
          setLoading(false); setPrompt(''); setRefImageUri(null);
        } else if (status === 'failed') {
          const reason = qJson.data?.task_status_msg ?? '';
          setError(`Geração falhou${reason ? ': ' + reason : ''}. Tenta novamente.`);
          setLoading(false);
          onResult({ id: loadingId, role: 'assistant', content: 'Não consegui gerar a imagem. Tenta com outra descrição.', loading: false });
        } else {
          pollingRef.current = setTimeout(poll, 4000);
        }
      };
      pollingRef.current = setTimeout(poll, 5000);
    } catch (e: any) {
      const msg = e.message ?? 'Erro a gerar imagem';
      setError(msg);
      setLoading(false);
      onResult({ id: loadingId, role: 'assistant', content: `Erro: ${msg}`, loading: false });
    }
  };

  useEffect(() => () => { if (pollingRef.current) clearTimeout(pollingRef.current); }, []);

  return (
    <View style={{ gap: 14, padding: 16, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#7B3FF2', alignItems: 'center', justifyContent: 'center',
          shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 }}>
          <Sparkles size={18} color="#fff" />
        </View>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>Gerar Imagem com IA</Text>
      </View>
      <TextInput
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14,
          borderWidth: 1, borderColor: colors.inputBorder,
          color: colors.text, minHeight: 100, textAlignVertical: 'top', fontSize: 15,
        }}
        placeholder="Ex: Uma mulher angolana vestida de missanga num jardim florido, ultra-realista..."
        placeholderTextColor="#4B5563"
        value={prompt} onChangeText={setPrompt} multiline
      />
      <Pressable onPress={pickRef} style={{
        backgroundColor: 'rgba(123,63,242,0.15)', borderRadius: 14, padding: 13,
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)',
      }}>
        <ImageIcon size={18} color="#A78BFA" />
        <Text style={{ color: '#A78BFA', fontWeight: '600', flex: 1 }}>
          {refImageUri ? '✓ Imagem de referência adicionada' : 'Adicionar imagem de referência (opcional)'}
        </Text>
        {refImageUri && (
          <Pressable onPress={() => setRefImageUri(null)}>
            <X size={16} color="#A78BFA" />
          </Pressable>
        )}
      </Pressable>
      {refImageUri && (
        <Image source={{ uri: refImageUri }} style={{ width: 100, height: 100, borderRadius: 12 }} contentFit="cover" />
      )}
      {error ? (
        <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10, padding: 10,
          flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
          <Text style={{ color: '#EF4444', fontSize: 13, flex: 1 }}>{error}</Text>
        </View>
      ) : null}
      <Pressable onPress={generate} disabled={loading} style={{
        backgroundColor: loading ? 'rgba(123,63,242,0.5)' : '#7B3FF2',
        borderRadius: 16, padding: 16, alignItems: 'center',
        flexDirection: 'row', justifyContent: 'center', gap: 10,
        shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
        elevation: 6,
      }}>
        {loading
          ? <><ActivityIndicator color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>A gerar... aguarda</Text></>
          : <><Sparkles size={20} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Gerar Imagem</Text></>}
      </Pressable>
    </View>
  );
}

// ─── History Video Card ───────────────────────────────────────────────────────
function HistoryVideoCard({ video, onPublish }: { video: { id: string; prompt: string; video_url: string; storage_url?: string; created_at: string }; onPublish: () => void }) {
  const { colors } = useZivaTheme();
  const url = video.storage_url || video.video_url;
  const date = new Date(video.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
  return (
    <View style={{ width: 160, backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden',
      borderWidth: 1, borderColor: colors.cardBorder }}>
      {process.env.EXPO_OS !== 'web' ? (
        <HistoryVideoPlayer url={url} />
      ) : (
        <View style={{ height: 100, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Film size={28} color="#60A5FA" />
        </View>
      )}
      <View style={{ padding: 8, gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600', lineHeight: 15 }} numberOfLines={2}>
          {video.prompt || 'Vídeo gerado'}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>{date}</Text>
        <Pressable onPress={onPublish} style={{ backgroundColor: '#7B3FF2', borderRadius: 8,
          paddingVertical: 6, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Publicar na Ziva</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HistoryVideoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => { p.loop = false; p.muted = false; });
  return (
    <View style={{ height: 100 }}>
      <VideoView style={{ flex: 1 }} player={player} nativeControls />
    </View>
  );
}

// ─── Video Gen Panel ──────────────────────────────────────────────────────────
type GeneratedVideo = { id: string; prompt: string; video_url: string; storage_url?: string; created_at: string };

function VideoGenPanel({ onResult, onPublishVideo }: { onResult: (msg: ChatMessage) => void; onPublishVideo?: (msgId: string, videoUrl: string, content: string) => void }) {
  const { colors } = useZivaTheme();
  const { session } = useSession();
  const userId = session?.user?.id ?? '';
  const [prompt, setPrompt] = useState('');
  const [audioPrompt, setAudioPrompt] = useState('');
  const [refImageUri, setRefImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<GeneratedVideo[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadHistory = async () => {
    if (!userId) return;
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from('user_generated_videos')
        .select('id, prompt, video_url, storage_url, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      setHistory((data ?? []) as GeneratedVideo[]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    if (!showHistory) loadHistory();
    setShowHistory(v => !v);
  };

  const pickRef = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Permissão negada. Activa nas definições.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled) { setRefImageUri(r.assets[0].uri); setError(''); }
  };

  const generate = async () => {
    if (!prompt.trim()) { setError('Descreve o vídeo que queres criar'); return; }
    setLoading(true); setError('');
    const loadingId = Date.now().toString();
    const hasImage = !!refImageUri;
    onResult({ id: loadingId, role: 'assistant', content: '', loading: true });

    try {
      const body: Record<string, unknown> = {
        prompt: prompt.trim(),
        aspect_ratio: '9:16',
        duration: '5',   // string conforme spec da API
        mode: 'pro',     // único valor válido na API Kling omni-video
        sound: 'on',     // activar geração de áudio/fala no vídeo
        ...(audioPrompt.trim() ? { bgm_prompt: audioPrompt.trim() } : {}),
      };

      // image_list: campo correto é image_url (spec Kling omni-video)
      if (refImageUri) {
        onResult({ id: loadingId, role: 'assistant', content: '', loading: true, loadingMsg: '📤 A enviar imagem...' });
        const imgUrl = await uploadToStorage(refImageUri, `vid-ref`, 'image/jpeg');
        body.image_list = [{ image_url: imgUrl }];
      }

      onResult({ id: loadingId, role: 'assistant', content: '', loading: true, loadingMsg: '🚀 A submeter tarefa...' });

      const submitRes = await fetch(`${SUPABASE_URL}/functions/v1/kling-omni-video-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });
      const submitJson = await submitRes.json().catch(() => ({ error: `Erro HTTP ${submitRes.status}` }));
      if (!submitRes.ok || submitJson.error) {
        // Mensagens amigáveis para erros conhecidos
        const msg = submitJson.error ?? submitJson.message ?? `Erro HTTP ${submitRes.status}`;
        throw new Error(msg);
      }
      if (submitJson.code !== 0) throw new Error(submitJson.message ?? 'Erro ao submeter tarefa de vídeo');
      const taskId = submitJson.data.task_id;

      // Intervalos adaptativos: imagem→vídeo começa mais cedo (modelo já tem contexto visual)
      // Texto→vídeo: 8s inicial, depois 5s. Imagem→vídeo: 5s inicial, depois 4s.
      const INITIAL_DELAY = hasImage ? 5000 : 8000;
      const POLL_INTERVAL = hasImage ? 4000 : 5000;
      const MAX_ATTEMPTS  = hasImage ? 90  : 80;   // ~6 min máx para ambos

      const PROGRESS_MSGS = [
        '🎬 A criar o teu vídeo...',
        '🎨 A renderizar cenas...',
        '⚡ A processar frames...',
        '🌟 Quase pronto...',
      ];

      // Hard timeout: cancela se demorar mais de 5 minutos
      const hardTimeoutId = setTimeout(() => {
        if (pollingRef.current) clearTimeout(pollingRef.current);
        setError('A geração demorou demasiado. Tenta novamente.');
        setLoading(false);
        onResult({ id: loadingId, role: 'assistant', content: '⏱️ A geração demorou demasiado. Tenta novamente com uma descrição mais simples.', loading: false });
      }, 5 * 60 * 1000);

      let attempts = 0;
      const poll = async () => {
        if (attempts >= MAX_ATTEMPTS) {
          clearTimeout(hardTimeoutId);
          setError('A geração está a demorar. Tenta novamente.');
          setLoading(false);
          onResult({ id: loadingId, role: 'assistant', content: 'Geração demorou demasiado. Tenta novamente.', loading: false });
          return;
        }
        const progressMsg = PROGRESS_MSGS[Math.min(Math.floor(attempts / 5), PROGRESS_MSGS.length - 1)];
        onResult({ id: loadingId, role: 'assistant', content: '', loading: true, loadingMsg: progressMsg });
        attempts++;

        try {
          const qRes = await fetch(`${SUPABASE_URL}/functions/v1/kling-omni-video-query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              apikey: SUPABASE_ANON_KEY,
            },
            // Passar user_id + prompt para o edge function gravar na BD
            body: JSON.stringify({ task_id: taskId, user_id: userId || undefined, prompt: prompt.trim() }),
          });
          const qJson = await qRes.json();
          const status = qJson.data?.task_status;
          if (status === 'succeed') {
            clearTimeout(hardTimeoutId);
            const videoUrl = qJson.data?.task_result?.videos?.[0]?.url ?? '';
            const content = '🎬 O teu vídeo está pronto!\n\nPodes **publicar directamente** na Ziva ou guardar no teu dispositivo.';

            // Guardar no histórico directamente do cliente — mais fiável que background task
            if (userId && videoUrl && taskId) {
              supabase.from('user_generated_videos').upsert({
                user_id: userId,
                task_id: taskId,
                prompt: prompt.trim(),
                video_url: videoUrl,
                storage_url: videoUrl,
                duration: qJson.data?.task_result?.videos?.[0]?.duration ?? '5',
                status: 'completed',
              }, { onConflict: 'task_id' }).then((_r) => { void _r; });
            }

            onResult({
              id: loadingId, role: 'assistant',
              content,
              videoUrl,
              loading: false,
              canPublish: !!videoUrl,
              publishFn: videoUrl && onPublishVideo ? () => onPublishVideo(loadingId, videoUrl, content) : undefined,
            });
            setLoading(false); setPrompt(''); setRefImageUri(null);
            // Actualizar histórico automaticamente se o painel estiver visível
            if (showHistory) loadHistory();
          } else if (status === 'failed') {
            clearTimeout(hardTimeoutId);
            const reason = qJson.data?.task_status_msg ?? '';
            setError(`Geração falhou${reason ? ': ' + reason : ''}. Tenta com outra descrição.`);
            setLoading(false);
            onResult({ id: loadingId, role: 'assistant', content: '❌ Não consegui gerar o vídeo. Tenta com outra descrição.', loading: false });
          } else {
            pollingRef.current = setTimeout(poll, POLL_INTERVAL);
          }
        } catch {
          // Erro de rede temporário — continua a tentar com intervalo maior
          pollingRef.current = setTimeout(poll, POLL_INTERVAL * 2);
        }
      };
      pollingRef.current = setTimeout(poll, INITIAL_DELAY);
    } catch (e: any) {
      const msg = e.message ?? 'Erro a gerar vídeo';
      setError(msg);
      setLoading(false);
      onResult({ id: loadingId, role: 'assistant', content: `Erro: ${msg}`, loading: false });
    }
  };

  useEffect(() => () => { if (pollingRef.current) clearTimeout(pollingRef.current); }, []);

  return (
    <View style={{ gap: 14, padding: 16, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center',
          shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 }}>
          <Video size={18} color="#fff" />
        </View>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17, flex: 1 }}>Gerar Vídeo com IA</Text>
        {/* Botão "Ver vídeos gerados" */}
        <Pressable onPress={toggleHistory} style={{
          flexDirection: 'row', alignItems: 'center', gap: 5,
          backgroundColor: showHistory ? 'rgba(123,63,242,0.15)' : 'rgba(123,63,242,0.08)',
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
          borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)',
        }}>
          <Film size={13} color="#A78BFA" />
          <Text style={{ color: '#A78BFA', fontSize: 11, fontWeight: '700' }}>
            {showHistory ? 'Fechar' : 'Meus vídeos'}
          </Text>
        </Pressable>
      </View>

      {/* ── Histórico de vídeos gerados ── */}
      {showHistory && (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
            VÍDEOS GERADOS RECENTEMENTE
          </Text>
          {historyLoading ? (
            <ActivityIndicator color="#7B3FF2" />
          ) : history.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
              Ainda não geraste nenhum vídeo. Cria o teu primeiro!
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {history.map((v) => (
                <HistoryVideoCard
                  key={v.id}
                  video={v}
                  onPublish={() => {
                    const url = v.storage_url || v.video_url;
                    const content = `🎬 Vídeo: "${v.prompt.slice(0, 60)}${v.prompt.length > 60 ? '…' : ''}"`;
                    if (onPublishVideo) onPublishVideo(v.id, url, content);
                  }}
                />
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <TextInput
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14,
          borderWidth: 1, borderColor: colors.inputBorder,
          color: colors.text, minHeight: 100, textAlignVertical: 'top', fontSize: 15,
        }}
        placeholder="Ex: Uma mulher angolana a dançar kizomba num jardim florido ao pôr-do-sol..."
        placeholderTextColor="#4B5563"
        value={prompt} onChangeText={setPrompt} multiline
      />
      <Pressable onPress={pickRef} style={{
        backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 14, padding: 13,
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
      }}>
        <ImageIcon size={18} color="#60A5FA" />
        <Text style={{ color: '#60A5FA', fontWeight: '600', flex: 1 }}>
          {refImageUri ? '✓ Imagem de referência adicionada' : 'Adicionar imagem de referência (opcional)'}
        </Text>
        {refImageUri && (
          <Pressable onPress={() => setRefImageUri(null)}>
            <X size={16} color="#60A5FA" />
          </Pressable>
        )}
      </Pressable>
      {refImageUri && (
        <Image source={{ uri: refImageUri }} style={{ width: 100, height: 100, borderRadius: 12 }} contentFit="cover" />
      )}
      {/* ── Campo de áudio/som ── */}
      <TextInput
        placeholder="Música / Som (ex: kizomba suave, suspense, sem som)..."
        placeholderTextColor="#4B5563"
        value={audioPrompt} onChangeText={setAudioPrompt}
        style={{
          backgroundColor: 'rgba(34,197,94,0.08)', color: '#fff',
          borderRadius: 14, padding: 13, fontSize: 14, minHeight: 44,
          borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
        }}
      />
      {error ? (
        <View style={{ backgroundColor: 'rgba(239,68,68,0.10)', borderRadius: 12, padding: 12,
          borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', gap: 10 }}>
          <Text style={{ color: '#EF4444', fontSize: 13, lineHeight: 18 }}>{error}</Text>
          {/* Botão tentar novamente */}
          <Pressable onPress={() => { setError(''); generate(); }}
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, paddingVertical: 8,
              alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
            <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>🔄 Tentar novamente</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable onPress={generate} disabled={loading} style={{
        backgroundColor: loading ? 'rgba(59,130,246,0.5)' : '#3B82F6',
        borderRadius: 16, padding: 16, alignItems: 'center',
        flexDirection: 'row', justifyContent: 'center', gap: 10,
        shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
        elevation: 6,
      }}>
        {loading
          ? <><ActivityIndicator color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>A gerar vídeo{refImageUri ? ' da imagem' : ''}...</Text></>
          : <><Video size={20} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{refImageUri ? '🖼️ Imagem → Vídeo' : 'Gerar Vídeo'}</Text></>}
      </Pressable>
    </View>
  );
}

// ─── Voice Call Panel ─────────────────────────────────────────────────────────
function VoiceCallPanel({ onResult, systemPrompt }: { onResult: (msg: ChatMessage) => void; systemPrompt: string }) {
  const { colors } = useZivaTheme();
  const [callActive, setCallActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState('Toca em "Ligar" para falar com a Aura');
  const [error, setError] = useState('');
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const ttsPlayer = useAudioPlayer('');

  // Web: MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startCall = () => { setCallActive(true); setStatusText('Chamada activa — toca no microfone para falar'); };
  const endCall = () => {
    setCallActive(false); setRecording(false);
    setStatusText('Toca em "Ligar" para falar com a Aura');
    if (process.env.EXPO_OS === 'web' && mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // ── Web recording via MediaRecorder ─────────────────────────────────────────
  const startRecordingWeb = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setError('Microfone não disponível neste browser.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true); setError('');
      setStatusText('A ouvir... toca novamente para enviar');
    } catch {
      setError('Não foi possível aceder ao microfone. Verifica as permissões do browser.');
    }
  };

  const stopAndProcessWeb = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.onstop = async () => {
      setRecording(false); setProcessing(true); setStatusText('A processar a tua voz...');
      try {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const buf = await blob.arrayBuffer();
        const path = `voice/${Date.now()}.webm`;
        const { error: upErr } = await supabase.storage.from('ziva_images').upload(path, buf, { contentType: 'audio/webm' });
        if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);
        const { data: urlData } = supabase.storage.from('ziva_images').getPublicUrl(path);
        await processTranscript(urlData.publicUrl, 'webm');
      } catch (e: any) {
        setError(e.message ?? 'Erro no processamento de voz');
        setStatusText('Chamada activa — toca para tentar novamente');
        setProcessing(false);
      }
      // Liberta stream
      mr.stream.getTracks().forEach((t) => t.stop());
    };
    mr.stop();
  };

  // ── Native recording via expo-audio ─────────────────────────────────────────
  const startRecordingNative = async () => {
    setError('');
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) { setError('Permissão de microfone negada. Activa nas definições.'); return; }
    await audioRecorder.record();
    setRecording(true);
    setStatusText('A ouvir... toca novamente para enviar');
  };

  const stopAndProcessNative = async () => {
    if (!recording) return;
    setRecording(false); setProcessing(true); setStatusText('A processar a tua voz...');
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error('Sem áudio gravado');
      const audioUrl = await uploadToStorage(uri, 'voice', 'audio/m4a');
      await processTranscript(audioUrl, 'm4a');
    } catch (e: any) {
      setError(e.message ?? 'Erro no processamento de voz');
      setStatusText('Chamada activa — toca para tentar novamente');
      setProcessing(false);
    }
  };

  // ── Common: STT → AI → TTS ────────────────────────────────────────────────
  const processTranscript = async (audioUrl: string, _fmt: string) => {
    try {
      setStatusText('A transcrever...');
      const sttRes = await fetch(`${SUPABASE_URL}/functions/v1/speech-to-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ fileUrl: audioUrl, language: 'portuguese' }),
      });
      const sttJson = await sttRes.json();
      const transcript = sttJson.text ?? '';
      if (!transcript) throw new Error('Não consegui perceber. Fala mais perto do microfone.');

      setStatusText(`Percebido: "${transcript.substring(0, 40)}..."\nAura está a pensar...`);
      onResult({ id: Date.now().toString(), role: 'user', content: transcript });

      let aiText = '';
      const aiMsgId = (Date.now() + 1).toString();
      onResult({ id: aiMsgId, role: 'assistant', content: '', loading: true });

      await streamZivaAI(
        [{ role: 'user', parts: [{ text: transcript }] }],
        systemPrompt,
        (chunk) => { aiText += chunk; },
        async () => {
          onResult({ id: aiMsgId, role: 'assistant', content: aiText, loading: false });
          setStatusText('A sintetizar resposta em voz...');
          try {
            const ttsRes = await fetch(`${SUPABASE_URL}/functions/v1/text-to-speech`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                apikey: SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ input: aiText.slice(0, 800), voice: 'nova', response_format: 'mp3' }),
            });
            const ttsJson = await ttsRes.json();
            if (ttsJson.audioUrl) {
              ttsPlayer.replace({ uri: ttsJson.audioUrl });
              ttsPlayer.play();
            }
          } catch { /* TTS não bloqueante */ }
          setStatusText('Chamada activa — toca no microfone para continuar');
          setProcessing(false);
        },
        undefined,
        () => { setStatusText('A pensar…'); },
      );
    } catch (e: any) {
      setError(e.message ?? 'Erro no processamento de voz');
      setStatusText('Chamada activa — toca para tentar novamente');
      setProcessing(false);
    }
  };

  const handleMicPress = () => {
    if (recording) {
      if (process.env.EXPO_OS === 'web') stopAndProcessWeb();
      else stopAndProcessNative();
    } else {
      if (process.env.EXPO_OS === 'web') startRecordingWeb();
      else startRecordingNative();
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, padding: 32, backgroundColor: colors.bg }}>
      {/* Avatar animado */}
      <View style={{
        width: 128, height: 128, borderRadius: 64,
        backgroundColor: callActive ? '#7B3FF2' : 'rgba(123,63,242,0.15)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: callActive ? 3 : 1, borderColor: callActive ? '#A78BFA' : 'rgba(123,63,242,0.3)',
        shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: callActive ? 0.6 : 0.2, shadowRadius: 24,
        elevation: callActive ? 12 : 4,
      }}>
        <ZivaLogo size={60} color="#fff" />
      </View>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 22 }}>Aura</Text>
        <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 21, paddingHorizontal: 20 }}>
          {statusText}
        </Text>
      </View>

      {error ? (
        <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12, padding: 12, marginHorizontal: 10,
          borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
          <Text style={{ color: '#EF4444', textAlign: 'center', fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      {callActive && (
        <Pressable onPress={handleMicPress} disabled={processing} style={{
          width: 84, height: 84, borderRadius: 42,
          backgroundColor: recording ? '#EF4444' : '#7B3FF2',
          alignItems: 'center', justifyContent: 'center',
          shadowColor: recording ? '#EF4444' : '#7B3FF2',
          shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16,
          elevation: 8,
        }}>
          {processing
            ? <ActivityIndicator color="#fff" size="large" />
            : recording
              ? <StopCircle size={38} color="#fff" />
              : <Mic size={38} color="#fff" />}
        </Pressable>
      )}

      {!callActive ? (
        <Pressable onPress={startCall} style={{
          backgroundColor: '#22C55E', borderRadius: 24, paddingHorizontal: 36, paddingVertical: 16,
          flexDirection: 'row', alignItems: 'center', gap: 10,
          shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
          elevation: 6,
        }}>
          <Phone size={22} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>Ligar para Aura</Text>
        </Pressable>
      ) : (
        <Pressable onPress={endCall} style={{
          backgroundColor: '#EF4444', borderRadius: 22, paddingHorizontal: 28, paddingVertical: 13,
          flexDirection: 'row', alignItems: 'center', gap: 8,
          shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
          elevation: 6,
        }}>
          <PhoneOff size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Terminar Chamada</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Pulso Angola Panel — dados reais em tempo real ──────────────────────────
function PulsoAngolaPanel({ onAskAura }: { onAskAura: (q: string) => void }) {
  const { colors } = useZivaTheme();
  const [pulso, setPulso] = useState<PulsoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [provinciaSelec, setProvinciaSelec] = useState('luanda');

  const PROVINCIAS_LISTA = [
    { id: 'luanda', nome: 'Luanda' }, { id: 'benguela', nome: 'Benguela' },
    { id: 'huambo', nome: 'Huambo' }, { id: 'huila', nome: 'Huíla' },
    { id: 'cabinda', nome: 'Cabinda' }, { id: 'malanje', nome: 'Malanje' },
  ];

  const fetchPulso = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/aura-pulso?tipo=all`, {
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPulso(json);
    } catch (e: any) {
      setError('Não foi possível carregar o Pulso Angola. Verifica a ligação.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchPulso(); }, [fetchPulso]));

  const combustivel = pulso?.combustivel ?? {};
  const combEntries = Object.entries(combustivel).filter(
    ([k]) => !['fonte', 'actualizado_em'].includes(k)
  ) as [string, { preco: number; unidade: string; variacao: number }][];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Cabeçalho */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View>
          <Text style={{ color: '#F9FAFB', fontSize: 20, fontWeight: '800' }}>🇦🇴 Pulso de Angola</Text>
          <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2 }}>
            {pulso ? `Actualizado: ${new Date(pulso.actualizado_em).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}` : 'A carregar dados reais…'}
          </Text>
        </View>
        <Pressable onPress={fetchPulso} style={{
          width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(123,63,242,0.2)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <RefreshCw size={16} color="#A78BFA" />
        </Pressable>
      </View>

      {loading && (
        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
          <ActivityIndicator size="large" color="#7B3FF2" />
          <Text style={{ color: '#9CA3AF', marginTop: 12 }}>A obter dados em tempo real…</Text>
        </View>
      )}

      {!!error && !loading && (
        <View style={{
          backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 16,
          borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', marginBottom: 16,
        }}>
          <Text style={{ color: '#F87171', textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={fetchPulso} style={{
            marginTop: 10, backgroundColor: '#7B3FF2', borderRadius: 10, padding: 10, alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Tentar novamente</Text>
          </Pressable>
        </View>
      )}

      {!!pulso && !loading && (
        <>
          {/* ── CLIMA ─────────────────────────────────────────── */}
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
            ☁️  Clima nas Províncias
          </Text>
          {pulso.clima_destaque.map((c) => (
            <View key={c.provincia} style={{
              backgroundColor: colors.card, borderRadius: 16, padding: 14,
              marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F9FAFB', fontWeight: '700', fontSize: 15 }}>{c.provincia}</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2 }}>{c.descricao}</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                  <Text style={{ color: '#9CA3AF', fontSize: 11 }}>💧 {c.humidade_pct}%</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 11 }}>💨 {c.vento_kmh} km/h</Text>
                  {c.precipitacao_mm > 0 && (
                    <Text style={{ color: '#60A5FA', fontSize: 11 }}>🌧️ {c.precipitacao_mm}mm</Text>
                  )}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#7B3FF2', fontSize: 32, fontWeight: '800' }}>{c.temperatura_c}°</Text>
                <Pressable onPress={() => onAskAura(`Como vai estar o tempo em ${c.provincia} hoje? Dá-me uma previsão detalhada.`)}
                  style={{ marginTop: 6, backgroundColor: 'rgba(123,63,242,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#A78BFA', fontSize: 11, fontWeight: '700' }}>Perguntar à Aura</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {/* ── COMBUSTÍVEL ───────────────────────────────────── */}
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginTop: 12, textTransform: 'uppercase' }}>
            ⛽  Preços Combustíveis (AOA)
          </Text>
          <View style={{
            backgroundColor: colors.card, borderRadius: 16, padding: 14,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 12,
          }}>
            {combEntries.map(([key, val]) => (
              <View key={key} style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
              }}>
                <Text style={{ color: '#E5E7EB', fontSize: 14, textTransform: 'capitalize' }}>
                  {key.replace(/_/g, ' ')}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#7B3FF2', fontWeight: '800', fontSize: 15 }}>
                    {val.preco.toLocaleString('pt-AO')} <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '400' }}>{val.unidade}</Text>
                  </Text>
                  {val.variacao !== 0 && (
                    <Text style={{ color: val.variacao > 0 ? '#F87171' : '#34D399', fontSize: 11 }}>
                      {val.variacao > 0 ? '▲' : '▼'} {Math.abs(val.variacao)}%
                    </Text>
                  )}
                </View>
              </View>
            ))}
            <Text style={{ color: '#6B7280', fontSize: 10, marginTop: 8 }}>
              Fonte: {combustivel.fonte as string} • {combustivel.actualizado_em as string}
            </Text>
          </View>

          {/* ── PERGUNTAR À AURA ──────────────────────────────── */}
          <View style={{ gap: 8, marginTop: 4 }}>
            {[
              'Qual o melhor momento para abastecer em Luanda esta semana?',
              'Como os preços do petróleo afectam a economia angolana?',
              'Prevê-se chuva em Luanda nos próximos 3 dias?',
            ].map((q) => (
              <Pressable key={q} onPress={() => onAskAura(q)} style={{
                backgroundColor: 'rgba(123,63,242,0.12)', borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: 'rgba(123,63,242,0.2)', flexDirection: 'row', alignItems: 'center', gap: 8,
              }}>
                <Sparkles size={14} color="#A78BFA" />
                <Text style={{ color: '#C4B5FD', fontSize: 13, flex: 1 }}>{q}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── Main Aura Screen ────────────────────────────────────────────────────────
export default function ZivaIAScreen() {
  const { colors } = useZivaTheme();
  const { session } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id ?? '';
  const [mode, setMode] = useState<AiMode>('chat');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [userProfile, setUserProfile] = useState<{ username: string; full_name: string } | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const ttsPlayer = useAudioPlayer('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0', role: 'assistant',
      content: 'Olá! 🇦🇴 Sou a Aura, a sua assistente inteligente.\n\nPosso ajudá-lo(a) a:\n• Criar publicações para a Ziva\n• Pesquisar informações em tempo real\n• Ver as últimas tendências de Angola\n• Gerar imagens e vídeos\n• Conversar por voz\n\nEscolha uma das acções rápidas abaixo! 👇',
    },
  ]);
  const [input, setInput] = useState('');
  const [attachedImageUri, setAttachedImageUri] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [userFacts, setUserFacts] = useState<Record<string, string>>({});
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(false);
  const [publishStatus, setPublishStatus] = useState<Record<string, 'idle' | 'publishing' | 'done' | 'error'>>({});
  const [isRecordingChat, setIsRecordingChat] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const flatRef = useRef<FlatList>(null);
  const chatRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Prompt dinâmico com contexto do utilizador + factos aprendidos ────────
  const factsContext = Object.keys(userFacts).length > 0
    ? '\n\nMEMÓRIA VIVA (factos que já sei sobre este utilizador):\n' +
      Object.entries(userFacts).map(([k, v]) => `• ${k}: ${v}`).join('\n')
    : '';
  const ZIVA_SYSTEM = userProfile
    ? `${ZIVA_SYSTEM_BASE}\n\nCONTEXTO DO UTILIZADOR:\n• @${userProfile.username} (${userProfile.full_name || userProfile.username})\n• Plataforma: Ziva Social, Angola${factsContext}`
    : ZIVA_SYSTEM_BASE;

  // ── Sintetizar texto em voz — português angolano ─────────────────────────
  const speakText = async (msgId: string, text: string) => {
    if (speakingMsgId === msgId) return; // já a falar esta mensagem
    setSpeakingMsgId(msgId);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        // Limita a 800 caracteres para evitar timeouts; voz neutra e clara
        body: JSON.stringify({ input: text.slice(0, 800), voice: 'nova', response_format: 'mp3' }),
      });
      const json = await res.json();
      if (json.audioUrl) {
        ttsPlayer.replace({ uri: json.audioUrl });
        ttsPlayer.play();
      }
    } catch { /* TTS é não bloqueante */ }
    setSpeakingMsgId(null);
  };

  // ── Gravar comentário de áudio no chat ───────────────────────────────────
  const toggleChatRecording = async () => {
    if (isRecordingChat) {
      // Parar gravação e transcrever
      await chatRecorder.stop();
      const uri = chatRecorder.uri;
      if (!uri) return;
      setIsRecordingChat(false);
      const formData = new FormData();
      formData.append('file', { uri, name: 'voice.m4a', type: 'audio/m4a' } as any);
      formData.append('model', 'whisper-1');
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ziva-transcribe`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
          body: formData,
        });
        const json = await res.json();
        if (json.text) { setInput((prev) => `${prev}${json.text}`.trim()); }
      } catch { /* silencioso — mantém input vazio */ }
    } else {
      // Iniciar gravação
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await chatRecorder.record();
      setIsRecordingChat(true);
    }
  };

  // ── Carrega memória de conversas anteriores + perfil + factos do utilizador
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      (async () => {
        // Perfil do utilizador para contexto personalizado
        const { data: prof } = await supabase
          .from('profiles')
          .select('username, full_name')
          .eq('id', userId)
          .single();
        if (prof) setUserProfile({ username: prof.username ?? '', full_name: prof.full_name ?? '' });

        // Factos persistentes que a Aura aprendeu sobre este utilizador
        const { data: facts } = await supabase
          .from('aura_user_facts')
          .select('fact_key, fact_value')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(20);
        if (facts && facts.length > 0) {
          const factsMap: Record<string, string> = {};
          facts.forEach((f: { fact_key: string; fact_value: string }) => {
            factsMap[f.fact_key] = f.fact_value;
          });
          setUserFacts(factsMap);
        }

        // Histórico de conversas
        if (memoryLoaded) return;
        const { data } = await supabase
          .from('ziva_conversations')
          .select('role, content')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(20);
        if (data && data.length > 0) {
          const historicMsgs: ChatMessage[] = data.map((d, i) => ({
            id: `mem_${i}`,
            role: d.role as 'user' | 'assistant',
            content: d.content,
          }));
          setMessages((prev) => [prev[0], ...historicMsgs]);
        }
        setMemoryLoaded(true);
      })();
    }, [userId, memoryLoaded])
  );

  const addOrUpdateMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = msg;
        return updated;
      }
      return [...prev, msg];
    });
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  // ── Guarda mensagem na memória Supabase ──────────────────────────────────
  const saveToMemory = async (role: 'user' | 'assistant', content: string) => {
    if (!userId || !content.trim()) return;
    supabase.from('ziva_conversations').insert({
      user_id: userId,
      role,
      content: content.slice(0, 2000),
    });
  };

  // ── Publicar conteúdo gerado pela Aura directamente na Ziva ─────────────
  const publishToZiva = async (msgId: string, content: string, imageUrl?: string, videoUrl?: string) => {
    if (!userId) return;
    setPublishStatus((prev) => ({ ...prev, [msgId]: 'publishing' }));
    try {
      let error: any = null;
      if (videoUrl) {
        // Vídeos publicados vão para a tabela reels (lida pelo ecrã de Reels)
        ({ error } = await supabase.from('reels').insert({
          user_id: userId,
          video_url: videoUrl,
          caption: content.trim().slice(0, 500),
          thumbnail_url: '',
        }));
      } else {
        ({ error } = await supabase.from('posts').insert({
          user_id: userId,
          caption: content.trim().slice(0, 500),
          image_url: imageUrl ?? '',
          video_url: null,
          post_type: 'post',
          ai_generated: true,
          status: 'published',
          is_deleted: false,
        }));
      }
      if (error) throw error;
      setPublishStatus((prev) => ({ ...prev, [msgId]: 'done' }));
      setMessages((prev) => prev.map((m) =>
        m.id === msgId ? { ...m, canPublish: false, publishFn: undefined } : m
      ));
    } catch {
      setPublishStatus((prev) => ({ ...prev, [msgId]: 'error' }));
    }
  };

  // ── Feedback nas respostas da IA ─────────────────────────────────────────
  const handleFeedback = async (msgId: string, reaction: 'up' | 'down') => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId ? { ...m, feedback: reaction } : m
    ));
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || !userId) return;
    supabase.from('ai_feedback').insert({
      user_id: userId,
      message_content: msg.content.slice(0, 1000),
      reaction,
    });
  };

  // ── Acção rápida seleccionada ────────────────────────────────────────────
  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    setMode('chat');
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Tendências → pede à Ziva para comentar ───────────────────────────────
  const handleAskAboutNews = (text: string) => {
    setMode('chat');
    setInput(text);
  };

  const sendChat = async (overrideText?: string) => {
    const userText = (overrideText ?? input).trim();
    if ((!userText && !attachedImageUri) || streaming) return;
    setInput('');
    const imgUri = attachedImageUri;
    setAttachedImageUri(null);

    const userMsgId = Date.now().toString();
    let uploadedImageUrl: string | undefined;
    if (imgUri) {
      try { uploadedImageUrl = await uploadToStorage(imgUri, 'chat-images', 'image/jpeg'); }
      catch { /* ignora erro de upload — envia texto apenas */ }
    }

    addOrUpdateMessage({
      id: userMsgId, role: 'user',
      content: userText || '📷 Imagem enviada',
      imageUrl: uploadedImageUrl,
    });
    saveToMemory('user', userText || '[imagem enviada]');
    setStreaming(true);
    abortRef.current = new AbortController();

    const aiMsgId = (Date.now() + 1).toString();
    addOrUpdateMessage({ id: aiMsgId, role: 'assistant', content: '', loading: true });

    // Instrução de sistema contextualizada (passa server-side — não ocupa histórico)
    const systemInstruction = userProfile
      ? `${ZIVA_SYSTEM_BASE}\n\nCONTEXTO DO UTILIZADOR:\n• @${userProfile.username} (${userProfile.full_name || userProfile.username})\n• Plataforma: Ziva Social, Angola\nDirija-se ao utilizador pelo nome quando adequado.`
      : ZIVA_SYSTEM_BASE;

    // Histórico limpo — apenas turnos reais, sem prefixos de sistema
    const history: GeminiContent[] = messages
      .filter((m) => !m.loading && m.content && m.id !== '0')
      .slice(-12)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    // Partes da mensagem actual (texto + imagem inline se existir)
    const userParts: GeminiPart[] = [];
    if (uploadedImageUrl) {
      try {
        const imgRes = await fetch(uploadedImageUrl);
        const buf = await imgRes.arrayBuffer();
        // btoa com spread(...) falha para imagens grandes — usar loop em chunks
        const bytes = new Uint8Array(buf);
        let b64 = '';
        const CHUNK = 8192;
        for (let c = 0; c < bytes.length; c += CHUNK) {
          b64 += String.fromCharCode(...bytes.subarray(c, c + CHUNK));
        }
        b64 = btoa(b64);
        userParts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } });
      } catch { /* envia só texto se falhar */ }
    }
    if (userText) userParts.push({ text: userText });
    if (userParts.length === 0) userParts.push({ text: '[utilizador enviou uma imagem]' });

    const contents: GeminiContent[] = [
      ...history,
      { role: 'user', parts: userParts },
    ];

    // Detecta intenção de publicação (publicacao / legenda quick actions)
    const isPublishIntent = ['publicacao', 'legenda', 'agente'].some((kw) =>
      userText.toLowerCase().includes('publicação') ||
      userText.toLowerCase().includes('legenda') ||
      userText.toLowerCase().includes('publicar')
    );

    let accumulated = '';
    try {
      await streamZivaAI(
        contents,
        systemInstruction,
        (chunk) => {
          accumulated += chunk;
          addOrUpdateMessage({ id: aiMsgId, role: 'assistant', content: accumulated, loading: false });
        },
        () => {
          // Se a resposta parece conteúdo publicável, marca com botão de publicação
          const shouldOfferPublish = isPublishIntent && accumulated.length > 60 && !accumulated.startsWith('⏳');
          addOrUpdateMessage({
            id: aiMsgId, role: 'assistant', content: accumulated, loading: false,
            canPublish: shouldOfferPublish,
            publishFn: shouldOfferPublish ? () => publishToZiva(aiMsgId, accumulated) : undefined,
          });
          // Auto-publicação se activada pelo utilizador
          if (autoPublishEnabled && shouldOfferPublish) {
            publishToZiva(aiMsgId, accumulated);
          }
          saveToMemory('assistant', accumulated);
        },
        abortRef.current.signal,
        (attempt) => {
          // Mostra "A pensar…" animado em vez de erro durante retry transparente
          const dots = '.'.repeat((attempt % 3) + 1);
          addOrUpdateMessage({ id: aiMsgId, role: 'assistant', content: `A pensar${dots}`, loading: true });
        },
      );
    } catch (e: any) {
      if (!abortRef.current?.signal.aborted) {
        addOrUpdateMessage({
          id: aiMsgId,
          role: 'assistant',
          content: '⏳ A Aura está ocupada agora. Toca em "Tentar novamente" em instantes.',
          loading: false,
          isError: true,
          retryFn: () => sendChat(userText),
        });
      }
    } finally {
      setStreaming(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />

      {/* ── HEADER DARK PREMIUM ──────────────────────────── */}
      <View style={{
        paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 12,
        backgroundColor: colors.bg,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        {/* Seta voltar */}
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/home' as any)}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          <ArrowLeft size={22} color="#F9FAFB" strokeWidth={2} />
        </Pressable>

        {/* Avatar + nome + badge + subtítulo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{
            width: 42, height: 42, borderRadius: 21,
            backgroundColor: '#7B3FF2', alignItems: 'center', justifyContent: 'center',
            shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 10,
            elevation: 6,
          }}>
            <ZivaLogo size={24} color="#fff" />
          </View>
          <View style={{ gap: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Aura</Text>
              <View style={{
                width: 16, height: 16, borderRadius: 8,
                backgroundColor: '#7B3FF2', alignItems: 'center', justifyContent: 'center',
              }}>
                <CircleCheck size={11} color="#fff" fill="#fff" strokeWidth={0} />
              </View>
              {/* Badge IA Premium */}
              <View style={{ backgroundColor: 'rgba(123,63,242,0.2)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
                borderWidth: 1, borderColor: 'rgba(123,63,242,0.35)' }}>
                <Text style={{ fontSize: 9, color: '#A78BFA', fontWeight: '800' }}>PREMIUM</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '500' }}>
              Inteligência artificial angolana 🇦🇴
            </Text>
          </View>
        </View>

        {/* Online + menu "..." */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E',
              shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 }} />
            <Text style={{ fontSize: 12, color: '#22C55E', fontWeight: '700' }}>Online</Text>
          </View>
          <Pressable
            onPress={() => setAutoPublishEnabled((v) => !v)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12,
              backgroundColor: autoPublishEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
              borderWidth: 1, borderColor: autoPublishEnabled ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)',
            }}
          >
            <Send size={12} color={autoPublishEnabled ? '#4ADE80' : '#6B7280'} />
            <Text style={{ fontSize: 10, color: autoPublishEnabled ? '#4ADE80' : '#6B7280', fontWeight: '700' }}>
              {autoPublishEnabled ? 'Auto ON' : 'Auto'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowModeMenu(true)}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <MoreVertical size={20} color="#9CA3AF" strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* ── MODAL MENU DE MODOS "..." — dark ─────────────── */}
      <Modal visible={showModeMenu} transparent animationType="slide" onRequestClose={() => setShowModeMenu(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setShowModeMenu(false)} />
        <View style={{
          backgroundColor: '#111113', borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingBottom: Math.max(insets.bottom, 20), paddingTop: 8,
          borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, paddingHorizontal: 20, marginBottom: 8, letterSpacing: 0.5 }}>
            ESCOLHER MODO
          </Text>
          {MODES.map((m) => {
            const icons: Record<string, any> = {
              chat:       <Sparkles size={20} color="#A78BFA" />,
              pesquisa:   <Globe size={20} color="#60A5FA" />,
              tendencias: <TrendingUp size={20} color="#FBBF24" />,
              imagem:     <ImageIcon size={20} color="#F472B6" />,
              video:      <Video size={20} color="#F87171" />,
              voz:        <Phone size={20} color="#34D399" />,
            };
            const isActive = mode === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => { setMode(m.id); setShowModeMenu(false); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  paddingHorizontal: 20, paddingVertical: 14,
                  backgroundColor: isActive ? 'rgba(123,63,242,0.15)' : 'transparent',
                  borderLeftWidth: isActive ? 3 : 0,
                  borderLeftColor: '#7B3FF2',
                }}
              >
                {icons[m.id]}
                <Text style={{ flex: 1, fontSize: 15, fontWeight: isActive ? '700' : '500',
                  color: isActive ? '#A78BFA' : '#D1D5DB' }}>
                  {m.label}
                </Text>
                {isActive && <CircleCheck size={18} color="#7B3FF2" />}
              </Pressable>
            );
          })}
        </View>
      </Modal>

      {/* ── PAINÉIS DE MODO ─────────────────────────────────── */}
      {mode === 'pulso' ? (
        <PulsoAngolaPanel onAskAura={(q) => { setInput(q); setMode('chat'); }} />
      ) : mode === 'imagem' ? (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 32 }}>
          {messages.filter((m) => m.imageUrl).map((m) => (
            <View key={m.id} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <ChatBubble msg={m} isFirstInGroup
                onSpeak={(t) => speakText(m.id, t)} />
            </View>
          ))}
          <ImageGenPanel onResult={addOrUpdateMessage} />
        </ScrollView>
      ) : mode === 'video' ? (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 32 }}>
          {messages.filter((m) => m.videoUrl).map((m) => (
            <View key={m.id} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <ChatBubble msg={m} isFirstInGroup
                onSpeak={(t) => speakText(m.id, t)} />
            </View>
          ))}
          <VideoGenPanel
            onResult={addOrUpdateMessage}
            onPublishVideo={(msgId, videoUrl, content) => publishToZiva(msgId, content, undefined, videoUrl)}
          />
        </ScrollView>
      ) : mode === 'voz' ? (
        <VoiceCallPanel onResult={addOrUpdateMessage} systemPrompt={ZIVA_SYSTEM} />
      ) : mode === 'tendencias' ? (
        <TendenciasPanel onAskAbout={(text) => { handleAskAboutNews(text); setMode('chat'); }} />
      ) : (
        /* ── CHAT + PESQUISA — dark premium ── */
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          {/* Landing — mostrado apenas quando não há conversa ainda */}
          {messages.length <= 1 && (
            <ScrollView
              style={{ flex: 1, backgroundColor: colors.bg }}
              contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Orb roxo */}
              <View style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: '#7B3FF2',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#7B3FF2',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: 40,
                elevation: 20,
                marginBottom: 20,
              }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <View style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={28} color="#fff" strokeWidth={1.5} />
                  </View>
                </View>
              </View>

              {/* Título e subtítulo */}
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 6 }}>
                Olá, como posso ajudar hoje?
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>
                Escolha uma opção abaixo ou{'\n'}digite a sua pergunta.
              </Text>

              {/* 6 cartões de funcionalidades */}
              {[
                {
                  id: 'chat' as AiMode,
                  icon: <Sparkles size={22} color="#A78BFA" />,
                  label: 'Chat',
                  desc: 'Converse com IA avançada',
                  bg: 'rgba(123,63,242,0.12)',
                  border: 'rgba(123,63,242,0.25)',
                },
                {
                  id: 'pesquisa' as AiMode,
                  icon: <Globe size={22} color="#60A5FA" />,
                  label: 'Pesquisa',
                  desc: 'Encontre informações inteligentes',
                  bg: 'rgba(59,130,246,0.12)',
                  border: 'rgba(59,130,246,0.25)',
                },
                {
                  id: 'tendencias' as AiMode,
                  icon: <TrendingUp size={22} color="#FB923C" />,
                  label: 'Tendências',
                  desc: 'Veja o que está em alta',
                  bg: 'rgba(251,146,60,0.12)',
                  border: 'rgba(251,146,60,0.25)',
                },
                {
                  id: 'imagem' as AiMode,
                  icon: <ImageIcon size={22} color="#F472B6" />,
                  label: 'Imagem IA',
                  desc: 'Gere imagens incríveis',
                  bg: 'rgba(244,114,182,0.12)',
                  border: 'rgba(244,114,182,0.25)',
                },
                {
                  id: 'video' as AiMode,
                  icon: <Video size={22} color="#F87171" />,
                  label: 'Vídeo IA',
                  desc: 'Crie vídeos com IA',
                  bg: 'rgba(248,113,113,0.12)',
                  border: 'rgba(248,113,113,0.25)',
                },
                {
                  id: 'voz' as AiMode,
                  icon: <Phone size={22} color="#34D399" />,
                  label: 'Voz IA',
                  desc: 'Fale e interaja por voz',
                  bg: 'rgba(52,211,153,0.12)',
                  border: 'rgba(52,211,153,0.25)',
                },
              ].map((card) => (
                <Pressable
                  key={card.id}
                  onPress={() => setMode(card.id)}
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    backgroundColor: card.bg,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: card.border,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    marginBottom: 10,
                  }}
                >
                  <View style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {card.icon}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{card.label}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{card.desc}</Text>
                  </View>
                  <ArrowLeft size={16} color="#4B5563" style={{ transform: [{ rotate: '180deg' }] }} />
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Mensagens — apenas quando há conversa */}
          {messages.length > 1 && (
            <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={(item) => item.id}
              style={{ flex: 1, backgroundColor: colors.bg }}
              contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10 }}
              renderItem={({ item, index }) => {
                const isFirstInGroup =
                  item.role === 'assistant' &&
                  (index === 0 || messages[index - 1]?.role === 'user');
                return (
                  <ChatBubble
                    msg={item}
                    onFeedback={handleFeedback}
                    onSpeak={(t) => speakText(item.id, t)}
                    isFirstInGroup={isFirstInGroup}
                  />
                );
              }}
              contentInsetAdjustmentBehavior="automatic"
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
            />
          )}

          {/* ── RODAPÉ CHAT — dark ─────────────────────── */}
          {/* Preview imagem anexada */}
          {attachedImageUri ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4,
              backgroundColor: colors.bg,
              borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
            }}>
              <Image source={{ uri: attachedImageUri }}
                style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: '#1F1F23' }}
                contentFit="cover" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#D1D5DB' }}>Imagem anexada</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>Adiciona um texto ou envia só a imagem</Text>
              </View>
              <Pressable onPress={() => setAttachedImageUri(null)}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
                <X size={14} color="#EF4444" />
              </Pressable>
            </View>
          ) : null}

          {/* Barra de digitação dark */}
          <View style={{
            flexDirection: 'row', alignItems: 'flex-end', gap: 6,
            paddingHorizontal: 10, paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 10) + 4,
            backgroundColor: colors.bg,
            borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
          }}>
            {/* Clipe */}
            <Pressable
              onPress={async () => {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') return;
                const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: false });
                if (!res.canceled && res.assets[0]) setAttachedImageUri(res.assets[0].uri);
              }}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                marginBottom: 5, backgroundColor: attachedImageUri ? 'rgba(123,63,242,0.2)' : 'rgba(255,255,255,0.06)' }}
            >
              <Paperclip size={22} color={attachedImageUri ? '#A78BFA' : colors.muted} strokeWidth={1.8} />
            </Pressable>

            {/* Campo de texto */}
            <TextInput
              style={{
                flex: 1,
                minHeight: 50,
                maxHeight: 130,
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderRadius: 25,
                paddingHorizontal: 18,
                paddingTop: 13,
                paddingBottom: 13,
                color: colors.text,
                fontSize: 15,
                lineHeight: 22,
                borderWidth: 1,
                borderColor: isRecordingChat ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)',
              }}
              placeholder={
                isRecordingChat
                  ? '🎙 A gravar...'
                  : attachedImageUri
                    ? 'Adiciona um texto à imagem... (opcional)'
                    : mode === 'pesquisa'
                      ? 'Pesquisa qualquer coisa...'
                      : 'Fala com a Aura...'
              }
              placeholderTextColor={isRecordingChat ? '#F87171' : '#4B5563'}
              value={input}
              onChangeText={setInput}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => sendChat()}
              editable={!isRecordingChat}
            />

            {/* Câmera */}
            <Pressable
              onPress={async () => {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') return;
                const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
                if (!res.canceled && res.assets[0]) setAttachedImageUri(res.assets[0].uri);
              }}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                marginBottom: 5, backgroundColor: 'rgba(255,255,255,0.06)' }}
            >
              <Camera size={22} color="#6B7280" strokeWidth={1.8} />
            </Pressable>

            {/* Microfone */}
            <Pressable
              onPress={toggleChatRecording}
              style={{
                width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isRecordingChat ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                marginBottom: 5,
              }}
            >
              {isRecordingChat
                ? <MicOff size={22} color="#EF4444" strokeWidth={1.8} />
                : <Mic size={22} color="#6B7280" strokeWidth={1.8} />}
            </Pressable>

            {/* Cancelar stream */}
            {streaming && (
              <Pressable
                onPress={() => { abortRef.current?.abort(); setStreaming(false); }}
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 3, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
                }}
              >
                <RefreshCw size={17} color="#EF4444" />
              </Pressable>
            )}

            {/* Botão enviar — roxo neon */}
            <Pressable
              onPress={() => sendChat()}
              disabled={!input.trim() || streaming}
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: input.trim() && !streaming ? '#7B3FF2' : 'rgba(255,255,255,0.08)',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 3,
                shadowColor: '#7B3FF2',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: input.trim() && !streaming ? 0.5 : 0,
                shadowRadius: 8,
                elevation: input.trim() && !streaming ? 4 : 0,
              }}
            >
              {streaming
                ? <ActivityIndicator size="small" color="#7B3FF2" />
                : <Send size={20} color={input.trim() ? '#fff' : '#4B5563'} />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
