import { unmountHeaderActions } from '../components/headerActions.js';

export const cv_img_path_small = 'https://comicvine.gamespot.com/a/uploads/scale_small'
export const cv_img_path_original = 'https://comicvine.gamespot.com/a/uploads/original'
export const locg_img = 'https://leagueofcomicgeeks.com/assets/images/user-menu-logo-icon.png'

export const imgSrc = (item, size = 40, ratio = "2/3") => {
    if (!item?.cv_img) return '&#128214;';
    
    const isFullUrl = item.cv_img.startsWith('http');
    const prefix = !isFullUrl && !item.cv_img.startsWith('/') ? '/' : '';
    
    const src = isFullUrl
        ? item.cv_img
        : `${cv_img_path_small}${prefix}${item.cv_img}`;
    
    return `<img 
        src="${src}" 
        alt="${item.name}" 
        style="
            width:${size}px;
            aspect-ratio:${ratio};
            object-fit:cover;
            border-radius: 8px;
        "
    >`;
};

export function initDetailPage() {
    unmountHeaderActions();

    const pagination = document.getElementById('pagination');
    if (pagination) pagination.style.display = 'none';
}

// Загальна функція (ISO формат, для created_at тощо)
export function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('uk-UA');
}

// cover_date: формат "ДД-ММ-РРРР", де 00 = невідомо
// "01-03-2022" → "Березень 2022"
// "00-03-2022" → "Березень 2022"
// "00-00-2022" → "2022"
export function formatCoverDate(dateString) {
    if (!dateString) return '-';

    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;

    const [y, m] = parts.map(Number);
    if (isNaN(y) || !y) return dateString;

    // Невідомий місяць — показуємо тільки рік
    if (!m) return String(y);

    const date = new Date(y, m - 1, 1);
    if (isNaN(date.getTime())) return dateString;

    return date
        .toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
        .replace(' р.', '')
        .replace(/^./, c => c.toUpperCase());
}

// release_date: формат "ДД-ММ-РРРР", де 00 = невідомо
// "16-03-2022" → "16.03.2022"
// "00-03-2022" → "Березень 2022"
// "00-00-2022" → "2022"
export function formatReleaseDate(dateString) {
    if (!dateString) return '-';

    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;

    const [y, m, d] = parts.map(Number);
    if (isNaN(y) || !y) return dateString;

    // Невідомий місяць — показуємо тільки рік
    if (!m) return String(y);

    // Невідомий день — показуємо місяць і рік
    if (!d) {
        const date = new Date(y, m - 1, 1);
        if (isNaN(date.getTime())) return dateString;
        return date
            .toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
            .replace(' р.', '')
            .replace(/^./, c => c.toUpperCase());
    }

    // Повна дата
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime())
        ? dateString
        : date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
            .replace(' р.', '');
}

export function showError(message) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="empty-state">
            <p>❌</p>
            <p>${message}</p>
        </div>
    `;
}

export function showEmpty(message = 'Немає даних для відображення') {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="empty-state">
            <p>🔭</p>
            <p>${message}</p>
        </div>
    `;
}

export function showLoading() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="empty-state">
            <p>⏳</p>
            <p>Завантаження...</p>
        </div>
    `;
}

// ===== МОВНА МАПА =========================================================

export const LANG_MAP = {
    ja:      { label: 'Японська',               flag: '🇯🇵' },
    en:      { label: 'Американська',           flag: '🇺🇸' },
    gb:      { label: 'Британська',             flag: '🇬🇧' },
    fr:      { label: 'Французька',             flag: '🇫🇷' },
    de:      { label: 'Німецька',               flag: '🇩🇪' },
    it:      { label: 'Італійська',             flag: '🇮🇹' },
    es:      { label: 'Іспанська',              flag: '🇪🇸' },
    'es-AR': { label: 'Іспанська (Аргентина)',  flag: '🇦🇷' },
    be:      { label: 'Бельгійська',            flag: '🇧🇪' },
    'pt-br': { label: 'Бразильська',            flag: '🇧🇷' },
    el:      { label: 'Грецька',                flag: '🇬🇷' },
    da:      { label: 'Данська',                flag: '🇩🇰' },
    id:      { label: 'Індонезійська',          flag: '🇮🇩' },
    nb:      { label: 'Норвезька Букмол',       flag: '🇳🇴' },
    nl:      { label: 'Нідерландська',          flag: '🇳🇱' },
    no:      { label: 'Норвезька',              flag: '🇳🇴' },
    pl:      { label: 'Польська',               flag: '🇵🇱' },
    pt:      { label: 'Португальська',          flag: '🇵🇹' },
    sr:      { label: 'Сербська',               flag: '🇷🇸' },
    tr:      { label: 'Турецька',               flag: '🇹🇷' },
    fi:      { label: 'Фінська',                flag: '🇫🇮' },
    cs:      { label: 'Чеська',                 flag: '🇨🇿' },
    sv:      { label: 'Шведська',               flag: '🇸🇪' },
    uk:      { label: 'Українська',             flag: '🇺🇦' },
    zh:      { label: 'Китайська',              flag: '🇨🇳' },
    'zh-tw': { label: 'Китайська (Тайвань)',    flag: '🇨🇳' },
    tw:      { label: 'Тайська',                flag: '🇹🇼' },
    ko:      { label: 'Корейська',              flag: '🇰🇷' },
    ru:      { label: 'Російська',              flag: '🇷🇺' },
};

export function langDisplay(code) {
    if (!code) return '';
    const entry = LANG_MAP[code];
    return entry ? `${entry.flag} ${entry.label}` : code;
}