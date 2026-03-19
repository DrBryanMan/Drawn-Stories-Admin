// Компонент «Хронологія та зв'язки» для сторінки деталей тому.
// Підключається з volumeDetail.js викликом mountVolumeRelations(volumeId, containerId).

import { API_BASE } from '../utils/config.js';
import { cv_img_path_small } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';

// ── Конфіг типів зв'язку ──────────────────────────────────────────────────

const REL_TYPES = {
    continuation: { label: 'Продовження', icon: '🔢', cls: 'rel-type-continuation' },
    sequel:       { label: 'Сиквел',       icon: '⏩', cls: 'rel-type-sequel'       },
    prequel:      { label: 'Приквел',      icon: '⏪', cls: 'rel-type-prequel'      },
    spinoff:      { label: 'Спінофф',      icon: '🌀', cls: 'rel-type-spinoff'      },
    related:      { label: 'Пов\'язаний',  icon: '🔗', cls: 'rel-type-related'      },
};

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
                    const pos = i + 1; 
                    return `
                        <div class="vrel-chain-item${vol.current ? ' current' : ''}"
                            onclick="window._vrelNavigate(${vol.id})">
                            <div style="position:relative;">
                                <div class="vrel-cover">${imgTag(vol.cv_img, 110, 160)}</div>
                                <span class="vrel-chain-pos-badge"
                                    title="Позиція у серії. Клікни щоб змінити"
                                    onclick="event.stopPropagation(); window._vrelEditOrder(${vol.rel_id ?? 'null'}, ${pos})">
                                    ${pos}
                                </span>
                                ${(vol.rel_id || vol.in_rel_id) ? `
                                    <span class="vrel-del-chain-btn"
                                        title="Видалити зв'язок"
                                        onclick="event.stopPropagation(); window._vrelDelete(${vol.rel_id ?? vol.in_rel_id})">
                                        ✕
                                    </span>
                                ` : ''}
                            </div>
                            <div class="vrel-chain-name"
                                title="${escH(vol.name)}${vol.start_year ? ` (${vol.start_year})` : ''}">
                                ${escH(vol.name)}
                            </div>
                            ${vol.start_year ? `<span style="font-size:0.55rem;">${vol.start_year}</span>` : ''}
                        </div>
                        ${i < chain.length - 1 ? '<div class="vrel-chain-arrow">›</div>' : ''}
                    `;
                }).join('')}
            </div>
        </div>
    ` : '';

    const groupsHTML = hasOther ? `
        <div class="vrel-groups" style="border-top: 1px solid var(--border-color);">
            ${['sequel','prequel','spinoff','related'].map(type => {
                const vols = other[type] || [];
                if (!vols.length) return '';
                const { label, icon, cls } = REL_TYPES[type];
                return `
                    <div class="vrel-group">
                        <div class="vrel-group-label">
                            <span class="vrel-group-type-badge ${cls}">${icon} ${label}</span>
                        </div>
                        <div class="vrel-chain-scroll">
                            ${vols.map(v => `
                                <div class="vrel-chain-item vrel-other-item" onclick="window._vrelNavigate(${v.id})"
                                    title="${escH(v.name)}${v.start_year ? ' (' + v.start_year + ')' : ''}">
                                    <div style="position:relative;">
                                        ${imgTag(v.cv_img, 90, 126)}
                                        <button class="vrel-del-chain-btn"
                                            title="Видалити зв'язок"
                                            onclick="event.stopPropagation(); window._vrelDelete(${v.rel_id})">✕</button>
                                    </div>
                                    <div class="vrel-chain-name">${escH(v.name)}</div>
                                    ${v.start_year ? `<span style="font-size:0.55rem;color:var(--text-muted);">${v.start_year}</span>` : ''}
                                    <button class="vrel-other-edit-btn ${cls}"
                                        title="Змінити тип зв'язку"
                                        onclick="event.stopPropagation(); window._vrelEditType(${v.rel_id}, '${type}')">
                                        <i class="bi bi-pencil"></i>
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

window._vrelEditOrder = (relId, currentPos) => {
    if (!relId) return; // кінцевий елемент без rel_id
    const val = prompt(`Нова позиція у серії (поточна: ${currentPos}):`, currentPos ?? '');
    if (val === null) return;
    const num = parseInt(val);
    if (isNaN(num) || num < 1) { alert('Введіть ціле число ≥ 1'); return; }
    window._vrelSaveOrder(relId, num);
};

window._vrelSaveOrder = async (relId, newOrder) => {
    const res = await fetch(`${API_BASE}/volumes/${_volumeId}/relations/${relId}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_order: newOrder }),
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

    const body = {
        to_vol_id: _selectedVolId,
        rel_type:  _selectedType,
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