import Link from 'next/link';
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';

type ButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: 'solid' | 'ghost';
  style?: CSSProperties;
};

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  border: '1px solid transparent',
  padding: '10px 16px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all .2s ease'
};

const variants: Record<NonNullable<ButtonProps['variant']>, CSSProperties> = {
  solid: {
    background: 'linear-gradient(90deg, var(--primary), var(--accent))',
    color: '#051126'
  },
  ghost: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text)'
  }
};

export function Button({ children, href, onClick, variant = 'solid', style }: ButtonProps) {
  const mergedStyle = { ...baseStyle, ...variants[variant], ...style };

  if (href) {
    return (
      <Link href={href} style={mergedStyle}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} style={mergedStyle}>
      {children}
    </button>
  );
}
