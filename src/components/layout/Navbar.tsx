'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';

const links = [
  { href: '/', label: 'Home' },
  { href: '/camera', label: 'Form Fixer' },
  { href: '/programs', label: 'Programs' },
  { href: '/nutrition', label: 'Nutrition' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/social', label: 'Social' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/profile', label: 'Profile' }
];

export function Navbar() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadUnreadCount(nextUserId: string) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from('notifications').select('id').eq('user_id', nextUserId).is('read_at', null);
    if (!error) setUnreadCount((data ?? []).length);
  }

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | null = null;

    getSupabaseClient()
      .then((supabase) => {
        supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
          if (!active) return;
          setIsAuthed(Boolean(data.user));
          setUserId(data.user?.id ?? null);
          if (data.user) await loadUnreadCount(data.user.id);
        });

        const { data } = supabase.auth.onAuthStateChange(async (_event: string, session: { user?: { id: string } } | null) => {
          if (!active) return;
          const nextId = session?.user?.id ?? null;
          setIsAuthed(Boolean(nextId));
          setUserId(nextId);
          if (nextId) await loadUnreadCount(nextId);
          else setUnreadCount(0);
        });

        unsub = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        if (!active) return;
        setIsAuthed(false);
        setUserId(null);
        setUnreadCount(0);
      });

    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, []);

  async function handleLogout() {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) return;
    setIsAuthed(false);
    setUserId(null);
    setUnreadCount(0);
    router.push('/login');
    router.refresh();
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
        <div style={{ display: 'flex', gap: 14, color: 'var(--muted)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}

          <Link href="/notifications" style={{ position: 'relative' }}>
            🔔
            {isAuthed && unreadCount > 0 ? (
              <span
                style={{
                  position: 'absolute',
                  top: -8,
                  right: -10,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 999,
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px'
                }}
              >
                {unreadCount}
              </span>
            ) : null}
          </Link>

          {isAuthed && userId ? (
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
