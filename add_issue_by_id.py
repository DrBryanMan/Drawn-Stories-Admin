"""
Парсер: додає один випуск у БД за його ComicVine ID.

Використання:
    python add_issue_by_id.py 306640
    python add_issue_by_id.py 306640 --db comicsdb.db
"""

import sys
import re
import time
import argparse
import sqlite3
import cloudscraper
from bs4 import BeautifulSoup

# Без цього Windows (cp1252) крашиться на символах ═ ─ ✓ тощо
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding and sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

# ─── Налаштування ─────────────────────────────────────────────────────────────
DB_PATH = '../Drawn Stories Parser/comicsdb.db'
API_KEY  = '99b8aaa60addd5a3a119afbb1c57625e4c808c26'
# ──────────────────────────────────────────────────────────────────────────────


# ═══════════════════════════════════════════════════════════════
# УТИЛІТИ
# ═══════════════════════════════════════════════════════════════

def create_scraper():
    return cloudscraper.create_scraper(
        browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False},
        delay=2,
        interpreter='js2py',
        debug=False
    )


def fetch_page(scraper, url, retries=5):
    for attempt in range(1, retries + 1):
        try:
            response = scraper.get(url, timeout=30)

            if response.status_code == 404:
                print(f"  ✗ Сторінку не знайдено (404): {url}")
                return None
            if response.status_code == 403:
                print(f"  ⚠ Статус 403 (Cloudflare), спроба {attempt}/{retries}")
                time.sleep(5 * attempt)
                continue
            if response.status_code != 200:
                print(f"  ⚠ Статус {response.status_code}, спроба {attempt}/{retries}")
                time.sleep(3 * attempt)
                continue

            return response.text

        except Exception as e:
            print(f"  ⚠ Помилка на спробі {attempt}/{retries}: {e}")
            time.sleep(4 * attempt)

    print(f"  ✗ Не вдалося завантажити після {retries} спроб")
    return None


# ═══════════════════════════════════════════════════════════════
# КОНВЕРТАЦІЯ ДАТ
# ═══════════════════════════════════════════════════════════════

def convert_month_name_to_number(month_name):
    months = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12'
    }
    return months.get(month_name.lower(), '00')


def convert_cover_date(date_str):
    if not date_str:
        return None
    date_str = date_str.strip()
    m = re.match(r'(\w+)\s+\d{1,2},\s+(\d{4})', date_str)
    if m:
        return f"{m.group(2)}-{convert_month_name_to_number(m.group(1))}-00"
    m = re.match(r'(\w+)\s+(\d{4})', date_str)
    if m:
        return f"{m.group(2)}-{convert_month_name_to_number(m.group(1))}-00"
    m = re.match(r'^(1[89]\d{2}|20\d{2})$', date_str)
    if m:
        return f"{m.group(1)}-00-00"
    return None


def convert_release_date(date_str):
    if not date_str:
        return None
    date_str = date_str.strip()
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', date_str)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r'(\w+)\s+(\d{1,2}),\s+(\d{4})', date_str)
    if m:
        return f"{m.group(3)}-{convert_month_name_to_number(m.group(1))}-{m.group(2).zfill(2)}"
    m = re.match(r'(\w+)\s+(\d{4})', date_str)
    if m:
        return f"{m.group(2)}-{convert_month_name_to_number(m.group(1))}-00"
    m = re.match(r'^(1[89]\d{2}|20\d{2})$', date_str)
    if m:
        return f"{m.group(1)}-00-00"
    return None


# ═══════════════════════════════════════════════════════════════
# ПАРСИНГ СТОРІНКИ ВИПУСКУ
# ═══════════════════════════════════════════════════════════════

def parse_issue_page(html, cv_id):
    """
    Парсить сторінку випуску ComicVine.
    Повертає словник: name, slug, cover_img, cv_vol_id,
                      issue_number, cover_date, release_date.
    """
    if not html:
        return {}

    soup = BeautifulSoup(html, 'html.parser')
    data = {
        'name':         None,
        'slug':         None,
        'cover_img':    None,
        'cv_vol_id':    None,
        'issue_number': None,
        'cover_date':   None,
        'release_date': None,
    }

    # ── Slug із canonical-тегу ─────────────────────────────────
    canonical = soup.find('link', rel='canonical')
    if canonical:
        m = re.search(r'/([^/]+)/4000-\d+/?$', canonical.get('href', ''))
        if m:
            data['slug'] = m.group(1)

    aside = soup.find('aside', class_='secondary-content')

    # ── Обкладинка ─────────────────────────────────────────────
    if aside:
        cover_div = aside.find('div', class_='issue-cover')
        if cover_div:
            img = cover_div.find('img')
            if img:
                src = img.get('src', '') or img.get('data-src', '')
                if src:
                    pm = re.search(r'(\d+/\d+/[^/\s]+\.(?:jpg|jpeg|png|gif|webp))', src)
                    data['cover_img'] = ('/' + pm.group(1)) if pm else src

    # ── Назва ──────────────────────────────────────────────────
    name_el = soup.find(id=f'wiki-4000-{cv_id}-name')
    if name_el:
        a = name_el.find('a')
        data['name'] = a.get_text(strip=True) if a else name_el.get_text(strip=True)

    # ── Том (Volume) з таблиці wiki-details ────────────────────
    if aside:
        wiki_details = aside.find('div', class_='wiki-details')
        if wiki_details:
            table = wiki_details.find('table')
            if table:
                for row in table.find_all('tr'):
                    th = row.find('th')
                    td = row.find('td')
                    if not th or not td:
                        continue
                    if th.get_text(strip=True) == 'Volume':
                        vol_link = td.find('a', href=re.compile(r'/4050-\d+'))
                        if vol_link:
                            m = re.search(r'/4050-(\d+)', vol_link.get('href', ''))
                            if m:
                                data['cv_vol_id'] = int(m.group(1))
                        break

    # ── Номер випуску ──────────────────────────────────────────
    num_el = soup.find(id=f'wiki-4000-{cv_id}-issueNumber')
    if num_el:
        data['issue_number'] = num_el.get_text(strip=True) or None

    # ── Cover Date ─────────────────────────────────────────────
    cover_el = soup.find(id=f'wiki-4000-{cv_id}-cover_date')
    if cover_el:
        data['cover_date'] = convert_cover_date(cover_el.get_text(strip=True))

    # ── Store / Release Date ───────────────────────────────────
    store_el = soup.find(id=f'wiki-4000-{cv_id}-storeDate')
    if store_el:
        data['release_date'] = convert_release_date(store_el.get_text(strip=True))

    return data


