// public/js/components/globalAddModal.js
import { API_BASE } from '../utils/config.js';
import { LANG_MAP } from '../utils/helpers.js';

const CONTENT_TYPES = [
  { id: 'volume',        icon: '📚', label: 'Том (комікс)'      },
  { id: 'issue',         icon: '📖', label: 'Випуск'            },
  { id: 'collection',    icon: '📗', label: 'Збірник'           },
  { id: 'series',        icon: '🗂️',  label: 'Серія'             },
  { id: 'reading-order', icon: '📋', label: 'Порядок читання'   },
  { id: 'event',         icon: '⚡', label: 'Подія'             },
  { id: 'character',     icon: '🦸', label: 'Персонаж'          },
  { id: 'personnel',     icon: '👤', label: 'Персонал'          },
  { id: 'manga-volume',  icon: '🈳', label: 'Том манґи'         },
  { id: 'manga-chapter', icon: '📄', label: 'Розділ манґи'      },
];

let _modal = null;
let _currentType = null;

// ── DOM-ін'єкція ──────────────────────────────────────────────────────────

function ensureModal() {
  if (document.getElementById('global-add-modal')) return;

  const el = document.createElement('div');
  el.id = 'global-add-modal';
  el.style.cssText = [
    'display:none; position:fixed; inset:0;',
    'background:rgba(0,0,0,0.6); z-index:3000;',
    'align-items:center; justify-content:center;',
  ].join('');

  el.innerHTML = `
    <div id="gam-box" style="
      background:var(--bg-primary); border-radius:12px; padding:1.5rem;
      width:600px; max-width:95vw; max-height:90vh; overflow-y:auto;
      display:flex; flex-direction:column; gap:1rem;
      box-shadow:0 20px 60px rgba(0,0,0,0.5);
    ">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <h2 id="gam-title" style="margin:0; font-size:1.2rem;">Додати контент</h2>
        <button id="gam-close" style="
          background:none; border:none; font-size:1.4rem; line-height:1;
          cursor:pointer; color:var(--text-secondary); padding:0.2rem 0.5rem;
          border-radius:4px;
        ">×</button>
      </div>

      <div id="gam-type-grid" style="
        display:grid; grid-template-columns:repeat(5,1fr); gap:0.5rem;
      "></div>

      <div id="gam-form-area" style="display:none;"></div>

      <div id="gam-status" style="display:none; font-size:0.85rem; color:var(--text-secondary); padding:0.5rem; background:var(--bg-secondary); border-radius:6px;"></div>

      <div id="gam-actions" style="display:none; justify-content:flex-end; gap:0.5rem;">
        <button id="gam-back"   class="btn btn-secondary">← Назад</button>
        <button id="gam-submit" class="btn btn-primary">Зберегти</button>
      </div>
    </div>
  `;

  document.body.appendChild(el);
  _modal = el;

  el.addEventListener('click', e => { if (e.target === el) closeGlobalAddModal(); });
  document.getElementById('gam-close').addEventListener('click', closeGlobalAddModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _modal?.style.display !== 'none') closeGlobalAddModal();
  });
  document.getElementById('gam-back').addEventListener('click', showTypeSelection);
  document.getElementById('gam-submit').addEventListener('click', handleSubmit);

  renderTypeGrid();
}

// ── Сітка вибору типу ─────────────────────────────────────────────────────

function renderTypeGrid() {
  const grid = document.getElementById('gam-type-grid');
  grid.innerHTML = CONTENT_TYPES.map(t => `
    <button class="gam-type-btn" data-type="${t.id}" style="
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:0.35rem; padding:0.75rem 0.4rem;
      border:1.5px solid var(--border-color); border-radius:8px;
      background:var(--bg-secondary); cursor:pointer;
      font-size:0.77rem; font-weight:600; color:var(--text-primary);
      transition:all 0.15s;
    ">
      <span style="font-size:1.5rem;">${t.icon}</span>
      <span>${t.label}</span>
    </button>
  `).join('');

  grid.querySelectorAll('.gam-type-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = 'var(--accent)';
      btn.style.background  = 'var(--accent-light)';
      btn.style.color       = 'var(--accent)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'var(--border-color)';
      btn.style.background  = 'var(--bg-secondary)';
      btn.style.color       = 'var(--text-primary)';
    });
    btn.addEventListener('click', () => selectType(btn.dataset.type));
  });
}

