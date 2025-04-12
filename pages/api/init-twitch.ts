import type { NextApiRequest, NextApiResponse } from 'next';
import { getChatClient } from '../../lib/twitchAuth';

let isInitialized = false;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isInitialized) {
    try {
      const chatClient = await getChatClient();
      if (chatClient.readyState() !== 'OPEN') {
        await chatClient.connect();
      }
      isInitialized = true;
      res.status(200).json({ message: 'Twitch chat connected' });
    } catch (error) {
      console.error('Failed to connect to Twitch:', error);
      res.status(500).json({ error: 'Failed to connect to Twitch' });
    }
  } else {
    res.status(200).json({ message: 'Already connected' });
  }
} 