import { API_BASE } from '../utils/config.js';
import { cv_img_path_original, cv_img_path_small, formatDate, formatCoverDate, formatReleaseDate, showError, showLoading, initDetailPage, langDisplay } from '../utils/helpers.js';
import { openSearchPickerModal, closeSearchPickerModal } from '../components/searchPickerModal.js';
import { fetchItem, updateItem } from '../api/api.js';
import { openModal } from '../components/modal.js';
import { navigate } from '../utils/router.js';
import * as ICONS from '../utils/icons.js'

let currentVolumeId = null;
let currentIssueId = null;

// ═══════════════════════════════════════════════════════════════
// БЛОКИ КОНТЕНТУ (сюжет, появи)
// ═══════════════════════════════════════════════════════════════

/**
 * Будує всі блоки контенту для сторінки випуску.
 *
 * Логіка:
 * 1. ГОЛОВНИЙ БЛОК (завжди) — сам випуск.
 *    Плашки репрінту: reprintSources де story_id IS NULL.
 *
 * 2а. Якщо є власні stories (оригінальний випуск) — по блоку на кожну.
 *     Без плашок (вони оригінальні).
 *
 * 2б. Якщо репринт-випуск і є story-level джерела (story_id != null) —
 *     по блоку на кожне, з плашкою "Репринт: ... · «назва историї»".
 */
function renderContentBlocks(issue, stories, reprintSources, isReprintOrTranslated) {
    const blocks = [];

    // ── 1. Головний блок (завжди) — сам випуск, без плашок ───────────────
    blocks.push(renderStoryBlock({
        title:          issue.name || 'Без назви',
        titleOriginal:  null,
        plot:           issue.plot || '',
        reprintSources: [],
    }));

    if (isReprintOrTranslated && reprintSources.length > 0) {
        // ── 2. Репринт-випуск: окремий блок на КОЖНЕ джерело ─────────────
        for (const src of reprintSources) {
            if (src.story_id) {
                // Конкретна историія з оригіналу
                blocks.push(renderStoryBlock({
                    title:         src.story_name_ua || src.story_name_original || '— без назви —',
                    titleOriginal: src.story_name_ua && src.story_name_original
                                       ? src.story_name_original : null,
                    plot:          src.story_plot || '',
                    reprintSources: [src],
                }));
            } else {
                // Весь оригінальний випуск (без конкретної историї)
                blocks.push(renderStoryBlock({
                    title:         src.name || '— без назви —',
                    titleOriginal: null,
                    plot:          src.source_issue_plot || '',
                    reprintSources: [src],
                }));
            }
        }
    } else if (!isReprintOrTranslated && stories.length > 0) {
        // ── 2. Оригінальний випуск зі sub-stories ────────────────────────
        for (const s of stories) {
            blocks.push(renderStoryBlock({
                title:         s.name_ua || s.name_original || '— без назви —',
                titleOriginal: s.name_ua && s.name_original ? s.name_original : null,
                plot:          s.plot || '',
                reprintSources: [],
            }));
        }
    }

    return blocks.join('');
}

/**
 * Рендерить один контент-блок (для випуску або окремої историї).
 * @param {string}   title
 * @param {string|null} titleOriginal
 * @param {string}   plot
 * @param {Array}    reprintSources — масив джерел (може бути порожній)
 */
