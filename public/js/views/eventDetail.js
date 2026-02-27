import { fetchItem } from '../api/api.js';
import { cv_img_path_small, formatDate, showError, showLoading, initDetailPage } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { openModal } from '../components/modal.js';
import { openAddIssueModal } from '../components/addIssueModal.js';
import { buildVolumesMap, renderVolumeSummary, injectVolumeChipsStyles } from '../components/volumeChips.js';

const API_BASE = 'http://localhost:7000/api';

const IMPORTANCE_LABELS = {
  'main':     'Основний',
  'tie-in':   'Тай-ін',
  'prologue': 'Пролог',
  'epilogue': 'Епілог',
};

const IMPORTANCE_COLORS = {
  'main':     '#dbeafe',
  'tie-in':   '#fef9c3',
  'prologue': '#dcfce7',
  'epilogue': '#f3e8ff',
};

const IMPORTANCE_TEXT_COLORS = {
  'main':     '#1d4ed8',
  'tie-in':   '#854d0e',
  'prologue': '#166534',
  'epilogue': '#6b21a8',
};

let currentEventId = null;
let currentTab = 'issues';
let currentEventIssueIds = new Set();

export async function renderEventDetail(params) {
  const id = params.id;
  if (!id) { navigate('events'); return; }
  currentEventId = id;

  initDetailPage();
  showLoading();

  try {
    const event = await fetchItem('events', id);
    await renderPage(event);
  } catch (error) {
    console.error('Помилка завантаження події:', error);
    showError('Помилка завантаження даних');
  }
}

