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

export function initPublisherSearch({ inputId, hiddenId, resultsId, chipId }) {
  const input  = document.getElementById(inputId);
  const listEl = document.getElementById(resultsId);
  if (!input || !listEl) return;

  let timeout = null;

  // Рендер закріплених без жодного запиту на сервер
  function renderPinned() {
    if (!PINNED_PUBLISHER_IDS.length) {
      listEl.innerHTML = `<div class="publisher-list-empty">Введіть назву для пошуку</div>`;
      return;
    }
    listEl.innerHTML = `
      <div class="publisher-group-header">📌 Рекомендовані</div>
      ${PINNED_PUBLISHER_IDS.map(id => `
        <div class="publisher-list-item publisher-list-item--pinned"
             data-pub-id="${id}"
             onclick="loadAndSelectPublisher('${chipId}','${hiddenId}','${inputId}','${resultsId}', ${id})">
          🏢 <span class="pub-name-placeholder" data-id="${id}">…</span>
        </div>
      `).join('')}
    `;
    // Підвантажуємо назви асинхронно
    loadPinnedNames(chipId, hiddenId, inputId, resultsId);
  }

  function renderSearch(q) {
    listEl.innerHTML = `<div class="publisher-list-loading">Пошук…</div>`;
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
        const pinnedSet = new Set(PINNED_PUBLISHER_IDS);
        const pinned = pubs.filter(p => pinnedSet.has(p.id));
        const rest   = pubs.filter(p => !pinnedSet.has(p.id));
        let html = '';
        if (pinned.length) {
          html += `<div class="publisher-group-header">📌 Рекомендовані</div>`;
          html += pinned.map(p => publisherListItemHTML(p, chipId, hiddenId, inputId, resultsId)).join('');
        }
        if (rest.length) {
          if (pinned.length) html += `<div class="publisher-group-header">🔍 Результати</div>`;
          html += rest.map(p => publisherListItemHTML(p, chipId, hiddenId, inputId, resultsId)).join('');
        }
        listEl.innerHTML = html;
      } catch (_) {
        listEl.innerHTML = `<div class="publisher-list-empty">Помилка пошуку</div>`;
      }
    }, 250);
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) renderPinned();
    else    renderSearch(q);
  });

  renderPinned();
}

// Підвантажує назви для закріплених (запит лише один раз при відкритті)
async function loadPinnedNames(chipId, hiddenId, inputId, resultsId) {
  if (!PINNED_PUBLISHER_IDS.length) return;
  try {
    const res  = await fetch(`${API_BASE}/publishers?ids=${PINNED_PUBLISHER_IDS.join(',')}&limit=50`);
    const data = await res.json();
    (data.data || []).forEach(p => {
      document.querySelectorAll(`.pub-name-placeholder[data-id="${p.id}"]`).forEach(el => {
        el.textContent = p.name;
        // Додаємо onclick з правильною назвою
        el.closest('.publisher-list-item')?.setAttribute(
          'onclick',
          `selectPublisher('${chipId}','${hiddenId}','${inputId}','${resultsId}',${p.id},'${p.name.replace(/'/g, "\\'")}')`
        );
      });
    });
  } catch (_) {}
}

// Для placeholder-кнопки до завантаження назв
window.loadAndSelectPublisher = async (chipId, hiddenId, inputId, resultsId, pubId) => {
  try {
    const res  = await fetch(`${API_BASE}/publishers/${pubId}`);
    const p    = await res.json();
    window.selectPublisher(chipId, hiddenId, inputId, resultsId, p.id, p.name);
  } catch (_) {}
};

function publisherListItemHTML(p, chipId, hiddenId, inputId, resultsId) {
  return `
    <div class="publisher-list-item"
         onclick="selectPublisher('${chipId}','${hiddenId}','${inputId}','${resultsId}',${p.id},'${p.name.replace(/'/g, "\\'")}')"
         onmouseenter="this.classList.add('publisher-list-item--hover')"
         onmouseleave="this.classList.remove('publisher-list-item--hover')">
      🏢 ${p.name}
      <span style="color:var(--text-muted); font-size:0.75rem; margin-left:auto;">id: ${p.id}</span>
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