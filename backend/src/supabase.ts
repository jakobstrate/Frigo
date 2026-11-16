import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { authStorage } from './auth-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase configuration. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.',
  );
}

const configuredSupabaseUrl: string = supabaseUrl;
const configuredSupabasePublishableKey: string = supabasePublishableKey;

export const supabase = createClient(configuredSupabaseUrl, configuredSupabasePublishableKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function createInviteAuthClient() {
  return createClient(configuredSupabaseUrl, configuredSupabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
