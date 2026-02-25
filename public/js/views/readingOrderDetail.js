import { fetchItem } from '../api/api.js';
import { cv_img_path_small, formatDate, showError, showLoading, cleanupCatalogUI } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';

const API_BASE = 'http://localhost:7000/api';

// Зберігаємо ID вже доданих випусків для фільтрації в пошуку
let currentOrderIssueIds = new Set();

// Контролер для скасування старих event listeners при кожному renderPage
let handlersAbortController = null;

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
    // Оновлюємо Set вже доданих випусків
    currentOrderIssueIds = new Set((order.issues || []).map(i => i.id));

    document.getElementById('page-title').innerHTML = `
        <a href="#" id="btn-back-to-orders" style="color: var(--text-secondary); text-decoration: none;">
            &larr; Порядок читання
        </a> / ${order.name || 'Без назви'}
    `;
    const issues = order.issues || [];

    // Унікальні серії (volumes) з випусків
    const volumesMap = new Map();
    issues.forEach(i => {
        if (i.cv_vol_id) {
            if (!volumesMap.has(i.cv_vol_id)) {
                volumesMap.set(i.cv_vol_id, { name: i.volume_name || 'Без назви', count: 0 });
            }
            volumesMap.get(i.cv_vol_id).count++;
        }
    });
    const volumesHtml = volumesMap.size ? `
        <div style="margin-top: 1rem;">
            <strong style="color: var(--text-secondary); font-size: 0.85rem;">Додані серії:</strong>
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.4rem;">
                ${[...volumesMap.entries()].map(([id, vol]) => `
                    <span style="display:inline-flex; align-items:center; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:20px; font-size:0.8rem; overflow:hidden;">
                        <span class="volume-name-link"
                            data-vol-id="${id}"
                            title="Перейти до серії"
                            style="padding:0.2rem 0.5rem 0.2rem 0.7rem; cursor:pointer; color:var(--text-primary);">${vol.name} / 
                        </span>
                        <span class="volume-id-chip"
                            data-vol-id="${id}"
                            title="Скопіювати ID: ${id}"
                            style="cursor:pointer; color:var(--accent); font-weight:600;">id: ${id}</span>
                        <span style="padding: .5rem; color:var(--text-secondary);">${vol.count}</span>
                    </span>
                `).join('')}
            </div>
        </div>
    ` : '';

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
                    ${volumesHtml}
                    <button class="btn btn-secondary" id="btn-edit-order" style="margin-top: 1.5rem;">Редагувати</button>
                </div>
            </div>

            <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                    <h2 style="font-size: 1.5rem; margin: 0;">Список читання (${issues.length})</h2>
                    <button class="btn btn-primary" id="btn-add-issue">+ Додати випуск</button>
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
                    <button class="btn btn-secondary" id="btn-close-edit-modal">Скасувати</button>
                    <button class="btn btn-primary" id="btn-save-edit-modal">Зберегти</button>
                </div>
            </div>
        </div>

        <!-- Модалка додавання випуску -->
        <div id="add-issue-ro-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
            <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:900px; max-width:90vw;">
                <h3 style="margin-bottom:1rem;">Додати випуск до порядку читання</h3>

                <!-- Рядок 1: Назва, Том, Номер, CV Vol ID -->
                <div style="display:grid; grid-template-columns:1fr 1fr 10% 15%; gap:0.75rem; margin-bottom:0.5rem;">
                    <div class="form-group" style="margin:0;">
                        <label for="ro-search-name" style="font-size:0.8rem; display:block; margin-bottom:0.25rem;">Назва випуску</label>
                        <input type="text" id="ro-search-name" placeholder="Назва..." style="width:100%;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label for="ro-search-volume" style="font-size:0.8rem; display:block; margin-bottom:0.25rem;">Назва тому</label>
                        <input type="text" id="ro-search-volume" placeholder="Том..." style="width:100%;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label for="ro-search-number" style="font-size:0.8rem; display:block; margin-bottom:0.25rem;">Номер</label>
                        <input type="text" id="ro-search-number" placeholder="#..." style="width:100%;">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label for="ro-search-cv-vol-id" style="font-size:0.8rem; display:block; margin-bottom:0.25rem;">CV ID тому</label>
                        <input type="number" id="ro-search-cv-vol-id" placeholder="CV Vol ID..." style="width:100%;">
                    </div>
                </div>

                <!-- Рядок 2: чекбокс точного співпадіння -->
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                    <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; color:var(--text-secondary); cursor:pointer; user-select:none;">
                        <input type="checkbox" id="ro-exact-match" style="accent-color:var(--accent); width:14px; height:14px; cursor:pointer;">
                        Точне співпадіння назви
                    </label>
                </div>

                <div id="ro-issue-results"></div>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn btn-secondary" id="btn-close-add-modal">Скасувати</button>
                </div>
            </div>
        </div>
    `;

    attachHandlers(order);
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
                        <tr data-issue-id="${issue.id}">
                            <td style="text-align:center;">
                                <input type="number"
                                    class="input-order-num"
                                    data-order-id="${orderId}"
                                    data-issue-id="${issue.id}"
                                    data-order-num="${issue.order_num}"
                                    value="${issue.order_num}"
                                    min="1"
                                    max="${issues.length}"
                                    style="width:54px; text-align:center; font-weight:700; font-size:1rem; color:var(--accent); background:transparent; border:1px solid transparent; border-radius:4px; padding:2px 4px; cursor:text;"
                                    title="Введіть номер і натисніть Enter">
                            </td>
                            <td>
                                ${issue.cv_img
                                    ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}" alt="${issue.name || ''}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">`
                                    : '📖'}
                            </td>
                            <td>
                                <span class="issue-name-link" data-issue-id="${issue.id}" style="cursor:pointer; color:var(--accent); font-weight:500;">
                                    ${issue.name || 'Без назви'}
                                </span>
                            </td>
                            <td style="color:var(--text-secondary); font-size:0.85rem;">${issue.volume_name || '-'}</td>
                            <td>#${issue.issue_number || '?'}</td>
                            <td>${formatDate(issue.release_date)}</td>
                            <td>
                                <div style="display:flex; gap:0.25rem;">
                                    <button class="btn btn-danger btn-small btn-remove-issue"
                                        data-order-id="${orderId}"
                                        data-issue-id="${issue.id}" title="Видалити">✕</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ── Прив'язка всіх обробників через event delegation ──────────────────────

