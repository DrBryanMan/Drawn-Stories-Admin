export const PINNED_THEME_IDS = [
  36, // манґа
  35, // журнал
  71, // репрінт
  72, // публікується
];

// ── Хелпер: клас чіпа по типу ─────────────────────────────────────────────
function chipClassByType(type) {
  if (type === 'genre') return ' chip-genre';
  if (type === 'type')  return ' chip-type';
  return ' chip-theme';
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

  const renderChip = (t) => {
    const label = t.ua_name
        ? t.ua_name.charAt(0).toUpperCase() + t.ua_name.slice(1)
        : t.name;
    return `
    <span class=" chip ${chipClassByType(t.type)}" data-id="${t.id}">
      ${label}
    </span>
  `};

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

  const makeChips = (arr) => arr.map(t => {
    const label = t.ua_name
        ? t.ua_name.charAt(0).toUpperCase() + t.ua_name.slice(1)
        : t.name;
    return `
      <span class=" chip ${chipClassByType(t.type)}" data-id="${t.id}">
        ${label}
        <button type="button" onclick="${removeFnName}(${t.id})" title="Видалити">×</button>
      </span>
  `}).join('');

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
  const pinnedIds = new Set(PINNED_THEME_IDS);
  const pinned  = allThemes.filter(t => pinnedIds.has(t.id));
  const types   = allThemes.filter(t => !pinnedIds.has(t.id) && t.type === 'type');
  const genres  = allThemes.filter(t => !pinnedIds.has(t.id) && t.type === 'genre');
  const themes  = allThemes.filter(t => !pinnedIds.has(t.id) && (t.type === 'theme' || !t.type));

  const renderItem = (t) => {
    const label = t.ua_name
      ? t.ua_name.charAt(0).toUpperCase() + t.ua_name.slice(1)
      : t.name;
    const checked = selectedIds.has(t.id);
    return `
      <label class="theme-checkbox-item${checked ? ' theme-checkbox-item--checked' : ''}">
        <span class="theme-cb-box${checked ? ' theme-cb-box--checked' : ''}">
          <svg class="theme-cb-check" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <input type="checkbox" value="${t.id}"
              data-type="${t.type || 'theme'}"
              data-name="${(t.name || '').toLowerCase()}"
              data-ua-name="${label}"
              ${checked ? 'checked' : ''}
              onchange="${onChangeFn}(); this.closest('.theme-checkbox-item').classList.toggle('theme-checkbox-item--checked', this.checked); this.previousElementSibling.classList.toggle('theme-cb-box--checked', this.checked);">
        <span class="theme-cb-label">${label}</span>
      </label>
    `;
  };

  const parts = [];
  if (pinned.length) {
    parts.push(`<div class="theme-group-header theme-group-header--pinned">⭐ Закріплені</div>`);
    parts.push(pinned.map(renderItem).join(''));
  }
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
    const uaText = item.querySelector('.theme-cb-label')?.textContent?.toLowerCase() || '';
    const enText = item.querySelector('input')?.dataset?.name || '';
    item.style.display = (uaText.includes(q) || enText.includes(q)) ? '' : 'none';
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