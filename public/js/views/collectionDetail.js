import { fetchItem } from '../api/api.js';
import { cv_logo_svg, cv_img_path_small, cv_img_path_original, formatDate, formatCoverDate, formatReleaseDate, showError, showLoading, initDetailPage } from '../utils/helpers.js';
import { navigate, navigateToParent } from '../utils/router.js';
import { publisherSearchHTML, initPublisherSearch } from '../utils/publisherSearch.js';
import { openAddIssueModal } from '../components/addIssueModal.js';
import { buildThemeChipsHTML, buildThemeCheckboxListHTML, filterThemeCheckboxList, buildThemeChipsViewHTML } from '../utils/themeChips.js';
import {
    buildVolumesMap,
    renderVolumeSummary,
    attachVolumeChipsHandlers,
    injectVolumeChipsStyles,
} from '../components/volumeChips.js';

const API_BASE = 'http://localhost:7000/api';

// ID вже доданих випусків для фільтрації в пошуку
let currentCollectionIssueIds = new Set();
let currentIssues = [];
let currentCollectionId = null;
let currentSortOrder = 'order'; // 'order' | 'series' | 'date' | 'name'

// Контролер для скасування старих event listeners при кожному renderPage
let handlersAbortController = null;

// ═══════════════════════════════════════════════════════════════
// НАВІГАЦІЯ МІЖ ЗБІРНИКАМИ ТОМУ
// ═══════════════════════════════════════════════════════════════

const COL_NAV_PAGE_SIZE = 100;
let _cnav_items   = [];
let _cnav_page    = 0;
let _cnav_current = null;

function _cnavInjectCSS() {
    if (document.getElementById('col-nav-style')) return;
    const s = document.createElement('style');
    s.id = 'col-nav-style';
    document.head.appendChild(s);
}

function _cnavRender() {
    const container = document.getElementById('collection-volume-nav');
    if (!container) return;

    const total      = _cnav_items.length;
    const totalPages = Math.ceil(total / COL_NAV_PAGE_SIZE);
    const start      = _cnav_page * COL_NAV_PAGE_SIZE;
    const slice      = _cnav_items.slice(start, start + COL_NAV_PAGE_SIZE);
    const needsPager = total > COL_NAV_PAGE_SIZE;
    
    let gridStyle = '';
    if (slice.length > 0) {
        const colCount = slice.length <= 20 ? slice.length : 20;
        gridStyle = `grid-template-columns: repeat(${colCount}, 1fr) !important;`;
    }

    const pagerHTML = needsPager ? `
        <div class="inav__pager">
            <button class="inav__pager-btn" id="inav-prev" ${_cnav_page === 0 ? 'disabled' : ''}>‹</button>
            <input class="inav__pager-input" id="inav-goto" type="number" min="1" max="${totalPages}"
                   placeholder="${_cnav_page + 1}" title="Перейти на сторінку">
            <span class="inav__pager-info"> / ${totalPages}</span>
            <button class="inav__pager-btn" id="inav-next" ${_cnav_page >= totalPages - 1 ? 'disabled' : ''}>›</button>
        </div>
    ` : '';

    container.innerHTML = `
        <div class="inav" style="width: fit-content;">
            <div class="inav__header">
                <span class="inav__label">Збірники тому</span>
                <span class="inav__vol">${_cnav_items._volName || ''}</span>
                <span class="inav__label">(${total})</span>
                ${pagerHTML}
            </div>
            <div class="inav__grid" style="${gridStyle}">
                ${slice.map(col => `
                    <button
                        class="inav__btn${col.id === _cnav_current ? ' inav__btn--current' : ''}"
                        data-col-id="${col.id}"
                        title="${col.name || ''} #${col.issue_number}"
                    >#${col.issue_number || '?'}</button>
                `).join('')}
            </div>
        </div>
    `;

    container.querySelector('#inav-prev')?.addEventListener('click', () => {
        if (_cnav_page > 0) { _cnav_page--; _cnavRender(); }
    });
    container.querySelector('#inav-next')?.addEventListener('click', () => {
        if (_cnav_page < totalPages - 1) { _cnav_page++; _cnavRender(); }
    });
    container.querySelector('#inav-goto')?.addEventListener('change', (e) => {
        const p = parseInt(e.target.value) - 1;
        if (!isNaN(p) && p >= 0 && p < totalPages) { _cnav_page = p; _cnavRender(); }
        else e.target.value = '';
    });

    container.querySelectorAll('.inav__btn:not(.inav__btn--current)').forEach(btn => {
        btn.addEventListener('click', () => {
            navigate('collection-detail', { id: parseInt(btn.dataset.colId) });
        });
    });
}

