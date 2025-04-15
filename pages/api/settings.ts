import type { NextApiRequest, NextApiResponse } from 'next';
import { withChannelOwnerAuth } from '../../lib/authMiddleware';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return withChannelOwnerAuth(req, res, async () => {
      try {
        const settings = await db.getSettings();
        res.status(200).json(settings || {
          welcomeMessage: 'Bot connected and authenticated successfully!',
          showRejected: true,
          useHuhMode: false
        });
      } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
      }
    });
  } else if (req.method === 'POST') {
    return withChannelOwnerAuth(req, res, async () => {
      try {
        const success = await db.updateSettings(req.body);
        if (success) {
          res.status(200).json({ success: true });
        } else {
          res.status(500).json({ error: 'Failed to update settings' });
        }
      } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
      }
    });
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 