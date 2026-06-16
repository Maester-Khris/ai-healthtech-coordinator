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


def get_supabase_headers(prefer: str = None) -> dict:
    headers = {
        'apikey':        SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type':  'application/json',
    }
    if prefer:
        headers['Prefer'] = prefer
    return headers


def read_s3_payload(bucket: str, key: str) -> dict:
    obj = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(obj['Body'].read())


# def upsert_facilities(records: list) -> int:
#     """
#     Update business fields on existing facilities rows.
#     Matches on UUID facility_id — set by ingestion handler.
#     Only updates nullable business columns — never touches
#     name, category, lat, lng, source seeded data.
#     """
#     rows = []
#     for r in records:
#         if not r.get('facility_id'):
#             logger.warning(f"No facility_id on record: {r.get('name')} — skipping")
#             continue
#         rows.append({
#             'id':              r['facility_id'],   # UUID — must match existing row
#             'phone':           r.get('phone'),
#             'business_status': r.get('business_status'),
#             'open_now':        r.get('open_now'),
#             'weekday_hours':   json.dumps(r.get('weekday_hours', [])),
#             'updated_at':      datetime.now(timezone.utc).isoformat()
#         })

#     if not rows:
#         logger.warning("No rows to upsert")
#         return 0

#     url     = f"{SUPABASE_URL}/rest/v1/facilities"
#     payload = json.dumps(rows).encode('utf-8')
#     req     = urllib.request.Request(
#         url,
#         data    = payload,
#         headers = get_supabase_headers(
#             prefer='resolution=merge-duplicates,return=minimal'
#         ),
#         method  = 'POST'
#     )
#     with urllib.request.urlopen(req) as resp:
#         logger.info(f"Supabase upsert status: {resp.status}")

#     return len(rows)


def upsert_facilities(records: list) -> int:
    rows = []
    for r in records:
        if not r.get('facility_id'):
            logger.warning(f"No facility_id — skipping")
            continue
        rows.append({
            'id':              r['facility_id'],
            'phone':           r.get('phone'),
            'business_status': r.get('business_status'),
            'open_now':        r.get('open_now'),
            'weekday_hours':   r.get('weekday_hours'),
            'updated_at':      datetime.now(timezone.utc).isoformat()
        })

    if not rows:
        logger.warning("No rows to upsert")
        return 0

    # strip trailing slash to avoid double slash in path
    base_url = SUPABASE_URL.rstrip('/')
    url      = f"{base_url}/rest/v1/facilities?on_conflict=id"

    # log the exact URL for debugging
    logger.info(f"Posting to: {url}")
    logger.info(f"Row count: {len(rows)}")
    logger.info(f"First row keys: {list(rows[0].keys())}")

    payload = json.dumps(rows).encode('utf-8')
    req     = urllib.request.Request(
        url,
        data    = payload,
        headers = get_supabase_headers(
            prefer='resolution=merge-duplicates,return=minimal'
        ),
        method  = 'POST'
    )

    try:
        with urllib.request.urlopen(req) as resp:
            logger.info(f"Supabase upsert status: {resp.status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        logger.error(f"Supabase error {e.code}: {body}")
        raise

    return len(rows)


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

    payload = read_s3_payload(bucket, key)
    meta    = payload['meta']
    records = payload['records']

    logger.info(
        f"Source: {meta['source']} | "
        f"Records: {meta['record_count']} | "
        f"Errors: {meta['error_count']}"
    )

    if not records:
        logger.warning("No records to process — skipping upsert")
        return {"statusCode": 200, "body": "no records"}

    upserted = upsert_facilities(records)
    logger.info(f"Updated {upserted} facility records in Supabase")

    publish_completion('places-processor', upserted)

    return {
        "statusCode": 200,
        "body": {
            "processor": "places-processor",
            "upserted":  upserted,
            "s3_key":    key
        }
    }