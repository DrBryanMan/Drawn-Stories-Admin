/**
 * pagination.js — хелпер пагінації з інпутом і синхронізацією URL (?p=N)
 *
 * Використання:
 *   import { createPagination, getInitialPage } from '../utils/pagination.js';
 *
 *   const { currentOffset } = getInitialPage(LIMIT);
 *
 *   createPagination({
 *     total,
 *     limit: LIMIT,
 *     offset: currentOffset,
 *     onPageChange: (newOffset) => { currentOffset = newOffset; loadAndRender(); }
 *   });
 */

/**
 * Читає початковий offset з URL-параметра ?p=N або з params.p
 * @param {number} limit
 * @param {object} [params] — params переданий router-ом (може містити p)
 * @returns {{ currentOffset: number, initialPage: number }}
 */
export function getInitialPage(limit, params = {}) {
    const urlP = parseInt(new URL(window.location).searchParams.get('p')) || 1;
    const routerP = parseInt(params.p) || 1;
    // Використовуємо більший з двох — params.p береться від popstate
    const page = Math.max(1, urlP, routerP);
    return { currentOffset: (page - 1) * limit, initialPage: page };
}

/**
 * Записує поточну сторінку в URL (replaceState — не смічить історію)
 * @param {number} page
 */
function setPageInUrl(page) {
    const url = new URL(window.location);
    if (page <= 1) {
        url.searchParams.delete('p');
    } else {
        url.searchParams.set('p', page);
    }
    window.history.replaceState({}, '', url);
}

/**
 * Рендерить пагінацію з кнопками ← / → та інпутом сторінки
 * @param {{
 *   total: number,
 *   limit: number,
 *   offset: number,
 *   onPageChange: (newOffset: number) => void
 * }} options
 */
export function createPagination({ total, limit, offset, onPageChange }) {
    const page  = Math.floor(offset / limit) + 1;
    const pages = Math.ceil(total / limit) || 1;

    setPageInUrl(page);

    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    pagination.style.display = 'flex';
    pagination.style.alignItems = 'center';
    pagination.style.gap = '0.5rem';

    // Кнопки
    const prev = document.getElementById('prev-btn');
    const next = document.getElementById('next-btn');

    prev.disabled = offset === 0;
    next.disabled = offset + limit >= total;

    prev.onclick = () => {
        if (offset > 0) onPageChange(offset - limit);
    };
    next.onclick = () => {
        if (offset + limit < total) onPageChange(offset + limit);
    };

    // Інпут сторінки — замінюємо page-info на інпут+текст
    const pageInfo = document.getElementById('page-info');
    if (!pageInfo) return;

    pageInfo.innerHTML = '';
    pageInfo.style.display = 'flex';
    pageInfo.style.alignItems = 'center';
    pageInfo.style.gap = '0.4rem';
    pageInfo.style.fontSize = '0.9rem';

    const inputEl = document.createElement('input');
    inputEl.type = 'number';
    inputEl.min = 1;
    inputEl.max = pages;
    inputEl.value = page;
    inputEl.name = 'page';
    inputEl.id = 'pagination-page-input';
    inputEl.style.cssText = `
        width: 4rem;
        padding: 0.25rem 0.4rem;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background: var(--bg-primary);
        color: var(--text-primary);
        font-size: 0.9rem;
        text-align: center;
    `;

    const label = document.createElement('span');
    label.textContent = `з ${pages} (${total} рез.)`;

    pageInfo.appendChild(inputEl);
    pageInfo.appendChild(label);

    function goToPage() {
        let val = parseInt(inputEl.value);
        if (isNaN(val)) val = page;
        val = Math.max(1, Math.min(pages, val));
        inputEl.value = val;
        const newOffset = (val - 1) * limit;
        if (newOffset !== offset) {
            onPageChange(newOffset);
        }
    }

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); goToPage(); }
    });
    inputEl.addEventListener('blur', goToPage);
    // Виділяємо весь текст при фокусі для зручного введення
    inputEl.addEventListener('focus', () => inputEl.select());
}