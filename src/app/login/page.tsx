'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';
import { getSupabaseClient } from '@/lib/supabaseClient';

function validateCredentials(email: string, password: string) {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) return 'Email is required.';
  if (!trimmedEmail.includes('@')) return 'Please enter a valid email.';
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const validationError = validateCredentials(email, password);
    if (validationError) {
      setMessage(validationError);
      setLoading(false);
      return;
    }

    try {
      const supabase = await getSupabaseClient();
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
          setMessage(error.message);
          return;
        }

        if (data?.user && !data?.session) {
          setMessage('Signup successful. Please confirm your email before logging in.');
          return;
        }

        setMessage('Signup successful. Redirecting to dashboard...');
        router.push('/dashboard');
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setMessage(error.message);
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
    <Section title="Login / Signup" subtitle="Supabase Auth" description="Create an account or log in to save workout sessions.">
      <Card>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button type="submit">{loading ? 'Please wait...' : isSignup ? 'Create account' : 'Login'}</Button>
            <Button type="button" variant="ghost" onClick={() => setIsSignup((v) => !v)}>
              {isSignup ? 'Switch to login' : 'Switch to signup'}
            </Button>
          </div>
          {message ? <p style={{ color: 'var(--muted)', margin: 0 }}>{message}</p> : null}
        </form>
      </Card>
    </Section>
  );
}
