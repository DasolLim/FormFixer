import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { PageContainer } from '@/components/layout/PageContainer';

export const metadata: Metadata = {
  title: 'FormFixer',
  description: 'Real-time exercise form support with camera-based posture analysis.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <PageContainer>{children}</PageContainer>
      </body>
    </html>
  );
}
