import { API_BASE }                     from '../utils/config.js';
import { cv_img_path_small, initDetailPage } from '../utils/helpers.js';
import { navigate }                     from '../utils/router.js';

// ── Locale ────────────────────────────────────────────────────────────────

const DAYS_UK   = ['Неділя','Понеділок','Вівторок','Середа','Четвер','П\'ятниця','Субота'];
const MONTHS_UK = ['Січня','Лютого','Березня','Квітня','Травня','Червня',
                   'Липня','Серпня','Вересня','Жовтня','Листопада','Грудня'];

function fDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return `${DAYS_UK[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_UK[d.getUTCMonth()]}`;
}

function fWeek(start, end) {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end   + 'T00:00:00Z');
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear())
    return `${s.getUTCDate()}–${e.getUTCDate()} ${MONTHS_UK[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
  return `${s.getUTCDate()} ${MONTHS_UK[s.getUTCMonth()]} – ${e.getUTCDate()} ${MONTHS_UK[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
}

function weeksWord(n) {
  if (n === 1) return 'тиждень';
  if (n < 5)  return 'тижні';
  return 'тижнів';
}

// ── Week utils ────────────────────────────────────────────────────────────

function getWeekStart(ref) {
  let d;
  if (!ref) {
    d = new Date();
  } else if (ref instanceof Date) {
    d = new Date(ref);
  } else {
    d = new Date(String(ref).includes('T') ? ref : ref + 'T00:00:00Z');
  }
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}

function addWeeks(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

function weekEnd(start) {
  const d = new Date(start + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

function weeksDiff(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / (7 * 86400000));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isoWeekNum(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay() || 7;
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() + 4 - dow);
  const y1  = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thu - y1) / 86400000 + 1) / 7);
  return { year: thu.getUTCFullYear(), week };
}

function buildDayMap(start, end) {
  const map = {};
  const cur  = new Date(start + 'T00:00:00Z');
  const last = new Date(end   + 'T00:00:00Z');
  while (cur <= last) {
    map[cur.toISOString().slice(0, 10)] = [];
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return map;
}

// ── State ─────────────────────────────────────────────────────────────────

let _ws   = null;   // week start YYYY-MM-DD
let _type = 'all';
let _cols = true;
let _mode = 'chapters';  // 'chapters' | 'magazines'
let _busy = false;
let _nextContentDate = null;
let _prevContentDate = null;
let _cachedItems = null;    // всі завантажені елементи
let _cacheParams = null;    // параметри під які кешовано (type, cols, mode)

// ── Entry ─────────────────────────────────────────────────────────────────

function _filterByWeek(sortedItems, start, end) {
  const days = buildDayMap(start, end);
  const pri = { manga_magazine:0, manga_chapter:1, manga_collection:2, comic_issue:3, comic_collection:4 };

  // Бінарний пошук початку діапазону
  let lo = 0, hi = sortedItems.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sortedItems[mid].release_date || '') < start) lo = mid + 1;
    else hi = mid;
  }
  // Ітеруємо тільки елементи у вікні [start, end]
  for (let i = lo; i < sortedItems.length; i++) {
    const item = sortedItems[i];
    if ((item.release_date || '') > end) break;
    if (days[item.release_date]) days[item.release_date].push(item);
  }

  Object.keys(days).forEach(d => {
    days[d].sort((a, b) => {
      const p = (pri[a._type] ?? 9) - (pri[b._type] ?? 9);
      if (p !== 0) return p;
      return (a.volume_name || a.name || '').localeCompare(b.volume_name || b.name || '');
    });
  });

  return days;
}

// Бінарний пошук першого елемента з release_date > afterDate
function _findNextBinary(sortedItems, afterDate) {
  let lo = 0, hi = sortedItems.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sortedItems[mid].release_date || '') <= afterDate) lo = mid + 1;
    else hi = mid;
  }
  return lo < sortedItems.length ? sortedItems[lo].release_date : null;
}

// Бінарний пошук останнього елемента з release_date < beforeDate
function _findPrevBinary(sortedItems, beforeDate) {
  let lo = 0, hi = sortedItems.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sortedItems[mid].release_date || '') < beforeDate) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? sortedItems[lo - 1].release_date : null;
}

export async function renderCalendarView(params = {}) {
  initDetailPage();
  if (params.date) _ws = getWeekStart(params.date);
  else if (!_ws)   _ws = getWeekStart();

  document.getElementById('page-title').textContent = '📅 Календар релізів';
  _shell();
  await _load();
}

