import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chess Dungeon',
  description: 'High-stakes Kakegurui-themed chess battles with procedural lightning, animated avatars, and custom match progression.',
  openGraph: {
    title: 'Chess Dungeon',
    description: 'High-stakes Kakegurui-themed chess battles with procedural lightning, animated avatars, and custom match progression.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chess Dungeon',
    description: 'High-stakes Kakegurui-themed chess battles with procedural lightning, animated avatars, and custom match progression.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="font-['Nunito',sans-serif]">
        {children}
      </body>
    </html>
  );
}