async function mountCollectionVolumeNav(collection) {
    _cnavInjectCSS();
    _cnav_current = collection.id;

    const container = document.getElementById('collection-volume-nav');
    if (!container) return;

    if (!collection.cv_vol_id) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = '<div style="padding:0.75rem 1rem; color:var(--text-secondary); font-size:0.82rem;">Завантаження…</div>';

    try {
        const res  = await fetch(`${API_BASE}/collections/by-volume/${collection.cv_vol_id}`);
        const data = await res.json();
        const all  = (data.data || []).sort((a, b) => {
            const na = parseFloat(a.issue_number);
            const nb = parseFloat(b.issue_number);
            if (isNaN(na) && isNaN(nb)) return 0;
            if (isNaN(na)) return 1;
            if (isNaN(nb)) return -1;
            return na - nb;
        });

        _cnav_items = all;
        _cnav_items._volName = collection.volume_name || '';

        const idx = all.findIndex(c => c.id === collection.id);
        _cnav_page = idx >= 0 ? Math.floor(idx / COL_NAV_PAGE_SIZE) : 0;

        _cnavRender();
    } catch (e) {
        console.error('collection-volume-nav: помилка', e);
        if (container) container.innerHTML = '';
    }
}

export async function renderCollectionDetail(params) {
    const collectionId = params.id;

    if (!collectionId) {
        navigate('collections');
        return;
    }

    initDetailPage();
    showLoading();

    try {
        const [collection, seriesData] = await Promise.all([
            fetchItem('collections', collectionId),
            fetch(`${API_BASE}/collections/${collectionId}/series`).then(r => r.json())
        ]);
        renderPage(collection, seriesData.data || []);
    } catch (error) {
        console.error('Помилка завантаження збірника:', error);
        showError('Помилка завантаження даних');
    }
}

