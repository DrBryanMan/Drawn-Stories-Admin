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

    /* Тип (type) */
    .edit-chip-type {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
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

    /* Стилі чіпів у filter-panel */
    .filter-chip--theme {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.2rem 0.5rem 0.2rem 0.65rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
      background: #ede9fe;
      color: #5b21b6;
      border: 1px solid #ddd6fe;
    }
    .filter-chip--theme-genre {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.2rem 0.5rem 0.2rem 0.65rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .filter-chip--theme-type {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.2rem 0.5rem 0.2rem 0.65rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }

    /* Заголовок групи в дропдауні */
    .filter-dropdown__group-header {
      padding: 0.3rem 0.75rem 0.1rem;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary, #6b7280);
      background: var(--bg-secondary, #f9fafb);
      border-bottom: 1px solid var(--border-color, #e5e7eb);
      border-top: 1px solid var(--border-color, #e5e7eb);
    }
    .filter-dropdown__group-header:first-child {
      border-top: none;
    }
  `;
  document.head.appendChild(style);
}

// ── Хелпер: клас чіпа по типу ─────────────────────────────────────────────

function chipClassByType(type) {
  if (type === 'genre') return 'edit-chip-genre';
  if (type === 'type')  return 'edit-chip-type';
  return 'edit-chip-theme';
}

// ── Рендер чіпів для перегляду (без кнопок видалення) ───────────────────────

/**
 * @param {Array} allThemes — [{id, ua_name, type}]
 */
export function buildThemeChipsViewHTML(allThemes) {
  if (!allThemes?.length) return '';

  const types   = allThemes.filter(t => t.type === 'type');
  const genres  = allThemes.filter(t => t.type === 'genre');
  const themes  = allThemes.filter(t => t.type === 'theme');

  const renderChip = (t) => `
    <span class="edit-chip ${chipClassByType(t.type)}" data-id="${t.id}">
      ${t.ua_name || t.name}
    </span>
  `;

  const parts = [];
  if (types.length) {
    parts.push(`<span class="theme-chip-group-label" style="margin-left:0.25rem; width: 100%;">Типи:</span>`);
    parts.push(types.map(renderChip).join(''));
  }
  if (genres.length) {
    parts.push(`<span class="theme-chip-group-label" style="margin-left:0.25rem; width: 100%;">Жанри:</span>`);
    parts.push(genres.map(renderChip).join(''));
  }
  if (themes.length) {
    if (types.length || genres.length) parts.push(`<span class="theme-chip-group-label" style="margin-left:0.25rem; width: 100%;">Теми:</span>`);
    parts.push(themes.map(renderChip).join(''));
  }
  return parts.join('');
}

// ── Рендер чіпів з кнопками видалення ────────────────────────────────────────

/**
 * @param {Array} allThemes — масив обраних тем [{id, name|ua_name, type}]
 * @param {string} removeFnName — ім'я глобальної функції видалення (для onclick)
 */
export function buildThemeChipsHTML(allThemes, removeFnName) {
  const types   = allThemes.filter(t => t.type === 'type');
  const genres  = allThemes.filter(t => t.type === 'genre');
  const themes  = allThemes.filter(t => t.type === 'theme' || !t.type);

  const makeChips = (arr) => arr.map(t => `
    <span class="edit-chip ${chipClassByType(t.type)}" data-id="${t.id}">
      ${t.ua_name || t.name}
      <button type="button" onclick="${removeFnName}(${t.id})" title="Видалити">×</button>
    </span>
  `).join('');

  const parts = [];
  if (types.length) {
    parts.push(`<span class="theme-chip-group-label" style="width: 100%;">Типи:</span>${makeChips(types)}`);
  }
  if (genres.length) {
    parts.push(`<span class="theme-chip-group-label" style="${types.length ? 'margin-left:0.25rem;' : ''} width: 100%;">Жанри:</span>${makeChips(genres)}`);
  }
  if (themes.length) {
    const hasLabel = types.length || genres.length;
    parts.push(`${hasLabel ? '<span class="theme-chip-group-label" style="margin-left:0.25rem; width: 100%;">Теми:</span>' : ''}${makeChips(themes)}`);
  }
  return parts.join('');
}

// ── Рендер списку чекбоксів з групуванням ─────────────────────────────────────

/**
 * @param {Array} allThemes — [{id, name, ua_name, type}]
 * @param {Set<number>} selectedIds
 * @param {string} onChangeFn — ім'я глобальної функції для onchange
 */
export function buildThemeCheckboxListHTML(allThemes, selectedIds, onChangeFn) {
  const types   = allThemes.filter(t => t.type === 'type');
  const genres  = allThemes.filter(t => t.type === 'genre');
  const themes  = allThemes.filter(t => t.type === 'theme' || !t.type);

  const renderItem = (t) => {
    const label = t.ua_name || t.name;
    return `
      <label class="theme-checkbox-item"
        onmouseenter="this.style.background='var(--bg-secondary)'"
        onmouseleave="this.style.background=''">
        <input type="checkbox" value="${t.id}"
               data-type="${t.type || 'theme'}"
               ${selectedIds.has(t.id) ? 'checked' : ''}
               onchange="${onChangeFn}()">
        <span>${label}</span>
      </label>
    `;
  };

  const parts = [];
  if (types.length) {
    parts.push(`<div class="theme-group-header">📂 Типи</div>`);
    parts.push(types.map(renderItem).join(''));
  }
  if (genres.length) {
    parts.push(`<div class="theme-group-header">🎭 Жанри</div>`);
    parts.push(genres.map(renderItem).join(''));
  }
  if (themes.length) {
    parts.push(`<div class="theme-group-header">🏷️ Теми</div>`);
    parts.push(themes.map(renderItem).join(''));
  }
  return parts.join('');
}

// ── Фільтрація видимих чекбоксів по пошуку ────────────────────────────────────

export function filterThemeCheckboxList(query, listId) {
  const q = query.toLowerCase();
  const list = document.getElementById(listId);
  if (!list) return;
  list.querySelectorAll('.theme-checkbox-item').forEach(item => {
    const text = item.querySelector('span')?.textContent?.toLowerCase() || '';
    item.style.display = text.includes(q) ? '' : 'none';
  });
  // Ховаємо порожні заголовки груп
  list.querySelectorAll('.theme-group-header').forEach(header => {
    let next = header.nextElementSibling;
    let hasVisible = false;
    while (next && !next.classList.contains('theme-group-header')) {
      if (next.style.display !== 'none') { hasVisible = true; break; }
      next = next.nextElementSibling;
    }
    header.style.display = hasVisible ? '' : 'none';
  });
}