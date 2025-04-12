import { useState } from 'react';
import { useRouter } from 'next/router';

interface UserProfileProps {
  username: string;
  isChannelOwner: boolean;
}

export default function UserProfile({ username, isChannelOwner }: UserProfileProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST'
      });
      
      if (response.ok) {
        router.reload();
      } else {
        console.error('Logout failed');
        setIsLoggingOut(false);
      }
    } catch (error) {
      console.error('Error during logout:', error);
      setIsLoggingOut(false);
    }
  };
  
  return (
    <div className="flex items-center space-x-4 p-3 bg-gray-800 rounded-lg shadow-md">
      <div className="w-10 h-10 flex items-center justify-center bg-purple-600 rounded-full">
        {/* Todo: Add profile picture */}
        {username.charAt(0).toUpperCase()}
      </div>
      
      <div className="flex-1">
        <p className="font-medium">{username}</p>
        <p className="text-xs text-gray-400">
          {isChannelOwner ? 'Streamer • Admin' : 'Viewer'}
        </p>
      </div>
      
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
      >
        {isLoggingOut ? 'Logging out...' : 'Logout'}
      </button>
    </div>
  );
} 