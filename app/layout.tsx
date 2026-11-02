import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anuradhapura HeritageVerse',
  description: 'Explore the past. Experience history.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Browser extensions can inject attributes on body before React hydrates.
          Suppression applies only to this element, not its descendants. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
