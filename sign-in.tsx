import { useState, useEffect } from 'react';
import {
  Text, TextInput, Pressable, View, ScrollView,
  KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { supabase } from '@/client/supabase';

const PURPLE = '#7B3FF2';
const INPUT_BG = 'rgba(255,255,255,0.07)';
const INPUT_BORDER = 'rgba(255,255,255,0.12)';
const INPUT_BORDER_FOCUS = 'rgba(123,63,242,0.6)';

function AuthInput({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize,
  onSubmitEditing, returnKeyType, focused, onFocus, onBlur,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'words';
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'next';
  focused?: boolean; onFocus?: () => void; onBlur?: () => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.3 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#4B5563"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType ?? 'next'}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{
          backgroundColor: INPUT_BG,
          borderWidth: 1,
          borderColor: focused ? INPUT_BORDER_FOCUS : INPUT_BORDER,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 15,
          color: '#F9FAFB',
        }}
      />
    </View>
  );
}

/* Traduz erros do Supabase para Português */
function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Utilizador ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirma o teu email antes de entrar.';
  if (msg.includes('User already registered')) return 'Este email já está registado.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('duplicate key') && msg.includes('username')) return 'Este nome de utilizador já está em uso.';
  if (msg.includes('duplicate key')) return 'Este email já está registado.';
  if (msg.includes('Unable to validate email address')) return 'Endereço de email inválido.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Sem ligação à internet. Tenta novamente.';
  return msg;
}