function showTypeSelection() {
  _currentType = null;
  document.getElementById('gam-title').textContent     = 'Додати контент';
  document.getElementById('gam-type-grid').style.display  = 'grid';
  document.getElementById('gam-form-area').style.display  = 'none';
  document.getElementById('gam-actions').style.display    = 'none';
  document.getElementById('gam-status').style.display     = 'none';
}

function selectType(typeId) {
  _currentType = typeId;
  const type = CONTENT_TYPES.find(t => t.id === typeId);

  document.getElementById('gam-title').textContent     = `${type.icon} ${type.label}`;
  document.getElementById('gam-type-grid').style.display  = 'none';
  document.getElementById('gam-form-area').style.display  = 'block';
  document.getElementById('gam-actions').style.display    = 'flex';
  document.getElementById('gam-status').style.display     = 'none';

  renderForm(typeId);
}

// ── Форми ─────────────────────────────────────────────────────────────────

const S_INPUT = [
  'width:100%; padding:0.5rem 0.75rem;',
  'border:1px solid var(--border-color); border-radius:6px;',
  'background:var(--bg-secondary); color:var(--text-primary); font-size:0.9rem;',
].join('');

function fld(label, html, hint = '') {
  return `
    <div>
      <label style="display:block; font-size:0.82rem; font-weight:600;
                    color:var(--text-secondary); margin-bottom:0.3rem;">${label}</label>
      ${html}
      ${hint ? `<div style="font-size:0.73rem; color:var(--text-muted); margin-top:0.2rem;">${hint}</div>` : ''}
    </div>
  `;
}

function inp(name, type = 'text', placeholder = '') {
  return `<input type="${type}" name="${name}" placeholder="${placeholder}" style="${S_INPUT}">`;
}

function row(...cols) {
  return `<div style="display:grid; grid-template-columns:${cols.map(() => '1fr').join(' ')}; gap:0.75rem;">${cols.join('')}</div>`;
}

function langSelect() {
  const opts = Object.entries(LANG_MAP)
    .map(([code, { flag, label }]) => `<option value="${code}">${flag} ${label}</option>`)
    .join('');
  return `<select name="lang" style="${S_INPUT}"><option value="">— не вказано</option>${opts}</select>`;
}

