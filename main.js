const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ---------- Local storage layout ----------
// <userData>/gaba-data/db.json          -> array of species records
// <userData>/gaba-data/config.json      -> local settings (API keys, chosen image provider)
// <userData>/gaba-data/images/<id>/...  -> every photo and sound file you've added, copied here permanently
const dataDir = () => path.join(app.getPath('userData'), 'gaba-data');
const imagesDir = () => path.join(dataDir(), 'images');
const tmpDir = () => path.join(dataDir(), 'tmp');
const dbPath = () => path.join(dataDir(), 'db.json');
const configPath = () => path.join(dataDir(), 'config.json');

function ensureStorage() {
  if (!fs.existsSync(dataDir())) fs.mkdirSync(dataDir(), { recursive: true });
  if (!fs.existsSync(imagesDir())) fs.mkdirSync(imagesDir(), { recursive: true });
  if (!fs.existsSync(tmpDir())) fs.mkdirSync(tmpDir(), { recursive: true });
  if (!fs.existsSync(dbPath())) fs.writeFileSync(dbPath(), JSON.stringify([], null, 2));
  if (!fs.existsSync(configPath())) fs.writeFileSync(configPath(), JSON.stringify({}, null, 2));
}

function clearTmpDir() {
  if (!fs.existsSync(tmpDir())) return;
  for (const f of fs.readdirSync(tmpDir())) {
    fs.rmSync(path.join(tmpDir(), f), { force: true });
  }
}

function readDB() {
  ensureStorage();
  try {
    return JSON.parse(fs.readFileSync(dbPath(), 'utf-8'));
  } catch (err) {
    return [];
  }
}

function writeDB(records) {
  fs.writeFileSync(dbPath(), JSON.stringify(records, null, 2));
}

function readConfig() {
  ensureStorage();
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf-8'));
  } catch (err) {
    return {};
  }
}

function writeConfig(cfg) {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
}

// Copies any file (photo or sound) from wherever it currently sits into that
// record's permanent local folder, with a collision-proof filename.
function copyFileToStore(sourcePath, recordId) {
  if (!sourcePath) return null;
  const folder = path.join(imagesDir(), recordId);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const ext = path.extname(sourcePath) || '.jpg';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const dest = path.join(folder, filename);
  fs.copyFileSync(sourcePath, dest);
  return dest;
}

// ---------- Window ----------
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0d1b13',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    title: 'ghaba - a field journal',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  ensureStorage();
  clearTmpDir();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ================= IPC: records =================
ipcMain.handle('gaba:getAll', () => readDB());

ipcMain.handle('gaba:getByCategory', (_e, category) =>
  readDB()
    .filter((s) => s.category === category)
    .sort((a, b) => a.name.localeCompare(b.name))
);