function renderPage(collection, seriesList = []) {
    // Оновлюємо Set вже доданих випусків
    currentCollectionIssueIds = new Set((collection.issues || []).map(i => i.id));
    currentIssues = collection.issues || [];
    currentCollectionId = collection.id;

    const MANGA_THEME_ID = 36;
    const isMangaCollection = (collection.themes || []).some(t => t.id === MANGA_THEME_ID);

    // Скасовуємо старі обробники
    if (handlersAbortController) handlersAbortController.abort();
    handlersAbortController = new AbortController();
    const { signal } = handlersAbortController;

    document.getElementById('page-title').innerHTML = `
        <a href="#" onclick="event.preventDefault(); navigateToParent()" style="color: var(--text-secondary); text-decoration: none;">
            &larr; Збірники
        </a> /${collection.cv_slug}/4000-${collection.cv_id}/
    `;

    // ── Volume summary з проміжками номерів ──────────────────────────────────
    injectVolumeChipsStyles();
    const volumesMap = buildVolumesMap(collection.issues || [], {
        keyField:         'cv_vol_id',
        fallbackKeyField: 'ds_vol_id',
        nameField:        'volume_name',
        dbIdField:        'volume_db_id',
        collectNumbers:   true,
    });
    const volumesHtml = renderVolumeSummary(volumesMap, {
        label:      'Додані серії',
        clickable:  true,
        showRanges: true,
    });

    const content = document.getElementById('content');
    content.innerHTML = `
        <div style="max-width: 1200px;">
            <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
                <div style="flex-shrink: 0;">
                    ${collection.cv_img
                        ? `<img src="${collection.cv_img.startsWith('https') ? collection.cv_img : collection.cv_img.startsWith('/') ? cv_img_path_original + collection.cv_img : cv_img_path_original + '/' + collection.cv_img}" alt="${collection.name}"
                            style="width: 300px; border-radius: 8px; box-shadow: var(--shadow-lg);">`
                        : '<div style="width: 300px; height: 300px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 4rem;">&#128213;</div>'}
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1em;">
                            <a href="https://comicvine.gamespot.com/${collection.cv_slug}/4000-${collection.cv_id}" target="_blank">${cv_logo_svg}</a>
                            ${collection.locg_slug ? `
                                <a href="https://leagueofcomicgeeks.com/comics/series/${collection.locg_id}/${collection.locg_slug}" target="_blank">
                                    <img src="${locg_img}" alt="League of Comic Geeks" style="height:30px; vertical-align:middle;">
                                </a>
                            ` : ''}
                        </div>
                </div>
                <div style="flex: 1;">
                    <h1 style="font-size: 2rem; margin-bottom: 1rem;">${collection.name} #${collection.issue_number}</h1>
                    <div style="display: grid; gap: 0.5rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                        ${seriesList.length > 0 ? `
                            <div>
                                <strong>Серія:</strong>
                                ${seriesList.map(s => `
                                    <span class="theme-badge" style="background:#dcfce7; color:#166534; border-color:#bbf7d0; cursor:pointer;"
                                          onclick="navigate('series-detail', { id: ${s.id} })">${s.name}</span>
                                `).join(' ')}
                            </div>
                        ` : ''}
                        ${collection.volume_name ? `
                            <div>
                                <strong>Том:</strong>
                                <a href="#" onclick="event.preventDefault(); window.navigateToVolume(${collection.volume_id})"
                                   style="color: var(--accent); text-decoration: none;">
                                    ${collection.volume_name}
                                </a> <span style="color: var(--text-secondary); font-size: 0.85rem;">(cv_id: ${collection.cv_vol_id})</span>
                            </div>
                        ` : ''}
                        ${collection.isbn ? `<div><strong>ISBN:</strong> ${collection.isbn}</div>` : ''}
                        ${collection.cover_date ? `<div><strong>Дата обкладинки:</strong> ${formatCoverDate(collection.cover_date)}</div>` : ''}
                        ${collection.release_date ? `<div><strong>Дата релізу:</strong> ${formatReleaseDate(collection.release_date)}</div>` : ''}
                        ${collection.publisher || collection.publisher_name ? `
                            <div>
                                <strong>Видавець:</strong>
                                ${collection.publisher_name
                                    ? `${collection.publisher_name} <span style="color: var(--text-secondary); font-size: 0.85rem;">(cv_id: ${collection.publisher})</span>`
                                    : `cv_id: ${collection.publisher}`}
                            </div>
                        ` : ''}
                        <div id="col-theme-chips" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-bottom:0.5rem; min-height:0; align-items:center;">
                            ${buildThemeChipsViewHTML(collection.themes)}
                        </div>
                        <div><strong>Дата додавання:</strong> ${formatDate(collection.created_at)}</div>
                        ${collection.description ? `${collection.description}` : ''}
                    </div>
                    ${volumesHtml}
                    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="openEditCollectionModal(${collection.id})">Редагувати збірник</button>
                        <button class="btn btn-primary" onclick="openCollectionAddToSeriesModal(${collection.id})">+ Додати до серії</button>
                        ${collection.cv_id && collection.cv_slug ? `
                            <button class="btn btn-warning" onclick="makeIssueFromCollection(${collection.id})">🔄 Перетворити на випуск</button>
                        ` : ''}
                        ${isMangaCollection ? `
                            <button class="btn btn-secondary" onclick="createMangaVolume(${collection.id}, '${collection.name?.replace(/'/g, "\\'")}')">
                                📖 Створити том манґи
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div id="collection-volume-nav" style="display: flex; margin-top: 1.5rem; justify-content: center;"></div>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                <h2 style="font-size: 1.5rem; margin: 0;">Випуски (${collection.issues.length})</h2>
                <div style="display:flex; gap:0.75rem; align-items:center;">
                    <select id="collection-sort-select" style="padding:0.4rem 0.75rem; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.9rem;">
                        <option value="order"  ${currentSortOrder === 'order'  ? 'selected' : ''}>За порядком</option>
                        <option value="series" ${currentSortOrder === 'series' ? 'selected' : ''}>За серією і номером</option>
                        <option value="date"   ${currentSortOrder === 'date'   ? 'selected' : ''}>За датою</option>
                        <option value="name"   ${currentSortOrder === 'name'   ? 'selected' : ''}>За назвою</option>
                    </select>
                    <button class="btn btn-primary" onclick="openCollectionAddIssueModal(${collection.id})">+ Додати випуск</button>
                </div>
            </div>

            ${collection.issues.length ? `
                <div class="table">
                    <table>
                        <thead>
                            <tr>
                                <th id="col-th-order" style="${currentSortOrder === 'order' ? '' : 'display:none;'}">#</th>
                                <th>Обкладинка</th>
                                <th>Назва</th>
                                <th>Том</th>
                                <th>Номер</th>
                                <th>Дата</th>
                                <th>Дії</th>
                            </tr>
                        </thead>
                        <tbody id="collection-issues-tbody">
                            ${renderIssueRows(sortIssues(currentIssues, currentSortOrder), collection.id)}
                        </tbody>
                    </table>
                </div>
            ` : `
                <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                    Немає випусків. Додайте перший!
                </p>
            `}
        </div>

        <!-- Модалка редагування збірника -->
        <div id="edit-collection-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
            <div style="background: var(--bg-primary); border-radius: 8px; padding: 1.5rem; width: 560px; max-width: 90vw; max-height: 90vh; overflow-y: auto;">
                <h3 style="margin-bottom: 1.25rem;">Редагувати збірник</h3>
                <div id="edit-collection-form-body"></div>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem;">
                    <button class="btn btn-secondary" onclick="closeEditCollectionModal()">Скасувати</button>
                    <button class="btn btn-primary" onclick="saveCollectionEdit()">Зберегти</button>
                </div>
            </div>
        </div>

        <!-- Модалка додавання до серії -->
        <div id="col-add-to-series-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
            <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:500px; max-width:90vw;">
                <h3 style="margin-bottom:1rem;">Додати до серії</h3>
                <div class="form-group">
                    <input type="text" id="col-series-search-input" placeholder="Введіть назву серії..." style="width:100%;">
                </div>
                <div id="col-series-search-results" style="max-height:320px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:1rem; min-height:48px;"></div>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="closeCollectionAddToSeriesModal()">Скасувати</button>
                </div>
            </div>
        </div>
    `;

    // Навігація між збірниками тому
    mountCollectionVolumeNav(collection);

    // ── Сортування ────────────────────────────────────────────────────────────
    const sortSelect = document.getElementById('collection-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            currentSortOrder = sortSelect.value;
            rerenderTable();
        }, { signal });
    }

    // ── Volume chips навігація ────────────────────────────────────────────────
    attachVolumeChipsHandlers(content, navigate, signal);

    // ── Reorder — делегування на tbody ───────────────────────────────────────
    const tbody = document.getElementById('collection-issues-tbody');
    if (tbody) {
        tbody.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('col-order-input')) {
                e.target.blur();
            }
        }, { signal });

        tbody.addEventListener('change', async (e) => {
            const input = e.target;
            if (!input.classList.contains('col-order-input')) return;

            const issueId = parseInt(input.dataset.issueId);
            const oldNum  = parseInt(input.dataset.orderNum);
            const newNum  = parseInt(input.value);
            const total   = currentIssues.length;

            if (isNaN(newNum) || newNum < 1 || newNum > total || newNum === oldNum) {
                input.value = oldNum;
                return;
            }

            await moveCollectionIssue(currentCollectionId, issueId, newNum);
        }, { signal });
    }
}

// ── Перемалювання таблиці без повного ререндеру сторінки ─────────────────

function rerenderTable() {
    const tbody = document.getElementById('collection-issues-tbody');
    if (tbody) tbody.innerHTML = renderIssueRows(sortIssues(currentIssues, currentSortOrder), currentCollectionId);

    // Показуємо/ховаємо колонку #
    const thOrder = document.getElementById('col-th-order');
    if (thOrder) thOrder.style.display = currentSortOrder === 'order' ? '' : 'none';
}

// ── Рендер рядків таблиці ─────────────────────────────────────────────────

function renderIssueRows(issues, collectionId) {
    const showOrder = currentSortOrder === 'order';
    return issues.map((issue, idx) => `
        <tr onclick="window.navigateToIssue(${issue.id})" style="cursor: pointer;">
            ${showOrder ? `
            <td onclick="event.stopPropagation()" style="text-align:center; width:56px;">
                <input
                    type="number"
                    class="col-order-input"
                    data-issue-id="${issue.id}"
                    data-order-num="${issue.order_num || (idx + 1)}"
                    value="${issue.order_num || (idx + 1)}"
                    min="1"
                    max="${issues.length}"
                    style="width: 54px; text-align: center; font-weight: 700; font-size: 1rem; color: var(--accent); background: transparent; border: 1px solid transparent; border-radius: 4px; padding: 2px 4px; cursor: text;"
                    onclick="event.stopPropagation()">
            </td>
            ` : ''}
            <td>
                ${issue.cv_img
                    ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}" alt="${issue.name}">`
                    : '&#128214;'}
            </td>
            <td>${issue.name || 'Без назви'}</td>
            <td style="color: var(--text-secondary); font-size: 0.85rem;">${issue.volume_name || '-'}</td>
            <td>${issue.issue_number || '-'}</td>
            <td>${formatDate(issue.release_date)}</td>
            <td onclick="event.stopPropagation()">
                <button class="btn btn-secondary btn-small" onclick="window.navigateToIssue(${issue.id})">Переглянути</button>
                <button class="btn btn-danger btn-small" onclick="removeIssueFromCollection(${collectionId}, ${issue.id})">Видалити</button>
            </td>
        </tr>
    `).join('');
}

// ── Сортування ────────────────────────────────────────────────────────────

function sortIssues(issues, order) {
    const sorted = [...issues];
    if (order === 'order') {
        sorted.sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
    } else if (order === 'date') {
        sorted.sort((a, b) => {
            const da = a.release_date || '';
            const db = b.release_date || '';
            return da.localeCompare(db);
        });
    } else if (order === 'name') {
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uk'));
    } else {
        // 'series' — за назвою серії (volume_name), потім за номером
        sorted.sort((a, b) => {
            const seriesCmp = (a.volume_name || '').localeCompare(b.volume_name || '', 'uk');
            if (seriesCmp !== 0) return seriesCmp;
            return parseFloat(a.issue_number || 0) - parseFloat(b.issue_number || 0);
        });
    }
    return sorted;
}

// ── Переміщення випуску (reorder) ─────────────────────────────────────────

async function moveCollectionIssue(collectionId, issueId, newOrder) {
    const res = await fetch(`${API_BASE}/collections/${collectionId}/issues/${issueId}/reorder`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ new_order: newOrder }),
    });
    if (!res.ok) { alert('Помилка переміщення'); return; }

    const [collection, seriesData] = await Promise.all([
        fetchItem('collections', collectionId),
        fetch(`${API_BASE}/collections/${collectionId}/series`).then(r => r.json()),
    ]);
    currentIssues = collection.issues || [];
    currentCollectionIssueIds = new Set(currentIssues.map(i => i.id));
    rerenderTable();
}

// ===== ДОДАВАННЯ ВИПУСКУ (через уніфікований компонент) =====

window.openCollectionAddIssueModal = (collectionId) => {
    openAddIssueModal({
        title:          'Додати випуски до збірника',
        alreadyIds:     currentCollectionIssueIds,
        showImportance: false,
        apiBase:        API_BASE,
        cvImgPathSmall: cv_img_path_small,
        onAdd: async (issueIds, importance) => {
            if (!Array.isArray(issueIds) || issueIds.length === 0) return;

            try {
                for (const issueId of issueIds) {
                    const response = await fetch(`${API_BASE}/collections/${collectionId}/issues`, {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({ issue_id: issueId }),
                    });

                    if (!response.ok) {
                        const err = await response.json();
                        console.warn(`Не вдалося додати випуск ${issueId}:`, err);
                    }
                }

                const [collection, seriesData] = await Promise.all([
                    fetchItem('collections', collectionId),
                    fetch(`${API_BASE}/collections/${collectionId}/series`).then(r => r.json()),
                ]);

                renderPage(collection, seriesData.data || []);
                currentCollectionIssueIds = new Set((collection.issues || []).map(i => i.id));
            } catch (err) {
                console.error('Помилка масового додавання випусків:', err);
                alert('Сталася помилка під час додавання випусків');
            }
        },
    });
};

window.removeIssueFromCollection = async (collectionId, issueId) => {
    if (!confirm('Видалити цей випуск зі збірника?')) return;
    try {
        await fetch(`${API_BASE}/collections/${collectionId}/issues/${issueId}`, { method: 'DELETE' });
        const [collection, seriesData] = await Promise.all([
            fetchItem('collections', collectionId),
            fetch(`${API_BASE}/collections/${collectionId}/series`).then(r => r.json())
        ]);
        renderPage(collection, seriesData.data || []);
    } catch (error) {
        console.error('Помилка:', error);
        alert('Помилка видалення випуску');
    }
};

// ===== РЕДАГУВАННЯ ЗБІРНИКА =====

let currentEditCollectionId = null;

window.openEditCollectionModal = async (collectionId) => {
    currentEditCollectionId = collectionId;

    const formBody = document.getElementById('edit-collection-form-body');
    formBody.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-secondary);">Завантаження...</div>';
    document.getElementById('edit-collection-modal').style.display = 'flex';

    const colModalEl = document.getElementById('edit-collection-modal');
    colModalEl.onclick = (e) => { if (e.target === colModalEl) window.closeEditCollectionModal(); };
    function colEscHandler(e) {
        if (e.key === 'Escape') {
            window.closeEditCollectionModal();
            document.removeEventListener('keydown', colEscHandler);
        }
    }
    document.addEventListener('keydown', colEscHandler);

    try {
        const [collectionRes, collectionThemesRes, allThemesRes] = await Promise.all([
            fetch(`${API_BASE}/collections/${collectionId}`).then(r => r.json()),
            fetch(`${API_BASE}/collections/${collectionId}/themes`).then(r => r.json()),
            fetch(`${API_BASE}/themes`).then(r => r.json())
        ]);

        const collection      = collectionRes;
        const currentThemeIds = new Set((collectionThemesRes.data || []).map(t => t.id));
        const allThemes       = allThemesRes.data || [];
        let publisherName     = collection?.publisher_name || '';
        let safeReleaseDate   = '';
        if (collection.cover_date) {
            const [y, m, d] = collection.cover_date.split('-');
            if (d === '00') {
                safeReleaseDate = `${y}-${m}-01`;
            }
        }

        formBody.innerHTML = `
            <div class="form-row form-row-3">
                <div class="form-group">
                    <label>CV ID</label>
                    <input type="number" id="edit-col-cv_id" value="${collection.cv_id || ''}">
                </div>
                <div class="form-group">
                    <label>CV Slug</label>
                    <input type="text" id="edit-col-cv_slug" value="${collection.cv_slug || ''}">
                </div>
                <div class="form-group">
                    <label>CV Vol ID (тому)</label>
                    <input type="number" id="edit-col-cv_vol_id" value="${collection.cv_vol_id || ''}">
                </div>
            </div>
            <div class="form-row form-row-2">
                <div class="form-group">
                    <label>Номер випуску</label>
                    <input type="text" id="edit-col-issue_number" value="${collection.issue_number || ''}">
                </div>
                <div class="form-group">
                    <label>ISBN</label>
                    <input type="text" id="edit-col-isbn" value="${collection.isbn || ''}">
                </div>
            </div>
            <div class="form-row form-row-2">
                <div class="form-group">
                    <label>Назва *</label>
                    <input type="text" id="edit-col-name" value="${collection.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>URL зображення</label>
                    <input type="text" id="edit-col-cv_img" value="${collection.cv_img || ''}">
                </div>
            </div>
            ${publisherSearchHTML({
                publisherId:  collection?.publisher || '',
                publisherName,
                inputId:   'col-pub-input',
                hiddenId:  'col-pub-id',
                resultsId: 'col-pub-results',
                chipId:    'col-pub-chip'
            })}
            <div class="form-row form-row-2">
                <div class="form-group">
                    <label>Дата обкладинки</label>
                    <input type="date" id="edit-col-cover_date" value="${safeReleaseDate || collection.cover_date || ''}">
                </div>
                <div class="form-group">
                    <label>Дата релізу</label>
                    <input type="date" id="edit-col-release_date" value="${collection.release_date || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Опис</label>
                <textarea id="edit-col-description">${collection.description || ''}</textarea>
            </div>

            <!-- Теми -->
            <div class="form-group">
                <label>Теми</label>
                <div id="col-theme-chips-edit" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-bottom:0.5rem; min-height:0; align-items:center;">
                    ${buildThemeChipsHTML(allThemes.filter(t => currentThemeIds.has(t.id)), 'removeThemeChipCol')}
                </div>
                <input type="text" placeholder="Пошук тем..." style="margin-bottom:0.5rem; width:100%;"
                    oninput="filterThemesCol(this.value)">
                <div id="edit-themes-list" class="themes-checkbox-list">
                    ${buildThemeCheckboxListHTML(allThemes, currentThemeIds, 'onColThemeChange')}
                </div>
            </div>
        `;

        initPublisherSearch({
            inputId:   'col-pub-input',
            hiddenId:  'col-pub-id',
            resultsId: 'col-pub-results',
            chipId:    'col-pub-chip'
        });

    } catch (error) {
        console.error('Помилка завантаження даних для редагування:', error);
        formBody.innerHTML = '<div style="color:var(--danger); padding:1rem;">Помилка завантаження даних</div>';
    }
};

window.closeEditCollectionModal = () => {
    document.getElementById('edit-collection-modal').style.display = 'none';
    currentEditCollectionId = null;
};

window.saveCollectionEdit = async () => {
    const cv_id        = document.getElementById('edit-col-cv_id').value;
    const cv_slug      = document.getElementById('edit-col-cv_slug').value.trim();
    const name         = document.getElementById('edit-col-name').value.trim();
    const cv_img       = document.getElementById('edit-col-cv_img').value.trim();
    const cv_vol_id    = document.getElementById('edit-col-cv_vol_id').value;
    const publisherId  = document.getElementById('col-pub-id').value;
    const issue_number = document.getElementById('edit-col-issue_number').value.trim();
    const isbn         = document.getElementById('edit-col-isbn').value.trim();
    const cover_date   = document.getElementById('edit-col-cover_date').value;
    const release_date = document.getElementById('edit-col-release_date').value;
    const description  = document.getElementById('edit-col-description').value.trim();

    if (!name) { alert("Назва обов'язкова"); return; }

    const checkboxes = document.querySelectorAll('#edit-themes-list input[type="checkbox"]');
    const theme_ids  = Array.from(checkboxes).filter(cb => cb.checked).map(cb => parseInt(cb.value));

    try {
        const response = await fetch(`${API_BASE}/collections/${currentEditCollectionId}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cv_id:        cv_id ? parseInt(cv_id) : null,
                cv_slug:      cv_slug || null,
                name,
                cv_img:       cv_img || null,
                cv_vol_id:    cv_vol_id ? parseInt(cv_vol_id) : null,
                publisher:    publisherId ? parseInt(publisherId) : null,
                issue_number: issue_number || null,
                isbn:         isbn || null,
                cover_date:   cover_date || null,
                release_date: release_date || null,
                description:  description || null,
                theme_ids
            })
        });

        if (!response.ok) {
            const err = await response.json();
            alert(err.error || 'Помилка збереження');
            return;
        }

        const savedId = currentEditCollectionId;
        window.closeEditCollectionModal();
        const [collection, seriesData] = await Promise.all([
            fetchItem('collections', savedId),
            fetch(`${API_BASE}/collections/${savedId}/series`).then(r => r.json())
        ]);
        renderPage(collection, seriesData.data || []);
        await window.updateStats();
    } catch (error) {
        console.error('Помилка:', error);
        alert('Помилка збереження збірника');
    }
};

