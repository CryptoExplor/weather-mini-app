import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    // TODO: Verify JSON Farcaster Signature (header, payload, signature) - use @farcaster/core for verification
    const payload = JSON.parse(atob(body.payload)); // Assuming base64 payload from Farcaster webhook

    const { event, notificationDetails, fid } = payload; // fid from signature header or payload

    switch (event) {
      case 'miniapp_added':
      case 'notifications_enabled':
        if (notificationDetails) {
          await kv.set(`notification:${fid}`, {
            token: notificationDetails.token,
            url: notificationDetails.url, // Farcaster notification endpoint
            updatedAt: Date.now()
          });
          console.log(`Stored notification token for FID ${fid}`);
        }
        break;
      case 'miniapp_removed':
      case 'notifications_disabled':
        await kv.del(`notification:${fid}`);
        console.log(`Removed notification token for FID ${fid}`);
        break;
      default:
        console.log('Unknown event:', event);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