const FORMS = {
  'volume': () => `
    ${row(fld('CV ID', inp('cv_id', 'number', '...')), fld('CV Slug', inp('cv_slug', 'text', 'amazing-spider-man')))}
    ${fld('Назва *', inp('name', 'text', 'Amazing Spider-Man'))}
    ${row(fld('Рік початку', inp('start_year', 'number', '2025')), fld('Мова', langSelect()))}
    ${fld('URL зображення', inp('cv_img', 'url', 'https://...'))}
  `,
  'issue': () => `
    ${row(fld('CV ID', inp('cv_id', 'number', '...')), fld('CV Slug', inp('cv_slug', 'text', '...')))}
    ${fld('Назва', inp('name', 'text', 'The Amazing...'))}
    ${row(fld('Volume CV ID *', inp('cv_vol_id', 'number', '...')), fld('Номер', inp('issue_number', 'text', '1')))}
    ${row(fld('Дата обкладинки', inp('cover_date', 'date')), fld('Дата релізу', inp('release_date', 'date')))}
    ${fld('URL зображення', inp('cv_img', 'url', 'https://...'))}
  `,
  'collection': () => `
    ${row(fld('CV ID', inp('cv_id', 'number', '...')), fld('CV Slug', inp('cv_slug', 'text', '...')))}
    ${fld('Назва *', inp('name', 'text', 'Ultimate Collection Vol. 1'))}
    ${row(fld('CV Vol ID (тому)', inp('cv_vol_id', 'number', '...')), fld('Номер збірника', inp('issue_number', 'text', '1')))}
    ${row(fld('Дата обкладинки', inp('cover_date', 'date')), fld('Дата релізу', inp('release_date', 'date')))}
    ${fld('URL зображення', inp('cv_img', 'url', 'https://...'))}
  `,
  'series': () => `
    ${fld('Назва *', inp('name', 'text', 'Amazing Spider-Man Saga'))}
    ${fld('Опис', `<textarea name="description" rows="3" placeholder="Опис серії..." style="${S_INPUT} resize:vertical;"></textarea>`)}
    ${fld('URL зображення', inp('cv_img', 'url', 'https://...'))}
  `,
  'reading-order': () => `
    ${fld('Назва *', inp('name', 'text', 'Marvel 616 Reading Order'))}
    ${fld('Опис', `<textarea name="description" rows="3" placeholder="Опис порядку читання..." style="${S_INPUT} resize:vertical;"></textarea>`)}
    ${fld('URL зображення', inp('cv_img', 'url', 'https://...'))}
  `,
  'event': () => `
    ${fld('Назва *', inp('name', 'text', 'Civil War'))}
    ${row(fld('Рік початку', inp('start_year', 'number', '2006')), fld('Рік кінця', inp('end_year', 'number', '2007')))}
    ${fld('Опис', `<textarea name="description" rows="3" placeholder="Опис події..." style="${S_INPUT} resize:vertical;"></textarea>`)}
    ${fld('URL зображення', inp('cv_img', 'url', 'https://...'))}
  `,
  'character': () => `
    ${row(fld('CV ID *', inp('cv_id', 'number', '...')), fld('CV Slug *', inp('cv_slug', 'text', 'spider-man')))}
    ${fld("Ім'я персонажа *", inp('name', 'text', 'Spider-Man'))}
    ${fld("Справжнє ім'я", inp('real_name', 'text', 'Peter Parker'))}
    ${fld('URL зображення', inp('cv_img', 'url', 'https://...'))}
  `,
  'personnel': () => `
    ${fld("Ім'я *", inp('name', 'text', 'Stan Lee'))}
    ${row(fld('CV ID', inp('cv_id', 'number', '...')), fld('CV Slug', inp('cv_slug', 'text', 'stan-lee')))}
    ${fld('Біографія', `<textarea name="bio" rows="3" placeholder="Біографія..." style="${S_INPUT} resize:vertical;"></textarea>`)}
    ${fld('URL зображення', inp('cv_img', 'url', 'https://...'))}
  `,
  'manga-volume': () => `
    ${fld('Hikka Slug *', inp('hikka_slug', 'text', 'berserk-ek0mv'),
      'Slug з hikka.io — назва, постер, рік і опис підтягнуться автоматично')}
    ${fld('MAL ID', inp('mal_id', 'number', ''), 'Необов\'язково — ID на MyAnimeList')}
    ${fld('Назва (якщо Hikka недоступна)', inp('name', 'text', ''), 'Залиште порожнім, щоб взяти з Hikka')}
  `,
  'manga-chapter': () => `
    ${fld('DB ID тому манґи *', inp('ds_vol_id', 'number', ''),
      'ID тому в локальній базі (не cv_id — подивіться в URL сторінки тому)')}
    ${row(fld('Номер розділу *', inp('issue_number', 'text', '1')), fld('Дата виходу', inp('release_date', 'date')))}
    ${fld('Назва розділу', inp('name', 'text', 'The Black Swordsman'), 'Якщо порожньо — буде «Розділ N»')}
    ${fld('URL зображення', inp('cv_img', 'url', 'https://...'))}
  `,
};

function renderForm(typeId) {
  const area = document.getElementById('gam-form-area');
  const builder = FORMS[typeId];
  area.innerHTML = builder
    ? `<div style="display:flex; flex-direction:column; gap:0.75rem;">${builder()}</div>`
    : '<div style="color:var(--danger);">Невідомий тип</div>';
}

// ── Збереження ────────────────────────────────────────────────────────────

