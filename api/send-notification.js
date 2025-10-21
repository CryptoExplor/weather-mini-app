const { kv } = require('@vercel/kv');
let NeynarClient = null;
let neynarError = null;

try {
  const { NeynarAPIClient } = require('@neynar/nodejs-sdk');
  if (!process.env.NEYNAR_API_KEY) {
    throw new Error('NEYNAR_API_KEY env var missing');
  }
  NeynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY);
  console.log('Neynar client initialized');
} catch (err) {
  neynarError = err.message;
  console.error('Neynar init failed:', err.message);
}

// Embedded WMO for weather icons/descriptions
const WMO = {
  0: { t: "Clear sky", e: "☀️" }, 1: { t: "Mainly clear", e: "🌤️" }, 2: { t: "Partly cloudy", e: "⛅" }, 3: { t: "Overcast", e: "☁️" },
  45: { t: "Fog", e: "🌫️" }, 48: { t: "Depositing rime fog", e: "🌫️" },
  51: { t: "Light drizzle", e: "🌦️" }, 53: { t: "Moderate drizzle", e: "🌦️" }, 55: { t: "Dense drizzle", e: "🌧️" },
  56: { t: "Freezing drizzle: light", e: "🌧️" }, 57: { t: "Freezing drizzle: dense", e: "🌧️" },
  61: { t: "Slight rain", e: "🌧️" }, 63: { t: "Moderate rain", e: "🌧️" }, 65: { t: "Heavy rain", e: "🌧️" },
  66: { t: "Freezing rain: light", e: "🌧️" }, 67: { t: "Freezing rain: heavy", e: "🌧️" },
  71: { t: "Slight snow", e: "🌨️" }, 73: { t: "Moderate snow", e: "❄️" }, 75: { t: "Heavy snow", e: "❄️" }, 77: { t: "Snow grains", e: "🌨️" },
  80: { t: "Rain showers: slight", e: "🌧️" }, 81: { t: "Rain showers: moderate", e: "🌧️" }, 82: { t: "Rain showers: violent", e: "🌧️" },
  85: { t: "Snow showers: slight", e: "🌨️" }, 86: { t: "Snow showers: heavy", e: "❄️" },
  95: { t: "Thunderstorm", e: "⛈️" }, 96: { t: "Thunderstorm with slight hail", e: "⛈️" }, 99: { t: "Thunderstorm with heavy hail", e: "⛈️" }
};

module.exports = async (req, res) => {
  // Accept POST (manual) or GET (cron via x-vercel-cron header)
  if (req.method !== 'POST' && (req.method !== 'GET' || req.headers['x-vercel-cron'] !== 'true')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Send notification invoked');

  if (neynarError) {
    return res.status(500).json({ success: false, error: `Neynar setup failed: ${neynarError}` });
  }

  try {
    // Query all user locations from KV (scan keys matching pattern)
    const locations = [];
    let cursor = '0';  // Start with '0' as string (Redis convention)
    do {
      console.log(`Scanning KV with cursor: ${cursor}`);
      const [newCursor, keys] = await kv.scan(cursor, { match: 'location:*', count: 100 });
      console.log(`Found ${keys.length} keys`);
      for (const key of keys) {
        const fid = key.split(':')[1];
        const loc = await kv.get(key);
        if (loc && loc.lat && loc.lon) {
          locations.push({ fid: parseInt(fid), ...loc });
        }
      }
      cursor = newCursor;
    } while (cursor !== '0');

    console.log(`Total locations found: ${locations.length}`);

    if (locations.length === 0) {
      return res.status(200).json({ success: true, message: 'No users with locations to notify' });
    }

    // Group by approximate location (exact lat/lon match for simplicity; enhance with distance calc if needed)
    const groups = new Map();
    for (const loc of locations) {
      const key = `${loc.lat.toFixed(2)}-${loc.lon.toFixed(2)}`;  // Round to 0.01° (~1km grid)
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(loc.fid);
    }

    console.log(`Groups created: ${groups.size}`);

    const results = [];
    for (const [groupKey, fids] of groups) {
      // Batch FIDs into chunks ≤100
      for (let i = 0; i < fids.length; i += 100) {
        const batchFids = fids.slice(i, i + 100);
        if (batchFids.length === 0) continue;

        // Get representative location (first in batch)
        const sampleLoc = locations.find(l => l.fid === batchFids[0]);
        const { lat, lon, label } = sampleLoc;

        // Fetch weather for this location
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) {
          console.error(`Weather fetch failed for group ${groupKey}: ${weatherRes.status}`);
          results.push({ success: false, error: 'Weather fetch failed', batchSize: batchFids.length });
          continue;
        }
        const weather = await weatherRes.json();
        const cur = weather.current;
        const code = cur.weather_code;
        const info = WMO[code] || { t: "Clear", e: "☀️" };
        const temp = Math.round(cur.temperature_2m);

        // Craft personalized notification
        const title = `${info.e} ${temp}°C Morning Alert!`;
        const body = `${info.t} in ${label}. Good morning—tap for your full forecast! 🌤️`;
        const targetUrl = `https://weather-base-app.vercel.app/?context=notification&label=${encodeURIComponent(label)}`;

        console.log(`Sending to batch ${groupKey} (FIDs: ${batchFids.length})`);

        // Send via Neynar (with try-catch)
        let response;
        try {
          response = await NeynarClient.publishFrameNotifications({
            targetFids: batchFids,  // Only these FIDs (Neynar sends if enabled)
            filters: { minimum_user_score: 0.5 },  // Optional: High-engagement only
            notification: {
              title,
              body,
              target_url: targetUrl
            }
          });
        } catch (sendErr) {
          console.error(`Neynar send failed for ${groupKey}:`, sendErr.message);
          results.push({ success: false, error: sendErr.message, batchSize: batchFids.length });
          continue;
        }

        console.log(`Neynar response for batch ${groupKey}:`, response);
        results.push({ success: true, batchSize: batchFids.length, requestId: response.request_id });

        // Delay to respect rate limits (1s per batch)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    res.status(200).json({ success: true, groupsProcessed: groups.size, totalBatches: results.length, details: results });
  } catch (error) {
    console.error('Overall send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
