import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { createContext } from 'react';
import '../pages/api/_startup'; // Force initialization on server start

export const SocketContext = createContext(null);

export default function App({ Component, pageProps }: AppProps) {

  return (
    <>
      <Component {...pageProps} />
      <Analytics />
      <SpeedInsights />
    </>
  );
} 