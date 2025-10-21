const fs = require('fs/promises');
const path = require('path');

const STORAGE_FILE = path.join('/tmp', 'notifications.json');

// Helper to load/store (in-memory for speed, persist on write)
let cache = new Map(); // FID -> {url, token}

async function loadCache() {
  try {
    const data = await fs.readFile(STORAGE_FILE, 'utf8');
    cache = new Map(JSON.parse(data));
  } catch (err) {
    cache = new Map(); // Init empty
  }
}

async function saveCache() {
  await fs.writeFile(STORAGE_FILE, JSON.stringify(Array.from(cache.entries())));
}

// Init on module load
loadCache().catch(console.error);

module.exports = {
  saveToken: async (fid, url, token) => {
    cache.set(fid.toString(), { url, token });
    await saveCache();
  },
  getToken: (fid) => cache.get(fid.toString()),
  deleteToken: async (fid) => {
    cache.delete(fid.toString());
    await saveCache();
  },
  // For batch send: get all valid tokens
  getAllTokens: () => Array.from(cache.values())
};
