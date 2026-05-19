import Link from 'next/link';
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';

type ButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: 'solid' | 'ghost' | 'dark';
  full?: boolean;
  style?: CSSProperties;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
};

function variantClass(variant: NonNullable<ButtonProps['variant']>): string {
  if (variant === 'dark')  return 'btn btn-secondary';
  if (variant === 'ghost') return 'btn btn-ghost';
  return 'btn btn-primary';
}

export function Button({
  children,
  href,
  onClick,
  variant = 'solid',
  full = false,
  style,
  type = 'button',
  disabled,
  className,
}: ButtonProps) {
  const classes = [variantClass(variant), full ? 'btn-full' : '', className ?? ''].filter(Boolean).join(' ');

  if (href) {
    return (
      <Link href={href} className={classes} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes} style={style} disabled={disabled}>
      {children}
    </button>
  );
}
