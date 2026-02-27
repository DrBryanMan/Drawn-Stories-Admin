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
    document.getElementById('exact-match-wrapper')?.remove();
    document.getElementById('cv-id-search-wrapper')?.remove();
    document.getElementById('view-toggle')?.remove();
    document.getElementById('badge-filter')?.remove();
    document.getElementById('manga-type-filter')?.remove();
}