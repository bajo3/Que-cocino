import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'WhatsApp Memory Assistant',
  description: 'Panel privado',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