function rebuildColThemeChips() {
    const container = document.getElementById('col-theme-chips-edit');
    if (!container) return;

    const checked = document.querySelectorAll('#edit-themes-list input[type="checkbox"]:checked');
    const selectedThemes = Array.from(checked).map(cb => ({
        id:   parseInt(cb.value),
        name: cb.closest('label')?.querySelector('span')?.textContent?.trim() || '',
        type: cb.dataset.type || 'theme',
    }));

    container.innerHTML = buildThemeChipsHTML(selectedThemes, 'removeThemeChipCol');
}

window.removeThemeChipCol = (themeId) => {
    const cb = document.querySelector(`#edit-themes-list input[value="${themeId}"]`);
    if (cb) cb.checked = false;
    rebuildColThemeChips();
};

window.onColThemeChange = () => {
    rebuildColThemeChips();
};

window.filterThemesCol = (q) => {
    filterThemeCheckboxList(q, 'edit-themes-list');
};

// ===== КОНВЕРТАЦІЯ =====

window.makeIssueFromCollection = async (collectionId) => {
    if (!confirm('Перетворити цей збірник на випуск? Збірник буде видалено, а натомість створено випуск з тими самими даними.')) return;
    try {
        const res  = await fetch(`${API_BASE}/collections/${collectionId}/make-issue`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Помилка конвертації'); return; }
        await window.updateStats();
        navigate('issue-detail', { id: data.issue.id });
    } catch (e) {
        alert('Помилка під час конвертації');
    }
};

// ===== ДОДАТИ ЗБІРНИК ДО СЕРІЇ =====

let colAddToSeriesId       = null;
let colSeriesSearchTimeout = null;

window.openCollectionAddToSeriesModal = (collectionId) => {
    colAddToSeriesId = collectionId;
    document.getElementById('col-add-to-series-modal').style.display = 'flex';
    const input = document.getElementById('col-series-search-input');
    input.value = '';
    document.getElementById('col-series-search-results').innerHTML = '';
    input.oninput = (e) => {
        clearTimeout(colSeriesSearchTimeout);
        colSeriesSearchTimeout = setTimeout(() => searchSeriesForCollection(e.target.value), 300);
    };
    input.focus();
};

window.closeCollectionAddToSeriesModal = () => {
    document.getElementById('col-add-to-series-modal').style.display = 'none';
    colAddToSeriesId = null;
};

async function searchSeriesForCollection(query) {
    if (!query.trim()) { document.getElementById('col-series-search-results').innerHTML = ''; return; }
    const res    = await fetch(`${API_BASE}/series?search=${encodeURIComponent(query)}&limit=20`);
    const result = await res.json();
    const el     = document.getElementById('col-series-search-results');
    if (!result.data?.length) {
        el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>';
        return;
    }
    el.innerHTML = result.data.map(s => `
        <div onclick="addCollectionToSeriesFromDetail(${s.id})"
             style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
             onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
            ${s.cv_img
                ? `<img src="${s.cv_img}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; flex-shrink:0;">`
                : '<div style="width:40px; height:40px; background:var(--bg-secondary); border-radius:4px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:1.2rem;">📚</div>'}
            <span style="font-weight:500;">${s.name}</span>
        </div>
    `).join('');
}

window.addCollectionToSeriesFromDetail = async (seriesId) => {
    const res = await fetch(`${API_BASE}/series/${seriesId}/collections`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ collection_id: colAddToSeriesId })
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    window.closeCollectionAddToSeriesModal();
    const [collection, seriesData] = await Promise.all([
        fetchItem('collections', colAddToSeriesId),
        fetch(`${API_BASE}/collections/${colAddToSeriesId}/series`).then(r => r.json())
    ]);
    renderPage(collection, seriesData.data || []);
};

