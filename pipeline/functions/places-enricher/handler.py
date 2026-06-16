import json
import boto3
import requests
import os
import logging
from datetime import datetime, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── clients ────────────────────────────────────────────────────────────────
s3 = boto3.client('s3')

# ── config ─────────────────────────────────────────────────────────────────
S3_BUCKET        = os.environ['S3_BUCKET']
S3_PREFIX        = os.environ.get('S3_PREFIX', 'raw/places/')
GOOGLE_PLACES_KEY = os.environ['GOOGLE_PLACES_KEY']

# ── facilities to enrich ───────────────────────────────────────────────────
# facility_id = real UUID from Supabase facilities table (source='manual')
# processor will update phone, business_status, open_now, weekday_hours
# on the matching row using this UUID as the upsert key
FACILITIES = [
    {
        "facility_id": "528bf564-3b22-4290-b17f-561a3d9a4586",  # Toronto General Hospital
        "name":        "Toronto General Hospital",
        "address":     "200 Elizabeth St, Toronto, ON"
    },
    {
        "facility_id": "799f7e15-d7b6-4c82-b44c-ed3518d21de5",  # Toronto Western Hospital
        "name":        "Toronto Western Hospital",
        "address":     "399 Bathurst St, Toronto, ON"
    },
    {
        "facility_id": "fabef9a1-67fb-47de-95f2-1e9a4618d74e",  # Sunnybrook
        "name":        "Sunnybrook Health Sciences Centre",
        "address":     "2075 Bayview Ave, Toronto, ON"
    },
    {
        "facility_id": "4bd79c71-831a-4f86-857e-399f82fece90",  # St. Michael's
        "name":        "St. Michael's Hospital",
        "address":     "30 Bond St, Toronto, ON"
    },
    {
        "facility_id": "00e9a12b-c3ba-4b5e-962f-669d5068f827",  # Mount Sinai
        "name":        "Mount Sinai Hospital",
        "address":     "600 University Ave, Toronto, ON"
    },
    {
        "facility_id": "27ae24e2-bf33-4c65-b9da-7b3dd780bcd7",  # North York General
        "name":        "North York General Hospital",
        "address":     "4001 Leslie St, North York, ON"
    },
    {
        "facility_id": "64873cec-62b6-498e-8add-23153f68a1f1",  # Michael Garron
        "name":        "Michael Garron Hospital",
        "address":     "825 Coxwell Ave, Toronto, ON"
    },
    {
        "facility_id": "7cb3f13d-3cd5-4a6c-9e29-8f8052a75825",  # SHN Centenary
        "name":        "Scarborough Health Network - Centenary Hospital",
        "address":     "2867 Ellesmere Rd, Scarborough, ON"
    },
    {
        "facility_id": "ca29d90e-3f9c-4932-b54c-7ad8d84ae1e1",  # Trillium Queensway
        "name":        "Trillium Health Partners - Queensway Health Centre",
        "address":     "150 Sherway Dr, Etobicoke, ON"
    },
    {
        "facility_id": "267c8d87-4716-4fa6-8ae4-c5fbf1fd00ad",  # SHN General
        "name":        "Scarborough Health Network - General Hospital",
        "address":     "3050 Lawrence Ave E, Scarborough, ON"
    },
    {
        "facility_id": "7543d61e-ad77-4dae-912d-e35c1534901b",  # Trillium Mississauga
        "name":        "Trillium Health Partners - Mississauga Hospital",
        "address":     "100 Queensway W, Mississauga, ON"
    }
]


def search_place_id(facility: dict, api_key: str) -> str | None:
    """Resolve facility name + address to a Google Place ID."""
    url    = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    params = {
        "input":     f"{facility['name']} {facility['address']}",
        "inputtype": "textquery",
        "fields":    "place_id,name",
        "key":       api_key
    }
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    candidates = resp.json().get("candidates", [])
    if not candidates:
        logger.warning(f"No place_id found for {facility['name']}")
        return None
    return candidates[0]["place_id"]


def fetch_place_details(place_id: str, api_key: str) -> dict:
    """Fetch hours, phone, open_now, business_status from Places API."""
    url    = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields":   (
            "name,formatted_address,formatted_phone_number,"
            "opening_hours,current_opening_hours,business_status"
        ),
        "key": api_key
    }
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json().get("result", {})


def build_record(facility: dict, details: dict) -> dict:
    """
    Build raw S3 record aligned with Supabase facilities schema.
    Only populates nullable business columns — never touches
    name, category, lat, lng, accepted_severity, source.
    Those are set at seed time and owned by the processor.
    facility_id (UUID) is the upsert key in the processor.
    """
    hours = details.get("opening_hours", {})

    # weekday_text is a list of strings e.g.
    # ["Monday: 9:00 AM – 5:00 PM", "Tuesday: 9:00 AM – 5:00 PM", ...]
    # stored as JSON string in weekday_hours text column
    weekday_text = hours.get("weekday_text", [])

    return {
        # ── upsert key ────────────────────────────────────────────────────
        "facility_id":     facility["facility_id"],  # Supabase UUID

        # ── nullable business fields (schema columns) ─────────────────────
        "phone":           details.get("formatted_phone_number"),
        "business_status": details.get("business_status"),
        "open_now":        hours.get("open_now"),
        "weekday_hours":   json.dumps(weekday_text),  # text column — JSON string

        # ── pipeline metadata (not written to DB — used by processor) ─────
        "scraped_name":    details.get("name", facility["name"]),
        "scraped_address": details.get("formatted_address", facility["address"]),
        "scraped_at":      datetime.now(timezone.utc).isoformat()
    }


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
    logger.info("Starting Google Places enrichment")

    records = []
    errors  = []

    for facility in FACILITIES:
        try:
            logger.info(f"Processing: {facility['name']}")
            place_id = search_place_id(facility, GOOGLE_PLACES_KEY)
            if not place_id:
                errors.append({
                    "facility_id": facility["facility_id"],
                    "reason":      "no_place_id"
                })
                continue
            details = fetch_place_details(place_id, GOOGLE_PLACES_KEY)
            records.append(build_record(facility, details))
        except Exception as e:
            logger.error(f"Failed on {facility['name']}: {e}")
            errors.append({
                "facility_id": facility["facility_id"],
                "reason":      str(e)
            })

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
    logger.info(f"Done — {len(records)} records, {len(errors)} errors")

    return {
        "statusCode": 200,
        "body": {
            "s3_key":       s3_key,
            "record_count": len(records),
            "error_count":  len(errors)
        }
    }