import '#/styles/globals.css';

import Byline from '#/ui/byline';
import { GlobalNav } from '#/ui/global-nav';
import { themeScript } from '#/ui/theme-toggle';
import { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: { default: 'Revion evaluation simulations', template: '%s | Revion evaluation simulations' },
  description:
    'Interactive, seeded simulations behind two evaluation answers: a corrected guardrail violation rate and a golden-set recall bias.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`overflow-y-scroll bg-gray-950 font-sans text-gray-200 ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent">
          Skip to content
        </a>
        <div className="fixed top-0 z-10 flex w-full flex-col border-b border-gray-800 bg-black lg:bottom-0 lg:z-auto lg:w-72 lg:border-r lg:border-b-0 lg:border-gray-800">
          <GlobalNav />
        </div>

        <div className="lg:pl-72">
          <main id="main" className="mx-auto mt-20 mb-24 max-w-4xl -space-y-[1px] lg:mt-0 lg:px-8 lg:py-8">
            {children}

            <Byline />
          </main>
        </div>
      </body>
    </html>
  );
}
