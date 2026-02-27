// catalog.js — спільний компонент для всіх сторінок-списків
// Розташування: public/js/components/catalog.js

import { fetchItems } from '../api/api.js';
import { showEmpty, showError, showLoading } from '../utils/helpers.js';
import { cv_img_path_original } from '../utils/helpers.js';
import { mountHeaderActions } from './headerActions.js';

// ── Стан модуля (один активний список за раз) ─────────────────────────────
let viewMode = 'grid';
let currentOffset = 0;
let currentSearch = '';
let currentCvId = '';           // ← нове поле для cv_id
let exactMatch = false;
const LIMIT = 100;

let _config = null;       // поточна конфігурація сторінки
let _lastData = null;     // останні завантажені дані (для перемикання виду без запиту)

// ── Публічний API ─────────────────────────────────────────────────────────

/**
 * Ініціалізує сторінку-список.
 * Скидає offset/search/exact, налаштовує UI, завантажує дані.
 */
export async function initListPage(config) {
  currentOffset = 0;
  currentSearch = '';
  currentCvId = '';
  exactMatch = false;
  _config = config;
  _lastData = null;

  mountHeaderActions();
  document.getElementById('page-title').textContent = config.title;
  setupAddBtn(config.onAdd);
  setupSearchArea();
  setupViewToggle();

  await loadAndRender();
}

/**
 * Перезавантажує поточний список без скидання стану (після edit/delete).
 */
export async function reloadCatalog() {
  if (_config) await loadAndRender();
}

// ── Налаштування UI ───────────────────────────────────────────────────────

function setupAddBtn(onAdd) {
  const btn = document.getElementById('add-btn');
  if (onAdd) {
    btn.style.display = 'block';
    btn.onclick = onAdd;
  } else {
    btn.style.display = 'none';
  }
}

function setupSearchArea() {
  // Прибираємо старі елементи, якщо є (при навігації між сторінками)
  document.getElementById('exact-match-wrapper')?.remove();
  document.getElementById('cv-id-search-wrapper')?.remove();

  const searchInput = document.getElementById('search-input');
  searchInput.style.display = 'inline-block';
  searchInput.style.width = '240px';
  searchInput.style.padding = '0.5rem';
  searchInput.style.border = '1px solid #ccc';
  searchInput.style.borderRadius = '4px';
  searchInput.style.fontSize = '1rem';
  searchInput.style.marginRight = '0.75rem';
  searchInput.value = currentSearch;

  // ── Чекбокс "Точне співпадіння" ──
  const exactWrapper = document.createElement('label');
  exactWrapper.id = 'exact-match-wrapper';
  exactWrapper.style.display = 'inline-flex';
  exactWrapper.style.alignItems = 'center';
  exactWrapper.style.gap = '0.4rem';
  exactWrapper.style.marginRight = '1.5rem';
  exactWrapper.innerHTML = `
    <input type="checkbox" id="exact-match-cb">
    <span>Точне</span>
  `;
  searchInput.insertAdjacentElement('afterend', exactWrapper);

  document.getElementById('exact-match-cb').onchange = (e) => {
    exactMatch = e.target.checked;
    currentOffset = 0;
    loadAndRender();
  };

  // ── Пошук по cv_id ──
  const cvWrapper = document.createElement('div');
  cvWrapper.id = 'cv-id-search-wrapper';
  cvWrapper.style.display = 'inline-flex';
  cvWrapper.style.alignItems = 'center';
  cvWrapper.style.gap = '0.5rem';

  const cvLabel = document.createElement('span');
  cvLabel.textContent = 'cv_id:';
  cvLabel.style.fontSize = '0.95rem';
  cvLabel.style.color = '#555';

  const cvInput = document.createElement('input');
  cvInput.type = 'text';
  cvInput.id = 'cv-id-input';
  cvInput.placeholder = 'наприклад 42513';
  cvInput.value = currentCvId;
  cvInput.style.width = '140px';
  cvInput.style.padding = '0.5rem';
  cvInput.style.border = '1px solid #ccc';
  cvInput.style.borderRadius = '4px';
  cvInput.style.fontSize = '1rem';

  cvWrapper.appendChild(cvLabel);
  cvWrapper.appendChild(cvInput);

  exactWrapper.insertAdjacentElement('afterend', cvWrapper);

  // Debounce для основного пошуку
  let debounceMain;
  searchInput.oninput = (e) => {
    clearTimeout(debounceMain);
    debounceMain = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentOffset = 0;
      loadAndRender();
    }, 350);
  };

  // Debounce для cv_id
  let debounceCv;
  cvInput.oninput = (e) => {
    clearTimeout(debounceCv);
    debounceCv = setTimeout(() => {
      currentCvId = e.target.value.trim();
      currentOffset = 0;
      loadAndRender();
    }, 350);
  };
}

