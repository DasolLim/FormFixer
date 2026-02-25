'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

const links = [
  { href: '/', label: 'Home' },
  { href: '/camera', label: 'Camera' },
  { href: '/programs', label: 'Program' },
  { href: '/nutrition', label: 'Nutrition' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/social', label: 'Friends' },
  { href: '/profile', label: 'Profile' },
  { href: '/dashboard', label: 'Dashboard' }
];

export function Navbar() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | null = null;

    getSupabaseClient()
      .then(async (supabase) => {
        const { data: userData } = await supabase.auth.getUser();
        if (!active) return;
        setIsAuthed(Boolean(userData.user));

        const { data } = supabase.auth.onAuthStateChange((_event: string, session: { user?: { id: string } } | null) => {
          if (!active) return;
          setIsAuthed(Boolean(session?.user?.id));
        });

        unsub = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        if (!active) return;
        setIsAuthed(false);
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
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="top-nav-shell">
      <nav className="top-nav">
        <Link href="/" className="top-nav-logo" aria-label="FormCRT Home">
          FC
        </Link>

        <div className="top-nav-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>

        {isAuthed ? (
          <button type="button" className="top-nav-cta" onClick={handleLogout}>
            Logout
          </button>
        ) : (
          <Link href="/login" className="top-nav-cta">
            Join Now
          </Link>
        )}
      </nav>
    </header>
  );
}
