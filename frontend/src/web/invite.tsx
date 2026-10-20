import { router, type Href } from 'expo-router';
import { useEffect, useState, type FormEvent } from 'react';

import { supabase } from '@/backend/src/supabase';

type InviteState = 'loading' | 'ready' | 'error';

export default function InvitePage() {
  const [state, setState] = useState<InviteState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function prepareInvite() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const inviteType = params.get('type');

      window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);

      if (!accessToken || !refreshToken || inviteType !== 'invite') {
        setErrorMessage('Dette invitationslink er ugyldigt eller udløbet. Bed en administrator om at sende en ny invitation.');
        setState('error');
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        setErrorMessage(`Invitationen kunne ikke bekræftes: ${error.message}`);
        setState('error');
        return;
      }

      setState('ready');
    }

    void prepareInvite();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    if (password !== confirmPassword) {
      setErrorMessage('Adgangskoderne er ikke ens.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMessage(`Adgangskoden kunne ikke gemmes: ${error.message}`);
      setIsSaving(false);
      return;
    }

    router.replace('/admin-review' as Href);
  }

  return (
    <div className="frigo-web">
      <header className="frigo-web-header">
        <span className="frigo-web-brand">Frigo</span>
      </header>
      <main className="frigo-web-main">
        <section className="frigo-web-login" aria-labelledby="invite-title">
          <p className="frigo-web-eyebrow">VIRKSOMHEDSADMIN</p>
          <h1 id="invite-title">Aktivér din adgang</h1>
          {state === 'loading' ? (
            <p className="frigo-web-subtitle" role="status">Bekræfter din invitation...</p>
          ) : state === 'error' ? (
            <p className="frigo-web-error" role="alert">{errorMessage}</p>
          ) : (
            <>
              <p className="frigo-web-subtitle">Vælg en adgangskode for at åbne din virksomheds Frigo-administration.</p>
              <form onSubmit={(event) => void handleSubmit(event)} aria-busy={isSaving}>
                <label htmlFor="invite-password">Adgangskode</label>
                <input
                  id="invite-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                />
                <label htmlFor="invite-password-confirm">Gentag adgangskode</label>
                <input
                  id="invite-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                />
                {errorMessage && <p className="frigo-web-error" role="alert">{errorMessage}</p>}
                <button type="submit" disabled={isSaving || !password || !confirmPassword}>
                  {isSaving ? 'Gemmer...' : 'Gem adgangskode'}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