function renderStoryBlock({ title, titleOriginal, plot, reprintSources }) {
    const badges = reprintSources.map(src => `
        <div style="display:inline-flex; align-items:center; gap:0.4rem; background:var(--bg-tertiary);
                    border:1px solid var(--border-color); border-radius:4px; padding:0.25rem 0.6rem;
                    font-size:0.78rem; color:var(--text-secondary); margin-bottom:0.4rem; margin-right:0.4rem;">
            🔄 Репринт:
            <a href="#" onclick="event.preventDefault(); navigate('issue-detail', { id: ${src.id} })"
               style="color:var(--accent); text-decoration:none; font-weight:500;">
                ${src.name || 'Без назви'} #${src.issue_number || '?'}
            </a>
            ${src.volume_name ? `<span style="color:var(--text-muted);">${src.volume_name}</span>` : ''}
        </div>
    `).join('');

    return `
    <div style="background:var(--bg-primary); border:1px solid var(--border-color); border-radius:8px; padding:1.5rem; margin-bottom:1rem;">
        ${badges ? `<div style="margin-bottom:0.75rem;">${badges}</div>` : ''}

        <h2 style="font-size:1.35rem; margin:0 0 0.25rem;">${title}</h2>
        ${titleOriginal
            ? `<div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.75rem;">${titleOriginal}</div>`
            : ''}

        <!-- Появи (заглушка) -->
        <div style="margin-top:1.25rem;">
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;
                        letter-spacing:0.06em; margin-bottom:0.5rem;">Появи</div>
            <div style="color:var(--text-secondary); font-size:0.9rem; font-style:italic;">— поки порожньо —</div>
        </div>

        <!-- Сюжет -->
        <div style="margin-top:1.25rem;">
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;
                        letter-spacing:0.06em; margin-bottom:0.5rem;">Сюжет</div>
            ${plot
                ? `<div style="line-height:1.65; color:var(--text-primary);">${plot}</div>`
                : `<div style="color:var(--text-secondary); font-size:0.9rem; font-style:italic;">— поки порожньо —</div>`}
        </div>
    </div>
    `;
}

export async function renderIssueDetail(params) {
    const issueId = params.id;
    currentVolumeId = params.volumeId || null;
    currentIssueId = issueId;

    if (!issueId) { navigate('issues'); return; }

    initDetailPage();
    showLoading();

    try {
        const [issue, roData, colMemberData, reprintsData, reprintSourceData, storiesData, magMemberData, magChaptersData] = await Promise.all([
            fetchItem('issues', issueId),
            fetch(`${API_BASE}/issues/${issueId}/reading-orders`).then(r => r.json()),
            fetch(`${API_BASE}/issues/${issueId}/collections-membership`).then(r => r.json()),
            fetch(`${API_BASE}/issues/${issueId}/reprints`).then(r => r.json()),
            fetch(`${API_BASE}/issues/${issueId}/reprint-source`).then(r => r.json()),
            fetch(`${API_BASE}/issues/${issueId}/stories`).then(r => r.json()),
            fetch(`${API_BASE}/issues/${issueId}/magazine-memberships`).then(r => r.json()),
            fetch(`${API_BASE}/issues/${issueId}/magazine-chapters`).then(r => r.ok ? r.json() : { data: [] }),
        ]);

        const volumeThemeIds        = issue.volume_theme_ids || [];                     // теми батьківського тому
        const isTranslatedVolume    = volumeThemeIds.includes(51);                      // том — переклад (theme 51)
        const isCollectionVolume    = volumeThemeIds.includes(44);                      // том — збірник (theme 44)
        const isReprintVolume       = volumeThemeIds.includes(71);                      // том — репринт (theme 71)

        const isMangaChapter        = !issue.cv_vol_id && !!issue.ds_vol_id;            // розділ манги (ds_vol_id є, cv_vol_id — немає)
        const isMagazineIssue       = volumeThemeIds.includes(35) && !isMangaChapter;   // випуск журналу (theme 35), не розділ манги

        const isCollection          = !!issue.collection_id;                            // випуск є збірником

        const readingOrders         = roData.data || [];                                // хронології, до яких належить
        const collectionMemberships = colMemberData.data || [];                         // збірники, до яких входить
        const issueReprints         = reprintsData.data || [];                          // репринти цього випуску
        const reprintSources        = reprintSourceData.data || [];                     // оригінали, з яких перевидано
        const issueStories          = storiesData.data || [];                           // сюжетні блоки всередині випуску
        const hasStories            = issueStories.length > 0;                          // чи є хоч одна історія
        const magazineMemberships   = magMemberData.data || [];                         // випуски журналів, де є цей розділ
        const magazineChapters      = magChaptersData.data || [];                       // розділи манги у цьому випуску журналу
        const isTranslatedSingle    = isTranslatedVolume && !isCollectionVolume;        // переклад одиночного випуску
        const isOriginalIssue       = !isTranslatedVolume && !isReprintVolume;          // оригінальний випуск (не репринт, не переклад)
        const isReprintOrTranslated = isTranslatedSingle || isReprintVolume;            // будь-яке перевидання — для блоків контенту

        const issueTitle = isMangaChapter
            ? `${issue.volume_name || 'Манга'} — Розділ #${issue.issue_number || issue.id}`
            : `${issue.name || 'Без назви'} #${issue.issue_number || '?'}`;

        document.getElementById('page-title').innerHTML = `
            <a href="#" onclick="event.preventDefault(); navigateToParent()">
                <i class="bi bi-caret-left"></i> Випуски
            </a>
            <span style="font-weight:600; color:var(--text-primary);">${issueTitle}</span>
            ${!isMangaChapter && issue.cv_id
                ? `<a href="https://comicvine.gamespot.com/${issue.cv_slug}/4000-${issue.cv_id}" target="_blank"
                    style="font-size:0.7rem;padding:0.15em 0.5em;border-radius:6px;background:var(--bg-tertiary);
                            border:1px solid var(--border-color);color:var(--text-muted);text-decoration:none;white-space:nowrap;">
                    CV&thinsp;4000-${issue.cv_id}
                </a>`
                : ''}
            <span style="font-size:0.7rem;padding:0.15em 0.5em;border-radius:6px;background:var(--bg-tertiary);
                        border:1px solid var(--border-color);color:var(--text-muted);white-space:nowrap;">
                ➕&thinsp;${formatDate(issue.created_at)}
            </span>
        `;
        const content = document.getElementById('content');
        content.innerHTML = `
            <div style="max-width: 1200px;">
                <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
                    <div style="flex-shrink: 0;">
                        ${issue.cv_img
                            ? `<img src="${issue.cv_img.startsWith('https') ? issue.cv_img : issue.cv_img.startsWith('/') ? cv_img_path_original + issue.cv_img : cv_img_path_original + '/' + issue.cv_img}" alt="${issue.name}"
                                style="width: 300px; border-radius: 8px; box-shadow: var(--shadow-lg);">`
                            : '<div style="width: 300px; height: 450px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 4rem;">📖</div>'}
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1em;">
                                <a href="https://comicvine.gamespot.com/${issue.cv_slug}/4000-${issue.cv_id}" target="_blank">${ICONS.cv_logo_svg}</a>
                            </div>
                    </div>
                    <div style="flex: 1;">
                        <h1 style="font-size: 2rem; margin-bottom: 1rem;">${issue.name || 'Без назви'} #${issue.issue_number}</h1>
                        <div style="margin-bottom:1.25rem;">
                            <div style="display:flex; flex-wrap:wrap; gap:0.35rem; align-items:center; margin-bottom:0.5rem;">
                                ${!isMangaChapter && issue.volume_name
                                    ? `<a href="#" onclick="event.preventDefault(); navigateToVolumeFromIssue(${issue.cv_vol_id})"
                                        style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.2rem 0.6rem;border-radius:6px;
                                                font-size:0.8rem;background:var(--chip-publisher-bg-solid);color:var(--chip-publisher-color);
                                                border:1px solid var(--chip-publisher-border-solid);text-decoration:none;">
                                        📚 ${issue.volume_name}
                                    </a>`
                                    : ''}
                                ${isMangaChapter && issue.volume_name
                                    ? `<a href="#" onclick="event.preventDefault(); navigate('volume-detail', { id: ${issue.ds_vol_id} })"
                                        style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.2rem 0.6rem;border-radius:6px;
                                                font-size:0.8rem;background:var(--chip-publisher-bg-solid);color:var(--chip-publisher-color);
                                                border:1px solid var(--chip-publisher-border-solid);text-decoration:none;">
                                        📚 ${issue.volume_name}
                                    </a>`
                                    : ''}
                                ${issue.cover_date && issue.cover_date !== '0000-00-00'
                                    ? `<span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.2rem 0.6rem;border-radius:6px;
                                                    font-size:0.8rem;background:var(--badge-year-bg-solid);color:var(--badge-year-color);
                                                    border:1px solid var(--badge-year-border-solid);" title="Дата обкладинки">
                                        📅 ${formatCoverDate(issue.cover_date)}
                                    </span>`
                                    : ''}
                                ${issue.release_date
                                    ? `<span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.2rem 0.6rem;border-radius:6px;
                                                    font-size:0.8rem;background:var(--bg-tertiary);color:var(--text-secondary);
                                                    border:1px solid var(--border-color);" title="Дата релізу">
                                        🚀 ${formatReleaseDate(issue.release_date)}
                                    </span>`
                                    : ''}
                                ${readingOrders.map(ro => `
                                    <span class="theme-badge" style="cursor:pointer;" title="Хронологія"
                                        onclick="navigateTo('reading-order-detail', ${ro.id})">
                                        📋 ${ro.name}&thinsp;<span style="opacity:0.6;">#${ro.order_num}</span>
                                    </span>
                                `).join('')}
                            </div>
                            ${hasStories
                                ? `<div style="display:flex; flex-direction:column; gap:0.2rem;">
                                    ${issueStories.map((s, i) => `
                                        <span style="font-size:0.82rem;color:var(--text-secondary);">
                                            ${i + 1}. ${s.name_ua || s.name_original || '— без назви —'}
                                            ${s.name_ua && s.name_original
                                                ? `<span style="color:var(--text-muted);font-size:0.78rem;"> (${s.name_original})</span>`
                                                : ''}
                                        </span>
                                    `).join('')}
                                </div>`
                                : ''}
                        </div>

                        <!-- Рядок 1: основні дії -->
                        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem;">
                            <button class="btn btn-secondary" onclick="editIssueDetail(${issue.id})">Редагувати</button>
                            ${isCollection ? `
                                <button class="btn btn-success" onclick="navigate('collection-detail', ${issue.collection_id})">📚 Переглянути збірник →</button>
                            ` : `
                                <button class="btn btn-warning" onclick="makeCollection(${issue.id})">📚 Зробити збірником</button>
                            `}
                        </div>

                        <!-- Рядок 2: додавання до -->
                        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.75rem;">
                            <button class="btn btn-primary" onclick="openIssueAddToVolumeModal(${issue.id})">📚 Змінити том</button>
                            <button class="btn btn-primary" onclick="openIssueAddToCollectionModal(${issue.id})">📗 Додати до збірника</button>
                            <button class="btn btn-primary" onclick="openIssueAddToROModal(${issue.id})">📋 Додати до хронології</button>
                            ${isMangaChapter && magazineMemberships.length === 0 ? `
                                <button class="btn btn-secondary" onclick="openAddChapterToMagazineModal(${issue.id})">📰 Додати до журналу</button>
                            ` : ''}
                        </div>

                        ${isMangaChapter && magazineMemberships.length > 0 ? `
                            <div id="manga-magazine-block" style="display:inline-block; width:300px; background:var(--bg-primary); padding:.5rem; border-radius:8px; margin-top:1em;">
                                <div style="display:flex; align-items:center; margin-bottom:0.75rem;">
                                    <h2 style="font-size:1.1rem; margin:0;">📰 Журнали</h2>
                                </div>
                                ${magazineMemberships.map(mag => `
                                    <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; margin-bottom:0.5rem;">
                                        <div style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; flex:1;"
                                            onclick="navigate('issue-detail', { id: ${mag.mag_issue_id} })">
                                            ${mag.mag_issue_cv_img
                                                ? `<img src="${mag.mag_issue_cv_img.startsWith('https') ? mag.mag_issue_cv_img : cv_img_path_small + (mag.mag_issue_cv_img.startsWith('/') ? '' : '/') + mag.mag_issue_cv_img}"
                                                    style="width:40px;height:56px;object-fit:cover;border-radius:4px;flex-shrink:0;">`
                                                : '<div style="width:40px;height:56px;background:var(--bg-secondary);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">📰</div>'}
                                            <div>
                                                <div style="font-weight:600; font-size:0.9rem;">${mag.magazine_name}</div>
                                                <div style="font-size:0.8rem; color:var(--text-secondary);">
                                                    #${mag.mag_issue_number || '?'}
                                                    ${mag.mag_issue_name ? ` · ${mag.mag_issue_name}` : ''}
                                                </div>
                                                ${mag.page_type ? `<div style="font-size:0.75rem; color:var(--text-muted);">${
                                                    mag.page_type === 'color'    ? '🎨 Кольорова сторінка' :
                                                    mag.page_type === 'cover'    ? '🖼️ Обкладинка' :
                                                    mag.page_type === 'combined' ? '🔗 Разом' : ''
                                                }</div>` : ''}
                                            </div>
                                        </div>
                                        <button class="btn btn-danger btn-small"
                                                onclick="removeChapterFromMagazine(${issueId}, ${mag.mag_issue_id}, ${mag.link_id})">✕</button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Модалка: додати до хронології -->
            <div id="issue-add-ro-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
                <div style="background:var(--bg-primary); border-radius:8px; padding:1.5rem; width:500px; max-width:90vw;">
                    <h3 style="margin-bottom:1rem;">Додати до хронології</h3>
                    <div class="form-group">
                        <input type="text" id="iro-search" placeholder="Введіть назву хронології..." style="width:100%;">
                    </div>
                    <div id="iro-results" style="max-height:260px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-bottom:0.75rem; min-height:48px;"></div>
                    <div id="iro-position-row" style="display:none;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:0.875rem; font-weight:500;">
                                Позиція в хронології
                                <span style="color:var(--text-secondary); font-weight:400;">(порожньо = в кінець)</span>
                            </label>
                            <input type="number" id="iro-position" placeholder="наприклад: 5" min="1" style="width:100%; margin-top:0.35rem;">
                            <div id="iro-total-hint" style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;"></div>
                        </div>
                        <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:1rem;">
                            <button class="btn btn-secondary" onclick="closeIssueAddToROModal()">Скасувати</button>
                            <button class="btn btn-primary" id="iro-confirm-btn" onclick="confirmAddToRO()">Додати</button>
                        </div>
                    </div>
                    <div id="iro-cancel-row" style="display:flex; justify-content:flex-end; margin-top:0.5rem;">
                        <button class="btn btn-secondary" onclick="closeIssueAddToROModal()">Скасувати</button>
                    </div>
                </div>
            </div>

            <!-- Навігація між випусками тому -->
            <div id="issue-volume-nav" style="display: flex; margin-top: 1.5rem; justify-content: center;"></div>

            ${collectionMemberships.length > 0 ? (() => {
                // Групуємо за батьківським томом
                const groups = [];
                const groupMap = new Map();
                for (const c of collectionMemberships) {
                    const key = c.parent_vol_id ?? `__no_vol__${c.cv_vol_id}`;
                    if (!groupMap.has(key)) {
                        groupMap.set(key, {
                            vol_id:   c.parent_vol_id,
                            vol_name: c.parent_vol_name || c.name || 'Без тому',
                            vol_lang: c.parent_vol_lang || null,
                            cols: [],
                        });
                        groups.push(groupMap.get(key));
                    }
                    groupMap.get(key).cols.push(c);
                }

                const groupsHtml = groups.map(group => {
                    const langLabel = group.vol_lang ? langDisplay(group.vol_lang) : '';
                    const volClick = group.vol_id
                        ? `onclick="navigate('volume-detail', { id: ${group.vol_id} })"`
                        : '';

                    const cards = group.cols.map(c => {
                        const imgUrl = c.cv_img
                            ? (c.cv_img.startsWith('https') ? c.cv_img
                                : c.cv_img.startsWith('/') ? cv_img_path_small + c.cv_img
                                : cv_img_path_small + '/' + c.cv_img)
                            : null;
                        const year = c.cover_date
                            ? c.cover_date.substring(0, 4)
                            : c.release_date
                                ? c.release_date.substring(0, 4)
                                : null;
                        return `
                            <div onclick="navigateTo('collection-detail', ${c.id})"
                                style="display:flex; flex-direction:column; max-width: calc(100px + .5em); align-items:center; cursor:pointer;
                                        background:var(--bg-secondary); border:1px solid var(--border-color);
                                        border-radius:8px; padding:.2em;
                                        transition:box-shadow 0.15s;"
                                onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.18)'"
                                onmouseout="this.style.boxShadow='none'">
                                ${imgUrl
                                    ? `<img src="${imgUrl}" style="width:100px;height:160px;object-fit:cover;border-radius:4px;margin-bottom:.25rem;">`
                                    : `<div style="width:100px;height:160px;background:var(--bg-tertiary);border-radius:4px;
                                                display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:.25rem;">📗</div>`}
                                <div style="font-size:0.75rem; font-weight:600; text-align:center; line-height:1.2;">
                                    ${c.name || '—'}
                                </div>
                                ${year ? `<div style="font-size:0.7rem; color:var(--text-secondary);">${year}</div>` : ''}
                            </div>`;
                    }).join('');

                    return `
                        <div style="margin-bottom:1.25rem;">
                            <div style="display:flex; align-items:center; gap: .1em; margin-bottom:0.5rem;">
                                <span style="font-size:0.95rem; font-weight:600;
                                            cursor:${group.vol_id ? 'pointer' : 'default'};
                                            color:var(--text-primary);" ${volClick}>
                                    ${group.vol_name}
                                </span>
                                ${langLabel ? `
                                    <span style="font-size: .75rem; background: var(--bg-tertiary); padding: .1em 0.4em; color: var(--text-secondary);">
                                        ${langLabel}
                                    </span>
                                ` : ''}
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap: .6em;">
                                ${cards}
                            </div>
                        </div>`;
                }).join('');

                return `
                    <div style="background:var(--bg-primary); padding:1.5rem; border-radius:8px;
                                border:1px solid var(--border-color); margin-top:1.5rem;">
                        <h2 style="font-size:1.2rem; margin-bottom:1rem;">
                            📚 У збірниках (${collectionMemberships.length})
                        </h2>
                        ${groupsHtml}
                    </div>`;
            })() : ''}

            ${isMagazineIssue ? `
                <div style="background:var(--bg-primary); padding:1.5rem; border-radius:8px; border:1px solid var(--border-color); margin-top:1.5rem;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem;">
                        <h2 style="font-size:1.1rem; margin:0;">📖 Зміст (${magazineChapters.length})</h2>
                        <button class="btn btn-primary btn-small"
                                onclick="openAddMangaChapterToMagModal(${issue.id}, new Set([${magazineChapters.map(ch => ch.issue_id).join(',')}]))">
                            + Додати розділ
                        </button>
                    </div>
                    ${magazineChapters.length > 0 ? `
                    <div style="display:flex; flex-direction:column; gap:0.4rem;">
                        ${magazineChapters.map(ch => `
                            <div style="display:flex; align-items:center; gap:0.75rem; background:var(--bg-secondary);
                                        border-radius:6px; padding:0.5rem 0.75rem;">
                                <div style="cursor:pointer; display:flex; align-items:center; gap:0.75rem; flex:1; min-width:0;"
                                    onclick="navigate('issue-detail', { id: ${ch.issue_id} })">
                                    ${ch.cv_img
                                        ? `<img src="${ch.cv_img.startsWith('https') ? ch.cv_img : cv_img_path_small + (ch.cv_img.startsWith('/') ? '' : '/') + ch.cv_img}"
                                            style="width:36px;height:50px;object-fit:cover;border-radius:3px;flex-shrink:0;">`
                                        : '<div style="width:36px;height:50px;background:var(--bg-tertiary);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">📖</div>'}
                                    <div style="flex:1; min-width:0;">
                                        <div style="font-weight:600; font-size:0.85rem; color:var(--text-secondary);">${ch.vol_name}</div>
                                        <div style="font-size:0.95rem; font-weight:500;">Розділ #${ch.issue_number || '?'}</div>
                                        ${ch.issue_name && ch.issue_name !== `Розділ ${ch.issue_number}` ? `
                                            <div style="font-size:0.8rem; color:var(--text-secondary);">${ch.issue_name}</div>
                                        ` : ''}
                                    </div>
                                    ${ch.release_date ? `
                                        <span style="font-size:0.78rem; color:var(--text-muted); white-space:nowrap; padding:0.15rem 0.5rem;
                                                    background:var(--bg-tertiary); border-radius:4px; border:1px solid var(--border-color);">
                                            📅 ${ch.release_date}
                                        </span>
                                    ` : ''}
                                    ${ch.page_type ? (() => {
                                        const PAGE_TYPES = {
                                            color:    { label: 'Кольорова', bg: '#f4c65633', color: '#f4c656' },
                                            cover:    { label: 'Титульна',  bg: '#ff604e33', color: '#ff604e' },
                                            combined: { label: 'Разом',     bg: '#a78bfa33', color: '#a78bfa' },
                                        };
                                        const pt = PAGE_TYPES[ch.page_type];
                                        if (!pt) return '';
                                        return `<span style="color:${pt.color};background:${pt.bg};font-size:.8rem;line-height:1;padding:.35em .55em;border-radius:6px;font-weight:600;">${pt.label}</span>`;
                                    })() : ''}
                                </div>
                                <button class="btn btn-danger btn-small" onclick="removeChapterFromMagazine(${ch.issue_id}, ${issue.id})">✕</button>
                            </div>
                        `).join('')}
                    </div>
                    ` : `<p style="color:var(--text-secondary); font-size:0.9rem; margin:0;">Ще немає розділів. Додайте перший!</p>`}
                </div>
            ` : ''}

            <!-- ═══ БЛОК КОНТЕНТУ (сюжет, появи) ═══════════════════════════ -->
            ${!isMagazineIssue ? `
                <div id="issue-content-blocks" style="margin-top:2rem;">
                    ${renderContentBlocks(issue, issueStories, reprintSources, isReprintOrTranslated)}
                </div>
            ` : ''}

            <!-- ═══ МЕНЕДЖЕР ІСТОРІЙ ════════════════════════════════════════ -->
            ${!isMangaChapter && !isMagazineIssue ? `
            <div style="background:var(--bg-primary); padding:1.5rem; border-radius:8px; border:1px solid var(--border-color); margin-top:1.5rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:${hasStories ? '1rem' : '0'};">
                    <h2 style="font-size:1.1rem; margin:0;">📖 Історії у випуску</h2>
                    <button class="btn btn-secondary btn-small" onclick="openAddStoryModal(${issueId})">+ Додати</button>
                </div>
                ${hasStories ? `
                <div style="display:flex; flex-direction:column; gap:0.5rem;" id="stories-list">
                    ${issueStories.map(s => `
                    <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem; background:var(--bg-secondary); border-radius:6px;">
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:500;">${s.name_ua || s.name_original || '— без назви —'}</div>
                            ${s.name_original && s.name_ua ? `<div style="font-size:0.8rem; color:var(--text-secondary);">${s.name_original}</div>` : ''}
                        </div>
                        <button class="btn btn-secondary btn-small" onclick="openEditStoryModal(${issueId}, ${s.id})">✏️</button>
                        <button class="btn btn-danger btn-small" onclick="deleteStory(${issueId}, ${s.id})">✕</button>
                    </div>
                    `).join('')}
                </div>
                ` : '<div style="color:var(--text-secondary); font-size:0.9rem;">Цей випуск не містить окремих іменованих історій</div>'}
            </div>
            ` : ''}

            <!-- Блок "Репринти-сінгли" (показується для оригінальних випусків) -->
            ${isOriginalIssue && !isMagazineIssue ? `
            <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-top: 1.5rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: ${issueReprints.length ? '1rem' : '0'};">
                    <h2 style="font-size:1.1rem; margin:0;">🔁 Репринти (${issueReprints.length})</h2>
                    <button class="btn btn-secondary btn-small" onclick="openAddReprintModal(${issueId})">
                        + Вказати репринт
                    </button>
                </div>
                ${issueReprints.length > 0 ? `
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    ${issueReprints.map(rep => `
                    <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem; background:var(--bg-secondary); border-radius:6px;">
                        ${rep.cv_img
                            ? `<img src="${cv_img_path_small}${rep.cv_img.startsWith('/') ? '' : '/'}${rep.cv_img}"
                                style="width:36px; height:54px; object-fit:cover; border-radius:3px; flex-shrink:0;">`
                            : '<div style="width:36px; height:54px; background:var(--bg-tertiary); border-radius:3px; flex-shrink:0; display:flex; align-items:center; justify-content:center;">📖</div>'}
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:0.8rem; color:var(--text-secondary);">
                                ${rep.volume_lang ? `[${rep.volume_lang}] ` : ''}${rep.volume_name || ''}
                            </div>
                            <div style="font-weight:500; cursor:pointer; color:var(--accent);"
                                onclick="navigate('issue-detail', { id: ${rep.id} })">
                                ${rep.name || 'Без назви'} #${rep.issue_number || '?'}
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-secondary);">
                                ${rep.story_name_ua || rep.story_name_original
                                    ? `<span style="color:var(--accent);">«${rep.story_name_ua || rep.story_name_original}»</span>`
                                    : ''}
                            </div>
                        </div>
                        <button class="btn btn-danger btn-small" style="flex-shrink:0;"
                                onclick="removeReprint(${issueId}, ${rep.id})">✕</button>
                    </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
            ` : ''}

            <!-- Блок "Джерело" (показується для перекладених сінглів) -->
            ${isReprintOrTranslated && !isMagazineIssue ? `
            <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); margin-top: 1.5rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: ${reprintSources.length ? '1rem' : '0'};">
                    <h2 style="font-size:1.1rem; margin:0;">📄 Оригінал репринту ${reprintSources.length ? '' : ''}</h2>
                    ${(isReprintVolume || !reprintSources.length) ? `
                        <button class="btn btn-secondary btn-small" onclick="openAddReprintSourceModal(${issueId})">
                            + Вказати джерело
                        </button>` : ''}
                </div>
                ${reprintSources.length > 0 ? `
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    ${reprintSources.map(src => `
                    <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem; background:var(--bg-secondary); border-radius:6px;">
                        ${src.cv_img
                            ? `<img src="${cv_img_path_small}${src.cv_img.startsWith('/') ? '' : '/'}${src.cv_img}"
                                style="width:36px; height:54px; object-fit:cover; border-radius:3px; flex-shrink:0;">`
                            : '<div style="width:36px; height:54px; background:var(--bg-tertiary); border-radius:3px; flex-shrink:0; display:flex; align-items:center; justify-content:center;">📖</div>'}
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:0.8rem; color:var(--text-secondary);">
                                ${src.volume_name || ''}
                            </div>
                            <div style="font-weight:500; cursor:pointer; color:var(--accent);"
                                onclick="navigate('issue-detail', { id: ${src.id} })">
                                ${src.name || 'Без назви'} #${src.issue_number || '?'}
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-secondary);">
                                ${src.story_name_ua || src.story_name_original
                                    ? `<span style="color:var(--accent);">«${src.story_name_ua || src.story_name_original}»</span>`
                                    : ''}
                            </div>
                        </div>
                        <button class="btn btn-danger btn-small" style="flex-shrink:0;"
                                onclick="removeReprintSource(${issueId}, ${src.id})">✕</button>
                    </div>
                    `).join('')}
                </div>
                ` : '<div style="color:var(--text-secondary); font-size:0.9rem;">Джерело не вказано</div>'}
            </div>
            ` : ''}
        `;

        // Монтуємо навігацію між випусками тому
        if (issue.cv_vol_id || issue.ds_vol_id) {
            mountIssueVolumeNav(issue);
        }

    } catch (error) {
        console.error('Помилка завантаження випуску:', error);
        showError('Помилка завантаження даних');
    }
}

