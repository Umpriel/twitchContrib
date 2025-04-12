import type { NextApiRequest, NextApiResponse } from 'next';
import { chatClient } from '../../lib/twitchAuth';

let isInitialized = false;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isInitialized) {
    try {
      await chatClient.connect();
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