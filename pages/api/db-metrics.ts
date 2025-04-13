import type { NextApiRequest, NextApiResponse } from 'next';
import { checkDatabaseHealth } from '../../lib/db';
import { withAuth } from '../../lib/authMiddleware';

// Store metrics history
const metricsHistory: Array<{
  timestamp: number;
  latency: number;
  healthy: boolean;
}> = [];

// Collect metrics every 30 seconds
setInterval(async () => {
  const health = await checkDatabaseHealth();
  if (metricsHistory.length > 100) metricsHistory.shift();
  
  metricsHistory.push({
    timestamp: Date.now(),
    latency: health.latency,
    healthy: health.healthy
  });
}, 30000);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withAuth(req, res, async (req, res) => {
    const currentHealth = await checkDatabaseHealth();
    
    res.status(200).json({
      current: currentHealth,
      history: metricsHistory,
      averageLatency: metricsHistory.length > 0 
        ? metricsHistory.reduce((sum, item) => sum + item.latency, 0) / metricsHistory.length 
        : 0
    });
  });
} 