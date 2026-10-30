import { router, type Href } from 'expo-router';
import { useState } from 'react';

import { supabase } from '@/backend/src/supabase';

type LoginSuccessHandler = (destination: Href) => void | Promise<void>;

export function useLogin(onLoginSuccess?: LoginSuccessHandler) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    if (isLoading || !email.trim() || !password) return;

    setError('');
    setNotice('');
    setIsLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
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
        .select('status, role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        setError('Din konto er endnu ikke knyttet til en Frigo-profil. Kontakt din administrator.');
        await supabase.auth.signOut();
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

      const destination = profile.role === 'super_admin' || profile.role === 'company_admin'
        ? '/admin-review' as Href
        : '/explore' as Href;

      if (onLoginSuccess) {
        await onLoginSuccess(destination);
      } else {
        router.replace(destination);
      }
    } catch {
      setError('Det lykkedes ikke at logge ind. Prøv igen.');
    } finally {
      setIsLoading(false);
    }
  }

  return { email, setEmail, password, setPassword, error, notice, isLoading, handleLogin };
}