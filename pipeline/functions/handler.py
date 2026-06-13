# from tenacity import retry, wait_exponential, stop_after_attempt

# @retry(
#     wait=wait_exponential(multiplier=1, min=2, max=30),
#     stop=stop_after_attempt(4)
# )
# def fetch_er_data(url):
#     response = requests.get(url, timeout=10)
#     response.raise_for_status()
#     return response.text

import json
import boto3
import requests
import os
import logging
from datetime import datetime, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── clients ────────────────────────────────────────────────────────────────
ssm    = boto3.client('ssm',  region_name='ca-central-1')
s3     = boto3.client('s3',   region_name='ca-central-1')

# ── config ─────────────────────────────────────────────────────────────────
S3_BUCKET   = os.environ['S3_BUCKET']          # medicoord-ingestion-test
S3_PREFIX   = 'raw/places/'


def get_secret(name: str) -> str:
    """Fetch a SecureString from SSM Parameter Store."""
    resp = ssm.get_parameter(
        Name=f'/medicoord/prod/{name}',
        WithDecryption=True
    )
    return resp['Parameter']['Value']


# ── test facilities (hardcoded for manual test) ────────────────────────────
TEST_FACILITIES = [
    {
        "facility_id": "FAC-001",
        "name": "Centre for Addiction and Mental Health",
        "address": "1001 Queen St W, Toronto, ON"
    },
    {
        "facility_id": "FAC-002",
        "name": "Toronto General Hospital",
        "address": "200 Elizabeth St, Toronto, ON"
    },
    {
        "facility_id": "FAC-003",
        "name": "St. Michael's Hospital",
        "address": "36 Queen St E, Toronto, ON"
    }
]


def search_place_id(facility: dict, api_key: str) -> str | None:
    """Resolve a facility name + address to a Google Place ID."""
    url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    params = {
        "input":      f"{facility['name']} {facility['address']}",
        "inputtype":  "textquery",
        "fields":     "place_id,name",
        "key":        api_key
    }
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    candidates = resp.json().get("candidates", [])
    if not candidates:
        logger.warning(f"No place_id found for {facility['name']}")
        return None
    return candidates[0]["place_id"]


def fetch_place_details(place_id: str, api_key: str) -> dict:
    """Fetch hours, phone, open_now for a resolved Place ID."""
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields":   "name,formatted_address,formatted_phone_number,"
                    "opening_hours,current_opening_hours,business_status",
        "key":      api_key
    }
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json().get("result", {})


def build_record(facility: dict, details: dict) -> dict:
    """Normalise Places API response into our raw schema."""
    hours = details.get("opening_hours", {})
    return {
        "facility_id":    facility["facility_id"],
        "name":           details.get("name", facility["name"]),
        "address":        details.get("formatted_address", facility["address"]),
        "phone":          details.get("formatted_phone_number"),
        "business_status":details.get("business_status"),
        "open_now":       hours.get("open_now"),
        "weekday_hours":  hours.get("weekday_text", []),
        "scraped_at":     datetime.now(timezone.utc).isoformat()
    }


def upload_to_s3(payload: dict) -> str:
    """Write the raw payload to S3, return the S3 key."""
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


# ── entry point ────────────────────────────────────────────────────────────
def lambda_handler(event, context):
    logger.info("Starting Google Places ingestion — test run")

    api_key = get_secret('google_places_key')
    records = []
    errors  = []

    for facility in TEST_FACILITIES:
        try:
            logger.info(f"Processing: {facility['name']}")
            place_id = search_place_id(facility, api_key)
            if not place_id:
                errors.append({"facility_id": facility["facility_id"], "reason": "no_place_id"})
                continue
            details = fetch_place_details(place_id, api_key)
            records.append(build_record(facility, details))
        except Exception as e:
            logger.error(f"Failed on {facility['name']}: {e}")
            errors.append({"facility_id": facility["facility_id"], "reason": str(e)})

    payload = {
        "meta": {
            "source":       "google_places",
            "fetched_at":   datetime.now(timezone.utc).isoformat(),
            "record_count": len(records),
            "error_count":  len(errors),
            "errors":       errors
        },
        "records": records
    }

    s3_key = upload_to_s3(payload)

    return {
        "statusCode": 200,
        "body": {
            "s3_key":       s3_key,
            "record_count": len(records),
            "error_count":  len(errors)
        }
    }