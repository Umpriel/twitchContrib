import type { NextApiRequest } from 'next';
import type { NextApiResponseServerIO } from '../../types/next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIO
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the socket.io server instance
    const io = res.socket.server.io;
    
    if (!io) {
      console.log('Socket.io server not initialized yet');
      return res.status(200).json({ message: 'Notification queued' });
    }

    // Emit the refresh event to all connected clients
    io.emit('refreshContributions');
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending refresh notification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 