// ===== РЕДАГУВАННЯ =====
function getIssueFormHTML(issue = null) {
    const isMangaChapter = !issue?.cv_id && !!issue?.ds_vol_id;
    return `
        <form id="edit-form">
            ${!isMangaChapter ? `
            <div class="form-row">
                <div class="form-group"><label>CV ID</label><input type="number" name="cv_id" value="${issue?.cv_id || ''}"></div>
                <div class="form-group"><label>CV Slug</label><input type="text" name="cv_slug" value="${issue?.cv_slug || ''}"></div>
            </div>` : ''}
            <div class="form-group"><label>Назва</label><input type="text" name="name" value="${issue?.name || ''}"></div>
            <div class="form-row">
                ${!isMangaChapter ? `
                <div class="form-group"><label>Volume CV ID</label><input type="number" name="cv_vol_id" value="${issue?.cv_vol_id || ''}"></div>
                ` : `
                <div class="form-group">
                    <label>Том манги (ds_vol_id)</label>
                    <input type="number" name="ds_vol_id" value="${issue?.ds_vol_id || ''}">
                    ${issue?.volume_name ? `<small style="color:var(--text-secondary);">${issue.volume_name}</small>` : ''}
                </div>
                `}
                <div class="form-group"><label>Номер розділу</label><input type="text" name="issue_number" value="${issue?.issue_number || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Дата обкладинки</label><input type="date" name="cover_date" value="${issue?.cover_date || ''}"></div>
                <div class="form-group"><label>Дата випуску</label><input type="date" name="release_date" value="${issue?.release_date || ''}"></div>
            </div>
            <div class="form-group"><label>URL зображення</label><input type="text" name="cv_img" value="${issue?.cv_img || ''}"></div>
        </form>
    `;
}