window.createMangaVolume = async function(collectionId, collectionName) {
    const hikkaSlug = prompt(`Hikka slug для манґи "${collectionName}":\n(напр. berserk-ek0mv)`);
    if (!hikkaSlug || !hikkaSlug.trim()) return;

    const malId = prompt('MAL ID (необов\'язково, Enter щоб пропустити):');

    try {
        const resp = await fetch(`${API_BASE}/volumes/manga-volume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: collectionName,
                hikka_slug: hikkaSlug.trim(),
                mal_id: malId ? parseInt(malId) : null,
                collection_id: collectionId,
            }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            // Якщо том вже існує — пропонуємо перейти до нього
            if (data.id) {
                if (confirm(`Том вже існує (id: ${data.id}). Перейти до нього?`)) {
                    navigate('volume-detail', { id: data.id });
                }
            } else {
                alert(`Помилка: ${data.error}`);
            }
            return;
        }
        alert(`Том манґи створено! (id: ${data.id})`);
        navigate('volume-detail', { id: data.id });
    } catch (err) {
        alert(`Помилка: ${err.message}`);
    }
};

// ===== НАВІГАЦІЯ =====

window.navigateToIssue  = (id) => navigate('issue-detail',  { id });
window.navigateToVolume = (id) => navigate('volume-detail', { id });