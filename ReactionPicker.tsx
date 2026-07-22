import { useState, useRef } from 'react';
import {
  View, Text, Pressable, Modal, Animated as RNAnimated,
} from 'react-native';

export const REACTIONS = [
  { type: 'love',  emoji: '❤️', label: 'Amei' },
  { type: 'like',  emoji: '👍', label: 'Gostei' },
  { type: 'haha',  emoji: '😂', label: 'Haha' },
  { type: 'wow',   emoji: '😮', label: 'Uau' },
  { type: 'sad',   emoji: '😢', label: 'Triste' },
  { type: 'angry', emoji: '😡', label: 'Grr' },
  { type: 'clap',  emoji: '👏', label: 'Palmas' },
  { type: 'fire',  emoji: '🔥', label: 'Fogo' },
  { type: 'ziva',  emoji: '💜', label: 'Ziva' },
] as const;

export type ReactionType = (typeof REACTIONS)[number]['type'];

export function getReactionEmoji(type: string): string {
  return REACTIONS.find((r) => r.type === type)?.emoji ?? '❤️';
}

interface ReactionPickerProps {
  visible: boolean;
  onSelect: (type: ReactionType) => void;
  onClose: () => void;
}

export function ReactionPicker({ visible, onSelect, onClose }: ReactionPickerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
        onPress={onClose}
      >
        <View style={{
          position: 'absolute',
          bottom: 80,
          left: 16,
          right: 16,
          backgroundColor: '#fff',
          borderRadius: 24,
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
          elevation: 12,
        }}>
          <Text style={{
            fontSize: 13,
            fontWeight: '600',
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: 12,
          }}>
            Escolhe uma reação
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {REACTIONS.map((r, i) => (
              <Pressable
                key={r.type}
                onPress={() => { onSelect(r.type); onClose(); }}
                onPressIn={() => setHoveredIndex(i)}
                onPressOut={() => setHoveredIndex(null)}
                style={{
                  alignItems: 'center',
                  padding: 10,
                  borderRadius: 16,
                  backgroundColor: hoveredIndex === i ? '#f3f0ff' : 'transparent',
                  transform: [{ scale: hoveredIndex === i ? 1.18 : 1 }],
                  width: 64,
                }}
              >
                <Text style={{ fontSize: 30 }}>{r.emoji}</Text>
                <Text style={{ fontSize: 10, color: '#7c3aed', marginTop: 3, fontWeight: '600' }}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

interface QuickReactionProps {
  currentReaction: ReactionType | null;
  count: number;
  onTap: () => void;          // alterna reação padrão (❤️)
  onLongPress: () => void;    // abre picker
}

export function QuickReaction({ currentReaction, count, onTap, onLongPress }: QuickReactionProps) {
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;

  const handlePress = () => {
    RNAnimated.sequence([
      RNAnimated.timing(scaleAnim, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      RNAnimated.timing(scaleAnim, { toValue: 1.0, duration: 120, useNativeDriver: true }),
    ]).start();
    onTap();
  };

  const emoji = currentReaction ? getReactionEmoji(currentReaction) : null;
  const active = !!currentReaction;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={400}
      className="flex-row items-center gap-1.5 active:opacity-70"
    >
      <RNAnimated.Text
        style={{
          fontSize: 22,
          transform: [{ scale: scaleAnim }],
        }}
      >
        {active ? emoji : '🤍'}
      </RNAnimated.Text>
      <Text className={`text-sm font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}>
        {count > 0 ? count : ''}
      </Text>
    </Pressable>
  );
}
