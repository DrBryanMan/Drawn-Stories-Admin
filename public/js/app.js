import { fetchStats } from './api/api.js';
import { initRouter, registerRoute, navigate } from './utils/router.js';
import { initModalHandlers } from './components/modal.js';
import { renderVolumesList } from './views/volumesList.js';
import { renderVolumeDetail } from './views/volumeDetail.js';
import { renderIssuesList } from './views/issuesList.js';
import { renderIssueDetail } from './views/issueDetail.js';
import { renderCharactersList } from './views/charactersList.js';
import { renderCharacterDetail } from './views/characterDetail.js';
import { renderCollectionsList } from './views/collectionsList.js';
import { renderCollectionDetail } from './views/collectionDetail.js';
import { renderMangaList } from './views/mangaList.js';
import { renderSeriesList } from './views/seriesList.js';
import { renderSeriesDetail } from './views/seriesDetail.js';
import { renderReadingOrderList } from './views/readingOrderList.js';
import { renderReadingOrderDetail } from './views/readingOrderDetail.js';
import { renderPersonnelList }  from './views/personnelList.js';
import { renderPersonnelDetail } from './views/personnelDetail.js';
import { renderEventsList } from './views/eventsList.js';
import { renderEventDetail } from './views/eventDetail.js';

document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
});

async function initApp() {
    initModalHandlers();
    initNavigation();

    // Реєстрація маршрутів
    registerRoute('volumes',              renderVolumesList);
    registerRoute('volume-detail',        renderVolumeDetail);
    registerRoute('issues',               renderIssuesList);
    registerRoute('issue-detail',         renderIssueDetail);
    registerRoute('characters',           renderCharactersList);
    registerRoute('character-detail',     renderCharacterDetail);
    registerRoute('collections',          renderCollectionsList);
    registerRoute('collection-detail',    renderCollectionDetail);
    registerRoute('manga',                renderMangaList);
    registerRoute('series',               renderSeriesList);
    registerRoute('series-detail',        renderSeriesDetail);
    registerRoute('reading-orders',       renderReadingOrderList);
    registerRoute('reading-order-detail', renderReadingOrderDetail);
    registerRoute('personnel',            renderPersonnelList);
    registerRoute('personnel-detail',     renderPersonnelDetail);
    registerRoute('events',               renderEventsList);
    registerRoute('event-detail',         renderEventDetail);

    await updateStats();
    initRouter();
}

function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.dataset.page;
            // navigate() сам оновить активний таб через updateActiveNav()
            navigate(page);
        });
    });
}

async function updateStats() {
    try {
        const stats = await fetchStats();
        const elements = {
            'stat-series':            stats.series ?? 0,
            'stat-volumes':           stats.volumes,
            'stat-volumes-comics':    stats.volumesComics ?? 0,
            'stat-volumes-manga':     stats.volumesManga ?? 0,
            'stat-volumes-collected': stats.volumesCollected ?? 0,
            'stat-issues':            stats.issues,
            'stat-issues-comics':     stats.issuesComics ?? 0,
            'stat-issues-manga':      stats.issuesManga ?? 0,
            'stat-issues-collected':  stats.issuesCollected ?? 0,
            'stat-chapters':          stats.chapters ?? 0,
            'stat-collections':       stats.collections,
            'stat-characters':        stats.characters,
            'stat-personnel':         stats.personnel ?? 0,
            'stat-reading-orders':    stats.readingOrders ?? 0,
            'stat-events':            stats.events ?? 0,
        };
        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
    } catch (error) {
        console.error('Помилка завантаження статистики:', error);
    }
}

window.updateStats = updateStats;