window.editIssueDetail = async (id) => {
    const issue = await fetch(`${API_BASE}/issues/${id}`).then(r => r.json());
    openModal('Редагувати випуск', getIssueFormHTML(issue), async (data) => {
        await updateItem('issues', id, data);
        await renderIssueDetail({ id });
        await window.updateStats();
    });
};

window.makeCollection = async (issueId) => {
    if (!confirm('Перетворити цей випуск на збірник?\n\nВипуск буде ВИДАЛЕНО і замінено збірником зі своїм списком випусків.')) return;
    const response = await fetch(`${API_BASE}/issues/${issueId}/make-collection`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (!response.ok) {
        if (result.collection_id) { navigate('collection-detail', { id: result.collection_id }); return; }
        alert(result.error || 'Помилка');
        return;
    }
    await window.updateStats();
    navigate('collection-detail', { id: result.collection.id });
};

window.navigateToVolumeFromIssue = async (volumeCvId) => {
    if (currentVolumeId) { navigate('volume-detail', { id: currentVolumeId }); return; }
    const res = await fetch(`${API_BASE}/volumes/by-cv-id/${volumeCvId}`);
    if (!res.ok) { alert(`Том з CV ID ${volumeCvId} не знайдено`); return; }
    const volume = await res.json();
    navigate('volume-detail', { id: volume.id });
};

// ===== ЗМІНИТИ ТОМ =====

window.openIssueAddToVolumeModal = (issueId) => {
    openSearchPickerModal({
        title: 'Змінити том',
        hint:  'Знайдіть том і клікніть для підтвердження.',
        inputs: [
            { id: 'name',  label: 'Назва тому', placeholder: 'Введіть назву...' },
            { id: 'cv_id', label: 'CV ID тому',  placeholder: 'CV ID...', type: 'number' },
        ],
        searchFn: async ({ name, cv_id }) => {
            const params = new URLSearchParams({ limit: 20 });
            if (name)  params.set('search', name);
            if (cv_id) params.set('cv_id', cv_id);
            if (!name && !cv_id) return [];
            const res = await fetch(`${API_BASE}/volumes?${params}`);
            const data = await res.json();
            return data.data || [];
        },
        renderItem: (vol, idx) => `
            <div data-spm-item="${idx}"
                 style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; border-bottom:1px solid var(--border-color);">
                ${vol.cv_img
                    ? `<img src="${cv_img_path_small}${vol.cv_img.startsWith('/') ? '' : '/'}${vol.cv_img}"
                            style="width:40px; height:60px; object-fit:cover; border-radius:3px; flex-shrink:0;">`
                    : '<div style="width:40px; height:60px; background:var(--bg-secondary); border-radius:3px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">📚</div>'}
                <div>
                    <div style="font-weight:500;">${vol.name}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary);">CV ID: ${vol.cv_id}</div>
                </div>
            </div>
        `,
        onSelect: async (vol) => {
            if (!confirm(`Змінити том цього випуску на "${vol.name}"?`)) return;
            const issue = await fetch(`${API_BASE}/issues/${issueId}`).then(r => r.json());
            const res = await fetch(`${API_BASE}/issues/${issueId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...issue, cv_vol_id: vol.cv_id }),
            });
            if (!res.ok) { alert('Помилка збереження'); return; }
            await renderIssueDetail({ id: issueId });
        },
    });
};

// Зворотна сумісність
window.closeIssueAddToVolumeModal = () => closeSearchPickerModal();

// ===== ДОДАТИ ДО ЗБІРНИКА =====

window.openIssueAddToCollectionModal = (issueId) => {
    openSearchPickerModal({
        title: 'Додати до збірника',
        inputs: [
            { id: 'name',  label: 'Назва збірника', placeholder: 'Введіть назву...' },
            { id: 'cv_id', label: 'CV ID збірника',  placeholder: 'CV ID...', type: 'number' },
        ],
        searchFn: async ({ name, cv_id }) => {
            const params = new URLSearchParams({ limit: 20 });
            if (name)  params.set('name', name);
            if (cv_id) params.set('cv_id', cv_id);
            if (!name && !cv_id) return [];
            const res = await fetch(`${API_BASE}/collections/search?${params}`);
            const data = await res.json();
            return data.data || [];
        },
        renderItem: (col, idx) => `
            <div data-spm-item="${idx}"
                 style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; border-bottom:1px solid var(--border-color);">
                ${col.cv_img
                    ? `<img src="${cv_img_path_small}${col.cv_img.startsWith('/') ? '' : '/'}${col.cv_img}"
                            style="width:40px; height:60px; object-fit:cover; border-radius:3px; flex-shrink:0;">`
                    : '<div style="width:40px; height:60px; background:var(--bg-secondary); border-radius:3px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">📗</div>'}
                <div>
                    <div style="font-weight:500;">${col.name}</div>
                    ${col.volume_name ? `<div style="font-size:0.8rem; color:var(--text-secondary);">${col.volume_name}</div>` : ''}
                    ${col.cv_id ? `<div style="font-size:0.75rem; color:var(--text-tertiary);">CV ID: ${col.cv_id}</div>` : ''}
                </div>
            </div>
        `,
        onSelect: async (col) => {
            const res = await fetch(`${API_BASE}/collections/${col.id}/issues`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issue_id: issueId }),
            });
            if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
            await renderIssueDetail({ id: issueId });
        },
    });
};

// Зворотна сумісність
window.closeIssueAddToCollectionModal = () => closeSearchPickerModal();

// ===== ДОДАТИ ДО ХРОНОЛОГІЇ =====
let iroSelectedOrderId = null;
let iroSelectedOrderTotal = 0;
let iroCurrentIssueId = null;
let iroSearchTimeout = null;

window.openIssueAddToROModal = (issueId) => {
    iroCurrentIssueId = issueId;
    iroSelectedOrderId = null;
    document.getElementById('issue-add-ro-modal').style.display = 'flex';
    const input = document.getElementById('iro-search');
    input.value = '';
    document.getElementById('iro-results').innerHTML = '';
    document.getElementById('iro-position-row').style.display = 'none';
    document.getElementById('iro-cancel-row').style.display = 'flex';
    input.oninput = (e) => {
        clearTimeout(iroSearchTimeout);
        iroSearchTimeout = setTimeout(() => searchROForIssue(e.target.value), 300);
    };
    input.focus();
};

window.closeIssueAddToROModal = () => {
    document.getElementById('issue-add-ro-modal').style.display = 'none';
    iroSelectedOrderId = null;
    iroCurrentIssueId = null;
};

async function searchROForIssue(query) {
    if (!query.trim()) { document.getElementById('iro-results').innerHTML = ''; return; }
    const res = await fetch(`${API_BASE}/reading-orders?search=${encodeURIComponent(query)}&limit=20`);
    const result = await res.json();
    const el = document.getElementById('iro-results');
    if (!result.data?.length) { el.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Нічого не знайдено</div>'; return; }
    el.innerHTML = result.data.map(ro => `
        <div onclick="selectROForIssue(${ro.id}, ${ro.issue_count || 0})"
             style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
             onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
            <span style="font-weight:500;">${ro.name}</span>
            <span style="font-size:0.8rem; color:var(--text-secondary);">📖 ${ro.issue_count || 0} випусків</span>
        </div>
    `).join('');
}

window.selectROForIssue = (orderId, total) => {
    iroSelectedOrderId = orderId;
    iroSelectedOrderTotal = total;
    // Показуємо рядок позиції, ховаємо нижню кнопку скасування
    document.getElementById('iro-position-row').style.display = 'block';
    document.getElementById('iro-cancel-row').style.display = 'none';
    document.getElementById('iro-position').value = '';
    document.getElementById('iro-total-hint').textContent = `Зараз у хронології ${total} випусків. Нова позиція буде від 1 до ${total + 1}.`;
    document.getElementById('iro-position').focus();
};

window.confirmAddToRO = async () => {
    if (!iroSelectedOrderId || !iroCurrentIssueId) return;
    const posInput = document.getElementById('iro-position').value.trim();
    const body = { issue_id: parseInt(iroCurrentIssueId) };
    if (posInput !== '') body.order_num = parseInt(posInput);

    const res = await fetch(`${API_BASE}/reading-orders/${iroSelectedOrderId}/issues`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    window.closeIssueAddToROModal();
    await renderIssueDetail({ id: iroCurrentIssueId });
};

// ═══════════════════════════════════════════════════════════════
// РЕПРИНТИ (issue_reprints)
// ═══════════════════════════════════════════════════════════════

// Відкрити пікер для додавання репринту (з боку оригіналу)
window.openAddReprintModal = (issueId) => {
    openSearchPickerModal({
        title: 'Вказати репринт-сінгл',
        hint: 'Знайдіть перекладений випуск-сінгл і клікніть для підтвердження.',
        inputs: [
            { id: 'name',        label: 'Назва випуску', placeholder: 'Назва...' },
            { id: 'volume_name', label: 'Том',           placeholder: 'Том...'   },
        ],
        searchFn: async ({ name, volume_name }) => {
            const params = new URLSearchParams({ limit: 20 });
            if (name)        params.set('name', name);
            if (volume_name) params.set('volume_name', volume_name);
            if (!name && !volume_name) return [];
            const res = await fetch(`${API_BASE}/issues?${params}`);
            const data = await res.json();
            return data.data || [];
        },
        renderItem: (issue, idx) => `
            <div data-spm-item="${idx}"
                 style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; border-bottom:1px solid var(--border-color);">
                ${issue.cv_img
                    ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}"
                        style="width:36px; height:54px; object-fit:cover; border-radius:3px; flex-shrink:0;">`
                    : '<div style="width:36px; height:54px; background:var(--bg-secondary); border-radius:3px; flex-shrink:0; display:flex; align-items:center; justify-content:center;">📖</div>'}
                <div>
                    <div style="font-weight:500;">${issue.name || 'Без назви'} #${issue.issue_number || '?'}</div>
                    ${issue.volume_name ? `<div style="font-size:0.8rem; color:var(--text-secondary);">${issue.volume_name}</div>` : ''}
                </div>
            </div>
        `,
        onSelect: async (selectedIssue) => {
            const res = await fetch(`${API_BASE}/issues/${issueId}/reprints`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reprint_id: selectedIssue.id }),
            });
            if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
            await renderIssueDetail({ id: issueId });
        },
    });
};

