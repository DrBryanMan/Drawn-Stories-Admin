import { API_BASE } from '../utils/config.js';

// ── Закріплені видавництва (ID з бази) ────────────────────────────────────
export const PINNED_PUBLISHER_IDS = [
  11,  // Marvel
  4,   // DC
  199, // Image
  332, // IDW
  361, // Dynamite Entertainment
  182, // Disney
];

// ── Генерація HTML пошуку видавництва ──────────────────────────────────────
export function publisherSearchHTML({ publisherId, publisherName, inputId, hiddenId, resultsId, chipId }) {
  return `
    <div class="form-group">
      <label>Видавництво</label>
      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; margin-bottom:0.35rem;" id="${chipId}">
        ${publisherId ? `
          <span class="chip chip-publisher" data-id="${publisherId}">
            🏢 ${publisherName || 'ID:' + publisherId}
            <button type="button" onclick="clearPublisher('${chipId}','${hiddenId}','${inputId}')" title="Видалити">×</button>
          </span>
        ` : ''}
      </div>
      <input type="hidden" id="${hiddenId}" value="${publisherId || ''}">
      <input type="text" id="${inputId}" placeholder="Пошук видавництва..."
             style="width:100%; margin-bottom:0.35rem;"
             autocomplete="off">
      <div id="${resultsId}" class="publisher-inline-list">
        <div class="publisher-list-loading" style="padding:0.6rem 0.75rem; color:var(--text-muted); font-size:0.8rem;">
          Завантаження...
        </div>
      </div>
    </div>
  `;
}

/**
 * Ініціалізує логіку пошуку видавництва після вставки HTML в DOM.
 * Тепер показує inline-список (як теми): закріплені вгорі + пошук.
 */
export function initPublisherSearch({ inputId, hiddenId, resultsId, chipId }) {
  const input   = document.getElementById(inputId);
  const listEl  = document.getElementById(resultsId);
  if (!input || !listEl) return;

  let pinnedPublishers = [];
  let timeout = null;

  // Завантажуємо закріплені видавництва (якщо є)
  async function loadPinned() {
    if (!PINNED_PUBLISHER_IDS.length) {
      listEl.innerHTML = '';
      return;
    }
    try {
      const res  = await fetch(`${API_BASE}/publishers?ids=${PINNED_PUBLISHER_IDS.join(',')}&limit=50`);
      const data = await res.json();
      pinnedPublishers = data.data || [];
    } catch (_) {
      pinnedPublishers = [];
    }
    renderList('');
  }

  function renderList(query) {
    const q = query.toLowerCase().trim();

    if (!q) {
      // Без пошуку — показуємо тільки закріплені
      if (!pinnedPublishers.length) {
        listEl.innerHTML = `<div class="publisher-list-empty">Почніть вводити назву для пошуку</div>`;
        return;
      }
      listEl.innerHTML = `
        <div class="publisher-group-header">📌 Закріплені</div>
        ${pinnedPublishers.map(p => publisherListItemHTML(p, chipId, hiddenId, inputId, resultsId)).join('')}
      `;
      return;
    }

    // Під час пошуку — запит на сервер
    listEl.innerHTML = `<div class="publisher-list-loading">Пошук...</div>`;
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      try {
        const res  = await fetch(`${API_BASE}/publishers?search=${encodeURIComponent(q)}&limit=20`);
        const data = await res.json();
        const pubs = data.data || [];

        if (!pubs.length) {
          listEl.innerHTML = `<div class="publisher-list-empty">Нічого не знайдено</div>`;
          return;
        }

        // Відокремлюємо закріплені від решти
        const pinnedIds = new Set(PINNED_PUBLISHER_IDS);
        const pinnedInResults = pubs.filter(p => pinnedIds.has(p.id));
        const rest            = pubs.filter(p => !pinnedIds.has(p.id));

        let html = '';
        if (pinnedInResults.length) {
          html += `<div class="publisher-group-header">📌 Закріплені</div>`;
          html += pinnedInResults.map(p => publisherListItemHTML(p, chipId, hiddenId, inputId, resultsId)).join('');
        }
        if (rest.length) {
          if (pinnedInResults.length) html += `<div class="publisher-group-header">🔍 Результати</div>`;
          html += rest.map(p => publisherListItemHTML(p, chipId, hiddenId, inputId, resultsId)).join('');
        }
        listEl.innerHTML = html;
      } catch (_) {
        listEl.innerHTML = `<div class="publisher-list-empty">Помилка пошуку</div>`;
      }
    }, 250);
  }

  input.addEventListener('input', () => renderList(input.value));
  loadPinned();
}

function publisherListItemHTML(p, chipId, hiddenId, inputId, resultsId) {
  return `
    <div class="publisher-list-item"
         onclick="selectPublisher('${chipId}','${hiddenId}','${inputId}','${resultsId}',${p.id},'${p.name.replace(/'/g, "\\'")}')"
         onmouseenter="this.classList.add('publisher-list-item--hover')"
         onmouseleave="this.classList.remove('publisher-list-item--hover')">
      🏢 ${p.name}
      <span style="color:var(--text-muted); font-size:0.75rem; margin-left:auto;">#${p.id}</span>
    </div>
  `;
}

// ── Глобальні функції для onclick в HTML ──────────────────────────────────

window.selectPublisher = (chipId, hiddenId, inputId, resultsId, pubId, pubName) => {
  const chip = document.getElementById(chipId);
  if (chip) {
    chip.innerHTML = `
      <span class="chip chip-publisher" data-id="${pubId}">
        🏢 ${pubName}
        <button type="button" onclick="clearPublisher('${chipId}','${hiddenId}','${inputId}')" title="Видалити">×</button>
      </span>
    `;
  }
  const hidden = document.getElementById(hiddenId);
  if (hidden) hidden.value = pubId;
  const input  = document.getElementById(inputId);
  if (input)  input.value = '';

  // Оновлюємо список (знову показуємо закріплені)
  const listEl = document.getElementById(resultsId);
  if (listEl) {
    // Тригеримо повторний рендер з порожнім запитом
    input?.dispatchEvent(new Event('input'));
  }
};

window.clearPublisher = (chipId, hiddenId, inputId) => {
  const chip = document.getElementById(chipId);
  if (chip) chip.innerHTML = '';
  const hidden = document.getElementById(hiddenId);
  if (hidden) hidden.value = '';
  const input  = document.getElementById(inputId);
  if (input)  input.value = '';
};

// ── Хелпер для рендеру чіпів тем ─────────────────────────────────────────

export function renderThemeChips(selectedIds, allThemes, chipsContainerId) {
  const container = document.getElementById(chipsContainerId);
  if (!container) return;
  const selected = allThemes.filter(t => selectedIds.has(t.id));
  container.innerHTML = selected.map(t => `
    <span class="chip chip-theme" data-id="${t.id}">
      ${t.name}
      <button type="button" onclick="removeThemeChip(${t.id}, '${chipsContainerId}')" title="Видалити">×</button>
    </span>
  `).join('');
}

window.removeThemeChip = (themeId, chipsContainerId) => {
  const cb = document.querySelector(`input[type="checkbox"][value="${themeId}"]`);
  if (cb) {
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
  }
  const chip = document.querySelector(`#${chipsContainerId} [data-id="${themeId}"]`);
  if (chip) chip.remove();
};