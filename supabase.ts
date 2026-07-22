import { createClient } from '@supabase/supabase-js'
import 'expo-sqlite/localStorage/install';

const supabaseUrl: string = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

// Na web usa o localStorage nativo do browser; no native usa o polyfill SQLite
const authStorage: Storage | undefined =
  (process.env.EXPO_OS === 'web' && typeof window !== 'undefined')
    ? window.localStorage
    : (typeof localStorage !== 'undefined' ? localStorage : undefined);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
