// public/js/components/addIssueModal.js
//
// Уніфікована модалка для додавання випусків (підтримка мульти-вибору)
//
// API:
//   openAddIssueModal(config)
//   closeAddIssueModal()
//
// config = {
//   title          : string               — заголовок модалки
//   alreadyIds     : Set<number>          — ID вже доданих випусків (для фільтрації)
//   showImportance : boolean              — показувати вибір важливості (для подій)
//   apiBase        : string               — базовий URL API
//   cvImgPathSmall : string               — префікс для зображень
//   onAdd(issueIds: number[], importance?) — колбек при натисканні «Додати вибрані»
//   searchEndpoint  : string   — повний URL для пошуку; за замовч. `${apiBase}/issues`
//   nameLabel       : string   — лейбл першого поля;    за замовч. 'Назва випуску'
//   namePlaceholder : string   — placeholder;           за замовч. 'Назва...'
//   cardIcon        : string   — іконка-заглушка;       за замовч. '📖'
//   cvVolIdParam    : string   — назва query-param для CV Vol ID; за замовч. 'volume_id'
// }

const IMPORTANCE_OPTIONS = [
  { value: 'main',     label: 'Основний' },
  { value: 'tie-in',   label: 'Тай-ін'   },
  { value: 'prologue', label: 'Пролог'   },
  { value: 'epilogue', label: 'Епілог'   },
];

let _modal = null;
let _config = null;
let _searchTimeout = null;
let _selectedIssueIds = new Set();      // множина обраних
let _currentSearchResults = [];         // доступні результати поточного пошуку

// ── Ін'єкція DOM один раз ────────────────────────────────────────────────

