import { API_BASE } from '../utils/config.js';
import { fetchItem } from '../api/api.js';
import { cv_img_path_small, cv_img_path_original, formatDate, showError, showLoading, initDetailPage } from '../utils/helpers.js';
import { navigate, buildUrl } from '../utils/router.js';
import { openAddVolumeModal } from '../components/addVolumeModal.js';
import { openAddIssueModal } from '../components/addIssueModal.js';

let _collectionsSortOrder = 'date'; // 'date' | 'name' | 'number'

export async function renderSeriesDetail(params) {
    const id = params.id;
    if (!id) { navigate('series'); return; }

    initDetailPage();
    showLoading();

    try {
        const series = await fetchItem('series', id);
        renderPage(series);
    } catch (error) {
        console.error('Помилка завантаження серії:', error);
        showError('Помилка завантаження даних');
    }
}

async function renderPage(series) {
    const volumes = series.volumes || [];
    const collections = series.collections || [];

    // Розділяємо томи на два типи:
    const collectionVolumes = volumes.filter(v => v.has_collection_theme || +v.collection_count > 0);
    const regularVolumes    = volumes.filter(v => !v.has_collection_theme && +v.collection_count === 0);

    // Зберігаємо для використання у модалках
    window._seriesVolumes     = volumes;
    window._seriesCollections = collections;

    document.getElementById('page-title').innerHTML = `
        <a href="#" onclick="event.preventDefault(); navigateBack()" style="color: var(--text-secondary); text-decoration: none;">
            ← Серії
        </a> / ${series.name}
    `;

    const content = document.getElementById('content');
    content.innerHTML = `
        <div style="max-width: 1200px;">
            <!-- Шапка серії -->
            <div style="display: flex; gap: 2rem; margin-bottom: 2rem; align-items: flex-start;">
                <div style="flex-shrink: 0;">
                    ${series.cv_img
                        ? `<img src="${series.cv_img.startsWith('http') ? series.cv_img : cv_img_path_original + (series.cv_img.startsWith('/') ? '' : '/') + series.cv_img}" style="width: 300px; border-radius: 8px; box-shadow: var(--shadow-lg);" alt="${series.name}">`
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

            <!-- Томи: звичайні -->
            <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                    <h2 style="font-size: 1.5rem; margin: 0;">Томи (${regularVolumes.length})</h2>
                    <button class="btn btn-primary" onclick="openAddVolumeToSeriesModal(${series.id})">+ Додати том</button>
                </div>
                ${regularVolumes.length > 0
                    ? `<div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem;">${renderVolumeCards(regularVolumes, series.id)}</div>`
                    : '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Немає звичайних томів. Додайте перший!</p>'}
            </div>

            <!-- Томи збірників -->
            <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                    <h2 style="font-size: 1.5rem; margin: 0;">Томи збірників (${collectionVolumes.length})</h2>
                    <button class="btn btn-secondary btn-small" title="Перерахувати томи серії"
                        onclick="recalculateVolumes(${series.id})">🔄 Томи</button>
                </div>
                ${collectionVolumes.length > 0
                    ? `<div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem;">${renderVolumeCards(collectionVolumes, series.id)}</div>`
                    : '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Немає томів збірників.</p>'}
            </div>

            <!-- Збірники -->
            <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                    <h2 style="font-size: 1.5rem; margin: 0;">Збірники (${collections.length})</h2>
                    <div style="display:flex; gap:0.75rem; align-items:center;">
                        ${collections.length > 1 ? `
                            <select id="collections-sort-select" style="padding:0.4rem 0.75rem; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.9rem;">
                                <option value="date"   ${_collectionsSortOrder === 'date'   ? 'selected' : ''}>За датою</option>
                                <option value="number" ${_collectionsSortOrder === 'number' ? 'selected' : ''}>За номером</option>
                                <option value="name"   ${_collectionsSortOrder === 'name'   ? 'selected' : ''}>За назвою</option>
                            </select>
                        ` : ''}
                        <button class="btn btn-secondary btn-small" title="Перерахувати збірники серії"
                            onclick="recalculateCollections(${series.id})">🔄 Збірники</button>
                        <button class="btn btn-primary" onclick="openAddCollectionToSeriesModal(${series.id})">+ Додати збірник</button>
                    </div>
                </div>
                <div id="collections-grid">
                    ${collections.length > 0
                        ? `<div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem;">${renderCollectionCards(sortCollections(collections, _collectionsSortOrder), series.id)}</div>`
                        : '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Немає збірників. Додайте перший!</p>'}
                </div>
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
    `;
    const sortSelect = document.getElementById('collections-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            _collectionsSortOrder = sortSelect.value;
            const grid = document.getElementById('collections-grid');
            if (grid) {
                grid.innerHTML = `<div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem;">${renderCollectionCards(sortCollections(collections, _collectionsSortOrder), series.id)}</div>`;
            }
        });
    }
}

