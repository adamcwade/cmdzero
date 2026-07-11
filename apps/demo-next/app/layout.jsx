import './globals.css';
import { FastUIOverlay } from '@fastui/react';

export const metadata = {
  title: 'Northwind — Next.js demo',
  description: 'fastui Next.js demo app',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
        <FastUIOverlay />
      </body>
    </html>
  );
}
