import { fetchItem } from '../api/api.js';
import { cv_img_path_small, formatDate, showError, showLoading, cleanupCatalogUI } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';

const API_BASE = 'http://localhost:7000/api';

export async function renderSeriesDetail(params) {
    const seriesId = params.id;
    if (!seriesId) { navigate('series'); return; }
    cleanupCatalogUI();
    showLoading();
    try {
        const series = await fetchItem('series', seriesId);
        renderPage(series);
    } catch (error) {
        console.error('Помилка завантаження серії:', error);
        showError('Помилка завантаження даних');
    }
}

function renderPage(series) {
    document.getElementById('page-title').innerHTML = `
        <a href="#" onclick="event.preventDefault(); navigate('series')" style="color: var(--text-secondary); text-decoration: none;">
            &larr; Серії
        </a> / ${series.name || 'Серія'}
    `;
    const volumes = series.volumes || [];
    const collections = series.collections || [];
    const content = document.getElementById('content');
    content.innerHTML = `
        <div style="max-width: 1200px;">
            <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
                <div style="flex-shrink: 0;">
                    ${series.cv_img
                        ? `<img src="${series.cv_img}" alt="${series.name}" style="width: 300px; border-radius: 8px; box-shadow: var(--shadow-lg);">`
                        : '<div style="width: 300px; height: 300px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 5rem;">📚</div>'}
                </div>
                <div style="flex: 1;">
                    <h1 style="font-size: 2rem; margin-bottom: 1rem;">${series.name}</h1>
                    ${series.description ? `<p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.5rem;">${series.description}</p>` : ''}
                    <div style="display: grid; gap: 0.25rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                        <div><strong>Томів:</strong> ${volumes.length}</div>
                        <div><strong>Збірників:</strong> ${collections.length}</div>
                        <div><strong>Додано:</strong> ${formatDate(series.created_at)}</div>
                    </div>
                    <button class="btn btn-secondary" onclick="openEditSeriesModal(${series.id})">Редагувати серію</button>
                </div>
            </div>

            <!-- Томи -->
            <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                    <h2 style="font-size: 1.5rem; margin: 0;">Томи (${volumes.length})</h2>
                    <button class="btn btn-primary" onclick="openAddVolumeModal(${series.id})">+ Додати том</button>
                </div>
                ${volumes.length > 0
                    ? `<div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem;">${renderVolumeCards(volumes, series.id)}</div>`
                    : '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Немає томів. Додайте перший!</p>'}
            </div>

            <!-- Збірники -->
            <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                    <h2 style="font-size: 1.5rem; margin: 0;">Збірники (${collections.length})</h2>
                    <button class="btn btn-primary" onclick="openAddCollectionModal(${series.id})">+ Додати збірник</button>
                </div>
                ${collections.length > 0
                    ? `<div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem;">${renderCollectionCards(collections, series.id)}</div>`
                    : '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Немає збірників. Додайте перший!</p>'}
            </div>
        </div>

        <!-- Модалка редагування серії -->
        <div id="edit-series-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
            <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:480px; max-width:90vw; max-height:90vh; overflow-y:auto;">
                <h3 style="margin-bottom:1.25rem;">Редагувати серію</h3>
                <div id="edit-series-form-body"></div>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:1.25rem;">
                    <button class="btn btn-secondary" onclick="closeEditSeriesModal()">Скасувати</button>
                    <button class="btn btn-primary" onclick="saveSeriesEdit()">Зберегти</button>
                </div>
            </div>
        </div>

        <!-- Модалка додавання тому -->
        <div id="add-volume-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
            <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:500px; max-width:90vw;">
                <h3 style="margin-bottom:1rem;">Додати том до серії</h3>
                <div class="form-group">
                    <input type="text" id="volume-search-input" placeholder="Введіть назву тому..." style="width:100%;">
                </div>
                <div id="volume-search-results" style="max-height:320px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:1rem; min-height:48px;"></div>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn btn-secondary" onclick="closeAddVolumeModal()">Скасувати</button>
                </div>
            </div>
        </div>

        <!-- Модалка додавання збірника -->
        <div id="add-collection-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
            <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:500px; max-width:90vw;">
                <h3 style="margin-bottom:1rem;">Додати збірник до серії</h3>
                <div class="form-group">
                    <input type="text" id="collection-search-input" placeholder="Введіть назву збірника..." style="width:100%;">
                </div>
                <div id="collection-search-results" style="max-height:320px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:1rem; min-height:48px;"></div>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn btn-secondary" onclick="closeAddCollectionModal()">Скасувати</button>
                </div>
            </div>
        </div>
    `;
}

function renderVolumeCards(volumes, seriesId) {
    return volumes.map(vol => `
        <div class="card">
            <div class="card-img" onclick="navigateTo('volume-detail', ${vol.id})" style="cursor:pointer;">
                ${vol.cv_img
                    ? `<img src="${cv_img_path_small}${vol.cv_img.startsWith('/') ? '' : '/'}${vol.cv_img}" alt="${vol.name}">`
                    : '<div style="font-size:2.5rem;">📚</div>'}
            </div>
            <div class="card-body">
                <div class="card-title" title="${vol.name}">${vol.name}</div>
                ${vol.start_year ? `<div class="card-meta" style="color:var(--accent); font-weight:600;">${vol.start_year}</div>` : ''}
                <div class="card-meta">📖 ${vol.issue_count || 0} випусків</div>
                <button class="btn btn-danger btn-small" style="margin-top:0.5rem; width:100%;"
                    onclick="event.stopPropagation(); removeVolumeFromSeries(${seriesId}, ${vol.id})">
                    Видалити
                </button>
            </div>
        </div>
    `).join('');
}

function renderCollectionCards(collections, seriesId) {
    return collections.map(col => `
        <div class="card">
            <div class="card-img" onclick="navigateTo('collection-detail', ${col.id})" style="cursor:pointer;">
                ${col.cv_img
                    ? `<img src="${cv_img_path_small}${col.cv_img.startsWith('/') ? '' : '/'}${col.cv_img}" alt="${col.name}">`
                    : '<div style="font-size:2.5rem;">📗</div>'}
            </div>
            <div class="card-body">
                <div class="card-title" title="${col.name}">${col.name}</div>
                ${col.volume_name ? `<div class="card-meta">${col.volume_name}</div>` : ''}
                <button class="btn btn-danger btn-small" style="margin-top:0.5rem; width:100%;"
                    onclick="event.stopPropagation(); removeCollectionFromSeries(${seriesId}, ${col.id})">
                    Видалити
                </button>
            </div>
        </div>
    `).join('');
}

// ===== РЕДАГУВАННЯ СЕРІЇ =====
let currentEditSeriesId = null;

window.openEditSeriesModal = async (seriesId) => {
    currentEditSeriesId = seriesId;
    const formBody = document.getElementById('edit-series-form-body');
    formBody.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-secondary);">Завантаження...</div>';
    document.getElementById('edit-series-modal').style.display = 'flex';
    const series = await fetch(`${API_BASE}/series/${seriesId}`).then(r => r.json());
    formBody.innerHTML = `
        <div class="form-group"><label>Назва *</label><input type="text" id="edit-series-name" value="${series.name || ''}"></div>
        <div class="form-group"><label>Опис</label><textarea id="edit-series-description">${series.description || ''}</textarea></div>
        <div class="form-group"><label>URL зображення</label><input type="url" id="edit-series-cv_img" value="${series.cv_img || ''}"></div>
    `;
};

window.closeEditSeriesModal = () => {
    document.getElementById('edit-series-modal').style.display = 'none';
    currentEditSeriesId = null;
};

window.saveSeriesEdit = async () => {
    const name = document.getElementById('edit-series-name').value.trim();
    if (!name) { alert("Назва обов'язкова"); return; }
    const res = await fetch(`${API_BASE}/series/${currentEditSeriesId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            description: document.getElementById('edit-series-description').value.trim() || null,
            cv_img: document.getElementById('edit-series-cv_img').value.trim() || null
        })
    });
    if (!res.ok) { alert('Помилка збереження'); return; }
    const savedId = currentEditSeriesId;
    window.closeEditSeriesModal();
    const series = await fetchItem('series', savedId);
    renderPage(series);
};

