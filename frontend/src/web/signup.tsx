import { Link } from 'expo-router';
import { useEffect, useState, type FormEvent } from 'react';

import { supabase } from '@/backend/src/supabase';
import { FrigoLogo } from '@/frontend/src/components/frigo-logo';

type Company = { id: number; name: string };

export default function WebSignupPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationRequired, setConfirmationRequired] = useState(false);

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
      setIsLoading(false);
    }
    void loadCompanies();
    return () => { isMounted = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          display_name: name.trim(),
          company_id: Number(companyId),
        },
      },
    });
    setIsSubmitting(false);
    if (signupError) {
      setError(signupError.message);
      return;
    }
    if (data.session) {
      window.location.assign('/pending');
      return;
    }
    setConfirmationRequired(true);
  }

  return (
    <main className="frigo-web frigo-login-page">
      <section className="frigo-login-brand-panel" aria-label="Frigo">
        <div className="frigo-login-brand-content">
          <Link href="/" className="frigo-login-brand"><FrigoLogo size={30} tone="light" /></Link>
          <h1>Bliv en del af<br className="frigo-login-desktop-break" /> din virksomhed.</h1>
        </div>
      </section>
      <section className="frigo-login-form-panel" aria-labelledby="signup-title">
        <div className="frigo-login-card frigo-signup-card">
          {confirmationRequired ? (
            <>
              <h2 id="signup-title">Tjek din e-mail</h2>
              <p className="frigo-login-subtitle">Bekræft din e-mail. En administrator gennemgår derefter din anmodning.</p>
              <Link className="frigo-signup-back-link" href="/">Tilbage til log ind</Link>
            </>
          ) : (
            <>
              <h2 id="signup-title">Opret profil</h2>
              <p className="frigo-login-subtitle">Vælg din virksomhed. En administrator skal godkende din adgang.</p>
              <form onSubmit={(event) => void handleSubmit(event)} aria-busy={isSubmitting}>
                <label htmlFor="signup-name">Navn</label>
                <input id="signup-name" autoComplete="name" required value={name} onChange={(event) => setName(event.currentTarget.value)} />
                <label htmlFor="signup-email">E-mail</label>
                <input id="signup-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
                <label htmlFor="signup-company">Virksomhed</label>
                <select
                  id="signup-company"
                  required
                  value={companyId}
                  disabled={isLoading || companies.length === 0}
                  onChange={(event) => setCompanyId(event.currentTarget.value)}
                >
                  <option value="">{isLoading ? 'Indlæser virksomheder...' : 'Vælg virksomhed'}</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
                {!isLoading && companies.length === 0 && <p className="frigo-login-help">Der er ingen aktive virksomheder, du kan ikke oprette en profil endnu.</p>}
                <label htmlFor="signup-password">Adgangskode</label>
                <input id="signup-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.currentTarget.value)} />
                {error && <p className="frigo-web-error" role="alert">{error}</p>}
                <button type="submit" disabled={isSubmitting || isLoading || !companyId || !name.trim() || !email.trim() || password.length < 6}>
                  {isSubmitting ? 'Opretter profil...' : 'Opret profil'}
                </button>
                <p className="frigo-signup-login-link">Har du allerede en konto? <Link href="/">Log ind</Link></p>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