// Відкрити пікер для додавання джерела (з боку репринту)
window.openAddReprintSourceModal = (issueId) => {
    openSearchPickerModal({
        title: 'Вказати джерело (оригінал)',
        hint: 'Знайдіть оригінальний випуск і клікніть для підтвердження.',
        inputs: [
            { id: 'name',        label: 'Назва випуску', placeholder: 'Назва...' },
            { id: 'volume_name', label: 'Том',           placeholder: 'Том...'   },
        ],
        searchFn: async ({ name, volume_name }) => {
            const params = new URLSearchParams({ limit: 20 });
            if (name)        params.set('name', name);
            if (volume_name) params.set('volume_name', volume_name);
            if (!name && !volume_name) return [];
            const res = await fetch(`${API_BASE}/issues?${params}`);
            const data = await res.json();
            return data.data || [];
        },
        renderItem: (issue, idx) => `
            <div data-spm-item="${idx}"
                 style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; border-bottom:1px solid var(--border-color);">
                ${issue.cv_img
                    ? `<img src="${cv_img_path_small}${issue.cv_img.startsWith('/') ? '' : '/'}${issue.cv_img}"
                        style="width:36px; height:54px; object-fit:cover; border-radius:3px; flex-shrink:0;">`
                    : '<div style="width:36px; height:54px; background:var(--bg-secondary); border-radius:3px; flex-shrink:0; display:flex; align-items:center; justify-content:center;">📖</div>'}
                <div>
                    <div style="font-weight:500;">${issue.name || 'Без назви'} #${issue.issue_number || '?'}</div>
                    ${issue.volume_name ? `<div style="font-size:0.8rem; color:var(--text-secondary);">${issue.volume_name}</div>` : ''}
                </div>
            </div>
        `,
        onSelect: async (selectedIssue) => {
            // Перевіряємо — чи є у виданні окремі історії
            const stData = await fetch(`${API_BASE}/issues/${selectedIssue.id}/stories`).then(r => r.json());
            const srcStories = stData.data || [];

            let chosenStoryId = null;

            if (srcStories.length > 0) {
                // Показуємо додатковий крок — вибір конкретної історії
                chosenStoryId = await pickStoryFromIssue(selectedIssue, srcStories);
                if (chosenStoryId === false) return; // скасовано
            }

            const res = await fetch(`${API_BASE}/issues/${issueId}/reprint-source`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ original_id: selectedIssue.id, story_id: chosenStoryId }),
            });
            if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
            await renderIssueDetail({ id: issueId });
        },
    });
};

