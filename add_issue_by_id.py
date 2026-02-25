"""
Парсер: додає один випуск у БД за його ComicVine ID через API (без скрапінгу).

Використання:
    python add_issue_by_id.py 306640
    python add_issue_by_id.py 306640 --db comicsdb.db
"""

import sys
import argparse
import sqlite3
import cloudscraper
import time
import re

# Без цього Windows крашиться на символах
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding and sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

# ─── Налаштування ─────────────────────────────────────────────────────────────
DB_PATH = '../Drawn Stories Parser/comicsdb.db'
API_KEY = '99b8aaa60addd5a3a119afbb1c57625e4c808c26'
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


def make_api_request(scraper, api_key, endpoint, params=None, retries=3):
    """Універсальний запит до ComicVine API"""
    base_url = "https://comicvine.gamespot.com/api"
    url = f"{base_url}/{endpoint}/"

    default_params = {
        'api_key': api_key,
        'format': 'json'
    }
    if params:
        default_params.update(params)

    for attempt in range(1, retries + 1):
        try:
            response = scraper.get(url, params=default_params, timeout=15)

            if response.status_code == 420:
                print(f"  ⚠ Rate limit (420). Чекаємо 40 сек...")
                time.sleep(40)
                continue
            if response.status_code != 200:
                print(f"  ⚠ Статус {response.status_code}, спроба {attempt}")
                time.sleep(5 * attempt)
                continue

            data = response.json()
            if data.get('status_code') != 1:
                print(f"  ✗ API помилка: {data.get('error', 'невідомо')}")
                return None

            return data

        except Exception as e:
            print(f"  ⚠ Помилка на спробі {attempt}: {e}")
            time.sleep(5 * attempt)

    print("  ✗ Не вдалося отримати відповідь від API")
    return None


def extract_image_path(image_url):
    if not image_url:
        return None
    match = re.search(r'(\d+/\d+/[^/\s]+\.(?:jpg|jpeg|png|gif|webp))', image_url)
    return '/' + match.group(1) if match else None


def convert_cover_date(date_str):
    if not date_str:
        return None
    date_str = date_str.strip()
    # API повертає у форматі "2023-06-05 00:00:00" або "March 2023"
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', date_str)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"   # день-місяць-рік
    m = re.match(r'(\w+)\s+(\d{4})', date_str)
    if m:
        month = {'january':'01','february':'02','march':'03','april':'04',
                 'may':'05','june':'06','july':'07','august':'08',
                 'september':'09','october':'10','november':'11','december':'12'}
        return f"00-{month.get(m.group(1).lower(), '01')}-{m.group(2)}"
    return f"00-00-{date_str}" if date_str.isdigit() else None


def convert_release_date(date_str):
    if not date_str:
        return None
    date_str = date_str.strip()
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', date_str)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    m = re.match(r'(\w+)\s+(\d{1,2}),?\s+(\d{4})', date_str)
    if m:
        month = {'january':'01','february':'02','march':'03','april':'04',
                 'may':'05','june':'06','july':'07','august':'08',
                 'september':'09','october':'10','november':'11','december':'12'}
        return f"{m.group(2).zfill(2)}-{month.get(m.group(1).lower(), '01')}-{m.group(3)}"
    return convert_cover_date(date_str)  # fallback


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
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO issues
                (cv_id, cv_slug, name, cv_img, cv_vol_id,
                 issue_number, cover_date, release_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            issue['cv_id'],
            issue['cv_slug'],
            issue.get('name'),
            issue.get('cv_img'),
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
        return None


# ═══════════════════════════════════════════════════════════════
# ГОЛОВНА ЛОГІКА (API)
# ═══════════════════════════════════════════════════════════════

def fetch_issue_via_api(scraper, cv_id):
    """Отримує дані одного випуску через API"""
    endpoint = f"issue/4000-{cv_id}"
    params = {
        'field_list': 'id,name,volume,issue_number,cover_date,store_date,image,site_detail_url'
    }

    print(f"  Запит API → https://comicvine.gamespot.com/api/{endpoint}/")
    response = make_api_request(scraper, API_KEY, endpoint, params)

    if not response:
        return None

    issue_data = response.get('results')
    if isinstance(issue_data, list):
        issue_data = issue_data[0] if issue_data else {}
    return issue_data


def parse_issue_api(issue_data, cv_id):
    if not issue_data:
        return None

    # Slug з site_detail_url (100% надійно)
    site_url = issue_data.get('site_detail_url', '')
    slug_match = re.search(r'/([^/]+)/4000-\d+/?$', site_url)
    slug = slug_match.group(1) if slug_match else f"issue-{cv_id}"

    # Зображення
    image_data = issue_data.get('image') or {}
    img_url = (image_data.get('original_url') or
               image_data.get('super_url') or
               image_data.get('medium_url'))
    cv_img = extract_image_path(img_url)

    return {
        'cv_id': cv_id,
        'cv_slug': slug,
        'name': issue_data.get('name'),
        'cv_img': cv_img,
        'cv_vol_id': issue_data.get('volume', {}).get('id') if issue_data.get('volume') else None,
        'issue_number': issue_data.get('issue_number'),
        'cover_date': convert_cover_date(issue_data.get('cover_date')),
        'release_date': convert_release_date(issue_data.get('store_date')),
    }


def add_issue_by_id(cv_id, db_path=DB_PATH):
    print(f"\n{'═'*70}")
    print(f"  ДОДАВАННЯ ВИПУСКУ ЧЕРЕЗ API  CV_ID: {cv_id}")
    print(f"  БД: {db_path}")
    print(f"{'═'*70}")

    if issue_exists(db_path, cv_id):
        print(f"  ○ Випуск CV_ID={cv_id} вже є в базі")
        return {'ok': False, 'message': 'Вже існує'}

    scraper = create_scraper()
    issue_raw = fetch_issue_via_api(scraper, cv_id)

    if not issue_raw:
        print("  ✗ Не вдалося отримати дані з API")
        return {'ok': False, 'message': 'API помилка'}

    data = parse_issue_api(issue_raw, cv_id)

    print(f"\n  ┌{'─'*55}")
    print(f"  │ slug:         {data['cv_slug']}")
    print(f"  │ name:         {data.get('name')}")
    print(f"  │ cv_img:       {data.get('cv_img')}")
    print(f"  │ cv_vol_id:    {data.get('cv_vol_id')}")
    print(f"  │ issue_number: {data.get('issue_number')}")
    print(f"  │ cover_date:   {data.get('cover_date')}")
    print(f"  │ release_date: {data.get('release_date')}")
    print(f"  └{'─'*55}\n")

    result = save_issue(db_path, data)

    if result is True:
        print(f"  ✓ Успішно додано: {data.get('name')} ({data['cv_slug']})")
        return {'ok': True, 'message': 'Додано', 'data': data}
    elif result is False:
        print(f"  ○ Вже існує (IntegrityError)")
        return {'ok': False, 'message': 'Вже існує'}
    else:
        print(f"  ✗ Помилка збереження")
        return {'ok': False, 'message': 'Помилка БД'}


# ═══════════════════════════════════════════════════════════════
# ТОЧКА ВХОДУ
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Додає один випуск через ComicVine API')
    parser.add_argument('cv_id', type=int, help='ComicVine ID випуску')
    parser.add_argument('--db', default=DB_PATH, help='Шлях до БД')
    args = parser.parse_args()

    result = add_issue_by_id(args.cv_id, db_path=args.db)
    sys.exit(0 if result['ok'] else 1)


if __name__ == '__main__':
    main()