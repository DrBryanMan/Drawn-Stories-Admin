// catalog.js — спільний компонент для всіх сторінок-списків
// Розташування: public/js/components/catalog.js

import { fetchItems } from '../api/api.js';
import { showEmpty, showError, showLoading } from '../utils/helpers.js';

// ── Стан модуля (один активний список за раз) ─────────────────────────────
let viewMode = 'grid';
let currentOffset = 0;
let currentSearch = '';
let exactMatch = false;
const LIMIT = 100;

let _config = null;       // поточна конфігурація сторінки
let _lastData = null;     // останні завантажені дані (для перемикання виду без запиту)

// ── Публічний API ─────────────────────────────────────────────────────────

/**
 * Ініціалізує сторінку-список.
 * Скидає offset/search/exact, налаштовує UI, завантажує дані.
 *
 * config = {
 *   title        : string,
 *   endpoint     : string,           // 'volumes' | 'issues' | ...
 *   imageKey     : string,           // поле з URL зображення
 *   imagePrefix  : string | null,    // префікс для відносних шляхів
 *   titleKey     : string,           // поле для заголовка картки
 *   defaultIcon  : string,           // емодзі-заглушка
 *   showActions  : boolean,          // показувати кнопки Редагувати/Видалити (default: true)
 *   gridMeta     : [{ key, prefix }] // рядки мета-інфо в режимі grid
 *   tableColumns : [{ key, label, type? }]  // type: 'image' для першої колонки
 *   onAdd        : function | null,
 *   onEdit       : function(id),
 *   onDelete     : function(id),
 *   onNavigate   : function(id),
 * }
 */
export async function initListPage(config) {
  currentOffset = 0;
  currentSearch = '';
  exactMatch = false;
  _config = config;
  _lastData = null;

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
  // Прибираємо старий wrapper якщо є (при навігації між сторінками)
  document.getElementById('exact-match-wrapper')?.remove();

  const searchInput = document.getElementById('search-input');
  searchInput.style.display = 'block';
  searchInput.value = currentSearch;

  // Чекбокс "Точне співпадіння"
  const wrapper = document.createElement('label');
  wrapper.id = 'exact-match-wrapper';
  wrapper.className = 'exact-match-label';
  wrapper.innerHTML = '<input type="checkbox" id="exact-match-cb"> Точне';
  searchInput.insertAdjacentElement('afterend', wrapper);

  let debounce;
  searchInput.oninput = (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      currentSearch = e.target.value;
      currentOffset = 0;
      loadAndRender();
    }, 300);
  };

  document.getElementById('exact-match-cb').onchange = (e) => {
    exactMatch = e.target.checked;
    currentOffset = 0;
    loadAndRender();
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
  if (currentSearch) params.search = currentSearch;
  if (exactMatch)    params.exact  = 'true';

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
      <div class="card" data-item-id="${item.id}" style="cursor:pointer; position:relative">
        ${badges.map(m => {
          const v = item[m.key];
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
              ? `<div class="card-meta">${m.prefix || ''}${v}</div>`
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
      return `<td>${v != null && v !== '' ? v : '—'}</td>`;
    }).join('');

    const actionsCell = _config.showActions !== false ? `
      <td>
        <button class="btn btn-secondary btn-small" data-action="edit"   data-item-id="${item.id}">Редагувати</button>
        <button class="btn btn-danger btn-small"    data-action="delete" data-item-id="${item.id}">Видалити</button>
      </td>
    ` : '';

    return `<tr data-item-id="${item.id}" style="cursor:pointer">${cells}${actionsCell}</tr>`;
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
    if (row && _config.onNavigate) _config.onNavigate(parseInt(row.dataset.itemId));
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
  const val = item[_config.imageKey];
  if (!val) return null;
  if (_config.imagePrefix) {
    return _config.imagePrefix + (val.startsWith('/') ? val : '/' + val);
  }
  return val;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}