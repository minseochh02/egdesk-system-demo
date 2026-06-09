import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EGDesk Demo',
  description: 'Demo app showing EGDesk database integration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
