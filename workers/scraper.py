"""
scraper.py — Railway cron worker. Single entry point.

Railway calls:  python workers/scraper.py
Railway handles scheduling (set to every 15 min in railway.toml).

Run order on each invocation:
  1. Fetch facility list from Supabase (name → uuid)
  2. Scrape ERstat + HowLongWillIWait
  3. Fuzzy-match scraped names to facility UUIDs  (no static file needed)
  4. Consolidate both sources into one record per facility
  5. Batch upsert → Supabase `wait_times`
  6. Batch update → Upstash Redis Hash `wait_times:current`
  7. Exit

Env vars (Doppler):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    UPSTASH_REDIS_URL            — redis://:password@host:port
"""

import json
import logging
import os
import re
import sys
import uuid
from datetime import datetime, timezone

import redis
import requests
from bs4 import BeautifulSoup
from thefuzz import process as fuzz_process

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"].strip()
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip()
UPSTASH_REDIS_URL = os.environ["UPSTASH_REDIS_URL"].strip()
GOOGLE_PLACES_KEY = os.environ["GOOGLE_PLACES_KEY"].strip()

# Unmatched scraped hospitals get created with these — ER wait-time sources
# only ever report on hospitals/ERs, so these mirror seed/run.py's hospital row.
NEW_FACILITY_CATEGORY = "hospital"
NEW_FACILITY_SOURCE_TYPE = "general"
NEW_FACILITY_SEVERITY = ["emergent", "urgent", "moderate", "routine"]

REDIS_HASH_KEY = "wait_times:current"
# ponytail: no TTL — scraped hospital names are stable, and a stale
# negative entry just costs one re-resolve if the API result changes.
# Clear manually (SREM) if a name needs to be re-checked sooner.
NEGATIVE_CACHE_KEY = "scraper:unresolved_places"
FUZZY_THRESHOLD = 75  # minimum match score (0–100) to accept a facility link

# Amalgamated City of Toronto bounding box — covers all six former
# municipalities (incl. Scarborough, North York, Etobicoke). Real prod
# addresses (e.g. "...scarborough on m1w 3w3") never contain the literal
# word "toronto", so this replaces a substring match with geography.
TORONTO_BOUNDS = {"min_lat": 43.58, "max_lat": 43.86, "min_lng": -79.64, "max_lng": -79.12}


def _in_toronto_bounds(lat: float, lng: float) -> bool:
    return (
        TORONTO_BOUNDS["min_lat"] <= lat <= TORONTO_BOUNDS["max_lat"]
        and TORONTO_BOUNDS["min_lng"] <= lng <= TORONTO_BOUNDS["max_lng"]
    )

# Supabase Data API headers
SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# ── Name normalisation ────────────────────────────────────────────────────────

def clean_hospital_name(name: str) -> str:
    if not name:
        return ""
    name = name.lower()
    name = re.sub(r'\(.*?\)', '', name)
    name = re.sub(r'[^a-z0-9\s]', '', name)
    name = (
        name.replace("hospital", "")
            .replace("health sciences centre", "")
            .replace("centre", "")
    )
    return " ".join(name.split())


# ── Time parsing ──────────────────────────────────────────────────────────────

def parse_time_to_minutes(time_str: str) -> int | None:
    if not time_str or any(x in time_str.lower() for x in ("no data", "not available")):
        return None
    if "—" in time_str:
        return None

    s = time_str.lower()
    if "to" in s:
        s = s.split("to")[-1]

    minutes = 0
    has_match = False

    h = re.search(r'(\d+)\s*(?:h|hr|hour)', s)
    m = re.search(r'(\d+)\s*(?:m|min|minute)', s)

    if h:
        minutes += int(h.group(1)) * 60
        has_match = True
    if m:
        minutes += int(m.group(1))
        has_match = True
    elif not h and re.match(r'^\s*(\d+)\s*$', s):
        minutes = int(s.strip())
        has_match = True

    return minutes if has_match else None


# ── Step 1: fetch DB facilities ───────────────────────────────────────────────

def fetch_db_facilities(url: str, headers: dict) -> dict[str, str]:
    """
    Returns {clean_facility_name: facility_uuid} for all facilities_clean rows.
    Used as the fuzzy-match corpus.
    """
    endpoint = f"{url}/rest/v1/facilities_clean?select=facility_id,facility_name"
    r = requests.get(endpoint, headers=headers, timeout=10)
    if r.status_code != 200:
        log.error(f"Fetch DB facilities failed: {r.status_code} - {r.text}")
    r.raise_for_status()
    rows = r.json()
    
    corpus: dict[str, str] = {}
    for row in rows:
        clean = clean_hospital_name(row["facility_name"])
        if clean:
            corpus[clean] = row["facility_id"]
    log.info("DB: %d facilities loaded", len(corpus))
    return corpus


