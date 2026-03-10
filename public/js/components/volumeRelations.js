// public/js/components/volumeRelations.js
// Компонент «Хронологія та зв'язки» для сторінки деталей тому.
// Підключається з volumeDetail.js викликом mountVolumeRelations(volumeId, containerId).

import { API_BASE, cv_img_path_small } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';

// ── Конфіг типів зв'язку ──────────────────────────────────────────────────

const REL_TYPES = {
    continuation: { label: 'Продовження', icon: '🔢', cls: 'rel-type-continuation' },
    sequel:       { label: 'Сиквел',       icon: '⏩', cls: 'rel-type-sequel'       },
    prequel:      { label: 'Приквел',      icon: '⏪', cls: 'rel-type-prequel'      },
    spinoff:      { label: 'Спінофф',      icon: '🌀', cls: 'rel-type-spinoff'      },
    related:      { label: 'Пов\'язаний',  icon: '🔗', cls: 'rel-type-related'      },
};

// ── CSS (ін'єктується один раз) ───────────────────────────────────────────

let _cssInjected = false;
function injectCSS() {
    if (_cssInjected) return;
    _cssInjected = true;
    const style = document.createElement('style');
    style.textContent = `
    /* ── Секція хронологія ─────────────────────────────────────────── */
    .vrel-section {
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 1.5rem;
    }
    .vrel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.85rem 1.25rem;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
    }
    .vrel-header h2 {
        font-size: 1.1rem;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    /* ── Ланцюжок продовжень ────────────────────────────────────────── */
    .vrel-chain-wrap {
        padding: 1rem 1.25rem 0.5rem;
        border-bottom: 1px solid var(--border-color);
    }
    .vrel-chain-label {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: .07em;
        color: var(--text-secondary);
        font-weight: 700;
        margin-bottom: 0.75rem;
    }
    .vrel-chain {
        display: flex;
        align-items: flex-start;
        gap: 0;
        overflow-x: auto;
        padding: .4rem;
        scrollbar-width: thin;
    }
    .vrel-chain-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
        flex-shrink: 0;
        cursor: pointer;
        position: relative;
        padding-top: .2em;
    }
    .vrel-chain-item:hover .vrel-cover { border-color: var(--accent); transform: translateY(-.1em); }
    .vrel-chain-item.current .vrel-cover {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(26,136,193,.4);
    }
    .vrel-cover {
        aspect-ratio: 5/7;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid transparent;
        object-fit: cover;
        background: var(--bg-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.4rem;
        flex-shrink: 0;
        transition: border-color .15s, transform .15s;
    }
    .vrel-chain-name {
        font-size: 0.6rem;
        color: var(--text-secondary);
        text-align: center;
        max-width: 58px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .vrel-chain-item.current .vrel-chain-name { color: var(--accent); font-weight: 700; }
    .vrel-chain-arrow {
        color: var(--text-secondary);
        font-size: 1.5rem;
        padding: 0 0.25rem;
        padding-top: 2em;
        flex-shrink: 0;
        user-select: none;
    }
    .vrel-edit-order-btn {
        background: none;
        border: none;
        font-size: 0.65rem;
        cursor: pointer;
        opacity: 0;
        transition: opacity .15s;
        padding: 0;
        line-height: 1;
    }
    .vrel-chain-item:hover .vrel-edit-order-btn { opacity: 1; }

    /* ── Групи зв'язків ─────────────────────────────────────────────── */
    .vrel-groups { padding: 0.75rem 1.25rem 1rem; }
    .vrel-group  { margin-bottom: 0.75rem; }
    .vrel-group:last-child { margin-bottom: 0; }
    .vrel-group-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .07em;
        padding: 0.15rem 0.55rem;
        border-radius: 4px;
        margin-bottom: 0.5rem;
    }
    .rel-type-continuation { background: rgba(26,136,193,.1);  color: #1a88c1; }
    .rel-type-sequel       { background: rgba(124,58,237,.1);  color: #7c3aed; }
    .rel-type-prequel      { background: rgba(8,145,178,.1);   color: #0891b2; }
    .rel-type-spinoff      { background: rgba(217,119,6,.1);   color: #d97706; }
    .rel-type-related      { background: rgba(108,117,125,.1); color: #6c757d; }
    .vrel-cards { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .vrel-card {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: border-color .15s, background .15s;
        max-width: 100px;
    }
    .vrel-card:hover { border-color: var(--accent); background: var(--bg-hover); }
    .vrel-card-img {
        width: 100%;
        height: auto;
        border-radius: 3px;
        object-fit: cover;
        background: var(--bg-secondary);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
    }
    .vrel-card-name {
        font-size: 0.78rem;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 155px;
    }
    .vrel-card-meta { font-size: 0.68rem; color: var(--text-secondary); margin-top: 1px; }
    .vrel-del-btn {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 0.8rem;
        cursor: pointer;
        padding: 0 0.15rem;
        opacity: 0;
        transition: opacity .15s, color .15s;
        flex-shrink: 0;
    }
    .vrel-card:hover .vrel-del-btn { opacity: 1; }
    .vrel-del-btn:hover { color: var(--danger); }

    .vrel-empty {
        padding: 1.25rem;
        text-align: center;
        color: var(--text-secondary);
        font-size: 0.85rem;
    }

    .vrel-edit-btn {
        background: none;
        border: none;
        font-size: 0.8rem;
        cursor: pointer;
        padding: 0 0.15rem;
        opacity: 0;
        transition: opacity .15s;
        flex-shrink: 0;
    }
    .vrel-card:hover .vrel-edit-btn { opacity: 1; }

    /* ── Модалка додавання зв'язку ──────────────────────────────────── */
    #vrel-modal {
        display: none;
        position: fixed; inset: 0;
        background: rgba(0,0,0,.35);
        z-index: 200;
        align-items: center;
        justify-content: center;
    }
    #vrel-modal.open { display: flex; }
    .vrel-modal-box {
        background: var(--bg-primary);
        border-radius: 10px;
        padding: 1.5rem;
        width: 420px;
        max-width: 95vw;
        box-shadow: 0 8px 24px rgba(0,0,0,.15);
    }
    .vrel-modal-box h4 { font-size: 1rem; margin-bottom: 1rem; }
    .vrel-modal-fg { margin-bottom: 0.85rem; }
    .vrel-modal-fg label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 0.3rem;
    }
    .vrel-modal-fg input, .vrel-modal-fg select {
        width: 100%;
        padding: 0.45rem 0.65rem;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        font-size: 0.875rem;
        color: var(--text-primary);
        background: var(--bg-primary);
        outline: none;
    }
    .vrel-modal-fg input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(26,136,193,.1);
    }
    .vrel-type-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }
    .vrel-pill {
        padding: 0.3rem 0.7rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        border: 2px solid transparent;
        transition: all .15s;
        opacity: .55;
    }
    .vrel-pill.active { opacity: 1; border-color: currentColor; }
    .vrel-pill-continuation { background: rgba(26,136,193,.1);  color: #1a88c1; }
    .vrel-pill-sequel       { background: rgba(124,58,237,.1);  color: #7c3aed; }
    .vrel-pill-prequel      { background: rgba(8,145,178,.1);   color: #0891b2; }
    .vrel-pill-spinoff      { background: rgba(217,119,6,.1);   color: #d97706; }
    .vrel-pill-related      { background: rgba(108,117,125,.1); color: #6c757d; }

    .vrel-search-results {
        border: 1px solid var(--border-color);
        border-radius: 6px;
        overflow: hidden;
        margin-top: 0.35rem;
        max-height: 200px;
        overflow-y: auto;
    }
    .vrel-search-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        border-bottom: 1px solid var(--border-color);
        font-size: 0.82rem;
    }
    .vrel-search-row:last-child { border-bottom: none; }
    .vrel-search-row:hover { background: var(--bg-hover); }
    .vrel-search-row img, .vrel-search-row .vrel-search-thumb {
        width: 28px; height: 40px;
        border-radius: 3px;
        object-fit: cover;
        background: var(--bg-secondary);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
    }
    .vrel-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1.1rem;
    }
    `;
    document.head.appendChild(style);
}

