import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const contributions = await db.getContributions();
      return res.status(200).json(contributions);
    } catch (error) {
      console.error('Error fetching contributions:', error);
      return res.status(500).json({ error: 'Failed to fetch contributions' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, status } = req.body;
      await db.updateStatus(id, status);
      return res.status(200).json({ message: 'Status updated successfully' });
    } catch (error) {
      console.error('Error updating status:', error);
      return res.status(500).json({ error: 'Failed to update status' });
    }
  }

  res.status(405).json({ message: 'Method not allowed' });
} 