ipcMain.handle('gaba:search', (_e, query) => {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return readDB().filter((s) => {
    const haystack = [s.name, s.scientificName, s.description, s.category, s.captions && s.captions.habitat, ...(s.facts || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
});

ipcMain.handle('gaba:pickImage', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a picture',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('gaba:pickSound', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a sound file',
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

// Fields that hold a photo. Kept in one place since add/update/delete all loop over it.
const IMAGE_FIELDS = ['main', 'secondary', 'eye', 'face', 'feet', 'fur', 'footprint', 'habitat'];

ipcMain.handle('gaba:addSpecies', (_e, payload) => {
  const db = readDB();
  const id = `${payload.category}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const record = {
    id,
    category: payload.category,
    name: payload.name || 'Untitled',
    scientificName: payload.scientificName || '',
    description: payload.description || '',
    facts: (payload.facts || []).filter(Boolean),
    images: {},
    captions: payload.captions || {},
    sound: null,
    related: [],
    createdAt: new Date().toISOString(),
  };

  IMAGE_FIELDS.forEach((field) => {
    const src = payload.images && payload.images[field];
    if (src) record.images[field] = copyFileToStore(src, id);
  });

  if (payload.sound) record.sound = copyFileToStore(payload.sound, id);

  if (Array.isArray(payload.related)) {
    record.related = payload.related
      .filter((r) => r && (r.path || r.label))
      .map((r) => ({
        label: r.label || '',
        image: r.path ? copyFileToStore(r.path, id) : null,
      }));
  }

  db.push(record);
  writeDB(db);
  return record;
});

// Every top-level field present in `patch` fully replaces that field on the record
// (the renderer always sends complete values, never partial merges for objects/arrays).
// New photos/sounds referenced by a *local temp or picked path* (not already inside
// this record's permanent folder) get copied in; anything no longer referenced
// afterward gets deleted from disk.
ipcMain.handle('gaba:updateSpecies', (_e, { id, patch }) => {
  const db = readDB();
  const idx = db.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error('Record not found.');
  const before = db[idx];

  const referencedBefore = new Set(
    [
      ...Object.values(before.images || {}),
      before.sound,
      ...((before.related || []).map((r) => r.image)),
    ].filter(Boolean)
  );

  const recordFolder = path.join(imagesDir(), id);
  const isAlreadyStored = (p) => p && p.startsWith(recordFolder);

  const updated = { ...before, ...patch };

  if (patch.images) {
    const finalImages = {};
    IMAGE_FIELDS.forEach((field) => {
      const val = patch.images[field];
      if (!val) { finalImages[field] = null; return; }
      finalImages[field] = isAlreadyStored(val) ? val : copyFileToStore(val, id);
    });
    updated.images = finalImages;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'sound')) {
    updated.sound = patch.sound
      ? (isAlreadyStored(patch.sound) ? patch.sound : copyFileToStore(patch.sound, id))
      : null;
  }

  if (patch.related) {
    updated.related = patch.related
      .filter((r) => r && (r.path || r.image || r.label))
      .map((r) => {
        const src = r.path || r.image;
        return {
          label: r.label || '',
          image: src ? (isAlreadyStored(src) ? src : copyFileToStore(src, id)) : null,
        };
      });
  }

  db[idx] = updated;
  writeDB(db);

  const referencedAfter = new Set(
    [
      ...Object.values(updated.images || {}),
      updated.sound,
      ...((updated.related || []).map((r) => r.image)),
    ].filter(Boolean)
  );

  for (const oldPath of referencedBefore) {
    if (!referencedAfter.has(oldPath) && fs.existsSync(oldPath)) {
      fs.rmSync(oldPath, { force: true });
    }
  }

  return updated;
});

ipcMain.handle('gaba:deleteSpecies', (_e, id) => {
  const db = readDB();
  const rest = db.filter((s) => s.id !== id);
  writeDB(rest);
  const folder = path.join(imagesDir(), id);
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
  return true;
});

// ================= IPC: local config (API keys, provider choice) =================
ipcMain.handle('gaba:getConfig', () => readConfig());

ipcMain.handle('gaba:saveConfig', (_e, partial) => {
  const cfg = { ...readConfig(), ...partial };
  writeConfig(cfg);
  return cfg;
});

// ================= IPC: image search across providers =================
async function searchPexels(query, apiKey) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) throw new Error(`Pexels request failed (${res.status})`);
  const data = await res.json();
  return (data.photos || []).map((p) => ({
    id: p.id,
    thumb: p.src.medium,
    full: p.src.large2x || p.src.large || p.src.original,
  }));
}

async function searchUnsplash(query, apiKey) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=6`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${apiKey}` } });
  if (!res.ok) throw new Error(`Unsplash request failed (${res.status})`);
  const data = await res.json();
  return (data.results || []).map((p) => ({
    id: p.id,
    thumb: p.urls.thumb,
    full: p.urls.regular || p.urls.full,
  }));
}

async function searchPixabay(query, apiKey) {
  const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=6`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay request failed (${res.status})`);
  const data = await res.json();
  return (data.hits || []).map((p) => ({
    id: p.id,
    thumb: p.webformatURL,
    full: p.largeImageURL || p.webformatURL,
  }));
}

ipcMain.handle('gaba:searchImages', async (_e, { query, provider, apiKey }) => {
  if (!apiKey) throw new Error(`No ${provider || 'image'} API key saved yet.`);
  if (!query || !query.trim()) throw new Error('Type something to search for.');
  if (provider === 'unsplash') return searchUnsplash(query, apiKey);
  if (provider === 'pixabay') return searchPixabay(query, apiKey);
  return searchPexels(query, apiKey);
});

ipcMain.handle('gaba:downloadFileToTemp', async (_e, url) => {
  ensureStorage();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download that file (${response.status}).`);
  const buf = Buffer.from(await response.arrayBuffer());

  const contentType = response.headers.get('content-type') || '';
  let ext = '.jpg';
  if (contentType.includes('png')) ext = '.png';
  else if (contentType.includes('webp')) ext = '.webp';
  else if (contentType.includes('gif')) ext = '.gif';
  else if (contentType.includes('mpeg') || contentType.includes('mp3')) ext = '.mp3';
  else if (contentType.includes('wav')) ext = '.wav';
  else if (contentType.includes('ogg')) ext = '.ogg';

  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const dest = path.join(tmpDir(), filename);
  fs.writeFileSync(dest, buf);
  return dest;
});

// ================= IPC: sound search (Freesound) =================
ipcMain.handle('gaba:searchSounds', async (_e, { query, apiKey }) => {
  if (!apiKey) throw new Error('No Freesound API key saved yet.');
  if (!query || !query.trim()) throw new Error('Type something to search for.');

  const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&fields=id,name,previews,username,duration&page_size=6`;
  const res = await fetch(url, { headers: { Authorization: `Token ${apiKey}` } });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Freesound request failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    duration: r.duration,
    previewUrl: (r.previews && (r.previews['preview-hq-mp3'] || r.previews['preview-lq-mp3'])) || null,
  })).filter((r) => r.previewUrl);
});

// ================= IPC: AI features (Groq / Llama 3) =================
async function callGroq(apiKey, prompt, jsonMode) {
  const body = {
    model: 'llama-3.3-70b-versatile',
    temperature: 0.6,
    messages: [{ role: 'user', content: prompt }],
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Groq request failed (${response.status}): ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!raw) throw new Error('Groq returned an empty response.');
  return raw;
}

ipcMain.handle('gaba:aiAutofill', async (_e, { name, category, apiKey }) => {
  if (!apiKey) throw new Error('No Groq API key saved yet.');
  if (!name) throw new Error('Enter a name first.');

  const prompt = `You are helping fill a nature field journal entry.
Species / subject name: "${name}"
Category: "${category}"

Respond with ONLY raw JSON (no markdown fences, no commentary, no em dashes anywhere) in exactly this shape:
{
  "description": "a warm, factual 2-4 sentence profile, written for a curious naturalist's journal",
  "scientificName": "the binomial Latin name, or your best-supported estimate",
  "habitat": "one short sentence on where this is typically found (den, nest, riverbank, forest floor, stable, etc.)",
  "facts": ["short fact 1", "short fact 2", "short fact 3", "short fact 4"],
  "related": ["related species name 1", "related species name 2", "related species name 3"]
}
If you are not fully certain of a fact, keep it general rather than inventing specifics. Never use an em dash character; use commas or separate sentences instead.`;

  const raw = await callGroq(apiKey, prompt, true);
  let parsed;
  try { parsed = JSON.parse(raw); } catch (err) { throw new Error('Could not parse the AI response as JSON.'); }

  return {
    description: parsed.description || '',
    scientificName: parsed.scientificName || '',
    habitat: parsed.habitat || '',
    facts: Array.isArray(parsed.facts) ? parsed.facts.slice(0, 6) : [],
    related: Array.isArray(parsed.related) ? parsed.related.slice(0, 4) : [],
  };
});

const CAPTION_FIELD_PROMPTS = {
  eye: 'the close-up eye photo, mentioning things like pupil shape, vision type (monocular/binocular), or notable eye features',
  face: 'the face photo, mentioning face shape, markings, or distinguishing features',
  feet: 'the feet/paws/hooves photo, mentioning the type of feet, how many toes/claws, or what they are adapted for',
  fur: 'the fur/skin/scales close-up photo, mentioning texture, color pattern, or coat type',
  footprint: 'the footprint/track photo, mentioning track shape, size, or gait pattern',
  habitat: 'the habitat photo, mentioning the type of environment or dwelling this is typically found in (den, nest, riverbank, stable, forest floor, etc.)',
};

ipcMain.handle('gaba:aiCaption', async (_e, { name, category, field, apiKey }) => {
  if (!apiKey) throw new Error('No Groq API key saved yet.');
  if (!name) throw new Error('Enter a name first.');
  const focus = CAPTION_FIELD_PROMPTS[field] || `the ${field} photo`;

  const prompt = `Write ONE short caption (under 18 words, one sentence, no quotes, no em dash character) for ${focus}, for a "${name}" (${category}) in a nature field journal.
If you are not fully certain of a fact, keep it general rather than inventing specifics.
Respond with ONLY the caption text, no quotes, no labels, no extra commentary.`;

  const raw = await callGroq(apiKey, prompt, false);
  return { caption: raw.trim().replace(/^["']|["']$/g, '') };
});

ipcMain.handle('gaba:aiScientificName', async (_e, { name, category, apiKey }) => {
  if (!apiKey) throw new Error('No Groq API key saved yet.');
  if (!name) throw new Error('Enter a name first.');

  const prompt = `Give the scientific (binomial Latin) name for "${name}", a ${category} in a nature field journal. Respond with ONLY the scientific name in "Genus species" format, nothing else, no extra commentary. If uncertain, give your best-supported estimate rather than refusing.`;

  const raw = await callGroq(apiKey, prompt, false);
  return { scientificName: raw.trim().replace(/^["']|["']$/g, '') };
});

ipcMain.handle('gaba:checkCategory', async (_e, { name, category, apiKey }) => {
  if (!apiKey) throw new Error('No Groq API key saved yet.');
  if (!name) throw new Error('Enter a name first.');

  const prompt = `A nature journal has exactly five categories: plants, animals, birds, fishes, insects ("animals" means non-insect, non-bird, non-fish, non-plant creatures such as mammals, reptiles, and amphibians; "insects" means insects and other small arthropods such as spiders and beetles). Someone is filing "${name}" under the category "${category}".
Respond with ONLY raw JSON, no markdown fences, no commentary, in exactly this shape:
{"match": true or false, "suggestedCategory": "plants" or "animals" or "birds" or "fishes" or "insects"}`;

  const raw = await callGroq(apiKey, prompt, true);
  let parsed;
  try { parsed = JSON.parse(raw); } catch (err) { return { match: true, suggestedCategory: category }; }
  return {
    match: parsed.match !== false,
    suggestedCategory: parsed.suggestedCategory || category,
  };
});
