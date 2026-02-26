"""
Парсер: додає випуски та томи у БД за ComicVine ID через API.

Використання:
    python add_issue_by_id.py issue 306640
    python add_issue_by_id.py volume 18138
    python add_issue_by_id.py volume-issues 18138
    python add_issue_by_id.py volume-issues 18138 --skip-existing
"""

import sys
import argparse
import sqlite3
import cloudscraper
import time
import re
import json
import os
from datetime import datetime, timedelta

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding and sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

# ─── Налаштування ─────────────────────────────────────────────────────────────
DB_PATH  = '../Drawn Stories Parser/comicsdb.db'
API_KEY  = '99b8aaa60addd5a3a119afbb1c57625e4c808c26'
API_BASE = 'https://comicvine.gamespot.com/api'
# ──────────────────────────────────────────────────────────────────────────────


# ═══════════════════════════════════════════════════════════════
# УТИЛІТИ + КЕШУВАННЯ
# ═══════════════════════════════════════════════════════════════

def create_scraper():
    return cloudscraper.create_scraper(
        browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False},
        delay=1,           # зменшено для швидкості
        interpreter='js2py',
        debug=False
    )


def make_api_request(scraper, endpoint, params=None, retries=3):
    """Універсальний запит до ComicVine API"""
    url = f"{API_BASE}/{endpoint}/"
    default_params = {'api_key': API_KEY, 'format': 'json'}
    if params:
        default_params.update(params)

    for attempt in range(1, retries + 1):
        try:
            response = scraper.get(url, params=default_params, timeout=30)

            if response.status_code == 420:
                wait = 40 + attempt * 10
                print(f"  ⚠ Rate limit (420). Чекаємо {wait} сек...")
                time.sleep(wait)
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


