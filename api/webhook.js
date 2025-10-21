const { parseWebhookEvent, verifyAppKeyWithNeynar } = require('@farcaster/miniapp-node');
const { saveToken, deleteToken } = require('./storage');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify event (throws on invalid)
    const data = await parseWebhookEvent(req.body, verifyAppKeyWithNeynar);
    const { fid, event } = data;

    switch (event) {
      case 'miniapp_added':
      case 'notifications_enabled':
        if (data.notificationDetails) {
          const { url, token } = data.notificationDetails;
          await saveToken(fid, url, token);
          console.log(`Saved token for FID ${fid}`);
        }
        break;
      case 'miniapp_removed':
      case 'notifications_disabled':
        await deleteToken(fid);
        console.log(`Deleted token for FID ${fid}`);
        break;
      default:
        console.log(`Unknown event: ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to ack (Farcaster retries on non-2xx)
    res.status(200).json({ success: false, error: error.message });
  }
}