// ── Shell ─────────────────────────────────────────────────────────────────

function _shell() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div id="cal-root" style="display:flex;flex-direction:column;gap:0;">

      <div id="cal-ctrl" style="
        z-index:20;
        background:var(--bg-primary);
        border:1px solid var(--border-color);border-radius:10px;
        padding:0.75rem 1rem;margin-bottom:0.75rem;
        box-shadow:var(--shadow);
        display:flex;flex-direction:column;gap:0.6rem;
      ">
        <!-- Row 1 -->
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">

          <div style="display:flex;background:var(--bg-secondary);border-radius:8px;padding:0.2rem;gap:0.15rem;">
            ${[['all','Всі'],['comics','Комікси'],['manga','Манґа']].map(([t,l]) => `
              <button class="cal-tab" data-t="${t}" style="
                padding:0.3rem 0.9rem;border:none;border-radius:6px;cursor:pointer;
                font-size:0.83rem;font-weight:600;transition:all 0.15s;
                background:${_type===t?'var(--bg-primary)':'transparent'};
                color:${_type===t?'var(--accent)':'var(--text-secondary)'};
                box-shadow:${_type===t?'var(--shadow)':'none'};
              ">${l}</button>
            `).join('')}
          </div>

          <label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.875rem;color:var(--text-secondary);user-select:none;">
            <input type="checkbox" id="cal-cb" ${_cols?'checked':''} style="accent-color:var(--accent);cursor:pointer;width:14px;height:14px;">
            📚 Збірники
          </label>

          <div id="cal-mtoggle" style="display:${_type!=='comics'?'flex':'none'};align-items:center;gap:0.5rem;font-size:0.84rem;">
            <span id="cal-mlabel-mag" style="color:${_mode==='magazines'?'var(--accent)':'var(--text-secondary)'};font-weight:${_mode==='magazines'?700:400};">📰 Журнали</span>
            <div id="cal-mswitch" style="
              position:relative;width:44px;height:24px;border-radius:12px;cursor:pointer;
              background:var(--accent);flex-shrink:0;
            ">
              <div id="cal-mthumb" style="
                position:absolute;top:4px;left:${_mode==='chapters'?'22px':'4px'};
                width:16px;height:16px;border-radius:50%;background:white;
                transition:left 0.18s;box-shadow:0 1px 3px rgba(0,0,0,0.3);
              "></div>
            </div>
            <span id="cal-mlabel-ch" style="color:${_mode==='chapters'?'var(--accent)':'var(--text-secondary)'};font-weight:${_mode==='chapters'?700:400};">📖 Розділи</span>
          </div>
        </div>

        <!-- Row 2 -->
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          <button id="cal-prev" class="btn btn-secondary" style="padding:0.3rem 0.75rem;font-size:1rem;min-width:52px;"></button>

          <div id="cal-wlabel" style="font-weight:700;font-size:0.95rem;color:var(--text-primary);min-width:230px;text-align:center;"></div>

          <input type="week" id="cal-picker" style="
            padding:0.3rem 0.6rem;border:1px solid var(--border-color);border-radius:6px;
            background:var(--bg-secondary);color:var(--text-primary);font-size:0.82rem;cursor:pointer;outline:none;
          ">

          <button id="cal-next" class="btn btn-secondary" style="padding:0.3rem 0.75rem;font-size:1rem;min-width:52px;"></button>

          <button id="cal-today" class="btn btn-primary btn-small" style="display:none;">Сьогодні</button>
          <button id="cal-clear-cache" class="btn btn-secondary btn-small" title="Очистити кеш і перезавантажити">🔄</button>
        </div>
      </div>

      <div id="cal-body" style="min-height:200px;">
        <div style="text-align:center;padding:3rem;color:var(--text-secondary);">⏳ Завантаження…</div>
      </div>
    </div>
  `;

  _bindControls();
}

function _bindControls() {
    document.querySelectorAll('.cal-tab').forEach(b => b.addEventListener('click', () => {
        _type = b.dataset.t;
        document.querySelectorAll('.cal-tab').forEach(x => {
        const a = x.dataset.t === _type;
        x.style.background = a ? 'var(--bg-primary)' : 'transparent';
        x.style.color      = a ? 'var(--accent)'     : 'var(--text-secondary)';
        x.style.boxShadow  = a ? 'var(--shadow)'     : 'none';
        });
        const mt = document.getElementById('cal-mtoggle');
        if (mt) mt.style.display = _type !== 'comics' ? 'flex' : 'none';
        _cachedItems = null;
        _load();
    }));

    document.getElementById('cal-cb')?.addEventListener('change', e => { 
        _cols = e.target.checked;
        _cachedItems = null;
        _load();
    });

    document.getElementById('cal-mswitch')?.addEventListener('click', () => {
        _mode = _mode === 'chapters' ? 'magazines' : 'chapters';
        const thumb = document.getElementById('cal-mthumb');
        if (thumb) thumb.style.left = _mode === 'chapters' ? '22px' : '4px';
        const lMag = document.getElementById('cal-mlabel-mag');
        const lCh  = document.getElementById('cal-mlabel-ch');
        if (lMag) { lMag.style.color = _mode==='magazines'?'var(--accent)':'var(--text-secondary)'; lMag.style.fontWeight = _mode==='magazines'?700:400; }
        if (lCh)  { lCh.style.color  = _mode==='chapters' ?'var(--accent)':'var(--text-secondary)'; lCh.style.fontWeight  = _mode==='chapters' ?700:400; }
        _cachedItems = null;
        _load();
    });

    document.getElementById('cal-prev')?.addEventListener('click', () => {
        _ws = _prevContentDate ? getWeekStart(_prevContentDate) : addWeeks(_ws, -1);
        _load();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
        _ws = _nextContentDate ? getWeekStart(_nextContentDate) : addWeeks(_ws, 1);
        _load();
    });
    document.getElementById('cal-today')?.addEventListener('click', () => { _ws = getWeekStart();    _load(); });

    document.getElementById('cal-picker')?.addEventListener('change', e => {
        const val = e.target.value;
        if (!val) return;
        const [yr, wk] = val.split('-W').map(Number);
        const jan4    = new Date(Date.UTC(yr, 0, 4));
        const dj4     = (jan4.getUTCDay() + 6) % 7;
        const monday  = new Date(jan4);
        monday.setUTCDate(jan4.getUTCDate() - dj4 + (wk - 1) * 7);
        _ws = monday.toISOString().slice(0, 10);
        _load();
    });

    document.getElementById('cal-clear-cache')?.addEventListener('click', () => {
        _cachedItems = null;
        _cacheParams = null;
        _load();
    });
}

// ── Load & render ─────────────────────────────────────────────────────────

async function _load() {
  if (_busy) return;
  _busy = true;
  _updateNav(null);
  const body = document.getElementById('cal-body');
  if (body) body.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-secondary);">⏳ Завантаження…</div>';

  const paramsKey = `${_type}|${_cols}|${_mode}`;

  try {
    if (!_cachedItems || _cacheParams !== paramsKey) {
      const p = new URLSearchParams({
        type: _type,
        collections: _cols ? '1' : '0',
        manga_mode: _mode,
      });
      const res = await fetch(`${API_BASE}/calendar/all?${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Сортуємо один раз при завантаженні — щоб _findNext/Prev працювали швидко
      _cachedItems = (json.data || []).sort((a, b) =>
        (a.release_date || '').localeCompare(b.release_date || '')
      );
      _cacheParams = paramsKey;

      // Тимчасовий дебаг — прибрати після перевірки
    console.log('[Calendar] Loaded items:', _cachedItems.length,
        'magazines:', _cachedItems.filter(i => i._type === 'manga_magazine').length,
        'sample:', _cachedItems.find(i => i._type === 'manga_magazine'));
    }

    const start = _ws;
    const end   = weekEnd(_ws);
    const days  = _filterByWeek(_cachedItems, start, end);
    const total = Object.values(days).reduce((s, a) => s + a.length, 0);

    // Бінарний пошук для next/prev — O(log n) замість O(n)
    const next_content_date = _findNextBinary(_cachedItems, end);
    const prev_content_date = _findPrevBinary(_cachedItems, start);

    _nextContentDate = next_content_date;
    _prevContentDate = prev_content_date;

    const data = { days, total, next_content_date, prev_content_date };
    _updateNav(data);
    _renderBody(data);
  } catch (err) {
    console.error('Calendar:', err);
    if (body) body.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--danger);">Помилка: ${err.message}</div>`;
  } finally {
    _busy = false;
  }
}

