# ghaba - Project Documentation (v2)
### A local-first field journal for plants, animals, birds, fishes, and insects

---

## 0.0 What is Ghaba App?

The Ghaba App is a simple but effect Nature Journaling app that locally stores are all the information collected in the app. The App is furthermore divided in to 5 parts: 1. Animal -  Where all the animal details are listed, 2. Plants - Where all plants & trees are mentioned, 3. Fishes - All kinds of fishes are addressed with details. 4. Birds - Fond of birds, so listed all the birds, 5. Insects - I just love nature which also includes the insects as well. Each section has its own color and all that I explore and come across either in real life or online, I mention them all in the Ghaba App. The trueness of this app is real you never find an app like this with this simplicity and effectiveness. This app was never build to be judged it was purely build on the need for my self and the easiness to store the information in terms of categorizing, organizing and maintain every detail such that is readable and editable at the same time.  


## 1. How It Is Made

`ghaba` is a desktop application built with **Electron** - a real, installable Windows program, not a website. It has three parts working together:

1. **The main process** (`main.js`) - a Node.js program that owns the actual window, talks to your file system, and calls every external API (Groq, Pexels, Unsplash, Pixabay, Freesound). There is exactly one of these, and it's the only part of the app allowed to touch your disk directly.
2. **The renderer process** (`renderer/index.html`, `styles.css`, `app.js`) - what you see and click. A webpage rendered by Chromium, running inside the app window.
3. **The preload script** (`preload.js`) - a narrow, controlled bridge. The renderer cannot reach into Node.js or your file system on its own; it can only call the specific functions preload chooses to expose, under `window.gaba`.

Nothing in this app touches a server of its own. Every record, every photo, every sound clip lives in a folder on your machine. The only network calls it ever makes are the ones you deliberately trigger - a picture search, a sound search, or an AI request - and only once you've supplied that service's own API key.

---

## 2. What Tech Is Used

| Piece                                       | What it is                                | Why it's here                                                                                                                                                 |
| ------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Electron 31**                             | Framework bundling Chromium + Node.js     | Desktop app built with web technology, with real file-system access                                                                                           |
| **Node.js** (built into Electron)           | JavaScript runtime for the main process   | Reads/writes JSON, copies files, makes network calls                                                                                                          |
| **Vanilla HTML/CSS/JavaScript**             | No framework, no build step               | The app is small enough that a framework adds ceremony without adding value                                                                                   |
| **JSON file storage** (`db.json`)           | A flat-file database                      | No server, no SQL engine; simple, human-readable, and enough for a personal journal                                                                           |
| **Groq API** (Llama 3.3 70B)                | Free-tier LLM                             | Powers every "Auto-fill with AI" button: descriptions, facts, related species, scientific names, habitat, per-photo captions, and the category-mismatch check |
| **Pexels / Unsplash / Pixabay APIs**        | Three free stock-photo search APIs        | "Add photo" search, switchable per your preference in Settings                                                                                                |
| **Freesound API**                           | Free nature/field-recording audio library | Powers "Add sound"                                                                                                                                            |
| **Google Fonts** (Cormorant Garamond, Lora) | CDN-loaded web fonts                      | Cormorant for display/headings, Lora for readable body text                                                                                                   |
| **electron-builder**                        | Packaging tool                            | Turns the source into a real Windows `.exe` installer                                                                                                         |

---

## 3. Every Category (5 Realms)

| Realm | Theme color |
|---|---|
| Plants | Light green |
| Animals | Deep forest green |
| Birds | Sky blue |
| Fishes | True blue |
| Insects | Warm amber/orange |

Each realm swaps the entire app's accent color and background gradient the moment you open it, via a `theme-<category>` class on `<body>`. "Animals" is explicitly scoped to exclude insects now (mammals, reptiles, amphibians only) - the AI category-checker knows this distinction and will flag a beetle filed under Animals.

---

## 4. Every Field On A Record

**Identity:** Name, Scientific name (with its own AI button), Realm (a dropdown you can change at any time, including on an existing record).

**Description & facts:** a free-text description, and an editable list of short bullet facts.

**Habitat:** one line of text (e.g. "den," "riverbank," "stable") with its own AI button, plus an optional photo. If a habitat photo exists it gets a full detail-row like Eye/Face; if only the text is filled in, it still shows as a line on the species page.

**Photos** (each with "Add photo" - search or upload, and a remove button once attached):
- Main photo, Secondary photo (both hero-sized)
- Eye close-up, Face, Feet/hooves, Fur/skin, Footprint, Habitat - each of these six gets a caption field with its own AI button, and all six now render identically as detail-rows in the left column of the species page (this was the layout fix - they used to be split between a big left column and small bottom tiles, which was inconsistent)

