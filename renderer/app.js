(() => {
  const state = {
    category: null,      // realm currently being browsed
    list: [],
    index: 0,
    addImages: {},         // field -> local path, live while the form is open
    addSound: null,         // local path to the currently-attached sound, or null
    formMode: 'add',         // 'add' | 'edit'
    editingId: null,
    categoryCheckOverride: false, // true once the user clicks "Save anyway" for this attempt
  };

  const CATEGORIES = ['plants', 'animals', 'birds', 'fishes', 'insects'];

  let currentAudio = null; // the single <audio> used for species-page sound playback

  function stopSpeciesAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const btn = document.getElementById('s-sound-btn');
    btn.classList.remove('playing');
    btn.querySelector('span:last-child').textContent = 'Play call';
  }

  // ---------- view switching ----------
  function showView(id) {
    if (id !== 'view-species') stopSpeciesAudio();
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function applyCategoryTheme(category) {
    document.body.className = category ? `theme-${category}` : '';
  }

  async function refreshCategoryCounts() {
    const all = await window.gaba.getAll();
    CATEGORIES.forEach((c) => {
      const el = document.querySelector(`.cat-count[data-count="${c}"]`);
      const n = all.filter((s) => s.category === c).length;
      el.textContent = `${n} record${n === 1 ? '' : 's'}`;
    });
  }

  // ---------- landing ----------
  document.getElementById('btn-enter').addEventListener('click', async () => {
    applyCategoryTheme(null);
    await refreshCategoryCounts();
    showView('view-categories');
  });
  document.getElementById('btn-home').addEventListener('click', () => {
    applyCategoryTheme(null);
    showView('view-landing');
  });

  // ---------- categories -> list page ----------
  document.querySelectorAll('.category-card').forEach((card) => {
    card.addEventListener('click', async () => {
      state.category = card.dataset.category;
      applyCategoryTheme(state.category);
      await openList(state.category);
    });
  });
  document.getElementById('btn-back-cat').addEventListener('click', async () => {
    applyCategoryTheme(null);
    await refreshCategoryCounts();
    showView('view-categories');
  });

  async function openList(category) {
    state.list = await window.gaba.getByCategory(category);
    document.getElementById('list-category-label').textContent = category;
    renderList();
    showView('view-list');
  }

  function renderList() {
    const empty = document.getElementById('list-empty');
    const grid = document.getElementById('list-grid');
    grid.innerHTML = '';

    if (!state.list.length) {
      empty.classList.add('show');
    } else {
      empty.classList.remove('show');
      state.list.forEach((s, i) => {
        const card = document.createElement('button');
        card.className = 'list-card';
        card.type = 'button';
        const img = document.createElement('img');
        img.src = s.images.main ? window.gaba.toFileUrl(s.images.main) : '';
        const name = document.createElement('div');
        name.className = 'list-card-name';
        name.textContent = s.name;
        const desc = document.createElement('div');
        desc.className = 'list-card-desc';
        desc.textContent = s.description || '';
        card.appendChild(img);
        card.appendChild(name);
        card.appendChild(desc);
        card.addEventListener('click', () => openSpeciesAt(i));
        grid.appendChild(card);
      });
    }

    const addTile = document.createElement('button');
    addTile.type = 'button';
    addTile.className = 'add-tile';
    addTile.innerHTML = '<span class="add-tile-plus">＋</span><span class="add-tile-label">Add new record</span>';
    addTile.addEventListener('click', () => openAddForm(state.category));
    grid.appendChild(addTile);
  }

  function openSpeciesAt(i) {
    state.index = i;
    document.getElementById('species-category-label').textContent = state.category;
    showView('view-species');
    renderSpecies();
  }

  document.getElementById('btn-back-list').addEventListener('click', async () => {
    state.list = await window.gaba.getByCategory(state.category);
    renderList();
    showView('view-list');
  });

  // ---------- species navigation ----------
  document.getElementById('btn-prev').addEventListener('click', () => {
    if (!state.list.length) return;
    state.index = (state.index - 1 + state.list.length) % state.list.length;
    renderSpecies();
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    if (!state.list.length) return;
    state.index = (state.index + 1) % state.list.length;
    renderSpecies();
  });

  function renderSpecies() {
    stopSpeciesAudio();
    const card = document.getElementById('species-card');
    const posEl = document.getElementById('species-position');

    if (!state.list.length) {
      card.classList.remove('show');
      posEl.textContent = '0 / 0';
      return;
    }
    card.classList.add('show');
    posEl.textContent = `${state.index + 1} / ${state.list.length}`;

    const s = state.list[state.index];
    setImg('s-main-img', s.images.main);
    setImg('s-secondary-img', s.images.secondary);
    document.getElementById('s-name').textContent = s.name;
    document.getElementById('s-scientific').textContent = s.scientificName || '';
    document.getElementById('s-description').textContent = s.description || '';

    const factsEl = document.getElementById('s-facts');
    factsEl.innerHTML = '';
    (s.facts || []).forEach((f) => {
      const li = document.createElement('li');
      li.textContent = f;
      factsEl.appendChild(li);
    });
    if (s.captions && s.captions.habitat) {
      const li = document.createElement('li');
      li.textContent = 'Habitat: ' + s.captions.habitat;
      factsEl.appendChild(li);
    }

    const DETAIL_ROW_FIELDS = ['eye', 'face', 'feet', 'fur', 'footprint', 'habitat'];
    DETAIL_ROW_FIELDS.forEach((field) => {
      const row = document.getElementById(`row-${field}`);
      const hasImage = !!s.images[field];
      row.style.display = hasImage ? 'flex' : 'none';
      if (hasImage) {
        setImg(`s-${field}-img`, s.images[field]);
        document.getElementById(`s-${field}-caption`).textContent = (s.captions && s.captions[field]) || '';
      }
    });

    const soundBtn = document.getElementById('s-sound-btn');
    if (s.sound) {
      soundBtn.style.display = 'flex';
      soundBtn.onclick = () => toggleSpeciesSound(s.sound);
    } else {
      soundBtn.style.display = 'none';
    }

    const bottom = document.getElementById('s-bottom-row');
    bottom.innerHTML = '';
    (s.related || []).forEach((r) => {
      if (!r.image && !r.label) return;
      bottom.appendChild(makeTile(r.image, r.label || 'Related species'));
    });
  }

  function toggleSpeciesSound(soundPath) {
    const btn = document.getElementById('s-sound-btn');
    if (currentAudio) {
      stopSpeciesAudio();
      return;
    }
    currentAudio = new Audio(window.gaba.toFileUrl(soundPath));
    currentAudio.addEventListener('ended', stopSpeciesAudio);
    currentAudio.play();
    btn.classList.add('playing');
    btn.querySelector('span:last-child').textContent = 'Pause';
  }

  function makeTile(imgPath, label) {
    const div = document.createElement('div');
    div.className = 'bottom-tile';
    const img = document.createElement('img');
    img.src = imgPath ? window.gaba.toFileUrl(imgPath) : '';
    const cap = document.createElement('div');
    cap.className = 'bottom-tile-label';
    cap.textContent = label || '';
    div.appendChild(img);
    div.appendChild(cap);
    return div;
  }

  function setImg(id, path) {
    const el = document.getElementById(id);
    el.src = path ? window.gaba.toFileUrl(path) : '';
  }

  // ---------- delete whole record ----------
  document.getElementById('btn-delete').addEventListener('click', async () => {
    if (!state.list.length) return;
    const s = state.list[state.index];
    const ok = window.confirm(`Delete "${s.name}" permanently? Its photos and sound will be removed from disk too.`);
    if (!ok) return;
    await window.gaba.deleteSpecies(s.id);
    state.list = await window.gaba.getByCategory(state.category);
    renderList();
    showView('view-list');
  });

  // ---------- edit an existing record ----------
  document.getElementById('btn-edit-record').addEventListener('click', () => {
    if (!state.list.length) return;
    openEditForm(state.list[state.index]);
  });

  // ---------- search (shared logic for all three search boxes) ----------
  function wireSearch(inputId, resultsId) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    let timer = null;

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value;
      timer = setTimeout(async () => {
        if (!q.trim()) { results.classList.remove('show'); return; }
        const matches = await window.gaba.search(q);
        results.innerHTML = '';
        if (!matches.length) {
          const div = document.createElement('div');
          div.className = 'search-empty';
          div.textContent = 'No records match that yet.';
          results.appendChild(div);
        } else {
          matches.slice(0, 12).forEach((m) => {
            const row = document.createElement('div');
            row.className = 'search-result-item';
            const img = document.createElement('img');
            img.src = m.images.main ? window.gaba.toFileUrl(m.images.main) : '';
            const textWrap = document.createElement('div');
            const name = document.createElement('div');
            name.className = 'search-result-name';
            name.textContent = m.name;
            const cat = document.createElement('div');
            cat.className = 'search-result-cat';
            cat.textContent = m.category;
            textWrap.appendChild(name);
            textWrap.appendChild(cat);
            row.appendChild(img);
            row.appendChild(textWrap);
            row.addEventListener('click', async () => {
              state.category = m.category;
              applyCategoryTheme(m.category);
              document.getElementById('species-category-label').textContent = m.category;
              state.list = await window.gaba.getByCategory(m.category);
              state.index = Math.max(0, state.list.findIndex((x) => x.id === m.id));
              results.classList.remove('show');
              input.value = '';
              showView('view-species');
              renderSpecies();
            });
            results.appendChild(row);
          });
        }
        results.classList.add('show');
      }, 180);
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.classList.remove('show');
      }
    });
  }
  wireSearch('search-input', 'search-results');
  wireSearch('search-input-list', 'search-results-list');
  wireSearch('search-input-2', 'search-results-2');

  // ==========================================================
  // ADD / EDIT FORM (shared between creating and editing records)
  // ==========================================================

  function openAddForm(category) {
    resetAddForm();
    state.formMode = 'add';
    state.editingId = null;
    document.getElementById('f-category').value = category || state.category || 'plants';
    document.getElementById('form-heading').textContent = 'new record';
    showView('view-add');
  }

  function openEditForm(record) {
    resetAddForm();
    state.formMode = 'edit';
    state.editingId = record.id;
    document.getElementById('form-heading').textContent = `edit - ${record.name}`;

    document.getElementById('f-category').value = record.category;
    document.getElementById('f-name').value = record.name || '';
    document.getElementById('f-scientific').value = record.scientificName || '';
    document.getElementById('f-description').value = record.description || '';

    document.getElementById('f-facts-list').innerHTML = '';
    const facts = (record.facts && record.facts.length) ? record.facts : [''];
    facts.forEach((f) => addFactRow(f));

    ['eye', 'face', 'feet', 'fur', 'footprint', 'habitat'].forEach((field) => {
      const cap = document.querySelector(`[data-caption="${field}"]`);
      if (cap) cap.value = (record.captions && record.captions[field]) || '';
    });

    ['main', 'secondary', 'eye', 'face', 'feet', 'fur', 'footprint', 'habitat'].forEach((field) => {
      const p = record.images && record.images[field];
      if (p) setFieldImage(field, p);
    });

    if (record.sound) setSound(record.sound, record.sound.split(/[\\/]/).pop());

    document.getElementById('f-related-list').innerHTML = '';
    (record.related || []).forEach((r) => addRelatedRow(r.label || '', r.image || null));

    showView('view-add');
  }

  document.getElementById('btn-list-add').addEventListener('click', () => openAddForm(state.category));
  document.getElementById('btn-add-new').addEventListener('click', () => openAddForm(state.category));
  document.getElementById('btn-empty-add').addEventListener('click', () => openAddForm(state.category));

  async function backToListFromForm() {
    state.list = await window.gaba.getByCategory(state.category);
    renderList();
    showView('view-list');
  }
  document.getElementById('btn-cancel-add').addEventListener('click', backToListFromForm);
  document.getElementById('btn-add-cancel-2').addEventListener('click', backToListFromForm);

  // ---------- facts ----------
  function addFactRow(value = '') {
    const list = document.getElementById('f-facts-list');
    const row = document.createElement('div');
    row.className = 'fact-row';
    const input = document.createElement('input');
    input.className = 'field-input';
    input.type = 'text';
    input.placeholder = 'e.g. Native to the Western Ghats';
    input.value = value;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'fact-remove';
    remove.textContent = '×';
    remove.addEventListener('click', () => row.remove());
    row.appendChild(input);
    row.appendChild(remove);
    list.appendChild(row);
  }
  document.getElementById('f-add-fact').addEventListener('click', () => addFactRow());

  // ---------- related species ----------
  // Each row keeps its chosen image path directly on the DOM node (row.gabaPath),
  // so removing a row from the DOM automatically removes it from the saved data.
  function addRelatedRow(prefillLabel = '', prefillPath = null) {
    const list = document.getElementById('f-related-list');
    const row = document.createElement('div');
    row.className = 'related-row';
    row.gabaPath = prefillPath;

    const img = document.createElement('img');
    if (prefillPath) img.src = window.gaba.toFileUrl(prefillPath);
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'btn-tiny';
    pick.textContent = 'Add photo';
    const label = document.createElement('input');
    label.className = 'field-input';
    label.type = 'text';
    label.placeholder = 'Species name';
    label.value = prefillLabel;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'fact-remove';
    remove.textContent = '×';

    pick.addEventListener('click', () => {
      openImagePicker(label.value.trim(), (path) => {
        row.gabaPath = path;
        img.src = window.gaba.toFileUrl(path);
      });
    });
    remove.addEventListener('click', () => row.remove());

    row.appendChild(img);
    row.appendChild(label);
    row.appendChild(pick);
    row.appendChild(remove);
    list.appendChild(row);
  }
  document.getElementById('f-add-related').addEventListener('click', () => addRelatedRow());

  // ---------- image fields (main/secondary/eye/face/feet/fur/footprint/habitat) ----------
  function setFieldImage(field, path) {
    state.addImages[field] = path;
    const preview = document.querySelector(`.img-preview[data-preview="${field}"]`);
    const removeBtn = document.querySelector(`.img-remove[data-remove="${field}"]`);
    preview.src = window.gaba.toFileUrl(path);
    preview.classList.add('show');
    removeBtn.classList.add('show');
  }
  function clearFieldImage(field) {
    delete state.addImages[field];
    const preview = document.querySelector(`.img-preview[data-preview="${field}"]`);
    const removeBtn = document.querySelector(`.img-remove[data-remove="${field}"]`);
    preview.src = '';
    preview.classList.remove('show');
    removeBtn.classList.remove('show');
  }
  document.querySelectorAll('.img-picker').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.target;
      const name = document.getElementById('f-name').value.trim();
      const hint = btn.dataset.queryHint || '';
      const defaultQuery = [name, hint].filter(Boolean).join(' ');
      openImagePicker(defaultQuery, (path) => setFieldImage(field, path));
    });
  });
  document.querySelectorAll('.img-remove').forEach((btn) => {
    btn.addEventListener('click', () => clearFieldImage(btn.dataset.remove));
  });

  // ---------- sound field ----------
  function setSound(path, displayName) {
    state.addSound = path;
    document.getElementById('sound-preview-name').textContent = displayName || 'sound file attached';
    document.getElementById('sound-preview-wrap').style.display = 'flex';
  }
  function clearSound() {
    state.addSound = null;
    document.getElementById('sound-preview-wrap').style.display = 'none';
  }
  document.getElementById('btn-sound-add').addEventListener('click', () => {
    const name = document.getElementById('f-name').value.trim();
    openSoundPicker(name, (path, displayName) => setSound(path, displayName));
  });
  document.getElementById('btn-sound-remove').addEventListener('click', clearSound);

  function resetAddForm() {
    document.getElementById('add-form').reset();
    document.getElementById('f-facts-list').innerHTML = '';
    document.getElementById('f-related-list').innerHTML = '';
    document.getElementById('ai-status').textContent = '';
    document.getElementById('ai-status').classList.remove('error');
    document.getElementById('category-warning').style.display = 'none';
    state.addImages = {};
    state.addSound = null;
    state.categoryCheckOverride = false;
    document.querySelectorAll('.img-preview').forEach((p) => { p.src = ''; p.classList.remove('show'); });
    document.querySelectorAll('.img-remove').forEach((b) => b.classList.remove('show'));
    document.getElementById('sound-preview-wrap').style.display = 'none';
    addFactRow();
    addFactRow();
  }

  // ---------- AI: full auto-fill ----------
  document.getElementById('btn-ai-fill').addEventListener('click', async () => {
    const nameInput = document.getElementById('f-name');
    const statusEl = document.getElementById('ai-status');
    const name = nameInput.value.trim();
    statusEl.classList.remove('error');

    if (!name) {
      statusEl.textContent = 'Type a name first, then auto-fill.';
      statusEl.classList.add('error');
      nameInput.focus();
      return;
    }
    const cfg = await window.gaba.getConfig();
    if (!cfg.groqApiKey) {
      statusEl.textContent = 'No Groq API key saved yet - opening settings.';
      statusEl.classList.add('error');
      openSettings();
      return;
    }

    const btn = document.getElementById('btn-ai-fill');
    btn.disabled = true;
    statusEl.textContent = 'Asking the AI for a draft...';
    const category = document.getElementById('f-category').value;

    try {
      const result = await window.gaba.aiAutofill({ name, category, apiKey: cfg.groqApiKey });
      document.getElementById('f-description').value = result.description || '';
      document.getElementById('f-scientific').value = result.scientificName || document.getElementById('f-scientific').value;
      const habitatInput = document.querySelector('[data-caption="habitat"]');
      if (habitatInput && result.habitat) habitatInput.value = result.habitat;

      document.getElementById('f-facts-list').innerHTML = '';
      const facts = result.facts && result.facts.length ? result.facts : [''];
      facts.forEach((f) => addFactRow(f));

      document.getElementById('f-related-list').innerHTML = '';
      (result.related || []).forEach((label) => addRelatedRow(label));

      statusEl.classList.remove('error');
      statusEl.textContent = 'Draft filled in - review and edit anything before saving.';
    } catch (err) {
      statusEl.classList.add('error');
      statusEl.textContent = err.message || 'AI auto-fill failed.';
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- AI: scientific name (standalone button) ----------
  document.querySelector('[data-sci-name]').addEventListener('click', async () => {
    const nameInput = document.getElementById('f-name');
    const statusEl = document.getElementById('ai-status');
    const name = nameInput.value.trim();
    statusEl.classList.remove('error');
    if (!name) {
      statusEl.textContent = 'Type a name first, then auto-fill.';
      statusEl.classList.add('error');
      nameInput.focus();
      return;
    }
    const cfg = await window.gaba.getConfig();
    if (!cfg.groqApiKey) {
      statusEl.textContent = 'No Groq API key saved yet - opening settings.';
      statusEl.classList.add('error');
      openSettings();
      return;
    }
    const btn = document.querySelector('[data-sci-name]');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = '…';
    try {
      const category = document.getElementById('f-category').value;
      const result = await window.gaba.aiScientificName({ name, category, apiKey: cfg.groqApiKey });
      document.getElementById('f-scientific').value = result.scientificName || '';
      statusEl.classList.remove('error');
      statusEl.textContent = 'Scientific name filled in.';
    } catch (err) {
      statusEl.classList.add('error');
      statusEl.textContent = err.message || 'AI lookup failed.';
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  // ---------- AI: per-field captions (eye/face/feet/fur/footprint/habitat) ----------
  document.querySelectorAll('.btn-caption-ai[data-caption-field]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const field = btn.dataset.captionField;
      const nameInput = document.getElementById('f-name');
      const statusEl = document.getElementById('ai-status');
      const name = nameInput.value.trim();
      statusEl.classList.remove('error');
      if (!name) {
        statusEl.textContent = 'Type a name first, then auto-fill captions.';
        statusEl.classList.add('error');
        nameInput.focus();
        return;
      }
      const cfg = await window.gaba.getConfig();
      if (!cfg.groqApiKey) {
        statusEl.textContent = 'No Groq API key saved yet - opening settings.';
        statusEl.classList.add('error');
        openSettings();
        return;
      }
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = '…';
      try {
        const category = document.getElementById('f-category').value;
        const result = await window.gaba.aiCaption({ name, category, field, apiKey: cfg.groqApiKey });
        document.querySelector(`[data-caption="${field}"]`).value = result.caption || '';
        statusEl.classList.remove('error');
        statusEl.textContent = `${field} caption filled in - review before saving.`;
      } catch (err) {
        statusEl.classList.add('error');
        statusEl.textContent = err.message || 'AI caption failed.';
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });

  // ---------- submit (handles both add and edit, with a category sanity check) ----------
  function buildPayload() {
    const category = document.getElementById('f-category').value;
    const name = document.getElementById('f-name').value.trim();
    const scientificName = document.getElementById('f-scientific').value.trim();
    const description = document.getElementById('f-description').value.trim();
    const facts = Array.from(document.querySelectorAll('#f-facts-list input')).map((i) => i.value.trim());

    const captions = {};
    document.querySelectorAll('[data-caption]').forEach((el) => {
      captions[el.dataset.caption] = el.value.trim();
    });

    const related = Array.from(document.querySelectorAll('#f-related-list .related-row'))
      .map((row) => ({ path: row.gabaPath, label: row.querySelector('input').value.trim() }))
      .filter((r) => r.path || r.label);

    return { category, name, scientificName, description, facts, images: { ...state.addImages }, captions, sound: state.addSound, related };
  }

  async function performSave(payload) {
    let saved;
    if (state.formMode === 'edit' && state.editingId) {
      saved = await window.gaba.updateSpecies(state.editingId, payload);
    } else {
      saved = await window.gaba.addSpecies(payload);
    }
    state.category = saved.category;
    applyCategoryTheme(saved.category);
    document.getElementById('species-category-label').textContent = saved.category;
    state.list = await window.gaba.getByCategory(saved.category);
    state.index = Math.max(0, state.list.findIndex((x) => x.id === saved.id));
    state.categoryCheckOverride = false;
    showView('view-species');
    renderSpecies();
  }

  document.getElementById('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('f-name').value.trim();
    if (!name) return;

    const payload = buildPayload();
    const warningBox = document.getElementById('category-warning');
    const statusEl = document.getElementById('ai-status');

    if (!state.categoryCheckOverride) {
      const cfg = await window.gaba.getConfig();
      if (cfg.groqApiKey) {
        try {
          const check = await window.gaba.checkCategory({ name, category: payload.category, apiKey: cfg.groqApiKey });
          if (!check.match && check.suggestedCategory !== payload.category) {
            document.getElementById('category-warning-text').textContent =
              `"${name}" looks like it might belong under ${check.suggestedCategory}, not ${payload.category}.`;
            const useSuggestedBtn = document.getElementById('btn-use-suggested');
            useSuggestedBtn.textContent = `Use ${check.suggestedCategory}`;
            useSuggestedBtn.onclick = () => {
              document.getElementById('f-category').value = check.suggestedCategory;
              warningBox.style.display = 'none';
              document.getElementById('add-form').requestSubmit();
            };
            warningBox.style.display = 'flex';
            return;
          }
        } catch (err) {
          // If the check itself fails (e.g. bad key), don't block saving - just skip it.
        }
      }
    }

    warningBox.style.display = 'none';
    try {
      await performSave(payload);
    } catch (err) {
      statusEl.classList.add('error');
      statusEl.textContent = err.message || 'Could not save this record.';
    }
  });

  document.getElementById('btn-save-anyway').addEventListener('click', () => {
    state.categoryCheckOverride = true;
    document.getElementById('category-warning').style.display = 'none';
    document.getElementById('add-form').requestSubmit();
  });

  // ---------- settings modal ----------
  function openSettings() {
    window.gaba.getConfig().then((cfg) => {
      document.getElementById('f-groq-key').value = cfg.groqApiKey || '';
      document.getElementById('f-pexels-key').value = cfg.pexelsApiKey || '';
      document.getElementById('f-unsplash-key').value = cfg.unsplashApiKey || '';
      document.getElementById('f-pixabay-key').value = cfg.pixabayApiKey || '';
      document.getElementById('f-freesound-key').value = cfg.freesoundApiKey || '';
      document.getElementById('f-image-provider').value = cfg.imageProvider || 'pexels';
    });
    document.getElementById('settings-overlay').classList.add('show');
  }
  function closeSettings() {
    document.getElementById('settings-overlay').classList.remove('show');
  }
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('btn-settings-cancel').addEventListener('click', closeSettings);
  document.getElementById('btn-settings-save').addEventListener('click', async () => {
    await window.gaba.saveConfig({
      groqApiKey: document.getElementById('f-groq-key').value.trim(),
      pexelsApiKey: document.getElementById('f-pexels-key').value.trim(),
      unsplashApiKey: document.getElementById('f-unsplash-key').value.trim(),
      pixabayApiKey: document.getElementById('f-pixabay-key').value.trim(),
      freesoundApiKey: document.getElementById('f-freesound-key').value.trim(),
      imageProvider: document.getElementById('f-image-provider').value,
    });
    closeSettings();
  });
  document.getElementById('settings-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'settings-overlay') closeSettings();
  });

  // ---------- image search / add-photo modal ----------
  let currentImageOnSelect = null;

  function openImagePicker(defaultQuery, onSelect) {
    currentImageOnSelect = onSelect;
    document.getElementById('img-search-query').value = defaultQuery || '';
    document.getElementById('img-search-results').innerHTML = '';
    document.getElementById('img-search-results').classList.remove('has-results');
    document.getElementById('img-search-status').textContent = '';
    document.getElementById('img-search-status').classList.remove('error');
    document.getElementById('image-search-overlay').classList.add('show');
    if (defaultQuery) runImageSearch(defaultQuery);
  }
  function closeImagePicker() {
    document.getElementById('image-search-overlay').classList.remove('show');
    currentImageOnSelect = null;
  }

  async function runImageSearch(query) {
    const statusEl = document.getElementById('img-search-status');
    const grid = document.getElementById('img-search-results');
    statusEl.classList.remove('error');
    if (!query || !query.trim()) {
      statusEl.textContent = 'Type something to search for.';
      statusEl.classList.add('error');
      return;
    }
    const cfg = await window.gaba.getConfig();
    const provider = cfg.imageProvider || 'pexels';
    const keyMap = { pexels: cfg.pexelsApiKey, unsplash: cfg.unsplashApiKey, pixabay: cfg.pixabayApiKey };
    const apiKey = keyMap[provider];
    if (!apiKey) {
      statusEl.textContent = `No ${provider} API key saved yet - opening settings.`;
      statusEl.classList.add('error');
      closeImagePicker();
      openSettings();
      return;
    }

    statusEl.textContent = 'Searching...';
    grid.innerHTML = '';
    grid.classList.remove('has-results');

    try {
      const results = await window.gaba.searchImages(query, provider, apiKey);
      if (!results.length) {
        statusEl.textContent = 'No results - try a different search, or upload your own.';
        return;
      }
      statusEl.textContent = `${results.length} results from ${provider} - click one to use it.`;
      grid.classList.add('has-results');
      results.forEach((r) => {
        const cell = document.createElement('div');
        cell.className = 'img-result';
        const img = document.createElement('img');
        img.src = r.thumb;
        img.loading = 'lazy';
        cell.appendChild(img);
        cell.addEventListener('click', async () => {
          statusEl.textContent = 'Downloading...';
          try {
            const localPath = await window.gaba.downloadFileToTemp(r.full);
            if (currentImageOnSelect) currentImageOnSelect(localPath);
            closeImagePicker();
          } catch (err) {
            statusEl.textContent = err.message || 'Download failed.';
            statusEl.classList.add('error');
          }
        });
        grid.appendChild(cell);
      });
    } catch (err) {
      statusEl.textContent = err.message || 'Search failed.';
      statusEl.classList.add('error');
    }
  }

  document.getElementById('btn-img-search-go').addEventListener('click', () => runImageSearch(document.getElementById('img-search-query').value));
  document.getElementById('img-search-query').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); runImageSearch(e.target.value); }
  });
  document.getElementById('btn-img-search-upload').addEventListener('click', async () => {
    const path = await window.gaba.pickImage();
    if (path && currentImageOnSelect) currentImageOnSelect(path);
    if (path) closeImagePicker();
  });
  document.getElementById('btn-img-search-cancel').addEventListener('click', closeImagePicker);
  document.getElementById('image-search-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'image-search-overlay') closeImagePicker();
  });

  // ---------- sound search / add-sound modal ----------
  let currentSoundOnSelect = null;
  let previewAudio = null;

  function openSoundPicker(defaultQuery, onSelect) {
    currentSoundOnSelect = onSelect;
    document.getElementById('snd-search-query').value = defaultQuery || '';
    document.getElementById('snd-search-results').innerHTML = '';
    document.getElementById('snd-search-status').textContent = '';
    document.getElementById('snd-search-status').classList.remove('error');
    document.getElementById('sound-search-overlay').classList.add('show');
    if (defaultQuery) runSoundSearch(defaultQuery);
  }
  function closeSoundPicker() {
    if (previewAudio) { previewAudio.pause(); previewAudio = null; }
    document.getElementById('sound-search-overlay').classList.remove('show');
    currentSoundOnSelect = null;
  }

  async function runSoundSearch(query) {
    const statusEl = document.getElementById('snd-search-status');
    const list = document.getElementById('snd-search-results');
    statusEl.classList.remove('error');
    if (!query || !query.trim()) {
      statusEl.textContent = 'Type something to search for.';
      statusEl.classList.add('error');
      return;
    }
    const cfg = await window.gaba.getConfig();
    if (!cfg.freesoundApiKey) {
      statusEl.textContent = 'No Freesound API key saved yet - opening settings.';
      statusEl.classList.add('error');
      closeSoundPicker();
      openSettings();
      return;
    }
    statusEl.textContent = 'Searching...';
    list.innerHTML = '';
    try {
      const results = await window.gaba.searchSounds(query, cfg.freesoundApiKey);
      if (!results.length) {
        statusEl.textContent = 'No results - try a different search, or upload your own.';
        return;
      }
      statusEl.textContent = `${results.length} results - preview or use one.`;
      results.forEach((r) => {
        const row = document.createElement('div');
        row.className = 'sound-result';

        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'sound-result-play';
        playBtn.textContent = '▶';
        playBtn.addEventListener('click', () => {
          if (previewAudio) { previewAudio.pause(); previewAudio = null; }
          if (playBtn.textContent === '▶') {
            previewAudio = new Audio(r.previewUrl);
            previewAudio.play();
            playBtn.textContent = '⏸';
            previewAudio.addEventListener('ended', () => { playBtn.textContent = '▶'; });
          } else {
            playBtn.textContent = '▶';
          }
        });

        const info = document.createElement('div');
        info.className = 'sound-result-info';
        const nameEl = document.createElement('div');
        nameEl.className = 'sound-result-name';
        nameEl.textContent = r.name;
        const metaEl = document.createElement('div');
        metaEl.className = 'sound-result-meta';
        metaEl.textContent = `${r.username} - ${Math.round(r.duration)}s`;
        info.appendChild(nameEl);
        info.appendChild(metaEl);

        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'btn-tiny sound-result-use';
        useBtn.textContent = 'Use this';
        useBtn.addEventListener('click', async () => {
          statusEl.textContent = 'Downloading...';
          try {
            const localPath = await window.gaba.downloadFileToTemp(r.previewUrl);
            if (currentSoundOnSelect) currentSoundOnSelect(localPath, r.name);
            closeSoundPicker();
          } catch (err) {
            statusEl.textContent = err.message || 'Download failed.';
            statusEl.classList.add('error');
          }
        });

        row.appendChild(playBtn);
        row.appendChild(info);
        row.appendChild(useBtn);
        list.appendChild(row);
      });
    } catch (err) {
      statusEl.textContent = err.message || 'Search failed.';
      statusEl.classList.add('error');
    }
  }

  document.getElementById('btn-snd-search-go').addEventListener('click', () => runSoundSearch(document.getElementById('snd-search-query').value));
  document.getElementById('snd-search-query').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); runSoundSearch(e.target.value); }
  });
  document.getElementById('btn-snd-search-upload').addEventListener('click', async () => {
    const path = await window.gaba.pickSound();
    if (path && currentSoundOnSelect) currentSoundOnSelect(path, path.split(/[\\/]/).pop());
    if (path) closeSoundPicker();
  });
  document.getElementById('btn-snd-search-cancel').addEventListener('click', closeSoundPicker);
  document.getElementById('sound-search-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'sound-search-overlay') closeSoundPicker();
  });

  // start on landing
  showView('view-landing');
})();
