import { fetchItem } from '../api/api.js';
import { cv_logo_svg, cv_img_path_small, cv_img_path_original, formatDate, showError, showLoading, cleanupCatalogUI } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';

const API_BASE = 'http://localhost:7000/api';

export async function renderCollectionDetail(params) {
    const collectionId = params.id;

    if (!collectionId) {
        navigate('collections');
        return;
    }

    cleanupCatalogUI();
    showLoading();

    try {
        const [collection, seriesData] = await Promise.all([
            fetchItem('collections', collectionId),
            fetch(`${API_BASE}/collections/${collectionId}/series`).then(r => r.json())
        ]);
        renderPage(collection, seriesData.data || []);
    } catch (error) {
        console.error('Помилка завантаження збірника:', error);
        showError('Помилка завантаження даних');
    }
}

function renderPage(collection, seriesList = []) {
    document.getElementById('page-title').innerHTML = `
        <a href="#" onclick="event.preventDefault(); window.navigateBack()" style="color: var(--text-secondary); text-decoration: none;">
            &larr; Збірники
        </a> / ${collection.name || 'Збірник'}
    `;

    const content = document.getElementById('content');
    content.innerHTML = `
        <div style="max-width: 1200px;">
            <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
                <div style="flex-shrink: 0;">
                    ${collection.cv_img
                        ? `<img src="${cv_img_path_original}${collection.cv_img.startsWith('/') ? '' : '/'}${collection.cv_img}" alt="${collection.name}"
                            style="width: 300px; border-radius: 8px; box-shadow: var(--shadow-lg);">`
                        : '<div style="width: 300px; height: 450px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 4rem;">&#128213;</div>'}
                </div>
                <div style="flex: 1;">
                    <h1 style="font-size: 2rem; margin-bottom: 1rem;">${collection.name}</h1>
                    <div style="display: grid; gap: 0.5rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                        ${collection.cv_slug ? `<div><strong>CV Slug:</strong> ${collection.cv_slug}</div>` : ''}
                        ${collection.volume_name ? `
                            <div>
                                <strong>Том:</strong>
                                <a href="#" onclick="event.preventDefault(); window.navigateToVolume(${collection.volume_id})"
                                   style="color: var(--accent); text-decoration: none;">
                                    ${collection.volume_name}
                                    ${collection.cv_vol_id ? `<span style="color: var(--text-secondary); font-size: 0.85rem;">(id: ${collection.cv_vol_id})</span>` : ''}
                                </a>
                            </div>
                        ` : ''}
                        ${collection.issue_number ? `<div><strong>Номер:</strong> ${collection.issue_number}</div>` : ''}
                        ${collection.isbn ? `<div><strong>ISBN:</strong> ${collection.isbn}</div>` : ''}
                        ${collection.cover_date ? `<div><strong>Дата обкладинки:</strong> ${collection.cover_date}</div>` : ''}
                        ${collection.release_date ? `<div><strong>Дата виходу:</strong> ${collection.release_date}</div>` : ''}
                        ${collection.publisher || collection.publisher_name ? `
                            <div>
                                <strong>Видавець:</strong>
                                ${collection.publisher_name
                                    ? `${collection.publisher_name} <span style="color: var(--text-secondary); font-size: 0.85rem;">(cv_id: ${collection.publisher})</span>`
                                    : `cv_id: ${collection.publisher}`}
                            </div>
                        ` : ''}
                        ${collection.description ? `<div><strong>Опис:</strong> ${collection.description}</div>` : ''}
                        ${collection.themes && collection.themes.length > 0 ? `
                            <div>
                                <strong>Теми:</strong>
                                ${collection.themes.map(t => `<span class="theme-badge">${t.name}</span>`).join(' ')}
                            </div>
                        ` : ''}
                        ${seriesList.length > 0 ? `
                            <div>
                                <strong>Серії:</strong>
                                ${seriesList.map(s => `
                                    <span class="theme-badge" style="background:#dcfce7; color:#166534; border-color:#bbf7d0; cursor:pointer;"
                                          onclick="navigate('series-detail', { id: ${s.id} })">${s.name}</span>
                                `).join(' ')}
                            </div>
                        ` : ''}
                        <div><strong>Дата додавання:</strong> ${formatDate(collection.created_at)}</div>
                        <div>
                            <a href="https://comicvine.gamespot.com/${collection.cv_slug}/4000-${collection.cv_id}" target="_blank">${cv_logo_svg}</a>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="openEditCollectionModal(${collection.id})">Редагувати збірник</button>
                        <button class="btn btn-primary" onclick="openCollectionAddToSeriesModal(${collection.id})">+ Додати до серії</button>
                        ${collection.cv_id && collection.cv_slug ? `
                            <button class="btn btn-warning" onclick="makeIssueFromCollection(${collection.id})">🔄 Перетворити на випуск</button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                    <h2 style="font-size: 1.5rem; margin: 0;">
                        Випуски у збірнику (${collection.issues?.length || 0})
                    </h2>
                    <button class="btn btn-primary" onclick="openCollectionAddIssueModal(${collection.id})">
                        + Додати випуск
                    </button>
                </div>

                ${collection.issues && collection.issues.length > 0 ? `
                    <div class="table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Обкладинка</th>
                                    <th>Назва</th>
                                    <th>Том</th>
                                    <th>Номер</th>
                                    <th>Дата</th>
                                    <th>Дії</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderIssueRows(collection.issues, collection.id)}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                        Немає випусків. Додайте перший!
                    </p>
                `}
            </div>
        </div>

        <!-- Модалка редагування збірника -->
        <div id="edit-collection-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
            <div style="background: var(--bg-primary); border-radius: 8px; padding: 1.5rem; width: 560px; max-width: 90vw; max-height: 90vh; overflow-y: auto;">
                <h3 style="margin-bottom: 1.25rem;">Редагувати збірник</h3>
                <div id="edit-collection-form-body"></div>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem;">
                    <button class="btn btn-secondary" onclick="closeEditCollectionModal()">Скасувати</button>
                    <button class="btn btn-primary" onclick="saveCollectionEdit()">Зберегти</button>
                </div>
            </div>
        </div>

        <!-- Модалка додавання до серії -->
        <div id="col-add-to-series-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
            <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:500px; max-width:90vw;">
                <h3 style="margin-bottom:1rem;">Додати до серії</h3>
                <div class="form-group">
                    <input type="text" id="col-series-search-input" placeholder="Введіть назву серії..." style="width:100%;">
                </div>
                <div id="col-series-search-results" style="max-height:320px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:1rem; min-height:48px;"></div>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn btn-secondary" onclick="closeCollectionAddToSeriesModal()">Скасувати</button>
                </div>
            </div>
        </div>
        <div id="add-issue-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
            <div style="background: var(--bg-primary); border-radius: 8px; padding: 1.5rem; width: 560px; max-width: 90vw;">
                <h3 style="margin-bottom: 1rem;">Додати випуск до збірника</h3>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; margin-bottom: 0.25rem; display: block;">Назва випуску</label>
                        <input type="text" id="search-issue-name" placeholder="Назва..." style="width: 100%;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; margin-bottom: 0.25rem; display: block;">Назва тому</label>
                        <input type="text" id="search-volume-name" placeholder="Том..." style="width: 100%;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; margin-bottom: 0.25rem; display: block;">Номер</label>
                        <input type="text" id="search-issue-number" placeholder="#..." style="width: 100%;">
                    </div>
                </div>

                <div id="issue-search-results" style="max-height: 320px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 1rem; min-height: 48px;"></div>

                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="closeCollectionAddIssueModal()">Скасувати</button>
                </div>
            </div>
        </div>
    `;
}

function renderIssueRows(issues, collectionId) {
    return issues.map(issue => `
        <tr onclick="window.navigateToIssue(${issue.id})" style="cursor: pointer;">
            <td>
                ${issue.cv_img
                    ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}" alt="${issue.name}">`
                    : '&#128214;'}
            </td>
            <td>${issue.name || 'Без назви'}</td>
            <td style="color: var(--text-secondary); font-size: 0.85rem;">${issue.volume_name || '-'}</td>
            <td>${issue.issue_number || '-'}</td>
            <td>${formatDate(issue.release_date)}</td>
            <td onclick="event.stopPropagation()">
                <button class="btn btn-secondary btn-small" onclick="window.navigateToIssue(${issue.id})">Переглянути</button>
                <button class="btn btn-danger btn-small" onclick="removeIssueFromCollection(${collectionId}, ${issue.id})">Видалити</button>
            </td>
        </tr>
    `).join('');
}

// ===== РЕДАГУВАННЯ ЗБІРНИКА =====

let currentEditCollectionId = null;

window.openEditCollectionModal = async (collectionId) => {
    currentEditCollectionId = collectionId;

    const formBody = document.getElementById('edit-collection-form-body');
    formBody.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-secondary);">Завантаження...</div>';
    document.getElementById('edit-collection-modal').style.display = 'flex';

    try {
        const [collectionRes, collectionThemesRes, allThemesRes] = await Promise.all([
            fetch(`${API_BASE}/collections/${collectionId}`).then(r => r.json()),
            fetch(`${API_BASE}/collections/${collectionId}/themes`).then(r => r.json()),
            fetch(`${API_BASE}/themes`).then(r => r.json())
        ]);

        const collection = collectionRes;
        const currentThemeIds = new Set((collectionThemesRes.data || []).map(t => t.id));
        const allThemes = allThemesRes.data || [];

        formBody.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>CV ID</label>
                    <input type="number" id="edit-col-cv_id" value="${collection.cv_id || ''}">
                </div>
                <div class="form-group">
                    <label>CV Slug</label>
                    <input type="text" id="edit-col-cv_slug" value="${collection.cv_slug || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Назва *</label>
                <input type="text" id="edit-col-name" value="${collection.name || ''}">
            </div>
            <div class="form-group">
                <label>URL зображення</label>
                <input type="url" id="edit-col-cv_img" value="${collection.cv_img || ''}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Volume CV ID</label>
                    <input type="number" id="edit-col-cv_vol_id" value="${collection.cv_vol_id || ''}">
                </div>
                <div class="form-group">
                    <label>Publisher (CV ID)</label>
                    <input type="number" id="edit-col-publisher" value="${collection.publisher || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Номер випуску</label>
                    <input type="text" id="edit-col-issue_number" value="${collection.issue_number || ''}">
                </div>
                <div class="form-group">
                    <label>ISBN</label>
                    <input type="text" id="edit-col-isbn" value="${collection.isbn || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Дата обкладинки</label>
                    <input type="date" id="edit-col-cover_date" value="${collection.cover_date || ''}">
                </div>
                <div class="form-group">
                    <label>Дата виходу</label>
                    <input type="date" id="edit-col-release_date" value="${collection.release_date || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Опис</label>
                <textarea id="edit-col-description" rows="3" style="width:100%; resize:vertical;">${collection.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Теми</label>
                <input type="text" id="edit-theme-search" placeholder="Пошук тем..." style="width: 100%; margin-bottom: 0.5rem;" oninput="filterThemes(this.value)">
                <div id="edit-themes-list" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px; padding: 0.25rem 0;">
                    ${allThemes.length > 0
                        ? allThemes.map(theme => `
                            <label class="theme-checkbox-item"
                                onmouseenter="this.style.background='var(--bg-secondary)'"
                                onmouseleave="this.style.background=''">
                                <input type="checkbox" value="${theme.id}" ${currentThemeIds.has(theme.id) ? 'checked' : ''} style="width: auto; margin: 0; flex-shrink: 0; accent-color: var(--accent);">
                                <span>${theme.name}</span>
                                <span style="color: var(--text-secondary); font-size: 0.75rem; margin-left: auto;">(cv_id: ${theme.cv_id})</span>
                            </label>
                        `).join('')
                        : '<div style="color: var(--text-secondary); padding: 0.5rem;">Теми не знайдено</div>'
                    }
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Помилка завантаження даних для редагування:', error);
        formBody.innerHTML = '<div style="color: var(--danger); padding: 1rem;">Помилка завантаження даних</div>';
    }
};

window.filterThemes = (q) => {
    const lower = q.toLowerCase();
    document.querySelectorAll('#edit-themes-list .theme-checkbox-item').forEach(item => {
        const name = item.querySelector('span')?.textContent?.toLowerCase() || '';
        item.style.display = name.includes(lower) ? '' : 'none';
    });
};

window.closeEditCollectionModal = () => {
    document.getElementById('edit-collection-modal').style.display = 'none';
    currentEditCollectionId = null;
};

window.saveCollectionEdit = async () => {
    const cv_id = document.getElementById('edit-col-cv_id').value;
    const cv_slug = document.getElementById('edit-col-cv_slug').value.trim();
    const name = document.getElementById('edit-col-name').value.trim();
    const cv_img = document.getElementById('edit-col-cv_img').value.trim();
    const cv_vol_id = document.getElementById('edit-col-cv_vol_id').value;
    const publisher = document.getElementById('edit-col-publisher').value;
    const issue_number = document.getElementById('edit-col-issue_number').value.trim();
    const isbn = document.getElementById('edit-col-isbn').value.trim();
    const cover_date = document.getElementById('edit-col-cover_date').value;
    const release_date = document.getElementById('edit-col-release_date').value;
    const description = document.getElementById('edit-col-description').value.trim();

    if (!name) {
        alert("Назва обов'язкова");
        return;
    }

    const checkboxes = document.querySelectorAll('#edit-themes-list input[type="checkbox"]');
    const theme_ids = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));

    try {
        const response = await fetch(`${API_BASE}/collections/${currentEditCollectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cv_id: cv_id ? parseInt(cv_id) : null,
                cv_slug: cv_slug || null,
                name,
                cv_img: cv_img || null,
                cv_vol_id: cv_vol_id ? parseInt(cv_vol_id) : null,
                publisher: publisher ? parseInt(publisher) : null,
                issue_number: issue_number || null,
                isbn: isbn || null,
                cover_date: cover_date || null,
                release_date: release_date || null,
                description: description || null,
                theme_ids
            })
        });

        if (!response.ok) {
            const err = await response.json();
            alert(err.error || 'Помилка збереження');
            return;
        }

        const savedId = currentEditCollectionId;
        window.closeEditCollectionModal();
        const [collection, seriesData] = await Promise.all([
            fetchItem('collections', savedId),
            fetch(`${API_BASE}/collections/${savedId}/series`).then(r => r.json())
        ]);
        renderPage(collection, seriesData.data || []);
        await window.updateStats();
    } catch (error) {
        console.error('Помилка:', error);
        alert('Помилка збереження збірника');
    }
};

