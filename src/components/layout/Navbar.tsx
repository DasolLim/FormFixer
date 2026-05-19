'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import {
  Home,
  Camera,
  Dumbbell,
  Apple,
} from 'lucide-react';

const bottomNavItems = [
  { href: '/dashboard', label: 'Home',      icon: Home },
  { href: '/camera',    label: 'Camera',    icon: Camera },
  { href: '/programs',  label: 'Programs',  icon: Dumbbell },
  { href: '/nutrition', label: 'Nutrition', icon: Apple },
] as const;

const desktopNavItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/camera',    label: 'Camera' },
  { href: '/programs',  label: 'Programs' },
  { href: '/nutrition', label: 'Nutrition' },
  { href: '/calendar',  label: 'Calendar' },
] as const;


function getInitials(username: string | null | undefined, email: string | null | undefined): string {
  if (username) return username.slice(0, 2).toUpperCase();
  if (email) return email[0].toUpperCase();
  return 'FF';
}

export function Navbar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [isAuthed,  setIsAuthed]  = useState(false);
  const [username,  setUsername]  = useState<string | null>(null);
  const [email,     setEmail]     = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | null = null;

    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!active) return;
        const user = userData.user;
        setIsAuthed(Boolean(user));
        setEmail(user?.email ?? null);

        if (user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
          if (active) setUsername(profile?.username ?? null);
        }

        const { data } = supabase.auth.onAuthStateChange(
          (_event: string, session: { user?: { id: string; email?: string } } | null) => {
            if (!active) return;
            setIsAuthed(Boolean(session?.user?.id));
            setEmail(session?.user?.email ?? null);
          }
        );
        unsub = () => data.subscription.unsubscribe();
      } catch {
        if (!active) return;
        setIsAuthed(false);
      }
    })();

    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, []);

  async function handleLogout() {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) return;
    setIsAuthed(false);
    router.push('/login');
    router.refresh();
  }

  const initials = getInitials(username, email);
  const isProfileActive = pathname === '/profile' || pathname?.startsWith('/profile/');

  return (
    <>
      <header className="navbar">
        {/* Mobile: greeting */}
        <div className="navbar-user">
          <div className="avatar-placeholder">FF</div>
          <div className="navbar-greeting">
            <span className="navbar-greeting-sub">Welcome back</span>
            <span className="navbar-greeting-name">FormFixer</span>
          </div>
        </div>

        {/* Desktop: brand */}
        <Link href="/" className="navbar-brand-wrap">
          FormFixer
        </Link>

        {/* Desktop: nav links */}
        <nav className="desktop-nav-links">
          {desktopNavItems.map(({ href, label }) => {
            const isActive = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`desktop-nav-link${isActive ? ' active' : ''}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right: auth + profile avatar */}
        <div className="navbar-end">
          {isAuthed ? (
            <button
              type="button"
              className="navbar-auth-btn"
              onClick={handleLogout}
              style={{ display: 'none' }}
            />
          ) : (
            <Link href="/login" className="navbar-auth-btn">
              Sign in
            </Link>
          )}

          {/* Profile avatar — always shown when authed */}
          {isAuthed && (
            <Link
              href="/profile"
              aria-label="Go to profile"
              title="Profile"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: isProfileActive ? 'var(--accent)' : 'var(--bg-input)',
                border: `2px solid ${isProfileActive ? 'var(--accent)' : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: isProfileActive ? 'var(--accent-fg)' : 'var(--text-secondary)',
                textDecoration: 'none',
                flexShrink: 0,
                transition: 'border-color 0.15s, background 0.15s',
                letterSpacing: '0.02em',
              }}
            >
              {initials}
            </Link>
          )}
        </div>
      </header>

      {/* Mobile bottom tab nav */}
      <nav className="bottom-nav">
        {bottomNavItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={22} strokeWidth={1.5} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
