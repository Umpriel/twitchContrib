import { Server as ServerIO } from 'socket.io';
import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '../../types/next';

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    console.log('Initializing Socket.IO server...');
    const io = new ServerIO(res.socket.server);
    res.socket.server.io = io;
  }
  
  res.end();
} 