export const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
export const GEO_CODE = "https://geocoding-api.open-meteo.com/v1/search";
export const DEFAULT_CITY = { name: "Bangalore", latitude: 12.9716, longitude: 77.5946 };

export const WMO = {
  0: { t: "Clear sky", e: "☀️", bg: "sunny" },
  1: { t: "Mainly clear", e: "🌤️", bg: "sunny" },
  2: { t: "Partly cloudy", e: "⛅", bg: "cloudy" },
  3: { t: "Overcast", e: "☁️", bg: "cloudy" },
  45: { t: "Fog", e: "🌫️", bg: "cloudy" },
  48: { t: "Depositing rime fog", e: "🌫️", bg: "cloudy" },
  51: { t: "Light drizzle", e: "🌦️", bg: "rainy" },
  53: { t: "Moderate drizzle", e: "🌦️", bg: "rainy" },
  55: { t: "Dense drizzle", e: "🌧️", bg: "rainy" },
  56: { t: "Freezing drizzle: light", e: "🌧️", bg: "rainy" },
  57: { t: "Freezing drizzle: dense", e: "🌧️", bg: "rainy" },
  61: { t: "Slight rain", e: "🌧️", bg: "rainy" },
  63: { t: "Moderate rain", e: "🌧️", bg: "rainy" },
  65: { t: "Heavy rain", e: "🌧️", bg: "rainy" },
  66: { t: "Freezing rain: light", e: "🌧️", bg: "rainy" },
  67: { t: "Freezing rain: heavy", e: "🌧️", bg: "rainy" },
  71: { t: "Slight snow", e: "🌨️", bg: "cloudy" },
  73: { t: "Moderate snow", e: "❄️", bg: "cloudy" },
  75: { t: "Heavy snow", e: "❄️", bg: "cloudy" },
  77: { t: "Snow grains", e: "🌨️", bg: "cloudy" },
  80: { t: "Rain showers: slight", e: "🌧️", bg: "rainy" },
  81: { t: "Rain showers: moderate", e: "🌧️", bg: "rainy" },
  82: { t: "Rain showers: violent", e: "🌧️", bg: "rainy" },
  85: { t: "Snow showers: slight", e: "🌨️", bg: "cloudy" },
  86: { t: "Snow showers: heavy", e: "❄️", bg: "cloudy" },
  95: { t: "Thunderstorm", e: "⛈️", bg: "rainy" },
  96: { t: "Thunderstorm with slight hail", e: "⛈️", bg: "rainy" },
  99: { t: "Thunderstorm with heavy hail", e: "⛈️", bg: "rainy" }
};

export async function fetchWeather(lat, lon) {
  const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,is_day&hourly=weather_code,temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Weather fetch failed");
  return res.json();
}

export async function geocodeCity(q) {
  const url = `${GEO_CODE}?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("City lookup failed");
  const data = await res.json();
  if (!data.results || !data.results.length) throw new Error("City not found");
  const r = data.results[0];
  return { name: r.name, latitude: r.latitude, longitude: r.longitude, country: r.country };
}

export async function getIPLocation() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error("IP fetch failed");
    const data = await res.json();
    if (data.error) throw new Error(data.reason);
    if (data.latitude && data.longitude) {
      const label = data.city ? `${data.city}${data.region ? `, ${data.region}` : ''}, ${data.country_name || data.country}`.trim() : "Your approximate location";
      return { lat: parseFloat(data.latitude), lon: parseFloat(data.longitude), label, from: "ip" };
    } else {
      throw new Error("No coords in IP data");
    }
  } catch (err) {
    console.warn("IP lookup failed:", err);
    return { lat: DEFAULT_CITY.latitude, lon: DEFAULT_CITY.longitude, label: DEFAULT_CITY.name, from: "fallback" };
  }
}

export function getGeolocationErrorMessage(code, message) {
  switch (code) {
    case 1:
      return {
        title: "📍 Location Permission Denied",
        message: "You denied location access. Please enable it in your browser settings for accurate local weather."
      };
    case 2:
      return {
        title: "📍 Location Unavailable",
        message: "Unable to determine your location. This could be due to no GPS signal or device issues."
      };
    case 3:
      return {
        title: "📍 Location Timeout",
        message: "Location request timed out. Please check your connection or try again."
      };
    default:
      return {
        title: "📍 Location Error",
        message: `An error occurred: ${message}. Falling back to approximate location.`
      };
  }
}

export async function getGeoLocation(accuracy = 'high') {
  const options = {
    timeout: 15000,
    maximumAge: 0,
    enableHighAccuracy: accuracy === 'high'
  };
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function initGeolocation() {
  if (!navigator.geolocation) {
    console.log("📍 Geolocation not supported");
    return await getIPLocation();
  }

  try {
    const pos = await getGeoLocation('high');
    console.log("✅ GPS location detected");
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Your location", from: "gps" };
  } catch (err) {
    console.warn("⚠️ GPS error:", err);
    if (err.code === 1) {
      throw err;
    }

    try {
      const pos = await getGeoLocation('low');
      console.log("✅ Network location detected");
      return { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Your approximate location", from: "network" };
    } catch (netErr) {
      console.warn("⚠️ Network location error:", netErr);
      if (netErr.code === 1) {
        throw netErr;
      }
      return await getIPLocation();
    }
  }
}
