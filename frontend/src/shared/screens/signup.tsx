import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/backend/src/supabase';

const colors = {
  background: '#F5F7F2',
  ink: '#19251F',
  muted: '#69766E',
  line: '#DCE4DB',
  green: '#247451',
  white: '#FFFFFF',
  error: '#A33D36',
};

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignup() {
    setError('');
    setIsLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: name.trim(),
          approver_email: adminEmail.trim().toLowerCase(),
        },
      },
    });

    setIsLoading(false);
    if (signupError) {
      setError(signupError.message);
      return;
    }

    if (data.session) {
      router.replace('/pending');
      return;
    }

    setConfirmationRequired(true);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
            <Text style={styles.brand}>Frigo</Text>
          </View>

          {confirmationRequired ? (
            <View style={styles.successBlock}>
              <Text style={styles.eyebrow}>ACCOUNT CREATED</Text>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>Confirm your email address, then sign in to check your employee request status.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Back to sign in</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.headingBlock}>
                <Text style={styles.eyebrow}>JOIN YOUR COMPANY</Text>
                <Text style={styles.title}>Create an account</Text>
                <Text style={styles.subtitle}>Your request will be reviewed before company access is enabled.</Text>
              </View>

              <View style={styles.form}>
                <Text style={styles.label}>Full name</Text>
                <TextInput autoComplete="name" onChangeText={setName} placeholder="Your name" placeholderTextColor="#8A958D" style={styles.input} value={name} />

                <Text style={styles.label}>Your email</Text>
                <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="you@company.com" placeholderTextColor="#8A958D" style={styles.input} value={email} />

                <Text style={styles.label}>Company admin or SuperAdmin email</Text>
                <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setAdminEmail} placeholder="admin@company.com" placeholderTextColor="#8A958D" style={styles.input} value={adminEmail} />
                <Text style={styles.helpText}>If you enter a SuperAdmin&apos;s email, they will choose your company when reviewing your request.</Text>

                <Text style={styles.label}>Password</Text>
                <TextInput autoCapitalize="none" autoComplete="new-password" onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor="#8A958D" secureTextEntry style={styles.input} value={password} />

                {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

                <Pressable
                  accessibilityRole="button"
                  disabled={isLoading || !name.trim() || !email.trim() || !adminEmail.trim() || password.length < 6}
                  onPress={handleSignup}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (isLoading || !name.trim() || !email.trim() || !adminEmail.trim() || password.length < 6) && styles.disabled]}>
                  {isLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Create account</Text>}
                </Pressable>

                <View style={styles.loginRow}>
                  <Text style={styles.subtitle}>Already have an account?</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.replace('/')}>
                    <Text style={styles.link}>Sign in</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  page: { width: '100%', maxWidth: 460, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 30 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  brand: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  headingBlock: { gap: 8, marginBottom: 20 },
  successBlock: { gap: 14 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  form: { gap: 9 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 5 },
  input: { height: 50, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: 15, color: colors.ink, fontSize: 15 },
  helpText: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: -3 },
  primaryButton: { height: 52, borderRadius: 8, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  link: { color: colors.green, fontSize: 14, fontWeight: '700' },
  error: { color: colors.error, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.52 },
});