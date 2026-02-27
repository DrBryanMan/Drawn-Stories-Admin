import { fetchItem, updateItem } from '../api/api.js';
import { cv_logo_svg, cv_img_path_original, cv_img_path_small, formatDate, formatCoverDate, formatReleaseDate, showError, showLoading, initDetailPage } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { openModal } from '../components/modal.js';

const API_BASE = 'http://localhost:7000/api';

let currentVolumeId = null;
let currentIssueId = null;

export async function renderIssueDetail(params) {
    const issueId = params.id;
    currentVolumeId = params.volumeId || null;
    currentIssueId = issueId;

    if (!issueId) { navigate('issues'); return; }

    initDetailPage();
    showLoading();

    try {
        const [issue, roData, colMemberData] = await Promise.all([
            fetchItem('issues', issueId),
            fetch(`${API_BASE}/issues/${issueId}/reading-orders`).then(r => r.json()),
            fetch(`${API_BASE}/issues/${issueId}/collections-membership`).then(r => r.json())
        ]);

        const isCollection = !!issue.collection_id;
        const readingOrders = roData.data || [];
        const collectionMemberships = colMemberData.data || [];

        document.getElementById('page-title').innerHTML = `
            <a href="#" onclick="event.preventDefault(); navigateToParent()" style="color: var(--text-secondary); text-decoration: none;">
                ← Випуски
            </a> / ${issue.name || 'Випуск'}
        `;

        const content = document.getElementById('content');
        content.innerHTML = `
            <div style="max-width: 1200px;">
                <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
                    <div style="flex-shrink: 0;">
                        ${issue.cv_img
                            ? `<img src="${issue.cv_img.startsWith('https') ? issue.cv_img : issue.cv_img.startsWith('/') ? cv_img_path_original + issue.cv_img : cv_img_path_original + '/' + issue.cv_img}" alt="${issue.name}"
                                style="width: 300px; border-radius: 8px; box-shadow: var(--shadow-lg);">`
                            : '<div style="width: 300px; height: 450px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 4rem;">📖</div>'}
                    </div>
                    <div style="flex: 1;">
                        <h1 style="font-size: 2rem; margin-bottom: 1rem;">${issue.name || 'Без назви'}</h1>
                        <div style="display: grid; gap: 0.5rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                            ${issue.volume_name ? `
                                <div>
                                    <strong>Том:</strong>
                                    <a href="#" onclick="navigateToVolumeFromIssue(${issue.cv_vol_id})"
                                    style="color: var(--accent); text-decoration: none;">
                                        ${issue.volume_name}
                                        <span style="color: var(--text-secondary); font-size: 0.85rem;">(id: ${issue.cv_vol_id})</span>
                                    </a>
                                </div>
                            ` : `id: ${issue.cv_vol_id}`}
                            ${issue.issue_number ? `<div><strong>Номер випуску:</strong> ${issue.issue_number}</div>` : ''}
                            <div><strong>Volume CV ID:</strong> ${issue.cv_vol_id}</div>
                            <div><strong>CV ID:</strong> ${issue.cv_id}</div>
                            <div><strong>CV Slug:</strong> ${issue.cv_slug}</div>
                            <div><strong>Дата обкладинки:</strong> ${formatCoverDate(issue.cover_date)}</div>
                            <div><strong>Дата випуску:</strong> ${formatReleaseDate(issue.release_date)}</div>
                            <div><strong>Дата створення:</strong> ${formatDate(issue.created_at)}</div>
                            ${readingOrders.length > 0 ? `
                                <div>
                                    <strong>Хронологія:</strong>
                                    ${readingOrders.map(ro => `
                                        <span class="theme-badge" style="cursor:pointer;"
                                              onclick="navigateTo('reading-order-detail', ${ro.id})">
                                            ${ro.name} <span style="opacity:0.7;">#${ro.order_num}</span>
                                        </span>
                                    `).join(' ')}
                                </div>
                            ` : ''}
                            ${collectionMemberships.length > 0 ? `
                                <div>
                                    <strong>У збірниках:</strong>
                                    ${collectionMemberships.map(c => `
                                        <span class="theme-badge" style="background:#dbeafe; color:#1e40af; border-color:#bfdbfe; cursor:pointer;"
                                              onclick="navigateTo('collection-detail', ${c.id})">${c.name}</span>
                                    `).join(' ')}
                                </div>
                            ` : ''}
                        </div>
                        <div>
                            <a href="https://comicvine.gamespot.com/${issue.cv_slug}/4000-${issue.cv_id}" target="_blank">${cv_logo_svg}</a>
                        </div>

                        <!-- Рядок 1: основні дії -->
                        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem;">
                            <button class="btn btn-secondary" onclick="editIssueDetail(${issue.id})">Редагувати</button>
                            ${isCollection ? `
                                <button class="btn btn-success" onclick="navigate('collection-detail', ${issue.collection_id})">📚 Переглянути збірник →</button>
                            ` : `
                                <button class="btn btn-warning" onclick="makeCollection(${issue.id})">📚 Зробити збірником</button>
                            `}
                        </div>

                        <!-- Рядок 2: додавання до -->
                        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.75rem;">
                            <button class="btn btn-primary" onclick="openIssueAddToVolumeModal(${issue.id})">📚 Змінити том</button>
                            <button class="btn btn-primary" onclick="openIssueAddToCollectionModal(${issue.id})">📗 Додати до збірника</button>
                            <button class="btn btn-primary" onclick="openIssueAddToROModal(${issue.id})">📋 Додати до хронології</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Модалка: змінити том -->
            <div id="issue-add-volume-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
                <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:500px; max-width:90vw;">
                    <h3 style="margin-bottom:1rem;">Змінити том</h3>
                    <p style="color:var(--text-secondary); font-size:0.875rem; margin-bottom:1rem;">Знайдіть том і клікніть для підтвердження.</p>
                    <div class="form-group">
                        <input type="text" id="iv-volume-search" placeholder="Введіть назву тому..." style="width:100%;">
                    </div>
                    <div id="iv-volume-results" style="max-height:320px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:1rem; min-height:48px;"></div>
                    <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                        <button class="btn btn-secondary" onclick="closeIssueAddToVolumeModal()">Скасувати</button>
                    </div>
                </div>
            </div>

            <!-- Модалка: додати до збірника -->
            <div id="issue-add-collection-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
                <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:500px; max-width:90vw;">
                    <h3 style="margin-bottom:1rem;">Додати до збірника</h3>
                    <div class="form-group">
                        <input type="text" id="ic-collection-search" placeholder="Введіть назву збірника..." style="width:100%;">
                    </div>
                    <div id="ic-collection-results" style="max-height:320px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:1rem; min-height:48px;"></div>
                    <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                        <button class="btn btn-secondary" onclick="closeIssueAddToCollectionModal()">Скасувати</button>
                    </div>
                </div>
            </div>

            <!-- Модалка: додати до хронології -->
            <div id="issue-add-ro-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
                <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:500px; max-width:90vw;">
                    <h3 style="margin-bottom:1rem;">Додати до хронології</h3>
                    <div class="form-group">
                        <input type="text" id="iro-search" placeholder="Введіть назву хронології..." style="width:100%;">
                    </div>
                    <div id="iro-results" style="max-height:260px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:0.75rem; min-height:48px;"></div>
                    <div id="iro-position-row" style="display:none;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:0.875rem; font-weight:500;">
                                Позиція в хронології
                                <span style="color:var(--text-secondary); font-weight:400;">(порожньо = в кінець)</span>
                            </label>
                            <input type="number" id="iro-position" placeholder="наприклад: 5" min="1" style="width:100%; margin-top:0.35rem;">
                            <div id="iro-total-hint" style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;"></div>
                        </div>
                        <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:1rem;">
                            <button class="btn btn-secondary" onclick="closeIssueAddToROModal()">Скасувати</button>
                            <button class="btn btn-primary" id="iro-confirm-btn" onclick="confirmAddToRO()">Додати</button>
                        </div>
                    </div>
                    <div id="iro-cancel-row" style="display:flex; justify-content:flex-end; margin-top:0.5rem;">
                        <button class="btn btn-secondary" onclick="closeIssueAddToROModal()">Скасувати</button>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Помилка завантаження випуску:', error);
        showError('Помилка завантаження даних');
    }
}

// ===== РЕДАГУВАННЯ =====
function getIssueFormHTML(issue = null) {
    return `
        <form id="edit-form">
            <div class="form-row">
                <div class="form-group"><label>CV ID *</label><input type="number" name="cv_id" value="${issue?.cv_id || ''}" required></div>
                <div class="form-group"><label>CV Slug *</label><input type="text" name="cv_slug" value="${issue?.cv_slug || ''}" required></div>
            </div>
            <div class="form-group"><label>Назва</label><input type="text" name="name" value="${issue?.name || ''}"></div>
            <div class="form-row">
                <div class="form-group"><label>Volume CV ID</label><input type="number" name="cv_vol_id" value="${issue?.cv_vol_id || ''}"></div>
                <div class="form-group"><label>Номер випуску</label><input type="text" name="issue_number" value="${issue?.issue_number || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Дата обкладинки</label><input type="date" name="cover_date" value="${issue?.cover_date || ''}"></div>
                <div class="form-group"><label>Дата випуску</label><input type="date" name="release_date" value="${issue?.release_date || ''}"></div>
            </div>
            <div class="form-group"><label>URL зображення</label><input type="text" name="cv_img" value="${issue?.cv_img || ''}"></div>
        </form>
    `;
}

window.editIssueDetail = async (id) => {
    const issue = await fetch(`${API_BASE}/issues/${id}`).then(r => r.json());
    openModal('Редагувати випуск', getIssueFormHTML(issue), async (data) => {
        await updateItem('issues', id, data);
        await renderIssueDetail({ id });
        await window.updateStats();
    });
};

window.makeCollection = async (issueId) => {
    if (!confirm('Перетворити цей випуск на збірник?\n\nВипуск буде ВИДАЛЕНО і замінено збірником зі своїм списком випусків.')) return;
    const response = await fetch(`${API_BASE}/issues/${issueId}/make-collection`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (!response.ok) {
        if (result.collection_id) { navigate('collection-detail', { id: result.collection_id }); return; }
        alert(result.error || 'Помилка');
        return;
    }
    await window.updateStats();
    navigate('collection-detail', { id: result.collection.id });
};

window.navigateToVolumeFromIssue = async (volumeCvId) => {
    if (currentVolumeId) { navigate('volume-detail', { id: currentVolumeId }); return; }
    const res = await fetch(`${API_BASE}/volumes/by-cv-id/${volumeCvId}`);
    if (!res.ok) { alert(`Том з CV ID ${volumeCvId} не знайдено`); return; }
    const volume = await res.json();
    navigate('volume-detail', { id: volume.id });
};

// ===== ЗМІНИТИ ТОМ =====
let ivSearchTimeout = null;

window.openIssueAddToVolumeModal = (issueId) => {
    document.getElementById('issue-add-volume-modal').style.display = 'flex';
    const input = document.getElementById('iv-volume-search');
    input.value = '';
    document.getElementById('iv-volume-results').innerHTML = '';
    input.oninput = (e) => {
        clearTimeout(ivSearchTimeout);
        ivSearchTimeout = setTimeout(() => searchVolumesForIssue(e.target.value, issueId), 300);
    };
    input.focus();
};

window.closeIssueAddToVolumeModal = () => {
    document.getElementById('issue-add-volume-modal').style.display = 'none';
};

async function searchVolumesForIssue(query, issueId) {
    if (!query.trim()) { document.getElementById('iv-volume-results').innerHTML = ''; return; }
    const res = await fetch(`${API_BASE}/volumes?search=${encodeURIComponent(query)}&limit=20`);
    const result = await res.json();
    const el = document.getElementById('iv-volume-results');
    if (!result.data?.length) { el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>'; return; }
    el.innerHTML = result.data.map(vol => `
        <div onclick="changeIssueVolume(${issueId}, ${vol.cv_id}, '${(vol.name || '').replace(/'/g, "\\'")}')"
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

window.changeIssueVolume = async (issueId, volumeCvId, volumeName) => {
    if (!confirm(`Змінити том цього випуску на "${volumeName}"?`)) return;
    const issue = await fetch(`${API_BASE}/issues/${issueId}`).then(r => r.json());
    const res = await fetch(`${API_BASE}/issues/${issueId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...issue, cv_vol_id: volumeCvId })
    });
    if (!res.ok) { alert('Помилка збереження'); return; }
    window.closeIssueAddToVolumeModal();
    await renderIssueDetail({ id: issueId });
};

// ===== ДОДАТИ ДО ЗБІРНИКА =====
let icSearchTimeout = null;

window.openIssueAddToCollectionModal = (issueId) => {
    document.getElementById('issue-add-collection-modal').style.display = 'flex';
    const input = document.getElementById('ic-collection-search');
    input.value = '';
    document.getElementById('ic-collection-results').innerHTML = '';
    input.oninput = (e) => {
        clearTimeout(icSearchTimeout);
        icSearchTimeout = setTimeout(() => searchCollectionsForIssue(e.target.value, issueId), 300);
    };
    input.focus();
};

window.closeIssueAddToCollectionModal = () => {
    document.getElementById('issue-add-collection-modal').style.display = 'none';
};

async function searchCollectionsForIssue(query, issueId) {
    if (!query.trim()) { document.getElementById('ic-collection-results').innerHTML = ''; return; }
    const res = await fetch(`${API_BASE}/collections/search?search=${encodeURIComponent(query)}&limit=20`);
    const result = await res.json();
    const el = document.getElementById('ic-collection-results');
    if (!result.data?.length) { el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>'; return; }
    el.innerHTML = result.data.map(col => `
        <div onclick="addIssueToCollectionFromDetail(${issueId}, ${col.id})"
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

window.addIssueToCollectionFromDetail = async (issueId, collectionId) => {
    const res = await fetch(`${API_BASE}/collections/${collectionId}/issues`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId })
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    window.closeIssueAddToCollectionModal();
    await renderIssueDetail({ id: issueId });
};

// ===== ДОДАТИ ДО ХРОНОЛОГІЇ =====
let iroSelectedOrderId = null;
let iroSelectedOrderTotal = 0;
let iroCurrentIssueId = null;
let iroSearchTimeout = null;

window.openIssueAddToROModal = (issueId) => {
    iroCurrentIssueId = issueId;
    iroSelectedOrderId = null;
    document.getElementById('issue-add-ro-modal').style.display = 'flex';
    const input = document.getElementById('iro-search');
    input.value = '';
    document.getElementById('iro-results').innerHTML = '';
    document.getElementById('iro-position-row').style.display = 'none';
    document.getElementById('iro-cancel-row').style.display = 'flex';
    input.oninput = (e) => {
        clearTimeout(iroSearchTimeout);
        iroSearchTimeout = setTimeout(() => searchROForIssue(e.target.value), 300);
    };
    input.focus();
};

window.closeIssueAddToROModal = () => {
    document.getElementById('issue-add-ro-modal').style.display = 'none';
    iroSelectedOrderId = null;
    iroCurrentIssueId = null;
};

async function searchROForIssue(query) {
    if (!query.trim()) { document.getElementById('iro-results').innerHTML = ''; return; }
    const res = await fetch(`${API_BASE}/reading-orders?search=${encodeURIComponent(query)}&limit=20`);
    const result = await res.json();
    const el = document.getElementById('iro-results');
    if (!result.data?.length) { el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>'; return; }
    el.innerHTML = result.data.map(ro => `
        <div onclick="selectROForIssue(${ro.id}, ${ro.issue_count || 0})"
             style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
             onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
            <span style="font-weight:500;">${ro.name}</span>
            <span style="font-size:0.8rem; color:var(--text-secondary);">📖 ${ro.issue_count || 0} випусків</span>
        </div>
    `).join('');
}

window.selectROForIssue = (orderId, total) => {
    iroSelectedOrderId = orderId;
    iroSelectedOrderTotal = total;
    // Показуємо рядок позиції, ховаємо нижню кнопку скасування
    document.getElementById('iro-position-row').style.display = 'block';
    document.getElementById('iro-cancel-row').style.display = 'none';
    document.getElementById('iro-position').value = '';
    document.getElementById('iro-total-hint').textContent = `Зараз у хронології ${total} випусків. Нова позиція буде від 1 до ${total + 1}.`;
    document.getElementById('iro-position').focus();
};

window.confirmAddToRO = async () => {
    if (!iroSelectedOrderId || !iroCurrentIssueId) return;
    const posInput = document.getElementById('iro-position').value.trim();
    const body = { issue_id: parseInt(iroCurrentIssueId) };
    if (posInput !== '') body.order_num = parseInt(posInput);

    const res = await fetch(`${API_BASE}/reading-orders/${iroSelectedOrderId}/issues`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    window.closeIssueAddToROModal();
    await renderIssueDetail({ id: iroCurrentIssueId });
};

window.navigateTo = (type, id) => navigate(type, { id: id });