// public/js/components/addCollectionModal.js
//
// Уніфікована модалка для додавання збірників (підтримка мульти-вибору)
//
// API:
//   openAddCollectionModal(config)
//   closeAddCollectionModal()
//
// config = {
//   title          : string               — заголовок модалки
//   alreadyIds     : Set<number>          — ID вже доданих збірників (для блокування)
//   apiBase        : string               — базовий URL API
//   cvImgPathSmall : string               — префікс для зображень
//   onAdd(collectionIds: number[])        — колбек при натисканні «Додати вибрані»
// }

let _modal = null;
let _config = null;
let _searchTimeout = null;
let _selectedIds = new Set();
let _currentResults = [];

// ── Ін'єкція DOM один раз ────────────────────────────────────────────────

function ensureModal() {
  if (document.getElementById('add-collection-unified-modal')) return;

  const el = document.createElement('div');
  el.id = 'add-collection-unified-modal';
  el.className = 'acm-overlay';
  el.innerHTML = `
    <div class="acm-box">
      <h3 id="acm-title" style="margin-bottom:1rem;"></h3>

      <div class="acm-filters">
        <div class="form-group" style="margin:0;">
          <label class="acm-label">Назва збірника</label>
          <input type="text" id="acm-name" placeholder="Пошук..." style="width:100%;">
        </div>
        <div style="display:flex; align-items:flex-end;">
          <button class="btn btn-primary" id="acm-search-btn" style="white-space:nowrap;">🔍 Знайти</button>
        </div>
      </div>

      <!-- Рядок "Вибрати всі" -->
      <div id="acm-select-all-row" style="display:none; align-items:center; gap:0.75rem; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:var(--bg-secondary); border-radius:8px; border:1px solid var(--border-color);">
        <input type="checkbox" id="acm-select-all-checkbox" style="width:16px;height:16px;cursor:pointer;">
        <label for="acm-select-all-checkbox" style="cursor:pointer; font-size:0.9rem;">
          Вибрати всі <span id="acm-select-all-count"></span>
        </label>
        <span id="acm-select-all-hint" style="color:var(--text-secondary); font-size:0.82rem; margin-left:auto;"></span>
      </div>

      <div id="acm-results-grid" class="acm-results-grid">
        <div class="acm-empty">Введіть назву збірника для пошуку</div>
      </div>

      <div class="acm-footer">
        <button class="btn btn-secondary" id="acm-cancel-btn">Скасувати</button>
        <button class="btn btn-primary" id="acm-confirm-btn" style="display:none;">
          Додати вибрані (<span id="acm-selected-count">0</span>)
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  el.addEventListener('click', (e) => { if (e.target === el) closeAddCollectionModal(); });
  document.getElementById('acm-cancel-btn').addEventListener('click', closeAddCollectionModal);
  document.getElementById('acm-confirm-btn').addEventListener('click', confirmSelection);
  document.getElementById('acm-search-btn').addEventListener('click', triggerSearch);
  document.getElementById('acm-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') triggerSearch();
  });
  document.getElementById('acm-name').addEventListener('input', () => {
    clearTimeout(_searchTimeout);
    _searchTimeout = setTimeout(triggerSearch, 400);
  });
  document.getElementById('acm-select-all-checkbox').addEventListener('change', (e) => {
    toggleSelectAll(e.target.checked);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _modal?.classList.contains('active')) closeAddCollectionModal();
  });

  injectStyles();
  _modal = el;
}

// ── Публічні функції ─────────────────────────────────────────────────────

export function openAddCollectionModal(config) {
  _config = config;
  _selectedIds = new Set();
  _currentResults = [];
  ensureModal();

  document.getElementById('acm-title').textContent = config.title || 'Додати збірник';
  document.getElementById('acm-name').value = '';
  document.getElementById('acm-results-grid').innerHTML = '<div class="acm-empty">Введіть назву збірника для пошуку</div>';
  document.getElementById('acm-confirm-btn').style.display = 'none';
  document.getElementById('acm-selected-count').textContent = '0';
  document.getElementById('acm-select-all-row').style.display = 'none';

  _modal.classList.add('active');
  setTimeout(() => document.getElementById('acm-name').focus(), 50);
}

export function closeAddCollectionModal() {
  _modal?.classList.remove('active');
  _config = null;
  _selectedIds.clear();
  _currentResults = [];
}

// ── Пошук ────────────────────────────────────────────────────────────────

function triggerSearch() {
  const name = document.getElementById('acm-name').value.trim();
  if (!name) {
    document.getElementById('acm-results-grid').innerHTML = '<div class="acm-empty">Введіть назву збірника для пошуку</div>';
    updateSelectAllRow([]);
    return;
  }
  performSearch(name);
}

async function performSearch(name) {
  const el = document.getElementById('acm-results-grid');
  el.innerHTML = '<div class="acm-empty">⏳ Пошук...</div>';

  try {
    const params = new URLSearchParams({ search: name, limit: 40 });
    const res = await fetch(`${_config.apiBase}/collections/search?${params}`);
    const result = await res.json();
    const data = result.data || [];

    if (!data.length) {
      el.innerHTML = '<div class="acm-empty">Нічого не знайдено</div>';
      updateSelectAllRow([]);
      return;
    }

    el.innerHTML = data.map(col => {
      const alreadyAdded = _config?.alreadyIds?.has(col.id);
      const selected = _selectedIds.has(col.id);
      const imgSrc = col.cv_img
        ? `${_config.cvImgPathSmall}${col.cv_img.startsWith('/') ? '' : '/'}${col.cv_img}`
        : null;

      const metaParts = [];
      if (col.volume_name) metaParts.push(col.volume_name);
      if (col.issue_number) metaParts.push('#' + col.issue_number);
      if (col.cv_id) metaParts.push('CV: ' + col.cv_id);
      const meta = metaParts.join(' · ');

      return `
        <div class="acm-card ${alreadyAdded ? 'acm-card--added' : ''}${selected ? ' acm-card--selected' : ''}"
             data-col-id="${col.id}"
             title="${(col.name || '').replace(/"/g, '&quot;')}">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="" class="acm-card-img" loading="lazy">`
            : '<div class="acm-card-placeholder">📚</div>'}
          <div class="acm-card-info">
            <div class="acm-card-name">${col.name || 'Без назви'}</div>
            <div class="acm-card-meta">${meta}</div>
          </div>
          ${alreadyAdded ? '<div class="acm-card-badge">✓ Вже додано</div>' : ''}
        </div>
      `;
    }).join('');

    el.querySelectorAll('.acm-card:not(.acm-card--added)').forEach(card => {
      card.addEventListener('click', () => toggleSelection(parseInt(card.dataset.colId), card));
    });

    updateSelectAllRow(data);

  } catch (err) {
    el.innerHTML = '<div class="acm-empty" style="color:var(--danger);">Помилка пошуку</div>';
    updateSelectAllRow([]);
    console.error('addCollectionModal search error:', err);
  }
}

// ── Вибір ────────────────────────────────────────────────────────────────

function toggleSelection(colId, cardEl) {
  if (_selectedIds.has(colId)) {
    _selectedIds.delete(colId);
    cardEl.classList.remove('acm-card--selected');
  } else {
    _selectedIds.add(colId);
    cardEl.classList.add('acm-card--selected');
  }
  updateConfirmBtn();
  updateSelectAllRow(_currentResults);
}

function updateConfirmBtn() {
  const btn = document.getElementById('acm-confirm-btn');
  const count = _selectedIds.size;
  document.getElementById('acm-selected-count').textContent = count;
  btn.style.display = count > 0 ? 'inline-flex' : 'none';
}

function updateSelectAllRow(data) {
  const row      = document.getElementById('acm-select-all-row');
  const checkbox = document.getElementById('acm-select-all-checkbox');
  const countEl  = document.getElementById('acm-select-all-count');
  const hint     = document.getElementById('acm-select-all-hint');
  if (!row) return;

  const available = data.filter(c => !_config?.alreadyIds?.has(c.id));
  _currentResults = available;

  if (available.length === 0) { row.style.display = 'none'; return; }

  const alreadyCount = data.length - available.length;
  row.style.display = 'flex';
  countEl.textContent = `(${available.length})`;
  hint.textContent = alreadyCount > 0 ? `${alreadyCount} вже додано` : '';

  const allSelected = available.every(c => _selectedIds.has(c.id));
  checkbox.checked = allSelected && available.length > 0;
}

function toggleSelectAll(checked) {
  _currentResults.forEach(col => {
    const card = document.querySelector(`.acm-card[data-col-id="${col.id}"]`);
    if (checked) {
      _selectedIds.add(col.id);
      card?.classList.add('acm-card--selected');
    } else {
      _selectedIds.delete(col.id);
      card?.classList.remove('acm-card--selected');
    }
  });
  updateConfirmBtn();
}

// ── Підтвердження ────────────────────────────────────────────────────────

async function confirmSelection() {
  if (!_config?.onAdd || !_selectedIds.size) return;
  const ids = Array.from(_selectedIds);
  const onAdd = _config.onAdd;   // зберігаємо до закриття
  closeAddCollectionModal();
  await onAdd(ids);
}

// ── Стилі ────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('add-collection-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'add-collection-modal-styles';
  style.textContent = `
    .acm-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 1100;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    .acm-overlay.active { display: flex; }
    .acm-box {
      background: var(--bg-primary);
      border-radius: 12px;
      padding: 1.75rem;
      width: 860px;
      max-width: 96vw;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    }
    .acm-filters {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.9rem;
      margin-bottom: 1.25rem;
      align-items: flex-end;
    }
    .acm-label {
      font-size: 0.82rem;
      display: block;
      margin-bottom: 0.3rem;
      color: var(--text-secondary);
    }
    .acm-results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
      gap: 0.9rem;
      padding: 0.8rem;
      max-height: 420px;
      overflow-y: auto;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      background: var(--bg-secondary);
      flex: 1;
    }
    .acm-empty {
      grid-column: 1 / -1;
      padding: 2rem 1rem;
      text-align: center;
      color: var(--text-tertiary);
      font-size: 0.95rem;
    }
    .acm-card {
      display: flex;
      flex-direction: column;
      background: var(--bg-primary);
      border: 2px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
      transition: all 0.18s ease;
      position: relative;
      cursor: pointer;
    }
    .acm-card:hover:not(.acm-card--added) {
      border-color: var(--accent);
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.18);
    }
    .acm-card--added {
      opacity: 0.4;
      filter: grayscale(0.7);
      pointer-events: none;
    }
    .acm-card--selected {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 12%, var(--bg-primary));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent);
    }
    .acm-card-img {
      width: 100%;
      aspect-ratio: 2/3;
      object-fit: cover;
      display: block;
    }
    .acm-card-placeholder {
      width: 100%;
      aspect-ratio: 2/3;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      background: var(--bg-secondary);
    }
    .acm-card-info {
      padding: 0.5rem 0.6rem;
      flex: 1;
    }
    .acm-card-name {
      font-size: 0.8rem;
      font-weight: 600;
      line-height: 1.3;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .acm-card-meta {
      font-size: 0.72rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .acm-card-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      background: var(--success, #28a745);
      color: #fff;
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .acm-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
    }
  `;
  document.head.appendChild(style);
}