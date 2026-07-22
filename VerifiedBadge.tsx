import { View, Text } from 'react-native';

/**
 * Selo azul de verificação Ziva — círculo #2563EB com ✓ branco.
 * Distribuído automaticamente a todos os utilizadores.
 */
export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#2563EB',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text style={{
        color: '#fff',
        fontSize: size * 0.55,
        fontWeight: '900',
        lineHeight: size * 0.7,
        includeFontPadding: false,
      }}>
        ✓
      </Text>
    </View>
  );
}