// ── Картки томів ─────────────────────────────────────────────────────────

function renderVolumeCards(volumes, seriesId) {
    return volumes.map(vol => `
        <div class="card" style="cursor:pointer; position: relative;"
             onclick="if(event.ctrlKey||event.metaKey){event.preventDefault();window.open('${buildUrl('volume-detail', { id: vol.id })}','_blank')}else{navigate('volume-detail',{id:${vol.id}})}"
             onmousedown="if(event.button===1){event.preventDefault();window.open('${buildUrl('volume-detail', { id: vol.id })}','_blank')}">
            <div class="card-img">
                ${vol.cv_img
                    ? `<img src="${cv_img_path_small}${vol.cv_img.startsWith('/') ? '' : '/'}${vol.cv_img}" alt="${vol.name}">`
                    : '<div style="font-size:2.5rem;">📚</div>'}
            </div>
            <div class="card-body">
                <div class="card-title" title="${vol.name}">${vol.name}</div>
                ${(+vol.collection_count > 0)
                    ? `<div class="card-meta">📗 ${vol.collection_count}</div>`
                    : (vol.issue_count ? `<div class="card-meta">📖 ${vol.issue_count}</div>` : '')}
                <button class="btn btn-delete btn-notext btn-danger btn-small"
                    onclick="event.stopPropagation(); removeVolumeFromSeries(${seriesId}, ${vol.id})">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
}

// ── Картки збірників ─────────────────────────────────────────────────────

function renderCollectionCards(collections, seriesId) {
    return collections.map(col => `
        <div class="card" style="cursor:pointer; position: relative;"
             onclick="if(event.ctrlKey||event.metaKey){event.preventDefault();window.open('${buildUrl('collection-detail', { id: col.id })}','_blank')}else{navigate('collection-detail',{id:${col.id}})}"
             onmousedown="if(event.button===1){event.preventDefault();window.open('${buildUrl('collection-detail', { id: col.id })}','_blank')}">            <div class="card-img">
                ${col.cv_img
                    ? `<img src="${cv_img_path_small}${col.cv_img.startsWith('/') ? '' : '/'}${col.cv_img}" alt="${col.name}">`
                    : '<div style="font-size:2.5rem;">📗</div>'}
            </div>
            <div class="card-body">
                <div class="card-title" title="${col.name}">${col.name}</div>
                ${col.volume_name ? `<div class="card-meta">${col.volume_name}</div>` : ''}
                ${col.issue_count ? `<div class="card-meta">📖 ${col.issue_count}</div>` : ''}
                ${col.issue_number ? `<div class="card-meta">#${col.issue_number}</div>` : ''}
                <button class="btn btn-delete btn-notext btn-danger btn-small"
                    onclick="event.stopPropagation(); removeCollectionFromSeries(${seriesId}, ${col.id})">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
}

function sortCollections(collections, order) {
    const arr = [...collections];
    if (order === 'name') {
        return arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    if (order === 'number') {
        return arr.sort((a, b) => {
            const na = parseFloat(a.issue_number) || Infinity;
            const nb = parseFloat(b.issue_number) || Infinity;
            return na - nb;
        });
    }
    // 'date' — cover_date, fallback release_date, fallback без дати в кінець
    return arr.sort((a, b) => {
        const da = a.cover_date || a.release_date || '';
        const db = b.cover_date || b.release_date || '';
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.localeCompare(db);
    });
}

// ===== РЕДАГУВАННЯ СЕРІЇ ================================================

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

// ===== ТОМИ =============================================================

window.openAddVolumeToSeriesModal = (seriesId) => {
    openAddVolumeModal({
        title: 'Додати том до серії',
        alreadyIds: new Set((window._seriesVolumes || []).map(v => v.id)),
        apiBase: API_BASE,
        cvImgPathSmall: cv_img_path_small,
        warnCollectionVolume: true,
        onAdd: async (volumeIds) => {
            let lastError = null;
            for (const volId of volumeIds) {
                const res = await fetch(`${API_BASE}/series/${seriesId}/volumes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ volume_id: volId })
                });
                if (!res.ok) { const err = await res.json(); lastError = err.error; }
            }
            if (lastError) alert(lastError);
            const updatedSeries = await fetchItem('series', seriesId);
            renderPage(updatedSeries);
        }
    });
};

window.removeVolumeFromSeries = async (seriesId, volumeId) => {
    if (!confirm('Видалити цей том із серії?')) return;
    await fetch(`${API_BASE}/series/${seriesId}/volumes/${volumeId}`, { method: 'DELETE' });
    const series = await fetchItem('series', seriesId);
    renderPage(series);
};

// ===== ЗБІРНИКИ =========================================================

window.openAddCollectionToSeriesModal = (seriesId) => {
    openAddIssueModal({
        title: 'Додати збірник до серії',
        alreadyIds: new Set((window._seriesCollections || []).map(c => c.id)),
        apiBase: API_BASE,
        cvImgPathSmall: cv_img_path_small,
        showImportance: false,
        // ── ось і вся різниця ──
        searchEndpoint: `${API_BASE}/collections/search`,
        nameLabel:      'Назва збірника',
        cvVolIdParam:   'cv_vol_id',
        cardIcon:       '📗',
        onAdd: async (collectionIds) => {
            let lastError = null;
            for (const colId of collectionIds) {
                const res = await fetch(`${API_BASE}/series/${seriesId}/collections`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ collection_id: colId })
                });
                if (!res.ok) { const err = await res.json(); lastError = err.error; }
            }
            if (lastError) alert(lastError);
            const updatedSeries = await fetchItem('series', seriesId);
            renderPage(updatedSeries);
        }
    });
};

window.removeCollectionFromSeries = async (seriesId, collectionId) => {
    if (!confirm('Видалити цей збірник із серії?')) return;
    await fetch(`${API_BASE}/series/${seriesId}/collections/${collectionId}`, { method: 'DELETE' });
    const series = await fetchItem('series', seriesId);
    renderPage(series);
};

window.recalculateCollections = async (seriesId) => {
    const res = await fetch(`${API_BASE}/series/${seriesId}/recalculate-collections`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Помилка'); return; }
    alert(data.message);
    const updatedSeries = await fetchItem('series', seriesId);
    renderPage(updatedSeries);
};

window.recalculateVolumes = async (seriesId) => {
    const res = await fetch(`${API_BASE}/series/${seriesId}/recalculate-volumes`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Помилка'); return; }
    alert(data.message);
    const updatedSeries = await fetchItem('series', seriesId);
    renderPage(updatedSeries);
};

// ===== НАВІГАЦІЯ =========================================================

window.navigateBack = () => navigate('series');