async function renderPage(event) {
  const [issuesRes, collectionsRes] = await Promise.all([
    fetch(`${API_BASE}/events/${event.id}/issues`).then(r => r.json()),
    fetch(`${API_BASE}/events/${event.id}/collections`).then(r => r.json()),
  ]);

  const issues = issuesRes.data || [];
  const collections = collectionsRes.data || [];

  currentEventIssueIds = new Set(issues.map(i => i.id));

  document.getElementById('page-title').innerHTML = `
    <a href="#" onclick="event.preventDefault(); navigateToParent()" style="color:var(--text-secondary); text-decoration:none;">
      ← Події
    </a> / ${event.name}
  `;

  // Уніфікований компонент томів (clickable: false — без навігації, бо в event немає vol_db_id)
  injectVolumeChipsStyles();
  const volumesMap = buildVolumesMap(issues, { keyField: 'volume_cv_id', nameField: 'volume_name', dbIdField: 'volume_db_id' });
  const volumesHtml = renderVolumeSummary(volumesMap, { label: 'Томи у події', clickable: true });

  const content = document.getElementById('content');
  content.innerHTML = `
    <div style="max-width:1200px;">

      <!-- Шапка -->
      <div style="display:flex; gap:2rem; margin-bottom:2rem; align-items:flex-start;">
        <div style="flex-shrink:0;">
          ${event.cv_img
            ? `<img src="${event.cv_img}" alt="${event.name}" style="width:260px; border-radius:8px; box-shadow:var(--shadow-lg);">`
            : '<div style="width:260px; height:340px; background:var(--bg-secondary); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:5rem;">⚡</div>'}
        </div>
        <div style="flex:1;">
          <h1 style="font-size:2rem; margin-bottom:1rem;">${event.name}</h1>
          <div style="display:grid; gap:0.5rem; color:var(--text-secondary); margin-bottom:1rem;">
            ${event.start_year ? `<div><strong>Рік початку:</strong> ${event.start_year}</div>` : ''}
            ${event.end_year   ? `<div><strong>Рік кінця:</strong> ${event.end_year}</div>`   : ''}
            <div><strong>Випусків:</strong> ${issues.length}</div>
            <div><strong>Збірників:</strong> ${collections.length}</div>
          </div>
          ${event.description ? `
            <div style="background:var(--bg-secondary); border-radius:8px; padding:1rem; margin-bottom:1.5rem; line-height:1.6; color:var(--text-primary);">
              ${event.description}
            </div>
          ` : ''}
          <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
            <button class="btn btn-secondary" onclick="editEvent(${event.id})">Редагувати подію</button>
          </div>
        </div>
      </div>

      <!-- Інфо про серії/томи у події -->
      ${volumesHtml}

      <!-- Таби -->
      <div style="background:var(--bg-primary); border-radius:8px; border:1px solid var(--border-color);">
        <div style="display:flex; border-bottom:1px solid var(--border-color);">
          <button id="tab-issues" onclick="switchTab('issues')"
            style="padding:0.875rem 1.5rem; border:none; background:none; cursor:pointer; font-weight:600;
                   border-bottom:2px solid transparent; transition:all 0.2s; color:var(--text-secondary);">
            📖 Випуски (${issues.length})
          </button>
          <button id="tab-collections" onclick="switchTab('collections')"
            style="padding:0.875rem 1.5rem; border:none; background:none; cursor:pointer; font-weight:600;
                   border-bottom:2px solid transparent; transition:all 0.2s; color:var(--text-secondary);">
            📗 Збірники (${collections.length})
          </button>
        </div>

        <!-- Контент таба: Випуски -->
        <div id="tab-content-issues" style="padding:1.5rem; display:${currentTab === 'issues' ? 'block' : 'none'};">
          <div style="display:flex; justify-content:flex-end; margin-bottom:1rem;">
            <button class="btn btn-primary" onclick="openAddIssueToEventModal(${event.id})">+ Додати випуск</button>
          </div>
          ${renderIssuesTable(issues, event.id)}
        </div>

        <!-- Контент таба: Збірники -->
        <div id="tab-content-collections" style="padding:1.5rem; display:${currentTab === 'collections' ? 'block' : 'none'};">
          <div style="display:flex; justify-content:flex-end; margin-bottom:1rem;">
            <button class="btn btn-primary" onclick="openAddCollectionToEventModal(${event.id})">+ Додати збірник</button>
          </div>
          ${renderCollectionsTable(collections, event.id)}
        </div>
      </div>

    </div>

    <!-- Модалка: Додати збірник -->
    <div id="add-collection-event-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
      <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:520px; max-width:90vw;">
        <h3 style="margin-bottom:1rem;">Додати збірник до події</h3>
        <div class="form-group">
          <input type="text" id="ev-col-search" placeholder="Пошук збірника..." style="width:100%;">
        </div>
        <div id="ev-col-results" style="max-height:300px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:1rem; min-height:48px;"></div>

        <div id="ev-col-importance-row" style="display:none; margin-bottom:1rem;">
          <label style="display:block; margin-bottom:0.5rem; font-weight:600;">Важливість</label>
          <select id="ev-col-importance-select" style="width:100%; padding:0.5rem; border:1px solid var(--border-color); border-radius:6px;">
            <option value="main">Основний</option>
            <option value="tie-in">Тай-ін</option>
            <option value="prologue">Пролог</option>
            <option value="epilogue">Епілог</option>
          </select>
        </div>

        <div id="ev-col-confirm-row" style="display:none; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <span id="ev-col-selected-label" style="color:var(--text-secondary); font-size:0.9rem;"></span>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-secondary" onclick="cancelCollectionSelection()">Змінити</button>
            <button class="btn btn-primary" onclick="confirmAddCollectionToEvent()">Додати</button>
          </div>
        </div>

        <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeAddCollectionEventModal()">Скасувати</button>
        </div>
      </div>
    </div>
  `;

  updateTabStyles();
}

// ===== ТАБИ =====

window.switchTab = (tab) => {
  currentTab = tab;
  document.getElementById('tab-content-issues').style.display = tab === 'issues' ? 'block' : 'none';
  document.getElementById('tab-content-collections').style.display = tab === 'collections' ? 'block' : 'none';
  updateTabStyles();
};