**Sound:** one audio clip per record, searchable via Freesound or uploaded from your computer, played from a speaker button on the species page.

**Related species:** a repeatable list of name + optional photo, shown as small tiles at the bottom of the page (the one section that stayed as tiles, since it's a different kind of content - other species, not this one's body parts).

---

## 5. Errors Found And Resolved (Updated Log)

| # | Issue | How it was caught | Resolution |
|---|---|---|---|
| 1 | Corrupted CSS hex values from a typo while writing the category-theming code | Caught by grep before shipping | Rewrote the broken block |
| 2 | Related-species row removal didn't actually remove the data (stale parallel array) | Found during edit-mode design work | Data now lives directly on the DOM node; deleting the row deletes the data |
| 3 | You reported not being able to type in the Name field | Reproduced the exact click path via Chrome DevTools Protocol with real synthetic mouse clicks and keystrokes | No code bug found - field accepted real keystrokes correctly in testing; resolved itself on your end |
| 4 | The "Add sound" button was styled with the same CSS class as the photo-picker buttons, which meant clicking it also silently fired the *photo* search logic underneath the sound logic | Caught by literally counting how many buttons a shared selector matched during a scripted test, before you ever saw it | Gave the sound button its own class name |
| 5 | Electron needs `--no-sandbox` and a virtual display to run at all inside a container with no monitor | Testing-environment limitation only, not an app bug | Used `Xvfb` + flags for my own verification; irrelevant to your actual laptop |

**Every version shipped since the last documentation pass has gone through the same four-step check:** syntax validation, an ID cross-reference between every `getElementById` call and the actual HTML, a live headless boot with zero uncaught exceptions, and for the more structural changes, an actual scripted click-through (open the add form, fill fields, submit, confirm the right thing happened) via the Chrome DevTools Protocol - not just a visual read of the code.

---

## 6. What's In The Folder Now

```
gaba-journal/
├── package.json          -> manifest + electron-builder config (now points at build/icon.ico)
├── main.js                -> main process: storage, all 17 IPC handlers, all external API calls
├── preload.js              -> exposes window.gaba - the entire safe API surface, 18 methods
├── .gitignore
├── build/
│   ├── icon.ico              -> multi-resolution Windows icon (installer, Start Menu, uninstaller)
│   └── icon.png               -> same artwork, used for the live window icon (cross-platform safe)
└── renderer/
    ├── index.html            -> every view: landing, categories, list, species, the shared add/edit form, three modals
    ├── styles.css             -> all styling, including 5 category themes and the tactical-frame corner brackets
    └── app.js                  -> all interactivity, ~900 lines, organized by feature area
```

---

## 7. How To Turn It Into A Real `.exe`

Unchanged from before:
```
npm install
npm run build
```
Produces `dist/ghaba Setup <version>.exe`. Windows SmartScreen will warn on first run since it's unsigned - "More info" -> "Run anyway" is expected and safe for a personal unsigned app.

---

## 8. What Is Electron (Recap)

A website in a browser tab is sandboxed on purpose - it can't read your files or talk to your OS, and that's a good thing for random websites. Electron pairs that same web-building toolkit (HTML/CSS/JS) with Node.js, which *can* do those things, inside one trusted process. That's the entire reason `ghaba` can look like a polished webpage but still save real files to a real folder on your hard drive.

---

## 9. What Is Happening - The Full Data Flow

Every action that needs real disk or network access travels the same path:

```
You click something
      -> app.js calls window.gaba.someFunction(...)
      -> preload.js relays it over Electron's IPC channel
      -> main.js's matching ipcMain.handle(...) does the real work
      -> result comes back, app.js updates the screen
```

**Walkthrough - adding a sound via search:**
1. Click "Add sound" -> `openSoundPicker()` shows the modal, pre-filled with the species name as the search query.
2. You click Search -> `window.gaba.searchSounds(query, freesoundApiKey)` -> `main.js` calls the real Freesound API and returns name/duration/preview-URL for each result.
3. You click the small play button on a result -> a temporary `Audio` object streams the preview URL directly (nothing downloaded yet, just previewed).
4. You click "Use this" -> `window.gaba.downloadFileToTemp(previewUrl)` -> `main.js` actually downloads the audio bytes to a temp file and returns its local path.
5. That local path is held in `state.addSound` until you click **Save record** -> `window.gaba.addSpecies(payload)` (or `updateSpecies` if editing) -> `main.js` copies that temp file into the record's permanent folder and writes it into `db.json`.
6. Every future app launch clears the temp folder, since anything still sitting there was never actually attached to a saved record.