function setupViewToggle() {
  const headerActions = document.querySelector('.header-actions');
  let toggle = document.getElementById('view-toggle');

  if (!toggle) {
    toggle = document.createElement('div');
    toggle.id = 'view-toggle';
    toggle.className = 'view-toggle';
    headerActions.appendChild(toggle);
  }

  updateToggleButtons(toggle);

  toggle.onclick = (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    viewMode = btn.dataset.view;
    updateToggleButtons(toggle);
    if (_lastData) renderItems(_lastData);
  };
}

function updateToggleButtons(toggle) {
  toggle.innerHTML = `
    <button class="btn-view ${viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Сітка">⊞</button>
    <button class="btn-view ${viewMode === 'table' ? 'active' : ''}" data-view="table" title="Таблиця">≡</button>
  `;
}

// ── Завантаження та рендер ─────────────────────────────────────────────────

async function loadAndRender() {
  showLoading();

  const params = { limit: LIMIT, offset: currentOffset };
  if (currentSearch)   params.search = currentSearch;
  if (exactMatch)      params.exact  = 'true';
  if (currentCvId)     params.cv_id  = currentCvId;     // ← передаємо cv_id в API

  try {
    const result = await fetchItems(_config.endpoint, params);
    _lastData = result.data;

    if (!result.data.length) {
      showEmpty('Нічого не знайдено');
      updatePagination(0);
      return;
    }

    renderItems(result.data);
    updatePagination(result.total);
  } catch (err) {
    console.error('Помилка каталогу:', err);
    showError('Помилка завантаження даних');
  }
}

function renderItems(items) {
  const content = document.getElementById('content');
  content.innerHTML = viewMode === 'grid' ? buildGrid(items) : buildTable(items);
  attachClickHandlers(content);
}

// ── Побудова Grid ──────────────────────────────────────────────────────────

function buildGrid(items) {
  const icon = _config.defaultIcon || '📄';
  const cards = items.map(item => {
    const imgUrl = resolveImageUrl(item);
    const title  = item[_config.titleKey] || 'Без назви';

    const badges = (_config.gridMeta || []).filter(m => m.badge);
    const meta   = (_config.gridMeta || []).filter(m => !m.badge);

    return `
      <div class="card" data-item-id="${item.id}" data-item-cv-id="${item.cv_id || ''}" style="cursor:pointer; position:relative">
        ${badges.map(m => {
          const v = item[m.key];
          
          if ((m.key === 'themes') && Array.isArray(v) && v.length > 0) {
            return v.slice(0, 4).map((theme, idx) => `
              <span class="badge badge-theme" 
                    style="position:absolute; bottom:0.5rem; left: calc(0.5rem + ${idx * 5}rem); z-index:1; font-size:0.7rem; padding:0.2rem 0.5rem;">
                ${theme.trim()}
              </span>
            `).join('');
          }
          return v != null && v !== ''
            ? `<span class="badge ${m.badgeClass || ''}" style="position:absolute; top:0.5rem; ${m.badgePosition || 'right:0.5rem'}; z-index:1">${m.prefix || ''}${v}</span>`
            : '';
        }).join('')}
        <div class="card-img">
          ${imgUrl
            ? `<img src="${imgUrl}" alt="${escapeAttr(title)}">`
            : `<div style="font-size:3rem">${icon}</div>`}
        </div>
        <div class="card-body">
          <div class="card-title">${title}</div>
          ${meta.map(m => {
            const v = item[m.key];
            return v != null && v !== ''
              ? `<div class="card-meta">${m.prefix || ''}${m.type === 'date' ? new Date(v).toLocaleDateString('uk-UA') : v}</div>`
              : '';
          }).join('')}
          ${_config.showActions !== false ? `
            <div class="card-actions">
              <button class="btn btn-secondary btn-small" data-action="edit" data-item-id="${item.id}">Редагувати</button>
              <button class="btn btn-danger btn-small"    data-action="delete" data-item-id="${item.id}">Видалити</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  });

  return `<div class="grid">${cards.join('')}</div>`;
}