function _updateNav(data) {
    const we = weekEnd(_ws);

    const lbl = document.getElementById('cal-wlabel');
    if (lbl) lbl.textContent = fWeek(_ws, we);

    const todayBtn = document.getElementById('cal-today');
    if (todayBtn) todayBtn.style.display = _ws === getWeekStart() ? 'none' : 'block';

    const picker = document.getElementById('cal-picker');
    if (picker) {
        const monday = new Date(_ws + 'T00:00:00Z');
        monday.setUTCDate(monday.getUTCDate() + 1);
        const { year, week } = isoWeekNum(monday.toISOString().slice(0, 10));
        picker.value = `${year}-W${String(week).padStart(2,'0')}`;
    }

    const prev = document.getElementById('cal-prev');
    const next = document.getElementById('cal-next');

    if (prev) {
        const twoWeeksAgo = addWeeks(getWeekStart(), -2);
        const prevWS = _prevContentDate
        ? getWeekStart(_prevContentDate)
        : addWeeks(_ws, -1);
        const tooFarBack = prevWS < twoWeeksAgo;

        prev.disabled = tooFarBack;
        prev.style.opacity = tooFarBack ? '0.35' : '';
        prev.style.cursor  = tooFarBack ? 'not-allowed' : '';

        if (!tooFarBack && data?.prev_content_date) {
        const diff = weeksDiff(getWeekStart(data.prev_content_date), _ws);
        prev.textContent = diff > 1 ? `←${diff}тиж` : '←';
        prev.title       = diff > 1 ? `Попередній контент: ${data.prev_content_date}` : '';
        prev.style.color = diff > 1 ? 'var(--text-muted)' : '';
        } else {
        prev.textContent = '←'; prev.title = ''; prev.style.color = '';
        }
    }

    if (next) {
        if (data?.next_content_date) {
        const nws  = getWeekStart(data.next_content_date);
        const diff = weeksDiff(_ws, nws);
        next.textContent = diff > 1 ? `→+${diff}тиж` : '→';
        next.title       = diff > 1 ? `Наступний контент: ${data.next_content_date} (через ${diff} ${weeksWord(diff)})` : '';
        next.style.color = diff > 1 ? 'var(--warning)' : '';
        } else {
        next.textContent = '→'; next.title = ''; next.style.color = '';
        }
    }
}

