/**
 * ZivaThemeContext — tema global claro/escuro para toda a aplicação.
 * Suporta preferências: 'light' | 'dark' | 'system'
 * 'system' segue automaticamente o esquema do dispositivo.
 * Persiste preferência em localStorage (web) e Appearance (nativo).
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { Z } from '@/lib/theme';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeMode = 'light' | 'dark';

export interface ZivaColors {
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  input: string;
  purple: string;
  blue: string;
  danger: string;
  success: string;
  overlay: string;
  cardBorder: string;
  inputBorder: string;
  placeholder: string;
  statusBar: 'light' | 'dark';
}

const STORAGE_KEY = 'ziva_theme_preference';

function loadSavedPreference(): ThemePreference {
  if (process.env.EXPO_OS === 'web' && typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  }
  return 'system';
}

function savePreference(pref: ThemePreference) {
  if (process.env.EXPO_OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, pref);
  }
}

function buildColors(mode: ThemeMode): ZivaColors {
  const base = mode === 'dark' ? Z.dark : Z.light;
  return {
    ...base,
    purple:      Z.purple,
    blue:        Z.blue,
    danger:      Z.danger,
    success:     Z.success,
    overlay:     mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.45)',
    cardBorder:  mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#D8DDE6',
    inputBorder: mode === 'dark' ? 'rgba(255,255,255,0.1)'  : '#D1D5DB',
    placeholder: mode === 'dark' ? '#4B5563' : '#9CA3AF',
    statusBar:   mode === 'dark' ? 'light' : 'dark',
  };
}

interface ZivaThemeContextValue {
  mode: ThemeMode;
  preference: ThemePreference;
  colors: ZivaColors;
  isDark: boolean;
  /** Aceita 'light' | 'dark' | 'system' — persiste e aplica imediatamente */
  setMode: (pref: ThemePreference) => void;
}

const ZivaThemeContext = createContext<ZivaThemeContextValue>({
  mode: 'dark',
  preference: 'system',
  colors: buildColors('dark'),
  isDark: true,
  setMode: () => {},
});

export function ZivaThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme() ?? 'dark';
  const [preference, setPreference] = useState<ThemePreference>(loadSavedPreference);

  // Resolver modo efectivo: 'system' → usa o esquema do dispositivo
  const resolvedMode: ThemeMode =
    preference === 'system' ? (systemColorScheme as ThemeMode) : preference;

  // Sincronizar Appearance nativo — ignorado no web, só actua em native
  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return;
    if (preference === 'light' || preference === 'dark') {
      Appearance.setColorScheme(preference);
    }
    // 'system': não interferir — deixar o SO controlar
  }, [preference]);

  const setMode = (pref: ThemePreference) => {
    savePreference(pref);
    setPreference(pref);
  };

  const colors = buildColors(resolvedMode);

  return (
    <ZivaThemeContext.Provider value={{
      mode: resolvedMode,
      preference,
      colors,
      isDark: resolvedMode === 'dark',
      setMode,
    }}>
      {children}
    </ZivaThemeContext.Provider>
  );
}

/** Hook principal — use em qualquer ecrã ou componente */
export function useZivaTheme(): ZivaThemeContextValue {
  return useContext(ZivaThemeContext);
}