function attachHandlers(order) {
    const orderId = order.id;
    const content = document.getElementById('content');

    // Скасовуємо старі listeners щоб не накопичувались при кожному renderPage
    if (handlersAbortController) handlersAbortController.abort();
    handlersAbortController = new AbortController();
    const signal = handlersAbortController.signal;

    // Посилання "← Порядок читання"
    document.getElementById('btn-back-to-orders').addEventListener('click', (e) => {
        e.preventDefault();
        navigate('reading-orders');
    }, { signal });

    // Кнопка редагувати
    document.getElementById('btn-edit-order').addEventListener('click', () => openEditOrderModal(orderId), { signal });

    // Кнопка додати випуск
    document.getElementById('btn-add-issue').addEventListener('click', () => openROAddIssueModal(orderId), { signal });

    // Кнопки закрити модалки
    document.getElementById('btn-close-edit-modal').addEventListener('click', closeEditOrderModal, { signal });
    document.getElementById('btn-save-edit-modal').addEventListener('click', () => saveOrderEdit(orderId), { signal });
    document.getElementById('btn-close-add-modal').addEventListener('click', closeROAddIssueModal, { signal });

    // Event delegation для таблиці
    content.addEventListener('click', async (e) => {
        // Перехід до деталей випуску
        const nameLink = e.target.closest('.issue-name-link');
        if (nameLink) {
            navigate('issue-detail', { id: parseInt(nameLink.dataset.issueId) });
            return;
        }

        // Кнопка видалити
        const btnRemove = e.target.closest('.btn-remove-issue');
        if (btnRemove) {
            const oid = parseInt(btnRemove.dataset.orderId);
            const iid = parseInt(btnRemove.dataset.issueId);
            await removeIssueFromOrder(oid, iid);
            return;
        }

        // Клік по результату пошуку
        const resultItem = e.target.closest('.ro-issue-result-item');
        if (resultItem) {
            await addIssueToOrder(orderId, parseInt(resultItem.dataset.issueId));
            return;
        }
    }, { signal });

    // Hover для результатів пошуку
    content.addEventListener('mouseover', (e) => {
        const item = e.target.closest('.ro-issue-result-item');
        if (item) item.style.background = 'var(--bg-secondary)';
    }, { signal });
    content.addEventListener('mouseout', (e) => {
        const item = e.target.closest('.ro-issue-result-item');
        if (item) item.style.background = '';
    }, { signal });

    // Копіювання ID серії та навігація до серії
    content.addEventListener('click', (e) => {
        const nameLink = e.target.closest('.volume-name-link');
        if (nameLink) {
            navigate('volume-detail', { id: parseInt(nameLink.dataset.volId) });
            return;
        }
        const chip = e.target.closest('.volume-id-chip');
        if (!chip) return;
        const id = chip.dataset.volId;
        navigator.clipboard.writeText(id).then(() => {
            const prev = chip.textContent;
            chip.textContent = '✓ скопійовано';
            setTimeout(() => { chip.textContent = `id: ${id}`; }, 1200);
        });
    }, { signal });

    // Інпут для прямого введення порядкового номера
    content.addEventListener('focusin', (e) => {
        const input = e.target.closest('.input-order-num');
        if (input) input.style.border = '1px solid var(--accent)';
    }, { signal });

    content.addEventListener('focusout', (e) => {
        const input = e.target.closest('.input-order-num');
        if (!input) return;
        input.style.border = '1px solid transparent';
        // Скидаємо значення якщо не підтверджено
        input.value = input.dataset.orderNum;
    }, { signal });

    content.addEventListener('keydown', async (e) => {
        const input = e.target.closest('.input-order-num');
        if (!input) return;

        if (e.key === 'Escape') {
            input.value = input.dataset.orderNum;
            input.blur();
            return;
        }

        if (e.key === 'Enter') {
            const newNum = parseInt(input.value);
            const oldNum = parseInt(input.dataset.orderNum);
            if (!newNum || newNum === oldNum) { input.blur(); return; }
            const oid = parseInt(input.dataset.orderId);
            const iid = parseInt(input.dataset.issueId);
            input.blur();
            await moveIssue(oid, iid, oldNum, newNum);
        }
    }, { signal });
}

