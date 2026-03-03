// public/js/components/themeFilterPanel.js
// Блок фільтру по темах/жанрах (мульти-вибір) — монтується в #filters-panel

const API_BASE = 'http://localhost:7000/api';

/**
 * Додає блок вибору тем/жанрів в #filters-panel.
 * @param {Object} opts
 *   panelId          — унікальний id блоку
 *   selectedThemeIds — поточний масив id тем (числа)
 *   onChange         — callback(selectedIds: number[]) при зміні
 */
export async function mountThemeFilter({ panelId, selectedThemeIds, onChange }) {
  document.getElementById(panelId)?.remove();

  const filtersPanel = document.getElementById('filters-panel');
  if (!filtersPanel) return;

  // Завантажуємо всі теми один раз
  let allThemes = [];
  try {
    const res = await fetch(`${API_BASE}/themes`);
    const data = await res.json();
    allThemes = data.data || [];
  } catch (e) {
    console.error('Помилка завантаження тем:', e);
    return;
  }

  const genres = allThemes.filter(t => t.type === 'genre');
  const themes = allThemes.filter(t => t.type === 'theme');

  const block = document.createElement('div');
  block.id = panelId;
  block.className = 'filter-block';
  block.style.position = 'relative';

  let current = [...(selectedThemeIds || [])];

  function getThemeById(id) {
    return allThemes.find(t => t.id === id);
  }

  function render() {
    block.innerHTML = '';

    // Лейбл
    const lbl = document.createElement('span');
    lbl.className = 'filter-block__label';
    lbl.textContent = '🏷️ Тема/Жанр:';
    block.appendChild(lbl);

    // Чіпи обраних тем
    current.forEach(id => {
      const theme = getThemeById(id);
      if (!theme) return;
      const isGenre = theme.type === 'genre';
      const chip = document.createElement('span');
      chip.className = `filter-chip filter-chip--${isGenre ? 'genre' : 'theme'}`;
      chip.innerHTML = `${theme.ua_name || theme.name} <button title="Прибрати" class="filter-chip__remove">×</button>`;
      chip.querySelector('button').onclick = () => {
        current = current.filter(i => i !== id);
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

    // Кнопка-тригер для відкриття дропдауну
    const triggerWrap = document.createElement('div');
    triggerWrap.style.cssText = 'position:relative; flex-shrink:0;';

    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'filter-search-input';
    triggerBtn.style.cssText = 'cursor:pointer; text-align:left; width:170px; display:flex; align-items:center; justify-content:space-between; gap:0.4rem;';
    triggerBtn.innerHTML = `<span>Обрати тему...</span><span style="opacity:0.5; font-size:0.75rem;">▼</span>`;

    // Дропдаун
    const dropdown = document.createElement('div');
    dropdown.className = 'filter-dropdown';
    dropdown.style.cssText = 'max-height:280px; min-width:240px;';

    // Поле пошуку всередині дропдауну
    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'padding:0.4rem 0.5rem; border-bottom:1px solid var(--border-color); position:sticky; top:0; background:var(--bg-primary); z-index:2;';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Пошук теми...';
    searchInput.className = 'filter-search-input';
    searchInput.style.cssText = 'width:100%; box-sizing:border-box;';
    searchWrap.appendChild(searchInput);
    dropdown.appendChild(searchWrap);

    // Контент тем
    const listWrap = document.createElement('div');
    dropdown.appendChild(listWrap);

    function renderDropdownList(filterText = '') {
      listWrap.innerHTML = '';
      const q = filterText.toLowerCase();

      const filterFn = t => {
        if (current.includes(t.id)) return false; // вже обрано
        if (!q) return true;
        return (t.ua_name || t.name || '').toLowerCase().includes(q);
      };

      const filteredGenres = genres.filter(filterFn);
      const filteredThemes = themes.filter(filterFn);

      if (!filteredGenres.length && !filteredThemes.length) {
        listWrap.innerHTML = '<div class="filter-dropdown__empty">Нічого не знайдено</div>';
        return;
      }

      if (filteredGenres.length) {
        const header = document.createElement('div');
        header.className = 'theme-group-header';
        header.textContent = 'Жанри';
        listWrap.appendChild(header);

        filteredGenres.forEach(t => {
          const item = document.createElement('div');
          item.className = 'filter-dropdown__item';
          item.dataset.themeId = t.id;
          item.innerHTML = `<span class="edit-chip edit-chip-genre" style="pointer-events:none; margin-right:0.4rem; font-size:0.75rem;">${t.ua_name || t.name}</span>`;
          item.onclick = () => {
            current = [...current, t.id];
            onChange(current);
            dropdown.style.display = 'none';
            render();
          };
          listWrap.appendChild(item);
        });
      }

      if (filteredThemes.length) {
        const header = document.createElement('div');
        header.className = 'theme-group-header';
        header.textContent = 'Теми';
        listWrap.appendChild(header);

        filteredThemes.forEach(t => {
          const item = document.createElement('div');
          item.className = 'filter-dropdown__item';
          item.dataset.themeId = t.id;
          item.innerHTML = `<span class="edit-chip edit-chip-theme" style="pointer-events:none; margin-right:0.4rem; font-size:0.75rem;">${t.ua_name || t.name}</span>`;
          item.onclick = () => {
            current = [...current, t.id];
            onChange(current);
            dropdown.style.display = 'none';
            render();
          };
          listWrap.appendChild(item);
        });
      }
    }

    renderDropdownList();

    searchInput.addEventListener('input', () => renderDropdownList(searchInput.value));
    searchInput.addEventListener('click', e => e.stopPropagation());

    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display === 'block';
      dropdown.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        searchInput.value = '';
        renderDropdownList();
        setTimeout(() => searchInput.focus(), 50);
      }
    });

    document.addEventListener('click', function outsideClick(e) {
      if (!triggerWrap.contains(e.target)) {
        dropdown.style.display = 'none';
        document.removeEventListener('click', outsideClick);
      }
    });

    triggerWrap.appendChild(triggerBtn);
    triggerWrap.appendChild(dropdown);
    block.appendChild(triggerWrap);
  }

  render();
  filtersPanel.appendChild(block);
}