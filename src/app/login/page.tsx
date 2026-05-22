'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

function validateCredentials(email: string, password: string, isSignup: boolean, confirmPassword: string, acceptedTerms: boolean) {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) return 'Email is required.';
  if (!trimmedEmail.includes('@')) return 'Please enter a valid email.';
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';

  if (isSignup) {
    if (password !== confirmPassword) return 'Password and confirm password must match.';
    if (!acceptedTerms) return 'Please agree to the terms and conditions.';
  }

  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const validationError = validateCredentials(email, password, isSignup, confirmPassword, acceptedTerms);
    if (validationError) {
      setMessage(validationError);
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
          setMessage(error.message);
          return;
        }

        if (data?.user?.id && username.trim()) {
          await supabase.from('profiles').upsert({ id: data.user.id, username: username.trim().toLowerCase() }, { onConflict: 'id' });
        }

        if (data?.user && !data?.session) {
          setMessage('Signup successful. Please confirm your email before logging in.');
          return;
        }

        if (data?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_complete')
            .eq('id', data.user.id)
            .single();
          const dest = profile?.onboarding_complete ? '/dashboard' : '/onboarding/movement-screen';
          setMessage('Signup successful. Redirecting...');
          router.push(dest);
          router.refresh();
          return;
        }

        setMessage('Signup successful. Redirecting to dashboard...');
        router.push('/dashboard');
        router.refresh();
        return;
      }

      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setMessage(error.message);
        return;
      }

      if (signInData?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', signInData.user.id)
          .single();
        const dest = profile?.onboarding_complete ? '/dashboard' : '/onboarding/movement-screen';
        setMessage('Login successful. Redirecting...');
        router.push(dest);
        router.refresh();
        return;
      }

      setMessage('Login successful. Redirecting...');
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-label={isSignup ? 'Signup form' : 'Login form'}>
        <h1 className="auth-title">{isSignup ? 'Signup' : 'Login'}</h1>
        <p className="auth-subtitle">to get started</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignup ? (
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="auth-input"
              autoComplete="username"
              required
            />
          ) : null}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="auth-input"
            autoComplete="email"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="auth-input"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
          />

          {isSignup ? (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              className="auth-input"
              autoComplete="new-password"
              required
            />
          ) : (
            <button type="button" className="auth-text-link" onClick={() => setMessage('Password reset flow is not configured yet.')}
            >
              Forgot Password?
            </button>
          )}

          {isSignup ? (
            <label className="auth-checkbox-row">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>Agree to Our terms and Conditions</span>
            </label>
          ) : null}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : 'Continue'}
          </button>

          {message ? <p className="auth-message">{message}</p> : null}

          <p className="auth-switch-text">
            {isSignup ? 'Already registered?' : 'New User?'}{' '}
            <button type="button" className="auth-inline-link" onClick={() => {
              setIsSignup((v) => !v);
              setMessage('');
            }}>
              {isSignup ? 'Login' : 'Register'}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
