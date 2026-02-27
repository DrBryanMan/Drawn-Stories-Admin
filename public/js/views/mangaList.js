import { cv_img_path_small, showError, showLoading, showEmpty } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { createPagination, getInitialPage } from '../utils/pagination.js';
import { mountHeaderActions } from '../components/headerActions.js';

const API_BASE = 'http://localhost:7000/api';
const LIMIT = 50;
let currentOffset = 0;
let currentSearch = '';
let currentType = ''; // '' | 'issue' | 'collection'

export async function renderMangaList(params) {
    const { currentOffset: initialOffset } = getInitialPage(LIMIT, params);
    currentOffset = initialOffset;
    currentSearch = '';
    currentType = '';

    mountHeaderActions()
    const searchInput = document.getElementById('search-input');
    searchInput.style.display = 'block';
    searchInput.value = '';
    document.getElementById('add-btn').style.display = 'none';
    document.getElementById('page-title').textContent = 'Манґа';

    renderTypeFilter();

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

function renderTypeFilter() {
    // Видаляємо старий фільтр, якщо є
    document.getElementById('manga-type-filter')?.remove();

    const searchInput = document.getElementById('search-input');
    const wrapper = document.createElement('div');
    wrapper.id = 'manga-type-filter';
    wrapper.style.cssText = 'display:flex; gap:0.4rem; margin-bottom:0.75rem; flex-wrap:wrap;';

    const badges = [
        { label: 'Всі', value: '' },
        { label: 'Випуски', value: 'issue' },
        { label: 'Збірники', value: 'collection' },
    ];

    badges.forEach(({ label, value }) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.dataset.type = value;
        btn.className = 'badge-filter' + (currentType === value ? ' active' : '');
        btn.style.cssText = `
            padding: 0.25rem 0.75rem;
            border-radius: 999px;
            border: 1px solid var(--border-color);
            background: ${currentType === value ? 'var(--accent-color)' : 'var(--bg-secondary)'};
            color: ${currentType === value ? '#fff' : 'var(--text-primary)'};
            cursor: pointer;
            font-size: 0.85rem;
        `;
        btn.onclick = () => {
            currentType = value;
            currentOffset = 0;
            renderTypeFilter();
            loadAndRender();
        };
        wrapper.appendChild(btn);
    });

    searchInput.insertAdjacentElement('afterend', wrapper);
}

async function loadAndRender() {
    showLoading();
    try {
        const params = new URLSearchParams({ limit: LIMIT, offset: currentOffset });
        if (currentSearch) params.set('search', currentSearch);
        if (currentType) params.set('type', currentType);

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
            <div class="card" data-item-id="${item.id}" data-item-type="${item._type}" style="cursor: pointer;">
                <div class="card-img">
                    ${imgUrl
                        ? `<img src="${imgUrl}" alt="${escapeAttr(title)}">`
                        : `<div style="font-size: 3rem;">📖</div>`}
                </div>
                <div class="card-body">
                    <div class="card-title">${title}</div>
                    ${item.volume_name ? `<div class="card-meta">Том: ${item.volume_name}</div>` : ''}
                    ${item.issue_number ? `<div class="card-meta">#${item.issue_number}</div>` : ''}
                    ${isCollection ? `<div class="card-meta" style="color:var(--accent-color)">Збірник</div>` : ''}
                </div>
            </div>
        `;
    });

    content.innerHTML = `<div class="grid">${cards.join('')}</div>`;

    content.onclick = (e) => {
        const card = e.target.closest('[data-item-id]');
        if (!card) return;
        const id = parseInt(card.dataset.itemId);
        const type = card.dataset.itemType;
        navigate(type === 'collection' ? 'collection-detail' : 'issue-detail', { id });
    };
}

function updatePagination(total) {
    createPagination({
        total,
        limit: LIMIT,
        offset: currentOffset,
        onPageChange: (newOffset) => { currentOffset = newOffset; loadAndRender(); }
    });
}

function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;');
}