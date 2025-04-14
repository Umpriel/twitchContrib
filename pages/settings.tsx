import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

interface Settings {
  welcomeMessage: string;
  showRejected: boolean;
  useHuhMode: boolean;
}

export default function Settings() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChannelOwner, setIsChannelOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    welcomeMessage: 'Bot connected and authenticated successfully!',
    showRejected: true,
    useHuhMode: false
  });

  // Check if user is authenticated and channel owner
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        
        setIsAuthenticated(data.authenticated);
        setIsChannelOwner(data.isChannelOwner);
        
        if (!data.authenticated) {
          router.push('/auth-twitch');
          return;
        }
        
        if (!data.isChannelOwner) {
          router.push('/');
          return;
        }
        
        // Load settings
        fetchSettings();
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setMessage('');
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        setMessage('Settings saved successfully!');
        setSaveSuccess(true);
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.error || 'Failed to save settings'}`);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage('Error: Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100">
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isChannelOwner) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Head>
        <title>Bot Settings</title>
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Bot Settings</h1>
        
        {message && (
          <div className={`p-4 mb-6 rounded ${saveSuccess ? 'bg-green-700 text-white' : 'bg-red-700 text-white'}`}>
            {message}
          </div>
        )}
        
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Bot Messaging</h2>
          <div className="mb-4">
            <label className="block mb-2">Welcome Message</label>
            <input
              type="text"
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
              value={settings.welcomeMessage}
              onChange={(e) => setSettings({...settings, welcomeMessage: e.target.value})}
            />
            <p className="text-gray-400 text-sm mt-1">
              Message displayed when the bot connects successfully
            </p>
          </div>
        </div>
        
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Display Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500" 
                  checked={settings.showRejected}
                  onChange={(e) => setSettings({...settings, showRejected: e.target.checked})}
                />
                <span>Show rejected contributions</span>
              </label>
              <p className="text-gray-400 text-sm mt-1 ml-6">
                Display rejected contributions in the dashboard
              </p>
            </div>
            
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500" 
                  checked={settings.useHuhMode}
                  onChange={(e) => setSettings({...settings, useHuhMode: e.target.checked})}
                />
                <span>Use HUH Mode</span>
              </label>
              <p className="text-gray-400 text-sm mt-1 ml-6">
                Use casual, Twitch-style messages instead of professional ones
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
} 