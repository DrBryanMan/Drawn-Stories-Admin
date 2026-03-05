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
          <label class="aim-label">CV ID тому</label>
          <input type="number" id="aim-cvvolid" placeholder="CV Vol ID..." style="width:100%;">
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
      <div id="aim-select-all-row" style="display:none; align-items:center; justify-content:space-between; padding:0.5rem 0.75rem; margin-bottom:0.5rem; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:8px;">
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
  ['aim-name', 'aim-volume', 'aim-number', 'aim-cvvolid'].forEach(id => {
    document.getElementById(id).addEventListener('input', scheduleSearch);
  });
  document.getElementById('aim-exact').addEventListener('change', scheduleSearch);

  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _modal?.classList.contains('active')) closeAddIssueModal();
  });

  injectStyles();
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

  ['aim-name', 'aim-volume', 'aim-number', 'aim-cvvolid'].forEach(id => {
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

  const name    = document.getElementById('aim-name').value.trim();
  const volume  = document.getElementById('aim-volume').value.trim();
  const number  = document.getElementById('aim-number').value.trim();
  const cvVolId = document.getElementById('aim-cvvolid').value.trim();
  const exact   = document.getElementById('aim-exact').checked;

  const el = document.getElementById('aim-results');

  if (!name && !volume && !number && !cvVolId) {
    el.innerHTML = '';
    updateSelectAllRow([]);
    return;
  }

  el.innerHTML = '<div class="aim-empty">Пошук...</div>';

  const searchParams = new URLSearchParams({ limit: 60 });
  if (name)    searchParams.set('name', name);
  if (volume)  searchParams.set('volume_name', volume);
  if (number)  searchParams.set('issue_number', number);
  if (cvVolId) searchParams.set(_config.cvVolIdParam ?? 'volume_id', cvVolId);
  if (exact)   searchParams.set('exact', 'true');

  try {
    const endpoint = _config.searchEndpoint ?? `${_config.apiBase}/issues`;
    const res = await fetch(`${endpoint}?${searchParams}`);
    const result = await res.json();
    const data = result.data || [];

    if (!data.length) {
      el.innerHTML = '<div class="aim-empty">Нічого не знайдено</div>';
      updateSelectAllRow([]);
      return;
    }

    el.innerHTML = data.map(issue => {
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
            <div class="aim-card-meta">${issue.volume_name || ''}${issue.issue_number ? ' #' + issue.issue_number : ''}</div>
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

// ── Стилі ───────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('add-issue-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'add-issue-modal-styles';
  style.textContent = `
    .add-issue-modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 1100;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    .add-issue-modal-overlay.active {
      display: flex;
    }
    .add-issue-modal-box {
      background: var(--bg-primary);
      border-radius: 12px;
      padding: 1.75rem;
      width: 980px;
      max-width: 96vw;
      max-height: 92vh;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    }
    .aim-filters {
      display: grid;
      grid-template-columns: 2fr 2fr 1fr 1fr auto;
      gap: 0.9rem;
      margin-bottom: 1.25rem;
      align-items: flex-end;
    }
    .aim-label {
      font-size: 0.82rem;
      display: block;
      margin-bottom: 0.3rem;
      color: var(--text-secondary);
    }
    .aim-results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
      gap: 0.9rem;
      padding: 0.8rem;
      max-height: 380px;
      overflow-y: auto;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      background: var(--bg-secondary);
    }
    .aim-empty {
      grid-column: 1 / -1;
      padding: 2rem 1rem;
      text-align: center;
      color: var(--text-tertiary);
      font-size: 0.95rem;
    }
    .aim-card {
      display: flex;
      flex-direction: column;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
      transition: all 0.18s ease;
      position: relative;
      height: 100%;
      cursor: pointer;
    }
    .aim-card:hover {
      border-color: var(--accent);
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.18);
    }
    .aim-card--added {
      opacity: 0.4;
      filter: grayscale(0.7);
      pointer-events: none;
      cursor: not-allowed;
    }
    .aim-card--selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 3.5px rgba(var(--accent-rgb), 0.35);
    }
    .aim-card--selected::after {
      content: '✓';
      position: absolute;
      top: 10px;
      right: 10px;
      background: var(--accent);
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 16px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      z-index: 2;
    }
    .aim-card-img {
      width: 100%;
      aspect-ratio: 2 / 3;
      object-fit: cover;
      object-position: top;
      display: block;
      background: #0f0f0f;
    }
    .aim-card-placeholder {
      aspect-ratio: 2 / 3;
      background: linear-gradient(145deg, #1e1e1e, #111);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.4rem;
      color: #555;
    }
    .aim-card-info {
      padding: 0.6rem 0.75rem;
      font-size: 0.8rem;
      line-height: 1.3;
      flex-grow: 1;
    }
    .aim-card-name {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .aim-card-meta {
      color: var(--text-tertiary);
      font-size: 0.74rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 0.2rem;
    }
    .aim-footer {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 1.25rem;
    }
  `;
  document.head.appendChild(style);
}