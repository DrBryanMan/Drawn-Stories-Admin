// public/js/components/volumeChips.js
//
// Уніфікований компонент для відображення списку томів (серій) у detail-сторінках.
//
// API:
//   buildVolumesMap(issues, options)          → Map<key, {name, cv_id, db_id, count}>
//   renderVolumeSummary(volumesMap, options)  → HTML-рядок
//   attachVolumeChipsHandlers(container, navigate, signal)
//
// options для buildVolumesMap = {
//   keyField   : string — поле CV ID тому ('cv_vol_id' | 'volume_cv_id')
//   nameField  : string — поле назви тому ('volume_name')
//   dbIdField  : string — поле db id тому ('volume_db_id') — потрібне для навігації
// }
//
// options для renderVolumeSummary = {
//   label      : string  — заголовок блоку (default: 'Томи')
//   clickable  : boolean — чи можна клікати на назву (navigate) і копіювати cv_id
// }

// ── Побудова Map ─────────────────────────────────────────────────────────

export function buildVolumesMap(issues, { keyField = 'cv_vol_id', nameField = 'volume_name', dbIdField = 'volume_db_id' } = {}) {
  const map = new Map();
  for (const issue of issues) {
    const key   = issue[keyField];
    const name  = issue[nameField] || 'Без назви';
    const db_id = issue[dbIdField] || null;
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { name, cv_id: key, db_id, count: 0 });
    }
    map.get(key).count++;
  }
  return map;
}

// ── Рендер HTML ──────────────────────────────────────────────────────────

export function renderVolumeSummary(volumesMap, { label = 'Томи', clickable = false } = {}) {
  if (!volumesMap.size) return '';

  const entries = [...volumesMap.entries()].sort((a, b) => b[1].count - a[1].count);

  const chips = entries.map(([cvId, vol]) => {
    if (clickable) {
      // Клік на назву = навігація (за db_id), клік на cv_id = копіювання
      const canNavigate = !!vol.db_id;
      return `
        <span class="vol-chip">
          <span class="vol-chip__name volume-name-link"
                data-vol-db-id="${vol.db_id || ''}"
                data-vol-cv-id="${cvId}"
                style="cursor:${canNavigate ? 'pointer' : 'default'};"
                title="${canNavigate ? 'Перейти до серії' : 'Немає db id'}">
            📚 ${vol.name}
          </span>
          <span class="vol-chip__id volume-id-chip"
                data-vol-cv-id="${cvId}"
                title="Скопіювати CV ID: ${cvId}">
            cv_id: ${cvId}
          </span>
          <span class="vol-chip__count">${vol.count}</span>
        </span>
      `;
    } else {
      // Некліковний режим (eventDetail)
      return `
        <span class="vol-chip">
          <span class="vol-chip__name volume-name-link"
                data-vol-db-id="${vol.db_id || ''}"
                data-vol-cv-id="${cvId}"
                style="cursor:${vol.db_id ? 'pointer' : 'default'};"
                title="${vol.db_id ? 'Перейти до серії' : ''}">
            📚 ${vol.name}
          </span>
          <span class="vol-chip__id volume-id-chip"
                data-vol-cv-id="${cvId}"
                title="Скопіювати CV ID: ${cvId}">
            cv_id: ${cvId}
          </span>
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

// ── Обробники кліків ──────────────────────────────────────────────────────
// Працює як для clickable:true, так і для clickable:false — навігація по db_id

export function attachVolumeChipsHandlers(container, navigate, signal) {
  container.addEventListener('click', (e) => {
    // Навігація до тому (серії) по db_id
    const nameLink = e.target.closest('.volume-name-link');
    if (nameLink) {
      const dbId = nameLink.dataset.volDbId;
      if (dbId) {
        navigate('volume-detail', { id: parseInt(dbId) });
      }
      return;
    }

    // Копіювання CV ID
    const chip = e.target.closest('.volume-id-chip');
    if (!chip) return;
    const cvId = chip.dataset.volCvId;
    navigator.clipboard.writeText(cvId).then(() => {
      const prev = chip.textContent;
      chip.textContent = '✓ скопійовано';
      setTimeout(() => { chip.textContent = prev; }, 1200);
    });
  }, { signal });
}

// ── CSS-стилі (ін'єктуються один раз) ───────────────────────────────────

export function injectVolumeChipsStyles() {
  if (document.getElementById('vol-chips-style')) return;
  const style = document.createElement('style');
  style.id = 'vol-chips-style';
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