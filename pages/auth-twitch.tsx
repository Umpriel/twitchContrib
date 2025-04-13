import { useEffect, useState } from 'react';

export default function AuthTwitch() {
  const [authUrl, setAuthUrl] = useState('');
  
  useEffect(() => {

    const scopes = (process.env.TWITCH_SCOPES || 'chat:read chat:edit').split(' ');
    const clientId = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!;
    const redirectUri = process.env.NEXT_PUBLIC_TWITCH_REDIRECT_URI!;
    

    const url = new URL('https://id.twitch.tv/oauth2/authorize');
    url.searchParams.append('client_id', clientId);
    url.searchParams.append('redirect_uri', redirectUri);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('scope', scopes.join(' '));
    
    setAuthUrl(url.toString());
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-8 text-purple-400">TwitchContrib Authentication</h1>
      <p className="mb-8 text-lg">
        Click the button below to authorize the TwitchContrib app with your Twitch account.
      </p>
      
      <a 
        href={authUrl}
        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md transition-colors text-lg"
        target="_blank"
        rel="noopener noreferrer"
      >
        Authorize with Twitch
      </a>
    </div>
  );
} 