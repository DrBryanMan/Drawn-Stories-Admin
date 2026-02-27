const routes = {};
let currentRoute = null;

const PARENT_PAGE_MAP = {
    'volume-detail':        'volumes',
    'issue-detail':         'issues',
    'character-detail':     'characters',
    'collection-detail':    'collections',
    'series-detail':        'series',
    'reading-order-detail': 'reading-orders',
    'personnel-detail':     'personnel',
    'event-detail':         'events',
};

function updateActiveNav(path) {
    const navPage = PARENT_PAGE_MAP[path] || path;
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.page === navPage);
    });
}

export function registerRoute(path, handler) {
    routes[path] = handler;
}

export function navigate(path, params = {}) {
    currentRoute = { path, params };

    const url = new URL(window.location);
    const prevPage = url.searchParams.get('page');

    url.searchParams.set('page', path);

    if (params.id !== undefined && params.id !== null) {
        url.searchParams.set('id', params.id);
    } else {
        url.searchParams.delete('id');
    }

    if (params.cv_id !== undefined && params.cv_id !== null) {
        url.searchParams.set('cv_id', params.cv_id);
    } else {
        url.searchParams.delete('cv_id');
    }

    if (prevPage !== path) {
        url.searchParams.delete('p');
    }

    window.history.pushState({}, '', url);
    updateActiveNav(path);

    const handler = routes[path];
    if (handler) {
        handler(params);
    } else {
        console.error(`Route not found: ${path}`);
    }
}

/**
 * Переходить до батьківського каталогу поточної сторінки деталей.
 * Визначає батька через PARENT_PAGE_MAP по currentRoute.
 * Кнопка «←» скрізь однакова: onclick="navigateToParent()"
 */
export function navigateToParent() {
    const path = currentRoute?.path;
    const parent = PARENT_PAGE_MAP[path];
    if (parent) {
        navigate(parent);
    } else {
        console.warn(`navigateToParent: no parent for "${path}"`);
    }
}

export function getCurrentRoute() {
    return currentRoute;
}

export function initRouter() {
    window.addEventListener('popstate', () => {
        const url = new URL(window.location);
        const page  = url.searchParams.get('page') || 'volumes';
        const id    = url.searchParams.get('id');
        const cv_id = url.searchParams.get('cv_id');
        const p     = url.searchParams.get('p');

        const params = {};
        if (id)    params.id    = id;
        if (cv_id) params.cv_id = cv_id;
        if (p)     params.p     = p;

        currentRoute = { path: page, params };
        updateActiveNav(page);

        const handler = routes[page];
        if (handler) handler(params);
    });

    const url = new URL(window.location);
    const page  = url.searchParams.get('page') || 'volumes';
    const id    = url.searchParams.get('id');
    const cv_id = url.searchParams.get('cv_id');
    const p     = url.searchParams.get('p');

    const params = {};
    if (id)    params.id    = id;
    if (cv_id) params.cv_id = cv_id;
    if (p)     params.p     = p;

    navigate(page, params);
}

// Глобальний доступ для inline onclick у HTML-рядках
window.navigate         = navigate;
window.navigateToParent = navigateToParent;