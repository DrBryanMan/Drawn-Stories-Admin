// public/js/components/headerActions.js
const CONTAINER_ID = 'catalog-header-actions';

export function mountHeaderActions() {
    if (document.getElementById(CONTAINER_ID)) return;

    const pageHeader = document.querySelector('.page-header');
    if (!pageHeader) return;

    const div = document.createElement('div');
    div.id = CONTAINER_ID;
    div.className = 'header-actions';
    div.innerHTML = `
        <input type="text" id="search-input" placeholder="Пошук..." class="search-input">
        <button id="add-btn" class="btn btn-primary" style="display:none">+ Додати</button>
    `;
    pageHeader.appendChild(div);
}

export function unmountHeaderActions() {
    document.getElementById(CONTAINER_ID)?.remove();

    // Елементи які catalog.js вставляє в header-actions
    document.getElementById('exact-match-wrapper')?.remove();
    document.getElementById('cv-id-search-wrapper')?.remove();

    // Очищаємо панель фільтрів
    const filtersPanel = document.getElementById('filters-panel');
    if (filtersPanel) {
        filtersPanel.innerHTML = '';
        filtersPanel.style.display = 'none';
    }
}