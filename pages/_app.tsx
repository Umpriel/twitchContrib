import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { createContext, useState, useEffect } from 'react';
import '../pages/api/_startup'; // Force initialization on server start
import Link from 'next/link';

export const SocketContext = createContext(null);

export default function App({ Component, pageProps }: AppProps) {
  const [isChannelOwner, setIsChannelOwner] = useState(false);
  
  useEffect(() => {
    // Check if user is channel owner
    fetch('/api/check-auth')
      .then(response => response.json())
      .then(data => {
        setIsChannelOwner(!!data.isChannelOwner);
      })
      .catch(error => {
        console.error('Error checking auth:', error);
      });
  }, []);

  return (
    <>
      <Component {...pageProps} />
      <Analytics />
      <SpeedInsights />
      {isChannelOwner && (
        <Link href="/settings" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded">
          Settings
        </Link>
      )}
    </>
  );
} 