// ── Body ─────────────────────────────────────────────────────────────────

function _renderBody(data) {
  const body = document.getElementById('cal-body');
  if (!body) return;

  const today  = todayStr();
  const curWS  = getWeekStart();
  const isNow  = _ws === curWS;
  const isFut  = _ws > curWS;

  const summaryHtml = `
    <div style="display:flex;align-items:center;gap:0.75rem;padding:0.3rem 0;margin-bottom:0.6rem;flex-wrap:wrap;">
      ${isNow ? '<span style="font-size:0.82rem;color:var(--accent);font-weight:700;">📌 Поточний тиждень</span>'
              : isFut ? '<span style="font-size:0.82rem;color:var(--warning);font-weight:600;">🔮 Майбутній тиждень</span>'
                      : '<span style="font-size:0.82rem;color:var(--text-muted);">📁 Архів</span>'}
      <span style="font-size:0.82rem;color:var(--text-secondary);">
        Всього: <strong style="color:var(--text-primary);">${data.total}</strong>
      </span>
    </div>
  `;

  const daysHtml = Object.entries(data.days)
    .map(([date, items]) => _daySection(date, items, today))
    .join('');

  if (data.total === 0 && data.next_content_date) {
    const nws  = getWeekStart(data.next_content_date);
    const diff = weeksDiff(_ws, nws);
    body.innerHTML = summaryHtml + `
      <div style="text-align:center;padding:3.5rem 2rem;background:var(--bg-primary);
                  border-radius:10px;border:1px solid var(--border-color);color:var(--text-secondary);margin-bottom:0.75rem;">
        <div style="font-size:2.5rem;margin-bottom:0.75rem;">📭</div>
        <div style="font-size:1rem;font-weight:600;margin-bottom:0.4rem;">Немає контенту на цьому тижні</div>
        <div style="font-size:0.875rem;color:var(--text-muted);margin-bottom:1.25rem;">
          Наступний контент: <strong style="color:var(--text-primary);">${data.next_content_date}</strong>
          — через <strong>${diff} ${weeksWord(diff)}</strong>
        </div>
        <button class="btn btn-primary" id="cal-jump">Перейти → ${data.next_content_date}</button>
      </div>
    ` + daysHtml;
    document.getElementById('cal-jump')?.addEventListener('click', () => { _ws = nws; _load(); });
  } else {
    body.innerHTML = summaryHtml + daysHtml;
  }

  // Update sticky offsets after layout
//   requestAnimationFrame(() => {
//     const ctrl = document.getElementById('cal-ctrl');
//     const top  = (ctrl?.offsetHeight ?? 108) + 10;
//     document.querySelectorAll('.cal-dh').forEach(h => { h.style.top = `${top}px`; });
//   });
}

