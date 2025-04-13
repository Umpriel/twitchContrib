import { useState, useEffect } from 'react';

export default function DbMonitor() {
  const [metrics, setMetrics] = useState<{
    current: {healthy: boolean, latency: number},
    history: Array<{timestamp: number, latency: number, healthy: boolean}>,
    averageLatency: number
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  
  const monitoringEnabled = process.env.NEXT_PUBLIC_ENABLE_DB_MONITORING === 'true';
  
  const fetchMetrics = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/db-metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch database metrics');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 30000);
      return () => clearInterval(interval);
    }
  }, [expanded]);

  if (!monitoringEnabled) {
    return null;
  }

  if (!expanded) {
    return (
      <div className="fixed bottom-4 right-4">
        <button 
          onClick={() => setExpanded(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-full shadow-lg"
        >
          DB Status
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg w-80 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Database Health</h3>
        <button 
          onClick={() => setExpanded(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          Close
        </button>
      </div>
      
      {isLoading && <p>Loading metrics...</p>}
      {error && <p className="text-red-500">{error}</p>}
      
      {metrics && (
        <div>
          <div className="flex items-center mb-2">
            <span className={`h-3 w-3 rounded-full mr-2 ${metrics.current.healthy ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>Status: {metrics.current.healthy ? 'Healthy' : 'Unhealthy'}</span>
          </div>
          
          <div className="mb-2">
            <span>Current Latency: {metrics.current.latency}ms</span>
          </div>
          
          <div className="mb-2">
            <span>Avg Latency: {metrics.averageLatency.toFixed(2)}ms</span>
          </div>
          
          <button 
            onClick={fetchMetrics} 
            className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
} 