// ===== ПОШУК І ДОДАВАННЯ ВИПУСКІВ =====

let addIssueCollectionId = null;
let issueSearchTimeout = null;

window.openCollectionAddIssueModal = (collectionId) => {
    addIssueCollectionId = collectionId;

    document.getElementById('add-issue-modal').style.display = 'flex';
    document.getElementById('search-issue-name').value = '';
    document.getElementById('search-volume-name').value = '';
    document.getElementById('search-issue-number').value = '';
    document.getElementById('issue-search-results').innerHTML = '';

    ['search-issue-name', 'search-volume-name', 'search-issue-number'].forEach(inputId => {
        document.getElementById(inputId).oninput = () => {
            clearTimeout(issueSearchTimeout);
            issueSearchTimeout = setTimeout(() => searchIssues(collectionId), 300);
        };
    });

    document.getElementById('search-issue-name').focus();
};

window.closeCollectionAddIssueModal = () => {
    document.getElementById('add-issue-modal').style.display = 'none';
    addIssueCollectionId = null;
};

async function searchIssues(collectionId) {
    const name = document.getElementById('search-issue-name').value.trim();
    const volumeName = document.getElementById('search-volume-name').value.trim();
    const issueNumber = document.getElementById('search-issue-number').value.trim();

    if (!name && !volumeName && !issueNumber) {
        document.getElementById('issue-search-results').innerHTML = '';
        return;
    }

    const params = new URLSearchParams({ limit: 20 });
    if (name) params.set('name', name);
    if (volumeName) params.set('volume_name', volumeName);
    if (issueNumber) params.set('issue_number', issueNumber);

    try {
        const response = await fetch(`${API_BASE}/issues?${params}`);
        const result = await response.json();
        const resultsEl = document.getElementById('issue-search-results');

        if (!result.data || result.data.length === 0) {
            resultsEl.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">Нічого не знайдено</div>';
            return;
        }

        resultsEl.innerHTML = result.data.map(issue => `
            <div
                onclick="addIssueToCollection(${collectionId}, ${issue.id})"
                style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.15s;"
                onmouseenter="this.style.background='var(--bg-secondary)'"
                onmouseleave="this.style.background=''"
            >
                ${issue.cv_img
                    ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}" style="width: 40px; height: 60px; object-fit: cover; border-radius: 3px; flex-shrink: 0;">`
                    : '<div style="width: 40px; height: 60px; background: var(--bg-secondary); border-radius: 3px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">&#128214;</div>'}
                <div>
                    <div style="font-weight: 500;">${issue.name || 'Без назви'}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        ${issue.volume_name || ''}${issue.issue_number ? ' &middot; #' + issue.issue_number : ''}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Помилка пошуку:', error);
    }
}