function ensureModal() {
  if (document.getElementById('add-issue-unified-modal')) return;

  const el = document.createElement('div');
  el.id = 'add-issue-unified-modal';
  el.className = 'add-issue-modal-overlay';
  el.innerHTML = `
    <div class="add-issue-modal-box">
      <h3 id="aim-title" style="margin-bottom:1rem;"></h3>

      <div class="aim-filters">
        <div class="form-group" style="margin:0;">
          <label class="aim-label" id="aim-name-label">Назва випуску</label>
          <input type="text" id="aim-name" placeholder="Назва..." style="width:100%;">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="aim-label">Назва тому</label>
          <input type="text" id="aim-volume" placeholder="Том..." style="width:100%;">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="aim-label">Номер</label>
          <input type="text" id="aim-number" placeholder="#..." style="width:100%;">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="aim-label">DS ID (БД)</label>
          <input type="number" id="aim-ds-id" placeholder="DS ID..." style="width:100%;">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="aim-label">CV ID</label>
          <input type="number" id="aim-cvvolid" placeholder="CV Vol ID..." style="width:100%;">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="aim-label">x-slug</label>
          <input type="text" id="aim-hikka-slug" placeholder="напр. berserk" style="width:100%;">
        </div>
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <label class="aim-label" style="color:var(--text-secondary);">Точна назва</label>
          <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; height:36px;">
            <input type="checkbox" id="aim-exact" style="width:auto; margin:0; accent-color:var(--accent);">
            <span style="font-size:0.85rem;">Точно</span>
          </label>
        </div>
      </div>

      <!-- Рядок "Вибрати всі" -->
      <div id="aim-select-all-row">
        <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; font-size:0.88rem; user-select:none;">
          <input type="checkbox" id="aim-select-all-checkbox" style="width:16px; height:16px; margin:0; accent-color:var(--accent);">
          <span>Вибрати всі</span>
          <span id="aim-select-all-count" style="color:var(--text-secondary);"></span>
        </label>
        <span id="aim-select-all-hint" style="font-size:0.78rem; color:var(--text-tertiary);"></span>
      </div>

      <div id="aim-results" class="aim-results-grid"></div>

      <div id="aim-importance-block" style="display:none; margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <span id="aim-selected-label" style="color:var(--text-secondary); font-size:0.9rem;"></span>
          <button class="btn btn-secondary" id="aim-change-btn" style="font-size:0.8rem; padding:0.25rem 0.6rem;">Змінити</button>
        </div>
        <label style="display:block; margin-bottom:0.5rem; font-weight:600;">Важливість</label>
        <select id="aim-importance" style="width:100%; padding:0.5rem; border:1px solid var(--border-color); border-radius:6px;">
          ${IMPORTANCE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>

      <div class="aim-footer">
        <button class="btn btn-secondary" id="aim-cancel-btn">Скасувати</button>
        <button class="btn btn-primary" id="aim-multi-confirm-btn" style="display:none;">
          Додати вибрані (<span id="aim-selected-count">0</span>)
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  _modal = el;

  // Закриття по кліку на фон
  el.addEventListener('click', (e) => {
    if (e.target === el) closeAddIssueModal();
  });

  document.getElementById('aim-cancel-btn').addEventListener('click', closeAddIssueModal);

  // Кнопка "Додати вибрані"
  document.getElementById('aim-multi-confirm-btn').addEventListener('click', (e) => {
    if (!_config || _selectedIssueIds.size === 0) return;
    const importance = _config.showImportance
      ? document.getElementById('aim-importance')?.value
      : undefined;
    const ids   = Array.from(_selectedIssueIds);
    const onAdd = _config.onAdd;
    e.currentTarget.disabled = true;
    closeAddIssueModal();
    onAdd(ids, importance);
  });

  // Чекбокс "Вибрати всі"
  document.getElementById('aim-select-all-checkbox').addEventListener('change', (e) => {
    toggleSelectAll(e.target.checked);
  });

  // Пошук
  ['aim-name', 'aim-volume', 'aim-number', 'aim-ds-id', 'aim-cvvolid', 'aim-hikka-slug'].forEach(id => {
    document.getElementById(id).addEventListener('input', scheduleSearch);
  });
  document.getElementById('aim-exact').addEventListener('change', scheduleSearch);

  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _modal?.classList.contains('active')) closeAddIssueModal();
  });
}

// ── Відкрити / Закрити ────────────────────────────────────────────────────

export function openAddIssueModal(config) {
  ensureModal();
  _config = config;
  _selectedIssueIds.clear();
  _currentSearchResults = [];

  document.getElementById('aim-title').textContent = config.title || 'Додати випуски';

  document.getElementById('aim-name-label').textContent =
    config.nameLabel ?? 'Назва випуску';
  document.getElementById('aim-name').placeholder =
    config.namePlaceholder ?? 'Назва...';

  ['aim-name', 'aim-volume', 'aim-number', 'aim-ds-id', 'aim-cvvolid', 'aim-hikka-slug'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('aim-exact').checked = false;
  document.getElementById('aim-importance-block').style.display = config.showImportance ? 'block' : 'none';

  updateConfirmButtonState();

  _modal.classList.add('active');
  document.getElementById('aim-name').focus();
}

export function closeAddIssueModal() {
  if (!_modal) return;
  _modal.classList.remove('active');
  _config = null;
  _selectedIssueIds.clear();
  _currentSearchResults = [];
  document.getElementById('aim-results').innerHTML = '';
  document.getElementById('aim-select-all-row').style.display = 'none';
  document.getElementById('aim-multi-confirm-btn').disabled = false;
  clearTimeout(_searchTimeout);
}

// ── Пошук ───────────────────────────────────────────────────────────────

function scheduleSearch() {
  clearTimeout(_searchTimeout);
  _searchTimeout = setTimeout(runSearch, 300);
}

async function runSearch() {
  if (!_config) return;

const name      = document.getElementById('aim-name').value.trim();
  const volume    = document.getElementById('aim-volume').value.trim();
  const number    = document.getElementById('aim-number').value.trim();
  const dsId      = document.getElementById('aim-ds-id').value.trim();
  const cvVolId   = document.getElementById('aim-cvvolid').value.trim();
  const hikkaSlug = document.getElementById('aim-hikka-slug').value.trim();
  const exact     = document.getElementById('aim-exact').checked;

  const el = document.getElementById('aim-results');

  if (!name && !volume && !number && !dsId && !cvVolId && !hikkaSlug) {
    el.innerHTML = '';
    updateSelectAllRow([]);
    return;
  }

  el.innerHTML = '<div class="aim-empty">Пошук...</div>';

  // Якщо введено Hikka Slug — резолвимо том щоб дістати ds_vol_id
  let resolvedDsVolId = null;
  if (hikkaSlug) {
    try {
      const volRes = await fetch(`${_config.apiBase}/volumes?hikka_slug=${encodeURIComponent(hikkaSlug)}&limit=1`);
      const volData = await volRes.json();
      const vol = volData.data?.[0];
      if (vol) {
        resolvedDsVolId = vol.id;
      } else {
        el.innerHTML = '<div class="aim-empty">Том з таким Hikka Slug не знайдено</div>';
        updateSelectAllRow([]);
        return;
      }
    } catch {
      el.innerHTML = '<div class="aim-empty" style="color:var(--danger);">Помилка резолву Hikka Slug</div>';
      updateSelectAllRow([]);
      return;
    }
  }

  const searchParams = new URLSearchParams({ limit: 50 });
  if (name)            searchParams.set('name', name);
  if (volume)          searchParams.set('volume_name', volume);
  if (number)          searchParams.set('issue_number', number);
  if (dsId)            searchParams.set('ds_id', dsId);
  if (cvVolId)         searchParams.set(_config.cvVolIdParam ?? 'volume_id', cvVolId);
  if (resolvedDsVolId) searchParams.set('ds_vol_id', resolvedDsVolId);
  if (exact)           searchParams.set('exact', 'true');

  try {
    const endpoint = _config.searchEndpoint ?? `${_config.apiBase}/issues`;
    const res = await fetch(`${endpoint}?${searchParams}`);    const result = await res.json();
    const data = result.data || [];

    if (!data.length) {
      el.innerHTML = '<div class="aim-empty">Нічого не знайдено</div>';
      updateSelectAllRow([]);
      return;
    }

    const sortedData = [...data].sort((a, b) => {
      const v = (a.volume_name || '').localeCompare(b.volume_name || '', 'uk');
      if (v !== 0) return v;
      return (parseFloat(b.issue_number) || 0) - (parseFloat(a.issue_number) || 0);
    });

    el.innerHTML = sortedData.map(issue => {
      const imgSrc = issue.cv_img
        ? `${_config.cvImgPathSmall}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}`
        : null;
      const alreadyAdded = _config.alreadyIds?.has(issue.id);
      const selected = _selectedIssueIds.has(issue.id);

      return `
        <div class="aim-card${alreadyAdded ? ' aim-card--added' : ''}${selected ? ' aim-card--selected' : ''}"
             data-issue-id="${issue.id}"
             title="${issue.name || 'Без назви'}">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="" class="aim-card-img" loading="lazy">`
            : `<div class="aim-card-placeholder">${_config.cardIcon ?? '📖'}</div>`}
          <div class="aim-card-info">
            <div class="aim-card-name">${issue.name || 'Без назви'}</div>
            <div class="aim-card-meta">${issue.volume_name || ''}</div>
            <div class="aim-card-name">${issue.issue_number || 'Без номеру'}</div>
          </div>
        </div>
      `;
    }).join('');

    updateSelectAllRow(data);

    el.querySelectorAll('.aim-card:not(.aim-card--added)').forEach(card => {
      card.addEventListener('click', () => {
        const issueId = parseInt(card.dataset.issueId);
        toggleIssueSelection(issueId, card);
      });
    });

  } catch (err) {
    el.innerHTML = '<div class="aim-empty" style="color:var(--danger);">Помилка пошуку</div>';
    updateSelectAllRow([]);
    console.error('addIssueModal search error:', err);
  }
}

