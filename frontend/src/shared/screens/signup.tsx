import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/backend/src/supabase';
import { FrigoLogoIcon } from '@/frontend/src/components/frigo-logo';

const colors = {
  background: '#1028D8',
  ink: '#1028D8',
  muted: '#DDE3FF',
  line: '#A9B8FF',
  white: '#FFFFFF',
  error: '#A33D36',
};

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadCompanies() {
      const { data, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (!isMounted) return;
      if (companiesError) setError(`Virksomheder kunne ikke indlæses: ${companiesError.message}`);
      setCompanies(data ?? []);
      setIsLoadingCompanies(false);
    }
    void loadCompanies();
    return () => { isMounted = false; };
  }, []);

  async function handleSignup() {
    setError('');
    setIsLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: name.trim(),
          company_id: companyId,
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
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ChevronLeft color={colors.white} size={22} strokeWidth={2.5} />
            <Text style={styles.backButtonText}>Tilbage til log ind</Text>
          </Pressable>
          <View style={styles.brand}>
            <FrigoLogoIcon size={76} />
            <Text style={styles.wordmark}>FriGo</Text>
          </View>

          {confirmationRequired ? (
            <View style={styles.successBlock}>
              <Text style={styles.title}>Tjek din e-mail</Text>
              <Text style={styles.subtitle}>Bekræft din e-mailadresse. Log derefter ind for at følge din anmodning om adgang.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Tilbage til log ind</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.headingBlock}>
                <Text style={styles.title}>Opret profil</Text>
                <Text style={styles.subtitle}>Vælg din virksomhed. En administrator skal godkende din adgang.</Text>
              </View>

              <View style={styles.form}>
                <Text style={styles.label}>Navn</Text>
                <TextInput autoComplete="name" onChangeText={setName} placeholder="Dit navn" placeholderTextColor="#929FB4" style={styles.input} value={name} />

                <Text style={styles.label}>E-mail</Text>
                <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="navn@virksomhed.dk" placeholderTextColor="#929FB4" style={styles.input} value={email} />

                <Text style={styles.label}>Virksomhed</Text>
                {isLoadingCompanies ? (
                  <ActivityIndicator color={colors.white} />
                ) : companies.length > 0 ? (
                  <View style={styles.companyChoices}>
                    {companies.map((company) => {
                      const selected = companyId === company.id;
                      return (
                        <Pressable
                          key={company.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setCompanyId(company.id)}
                          style={[styles.companyChoice, selected && styles.companyChoiceSelected]}>
                          <Text style={[styles.companyChoiceText, selected && styles.companyChoiceTextSelected]}>{company.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.helpText}>Der er ingen aktive virksomheder at vælge lige nu.</Text>
                )}
                <Text style={styles.helpText}>Din anmodning gennemgås af virksomhedens administrator.</Text>

                <Text style={styles.label}>Adgangskode</Text>
                <TextInput autoCapitalize="none" autoComplete="new-password" onChangeText={setPassword} placeholder="Mindst 6 tegn" placeholderTextColor="#929FB4" secureTextEntry style={styles.input} value={password} />

                {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

                <Pressable
                  accessibilityRole="button"
                  disabled={isLoading || isLoadingCompanies || !companies.length || !companyId || !name.trim() || !email.trim() || password.length < 6}
                  onPress={handleSignup}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (isLoading || isLoadingCompanies || !companies.length || !companyId || !name.trim() || !email.trim() || password.length < 6) && styles.disabled]}>
                  {isLoading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.primaryButtonText}>Opret profil</Text>}
                </Pressable>

                <View style={styles.loginRow}>
                  <Text style={styles.subtitle}>Har du allerede en konto?</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.replace('/')}>
                    <Text style={styles.link}>Log ind</Text>
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
  scrollContent: { flexGrow: 1 },
  page: { flexGrow: 1, width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 18, paddingBottom: 24, gap: 24 },
  backButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3 },
  backButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  brand: { alignItems: 'center', gap: 4 },
  wordmark: { color: colors.white, fontSize: 34, fontWeight: '700' },
  headingBlock: { gap: 8, marginBottom: 2 },
  successBlock: { alignItems: 'center', gap: 14 },
  title: { color: colors.white, fontSize: 29, lineHeight: 36, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  form: { gap: 10 },
  label: { color: colors.white, fontSize: 15, fontWeight: '600', marginTop: 4 },
  input: { height: 56, borderWidth: 1, borderColor: colors.white, backgroundColor: colors.white, borderRadius: 30, paddingHorizontal: 20, color: '#17213D', fontSize: 16 },
  helpText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -2 },
  companyChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  companyChoice: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 22, backgroundColor: 'transparent', justifyContent: 'center', paddingHorizontal: 14 },
  companyChoiceSelected: { borderColor: colors.white, backgroundColor: colors.white },
  companyChoiceText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  companyChoiceTextSelected: { color: colors.ink },
  primaryButton: { height: 58, borderRadius: 32, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  loginRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  link: { color: colors.white, fontSize: 14, fontWeight: '700' },
  error: { color: '#FFE7E6', fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.52 },
});