window.addIssueToCollection = async (collectionId, issueId) => {
    try {
        const response = await fetch(`${API_BASE}/collections/${collectionId}/issues`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issue_id: issueId })
        });

        if (!response.ok) {
            const err = await response.json();
            alert(err.error || 'Помилка додавання');
            return;
        }

        window.closeCollectionAddIssueModal();
        const [collection, seriesData] = await Promise.all([
            fetchItem('collections', collectionId),
            fetch(`${API_BASE}/collections/${collectionId}/series`).then(r => r.json())
        ]);
        renderPage(collection, seriesData.data || []);
    } catch (error) {
        console.error('Помилка:', error);
        alert('Помилка додавання випуску');
    }
};

window.removeIssueFromCollection = async (collectionId, issueId) => {
    if (!confirm('Видалити цей випуск зі збірника?')) return;
    try {
        await fetch(`${API_BASE}/collections/${collectionId}/issues/${issueId}`, { method: 'DELETE' });
        const [collection, seriesData] = await Promise.all([
            fetchItem('collections', collectionId),
            fetch(`${API_BASE}/collections/${collectionId}/series`).then(r => r.json())
        ]);
        renderPage(collection, seriesData.data || []);
    } catch (error) {
        console.error('Помилка:', error);
        alert('Помилка видалення випуску');
    }
};

