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
        <Link 
        href="/settings" 
        className="fixed bottom-4 right-4 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors z-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
        Settings
      </Link>
      )}
    </>
  );
} 