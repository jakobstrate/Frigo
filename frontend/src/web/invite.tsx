import { Link, router, type Href } from 'expo-router';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { createInviteAuthClient, supabase } from '@/backend/src/supabase';
import { FrigoLogo } from '@/frontend/src/components/frigo-logo';

type InviteState = 'loading' | 'ready' | 'error';

export default function InvitePage() {
  const [state, setState] = useState<InviteState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inviteAuthClient = useRef<ReturnType<typeof createInviteAuthClient> | null>(null);
  const hasMinimumLength = password.length >= 8;
  const hasUpperAndLowercase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);

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

      const authClient = createInviteAuthClient();
      inviteAuthClient.current = authClient;
      const { data, error } = await authClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        setErrorMessage(`Invitationen kunne ikke bekræftes: ${error.message}`);
        setState('error');
        return;
      }

      const email = data.session?.user.email;
      if (!email) {
        setErrorMessage('E-mailadressen i invitationen kunne ikke læses. Bed en administrator om at sende en ny invitation.');
        setState('error');
        return;
      }

      setInviteEmail(email);
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
    if (!hasMinimumLength || !hasUpperAndLowercase || !hasNumber) {
      setErrorMessage('Adgangskoden opfylder ikke alle krav endnu.');
      return;
    }
    const authClient = inviteAuthClient.current;
    if (!authClient || !inviteEmail) {
      setErrorMessage('Invitationen skal bekræftes igen. Bed en administrator om at sende en ny invitation.');
      setState('error');
      return;
    }

    setIsSaving(true);
    const { error: updateError } = await authClient.auth.updateUser({ password });
    if (updateError) {
      setErrorMessage(`Adgangskoden kunne ikke gemmes: ${updateError.message}`);
      setIsSaving(false);
      return;
    }

    const { error: activationError } = await authClient.rpc('activate_invited_account');
    if (activationError) {
      setErrorMessage(`Adgangskoden blev gemt, men kontoen kunne ikke aktiveres: ${activationError.message}`);
      setIsSaving(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: inviteEmail, password });
    if (signInError) {
      setErrorMessage(`Adgangskoden blev gemt, men login kunne ikke gennemføres: ${signInError.message}`);
      setState('error');
      setIsSaving(false);
      return;
    }

    router.replace('/admin-review' as Href);
  }

  return (
    <main className="frigo-web frigo-login-page frigo-invite-page">
      <section className="frigo-login-brand-panel" aria-label="Frigo">
        <div className="frigo-login-brand-content">
          <Link href="/" className="frigo-login-brand">
            <FrigoLogo size={30} tone="light" />
          </Link>
          <h1>Styr køleskabet fra<br className="frigo-login-desktop-break" /> ét sted.</h1>
        </div>
      </section>

      <section className="frigo-login-form-panel" aria-labelledby="invite-title">
        <div className="frigo-login-card frigo-invite-card">
          <Link href="/" className="frigo-invite-back-link">‹ Tilbage til log ind</Link>
          <h2 id="invite-title">Vælg ny adgangskode</h2>
          {state === 'loading' ? (
            <p className="frigo-login-subtitle" role="status">Bekræfter din invitation...</p>
          ) : state === 'error' ? (
            <p className="frigo-web-error" role="alert">{errorMessage}</p>
          ) : (
            <>
              <form onSubmit={(event) => void handleSubmit(event)} aria-busy={isSaving}>
                <label htmlFor="invite-password">Ny adgangskode</label>
                <input
                  id="invite-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                />
                <ul className="frigo-invite-requirements" aria-label="Krav til adgangskoden">
                  <li className={hasMinimumLength ? 'is-passed' : ''}>
                    <span aria-hidden="true">{hasMinimumLength ? '✓' : '○'}</span> Mindst 8 tegn
                  </li>
                  <li className={hasUpperAndLowercase ? 'is-passed' : ''}>
                    <span aria-hidden="true">{hasUpperAndLowercase ? '✓' : '○'}</span> Store og små bogstaver
                  </li>
                  <li className={hasNumber ? 'is-passed' : ''}>
                    <span aria-hidden="true">{hasNumber ? '✓' : '○'}</span> Mindst ét tal
                  </li>
                </ul>
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
                <button
                  type="submit"
                  disabled={isSaving || !hasMinimumLength || !hasUpperAndLowercase || !hasNumber || password !== confirmPassword}
                >
                  {isSaving ? 'Gemmer...' : 'Gem og log ind'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
