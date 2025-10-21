const { getAllTokens } = require('./storage'); // Or filter by user/location if needed

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tokensData = getAllTokens();
    if (!tokensData.length) {
      return res.status(200).json({ success: true, message: 'No tokens to notify' });
    }

    // Batch up to 100 tokens (docs limit)
    const batches = [];
    for (let i = 0; i < tokensData.length; i += 100) {
      batches.push(tokensData.slice(i, i + 100));
    }

    const results = [];
    for (const batch of batches) {
      const url = batch[0].url; // Assume same URL for all; fallback if varies
      const tokens = batch.map(t => t.token);

      const payload = {
        notificationId: `weather-update-${new Date().toISOString().split('T')[0]}`, // Unique daily ID for dedup
        title: 'Daily Weather Alert!', // <=32 chars
        body: 'Check your local forecast now.', // <=128 chars
        targetUrl: 'https://weather-base-app.vercel.app/?context=notification', // Your app URL + context
        tokens: tokens
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseJson = await response.json();

      if (response.ok) {
        // Handle response: remove invalid tokens
        const { invalidTokens, rateLimitedTokens } = responseJson;
        invalidTokens.forEach(token => {
          // Delete invalid from storage (match by token)
          // For simplicity, clear all if invalid; refine with token->FID map
          console.log(`Invalid token: ${token} - remove from DB`);
        });
        if (rateLimitedTokens.length) {
          console.log(`Rate limited: ${rateLimitedTokens.length} tokens`);
        }
        results.push({ success: true, batchSize: tokens.length });
      } else {
        results.push({ success: false, error: responseJson });
      }

      // Rate limit: 30s per token, but batch helps; add delay if needed
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1s batch delay
    }

    res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
