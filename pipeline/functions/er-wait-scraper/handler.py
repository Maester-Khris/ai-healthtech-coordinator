import json
import boto3
import requests
import logging
import os
from datetime import datetime, timezone
from bs4 import BeautifulSoup

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')

S3_BUCKET  = os.environ['S3_BUCKET']
S3_PREFIX  = os.environ.get('S3_PREFIX', 'raw/er-wait/')

# ── scrape targets ─────────────────────────────────────────────────────────
SOURCES = [
    {
        'name':    'erstat',
        'url':     'https://erstat.ca/hospitals/on/toronto',
        'parser':  'parse_erstat'
    },
    {
        'name':    'howlongwilliwait',
        'url':     'https://howlongwilliwait.com/',
        'parser':  'parse_hlwiw'
    }
]


def parse_erstat(html: str) -> list:
    """
    Parse ERstat Toronto page.
    Hospital entries render as anchor tags containing name + wait time text.
    Pattern: 'Hospital Name24/7 · Address Wait'
    Only hospitals with live data have a numeric wait — others show '--'.
    """
    soup     = BeautifulSoup(html, 'lxml')
    records  = []

    # hospital cards are <a> tags in the main content area
    # each contains: name, hours, address, wait time as concatenated text
    for anchor in soup.select('a[href*="/hospitals/on/"]'):
        text = anchor.get_text(separator='|', strip=True)
        parts = [p.strip() for p in text.split('|') if p.strip()]

        if len(parts) < 2:
            continue

        name     = parts[0]
        raw_wait = parts[-1]  # last element is wait time or '--'

        # skip entries with no live data
        if raw_wait == '--' or not any(c.isdigit() for c in raw_wait):
            continue

        wait_minutes = parse_wait_to_minutes(raw_wait)
        if wait_minutes is None:
            continue

        records.append({
            'hospital_name': name,
            'wait_minutes':  wait_minutes,
            'raw_wait':      raw_wait,
            'source':        'erstat',
            'source_url':    f"https://erstat.ca/hospitals/on/toronto",
            'scraped_at':    datetime.now(timezone.utc).isoformat()
        })

    logger.info(f"ERstat: parsed {len(records)} hospitals with live data")
    return records


def parse_hlwiw(html: str) -> list:
    """
    Parse howlongwilliwait.com.
    Page renders hospital rows with name and wait time columns.
    """
    soup    = BeautifulSoup(html, 'lxml')
    records = []

    # rows contain hospital name + wait time in adjacent elements
    for row in soup.select('tr'):
        cells = row.find_all('td')
        if len(cells) < 2:
            continue

        name     = cells[0].get_text(strip=True)
        raw_wait = cells[1].get_text(strip=True)

        if not name or not raw_wait:
            continue
        if raw_wait in ('--', 'N/A', ''):
            continue

        wait_minutes = parse_wait_to_minutes(raw_wait)
        if wait_minutes is None:
            continue

        records.append({
            'hospital_name': name,
            'wait_minutes':  wait_minutes,
            'raw_wait':      raw_wait,
            'source':        'howlongwilliwait',
            'source_url':    'https://howlongwilliwait.com/',
            'scraped_at':    datetime.now(timezone.utc).isoformat()
        })

    logger.info(f"HLWIW: parsed {len(records)} hospitals with live data")
    return records


def parse_wait_to_minutes(raw: str) -> int | None:
    """
    Normalise wait time strings to integer minutes.
    Handles formats: '2h 4m', '45m', '1h', '30 min', '2:04'
    Returns None if unparseable.
    """
    import re
    raw = raw.strip().lower()

    # format: 2h 4m or 1h 30m
    m = re.match(r'(\d+)h\s*(\d+)m', raw)
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))

    # format: 2h
    m = re.match(r'(\d+)h$', raw)
    if m:
        return int(m.group(1)) * 60

    # format: 45m or 45 min
    m = re.match(r'(\d+)\s*m', raw)
    if m:
        return int(m.group(1))

    # format: 2:04 (hours:minutes)
    m = re.match(r'(\d+):(\d+)', raw)
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))

    logger.warning(f"Could not parse wait time: '{raw}'")
    return None


def scrape_source(source: dict) -> list:
    """Fetch HTML and dispatch to correct parser."""
    try:
        resp = requests.get(source['url'], timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; Medicoord/1.0)'
        })
        resp.raise_for_status()
        parser_fn = globals()[source['parser']]
        return parser_fn(resp.text)
    except Exception as e:
        logger.error(f"Failed to scrape {source['name']}: {e}")
        return []


def upload_to_s3(payload: dict) -> str:
    ts  = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')
    key = f"{S3_PREFIX}{ts}.json"
    s3.put_object(
        Bucket      = S3_BUCKET,
        Key         = key,
        Body        = json.dumps(payload, indent=2),
        ContentType = 'application/json'
    )
    logger.info(f"Uploaded to s3://{S3_BUCKET}/{key}")
    return key


def lambda_handler(event, context):
    logger.info("Starting ER wait time scraper")

    all_records = []
    errors      = []

    for source in SOURCES:
        logger.info(f"Scraping: {source['name']}")
        records = scrape_source(source)
        all_records.extend(records)
        if not records:
            errors.append({'source': source['name'], 'reason': 'no_records'})

    payload = {
        'meta': {
            'source':       'er_wait_scraper',
            'fetched_at':   datetime.now(timezone.utc).isoformat(),
            'record_count': len(all_records),
            'error_count':  len(errors),
            'errors':       errors
        },
        'records': all_records
    }

    s3_key = upload_to_s3(payload)

    return {
        'statusCode': 200,
        'body': {
            's3_key':       s3_key,
            'record_count': len(all_records),
            'error_count':  len(errors)
        }
    }