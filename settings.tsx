import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  Switch, ActivityIndicator, Modal, KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import {
  ArrowLeft, ChevronRight, User, Lock, Bell, Palette,
  Brain, HelpCircle, LogOut, Globe, Moon,
  Shield, HardDrive, Accessibility, Eye, EyeOff, Key,
  FileText, BookOpen, Info, Settings,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { useZivaTheme } from '@/lib/theme-context';
import type { ThemePreference } from '@/lib/theme-context';

interface UserSettings {
  theme: string;
  language: string;
  notifications_likes: boolean;
  notifications_comments: boolean;
  notifications_follows: boolean;
  notifications_mentions: boolean;
  notifications_messages: boolean;
  profile_public: boolean;
  ziva_personality: string;
  ziva_memory: boolean;
  font_size: string;
  high_contrast: boolean;
  gemini_api_key: string;
}

interface Profile {
  username: string;
  full_name: string;
  bio: string;
  email?: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark', language: 'pt-AO',
  notifications_likes: true, notifications_comments: true,
  notifications_follows: true, notifications_mentions: true,
  notifications_messages: true,
  profile_public: true,
  ziva_personality: 'amigavel', ziva_memory: true,
  font_size: 'normal', high_contrast: false,
  gemini_api_key: '',
};

function SectionHeader({ title }: { title: string }) {
  const { colors } = useZivaTheme();
  return (
    <Text style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8,
      fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1.2,
      textTransform: 'uppercase', backgroundColor: colors.bg }}>
      {title}
    </Text>
  );
}

function SettingRow({ icon, label, value, onPress, danger }: {
  icon: React.ReactNode; label: string; value?: string;
  onPress?: () => void; danger?: boolean;
}) {
  const { colors } = useZivaTheme();
  return (
    <Pressable
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder,
        gap: 14, opacity: 1 }}
      onPress={onPress}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: danger ? 'rgba(239,68,68,0.12)' : 'rgba(123,63,242,0.15)' }}>
        {icon}
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '500',
        color: danger ? colors.danger : colors.text }}>{label}</Text>
      {value ? <Text style={{ color: colors.muted, fontSize: 13, marginRight: 4 }}>{value}</Text> : null}
      {onPress && <ChevronRight size={16} color={colors.muted} />}
    </Pressable>
  );
}

function ToggleRow({ icon, label, value, onChange }: {
  icon: React.ReactNode; label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  const { colors } = useZivaTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder, gap: 14 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(123,63,242,0.15)' }}>{icon}</View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: colors.text }}>{label}</Text>
      <Switch value={value} onValueChange={onChange}
        trackColor={{ false: colors.inputBorder, true: colors.purple }}
        thumbColor="#fff"
        ios_backgroundColor={colors.inputBorder} />
    </View>
  );
}

