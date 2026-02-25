import Link from 'next/link';
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';

type ButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: 'solid' | 'ghost';
  style?: CSSProperties;
  type?: 'button' | 'submit' | 'reset';
};

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 10,
  border: '1px solid transparent',
  minHeight: 42,
  padding: '10px 18px',
  fontWeight: 600,
  fontSize: 'var(--font-size-sm)',
  letterSpacing: '.01em',
  cursor: 'pointer',
  transition: 'all .2s ease'
};

const variants: Record<NonNullable<ButtonProps['variant']>, CSSProperties> = {
  solid: {
    background: 'var(--accent)',
    color: '#ffffff',
    boxShadow: '0 8px 16px rgba(16, 40, 217, 0.2)'
  },
  ghost: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text)'
  }
};

export function Button({ children, href, onClick, variant = 'solid', style, type = 'button' }: ButtonProps) {
  const mergedStyle = { ...baseStyle, ...variants[variant], ...style };

  if (href) {
    return (
      <Link href={href} style={mergedStyle}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} style={mergedStyle}>
      {children}
    </button>
  );
}
