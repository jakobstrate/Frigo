import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/backend/src/supabase';

const colors = { background: '#F5F7F2', ink: '#19251F', muted: '#69766E', line: '#DCE4DB', green: '#247451', white: '#FFFFFF', red: '#A33D36' };

type RequestState = {
  profileStatus: string;
  requestStatus: string | null;
  declineReason: string | null;
};

export default function PendingScreen() {
  const [request, setRequest] = useState<RequestState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadRequest() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        router.replace('/' as Href);
        return;
      }

      const [{ data: profile, error: profileError }, { data: employeeRequest, error: requestError }] = await Promise.all([
        supabase.from('profiles').select('status').eq('id', user.id).maybeSingle(),
        supabase.from('employee_requests').select('status, decline_reason').eq('employee_id', user.id).maybeSingle(),
      ]);

      if (!isActive) return;
      if (profileError || requestError || !profile) {
        setError('We could not load your request status. Please try again shortly.');
        return;
      }

      if (profile.status === 'active') {
        router.replace('/explore' as Href);
        return;
      }

      setRequest({
        profileStatus: profile.status,
        requestStatus: employeeRequest?.status ?? null,
        declineReason: employeeRequest?.decline_reason ?? null,
      });
    }

    void loadRequest();
    return () => { isActive = false; };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/' as Href);
  }

  const declined = request?.profileStatus === 'rejected' || request?.requestStatus === 'declined';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
          <Text style={styles.brand}>Frigo</Text>
        </View>

        {!request && !error ? <ActivityIndicator color={colors.green} size="large" /> : (
          <View style={styles.messageBlock}>
            <View style={[styles.statusMark, declined && styles.declinedMark]}>
              <Text style={styles.statusMarkText}>{declined ? '!' : '…'}</Text>
            </View>
            <Text style={styles.eyebrow}>{declined ? 'REQUEST DECLINED' : 'REQUEST UNDER REVIEW'}</Text>
            <Text style={styles.title}>{declined ? 'Your request was declined' : 'Waiting for approval'}</Text>
            <Text style={styles.subtitle}>
              {error || (declined
                ? request?.declineReason || 'Your company administrator declined your request. Contact them if you think this was a mistake.'
                : 'You can sign in to check this page while your CompanyAdmin or SuperAdmin reviews your request.')}
            </Text>
            <Pressable accessibilityRole="button" onPress={handleSignOut} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>Sign out</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, width: '100%', maxWidth: 460, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 30 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, position: 'absolute', top: 28, left: 28 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  brand: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  messageBlock: { alignItems: 'center', gap: 13 },
  statusMark: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#DFEEE5', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  declinedMark: { backgroundColor: '#F4E2DF' },
  statusMarkText: { color: colors.green, fontSize: 26, fontWeight: '700' },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 27, lineHeight: 34, textAlign: 'center', fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  button: { height: 50, minWidth: 140, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 20 },
  buttonText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.82 },
});