import json
import boto3
import logging
import os
import urllib.request
from datetime import datetime, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3            = boto3.client('s3')
events_client = boto3.client('events')

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']

_FACILITY_CACHE: list = []


def get_supabase_headers(prefer: str = None) -> dict:
    headers = {
        'apikey':        SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type':  'application/json',
    }
    if prefer:
        headers['Prefer'] = prefer
    return headers


def load_facilities() -> list:
    """
    Fetch hospital-category facilities only — cached per cold start.
    Filters server-side to avoid fuzzy matching against 500+
    community health orgs, retirement homes etc.
    """
    global _FACILITY_CACHE
    if _FACILITY_CACHE:
        logger.info("Using cached facility list")
        return _FACILITY_CACHE

    url = (
        f"{SUPABASE_URL}/rest/v1/facilities"
        f"?select=id,name,short_code"
        f"&category=eq.hospital"
    )
    req = urllib.request.Request(
        url,
        headers=get_supabase_headers(),
        method='GET'
    )
    with urllib.request.urlopen(req) as resp:
        _FACILITY_CACHE = json.loads(resp.read())

    logger.info(f"Loaded {len(_FACILITY_CACHE)} hospital facilities")
    for f in _FACILITY_CACHE:
        logger.info(f"  {f.get('short_code','?'):6} | {f['name']}")

    return _FACILITY_CACHE


def fuzzy_match_facility(scraped_name: str, facilities: list) -> dict | None:
    """
    Match scraped hospital name to Supabase facility.
    Three passes — decreasing strictness.
    Returns full facility dict or None.
    """
    scraped_lower = scraped_name.lower().strip()
    scraped_words = set(scraped_lower.split())

    # pass 1 — exact
    for f in facilities:
        if f['name'].lower().strip() == scraped_lower:
            logger.info(f"Exact match: '{scraped_name}' → {f['name']} ({f['id']})")
            return f

    # pass 2 — substring
    for f in facilities:
        db_lower = f['name'].lower().strip()
        if db_lower in scraped_lower or scraped_lower in db_lower:
            logger.info(f"Substring match: '{scraped_name}' → '{f['name']}'")
            return f

    # pass 3 — word overlap >= 50%
    for f in facilities:
        db_words = set(f['name'].lower().split())
        overlap  = scraped_words & db_words
        if len(overlap) >= max(2, len(scraped_words) * 0.5):
            logger.info(
                f"Word overlap: '{scraped_name}' → '{f['name']}' "
                f"overlap={overlap}"
            )
            return f

    logger.warning(f"No match: '{scraped_name}'")
    return None


def upsert_wait_times(records: list, facilities: list) -> tuple[int, int]:
    """
    Resolve facility UUIDs via fuzzy match, upsert to wait_times.
    Conflict target: (facility_id, scraped_at) unique index.
    Returns (upserted, skipped).
    """
    rows    = []
    skipped = 0

    for r in records:
        facility = fuzzy_match_facility(r['hospital_name'], facilities)
        if not facility:
            skipped += 1
            continue

        rows.append({
            'facility_id':  facility['id'],      # UUID
            'wait_minutes': r['wait_minutes'],
            'raw_wait':     r.get('raw_wait'),
            'source':       r.get('source'),
            'scraped_at':   r.get('scraped_at'),
            'recorded_at':  datetime.now(timezone.utc).isoformat()
        })

    if not rows:
        logger.warning("No rows after matching — check facility names")
        return 0, skipped

    url     = f"{SUPABASE_URL}/rest/v1/wait_times"
    payload = json.dumps(rows).encode('utf-8')
    req     = urllib.request.Request(
        url,
        data    = payload,
        headers = get_supabase_headers(
            prefer='resolution=merge-duplicates,return=minimal'
        ),
        method  = 'POST'
    )
    with urllib.request.urlopen(req) as resp:
        logger.info(f"Supabase upsert status: {resp.status}")

    return len(rows), skipped


def publish_completion(processor: str, record_count: int) -> None:
    events_client.put_events(
        Entries=[{
            'Source':       'medicoord.pipeline',
            'DetailType':   'ProcessorComplete',
            'Detail':       json.dumps({
                'processor':    processor,
                'status':       'SUCCESS',
                'record_count': record_count,
                'completed_at': datetime.now(timezone.utc).isoformat()
            }),
            'EventBusName': 'default'
        }]
    )
    logger.info(f"Published ProcessorComplete for {processor}")


def lambda_handler(event, context):
    logger.info(f"Received event: {json.dumps(event)}")

    bucket = event['detail']['bucket']['name']
    key    = event['detail']['object']['key']
    logger.info(f"Processing s3://{bucket}/{key}")

    obj     = s3.get_object(Bucket=bucket, Key=key)
    payload = json.loads(obj['Body'].read())
    meta    = payload['meta']
    records = payload['records']

    logger.info(
        f"Source: {meta['source']} | "
        f"Records: {meta['record_count']} | "
        f"Errors: {meta['error_count']}"
    )

    if not records:
        logger.warning("No records — skipping")
        return {"statusCode": 200, "body": "no records"}

    facilities        = load_facilities()
    upserted, skipped = upsert_wait_times(records, facilities)

    logger.info(f"Upserted: {upserted} | Skipped: {skipped}")

    publish_completion('er-wait-processor', upserted)

    return {
        'statusCode': 200,
        'body': {
            'processor': 'er-wait-processor',
            'upserted':  upserted,
            'skipped':   skipped,
            's3_key':    key
        }
    }