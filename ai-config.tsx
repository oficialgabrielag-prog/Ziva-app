import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Brain, Eye, EyeOff, CheckCircle, XCircle, ExternalLink,
  ChevronLeft, Key, Sparkles, Zap,
} from 'lucide-react-native';
import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';

export default function AiConfigScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id ?? '';

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [saved, setSaved] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      const { data } = await supabase
        .from('user_settings').select('gemini_api_key').eq('user_id', userId).maybeSingle();
      setApiKey(data?.gemini_api_key ?? '');
    })();
  }, [userId]));

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    await supabase.from('user_settings')
      .upsert({ user_id: userId, gemini_api_key: apiKey.trim() }, { onConflict: 'user_id' });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTest = async () => {
    const key = apiKey.trim();
    if (!key) { setTestResult('error'); setTestMessage('Insere uma chave antes de testar.'); return; }
    setTesting(true); setTestResult(null); setTestMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('large-language-model', {
        body: {
          contents: [{ role: 'user', parts: [{ text: 'Olá! Responde apenas com: OK' }] }],
          user_gemini_key: key,
        },
      });
      if (error) throw error;
      // SSE: data pode ser Response bruto
      let raw = '';
      if (data instanceof Response) raw = await data.text();
      else if (typeof data === 'string') raw = data;
      else raw = JSON.stringify(data ?? '');

      let text = '';
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const d = line.slice(5).trim();
        if (!d || d === '[DONE]') continue;
        try { const f = JSON.parse(d); text += f?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''; } catch { /* skip */ }
      }
      if (text.trim()) {
        setTestResult('success');
        setTestMessage('Chave válida! A IA Ziva está pronta a usar a tua chave pessoal.');
      } else {
        setTestResult('error');
        setTestMessage('A chave foi aceite mas a resposta foi inesperada. Verifica no Google AI Studio.');
      }
    } catch (e: any) {
      setTestResult('error');
      setTestMessage(e?.message?.includes('401') || e?.message?.includes('403')
        ? 'Chave inválida ou sem permissões. Verifica no Google AI Studio.'
        : `Erro: ${e?.message ?? 'Falha ao testar a chave.'}`);
    }
    setTesting(false);
  };

  const hasKey = apiKey.trim().length > 0;
  const maskedKey = hasKey && !showKey
    ? `${apiKey.slice(0, 6)}${'•'.repeat(Math.max(0, apiKey.length - 10))}${apiKey.slice(-4)}`
    : apiKey;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8f7ff' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingTop: 56, paddingBottom: 16, backgroundColor: '#ffffff',
        borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
      }}>
        <Pressable onPress={() => router.back()}
          style={{ marginRight: 12, padding: 4 }}>
          <ChevronLeft size={24} color="#111827" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Configuração de IA</Text>
          <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>Chave API Gemini pessoal</Text>
        </View>
        <View style={{
          width: 36, height: 36, borderRadius: 12,
          backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center',
        }}>
          <Brain size={18} color="#7c3aed" />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}
        contentInsetAdjustmentBehavior="automatic">

        {/* Banner informativo */}
        <View style={{
          backgroundColor: '#ede9fe', borderRadius: 16, padding: 16,
          borderWidth: 1, borderColor: '#ddd6fe', gap: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#7c3aed" />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#5b21b6' }}>
              Usa a tua própria chave Gemini
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: '#6d28d9', lineHeight: 19 }}>
            Com a tua chave pessoal do Google AI Studio, todas as funcionalidades de IA do Ziva — sugestões de legendas, respostas inteligentes, assistente de publicação — utilizam a tua cota gratuita sem limites da plataforma.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {['Legendas IA', 'Assistente Ziva', 'Pesquisa inteligente', 'Respostas automáticas'].map((f) => (
              <View key={f} style={{
                backgroundColor: '#ddd6fe', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#5b21b6' }}>✓ {f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Campo da chave */}
        <View style={{
          backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
          borderWidth: 1, borderColor: '#e5e7eb', gap: 12,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Key size={16} color="#7c3aed" />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>
              Chave API Gemini
            </Text>
            {hasKey && (
              <View style={{
                backgroundColor: '#d1fae5', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 'auto',
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#065f46' }}>✓ Activa</Text>
              </View>
            )}
          </View>

          <View style={{
            flexDirection: 'row', alignItems: 'center',
            borderWidth: 1.5, borderColor: hasKey ? '#7c3aed' : '#e5e7eb',
            borderRadius: 12, backgroundColor: '#f9fafb', overflow: 'hidden',
          }}>
            <TextInput
              value={maskedKey}
              onChangeText={(v) => { setApiKey(v); setSaved(false); setTestResult(null); }}
              onFocus={() => setShowKey(true)}
              onBlur={() => setShowKey(false)}
              placeholder="AIzaSy..."
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1, paddingHorizontal: 14, paddingVertical: 12,
                fontSize: 14, color: '#111827', fontFamily: 'monospace',
              }}
            />
            <Pressable onPress={() => setShowKey((v) => !v)}
              style={{ padding: 12 }}>
              {showKey
                ? <EyeOff size={18} color="#6b7280" />
                : <Eye size={18} color="#6b7280" />}
            </Pressable>
          </View>

          <Text style={{ fontSize: 12, color: '#6b7280', lineHeight: 17 }}>
            Obtém a tua chave gratuita em{' '}
            <Text style={{ color: '#7c3aed', fontWeight: '600' }}>
              aistudio.google.com/apikey
            </Text>
            {' '}— cria um projeto e clica em "Create API Key".
          </Text>

          {/* Resultado do teste */}
          {testResult && (
            <View style={{
              flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12,
              backgroundColor: testResult === 'success' ? '#f0fdf4' : '#fef2f2',
              borderRadius: 10, borderWidth: 1,
              borderColor: testResult === 'success' ? '#bbf7d0' : '#fecaca',
            }}>
              {testResult === 'success'
                ? <CheckCircle size={16} color="#16a34a" />
                : <XCircle size={16} color="#dc2626" />}
              <Text style={{
                flex: 1, fontSize: 12, lineHeight: 17,
                color: testResult === 'success' ? '#15803d' : '#dc2626',
              }}>
                {testMessage}
              </Text>
            </View>
          )}

          {/* Botões */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={handleTest}
              disabled={testing || !hasKey}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 6, paddingVertical: 11, borderRadius: 10,
                backgroundColor: hasKey ? '#ede9fe' : '#f3f4f6',
                opacity: testing ? 0.7 : 1,
              }}>
              {testing
                ? <ActivityIndicator size="small" color="#7c3aed" />
                : <Zap size={15} color={hasKey ? '#7c3aed' : '#9ca3af'} />}
              <Text style={{
                fontSize: 13, fontWeight: '700',
                color: hasKey ? '#7c3aed' : '#9ca3af',
              }}>Testar chave</Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 6, paddingVertical: 11, borderRadius: 10,
                backgroundColor: saved ? '#d1fae5' : '#7c3aed',
                opacity: saving ? 0.7 : 1,
              }}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : saved
                  ? <CheckCircle size={15} color="#065f46" />
                  : null}
              <Text style={{
                fontSize: 13, fontWeight: '700',
                color: saved ? '#065f46' : '#fff',
              }}>
                {saved ? 'Guardada!' : 'Guardar'}
              </Text>
            </Pressable>
          </View>

          {/* Limpar chave */}
          {hasKey && (
            <Pressable
              onPress={() => { setApiKey(''); setTestResult(null); }}
              style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>
                Remover chave e usar cota da plataforma
              </Text>
            </Pressable>
          )}
        </View>

        {/* Como obter a chave */}
        <View style={{
          backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
          borderWidth: 1, borderColor: '#e5e7eb', gap: 14,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ExternalLink size={16} color="#7c3aed" />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>
              Como obter a chave (3 passos)
            </Text>
          </View>
          {[
            { num: '1', title: 'Abre o Google AI Studio', desc: 'Vai a aistudio.google.com e inicia sessão com a tua conta Google.' },
            { num: '2', title: 'Cria uma chave API', desc: 'Clica em "Get API Key" → "Create API Key in new project". A chave começa com "AIza...".' },
            { num: '3', title: 'Cola aqui e guarda', desc: 'Copia a chave, cola no campo acima e clica em "Guardar". Usa "Testar chave" para confirmar.' },
          ].map((step) => (
            <View key={step.num} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 14, backgroundColor: '#7c3aed',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
              }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{step.num}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{step.title}</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', lineHeight: 17 }}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Nota de privacidade */}
        <View style={{
          backgroundColor: '#fafafa', borderRadius: 12, padding: 12,
          borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', gap: 8,
        }}>
          <Text style={{ fontSize: 18 }}>🔒</Text>
          <Text style={{ flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 17 }}>
            A tua chave API é armazenada de forma segura na base de dados do Ziva e nunca é partilhada com terceiros. É usada exclusivamente para as funcionalidades de IA dentro da app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
