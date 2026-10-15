import { router, type Href } from 'expo-router';
import { useState } from 'react';

import { supabase } from '@/backend/src/supabase';

export function useLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    if (isLoading || !email.trim() || !password) return;

    setError('');
    setIsLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status, role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        setError('Your account is not linked to a Frigo profile yet. Please contact your administrator.');
        await supabase.auth.signOut();
        return;
      }

      if (profile.status !== 'active') {
        router.replace('/pending' as Href);
      } else if (profile.role === 'super_admin' || profile.role === 'company_admin') {
        router.replace('/admin-review' as Href);
      } else {
        router.replace('/explore');
      }
    } catch {
      setError('Unable to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return { email, setEmail, password, setPassword, error, isLoading, handleLogin };
}