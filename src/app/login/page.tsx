'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setMessage('');

    try {
      const supabase = await getSupabaseClient();
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password });
        setMessage(error ? error.message : 'Signup successful. Check your email if confirmation is enabled.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage(error.message);
        } else {
          setMessage('Login successful. Redirecting...');
          window.location.href = '/dashboard';
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="Login / Signup" subtitle="Supabase Auth" description="Create an account or log in to save workout sessions.">
      <Card>
        <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
              style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={handleSubmit}>{loading ? 'Please wait...' : isSignup ? 'Create account' : 'Login'}</Button>
            <Button variant="ghost" onClick={() => setIsSignup((v) => !v)}>
              {isSignup ? 'Switch to login' : 'Switch to signup'}
            </Button>
          </div>
          {message ? <p style={{ color: 'var(--muted)', margin: 0 }}>{message}</p> : null}
        </div>
      </Card>
    </Section>
  );
}
