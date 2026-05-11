import type { PropsWithChildren } from 'react';

export function SectionCard({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {children}
    </section>
  );
}

export function Badge({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <span className={`badge ${className ?? ''}`}>
      {children}
    </span>
  );
}