// ── Утиліти ───────────────────────────────────────────────────────────────

function imgTag(cv_img, w = 100, h = 140) {
    if (!cv_img) return `<div style="width:${w}px;height:${h}px;background:var(--bg-secondary);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(h/3)}px;">📚</div>`;
    const src = cv_img.startsWith('http') ? cv_img : `${cv_img_path_small}${cv_img.startsWith('/') ? '' : '/'}${cv_img}`;
    return `<img src="${src}" style="width:${w}px;height:${h}px;object-fit:cover;border-radius:3px;flex-shrink:0;">`;
}

// ── Стан модуля ───────────────────────────────────────────────────────────

let _volumeId      = null;   // поточний db id тому
let _selectedType  = 'continuation';
let _selectedVolId = null;   // обраний том в пікері
let _searchTimeout = null;
let _onReload      = null;   // колбек для перерендеру

// ── Публічний API ─────────────────────────────────────────────────────────

/**
 * Монтує секцію хронології у DOM-елемент з вказаним id.
 * @param {number|string} volumeId  — db id поточного тому
 * @param {string}        containerId — id елемента куди рендерити
 * @param {Function}      onReload  — колбек після зміни (зазвичай renderVolumeDetail)
 */
export async function mountVolumeRelations(volumeId, containerId, onReload) {
    injectCSS();
    _volumeId = parseInt(volumeId);
    _onReload = onReload;

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div style="padding:1rem;color:var(--text-secondary);font-size:0.85rem;">Завантаження зв\'язків…</div>';

    const data = await fetchRelations(volumeId);

    container.innerHTML = buildSectionHTML(data);

    _ensureModal();
}

