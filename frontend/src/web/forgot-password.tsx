import { Link } from 'expo-router';
import { useEffect, useState, type FormEvent } from 'react';

import { supabase } from '@/backend/src/supabase';
import { FrigoLogo } from '@/frontend/src/components/frigo-logo';

type RecoveryStage = 'request' | 'sent' | 'reset' | 'complete';

function getRecoveryParams(url: string) {
  const parsedUrl = new URL(url);
  const fragment = new URLSearchParams(parsedUrl.hash.slice(1));
  return fragment.has('access_token')
    || fragment.has('code')
    || fragment.has('error')
    || fragment.has('error_description')
    ? fragment
    : parsedUrl.searchParams;
}

export default function WebForgotPasswordPage() {
  const [stage, setStage] = useState<RecoveryStage>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState('');
  const [completionNotice, setCompletionNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(true);

  const hasMinimumLength = password.length >= 8;
  const hasUpperAndLowercase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);

  useEffect(() => {
    let isMounted = true;

    async function handleRecoveryUrl(url: string) {
      const params = getRecoveryParams(url);
      const hasCallbackParams = params.has('access_token')
        || params.has('code')
        || params.has('error')
        || params.has('error_description')
        || params.has('type');

      if (!hasCallbackParams) {
        if (isMounted) setIsCheckingRecovery(false);
        return;
      }

      window.history.replaceState(null, document.title, window.location.pathname);

      try {
        if (params.has('error') || params.has('error_description')) {
          throw new Error('Linket er ugyldigt eller udløbet. Bed om et nyt nulstillingslink.');
        }

        const recoveryType = params.get('type');
        if (recoveryType && recoveryType !== 'recovery') {
          throw new Error('Linket er ugyldigt eller udløbet. Bed om et nyt nulstillingslink.');
        }

        const code = params.get('code');
        if (code) {
          const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;
        } else {
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (!accessToken || !refreshToken) {
            throw new Error('Linket er ugyldigt eller udløbet. Bed om et nyt nulstillingslink.');
          }

          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }

        if (isMounted) {
          setError('');
          setStage('reset');
        }
      } catch {
        if (isMounted) setError('Linket er ugyldigt eller udløbet. Bed om et nyt nulstillingslink.');
      } finally {
        if (isMounted) setIsCheckingRecovery(false);
      }
    }

    void handleRecoveryUrl(window.location.href);
    return () => {
      isMounted = false;
    };
  }, []);

  async function sendResetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Skriv en gyldig e-mailadresse.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/forgot-password`,
      });
      if (resetError) throw resetError;
      setStage('sent');
    } catch {
      setError('Nulstillingslinket kunne ikke sendes. Prøv igen senere.');
    } finally {
      setIsLoading(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasMinimumLength || !hasUpperAndLowercase || !hasNumber) {
      setError('Adgangskoden opfylder ikke alle krav endnu.');
      return;
    }
    if (password !== repeatPassword) {
      setError('Adgangskoderne er ikke ens.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setCompletionNotice('Adgangskoden er ændret, men du blev ikke logget ud. Log ud, før du logger ind igen.');
      }
      setStage('complete');
    } catch {
      setError('Adgangskoden kunne ikke ændres. Bed om et nyt nulstillingslink, og prøv igen.');
    } finally {
      setIsLoading(false);
    }
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

      <section className="frigo-login-form-panel" aria-labelledby="forgot-password-title">
        <div className="frigo-login-card frigo-invite-card">
          <Link className="frigo-invite-back-link" href="/">‹ Tilbage til log ind</Link>
          <h2 id="forgot-password-title">
            {stage === 'request' ? 'Glemt adgangskode?'
              : stage === 'sent' ? 'Tjek din mail'
                : stage === 'reset' ? 'Vælg ny adgangskode'
                  : 'Adgangskoden er ændret'}
          </h2>
          {isCheckingRecovery ? (
            <p className="frigo-login-subtitle" role="status">Kontrollerer nulstillingslink...</p>
          ) : stage === 'request' ? (
            <>
              <p className="frigo-login-subtitle">Skriv din e-mail, så sender vi et link til at vælge en ny adgangskode.</p>
              <form onSubmit={(event) => void sendResetLink(event)} aria-busy={isLoading}>
                <label htmlFor="reset-email">E-mail</label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="navn@virksomhed.dk"
                  required
                  value={email}
                  onChange={(event) => { setEmail(event.currentTarget.value); setError(''); }}
                />
                {error && <p className="frigo-web-error" role="alert">{error}</p>}
                <button type="submit" disabled={isLoading || !email.trim()}>
                  {isLoading ? 'Sender...' : 'Send nulstillingslink'}
                </button>
                <p className="frigo-login-help">Hvis adressen er knyttet til en konto, sender vi et link.</p>
              </form>
            </>
          ) : stage === 'sent' ? (
            <>
              <p className="frigo-login-subtitle" role="status">
                Hvis {email.trim()} er knyttet til en konto, modtager du snart et link til at nulstille adgangskoden.
              </p>
              <button className="frigo-login-forgot" type="button" onClick={() => setStage('request')}>
                Brug en anden e-mail
              </button>
            </>
          ) : stage === 'reset' ? (
            <>
              <form onSubmit={(event) => void savePassword(event)} aria-busy={isLoading}>
                <label htmlFor="reset-new-password">Ny adgangskode</label>
                <input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => { setPassword(event.currentTarget.value); setError(''); }}
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
                <label htmlFor="reset-repeat-password">Gentag adgangskode</label>
                <input
                  id="reset-repeat-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={repeatPassword}
                  onChange={(event) => { setRepeatPassword(event.currentTarget.value); setError(''); }}
                />
                {error && <p className="frigo-web-error" role="alert">{error}</p>}
                <button type="submit" disabled={isLoading || !hasMinimumLength || !hasUpperAndLowercase || !hasNumber || password !== repeatPassword}>
                  {isLoading ? 'Gemmer...' : 'Gem ny adgangskode'}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="frigo-login-subtitle" role="status">Du kan nu logge ind med din nye adgangskode.</p>
              {completionNotice && <p className="frigo-web-error" role="alert">{completionNotice}</p>}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