def fetch_existing_place_ids(url: str, headers: dict) -> dict[str, str]:
    """
    Returns {google_place_id: facility_id} for every facility that already
    has one. Pre-seeds build_facility_map's dedup map so a name that
    resolves to an already-created facility in a later run (facilities_clean
    won't show it for up to ~7 days post-dbt-rebuild) reuses the existing
    row instead of violating facilities_name_lat_lng_unique or creating a
    silent duplicate.
    """
    endpoint = f"{url}/rest/v1/facilities?select=id,google_place_id&google_place_id=not.is.null"
    r = requests.get(endpoint, headers=headers, timeout=10)
    r.raise_for_status()
    return {row["google_place_id"]: row["id"] for row in r.json()}


# ── Step 2: scrapers ──────────────────────────────────────────────────────────

def scrape_erstat() -> dict[str, dict]:
    """Returns {clean_name: {official_name, city, raw_wait, wait_minutes}}."""
    url = "https://erstat.ca/hospitals/on"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    try:
        r = requests.get(url, headers=headers, timeout=10)
        r.raise_for_status()
    except requests.RequestException as e:
        log.error("ERstat fetch failed: %s", e)
        return {}

    soup = BeautifulSoup(r.text, "html.parser")
    data: dict[str, dict] = {}

    rows = soup.select(".hospital-row")
    if rows:
        for row in rows:
            info = row.select_one(".hospital-row-info")
            wait_el = row.select_one(".hospital-row-wait")
            name = info.select_one("h3").get_text(strip=True) if info and info.select_one("h3") else ""
            p_text = info.select_one("p").get_text(strip=True) if info and info.select_one("p") else ""
            city = p_text.split("·")[0].strip() if "·" in p_text else p_text
            raw_wait = wait_el.get_text(strip=True) if wait_el else ""
            clean = clean_hospital_name(name)
            if clean:
                data[clean] = {
                    "official_name": name,
                    "city": city,
                    "raw_wait": raw_wait,
                    "wait_minutes": parse_time_to_minutes(raw_wait),
                }
    else:
        for row in soup.select("table tbody tr"):
            cells = row.find_all(["td", "div"], recursive=False)
            if len(cells) >= 3:
                name = cells[0].get_text(strip=True)
                city = cells[1].get_text(strip=True)
                raw_wait = cells[2].get_text(strip=True)
                clean = clean_hospital_name(name)
                if clean:
                    data[clean] = {
                        "official_name": name,
                        "city": city,
                        "raw_wait": raw_wait,
                        "wait_minutes": parse_time_to_minutes(raw_wait),
                    }

    log.info("ERstat: %d hospitals scraped", len(data))
    return data


def scrape_howlongwilliwait() -> dict[str, dict]:
    """Returns {clean_name: {hlwiw_name, raw_wait, wait_minutes}}."""
    url = "https://howlongwilliwait.com/sample.json"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }

    try:
        r = requests.get(url, headers=headers, timeout=10)
        r.raise_for_status()
        raw = r.json()
    except Exception as e:
        log.error("HowLongWillIWait fetch failed: %s", e)
        return {}

    data: dict[str, dict] = {}
    for name, wait_str in raw.items():
        clean = clean_hospital_name(name)
        if clean:
            data[clean] = {
                "hlwiw_name": name.strip(),
                "raw_wait": wait_str.strip(),
                "wait_minutes": parse_time_to_minutes(wait_str),
            }

    log.info("HowLongWillIWait: %d hospitals scraped", len(data))
    return data


# ── Step 3a: resolve + create unmatched hospitals via Google Places ──────────

class TransientLookupError(Exception):
    """Places API call failed for a reason likely to clear up on retry."""


