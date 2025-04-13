import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { useEffect } from 'react';
import io from 'socket.io-client';
import { createContext } from 'react';

export const SocketContext = createContext(null);

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {

    fetch('/api/socket').catch(console.error);
    
    const socket = io();
    
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <>
      <Component {...pageProps} />
      <Analytics />
      <SpeedInsights />
    </>
  );
} 