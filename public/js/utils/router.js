// public/js/utils/router.js — повна виправлена версія

const routes = {};
let currentRoute = null;

export function registerRoute(path, handler) {
    routes[path] = handler;
}

export function navigate(path, params = {}) {
    currentRoute = { path, params };
    
    const url = new URL(window.location);
    const prevPage = url.searchParams.get('page');

    url.searchParams.set('page', path);

    // db id
    if (params.id !== undefined && params.id !== null) {
        url.searchParams.set('id', params.id);
    } else {
        url.searchParams.delete('id');
    }

    // cv_id (для зручності — щоб в URL було видно обидва)
    if (params.cv_id !== undefined && params.cv_id !== null) {
        url.searchParams.set('cv_id', params.cv_id);
    } else {
        url.searchParams.delete('cv_id');
    }

    // Скидаємо номер сторінки якщо переходимо на інший розділ
    if (prevPage !== path) {
        url.searchParams.delete('p');
    }

    window.history.pushState({}, '', url);
    
    const handler = routes[path];
    if (handler) {
        handler(params);
    } else {
        console.error(`Route not found: ${path}`);
    }
}

export function getCurrentRoute() {
    return currentRoute;
}

export function initRouter() {
    window.addEventListener('popstate', () => {
        const url = new URL(window.location);
        const page = url.searchParams.get('page') || 'volumes';
        const id    = url.searchParams.get('id');
        const cv_id = url.searchParams.get('cv_id');
        const p     = url.searchParams.get('p');
        
        const params = {};
        if (id)    params.id    = id;
        if (cv_id) params.cv_id = cv_id;
        if (p)     params.p     = p;
        
        currentRoute = { path: page, params };
        const handler = routes[page];
        if (handler) {
            handler(params);
        }
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