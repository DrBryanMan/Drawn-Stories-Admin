// Уніфікований компонент для відображення списку томів (серій) у detail-сторінках.
//
// API:
//   buildVolumesMap(issues, options)          → Map<key, {name, cv_id, db_id, count, numbers}>
//   renderVolumeSummary(volumesMap, options)  → HTML-рядок
//   attachVolumeChipsHandlers(container, navigate, signal)
//
// options для buildVolumesMap = {
//   keyField       : string  — поле CV ID тому ('cv_vol_id' | 'volume_cv_id')
//   nameField      : string  — поле назви тому ('volume_name')
//   dbIdField      : string  — поле db id тому ('volume_db_id') — потрібне для навігації
//   collectNumbers : boolean — збирати масив issue_number для відображення проміжків
// }
//
// options для renderVolumeSummary = {
//   label      : string  — заголовок блоку (default: 'Томи')
//   clickable  : boolean — чи можна клікати на назву (navigate) і копіювати cv_id
//   showRanges : boolean — показувати проміжки номерів замість кількості
// }

// ── Побудова Map ─────────────────────────────────────────────────────────

export function buildVolumesMap(issues, {
  keyField          = 'cv_vol_id',
  fallbackKeyField  = null,
  nameField         = 'volume_name',
  dbIdField         = 'volume_db_id',
  collectNumbers    = false,
} = {}) {
  const map = new Map();
  for (const issue of issues) {
    const key = issue[keyField] ?? (fallbackKeyField ? issue[fallbackKeyField] : null);
    const name  = issue[nameField] || 'Без назви';
    const db_id = issue[dbIdField] || null;
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { name, cv_id: key, db_id, count: 0, numbers: [] });
    }
    const entry = map.get(key);
    entry.count++;
    if (collectNumbers && issue.issue_number != null) {
      entry.numbers.push(String(issue.issue_number));
    }
  }
  return map;
}

// ── Обчислення проміжків номерів випусків ────────────────────────────────
// Вхід: масив рядків ['1','2','3','7','8','10'] або ['0','1.5','TP']
// Вихід: рядок типу '1–3, 7–8, 10' або '0, 1.5, TP'

function formatIssueRanges(numbers) {
  // Розділяємо на числові та нечислові
  const parsed = numbers
    .map(n => ({ raw: n, num: parseFloat(n) }))
    .filter(x => !isNaN(x.num));

  const nonNumeric = numbers.filter(n => isNaN(parseFloat(n)));

  if (!parsed.length && !nonNumeric.length) return '?';
  if (!parsed.length) return nonNumeric.join(', ');

  // Дедублікуємо та сортуємо
  const seen = new Set();
  const unique = parsed
    .filter(x => { if (seen.has(x.num)) return false; seen.add(x.num); return true; })
    .sort((a, b) => a.num - b.num);

  // Групуємо лише цілі в послідовні діапазони (різниця = 1)
  const ranges = [];
  let start = unique[0];
  let end   = unique[0];

  for (let i = 1; i < unique.length; i++) {
    const cur = unique[i];
    const isConsecutiveIntegers =
      Number.isInteger(end.num) &&
      Number.isInteger(cur.num) &&
      cur.num === end.num + 1;

    if (isConsecutiveIntegers) {
      end = cur;
    } else {
      ranges.push(start.num === end.num ? start.raw : `${start.raw}–${end.raw}`);
      start = end = cur;
    }
  }
  ranges.push(start.num === end.num ? start.raw : `${start.raw}–${end.raw}`);

  // Додаємо нечислові в кінець
  const all = [...ranges, ...nonNumeric];
  return all.join(', ');
}

// ── Рендер HTML ──────────────────────────────────────────────────────────

export function renderVolumeSummary(volumesMap, {
  label      = 'Томи',
  clickable  = false,
  showRanges = false,
} = {}) {
  if (!volumesMap.size) return '';

  const entries = [...volumesMap.entries()].sort((a, b) => b[1].count - a[1].count);

  const chips = entries.map(([cvId, vol]) => {
    const countDisplay = showRanges && vol.numbers.length
      ? formatIssueRanges(vol.numbers)
      : vol.count;

    if (clickable) {
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
          <span class="vol-chip__count" title="${showRanges ? 'Номери випусків' : 'Кількість випусків'}">${countDisplay}</span>
        </span>
      `;
    } else {
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
          <span class="vol-chip__count" title="${showRanges ? 'Номери випусків' : 'Кількість випусків'}">${countDisplay}</span>
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