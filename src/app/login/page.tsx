import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';

export default function LoginPage() {
  return (
    <Section title="Login / Signup" subtitle="Auth UI placeholder" description="Supabase Auth wiring will be added in v1.">
      <Card>
        <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
          <label>
            Email
            <input
              type="email"
              placeholder="you@example.com"
              style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="••••••••"
              style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button>Login</Button>
            <Button variant="ghost">Create account</Button>
          </div>
        </div>
      </Card>
    </Section>
  );
}