export default function SignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();

  const [mode, setMode] = useState<'login' | 'register'>(
    params.mode === 'register' ? 'register' : 'login'
  );

  // Campos de login: aceita username ou email
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');

  // Campos de cadastro
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState('');

  // Atualizar modo quando o parâmetro mudar
  useEffect(() => {
    if (params.mode === 'register') setMode('register');
    else if (params.mode === 'login') setMode('login');
  }, [params.mode]);

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError('');
    setLoginInput(''); setPassword('');
    setRegEmail(''); setRegPassword(''); setRegUsername(''); setRegFullName('');
  };

  const handleLogin = async () => {
    const input = loginInput.trim();
    const pass = password.trim();
    if (!input || !pass) { setError('Preencha todos os campos.'); return; }
    setLoading(true);
    setError('');

    // Detectar se é email ou username
    let emailToUse = input;
    const isEmail = input.includes('@') && input.includes('.');

    if (!isEmail) {
      // Buscar email pelo username via RPC
      const { data, error: rpcErr } = await supabase.rpc('get_email_by_username', { p_username: input });
      if (rpcErr || !data) {
        setError('Utilizador não encontrado.');
        setLoading(false);
        return;
      }
      emailToUse = data as string;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: emailToUse, password: pass });
    if (signInErr) setError(translateError(signInErr.message));
    else router.replace('/');
    setLoading(false);
  };

  const handleRegister = async () => {
    const usr = regUsername.trim().toLowerCase();
    const name = regFullName.trim();
    const em = regEmail.trim().toLowerCase();
    const pass = regPassword;

    if (!usr || !name || !em || !pass) { setError('Preencha todos os campos.'); return; }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(usr)) {
      setError('Nome de utilizador: 3-30 caracteres, apenas letras, números e _');
      return;
    }
    if (pass.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (!em.includes('@') || !em.includes('.')) { setError('Endereço de email inválido.'); return; }

    setLoading(true);
    setError('');

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: em,
      password: pass,
      options: {
        data: { username: usr, full_name: name },
      },
    });

    if (signUpErr) { setError(translateError(signUpErr.message)); setLoading(false); return; }

    // Se o email já está confirmado (magic link desactivado) vai directo para home
    if (data.session) {
      router.replace('/');
    } else {
      // Email de confirmação enviado — informar utilizador
      setError('');
      setMode('login');
      setLoginInput(usr);
    }
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#09090B' }}>
      <StatusBar style="light" backgroundColor="#09090B" />

      {/* Brilho de fundo */}
      <View style={{ position: 'absolute', top: -60, left: '50%', marginLeft: -150,
        width: 300, height: 300, borderRadius: 150, backgroundColor: PURPLE, opacity: 0.06 }} />
      <View style={{ position: 'absolute', bottom: 0, right: -80,
        width: 250, height: 250, borderRadius: 125, backgroundColor: '#3B82F6', opacity: 0.05 }} />

      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center',
            paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ── */}
          <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center', marginBottom: 32 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center',
              shadowColor: PURPLE, shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5, shadowRadius: 20, elevation: 12, marginBottom: 16,
            }}>
              <Text style={{ fontSize: 38, fontWeight: '900', color: '#fff',
                includeFontPadding: false }}>Z</Text>
            </View>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#F9FAFB', letterSpacing: -1 }}>Ziva</Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
              {mode === 'login' ? 'Bem-vindo de volta! 👋' : 'Cria a tua conta gratuita'}
            </Text>
          </Animated.View>

          {/* ── Card ── */}
          <Animated.View entering={FadeInDown.delay(150).duration(500)} style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderRadius: 24, padding: 24, gap: 18,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>

            {/* Selector de modo */}
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 14, padding: 3, gap: 3 }}>
              {(['login', 'register'] as const).map((m) => (
                <Pressable key={m} onPress={() => switchMode(m)}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                    backgroundColor: mode === m ? PURPLE : 'transparent',
                    shadowColor: mode === m ? PURPLE : 'transparent',
                    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: mode === m ? 3 : 0 }}>
                  <Text style={{ fontWeight: '700', fontSize: 14,
                    color: mode === m ? '#fff' : '#6B7280' }}>
                    {m === 'login' ? 'Entrar' : 'Cadastrar'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* ── CAMPOS DE CADASTRO ── */}
            {mode === 'register' && (
              <>
                <AuthInput label="Nome completo" value={regFullName} onChangeText={setRegFullName}
                  placeholder="ex: João Silva" autoCapitalize="words"
                  focused={focusedField === 'fullname'}
                  onFocus={() => setFocusedField('fullname')} onBlur={() => setFocusedField('')} />
                <AuthInput label="Nome de utilizador" value={regUsername}
                  onChangeText={(v) => setRegUsername(v.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  placeholder="ex: joao_silva"
                  focused={focusedField === 'username'}
                  onFocus={() => setFocusedField('username')} onBlur={() => setFocusedField('')} />
                <AuthInput label="E-mail" value={regEmail} onChangeText={setRegEmail}
                  placeholder="seuemail@exemplo.com" keyboardType="email-address"
                  focused={focusedField === 'regemail'}
                  onFocus={() => setFocusedField('regemail')} onBlur={() => setFocusedField('')} />
                <AuthInput label="Senha" value={regPassword} onChangeText={setRegPassword}
                  placeholder="Mínimo 6 caracteres" secureTextEntry
                  returnKeyType="done" onSubmitEditing={handleRegister}
                  focused={focusedField === 'regpass'}
                  onFocus={() => setFocusedField('regpass')} onBlur={() => setFocusedField('')} />
              </>
            )}

            {/* ── CAMPOS DE LOGIN ── */}
            {mode === 'login' && (
              <>
                <AuthInput label="Utilizador ou email" value={loginInput} onChangeText={setLoginInput}
                  placeholder="@seuusuario ou email"
                  focused={focusedField === 'logininput'}
                  onFocus={() => setFocusedField('logininput')} onBlur={() => setFocusedField('')} />
                <AuthInput label="Senha" value={password} onChangeText={setPassword}
                  placeholder="A tua senha" secureTextEntry
                  returnKeyType="done" onSubmitEditing={handleLogin}
                  focused={focusedField === 'loginpass'}
                  onFocus={() => setFocusedField('loginpass')} onBlur={() => setFocusedField('')} />
              </>
            )}

            {/* Erro */}
            {error ? (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 10,
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}>
                <Text style={{ color: '#F87171', fontSize: 13, textAlign: 'center' }}>{error}</Text>
              </View>
            ) : null}

            {/* Botão principal */}
            <Pressable
              onPress={mode === 'login' ? handleLogin : handleRegister}
              disabled={loading}
              style={{ backgroundColor: loading ? 'rgba(123,63,242,0.5)' : PURPLE,
                borderRadius: 16, paddingVertical: 15, alignItems: 'center',
                shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                    {mode === 'login' ? 'Entrar' : 'Criar conta'}
                  </Text>}
            </Pressable>
          </Animated.View>

          {/* Termos */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}
            style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ color: '#4B5563', fontSize: 11, textAlign: 'center', paddingHorizontal: 16 }}>
              Ao continuar, concordas com os nossos{' '}
              <Text style={{ color: PURPLE }}>Termos</Text>{' '}e{' '}
              <Text style={{ color: PURPLE }}>Privacidade</Text>.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
