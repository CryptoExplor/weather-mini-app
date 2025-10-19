import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fid, lat, lon, label } = req.body;

    // Store in a queue (e.g., list for cron to process)
    await kv.lpush('morning_queue', JSON.stringify({ fid, lat, lon, label }));

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Queue morning error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
