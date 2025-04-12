import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';  // Dark theme
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import { ArrowPathIcon, ClipboardIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import db from '../lib/db';
import UserProfile from '../components/UserProfile';

interface Contribution {
  id: number;
  username: string;
  filename: string;
  line_number: number | null;
  code: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export const getServerSideProps: GetServerSideProps = async () => {
  const contributions = await db.getContributions();
  return {
    props: {
      initialContributions: contributions
    }
  };
};

export default function Home({ initialContributions }: { initialContributions: Contribution[] }) {
  const [contributions, setContributions] = useState<Contribution[]>(initialContributions);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isPollingEnabled, setIsPollingEnabled] = useState(true);
  const [dataUpdated, setDataUpdated] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChannelOwner, setIsChannelOwner] = useState(false);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [userInfo, setUserInfo] = useState<{username: string} | null>(null);

  useEffect(() => {
    // Check auth status
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        
        setIsAuthenticated(data.authenticated);
        setIsChannelOwner(data.isChannelOwner);
        
        if (data.authenticated) {
          // Get user info when authenticated
          const userResponse = await fetch('/api/user');
          const userData = await userResponse.json();
          setUserInfo(userData);
          
          // Initialize Twitch
          fetch('/api/init-twitch').catch(console.error);
        }
        
        setAuthCheckComplete(true);
      } catch (error) {
        console.error('Failed to check auth status:', error);
        setAuthCheckComplete(true);
      }
    };
    
    checkAuth();
    
    // Highlight all code blocks after a slight delay to ensure DOM is updated
    const highlightTimer = setTimeout(() => {
      Prism.highlightAll();
    }, 100);
    
    return () => clearTimeout(highlightTimer);
  }, []);

  useEffect(() => {
    // Set up polling for new contributions
    const pollInterval = setInterval(() => {
      if (isPollingEnabled) {
        refreshContributions();
      }
    }, 10000); // Poll every 10 seconds
    
    return () => clearInterval(pollInterval); // Clean up on unmount
  }, [isPollingEnabled]); // Re-establish interval if polling state changes

  // Helper function to determine language from filename
  const getLanguage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': return 'typescript';
      case 'tsx': return 'tsx';
      case 'js': return 'javascript';
      case 'jsx': return 'jsx';
      case 'css': return 'css';
      case 'json': return 'json';
      default: return 'typescript';
    }
  };

  const updateStatus = async (id: number, status: 'accepted' | 'rejected') => {
    await fetch('/api/contributions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });

    setContributions(contributions.map(contrib =>
      contrib.id === id ? { ...contrib, status } : contrib
    ));
  };

  const refreshContributions = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/contributions');
      const data = await response.json();
      
      // Compare new data with current state to detect changes
      const hasNewItems = data.some((newItem: Contribution) => 
        !contributions.some(existingItem => existingItem.id === newItem.id)
      );
      
      // Or check if any status has changed
      const hasStatusChanges = data.some((newItem: Contribution) => {
        const existingItem = contributions.find(item => item.id === newItem.id);
        return existingItem && existingItem.status !== newItem.status;
      });
      
      // Update state and set the dataUpdated flag if there are changes
      if (hasNewItems || hasStatusChanges) {
        setContributions(data);
        setDataUpdated(true);
        
        // Clear the flag after a moment to allow animation to reset
        setTimeout(() => setDataUpdated(false), 2000);
      } else {
        // Still update the data even if no visible changes
        setContributions(data);
      }
    } catch (error) {
      console.error('Failed to refresh contributions:', error);
    } finally {
      setIsPolling(false);
    }
  };

  const copyToClipboard = async (id: number, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const sendToVSCodeWithPath = async (id: number) => {
    try {
      // Ask for path (optional)
      const filePath = prompt(
        "Enter path where file should be created (optional):\n" +
        "Leave blank to select in VSCode, or enter a path on your system.",
        ""
      );
      
      await fetch('/api/send-to-vscode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, filePath })
      });
      
      // Show success message
      alert('Contribution sent to VSCode!');
    } catch (error) {
      console.error('Failed to send to VSCode:', error);
      alert('Failed to send to VSCode. Make sure the VSCode extension is installed and running.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {!authCheckComplete ? (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : !isAuthenticated ? (
        <div className="flex flex-col items-center justify-center h-screen">
          <h1 className="text-4xl font-bold mb-8 text-purple-400">TwitchContrib</h1>
          <p className="mb-8 text-lg text-center">
            Please log in with your Twitch account to access TwitchContrib.
          </p>
          <a 
            href="/auth-twitch"
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md transition-colors text-lg"
          >
            Login with Twitch
          </a>
        </div>
      ) : (
        <div className="max-w-[90%] mx-auto p-6">
          <h1 className="text-4xl font-bold mb-8 text-purple-400">TwitchContrib</h1>
          
          <div className="absolute top-4 right-4">
            <UserProfile 
              username={userInfo?.username || 'User'} 
              isChannelOwner={isChannelOwner} 
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="w-full">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-blue-400">Pending Contributions</h2>
                  {dataUpdated && (
                    <span className="animate-pulse px-2 py-1 bg-green-500 text-white text-xs rounded-md">
                      New updates!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={refreshContributions}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
                    disabled={isPolling}
                  >
                    <ArrowPathIcon className={`w-5 h-5 ${isPolling ? 'animate-spin' : ''}`} />
                    <span>{isPolling ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm text-gray-400">Auto-refresh:</span>
                    <button 
                      onClick={() => setIsPollingEnabled(!isPollingEnabled)}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        isPollingEnabled 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-gray-600 hover:bg-gray-700'
                      }`}
                    >
                      {isPollingEnabled ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                {contributions.filter(c => c.status === 'pending').map(contribution => (
                  <div key={contribution.id} className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700 hover:border-purple-500 transition-all">
                    <div className="flex items-center mb-4">
                      <span className="text-purple-400 font-semibold">{contribution.username}</span>
                      <span className="mx-2 text-gray-500">•</span>
                      <span className="text-gray-400">{new Date(contribution.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mb-4 p-4 bg-gray-950 rounded-lg border border-gray-700">
                      <p className="text-gray-300 mb-2">
                        <span className="text-blue-400 font-semibold">File: </span>
                        <code className="text-yellow-400">{contribution.filename}</code>
                      </p>
                      {contribution.line_number && (
                        <p className="text-gray-300 mb-2">
                          <span className="text-blue-400 font-semibold">Line: </span>
                          <code className="text-yellow-400">{contribution.line_number}</code>
                        </p>
                      )}
                    </div>
                    <div className="relative">
                      <pre className="font-mono text-sm bg-[#1e1e1e] p-4 rounded-lg border border-gray-700 whitespace-pre overflow-x-auto">
                        <code className={`language-${getLanguage(contribution.filename)}`}>
                          {contribution.code}
                        </code>
                      </pre>
                      <button
                        onClick={() => copyToClipboard(contribution.id, contribution.code)}
                        className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                        title="Copy code"
                      >
                        {copiedId === contribution.id ? (
                          <ClipboardDocumentCheckIcon className="w-5 h-5 text-green-400" />
                        ) : (
                          <ClipboardIcon className="w-5 h-5 text-gray-300" />
                        )}
                      </button>
                    </div>
                    {isChannelOwner && (
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={() => updateStatus(contribution.id, 'accepted')}
                          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => updateStatus(contribution.id, 'rejected')}
                          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full">
              <h2 className="text-2xl font-bold mb-6 text-blue-400">History</h2>
              <div className="space-y-6">
                {contributions.filter(c => c.status !== 'pending').map(contribution => (
                  <div key={contribution.id} className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
                    <div className="flex items-center mb-4">
                      <span className="text-purple-400 font-semibold">{contribution.username}</span>
                      <span className="mx-2 text-gray-500">•</span>
                      <span className="text-gray-400">{new Date(contribution.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mb-4 p-4 bg-gray-950 rounded-lg border border-gray-700">
                      <p className="text-gray-300 mb-2">
                        <span className="text-blue-400 font-semibold">File: </span>
                        <code className="text-yellow-400">{contribution.filename}</code>
                      </p>
                      {contribution.line_number && (
                        <p className="text-gray-300 mb-2">
                          <span className="text-blue-400 font-semibold">Line: </span>
                          <code className="text-yellow-400">{contribution.line_number}</code>
                        </p>
                      )}
                    </div>
                    <div className="relative">
                      <pre className="font-mono text-sm bg-[#1e1e1e] p-4 rounded-lg border border-gray-700 whitespace-pre overflow-x-auto">
                        <code className={`language-${getLanguage(contribution.filename)}`}>
                          {contribution.code}
                        </code>
                      </pre>
                      <button
                        onClick={() => copyToClipboard(contribution.id, contribution.code)}
                        className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                        title="Copy code"
                      >
                        {copiedId === contribution.id ? (
                          <ClipboardDocumentCheckIcon className="w-5 h-5 text-green-400" />
                        ) : (
                          <ClipboardIcon className="w-5 h-5 text-gray-300" />
                        )}
                      </button>
                    </div>
                    <p className={`mt-4 font-semibold ${
                      contribution.status === 'accepted' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      Status: {contribution.status.charAt(0).toUpperCase() + contribution.status.slice(1)}
                    </p>
                    {contribution.status === 'accepted' && (
                      <button
                        onClick={() => sendToVSCodeWithPath(contribution.id)}
                        className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l-4-4m4 4l4-4" />
                        </svg>
                        <span>Send to VSCode</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 