// ── Побудова Table ─────────────────────────────────────────────────────────

function buildTable(items) {
  const cols = _config.tableColumns;
  const icon = _config.defaultIcon || '📄';

  const header = cols.map(c => `<th>${c.label}</th>`).join('');
  const actionsHeader = _config.showActions !== false ? '<th>Дії</th>' : '';

  const rows = items.map(item => {
    const cells = cols.map(c => {
      if (c.type === 'image') {
        const img = resolveImageUrl(item);
        return `<td>${img
          ? `<img src="${img}" alt="">`
          : `<div style="font-size:2rem">${icon}</div>`}</td>`;
      }
      const v = item[c.key];
      if (c.type === 'date') {
        return `<td>${v ? new Date(v).toLocaleDateString('uk-UA') : '—'}</td>`;
      }
      return `<td>${v != null && v !== '' ? v : '—'}</td>`;
    }).join('');

    const actionsCell = _config.showActions !== false ? `
      <td>
        <button class="btn btn-secondary btn-small" data-action="edit"   data-item-id="${item.id}">Редагувати</button>
        <button class="btn btn-danger btn-small"    data-action="delete" data-item-id="${item.id}">Видалити</button>
      </td>
    ` : '';

    return `<tr data-item-id="${item.id}" data-item-cv-id="${item.cv_id || ''}" style="cursor:pointer">${cells}${actionsCell}</tr>`;
  }).join('');

  return `
    <div class="table">
      <table>
        <thead><tr>${header}${actionsHeader}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ── Обробка кліків (event delegation) ─────────────────────────────────────

function attachClickHandlers(content) {
  content.onclick = (e) => {
    // Кнопки дій
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      e.stopPropagation();
      const id = parseInt(actionBtn.dataset.itemId);
      if (actionBtn.dataset.action === 'edit'   && _config.onEdit)   _config.onEdit(id);
      if (actionBtn.dataset.action === 'delete' && _config.onDelete) _config.onDelete(id);
      return;
    }

    // Клік по картці / рядку
    const row = e.target.closest('[data-item-id]');
    if (row && _config.onNavigate) {
       const id    = parseInt(row.dataset.itemId);
       const cv_id = row.dataset.itemCvId ? parseInt(row.dataset.itemCvId) : null;
       _config.onNavigate(id, cv_id);
     }
  };
}

// ── Пагінація ─────────────────────────────────────────────────────────────

function updatePagination(total) {
  const page  = Math.floor(currentOffset / LIMIT) + 1;
  const pages = Math.ceil(total / LIMIT) || 1;

  const pagination = document.getElementById('pagination');
  pagination.style.display = 'flex';

  document.getElementById('page-info').textContent =
    `Ст. ${page} з ${pages} (Рез. ${total})`;

  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');

  prev.disabled = currentOffset === 0;
  next.disabled = currentOffset + LIMIT >= total;

  prev.onclick = () => { if (currentOffset > 0) { currentOffset -= LIMIT; loadAndRender(); } };
  next.onclick = () => { if (currentOffset + LIMIT < total) { currentOffset += LIMIT; loadAndRender(); } };
}

// ── Утиліти ───────────────────────────────────────────────────────────────

function resolveImageUrl(item) {
  const filename = item[_config.imageKey];
  if (!filename) return null;

  // Якщо вже повне посилання — повертаємо як є
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }

  // Якщо починається з / — додаємо базовий шлях
  if (filename.startsWith('/')) {
    return cv_img_path_original + filename;
  }

  // В інших випадках — вважаємо, що це просто ім'я файлу
  return cv_img_path_original + '/' + filename;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}