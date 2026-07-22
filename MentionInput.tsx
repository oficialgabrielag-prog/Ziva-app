import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable,
  type TextInputProps, type NativeSyntheticEvent, type TextInputSelectionChangeEventData,
} from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '@/client/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────
interface MentionUser {
  id: string;
  username: string;
  avatar_url: string;
}

interface MentionInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  onMentionsChange?: (userIds: string[]) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  style?: TextInputProps['style'];
  className?: string;
}

// ─── Componente ──────────────────────────────────────────────────────────────
export function MentionInput({
  value,
  onChangeText,
  onMentionsChange,
  placeholder = 'Escreve algo…',
  multiline = true,
  maxLength,
  style,
  className,
  ...rest
}: MentionInputProps) {
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  const handleChange = useCallback(async (text: string) => {
    onChangeText(text);

    // Find @mention being typed at cursor position
    const cursor = selectionRef.current.start;
    const before = text.slice(0, cursor);
    const match = before.match(/@(\w*)$/);

    if (match) {
      const q = match[1];
      setMentionQuery(q);
      if (q.length >= 1) {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .ilike('username', `${q}%`)
          .limit(6);
        setSuggestions((data as MentionUser[]) ?? []);
      } else {
        setSuggestions([]);
      }
    } else {
      setMentionQuery(null);
      setSuggestions([]);
    }
  }, [onChangeText]);

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      selectionRef.current = e.nativeEvent.selection;
    }, []
  );

  const insertMention = useCallback((user: MentionUser) => {
    const cursor = selectionRef.current.start;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    // Replace the @query with @username + space
    const replaced = before.replace(/@(\w*)$/, `@${user.username} `);
    const newText = replaced + after;

    onChangeText(newText);
    setSuggestions([]);
    setMentionQuery(null);

    // Track mentioned user ids
    const newIds = [...new Set([...mentionedIds, user.id])];
    setMentionedIds(newIds);
    onMentionsChange?.(newIds);
  }, [value, onChangeText, mentionedIds, onMentionsChange]);

  // Render text with highlighted @mentions
  const renderHighlightedText = () => {
    const parts = value.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <Text key={i} style={{ color: '#7c3aed', fontWeight: '700' }}>{part}</Text>
      ) : (
        <Text key={i}>{part}</Text>
      )
    );
  };

  return (
    <View className="relative">
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        multiline={multiline}
        maxLength={maxLength}
        style={style}
        className={className}
        {...rest}
      />

      {/* Sugestões de menções */}
      {suggestions.length > 0 && mentionQuery !== null && (
        <View
          className="absolute bottom-full left-0 right-0 bg-background border border-border rounded-2xl overflow-hidden z-50"
          style={{ marginBottom: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: -2 }, elevation: 8 }}
        >
          {suggestions.map((user) => (
            <Pressable
              key={user.id}
              onPress={() => insertMention(user)}
              className="flex-row items-center gap-3 px-4 py-3 active:bg-muted border-b border-border"
            >
              <Image
                source={user.avatar_url ? { uri: user.avatar_url } : undefined}
                style={{ width: 36, height: 36, borderRadius: 18 }}
                contentFit="cover"
              />
              <Text className="font-bold text-foreground text-sm">@{user.username}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Utilitário: extrair @menções de um texto ─────────────────────────────────
export async function resolveMentions(text: string): Promise<string[]> {
  const handles = [...text.matchAll(/@(\w+)/g)].map((m) => m[1]);
  if (!handles.length) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .in('username', handles);
  return (data ?? []).map((u) => u.id);
}
