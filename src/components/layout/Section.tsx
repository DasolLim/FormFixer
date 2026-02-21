import type { ReactNode } from 'react';

type SectionProps = {
  title: string;
  subtitle?: string;
  description?: string;
  children: ReactNode;
};

export function Section({ title, subtitle, description, children }: SectionProps) {
  return (
    <section style={{ marginBottom: 28 }}>
      <p style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: 2 }}>{subtitle}</p>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h1>
      {description ? <p style={{ marginTop: 0, marginBottom: 16, color: 'var(--muted)' }}>{description}</p> : null}
      {children}
    </section>
  );
}