// ===== ТОМИ =====
let addVolumeSeriesId = null;
let volumeSearchTimeout = null;

window.openAddVolumeModal = (seriesId) => {
    addVolumeSeriesId = seriesId;
    document.getElementById('add-volume-modal').style.display = 'flex';
    const input = document.getElementById('volume-search-input');
    input.value = '';
    document.getElementById('volume-search-results').innerHTML = '';
    input.oninput = (e) => {
        clearTimeout(volumeSearchTimeout);
        volumeSearchTimeout = setTimeout(() => searchVolumesForSeries(e.target.value, seriesId), 300);
    };
    input.focus();
};

window.closeAddVolumeModal = () => {
    document.getElementById('add-volume-modal').style.display = 'none';
    addVolumeSeriesId = null;
};

async function searchVolumesForSeries(query, seriesId) {
    if (!query.trim()) { document.getElementById('volume-search-results').innerHTML = ''; return; }
    const res = await fetch(`${API_BASE}/volumes?search=${encodeURIComponent(query)}&limit=20`);
    const result = await res.json();
    const el = document.getElementById('volume-search-results');
    if (!result.data?.length) { el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>'; return; }
    el.innerHTML = result.data.map(vol => `
        <div onclick="addVolumeToSeries(${seriesId}, ${vol.id})"
             style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
             onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
            ${vol.cv_img
                ? `<img src="${cv_img_path_small}${vol.cv_img.startsWith('/') ? '' : '/'}${vol.cv_img}" style="width:40px; height:60px; object-fit:cover; border-radius:3px; flex-shrink:0;">`
                : '<div style="width:40px; height:60px; background:var(--bg-secondary); border-radius:3px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">📚</div>'}
            <div>
                <div style="font-weight:500;">${vol.name}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">CV ID: ${vol.cv_id}</div>
            </div>
        </div>
    `).join('');
}

window.addVolumeToSeries = async (seriesId, volumeId) => {
    const res = await fetch(`${API_BASE}/series/${seriesId}/volumes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume_id: volumeId })
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    window.closeAddVolumeModal();
    const series = await fetchItem('series', seriesId);
    renderPage(series);
};

window.removeVolumeFromSeries = async (seriesId, volumeId) => {
    if (!confirm('Видалити цей том із серії?')) return;
    await fetch(`${API_BASE}/series/${seriesId}/volumes/${volumeId}`, { method: 'DELETE' });
    const series = await fetchItem('series', seriesId);
    renderPage(series);
};

// ===== ЗБІРНИКИ =====
let addCollectionSeriesId = null;
let collectionSearchTimeout = null;

window.openAddCollectionModal = (seriesId) => {
    addCollectionSeriesId = seriesId;
    document.getElementById('add-collection-modal').style.display = 'flex';
    const input = document.getElementById('collection-search-input');
    input.value = '';
    document.getElementById('collection-search-results').innerHTML = '';
    input.oninput = (e) => {
        clearTimeout(collectionSearchTimeout);
        collectionSearchTimeout = setTimeout(() => searchCollectionsForSeries(e.target.value, seriesId), 300);
    };
    input.focus();
};

window.closeAddCollectionModal = () => {
    document.getElementById('add-collection-modal').style.display = 'none';
    addCollectionSeriesId = null;
};

async function searchCollectionsForSeries(query, seriesId) {
    if (!query.trim()) { document.getElementById('collection-search-results').innerHTML = ''; return; }
    const res = await fetch(`${API_BASE}/collections/search?search=${encodeURIComponent(query)}&limit=20`);
    const result = await res.json();
    const el = document.getElementById('collection-search-results');
    if (!result.data?.length) { el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>'; return; }
    el.innerHTML = result.data.map(col => `
        <div onclick="addCollectionToSeries(${seriesId}, ${col.id})"
             style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
             onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
            ${col.cv_img
                ? `<img src="${cv_img_path_small}${col.cv_img.startsWith('/') ? '' : '/'}${col.cv_img}" style="width:40px; height:60px; object-fit:cover; border-radius:3px; flex-shrink:0;">`
                : '<div style="width:40px; height:60px; background:var(--bg-secondary); border-radius:3px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">📗</div>'}
            <div>
                <div style="font-weight:500;">${col.name}</div>
                ${col.volume_name ? `<div style="font-size:0.8rem; color:var(--text-secondary);">${col.volume_name}</div>` : ''}
            </div>
        </div>
    `).join('');
}

window.addCollectionToSeries = async (seriesId, collectionId) => {
    const res = await fetch(`${API_BASE}/series/${seriesId}/collections`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_id: collectionId })
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    window.closeAddCollectionModal();
    const series = await fetchItem('series', seriesId);
    renderPage(series);
};

window.removeCollectionFromSeries = async (seriesId, collectionId) => {
    if (!confirm('Видалити цей збірник із серії?')) return;
    await fetch(`${API_BASE}/series/${seriesId}/collections/${collectionId}`, { method: 'DELETE' });
    const series = await fetchItem('series', seriesId);
    renderPage(series);
};

window.navigateBack = () => navigate('series');
window.navigateTo = (type, id) => navigate(type, { id: id });