def get_cache_path(cv_vol_id):
    cache_dir = os.path.join(os.path.dirname(DB_PATH), 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    return os.path.join(cache_dir, f"volume_{cv_vol_id}_ids.json")


def load_issue_ids_cache(cv_vol_id):
    path = get_cache_path(cv_vol_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # кеш дійсний 24 години
        if 'timestamp' in data:
            ts = datetime.fromtimestamp(data['timestamp'])
            if datetime.now() - ts < timedelta(hours=24):
                print(f"  ✅ Кеш завантажено ({len(data.get('issue_ids', []))} ID)")
                return data.get('issue_ids', [])
        return None
    except Exception:
        return None


def save_issue_ids_cache(cv_vol_id, issue_ids):
    path = get_cache_path(cv_vol_id)
    data = {
        'cv_vol_id': cv_vol_id,
        'issue_ids': issue_ids,
        'timestamp': time.time(),
        'total': len(issue_ids),
        'cached_at': datetime.now().isoformat()
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  💾 Кеш збережено ({len(issue_ids)} ID)")


def get_all_issue_ids_for_volume(scraper, cv_vol_id):
    """Отримує список ВСІХ cv_id випусків тому (з кешем)"""
    cached = load_issue_ids_cache(cv_vol_id)
    if cached is not None:
        return cached

    print(f"  Запит списку ID випусків тому {cv_vol_id}...")
    all_ids = []
    offset = 0
    limit = 200          # максимум, який дозволяє ComicVine
    total = None

    while True:
        params = {
            'field_list': 'id',                    # тільки ID — дуже швидко
            'filter':     f'volume:{cv_vol_id}',
            'limit':      limit,
            'offset':     offset,
            'sort':       'issue_number:asc',
        }

        response = make_api_request(scraper, 'issues', params)
        if not response:
            break

        results = response.get('results', [])
        all_ids.extend([item['id'] for item in results if 'id' in item])

        if total is None:
            total = response.get('number_of_total_results', 0)
            print(f"    Знайдено всього: {total} випусків")

        print(f"    Отримано ID: {len(all_ids)}/{total}")

        if len(results) < limit or len(all_ids) >= total:
            break

        offset += limit
        time.sleep(0.7)

    save_issue_ids_cache(cv_vol_id, all_ids)
    return all_ids


def get_missing_issue_ids(db_path, cv_ids):
    """Повертає тільки ті cv_id, яких ще немає в БД"""
    if not cv_ids:
        return []
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    placeholders = ','.join('?' * len(cv_ids))
    cursor.execute(f'SELECT cv_id FROM issues WHERE cv_id IN ({placeholders})', cv_ids)
    existing = {row[0] for row in cursor.fetchall()}
    conn.close()

    missing = [cid for cid in cv_ids if cid not in existing]
    print(f"  Відсутніх у БД: {len(missing)} (вже є: {len(existing)})")
    return missing


# ═══════════════════════════════════════════════════════════════
# (всі інші функції без змін: extract_image_path, convert_*, print_divider,
# issue_exists, save_issue, volume_exists, get_or_create_publisher, save_volume,
# fetch_issue_via_api, parse_issue_api, fetch_volume_via_api, parse_volume_api)
# ═══════════════════════════════════════════════════════════════

def extract_image_path(image_url):
    if not image_url:
        return None
    match = re.search(r'(\d+/\d+/[^/\s]+\.(?:jpg|jpeg|png|gif|webp))', image_url)
    return '/' + match.group(1) if match else None


def convert_cover_date(date_str):
    if not date_str:
        return None
    date_str = date_str.strip()
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', date_str)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r'(\w+)\s+(\d{4})', date_str)
    if m:
        month = {'january':'01','february':'02','march':'03','april':'04',
                 'may':'05','june':'06','july':'07','august':'08',
                 'september':'09','october':'10','november':'11','december':'12'}
        return f"{m.group(2)}-{month.get(m.group(1).lower(), '00')}-00"
    if date_str.isdigit() and len(date_str) == 4:
        return f"{date_str}-00-00"
    return None


def convert_release_date(date_str):
    if not date_str:
        return None
    date_str = date_str.strip()
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', date_str)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r'(\w+)\s+(\d{1,2}),?\s+(\d{4})', date_str)
    if m:
        month = {'january':'01','february':'02','march':'03','april':'04',
                 'may':'05','june':'06','july':'07','august':'08',
                 'september':'09','october':'10','november':'11','december':'12'}
        return f"{m.group(3)}-{month.get(m.group(1).lower(), '00')}-{m.group(2).zfill(2)}"
    return convert_cover_date(date_str)


def print_divider(title=''):
    print(f"\n{'═'*70}")
    if title:
        print(f"  {title}")
    print(f"{'═'*70}")


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

        # Знаходимо перший вільний ID
        cursor.execute('''
            SELECT COALESCE(
                (SELECT MIN(id + 1) FROM issues WHERE id + 1 NOT IN (SELECT id FROM issues)),
                (SELECT MAX(id) + 1 FROM issues),
                1
            )
        ''')
        next_id = cursor.fetchone()[0]

        cursor.execute('''
            INSERT INTO issues
                (id, cv_id, cv_slug, name, cv_img, cv_vol_id,
                 issue_number, cover_date, release_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            next_id,
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

def volume_exists(db_path, cv_id):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT 1 FROM volumes WHERE cv_id = ? LIMIT 1', (cv_id,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists


def get_or_create_publisher(conn, pub_data):
    if not pub_data or not pub_data.get('id'):
        return None
    cv_id   = pub_data['id']
    name    = pub_data.get('name', f'Publisher {cv_id}')
    cv_slug = pub_data.get('api_detail_url', '')
    slug_match = re.search(r'/([^/]+)/4010-\d+/?', cv_slug)
    slug = slug_match.group(1) if slug_match else f'publisher-{cv_id}'

    cursor = conn.cursor()
    cursor.execute('SELECT id FROM publishers WHERE cv_id = ?', (cv_id,))
    row = cursor.fetchone()
    if row:
        return row[0]

    cursor.execute(
        'INSERT INTO publishers (cv_id, name, cv_slug) VALUES (?, ?, ?)',
        (cv_id, name, slug)
    )
    conn.commit()
    print(f"  + Видавець доданий: {name} (cv_id={cv_id})")
    return cursor.lastrowid


def save_volume(db_path, volume, publisher_db_id=None):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO volumes
                (cv_id, cv_slug, name, cv_img, publisher, start_year)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            volume['cv_id'],
            volume['cv_slug'],
            volume.get('name'),
            volume.get('cv_img'),
            publisher_db_id,
            volume.get('start_year'),
        ))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False
    except Exception as e:
        print(f"  ✗ Помилка запису тому в БД: {e}")
        return None


def fetch_issue_via_api(scraper, cv_id):
    endpoint = f"issue/4000-{cv_id}"
    params = {
        'field_list': 'id,name,volume,issue_number,cover_date,store_date,image,site_detail_url'
    }
    response = make_api_request(scraper, endpoint, params)
    if not response:
        return None
    data = response.get('results')
    if isinstance(data, list):
        data = data[0] if data else {}
    return data


def parse_issue_api(issue_data, cv_id):
    if not issue_data:
        return None
    site_url = issue_data.get('site_detail_url', '')
    slug_match = re.search(r'/([^/]+)/4000-\d+/?$', site_url)
    slug = slug_match.group(1) if slug_match else f"issue-{cv_id}"

    image_data = issue_data.get('image') or {}
    img_url = (image_data.get('original_url') or
               image_data.get('super_url') or
               image_data.get('medium_url'))

    return {
        'cv_id':        cv_id,
        'cv_slug':      slug,
        'name':         issue_data.get('name'),
        'cv_img':       extract_image_path(img_url),
        'cv_vol_id':    issue_data.get('volume', {}).get('id') if issue_data.get('volume') else None,
        'issue_number': issue_data.get('issue_number'),
        'cover_date':   convert_cover_date(issue_data.get('cover_date')),
        'release_date': convert_release_date(issue_data.get('store_date')),
    }


def fetch_volume_via_api(scraper, cv_id):
    endpoint = f"volume/4000-{cv_id}"
    params = {
        'field_list': 'id,name,publisher,image,start_year,site_detail_url,count_of_issues'
    }
    response = make_api_request(scraper, endpoint, params)
    if not response:
        return None
    data = response.get('results')
    if isinstance(data, list):
        data = data[0] if data else {}
    return data


def parse_volume_api(vol_data, cv_id):
    if not vol_data:
        return None
    site_url = vol_data.get('site_detail_url', '')
    slug_match = re.search(r'/([^/]+)/4050-\d+/?$', site_url)
    slug = slug_match.group(1) if slug_match else f"volume-{cv_id}"

    image_data = vol_data.get('image') or {}
    img_url = (image_data.get('original_url') or
               image_data.get('super_url') or
               image_data.get('medium_url'))

    return {
        'cv_id':       cv_id,
        'cv_slug':     slug,
        'name':        vol_data.get('name'),
        'cv_img':      extract_image_path(img_url),
        'start_year':  vol_data.get('start_year'),
        'publisher':   vol_data.get('publisher'),
        'issue_count': vol_data.get('count_of_issues', 0),
    }


# ═══════════════════════════════════════════════════════════════
# ГОЛОВНА ЛОГІКА
# ═══════════════════════════════════════════════════════════════

def add_issue_by_id(cv_id, db_path=DB_PATH):
    # ... (без змін — твоя оригінальна функція)
    print_divider(f"ДОДАВАННЯ ВИПУСКУ  CV_ID: {cv_id}")
    print(f"  БД: {db_path}")

    if issue_exists(db_path, cv_id):
        print(f"  ○ Випуск CV_ID={cv_id} вже є в базі")
        return {'ok': False, 'message': 'Вже існує'}

    scraper = create_scraper()
    issue_raw = fetch_issue_via_api(scraper, cv_id)
    if not issue_raw:
        return {'ok': False, 'message': 'API помилка'}

    data = parse_issue_api(issue_raw, cv_id)
    _print_issue(data)

    result = save_issue(db_path, data)

    if result is True:
        print(f"  ✓ Успішно додано: {data.get('name')} ({data['cv_slug']})")
        return {'ok': True, 'message': f"✓ Успішно додано: {data.get('name')}", 'data': data}
    elif result is False:
        print(f"  ○ Вже існує (IntegrityError)")
        return {'ok': False, 'message': 'Вже існує'}
    else:
        return {'ok': False, 'message': 'Помилка БД'}


def add_volume_by_id(cv_id, db_path=DB_PATH):
    # ... (без змін)
    print_divider(f"ДОДАВАННЯ ТОМУ  CV_ID: {cv_id}")
    print(f"  БД: {db_path}")

    if volume_exists(db_path, cv_id):
        print(f"  ○ Том CV_ID={cv_id} вже є в базі")
        return {'ok': False, 'message': 'Вже існує'}

    scraper  = create_scraper()
    vol_raw  = fetch_volume_via_api(scraper, cv_id)
    if not vol_raw:
        return {'ok': False, 'message': 'API помилка'}

    data = parse_volume_api(vol_raw, cv_id)

    print(f"\n  ┌{'─'*55}")
    print(f"  │ slug:        {data['cv_slug']}")
    print(f"  │ name:        {data.get('name')}")
    print(f"  │ cv_img:      {data.get('cv_img')}")
    print(f"  │ start_year:  {data.get('start_year')}")
    print(f"  │ publisher:   {data.get('publisher')}")
    print(f"  │ issue_count: {data.get('issue_count')}")
    print(f"  └{'─'*55}\n")

    publisher_db_id = None
    if data.get('publisher'):
        conn = sqlite3.connect(db_path)
        publisher_db_id = get_or_create_publisher(conn, data['publisher'])
        conn.close()

    result = save_volume(db_path, data, publisher_db_id)

    if result is True:
        print(f"  ✓ Том успішно додано: {data.get('name')} (cv_id={cv_id})")
        return {'ok': True, 'message': f"✓ Том додано: {data.get('name')}", 'data': data, 'cv_vol_id': cv_id}
    elif result is False:
        return {'ok': False, 'message': 'Вже існує'}
    else:
        return {'ok': False, 'message': 'Помилка БД'}


def add_all_issues_by_volume(cv_vol_id, db_path=DB_PATH, skip_existing=True):
    print_divider(f"ДОДАВАННЯ ВСІХ ВИПУСКІВ ТОМУ  CV_VOL_ID: {cv_vol_id}")
    print(f"  БД: {db_path}")

    scraper = create_scraper()

    # Крок 1: список ID (з кешем)
    all_ids = get_all_issue_ids_for_volume(scraper, cv_vol_id)

    # Крок 2: які відсутні
    if skip_existing:
        missing_ids = get_missing_issue_ids(db_path, all_ids)
    else:
        missing_ids = all_ids

    if not missing_ids:
        print("  ✓ Всі випуски вже є в базі. Нічого додавати.")
        return {'ok': True, 'message': 'Всі вже є', 'added': 0, 'skipped': len(all_ids)}

    print(f"\n  Починаємо завантаження {len(missing_ids)} відсутніх випусків...")

    added = 0
    errors = 0

    for i, cv_id in enumerate(missing_ids, 1):
        print(f"[{i}/{len(missing_ids)}] cv_id = {cv_id}")
        issue_raw = fetch_issue_via_api(scraper, cv_id)
        if not issue_raw:
            errors += 1
            continue

        data = parse_issue_api(issue_raw, cv_id)
        result = save_issue(db_path, data)

        if result is True:
            added += 1
            name = data.get('name') or f'#{data.get("issue_number", "?")}'
            print(f" ✓ #{data.get('issue_number', '?')} name: {name}")
        elif result is False:
            print(f"    ○ вже є")
        else:
            errors += 1

        time.sleep(0.6)   # оптимальна пауза

    summary = f"Додано: {added}, помилок: {errors}"
    print(f"\n  {'═'*50}")
    print(f"  РЕЗУЛЬТАТ: {summary} (всього в томі: {len(all_ids)})")
    print(f"  {'═'*50}\n")

    return {
        'ok': True,
        'message': summary,
        'added': added,
        'skipped': len(all_ids) - added,
        'errors': errors,
    }


def _print_issue(data):
    print(f"\n  ┌{'─'*55}")
    print(f"  │ slug:         {data['cv_slug']}")
    print(f"  │ name:         {data.get('name')}")
    print(f"  │ cv_img:       {data.get('cv_img')}")
    print(f"  │ cv_vol_id:    {data.get('cv_vol_id')}")
    print(f"  │ issue_number: {data.get('issue_number')}")
    print(f"  │ cover_date:   {data.get('cover_date')}")
    print(f"  │ release_date: {data.get('release_date')}")
    print(f"  └{'─'*55}\n")


# ═══════════════════════════════════════════════════════════════
# ТОЧКА ВХОДУ
# ═══════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) >= 2 and sys.argv[1].lstrip('-').isdigit():
        parser = argparse.ArgumentParser()
        parser.add_argument('cv_id', type=int)
        parser.add_argument('--db', default=DB_PATH)
        args = parser.parse_args()
        result = add_issue_by_id(args.cv_id, db_path=args.db)
        sys.exit(0 if result['ok'] else 1)

    parser = argparse.ArgumentParser(description='ComicVine парсер')
    sub = parser.add_subparsers(dest='cmd', required=True)

    p_issue = sub.add_parser('issue', help='Додати один випуск')
    p_issue.add_argument('cv_id', type=int)
    p_issue.add_argument('--db', default=DB_PATH)

    p_vol = sub.add_parser('volume', help='Додати один том')
    p_vol.add_argument('cv_id', type=int)
    p_vol.add_argument('--db', default=DB_PATH)

    p_vi = sub.add_parser('volume-issues', help='Додати всі випуски тому')
    p_vi.add_argument('cv_vol_id', type=int)
    p_vi.add_argument('--db', default=DB_PATH)
    p_vi.add_argument('--skip-existing', action='store_true', default=True,
                      help='Пропускати вже наявні (за замовчуванням)')
    p_vi.add_argument('--no-skip', dest='skip_existing', action='store_false')

    args = parser.parse_args()

    if args.cmd == 'issue':
        result = add_issue_by_id(args.cv_id, db_path=args.db)
    elif args.cmd == 'volume':
        result = add_volume_by_id(args.cv_id, db_path=args.db)
    elif args.cmd == 'volume-issues':
        result = add_all_issues_by_volume(args.cv_vol_id, db_path=args.db,
                                          skip_existing=args.skip_existing)
    else:
        parser.print_help()
        sys.exit(1)

    sys.exit(0 if result['ok'] else 1)


if __name__ == '__main__':
    main()