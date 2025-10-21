const { NeynarAPIClient } = require('@neynar/nodejs-sdk');
const client = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Optional: Personalize for weather (e.g., query your location DB by FID)
    // For now, broadcast to all enabled users
    const targetFids = [];  // Empty = all users
    const filters = {  // Example: Near a location for weather
      near_location: {
        latitude: 37.7749,  // e.g., SF coords; pull from user data
        longitude: -122.4194,
        radius: 50000  // 50km
      },
      minimum_user_score: 0.5  // Optional: High-engagement users
    };
    const notification = {
      title: '🌤️ Daily Weather Alert!',  // <=32 chars
      body: 'Sunny with a high of 72°F—perfect for a walk! Tap for details.',  // <=128 chars; dynamic via DB
      target_url: 'https://weather-base-app.vercel.app/?context=notification&location=sf'  // Your app + params
    };

    const response = await client.publishFrameNotifications({
      targetFids,
      filters,
      notification
    });

    console.log('Neynar response:', response);
    // response includes request_id; check portal for delivery

    res.status(200).json({ success: true, requestId: response.request_id });
  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
