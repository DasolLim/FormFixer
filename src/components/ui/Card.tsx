import type { ReactNode } from 'react';

type CardProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
  variant?: 'default' | 'white' | 'accent';
  className?: string;
};

export function Card({ title, description, children, variant = 'default', className }: CardProps) {
  const variantClass = variant === 'white' ? 'card card-white' : variant === 'accent' ? 'card card-accent' : 'card';
  const classes = [variantClass, className ?? ''].filter(Boolean).join(' ');

  return (
    <article className={classes}>
      {title ? <h3 className="ui-card-title">{title}</h3> : null}
      {description ? <p className="ui-card-description">{description}</p> : null}
      {children}
    </article>
  );
}
