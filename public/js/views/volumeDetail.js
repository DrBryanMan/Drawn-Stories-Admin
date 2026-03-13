import { API_BASE, locg_img, cv_img_path_small, cv_logo_svg, formatDate, formatCoverDate, formatReleaseDate, showError, showLoading, initDetailPage, LANG_MAP, langDisplay } from '../utils/helpers.js';
import { buildThemeChipsHTML, buildThemeCheckboxListHTML, filterThemeCheckboxList, buildThemeChipsViewHTML } from '../utils/themeChips.js';
import { publisherSearchHTML, initPublisherSearch, renderThemeChips } from '../utils/publisherSearch.js';
import { fetchItem, fetchItems } from '../api/api.js';
import { mountVolumeRelations } from '../components/volumeRelations.js';
import { openModal } from '../components/modal.js';
import { navigate, buildUrl } from '../utils/router.js';

// ===== ПАГІНАЦІЯ ВИПУСКІВ ================================================

const ISSUES_PAGE_SIZE = 100;
let _issuesPage = 0;
let _chaptersPage = 0;
let _collectionsPage = 0;
let _currentVolumeId = null;
let _allChapters = [];
let _issuesSort = { key: 'issue_number', dir: 'desc' };
let _chaptersSort = { key: 'issue_number', dir: 'desc' };
let _collectionsSort = { key: 'issue_number', dir: 'desc' };

