import { fetchItem } from '../api/api.js';
import { cv_img_path_small, formatDate, showError, showLoading, cleanupCatalogUI } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';

const API_BASE = 'http://localhost:7000/api';

export async function renderReadingOrderDetail(params) {
    const orderId = params.id;
    if (!orderId) { navigate('reading-orders'); return; }
    cleanupCatalogUI();
    showLoading();
    try {
        const order = await fetchItem('reading-orders', orderId);
        renderPage(order);
    } catch (error) {
        console.error('Помилка завантаження порядку читання:', error);
        showError('Помилка завантаження даних');
    }
}

function renderPage(order) {
    document.getElementById('page-title').innerHTML = `
        <a href="#" onclick="event.preventDefault(); navigate('reading-orders')" style="color: var(--text-secondary); text-decoration: none;">
            &larr; Порядок читання
        </a> / ${order.name || 'Без назви'}
    `;
    const issues = order.issues || [];
    const content = document.getElementById('content');
    content.innerHTML = `
        <div style="max-width: 1200px;">
            <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
                <div style="flex-shrink: 0;">
                    ${order.cv_img
                        ? `<img src="${order.cv_img}" alt="${order.name}" style="width: 300px; border-radius: 8px; box-shadow: var(--shadow-lg);">`
                        : '<div style="width: 300px; height: 300px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 5rem;">📋</div>'}
                </div>
                <div style="flex: 1;">
                    <h1 style="font-size: 2rem; margin-bottom: 1rem;">${order.name}</h1>
                    ${order.description ? `<p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.5rem;">${order.description}</p>` : ''}
                    <div style="display: grid; gap: 0.25rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                        <div><strong>Випусків:</strong> ${issues.length}</div>
                        <div><strong>Додано:</strong> ${formatDate(order.created_at)}</div>
                    </div>
                    <button class="btn btn-secondary" onclick="openEditOrderModal(${order.id})">Редагувати</button>
                </div>
            </div>

            <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                    <h2 style="font-size: 1.5rem; margin: 0;">Список читання (${issues.length})</h2>
                    <button class="btn btn-primary" onclick="openROAddIssueModal(${order.id})">+ Додати випуск</button>
                </div>
                ${renderIssueTable(issues, order.id)}
            </div>
        </div>

        <!-- Модалка редагування -->
        <div id="edit-order-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
            <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:480px; max-width:90vw;">
                <h3 style="margin-bottom:1.25rem;">Редагувати</h3>
                <div id="edit-order-form-body"></div>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:1.25rem;">
                    <button class="btn btn-secondary" onclick="closeEditOrderModal()">Скасувати</button>
                    <button class="btn btn-primary" onclick="saveOrderEdit()">Зберегти</button>
                </div>
            </div>
        </div>

        <!-- Модалка додавання випуску -->
        <div id="add-issue-ro-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
            <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:900px; max-width:90vw;">
                <h3 style="margin-bottom:1rem;">Додати випуск до порядку читання</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.8rem; display:block; margin-bottom:0.25rem;">Назва випуску</label>
                        <input type="text" id="ro-search-name" placeholder="Назва..." style="width:100%;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.8rem; display:block; margin-bottom:0.25rem;">Назва тому</label>
                        <input type="text" id="ro-search-volume" placeholder="Том..." style="width:100%;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:0.8rem; display:block; margin-bottom:0.25rem;">Номер</label>
                        <input type="text" id="ro-search-number" placeholder="#..." style="width:100%;">
                    </div>
                </div>
                <div id="ro-issue-results"></div>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn btn-secondary" onclick="closeROAddIssueModal()">Скасувати</button>
                </div>
            </div>
        </div>
    `;
}

function renderIssueTable(issues, orderId) {
    if (!issues.length) {
        return '<p style="text-align:center; color:var(--text-secondary); padding:2rem;">Немає випусків. Додайте перший!</p>';
    }
    return `
        <div class="table">
            <table>
                <thead>
                    <tr>
                        <th style="width:64px; text-align:center;">#</th>
                        <th style="width:70px;">Обкл.</th>
                        <th>Назва</th>
                        <th>Том</th>
                        <th style="width:60px;">Вип.</th>
                        <th>Дата</th>
                        <th style="width:120px;">Дії</th>
                    </tr>
                </thead>
                <tbody>
                    ${issues.map((issue, idx) => `
                        <tr>
                            <td style="text-align:center; font-weight:700; font-size:1.1rem; color:var(--accent);">
                                ${issue.order_num}
                            </td>
                            <td>
                                ${issue.cv_img
                                    ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}" alt="${issue.name || ''}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">`
                                    : '📖'}
                            </td>
                            <td>
                                <span onclick="navigateTo('issue-detail', ${issue.id})" style="cursor:pointer; color:var(--accent); font-weight:500;">
                                    ${issue.name || 'Без назви'}
                                </span>
                            </td>
                            <td style="color:var(--text-secondary); font-size:0.85rem;">${issue.volume_name || '-'}</td>
                            <td>#${issue.issue_number || '?'}</td>
                            <td>${formatDate(issue.release_date)}</td>
                            <td>
                                <div style="display:flex; gap:0.25rem;">
                                    <button class="btn btn-secondary btn-small"
                                        onclick="moveIssue(${orderId}, ${issue.id}, ${issue.order_num}, 'up')"
                                        ${idx === 0 ? 'disabled' : ''} title="Вгору">↑</button>
                                    <button class="btn btn-secondary btn-small"
                                        onclick="moveIssue(${orderId}, ${issue.id}, ${issue.order_num}, 'down')"
                                        ${idx === issues.length - 1 ? 'disabled' : ''} title="Вниз">↓</button>
                                    <button class="btn btn-danger btn-small"
                                        onclick="removeIssueFromOrder(${orderId}, ${issue.id})" title="Видалити">✕</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ===== РЕДАГУВАННЯ =====
let currentOrderId = null;

window.openEditOrderModal = async (orderId) => {
    currentOrderId = orderId;
    const formBody = document.getElementById('edit-order-form-body');
    formBody.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-secondary);">Завантаження...</div>';
    document.getElementById('edit-order-modal').style.display = 'flex';
    const order = await fetch(`${API_BASE}/reading-orders/${orderId}`).then(r => r.json());
    formBody.innerHTML = `
        <div class="form-group"><label>Назва *</label><input type="text" id="edit-order-name" value="${order.name || ''}"></div>
        <div class="form-group"><label>Опис</label><textarea id="edit-order-desc">${order.description || ''}</textarea></div>
        <div class="form-group"><label>URL зображення</label><input type="url" id="edit-order-img" value="${order.cv_img || ''}"></div>
    `;
};

window.closeEditOrderModal = () => {
    document.getElementById('edit-order-modal').style.display = 'none';
    currentOrderId = null;
};

window.saveOrderEdit = async () => {
    const name = document.getElementById('edit-order-name').value.trim();
    if (!name) { alert("Назва обов'язкова"); return; }
    const res = await fetch(`${API_BASE}/reading-orders/${currentOrderId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            description: document.getElementById('edit-order-desc').value.trim() || null,
            cv_img: document.getElementById('edit-order-img').value.trim() || null
        })
    });
    if (!res.ok) { alert('Помилка збереження'); return; }
    const savedId = currentOrderId;
    window.closeEditOrderModal();
    const order = await fetchItem('reading-orders', savedId);
    renderPage(order);
};

// ===== ДОДАВАННЯ ВИПУСКУ =====
let currentAddOrderId = null;
let issueSearchTimeout = null;

window.openROAddIssueModal = (orderId) => {
    currentAddOrderId = orderId;
    document.getElementById('add-issue-ro-modal').style.display = 'flex';
    ['ro-search-name', 'ro-search-volume', 'ro-search-number'].forEach(id => {
        const el = document.getElementById(id);
        el.value = '';
        el.oninput = () => {
            clearTimeout(issueSearchTimeout);
            issueSearchTimeout = setTimeout(searchIssuesForOrder, 300);
        };
    });
    document.getElementById('ro-issue-results').innerHTML = '';
    document.getElementById('ro-search-name').focus();
};

window.closeROAddIssueModal = () => {
    document.getElementById('add-issue-ro-modal').style.display = 'none';
    currentAddOrderId = null;
};

async function searchIssuesForOrder() {
    const name = document.getElementById('ro-search-name').value.trim();
    const volumeName = document.getElementById('ro-search-volume').value.trim();
    const issueNumber = document.getElementById('ro-search-number').value.trim();
    if (!name && !volumeName && !issueNumber) { document.getElementById('ro-issue-results').innerHTML = ''; return; }
    const params = new URLSearchParams({ limit: 20 });
    if (name) params.set('name', name);
    if (volumeName) params.set('volume_name', volumeName);
    if (issueNumber) params.set('issue_number', issueNumber);
    const res = await fetch(`${API_BASE}/issues?${params}`);
    const result = await res.json();
    const el = document.getElementById('ro-issue-results');
    if (!result.data?.length) { el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>'; return; }
    el.innerHTML = result.data.map(issue => `
        <div onclick="addIssueToOrder(${currentAddOrderId}, ${issue.id})"
            onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
            ${issue.cv_img
                ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}">`
                : '<div style="width:40px; height:60px; background:var(--bg-secondary); border-radius:3px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">📖</div>'}
            <div>
                <div style="font-weight:500;">${issue.name || 'Без назви'}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">${issue.volume_name || ''}${issue.issue_number ? ' · #' + issue.issue_number : ''}</div>
            </div>
        </div>
    `).join('');
}

window.addIssueToOrder = async (orderId, issueId) => {
    const res = await fetch(`${API_BASE}/reading-orders/${orderId}/issues`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId })
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    window.closeROAddIssueModal();
    const order = await fetchItem('reading-orders', orderId);
    renderPage(order);
};

// Переміщення: up/down — зсуває на одну позицію
window.moveIssue = async (orderId, issueId, currentOrder, direction) => {
    const newOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    const res = await fetch(`${API_BASE}/reading-orders/${orderId}/issues/${issueId}/reorder`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_order: newOrder })
    });
    if (!res.ok) { alert('Помилка переміщення'); return; }
    const order = await fetchItem('reading-orders', orderId);
    renderPage(order);
};

window.removeIssueFromOrder = async (orderId, issueId) => {
    if (!confirm('Видалити цей випуск із порядку читання?')) return;
    await fetch(`${API_BASE}/reading-orders/${orderId}/issues/${issueId}`, { method: 'DELETE' });
    const order = await fetchItem('reading-orders', orderId);
    renderPage(order);
};

window.navigateBack = () => navigate('reading-orders');
window.navigateTo = (type, id) => navigate(type, { id: id });