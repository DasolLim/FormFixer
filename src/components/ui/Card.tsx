import type { ReactNode } from 'react';

type CardProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
};

export function Card({ title, description, children }: CardProps) {
  return (
    <article className="ui-card">
      {title ? <h3 className="ui-card-title">{title}</h3> : null}
      {description ? <p className="ui-card-description">{description}</p> : null}
      {children}
    </article>
  );
}
