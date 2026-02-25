import type { ReactNode } from 'react';

type SectionProps = {
  title: string;
  subtitle?: string;
  description?: string;
  children: ReactNode;
};

export function Section({ title, subtitle, description, children }: SectionProps) {
  return (
    <section className="ui-section">
      {subtitle ? <p className="ui-section-subtitle">{subtitle}</p> : null}
      <h1 className="ui-section-title">{title}</h1>
      {description ? <p className="ui-section-description">{description}</p> : null}
      {children}
    </section>
  );
}
