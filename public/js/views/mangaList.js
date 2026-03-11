import { cv_img_path_small, showError, showLoading, showEmpty } from '../utils/helpers.js';
import { navigate, buildUrl } from '../utils/router.js';
import { createPagination, getInitialPage } from '../utils/pagination.js';
import { mountHeaderActions } from '../components/headerActions.js';
import { clearFiltersPanel, getFiltersPanel } from '../components/filtersPanel.js';
import { mountPublisherFilter } from '../components/publisherFilterPanel.js';

const API_BASE = 'http://localhost:7000/api';
const LIMIT = 50;
let currentOffset = 0;
let currentSearch = '';
let currentType = '';
let currentPublishers = [];

export async function renderMangaList(params) {
    const { currentOffset: initialOffset } = getInitialPage(LIMIT, params);
    currentOffset = initialOffset;
    currentSearch = '';
    currentType = '';
    currentPublishers = [];

    mountHeaderActions();
    clearFiltersPanel();

    const searchInput = document.getElementById('search-input');
    searchInput.style.display = 'block';
    searchInput.value = '';
    document.getElementById('add-btn').style.display = 'none';
    document.getElementById('page-title').textContent = 'Манґа';

    // ── Панель фільтрів ───────────────────────────────────────────────────────
    const fp = getFiltersPanel();

    // Фільтр типу
    const typeBlock = document.createElement('div');
    typeBlock.id = 'manga-type-filter';
    typeBlock.className = 'filter-block';
    typeBlock.innerHTML = `
        <span class="filter-block__label">Тип:</span>
        <button class="badge-filter-btn active" data-type="">Всі</button>
        <button class="badge-filter-btn" data-type="issue">Випуски</button>
        <button class="badge-filter-btn" data-type="collection">Збірники</button>
    `;
    typeBlock.addEventListener('click', (e) => {
        const btn = e.target.closest('.badge-filter-btn');
        if (!btn) return;
        typeBlock.querySelectorAll('.badge-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type;
        currentOffset = 0;
        loadAndRender();
    });
    fp.appendChild(typeBlock);

    // Фільтр видавництва
    mountPublisherFilter({
        panelId: 'manga-publisher-filter',
        selectedPubs: currentPublishers,
        onChange: (pubs) => { currentPublishers = pubs; currentOffset = 0; loadAndRender(); },
    });

    // ── Пошук ─────────────────────────────────────────────────────────────────
    let debounce;
    searchInput.oninput = (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            currentSearch = e.target.value;
            currentOffset = 0;
            loadAndRender();
        }, 300);
    };

    await loadAndRender();
}

async function loadAndRender() {
    showLoading();
    try {
        const params = new URLSearchParams({ limit: LIMIT, offset: currentOffset });
        if (currentSearch) params.set('search', currentSearch);
        if (currentType)   params.set('type', currentType);
        if (currentPublishers.length)
            params.set('publisher_ids', currentPublishers.map(p => p.id).join(','));

        const resp = await fetch(`${API_BASE}/manga?${params}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const result = await resp.json();

        if (!result.data || result.data.length === 0) {
            showEmpty('Манґу не знайдено');
            updatePagination(0);
            return;
        }
        renderItems(result.data);
        updatePagination(result.total);
    } catch (err) {
        console.error('Помилка манґи:', err);
        showError('Помилка завантаження даних');
    }
}

function renderItems(items) {
    const content = document.getElementById('content');
    const cards = items.map(item => {
        const imgUrl = item.cv_img ? cv_img_path_small + item.cv_img : null;
        const title = item.name || 'Без назви';
        const isCollection = item._type === 'collection';
        return `
            <div class="card" data-item-id="${item.id}" data-item-type="${item._type}" style="cursor:pointer;">
                <div class="badge badge-${isCollection ? 'collection' : 'issue'}" style="position: absolute; top: .5em; right: .5em; font-size: .7rem; padding: .2rem .5rem;">${isCollection ? 'Збірник' : 'Випуск'}</div>
                <div class="card-img">
                    ${imgUrl ? `<img src="${imgUrl}" alt="${escapeAttr(title)}">` : `<div style="font-size:3rem;">📖</div>`}
                </div>
                <div class="card-body">
                    <div class="card-title">${title}</div>
                    ${item.issue_number ? `<div class="card-meta issue-number">#${item.issue_number}</div>` : ''}
                    ${item.volume_name ? `<div class="card-meta">Том: ${item.volume_name}</div>` : ''}
                    ${isCollection ? `<div class="card-meta">Видавництво: ${item.publisher_name}</div>` : ''}
                </div>
            </div>
        `;
    });
    content.innerHTML = `<div class="grid">${cards.join('')}</div>`;

    if (content._clickAbort) content._clickAbort.abort();
    const ctrl = new AbortController();
    content._clickAbort = ctrl;
    
    content.onclick = (e) => {
        const card = e.target.closest('[data-item-id]');
        if (!card) return;
        const id   = parseInt(card.dataset.itemId);
        const type = card.dataset.itemType;
        const page = type === 'collection' ? 'collection-detail' : 'issue-detail';
        if (e.ctrlKey || e.metaKey) {
            window.open(buildUrl(page, { id }), '_blank');
            return;
        }
        navigate(page, { id });
    };
    content.addEventListener('mousedown', (e) => {
        if (e.button !== 1) return;
        const card = e.target.closest('[data-item-id]');
        if (!card) return;
        e.preventDefault();
        const id   = parseInt(card.dataset.itemId);
        const type = card.dataset.itemType;
        const page = type === 'collection' ? 'collection-detail' : 'issue-detail';
        window.open(buildUrl(page, { id }), '_blank');
    }, { signal: ctrl.signal });
}

function updatePagination(total) {
    createPagination({
        total, limit: LIMIT, offset: currentOffset,
        onPageChange: (newOffset) => { currentOffset = newOffset; loadAndRender(); }
    });
}

function escapeAttr(str) { return String(str).replace(/"/g, '&quot;'); }