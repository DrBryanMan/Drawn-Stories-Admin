// eventDetail.js — public/js/views/eventDetail.js

import { fetchItem } from '../api/api.js';
import { cv_img_path_small, formatDate, showError, showLoading, cleanupCatalogUI } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { openModal } from '../components/modal.js';

const API_BASE = 'http://localhost:7000/api';

const IMPORTANCE_LABELS = {
  'main':     'Основний',
  'tie-in':   'Тай-ін',
  'prologue':  'Пролог',
  'epilogue':  'Епілог',
};

const IMPORTANCE_COLORS = {
  'main':    '#dbeafe',
  'tie-in':  '#fef9c3',
  'prologue':'#dcfce7',
  'epilogue':'#f3e8ff',
};

const IMPORTANCE_TEXT_COLORS = {
  'main':    '#1d4ed8',
  'tie-in':  '#854d0e',
  'prologue':'#166534',
  'epilogue':'#6b21a8',
};

let currentEventId = null;
let currentTab = 'issues'; // 'issues' | 'collections'

export async function renderEventDetail(params) {
  const id = params.id;
  if (!id) { navigate('events'); return; }
  currentEventId = id;

  cleanupCatalogUI();
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

  document.getElementById('page-title').innerHTML = `
    <a href="#" onclick="event.preventDefault(); navigateBack()" style="color:var(--text-secondary); text-decoration:none;">
      ← Події
    </a> / ${event.name}
  `;

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

      <!-- Таби -->
      <div style="background:var(--bg-primary); border-radius:8px; border:1px solid var(--border-color);">
        <div style="display:flex; border-bottom:1px solid var(--border-color);">
          <button id="tab-issues" onclick="switchTab('issues')"
            style="padding:0.875rem 1.5rem; border:none; background:none; cursor:pointer; font-weight:600;
                   border-bottom:2px solid transparent; transition:all 0.2s; color:var(--text-secondary);"
            class="event-tab ${currentTab === 'issues' ? 'active' : ''}">
            📖 Випуски (${issues.length})
          </button>
          <button id="tab-collections" onclick="switchTab('collections')"
            style="padding:0.875rem 1.5rem; border:none; background:none; cursor:pointer; font-weight:600;
                   border-bottom:2px solid transparent; transition:all 0.2s; color:var(--text-secondary);"
            class="event-tab ${currentTab === 'collections' ? 'active' : ''}">
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

    <!-- Модалка: Додати випуск -->
    <div id="add-issue-event-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
      <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:580px; max-width:90vw;">
        <h3 style="margin-bottom:1rem;">Додати випуск до події</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.8rem; display:block; margin-bottom:0.25rem;">Назва випуску</label>
            <input type="text" id="ev-search-name" placeholder="Назва..." style="width:100%;">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.8rem; display:block; margin-bottom:0.25rem;">Назва тому</label>
            <input type="text" id="ev-search-volume" placeholder="Том..." style="width:100%;">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.8rem; display:block; margin-bottom:0.25rem;">Номер</label>
            <input type="text" id="ev-search-number" placeholder="#..." style="width:100%;">
          </div>
        </div>
        <div id="ev-issue-results" style="max-height:300px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:1rem; min-height:48px;"></div>

        <!-- Importance (показується після вибору випуску) -->
        <div id="ev-importance-row" style="display:none; margin-bottom:1rem;">
          <label style="display:block; margin-bottom:0.5rem; font-weight:600;">Важливість</label>
          <select id="ev-importance-select" style="width:100%; padding:0.5rem; border:1px solid var(--border-color); border-radius:6px;">
            <option value="main">Основний</option>
            <option value="tie-in">Тай-ін</option>
            <option value="prologue">Пролог</option>
            <option value="epilogue">Епілог</option>
          </select>
        </div>

        <div id="ev-confirm-row" style="display:none; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <span id="ev-selected-label" style="color:var(--text-secondary); font-size:0.9rem;"></span>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-secondary" onclick="cancelIssueSelection()">Змінити</button>
            <button class="btn btn-primary" onclick="confirmAddIssueToEvent()">Додати</button>
          </div>
        </div>

        <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeAddIssueEventModal()">Скасувати</button>
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

    <style>
      .event-tab.active {
        border-bottom-color: var(--primary-color) !important;
        color: var(--primary-color) !important;
      }
      .event-tab:hover { color: var(--primary-color) !important; }
      .importance-badge {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        white-space: nowrap;
      }
    </style>
  `;

  // Підсвітка активного таба
  updateTabStyles();
}

// ===== ТАБИ =====

window.switchTab = (tab) => {
  currentTab = tab;
  document.getElementById('tab-content-issues').style.display      = tab === 'issues'      ? 'block' : 'none';
  document.getElementById('tab-content-collections').style.display = tab === 'collections' ? 'block' : 'none';
  updateTabStyles();
};

function updateTabStyles() {
  ['issues', 'collections'].forEach(tab => {
    const btn = document.getElementById(`tab-${tab}`);
    if (!btn) return;
    if (tab === currentTab) {
      btn.style.borderBottomColor = 'var(--primary-color)';
      btn.style.color = 'var(--primary-color)';
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
  return `<span class="importance-badge" style="background:${bg}; color:${color};">${label}</span>`;
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
            <th></th>
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
              <td onclick="event.stopPropagation()" style="white-space:nowrap;">
                <button class="btn btn-secondary btn-small" onclick="moveEventItem(${eventId}, ${issue.link_id}, 'up')"
                  ${idx === 0 ? 'disabled' : ''} title="Вгору">↑</button>
                <button class="btn btn-secondary btn-small" onclick="moveEventItem(${eventId}, ${issue.link_id}, 'down')"
                  ${idx === issues.length - 1 ? 'disabled' : ''} title="Вниз">↓</button>
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
            <th></th>
            <th>Обкладинка</th>
            <th>Важливість</th>
            <th>Назва</th>
            <th>Дії</th>
          </tr>
        </thead>
        <tbody>
          ${collections.map((col, idx) => `
            <tr onclick="navigate('collection-detail', {id:${col.id}})" style="cursor:pointer;">
              <td onclick="event.stopPropagation()" style="white-space:nowrap;">
                <button class="btn btn-secondary btn-small" onclick="moveEventItem(${eventId}, ${col.link_id}, 'up')"
                  ${idx === 0 ? 'disabled' : ''} title="Вгору">↑</button>
                <button class="btn btn-secondary btn-small" onclick="moveEventItem(${eventId}, ${col.link_id}, 'down')"
                  ${idx === collections.length - 1 ? 'disabled' : ''} title="Вниз">↓</button>
              </td>
              <td>
                ${col.cv_img
                  ? `<img src="${col.cv_img.startsWith('http') ? col.cv_img : cv_img_path_small + col.cv_img}" style="width:40px; height:60px; object-fit:cover; border-radius:3px;">`
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
  const { openModal } = await import('../components/modal.js');
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

// ===== ПЕРЕМІЩЕННЯ ТА IMPORTANCE =====

window.moveEventItem = async (eventId, linkId, direction) => {
  await fetch(`${API_BASE}/events/${eventId}/items/${linkId}/move`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ direction })
  });
  const event = await fetchItem('events', eventId);
  await renderPage(event);
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