// ── РЕДАГУВАННЯ ────────────────────────────────────────────────────────────

let currentOrderId = null;

async function openEditOrderModal(orderId) {
    currentOrderId = orderId;
    const formBody = document.getElementById('edit-order-form-body');
    formBody.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-secondary);">Завантаження...</div>';
    document.getElementById('edit-order-modal').style.display = 'flex';
    const order = await fetch(`${API_BASE}/reading-orders/${orderId}`).then(r => r.json());
    formBody.innerHTML = `
        <div class="form-group"><label for="edit-order-name">Назва *</label><input type="text" id="edit-order-name" value="${order.name || ''}"></div>
        <div class="form-group"><label for="edit-order-desc">Опис</label><textarea id="edit-order-desc">${order.description || ''}</textarea></div>
        <div class="form-group"><label for="edit-order-img">URL зображення</label><input type="url" id="edit-order-img" value="${order.cv_img || ''}"></div>
    `;
}

function closeEditOrderModal() {
    document.getElementById('edit-order-modal').style.display = 'none';
    currentOrderId = null;
}

async function saveOrderEdit(orderId) {
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
    closeEditOrderModal();
    const order = await fetchItem('reading-orders', savedId);
    renderPage(order);
}

// ── ДОДАВАННЯ ВИПУСКУ ──────────────────────────────────────────────────────

let currentAddOrderId = null;
let issueSearchTimeout = null;

