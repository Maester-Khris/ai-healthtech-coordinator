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

REDIS_HASH_KEY = "wait_times:current"
FUZZY_THRESHOLD = 75  # minimum match score (0–100) to accept a facility link

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


# ── Step 3: fuzzy match scraped names → facility UUIDs ───────────────────────

def build_facility_map(
    erstat_data: dict[str, dict],
    hlwiw_data: dict[str, dict],
    db_corpus: dict[str, str],  # {clean_db_name: uuid}
) -> dict[str, str]:
    """
    Fuzzy-matches all scraped clean names against the DB corpus.
    Returns {clean_scraped_name: facility_uuid}.
    Logs unmatched names as warnings.
    """
    all_scraped_names: set[str] = set(erstat_data.keys()) | set(hlwiw_data.keys())
    corpus_keys = list(db_corpus.keys())
    facility_map: dict[str, str] = {}
    unmatched: list[str] = []

    for clean in all_scraped_names:
        result = fuzz_process.extractOne(clean, corpus_keys, score_cutoff=FUZZY_THRESHOLD)
        if result:
            best_key, score, *_ = result
            facility_map[clean] = db_corpus[best_key]
        else:
            official = (
                erstat_data.get(clean, {}).get("official_name")
                or hlwiw_data.get(clean, {}).get("hlwiw_name")
                or clean
            )
            unmatched.append(official)

    log.info(
        "Mapping: %d matched, %d unmatched (threshold=%d)",
        len(facility_map), len(unmatched), FUZZY_THRESHOLD,
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

    log.info("Consolidated: %d records ready for publish", len(records))
    return records


# ── Step 5: Supabase upsert ───────────────────────────────────────────────────

def upsert_wait_times(url: str, headers: dict, records: list[dict]) -> None:
    if not records:
        log.info("Nothing to upsert.")
        return
    endpoint = f"{url}/rest/v1/wait_times?on_conflict=facility_id"
    upsert_headers = {**headers, "Prefer": "resolution=merge-duplicates"}
    r = requests.post(endpoint, headers=upsert_headers, json=records, timeout=10)
    r.raise_for_status()
    log.info("Supabase: upserted %d rows into wait_times", len(records))


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

    # 3. Build name → uuid mapping via fuzzy match
    facility_map = build_facility_map(erstat_data, hlwiw_data, db_corpus)

    # 4. Consolidate into one record per facility
    records = consolidate(erstat_data, hlwiw_data, facility_map)

    # 5. Publish
    upsert_wait_times(SUPABASE_URL, SUPABASE_HEADERS, records)
    update_redis(redis_client, records)

    log.info("═══ Scraper run complete — %d records published ═══", len(records))


if __name__ == "__main__":
    main()