// ── Fetch ─────────────────────────────────────────────────────────────────

async function fetchRelations(volumeId) {
    const res = await fetch(`${API_BASE}/volumes/${volumeId}/relations`);
    if (!res.ok) return { chain: [], other: {} };
    return res.json(); // { chain: [...], other: { sequel:[...], prequel:[...], ... } }
}

// ── Рендер секції ─────────────────────────────────────────────────────────

function buildSectionHTML(data) {
    const chain = data.chain || [];
    const other = data.other || {};
    const hasOther = Object.values(other).some(arr => arr.length > 0);

    const chainHTML = chain.length > 0 ? `
        <div class="vrel-chain-wrap">
            <div class="vrel-chain-label">📖 Продовження серії</div>
            <div class="vrel-chain">
                ${chain.map((vol, i) => {
                    const displayNum = vol.order_num !== null
                        ? vol.order_num
                        : (chain[i - 1]?.order_num ?? i) + 1;

                    return `
                        <div class="vrel-chain-item${vol.current ? ' current' : ''}"
                            onclick="window._vrelNavigate(${vol.id})">
                            <div class="vrel-cover">${imgTag(vol.cv_img, 80, 120)}</div>
                            <div class="vrel-chain-name"
                                title="${escH(vol.name)}${vol.start_year ? ` (${vol.start_year})` : ''}">
                                Vol ${displayNum}
                                ${vol.start_year ? `<br><span style="font-size:0.55rem;">${vol.start_year}</span>` : ''}
                            </div>
                            ${vol.rel_id ? `
                                <button class="vrel-edit-order-btn"
                                        title="Змінити порядок"
                                        onclick="event.stopPropagation(); window._vrelEditOrder(${vol.rel_id}, ${vol.order_num ?? ''})">
                                    ✏️
                                </button>
                            ` : `<span style="font-size:0.55rem; color:var(--text-secondary); text-align:center;">кінець</span>`}
                        </div>
                        ${i < chain.length - 1 ? '<div class="vrel-chain-arrow">›</div>' : ''}
                    `;
                }).join('')}
            </div>
        </div>
    ` : '';

    const groupsHTML = hasOther ? `
        <div class="vrel-groups">
            ${['sequel','prequel','spinoff','related'].map(type => {
                const vols = other[type] || [];
                if (!vols.length) return '';
                const { label, icon, cls } = REL_TYPES[type];
                return `
                    <div class="vrel-group">
                        <div class="vrel-group-badge ${cls}">${icon} ${label}</div>
                        <div class="vrel-cards">
                            ${vols.map(v => `
                                <div class="vrel-card" onclick="window._vrelNavigate(${v.id})">
                                    ${imgTag(v.cv_img)}
                                    <div style="overflow:hidden; padding:0 0.25rem;">
                                        <div class="vrel-card-name">${escH(v.name)}</div>
                                        <div class="vrel-card-meta">${v.start_year || '—'} · CV #${v.cv_id}</div>
                                    </div>
                                    <button class="vrel-edit-btn"
                                        title="Змінити тип зв'язку"
                                        onclick="event.stopPropagation(); window._vrelEditType(${v.rel_id}, '${type}')">
                                        ✏️
                                    </button>
                                    <button class="vrel-del-btn"
                                        title="Видалити зв'язок"
                                        onclick="event.stopPropagation(); window._vrelDelete(${v.rel_id})">
                                        ✕
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    ` : (!chain.length ? '<div class="vrel-empty">Зв\'язки ще не додано</div>' : '');

    return `
        <div class="vrel-section">
            <div class="vrel-header">
                <h2>🔗 Хронологія та зв'язки</h2>
                <button class="btn btn-primary btn-small" onclick="window._vrelOpenModal()">＋ Додати зв'язок</button>
            </div>
            ${chainHTML}
            ${groupsHTML}
        </div>
    `;
}

function escH(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Глобальні обробники (для onclick у innerHTML) ─────────────────────────

window._vrelNavigate = (id) => navigate('volume-detail', { id });

window._vrelDelete = async (relId) => {
    if (!confirm('Видалити цей зв\'язок?')) return;
    const res = await fetch(`${API_BASE}/volumes/${_volumeId}/relations/${relId}`, { method: 'DELETE' });
    if (!res.ok) { const e = await res.json(); alert(e.error || 'Помилка'); return; }
    if (_onReload) _onReload();
};

window._vrelEditOrder = (relId, currentOrder) => {
    const val = prompt(
        `Порядковий номер цього тому у серії (поточний: ${currentOrder ?? 'не задано'})\n\nПам\'ятай: order_num = позиція ЦЬОГО тому (від якого йде стрілка вперед).`,
        currentOrder ?? ''
    );
    if (val === null) return;           // скасовано
    const num = parseInt(val);
    if (isNaN(num) || num < 0) { alert('Введіть ціле число ≥ 0'); return; }
    window._vrelSaveOrder(relId, num);
};

window._vrelSaveOrder = async (relId, orderNum) => {
    const res = await fetch(`${API_BASE}/volumes/${_volumeId}/relations/${relId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_num: orderNum }),
    });
    if (!res.ok) { const e = await res.json(); alert(e.error || 'Помилка'); return; }
    if (_onReload) _onReload();
};

window._vrelEditType = (relId, currentType) => {
    const types = { sequel:'⏩ Сиквел', prequel:'⏪ Приквел', spinoff:'🌀 Спінофф', related:'🔗 Пов\'язаний' };
    const options = Object.entries(types)
        .map(([val, label]) => `<option value="${val}"${val === currentType ? ' selected' : ''}>${label}</option>`)
        .join('');

    // Використовуємо існуючу модалку але перевикористовуємо її вміст
    const box = document.querySelector('.vrel-modal-box');
    box.dataset.prevHtml = box.innerHTML;  // зберігаємо старий вміст

    box.innerHTML = `
        <h4>Змінити тип зв'язку</h4>
        <div class="vrel-modal-fg">
            <label>Новий тип</label>
            <select id="vrel-edit-type-select">${options}</select>
        </div>
        <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.5rem;">
            Зворотній зв'язок буде оновлено автоматично.
        </p>
        <div class="vrel-modal-actions">
            <button class="btn btn-secondary" onclick="window._vrelCancelEditType()">Скасувати</button>
            <button class="btn btn-primary"   onclick="window._vrelSaveType(${relId})">Зберегти</button>
        </div>
    `;

    document.getElementById('vrel-modal').classList.add('open');
};

window._vrelCancelEditType = () => {
    const box = document.querySelector('.vrel-modal-box');
    if (box.dataset.prevHtml) box.innerHTML = box.dataset.prevHtml;
    delete box.dataset.prevHtml;
    window._vrelCloseModal();
};

window._vrelSaveType = async (relId) => {
    const newType = document.getElementById('vrel-edit-type-select').value;
    const res = await fetch(`${API_BASE}/volumes/${_volumeId}/relations/${relId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rel_type: newType }),
    });
    if (!res.ok) { const e = await res.json(); alert(e.error || 'Помилка'); return; }
    window._vrelCloseModal();
    if (_onReload) _onReload();
};

window._vrelOpenModal = () => {
    _selectedVolId = null;
    _selectedType  = 'continuation';

    // скидаємо форму
    document.getElementById('vrel-search-input').value = '';
    document.getElementById('vrel-cvid-input').value   = '';
    document.getElementById('vrel-search-results').innerHTML = '';
    document.getElementById('vrel-selected-info').innerHTML  = '';
    document.getElementById('vrel-order-row').style.display  = 'block';
    document.getElementById('vrel-order-num').value          = '';

    document.querySelectorAll('.vrel-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.type === 'continuation');
    });

    document.getElementById('vrel-modal').classList.add('open');
    setTimeout(() => document.getElementById('vrel-search-input').focus(), 50);
};