async function handleSubmit() {
  const btn    = document.getElementById('gam-submit');
  const status = document.getElementById('gam-status');

  btn.disabled     = true;
  btn.textContent  = '⏳ Збереження...';
  status.style.display = 'none';

  try {
    const data = collectFormData();
    const result = await submitData(_currentType, data);

    status.style.display    = 'block';
    status.style.color      = 'var(--success, #00b894)';
    status.textContent      = `✓ Збережено успішно${result?.id ? ` (id: ${result.id})` : ''}`;

    await window.updateStats?.();
    reloadCurrentPage(_currentType);

    setTimeout(closeGlobalAddModal, 800);
  } catch (err) {
    console.error('[GlobalAddModal]', err);
    status.style.display = 'block';
    status.style.color   = 'var(--danger, #d63031)';
    status.textContent   = `✗ ${err.message || 'Помилка збереження'}`;
    btn.disabled    = false;
    btn.textContent = 'Зберегти';
  }
}

function collectFormData() {
  const area = document.getElementById('gam-form-area');
  const data = {};
  area.querySelectorAll('[name]').forEach(el => {
    const val = el.value.trim();
    data[el.name] = val === '' ? null : val;
  });
  return data;
}

const REQUIRED_FIELDS = {
  'volume':        ['name'],
  'issue':         ['cv_vol_id'],
  'collection':    ['name'],
  'series':        ['name'],
  'reading-order': ['name'],
  'event':         ['name'],
  'character':     ['cv_id', 'cv_slug', 'name'],
  'personnel':     ['name'],
  'manga-volume':  ['hikka_slug'],
  'manga-chapter': ['ds_vol_id', 'issue_number'],
};

const NUMERIC_FIELDS = ['cv_id', 'cv_vol_id', 'start_year', 'end_year', 'mal_id', 'ds_vol_id'];

async function submitData(typeId, raw) {
  // Валідація
  const missing = (REQUIRED_FIELDS[typeId] || []).filter(f => !raw[f]);
  if (missing.length) throw new Error(`Заповніть обов'язкові поля: ${missing.join(', ')}`);

  // Типізація
  const data = { ...raw };
  NUMERIC_FIELDS.forEach(f => { if (data[f]) data[f] = parseInt(data[f]); });

  let endpoint, body;

  switch (typeId) {
    case 'manga-volume':
      endpoint = `${API_BASE}/volumes/manga-volume`;
      body = { hikka_slug: data.hikka_slug, mal_id: data.mal_id || null, name: data.name || null };
      break;

    case 'manga-chapter':
      endpoint = `${API_BASE}/issues`;
      body = {
        ds_vol_id:    data.ds_vol_id,
        issue_number: data.issue_number,
        name:         data.name || `Розділ ${data.issue_number}`,
        release_date: data.release_date || null,
        cv_img:       data.cv_img || null,
      };
      break;

    case 'reading-order':
      endpoint = `${API_BASE}/reading-orders`;
      body = data;
      break;

    default: {
      const MAP = {
        volume: 'volumes', issue: 'issues', collection: 'collections',
        series: 'series',  event: 'events', character: 'characters',
        personnel: 'personnel',
      };
      endpoint = `${API_BASE}/${MAP[typeId]}`;
      body = data;
    }
  }

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Перезавантаження поточної сторінки ───────────────────────────────────

function reloadCurrentPage(typeId) {
  const PAGE_MAP = {
    'volume':        'volumes',
    'issue':         'issues',
    'collection':    'collections',
    'series':        'series',
    'reading-order': 'reading-orders',
    'event':         'events',
    'character':     'characters',
    'personnel':     'personnel',
    'manga-volume':  'volumes',
    'manga-chapter': 'issues',
  };
  const target  = PAGE_MAP[typeId];
  const current = new URL(window.location).searchParams.get('page') || 'volumes';
  if (target && current === target) {
    window.navigate?.(target);
  }
}

// ── Публічний API ─────────────────────────────────────────────────────────

export function openGlobalAddModal(defaultType = null) {
  ensureModal();
  _modal.style.display = 'flex';
  showTypeSelection();
  if (defaultType) selectType(defaultType);
}

export function closeGlobalAddModal() {
  if (_modal) _modal.style.display = 'none';
  _currentType = null;
}