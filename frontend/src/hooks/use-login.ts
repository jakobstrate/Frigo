import { router, type Href } from 'expo-router';
import { useState } from 'react';

import { supabase } from '@/backend/src/supabase';

export type LoginCredentials = { email: string; password: string };
type LoginSuccessHandler = (destination: Href, credentials: LoginCredentials) => void | Promise<void>;

type LoginConfiguration = { allowEmployeeAccess?: boolean } | LoginSuccessHandler;

export function useLogin(loginConfiguration?: LoginConfiguration) {
  const onLoginSuccess = typeof loginConfiguration === 'function' ? loginConfiguration : undefined;
  const allowEmployeeAccess = typeof loginConfiguration === 'function'
    ? true
    : loginConfiguration?.allowEmployeeAccess ?? true;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function signInWithCredentials(loginEmail: string, loginPassword: string) {
    if (isLoading || !loginEmail.trim() || !loginPassword) return;

    setError('');
    setNotice('');
    setIsLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (signInError) {
        const message = signInError.message.toLowerCase();
        if (message.includes('invalid login credentials')) {
          setError('E-mail eller adgangskode er forkert.');
        } else if (message.includes('email not confirmed')) {
          setError('Bekræft din e-mail, før du logger ind.');
        } else if (message.includes('too many requests')) {
          setError('Der er for mange loginforsøg. Vent lidt, og prøv igen.');
        } else {
          setError('Det lykkedes ikke at logge ind. Prøv igen.');
        }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status, role, roles, company_id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        setError('Din konto er endnu ikke knyttet til en Frigo-profil. Kontakt din administrator.');
        await supabase.auth.signOut();
        return;
      }

      if (!allowEmployeeAccess && profile.role === 'employee') {
        await supabase.auth.signOut();
        setError('Medarbejdere har ikke adgang til at logge ind på administration. Brug Frigo-appen i stedet.');
        return;
      }

      if (profile.status !== 'active') {
        if (profile.status === 'pending') {
          setNotice('Din konto afventer godkendelse fra din virksomhedsadministrator.');
        } else if (profile.status === 'rejected') {
          setError('Din anmodning om adgang er blevet afvist. Kontakt din virksomhedsadministrator.');
        } else {
          setError('Din konto er endnu ikke aktiv. Kontakt din virksomhedsadministrator.');
        }
        await supabase.auth.signOut();
        return;
      }

      const isAdmin = profile.role === 'super_admin' || profile.role === 'company_admin';
      const hasEmployeeAccess = profile.roles.includes('employee') && profile.company_id !== null;
      const destination = allowEmployeeAccess && hasEmployeeAccess
        ? '/explore' as Href
        : isAdmin
          ? '/admin-review' as Href
          : '/explore' as Href;

      if (onLoginSuccess) {
        await onLoginSuccess(destination, { email: loginEmail.trim(), password: loginPassword });
      } else {
        router.replace(destination);
      }
    } catch {
      setError('Det lykkedes ikke at logge ind. Prøv igen.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin() {
    await signInWithCredentials(email, password);
  }

  async function handleSavedCredentialsLogin(credentials: LoginCredentials) {
    await signInWithCredentials(credentials.email, credentials.password);
  }

  return { email, setEmail, password, setPassword, error, notice, isLoading, handleLogin, handleSavedCredentialsLogin };
}