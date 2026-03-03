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
let currentCvId = '';
let exactMatch = false;
let currentPublisherIds = [];
let currentThemeIds = [];
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
  currentPublisherIds = [];
  currentThemeIds = [];
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
  exactWrapper.style.gap = '0.3rem';
  exactWrapper.style.marginRight = '0.75rem';
  exactWrapper.style.fontSize = '0.875rem';
  exactWrapper.style.cursor = 'pointer';
  exactWrapper.innerHTML = `<input type="checkbox" id="exact-match-cb" ${exactMatch ? 'checked' : ''}> Точне`;
  searchInput.parentElement?.insertBefore(exactWrapper, searchInput.nextSibling);

  document.getElementById('exact-match-cb')?.addEventListener('change', (e) => {
    exactMatch = e.target.checked;
    currentOffset = 0;
    loadAndRender();
  });

  // ── Пошук по CV ID ──
  const cvIdWrapper = document.createElement('span');
  cvIdWrapper.id = 'cv-id-search-wrapper';
  cvIdWrapper.style.display = 'inline-flex';
  cvIdWrapper.style.alignItems = 'center';
  cvIdWrapper.style.gap = '0.3rem';
  cvIdWrapper.style.marginRight = '0.75rem';

  const cvIdInput = document.createElement('input');
  cvIdInput.type = 'number';
  cvIdInput.placeholder = 'CV ID';
  cvIdInput.style.width = '90px';
  cvIdInput.style.padding = '0.45rem 0.5rem';
  cvIdInput.style.border = '1px solid #ccc';
  cvIdInput.style.borderRadius = '4px';
  cvIdInput.style.fontSize = '0.875rem';
  cvIdInput.value = currentCvId;
  cvIdWrapper.appendChild(cvIdInput);
  exactWrapper.parentElement?.insertBefore(cvIdWrapper, exactWrapper.nextSibling);

  let cvDebounce;
  cvIdInput.addEventListener('input', (e) => {
    clearTimeout(cvDebounce);
    cvDebounce = setTimeout(() => {
      currentCvId = e.target.value.trim();
      currentOffset = 0;
      loadAndRender();
    }, 400);
  });

  // ── Пошук по назві ──
  let searchDebounce;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentSearch = e.target.value;
      currentOffset = 0;
      loadAndRender();
    }, 300);
  });
}

function setupViewToggle() {
  const toggle = document.getElementById('view-toggle');
  if (!toggle) return;
  toggle.innerHTML = `
    <button class="btn-view ${viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Сітка">⊞</button>
    <button class="btn-view ${viewMode === 'table' ? 'active' : ''}" data-view="table" title="Таблиця">≡</button>
  `;
  toggle.onclick = (e) => {
    const btn = e.target.closest('.btn-view');
    if (!btn) return;
    viewMode = btn.dataset.view;
    toggle.querySelectorAll('.btn-view').forEach(b => b.classList.toggle('active', b.dataset.view === viewMode));
    if (_lastData) renderItems(_lastData);
  };
}

// ── Завантаження та рендер ─────────────────────────────────────────────────

async function loadAndRender() {
  showLoading();

  const params = { limit: LIMIT, offset: currentOffset };
  if (currentSearch)         params.search        = currentSearch;
  if (exactMatch)            params.exact         = 'true';
  if (currentCvId)           params.cv_id         = currentCvId;
                             params.publisher_ids = currentPublisherIds.join(',');
  if (currentThemeIds.length) params.theme_ids    = currentThemeIds.join(',');

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
              ? `<div class="card-meta ${m.class || ''}">${m.prefix || ''}${m.type === 'date' ? new Date(v).toLocaleDateString('uk') : v}</div>`
              : '';
          }).join('')}
        </div>
      </div>
    `;
  });
  return `<div class="grid">${cards.join('')}</div>`;
}

// ── Побудова Table ─────────────────────────────────────────────────────────

function buildTable(items) {
  const cols = _config.tableColumns || [];
  const headers = cols.map(c => `<th>${c.label}</th>`).join('');
  const rows = items.map(item => {
    const cells = cols.map(c => {
      let v = item[c.key];
      if (c.type === 'image') {
        const url = resolveImageUrl(item);
        return `<td>${url ? `<img src="${url}" style="width:40px; height:60px; object-fit:cover; border-radius:3px;">` : ''}</td>`;
      }
      if (c.type === 'date' && v) v = new Date(v).toLocaleDateString('uk');
      return `<td>${v ?? ''}</td>`;
    }).join('');
    return `<tr data-item-id="${item.id}" data-item-cv-id="${item.cv_id || ''}" style="cursor:pointer">${cells}</tr>`;
  });
  return `<table class="data-table"><thead><tr>${headers}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

// ── Обробники кліків ──────────────────────────────────────────────────────

function attachClickHandlers(content) {
  content.onclick = (e) => {
    const card = e.target.closest('[data-item-id]');
    if (!card) return;
    const id    = parseInt(card.dataset.itemId);
    const cv_id = card.dataset.itemCvId ? parseInt(card.dataset.itemCvId) : null;
    _config.onNavigate(id, cv_id);
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
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  if (filename.startsWith('/')) return cv_img_path_original + filename;
  return cv_img_path_original + '/' + filename;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

export function setCatalogPublisherIds(ids) {
  currentPublisherIds = ids;
  currentOffset = 0;
  if (_config) loadAndRender();
}

export function setCatalogThemeIds(ids) {
  currentThemeIds = ids;
  currentOffset = 0;
  if (_config) loadAndRender();
}