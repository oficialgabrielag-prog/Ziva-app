import { useEffect } from 'react';
import { Text, View, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence,
  Easing, FadeInDown, FadeIn,
} from 'react-native-reanimated';

/* ─── Partícula flutuante ───────────────────────────────────────────── */
function Particle({ x, delay, size }: { x: number; delay: number; size: number }) {
  const { height: H } = useWindowDimensions();
  const y = useSharedValue(H + 20);
  const op = useSharedValue(0);

  useEffect(() => {
    const dur = 4000 + Math.random() * 3000;
    const startY = H + 20;
    const endY = -20;
    setTimeout(() => {
      op.value = withRepeat(
        withSequence(withTiming(0.7, { duration: 800 }), withTiming(0, { duration: dur - 800 })),
        -1, false,
      );
      y.value = withRepeat(withTiming(endY, { duration: dur, easing: Easing.linear }), -1, false);
    }, delay);
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: y.value }] }));

  return (
    <Animated.View style={[{
      position: 'absolute', left: x,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: Math.random() > 0.5 ? '#7B3FF2' : '#3B82F6',
    }, style]} />
  );
}

/* ─── Logo Z 3D Neon ────────────────────────────────────────────────── */
function ZLogo() {
  const glow = useSharedValue(0.4);
  const rot = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
    rot.value = withRepeat(
      withSequence(withTiming(3, { duration: 2500 }), withTiming(-3, { duration: 2500 })),
      -1, true,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const rotStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  return (
    <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, rotStyle]}>
      {/* Halo triplo */}
      <Animated.View style={[{
        position: 'absolute', width: 200, height: 200, borderRadius: 100,
        backgroundColor: '#7B3FF2',
      }, glowStyle, { opacity: 0.08 }]} />
      <Animated.View style={[{
        position: 'absolute', width: 150, height: 150, borderRadius: 75,
        backgroundColor: '#7B3FF2',
      }, glowStyle, { opacity: 0.15 }]} />
      <Animated.View style={[{
        position: 'absolute', width: 110, height: 110, borderRadius: 55,
        backgroundColor: '#3B82F6',
      }, glowStyle, { opacity: 0.2 }]} />

      {/* Círculo principal gradiente */}
      <View style={{
        width: 90, height: 90, borderRadius: 45,
        backgroundColor: '#3B82F6',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.8, shadowRadius: 24, elevation: 20,
      }}>
        <View style={{
          position: 'absolute', width: 90, height: 90, borderRadius: 45,
          backgroundColor: '#7B3FF2', opacity: 0.7,
        }} />
        <Text style={{
          fontSize: 46, fontWeight: '900', color: '#fff',
          includeFontPadding: false, zIndex: 1,
          textShadowColor: 'rgba(123,63,242,0.8)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 12,
        }}>Z</Text>
      </View>
    </Animated.View>
  );
}