// ===== ДОДАВАННЯ ВИПУСКУ =====

let evSelectedIssueId = null;
let evAddEventId = null;
let evIssueSearchTimeout = null;

window.openAddIssueToEventModal = (eventId) => {
  evAddEventId = eventId;
  evSelectedIssueId = null;
  document.getElementById('add-issue-event-modal').style.display = 'flex';
  document.getElementById('ev-importance-row').style.display = 'none';
  document.getElementById('ev-confirm-row').style.display = 'none';
  document.getElementById('ev-issue-results').innerHTML = '';

  ['ev-search-name', 'ev-search-volume', 'ev-search-number'].forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.oninput = () => {
      clearTimeout(evIssueSearchTimeout);
      evIssueSearchTimeout = setTimeout(searchIssuesForEvent, 300);
    };
  });
  document.getElementById('ev-search-name').focus();
};

window.closeAddIssueEventModal = () => {
  document.getElementById('add-issue-event-modal').style.display = 'none';
  evSelectedIssueId = null;
  evAddEventId = null;
};

async function searchIssuesForEvent() {
  const name        = document.getElementById('ev-search-name').value.trim();
  const volumeName  = document.getElementById('ev-search-volume').value.trim();
  const issueNumber = document.getElementById('ev-search-number').value.trim();
  if (!name && !volumeName && !issueNumber) { document.getElementById('ev-issue-results').innerHTML = ''; return; }

  const params = new URLSearchParams({ limit: 20 });
  if (name)        params.set('name', name);
  if (volumeName)  params.set('volume_name', volumeName);
  if (issueNumber) params.set('issue_number', issueNumber);

  const res = await fetch(`${API_BASE}/issues?${params}`);
  const result = await res.json();
  const el = document.getElementById('ev-issue-results');

  if (!result.data?.length) {
    el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>';
    return;
  }

  el.innerHTML = result.data.map(issue => `
    <div onclick="selectIssueForEvent(${issue.id}, '${(issue.name || 'Без назви').replace(/'/g, "\\'")}')"
         style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
         onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
      ${issue.cv_img
        ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}" style="width:36px; height:54px; object-fit:cover; border-radius:3px; flex-shrink:0;">`
        : '<div style="width:36px; height:54px; background:var(--bg-secondary); border-radius:3px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">📖</div>'}
      <div>
        <div style="font-weight:500;">${issue.name || 'Без назви'}</div>
        <div style="font-size:0.8rem; color:var(--text-secondary);">${issue.volume_name || ''}${issue.issue_number ? ' · #' + issue.issue_number : ''}</div>
      </div>
    </div>
  `).join('');
}

window.selectIssueForEvent = (issueId, issueName) => {
  evSelectedIssueId = issueId;
  document.getElementById('ev-issue-results').innerHTML = '';
  ['ev-search-name', 'ev-search-volume', 'ev-search-number'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('ev-selected-label').textContent = `Обрано: ${issueName}`;
  document.getElementById('ev-importance-row').style.display = 'block';
  document.getElementById('ev-confirm-row').style.display = 'flex';
};

window.cancelIssueSelection = () => {
  evSelectedIssueId = null;
  document.getElementById('ev-importance-row').style.display = 'none';
  document.getElementById('ev-confirm-row').style.display = 'none';
  document.getElementById('ev-issue-results').innerHTML = '';
};

window.confirmAddIssueToEvent = async () => {
  if (!evSelectedIssueId) return;
  const importance = document.getElementById('ev-importance-select').value;
  const res = await fetch(`${API_BASE}/events/${evAddEventId}/issues`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue_id: evSelectedIssueId, importance })
  });
  if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
  window.closeAddIssueEventModal();
  const event = await fetchItem('events', evAddEventId);
  await renderPage(event);
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
        ? `<img src="${col.cv_img.startsWith('http') ? col.cv_img : cv_img_path_small + col.cv_img}" style="width:36px; height:54px; object-fit:cover; border-radius:3px; flex-shrink:0;">`
        : '<div style="width:36px; height:54px; background:var(--bg-secondary); border-radius:3px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">📗</div>'}
      <div>
        <div style="font-weight:500;">${col.name}</div>
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

// ===== Навігація =====
window.navigateBack = () => window.history.back();