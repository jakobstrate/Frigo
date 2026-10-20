import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLogin } from '@/frontend/src/hooks/use-login';

const colors = {
  background: '#F5F7F2',
  ink: '#19251F',
  muted: '#69766E',
  line: '#DCE4DB',
  green: '#247451',
  white: '#FFFFFF',
  error: '#A33D36',
};

export default function LoginScreen() {
  const { email, setEmail, password, setPassword, error, isLoading, handleLogin } = useLogin();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
            <Text style={styles.brand}>Frigo</Text>
          </View>

          <View style={styles.headingBlock}>
            <Text style={styles.eyebrow}>WELCOME BACK</Text>
            <Text style={styles.title}>Sign in to your account</Text>
            <Text style={styles.subtitle}>Your company shop, all in one place.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor="#8A958D"
              style={styles.input}
              value={email}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="current-password"
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              placeholder="Enter your password"
              placeholderTextColor="#8A958D"
              secureTextEntry
              style={styles.input}
              value={password}
            />

            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

            <Pressable
              accessibilityRole="button"
              disabled={isLoading || !email.trim() || !password}
              onPress={handleLogin}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (isLoading || !email.trim() || !password) && styles.disabled]}>
              {isLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
            </Pressable>

            <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.orText}>NEW TO FRIGO?</Text><View style={styles.divider} /></View>

            <Pressable accessibilityRole="button" onPress={() => router.push('/signup' as Href)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Create an account</Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>By continuing, you agree to your company&apos;s Frigo access policies.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  page: { flex: 1, width: '100%', maxWidth: 460, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 36 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 56 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  brand: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  headingBlock: { gap: 8, marginBottom: 30 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  form: { gap: 12 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 6 },
  input: { height: 52, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: 15, color: colors.ink, fontSize: 15 },
  primaryButton: { height: 52, borderRadius: 8, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  secondaryButton: { height: 52, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12 },
  divider: { height: 1, backgroundColor: colors.line, flex: 1 },
  orText: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  error: { color: colors.error, fontSize: 13, lineHeight: 19 },
  footer: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 30 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.52 },
});