function openROAddIssueModal(orderId) {
    currentAddOrderId = orderId;
    document.getElementById('add-issue-ro-modal').style.display = 'flex';

    const inputIds = ['ro-search-name', 'ro-search-volume', 'ro-search-number', 'ro-search-cv-vol-id'];
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        el.value = '';
        el.oninput = () => {
            clearTimeout(issueSearchTimeout);
            issueSearchTimeout = setTimeout(searchIssuesForOrder, 300);
        };
    });

    document.getElementById('ro-exact-match').checked = false;
    document.getElementById('ro-exact-match').onchange = () => {
        clearTimeout(issueSearchTimeout);
        issueSearchTimeout = setTimeout(searchIssuesForOrder, 100);
    };

    document.getElementById('ro-issue-results').innerHTML = '';
    document.getElementById('ro-search-name').focus();
}

function closeROAddIssueModal() {
    document.getElementById('add-issue-ro-modal').style.display = 'none';
    currentAddOrderId = null;
}

async function searchIssuesForOrder() {
    const name       = document.getElementById('ro-search-name').value.trim();
    const volumeName = document.getElementById('ro-search-volume').value.trim();
    const issueNumber= document.getElementById('ro-search-number').value.trim();
    const cvVolId    = document.getElementById('ro-search-cv-vol-id').value.trim();
    const exact      = document.getElementById('ro-exact-match').checked;

    if (!name && !volumeName && !issueNumber && !cvVolId) {
        document.getElementById('ro-issue-results').innerHTML = '';
        return;
    }

    // Запитуємо трохи більше, щоб після фільтрації залишилось достатньо
    const params = new URLSearchParams({ limit: 50 });
    if (name)        params.set('name', name);
    if (volumeName)  params.set('volume_name', volumeName);
    if (issueNumber) params.set('issue_number', issueNumber);
    if (cvVolId)     params.set('volume_id', cvVolId);
    if (exact)       params.set('exact', 'true');

    const res = await fetch(`${API_BASE}/issues?${params}`);
    const result = await res.json();
    const el = document.getElementById('ro-issue-results');

    if (!result.data?.length) {
        el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>';
        return;
    }

    // Фільтруємо вже додані випуски
    const filtered = result.data.filter(issue => !currentOrderIssueIds.has(issue.id));

    if (!filtered.length) {
        el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Всі знайдені випуски вже додано до хронології</div>';
        return;
    }

    el.innerHTML = filtered.map(issue => `
        <div class="ro-issue-result-item"
            data-issue-id="${issue.id}"
            style="cursor:pointer;">
            ${issue.cv_img
                ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}">`
                : '<div style="width:40px; height:60px; background:var(--bg-secondary); border-radius:3px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">📖</div>'}
            <div>
                <div style="font-weight:500;">${issue.name || 'Без назви'}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">${issue.volume_name || ''}${issue.issue_number ? ' · #' + issue.issue_number : ''}${issue.cv_vol_id ? ' · vol:' + issue.cv_vol_id : ''}</div>
            </div>
        </div>
    `).join('');
}

async function addIssueToOrder(orderId, issueId) {
    const res = await fetch(`${API_BASE}/reading-orders/${orderId}/issues`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId })
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    closeROAddIssueModal();
    const order = await fetchItem('reading-orders', orderId);
    renderPage(order);
}

// ── ПЕРЕМІЩЕННЯ ────────────────────────────────────────────────────────────

async function moveIssue(orderId, issueId, currentOrder, newOrder) {
    if (newOrder === currentOrder) return;
    const res = await fetch(`${API_BASE}/reading-orders/${orderId}/issues/${issueId}/reorder`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_order: newOrder })
    });
    if (!res.ok) { alert('Помилка переміщення'); return; }
    const order = await fetchItem('reading-orders', orderId);
    renderPage(order);
}

async function removeIssueFromOrder(orderId, issueId) {
    if (!confirm('Видалити цей випуск із порядку читання?')) return;
    await fetch(`${API_BASE}/reading-orders/${orderId}/issues/${issueId}`, { method: 'DELETE' });
    const order = await fetchItem('reading-orders', orderId);
    renderPage(order);
}