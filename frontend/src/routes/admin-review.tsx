import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/backend/src/supabase';

export default function AdminWebOnlyScreen() {
  const [error, setError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    setError('');
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      setIsSigningOut(false);
      return;
    }
    router.replace('/' as Href);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Administration foregår på web</Text>
        <Text style={styles.subtitle}>Brug Frigos webadministration til at gennemgå anmodninger og administrere virksomheden.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={isSigningOut}
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed, isSigningOut && styles.disabled]}
        >
          <Text style={styles.buttonText}>{isSigningOut ? 'Logger ud...' : 'Log ud'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7f2' },
  content: { flex: 1, width: '100%', maxWidth: 460, alignSelf: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  title: { color: '#19251f', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#69766e', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  error: { color: '#a33d36', fontSize: 13, textAlign: 'center' },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6, borderRadius: 9, backgroundColor: '#247451' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
});
