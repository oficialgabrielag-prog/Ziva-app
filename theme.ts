import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

// ─── Constantes de cor por tema ───────────────────────────────────────────────
export const Z = {
  // Dark
  dark: {
    bg:      '#09090B',
    card:    '#111115',
    border:  'rgba(255,255,255,0.08)',
    text:    '#F9FAFB',
    muted:   '#6B7280',
    input:   '#1F1F23',
  },
  // Light
  light: {
    bg:      '#FFFFFF',
    card:    '#F7F7F7',
    border:  '#D8DDE6',
    text:    '#111115',
    muted:   '#5D6470',
    input:   '#ECF0F5',
  },
  // Shared accent
  purple:  '#7B3FF2',
  blue:    '#3B82F6',
  danger:  '#EF4444',
  success: '#10B981',
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: Z.light.bg,
      border:     Z.light.border,
      card:       Z.light.card,
      notification: Z.danger,
      primary:    Z.purple,
      text:       Z.light.text,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: Z.dark.bg,
      border:     Z.dark.border,
      card:       Z.dark.card,
      notification: Z.danger,
      primary:    Z.purple,
      text:       Z.dark.text,
    },
  },
};
