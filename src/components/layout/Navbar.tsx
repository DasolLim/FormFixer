'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';

const links = [
  { href: '/', label: 'Home' },
  { href: '/camera', label: 'Form Fixer' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/profile', label: 'Profile' }
];

export function Navbar() {
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    getSupabaseClient().then((supabase) => {
      supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => setIsAuthed(Boolean(data.user)));
      const { data } = supabase.auth.onAuthStateChange((_event: string, session: { user?: { id: string } } | null) => setIsAuthed(Boolean(session?.user)));
      unsub = () => data.subscription.unsubscribe();
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  async function handleLogout() {
    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)' }}>
      <nav
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          padding: '14px 20px'
        }}
      >
        <Link href="/" style={{ fontWeight: 700, letterSpacing: '.04em' }}>
          FORMFIXER
        </Link>
        <div style={{ display: 'flex', gap: 14, color: 'var(--muted)', alignItems: 'center' }}>
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          {isAuthed ? (
            <Button onClick={handleLogout} variant="ghost">
              Logout
            </Button>
          ) : (
            <Link href="/login">Login</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
