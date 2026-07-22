import { useState } from 'react';
import {
  View, Text, Pressable, Modal, TextInput,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { X, Flag } from 'lucide-react-native';
import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type ReportTargetType = 'post' | 'comment' | 'profile' | 'reel' | 'story';

interface ReportModalProps {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
}

const REASONS = [
  { key: 'spam', label: '🚫 Spam ou conteúdo repetitivo' },
  { key: 'hate', label: '🔥 Discurso de ódio' },
  { key: 'violence', label: '⚠️ Violência ou conteúdo perigoso' },
  { key: 'nudity', label: '🔞 Nudez ou conteúdo sexual' },
  { key: 'harassment', label: '😡 Assédio ou bullying' },
  { key: 'fake', label: '🤖 Conta falsa ou bot' },
  { key: 'misinformation', label: '❌ Desinformação' },
  { key: 'other', label: '📝 Outro motivo' },
];

// ─── Componente ──────────────────────────────────────────────────────────────
export function ReportModal({ visible, targetType, targetId, onClose }: ReportModalProps) {
  const { session } = useSession();
  const userId = session?.user?.id ?? '';

  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setSelected(null); setDetails(''); setDone(false);
  };

  const submit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    await supabase.from('reports').insert({
      reporter_id: userId,
      target_type: targetType,
      target_id: targetId,
      reason: selected,
      details: details.trim() || null,
    });
    setSubmitting(false);
    setDone(true);
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-background rounded-t-3xl" style={{ paddingBottom: 32 }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-border">
            <View className="flex-row items-center gap-2">
              <Flag size={18} color="#ef4444" />
              <Text className="text-lg font-bold text-foreground">Denunciar</Text>
            </View>
            <Pressable onPress={handleClose} className="active:opacity-60">
              <X size={22} color="#9ca3af" />
            </Pressable>
          </View>

          {done ? (
            <View className="items-center py-12 px-6 gap-4">
              <Text style={{ fontSize: 52 }}>✅</Text>
              <Text className="text-xl font-bold text-foreground text-center">Denúncia enviada</Text>
              <Text className="text-muted-foreground text-sm text-center">
                Obrigado por ajudar a manter a Ziva segura. A nossa equipa vai analisar o conteúdo.
              </Text>
              <Pressable onPress={handleClose} className="bg-primary rounded-2xl px-8 py-3 mt-2">
                <Text className="text-primary-foreground font-bold">Fechar</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
              <Text className="text-foreground font-semibold mb-2">Qual é o motivo da denúncia?</Text>
              {REASONS.map((r) => (
                <Pressable
                  key={r.key}
                  onPress={() => setSelected(r.key)}
                  className={`flex-row items-center px-4 py-3.5 rounded-2xl border ${selected === r.key ? 'border-primary bg-primary/10' : 'border-border bg-muted'}`}
                  style={{ borderCurve: 'continuous' }}
                >
                  <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${selected === r.key ? 'border-primary bg-primary' : 'border-border'}`}>
                    {selected === r.key && <View className="w-2 h-2 rounded-full bg-white" />}
                  </View>
                  <Text className="text-foreground text-sm flex-1">{r.label}</Text>
                </Pressable>
              ))}

              {selected === 'other' && (
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Descreve o problema..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  maxLength={300}
                  className="bg-muted border border-border rounded-xl px-4 py-3 text-foreground text-sm mt-1"
                />
              )}

              <Pressable
                onPress={submit}
                disabled={!selected || submitting}
                className="bg-red-500 rounded-2xl py-4 items-center mt-2"
                style={{ opacity: !selected || submitting ? 0.5 : 1 }}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text className="text-white font-bold text-base">Enviar Denúncia</Text>}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