/* ─── Wave decoration ──────────────────────────────────────────────── */
function WaveDecor() {
  const { height: H } = useWindowDimensions();
  const shift = useSharedValue(0);
  useEffect(() => {
    shift.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value * 30 - 15 }] }));
  return (
    <Animated.View style={[{ position: 'absolute', top: H * 0.35, left: -40, right: -40, height: 120, opacity: 0.12 }, style]}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{
          position: 'absolute',
          top: i * 35,
          left: 0, right: 0,
          height: 2,
          backgroundColor: i % 2 === 0 ? '#7B3FF2' : '#3B82F6',
          borderRadius: 1,
        }} />
      ))}
    </Animated.View>
  );
}

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();

  // Partículas calculadas com largura real (funciona em web e nativo)
  const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
    x: (W / 18) * i + Math.random() * 20,
    delay: i * 300,
    size: 3 + Math.random() * 5,
  }));

  return (
    // overflow hidden: corta partículas/decorações que saiam para fora no browser
    <View style={{ flex: 1, backgroundColor: '#09090B', overflow: 'hidden' }}>
      <StatusBar style="light" backgroundColor="#09090B" />

      {/* Partículas de fundo */}
      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}
      <WaveDecor />

      {/* Fundo gradiente radial simulado */}
      <View style={{
        position: 'absolute', top: -80, left: W / 2 - 200,
        width: 400, height: 400, borderRadius: 200,
        backgroundColor: '#7B3FF2', opacity: 0.07,
      }} />
      <View style={{
        position: 'absolute', top: 200, right: -100,
        width: 300, height: 300, borderRadius: 150,
        backgroundColor: '#3B82F6', opacity: 0.06,
      }} />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo + Título ── */}
        <Animated.View entering={FadeIn.duration(800)} style={{ alignItems: 'center', paddingTop: 40 }}>
          <ZLogo />
          <View style={{ marginTop: 28, alignItems: 'center', gap: 6 }}>
            <Text style={{
              fontSize: 52, fontWeight: '900', color: '#F9FAFB',
              letterSpacing: -2,
              textShadowColor: 'rgba(123,63,242,0.6)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 16,
            }}>Ziva</Text>
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#7B3FF2', letterSpacing: 0.5 }}>
              A rede social da nova geração.
            </Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
              Conecte-se. Compartilhe. Evolua.
            </Text>
          </View>
        </Animated.View>

        {/* ── Tags de IA ── */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)}
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 32, paddingHorizontal: 24 }}>
          {['Inteligência Artificial', 'Angola 🇦🇴', 'Premium'].map((tag) => (
            <View key={tag} style={{
              backgroundColor: 'rgba(123,63,242,0.15)',
              borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
              borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)',
            }}>
              <Text style={{ color: '#A78BFA', fontSize: 11, fontWeight: '700' }}>{tag}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Cards de features ── */}
        <Animated.View entering={FadeInDown.delay(600).duration(600)}
          style={{ paddingHorizontal: 24, marginTop: 36, gap: 12 }}>
          {[
            { icon: '🤖', title: 'IA Integrada', desc: 'Ziva IA responde, cria e pesquisa por ti' },
            { icon: '📸', title: 'Stories & Reels', desc: 'Partilha momentos que ficam na memória' },
            { icon: '🌍', title: 'Comunidade Angola', desc: 'Conecta-te com pessoas de toda Angola' },
          ].map((f, i) => (
            <Animated.View key={f.title} entering={FadeInDown.delay(700 + i * 100).duration(500)}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: 20, padding: 16,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
              }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: 'rgba(123,63,242,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 22 }}>{f.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F9FAFB', fontWeight: '700', fontSize: 14 }}>{f.title}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{f.desc}</Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        {/* ── Botões CTA ── */}
        <Animated.View entering={FadeInDown.delay(1000).duration(500)}
          style={{ paddingHorizontal: 24, marginTop: 36, gap: 12 }}>
          {/* Criar conta — gradiente */}
          <Pressable
            onPress={() => router.push('/(auth)/sign-in?mode=register' as any)}
            style={{ borderRadius: 20, overflow: 'hidden' }}
            className="active:opacity-85"
          >
            <View style={{
              backgroundColor: '#3B82F6',
              paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
              shadowColor: '#7B3FF2', shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
            }}>
              <View style={{
                position: 'absolute', inset: 0,
                backgroundColor: '#7B3FF2', opacity: 0.6,
              }} />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, zIndex: 1 }}>
                Criar conta
              </Text>
            </View>
          </Pressable>

          {/* Entrar — contorno */}
          <Pressable
            onPress={() => router.push('/(auth)/sign-in?mode=login' as any)}
            style={{
              borderRadius: 20, borderWidth: 1.5,
              borderColor: 'rgba(123,63,242,0.5)',
              paddingVertical: 16, alignItems: 'center',
              backgroundColor: 'rgba(123,63,242,0.08)',
            }}
            className="active:opacity-75"
          >
            <Text style={{ color: '#A78BFA', fontWeight: '700', fontSize: 16 }}>Entrar</Text>
          </Pressable>
        </Animated.View>

        {/* Termos */}
        <Animated.View entering={FadeInDown.delay(1100).duration(400)}
          style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={{ color: '#4B5563', fontSize: 11, textAlign: 'center', paddingHorizontal: 32 }}>
            Ao continuar, concordas com os nossos{' '}
            <Text style={{ color: '#7B3FF2' }}>Termos</Text>{' '}e{' '}
            <Text style={{ color: '#7B3FF2' }}>Privacidade</Text>.
          </Text>
        </Animated.View>

        {/* Feito com ❤ em Angola */}
        <Animated.View entering={FadeInDown.delay(1200).duration(400)}
          style={{ alignItems: 'center', marginTop: 24 }}>
          <Text style={{ color: '#374151', fontSize: 11 }}>Feito com ❤️ em Angola 🇦🇴</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