# ═══════════════════════════════════════════════════════════════
# БД
# ═══════════════════════════════════════════════════════════════

def issue_exists(db_path, cv_id):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT 1 FROM issues WHERE cv_id = ? LIMIT 1', (cv_id,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists


def save_issue(db_path, issue):
    """Зберігає випуск у БД. Повертає True/False/None."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO issues
                (cv_id, cv_slug, name, cv_img, cv_vol_id,
                 issue_number, cover_date, release_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            issue['id'],
            issue.get('slug'),
            issue.get('name'),
            issue.get('cover_img'),
            issue.get('cv_vol_id'),
            issue.get('issue_number'),
            issue.get('cover_date'),
            issue.get('release_date'),
        ))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False
    except Exception as e:
        print(f"  ✗ Помилка запису в БД: {e}")
        try:
            conn.close()
        except Exception:
            pass
        return None


# ═══════════════════════════════════════════════════════════════
# ГОЛОВНА ЛОГІКА
# ═══════════════════════════════════════════════════════════════

def add_issue_by_id(cv_id, db_path=DB_PATH):
    """
    Основна функція: скрапить випуск за cv_id і зберігає в БД.
    Повертає словник з результатом:
      { 'ok': bool, 'message': str, 'data': dict|None }
    """
    print(f"\n{'═'*60}")
    print(f"  ДОДАВАННЯ ВИПУСКУ  CV_ID: {cv_id}")
    print(f"  БД: {db_path}")
    print(f"{'═'*60}")

    # Перевірка: чи вже є в БД
    if issue_exists(db_path, cv_id):
        msg = f"Випуск CV_ID={cv_id} вже є в базі даних."
        print(f"  ○ {msg}")
        return {'ok': False, 'message': msg, 'data': None}

    url = f"https://comicvine.gamespot.com/issue/4000-{cv_id}/"
    print(f"  URL: {url}")
    print("  Зачекайте 1 с. перед запитом...\n")
    time.sleep(1)

    scraper = create_scraper()
    html    = fetch_page(scraper, url)

    if not html:
        msg = f"Не вдалося завантажити сторінку випуску CV_ID={cv_id}."
        print(f"  ✗ {msg}")
        return {'ok': False, 'message': msg, 'data': None}

    data = parse_issue_page(html, cv_id)

    print(f"\n  ┌{'─'*50}")
    print(f"  │ slug:         {data.get('slug')}")
    print(f"  │ name:         {data.get('name')}")
    print(f"  │ cover_img:    {data.get('cover_img')}")
    print(f"  │ cv_vol_id:    {data.get('cv_vol_id')}")
    print(f"  │ issue_number: {data.get('issue_number')}")
    print(f"  │ cover_date:   {data.get('cover_date')}")
    print(f"  │ release_date: {data.get('release_date')}")
    print(f"  └{'─'*50}\n")

    issue_to_save = {
        'id':           cv_id,
        'slug':         data.get('slug') or f"issue-{cv_id}",
        'name':         data.get('name'),
        'cover_img':    data.get('cover_img'),
        'cv_vol_id':    data.get('cv_vol_id'),
        'issue_number': data.get('issue_number'),
        'cover_date':   data.get('cover_date'),
        'release_date': data.get('release_date'),
    }

    result = save_issue(db_path, issue_to_save)

    if result is True:
        msg = (f"Випуск #{data.get('issue_number')} «{data.get('name')}» "
               f"(CV_ID={cv_id}) успішно додано.")
        print(f"  ✓ {msg}")
        return {'ok': True, 'message': msg, 'data': issue_to_save}
    elif result is False:
        msg = f"Випуск CV_ID={cv_id} вже є в базі (IntegrityError)."
        print(f"  ○ {msg}")
        return {'ok': False, 'message': msg, 'data': None}
    else:
        msg = f"Помилка при збереженні випуску CV_ID={cv_id}."
        print(f"  ✗ {msg}")
        return {'ok': False, 'message': msg, 'data': None}


# ═══════════════════════════════════════════════════════════════
# ТОЧКА ВХОДУ
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Додає один випуск у БД за його ComicVine ID.'
    )
    parser.add_argument('cv_id', type=int, help='ComicVine ID випуску (наприклад: 306640)')
    parser.add_argument('--db', default=DB_PATH, help=f'Шлях до БД (за замовч.: {DB_PATH})')
    args = parser.parse_args()

    result = add_issue_by_id(args.cv_id, db_path=args.db)
    sys.exit(0 if result['ok'] else 1)


if __name__ == '__main__':
    main()