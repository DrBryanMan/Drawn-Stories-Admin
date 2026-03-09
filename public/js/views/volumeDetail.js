import { fetchItem, fetchItems } from '../api/api.js';
import { publisherSearchHTML, initPublisherSearch, renderThemeChips } from '../utils/publisherSearch.js';
import { locg_img, cv_img_path_small, cv_logo_svg, formatDate, formatCoverDate, formatReleaseDate, showError, showLoading, initDetailPage } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { openModal } from '../components/modal.js';
import { buildThemeChipsHTML, buildThemeCheckboxListHTML, filterThemeCheckboxList, buildThemeChipsViewHTML } from '../utils/themeChips.js';

const API_BASE = 'http://localhost:7000/api';

// ===== ПАГІНАЦІЯ ВИПУСКІВ ================================================

let _issuesPage = 0;
const ISSUES_PAGE_SIZE = 100;

// Стан сортування блоку випусків тому
// key: 'issue_number' | 'release_date'   dir: 'asc' | 'desc'
let _issuesSort = { key: 'issue_number', dir: 'desc' };

// ===== МОВНА МАПА =========================================================

const LANG_MAP = {
    ja:    { label: 'Японська',               flag: '🇯🇵' },
    en:    { label: 'Американська',           flag: '🇺🇸' },
    gb:    { label: 'Британська',             flag: '🇬🇧' },
    fr:    { label: 'Французька',             flag: '🇫🇷' },
    de:    { label: 'Німецька',               flag: '🇩🇪' },
    it:    { label: 'Італійська',             flag: '🇮🇹' },
    es:    { label: 'Іспанська',              flag: '🇪🇸' },
    'es-AR': { label: 'Іспанська (Аргентина)', flag: '🇦🇷' },
    da:    { label: 'Данська',                flag: '🇩🇰' },
    fi:    { label: 'Фінська',                flag: '🇫🇮' },
    nb:    { label: 'Норвезька Букмол',       flag: '🇳🇴' },
    nl:    { label: 'Нідерландська',          flag: '🇳🇱' },
    no:    { label: 'Норвезька',              flag: '🇳🇴' },
    pl:    { label: 'Польська',               flag: '🇵🇱' },
    pt:    { label: 'Португальська',          flag: '🇵🇹' },
    sr:    { label: 'Сербська',               flag: '🇷🇸' },
    sv:    { label: 'Шведська',               flag: '🇸🇪' },
    tr:    { label: 'Турецька',               flag: '🇹🇷' },
    uk:    { label: 'Українська',             flag: '🇺🇦' },
    ru:    { label: 'Російська',              flag: '🇷🇺' },
    zh:    { label: 'Китайська',              flag: '🇨🇳' },
    ko:    { label: 'Корейська',              flag: '🇰🇷' },
};

