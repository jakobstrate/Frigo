import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check, ChevronLeft, Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/backend/src/supabase';

const colors = {
  background: '#EDF2F6',
  ink: '#1A2344',
  muted: '#687487',
  line: '#D8E0E8',
  blue: '#1028D8',
  white: '#FFFFFF',
  green: '#21824E',
  error: '#9D2929',
};

type RecoveryStage = 'request' | 'sent' | 'reset' | 'complete';

function parseRecoveryParams(url: string) {
  const parsedUrl = new URL(url);
  const fragment = new URLSearchParams(parsedUrl.hash.slice(1));
  return fragment.has('access_token') || fragment.has('code')
    ? fragment
    : new URLSearchParams(parsedUrl.search);
}

export default function ForgotPasswordScreen() {
  const [stage, setStage] = useState<RecoveryStage>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const hasMinimumLength = password.length >= 8;
  const hasUpperAndLowercase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);

  useEffect(() => {
    let isMounted = true;

    async function handleRecoveryUrl(url: string) {
      try {
        const params = parseRecoveryParams(url);
        const callbackError = params.get('error_description');
        if (callbackError) {
          if (isMounted) setError(callbackError);
          return;
        }

        const recoveryType = params.get('type');
        if (recoveryType && recoveryType !== 'recovery') return;

        const code = params.get('code');
        if (code) {
          const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;
        } else {
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (!accessToken || !refreshToken) return;

          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }

        if (isMounted) {
          setError('');
          setStage('reset');
        }
      } catch {
        if (isMounted) setError('Linket er ugyldigt eller udløbet. Bed om et nyt nulstillingslink.');
      }
    }

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleRecoveryUrl(url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) return handleRecoveryUrl(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  async function sendResetLink() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Skriv en gyldig e-mailadresse.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('forgot-password'),
      });
      if (resetError) throw resetError;
      setStage('sent');
    } catch {
      setError('Nulstillingslinket kunne ikke sendes. Prøv igen senere.');
    } finally {
      setIsLoading(false);
    }
  }

  async function savePassword() {
    if (!hasMinimumLength || !hasUpperAndLowercase || !hasNumber) {
      setError('Adgangskoden opfylder ikke alle krav endnu.');
      return;
    }
    if (password !== repeatPassword) {
      setError('Adgangskoderne er ikke ens.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setStage('complete');
    } catch {
      setError('Adgangskoden kunne ikke ændres. Bed om et nyt nulstillingslink, og prøv igen.');
    } finally {
      setIsLoading(false);
    }
  }

  function renderRequirement(label: string, passed: boolean) {
    return (
      <View key={label} style={styles.requirementRow}>
        <View style={[styles.requirementIcon, passed && styles.requirementIconPassed]}>
          {passed && <Check color={colors.white} size={14} strokeWidth={3} />}
        </View>
        <Text style={[styles.requirementText, passed && styles.requirementTextPassed]}>{label}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          {stage === 'request' && (
            <>
              <View>
                <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backButton}>
                  <ChevronLeft color={colors.blue} size={26} strokeWidth={2.5} />
                  <Text style={styles.backText}>Log ind</Text>
                </Pressable>
                <View style={styles.heading}>
                  <Text style={styles.title}>Glemt adgangskode?</Text>
                  <Text style={styles.subtitle}>Skriv din e-mail, så sender vi et link til at vælge en ny adgangskode.</Text>
                </View>
                <View style={styles.form}>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onChangeText={(value) => { setEmail(value); setError(''); }}
                    onSubmitEditing={() => { void sendResetLink(); }}
                    placeholder="navn@virksomhed.dk"
                    placeholderTextColor="#929FB4"
                    returnKeyType="send"
                    style={styles.input}
                    value={email}
                  />
                  {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                </View>
              </View>
              <View>
                <Pressable accessibilityRole="button" disabled={isLoading} onPress={() => { void sendResetLink(); }} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isLoading && styles.disabled]}>
                  {isLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Send nulstillingslink</Text>}
                </Pressable>
                <Text style={styles.note}>Hvis adressen er knyttet til en konto, sender vi et link.</Text>
              </View>
            </>
          )}

          {stage === 'sent' && (
            <View style={styles.centeredStage}>
              <View style={styles.mailIcon}>
                <Mail color={colors.blue} size={40} strokeWidth={2} />
              </View>
              <Text style={styles.title}>Tjek din mail</Text>
              <Text style={styles.subtitle}>Hvis {email.trim()} er knyttet til en konto, modtager du snart et link til at nulstille adgangskoden.</Text>
              <Pressable accessibilityRole="button" onPress={() => setStage('request')} style={styles.textButton}>
                <Text style={styles.textButtonLabel}>Brug en anden e-mail</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.textButton}>
                <Text style={styles.textButtonLabel}>Tilbage til log ind</Text>
              </Pressable>
            </View>
          )}

          {stage === 'reset' && (
            <>
              <View>
                <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backButton}>
                  <ChevronLeft color={colors.blue} size={26} strokeWidth={2.5} />
                  <Text style={styles.backText}>Log ind</Text>
                </Pressable>
                <View style={styles.heading}>
                  <Text style={styles.title}>Vælg ny adgangskode</Text>
                </View>
                <View style={styles.form}>
                  <Text style={styles.label}>Ny adgangskode</Text>
                  <TextInput autoCapitalize="none" autoComplete="new-password" onChangeText={(value) => { setPassword(value); setError(''); }} secureTextEntry style={styles.input} value={password} />
                  <View style={styles.requirements}>
                    {renderRequirement('Mindst 8 tegn', hasMinimumLength)}
                    {renderRequirement('Store og små bogstaver', hasUpperAndLowercase)}
                    {renderRequirement('Mindst ét tal', hasNumber)}
                  </View>
                  <Text style={styles.label}>Gentag adgangskode</Text>
                  <TextInput autoCapitalize="none" autoComplete="new-password" onChangeText={(value) => { setRepeatPassword(value); setError(''); }} secureTextEntry style={styles.input} value={repeatPassword} />
                  {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                </View>
              </View>
              <Pressable accessibilityRole="button" disabled={isLoading} onPress={() => { void savePassword(); }} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isLoading && styles.disabled]}>
                {isLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Gem ny adgangskode</Text>}
              </Pressable>
            </>
          )}

          {stage === 'complete' && (
            <View style={styles.centeredStage}>
              <View style={styles.mailIcon}>
                <Check color={colors.green} size={42} strokeWidth={2.5} />
              </View>
              <Text style={styles.title}>Adgangskoden er ændret</Text>
              <Text style={styles.subtitle}>Du kan nu logge ind med din nye adgangskode.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Tilbage til log ind</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  page: { flexGrow: 1, width: '100%', maxWidth: 500, alignSelf: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24, gap: 36 },
  backButton: { height: 38, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5 },
  backText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
  heading: { gap: 14, marginTop: 44, marginBottom: 42 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  form: { gap: 10 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: { height: 54, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 13, paddingHorizontal: 16, color: colors.ink, fontSize: 15 },
  error: { color: colors.error, backgroundColor: '#FDE8E7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, lineHeight: 18 },
  primaryButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 30, backgroundColor: colors.blue },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  note: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 8 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
  centeredStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  mailIcon: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center', borderRadius: 52, backgroundColor: '#E2E7FF' },
  textButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 12 },
  textButtonLabel: { color: colors.blue, fontSize: 14, fontWeight: '600' },
  requirements: { gap: 8, marginTop: 10, marginBottom: 10 },
  requirementRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 10 },
  requirementIcon: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.white },
  requirementIconPassed: { borderColor: colors.green, backgroundColor: colors.green },
  requirementText: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  requirementTextPassed: { color: colors.green, fontWeight: '600' },
});