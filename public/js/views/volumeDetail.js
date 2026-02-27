import { fetchItem, fetchItems, updateItem } from '../api/api.js';
import { publisherSearchHTML, initPublisherSearch, renderThemeChips } from '../utils/publisherSearch.js';
import { locg_img, cv_img_path_small, cv_logo_svg, formatDate, formatCoverDate, formatReleaseDate, showError, showLoading, initDetailPage } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { openModal } from '../components/modal.js';
import { buildThemeChipsHTML, buildThemeCheckboxListHTML, filterThemeCheckboxList } from '../utils/themeChips.js';

const API_BASE = 'http://localhost:7000/api';

export async function renderVolumeDetail(params) {
    const volumeId = params.id;
    if (!volumeId) { navigate('volumes'); return; }

    initDetailPage();
    showLoading();

    try {
        const [volume, themesData, seriesData] = await Promise.all([
            fetchItem('volumes', volumeId),
            fetch(`${API_BASE}/volumes/${volumeId}/themes`).then(r => r.json()),
            fetch(`${API_BASE}/volumes/${volumeId}/series`).then(r => r.json())
        ]);

        const [issuesResult, volumeCollectionsData] = await Promise.all([
            fetchItems('issues', { volume_id: volume.cv_id, limit: 1000 }),
            fetch(`${API_BASE}/collections/by-volume/${volume.cv_id}`).then(r => r.ok ? r.json() : { data: [] })
        ]);
        const volumeThemes = themesData.data || [];
        const volumeSeries = seriesData.data || [];
        const isCollectionVolume = volumeThemes.some(t => t.id === 44);
        const volCollections = volumeCollectionsData.data || [];

        document.getElementById('page-title').innerHTML = `
            <a href="#" onclick="event.preventDefault(); navigateToParent()" style="color: var(--text-secondary); text-decoration: none;">
                ← Томи
            </a> / ${volume.name || 'Том'}
        `;

        const content = document.getElementById('content');
        content.innerHTML = `
            <div style="max-width: 1200px;">
                <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
                    <div style="flex-shrink: 0;">
                        ${volume.cv_img
                            ? `<img src="${cv_img_path_small + volume.cv_img}" alt="${volume.name}"
                                style="width: 300px; border-radius: 8px; box-shadow: var(--shadow-lg);">`
                            : '<div style="width: 300px; height: 450px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 4rem;">📚</div>'}
                    </div>
                    <div style="flex: 1;">
                        <h1 style="font-size: 2rem; margin-bottom: 1rem;">${volume.name || 'Без назви'}</h1>
                        <div style="display: grid; gap: 0.5rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                            ${volumeSeries.length > 0 ? `
                                <div>
                                    <strong>Серія:</strong>
                                    ${volumeSeries.map(s => `
                                        <span class="theme-badge" style="background:#dcfce7; color:#166534; border-color:#bbf7d0; cursor:pointer;"
                                              onclick="navigate('series-detail', { id: ${s.id} })">${s.name}</span>
                                    `).join(' ')}
                                </div>
                            ` : ''}
                            <div><strong>CV ID:</strong> ${volume.cv_id}</div>
                            <div><strong>CV Slug:</strong> ${volume.cv_slug}</div>
                            ${volume.start_year ? `<div><strong>Рік початку:</strong> ${volume.start_year}</div>` : ''}
                            ${volume.publisher || volume.publisher_name ? `
                                <div>
                                    <strong>Видавець:</strong>
                                    ${volume.publisher_name
                                        ? `${volume.publisher_name} <span style="color: var(--text-secondary); font-size: 0.85rem;">(cv_id: ${volume.publisher})</span>`
                                        : `cv_id: ${volume.publisher}`}
                                </div>
                            ` : ''}
                            <div><strong>Дата створення:</strong> ${formatDate(volume.created_at)}</div>
                            ${volume.lang ? `<div><strong>Мова:</strong> ${volume.lang}</div>` : ''}
                            ${volumeThemes.length > 0 ? `
                                <div>
                                    <strong>Теми:</strong>
                                    ${volumeThemes.map(t => `<span class="theme-badge">${t.ua_name}</span>`).join(' ')}
                                </div>
                            ` : ''}
                            <div style="display: flex; align-items: center; gap: 0.5rem; height:30px;">
                                <a href="https://comicvine.gamespot.com/${volume.cv_slug}/4050-${volume.cv_id}" target="_blank">${cv_logo_svg}</a>
                                ${volume.locg_slug ? `
                                    <a href="https://leagueofcomicgeeks.com/comics/series/${volume.locg_id}/${volume.locg_slug}" target="_blank">
                                        <img src="${locg_img}" alt="League of Comic Geeks" style="height:30px; vertical-align:middle;">
                                    </a>
                                ` : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                            <button class="btn btn-secondary" onclick="editVolumeDetail(${volume.id})">Редагувати том</button>
                            <button class="btn btn-primary" onclick="openAddToSeriesModal(${volume.id}, 'volume')">+ Додати до серії</button>
                            ${isCollectionVolume ? `
                                ${issuesResult.data.length > 0 ? `
                                    <button class="btn btn-warning" onclick="convertAllIssuesToCollections(${volume.id}, ${issuesResult.data.length})">
                                        📚 Конвертувати всі випуски (${issuesResult.data.length}) → збірники
                                    </button>
                                ` : ''}
                                ${volCollections.length > 0 ? `
                                    <button class="btn btn-danger" onclick="convertAllCollectionsToIssues(${volume.id}, ${volCollections.length})">
                                        🔄 Повернути всі збірники (${volCollections.length}) → випуски
                                    </button>
                                ` : ''}
                            ` : `
                                ${issuesResult.data.length > 0 ? `
                                    <button class="btn btn-warning" onclick="convertAllIssuesToCollections(${volume.id}, ${issuesResult.data.length})">
                                        📚 Конвертувати всі (${issuesResult.data.length}) у збірники
                                    </button>
                                ` : ''}
                            `}
                        </div>
                    </div>
                </div>

                ${isCollectionVolume && volCollections.length > 0 ? `
                    <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                        <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">Збірники (${volCollections.length})</h2>
                        <div class="table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Обкладинка</th>
                                        <th>Номер</th>
                                        <th>Назва</th>
                                        <th>Дата обкладинки</th>
                                        <th>Реліз</th>
                                        <th>Дії</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${volCollections.map(col => `
                                        <tr onclick="navigateToCollection(${col.id})" style="cursor: pointer;">
                                            <td>
                                                ${col.cv_img
                                                    ? `<img src="${cv_img_path_small}${col.cv_img.startsWith('/') ? '' : '/'}${col.cv_img}" alt="${col.name}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">`
                                                    : '📗'}
                                            </td>
                                            <td><strong>#${col.issue_number || '?'}</strong></td>
                                            <td>${col.name || 'Без назви'}</td>
                                            <td>${formatCoverDate(col.cover_date)}</td>
                                            <td>${formatReleaseDate(col.release_date)}</td>
                                            <td onclick="event.stopPropagation()">
                                                <button class="btn btn-primary btn-small" onclick="navigateToCollection(${col.id})">Переглянути</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}

                ${issuesResult && issuesResult.length > 0 ? `
                    <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                        <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">Випуски (${issuesResult.data.length})</h2>
                        ${issuesResult.data.length > 0 ? `
                            <div class="table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Обкладинка</th>
                                            <th>Номер</th>
                                            <th>Назва</th>
                                            <th>Обкладинка</th>
                                            <th>Реліз</th>
                                            <th>Дії</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${issuesResult.data.map(issue => `
                                            <tr onclick="navigateToIssue(${issue.id})" style="cursor: pointer;">
                                                <td>
                                                    ${issue.cv_img
                                                        ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}" alt="${issue.name}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">`
                                                        : '📖'}
                                                </td>
                                                <td><strong>#${issue.issue_number || '?'}</strong></td>
                                                <td>${issue.name || 'Без назви'}</td>
                                                <td>${formatCoverDate(issue.cover_date)}</td>
                                                <td>${formatReleaseDate(issue.release_date)}</td>
                                                <td onclick="event.stopPropagation()">
                                                    <button class="btn btn-secondary btn-small" onclick="editIssueFromVolume(${issue.id})">Редагувати</button>
                                                    <button class="btn btn-primary btn-small" onclick="navigateToIssue(${issue.id})">Переглянути</button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : '<p style="text-align:center; color:var(--text-secondary); padding:2rem;">Немає випусків</p>'}
                    </div>
                ` : ''}
            </div>

            ${renderAddToSeriesModal()}
        `;

    } catch (error) {
        console.error('Помилка завантаження тому:', error);
        showError('Помилка завантаження даних');
    }
}

// ===== МОДАЛКА "ДОДАТИ ДО СЕРІЇ" (shared з collectionDetail) =====

function renderAddToSeriesModal() {
    return `
        <div id="add-to-series-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
            <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:500px; max-width:90vw;">
                <h3 style="margin-bottom:1rem;">Додати до серії</h3>
                <div class="form-group">
                    <input type="text" id="series-search-input" placeholder="Введіть назву серії..." style="width:100%;">
                </div>
                <div id="series-search-results" style="max-height:320px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:1rem; min-height:48px;"></div>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn btn-secondary" onclick="closeAddToSeriesModal()">Скасувати</button>
                </div>
            </div>
        </div>
    `;
}

let addToSeriesItemId = null;
let addToSeriesType = null; // 'volume'
let seriesSearchTimeout = null;

window.openAddToSeriesModal = (itemId, type) => {
    addToSeriesItemId = itemId;
    addToSeriesType = type;
    document.getElementById('add-to-series-modal').style.display = 'flex';
    const input = document.getElementById('series-search-input');
    input.value = '';
    document.getElementById('series-search-results').innerHTML = '';
    input.oninput = (e) => {
        clearTimeout(seriesSearchTimeout);
        seriesSearchTimeout = setTimeout(() => searchSeriesForAdd(e.target.value), 300);
    };
    input.focus();
};

window.closeAddToSeriesModal = () => {
    document.getElementById('add-to-series-modal').style.display = 'none';
    addToSeriesItemId = null;
    addToSeriesType = null;
};

async function searchSeriesForAdd(query) {
    if (!query.trim()) { document.getElementById('series-search-results').innerHTML = ''; return; }
    const res = await fetch(`${API_BASE}/series?search=${encodeURIComponent(query)}&limit=20`);
    const result = await res.json();
    const el = document.getElementById('series-search-results');
    if (!result.data?.length) {
        el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>';
        return;
    }
    el.innerHTML = result.data.map(s => `
        <div onclick="addItemToSeries(${s.id})"
             style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
             onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
            ${s.cv_img
                ? `<img src="${s.cv_img}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; flex-shrink:0;">`
                : '<div style="width:40px; height:40px; background:var(--bg-secondary); border-radius:4px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:1.2rem;">📚</div>'}
            <span style="font-weight:500;">${s.name}</span>
        </div>
    `).join('');
}

window.addItemToSeries = async (seriesId) => {
    const endpoint = addToSeriesType === 'volume'
        ? `${API_BASE}/series/${seriesId}/volumes`
        : `${API_BASE}/series/${seriesId}/collections`;
    const body = addToSeriesType === 'volume'
        ? { volume_id: addToSeriesItemId }
        : { collection_id: addToSeriesItemId };

    const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    window.closeAddToSeriesModal();
    // Перезавантажуємо поточну сторінку
    const url = new URL(window.location);
    const id = url.searchParams.get('id');
    if (id) renderVolumeDetail({ id });
};

// ===== ФОРМИ РЕДАГУВАННЯ =====



async function getVolumeFormHTML(volume = null) {
  const [themesRes, currentThemesRes] = await Promise.all([
    fetch(`${API_BASE}/themes`).then(r => r.json()),
    volume?.id
      ? fetch(`${API_BASE}/volumes/${volume.id}/themes`).then(r => r.json())
      : Promise.resolve({ data: [] })
  ]);

  const allThemes = themesRes.data || [];
  const currentThemeIds = new Set((currentThemesRes.data || []).map(t => t.id));

  // Отримуємо ім'я видавника якщо є ID
  let publisherName = volume?.publisher_name || '';

  return `
    <form id="edit-form">
      <div class="form-row">
        <div class="form-group"><label>CV ID *</label><input type="number" name="cv_id" value="${volume?.cv_id || ''}" required></div>
        <div class="form-group"><label>CV Slug *</label><input type="text" name="cv_slug" value="${volume?.cv_slug || ''}" required></div>
      </div>
      <div class="form-group"><label>Назва</label><input type="text" name="name" value="${volume?.name || ''}"></div>
      <div class="form-group"><label>URL зображення</label><input type="text" name="cv_img" value="${volume?.cv_img || ''}"></div>
      <div class="form-row">
        <div class="form-group"><label>Мова</label><input type="text" name="lang" value="${volume?.lang || ''}" placeholder="en, uk"></div>
        <div class="form-group"><label>Рік початку</label><input type="number" name="start_year" value="${volume?.start_year || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>LocG ID</label><input type="number" name="locg_id" value="${volume?.locg_id || ''}"></div>
        <div class="form-group"><label>LocG Slug</label><input type="text" name="locg_slug" value="${volume?.locg_slug || ''}"></div>
      </div>

      ${publisherSearchHTML({
        publisherId: volume?.publisher || '',
        publisherName,
        inputId: 'vol-pub-input',
        hiddenId: 'vol-pub-id',
        resultsId: 'vol-pub-results',
        chipId: 'vol-pub-chip'
      })}

        <!-- Теми: чіпи + пошук + чекбокси -->
        <div class="form-group">
            <label>Теми</label>
            <div id="vol-theme-chips" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-bottom:0.5rem; min-height:0; align-items:center;">
            ${buildThemeChipsHTML(
                allThemes.filter(t => currentThemeIds.has(t.id)),
                'removeThemeChipVolume'
            )}
            </div>
            <input type="text" id="theme-search" placeholder="Пошук тем..." style="margin-bottom:0.5rem; width:100%;"
                oninput="filterThemesVol(this.value)">
            <div id="themes-list" class="themes-checkbox-list">
            ${buildThemeCheckboxListHTML(allThemes, currentThemeIds, 'onThemeCheckboxChangeVol')}
            </div>
        </div>
    </form>
  `;
}

function getIssueFormHTML(issue = null) {
    return `
        <form id="edit-form">
            <div class="form-row">
                <div class="form-group"><label>CV ID *</label><input type="number" name="cv_id" value="${issue?.cv_id || ''}" required></div>
                <div class="form-group"><label>CV Slug *</label><input type="text" name="cv_slug" value="${issue?.cv_slug || ''}" required></div>
            </div>
            <div class="form-group"><label>Назва</label><input type="text" name="name" value="${issue?.name || ''}"></div>
            <div class="form-row">
                <div class="form-group"><label>Volume CV ID</label><input type="number" name="cv_vol_id" value="${issue?.cv_vol_id || ''}"></div>
                <div class="form-group"><label>Номер випуску</label><input type="text" name="issue_number" value="${issue?.issue_number || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Дата обкладинки</label><input type="date" name="cover_date" value="${issue?.cover_date || ''}"></div>
                <div class="form-group"><label>Дата випуску</label><input type="date" name="release_date" value="${issue?.release_date || ''}"></div>
            </div>
            <div class="form-group"><label>URL зображення</label><input type="url" name="cv_img" value="${issue?.cv_img || ''}"></div>
        </form>
    `;
}

window.navigateToIssue = (id) => navigate('issue-detail', { id });

window.editVolumeDetail = async (id) => {
  const volume = await fetch(`${API_BASE}/volumes/${id}`).then(r => r.json());
  const formHTML = await getVolumeFormHTML(volume);

  openModal('Редагувати том', formHTML, async (data) => { // wide модалка → додай , { wide: true } як 4й параметр
    const themeCheckboxes = document.querySelectorAll('#edit-form input[name="theme_ids"]:checked');
    const theme_ids = Array.from(themeCheckboxes).map(cb => parseInt(cb.value));
    const publisherId = document.getElementById('vol-pub-id')?.value;

    await fetch(`${API_BASE}/volumes/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        theme_ids,
        publisher: publisherId ? parseInt(publisherId) : null,
        locg_id: data.locg_id ? parseInt(data.locg_id) : null,
        start_year: data.start_year ? parseInt(data.start_year) : null,
      })
    });
    await renderVolumeDetail({ id });
    await window.updateStats();
  });

  // Ініціалізуємо пошук видавництва після рендеру
  requestAnimationFrame(() => {
    initPublisherSearch({
      inputId: 'vol-pub-input',
      hiddenId: 'vol-pub-id',
      resultsId: 'vol-pub-results',
      chipId: 'vol-pub-chip'
    });
    initVolThemeChips();
  });
};

function initVolThemeChips() {
  // Встановлюємо обробники на всі чекбокси
  document.querySelectorAll('#themes-list input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      rebuildVolThemeChips();
    });
  });
}

function rebuildVolThemeChips() {
  const container = document.getElementById('vol-theme-chips');
  if (!container) return;

  const checked = document.querySelectorAll('#themes-list input[type="checkbox"]:checked');
  const selectedThemes = Array.from(checked).map(cb => ({
    id: parseInt(cb.value),
    name: cb.closest('label')?.querySelector('span')?.textContent?.trim() || '',
    type: cb.dataset.type || 'theme',
  }));

  container.innerHTML = buildThemeChipsHTML(selectedThemes, 'removeThemeChipVolume');
}

window.removeThemeChipVolume = (themeId) => {
  const cb = document.querySelector(`#themes-list input[value="${themeId}"]`);
  if (cb) {
    cb.checked = false;
  }
  rebuildVolThemeChips();
};

window.onThemeCheckboxChangeVol = (themeId, themeName, checked) => {
  rebuildVolThemeChips();
};

window.filterThemesVol = (q) => {
  filterThemeCheckboxList(q, 'themes-list');
};

window.editIssueFromVolume = async (id) => {
    const issue = await fetch(`${API_BASE}/issues/${id}`).then(r => r.json());
    openModal('Редагувати випуск', getIssueFormHTML(issue), async (data) => {
        await fetch(`${API_BASE}/issues/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const volumeId = new URL(window.location).searchParams.get('id');
        if (volumeId) await renderVolumeDetail({ id: volumeId });
        await window.updateStats();
    });
};

window.convertAllIssuesToCollections = async (volumeId, count) => {
    if (!confirm(`Конвертувати всі ${count} випусків цього тома у збірники? Цю дію не можна скасувати.`)) return;
    try {
        const res = await fetch(`${API_BASE}/volumes/${volumeId}/convert-all-to-collections`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Помилка конвертації'); return; }
        alert(`✅ ${data.message}`);
        await renderVolumeDetail({ id: volumeId });
        await window.updateStats();
    } catch (e) {
        alert('Помилка під час конвертації');
    }
};

window.convertAllCollectionsToIssues = async (volumeId, count) => {
    if (!confirm(`Повернути всі ${count} збірників цього тома назад у випуски? Тема "Collection" буде видалена з тому.`)) return;
    try {
        const res = await fetch(`${API_BASE}/volumes/${volumeId}/convert-all-collections-to-issues`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Помилка конвертації'); return; }
        alert(`✅ ${data.message}`);
        await renderVolumeDetail({ id: volumeId });
        await window.updateStats();
    } catch (e) {
        alert('Помилка під час конвертації');
    }
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ['edit-order-modal', 'add-issue-ro-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.style.display === 'flex') el.style.display = 'none';
    });
    // Також стандартна модалка
    const mainModal = document.getElementById('modal');
    if (mainModal?.classList.contains('active')) {
      mainModal.classList.remove('active');
    }
  }
});

window.navigateToCollection = (id) => navigate('collection-detail', { id });