function updateTabStyles() {
  ['issues', 'collections'].forEach(tab => {
    const btn = document.getElementById(`tab-${tab}`);
    if (!btn) return;
    if (tab === currentTab) {
      btn.style.borderBottomColor = 'var(--accent)';
      btn.style.color = 'var(--accent)';
    } else {
      btn.style.borderBottomColor = 'transparent';
      btn.style.color = 'var(--text-secondary)';
    }
  });
}

// ===== РЕНДЕР ТАБЛИЦЬ =====

function importanceBadge(importance) {
  const label = IMPORTANCE_LABELS[importance] || importance;
  const bg    = IMPORTANCE_COLORS[importance] || '#f1f5f9';
  const color = IMPORTANCE_TEXT_COLORS[importance] || '#334155';
  return `<span style="display:inline-block; padding:0.15rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600; background:${bg}; color:${color};">${label}</span>`;
}

function renderIssuesTable(issues, eventId) {
  if (!issues.length) {
    return '<p style="text-align:center; color:var(--text-secondary); padding:2rem;">Немає випусків. Додайте перший.</p>';
  }
  return `
    <div class="table">
      <table>
        <thead>
          <tr>
            <th style="width:60px;">#</th>
            <th>Обкладинка</th>
            <th>Важливість</th>
            <th>#</th>
            <th>Назва</th>
            <th>Том</th>
            <th>Дата</th>
            <th>Дії</th>
          </tr>
        </thead>
        <tbody>
          ${issues.map((issue, idx) => `
            <tr onclick="navigate('issue-detail', {id:${issue.id}})" style="cursor:pointer;">
              <td onclick="event.stopPropagation()" style="text-align:center;">
                <input type="number" min="1" max="${issues.length}" value="${idx + 1}"
                  style="width:48px; padding:0.2rem 0.3rem; border:1px solid var(--border-color); border-radius:4px; text-align:center; font-size:0.85rem;"
                  onchange="reorderEventItem(${eventId}, ${issue.link_id}, this.value, ${issues.length}, this)"
                  onclick="event.stopPropagation()">
              </td>
              <td>
                ${issue.cv_img
                  ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}" style="width:40px; height:60px; object-fit:cover; border-radius:3px;">`
                  : '📖'}
              </td>
              <td onclick="event.stopPropagation()">
                <select onchange="updateEventItemImportance(${eventId}, ${issue.link_id}, this.value)"
                  style="padding:0.25rem 0.5rem; border:1px solid var(--border-color); border-radius:4px; font-size:0.8rem; background:var(--bg-secondary);">
                  ${Object.entries(IMPORTANCE_LABELS).map(([val, label]) =>
                    `<option value="${val}" ${issue.importance === val ? 'selected' : ''}>${label}</option>`
                  ).join('')}
                </select>
              </td>
              <td><strong>#${issue.issue_number || '?'}</strong></td>
              <td>${issue.name || 'Без назви'}</td>
              <td style="color:var(--text-secondary); font-size:0.85rem;">${issue.volume_name || '—'}</td>
              <td style="color:var(--text-secondary); font-size:0.85rem;">${formatDate(issue.release_date)}</td>
              <td onclick="event.stopPropagation()">
                <button class="btn btn-danger btn-small" onclick="removeEventItem(${eventId}, ${issue.link_id})" title="Видалити">✕</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCollectionsTable(collections, eventId) {
  if (!collections.length) {
    return '<p style="text-align:center; color:var(--text-secondary); padding:2rem;">Немає збірників. Додайте перший.</p>';
  }
  return `
    <div class="table">
      <table>
        <thead>
          <tr>
            <th style="width:60px;">#</th>
            <th>Обкладинка</th>
            <th>Важливість</th>
            <th>Назва</th>
            <th>Дії</th>
          </tr>
        </thead>
        <tbody>
          ${collections.map((col, idx) => `
            <tr onclick="navigate('collection-detail', {id:${col.id}})" style="cursor:pointer;">
              <td onclick="event.stopPropagation()" style="text-align:center;">
                <input type="number" min="1" max="${collections.length}" value="${idx + 1}"
                  style="width:48px; padding:0.2rem 0.3rem; border:1px solid var(--border-color); border-radius:4px; text-align:center; font-size:0.85rem;"
                  onchange="reorderEventItem(${eventId}, ${col.link_id}, this.value, ${collections.length}, this)"
                  onclick="event.stopPropagation()">
              </td>
              <td>
                ${col.cv_img
                  ? `<img src="${col.cv_img.startsWith('http') ? col.cv_img : cv_img_path_small + (col.cv_img.startsWith('/') ? '' : '/') + col.cv_img}" style="width:40px; height:60px; object-fit:cover; border-radius:3px;">`
                  : '📗'}
              </td>
              <td onclick="event.stopPropagation()">
                <select onchange="updateEventItemImportance(${eventId}, ${col.link_id}, this.value)"
                  style="padding:0.25rem 0.5rem; border:1px solid var(--border-color); border-radius:4px; font-size:0.8rem; background:var(--bg-secondary);">
                  ${Object.entries(IMPORTANCE_LABELS).map(([val, label]) =>
                    `<option value="${val}" ${col.importance === val ? 'selected' : ''}>${label}</option>`
                  ).join('')}
                </select>
              </td>
              <td>${col.name}</td>
              <td onclick="event.stopPropagation()">
                <button class="btn btn-danger btn-small" onclick="removeEventItem(${eventId}, ${col.link_id})" title="Видалити">✕</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ===== РЕДАГУВАННЯ ПОДІЇ =====

window.editEvent = async (id) => {
  const event = await fetch(`${API_BASE}/events/${id}`).then(r => r.json());
  const formHTML = `
    <form id="edit-form">
      <div class="form-group">
        <label>Назва *</label>
        <input type="text" name="name" value="${event.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Опис</label>
        <textarea name="description" rows="3">${event.description || ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Рік початку</label>
          <input type="number" name="start_year" value="${event.start_year || ''}">
        </div>
        <div class="form-group">
          <label>Рік кінця</label>
          <input type="number" name="end_year" value="${event.end_year || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>URL зображення</label>
        <input type="url" name="cv_img" value="${event.cv_img || ''}">
      </div>
    </form>
  `;
  openModal('Редагувати подію', formHTML, async (data) => {
    await fetch(`${API_BASE}/events/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const updatedEvent = await fetchItem('events', id);
    await renderPage(updatedEvent);
    await window.updateStats();
  });
};

// ===== ПОРЯДОК (ПОЗИЦІЯ) =====

window.reorderEventItem = async (eventId, linkId, newValue, total, inputEl) => {
  const pos = parseInt(newValue);
  if (isNaN(pos) || pos < 1 || pos > total) {
    inputEl.value = inputEl.defaultValue;
    return;
  }
  try {
    await fetch(`${API_BASE}/events/${eventId}/items/${linkId}/reorder`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: pos })
    });
    const ev = await fetchItem('events', eventId);
    await renderPage(ev);
  } catch (e) {
    console.error(e);
  }
};

window.updateEventItemImportance = async (eventId, linkId, importance) => {
  await fetch(`${API_BASE}/events/${eventId}/items/${linkId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ importance })
  });
};

window.removeEventItem = async (eventId, linkId) => {
  if (!confirm('Видалити зі списку події?')) return;
  await fetch(`${API_BASE}/events/${eventId}/items/${linkId}`, { method: 'DELETE' });
  const event = await fetchItem('events', eventId);
  await renderPage(event);
};

// ===== ДОДАВАННЯ ВИПУСКУ (через уніфікований компонент) =====

window.openAddIssueToEventModal = (eventId) => {
  openAddIssueModal({
    title: 'Додати випуск до події',
    alreadyIds: currentEventIssueIds,
    showImportance: true,
    apiBase: API_BASE,
    cvImgPathSmall: cv_img_path_small,
    onAdd: async (issueId, importance) => {
      const res = await fetch(`${API_BASE}/events/${eventId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId, importance }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Помилка додавання');
        return;
      }
      const event = await fetchItem('events', eventId);
      await renderPage(event);
    },
  });
};

// ===== ДОДАВАННЯ ЗБІРНИКА =====

let evSelectedCollectionId = null;
let evColAddEventId = null;
let evColSearchTimeout = null;

window.openAddCollectionToEventModal = (eventId) => {
  evColAddEventId = eventId;
  evSelectedCollectionId = null;
  document.getElementById('add-collection-event-modal').style.display = 'flex';
  document.getElementById('ev-col-importance-row').style.display = 'none';
  document.getElementById('ev-col-confirm-row').style.display = 'none';
  document.getElementById('ev-col-results').innerHTML = '';

  const input = document.getElementById('ev-col-search');
  input.value = '';
  input.oninput = (e) => {
    clearTimeout(evColSearchTimeout);
    evColSearchTimeout = setTimeout(() => searchCollectionsForEvent(e.target.value), 300);
  };

  const overlay = document.getElementById('add-collection-event-modal');
  overlay.onclick = (e) => { if (e.target === overlay) closeAddCollectionEventModal(); };

  input.focus();
};

window.closeAddCollectionEventModal = () => {
  document.getElementById('add-collection-event-modal').style.display = 'none';
  evSelectedCollectionId = null;
  evColAddEventId = null;
};

async function searchCollectionsForEvent(query) {
  if (!query.trim()) { document.getElementById('ev-col-results').innerHTML = ''; return; }
  const res = await fetch(`${API_BASE}/collections/search?search=${encodeURIComponent(query)}&limit=20`);
  const result = await res.json();
  const el = document.getElementById('ev-col-results');
  if (!result.data?.length) {
    el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>';
    return;
  }
  el.innerHTML = result.data.map(col => `
    <div onclick="selectCollectionForEvent(${col.id}, '${(col.name || '').replace(/'/g, "\\'")}')"
         style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
         onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
      ${col.cv_img
        ? `<img src="${col.cv_img.startsWith('http') ? col.cv_img : cv_img_path_small + (col.cv_img.startsWith('/') ? '' : '/') + col.cv_img}" style="width:36px; height:54px; object-fit:cover; border-radius:3px; flex-shrink:0;">`
        : '<div style="width:36px; height:54px; background:var(--bg-secondary); border-radius:3px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">📗</div>'}
      <div>
        <div style="font-weight:500;">${col.name || 'Без назви'}</div>
        <div style="font-size:0.8rem; color:var(--text-secondary);">${col.volume_name || ''}</div>
      </div>
    </div>
  `).join('');
}

window.selectCollectionForEvent = (colId, colName) => {
  evSelectedCollectionId = colId;
  document.getElementById('ev-col-results').innerHTML = '';
  document.getElementById('ev-col-search').value = '';
  document.getElementById('ev-col-selected-label').textContent = `Обрано: ${colName}`;
  document.getElementById('ev-col-importance-row').style.display = 'block';
  document.getElementById('ev-col-confirm-row').style.display = 'flex';
};

window.cancelCollectionSelection = () => {
  evSelectedCollectionId = null;
  document.getElementById('ev-col-importance-row').style.display = 'none';
  document.getElementById('ev-col-confirm-row').style.display = 'none';
  document.getElementById('ev-col-results').innerHTML = '';
};

window.confirmAddCollectionToEvent = async () => {
  if (!evSelectedCollectionId) return;
  const importance = document.getElementById('ev-col-importance-select').value;
  const res = await fetch(`${API_BASE}/events/${evColAddEventId}/collections`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection_id: evSelectedCollectionId, importance })
  });
  if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
  window.closeAddCollectionEventModal();
  const event = await fetchItem('events', evColAddEventId);
  await renderPage(event);
};