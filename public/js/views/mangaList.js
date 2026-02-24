import { cv_img_path_small, showError, showLoading, showEmpty } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { createPagination, getInitialPage } from '../utils/pagination.js';

const API_BASE = 'http://localhost:7000/api';
const LIMIT = 50;
let currentOffset = 0;
let currentSearch = '';

export async function renderMangaList(params) {
    const { currentOffset: initialOffset } = getInitialPage(LIMIT, params);
    currentOffset = initialOffset;
    currentSearch = '';

    // document.getElementById('exact-match-wrapper')?.remove();
    // document.getElementById('view-toggle')?.remove();

    const searchInput = document.getElementById('search-input');
    searchInput.style.display = 'block';
    searchInput.value = '';
    document.getElementById('add-btn').style.display = 'none';
    document.getElementById('page-title').textContent = 'Манґа';

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

        return `
            <div class="card" data-item-id="${item.id}" style="cursor: pointer;">
                <div class="card-img">
                    ${imgUrl
                        ? `<img src="${imgUrl}" alt="${escapeAttr(title)}">`
                        : `<div style="font-size: 3rem;">📖</div>`}
                </div>
                <div class="card-body">
                    <div class="card-title">${title}</div>
                    ${item.volume_name ? `<div class="card-meta">Том: ${item.volume_name}</div>` : ''}
                    ${item.issue_number ? `<div class="card-meta">#${item.issue_number}</div>` : ''}
                </div>
            </div>
        `;
    });

    content.innerHTML = `<div class="grid">${cards.join('')}</div>`;

    // Event delegation — navigate доступна тут бо ми всередині модуля
    content.onclick = (e) => {
        const card = e.target.closest('[data-item-id]');
        if (card) navigate('issue-detail', { id: parseInt(card.dataset.itemId) });
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