function ChipSelector<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useZivaTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)}
          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
            backgroundColor: value === o.key ? colors.purple : colors.input,
            borderWidth: 1,
            borderColor: value === o.key ? 'rgba(123,63,242,0.5)' : colors.inputBorder,
            shadowColor: value === o.key ? colors.purple : 'transparent',
            shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6,
            elevation: value === o.key ? 3 : 0 }}>
          <Text style={{ fontSize: 12, fontWeight: '600',
            color: value === o.key ? '#fff' : colors.muted }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function InfoBlock({ title, children, colors }: {
  title: string; children: string;
  colors: { card: string; cardBorder: string; text: string; muted: string; };
}) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, gap: 6,
      borderWidth: 1, borderColor: colors.cardBorder }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{title}</Text>
      <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 21 }}>{children}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { session } = useSession();
  const router = useRouter();
  const userId = session?.user?.id ?? '';
  const userEmail = session?.user?.email ?? '';
  const { colors, preference, setMode } = useZivaTheme();

  const [profile, setProfile] = useState<Profile>({ username: '', full_name: '', bio: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<'username' | 'full_name' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [pwFeedback, setPwFeedback] = useState('');
  const [geminiKeyVisible, setGeminiKeyVisible] = useState(false);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  const [infoModal, setInfoModal] = useState<'sobre' | 'privacidade' | 'diretrizes' | null>(null);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setLoading(true);
        const [profRes, settingsRes] = await Promise.all([
          supabase.from('profiles').select('username, full_name, bio, is_admin').eq('id', userId).single(),
          supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
        ]);
        if (profRes.data) {
          setProfile({ ...profRes.data, email: userEmail });
          setIsAdmin(profRes.data.is_admin ?? false);
        }
        if (settingsRes.data) {
          const s = { ...DEFAULT_SETTINGS, ...settingsRes.data };
          setSettings(s);
          // Restaurar tema guardado na BD — propaga para ZivaThemeProvider
          const savedTheme = s.theme as ThemePreference;
          if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
            setMode(savedTheme);
          }
        }
        setLoading(false);
      };
      load();
    }, [userId, userEmail, setMode])
  );

  const saveSettings = async (updates: Partial<UserSettings>) => {
    const merged = { ...settings, ...updates };
    setSettings(merged);
    setSaving(true);
    // Aplicar tema imediatamente — propaga para toda a app via ZivaThemeContext
    if (updates.theme !== undefined) {
      const pref = updates.theme as ThemePreference;
      setMode(pref === 'light' || pref === 'dark' || pref === 'system' ? pref : 'dark');
    }
    await supabase.from('user_settings')
      .upsert({ user_id: userId, ...merged, updated_at: new Date().toISOString() });
    setSaving(false);
  };

  const handleChangePassword = async () => {
    const email = session?.user?.email;
    if (!email) return;
    await supabase.auth.resetPasswordForEmail(email);
    setPwFeedback(`Email de recuperação enviado para ${email}`);
    setTimeout(() => { setPwFeedback(''); setShowPasswordModal(false); }, 3000);
  };

  const openEdit = (field: 'username' | 'full_name') => {
    setEditValue(field === 'username' ? profile.username : profile.full_name);
    setEditError('');
    setShowEditModal(field);
  };

  const handleSaveEdit = async () => {
    if (!showEditModal) return;
    const val = editValue.trim();
    if (!val) { setEditError('Este campo não pode ficar vazio.'); return; }
    if (showEditModal === 'username' && !/^[a-zA-Z0-9_]{3,30}$/.test(val)) {
      setEditError('Nome de utilizador inválido (3-30 caracteres, letras, números e _).');
      return;
    }
    setEditSaving(true); setEditError('');
    const field = showEditModal === 'username' ? 'username' : 'full_name';
    const { error } = await supabase.from('profiles').update({ [field]: val }).eq('id', userId);
    if (error) {
      setEditError(error.message.includes('unique') ? 'Este nome de utilizador já está em uso.' : error.message);
      setEditSaving(false); return;
    }
    setProfile((prev) => ({ ...prev, [field]: val }));
    setEditSaving(false); setShowEditModal(null);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); };
  const handleDeleteAccount = async () => { await supabase.auth.signOut(); };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />
        <ActivityIndicator size="large" color={colors.purple} />
      </View>
    );
  }

  const PURPLE = colors.purple;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />

      {/* ── Cabeçalho ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder,
        backgroundColor: colors.bg }}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/home' as any)}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.input }}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: colors.text }}>Configurações</Text>
        {saving && <ActivityIndicator size="small" color={PURPLE} />}
      </View>

      <ScrollView style={{ backgroundColor: colors.bg }} contentInsetAdjustmentBehavior="automatic">

        {/* ── Conta ── */}
        <SectionHeader title="Conta" />
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
          <SettingRow icon={<User size={18} color="#A78BFA" />} label="Utilizador"
            value={`@${profile.username}`} onPress={() => openEdit('username')} />
          <SettingRow icon={<User size={18} color="#A78BFA" />} label="Nome"
            value={profile.full_name || '—'} onPress={() => openEdit('full_name')} />
          <SettingRow icon={<User size={18} color="#A78BFA" />} label="Email"
            value={profile.email ?? '—'} />
        </View>

        {/* ── Privacidade ── */}
        <SectionHeader title="Privacidade" />
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
          <ToggleRow icon={<Shield size={18} color="#A78BFA" />} label="Perfil público"
            value={settings.profile_public} onChange={(v) => saveSettings({ profile_public: v })} />
        </View>

        {/* ── Segurança ── */}
        <SectionHeader title="Segurança" />
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
          <SettingRow icon={<Lock size={18} color="#A78BFA" />} label="Alterar palavra-passe"
            onPress={() => setShowPasswordModal(true)} />
        </View>

        {/* ── Notificações ── */}
        <SectionHeader title="Notificações" />
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
          <ToggleRow icon={<Bell size={18} color="#A78BFA" />} label="Reações"
            value={settings.notifications_likes} onChange={(v) => saveSettings({ notifications_likes: v })} />
          <ToggleRow icon={<Bell size={18} color="#A78BFA" />} label="Comentários"
            value={settings.notifications_comments} onChange={(v) => saveSettings({ notifications_comments: v })} />
          <ToggleRow icon={<Bell size={18} color="#A78BFA" />} label="Novos seguidores"
            value={settings.notifications_follows} onChange={(v) => saveSettings({ notifications_follows: v })} />
          <ToggleRow icon={<Bell size={18} color="#A78BFA" />} label="Menções"
            value={settings.notifications_mentions} onChange={(v) => saveSettings({ notifications_mentions: v })} />
          <ToggleRow icon={<Bell size={18} color="#A78BFA" />} label="Mensagens"
            value={settings.notifications_messages} onChange={(v) => saveSettings({ notifications_messages: v })} />
        </View>

        {/* ── Idioma ── */}
        <SectionHeader title="Idioma" />
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
            backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder, gap: 14, flexWrap: 'wrap' }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(123,63,242,0.15)' }}>
              <Globe size={18} color="#60A5FA" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text, marginRight: 8 }}>Idioma</Text>
            <ChipSelector
              options={[{ key: 'pt-AO', label: '🇦🇴 Português (Angola)' }, { key: 'pt-PT', label: '🇵🇹 Português (Portugal)' }]}
              value={settings.language as any}
              onChange={(v) => saveSettings({ language: v })}
            />
          </View>
        </View>

        {/* ── Aparência ── */}
        <SectionHeader title="Aparência" />
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
            backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder, gap: 14, flexWrap: 'wrap' }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(123,63,242,0.15)' }}>
              <Palette size={18} color="#A78BFA" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text, marginRight: 8 }}>Tema</Text>
            <ChipSelector
              options={[{ key: 'light', label: '☀️ Claro' }, { key: 'dark', label: '🌙 Escuro' }, { key: 'system', label: '🔄 Auto' }]}
              value={preference}
              onChange={(v) => saveSettings({ theme: v })}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
            backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder, gap: 14, flexWrap: 'wrap' }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(123,63,242,0.15)' }}>
              <Moon size={18} color="#A78BFA" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text, marginRight: 8 }}>Tamanho da fonte</Text>
            <ChipSelector
              options={[{ key: 'small', label: 'Pequena' }, { key: 'normal', label: 'Normal' }, { key: 'large', label: 'Grande' }]}
              value={settings.font_size as any}
              onChange={(v) => saveSettings({ font_size: v })}
            />
          </View>
        </View>

        {/* ── Acessibilidade ── */}
        <SectionHeader title="Acessibilidade" />
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
          <ToggleRow icon={<Accessibility size={18} color="#A78BFA" />} label="Alto contraste"
            value={settings.high_contrast} onChange={(v) => saveSettings({ high_contrast: v })} />
        </View>

        {/* ── Armazenamento ── */}
        <SectionHeader title="Armazenamento" />
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
          <SettingRow icon={<HardDrive size={18} color="#60A5FA" />} label="Limpar cache" onPress={() => {}} />
        </View>

        {/* ── Ziva IA ── */}
        <SectionHeader title="Ziva IA" />
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
            backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder, gap: 14, flexWrap: 'wrap' }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(123,63,242,0.15)' }}>
              <Brain size={18} color="#A78BFA" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text, marginRight: 8 }}>Personalidade da IA</Text>
            <ChipSelector
              options={[
                { key: 'amigavel', label: '😊 Amigável' },
                { key: 'profissional', label: '💼 Prof.' },
                { key: 'humoristico', label: '😄 Humor' },
              ]}
              value={settings.ziva_personality as any}
              onChange={(v) => saveSettings({ ziva_personality: v })}
            />
          </View>
          <ToggleRow icon={<Brain size={18} color="#A78BFA" />} label="Memória de conversas"
            value={settings.ziva_memory} onChange={(v) => saveSettings({ ziva_memory: v })} />

          {/* Chave API Gemini */}
          <View style={{ backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder,
            paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(251,191,36,0.12)' }}>
                <Key size={18} color="#FBBF24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Chave API Gemini 🧠</Text>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                  Usa a tua própria chave para IA sem limites
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={settings.gemini_api_key}
                onChangeText={(v) => setSettings((s) => ({ ...s, gemini_api_key: v }))}
                placeholder="AIza..."
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!geminiKeyVisible}
                autoCorrect={false}
                autoCapitalize="none"
                style={{
                  flex: 1, backgroundColor: colors.input,
                  borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
                  color: colors.text, fontSize: 13,
                  borderWidth: 1, borderColor: colors.inputBorder,
                }}
              />
              <Pressable onPress={() => setGeminiKeyVisible((v) => !v)} style={{ padding: 8 }}>
                {geminiKeyVisible ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
              </Pressable>
              <Pressable
                onPress={async () => {
                  await saveSettings({ gemini_api_key: settings.gemini_api_key });
                  setGeminiKeySaved(true);
                  setTimeout(() => setGeminiKeySaved(false), 2000);
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                  backgroundColor: geminiKeySaved ? 'rgba(34,197,94,0.2)' : PURPLE }}>
                <Text style={{ color: geminiKeySaved ? '#4ADE80' : '#fff', fontSize: 13, fontWeight: '700' }}>
                  {geminiKeySaved ? '✓ Guardado' : 'Guardar'}
                </Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 11, color: colors.muted, lineHeight: 15 }}>
              Obtém a tua chave em{' '}
              <Text style={{ color: PURPLE }}>aistudio.google.com</Text>.
              A chave é guardada de forma segura e usada apenas na Ziva IA.
            </Text>
          </View>
        </View>

        {/* ── Sobre o Ziva ── */}
        <SectionHeader title="Sobre o Ziva" />
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
          <SettingRow icon={<Info size={18} color="#A78BFA" />} label="Sobre o Ziva"
            onPress={() => setInfoModal('sobre')} />
          <SettingRow icon={<Shield size={18} color="#A78BFA" />} label="Política de Privacidade"
            onPress={() => setInfoModal('privacidade')} />
          <SettingRow icon={<BookOpen size={18} color="#A78BFA" />} label="Diretrizes da Comunidade"
            onPress={() => setInfoModal('diretrizes')} />
          <SettingRow icon={<HelpCircle size={18} color="#A78BFA" />} label="Denunciar problema" onPress={() => {}} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
            backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder, gap: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(59,130,246,0.12)' }}>
              <Info size={18} color="#60A5FA" />
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: colors.text }}>Versão do Ziva</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>3.0.0</Text>
          </View>
          <View style={{ alignItems: 'center', paddingVertical: 16, backgroundColor: colors.card,
            borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>Feito com ❤️ em Angola 🇦🇴</Text>
          </View>
        </View>

        {/* ── Administração (só visível para admins) ── */}
        {isAdmin && (
          <>
            <SectionHeader title="Administração" />
            <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
              <SettingRow
                icon={<Settings size={18} color="#F59E0B" />}
                label="Painel de Administração"
                onPress={() => router.push('/(app)/admin' as RelativePathString)}
              />
            </View>
          </>
        )}

        {/* ── Sessão ── */}
        <SectionHeader title="Sessão" />
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.cardBorder }}>
          <SettingRow icon={<LogOut size={18} color={colors.danger} />} label="Terminar sessão"
            onPress={handleSignOut} danger />
          <SettingRow icon={<HelpCircle size={18} color={colors.danger} />} label="Eliminar conta"
            onPress={handleDeleteAccount} danger />
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ── Modal: Alterar palavra-passe ── */}
      <Modal visible={showPasswordModal} transparent animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center',
          alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, width: '100%', gap: 16,
            borderWidth: 1, borderColor: colors.cardBorder }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.inputBorder, alignSelf: 'center', marginBottom: 4 }} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Alterar palavra-passe</Text>
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>
              Enviaremos um link de recuperação para {profile.email}.
            </Text>
            {pwFeedback ? (
              <View style={{ backgroundColor: 'rgba(123,63,242,0.12)', borderRadius: 10, padding: 10,
                borderWidth: 1, borderColor: 'rgba(123,63,242,0.25)' }}>
                <Text style={{ color: '#A78BFA', fontSize: 13, fontWeight: '600' }}>{pwFeedback}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setShowPasswordModal(false)}
                style={{ flex: 1, backgroundColor: colors.input, borderRadius: 12, padding: 14,
                  alignItems: 'center', borderWidth: 1, borderColor: colors.inputBorder }}>
                <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 15 }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleChangePassword}
                style={{ flex: 1, backgroundColor: PURPLE, borderRadius: 12, padding: 14, alignItems: 'center',
                  shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 4 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Enviar email</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Editar nome / username ── */}
      <Modal visible={!!showEditModal} transparent animationType="slide"
        onRequestClose={() => setShowEditModal(null)}>
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, gap: 16, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.inputBorder, alignSelf: 'center', marginBottom: 4 }} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
              {showEditModal === 'username' ? 'Alterar nome de utilizador' : 'Alterar nome completo'}
            </Text>
            <TextInput
              value={editValue}
              onChangeText={setEditValue}
              placeholder={showEditModal === 'username' ? 'ex: joao_silva' : 'ex: João Silva'}
              autoCapitalize={showEditModal === 'username' ? 'none' : 'words'}
              autoCorrect={false}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1, borderColor: editError ? 'rgba(239,68,68,0.5)' : colors.inputBorder,
                borderRadius: 12, padding: 14, fontSize: 16, color: colors.text,
                backgroundColor: colors.input,
              }}
            />
            {editError ? (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 8,
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                <Text style={{ color: colors.danger, fontSize: 13 }}>{editError}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setShowEditModal(null)}
                style={{ flex: 1, backgroundColor: colors.input, borderRadius: 12, padding: 14,
                  alignItems: 'center', borderWidth: 1, borderColor: colors.inputBorder }}>
                <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 15 }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleSaveEdit} disabled={editSaving}
                style={{ flex: 1, backgroundColor: editSaving ? 'rgba(123,63,242,0.5)' : PURPLE,
                  borderRadius: 12, padding: 14, alignItems: 'center',
                  shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 4 }}>
                {editSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Guardar</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Informação (Sobre / Privacidade / Diretrizes) ── */}
      <Modal visible={!!infoModal} transparent animationType="slide"
        onRequestClose={() => setInfoModal(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: '85%', borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.inputBorder }} />
            </View>
            {/* Título */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                {infoModal === 'sobre' ? 'Sobre o Ziva 🌟' :
                 infoModal === 'privacidade' ? 'Política de Privacidade 🔒' :
                 'Diretrizes da Comunidade 📖'}
              </Text>
              <Pressable onPress={() => setInfoModal(null)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.input,
                  alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.muted, fontSize: 18, lineHeight: 22 }}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={{ padding: 20 }} contentInsetAdjustmentBehavior="automatic">
              {infoModal === 'sobre' && (
                <View style={{ gap: 16, paddingBottom: 40 }}>
                  <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
                    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: PURPLE,
                      alignItems: 'center', justifyContent: 'center',
                      shadowColor: PURPLE, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 }}>
                      <Text style={{ fontSize: 36, fontWeight: '900', color: '#fff' }}>Z</Text>
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>Ziva Omega</Text>
                    <Text style={{ fontSize: 13, color: colors.muted }}>Versão 3.0.0 · Feito em Angola 🇦🇴</Text>
                  </View>
                  <InfoBlock colors={colors} title="O que é o Ziva?">
                    {`O Ziva é a primeira rede social angolana com inteligência artificial integrada. Criada para conectar, inspirar e dar voz aos angolanos e à diáspora, o Ziva combina o poder das redes sociais modernas com uma IA angolana — a Ziva IA.`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="🤖 Ziva IA">
                    {`A Ziva IA é uma inteligência artificial treinada com cultura, idioma e contexto angolano. Podes conversar, pedir ajuda para criar publicações, pesquisar tendências e muito mais.`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="📱 Funcionalidades">
                    {`• Feed inteligente com conteúdo personalizado\n• Reels — vídeos curtos\n• Comunidades temáticas\n• Stories que expiram em 24h\n• Mensagens privadas\n• Comentários com áudio\n• Perfil premium com 10 secções\n• Modo claro e escuro`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="🏆 Missão">
                    {`Democratizar a comunicação digital em Angola, criando uma plataforma segura, inclusiva e inovadora, que celebra a cultura angolana e conecta a nossa comunidade globalmente.`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="📬 Contacto">
                    {`Para suporte, parcerias ou mais informações:\ncontato@ziva.ao`}
                  </InfoBlock>
                </View>
              )}
              {infoModal === 'privacidade' && (
                <View style={{ gap: 16, paddingBottom: 40 }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Última actualização: Janeiro de 2025</Text>
                  <InfoBlock colors={colors} title="1. Dados que Recolhemos">
                    {`Recolhemos os dados que forneces ao criar a tua conta (nome, email, foto de perfil), bem como o conteúdo que publicas (fotos, vídeos, textos, áudios) e dados de utilização da plataforma (interações, preferências, registos de acesso).`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="2. Como Usamos os Teus Dados">
                    {`• Prestar e melhorar os serviços do Ziva\n• Personalizar o teu feed e sugestões\n• Garantir a segurança da plataforma\n• Cumprir obrigações legais\n• Enviar notificações relevantes (com o teu consentimento)`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="3. Partilha de Dados">
                    {`Não vendemos os teus dados pessoais a terceiros. Partilhamos dados apenas:\n• Com fornecedores de serviços técnicos essenciais (ex: servidores na nuvem)\n• Quando exigido por lei ou autoridades competentes\n• Com o teu consentimento explícito`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="4. Os Teus Direitos">
                    {`Tens direito a:\n• Aceder aos teus dados pessoais\n• Corrigir dados incorrectos\n• Solicitar a eliminação da tua conta\n• Exportar os teus dados\n• Opor-te ao tratamento para fins de marketing`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="5. Segurança">
                    {`Utilizamos encriptação de ponta a ponta para mensagens privadas, armazenamento seguro de palavras-passe e monitorização contínua para detetar actividades suspeitas.`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="6. Cookies e Rastreamento">
                    {`Utilizamos cookies técnicos essenciais para o funcionamento da plataforma. Não usamos cookies de rastreamento publicitário de terceiros.`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="7. Contacto DPO">
                    {`Para exerceres os teus direitos ou esclarecer dúvidas sobre privacidade:\nprivacidade@ziva.ao`}
                  </InfoBlock>
                </View>
              )}
              {infoModal === 'diretrizes' && (
                <View style={{ gap: 16, paddingBottom: 40 }}>
                  <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 22 }}>
                    O Ziva é um espaço de expressão livre e respeitosa. As seguintes regras garantem uma comunidade saudável para todos.
                  </Text>
                  <InfoBlock colors={colors} title="✅ O que encorajamos">
                    {`• Conteúdo autêntico e criativo\n• Celebração da cultura angolana e africana\n• Debates respeitosos e construtivos\n• Apoio mútuo e positividade\n• Partilha de conhecimento e experiências`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="🚫 Conteúdo Proibido">
                    {`• Discurso de ódio, racismo ou discriminação de qualquer forma\n• Assédio, bullying ou ameaças a outros utilizadores\n• Desinformação e notícias falsas\n• Nudez não consentida ou conteúdo sexual explícito\n• Conteúdo que promova violência ou actividades ilegais\n• Spam ou publicidade não autorizada\n• Perfis falsos ou personificação de outros`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="🔞 Idade Mínima">
                    {`O Ziva é destinado a utilizadores com 13 anos ou mais. Contas de menores sem supervisão parental serão removidas.`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="⚠️ Denúncias">
                    {`Se encontrares conteúdo que viole estas diretrizes, usa o botão "Denunciar" disponível em cada publicação ou perfil. A nossa equipa de moderação analisa todas as denúncias em até 24 horas.`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="⚖️ Consequências">
                    {`Violações das diretrizes podem resultar em:\n• Aviso formal\n• Remoção de conteúdo\n• Suspensão temporária da conta\n• Banimento permanente (casos graves)`}
                  </InfoBlock>
                  <InfoBlock colors={colors} title="📝 Actualizações">
                    {`Estas diretrizes podem ser actualizadas periodicamente. Notificaremos os utilizadores sobre mudanças significativas através de aviso no aplicativo.`}
                  </InfoBlock>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

