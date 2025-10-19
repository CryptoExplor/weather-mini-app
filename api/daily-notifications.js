import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Only run if cron
  if (req.method !== 'GET' || req.headers['x-vercel-cron'] !== 'true') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all FIDs with notifications and locations
    const fids = await kv.keys('notification:*');
    const notifications = await Promise.all(
      fids.map(async (key) => {
        const fid = key.split(':')[1];
        const notif = await kv.get(key);
        const loc = await kv.get(`location:${fid}`);
        return { fid, ...notif, ...loc };
      })
    );

    for (const user of notifications.filter(u => u.token && u.lat && u.lon)) {
      // Fetch weather
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${user.lat}&longitude=${user.lon}&current=temperature_2m,weather_code&timezone=auto`);
      const weather = await weatherRes.json();
      const cur = weather.current;
      const code = cur.weather_code;
      const info = WMO[code] || {t:"Clear", e:"☀️"}; // Assume WMO defined

      const temp = Math.round(cur.temperature_2m);
      const title = `🌤️ ${info.e} ${temp}°C in ${user.label}`;
      const body = `${info.t}. Good morning! Check your weather.`;

      const notificationId = `morning-${user.fid}-${Date.now()}`;

      // Send notification
      const sendRes = await fetch(user.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId,
          title,
          body,
          targetUrl: 'https://weather-base-app.vercel.app/',
          tokens: [user.token]
        })
      });

      const sendData = await sendRes.json();
      // Handle successfulTokens, invalidTokens, etc.
      if (sendData.invalidTokens?.includes(user.token)) {
        await kv.del(`notification:${user.fid}`);
      }

      console.log(`Sent morning notification to FID ${user.fid}`);
    }

    res.status(200).json({ success: true, sent: notifications.length });
  } catch (error) {
    console.error('Daily notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// vercel.json addition: {"crons": [{"path": "/api/daily-notifications", "schedule": "0 7 * * *"}]}