function langDisplay(code) {
    if (!code) return '';
    const entry = LANG_MAP[code];
    return entry ? `${entry.flag} ${entry.label}` : code;
    // return entry ? `${entry.flag} ${entry.label} (${code})` : code;
}

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

        const [
            issuesResult,
            volumeCollectionsData,
            collectionsFromIssuesData,
            translationsData,
            translationParentData,
            magazineChildrenData,
            magazineParentData,
        ] = await Promise.all([
            fetchItems('issues', { volume_id: volume.cv_id }),
            fetch(`${API_BASE}/collections/by-volume/${volume.cv_id}`).then(r => r.ok ? r.json() : { data: [] }),
            fetch(`${API_BASE}/volumes/${volumeId}/collections-from-issues`).then(r => r.ok ? r.json() : { data: [] }),
            fetch(`${API_BASE}/volumes/${volumeId}/translations`).then(r => r.ok ? r.json() : { data: [] }),
            fetch(`${API_BASE}/volumes/${volumeId}/translation-parent`).then(r => r.ok ? r.json() : { data: null }),
            fetch(`${API_BASE}/volumes/${volumeId}/magazine-children`).then(r => r.ok ? r.json() : { data: [] }),
            fetch(`${API_BASE}/volumes/${volumeId}/magazine-parent`).then(r => r.ok ? r.json() : { data: null }),
        ]);

        const volumeThemes = themesData.data || [];
        const volumeSeries = seriesData.data || [];
        const isCollectionVolume = volumeThemes.some(t => t.id === 44);
        const isMagazineVolume   = volumeThemes.some(t => t.id === 35);
        const volCollections = volumeCollectionsData.data || [];
        const volCollectionsFromIssues = collectionsFromIssuesData.data || [];
        const translations = translationsData.data || [];
        const translationParent = translationParentData.data || null;
        const magazineChildren = magazineChildrenData.data || [];
        const magazineParent = magazineParentData.data || null;

        document.getElementById('page-title').innerHTML = `
            <a href="#" onclick="event.preventDefault(); navigateToParent()">
                ← Томи
            </a> /${volume.cv_slug}/4050-${volume.cv_id}
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
                            : '<div style="width: 300px; height: 450px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 4rem;">📚</div>'
                        }
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1em;">
                            <a href="https://comicvine.gamespot.com/${volume.cv_slug}/4050-${volume.cv_id}" target="_blank">${cv_logo_svg}</a>
                            ${volume.locg_slug ? `
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
                                            ? `${volume.publisher_name} <span style="color: var(--text-secondary); font-size: 0.85rem;">(cv_id: ${volume.publisher})</span>`
                                            : `cv_id: ${volume.publisher}`}
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
                        </div>
                        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                            <button class="btn btn-secondary" onclick="editVolumeDetail(${volume.id})">Редагувати том</button>
                            <button class="btn btn-primary" onclick="openAddToSeriesModal(${volume.id}, 'volume')">+ Додати до серії</button>
                            ${!isMagazineVolume ? `
                                ${!translationParent ? `
                                    <button class="btn btn-secondary" onclick="openVolumePickerModal('translation-set-parent', ${volume.id})">🌐 Додати до першоджерела</button>
                                ` : ''}
                                ${!magazineParent ? `
                                    <button class="btn btn-secondary" onclick="openVolumePickerModal('magazine-set-parent', ${volume.id})">📰 Додати до журналу</button>
                                ` : ''}
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
                        </div>
                    </div>
                </div>

                <!-- ── Переклади: список дочірніх (цей том — оригінал) ───── -->
                
                ${!isMagazineVolume ? `
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
                                        <span style="font-size:0.9rem;">${t.lang ? `<i>${langDisplay(t.lang)}</i> — ` : ''}${t.name}</span>
                                        <button class="btn btn-notext btn-nobg btn-danger btn-small"
                                            onclick="event.stopPropagation(); removeTranslation(${volume.id}, ${t.id})">✕</button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `<p style="color:var(--text-secondary); margin:0; font-size:0.9rem;">Немає прив'язаних перекладів.</p>`}
                    </div>
                ` : ''}

                <!-- ── Оригінал (цей том — переклад) ────────────────────── -->
                ${translationParent ? `
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
                                : '<div style="width:48px;height:48px;background:var(--bg-secondary);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">📚</div>'}
                            <div>
                                <div style="font-weight:600;">${translationParent.lang ? `[${translationParent.lang}] ` : ''}${translationParent.name}</div>
                            ${translationParent.publisher_name ? `<div style="font-size:0.85rem; color:var(--text-secondary);">${translationParent.publisher_name}</div>` : ''}
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
            ${magazineParent ? `
                    <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem;">
                            <h2 style="font-size:1.25rem; margin:0;">📰 Журнал</h2>
                            <button class="btn btn-danger btn-small"
                                onclick="removeMagazineChild(${magazineParent.id}, ${volume.id})">
                                Від'єднати
                            </button>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.75rem; cursor:pointer;"
                             onclick="navigate('volume-detail', { id: ${magazineParent.id} })">
                        ${magazineParent.cv_img
                                ? `<img src="${cv_img_path_small}${magazineParent.cv_img.startsWith('/') ? '' : '/'}${magazineParent.cv_img}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">`
                                : '<div style="width:48px;height:48px;background:var(--bg-secondary);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">📰</div>'}
                            <div>
                                <div style="font-weight:600;">${magazineParent.name}</div>
                            ${magazineParent.publisher_name ? `<div style="font-size:0.85rem; color:var(--text-secondary);">${magazineParent.publisher_name}</div>` : ''}
                            </div>
                        </div>
                    </div>
                ` : ''}

                <!-- ── Збірники (collections-from-issues) ────────────────── -->
                ${!isCollectionVolume && volCollectionsFromIssues.length > 0 ? `
                    <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                        <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">Входить у збірники (${volCollectionsFromIssues.length})</h2>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${volCollectionsFromIssues.map(col => {
                                const range = col.issue_numbers ? formatIssueRanges(col.issue_numbers.split(',')) : null;
                                return `
                                    <div onclick="navigateToCollection(${col.id})"
                                         style="display:flex; align-items:center; gap:0.5rem; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:0.4rem 0.75rem; cursor:pointer;">
                                    ${col.cv_img ? `<img src="${cv_img_path_small}${col.cv_img.startsWith('/') ? '' : '/'}${col.cv_img}" style="width:28px;height:28px;object-fit:cover;border-radius:3px;flex-shrink:0;">` : ''}
                                        <div>
                                            <div style="font-size:0.9rem; font-weight:500;">${col.name || 'Без назви'}</div>
                                        ${range ? `
                                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                                    📖 ${range}
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- ── Збірники тому (якщо Collection-том) ───────────────── -->
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
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}

                <!-- ── Випуски ────────────────────────────────────────────── -->
                ${issuesResult && issuesResult.data.length > 0 ? '<div id="issues-block"></div>' : ''}

                ${renderAddToSeriesModal()}

                <!-- ── Модалка вибору тому (переклади + журнали) ─────────── -->
                <div id="volume-picker-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
                    <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:520px; max-width:90vw;">
                        <h3 id="volume-picker-title" style="margin-bottom:1rem;">Вибрати том</h3>
                        <div style="display:flex; gap:0.5rem; margin-bottom:0.75rem;">
                            <div class="form-group" style="flex:1; margin:0;">
                                <input type="text" id="volume-picker-search" placeholder="Пошук за назвою..." style="width:100%;">
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
        if (issuesResult && issuesResult.data.length > 0) {
            renderIssuesBlock(issuesResult.data, 0);
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

    // ── Кнопки сортування ─────────────────────────────────────
    function sortBtn(key, labelAsc, labelDesc) {
        const isActive = _issuesSort.key === key;
        const dir = isActive ? _issuesSort.dir : null;
        const label = dir === 'asc' ? labelAsc : labelDesc;
        return `
            <button
                id="issues-sort-${key}"
                class="btn btn-secondary btn-small${isActive ? ' btn-active' : ''}"
                style="padding:0.2rem 0.6rem; font-size:0.82rem; line-height:1; ${isActive ? 'font-weight:600;' : ''}"
            >${label}</button>
        `;
    }

    const sortHtml = `
        <div style="display:inline-flex; align-items:center; gap:0.35rem;">
            <span style="font-size:0.8rem; color:var(--text-secondary);">Сортування:</span>
            ${sortBtn('issue_number', '№ ↑', '№ ↓')}
            ${sortBtn('release_date', 'Реліз ↑', 'Реліз ↓')}
        </div>
    `;

    block.innerHTML = `
        <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
            <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                    <span>Випуски (${total})</span>
                    <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                        ${sortHtml}
                        ${paginationHtml}
                    </div>
                </div>
            </h2>
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
            <div class="form-row">
                <div class="form-group"><label>CV ID *</label><input type="number" name="cv_id" value="${volume?.cv_id || ''}" required></div>
                <div class="form-group"><label>CV Slug *</label><input type="text" name="cv_slug" value="${volume?.cv_slug || ''}" required></div>
            </div>
            <div class="form-group"><label>Назва</label><input type="text" name="name" value="${volume?.name || ''}"></div>
            <div class="form-group"><label>URL зображення</label><input type="text" name="cv_img" value="${volume?.cv_img || ''}"></div>
            <div class="form-row">
                <div class="form-group">
                    <label>Мова</label>
                    <select name="lang">
                        <option value="">— не вказано —</option>
                        ${Object.entries(LANG_MAP).map(([code, { label, flag }]) =>
                            `<option value="${code}" ${volume?.lang === code ? 'selected' : ''}>${flag} ${label} (${code})</option>`
                        ).join('\n                        ')}
                    </select>
                </div>
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

// ===== НАВІГАЦІЯ =========================================================

window.navigateToIssue = (id) => navigate('issue-detail', { id });
window.navigateToCollection = (id) => navigate('collection-detail', { id });

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
    const cvidInput   = document.getElementById('volume-picker-cvid');
    searchInput.value = '';
    cvidInput.value   = '';

    document.getElementById('volume-picker-modal').style.display = 'flex';

    searchInput.oninput = (e) => {
        cvidInput.value = '';
        clearTimeout(_volumePickerTimeout);
        _volumePickerTimeout = setTimeout(() => _searchVolumePicker({ name: e.target.value }), 300);
    };

    cvidInput.oninput = (e) => {
        searchInput.value = '';
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

async function _searchVolumePicker({ name, cv_id } = {}) {
    const el = document.getElementById('volume-picker-results');

    if (!name?.trim() && !cv_id?.toString().trim()) {
        el.innerHTML = '';
        return;
    }

    let url;
    if (cv_id?.toString().trim()) {
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
    el.innerHTML = result.data.map(vol => `
        <div onclick="_confirmVolumePickerSelection(${vol.id})"
             style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
             onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
        ${vol.cv_img
                ? `<img src="${cv_img_path_small}${vol.cv_img.startsWith('/') ? '' : '/'}${vol.cv_img}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0;">`
                : '<div style="width:36px;height:36px;background:var(--bg-secondary);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1rem;">📚</div>'}
            <div>
                <div style="font-weight:500;">${vol.lang ? `<span style="color:var(--accent)">[${vol.lang}]</span> ` : ''}${vol.name}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">CV ID: ${vol.cv_id}${vol.publisher_name ? ` · ${vol.publisher_name}` : ''}</div>
            </div>
        </div>
    `).join('');
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
    }
});