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
      <h3 id="avm-title"></h3>

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
            <div class="avm-card-meta">
              ${vol.has_collection_theme ? '<span style="color:#7c3aed; font-weight:600;">📚 Збірник</span> · ' : ''}
              ${vol.issue_count ? '📖 ' + vol.issue_count : ''}${vol.lang ? ' · ' + vol.lang.toUpperCase() : ''}
            </div>
          </div>
          ${alreadyAdded ? '<div class="avm-card-badge">✓ Вже додано</div>' : ''}
        </div>
      `;
    }).join('');

    // Зберігаємо дані для варну
    if (!_config._volumeDataCache) _config._volumeDataCache = {};
    volumes.forEach(v => { _config._volumeDataCache[v.id] = v; });

    el.querySelectorAll('.avm-card:not(.avm-card--added)').forEach(card => {
      card.addEventListener('click', () => toggleSelection(parseInt(card.dataset.volId), card));
    });

  } catch (err) {
    el.innerHTML = '<div class="avm-empty">Помилка пошуку</div>';
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

  // Варн якщо серед вибраних є томи-збірники
  if (_config.warnCollectionVolume && _config._volumeDataCache) {
    const collectionVols = ids
      .map(id => _config._volumeDataCache[id])
      .filter(v => v?.has_collection_theme);
    if (collectionVols.length > 0) {
      const names = collectionVols.map(v => v.name).join(', ');
      const ok = confirm(
        `⚠️ Увага! Наступні томи є томами-збірниками і будуть відображатись у секції "Томи збірників":\n\n${names}\n\nПродовжити?`
      );
      if (!ok) return;
    }
  }

  const onAdd = _config.onAdd;
  closeAddVolumeModal();
  await onAdd(ids);
}