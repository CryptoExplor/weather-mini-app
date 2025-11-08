import './style.css';
import { sdk } from '@farcaster/miniapp-sdk';
import {
  WMO,
  fetchWeather,
  geocodeCity,
  initGeolocation,
  getIPLocation,
  getGeolocationErrorMessage
} from './weather.js';

// DOM Elements
const els = {
  emoji: document.getElementById("emoji"),
  temp: document.getElementById("temp"),
  cond: document.getElementById("cond"),
  humid: document.getElementById("humid"),
  wind: document.getElementById("wind"),
  feels: document.getElementById("feels"),
  ltime: document.getElementById("ltime"),
  greeting: document.getElementById("greeting"),
  status: document.getElementById("status"),
  refresh: document.getElementById("refresh"),
  forecast: document.getElementById("forecast"),
  city: document.getElementById("city"),
  btnSearch: document.getElementById("btn-search"),
  btnMyLoc: document.getElementById("btn-myloc"),
  btnCast: document.getElementById("btn-cast"),
  btnCopy: document.getElementById("btn-copy"),
  btnAddMiniapp: document.getElementById("btn-add-miniapp"),
  userFid: document.getElementById("user-fid"),
  locationModal: document.getElementById("locationModal"),
  modalTitle: document.getElementById("modal-title"),
  modalMessage: document.getElementById("modal-message"),
  retryLocation: document.getElementById("retryLocation"),
  useIP: document.getElementById("useIP")
};

// Storage utilities
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
};

const load = (k, d = null) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};

// Background theme
function setBackgroundByCode(code, isNight = false) {
  const info = WMO[code] || WMO[2];
  document.body.className = isNight ? "bg-night" : `bg-${info.bg}`;
}

// Time formatting
function formatTimeLocal(dateStr) {
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return "--:--";
  }
}

// Toast notification
function toast(msg) {
  els.status.textContent = msg;
  setTimeout(() => els.status.textContent = "", 3000);
}

// Copy to clipboard
function copy(t) {
  try {
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = t;
    tempTextArea.style.position = "fixed";
    tempTextArea.style.opacity = "0";
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextArea);
    toast("📋 Copied to clipboard!");
  } catch (e) {
    console.error("Copy failed:", e);
    toast("Copy failed");
  }
}

// Modal functions
function showLocationModal(title = "Enable Location Access", message = "To get accurate weather for your area, please allow location access in your browser settings.") {
  els.modalTitle.textContent = title;
  els.modalMessage.textContent = message;
  els.locationModal.style.display = "block";
}

function hideLocationModal() {
  els.locationModal.style.display = "none";
}

// Handle notification context
function handleNotificationContext() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('context') === 'notification') {
    const label = urlParams.get('label') || 'your area';
    toast(`🔔 Welcome back! Showing weather for ${label}`);
    els.greeting.textContent = `Welcome back! Check out the latest weather. 🌤️`;
  }
}

// Update timestamp
let lastUpdatedTs = null;