def resolve_unmatched_facility(name: str) -> dict | None:
    """
    Mirrors pipeline/functions/places-enricher/handler.py's search+details calls.
    Restricted to the Toronto routing region — returns None (not created) for
    anything outside it, anything Google can't resolve. Raises
    TransientLookupError on network failure so callers don't treat a flaky
    request the same as "this facility doesn't exist".
    """
    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
            params={
                "input": f"{name} Ontario",
                "inputtype": "textquery",
                "fields": "place_id",
                "key": GOOGLE_PLACES_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()
        candidates = resp.json().get("candidates", [])
    except requests.RequestException as e:
        log.warning("Places search failed for '%s': %s", name, e)
        raise TransientLookupError(name) from e
    if not candidates:
        return None
    place_id = candidates[0]["place_id"]

    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/place/details/json",
            params={
                "place_id": place_id,
                "fields": "name,formatted_address,formatted_phone_number,opening_hours,business_status,geometry",
                "key": GOOGLE_PLACES_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()
        details = resp.json().get("result", {})
    except requests.RequestException as e:
        log.warning("Places details failed for '%s': %s", name, e)
        raise TransientLookupError(name) from e

    address = details.get("formatted_address", "")

    location = details.get("geometry", {}).get("location", {})
    if "lat" not in location or "lng" not in location:
        return None
    if not _in_toronto_bounds(location["lat"], location["lng"]):
        return None  # outside the routing region — not a real "no match"

    return {
        "facility_name": (details.get("name") or name).strip(),
        "category": NEW_FACILITY_CATEGORY,
        "source_facility_type": NEW_FACILITY_SOURCE_TYPE,
        "accepted_severity": NEW_FACILITY_SEVERITY,
        "address": address,
        "lat": location["lat"],
        "lng": location["lng"],
        "phone": details.get("formatted_phone_number"),
        "google_place_id": place_id,
        "business_status": details.get("business_status"),
        "weekday_hours": json.dumps(details.get("opening_hours", {}).get("weekday_text", [])),
    }


def insert_new_facilities(url: str, headers: dict, records: list[dict]) -> set[str]:
    """
    Persists newly-discovered Toronto hospitals into both `facilities` and
    `facilities_clean` so future scraper runs match them directly via the
    normal fuzzy-match corpus instead of re-resolving every time.

    Returns the set of facility_ids whose `facilities` row was actually
    persisted. wait_times.facility_id has an FK to facilities(id) (not
    facilities_clean), so that row alone is what callers need to know
    succeeded before publishing wait times for it.
    """
    if not records:
        return set()
    now = datetime.now(timezone.utc).isoformat()

    def _common(r: dict) -> dict:
        return dict(
            category=r["category"],
            source_facility_type=r["source_facility_type"],
            accepted_severity=r["accepted_severity"],
            address=r["address"],
            lat=r["lat"],
            lng=r["lng"],
            phone=r["phone"],
            google_place_id=r["google_place_id"],
            weekday_hours=r["weekday_hours"],
            last_enriched_at=now,
        )

    facilities_rows = [{
        "id": r["facility_id"],
        "name": r["facility_name"],
        **_common(r),
        "business_status": r["business_status"],
        "source": "manual",
    } for r in records]

    try:
        resp = requests.post(f"{url}/rest/v1/facilities", headers=headers, json=facilities_rows, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as e:
        log.error("Insert into facilities failed, skipping facilities_clean too: %s", e)
        return set()

    succeeded_ids = {r["facility_id"] for r in records}

    clean_rows = [{
        "facility_id": r["facility_id"],
        "facility_name": r["facility_name"],
        **_common(r),
        "business_status": (r["business_status"] or "").upper(),
        "is_operational": (r["business_status"] or "").upper() == "OPERATIONAL",
        "dbt_run_at": now,
    } for r in records]

    try:
        resp = requests.post(f"{url}/rest/v1/facilities_clean", headers=headers, json=clean_rows, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as e:
        log.error("Insert into facilities_clean failed (facilities row still created): %s", e)
        return succeeded_ids

    log.info("Created %d new Toronto facilities from unmatched scraped names", len(records))
    return succeeded_ids


# ── Step 3b: fuzzy match scraped names → facility UUIDs ──────────────────────

def build_facility_map(
    erstat_data: dict[str, dict],
    hlwiw_data: dict[str, dict],
    db_corpus: dict[str, str],  # {clean_db_name: uuid}
    url: str,
    headers: dict,
    redis_client: redis.Redis,
) -> dict[str, str]:
    """
    Fuzzy-matches all scraped clean names against the DB corpus.
    Unmatched names are resolved via Google Places and, if confirmed inside
    the Toronto routing region, created as new facilities on the fly.
    Returns {clean_scraped_name: facility_uuid}.
    """
    all_scraped_names: set[str] = set(erstat_data.keys()) | set(hlwiw_data.keys())
    corpus_keys = list(db_corpus.keys())
    facility_map: dict[str, str] = {}
    unmatched: list[str] = []
    new_facilities: list[dict] = []
    dedup_reused = 0
    place_id_to_facility_id: dict[str, str] | None = None  # fetched lazily, only if a name resolves
    cached_unresolved = redis_client.smembers(NEGATIVE_CACHE_KEY)

    for clean in all_scraped_names:
        result = fuzz_process.extractOne(clean, corpus_keys, score_cutoff=FUZZY_THRESHOLD)
        if result:
            best_key, score, *_ = result
            facility_map[clean] = db_corpus[best_key]
            continue

        official = (
            erstat_data.get(clean, {}).get("official_name")
            or hlwiw_data.get(clean, {}).get("hlwiw_name")
            or clean
        )
        cache_key = official.strip().lower()
        if cache_key in cached_unresolved:
            unmatched.append(official)
            continue

        try:
            created = resolve_unmatched_facility(official)
        except TransientLookupError:
            unmatched.append(official)
            continue
        if created is None:
            unmatched.append(official)
            redis_client.sadd(NEGATIVE_CACHE_KEY, cache_key)
            continue

        if place_id_to_facility_id is None:
            place_id_to_facility_id = fetch_existing_place_ids(url, headers)

        place_id = created["google_place_id"]
        if place_id in place_id_to_facility_id:
            # Dedup-reused: this name resolves to an existing facility via
            # Places, but facilities_clean hasn't caught up yet (dbt lag).
            # Do NOT blacklist — keep retrying every run so this facility's
            # wait time doesn't silently stop updating if facilities_clean
            # never picks up this specific name variant.
            facility_map[clean] = place_id_to_facility_id[place_id]
            dedup_reused += 1
            continue

        facility_id = str(uuid.uuid4())
        created["facility_id"] = facility_id
        place_id_to_facility_id[place_id] = facility_id
        new_facilities.append(created)
        facility_map[clean] = facility_id

    matched = len(facility_map) - len(new_facilities) - dedup_reused

    succeeded_ids = insert_new_facilities(url, headers, new_facilities)
    failed_ids = {f["facility_id"] for f in new_facilities} - succeeded_ids
    if failed_ids:
        facility_map = {k: v for k, v in facility_map.items() if v not in failed_ids}
        log.warning("Dropped %d scraped name(s) mapped to facilities that failed to persist", len(failed_ids))

    log.info(
        "Mapping: %d matched, %d newly created, %d dedup-reused, %d unmatched (threshold=%d)",
        matched, len(succeeded_ids), dedup_reused, len(unmatched), FUZZY_THRESHOLD,
    )
    for name in unmatched:
        log.warning("No DB match for scraped hospital: '%s'", name)

    return facility_map


# ── Step 4: consolidate ───────────────────────────────────────────────────────

def consolidate(
    erstat_data: dict[str, dict],
    hlwiw_data: dict[str, dict],
    facility_map: dict[str, str],
) -> list[dict]:
    """
    Merges both sources into one record per matched facility.
    - When both have wait_minutes: averages them.
    - Unmatched scraped names are skipped.
    Returns upsert-ready dicts for the `wait_times` table.
    """
    all_clean_names: set[str] = set(erstat_data.keys()) | set(hlwiw_data.keys())
    scraped_at = datetime.now(timezone.utc).isoformat()
    records: list[dict] = []

    for clean in all_clean_names:
        facility_id = facility_map.get(clean)
        if not facility_id:
            continue  # already logged as warning in build_facility_map

        er = erstat_data.get(clean, {})
        hw = hlwiw_data.get(clean, {})
        er_mins = er.get("wait_minutes")
        hw_mins = hw.get("wait_minutes")

        if er_mins is not None and hw_mins is not None:
            wait_minutes = round((er_mins + hw_mins) / 2)
            raw_wait = f"erstat:{er['raw_wait']} / hlwiw:{hw['raw_wait']}"
            source = "erstat+howlongwilliwait"
        elif er_mins is not None:
            wait_minutes = er_mins
            raw_wait = er["raw_wait"]
            source = "erstat"
        elif hw_mins is not None:
            wait_minutes = hw_mins
            raw_wait = hw["raw_wait"]
            source = "howlongwilliwait"
        else:
            wait_minutes = None
            raw_wait = er.get("raw_wait") or hw.get("raw_wait")
            source = "+".join(filter(None, ["erstat" if er else "", "howlongwilliwait" if hw else ""]))

        records.append({
            "facility_id": facility_id,
            "wait_minutes": wait_minutes,
            "raw_wait": raw_wait,
            "source": source,
            "scraped_at": scraped_at,
        })

    records = _merge_duplicate_facilities(records)
    log.info("Consolidated: %d records ready for publish", len(records))
    return records


def _merge_duplicate_facilities(records: list[dict]) -> list[dict]:
    """
    Differently-normalised name variants (e.g. ERstat vs HowLongWillIWait
    spelling) can independently fuzzy-match to the same facility_id within
    one run. wait_times has a unique (facility_id, scraped_at) index, so
    collapse those into a single row before insert — same averaging
    approach as the per-source merge above.
    """
    by_facility: dict[str, list[dict]] = {}
    for r in records:
        by_facility.setdefault(r["facility_id"], []).append(r)

    merged: list[dict] = []
    for facility_id, group in by_facility.items():
        if len(group) == 1:
            merged.append(group[0])
            continue
        mins = [g["wait_minutes"] for g in group if g["wait_minutes"] is not None]
        merged.append({
            "facility_id": facility_id,
            "wait_minutes": round(sum(mins) / len(mins)) if mins else None,
            "raw_wait": " / ".join(g["raw_wait"] for g in group if g["raw_wait"]),
            "source": "+".join(dict.fromkeys(g["source"] for g in group if g["source"])),
            "scraped_at": group[0]["scraped_at"],
        })
    return merged


# ── Step 5: Supabase insert ───────────────────────────────────────────────────

def insert_wait_times(url: str, headers: dict, records: list[dict]) -> None:
    """
    wait_times is an append-only history log (autoincrement id, recorded_at
    default now()) — one new row per facility per scrape run, not a
    current-value table. The current value lives in Redis (see update_redis).

    wait_minutes is NOT NULL in this table; records with no parseable time
    from either source (wait_minutes is None) carry no useful history-log
    value and are skipped here, though they still reach Redis as "no data".
    """
    skipped = [r["facility_id"] for r in records if r["wait_minutes"] is None]
    records = [r for r in records if r["wait_minutes"] is not None]
    if skipped:
        log.info("Skipping %d record(s) with no parsed wait time: %s", len(skipped), skipped)

    if not records:
        log.info("Nothing to insert.")
        return
    endpoint = f"{url}/rest/v1/wait_times"
    r = requests.post(endpoint, headers=headers, json=records, timeout=10)
    r.raise_for_status()
    log.info("Supabase: inserted %d rows into wait_times", len(records))


# ── Step 6: Redis update ──────────────────────────────────────────────────────

def update_redis(r: redis.Redis, records: list[dict]) -> None:
    """
    Redis Hash layout:
      Key:   wait_times:current
      Field: <facility_uuid>
      Value: JSON {"wait_minutes": int|null, "raw_wait": str, "source": str, "updated_at": ISO8601}

    Full hash retrievable in O(1) via HGETALL.
    Per-facility lookup via HGET wait_times:current <uuid>.
    """
    if not records:
        return
    pipe = r.pipeline()
    for rec in records:
        pipe.hset(
            REDIS_HASH_KEY,
            rec["facility_id"],
            json.dumps({
                "wait_minutes": rec["wait_minutes"],
                "raw_wait": rec["raw_wait"],
                "source": rec["source"],
                "updated_at": rec["scraped_at"],
            }),
        )
    pipe.execute()
    log.info("Redis: updated %d fields in '%s'", len(records), REDIS_HASH_KEY)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    log.info("═══ Scraper run started ═══")

    redis_client = redis.from_url(UPSTASH_REDIS_URL, decode_responses=True)

    # 1. Fetch DB facilities (fuzzy match corpus)
    db_corpus = fetch_db_facilities(SUPABASE_URL, SUPABASE_HEADERS)

    # 2. Scrape both sources
    erstat_data = scrape_erstat()
    hlwiw_data = scrape_howlongwilliwait()

    if not erstat_data and not hlwiw_data:
        log.error("Both scrapers returned empty — aborting run.")
        sys.exit(1)

    # 3. Build name → uuid mapping via fuzzy match (creates new Toronto facilities on the fly)
    facility_map = build_facility_map(erstat_data, hlwiw_data, db_corpus, SUPABASE_URL, SUPABASE_HEADERS, redis_client)

    # 4. Consolidate into one record per facility
    records = consolidate(erstat_data, hlwiw_data, facility_map)

    # 5. Publish
    insert_wait_times(SUPABASE_URL, SUPABASE_HEADERS, records)
    update_redis(redis_client, records)

    log.info("═══ Scraper run complete — %d records published ═══", len(records))


if __name__ == "__main__":
    main()