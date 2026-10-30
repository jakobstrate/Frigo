import { router, type Href } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ForgotPasswordFlow } from '@/frontend/src/app/forgot-password-flow';
import { FrigoLogoIcon } from '@/frontend/src/components/frigo-logo';
import { useLogin } from '@/frontend/src/hooks/use-login';

const colors = {
  background: '#1028D8',
  ink: '#1028D8',
  white: '#FFFFFF',
  error: '#8F1D25',
};

const biometricSetupKey = 'frigo-biometric-setup';

export default function LoginScreen() {
  const [biometricDestination, setBiometricDestination] = useState<Href | null>(null);
  const [biometricName, setBiometricName] = useState('biometrisk login');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricError, setBiometricError] = useState('');
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [isMockLoading, setIsMockLoading] = useState(false);
  const [isMockBiometricFlow, setIsMockBiometricFlow] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  async function handleLoginSuccess(destination: Href, isMockFlow = false) {
    try {
      setIsMockBiometricFlow(isMockFlow);
      const setupChoice = await SecureStore.getItemAsync(biometricSetupKey);
      if (setupChoice && !isMockFlow) {
        router.replace(destination);
        return;
      }

      const [types, hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.supportedAuthenticationTypesAsync(),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      const supportsFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const supportsFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
      const label = supportsFace
        ? 'Face ID'
        : supportsFingerprint && Platform.OS === 'ios'
          ? 'Touch ID'
          : supportsFingerprint
            ? 'fingeraftryk'
            : 'biometrisk login';

      setBiometricName(label);
      setBiometricAvailable(isMockFlow || (hasHardware && isEnrolled && (supportsFace || supportsFingerprint)));
      setBiometricError('');
      setBiometricDestination(destination);
    } catch {
      router.replace(destination);
    }
  }

  async function finishBiometricSetup(enabled: boolean) {
    if (!biometricDestination) return;

    setIsBiometricLoading(true);
    try {
      await SecureStore.setItemAsync(biometricSetupKey, enabled ? 'enabled' : 'skipped');
      const destination = biometricDestination;
      setBiometricDestination(null);
      setIsMockBiometricFlow(false);
      router.replace(destination);
    } catch {
      setBiometricError('Vi kunne ikke gemme dit valg. Prøv igen.');
    } finally {
      setIsBiometricLoading(false);
    }
  }

  async function enableBiometrics() {
    if (!biometricAvailable || isBiometricLoading) return;

    setIsBiometricLoading(true);
    setBiometricError('');
    try {
      if (isMockBiometricFlow) {
        await SecureStore.setItemAsync(biometricSetupKey, 'enabled');
        const destination = biometricDestination;
        setBiometricDestination(null);
        setIsMockBiometricFlow(false);
        if (destination) router.replace(destination);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Aktivér ${biometricName} til FriGo`,
        cancelLabel: 'Ikke nu',
        disableDeviceFallback: true,
      });

      if (result.success) {
        await SecureStore.setItemAsync(biometricSetupKey, 'enabled');
        const destination = biometricDestination;
        setBiometricDestination(null);
        if (destination) router.replace(destination);
      } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel' && result.error !== 'app_cancel') {
        setBiometricError(`${biometricName} kunne ikke bekræfte dig. Prøv igen, eller vælg “Ikke nu”.`);
      }
    } catch {
      setBiometricError('Vi kunne ikke gemme dit valg. Prøv igen.');
    } finally {
      setIsBiometricLoading(false);
    }
  }

  async function handleMockLogin() {
    if (isMockLoading) return;

    setIsMockLoading(true);
    try {
      await SecureStore.deleteItemAsync(biometricSetupKey);
      await handleLoginSuccess('/mock-home' as Href, true);
    } catch {
      router.replace('/mock-home' as Href);
    } finally {
      setIsMockLoading(false);
    }
  }

  const { email, setEmail, password, setPassword, error, notice, isLoading, handleLogin } = useLogin(handleLoginSuccess);

  if (showForgotPassword) {
    return <ForgotPasswordFlow onClose={() => setShowForgotPassword(false)} />;
  }

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
              onPress={() => setShowForgotPassword(true)}
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

            <Pressable
              accessibilityRole="button"
              disabled={isMockLoading}
              onPress={() => { void handleMockLogin(); }}
              style={({ pressed }) => [styles.mockLoginButton, pressed && styles.pressed, isMockLoading && styles.disabled]}>
              {isMockLoading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.mockLoginText}>Log ind med demo</Text>}
            </Pressable>
            <Text style={styles.mockLoginNote}>Bruger kun fiktive data. Ingen konto oprettes.</Text>
          </View>
        </View>
      </ScrollView>
      <Modal animationType="fade" transparent visible={!!biometricDestination} onRequestClose={() => { void finishBiometricSetup(false); }}>
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.biometricCard}>
            <View style={styles.biometricIcon}>
              {biometricName === 'Face ID'
                ? <ScanFace color={colors.ink} size={34} strokeWidth={2} />
                : <Fingerprint color={colors.ink} size={34} strokeWidth={2} />}
            </View>
            <Text style={styles.biometricTitle}>Aktivér {biometricName}?</Text>
            <Text style={styles.biometricDescription}>Brug {biometricName} næste gang for at gøre det nemmere at komme i gang.</Text>
            {!biometricAvailable && (
              <Text style={styles.biometricUnavailable}>
                {biometricName === 'biometrisk login'
                  ? 'Denne telefon understøtter ikke Face ID eller fingeraftryk.'
                  : `Der er ikke konfigureret ${biometricName} på telefonen. Slå det til i telefonens indstillinger.`}
              </Text>
            )}
            <Text style={styles.biometricDemoNote}>
              {isMockBiometricFlow
                ? 'Demo-login: aktivering simuleres, og der bruges ikke rigtig biometri.'
                : 'Demo: dit valg gemmes på telefonen, men biometrisk login bruges ikke endnu.'}
            </Text>
            {!!biometricError && <Text accessibilityRole="alert" style={styles.biometricError}>{biometricError}</Text>}
            {biometricAvailable && (
              <Pressable
                accessibilityRole="button"
                disabled={isBiometricLoading}
                onPress={() => { void enableBiometrics(); }}
                style={({ pressed }) => [styles.biometricPrimaryButton, pressed && styles.pressed, isBiometricLoading && styles.disabled]}>
                {isBiometricLoading
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.biometricPrimaryText}>Aktivér {biometricName}</Text>}
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={isBiometricLoading}
              onPress={() => { void finishBiometricSetup(false); }}
              style={styles.biometricSecondaryButton}>
              <Text style={styles.biometricSecondaryText}>{biometricAvailable ? 'Ikke nu' : 'Fortsæt'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  mockLoginButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  mockLoginText: { color: '#DDE3FF', fontSize: 14, fontWeight: '600' },
  mockLoginNote: { color: '#DDE3FF', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.52 },
  modalBackdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(10, 20, 77, 0.48)' },
  biometricCard: { alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 28, borderRadius: 24, backgroundColor: '#EDF2F6' },
  biometricIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E7FF' },
  biometricTitle: { color: '#1A2344', fontSize: 22, lineHeight: 29, fontWeight: '700', textAlign: 'center' },
  biometricDescription: { color: '#687487', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  biometricUnavailable: { color: '#687487', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  biometricDemoNote: { color: '#687487', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  biometricError: { width: '100%', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: '#8F1D25', backgroundColor: '#FFE7E6', fontSize: 13, lineHeight: 18 },
  biometricPrimaryButton: { width: '100%', minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: colors.ink },
  biometricPrimaryText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  biometricSecondaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  biometricSecondaryText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
});
