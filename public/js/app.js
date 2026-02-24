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

// Ініціалізація при завантаженні сторінки
document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
});

async function initApp() {
    // Ініціалізація компонентів
    initModalHandlers();
    initNavigation();
    
    // Реєстрація маршрутів
    registerRoute('volumes', renderVolumesList);
    registerRoute('volume-detail', renderVolumeDetail);
    registerRoute('issues', renderIssuesList);
    registerRoute('issue-detail', renderIssueDetail);
    registerRoute('characters', renderCharactersList);
    registerRoute('character-detail', renderCharacterDetail);
    registerRoute('collections', renderCollectionsList);
    registerRoute('collection-detail', renderCollectionDetail);
    registerRoute('manga', renderMangaList);
    registerRoute('series', renderSeriesList);
    registerRoute('series-detail', renderSeriesDetail);
  registerRoute('series',               renderSeriesList);
  registerRoute('series-detail',        renderSeriesDetail);
  registerRoute('reading-orders',       renderReadingOrderList);
  registerRoute('reading-order-detail', renderReadingOrderDetail);
  registerRoute('personnel',            renderPersonnelList);
  registerRoute('personnel-detail',     renderPersonnelDetail);
  registerRoute('events',               renderEventsList);
  registerRoute('event-detail',         renderEventDetail);
    
    // Завантаження статистики
    await updateStats();
    
    // Запуск роутера
    initRouter();
}

function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.dataset.page;
            
            // Оновлюємо активний пункт меню
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            
            // Переходимо на сторінку
            navigate(page);
        });
    });
}

async function updateStats() {
    try {
        const stats = await fetchStats();

        const elements = {
            'stat-volumes':     stats.volumes,
            'stat-issues':      stats.issues,
            'stat-characters':  stats.characters,
            'stat-collections': stats.collections,
            'stat-manga':       stats.manga ?? '',
            'stat-series':      stats.series ?? 0,
            'stat-personnel':   stats.personnel ?? 0,
            'stat-events':      stats.events ?? 0,
            'stat-reading-orders':      stats.readingOrders ?? 0,
        };

        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value;
            }
        }
    } catch (error) {
        console.error('Помилка завантаження статистики:', error);
    }
}

// Експортуємо функцію для доступу з інших модулів
window.updateStats = updateStats;