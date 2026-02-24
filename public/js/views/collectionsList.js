import { cv_img_path_small, showError, showLoading, showEmpty } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { createPagination, getInitialPage } from '../utils/pagination.js';

const LIMIT = 50;
let currentOffset = 0;
let currentSearch = '';
let currentType = '';

export async function renderCollectionsList(params) {
    const { currentOffset: initialOffset } = getInitialPage(LIMIT, params);
    currentOffset = initialOffset;
    currentSearch = '';
    currentType = '';

    // document.getElementById('exact-match-wrapper')?.remove();
    // document.getElementById('view-toggle')?.remove();
    document.getElementById('badge-filter')?.remove();

    const searchInput = document.getElementById('search-input');
    searchInput.style.display = 'block';
    searchInput.value = '';
    document.getElementById('add-btn').style.display = 'none';
    document.getElementById('page-title').textContent = 'Збірники';

    // Вставляємо кнопки-фільтри після рядка пошуку
    const filterBar = document.createElement('div');
    filterBar.id = 'badge-filter';
    filterBar.style.cssText = 'display:flex;gap:0.5rem;padding:0.5rem 1rem;flex-wrap:wrap;';
    filterBar.innerHTML = `
        <button class="badge-filter-btn active" data-type="">Всі</button>
        <button class="badge-filter-btn" data-type="collection">Збірник</button>
        <button class="badge-filter-btn" data-type="issue">Випуск</button>
    `;
    searchInput.parentNode.insertBefore(filterBar, searchInput.nextSibling);

    filterBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.badge-filter-btn');
        if (!btn) return;
        filterBar.querySelectorAll('.badge-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type;
        currentOffset = 0;
        loadAndRender();
    });

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
        if (currentType) params.set('type', currentType);

        const resp = await fetch(`http://localhost:7000/api/collections?${params}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const result = await resp.json();

        if (!result.data || result.data.length === 0) {
            showEmpty('Збірників не знайдено');
            updatePagination(0);
            return;
        }
        renderItems(result.data);
        updatePagination(result.total);
    } catch (err) {
        console.error('Помилка збірників:', err);
        showError('Помилка завантаження даних');
    }
}

function renderItems(items) {
    const content = document.getElementById('content');

    const cards = items.map(item => {
        const isCollection = item._type === 'collection';
        const imgUrl = item.cv_img ? cv_img_path_small + item.cv_img : null;
        const title = item.name || 'Без назви';
        const badgeClass = isCollection ? 'badge-collection' : 'badge-issue';
        const badgeText  = isCollection ? 'Збірник' : 'Випуск';

        return `
            <div class="card collections-card"
                 data-item-id="${item.id}"
                 data-item-type="${item._type}"
                 style="cursor: pointer; position: relative;">
                <span class="badge ${badgeClass}"
                      style="position: absolute; top: 0.5rem; right: 0.5rem; z-index: 1;">
                    ${badgeText}
                </span>
                <div class="card-img">
                    ${imgUrl
                        ? `<img src="${imgUrl}" alt="${escapeAttr(title)}">`
                        : `<div style="font-size: 3rem;">📚</div>`}
                </div>
                <div class="card-body">
                    <div class="card-title">${title}</div>
                    ${item.volume_name  ? `<div class="card-meta">📚 ${item.volume_name}</div>` : ''}
                    ${item.issue_number ? `<div class="card-meta">#${item.issue_number}</div>` : ''}
                    ${isCollection && item.issue_count ? `<div class="card-meta">📖 ${item.issue_count} вип.</div>` : ''}
                    ${item.publisher_name ? `<div class="card-meta">${item.publisher_name}</div>` : ''}
                </div>
            </div>
        `;
    });

    content.innerHTML = `<div class="grid">${cards.join('')}</div>`;

    // Event delegation — navigate доступна тут бо ми всередині модуля
    content.onclick = (e) => {
        const card = e.target.closest('[data-item-id]');
        if (!card) return;
        const id   = parseInt(card.dataset.itemId);
        const type = card.dataset.itemType;
        if (type === 'collection') navigate('collection-detail', { id });
        else                       navigate('issue-detail', { id });
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