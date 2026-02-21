import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/camera', label: 'Form Fixer' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/login', label: 'Login' }
];

export function Navbar() {
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
        <div style={{ display: 'flex', gap: 14, color: 'var(--muted)' }}>
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