function setUpdatedNow() {
  lastUpdatedTs = Date.now();
  els.refresh.textContent = `Updated • ${new Date(lastUpdatedTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

setInterval(() => {
  if (!lastUpdatedTs) return;
  const mins = Math.floor((Date.now() - lastUpdatedTs) / 60000);
  if (mins <= 0) return;
  els.refresh.textContent = `Updated • ${mins}m ago`;
}, 60000);

// Render weather data
function render(data, placeName = "Your location") {
  try {
    const cur = data.current;
    const daily = data.daily;
    const code = cur.weather_code;
    const info = WMO[code] || { t: "Unknown", e: "⛅", bg: "cloudy" };
    const isNight = (typeof cur.is_day === "number") ? (cur.is_day === 0) : false;

    setBackgroundByCode(code, isNight);
    els.emoji.textContent = info.e;
    els.temp.textContent = `${Math.round(cur.temperature_2m)}°C`;
    els.cond.textContent = `${info.t} • ${placeName}`;
    els.humid.textContent = `${Math.round(cur.relative_humidity_2m)}%`;
    els.wind.textContent = `${Math.round(cur.wind_speed_10m)} km/h`;
    els.feels.textContent = `${Math.round(cur.apparent_temperature ?? cur.temperature_2m)}°C`;
    els.ltime.textContent = formatTimeLocal(cur.time);

    const prevTemp = load("lastTemp", null);
    if (prevTemp !== null && Math.abs(prevTemp - cur.temperature_2m) > 3) {
      toast(`🌡️ Temp changed ${Math.round(cur.temperature_2m - prevTemp)}°C since last check`);
    }
    save("lastTemp", cur.temperature_2m);

    adaptiveGreeting(code, (placeName || "").split(",")[0]);

    els.forecast.innerHTML = "";
    if (daily && daily.time && daily.time.length) {
      const days = daily.time.slice(0, 5);
      days.forEach((d, i) => {
        const dcode = daily.weather_code[i];
        const max = Math.round(daily.temperature_2m_max[i]);
        const min = Math.round(daily.temperature_2m_min[i]);
        const label = new Date(d).toLocaleDateString([], { weekday: "short" });
        const dinfo = WMO[dcode] || { e: "⛅" };
        const node = document.createElement("div");
        node.className = "fcard";
        node.innerHTML = `
          <div class="fday">${label}</div>
          <div style="font-size:18px;margin:4px 0">${dinfo.e}</div>
          <div class="ftemp">↑${max}° ↓${min}°</div>
        `;
        els.forecast.appendChild(node);
      });
    }

    save("lastWeather", { data, placeName, ts: Date.now() });
  } catch (err) {
    console.error(err);
    els.status.textContent = "Render error";
  }
}

// Load weather by coordinates
async function loadByCoords(lat, lon, label) {
  els.status.textContent = "Loading weather…";
  try {
    const data = await fetchWeather(lat, lon);
    render(data, label);
    setUpdatedNow();
    els.status.textContent = "";
  } catch (err) {
    console.error(err);
    els.status.textContent = "Offline — showing saved weather data ☁️";
    const cache = load("lastWeather");
    if (cache) {
      render(cache.data, cache.placeName || label);
    }
  }
}

// Adaptive greeting
function adaptiveGreeting(code, name) {
  const hr = new Date().getHours();
  const base =
    (hr >= 6 && hr < 12) ? "☀️ Good morning" :
      (hr >= 12 && hr < 18) ? "🌤️ Good afternoon" :
        "🌙 Good evening";
  let tail = " Let's build something new today.";
  if ([0, 1].includes(code)) tail = " Bright and clear — perfect day to ship!";
  else if ([2, 3, 45, 48].includes(code)) tail = " Cloudy skies — cozy coding weather.";
  else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) tail = " Rainy vibes — great time to code indoors.";
  else if ([71, 73, 75, 77, 85, 86].includes(code)) tail = " Snowy mood — warm beverage and deep focus.";
  else if ([95, 96, 99].includes(code)) tail = " Stormy out — perfect to build something big inside.";
  const msg = `${base}${name ? `, ${name}` : ""}!${tail}`;
  els.greeting.textContent = msg;
  save("greetMsg", msg);
}

// Check morning greeting
async function checkMorningGreeting() {
  const lastMsgDate = load("lastGreetDate", "");
  const today = new Date().toDateString();
  if (lastMsgDate !== today) {
    const greetMsg = load("greetMsg", "Good morning!");
    toast(greetMsg);
    save("lastGreetDate", today);
  }
}

// Get weather text for sharing
function getWeatherText() {
  const emoji = els.emoji.textContent;
  const temp = els.temp.textContent;
  const cond = els.cond.textContent;
  const humid = els.humid.textContent;
  const wind = els.wind.textContent;
  return `${emoji} Weather Update\n\n${temp} ${cond}\n💧 ${humid} humidity • 🍃 ${wind} wind\n\nvia CastWeather MiniApp 🌤️`;
}

// Global SDK state
let sdkReady = false;
let farcasterUser = null;
let farcasterContext = null;

// Cast weather with proper error handling
async function castWeather() {
  if (!sdkReady) {
    toast("⚠️ Not running in Farcaster app");
    console.log("SDK not ready, falling back to copy");
    copyWeather();
    return;
  }

  try {
    els.btnCast.disabled = true;
    els.btnCast.textContent = "Casting...";

    console.log("Attempting to compose cast...");
    const result = await sdk.actions.composeCast({
      text: getWeatherText(),
      embeds: [window.location.origin]
    });

    console.log("Cast result:", result);

    if (result?.cast) {
      toast(`✅ Cast posted! Hash: ${result.cast.hash.slice(0, 10)}...`);
      console.log("Cast hash:", result.cast.hash);
      if (result.cast.channelKey) {
        console.log("Posted to channel:", result.cast.channelKey);
      }
    } else {
      toast("Cast cancelled or failed");
      console.log("Cast was cancelled or returned no result");
    }
  } catch (err) {
    console.error("Cast error:", err);
    toast("Cast failed - copied to clipboard instead");
    copyWeather();
  } finally {
    els.btnCast.disabled = false;
    els.btnCast.textContent = "🟣 CastWeather";
  }
}

function copyWeather() {
  copy(getWeatherText());
}

async function addMiniApp() {
  if (!sdkReady) {
    toast("⚠️ Not running in Farcaster app");
    return;
  }

  try {
    els.btnAddMiniapp.disabled = true;
    els.btnAddMiniapp.textContent = "Adding...";

    console.log("Attempting to add miniapp...");
    const result = await sdk.actions.addMiniApp();
    console.log("Add miniapp result:", result);

    if (result.added) {
      toast("✅ MiniApp added! Enable notifications in app settings.");
    } else {
      console.error('Add failed:', result.reason);
      toast(`Add failed: ${result.reason || 'Unknown reason'}`);
    }
  } catch (err) {
    console.error("Add MiniApp error:", err);
    toast("Add MiniApp failed");
  } finally {
    els.btnAddMiniapp.disabled = false;
    els.btnAddMiniapp.textContent = "➕ Add MiniApp";
  }
}

async function initFarcasterContext() {
  try {
    console.log("Initializing Farcaster SDK...");

    await sdk.actions.ready();
    console.log("SDK ready signal sent");

    farcasterContext = await sdk.context;
    console.log("Farcaster context:", farcasterContext);

    if (farcasterContext?.user?.fid) {
      farcasterUser = farcasterContext.user;
      els.userFid.textContent = `FID: ${farcasterUser.fid}`;
      els.userFid.style.display = "inline-flex";
      console.log("Farcaster user authenticated:", farcasterUser);
      sdkReady = true;

      els.btnCast.disabled = false;
      els.btnAddMiniapp.disabled = false;
    } else {
      console.log("No user context found");
      sdkReady = false;
      els.btnCast.title = "Only available in Farcaster app";
      els.btnAddMiniapp.title = "Only available in Farcaster app";
    }
  } catch (err) {
    console.log("Not running in Farcaster context:", err);
    sdkReady = false;
    els.btnCast.title = "Only available in Farcaster app";
    els.btnAddMiniapp.title = "Only available in Farcaster app";
  }
}

// Auto refresh
let lastGeo = null;
let refreshTimer = null;

function scheduleAutoRefresh(lat, lon, label) {
  const threeHours = 3 * 60 * 60 * 1000;
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => loadByCoords(lat, lon, label), threeHours);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadByCoords(lat, lon, label);
    }
  }, { once: true });
}

// Event listeners
els.btnSearch.addEventListener("click", async () => {
  const q = els.city.value.trim();
  if (!q) return;
  els.status.textContent = "Searching city…";
  try {
    const loc = await geocodeCity(q);
    els.city.blur();
    const label = `${loc.name}, ${loc.country || ""}`.trim();
    await loadByCoords(loc.latitude, loc.longitude, label);
    scheduleAutoRefresh(loc.latitude, loc.longitude, label);
    save("lastCity", loc);
  } catch (err) {
    console.error(err);
    els.status.textContent = "City not found";
  }
});

els.city.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.btnSearch.click();
});

els.btnCast.addEventListener("click", castWeather);
els.btnCopy.addEventListener("click", copyWeather);
els.btnAddMiniapp.addEventListener("click", addMiniApp);

els.btnMyLoc.addEventListener("click", async () => {
  try {
    els.status.textContent = "📍 Detecting your location…";
    const { lat, lon, label, from } = await initGeolocation();
    lastGeo = { lat, lon, label };
    await loadByCoords(lat, lon, label);
    scheduleAutoRefresh(lat, lon, label);
    els.status.textContent = from === "gps"
      ? "✅ GPS location loaded"
      : from === "network"
        ? "📍 Network location loaded"
        : from === "ip"
          ? "📍 IP-based location loaded"
          : "⚠️ Using default city";
  } catch (err) {
    console.warn("Location denied, modal shown");
  }
});

els.retryLocation.addEventListener("click", async () => {
  hideLocationModal();
  els.status.textContent = "📍 Retrying GPS location…";
  try {
    const { lat, lon, label, from } = await initGeolocation();
    lastGeo = { lat, lon, label };
    await loadByCoords(lat, lon, label);
    scheduleAutoRefresh(lat, lon, label);
    els.status.textContent = from === "gps"
      ? "✅ GPS location loaded"
      : from === "network"
        ? "📍 Network location loaded"
        : "⚠️ Still unable to get location";
  } catch (retryErr) {
    if (retryErr.code === 1) {
      const errorInfo = getGeolocationErrorMessage(retryErr.code, retryErr.message);
      showLocationModal(errorInfo.title, errorInfo.message);
    } else {
      els.status.textContent = "📍 Falling back to IP location…";
      const ipLoc = await getIPLocation();
      lastGeo = { lat: ipLoc.lat, lon: ipLoc.lon, label: ipLoc.label };
      await loadByCoords(ipLoc.lat, ipLoc.lon, ipLoc.label);
      scheduleAutoRefresh(ipLoc.lat, ipLoc.lon, ipLoc.label);
      els.status.textContent = "📍 IP-based location loaded";
    }
  }
});

els.useIP.addEventListener("click", async () => {
  hideLocationModal();
  els.status.textContent = "📍 Using approximate IP location…";
  const ipLoc = await getIPLocation();
  lastGeo = { lat: ipLoc.lat, lon: ipLoc.lon, label: ipLoc.label };
  await loadByCoords(ipLoc.lat, ipLoc.lon, ipLoc.label);
  scheduleAutoRefresh(ipLoc.lat, ipLoc.lon, ipLoc.label);
  els.status.textContent = ipLoc.from === "ip" ? "📍 IP-based location loaded" : "⚠️ Using default city";
});

// Boot sequence
(async function boot() {
  console.log("🧭 Boot: starting initialization...");

  handleNotificationContext();

  const cached = load("lastWeather");
  if (cached) {
    render(cached.data, cached.placeName);
    console.log("Loaded cached weather data");
  }

  await initFarcasterContext();

  try {
    const { lat, lon, label, from } = await initGeolocation();
    lastGeo = { lat, lon, label };
    await loadByCoords(lat, lon, label);
    scheduleAutoRefresh(lat, lon, label);

    els.status.textContent = from === "gps"
      ? "✅ GPS location loaded"
      : from === "network"
        ? "📍 Network location loaded"
        : from === "ip"
          ? "📍 IP-based location loaded"
          : "⚠️ Using default city";
  } catch (err) {
    if (err.code === 1) {
      const errorInfo = getGeolocationErrorMessage(err.code, err.message);
      els.status.textContent = "⚠️ Location permission needed";
      showLocationModal(errorInfo.title, errorInfo.message);
      setTimeout(async () => {
        const ipLoc = await getIPLocation();
        lastGeo = { lat: ipLoc.lat, lon: ipLoc.lon, label: ipLoc.label };
        await loadByCoords(ipLoc.lat, ipLoc.lon, ipLoc.label);
        scheduleAutoRefresh(ipLoc.lat, ipLoc.lon, ipLoc.label);
        els.status.textContent = ipLoc.from === "ip" ? "📍 IP-based location loaded" : "⚠️ Using default city";
      }, 1000);
    } else {
      const errorInfo = getGeolocationErrorMessage(err.code || 0, err.message || "Unknown error");
      toast(errorInfo.message);
      const ipLoc = await getIPLocation();
      lastGeo = { lat: ipLoc.lat, lon: ipLoc.lon, label: ipLoc.label };
      await loadByCoords(ipLoc.lat, ipLoc.lon, ipLoc.label);
      scheduleAutoRefresh(ipLoc.lat, ipLoc.lon, ipLoc.label);
      els.status.textContent = ipLoc.from === "ip" ? "📍 IP-based location loaded" : "⚠️ Using default city";
    }
  }

  const lastCity = load("lastCity");
  if (lastCity) els.city.placeholder = `Try: ${lastCity.name}`;

  const hr = new Date().getHours();
  if (hr >= 6 && hr < 9) checkMorningGreeting();

  console.log("✅ Boot complete. SDK ready:", sdkReady);
})();
