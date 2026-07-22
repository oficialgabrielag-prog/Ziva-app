import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

interface ZivaIconProps {
  size?: number;
  animate?: boolean;
  color?: string;
}

/**
 * Ícone Ziva — círculo gradiente roxo-azul com letra Z branca e halo neon.
 */
export function ZivaIcon({ size = 40, animate = true }: ZivaIconProps) {
  const glow = useSharedValue(0.3);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!animate) return;
    glow.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
  }, [animate, glow, scale]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: scale.value }],
  }));

  const fontSize = Math.round(size * 0.52);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Halo neon roxo-azul pulsante */}
      <Animated.View style={[{
        position: 'absolute',
        width: size * 1.6,
        height: size * 1.6,
        borderRadius: size * 0.8,
        backgroundColor: '#7B3FF2',
      }, glowStyle]} />

      {/* Círculo gradiente simulado: camada azul + roxo sobre ela */}
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#3B82F6',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#7B3FF2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
      }}>
        {/* sobreposição roxa para simular gradiente */}
        <View style={{
          position: 'absolute', width: size, height: size, borderRadius: size / 2,
          backgroundColor: '#7B3FF2', opacity: 0.65,
        }} />
        <Text style={{
          fontSize, fontWeight: '900', color: '#ffffff',
          lineHeight: fontSize * 1.1, letterSpacing: -1,
          includeFontPadding: false, zIndex: 1,
        }}>Z</Text>
      </View>
    </View>
  );
}
