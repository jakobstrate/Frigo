import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, CircleUserRound } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = { background: '#EDF2F6', ink: '#1A2344', muted: '#687487', blue: '#1028D8', white: '#FFFFFF' };

export default function MockHomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backButton}>
          <ArrowLeft color={colors.blue} size={21} />
          <Text style={styles.backText}>Log ud af demo</Text>
        </Pressable>
        <View style={styles.content}>
          <View style={styles.avatar}><CircleUserRound color={colors.blue} size={38} strokeWidth={1.8} /></View>
          <Text style={styles.eyebrow}>DEMO-TILSTAND</Text>
          <Text style={styles.title}>Velkommen, Demo-bruger</Text>
          <Text style={styles.subtitle}>Pentia Mobile</Text>
          <View style={styles.message}>
            <Text style={styles.messageTitle}>Du er logget ind i demoen</Text>
            <Text style={styles.messageText}>Her kan du teste funktioner efter login. Demoen bruger ingen rigtig konto eller virksomhedsdata.</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 24 },
  backButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8 },
  backText: { color: colors.blue, fontSize: 14, fontWeight: '600' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#E2E7FF', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 15 },
  message: { width: '100%', gap: 8, marginTop: 18, padding: 18, borderRadius: 16, backgroundColor: colors.white },
  messageTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  messageText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});