import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FrigoLogoIcon } from '@/frontend/src/components/frigo-logo';
import { useLogin } from '@/frontend/src/hooks/use-login';

const colors = {
  background: '#1028D8',
  ink: '#1028D8',
  white: '#FFFFFF',
  error: '#8F1D25',
};

export default function LoginScreen() {
  const { email, setEmail, password, setPassword, error, notice, isLoading, handleLogin } = useLogin();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          <View style={styles.brand}>
            <FrigoLogoIcon size={112} />
            <Text style={styles.wordmark}>FriGo</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="navn@virksomhed.dk"
              placeholderTextColor="#929FB4"
              style={styles.input}
              value={email}
            />

            <Text style={styles.label}>Adgangskode</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="current-password"
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              placeholder=""
              placeholderTextColor="#929FB4"
              secureTextEntry
              style={styles.input}
              value={password}
            />

            {(!!error || !!notice) && (
              <View style={[styles.statusBar, error ? styles.errorBar : styles.noticeBar]}>
                <Text
                  accessibilityLiveRegion={error ? 'assertive' : 'polite'}
                  accessibilityRole={error ? 'alert' : 'text'}
                  style={[styles.statusText, error ? styles.errorText : styles.noticeText]}>
                  {error || notice}
                </Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/forgot-password' as Href)}
              style={styles.forgotButton}>
              <Text style={styles.forgotText}>Glemt adgangskode?</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading || !email.trim() || !password}
              onPress={handleLogin}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (isLoading || !email.trim() || !password) && styles.disabled]}>
              {isLoading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.primaryButtonText}>Log ind</Text>}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/signup' as Href)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Ny her? Opret profil</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  page: { flexGrow: 1, width: '100%', maxWidth: 500, alignSelf: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 44, paddingBottom: 24, gap: 40 },
  brand: { alignItems: 'center', gap: 14 },
  wordmark: { color: colors.white, fontSize: 52, fontWeight: '700' },
  form: { gap: 12 },
  label: { color: colors.white, fontSize: 15, fontWeight: '600', marginTop: 4 },
  input: { height: 56, borderWidth: 1, borderColor: colors.white, backgroundColor: colors.white, borderRadius: 30, paddingHorizontal: 20, color: '#17213D', fontSize: 16 },
  statusBar: { minHeight: 42, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  errorBar: { backgroundColor: '#FFE7E6' },
  noticeBar: { backgroundColor: '#E8EDFF' },
  statusText: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  errorText: { color: colors.error },
  noticeText: { color: '#192A8C' },
  forgotButton: { alignSelf: 'flex-end', minHeight: 34, justifyContent: 'center', marginTop: 2 },
  forgotText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  actions: { gap: 12 },
  primaryButton: { height: 58, borderRadius: 32, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  secondaryButton: { height: 58, borderRadius: 32, borderWidth: 2, borderColor: '#A9B8FF', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.52 },
});
