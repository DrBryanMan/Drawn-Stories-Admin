// public/js/components/volumeChips.js
//
// Уніфікований компонент для відображення списку томів (серій) у detail-сторінках.
// Замінює дві різні реалізації в readingOrderDetail та eventDetail.
//
// API:
//   buildVolumesMap(issues, options)          → Map<key, {name, cv_id, count}>
//   renderVolumeSummary(volumesMap, options)  → HTML-рядок
//   attachVolumeChipsHandlers(container, navigate, signal)
//
// options для buildVolumesMap = {
//   keyField  : string   — поле ID тому у об'єкті issue ('cv_vol_id' | 'volume_cv_id')
//   nameField : string   — поле назви тому ('volume_name')
// }
//
// options для renderVolumeSummary = {
//   label      : string   — заголовок блоку (default: 'Томи')
//   clickable  : boolean  — чи можна клікати на назву (navigate) і копіювати id
// }

// ── Побудова Map ─────────────────────────────────────────────────────────

export function buildVolumesMap(issues, { keyField = 'cv_vol_id', nameField = 'volume_name' } = {}) {
  const map = new Map();
  for (const issue of issues) {
    const key  = issue[keyField];
    const name = issue[nameField] || 'Без назви';
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { name, cv_id: key, count: 0 });
    }
    map.get(key).count++;
  }
  return map;
}

// ── Рендер HTML ──────────────────────────────────────────────────────────

export function renderVolumeSummary(volumesMap, { label = 'Томи', clickable = false } = {}) {
  if (!volumesMap.size) return '';

  const entries = [...volumesMap.entries()].sort((a, b) => b[1].count - a[1].count);

  const chips = entries.map(([id, vol]) => {
    if (clickable) {
      // Режим readingOrderDetail: клік на назву = навігація, клік на id = копіювання
      return `
        <span class="vol-chip">
          <span class="vol-chip__name volume-name-link"
                data-vol-id="${id}"
                title="Перейти до серії">
            📚 ${vol.name}
          </span>
          <span class="vol-chip__id volume-id-chip"
                data-vol-id="${id}"
                title="Скопіювати CV ID: ${id}">
            id: ${id}
          </span>
          <span class="vol-chip__count">${vol.count}</span>
        </span>
      `;
    } else {
      // Режим eventDetail: простий бейдж без взаємодії
      return `
        <span class="vol-chip">
          <span class="vol-chip__name">📚 ${vol.name}</span>
          <span class="vol-chip__count">${vol.count}</span>
        </span>
      `;
    }
  }).join('');

  return `
    <div class="vol-summary">
      <div class="vol-summary__label">${label} (${volumesMap.size})</div>
      <div class="vol-summary__chips">${chips}</div>
    </div>
  `;
}

// ── Обробники кліків (тільки для clickable-режиму) ───────────────────────

export function attachVolumeChipsHandlers(container, navigate, signal) {
  container.addEventListener('click', (e) => {
    // Навігація до серії
    const nameLink = e.target.closest('.volume-name-link');
    if (nameLink) {
      navigate('volume-detail', { id: parseInt(nameLink.dataset.volId) });
      return;
    }

    // Копіювання CV ID
    const chip = e.target.closest('.volume-id-chip');
    if (!chip) return;
    const id = chip.dataset.volId;
    navigator.clipboard.writeText(id).then(() => {
      const prev = chip.textContent;
      chip.textContent = '✓ скопійовано';
      setTimeout(() => { chip.textContent = `id: ${id}`; }, 1200);
    });
  }, { signal });
}

// ── CSS-стилі (ін'єктуються один раз) ───────────────────────────────────

export function injectVolumeChipsStyles() {
  if (document.getElementById('volume-chips-styles')) return;
  const style = document.createElement('style');
  style.id = 'volume-chips-styles';
  style.textContent = `
    .vol-summary {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin-bottom: 1.5rem;
    }
    .vol-summary__label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .vol-summary__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .vol-chip {
      display: inline-flex;
      align-items: center;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      font-size: 0.8rem;
      overflow: hidden;
    }
    .vol-chip__name {
      padding: 0.2rem 0.5rem 0.2rem 0.6rem;
      color: var(--text-primary);
    }
    .vol-chip__name.volume-name-link {
      cursor: pointer;
    }
    .vol-chip__name.volume-name-link:hover {
      color: var(--accent);
    }
    .vol-chip__id {
      cursor: pointer;
      color: var(--accent);
      font-weight: 600;
      padding: 0.2rem 0.4rem;
      border-left: 1px solid var(--border-color);
      transition: background 0.15s;
    }
    .vol-chip__id:hover {
      background: var(--bg-hover);
    }
    .vol-chip__count {
      padding: 0.2rem 0.5rem;
      color: var(--text-secondary);
      border-left: 1px solid var(--border-color);
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);
}