import type { ReactNode } from 'react';

type CardProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
  variant?: 'default' | 'raised' | 'white' | 'accent';
  className?: string;
  id?: string;
};

export function Card({ title, description, children, variant = 'default', className, id }: CardProps) {
  const variantClass =
    variant === 'raised' ? 'card card-raised' :
    variant === 'white'  ? 'card card-white'  :
    variant === 'accent' ? 'card card-accent' :
    'card';
  const classes = [variantClass, className ?? ''].filter(Boolean).join(' ');

  return (
    <article id={id} className={classes}>
      {title ? <h3 className="ui-card-title">{title}</h3> : null}
      {description ? <p className="ui-card-description">{description}</p> : null}
      {children}
    </article>
  );
}
