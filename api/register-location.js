import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fid, lat, lon, label } = req.body;

    if (!fid || !lat || !lon) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await kv.set(`location:${fid}`, {
      lat,
      lon,
      label,
      updatedAt: Date.now()
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Register location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
