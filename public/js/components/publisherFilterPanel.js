import { API_BASE } from '../utils/config.js';

// Блок фільтру по видавництву (мульти-вибір) — монтується в #filters-panel

/**
 * Додає блок вибору видавництва в #filters-panel.
 * @param {Object} opts
 *   panelId      — унікальний id блоку (щоб не дублювати при ре-рендері)
 *   selectedPubs — поточний масив [{id, name}]
 *   onChange     — callback(selectedPubs: [{id, name}]) при зміні
 */
export function mountPublisherFilter({ panelId, selectedPubs, onChange }) {
  document.getElementById(panelId)?.remove();

  const filtersPanel = document.getElementById('filters-panel');
  if (!filtersPanel) return;

  const block = document.createElement('div');
  block.id = panelId;
  block.className = 'filter-block';

  let current = [...selectedPubs];

  function render() {
    block.innerHTML = '';

    // Лейбл
    const lbl = document.createElement('span');
    lbl.className = 'filter-block__label';
    lbl.textContent = '🏢 Видавництво:';
    block.appendChild(lbl);

    // Чіпи
    current.forEach(pub => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip filter-chip--publisher';
      chip.innerHTML = `${pub.name} <button title="Прибрати" class="filter-chip__remove">×</button>`;
      chip.querySelector('button').onclick = () => {
        current = current.filter(p => p.id !== pub.id);
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
    input.placeholder = 'Додати видавництво...';
    input.className = 'filter-search-input';

    const dropdown = document.createElement('div');
    dropdown.className = 'filter-dropdown';

    let timeout = null;
    input.addEventListener('input', () => {
      clearTimeout(timeout);
      const q = input.value.trim();
      if (!q) { dropdown.style.display = 'none'; return; }
      timeout = setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE}/publishers?search=${encodeURIComponent(q)}&limit=20`);
          const data = await res.json();
          const publishers = data.data || [];
          if (!publishers.length) {
            dropdown.innerHTML = `<div class="filter-dropdown__empty">Нічого не знайдено</div>`;
          } else {
            dropdown.innerHTML = publishers.map(p => {
              const selected = current.some(c => c.id === p.id);
              return `<div class="filter-dropdown__item${selected ? ' filter-dropdown__item--selected' : ''}"
                           data-pub-id="${p.id}"
                           data-pub-name="${p.name.replace(/"/g, '&quot;')}">
                🏢 ${p.name}${selected ? ' ✓' : ''}
              </div>`;
            }).join('');
          }
          dropdown.style.display = 'block';
        } catch (e) { console.error('Publisher search error', e); }
      }, 250);
    });

    dropdown.addEventListener('click', e => {
      const row = e.target.closest('[data-pub-id]');
      if (!row || row.classList.contains('filter-dropdown__item--selected')) return;
      const id = parseInt(row.dataset.pubId);
      const name = row.dataset.pubName;
      current = [...current, { id, name }];
      onChange(current);
      input.value = '';
      dropdown.style.display = 'none';
      render();
    });

    document.addEventListener('click', function outsideClick(e) {
      if (!inputWrap.contains(e.target)) {
        dropdown.style.display = 'none';
        document.removeEventListener('click', outsideClick);
      }
    });

    inputWrap.appendChild(input);
    inputWrap.appendChild(dropdown);
    block.appendChild(inputWrap);
  }

  render();
  filtersPanel.appendChild(block);
}