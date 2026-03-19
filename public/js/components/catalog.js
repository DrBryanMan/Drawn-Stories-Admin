// catalog.js — спільний компонент для всіх сторінок-списків
// Розташування: public/js/components/catalog.js

import { fetchItems } from '../api/api.js';
import { cv_img_path_small, showEmpty, showError, showLoading } from '../utils/helpers.js';
import { cv_img_path_original } from '../utils/helpers.js';
import { mountHeaderActions } from './headerActions.js';

function _isNewThisWeek(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  const ws = new Date(today);
  ws.setDate(today.getDate() - today.getDay());
  ws.setHours(0,0,0,0);
  const we = new Date(ws);
  we.setDate(ws.getDate() + 7);
  const d = new Date(dateStr);
  return d >= ws && d < we;
}

// ── Стан модуля (один активний список за раз) ─────────────────────────────
let currentOffset = 0;
let currentSearch = '';
let currentCvId = '';
let exactMatch = false;
let currentPublisherIds = [];
let currentThemeIds = [];
const LIMIT = 100;

let _config = null;
let _clickAbortCtrl = null;

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

  mountHeaderActions();
  document.getElementById('page-title').textContent = config.title;
  setupAddBtn(config.onAdd);
  setupSearchArea();

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
  searchInput.className = 'search-input';
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

  const cb = document.getElementById('exact-match-cb');
  if (cb) cb.onchange = (e) => {
    exactMatch = e.target.checked;
    currentOffset = 0;
    loadAndRender();
  };

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
  searchInput.oninput = (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentSearch = e.target.value;
      currentOffset = 0;
      loadAndRender();
    }, 300);
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
  content.innerHTML = buildGrid(items);
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
        ${_isNewThisWeek(item.release_date) ? `
          <div class="issue-this-week">NEW</div>
        ` : ''}
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

// ── Обробники кліків ──────────────────────────────────────────────────────

function attachClickHandlers(content) {
  if (_clickAbortCtrl) _clickAbortCtrl.abort();
  if (content._clickAbort) content._clickAbort.abort();
  _clickAbortCtrl = new AbortController();
  content._clickAbort = _clickAbortCtrl;
  const { signal } = _clickAbortCtrl;

  content.addEventListener('click', (e) => {
    const card = e.target.closest('[data-item-id]');
    if (!card) return;
    const id    = parseInt(card.dataset.itemId);
    const cv_id = card.dataset.itemCvId ? parseInt(card.dataset.itemCvId) : null;

    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      const url = _config.buildUrl ? _config.buildUrl(id, cv_id) : null;
      if (url) {
        e.preventDefault();
        window.open(url, '_blank');
        return;
      }
    }
    _config.onNavigate(id, cv_id);
  }, { signal });

  content.addEventListener('mousedown', (e) => {
    if (e.button !== 1) return;
    const card = e.target.closest('[data-item-id]');
    if (!card) return;
    e.preventDefault();
    const id    = parseInt(card.dataset.itemId);
    const cv_id = card.dataset.itemCvId ? parseInt(card.dataset.itemCvId) : null;
    const url = _config.buildUrl ? _config.buildUrl(id, cv_id) : null;
    if (url) window.open(url, '_blank');
  }, { signal });
}

// ── Пагінація ─────────────────────────────────────────────────────────────

function updatePagination(total) {
  const page  = Math.floor(currentOffset / LIMIT) + 1;
  const pages = Math.ceil(total / LIMIT) || 1;

  const pagination = document.getElementById('pagination');
  pagination.style.display = 'flex';

  document.getElementById('page-info').textContent =
    `Ст. ${page} з ${pages} (${total})`;

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
  if (filename.startsWith('/')) return cv_img_path_small + filename;
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