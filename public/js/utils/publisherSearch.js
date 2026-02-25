// public/js/utils/publisherSearch.js
// Спільний хелпер для пошуку видавництва та відображення чіпів теми/видавництва

const API_BASE = 'http://localhost:7000/api';

// ── Генерація HTML пошуку видавництва ──────────────────────────────────────

/**
 * Повертає HTML-блок пошуку видавництва.
 * publisherId   — поточний publisher (id або null)
 * publisherName — поточна назва (рядок або null)
 * inputId       — ID для input (напр. "vol-pub-input")
 * hiddenId      — ID для прихованого input зі значенням (напр. "vol-pub-id")
 * resultsId     — ID для div результатів (напр. "vol-pub-results")
 * chipId        — ID для div чіпа (напр. "vol-pub-chip")
 */
export function publisherSearchHTML({ publisherId, publisherName, inputId, hiddenId, resultsId, chipId }) {
  return `
    <div class="form-group" style="position:relative;">
      <label>Видавництво</label>
      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; margin-bottom:0.35rem;" id="${chipId}">
        ${publisherId ? `
          <span class="edit-chip edit-chip-publisher" data-id="${publisherId}">
            🏢 ${publisherName || 'ID:' + publisherId}
            <button type="button" onclick="clearPublisher('${chipId}','${hiddenId}','${inputId}')" title="Видалити">×</button>
          </span>
        ` : ''}
      </div>
      <input type="hidden" id="${hiddenId}" value="${publisherId || ''}">
      <input type="text" id="${inputId}" placeholder="Шукати видавництво..."
             value=""
             style="width:100%;"
             autocomplete="off">
      <div id="${resultsId}"
           style="display:none; position:absolute; left:0; right:0; z-index:200; background:var(--bg-primary);
                  border:1px solid var(--border-color); border-radius:6px; max-height:200px; overflow-y:auto;
                  box-shadow:var(--shadow-lg); margin-top:2px;">
      </div>
    </div>
  `;
}

/**
 * Ініціалізує логіку пошуку видавництва після вставки HTML в DOM.
 */
export function initPublisherSearch({ inputId, hiddenId, resultsId, chipId }) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;

  let timeout = null;

  input.addEventListener('input', () => {
    clearTimeout(timeout);
    const q = input.value.trim();
    if (!q) { results.style.display = 'none'; return; }
    timeout = setTimeout(async () => {
      const res = await fetch(`${API_BASE}/publishers?search=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json();
      if (!data.data?.length) {
        results.innerHTML = '<div style="padding:0.75rem; color:var(--text-secondary); font-size:0.875rem;">Нічого не знайдено</div>';
        results.style.display = 'block';
        return;
      }
      results.innerHTML = data.data.map(p => `
        <div onclick="selectPublisher('${chipId}','${hiddenId}','${inputId}','${resultsId}', ${p.id}, '${p.name.replace(/'/g, "\\'")}')"
             style="padding:0.5rem 0.75rem; cursor:pointer; font-size:0.875rem; border-bottom:1px solid var(--border-color);"
             onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
          🏢 ${p.name} <span style="color:var(--text-secondary); font-size:0.75rem;">(ID: ${p.id})</span>
        </div>
      `).join('');
      results.style.display = 'block';
    }, 250);
  });

  // Закрити dropdown при кліку поза
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.style.display = 'none';
    }
  });
}

// ── Глобальні функції для onclick в HTML ──────────────────────────────────

window.selectPublisher = (chipId, hiddenId, inputId, resultsId, pubId, pubName) => {
  // Встановлюємо чіп
  const chip = document.getElementById(chipId);
  if (chip) {
    chip.innerHTML = `
      <span class="edit-chip edit-chip-publisher" data-id="${pubId}">
        🏢 ${pubName}
        <button type="button" onclick="clearPublisher('${chipId}','${hiddenId}','${inputId}')" title="Видалити">×</button>
      </span>
    `;
  }
  // Встановлюємо прихований input
  const hidden = document.getElementById(hiddenId);
  if (hidden) hidden.value = pubId;
  // Очищаємо пошук
  const input = document.getElementById(inputId);
  if (input) input.value = '';
  const results = document.getElementById(resultsId);
  if (results) results.style.display = 'none';
};

window.clearPublisher = (chipId, hiddenId, inputId) => {
  const chip = document.getElementById(chipId);
  if (chip) chip.innerHTML = '';
  const hidden = document.getElementById(hiddenId);
  if (hidden) hidden.value = '';
  const input = document.getElementById(inputId);
  if (input) input.value = '';
};

// ── Хелпер для рендеру чіпів тем ─────────────────────────────────────────

/**
 * Оновлює список чіпів тем.
 * selectedIds — Set<number> обраних тем
 * allThemes   — масив усіх тем [{id, name}]
 * chipsContainerId — ID контейнера для чіпів
 * checkboxContainerId — ID контейнера з чекбоксами
 */
export function renderThemeChips(selectedIds, allThemes, chipsContainerId) {
  const container = document.getElementById(chipsContainerId);
  if (!container) return;
  const selected = allThemes.filter(t => selectedIds.has(t.id));
  container.innerHTML = selected.map(t => `
    <span class="edit-chip edit-chip-theme" data-id="${t.id}">
      ${t.name}
      <button type="button" onclick="removeThemeChip(${t.id}, '${chipsContainerId}')" title="Видалити">×</button>
    </span>
  `).join('');
}

window.removeThemeChip = (themeId, chipsContainerId) => {
  // Знімаємо чекбокс
  const cb = document.querySelector(`input[type="checkbox"][value="${themeId}"]`);
  if (cb) {
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
  }
  // Видаляємо чіп
  const chip = document.querySelector(`#${chipsContainerId} [data-id="${themeId}"]`);
  if (chip) chip.remove();
};

// ── CSS-стилі для чіпів (додаються один раз) ─────────────────────────────

if (!document.getElementById('edit-chips-style')) {
  const style = document.createElement('style');
  style.id = 'edit-chips-style';
  style.textContent = `
    .edit-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.5rem 0.2rem 0.6rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .edit-chip button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      font-size: 1rem;
      opacity: 0.6;
    }
    .edit-chip button:hover { opacity: 1; }
    .edit-chip-publisher {
      background: #dbeafe;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .edit-chip-theme {
      background: #ede9fe;
      color: #5b21b6;
      border: 1px solid #ddd6fe;
    }
  `;
  document.head.appendChild(style);
}