**Where your data lives** (Windows): `%APPDATA%\ghaba\gaba-data\` - containing `db.json`, `config.json` (your API keys), and `images/<record-id>/` (every photo and sound file you've ever attached). This is completely separate from the app's install location, so rebuilding, reinstalling, or updating the app never touches your journal entries.

---

## 10. Every Feature, Explained

**Landing, Categories, List** - unchanged in spirit from the first version: animated jungle landing, five theme-colored realm cards with live counts, then an index page of every record in that realm before you drill into one.

**Species template page** - hero photo + name + scientific name (italic) + description + facts + habitat line + sound button, then six uniform detail-rows (Eye, Face, Feet, Fur/Skin, Footprint, Habitat - any with no photo simply don't render, so a sparse record doesn't show empty boxes), a secondary photo, and related-species tiles at the bottom.

**The unified Add/Edit form** - this is the biggest structural change since the last doc. There is no longer a separate lightweight "edit mode" that could only delete things. Clicking ✎ Edit on a saved record opens the exact same form used to create it, fully pre-filled - every field, every photo with its remove button already active, every AI button still live. Change the realm dropdown and save, and the record actually moves to that realm. Submitting either creates a new record or patches the existing one, depending on how the form was opened.

**AI features** (all via Groq, all requiring your own free key in Settings):
- **Full auto-fill** - one click drafts description, facts, related species, scientific name, and habitat, all editable before saving.
- **Scientific name** - its own standalone button for a quick refresh without touching anything else.
- **Per-photo captions** - six independent buttons (one per detail field), each prompted specifically for what that photo shows (the eye prompt asks about pupil shape and vision type; feet asks about toe/claw structure; habitat asks about the environment).
- **Category check** - runs quietly when you hit Save. If the AI thinks "Monarch Butterfly" filed under Animals should really be Insects, you get a banner with one click to switch, and one click to save anyway. No key configured just skips this silently.

**Multi-provider photo search** - one shared "Add photo" panel across every photo slot, but which service it searches (Pexels, Unsplash, or Pixabay) is chosen once in Settings and applies everywhere. Whatever you pick from the results gets downloaded and copied into permanent local storage - never hot-linked.

**Sound** - search Freesound, preview results before committing, or upload your own file. Playback on the species page is a simple toggle button.

**Edit-anything, remove-anything** - every photo slot, every fact row, every related-species row, the sound clip, all have their own remove control, available identically whether you're creating a new record or editing a saved one.

---

## 11. Code Walkthrough By File

### `main.js`
Storage helpers (`ensureStorage`, `readDB`/`writeDB`, `readConfig`/`writeConfig`, `copyFileToStore`) sit at the top. Below that, `createWindow()` builds the actual window (now pointing at `build/icon.png` for its icon). Everything after that is **17 `ipcMain.handle` blocks** - one per thing the renderer is allowed to ask for, nothing more. Three small provider-specific search functions (`searchPexels`, `searchUnsplash`, `searchPixabay`) normalize each service's different response shape into one common `{id, thumb, full}` format before it ever reaches the renderer, so `app.js` never has to know which provider is active. A shared `callGroq()` helper handles every AI request - four different features (`aiAutofill`, `aiCaption`, `aiScientificName`, `checkCategory`) all funnel through it, each with their own prompt and either plain-text or JSON-mode response handling.

### `preload.js`
18 exposed methods, one line each - this is the complete list of everything the webpage side of the app can possibly do. Nothing here does real work itself; every line just relays to `main.js` over IPC.

### `renderer/index.html`
Five `<section class="view">` blocks (landing, categories, list, species, and the shared add/edit form) plus three modals (settings, image search, sound search). Only one view is ever visible at a time - `app.js` controls that by toggling an `active` class.

### `renderer/styles.css`
CSS custom properties define the whole color language once (`--gold`, `--canopy`, etc.), then five `body.theme-<category>` blocks override them - which is the entire mechanism behind the instant realm re-theming. The `.tactical-frame` class draws the corner-bracket accents purely in CSS via two pseudo-elements, no extra markup needed anywhere it's applied.

### `renderer/app.js`
One large `state` object tracks what's currently on screen (which realm, which record, whether the form is in add or edit mode, which category-check override is active). Every other function either reads that object to decide what to draw, or updates it in response to a click. The file is organized in the order you'd actually use the app: navigation first, then the species template renderer, then the entire add/edit form logic, then the three modals (settings, image search, sound search) at the bottom.

---

## 12. Every Function, Explained

### `main.js`

| Function | What it does |
|---|---|
| `ensureStorage()` | Creates the data/images/tmp folders and empty `db.json`/`config.json` on first run |
| `clearTmpDir()` | Wipes leftover downloaded search files on every app startup |
| `readDB()` / `writeDB()` | Load/save the full array of records |
| `readConfig()` / `writeConfig()` | Load/save your saved API keys and provider choice |
| `copyFileToStore(sourcePath, recordId)` | Copies any file - photo or sound - into that record's permanent folder |
| `createWindow()` | Builds the actual app window, sets its icon and title |
| `gaba:getAll` / `gaba:getByCategory` | Return records, optionally filtered to one realm |
| `gaba:search` | Filters every record by whether the query appears in name/scientific name/description/category/habitat/facts |
| `gaba:pickImage` / `gaba:pickSound` | Open native file-choose dialogs |
| `gaba:addSpecies` | Builds a new record, copies every attached photo and sound into permanent storage |
| `gaba:updateSpecies` | Replaces whichever fields were sent, copying in any *new* files while leaving already-stored ones alone, and deleting any file no longer referenced afterward |
| `gaba:deleteSpecies` | Removes a record and its entire folder |
| `gaba:getConfig` / `gaba:saveConfig` | Read/write your saved settings |
| `searchPexels` / `searchUnsplash` / `searchPixabay` | Provider-specific search calls, normalized to one common result shape |
| `gaba:searchImages` | Picks the right provider function based on your Settings choice |
| `gaba:downloadFileToTemp` | Downloads any URL (photo or sound) to a temp file, ready to be treated like a locally-picked file |
| `gaba:searchSounds` | Calls the real Freesound API |
| `callGroq(apiKey, prompt, jsonMode)` | Shared helper every AI feature calls under the hood |
| `gaba:aiAutofill` | Full description + facts + related species + scientific name + habitat draft |
| `gaba:aiCaption` | One short caption, tuned per photo field |
| `gaba:aiScientificName` | Just the binomial Latin name |
| `gaba:checkCategory` | Asks whether a name fits its chosen realm, suggests the right one if not |

### `renderer/app.js`

| Function | What it does |
|---|---|
| `showView(id)` | Hides every screen, shows exactly one; also stops any playing sound if you're leaving the species page |
| `applyCategoryTheme(category)` | Swaps the color theme via `<body>`'s class |
| `refreshCategoryCounts()` | Updates the "N records" text on each of the five category cards |
| `openList()` / `renderList()` | Load and draw the index page for a realm |
| `openSpeciesAt()` / `renderSpecies()` | Load and draw the full template page for one record, including hiding any detail-row with no photo |
| `toggleSpeciesSound()` / `stopSpeciesAudio()` | Play/pause the species-page sound button |
| `makeTile()` / `setImg()` | Small reusable builders for thumbnails and image sources |
| `openAddForm()` / `openEditForm()` | Open the shared form blank, or fully pre-filled from an existing record |
| `resetAddForm()` | Clears every field, including the newer ones (scientific name, habitat, sound, category) |
| `addFactRow()` / `addRelatedRow()` | Add one more editable row of either kind |
| `setFieldImage()` / `clearFieldImage()` | Attach or remove a photo on any of the eight image slots |
| `setSound()` / `clearSound()` | Attach or remove the record's sound clip |
| `buildPayload()` | Gathers every field on the form into one object ready to save |
| `performSave()` | Calls `addSpecies` or `updateSpecies` depending on form mode, then navigates to the result |
| `openSettings()` / `closeSettings()` | Drive the API-key modal, now with five keys and a provider dropdown |
| `openImagePicker()` / `runImageSearch()` | Drive the shared photo search-and-pick modal, provider-aware |
| `openSoundPicker()` / `runSoundSearch()` | Drive the sound search-and-pick modal, with inline preview playback |

---

## 13. Everything Done, In Order

**v1 - the original build:** landing, categories, species template matching your reference image, an add-record form, universal search, local JSON + local image storage.

**v2:** renamed to `ghaba`, delete button, matched captions across eye/face/feet/footprint, category color theming, tactical corner-bracket accents, richer gradients, split into list-page-then-detail flow, first AI auto-fill (description/facts/related) with a Groq key in Settings.

**v3:** Pexels-powered photo search across every image field, full edit mode for removing anything after save (later superseded by v5's full edit form).

**v4:** per-photo AI caption buttons, remove-before-saving on every photo slot in the add form.

**v5 (this pass):** the icon, em-dash removal everywhere including AI prompts, larger and more readable fonts (Lora), and then the big one - full record editing via the shared add/edit form, sound support via Freesound, three switchable photo providers, scientific name, habitat, fur/skin, AI category-mismatch checking, the layout fix making all six detail sections visually consistent, and the fifth realm, Insects.

---


