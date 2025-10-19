import { kv } from '@vercel/kv';

// Full WMO object (embedded for server-side use)
const WMO = {
  0:{t:"Clear sky",e:"☀️",bg:"sunny"}, 1:{t:"Mainly clear",e:"🌤️",bg:"sunny"}, 2:{t:"Partly cloudy",e:"⛅",bg:"cloudy"}, 3:{t:"Overcast",e:"☁️",bg:"cloudy"},
  45:{t:"Fog",e:"🌫️",bg:"cloudy"}, 48:{t:"Depositing rime fog",e:"🌫️",bg:"cloudy"},
  51:{t:"Light drizzle",e:"🌦️",bg:"rainy"}, 53:{t:"Moderate drizzle",e:"🌦️",bg:"rainy"}, 55:{t:"Dense drizzle",e:"🌧️",bg:"rainy"},
  56:{t:"Freezing drizzle: light",e:"🌧️",bg:"rainy"}, 57:{t:"Freezing drizzle: dense",e:"🌧️",bg:"rainy"},
  61:{t:"Slight rain",e:"🌧️",bg:"rainy"}, 63:{t:"Moderate rain",e:"🌧️",bg:"rainy"}, 65:{t:"Heavy rain",e:"🌧️",bg:"rainy"},
  66:{t:"Freezing rain: light",e:"🌧️",bg:"rainy"}, 67:{t:"Freezing rain: heavy",e:"🌧️",bg:"rainy"},
  71:{t:"Slight snow",e:"🌨️",bg:"cloudy"}, 73:{t:"Moderate snow",e:"❄️",bg:"cloudy"}, 75:{t:"Heavy snow",e:"❄️",bg:"cloudy"}, 77:{t:"Snow grains",e:"🌨️",bg:"cloudy"},
  80:{t:"Rain showers: slight",e:"🌧️",bg:"rainy"}, 81:{t:"Rain showers: moderate",e:"🌧️",bg:"rainy"}, 82:{t:"Rain showers: violent",e:"🌧️",bg:"rainy"},
  85:{t:"Snow showers: slight",e:"🌨️",bg:"cloudy"}, 86:{t:"Snow showers: heavy",e:"❄️",bg:"cloudy"},
  95:{t:"Thunderstorm",e:"⛈️",bg:"rainy"}, 96:{t:"Thunderstorm with slight hail",e:"⛈️",bg:"rainy"}, 99:{t:"Thunderstorm with heavy hail",e:"⛈️",bg:"rainy"}
};

export default async function handler(req, res) {
  // Only run if cron (via x-vercel-cron header)
  if (req.method !== 'GET' || req.headers['x-vercel-cron'] !== 'true') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get queued items (process up to 100 per run to avoid timeouts)
    const queued = await kv.lrange('morning_queue', 0, 99);
    if (queued.length === 0) {
      return res.status(200).json({ success: true, processed: 0 });
    }

    let processed = 0;
    for (const itemStr of queued) {
      const item = JSON.parse(itemStr);
      const { fid, lat, lon, label } = item;

      if (!lat || !lon) {
        // Skip if no location
        continue;
      }

      // Fetch weather
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
      if (!weatherRes.ok) {
        console.error(`Weather fetch failed for FID ${fid}`);
        continue;
      }
      const weather = await weatherRes.json();
      const cur = weather.current;
      const code = cur.weather_code;
      const info = WMO[code] || {t:"Clear", e:"☀️"};

      const temp = Math.round(cur.temperature_2m);
      const title = `🌤️ ${info.e} ${temp}°C in ${label}`;
      const body = `${info.t}. Good morning! Check your weather.`;

      const notificationId = `morning-${fid}-${Date.now()}`;

      // Get user notification details
      const notif = await kv.get(`notification:${fid}`);
      if (!notif || !notif.token || !notif.url) {
        // Skip if no token
        continue;
      }

      // Send to Farcaster notifications endpoint
      const sendRes = await fetch(notif.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId,
          title,
          body,
          targetUrl: 'https://weather-base-app.vercel.app/',
          tokens: [notif.token]
        })
      });

      if (!sendRes.ok) {
        console.error(`Notification send failed for FID ${fid}: ${sendRes.status}`);
        continue;
      }

      const sendData = await sendRes.json();
      // Handle responses (e.g., invalid tokens)
      if (sendData.invalidTokens?.includes(notif.token)) {
        await kv.del(`notification:${fid}`);
      }

      processed++;
      console.log(`Sent morning notification to FID ${fid}`);

      // Remove from queue (simplified; use BRPOPLPUSH for production atomic queue)
    }

    // Clear processed items (trim list to 0)
    await kv.ltrim('morning_queue', queued.length, -1);

    res.status(200).json({ success: true, processed });
  } catch (error) {
    console.error('Daily notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
