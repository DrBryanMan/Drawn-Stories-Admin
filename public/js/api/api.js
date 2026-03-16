import { API_BASE } from '../utils/config.js';

export async function fetchStats() {
    const response = await fetch(`${API_BASE}/stats`);
    return response.json();
}

export async function fetchItems(type, params = {}) {
    const queryParams = new URLSearchParams();
    
    // Додаємо всі параметри, які передані
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            queryParams.set(key, params[key]);
        }
    });
    
    // Встановлюємо дефолтні значення якщо не передані
    // if (!queryParams.has('limit')) {
    //     queryParams.set('limit', '50');
    // }
    if (!queryParams.has('offset')) {
        queryParams.set('offset', '0');
    }
    
    const response = await fetch(`${API_BASE}/${type}?${queryParams}`);
    return response.json();
}

export async function fetchItem(type, id) {
    const response = await fetch(`${API_BASE}/${type}/${id}`);
    if (!response.ok) {
        throw new Error(`Помилка завантаження: ${response.status}`);
    }
    return response.json();
}

export async function createItem(type, data) {
    const response = await fetch(`${API_BASE}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error(`Помилка створення: ${response.status}`);
    }
    return response.json();
}

export async function updateItem(type, id, data) {
    const response = await fetch(`${API_BASE}/${type}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error(`Помилка оновлення: ${response.status}`);
    }
    return response.json();
}

export async function deleteItem(type, id) {
    const response = await fetch(`${API_BASE}/${type}/${id}`, {
        method: 'DELETE'
    });
    
    if (!response.ok) {
        throw new Error(`Помилка видалення: ${response.status}`);
    }
    return response.json();
}