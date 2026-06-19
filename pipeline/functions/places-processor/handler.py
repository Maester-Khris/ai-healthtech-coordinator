import json
import boto3
import requests
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3            = boto3.client('s3')
events_client = boto3.client('events')

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']

BATCH_SIZE        = 50
FAILURE_THRESHOLD = 0.10  # publish FAILURE and skip dbt if >10% of records fail


# ── helpers ────────────────────────────────────────────────────────────────

def _headers() -> dict:
    return {
        'apikey':        SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type':  'application/json',
    }


def read_s3_payload(bucket: str, key: str) -> dict:
    obj = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(obj['Body'].read())


# ── patch ──────────────────────────────────────────────────────────────────

def patch_facility(session: requests.Session, record: dict) -> None:
    """
    UPDATE-only PATCH — touches only business columns.
    last_enriched_at is set from scraped_at so the enricher's
    stale filter advances correctly after a successful DB write.
    """
    base = SUPABASE_URL.rstrip('/')
    url  = f"{base}/rest/v1/facilities?id=eq.{record['facility_id']}"
    body = {
        'phone':            record.get('phone'),
        'business_status':  record.get('business_status'),
        'weekday_hours':    record.get('weekday_hours'),
        'last_enriched_at': record.get('scraped_at'),
        'updated_at':       datetime.now(timezone.utc).isoformat(),
    }
    resp = session.patch(url, json=body, headers=_headers())
    resp.raise_for_status()


def patch_batch(
    session: requests.Session,
    batch: list[dict],
) -> tuple[int, list[dict]]:
    """Patch one batch. Returns (success_count, failures)."""
    successes = 0
    failures  = []
    for record in batch:
        try:
            patch_facility(session, record)
            successes += 1
        except Exception as e:
            logger.error(f"PATCH failed for {record['facility_id']}: {e}")
            failures.append({'facility_id': record['facility_id'], 'reason': str(e)})
    return successes, failures


# ── eventbridge ────────────────────────────────────────────────────────────

def publish_completion(
    processor: str,
    record_count: int,
    status: str,
    failures: list[dict],
) -> None:
    detail = {
        'processor':    processor,
        'status':       status,
        'record_count': record_count,
        'completed_at': datetime.now(timezone.utc).isoformat(),
    }
    if failures:
        detail['failed_ids'] = [f['facility_id'] for f in failures]

    events_client.put_events(
        Entries=[{
            'Source':       'medicoord.pipeline',
            'DetailType':   'ProcessorComplete',
            'Detail':       json.dumps(detail),
            'EventBusName': 'default',
        }]
    )
    logger.info(f"Published ProcessorComplete status={status} for {processor}")


# ── handler ────────────────────────────────────────────────────────────────

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
        f"Enricher errors: {meta['error_count']}"
    )

    if not records:
        logger.warning("No records to process — skipping upsert")
        return {'statusCode': 200, 'body': 'no records'}

    batches       = [records[i:i + BATCH_SIZE] for i in range(0, len(records), BATCH_SIZE)]
    total_success = 0
    all_failures  = []

    logger.info(f"Processing {len(records)} records in {len(batches)} batches of {BATCH_SIZE}")

    with requests.Session() as session:
        for i, batch in enumerate(batches):
            ok, failures = patch_batch(session, batch)
            total_success += ok
            all_failures.extend(failures)
            logger.info(f"Batch {i + 1}/{len(batches)}: {ok} ok, {len(failures)} failed")

    failure_rate = len(all_failures) / len(records)
    status       = 'FAILURE' if failure_rate > FAILURE_THRESHOLD else 'SUCCESS'

    logger.info(
        f"Done — {total_success} updated, {len(all_failures)} failed "
        f"({failure_rate:.1%} failure rate) → {status}"
    )

    publish_completion('places-processor', total_success, status, all_failures)

    return {
        'statusCode': 200,
        'body': {
            'processor':  'places-processor',
            'upserted':   total_success,
            'failed':     len(all_failures),
            's3_key':     key,
            'status':     status,
        },
    }
