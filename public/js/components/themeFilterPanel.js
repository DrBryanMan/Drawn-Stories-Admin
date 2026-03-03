// Блок фільтру по темам (мульти-вибір) — монтується в #filters-panel

const API_BASE = 'http://localhost:7000/api';

/**
 * Додає блок вибору теми в #filters-panel.
 * @param {Object} opts
 *   panelId      — унікальний id блоку
 *   selectedThemes — поточний масив [{id, name, type}]
 *   onChange     — callback(selectedThemes: [{id, name, type}]) при зміні
 */
export function mountThemeFilter({ panelId, selectedThemes, onChange }) {
  document.getElementById(panelId)?.remove();

  const filtersPanel = document.getElementById('filters-panel');
  if (!filtersPanel) return;

  const block = document.createElement('div');
  block.id = panelId;
  block.className = 'filter-block';

  let current = [...selectedThemes];

  function typeLabel(type) {
    if (type === 'genre') return '🎭';
    if (type === 'type')  return '📂';
    return '🏷️';
  }

  function chipClass(type) {
    if (type === 'genre') return 'filter-chip--theme-genre';
    if (type === 'type')  return 'filter-chip--theme-type';
    return 'filter-chip--theme';
  }

  function render() {
    block.innerHTML = '';

    // Лейбл
    const lbl = document.createElement('span');
    lbl.className = 'filter-block__label';
    lbl.textContent = '🏷️ Тема:';
    block.appendChild(lbl);

    // Чіпи обраних тем
    current.forEach(theme => {
      const chip = document.createElement('span');
      chip.className = `filter-chip ${chipClass(theme.type)}`;
      chip.innerHTML = `${typeLabel(theme.type)} ${theme.name} <button title="Прибрати" class="filter-chip__remove">×</button>`;
      chip.querySelector('button').onclick = () => {
        current = current.filter(t => t.id !== theme.id);
        onChange(current);
        render();
      };
      block.appendChild(chip);
    });

    // Кнопка "скинути всі"
    if (current.length > 0) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'filter-clear-btn';
      clearBtn.textContent = 'Скинути';
      clearBtn.onclick = () => { current = []; onChange(current); render(); };
      block.appendChild(clearBtn);
    }

    // Пошук-інпут
    const inputWrap = document.createElement('div');
    inputWrap.style.cssText = 'position:relative; flex-shrink:0;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Додати тему...';
    input.className = 'filter-search-input';

    const dropdown = document.createElement('div');
    dropdown.className = 'filter-dropdown';

    let timeout = null;

    async function fetchThemes(q) {
      const url = q
        ? `${API_BASE}/themes?search=${encodeURIComponent(q)}&limit=30`
        : `${API_BASE}/themes?limit=50`;
      const res = await fetch(url);
      const data = await res.json();
      return data.data || [];
    }

    async function showDropdown(q) {
      try {
        const themes = await fetchThemes(q);
        if (!themes.length) {
          dropdown.innerHTML = `<div class="filter-dropdown__empty">Нічого не знайдено</div>`;
        } else {
          // Групуємо по type
          const groups = { type: [], genre: [], theme: [] };
          themes.forEach(t => {
            const g = t.type || 'theme';
            if (!groups[g]) groups[g] = [];
            groups[g].push(t);
          });

          const groupLabels = { type: '📂 Тип', genre: '🎭 Жанр', theme: '🏷️ Тема' };
          let html = '';
          for (const [grp, items] of Object.entries(groups)) {
            if (!items.length) continue;
            html += `<div class="filter-dropdown__group-header">${groupLabels[grp]}</div>`;
            items.forEach(t => {
              const selected = current.some(c => c.id === t.id);
              const nameField = t.ua_name
                ? t.ua_name.charAt(0).toUpperCase() + t.ua_name.slice(1)
                : t.name;
              html += `<div class="filter-dropdown__item${selected ? ' filter-dropdown__item--selected' : ''}"
                            data-id="${t.id}" data-name="${nameField}" data-type="${t.type || 'theme'}">
                          ${nameField}
                       </div>`;
            });
          }
          dropdown.innerHTML = html;
        }

        dropdown.querySelectorAll('.filter-dropdown__item:not(.filter-dropdown__item--selected)').forEach(item => {
          item.onclick = () => {
            const id   = parseInt(item.dataset.id);
            const name = item.dataset.name;
            const type = item.dataset.type;
            if (!current.some(t => t.id === id)) {
              current.push({ id, name, type });
              onChange(current);
              render();
            }
            dropdown.style.display = 'none';
            input.value = '';
          };
        });

        dropdown.style.display = 'block';
      } catch (e) {
        console.error('Помилка завантаження тем:', e);
      }
    }

    input.addEventListener('focus', () => showDropdown(input.value.trim()));
    input.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => showDropdown(input.value.trim()), 250);
    });

    document.addEventListener('click', (e) => {
      if (!inputWrap.contains(e.target)) dropdown.style.display = 'none';
    }, { capture: true });

    inputWrap.appendChild(input);
    inputWrap.appendChild(dropdown);
    block.appendChild(inputWrap);
  }

  render();
  filtersPanel.appendChild(block);
}