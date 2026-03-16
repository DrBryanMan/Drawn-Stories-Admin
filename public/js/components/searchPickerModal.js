// Універсальна модалка пошуку + вибору одного елементу.
// Закривається кліком на фон та по Escape.
//
// API:
//   openSearchPickerModal(config)
//   closeSearchPickerModal()
//
// config = {
//   title      : string
//   hint?      : string                               — підказка під заголовком
//   inputs     : [{ id, label, placeholder, type? }] — поля пошуку
//   searchFn   : async (values) => item[]             — values = { [input.id]: string }
//   renderItem : (item, index) => string              — HTML картки (МУСИТЬ мати data-spm-item="${index}")
//   onSelect   : (item) => void
// }

let _spm        = null;
let _spmConfig  = null;
let _spmTimeout = null;

function ensureSPM() {
  if (document.getElementById('spm-modal')) return;

  const el = document.createElement('div');
  el.id = 'spm-modal';
  el.style.cssText =
    'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); ' +
    'z-index:2000; align-items:center; justify-content:center;';
  el.innerHTML = `
    <div id="spm-box"
         style="background:var(--bg-primary); border-radius:10px; padding:1.5rem;
                width:520px; max-width:92vw; max-height:88vh;
                display:flex; flex-direction:column; gap:0.75rem;
                box-shadow:0 10px 40px rgba(0,0,0,0.45);">
      <h3 id="spm-title" style="margin:0;"></h3>
      <p  id="spm-hint"  style="margin:0; font-size:0.85rem; color:var(--text-secondary); display:none;"></p>
      <div id="spm-inputs" style="display: grid; grid-template-columns: 1fr auto; gap: .5rem;"></div>
      <div id="spm-results"
           style="flex:1; overflow-y:auto; border:1px solid var(--border-color);
                  border-radius:6px; min-height:56px; max-height:340px;"></div>
      <div style="display:flex; justify-content:flex-end;">
        <button class="btn btn-secondary" id="spm-cancel-btn">Скасувати</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  _spm = el;

  // Закриття на фон
  el.addEventListener('click', (e) => {
    if (e.target === el) closeSearchPickerModal();
  });

  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _spm?.style.display !== 'none') closeSearchPickerModal();
  });

  document.getElementById('spm-cancel-btn').addEventListener('click', closeSearchPickerModal);
}

export function openSearchPickerModal(config) {
  ensureSPM();
  _spmConfig = config;
  clearTimeout(_spmTimeout);

  document.getElementById('spm-title').textContent = config.title || '';

  const hintEl = document.getElementById('spm-hint');
  if (config.hint) {
    hintEl.textContent = config.hint;
    hintEl.style.display = 'block';
  } else {
    hintEl.style.display = 'none';
  }

  // Генеруємо поля вводу
  const inputsEl = document.getElementById('spm-inputs');
  inputsEl.innerHTML = config.inputs.map(inp => `
    <div class="form-group" style="margin:0;">
      <label style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.25rem; display:block;">
        ${inp.label}
      </label>
      <input type="${inp.type || 'text'}"
             id="spm-input-${inp.id}"
             placeholder="${inp.placeholder || ''}"
             style="width:100%;"
             autocomplete="off">
    </div>
  `).join('');

  document.getElementById('spm-results').innerHTML =
    '<div style="padding:1rem; text-align:center; color:var(--text-secondary); font-size:0.875rem;">Введіть текст для пошуку</div>';

  // Прив'язуємо пошук до кожного поля
  config.inputs.forEach(inp => {
    document.getElementById(`spm-input-${inp.id}`)
      ?.addEventListener('input', () => {
        clearTimeout(_spmTimeout);
        _spmTimeout = setTimeout(_runSPMSearch, 300);
      });
  });

  _spm.style.display = 'flex';

  // Фокус на перше поле
  setTimeout(() => document.getElementById(`spm-input-${config.inputs[0]?.id}`)?.focus(), 50);
}

export function closeSearchPickerModal() {
  if (!_spm) return;
  _spm.style.display = 'none';
  _spmConfig = null;
  clearTimeout(_spmTimeout);
}

async function _runSPMSearch() {
  if (!_spmConfig) return;

  const values  = {};
  let hasValue  = false;

  _spmConfig.inputs.forEach(inp => {
    const val = document.getElementById(`spm-input-${inp.id}`)?.value.trim() || '';
    values[inp.id] = val;
    if (val) hasValue = true;
  });

  const el = document.getElementById('spm-results');

  if (!hasValue) {
    el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary); font-size:0.875rem;">Введіть текст для пошуку</div>';
    return;
  }

  el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary); font-size:0.875rem;">Пошук…</div>';

  try {
    const items = await _spmConfig.searchFn(values);

    if (!items.length) {
      el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary); font-size:0.875rem;">Нічого не знайдено</div>';
      return;
    }

    el.innerHTML = items.map((item, idx) => _spmConfig.renderItem(item, idx)).join('');

    // Прив'язуємо клік до кожної картки
    el.querySelectorAll('[data-spm-item]').forEach(row => {
      const idx = parseInt(row.dataset.spmItem);
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const onSelect = _spmConfig.onSelect;
        const item = items[idx];
        closeSearchPickerModal();
        onSelect(item);
      });
      row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-secondary)'; });
      row.addEventListener('mouseleave', () => { row.style.background = '';                    });
    });
  } catch (err) {
    el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--danger); font-size:0.875rem;">Помилка пошуку</div>';
    console.error('searchPickerModal error:', err);
  }
}