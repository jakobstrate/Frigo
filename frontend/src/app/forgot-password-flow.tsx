import { StatusBar } from 'expo-status-bar';
import { Check, ChevronLeft, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

type Stage = 'request' | 'sent' | 'reset' | 'complete';

type ForgotPasswordFlowProps = {
  onClose: () => void;
};

export function ForgotPasswordFlow({ onClose }: ForgotPasswordFlowProps) {
  const [stage, setStage] = useState<Stage>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatedPassword, setRepeatedPassword] = useState('');
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  const hasMinimumLength = password.length >= 8;
  const hasUpperAndLowercase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);

  function sendLink() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Skriv en gyldig e-mailadresse.');
      return;
    }

    setError('');
    setResent(false);
    setStage('sent');
  }

  function savePassword() {
    if (!hasMinimumLength || !hasUpperAndLowercase || !hasNumber) {
      setError('Adgangskoden opfylder ikke alle krav endnu.');
      return;
    }

    if (password !== repeatedPassword) {
      setError('Adgangskoderne er ikke ens.');
      return;
    }

    setError('');
    setStage('complete');
  }

  function goBack() {
    if (stage === 'reset') {
      setStage('sent');
      setError('');
      return;
    }

    onClose();
  }

  function renderBackButton(label: string) {
    return (
      <Pressable accessibilityRole="button" onPress={goBack} style={styles.backButton}>
        <ChevronLeft color={colors.blue} size={26} strokeWidth={2.5} />
        <Text style={styles.backText}>{label}</Text>
      </Pressable>
    );
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
                {renderBackButton('Log ind')}
                <View style={styles.requestHeading}>
                  <Text style={styles.title}>Glemt adgangskode?</Text>
                  <Text style={styles.subtitle}>Skriv din e-mail, så sender vi et link, hvor du kan vælge en ny adgangskode.</Text>
                </View>
                <View style={styles.form}>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onChangeText={(value) => { setEmail(value); setError(''); }}
                    onSubmitEditing={sendLink}
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
                <Pressable accessibilityRole="button" onPress={sendLink} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <Text style={styles.primaryButtonText}>Send link</Text>
                </Pressable>
                <Text style={styles.demoNote}>Demo: der sendes ikke en rigtig e-mail.</Text>
              </View>
            </>
          )}

          {stage === 'sent' && (
            <>
              <View style={styles.sentPageContent}>
                {renderBackButton('Tilbage')}
                {resent && (
                  <View style={styles.successBanner}>
                    <Text style={styles.successBannerText}>Et nyt demo-link er sendt. Det gamle link virker ikke længere.</Text>
                  </View>
                )}
                <View style={styles.mailMessage}>
                  <View style={styles.mailIconCircle}>
                    <Mail color={colors.blue} size={39} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.mailTitle}>Tjek din mail</Text>
                  <Text style={styles.mailSubtitle}>
                    Vi har sendt et demo-link til <Text style={styles.emailEmphasis}>{email.trim()}</Text>. Tryk på linket i mailen for at vælge en ny adgangskode. Linket virker i 1 time.
                  </Text>
                  <Pressable accessibilityRole="button" onPress={() => { setError(''); setStage('reset'); }} style={styles.demoLinkButton}>
                    <Text style={styles.demoLinkText}>Åbn demo-link</Text>
                  </Pressable>
                </View>
                <Text style={styles.demoNote}>Demo: mailen bliver ikke sendt.</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setResent(true)} style={({ pressed }) => [styles.resendButton, pressed && styles.pressed]}>
                <Text style={styles.resendText}>Send linket igen</Text>
              </Pressable>
            </>
          )}

          {stage === 'reset' && (
            <>
              <View>
                {renderBackButton('Tilbage')}
                <View style={styles.resetHeading}>
                  <Text style={styles.title}>Vælg ny adgangskode</Text>
                </View>
                <View style={styles.form}>
                  <Text style={styles.label}>Ny adgangskode</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={(value) => { setPassword(value); setError(''); }}
                    secureTextEntry
                    style={styles.input}
                    value={password}
                  />
                  <View style={styles.requirements}>
                    {renderRequirement('Mindst 8 tegn', hasMinimumLength)}
                    {renderRequirement('Store og små bogstaver', hasUpperAndLowercase)}
                    {renderRequirement('Mindst ét tal', hasNumber)}
                  </View>
                  <Text style={styles.label}>Gentag adgangskode</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={(value) => { setRepeatedPassword(value); setError(''); }}
                    secureTextEntry
                    style={styles.input}
                    value={repeatedPassword}
                  />
                  {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                  <Text style={styles.demoNote}>Demo: adgangskoden bliver ikke ændret.</Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" onPress={savePassword} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Gem adgangskode</Text>
              </Pressable>
            </>
          )}

          {stage === 'complete' && (
            <View style={styles.completePage}>
              <View style={styles.mailIconCircle}>
                <Check color={colors.green} size={40} strokeWidth={2.5} />
              </View>
              <Text style={styles.mailTitle}>Adgangskode klar</Text>
              <Text style={styles.mailSubtitle}>Demo-flowet er gennemført. Din adgangskode er ikke ændret.</Text>
              <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
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
  requestHeading: { gap: 14, marginTop: 44, marginBottom: 48 },
  resetHeading: { marginTop: 42, marginBottom: 28 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  form: { gap: 10 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: { height: 54, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 13, paddingHorizontal: 16, color: colors.ink, fontSize: 15 },
  error: { color: colors.error, backgroundColor: '#FDE8E7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, lineHeight: 18 },
  primaryButton: { minHeight: 58, borderRadius: 30, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: colors.white, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  demoNote: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 8 },
  pressed: { opacity: 0.82 },
  sentPageContent: { flex: 1 },
  successBanner: { marginTop: 26, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 15, backgroundColor: '#E0F2E7' },
  successBannerText: { color: '#205F3D', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  mailMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 8 },
  mailIconCircle: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#E2E7FF', alignItems: 'center', justifyContent: 'center' },
  mailTitle: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700', textAlign: 'center' },
  mailSubtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  emailEmphasis: { color: colors.ink, fontWeight: '600' },
  demoLinkButton: { paddingVertical: 8, paddingHorizontal: 12 },
  demoLinkText: { color: colors.blue, fontSize: 14, fontWeight: '600' },
  resendButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  resendText: { color: colors.blue, fontSize: 16, fontWeight: '600' },
  requirements: { gap: 8, marginTop: 12, marginBottom: 12 },
  requirementRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 10 },
  requirementIcon: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  requirementIconPassed: { borderColor: colors.green, backgroundColor: colors.green },
  requirementText: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  requirementTextPassed: { color: colors.green, fontWeight: '600' },
  completePage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
});