window._vrelCloseModal = () => {
    document.getElementById('vrel-modal').classList.remove('open');
};

window._vrelSelectType = (el) => {
    _selectedType = el.dataset.type;
    document.querySelectorAll('.vrel-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('vrel-order-row').style.display =
        _selectedType === 'continuation' ? 'block' : 'none';
};

window._vrelPickVolume = (id) => {
    _selectedVolId = id;
    const row = document.getElementById(`vrel-row-${id}`);
    if (row) {
        document.getElementById('vrel-selected-info').innerHTML =
            `<div style="padding:0.5rem 0.75rem; background:var(--bg-secondary); border-radius:6px; font-size:0.82rem; color:var(--accent); font-weight:600;">✔ ${row.dataset.name}</div>`;
    }
    document.getElementById('vrel-search-results').innerHTML = '';
};

window._vrelSave = async () => {
    if (!_selectedVolId) { alert('Оберіть том'); return; }

    const orderNum = parseInt(document.getElementById('vrel-order-num').value) || 0;
    const body = {
        to_vol_id: _selectedVolId,
        rel_type:  _selectedType,
        order_num: orderNum,
    };

    const res = await fetch(`${API_BASE}/volumes/${_volumeId}/relations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) { const e = await res.json(); alert(e.error || 'Помилка'); return; }
    window._vrelCloseModal();
    if (_onReload) _onReload();
};

// ── Пошук томів у модалці ─────────────────────────────────────────────────

function runSearch({ name, cv_id }) {
    clearTimeout(_searchTimeout);
    _searchTimeout = setTimeout(async () => {
        const resultsEl = document.getElementById('vrel-search-results');
        if (!name?.trim() && !cv_id?.toString().trim()) {
            resultsEl.innerHTML = ''; return;
        }

        let url = cv_id?.toString().trim()
            ? `${API_BASE}/volumes?cv_id=${encodeURIComponent(cv_id)}&limit=5`
            : `${API_BASE}/volumes?search=${encodeURIComponent(name.trim())}&limit=20`;

        const res = await fetch(url);
        const result = await res.json();
        const vols = result.data || [];

        if (!vols.length) {
            resultsEl.innerHTML = '<div style="padding:0.75rem; color:var(--text-secondary); font-size:0.82rem;">Нічого не знайдено</div>';
            return;
        }

        resultsEl.innerHTML = vols.map(v => `
            <div id="vrel-row-${v.id}"
                 data-name="${escH(v.name)}"
                 class="vrel-search-row"
                 onclick="window._vrelPickVolume(${v.id})">
                ${imgTag(v.cv_img, 40, 60)}
                <div style="overflow:hidden;">
                    <div style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:300px;">
                        ${v.lang ? `<span style="color:var(--accent)">[${v.lang}]</span> ` : ''}${escH(v.name)}
                    </div>
                    <div style="font-size:0.72rem; color:var(--text-secondary);">CV ID: ${v.cv_id}${v.start_year ? ` · ${v.start_year}` : ''}${v.publisher_name ? ` · ${v.publisher_name}` : ''}</div>
                </div>
            </div>
        `).join('');
    }, 300);
}

// ── Створення модального вікна (один раз) ─────────────────────────────────

function _ensureModal() {
    if (document.getElementById('vrel-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'vrel-modal';
    modal.innerHTML = `
        <div class="vrel-modal-box">
            <h4>Додати зв'язок з томом</h4>

            <div class="vrel-modal-fg">
                <label>Тип зв'язку</label>
                <div class="vrel-type-pills">
                    ${Object.entries(REL_TYPES).map(([type, { label, icon }]) => `
                        <span class="vrel-pill vrel-pill-${type}${type === 'continuation' ? ' active' : ''}"
                              data-type="${type}"
                              onclick="window._vrelSelectType(this)">
                            ${icon} ${label}
                        </span>
                    `).join('')}
                </div>
            </div>

            <div class="vrel-modal-fg">
                <label>Пошук за назвою</label>
                <input id="vrel-search-input" type="text" placeholder="напр. Amazing Spider-Man…">
            </div>
            <div class="vrel-modal-fg">
                <label>або CV ID</label>
                <input id="vrel-cvid-input" type="number" placeholder="напр. 796">
            </div>

            <div id="vrel-search-results" class="vrel-search-results" style="display:none;"></div>
            <div id="vrel-selected-info" style="margin-bottom:0.5rem;"></div>

            <div id="vrel-order-row" class="vrel-modal-fg">
                <label>Порядковий номер у серії (для «Продовження»)</label>
                <input id="vrel-order-num" type="number" placeholder="напр. 2" min="1">
            </div>

            <div class="vrel-modal-actions">
                <button class="btn btn-secondary" onclick="window._vrelCloseModal()">Скасувати</button>
                <button class="btn btn-primary"   onclick="window._vrelSave()">Зберегти</button>
            </div>
        </div>
    `;

    // Закрити по кліку на фон
    modal.addEventListener('click', (e) => { if (e.target === modal) window._vrelCloseModal(); });

    document.body.appendChild(modal);

    // Прив'язуємо інпути після вставки
    document.getElementById('vrel-search-input').addEventListener('input', (e) => {
        document.getElementById('vrel-cvid-input').value = '';
        const el = document.getElementById('vrel-search-results');
        el.style.display = e.target.value.trim() ? 'block' : 'none';
        runSearch({ name: e.target.value });
    });
    document.getElementById('vrel-cvid-input').addEventListener('input', (e) => {
        document.getElementById('vrel-search-input').value = '';
        const el = document.getElementById('vrel-search-results');
        el.style.display = e.target.value.trim() ? 'block' : 'none';
        runSearch({ cv_id: e.target.value });
    });
}