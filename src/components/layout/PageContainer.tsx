import type { ReactNode } from 'react';

export function PageContainer({ children }: { children: ReactNode }) {
  return <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 80px' }}>{children}</main>;
}
