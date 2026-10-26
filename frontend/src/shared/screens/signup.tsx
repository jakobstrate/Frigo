import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Camera, Check, ChevronDown, ChevronLeft, Mail } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  background: '#EDF2F6',
  ink: '#1A2344',
  muted: '#687487',
  line: '#D8E0E8',
  blue: '#1028D8',
  white: '#FFFFFF',
  error: '#9D2929',
};

const mockCompanies = ['Pentia Mobile', 'Frigo Demo', 'Nordisk Kontor'];
const mockExistingEmails = ['bruger@frigo.dk'];

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('Pentia Mobile');
  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);
  const [hasMockPhoto, setHasMockPhoto] = useState(false);
  const [error, setError] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  function handleSignup() {
    if (!name.trim()) {
      setError('Skriv dit fulde navn.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Skriv en gyldig arbejdsmail, fx navn@virksomhed.dk.');
      return;
    }

    if (mockExistingEmails.includes(email.trim().toLowerCase())) {
      setError('Der findes allerede en konto med den e-mail. Prøv at logge ind.');
      return;
    }

    if (password.length < 8) {
      setError('Adgangskoden skal være på mindst 8 tegn.');
      return;
    }

    if (!company) {
      setError('Vælg den virksomhed, du arbejder i.');
      return;
    }

    setError('');
    setRequestSent(true);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          {requestSent ? (
            <View style={styles.successBlock}>
              <View style={styles.confirmationContent}>
                <View style={styles.mailIconCircle}>
                  <Mail color={colors.blue} size={42} strokeWidth={2.2} />
                </View>
                <Text style={styles.confirmationTitle}>Anmodning sendt</Text>
                <Text style={styles.confirmationSubtitle}>
                  Din demo-anmodning til {company} er registreret. Ingen mail er sendt, og ingen rigtig konto er oprettet.
                </Text>

                <View style={styles.stepsCard}>
                  <View style={styles.stepRow}>
                    <View style={styles.completeStepMarker}>
                      <Check color={colors.white} size={18} strokeWidth={3} />
                    </View>
                    <Text style={styles.completeStepText}>Anmodning registreret (demo)</Text>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.currentStepMarker}>
                      <Text style={styles.currentStepNumber}>2</Text>
                    </View>
                    <View style={styles.stepCopy}>
                      <Text style={styles.currentStepText}>Admin godkender</Text>
                      <Text style={styles.stepHint}>Venter</Text>
                    </View>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.upcomingStepMarker}>
                      <Text style={styles.upcomingStepNumber}>3</Text>
                    </View>
                    <Text style={styles.upcomingStepText}>Du får en mail og kan logge ind</Text>
                  </View>
                </View>
              </View>

              <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={({ pressed }) => [styles.confirmationButton, pressed && styles.pressed]}>
                <Text style={styles.confirmationButtonText}>Tilbage til log ind</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backButton}>
                <ChevronLeft color={colors.blue} size={26} strokeWidth={2.5} />
                <Text style={styles.backText}>Log ind</Text>
              </Pressable>

              <View style={styles.headingBlock}>
                <Text style={styles.title}>Opret profil</Text>
                <Text style={styles.subtitle}>Din virksomheds admin godkender din profil, før du kan registrere varer.</Text>
              </View>

              <View style={styles.photoRow}>
                <View style={styles.avatar}>
                  {hasMockPhoto
                    ? <Check color={colors.blue} size={32} strokeWidth={2.4} />
                    : <Camera color={colors.blue} size={32} strokeWidth={2.2} />}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: hasMockPhoto }}
                  onPress={() => setHasMockPhoto((selected) => !selected)}
                  style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
                  <Text style={styles.photoButtonText}>{hasMockPhoto ? 'Demo-billede valgt' : 'Tilføj profilbillede'}</Text>
                </Pressable>
              </View>

              <View style={styles.form}>
                <Text style={styles.label}>Fulde navn</Text>
                <TextInput autoComplete="name" onChangeText={(value) => { setName(value); setError(''); }} placeholder="Fornavn Efternavn" placeholderTextColor="#929FB4" style={styles.input} value={name} />

                <Text style={styles.label}>Arbejdsmail</Text>
                <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={(value) => { setEmail(value); setError(''); }} placeholder="navn@virksomhed.dk" placeholderTextColor="#929FB4" style={styles.input} value={email} />

                <Text style={styles.label}>Adgangskode</Text>
                <TextInput autoCapitalize="none" autoComplete="new-password" onChangeText={(value) => { setPassword(value); setError(''); }} placeholder="Mindst 8 tegn" placeholderTextColor="#929FB4" secureTextEntry style={styles.input} value={password} />

                <Text style={styles.label}>Virksomhed</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Virksomhed: ${company || 'vælg virksomhed'}`}
                  accessibilityState={{ expanded: isCompanyPickerOpen }}
                  onPress={() => setIsCompanyPickerOpen(true)}
                  style={({ pressed }) => [styles.companyPicker, pressed && styles.pressed]}>
                  <Text style={[styles.companyValue, !company && styles.placeholder]}>{company || 'Vælg virksomhed'}</Text>
                  <ChevronDown color={colors.muted} size={22} />
                </Pressable>
                <Text style={styles.helpText}>Din admin placerer dig i den rigtige afdeling, når profilen godkendes.</Text>

                {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

                <Pressable accessibilityRole="button" onPress={handleSignup} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <Text style={styles.primaryButtonText}>Send anmodning</Text>
                </Pressable>

                <Text style={styles.demoNote}>Demo med eksempeldata. Ingen konto oprettes.</Text>
              </View>

              <Modal transparent animationType="slide" visible={isCompanyPickerOpen} onRequestClose={() => setIsCompanyPickerOpen(false)}>
                <Pressable accessibilityRole="button" accessibilityLabel="Luk virksomhedslisten" onPress={() => setIsCompanyPickerOpen(false)} style={styles.modalBackdrop}>
                  <Pressable onPress={(event) => event.stopPropagation()} style={styles.companySheet}>
                    <Text style={styles.sheetTitle}>Vælg virksomhed</Text>
                    {mockCompanies.map((companyOption) => (
                      <Pressable
                        key={companyOption}
                        accessibilityRole="button"
                        accessibilityState={{ selected: company === companyOption }}
                        onPress={() => {
                          setCompany(companyOption);
                          setError('');
                          setIsCompanyPickerOpen(false);
                        }}
                        style={styles.companyOption}>
                        <Text style={styles.companyOptionText}>{companyOption}</Text>
                        {company === companyOption && <Check color={colors.blue} size={20} />}
                      </Pressable>
                    ))}
                  </Pressable>
                </Pressable>
              </Modal>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  page: { flexGrow: 1, width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 30 },
  backButton: { height: 38, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5 },
  backText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
  headingBlock: { gap: 8, marginTop: 31, marginBottom: 16 },
  successBlock: { flex: 1, justifyContent: 'space-between', paddingTop: 72, paddingBottom: 24 },
  confirmationContent: { alignItems: 'center', gap: 18 },
  mailIconCircle: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#E2E7FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  confirmationTitle: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700', textAlign: 'center' },
  confirmationSubtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 8 },
  stepsCard: { width: '100%', gap: 16, paddingHorizontal: 20, paddingVertical: 20, borderRadius: 18, backgroundColor: colors.white },
  stepRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 14 },
  completeStepMarker: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#16834D', alignItems: 'center', justifyContent: 'center' },
  currentStepMarker: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF0E5', alignItems: 'center', justifyContent: 'center' },
  currentStepNumber: { color: '#A64420', fontSize: 15, fontWeight: '700' },
  upcomingStepMarker: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E9EDF2', alignItems: 'center', justifyContent: 'center' },
  upcomingStepNumber: { color: '#687487', fontSize: 15, fontWeight: '700' },
  stepCopy: { flex: 1, gap: 2 },
  completeStepText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  currentStepText: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  stepHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  upcomingStepText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  confirmationButton: { minHeight: 58, borderWidth: 1, borderColor: colors.line, borderRadius: 30, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  confirmationButtonText: { color: colors.blue, fontSize: 17, fontWeight: '600' },
  title: { color: colors.ink, fontSize: 32, lineHeight: 40, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, flexShrink: 1 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E2E7FF', alignItems: 'center', justifyContent: 'center' },
  photoButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 26, backgroundColor: colors.white },
  photoButtonText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
  form: { gap: 7 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600', marginTop: 5 },
  input: { height: 53, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 13, paddingHorizontal: 16, color: colors.ink, fontSize: 15 },
  companyPicker: { minHeight: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 13, paddingHorizontal: 15 },
  companyValue: { color: colors.ink, fontSize: 15 },
  placeholder: { color: '#929FB4' },
  helpText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2, marginBottom: 3 },
  error: { color: colors.error, backgroundColor: '#FDE8E7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, lineHeight: 18, marginTop: 3 },
  primaryButton: { minHeight: 58, borderRadius: 30, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginTop: 6, paddingHorizontal: 16 },
  primaryButtonText: { color: colors.white, fontSize: 17, fontWeight: '600' },
  demoNote: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 3 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 25, 52, 0.28)' },
  companySheet: { paddingTop: 22, paddingHorizontal: 22, paddingBottom: 32, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.background },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', marginBottom: 10 },
  companyOption: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  companyOptionText: { color: colors.ink, fontSize: 15 },
  pressed: { opacity: 0.82 },
});