export async function renderVolumeDetail(params) {
    const volumeId = params.id;
    if (!volumeId) { navigate('volumes'); return; }

    initDetailPage();
    showLoading();

    try {
        const [volume, themesData, seriesData] = await Promise.all([
            fetchItem('volumes', volumeId),
            fetch(`${API_BASE}/volumes/${volumeId}/themes`).then(r => r.json()),
            fetch(`${API_BASE}/volumes/${volumeId}/series`).then(r => r.json()),
        ]);

        _currentVolumeId = volume.id;
        const volumeThemes = themesData.data || [];
        const volumeSeries = seriesData.data || [];
        const isCollectionVolume  = volumeThemes.some(t => t.id === 44);
        const isMagazineVolume    = volumeThemes.some(t => t.id === 35);
        const isMangaVolume       = volumeThemes.some(t => t.id === 36);
        const isMangaSourceVolume = !isCollectionVolume && !!(volume.hikka_slug || volume.mal_id);

        // Другий етап — тільки потрібні запити залежно від типу тому
        let issuesResult            = { data: [] };
        let volumeCollectionsData   = { data: [] };
        let collectionsFromIssuesData = { data: [] };
        let translationsData        = { data: [] };
        let translationParentData   = { data: null };
        let magazineChildrenData    = { data: [] };
        let magazineParentData      = { data: null };

        if (isMangaSourceVolume) {
            // Для манґа-тому завантажуємо журнал, збірники і переклади
            [
                magazineChildrenData,
                magazineParentData,
                collectionsFromIssuesData,
                translationsData,
                translationParentData,
            ] = await Promise.all([
                fetch(`${API_BASE}/volumes/${volumeId}/magazine-children`).then(r => r.ok ? r.json() : { data: [] }),
                fetch(`${API_BASE}/volumes/${volumeId}/magazine-parent`).then(r => r.ok ? r.json() : { data: [] }),
                fetch(`${API_BASE}/volumes/${volumeId}/collections-from-issues`).then(r => r.ok ? r.json() : { data: [] }),
                fetch(`${API_BASE}/volumes/${volumeId}/translations`).then(r => r.ok ? r.json() : { data: [] }),
                fetch(`${API_BASE}/volumes/${volumeId}/translation-parent`).then(r => r.ok ? r.json() : { data: null }),
            ]);
        } else {
            [
                issuesResult,
                volumeCollectionsData,
                collectionsFromIssuesData,
                translationsData,
                translationParentData,
                magazineChildrenData,
                magazineParentData,
            ] = await Promise.all([
                volume.cv_id
                    ? fetchItems('issues', { volume_id: volume.cv_id })
                    : Promise.resolve({ data: [] }),
                volume.cv_id
                    ? fetch(`${API_BASE}/collections/by-volume/${volume.cv_id}`).then(r => r.ok ? r.json() : { data: [] })
                    : Promise.resolve({ data: [] }),
                fetch(`${API_BASE}/volumes/${volumeId}/collections-from-issues`).then(r => r.ok ? r.json() : { data: [] }),
                fetch(`${API_BASE}/volumes/${volumeId}/translations`).then(r => r.ok ? r.json() : { data: [] }),
                fetch(`${API_BASE}/volumes/${volumeId}/translation-parent`).then(r => r.ok ? r.json() : { data: null }),
                fetch(`${API_BASE}/volumes/${volumeId}/magazine-children`).then(r => r.ok ? r.json() : { data: [] }),
                fetch(`${API_BASE}/volumes/${volumeId}/magazine-parent`).then(r => r.ok ? r.json() : { data: null }),
            ]);
        }
        const volCollections = volumeCollectionsData.data || [];
        const volCollectionsFromIssues = collectionsFromIssuesData.data || [];
        const translations = translationsData.data || [];
        const translationParent = translationParentData.data || null;
        const magazineChildren = magazineChildrenData.data || [];
        const magazineParents = magazineParentData.data || [];

        document.getElementById('page-title').innerHTML = `
            <a href="#" onclick="event.preventDefault(); navigateToParent()">
                ← Томи
            </a> ${isMangaSourceVolume
                ? `/ hikka: ${volume.hikka_slug} / MAL: ${volume.mal_id}`
                : `/${volume.cv_slug}/4050-${volume.cv_id}`}
        `;


        const content = document.getElementById('content');
        content.innerHTML = `
            <div style="max-width: 1200px;">
                <!-- ── Шапка тому ────────────────────────────────────────── -->
                <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
                    <div style="flex-shrink: 0;">
                        ${volume.cv_img
                            ? `<img src="${cv_img_path_small + volume.cv_img}" alt="${volume.name}"
                                style="width: 300px; border-radius: 8px; box-shadow: var(--shadow-lg);">`
                            : volume.hikka_img
                                ? `<img src="${volume.hikka_img}" alt="${volume.name}"
                                    style="width: 300px; border-radius: 8px; box-shadow: var(--shadow-lg);">`
                                : '<div style="width: 300px; height: 450px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 4rem;">📚</div>'
                        }
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1em;">
                                ${!isMangaSourceVolume
                                    ? `<a href="https://comicvine.gamespot.com/${volume.cv_slug}/4050-${volume.cv_id}" target="_blank">${cv_logo_svg}</a>`
                                    : ''}
                                ${isMangaSourceVolume && volume.hikka_slug
                                    ? `<a href="https://hikka.io/manga/${volume.hikka_slug}" target="_blank" style="color:var(--accent); font-size:0.85rem; text-decoration:none;">hikka.io ↗</a>`
                                    : ''}
                                ${isMangaSourceVolume && volume.mal_id
                                    ? `<a href="https://myanimelist.net/manga/${volume.mal_id}" target="_blank" style="color:var(--accent); font-size:0.85rem; text-decoration:none;">MAL ↗</a>`
                                    : ''}                            ${volume.locg_slug ? `
                                <a href="https://leagueofcomicgeeks.com/comics/series/${volume.locg_id}/${volume.locg_slug}" target="_blank">
                                    <img src="${locg_img}" alt="League of Comic Geeks" style="height:30px; vertical-align:middle;">
                                </a>
                            ` : ''}
                        </div>
                    </div>
                    <div style="flex: 1;">
                        <h1 style="font-size: 2rem; margin-bottom: 1rem;">${volume.name || 'Без назви'}</h1>
                        <div style="display: grid; gap: 0.5rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                            ${volume.start_year ? `<div><strong>Рік початку:</strong> ${volume.start_year}</div>` : ''}
                            ${volume.publisher || volume.publisher_name ? `
                                    <div>
                                        <strong>Видавець:</strong>
                                    ${volume.publisher_name
                                            ? `${volume.publisher_name} <span style="color: var(--text-secondary); font-size: 0.85rem;">(db_id: ${volume.publisher})</span>`
                                            : `db_id: ${volume.publisher}`}
                                    </div>
                                ` : ''}
                            ${volume.lang ? `<div><strong>Мова:</strong> ${langDisplay(volume.lang)}</div>` : ''}
                            ${volumeSeries.length > 0 ? `
                                    <div>
                                        <strong>Серія:</strong>
                                    ${volumeSeries.map(s => `
                                            <span class="theme-badge" style="background:#dcfce7; color:#166534; border-color:#bbf7d0; cursor:pointer;"
                                                onclick="navigate('series-detail', { id: ${s.id} })">${s.name}</span>
                                        `).join(' ')}
                                    </div>
                                ` : ''}
                            <div id="col-theme-chips" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-bottom:0.5rem; min-height:0; align-items:center;">
                                ${buildThemeChipsViewHTML(volumeThemes)}
                            </div>
                            <div><strong>Дата додавання:</strong> ${formatDate(volume.created_at)}</div>
                            ${volume.description ? `<div class="form-group">${volume.description}</div>` : ''}
                        </div>
                        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                            <button class="btn btn-secondary" onclick="editVolumeDetail(${volume.id})">Редагувати том</button>
                            <button class="btn btn-primary" onclick="openAddToSeriesModal(${volume.id}, 'volume')">+ Додати до серії</button>
                            ${isMangaVolume && isCollectionVolume && volume.hikka_slug ? `
                                <button class="btn btn-primary" onclick="createMangaSourceVolume(${volume.id}, '${volume.hikka_slug}', '${(volume.name || '').replace(/'/g, "\\'")}', ${volume.mal_id || 'null'})">
                                    📖 Створити том манґи
                                </button>
                            ` : ''}
                            ${!isMagazineVolume ? `
                                ${!translationParent && translations.length === 0 && magazineParents.length === 0 ? `
                                    <button class="btn btn-secondary" onclick="openVolumePickerModal('translation-set-parent', ${volume.id})">🌐 Додати до першоджерела</button>
                                ` : ''}
                                ${magazineParents.length === 0 && !translationParent ? `
                                    <button class="btn btn-secondary" onclick="openVolumePickerModal('magazine-set-parent', ${volume.id})">📰 Додати до журналу</button>
                                ` : ''}
                                ${!isMangaSourceVolume ? `
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
                                ` : ''}
                            ` : ''}
                            ${volume.hikka_slug && !isCollectionVolume ? `
                                <button class="btn btn-primary" id="gen-chapters-btn"
                                        onclick="generateChapters(${volume.id}, '${volume.hikka_slug}')">
                                    ⚡ Згенерувати розділи
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- ── Переклади: список дочірніх (цей том — оригінал) ───── -->
                
                ${!isMagazineVolume && (translations.length > 0 || !translationParent) ? `
                    <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem;">
                            <h2 style="font-size:1.25rem; margin:0;">🌐 Переклади (${translations.length})</h2>
                            <button class="btn btn-primary btn-small"
                                onclick="openVolumePickerModal('translation-add', ${volume.id})">
                                + Додати переклад
                            </button>
                        </div>
                        ${translations.length > 0 ? `
                            <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                            ${translations.map(t => `
                                    <div style="display:flex; align-items:center; gap: .3rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: .3rem .6rem; cursor:pointer;"
                                        onclick="navigate('volume-detail', { id: ${t.id} })">
                                        <span style="font-size:0.9rem;">${t.lang ? `<i style="color: skyblue;">${langDisplay(t.lang)}</i> ` : ''}${t.name}</span>
                                        ${t.collections_count ? `<span class="badge" style="font-size: .75rem; padding: .1rem .4rem; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-secondary);">${t.collections_count}</span>` : ''}
                                        <button class="btn btn-notext btn-nobg btn-danger btn-small"
                                            onclick="event.stopPropagation(); removeTranslation(${volume.id}, ${t.id})">✕</button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `<p style="color:var(--text-secondary); margin:0; font-size:0.9rem;">Немає прив'язаних перекладів.</p>`}
                    </div>
                ` : ''}

                <!-- ── Оригінал (цей том — переклад) ────────────────────── -->
                ${translationParent && !isMangaSourceVolume ? `
                    <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem;">
                            <h2 style="font-size:1.25rem; margin:0;">📖 Оригінал</h2>
                            <button class="btn btn-danger btn-small"
                                onclick="removeTranslation(${translationParent.id}, ${volume.id})">
                                Від'єднати
                            </button>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.75rem; cursor:pointer;"
                             onclick="navigate('volume-detail', { id: ${translationParent.id} })">
                            ${translationParent.cv_img
                                ? `<img src="${cv_img_path_small}${translationParent.cv_img.startsWith('/') ? '' : '/'}${translationParent.cv_img}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">`
                                : translationParent.hikka_img
                                    ? `<img src="${translationParent.hikka_img}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">`
                                    : '<div style="width:48px;height:48px;background:var(--bg-secondary);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">📚</div>'}
                                <div>
                                    <div style="font-weight:600;">${translationParent.lang ? `[${translationParent.lang}] ` : ''}${translationParent.name}</div>
                                    ${translationParent.name_uk ? `<div style="font-size:0.85rem; color:var(--text-secondary);">🇺🇦 ${translationParent.name_uk}</div>` : ''}
                                    ${!translationParent.cv_id && translationParent.hikka_slug ? `<div style="font-size:0.85rem; color:var(--text-secondary);">hikka: ${translationParent.hikka_slug}</div>` : ''}
                                ${translationParent.publisher_name ? `<div style="font-size:0.85rem; color:var(--text-secondary);">${translationParent.publisher_name}</div>` : ''}
                                ${translationParent.collections_count ? `<div style="font-size:0.85rem; color:var(--text-secondary);">📚 ${translationParent.collections_count} збірн.</div>` : ''}
                                </div>
                        </div>
                    </div>
                ` : ''}

                <!-- ── Журнал: список підтомів (цей том — журнал) ─────────── -->
                ${isMagazineVolume || magazineChildren.length > 0 ? `
                    <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem;">
                            <h2 style="font-size:1.25rem; margin:0;">📰 Томи журналу (${magazineChildren.length})</h2>
                            <button class="btn btn-primary btn-small"
                                onclick="openVolumePickerModal('magazine-add', ${volume.id})">
                                + Додати том
                            </button>
                        </div>
                    ${magazineChildren.length > 0 ? `
                            <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                            ${magazineChildren.map(t => `
                                    <div style="display:flex; align-items:center; gap:0.5rem; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:0.4rem 0.75rem; cursor:pointer;"
                                         onclick="navigate('volume-detail', { id: ${t.id} })">
                                    ${t.cv_img ? `<img src="${cv_img_path_small}${t.cv_img.startsWith('/') ? '' : '/'}${t.cv_img}" style="width:28px;height:28px;object-fit:cover;border-radius:3px;flex-shrink:0;">` : ''}
                                        <span style="font-size:0.9rem;">${t.lang ? `<strong>[${t.lang}]</strong> ` : ''}${t.name}${t.start_year ? ` <span style="color:var(--text-secondary)">(${t.start_year})</span>` : ''}</span>
                                        <button class="btn btn-danger btn-small" style="padding:0.15rem 0.4rem; font-size:0.75rem; margin-left:0.25rem;"
                                            onclick="event.stopPropagation(); removeMagazineChild(${volume.id}, ${t.id})">✕</button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `<p style="color:var(--text-secondary); margin:0; font-size:0.9rem;">Немає підтомів. Натисніть "+ Додати том" щоб прив'язати том до цього журналу.</p>`}
                    </div>
                ` : ''}

                <!-- ── Батьківський журнал (цей том входить у журнал) ─────── -->
                ${magazineParents.length > 0 ? `
                    <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                        <h2 style="font-size:1.25rem; margin:0 0 1rem;">📰 Журнали (${magazineParents.length})</h2>
                        <div style="display:flex; flex-direction:column; gap:0.5rem;">
                            ${magazineParents.map(mp => `
                                <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:0.5rem 0.75rem;">
                                    <div style="display:flex; align-items:center; gap:0.75rem; cursor:pointer; flex:1;"
                                        onclick="navigate('volume-detail', { id: ${mp.id} })">
                                        ${mp.cv_img
                                            ? `<img src="${cv_img_path_small}${mp.cv_img.startsWith('/') ? '' : '/'}${mp.cv_img}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;">`
                                            : '<div style="width:40px;height:40px;background:var(--bg-tertiary);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">📰</div>'}
                                        <div>
                                            <div style="font-weight:600;">${mp.name}</div>
                                            ${mp.publisher_name ? `<div style="font-size:0.8rem; color:var(--text-secondary);">${mp.publisher_name}</div>` : ''}
                                        </div>
                                    </div>
                                    <button class="btn btn-danger btn-small" style="margin-left:0.75rem;"
                                        onclick="event.stopPropagation(); removeMagazineChild(${mp.id}, ${volume.id})">
                                        Від'єднати
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- ── Хронологія та зв'язки ──────────────────────────── -->
                ${!isMangaSourceVolume ? `<div id="volume-relations-mount"></div>` : ''}

                <!-- ── Збірники (collections-from-issues) ────────────────── -->
                ${!isCollectionVolume && volCollectionsFromIssues.length > 0 ? (() => {
                    // Групуємо за батьківським томом збірника
                    const groups = [];
                    const groupMap = new Map();
                    for (const col of volCollectionsFromIssues) {
                        const key = col.parent_vol_id ?? `__no_vol__${col.cv_vol_id}`;
                        if (!groupMap.has(key)) {
                            groupMap.set(key, {
                                vol_id:   col.parent_vol_id,
                                vol_name: col.parent_vol_name || col.cv_vol_id || '—',
                                vol_lang: col.parent_vol_lang || null,
                                cols: [],
                            });
                            groups.push(groupMap.get(key));
                        }
                        groupMap.get(key).cols.push(col);
                    }

                    const groupsHtml = groups.map(group => {
                        const langLabel = group.vol_lang ? langDisplay(group.vol_lang) : '';
                        const volLink = group.vol_id
                            ? `onclick="navigate('volume-detail', { id: ${group.vol_id} })"`
                            : '';
                        const colCards = group.cols.map(col => {
                            const range = col.volume_issue_numbers
                                ? formatIssueRanges(typeof col.volume_issue_numbers === 'string'
                                    ? col.volume_issue_numbers.split(',')
                                    : col.volume_issue_numbers)
                                : null;
                            const year = col.cover_date
                                ? col.cover_date.substring(0, 4)
                                : col.release_date
                                    ? col.release_date.substring(0, 4)
                                    : null;
                            return `
                                <div onclick="navigateToCollection(event, ${col.id})"
                                    style="display:flex; flex-direction:column; align-items:center; cursor:pointer;
                                        background:var(--bg-secondary); border:1px solid var(--border-color);
                                        border-radius:8px; padding:.2em;
                                        transition:box-shadow 0.15s;"
                                    onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.18)'"
                                    onmouseout="this.style.boxShadow='none'">
                                    ${col.cv_img
                                        ? `<img src="${cv_img_path_small}${col.cv_img.startsWith('/') ? '' : '/'}${col.cv_img}"
                                            style="width: 100px; height: 160px; object-fit:cover;border-radius:4px;margin-bottom:.25rem;">`
                                        : `<div style="width:100px;height:160px;background:var(--bg-tertiary);border-radius:4px;
                                                    display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:.25rem;">📗</div>`}
                                    <div style="font-size:0.75rem; font-weight:600; text-align:center; line-height:1.2;">
                                        #${col.issue_number || '?'}
                                    </div>
                                    ${year ? `<div style="font-size:0.7rem; color:var(--text-secondary);">${year}</div>` : ''}
                                    ${range ? `<div style="font-size:0.65rem; color:var(--text-secondary); text-align:center;">${range}</div>` : ''}
                                </div>`;
                        }).join('');

                        return `
                            <div style="margin-bottom:1.25rem;">
                                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
                                    <span style="font-size:0.95rem; font-weight:600; cursor:${group.vol_id ? 'pointer' : 'default'};
                                                color:var(--text-primary);" ${volLink}>
                                        ${group.vol_name}
                                    </span>
                                    ${langLabel ? `
                                        <span style="font-size: .75rem; background: var(--bg-tertiary); padding: .1em .4em; color: var(--text-secondary);">
                                            ${langLabel}
                                        </span>
                                    ` : ''}
                                </div>
                                <div style="display:flex; flex-wrap:wrap; gap: .6em;">
                                    ${colCards}
                                </div>
                            </div>`;
                    }).join('');

                    return `
                        <div style="background:var(--bg-primary); padding: 1em; border-radius:8px;
                                    border:1px solid var(--border-color); margin-bottom:1.5rem;">
                            <h2 style="font-size:1.2rem; margin-bottom:1rem;">
                                Входить у збірники (${volCollectionsFromIssues.length})
                            </h2>
                            ${groupsHtml}
                        </div>`;
                })() : ''}
                <!-- ── Збірники тому (якщо Collection-том) ───────────────── -->
                ${isCollectionVolume ? '<div id="collections-block"></div>' : ''}

                <!-- ── Випуски манґи ────────────────────────────────────────────── -->
                ${volume.hikka_slug && !isCollectionVolume ? `<div id="chapters-block" style="margin-top:2rem;"></div>` : ''}

                <!-- ── Випуски ────────────────────────────────────────────── -->
                ${!isMangaSourceVolume && issuesResult && issuesResult.data.length > 0 ? '<div id="issues-block"></div>' : ''}

                ${renderAddToSeriesModal()}

                <!-- ── Модалка вибору тому (переклади + журнали) ─────────── -->
                <div id="volume-picker-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
                    <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:520px; max-width:90vw;">
                        <h3 id="volume-picker-title" style="margin-bottom:1rem;">Вибрати том</h3>
                        <div style="display:flex; gap:0.5rem; margin-bottom:0.75rem;">
                            <div class="form-group" style="flex:1; margin:0;">
                                <input type="text" id="volume-picker-search" placeholder="Пошук за назвою..." style="width:100%;">
                            </div>
                            <div class="form-group" style="width:110px; margin:0;">
                                <input type="number" id="volume-picker-dbid" placeholder="DB ID" style="width:100%;">
                            </div>
                            <div class="form-group" style="width:130px; margin:0;">
                                <input type="number" id="volume-picker-cvid" placeholder="CV ID" style="width:100%;">
                            </div>
                        </div>
                        <div id="volume-picker-results" style="max-height:320px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:1rem; min-height:48px;"></div>
                        <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                            <button class="btn btn-secondary" onclick="closeVolumePickerModal()">Скасувати</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // ── Ініціалізація блоку випусків з пагінацією ──────────────────────
        _issuesPage = 0;
        _issuesSort = { key: 'issue_number', dir: 'desc' };
        if (!isMangaSourceVolume && issuesResult && issuesResult.data.length > 0) {
            renderIssuesBlock(issuesResult.data, 0);
        }
        _collectionsPage = 0;
        _collectionsSort = { key: 'issue_number', dir: 'desc' };
        if (isCollectionVolume) {
            renderCollectionsBlock(volCollections, 0);
        }

        // Монтуємо компонент зв'язків
        if (!isMangaSourceVolume) {
            await mountVolumeRelations(
                volumeId,
                'volume-relations-mount',
                () => renderVolumeDetail(params),
            );
        }

        // Якщо це манґа-том — завантажуємо розділи
        if (volume.hikka_slug && !isCollectionVolume) {
            await loadChapters(volume.id);
        }

    } catch (error) {
        console.error('Помилка завантаження тому:', error);
        showError('Помилка завантаження даних');
    }
}

// ===== ПАГІНОВАНИЙ РЕНДЕР БЛОКУ ВИПУСКІВ =================================

function renderIssuesBlock(allIssues, page) {
    const block = document.getElementById('issues-block');
    if (!block) return;

    // ── Сортування ────────────────────────────────────────────
    const sorted = [...allIssues].sort((a, b) => {
        let va, vb;
        if (_issuesSort.key === 'release_date') {
            va = a.release_date || '';
            vb = b.release_date || '';
        } else {
            // issue_number: парсимо як float, щоб 10.1 > 10
            va = parseFloat(a.issue_number) ?? -Infinity;
            vb = parseFloat(b.issue_number) ?? -Infinity;
            if (isNaN(va)) va = -Infinity;
            if (isNaN(vb)) vb = -Infinity;
        }
        if (va < vb) return _issuesSort.dir === 'asc' ? -1 : 1;
        if (va > vb) return _issuesSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    const total = sorted.length;
    const pages = Math.ceil(total / ISSUES_PAGE_SIZE);
    const start = page * ISSUES_PAGE_SIZE;
    const slice = sorted.slice(start, start + ISSUES_PAGE_SIZE);

    // ── Пагінація ─────────────────────────────────────────────
    const paginationHtml = total > ISSUES_PAGE_SIZE ? `
        <div style="display:inline-flex; align-items:center; gap:0.4rem;">
            <button
                id="issues-prev-btn"
                class="btn btn-secondary btn-small"
                ${page === 0 ? 'disabled' : ''}
                style="padding:0.2rem 0.55rem; font-size:0.85rem; line-height:1;"
            >←</button>
            <span style="font-size:0.85rem; color:var(--text-secondary); white-space:nowrap;">
                ${page + 1} / ${pages}
            </span>
            <button
                id="issues-next-btn"
                class="btn btn-secondary btn-small"
                ${page >= pages - 1 ? 'disabled' : ''}
                style="padding:0.2rem 0.55rem; font-size:0.85rem; line-height:1;"
            >→</button>
        </div>
    ` : '';

    block.innerHTML = `
        <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
            <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                    <span>Випуски (${total})</span>
                    <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                        ${paginationHtml}
                    </div>
                </div>
            </h2>
            <div class="table">
                <table>
                    <thead>
                        <tr>
                            <th>Обкладинка</th>
                            <th id="issues-sort-issue_number" style="cursor:pointer; user-select:none;">
                                Номер${_issuesSort.key === 'issue_number' ? (_issuesSort.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                            </th>
                            <th>Назва</th>
                            <th>Дата обкладинки</th>
                            <th id="issues-sort-release_date" style="cursor:pointer; user-select:none;">
                                Реліз${_issuesSort.key === 'release_date' ? (_issuesSort.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                            </th>
                            <th>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${slice.map(issue => `
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
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // ── Обробники пагінації ───────────────────────────────────
    document.getElementById('issues-prev-btn')?.addEventListener('click', () => {
        _issuesPage--;
        renderIssuesBlock(allIssues, _issuesPage);
        block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('issues-next-btn')?.addEventListener('click', () => {
        _issuesPage++;
        renderIssuesBlock(allIssues, _issuesPage);
        block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ── Обробники сортування ─────────────────────────────────
    document.getElementById('issues-sort-issue_number')?.addEventListener('click', () => {
        if (_issuesSort.key === 'issue_number') {
            _issuesSort.dir = _issuesSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            _issuesSort = { key: 'issue_number', dir: 'desc' };
        }
        _issuesPage = 0;
        renderIssuesBlock(allIssues, 0);
    });
    document.getElementById('issues-sort-release_date')?.addEventListener('click', () => {
        if (_issuesSort.key === 'release_date') {
            _issuesSort.dir = _issuesSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            _issuesSort = { key: 'release_date', dir: 'desc' };
        }
        _issuesPage = 0;
        renderIssuesBlock(allIssues, 0);
    });
}

// ===== РЕНДЕР БЛОКУ ЗБІРНИКІВ ============================================

function renderCollectionsBlock(allCollections, page) {
    const block = document.getElementById('collections-block');
    if (!block) return;

    if (!allCollections.length) {
        block.innerHTML = `
            <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px;
                        border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">Збірники (0)</h2>
                <p style="color: var(--text-secondary);">Збірників немає.</p>
            </div>`;
        return;
    }

    const sorted = [...allCollections].sort((a, b) => {
        let va, vb;
        if (_collectionsSort.key === 'release_date') {
            va = a.release_date || '';
            vb = b.release_date || '';
        } else {
            va = parseFloat(a.issue_number);
            vb = parseFloat(b.issue_number);
            if (isNaN(va)) va = -Infinity;
            if (isNaN(vb)) vb = -Infinity;
        }
        if (va < vb) return _collectionsSort.dir === 'asc' ? -1 : 1;
        if (va > vb) return _collectionsSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    const total = sorted.length;
    const pages = Math.ceil(total / ISSUES_PAGE_SIZE);
    const start = page * ISSUES_PAGE_SIZE;
    const slice = sorted.slice(start, start + ISSUES_PAGE_SIZE);

    // ── Пагінація ─────────────────────────────────────────────
    const paginationHtml = total > ISSUES_PAGE_SIZE ? `
        <div style="display:inline-flex; align-items:center; gap:0.4rem;">
            <button
                id="collections-prev-btn"
                class="btn btn-secondary btn-small"
                ${page === 0 ? 'disabled' : ''}
                style="padding:0.2rem 0.55rem; font-size:0.85rem; line-height:1;"
            >←</button>
            <span style="font-size:0.85rem; color:var(--text-secondary); white-space:nowrap;">
                ${page + 1} / ${pages}
            </span>
            <button
                id="collections-next-btn"
                class="btn btn-secondary btn-small"
                ${page >= pages - 1 ? 'disabled' : ''}
                style="padding:0.2rem 0.55rem; font-size:0.85rem; line-height:1;"
            >→</button>
        </div>
    ` : '';

    const sortArrow = (key) => {
        if (_collectionsSort.key !== key) return ' ↕';
        return _collectionsSort.dir === 'asc' ? ' ↑' : ' ↓';
    };

    block.innerHTML = `
        <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px;
                    border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
            <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                    <span>Збірники (${total})</span>
                    <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                        ${paginationHtml}
                    </div>
                </div>
            </h2>
            <div class="table">
                <table>
                    <thead>
                        <tr>
                            <th>Обкладинка</th>
                            <th id="col-sort-issue_number" style="cursor:pointer; user-select:none;">
                                Номер${sortArrow('issue_number')}
                            </th>
                            <th>Назва</th>
                            <th>Дата обкладинки</th>
                            <th id="col-sort-release_date" style="cursor:pointer; user-select:none;">
                                Реліз${sortArrow('release_date')}
                            </th>
                            <th>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${slice.map(col => `
                            <tr onclick="navigateToCollection(event, ${col.id})"
                                onmousedown="collectionMiddleClick(event, ${col.id})"
                                style="cursor: pointer;">
                                <td>
                                    ${col.cv_img
                                        ? `<img src="${cv_img_path_small}${col.cv_img.startsWith('/') ? '' : '/'}${col.cv_img}"
                                               alt="${col.name}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">`
                                        : '📗'}
                                </td>
                                <td><strong>#${col.issue_number || '?'}</strong></td>
                                <td>${col.name || 'Без назви'}</td>
                                <td>${formatCoverDate(col.cover_date)}</td>
                                <td>${formatReleaseDate(col.release_date)}</td>
                                <td onclick="event.stopPropagation()">
                                    <button class="btn btn-secondary btn-small"
                                            onclick="editCollectionFromVolume(${col.id})">Редагувати</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('collections-prev-btn')?.addEventListener('click', () => {
        _collectionsPage--;
        renderCollectionsBlock(allCollections, _collectionsPage);
        block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('collections-next-btn')?.addEventListener('click', () => {
        _collectionsPage++;
        renderCollectionsBlock(allCollections, _collectionsPage);
        block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('col-sort-issue_number')?.addEventListener('click', () => {
        if (_collectionsSort.key === 'issue_number') {
            _collectionsSort.dir = _collectionsSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            _collectionsSort = { key: 'issue_number', dir: 'asc' };
        }
        _collectionsPage = 0;
        renderCollectionsBlock(allCollections, 0);
    });
    document.getElementById('col-sort-release_date')?.addEventListener('click', () => {
        if (_collectionsSort.key === 'release_date') {
            _collectionsSort.dir = _collectionsSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            _collectionsSort = { key: 'release_date', dir: 'desc' };
        }
        _collectionsPage = 0;
        renderCollectionsBlock(allCollections, 0);
    });
}

// ─────────────────────────────────────────────────────────────────────────────

function formatIssueRanges(numbers) {
    const nums = numbers
        .map(n => parseInt(n.trim()))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);

    if (!nums.length) return '';

    const ranges = [];
    let start = nums[0], end = nums[0];

    for (let i = 1; i < nums.length; i++) {
        if (nums[i] === end + 1) {
            end = nums[i];
        } else {
            ranges.push(start === end ? `#${start}` : `#${start}–#${end}`);
            start = end = nums[i];
        }
    }
    ranges.push(start === end ? `#${start}` : `#${start}–#${end}`);

    return ranges.join(', ');
}

// ===== МОДАЛКА "ДОДАТИ ДО СЕРІЇ" =========================================

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
let addToSeriesType = null;
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
    const url = new URL(window.location);
    const id = url.searchParams.get('id');
    if (id) renderVolumeDetail({ id });
};

// ===== ФОРМИ РЕДАГУВАННЯ =================================================

async function getVolumeFormHTML(volume = null) {
    const [themesRes, currentThemesRes] = await Promise.all([
        fetch(`${API_BASE}/themes`).then(r => r.json()),
        volume?.id
            ? fetch(`${API_BASE}/volumes/${volume.id}/themes`).then(r => r.json())
            : Promise.resolve({ data: [] })
    ]);

    const allThemes = themesRes.data || [];
    const currentThemeIds = new Set((currentThemesRes.data || []).map(t => t.id));

    let publisherName = volume?.publisher_name || '';

    return `
        <form id="edit-form">
            <div class="form-row form-row-2">
                <div class="form-group"><label>CV ID</label><input type="number" name="cv_id" value="${volume?.cv_id || ''}"></div>
                <div class="form-group"><label>CV Slug</label><input type="text" name="cv_slug" value="${volume?.cv_slug || ''}"></div>
            </div>
            <div class="form-row form-row-2">
                <div class="form-group">
                    <label>Hikka Slug</label>
                    <input type="text" name="hikka_slug" value="${volume?.hikka_slug || ''}" placeholder="напр. berserk-ek0mv">
                </div>
                <div class="form-group">
                    <label>MAL ID</label>
                    <input type="number" name="mal_id" value="${volume?.mal_id || ''}">
                </div>
            </div>
            <div class="form-row form-row-2">
                <div class="form-group"><label>LocG ID</label><input type="number" name="locg_id" value="${volume?.locg_id || ''}"></div>
                <div class="form-group"><label>LocG Slug</label><input type="text" name="locg_slug" value="${volume?.locg_slug || ''}"></div>
            </div>
            <hr style="margin: 0 0 1em; border-style: none; border-bottom: 1px solid var(--border-color);">
            <div class="form-row form-row-2">
                <div class="form-group">
                    <div class="form-group"><label>Назва</label><input type="text" name="name" value="${volume?.name || ''}"></div>
                </div>
                <div class="form-group">
                    <div class="form-group"><label>Назва UA</label><input type="text" name="name_uk" value="${volume?.name_uk || ''}"></div>
                </div>
            </div>
            <div class="form-row form-row-2">
                <div class="form-group">
                    <label>URL зображення</label>
                    <input type="text" name="cv_img" value="${volume?.cv_img || ''}">
                </div>
                <div class="form-group">
                    <div class="form-group"><label>Рік початку</label><input type="number" name="start_year" value="${volume?.start_year || ''}"></div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Мова</label>
                    <input type="hidden" name="lang" id="lang-hidden" value="${volume?.lang || ''}">
                    <div id="lang-chips" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.4rem;">
                        <span class="lang-chip${!volume?.lang ? ' lang-chip--active' : ''}"
                            data-code="" onclick="selectLangChip(this)">— ?</span>
                        ${Object.entries(LANG_MAP).map(([code, { flag, label }]) =>
                            `<span class="lang-chip${volume?.lang === code ? ' lang-chip--active' : ''}"
                                data-code="${code}" onclick="selectLangChip(this)">${flag} ${label}</span>`
                        ).join('')}
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Опис</label>
                <textarea name="description" rows="4" style="width:100%; resize:vertical;">${volume?.description || ''}</textarea>
            </div>
            ${publisherSearchHTML({
                publisherId: volume?.publisher || '',
                publisherName,
                inputId: 'vol-pub-input',
                hiddenId: 'vol-pub-id',
                resultsId: 'vol-pub-results',
                chipId: 'vol-pub-chip'
            })}
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
                <div class="form-group"><label>CV ID *</label><input type="number" name="cv_id" value="${issue?.cv_id || ''}"></div>
                <div class="form-group"><label>CV Slug *</label><input type="text" name="cv_slug" value="${issue?.cv_slug || ''}"></div>
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

function getCollectionFormHTML(col = null) {
    let safeReleaseDate   = '';
    if (col.cover_date) {
        const [y, m, d] = col.cover_date.split('-');
        if (d === '00') {
            safeReleaseDate = `${y}-${m}-01`;
        }
    }
    return `
        <form id="edit-form">
            <div class="form-row form-row-3">
                <div class="form-group">
                    <label>CV ID</label>
                    <input type="number" id="edit-col-cv_id" value="${col.cv_id || ''}">
                </div>
                <div class="form-group">
                    <label>CV Slug</label>
                    <input type="text" id="edit-col-cv_slug" value="${col.cv_slug || ''}">
                </div>
                <div class="form-group">
                    <label>CV Vol ID (тому)</label>
                    <input type="number" id="edit-col-cv_vol_id" value="${col.cv_vol_id || ''}">
                </div>
            </div>
            <div class="form-row form-row-2">
                <div class="form-group">
                    <label>Номер випуску</label>
                    <input type="text" id="edit-col-issue_number" value="${col.issue_number || ''}">
                </div>
                <div class="form-group">
                    <label>ISBN</label>
                    <input type="text" id="edit-col-isbn" value="${col.isbn || ''}">
                </div>
            </div>
            <div class="form-row form-row-2">
                <div class="form-group">
                    <label>Назва *</label>
                    <input type="text" id="edit-col-name" value="${col.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>URL зображення</label>
                    <input type="text" id="edit-col-cv_img" value="${col.cv_img || ''}">
                </div>
            </div>
            <div class="form-row form-row-2">
                <div class="form-group">
                    <label>Дата обкладинки</label>
                    <input type="date" id="edit-col-cover_date" value="${safeReleaseDate || col.cover_date || ''}">
                </div>
                <div class="form-group">
                    <label>Дата релізу</label>
                    <input type="date" id="edit-col-release_date" value="${col.release_date || ''}">
                </div>
            </div>
        </form>
    `;
}

// ===== НАВІГАЦІЯ =========================================================

window.navigateToIssue = (id) => navigate('issue-detail', { id });
window.navigateToCollection = (e, id) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        window.open(buildUrl('collection-detail', { id }), '_blank');
        return;
    }
    navigate('collection-detail', { id });
};

window.collectionMiddleClick = (e, id) => {
    if (e.button === 1) {
        e.preventDefault();
        window.open(buildUrl('collection-detail', { id }), '_blank');
    }
};

// ===== РЕДАГУВАННЯ ТОМУ ==================================================

window.editVolumeDetail = async (id) => {
    const volume = await fetch(`${API_BASE}/volumes/${id}`).then(r => r.json());
    const formHTML = await getVolumeFormHTML(volume);

    openModal('Редагувати том', formHTML, async (data) => {
        const themeCheckboxes = document.querySelectorAll('#themes-list input[type="checkbox"]:checked');
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
                mal_id: data.mal_id ? parseInt(data.mal_id) : null,
                hikka_slug: data.hikka_slug?.trim() || null,
            })
        });
        await renderVolumeDetail({ id });
        await window.updateStats();
    });

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
    document.querySelectorAll('#themes-list input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => { rebuildVolThemeChips(); });
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
    if (cb) cb.checked = false;
    rebuildVolThemeChips();
};

window.onThemeCheckboxChangeVol = () => { rebuildVolThemeChips(); };
window.filterThemesVol = (q) => { filterThemeCheckboxList(q, 'themes-list'); };

window.selectLangChip = (el) => {
    document.querySelectorAll('#lang-chips .lang-chip').forEach(c => c.classList.remove('lang-chip--active'));
    el.classList.add('lang-chip--active');
    document.getElementById('lang-hidden').value = el.dataset.code;
};

// ===== РЕДАГУВАННЯ ВИПУСКУ ===============================================

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

// ===== РЕДАГУВАННЯ ЗБІРНИКА З ТОМУ =======================================

window.editCollectionFromVolume = async (id) => {
    const col = await fetch(`${API_BASE}/collections/${id}`).then(r => r.json());
    openModal('Редагувати збірник', getCollectionFormHTML(col), async (data) => {
        await fetch(`${API_BASE}/collections/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const volumeId = new URL(window.location).searchParams.get('id');
        if (volumeId) await renderVolumeDetail({ id: volumeId });
        await window.updateStats();
    });
};

// ===== КОНВЕРТАЦІЯ =======================================================

window.convertAllIssuesToCollections = async (volumeId, count) => {
    if (!confirm(`Конвертувати всі ${count} випусків цього тома у збірники?\nЦю дію не можна скасувати.`)) return;
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
    if (!confirm(`Повернути всі ${count} збірників цього тома назад у випуски?\nТема "Collection" буде видалена з тому.`)) return;
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

// ===== ГЕНЕРАЦІЯ РОЗДІЛІВ ==================================================
window.generateChapters = async function(volumeId, hikkaSlug) {
    const btn = document.getElementById('gen-chapters-btn');
    if (btn) btn.disabled = true;

    try {
        // Спочатку пробуємо без ручного вводу — бекенд сам запитує Hikka
        let resp = await fetch(`${API_BASE}/volumes/${volumeId}/generate-chapters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        let data = await resp.json();

        // Hikka не знає кількість — питаємо юзера
        if (data.needsManualCount) {
            const input = prompt(
                `Hikka не знає кількість розділів для "${data.manga_name || hikkaSlug}".\n` +
                `Введіть відому кількість розділів (або 0 щоб скасувати):`
            );
            if (!input || parseInt(input) === 0) {
                if (btn) btn.disabled = false;
                return;
            }
            resp = await fetch(`${API_BASE}/volumes/${volumeId}/generate-chapters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: parseInt(input) }),
            });
            data = await resp.json();
        }

        if (!resp.ok) {
            alert(`Помилка: ${data.error}`);
        } else {
            alert(data.message);
            await loadChapters(volumeId);
            // Оновлюємо текст кнопки після першої генерації
            if (btn) btn.textContent = '🔄 Оновити розділи';
        }
    } catch (err) {
        alert(`Помилка: ${err.message}`);
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.loadChapters = async function(volumeId) {
    const block = document.getElementById('chapters-block');
    if (!block) return;

    try {
        const resp = await fetch(`${API_BASE}/volumes/${volumeId}/chapters`);
        const { data, total } = await resp.json();

        if (!data || !data.length) {
            block.innerHTML = `
                <div style="background:var(--bg-primary); padding:1.5rem; border-radius:8px;
                            border:1px solid var(--border-color); margin-bottom:1.5rem;">
                    <h2 style="font-size:1.5rem; margin-bottom:1rem;">Розділи (0)</h2>
                    <p style="color:var(--text-secondary);">Розділів ще немає. Натисніть "Згенерувати розділи".</p>
                </div>`;
            return;
        }

        // Оновлюємо назву кнопки генерації
        const btn = document.getElementById('gen-chapters-btn');
        if (btn) btn.textContent = '🔄 Оновити розділи';

        _allChapters = data;
        _chaptersPage = 0;
        renderChaptersBlock(_allChapters, 0);
    } catch (err) {
        console.error('loadChapters error:', err);
    }
};

function renderChaptersBlock(allChapters, page) {
    const block = document.getElementById('chapters-block');
    if (!block) return;

    // ── Сортування ────────────────────────────────────────────
    const sorted = [...allChapters].sort((a, b) => {
        let va, vb;
        if (_chaptersSort.key === 'release_date') {
            va = a.release_date || '';
            vb = b.release_date || '';
        } else {
            va = parseFloat(a.issue_number) || -Infinity;
            vb = parseFloat(b.issue_number) || -Infinity;
        }
        if (va < vb) return _chaptersSort.dir === 'asc' ? -1 : 1;
        if (va > vb) return _chaptersSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    const total = sorted.length;
    const pages = Math.ceil(total / ISSUES_PAGE_SIZE);
    const start = page * ISSUES_PAGE_SIZE;
    const slice = sorted.slice(start, start + ISSUES_PAGE_SIZE);

    // ── Пагінація ─────────────────────────────────────────────
    const paginationHtml = total > ISSUES_PAGE_SIZE ? `
        <div style="display:inline-flex; align-items:center; gap:0.4rem;">
            <button
                id="chapters-prev-btn"
                class="btn btn-secondary btn-small"
                ${page === 0 ? 'disabled' : ''}
                style="padding:0.2rem 0.55rem; font-size:0.85rem; line-height:1;"
            >←</button>
            <span style="font-size:0.85rem; color:var(--text-secondary); white-space:nowrap;">
                ${page + 1} / ${pages}
            </span>
            <button
                id="chapters-next-btn"
                class="btn btn-secondary btn-small"
                ${page >= pages - 1 ? 'disabled' : ''}
                style="padding:0.2rem 0.55rem; font-size:0.85rem; line-height:1;"
            >→</button>
        </div>
    ` : '';

    block.innerHTML = `
        <div style="background:var(--bg-primary); padding:1.5rem; border-radius:8px;
                    border:1px solid var(--border-color); margin-bottom:1.5rem;">
            <h2 style="font-size:1.5rem; margin-bottom:1rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                    <span>Розділи (${total})</span>
                    <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                        ${paginationHtml}
                        <button class="btn btn-primary btn-small"
                                onclick="openAddChapterModal(${_currentVolumeId})"
                                style="font-size:0.85rem;">
                            + Додати розділ
                        </button>
                    </div>
                </div>
            </h2>
            <div class="table">
                <table>
                    <thead>
                        <tr>
                            <th id="chapters-sort-issue_number" style="cursor:pointer; user-select:none;">
                                Розділ${_chaptersSort.key === 'issue_number' ? (_chaptersSort.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                            </th>
                            <th>Назва</th>
                            <th id="chapters-sort-release_date" style="cursor:pointer; user-select:none;">
                                Реліз${_chaptersSort.key === 'release_date' ? (_chaptersSort.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                            </th>
                            <th>У збірнику</th>
                            <th>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${slice.map(ch => `
                            <tr onclick="window.navigateToIssue(${ch.id})" style="cursor: pointer;">
                                <td><strong>#${ch.issue_number || '?'}</strong></td>
                                <td onclick="event.stopPropagation()">
                                    <input class="chapter-name-input"
                                        data-issue-id="${ch.id}"
                                        data-field="name"
                                        value="${(ch.name || '').replace(/"/g, '&quot;')}"
                                        placeholder="Назва розділу"
                                        style="width:100%; background:transparent; border:1px solid transparent; border-radius:4px;
                                            padding:2px 4px; font-size:0.9rem; color:var(--accent); cursor:text;"
                                        onclick="event.stopPropagation()">
                                </td>
                                <td onclick="event.stopPropagation()">
                                    <input type="date" class="chapter-date-input"
                                        data-issue-id="${ch.id}"
                                        data-field="release_date"
                                        value="${ch.release_date || ''}"
                                        style="background:transparent; border:1px solid transparent; border-radius:4px;
                                            padding:2px 4px; font-size:0.85rem; color:var(--accent); cursor:pointer;"
                                        onclick="event.stopPropagation()">
                                </td>
                                <td style="text-align:center;">
                                    ${ch.in_collections_count > 0
                                        ? `<span style="color:#166534; font-weight:600;">✓ ${ch.in_collections_count > 1 ? ch.in_collections_count : ''}</span>`
                                        : '<span style="color:var(--text-secondary);">—</span>'}
                                </td>
                                <td onclick="event.stopPropagation()">
                                    <button class="btn btn-secondary btn-small"
                                            onclick="editIssueFromVolume(${ch.id})">Ред.</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // ── Обробники пагінації ───────────────────────────────────
    document.getElementById('chapters-prev-btn')?.addEventListener('click', () => {
        _chaptersPage--;
        renderChaptersBlock(_allChapters, _chaptersPage);
        block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('chapters-next-btn')?.addEventListener('click', () => {
        _chaptersPage++;
        renderChaptersBlock(_allChapters, _chaptersPage);
        block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ── Обробники сортування ──────────────────────────────────
    document.getElementById('chapters-sort-issue_number')?.addEventListener('click', () => {
        if (_chaptersSort.key === 'issue_number') {
            _chaptersSort.dir = _chaptersSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            _chaptersSort = { key: 'issue_number', dir: 'asc' };
        }
        _chaptersPage = 0;
        renderChaptersBlock(_allChapters, 0);
    });
    document.getElementById('chapters-sort-release_date')?.addEventListener('click', () => {
        if (_chaptersSort.key === 'release_date') {
            _chaptersSort.dir = _chaptersSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            _chaptersSort = { key: 'release_date', dir: 'desc' };
        }
        _chaptersPage = 0;
        renderChaptersBlock(_allChapters, 0);
    });

    // ── Inline-редагування назви та дати розділу ──────────────────────────
    const chaptersTableBody = block.querySelector('tbody');
    if (chaptersTableBody) {
        const hoverStyle = (el, on) => {
            el.style.borderColor = on ? 'var(--border-color)' : 'transparent';
            el.style.background  = on ? 'var(--bg-secondary)' : 'transparent';
        };

        chaptersTableBody.addEventListener('mouseover', (e) => {
            const inp = e.target.closest('.chapter-name-input, .chapter-date-input');
            if (inp) hoverStyle(inp, true);
        });
        chaptersTableBody.addEventListener('mouseout', (e) => {
            const inp = e.target.closest('.chapter-name-input, .chapter-date-input');
            if (inp && document.activeElement !== inp) hoverStyle(inp, false);
        });
        chaptersTableBody.addEventListener('focus', (e) => {
            const inp = e.target.closest('.chapter-name-input, .chapter-date-input');
            if (inp) hoverStyle(inp, true);
        }, true);
        chaptersTableBody.addEventListener('blur', async (e) => {
            const inp = e.target.closest('.chapter-name-input, .chapter-date-input');
            if (!inp) return;
            hoverStyle(inp, false);
            const issueId = parseInt(inp.dataset.issueId);
            const field   = inp.dataset.field;
            const value   = inp.value.trim() || null;

            try {
                await fetch(`${API_BASE}/issues/${issueId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [field]: value }),
                });
                // Оновлюємо локальний масив щоб сортування працювало актуально
                const ch = _allChapters.find(c => c.id === issueId);
                if (ch) ch[field] = value;
            } catch (err) {
                console.error('Помилка збереження поля розділу:', err);
            }
        }, true);

        chaptersTableBody.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') e.target.blur();
            if (e.key === 'Escape') {
                // Відновити старе значення з масиву
                const inp = e.target.closest('.chapter-name-input, .chapter-date-input');
                if (!inp) return;
                const ch = _allChapters.find(c => c.id === parseInt(inp.dataset.issueId));
                if (ch) inp.value = ch[inp.dataset.field] || '';
                inp.blur();
            }
        });
    }
}

// ===== ПЕРЕКЛАДИ =========================================================

window.removeTranslation = async (parentId, childId) => {
    if (!confirm('Від\'єднати цей переклад від оригіналу?')) return;
    const res = await fetch(`${API_BASE}/volumes/${parentId}/translations/${childId}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    const id = new URL(window.location).searchParams.get('id');
    if (id) renderVolumeDetail({ id });
};

// ===== ЖУРНАЛИ ===========================================================

window.removeMagazineChild = async (magazineId, childId) => {
    if (!confirm('Від\'єднати цей том від журналу?')) return;
    const res = await fetch(`${API_BASE}/volumes/${magazineId}/magazine-children/${childId}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    const id = new URL(window.location).searchParams.get('id');
    if (id) renderVolumeDetail({ id });
};

// ===== СПІЛЬНА МОДАЛКА ВИБОРУ ТОМУ =======================================
//
// Режими:
//   'translation-add'        — поточний том є оригіналом, шукаємо дочірній (переклад)
//   'translation-set-parent' — поточний том є перекладом, шукаємо батьківський (оригінал)
//   'magazine-add'           — поточний том є журналом, шукаємо дочірній
//   'magazine-set-parent'    — поточний том є дочірнім, шукаємо батьківський журнал

let _volumePickerMode   = null;
let _volumePickerRefId  = null;   // ID тому з якого відкрита модалка
let _volumePickerTimeout = null;

window.openVolumePickerModal = (mode, refId) => {
    _volumePickerMode  = mode;
    _volumePickerRefId = refId;

    const titles = {
        'translation-add':        'Додати перекладений том',
        'translation-set-parent': 'Вибрати першоджерело (оригінал)',
        'magazine-add':           'Додати том до журналу',
        'magazine-set-parent':    'Вибрати батьківський журнал',
    };
    document.getElementById('volume-picker-title').textContent = titles[mode] || 'Вибрати том';
    document.getElementById('volume-picker-results').innerHTML = '';

    const searchInput = document.getElementById('volume-picker-search');
    const dbidInput   = document.getElementById('volume-picker-dbid');
    const cvidInput   = document.getElementById('volume-picker-cvid');
    searchInput.value = '';
    dbidInput.value   = '';
    cvidInput.value   = '';

    document.getElementById('volume-picker-modal').style.display = 'flex';

    searchInput.oninput = (e) => {
        dbidInput.value = '';
        cvidInput.value = '';
        clearTimeout(_volumePickerTimeout);
        _volumePickerTimeout = setTimeout(() => _searchVolumePicker({ name: e.target.value }), 300);
    };

    dbidInput.oninput = (e) => {
        searchInput.value = '';
        cvidInput.value = '';
        clearTimeout(_volumePickerTimeout);
        _volumePickerTimeout = setTimeout(() => _searchVolumePicker({ db_id: e.target.value }), 300);
    };

    cvidInput.oninput = (e) => {
        searchInput.value = '';
        dbidInput.value = '';
        clearTimeout(_volumePickerTimeout);
        _volumePickerTimeout = setTimeout(() => _searchVolumePicker({ cv_id: e.target.value }), 300);
    };

    searchInput.focus();
};

window.closeVolumePickerModal = () => {
    document.getElementById('volume-picker-modal').style.display = 'none';
    _volumePickerMode  = null;
    _volumePickerRefId = null;
};

async function _searchVolumePicker({ name, db_id, cv_id } = {}) {
    const el = document.getElementById('volume-picker-results');

    if (!name?.trim() && !cv_id?.toString().trim() && !db_id?.toString().trim()) {
        el.innerHTML = '';
        return;
    }

    let url;
    if (db_id?.toString().trim()) {
        url = `${API_BASE}/volumes?db_id=${encodeURIComponent(db_id.toString().trim())}&limit=5`;
    } else if (cv_id?.toString().trim()) {
        url = `${API_BASE}/volumes?cv_id=${encodeURIComponent(cv_id.toString().trim())}&limit=5`;
    } else {
        url = `${API_BASE}/volumes?search=${encodeURIComponent(name.trim())}&limit=20`;
    }

    const res = await fetch(url);
    const result = await res.json();

    if (!result.data?.length) {
        el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>';
        return;
    }
    el.innerHTML = result.data.map(vol => {
        const imgSrc = vol.cv_img
            ? `${cv_img_path_small}${vol.cv_img.startsWith('/') ? '' : '/'}${vol.cv_img}`
            : vol.hikka_img || null;
        return `
        <div onclick="_confirmVolumePickerSelection(${vol.id})"
            style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
            onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
            ${imgSrc
                ? `<img src="${imgSrc}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0;">`
                : '<div style="width:36px;height:36px;background:var(--bg-secondary);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1rem;">📚</div>'}
            <div>
                <div style="font-weight:500;">${vol.lang ? `<span style="color:var(--accent)">[${vol.lang}]</span> ` : ''}${vol.name}</div>
                ${vol.name_uk ? `<div style="font-size:0.8rem; color:var(--text-secondary);">${vol.name_uk}</div>` : ''}
                <div style="font-size:0.75rem; color:var(--text-secondary);">
                    db: ${vol.id}${vol.cv_id ? ` · CV: ${vol.cv_id}` : ''}${vol.publisher_name ? ` · ${vol.publisher_name}` : ''}
                </div>
            </div>
        </div>
    `}).join('');
}

window._confirmVolumePickerSelection = async (selectedId) => {
    if (!_volumePickerMode || !_volumePickerRefId) return;

    // Визначаємо хто parent, хто child залежно від режиму
    let url, body;
    switch (_volumePickerMode) {
        case 'translation-add':
            // refId = оригінал, selectedId = переклад
            url  = `${API_BASE}/volumes/${_volumePickerRefId}/translations`;
            body = { child_id: selectedId };
            break;
        case 'translation-set-parent':
            // refId = переклад, selectedId = оригінал
            url  = `${API_BASE}/volumes/${selectedId}/translations`;
            body = { child_id: _volumePickerRefId };
            break;
        case 'magazine-add':
            // refId = журнал, selectedId = дочірній том
            url  = `${API_BASE}/volumes/${_volumePickerRefId}/magazine-children`;
            body = { child_id: selectedId };
            break;
        case 'magazine-set-parent':
            // refId = дочірній том, selectedId = журнал
            url  = `${API_BASE}/volumes/${selectedId}/magazine-children`;
            body = { child_id: _volumePickerRefId };
            break;
        default:
            return;
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Помилка');
        return;
    }

    window.closeVolumePickerModal();
    const id = new URL(window.location).searchParams.get('id');
    if (id) renderVolumeDetail({ id });
};

// ===== СТВОРЕННЯ ТОМУ МАНҐИ ==============================================

window.createMangaSourceVolume = async function(collectionVolumeId, hikkaSlug, volumeName, malId) {
    // Перевіряємо чи вже існує том з таким hikka_slug
    try {
        const checkResp = await fetch(`${API_BASE}/volumes?hikka_slug=${encodeURIComponent(hikkaSlug)}`);
        // Не блокуємо — просто передаємо далі, бекенд сам перевірить дублікат
    } catch (_) {}

    const confirmed = confirm(
        `Створити том манґи для "${volumeName}"?\n\n` +
        `Hikka slug: ${hikkaSlug}\n\n` +
        `Назва, постер, рік та опис будуть підтягнуті автоматично з Hikka.`
    );
    if (!confirmed) return;

    try {
        const resp = await fetch(`${API_BASE}/volumes/manga-volume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hikka_slug: hikkaSlug,
                mal_id: malId || null,   // передаємо як підказку, але Hikka може перезаписати
            }),
        });
        const data = await resp.json();

        if (!resp.ok) {
            if (data.id) {
                // Том вже існує — пропонуємо перейти
                if (confirm(`Том з таким hikka_slug вже існує (id: ${data.id}).\nПерейти до нього?`)) {
                    navigate('volume-detail', { id: data.id });
                }
            } else {
                alert(`Помилка: ${data.error}`);
            }
            return;
        }

        navigate('volume-detail', { id: data.id });
    } catch (err) {
        alert(`Помилка: ${err.message}`);
    }
};

// ===== СТВОРЕННЯ РОЗДІЛУ МАНҐИ ==========================================

window.openAddChapterModal = function(volumeId) {
    openModal('Додати розділ манґи', `
        <form id="edit-form">
            <div class="form-row">
                <div class="form-group">
                    <label>Номер розділу *</label>
                    <input type="text" name="issue_number" placeholder="напр. 1, 1.5" required>
                </div>
                <div class="form-group">
                    <label>Дата виходу</label>
                    <input type="date" name="release_date">
                </div>
            </div>
            <div class="form-group">
                <label>Назва (мовою оригіналу)</label>
                <input type="text" name="name" placeholder="напр. The Black Swordsman">
            </div>
            <div class="form-group">
                <label>URL обкладинки</label>
                <input type="text" name="cv_img" placeholder="https://...">
            </div>
        </form>
    `, async (data) => {
        if (!data.issue_number?.trim()) { alert('Введіть номер розділу'); return; }
        try {
            const resp = await fetch(`${API_BASE}/issues`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cv_id: null,
                    cv_slug: null,
                    ds_vol_id: volumeId,
                    issue_number: data.issue_number.trim(),
                    name: data.name?.trim() || null,
                    release_date: data.release_date || null,
                    cv_img: data.cv_img?.trim() || null,
                }),
            });
            const result = await resp.json();
            if (!resp.ok) { alert(result.error || 'Помилка'); return; }
            await loadChapters(volumeId);
            await window.updateStats();
        } catch (err) {
            alert(`Помилка: ${err.message}`);
        }
    });
};

// ===== KEYBOARD SHORTCUTS ================================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const pickerModal = document.getElementById('volume-picker-modal');
        if (pickerModal && pickerModal.style.display === 'flex') {
            window.closeVolumePickerModal();
            return;
        }
        const seriesModal = document.getElementById('add-to-series-modal');
        if (seriesModal && seriesModal.style.display === 'flex') {
            window.closeAddToSeriesModal();
            return;
        }
        const mainModal = document.getElementById('modal');
        if (mainModal?.classList.contains('active')) {
            mainModal.classList.remove('active');
        }
        const vrelModal = document.getElementById('vrel-modal');
        if (vrelModal?.classList.contains('open')) {
            window._vrelCloseModal();
            return;
        }
    }
});