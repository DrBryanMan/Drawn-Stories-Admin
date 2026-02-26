// public/js/utils/themeChips.js
// Утиліти для рендеру чіпів тем з розподілом за типом (жанр / тема)

// ── CSS стилі (додаються один раз) ───────────────────────────────────────────

if (!document.getElementById('theme-chips-style')) {
  const style = document.createElement('style');
  style.id = 'theme-chips-style';
  style.textContent = `
    /* Базовий чіп */
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

    /* Видавець */
    .edit-chip-publisher {
      background: #dbeafe;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }

    /* Тема (звичайна) */
    .edit-chip-theme {
      background: #ede9fe;
      color: #5b21b6;
      border: 1px solid #ddd6fe;
    }

    /* Жанр */
    .edit-chip-genre {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }

    /* Розділювач груп у чіпах */
    .theme-chip-group-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary, #6b7280);
      align-self: center;
      padding: 0 0.25rem;
      white-space: nowrap;
    }

    /* Розділювач груп у списку чекбоксів */
    .theme-group-header {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary, #6b7280);
      padding: 0.5rem 0.5rem 0.2rem;
      background: var(--bg-secondary, #f9fafb);
      border-bottom: 1px solid var(--border-color, #e5e7eb);
      top: 0;
      z-index: 1;
    }

    .theme-group-header:not(:first-child) {
      margin-top: 0.25rem;
      border-top: 1px solid var(--border-color, #e5e7eb);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Рендерить чіпи тем для перегляду (без кнопок видалення).
 * @param {Array} allThemes — [{id, ua_name, type}]
 */
export function buildThemeChipsViewHTML(allThemes) {
  if (!allThemes?.length) return '';

  const genres = allThemes.filter(t => t.type === 'genre');
  const themes = allThemes.filter(t => t.type === 'theme');

  const renderChip = (t) => `
    <span class="edit-chip edit-chip-${t.type === 'genre' ? 'genre' : 'theme'}" data-id="${t.id}">
      ${t.ua_name}
    </span>
  `;

  const parts = [];
  if (genres.length) {
    parts.push(`<span class="theme-chip-group-label" style="margin-left:0.25rem; width: 100%;">Жанри:</span>`);
    parts.push(genres.map(renderChip).join(''));
  }
  if (themes.length) {
    if (genres.length) parts.push(`<span class="theme-chip-group-label" style="margin-left:0.25rem; width: 100%;">Теми:</span>`);
    parts.push(themes.map(renderChip).join(''));
  }
  return parts.join('');
}

// ── Рендер чіпів з групуванням ───────────────────────────────────────────────

/**
 * Рендерить HTML чіпів тем, розділяючи на жанри та теми.
 * @param {Array} allThemes — масив обраних тем [{id, name, type}]
 * @param {Function} onRemove — (themeId) => void
 * @param {string} removeFnName — ім'я глобальної функції видалення (для onclick)
 */
export function buildThemeChipsHTML(allThemes, removeFnName) {
  const genres = allThemes.filter(t => t.type === 'genre');
  const themes = allThemes.filter(t => t.type == 'theme');

  const genreChips = genres.map(t => `
    <span class="edit-chip edit-chip-genre" data-id="${t.id}">
      ${t.ua_name}
      <button type="button" onclick="${removeFnName}(${t.id})" title="Видалити">×</button>
    </span>
  `).join('');

  const themeChips = themes.map(t => `
    <span class="edit-chip edit-chip-theme" data-id="${t.id}">
      ${t.ua_name}
      <button type="button" onclick="${removeFnName}(${t.id})" title="Видалити">×</button>
    </span>
  `).join('');

  const parts = [];
  if (genreChips) {
    parts.push(`<span class="theme-chip-group-label" style="width: 100%;">Жанри:</span>${genreChips}`);
  }
  if (themeChips) {
    if (genreChips) parts.push(`<span class="theme-chip-group-label" style="margin-left:0.25rem; width: 100%;">Теми:</span>`);
    parts.push(themeChips);
  }
  return parts.join('');
}

/**
 * Рендерить список чекбоксів тем, розгрупованих по типу.
 * @param {Array} allThemes — [{id, name, type}]
 * @param {Set<number>} selectedIds
 * @param {string} onChangeFn — ім'я глобальної функції для onchange
 */
export function buildThemeCheckboxListHTML(allThemes, selectedIds, onChangeFn) {
  const genres = allThemes.filter(t => t.type === 'genre');
  const themes = allThemes.filter(t => t.type == 'theme');

  const renderItem = (t) => `
    <label class="theme-checkbox-item"
      onmouseenter="this.style.background='var(--bg-secondary)'"
      onmouseleave="this.style.background=''">
      <input type="checkbox" value="${t.id}"
             data-type="${t.type || 'theme'}"
             ${selectedIds.has(t.id) ? 'checked' : ''}
             onchange="${onChangeFn}()">
      <span>${t.ua_name}</span>
    </label>
  `;

  let html = '';
  if (genres.length) {
    html += `<div class="theme-group-header">Жанри</div>`;
    html += genres.map(renderItem).join('');
  }
  if (themes.length) {
    html += `<div class="theme-group-header">Теми</div>`;
    html += themes.map(renderItem).join('');
  }
  return html;
}

/**
 * Фільтрує список чекбоксів за пошуковим запитом (враховує заголовки груп).
 * @param {string} q — пошуковий рядок
 * @param {string} listContainerId — ID контейнера зі списком
 */
export function filterThemeCheckboxList(q, listContainerId) {
  const lower = q.toLowerCase();
  const container = document.getElementById(listContainerId);
  if (!container) return;

  let lastHeader = null;
  let visibleInGroup = 0;

  container.querySelectorAll('.theme-group-header, .theme-checkbox-item').forEach(el => {
    if (el.classList.contains('theme-group-header')) {
      // Сховати попередній заголовок якщо в групі нічого не видно
      if (lastHeader && visibleInGroup === 0) lastHeader.style.display = 'none';
      lastHeader = el;
      visibleInGroup = 0;
      el.style.display = ''; // тимчасово показуємо
    } else {
      const name = el.querySelector('span')?.textContent?.toLowerCase() || '';
      const visible = name.includes(lower);
      el.style.display = visible ? '' : 'none';
      if (visible) visibleInGroup++;
    }
  });
  // Перевірити останній заголовок
  if (lastHeader && visibleInGroup === 0) lastHeader.style.display = 'none';
}