// Видалити репринт
window.removeReprint = async (issueId, reprintId) => {
    if (!confirm('Видалити зв\'язок з репринтом?')) return;
    const res = await fetch(`${API_BASE}/issues/${issueId}/reprints/${reprintId}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    await renderIssueDetail({ id: issueId });
};

// Видалити джерело
window.removeReprintSource = async (issueId, originalId) => {
    if (!confirm('Видалити зв\'язок з джерелом?')) return;
    const res = await fetch(`${API_BASE}/issues/${issueId}/reprint-source/${originalId}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    await renderIssueDetail({ id: issueId });
};

// ═══════════════════════════════════════════════════════════════
// НАВІГАЦІЯ МІЖ ВИПУСКАМИ ТОМУ
// ═══════════════════════════════════════════════════════════════

const ISSUE_NAV_PAGE_SIZE = 100;
let _inav_issues   = [];
let _inav_page     = 0;
let _inav_current  = null; // id поточного випуску

function _inavInjectCSS() {
    if (document.getElementById('issue-nav-style')) return;
    const s = document.createElement('style');
    s.id = 'issue-nav-style';
    document.head.appendChild(s);
}

function _inavRender() {
    const container = document.getElementById('issue-volume-nav');
    if (!container) return;

    const total      = _inav_issues.length;
    const totalPages = Math.ceil(total / ISSUE_NAV_PAGE_SIZE);
    const start      = _inav_page * ISSUE_NAV_PAGE_SIZE;
    const slice      = _inav_issues.slice(start, start + ISSUE_NAV_PAGE_SIZE);
    const needsPager = total > ISSUE_NAV_PAGE_SIZE;
    
    let gridStyle = '';
    if (slice.length > 0) {
        const colCount = slice.length <= 20 ? slice.length : 20;
        gridStyle = `grid-template-columns: repeat(${colCount}, 1fr) !important;`;
    }

    const pagerHTML = needsPager ? `
        <div class="inav__pager">
            <button class="inav__pager-btn" id="inav-prev" ${_inav_page === 0 ? 'disabled' : ''}>‹</button>
            <input class="inav__pager-input" id="inav-goto" type="number" min="1" max="${totalPages}" placeholder="${_inav_page + 1}" title="Перейти на сторінку"><span class="inav__pager-info"> / ${totalPages}</span>
            <button class="inav__pager-btn" id="inav-next" ${_inav_page >= totalPages - 1 ? 'disabled' : ''}>›</button>
        </div>
    ` : '';

    container.innerHTML = `
        <div class="inav" style="width: fit-content;">
            <div class="inav__header">
                <div style="display: flex; gap: .5em;">
                    <span class="inav__label">${_inav_issues._isManga ? 'Розділи тому' : 'Випуски тому'}</span>
                    <span class="inav__label">(${total})</span>
                </div>
                ${pagerHTML}
            </div>
            <div class="inav__grid" style="${gridStyle}">
                ${slice.map(iss => `
                    <button
                        class="inav__btn${iss.id === _inav_current ? ' inav__btn--current' : ''}"
                        data-issue-id="${iss.id}"
                        title="${iss.name || ''} #${iss.issue_number}"
                    >#${iss.issue_number}</button>
                `).join('')}
            </div>
        </div>
    `;

    // Пагінація
    container.querySelector('#inav-prev')?.addEventListener('click', () => {
        if (_inav_page > 0) { _inav_page--; _inavRender(); }
    });
    container.querySelector('#inav-next')?.addEventListener('click', () => {
        if (_inav_page < totalPages - 1) { _inav_page++; _inavRender(); }
    });
    container.querySelector('#inav-goto')?.addEventListener('change', (e) => {
        const p = parseInt(e.target.value) - 1;
        if (!isNaN(p) && p >= 0 && p < totalPages) { _inav_page = p; _inavRender(); }
        else e.target.value = '';
    });

    // Навігація по кнопках випусків
    container.querySelectorAll('.inav__btn:not(.inav__btn--current)').forEach(btn => {
        btn.addEventListener('click', () => {
            navigate('issue-detail', { id: parseInt(btn.dataset.issueId) });
        });
    });
}

export async function mountIssueVolumeNav(issue) {
    _inavInjectCSS();
    _inav_current = issue.id;

    const container = document.getElementById('issue-volume-nav');
    if (!container) return;
    container.innerHTML = '<div style="padding:0.75rem 1rem; color:var(--text-secondary); font-size:0.82rem;">Завантаження…</div>';

    try {
        const isMangaChapter = !issue.cv_vol_id && !!issue.ds_vol_id;
        const fetchUrl = isMangaChapter
            ? `${API_BASE}/issues?ds_vol_id=${issue.ds_vol_id}&limit=5000`
            : `${API_BASE}/issues?volume_id=${issue.cv_vol_id}&limit=5000`;

        const res  = await fetch(fetchUrl);
        const data = await res.json();
        const all  = data.data || [];

        // Сортуємо за issue_number як float (0, 0.5, 1, 2, …, 1000000)
        all.sort((a, b) => {
            const na = parseFloat(a.issue_number);
            const nb = parseFloat(b.issue_number);
            if (isNaN(na) && isNaN(nb)) return 0;
            if (isNaN(na)) return 1;
            if (isNaN(nb)) return -1;
            return na - nb;
        });

        _inav_issues = all;
        _inav_issues._volName = issue.volume_name || '';
        _inav_issues._isManga = isMangaChapter;

        // Визначаємо сторінку поточного випуску
        const idx = all.findIndex(i => i.id === issue.id);
        _inav_page = idx >= 0 ? Math.floor(idx / ISSUE_NAV_PAGE_SIZE) : 0;

        _inavRender();
    } catch (e) {
        console.error('issue-volume-nav: помилка завантаження', e);
        if (container) container.innerHTML = '';
    }
}

function pickStoryFromIssue(sourceIssue, stories) {
    return new Promise((resolve) => {
        // Перевикористовуємо overlay-стиль
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2000;display:flex;align-items:center;justify-content:center;';

        const box = document.createElement('div');
        box.style.cssText = 'background:var(--bg-primary);border-radius:8px;padding:1.5rem;width:460px;max-width:90vw;max-height:80vh;overflow-y:auto;';
        box.innerHTML = `
            <h3 style="margin:0 0 0.5rem;">Оберіть конкретну історію</h3>
            <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1rem;">
                Оригінальний випуск: <strong>${sourceIssue.name || 'Без назви'} #${sourceIssue.issue_number || '?'}</strong>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.4rem;">
                <button data-story-id="null"
                    style="text-align:left;padding:0.65rem 0.8rem;background:var(--bg-secondary);
                           border:1px solid var(--border-color);border-radius:6px;cursor:pointer;
                           font-size:0.9rem;color:var(--text-primary);">
                    📦 Весь випуск (без конкретної історії)
                </button>
                ${stories.map(s => `
                <button data-story-id="${s.id}"
                    style="text-align:left;padding:0.65rem 0.8rem;background:var(--bg-secondary);
                           border:1px solid var(--border-color);border-radius:6px;cursor:pointer;
                           font-size:0.9rem;color:var(--text-primary);">
                    ${s.name_ua || s.name_original || '— без назви —'}
                    ${s.name_ua && s.name_original ? `<span style="font-size:0.8rem;color:var(--text-muted);"> (${s.name_original})</span>` : ''}
                </button>
                `).join('')}
            </div>
            <div style="margin-top:1rem;text-align:right;">
                <button id="psi-cancel" class="btn btn-secondary btn-small">Скасувати</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-story-id]');
            if (btn) {
                const val = btn.dataset.storyId;
                document.body.removeChild(overlay);
                resolve(val === 'null' ? null : parseInt(val));
                return;
            }
            if (e.target === overlay || e.target.id === 'psi-cancel') {
                document.body.removeChild(overlay);
                resolve(false);
            }
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// CRUD STORIES
// ═══════════════════════════════════════════════════════════════

function getStoryFormHTML(story = null) {
    return `
        <form id="edit-form" class='story-form'>
            <div class="form-group">
                <label>Оригінальна назва</label>
                <input type="text" name="name_original" value="${story?.name_original || ''}" placeholder="Original Title">
            </div>
            <div class="form-group">
                <label>Назва українською</label>
                <input type="text" name="name_ua" value="${story?.name_ua || ''}" placeholder="Назва">
            </div>
            <div class="form-group">
                <label>Порядок</label>
                <input type="number" name="order_num" value="${story?.order_num ?? 0}" min="0" style="width:80px;">
            </div>
            <div class="form-group">
                <label>Сюжет</label>
                <textarea name="plot" rows="5" style="width:100%;">${story?.plot || ''}</textarea>
            </div>
        </form>
    `;
}

window.openAddStoryModal = (issueId) => {
    openModal('Додати історію', getStoryFormHTML(), async (data) => {
        const res = await fetch(`${API_BASE}/issues/${issueId}/stories`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
        await renderIssueDetail({ id: issueId });
    });
};

window.openEditStoryModal = async (issueId, storyId) => {
    const storiesRes = await fetch(`${API_BASE}/issues/${issueId}/stories`).then(r => r.json());
    const story = (storiesRes.data || []).find(s => s.id === storyId);
    if (!story) return;
    openModal('Редагувати історію', getStoryFormHTML(story), async (data) => {
        const res = await fetch(`${API_BASE}/issues/${issueId}/stories/${storyId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
        await renderIssueDetail({ id: issueId });
    });
};

window.deleteStory = async (issueId, storyId) => {
    if (!confirm('Видалити цю історію?')) return;
    const res = await fetch(`${API_BASE}/issues/${issueId}/stories/${storyId}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    await renderIssueDetail({ id: issueId });
};

// ===== ЖУРНАЛИ ДЛЯ РОЗДІЛІВ МАНГИ =====

// ===== ЖУРНАЛИ ДЛЯ РОЗДІЛІВ МАНГИ =====

window.openAddChapterToMagazineModal = (issueId) => {
    // Видаляємо попередню модалку якщо є
    document.getElementById('add-to-mag-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'add-to-mag-modal';
    overlay.style.cssText =
        'position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:2000;' +
        'display:flex; align-items:center; justify-content:center;';

    overlay.innerHTML = `
        <div style="background:var(--bg-primary); border-radius:10px; padding:1.5rem;
                    width:540px; max-width:92vw; max-height:90vh;
                    display:flex; flex-direction:column; gap:0.75rem;
                    box-shadow:0 10px 40px rgba(0,0,0,0.45);">

            <h3 style="margin:0;">📰 Додати до випуску журналу</h3>

            <!-- ── Крок 1: пошук журналу ─────────────────────────── -->
            <div id="atm-step1">
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.5rem;">
                    Крок 1 — знайдіть журнал
                </div>
                <input id="atm-mag-search" type="text" placeholder="Назва журналу..."
                       style="width:100%; padding:0.5rem 0.75rem; border:1px solid var(--border-color);
                              border-radius:6px; background:var(--bg-secondary); color:var(--text-primary);"
                       autocomplete="off">
                <div id="atm-mag-results"
                     style="margin-top:0.5rem; border:1px solid var(--border-color); border-radius:6px;
                            max-height:220px; overflow-y:auto; min-height:40px;
                            background:var(--bg-secondary);">
                    <div style="padding:0.75rem; color:var(--text-secondary); font-size:0.85rem;">
                        Введіть назву для пошуку…
                    </div>
                </div>
            </div>

            <!-- ── Крок 2: вибір випуску журналу ─────────────────── -->
            <div id="atm-step2" style="display:none; flex-direction:column; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <button id="atm-back-btn" class="btn btn-secondary btn-small">← Назад</button>
                    <span id="atm-mag-name"
                          style="font-weight:600; font-size:0.95rem; color:var(--text-primary);"></span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">
                    Крок 2 — оберіть випуск журналу
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <input id="atm-issue-search" type="text" placeholder="Фільтр за номером або назвою…"
                           style="flex:1; padding:0.4rem 0.75rem; border:1px solid var(--border-color);
                                  border-radius:6px; background:var(--bg-secondary); color:var(--text-primary);"
                           autocomplete="off">
                    <input id="atm-issue-id" type="number" placeholder="або ID випуску"
                           style="width:130px; padding:0.4rem 0.75rem; border:1px solid var(--border-color);
                                  border-radius:6px; background:var(--bg-secondary); color:var(--text-primary);">
                </div>
                <div id="atm-issue-results"
                     style="border:1px solid var(--border-color); border-radius:6px;
                            max-height:220px; overflow-y:auto; min-height:40px;
                            background:var(--bg-secondary);">
                    <div style="padding:0.75rem; color:var(--text-secondary); font-size:0.85rem;">
                        Завантаження…
                    </div>
                </div>
            </div>

            <!-- ── Крок 3: тип сторінки + підтвердження ──────────── -->
            <div id="atm-step3" style="display:none; flex-direction:column; gap:0.75rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <button id="atm-back-btn2" class="btn btn-secondary btn-small">← Назад</button>
                    <span id="atm-selected-label"
                          style="font-weight:600; font-size:0.9rem; color:var(--text-primary);"></span>
                </div>
                <div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.4rem;">
                        Тип сторінки (необов'язково)
                    </div>
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <button class="btn btn-secondary atm-type-btn" data-type="">— не вказано</button>
                        <button class="btn btn-secondary atm-type-btn" data-type="color">🎨 Кольорова</button>
                        <button class="btn btn-secondary atm-type-btn" data-type="cover">🖼️ Обкладинка</button>
                        <button class="btn btn-secondary atm-type-btn" data-type="combined">🔗 Разом</button>
                    </div>
                </div>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button id="atm-cancel-final" class="btn btn-secondary">Скасувати</button>
                    <button id="atm-confirm-btn" class="btn btn-primary">✓ Додати</button>
                </div>
            </div>

            <!-- Кнопка скасування (кроки 1-2) -->
            <div id="atm-cancel-row" style="display:flex; justify-content:flex-end;">
                <button id="atm-cancel-btn" class="btn btn-secondary">Скасувати</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // ── стан ──────────────────────────────────────────────────────────────
    let selectedMagVolId  = null;
    let selectedMagName   = '';
    let allMagIssues      = [];
    let selectedMagIssue  = null;
    let selectedPageType  = '';
    let magSearchTimeout  = null;
    let issueFilterTimeout = null;

    const close = () => overlay.remove();

    // ── helpers ───────────────────────────────────────────────────────────
    const showStep = (n) => {
        overlay.querySelector('#atm-step1').style.display  = n === 1 ? 'block'  : 'none';
        overlay.querySelector('#atm-step2').style.display  = n === 2 ? 'flex'   : 'none';
        overlay.querySelector('#atm-step3').style.display  = n === 3 ? 'flex'   : 'none';
        overlay.querySelector('#atm-cancel-row').style.display = n < 3 ? 'flex' : 'none';
    };

    const renderMagIssues = (filter = '') => {
        const el = overlay.querySelector('#atm-issue-results');
        const f  = filter.trim().toLowerCase();
        const filtered = f
            ? allMagIssues.filter(i =>
                String(i.issue_number || '').includes(f) ||
                (i.name || '').toLowerCase().includes(f))
            : allMagIssues;

        if (!filtered.length) {
            el.innerHTML = '<div style="padding:0.75rem; color:var(--text-secondary); font-size:0.85rem;">Нічого не знайдено</div>';
            return;
        }
        el.innerHTML = filtered.map((iss, idx) => `
            <div data-issue-idx="${idx}"
                 style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0.75rem;
                        border-bottom:1px solid var(--border-color); cursor:pointer;">
                ${iss.cv_img
                    ? `<img src="${iss.cv_img.startsWith('https') ? iss.cv_img
                            : cv_img_path_small + (iss.cv_img.startsWith('/') ? '' : '/') + iss.cv_img}"
                           style="width:32px;height:46px;object-fit:cover;border-radius:3px;flex-shrink:0;">`
                    : '<div style="width:32px;height:46px;background:var(--bg-tertiary);border-radius:3px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem;">📰</div>'}
                <div>
                    <div style="font-weight:500; font-size:0.9rem;">
                        #${iss.issue_number || '?'}
                        ${iss.name ? `<span style="color:var(--text-secondary); font-weight:400;"> · ${iss.name}</span>` : ''}
                    </div>
                    ${iss.release_date ? `<div style="font-size:0.75rem; color:var(--text-muted);">${iss.release_date}</div>` : ''}
                </div>
            </div>
        `).join('');

        el.querySelectorAll('[data-issue-idx]').forEach(row => {
            const iss = filtered[parseInt(row.dataset.issueIdx)];
            row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-primary)');
            row.addEventListener('mouseleave', () => row.style.background = '');
            row.addEventListener('click', () => {
                selectedMagIssue = iss;
                overlay.querySelector('#atm-selected-label').textContent =
                    `${selectedMagName} #${iss.issue_number || '?'}${iss.name ? ' · ' + iss.name : ''}`;
                // скидаємо тип
                selectedPageType = '';
                overlay.querySelectorAll('.atm-type-btn').forEach(b => {
                    b.style.background   = '';
                    b.style.borderColor  = '';
                    b.style.fontWeight   = '';
                });
                overlay.querySelector('.atm-type-btn[data-type=""]').style.background = 'var(--accent)';
                overlay.querySelector('.atm-type-btn[data-type=""]').style.color = '#fff';
                showStep(3);
            });
        });
    };

    // ── Крок 1: пошук журналу ─────────────────────────────────────────────
    overlay.querySelector('#atm-mag-search').addEventListener('input', (e) => {
        clearTimeout(magSearchTimeout);
        const q = e.target.value.trim();
        const resultsEl = overlay.querySelector('#atm-mag-results');
        if (!q) {
            resultsEl.innerHTML = '<div style="padding:0.75rem; color:var(--text-secondary); font-size:0.85rem;">Введіть назву для пошуку…</div>';
            return;
        }
        resultsEl.innerHTML = '<div style="padding:0.75rem; color:var(--text-secondary); font-size:0.85rem;">Пошук…</div>';
        magSearchTimeout = setTimeout(async () => {
            try {
                const res  = await fetch(`${API_BASE}/volumes?search=${encodeURIComponent(q)}&theme_ids=35&limit=20`);
                const data = await res.json();
                const vols = data.data || [];
                if (!vols.length) {
                    resultsEl.innerHTML = '<div style="padding:0.75rem; color:var(--text-secondary); font-size:0.85rem;">Нічого не знайдено</div>';
                    return;
                }
                resultsEl.innerHTML = vols.map((vol, idx) => `
                    <div data-vol-idx="${idx}"
                         style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0.75rem;
                                border-bottom:1px solid var(--border-color); cursor:pointer;">
                        ${vol.cv_img
                            ? `<img src="${cv_img_path_small}${vol.cv_img.startsWith('/') ? '' : '/'}${vol.cv_img}"
                                   style="width:32px;height:46px;object-fit:cover;border-radius:3px;flex-shrink:0;">`
                            : '<div style="width:32px;height:46px;background:var(--bg-tertiary);border-radius:3px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem;">📰</div>'}
                        <div>
                            <div style="font-weight:500;">${vol.name}</div>
                            ${vol.start_year ? `<div style="font-size:0.75rem; color:var(--text-muted);">${vol.start_year}</div>` : ''}
                        </div>
                    </div>
                `).join('');
                resultsEl.querySelectorAll('[data-vol-idx]').forEach(row => {
                    const vol = vols[parseInt(row.dataset.volIdx)];
                    row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-secondary)');
                    row.addEventListener('mouseleave', () => row.style.background = '');
                    row.addEventListener('click', async () => {
                        selectedMagVolId = vol.id;
                        selectedMagName  = vol.name;
                        overlay.querySelector('#atm-mag-name').textContent = vol.name;
                        // Завантажуємо випуски цього журналу
                        const issRes  = await fetch(`${API_BASE}/issues?volume_id=${vol.cv_id}&limit=200`);
                        const issData = await issRes.json();
                        allMagIssues  = (issData.data || []).sort((a, b) =>
                            parseFloat(a.issue_number || 0) - parseFloat(b.issue_number || 0));
                        showStep(2);
                        renderMagIssues();
                        overlay.querySelector('#atm-issue-search').value = '';
                        overlay.querySelector('#atm-issue-id').value = '';
                        overlay.querySelector('#atm-issue-search').focus();
                    });
                });
            } catch (err) {
                resultsEl.innerHTML = '<div style="padding:0.75rem; color:var(--danger); font-size:0.85rem;">Помилка пошуку</div>';
            }
        }, 300);
    });

    // ── Крок 2: фільтр по номеру/назві ───────────────────────────────────
    overlay.querySelector('#atm-issue-search').addEventListener('input', (e) => {
        clearTimeout(issueFilterTimeout);
        issueFilterTimeout = setTimeout(() => renderMagIssues(e.target.value), 200);
    });

    // ── Крок 2: пошук по ID випуску ───────────────────────────────────────
    overlay.querySelector('#atm-issue-id').addEventListener('change', async (e) => {
        const id = parseInt(e.target.value);
        if (!id) return;
        try {
            const res  = await fetch(`${API_BASE}/issues/${id}`);
            if (!res.ok) { alert('Випуск не знайдено'); return; }
            const iss  = await res.json();
            selectedMagIssue = { ...iss, id };
            overlay.querySelector('#atm-selected-label').textContent =
                `${iss.volume_name || 'Журнал'} #${iss.issue_number || '?'}${iss.name ? ' · ' + iss.name : ''}`;
            selectedPageType = '';
            overlay.querySelectorAll('.atm-type-btn').forEach(b => { b.style.background = ''; b.style.color = ''; });
            overlay.querySelector('.atm-type-btn[data-type=""]').style.background = 'var(--accent)';
            overlay.querySelector('.atm-type-btn[data-type=""]').style.color = '#fff';
            showStep(3);
        } catch { alert('Помилка пошуку випуску'); }
    });

    // ── Крок 2: назад ─────────────────────────────────────────────────────
    overlay.querySelector('#atm-back-btn').addEventListener('click', () => showStep(1));

    // ── Крок 3: вибір типу ────────────────────────────────────────────────
    overlay.querySelectorAll('.atm-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedPageType = btn.dataset.type;
            overlay.querySelectorAll('.atm-type-btn').forEach(b => {
                b.style.background = '';
                b.style.color      = '';
            });
            btn.style.background = 'var(--accent)';
            btn.style.color      = '#fff';
        });
    });

    // ── Крок 3: назад ─────────────────────────────────────────────────────
    overlay.querySelector('#atm-back-btn2').addEventListener('click', () => showStep(2));

    // ── Крок 3: підтвердження ─────────────────────────────────────────────
    overlay.querySelector('#atm-confirm-btn').addEventListener('click', async () => {
        if (!selectedMagIssue) return;
        const body = { issue_id: issueId };
        if (selectedPageType) body.page_type = selectedPageType;

        const res = await fetch(`${API_BASE}/issues/${selectedMagIssue.id}/magazine-chapters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
        close();
        await renderIssueDetail({ id: issueId });
    });

    // ── Закриття ──────────────────────────────────────────────────────────
    overlay.querySelector('#atm-cancel-btn').addEventListener('click', close);
    overlay.querySelector('#atm-cancel-final').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });

    showStep(1);
    setTimeout(() => overlay.querySelector('#atm-mag-search').focus(), 50);
};

window.removeChapterFromMagazine = async (issueId, magIssueId) => {
    if (!confirm('Прибрати розділ з випуску журналу?')) return;
    const res = await fetch(`${API_BASE}/issues/${magIssueId}/magazine-chapters/${issueId}`, {
        method: 'DELETE',
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Помилка'); return; }
    await renderIssueDetail({ id: issueId });
};

// ===== ДОДАВАННЯ РОЗДІЛУ МАНГИ ДО ВИПУСКУ ЖУРНАЛУ (з боку журналу) =====

window.openAddMangaChapterToMagModal = (magIssueId, alreadyIds = new Set()) => {
    document.getElementById('add-manga-chapter-mag-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'add-manga-chapter-mag-modal';
    overlay.style.cssText =
        'position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:2000;' +
        'display:flex; align-items:center; justify-content:center;';

    overlay.innerHTML = `
        <div style="background:var(--bg-primary); border-radius:10px; padding:1.5rem;
                    width:620px; max-width:92vw; max-height:90vh;
                    display:flex; flex-direction:column; gap:0.75rem;
                    box-shadow:0 10px 40px rgba(0,0,0,0.45);">
            <h3 style="margin:0;">📖 Додати розділ манґи</h3>

            <div style="display:grid; grid-template-columns:1fr 120px 140px; gap:0.5rem;">
                <div class="form-group" style="margin:0;">
                    <label class="aim-label">Назва розділу</label>
                    <input type="text" id="acmm-name" placeholder="Назва..." style="width:100%;" autocomplete="off">
                </div>
                <div class="form-group" style="margin:0;">
                    <label class="aim-label">ID в базі</label>
                    <input type="number" id="acmm-db-id" placeholder="DB ID" style="width:100%;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label class="aim-label">ID тому розділу</label>
                    <input type="number" id="acmm-vol-id" placeholder="Vol DB ID" style="width:100%;">
                </div>
            </div>

            <div id="acmm-results"
                 style="flex:1; overflow-y:auto; border:1px solid var(--border-color);
                        border-radius:6px; min-height:60px; max-height:320px;
                        background:var(--bg-secondary);">
                <div style="padding:1rem; text-align:center; color:var(--text-secondary); font-size:0.875rem;">
                    Введіть дані для пошуку
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end;">
                <button class="btn btn-secondary" id="acmm-cancel">Скасувати</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });
    overlay.querySelector('#acmm-cancel').addEventListener('click', close);

    let searchTimeout = null;

    const runSearch = async () => {
        const name   = overlay.querySelector('#acmm-name').value.trim();
        const dbId   = overlay.querySelector('#acmm-db-id').value.trim();
        const volId  = overlay.querySelector('#acmm-vol-id').value.trim();
        const resultsEl = overlay.querySelector('#acmm-results');

        if (!name && !dbId && !volId) {
            resultsEl.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary); font-size:0.875rem;">Введіть дані для пошуку</div>';
            return;
        }

        resultsEl.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary); font-size:0.875rem;">Пошук…</div>';

        const params = new URLSearchParams({ limit: 50 });
        if (dbId)  params.set('ds_id', dbId);
        else if (volId) params.set('ds_vol_id', volId);
        if (name)  params.set('name', name);

        try {
            const res  = await fetch(`${API_BASE}/issues?${params}`);
            const data = await res.json();
            const issues = (data.data || []).filter(i => i.ds_vol_id); // тільки розділи манги

            if (!issues.length) {
                resultsEl.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary); font-size:0.875rem;">Нічого не знайдено</div>';
                return;
            }

            resultsEl.innerHTML = issues.map(iss => {
                const isAdded = alreadyIds.has(iss.id);
                const imgSrc  = iss.cv_img
                    ? `${cv_img_path_small}${iss.cv_img.startsWith('/') ? '' : '/'}${iss.cv_img}`
                    : null;
                return `
                    <div data-issue-id="${iss.id}"
                         style="display:flex; align-items:center; gap:0.75rem; padding:0.65rem 0.9rem;
                                border-bottom:1px solid var(--border-color); cursor:${isAdded ? 'default' : 'pointer'};
                                opacity:${isAdded ? 0.45 : 1}; pointer-events:${isAdded ? 'none' : 'auto'};"
                         onmouseenter="if(!${isAdded}) this.style.background='var(--bg-primary)'"
                         onmouseleave="this.style.background=''">
                        ${imgSrc
                            ? `<img src="${imgSrc}" style="width:32px;height:46px;object-fit:cover;border-radius:3px;flex-shrink:0;">`
                            : '<div style="width:32px;height:46px;background:var(--bg-tertiary);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">📖</div>'}
                        <div style="flex:1; min-width:0; overflow:hidden;">
                            <div style="font-weight:500; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                ${iss.volume_name || '—'} · Розділ #${iss.issue_number || '?'}
                            </div>
                            <div style="font-size:0.78rem; color:var(--text-secondary);">
                                ${iss.name || ''} ${iss.release_date ? `· 📅 ${iss.release_date}` : ''}
                            </div>
                        </div>
                        ${isAdded
                            ? `<span style="font-size:0.75rem; color:var(--success); font-weight:600;">✓ Вже додано</span>`
                            : `<button class="btn btn-primary btn-small" style="flex-shrink:0;">Додати</button>`}
                    </div>
                `;
            }).join('');

            resultsEl.querySelectorAll('[data-issue-id]').forEach(row => {
                if (alreadyIds.has(parseInt(row.dataset.issueId))) return;
                row.addEventListener('click', async () => {
                    const issueId = parseInt(row.dataset.issueId);
                    const btn = row.querySelector('button');
                    if (btn) { btn.disabled = true; btn.textContent = '…'; }
                    try {
                        const res = await fetch(`${API_BASE}/issues/${magIssueId}/magazine-chapters`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ issue_id: issueId }),
                        });
                        if (!res.ok) {
                            const err = await res.json();
                            alert(err.error || 'Помилка');
                            if (btn) { btn.disabled = false; btn.textContent = 'Додати'; }
                            return;
                        }
                        alreadyIds.add(issueId);
                        row.style.opacity = '0.45';
                        row.style.pointerEvents = 'none';
                        if (btn) { btn.textContent = '✓ Додано'; btn.className = 'btn btn-secondary btn-small'; }
                        // Оновлюємо сторінку
                        await renderIssueDetail({ id: magIssueId });
                    } catch (err) {
                        console.error(err);
                        alert('Помилка додавання');
                        if (btn) { btn.disabled = false; btn.textContent = 'Додати'; }
                    }
                });
            });
        } catch (err) {
            resultsEl.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--danger); font-size:0.875rem;">Помилка пошуку</div>';
            console.error(err);
        }
    };

    const scheduleSearch = () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(runSearch, 350);
    };

    overlay.querySelector('#acmm-name').addEventListener('input', scheduleSearch);
    overlay.querySelector('#acmm-db-id').addEventListener('input', scheduleSearch);
    overlay.querySelector('#acmm-vol-id').addEventListener('input', scheduleSearch);

    setTimeout(() => overlay.querySelector('#acmm-name').focus(), 50);
};

window.navigateTo = (type, id) => navigate(type, { id: id });