function _daySection(date, items, today) {
  const empty   = items.length === 0;
  const isToday = date === today;

  return `
    <div style="margin-bottom:0.75rem;">
      <div class="cal-dh" style="
        margin: auto;
        width: fit-content;
        position:sticky;top:0px;z-index:10;
        display:flex;align-items:center;gap:0.6rem;
        padding:0.45rem 0.85rem;border-radius:7px;
        background:${isToday?'var(--accent-light)':empty?'var(--bg-tertiary)':'var(--bg-secondary)'};
        border:1px solid ${isToday?'rgba(108,92,231,0.35)':'var(--border-color)'};
        opacity:${empty?0.55:1};
      ">
        <span style="font-weight:700;font-size:0.88rem;color:${isToday?'var(--accent)':'var(--text-primary)'};">
          ${isToday?'📌 ':''}${fDay(date)}
        </span>
        ${!empty
          ? `<span style="font-size:0.73rem;padding:0.1rem 0.5rem;border-radius:10px;
               background:var(--bg-primary);color:var(--text-secondary);border:1px solid var(--border-color);">
               ${items.length}
             </span>`
          : '<span style="font-size:0.73rem;color:var(--text-muted);">— порожньо</span>'}
      </div>
      ${!empty ? `
        <div style="display:flex;flex-wrap:wrap;gap:0.6rem;padding:0.6rem 0.1rem 0.25rem;">
          ${items.map(_item).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ── Cards ─────────────────────────────────────────────────────────────────

const TYPE_META = {
  comic_issue:      { icon:'📖', label:'Випуск',  bg:'var(--badge-issue-bg-solid)',      col:'var(--badge-issue-color)' },
  comic_collection: { icon:'📗', label:'Збірник', bg:'var(--badge-collection-bg-solid)', col:'var(--badge-collection-color)' },
  manga_chapter:    { icon:'📖', label:'Розділ',  bg:'var(--accent-light-solid)',        col:'var(--accent)' },
  manga_collection: { icon:'📗', label:'Збірник', bg:'var(--badge-collection-bg-solid)', col:'var(--badge-collection-color)' },
};

function _imgUrl(item) {
  const src = item.cv_img || item.hikka_img;
  if (!src) return null;
  if (src.startsWith('http')) return src;
  return `${cv_img_path_small}${src.startsWith('/')?'':'/'}${src}`;
}

function _click(item) {
  switch (item._type) {
    case 'comic_issue': case 'manga_chapter': return `navigate('issue-detail',{id:${item.id}})`;
    case 'comic_collection': case 'manga_collection': return `navigate('collection-detail',{id:${item.id}})`;
    case 'manga_magazine': return `navigate('issue-detail',{id:${item.id}})`;
    default: return '';
  }
}

function _url(item) {
  switch (item._type) {
    case 'comic_issue': case 'manga_chapter': return `/?page=issue-detail&id=${item.id}`;
    case 'comic_collection': case 'manga_collection': return `/?page=collection-detail&id=${item.id}`;
    case 'manga_magazine': return `/?page=issue-detail&id=${item.id}`;
    default: return '';
  }
}

function _item(item) {
  return item._type === 'manga_magazine' ? _magazine(item) : _card(item);
}

function _card(item) {
  const m    = TYPE_META[item._type];
  const img  = _imgUrl(item);
  const vol  = item.volume_name || item.name || '—';
  const num  = item.issue_number ? `#${item.issue_number}` : '';
  const sub  = item.name && item.name !== vol ? item.name : null;

  return `
    <div onclick="if(event.ctrlKey||event.metaKey){event.preventDefault();window.open('${_url(item)}','_blank')}else{${_click(item)}}"
        onmousedown="if(event.button===1){event.preventDefault();window.open('${_url(item)}','_blank')}"
        style="
      width:130px;flex-shrink:0;cursor:pointer;
      background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;
      overflow:hidden;position:relative;transition:box-shadow 0.15s,transform 0.15s;
    " onmouseover="this.style.boxShadow='var(--shadow-lg)';this.style.transform='translateY(-2px)'"
       onmouseout="this.style.boxShadow='none';this.style.transform=''">
      ${m ? `<div style="
        position:absolute;top:0.3rem;left:0.3rem;z-index:1;
        font-size:0.62rem;font-weight:700;padding:0.15rem 0.4rem;border-radius:4px;
        background:${m.bg};color:${m.col};
      ">${m.label}</div>` : ''}
      <div style="width:130px;height:190px;background:var(--bg-secondary);overflow:hidden;display:flex;align-items:center;justify-content:center;">
        ${img
          ? `<img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;" loading="lazy">`
          : `<span style="font-size:2.5rem;">${m?.icon||'📄'}</span>`}
      </div>
      <div style="padding:0.4rem 0.5rem 0.5rem;">
        <div style="font-size:0.74rem;font-weight:600;line-height:1.3;overflow:hidden;
                    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
                    color:var(--text-primary);">${vol}</div>
        ${num ? `<div style="font-size:0.72rem;color:var(--accent);font-weight:700;margin-top:0.15rem;">${num}</div>` : ''}
        ${sub ? `<div style="font-size:0.67rem;color:var(--text-secondary);margin-top:0.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${sub}">${sub}</div>` : ''}
      </div>
    </div>
  `;
}

function _magazine(item) {
  const img  = _imgUrl(item);
  const chs  = item.chapters || [];

  return `
    <div style="
      width:100%;
      background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;overflow:hidden;
    ">
      <div onclick="if(event.ctrlKey||event.metaKey){event.preventDefault();window.open('${_url(item)}','_blank')}else{${_click(item)}}"
            onmousedown="if(event.button===1){event.preventDefault();window.open('${_url(item)}','_blank')}"
            style="
        display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.9rem;
        background:var(--bg-secondary);border-bottom:1px solid var(--border-color);
        cursor:pointer;transition:background 0.15s;
      " onmouseover="this.style.background='var(--bg-hover)'"
         onmouseout="this.style.background='var(--bg-secondary)'">
        <div style="flex-shrink:0;">
          ${img
            ? `<img src="${img}" style="width:40px;height:60px;object-fit:cover;border-radius:4px;">`
            : '<div style="width:40px;height:60px;background:var(--bg-tertiary);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">📰</div>'}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:0.15rem;">📰 Журнал</div>
          <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.magazine_name}</div>
          <div style="font-size:0.82rem;color:var(--text-secondary);">
            #${item.issue_number||'?'}${item.name?` · ${item.name}`:''}
            <span style="color:var(--text-muted);margin-left:0.4rem;">${chs.length} розд.</span>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;padding:0.65rem 0.75rem;">
        ${chs.map(ch => {
          const chImg = _imgUrl(ch)
          const chName = ch.name && ch.name !== `Розділ ${ch.issue_number}` ? ch.name : null;
          return `
            <div onclick="if(event.ctrlKey||event.metaKey){event.preventDefault();window.open('/?page=issue-detail&id=${ch.id}','_blank')}else{navigate('issue-detail',{id:${ch.id}})}"
                onmousedown="if(event.button===1){event.preventDefault();window.open('/?page=issue-detail&id=${ch.id}','_blank')}"
                style="
              width:90px;flex-shrink:0;cursor:pointer;
              background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;
              overflow:hidden;transition:box-shadow 0.15s,transform 0.1s;
            " onmouseover="this.style.boxShadow='var(--shadow-lg)';this.style.transform='translateY(-1px)'"
               onmouseout="this.style.boxShadow='none';this.style.transform=''">
              <div style="width:90px;height:126px;background:var(--bg-tertiary);overflow:hidden;display:flex;align-items:center;justify-content:center;">
                ${chImg
                  ? `<img src="${chImg}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">`
                  : '<span style="font-size:1.5rem;">📖</span>'}
              </div>
              <div style="padding:0.3rem 0.4rem 0.4rem;">
                <div style="font-size:0.67rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${ch.vol_name}">${ch.vol_name}</div>
                <div style="font-size:0.72rem;color:var(--accent);font-weight:700;">#${ch.issue_number||'?'}</div>
                ${chName?`<div style="font-size:0.63rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${chName}">${chName}</div>`:''}
              </div>
            </div>
          `;
        }).join('')}
        ${chs.length===0?'<div style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem;">Немає розділів</div>':''}
      </div>
    </div>
  `;
}