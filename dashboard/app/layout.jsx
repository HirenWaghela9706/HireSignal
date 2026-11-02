import './globals.css';
import { Inter, DM_Sans, Bebas_Neue, Chivo } from 'next/font/google';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });
const dmSans = DM_Sans({ subsets: ['latin'] });
const bebas = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-bebas' });
const chivo = Chivo({ subsets: ['latin'], variable: '--font-chivo' });

export const metadata = {
  title: 'HireSignal — Hiring Intent Intelligence',
  description: 'Hiring intent intelligence for job seekers',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.className} ${dmSans.className} ${bebas.variable} ${chivo.variable}`}>
      <body className="bg-bg-primary text-text-primary min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