function toggleIssueSelection(issueId, cardElement) {
  if (_selectedIssueIds.has(issueId)) {
    _selectedIssueIds.delete(issueId);
    cardElement.classList.remove('aim-card--selected');
  } else {
    _selectedIssueIds.add(issueId);
    cardElement.classList.add('aim-card--selected');
  }
  updateConfirmButtonState();
  updateSelectAllRow(_currentSearchResults);
}

function updateConfirmButtonState() {
  const btn = document.getElementById('aim-multi-confirm-btn');
  const countEl = document.getElementById('aim-selected-count');
  if (!btn || !countEl) return;

  const count = _selectedIssueIds.size;
  countEl.textContent = count;
  btn.style.display = count > 0 ? 'inline-flex' : 'none';
}

// ── "Вибрати всі" ────────────────────────────────────────────────────────

function updateSelectAllRow(data) {
  const row      = document.getElementById('aim-select-all-row');
  const checkbox = document.getElementById('aim-select-all-checkbox');
  const countEl  = document.getElementById('aim-select-all-count');
  const hint     = document.getElementById('aim-select-all-hint');
  if (!row) return;

  // Тільки ті, що ще не додані
  const available = data.filter(i => !_config?.alreadyIds?.has(i.id));
  _currentSearchResults = available;

  if (available.length === 0) {
    row.style.display = 'none';
    return;
  }

  const alreadyCount = data.length - available.length;
  row.style.display = 'flex';
  countEl.textContent = `(${available.length})`;
  hint.textContent = alreadyCount > 0 ? `${alreadyCount} вже додано` : '';

  // Синхронізуємо стан чекбоксу
  const allSelected  = available.every(i => _selectedIssueIds.has(i.id));
  const someSelected = available.some(i => _selectedIssueIds.has(i.id));
  checkbox.checked       = allSelected;
  checkbox.indeterminate = someSelected && !allSelected;
}

function toggleSelectAll(checked) {
  const available = _currentSearchResults;
  if (!available.length) return;

  if (checked) {
    available.forEach(i => _selectedIssueIds.add(i.id));
  } else {
    available.forEach(i => _selectedIssueIds.delete(i.id));
  }

  // Оновлюємо візуальний стан карток
  document.getElementById('aim-results')
    .querySelectorAll('.aim-card:not(.aim-card--added)')
    .forEach(card => {
      const id = parseInt(card.dataset.issueId);
      if (_selectedIssueIds.has(id)) {
        card.classList.add('aim-card--selected');
      } else {
        card.classList.remove('aim-card--selected');
      }
    });

  updateConfirmButtonState();

  const checkbox = document.getElementById('aim-select-all-checkbox');
  if (checkbox) checkbox.indeterminate = false;
}