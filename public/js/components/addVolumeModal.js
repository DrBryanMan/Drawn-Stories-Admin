// public/js/components/addVolumeModal.js
//
// Уніфікована модалка для додавання томів (підтримка мульти-вибору)
//
// API:
//   openAddVolumeModal(config)
//   closeAddVolumeModal()
//
// config = {
//   title          : string               — заголовок модалки
//   alreadyIds     : Set<number>          — ID вже доданих томів (для блокування)
//   apiBase        : string               — базовий URL API
//   cvImgPathSmall : string               — префікс для зображень
//   onAdd(volumeIds: number[])            — колбек при натисканні «Додати вибрані»
// }

let _modal = null;
let _config = null;
let _searchTimeout = null;
let _selectedVolumeIds = new Set();

// ── Ін'єкція DOM один раз ────────────────────────────────────────────────

function ensureModal() {
  if (document.getElementById('add-volume-unified-modal')) return;

  const el = document.createElement('div');
  el.id = 'add-volume-unified-modal';
  el.className = 'avm-overlay';
  el.innerHTML = `
    <div class="avm-box">
      <h3 id="avm-title" style="margin-bottom:1rem;"></h3>

      <div class="avm-filters">
        <div class="form-group" style="margin:0;">
          <label class="avm-label">Назва тому</label>
          <input type="text" id="avm-name" placeholder="Пошук..." style="width:100%;">
        </div>
        <div style="display:flex; align-items:flex-end;">
          <button class="btn btn-primary" id="avm-search-btn" style="white-space:nowrap;">🔍 Знайти</button>
        </div>
      </div>

      <div id="avm-results-grid" class="avm-results-grid">
        <div class="avm-empty">Введіть назву тому для пошуку</div>
      </div>

      <div class="avm-footer">
        <button class="btn btn-secondary" id="avm-cancel-btn">Скасувати</button>
        <button class="btn btn-primary" id="avm-confirm-btn" style="display:none;">
          Додати вибрані (<span id="avm-selected-count">0</span>)
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  el.addEventListener('click', (e) => { if (e.target === el) closeAddVolumeModal(); });
  document.getElementById('avm-cancel-btn').addEventListener('click', closeAddVolumeModal);
  document.getElementById('avm-confirm-btn').addEventListener('click', confirmSelection);
  document.getElementById('avm-search-btn').addEventListener('click', triggerSearch);
  document.getElementById('avm-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') triggerSearch(); });
  document.getElementById('avm-name').addEventListener('input', () => {
    clearTimeout(_searchTimeout);
    _searchTimeout = setTimeout(triggerSearch, 400);
  });

  injectStyles();
  _modal = el;
}

// ── Публічні функції ─────────────────────────────────────────────────────

export function openAddVolumeModal(config) {
  _config = config;
  _selectedVolumeIds = new Set();
  ensureModal();

  document.getElementById('avm-title').textContent = config.title || 'Додати том';
  document.getElementById('avm-name').value = '';
  document.getElementById('avm-results-grid').innerHTML =
    '<div class="avm-empty">Введіть назву тому для пошуку</div>';
  document.getElementById('avm-confirm-btn').style.display = 'none';
  document.getElementById('avm-selected-count').textContent = '0';

  _modal.classList.add('active');
  setTimeout(() => document.getElementById('avm-name').focus(), 50);
}

export function closeAddVolumeModal() {
  if (_modal) _modal.classList.remove('active');
  _selectedVolumeIds = new Set();
  _config = null;
}

// ── Пошук ────────────────────────────────────────────────────────────────

function triggerSearch() {
  const query = document.getElementById('avm-name').value.trim();
  if (!query) return;
  performSearch(query);
}

async function performSearch(query) {
  const el = document.getElementById('avm-results-grid');
  el.innerHTML = '<div class="avm-empty">Пошук...</div>';

  try {
    const res = await fetch(`${_config.apiBase}/volumes?search=${encodeURIComponent(query)}&limit=40`);
    const result = await res.json();
    const volumes = result.data || [];

    if (!volumes.length) {
      el.innerHTML = '<div class="avm-empty">Нічого не знайдено</div>';
      return;
    }

    el.innerHTML = volumes.map(vol => {
      const alreadyAdded = _config.alreadyIds?.has(vol.id);
      const selected = _selectedVolumeIds.has(vol.id);
      const imgSrc = vol.cv_img
        ? `${_config.cvImgPathSmall}${vol.cv_img.startsWith('/') ? '' : '/'}${vol.cv_img}`
        : null;

      return `
        <div class="avm-card${alreadyAdded ? ' avm-card--added' : ''}${selected ? ' avm-card--selected' : ''}"
             data-vol-id="${vol.id}"
             title="${(vol.name || '').replace(/"/g, '&quot;')}">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="" class="avm-card-img" loading="lazy">`
            : '<div class="avm-card-placeholder">📚</div>'}
          <div class="avm-card-info">
            <div class="avm-card-name">${vol.name || 'Без назви'}</div>
            <div class="avm-card-meta">${vol.issue_count ? '📖 ' + vol.issue_count : ''}${vol.lang ? ' · ' + vol.lang.toUpperCase() : ''}</div>
          </div>
          ${alreadyAdded ? '<div class="avm-card-badge">✓ Вже додано</div>' : ''}
        </div>
      `;
    }).join('');

    el.querySelectorAll('.avm-card:not(.avm-card--added)').forEach(card => {
      card.addEventListener('click', () => toggleSelection(parseInt(card.dataset.volId), card));
    });

  } catch (err) {
    el.innerHTML = '<div class="avm-empty" style="color:var(--danger);">Помилка пошуку</div>';
    console.error('addVolumeModal search error:', err);
  }
}

function toggleSelection(volId, cardEl) {
  if (_selectedVolumeIds.has(volId)) {
    _selectedVolumeIds.delete(volId);
    cardEl.classList.remove('avm-card--selected');
  } else {
    _selectedVolumeIds.add(volId);
    cardEl.classList.add('avm-card--selected');
  }
  updateConfirmBtn();
}

function updateConfirmBtn() {
  const btn = document.getElementById('avm-confirm-btn');
  const count = _selectedVolumeIds.size;
  document.getElementById('avm-selected-count').textContent = count;
  btn.style.display = count > 0 ? 'inline-flex' : 'none';
}

async function confirmSelection() {
  if (!_config?.onAdd || !_selectedVolumeIds.size) return;
  const ids = Array.from(_selectedVolumeIds);
  const onAdd = _config.onAdd;
  closeAddVolumeModal();
  await onAdd(ids);
}

// ── Стилі ────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('add-volume-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'add-volume-modal-styles';
  style.textContent = `
    .avm-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 1100;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    .avm-overlay.active { display: flex; }
    .avm-box {
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
    .avm-filters {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.9rem;
      margin-bottom: 1.25rem;
      align-items: flex-end;
    }
    .avm-label {
      font-size: 0.82rem;
      display: block;
      margin-bottom: 0.3rem;
      color: var(--text-secondary);
    }
    .avm-results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
      gap: 0.75rem;
      overflow-y: auto;
      flex: 1;
      min-height: 220px;
      max-height: 52vh;
      padding: 0.25rem;
    }
    .avm-empty {
      grid-column: 1 / -1;
      text-align: center;
      color: var(--text-secondary);
      padding: 3rem 1rem;
      font-size: 0.95rem;
    }
    .avm-card {
      position: relative;
      border: 2px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
      background: var(--bg-secondary);
    }
    .avm-card:hover {
      border-color: var(--primary);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .avm-card--selected {
      border-color: var(--primary) !important;
      background: color-mix(in srgb, var(--primary) 10%, var(--bg-secondary));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 25%, transparent);
    }
    .avm-card--added {
      opacity: 0.5;
      cursor: default;
      pointer-events: none;
    }
    .avm-card-img {
      width: 100%;
      aspect-ratio: 2/3;
      object-fit: cover;
      display: block;
    }
    .avm-card-placeholder {
      width: 100%;
      aspect-ratio: 2/3;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      background: var(--bg-tertiary, var(--bg-secondary));
    }
    .avm-card-info {
      padding: 0.4rem 0.5rem 0.5rem;
    }
    .avm-card-name {
      font-size: 0.78rem;
      font-weight: 600;
      line-height: 1.3;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .avm-card-meta {
      font-size: 0.7rem;
      color: var(--text-secondary);
      margin-top: 0.2rem;
    }
    .avm-card-badge {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      text-align: center;
      background: rgba(0,0,0,0.6);
      color: #fff;
      font-size: 0.7rem;
      padding: 0.25rem 0.4rem;
    }
    .avm-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
}