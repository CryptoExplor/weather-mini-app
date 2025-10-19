import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fid, lat, lon, label } = req.body;

    if (!fid) {
      return res.status(400).json({ error: 'Missing FID' });
    }

    // Queue for cron processing (LPUSH for FIFO)
    await kv.lpush('morning_queue', JSON.stringify({ 
      fid, 
      lat: lat || null, 
      lon: lon || null, 
      label: label || 'Your location',
      queuedAt: Date.now() 
    }));

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Queue morning error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
