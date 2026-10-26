import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/backend/src/supabase';
import { FrigoLogo } from '@/frontend/src/components/frigo-logo';

const colors = {
  background: '#F5F7F2',
  ink: '#19251F',
  muted: '#69766E',
  line: '#DCE4DB',
  green: '#247451',
  greenWash: '#E4F0E8',
  white: '#FFFFFF',
  red: '#A33D36',
  redWash: '#F8E9E6',
};

type AdminRole = 'super_admin' | 'company_admin';
type Reviewer = { id: string; displayName: string; role: AdminRole; companyId: number | null };
type Company = { id: number; name: string };
type EmployeeRequest = {
  id: number;
  employee_id: string;
  company_id: number | null;
  requested_admin_id: string | null;
  requested_admin_email: string | null;
  created_at: string;
  employeeName: string;
  employeeEmail: string;
  companyName: string | null;
};

export default function AdminReviewScreen({ embedded = false }: { embedded?: boolean }) {
  const [reviewer, setReviewer] = useState<Reviewer | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Record<number, number>>({});
  const [declineReasons, setDeclineReasons] = useState<Record<number, string>>({});
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError('');

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (sessionError || !user) {
      router.replace('/' as Href);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, role, company_id, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || profile.status !== 'active') {
      router.replace(profile?.status === 'pending' || profile?.status === 'rejected' ? '/pending' as Href : '/' as Href);
      return;
    }

    if (profile.role !== 'super_admin' && profile.role !== 'company_admin') {
      router.replace('/explore' as Href);
      return;
    }

    const currentReviewer: Reviewer = {
      id: profile.id,
      displayName: profile.display_name,
      role: profile.role,
      companyId: profile.company_id,
    };
    setReviewer(currentReviewer);

    if (currentReviewer.role === 'super_admin') {
      const { data: companyRows, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (companiesError) setError(companiesError.message);
      setCompanies(companyRows ?? []);
    } else if (currentReviewer.companyId !== null) {
      const { data: companyRows } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', currentReviewer.companyId)
        .limit(1);
      setCompanies(companyRows ?? []);
    }

    let requestQuery = supabase
      .from('employee_requests')
      .select('id, employee_id, company_id, requested_admin_id, requested_admin_email, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (currentReviewer.role === 'super_admin') {
      requestQuery = requestQuery.eq('requested_admin_id', currentReviewer.id);
    } else {
      requestQuery = requestQuery
        .eq('company_id', currentReviewer.companyId ?? -1)
        .eq('requested_admin_id', currentReviewer.id);
    }

    const { data: requestRows, error: requestsError } = await requestQuery;
    if (requestsError) {
      setError(requestsError.message);
      setRequests([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const employeeIds = (requestRows ?? []).map((request) => request.employee_id);
    const companyIds = [...new Set((requestRows ?? []).map((request) => request.company_id).filter((id): id is number => id !== null))];
    const [{ data: employees }, { data: companyLookup }] = await Promise.all([
      employeeIds.length
        ? supabase.from('profiles').select('id, display_name, email').in('id', employeeIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string; email: string }[] }),
      companyIds.length
        ? supabase.from('companies').select('id, name').in('id', companyIds)
        : Promise.resolve({ data: [] as Company[] }),
    ]);

    const employeeById = new Map((employees ?? []).map((employee) => [employee.id, employee]));
    const companyById = new Map((companyLookup ?? []).map((company) => [company.id, company]));
    setRequests((requestRows ?? []).map((request) => {
      const employee = employeeById.get(request.employee_id);
      return {
        ...request,
        employeeName: employee?.display_name ?? 'New employee',
        employeeEmail: employee?.email ?? '',
        companyName: request.company_id === null ? null : companyById.get(request.company_id)?.name ?? null,
      };
    }));
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleReview(request: EmployeeRequest, accept: boolean) {
    if (!reviewer) return;
    const companyId = reviewer.role === 'super_admin'
      ? selectedCompanies[request.id] ?? request.company_id ?? undefined
      : reviewer.companyId ?? undefined;

    if (accept && !companyId) {
      setError('Select a company before accepting this request.');
      return;
    }

    setBusyRequestId(request.id);
    setError('');
    setNotice('');
    const { error: reviewError } = await supabase.rpc('review_employee_request', {
      p_request_id: request.id,
      p_accept: accept,
      p_company_id: accept ? companyId : null,
      p_decline_reason: accept ? null : declineReasons[request.id]?.trim() || null,
    });

    setBusyRequestId(null);
    if (reviewError) {
      setError(reviewError.message);
      return;
    }

    setNotice(accept ? `${request.employeeName} was approved.` : `${request.employeeName}'s request was declined.`);
    await loadData(true);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/' as Href);
  }

  return (
    <SafeAreaView style={[styles.safeArea, embedded && styles.embeddedSafeArea]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} tintColor={colors.green} />}
      >
        <View style={styles.page}>
          {!embedded && (
            <View style={styles.topBar}>
              <View style={styles.brandRow}>
                <FrigoLogo size={34} />
              </View>
              <Pressable accessibilityRole="button" onPress={handleSignOut} hitSlop={10}>
                <Text style={styles.signOut}>Sign out</Text>
              </Pressable>
            </View>
          )}

          {!embedded && (
            <View style={styles.heading}>
              <Text style={styles.eyebrow}>{reviewer?.role === 'super_admin' ? 'SUPERADMIN' : 'COMPANY ADMIN'}</Text>
              <Text style={styles.title}>Employee requests</Text>
              <Text style={styles.subtitle}>
                {reviewer?.role === 'super_admin'
                  ? 'Review requests addressed to you and choose a company when approving.'
                  : `Review employee access requests for ${companies[0]?.name ?? 'your company'}.`}
              </Text>
            </View>
          )}

          {!!error && <Text accessibilityRole="alert" style={styles.errorBanner}>{error}</Text>}
          {!!notice && <Text accessibilityRole="alert" style={styles.noticeBanner}>{notice}</Text>}

          {isLoading ? (
            <View style={styles.loading}><ActivityIndicator size="large" color={colors.green} /></View>
          ) : requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySubtitle}>New employee requests addressed to you will appear here.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {requests.map((request) => {
                const busy = busyRequestId === request.id;
                return (
                  <View key={request.id} style={styles.requestRow}>
                    <View style={styles.requestHead}>
                      <View style={styles.avatar}><Text style={styles.avatarText}>{request.employeeName.slice(0, 1).toUpperCase()}</Text></View>
                      <View style={styles.identity}>
                        <Text style={styles.employeeName}>{request.employeeName}</Text>
                        <Text style={styles.employeeEmail}>{request.employeeEmail}</Text>
                      </View>
                      <Text style={styles.date}>{new Date(request.created_at).toLocaleDateString()}</Text>
                    </View>

                    {reviewer?.role === 'super_admin' ? (
                      <View style={styles.companySection}>
                        <Text style={styles.fieldLabel}>Company to assign</Text>
                        <View style={styles.companyChoices}>
                          {companies.map((company) => {
                            const selected = selectedCompanies[request.id] === company.id;
                            return (
                              <Pressable
                                key={company.id}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                onPress={() => setSelectedCompanies((current) => ({ ...current, [request.id]: company.id }))}
                                style={[styles.companyChoice, selected && styles.companyChoiceSelected]}
                              >
                                <Text style={[styles.companyChoiceText, selected && styles.companyChoiceTextSelected]}>{company.name}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.companySummary}>
                        Joining {request.companyName ?? 'your company'}
                      </Text>
                    )}

                    <TextInput
                      accessibilityLabel={`Optional decline reason for ${request.employeeName}`}
                      onChangeText={(value) => setDeclineReasons((current) => ({ ...current, [request.id]: value }))}
                      placeholder="Optional decline reason"
                      placeholderTextColor="#8A958D"
                      style={styles.reasonInput}
                      value={declineReasons[request.id] ?? ''}
                    />

                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => handleReview(request, false)}
                        style={({ pressed }) => [styles.declineButton, pressed && styles.pressed, busy && styles.disabled]}
                      >
                        <Text style={styles.declineText}>{busy ? 'Working…' : 'Decline'}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy || (reviewer?.role === 'super_admin' && !selectedCompanies[request.id])}
                        onPress={() => handleReview(request, true)}
                        style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed, (busy || (reviewer?.role === 'super_admin' && !selectedCompanies[request.id])) && styles.disabled]}
                      >
                        {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.acceptText}>Accept request</Text>}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  embeddedSafeArea: { backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1 },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signOut: { color: colors.muted, fontSize: 13, fontWeight: '600', padding: 8 },
  heading: { gap: 8, marginBottom: 28 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  loading: { paddingVertical: 72 },
  emptyState: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 30, gap: 6 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  emptySubtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  list: { borderTopWidth: 1, borderTopColor: colors.line },
  requestRow: { paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 16 },
  requestHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.greenWash, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.green, fontSize: 17, fontWeight: '700' },
  identity: { flex: 1, gap: 3 },
  employeeName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  employeeEmail: { color: colors.muted, fontSize: 13 },
  date: { color: colors.muted, fontSize: 11 },
  companySection: { gap: 8 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  companyChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  companyChoice: { minHeight: 38, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.white, justifyContent: 'center', paddingHorizontal: 12 },
  companyChoiceSelected: { borderColor: colors.green, backgroundColor: colors.greenWash },
  companyChoiceText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  companyChoiceTextSelected: { color: colors.green },
  companySummary: { color: colors.muted, fontSize: 13 },
  reasonInput: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.white, paddingHorizontal: 12, color: colors.ink, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  declineButton: { minHeight: 44, borderWidth: 1, borderColor: '#E5C7C2', borderRadius: 7, backgroundColor: colors.redWash, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17 },
  declineText: { color: colors.red, fontSize: 13, fontWeight: '700' },
  acceptButton: { minHeight: 44, minWidth: 130, borderRadius: 7, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17 },
  acceptText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  errorBanner: { color: colors.red, backgroundColor: colors.redWash, padding: 12, borderRadius: 7, marginBottom: 16, fontSize: 13 },
  noticeBanner: { color: colors.green, backgroundColor: colors.greenWash, padding: 12, borderRadius: 7, marginBottom: 16, fontSize: 13 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
