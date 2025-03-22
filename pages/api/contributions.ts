import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../lib/db';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const contributions = db.prepare('SELECT * FROM contributions ORDER BY created_at DESC').all();
    return res.status(200).json(contributions);
  }

  if (req.method === 'PUT') {
    const { id, status } = req.body;
    const stmt = db.prepare('UPDATE contributions SET status = ? WHERE id = ?');
    stmt.run(status, id);
    return res.status(200).json({ message: 'Status updated successfully' });
  }

  res.status(405).json({ message: 'Method not allowed' });
} 