window.navigateBack = () => navigate('collections');
window.navigateToIssue = (id) => navigate('issue-detail', { id });
window.navigateToVolume = (id) => navigate('volume-detail', { id });

// ===== ДОДАТИ ЗБІРНИК ДО СЕРІЇ =====
let colAddToSeriesId = null;
let colSeriesSearchTimeout = null;

window.openCollectionAddToSeriesModal = (collectionId) => {
    colAddToSeriesId = collectionId;
    document.getElementById('col-add-to-series-modal').style.display = 'flex';
    const input = document.getElementById('col-series-search-input');
    input.value = '';
    document.getElementById('col-series-search-results').innerHTML = '';
    input.oninput = (e) => {
        clearTimeout(colSeriesSearchTimeout);
        colSeriesSearchTimeout = setTimeout(() => searchSeriesForCollection(e.target.value), 300);
    };
    input.focus();
};

window.closeCollectionAddToSeriesModal = () => {
    document.getElementById('col-add-to-series-modal').style.display = 'none';
    colAddToSeriesId = null;
};

async function searchSeriesForCollection(query) {
    if (!query.trim()) { document.getElementById('col-series-search-results').innerHTML = ''; return; }
    const res = await fetch(`${API_BASE}/series?search=${encodeURIComponent(query)}&limit=20`);
    const result = await res.json();
    const el = document.getElementById('col-series-search-results');
    if (!result.data?.length) {
        el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>';
        return;
    }
    el.innerHTML = result.data.map(s => `
        <div onclick="addCollectionToSeriesFromDetail(${s.id})"
             style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
             onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
            ${s.cv_img
                ? `<img src="${s.cv_img}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; flex-shrink:0;">`
                : '<div style="width:40px; height:40px; background:var(--bg-secondary); border-radius:4px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:1.2rem;">📚</div>'}
            <span style="font-weight:500;">${s.name}</span>
        </div>
    `).join('');
}

window.addCollectionToSeriesFromDetail = async (seriesId) => {
    const res = await fetch(`${API_BASE}/series/${seriesId}/collections`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_id: colAddToSeriesId })
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    window.closeCollectionAddToSeriesModal();
    const [collection, seriesData] = await Promise.all([
        fetchItem('collections', colAddToSeriesId),
        fetch(`${API_BASE}/collections/${colAddToSeriesId}/series`).then(r => r.json())
    ]);
    renderPage(collection, seriesData.data || []);
};

window.makeIssueFromCollection = async (collectionId) => {
    if (!confirm('Перетворити цей збірник на випуск? Збірник буде видалено, а натомість створено випуск з тими самими даними.')) return;
    try {
        const res = await fetch(`${API_BASE}/collections/${collectionId}/make-issue`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Помилка конвертації'); return; }
        await window.updateStats();
        navigate('issue-detail', { id: data.issue.id });
    } catch (e) {
        alert('Помилка під час конвертації');
    }
};