import './globals.css';
import { TweakLocalOverlay } from '@tweaklocal/react';

export const metadata = {
  title: 'Northwind — Next.js demo',
  description: 'tweaklocal Next.js demo app',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
        <TweakLocalOverlay />
      </body>
    </html>
  );
}
