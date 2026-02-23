import type { ReactNode } from 'react';

type CardProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
};

export function Card({ title, description, children }: CardProps) {
  return (
    <article
      style={{
        background: 'linear-gradient(160deg, var(--surface), var(--surface-soft))',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 18
      }}
    >
      {title ? <h3 style={{ margin: '0 0 8px 0' }}>{title}</h3> : null}
      {description ? <p style={{ margin: '0 0 12px 0', color: 'var(--muted)' }}>{description}</p> : null}
      {children}
    </article>
  );
}
