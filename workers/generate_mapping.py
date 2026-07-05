"""
generate_mapping.py — One-off script.

Fetches facility names from Supabase `facilities_clean`, scrapes ERstat and
HowLongWillIWait, runs fuzzy matching, and writes `scraper_facility_map.json`.

Run once. Commit the generated map. Re-run only when source sites add new hospitals.

Requirements:
    pip install requests beautifulsoup4 thefuzz python-Levenshtein supabase

Env vars (set via Doppler or .env):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

import json
import os
import sys
from thefuzz import process as fuzz_process
from supabase import create_client, Client

# Import scrapers from same package
from scraper import scrape_erstat, scrape_howlongwilliwait, clean_hospital_name

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# Minimum fuzzy match score (0–100). Below this → unmatched, logged for review.
FUZZY_THRESHOLD = 75

OUTPUT_FILE = "scraper_facility_map.json"


# ── Helpers ───────────────────────────────────────────────────────────────────

def fetch_db_facilities(client: Client) -> list[dict]:
    """Returns list of {id, name, clean_name} from facilities_clean."""
    response = (
        client.table("facilities_clean")
        .select("id, facility_name")
        .execute()
    )
    facilities = []
    for row in response.data:
        facilities.append({
            "id": row["id"],
            "name": row["facility_name"],
            "clean_name": clean_hospital_name(row["facility_name"]),
        })
    return facilities


def build_match_candidates(facilities: list[dict]) -> dict[str, str]:
    """Returns {clean_name: uuid} lookup for fuzzy target corpus."""
    return {f["clean_name"]: f["id"] for f in facilities if f["clean_name"]}


def fuzzy_match_sources(
    scraped_names: dict[str, str],  # {clean_scraped_name: original_name}
    candidates: dict[str, str],     # {clean_db_name: uuid}
    threshold: int,
) -> tuple[dict[str, str], list[dict]]:
    """
    Fuzzy-matches scraped clean names against DB clean names.

    Returns:
        mapping   — {clean_scraped_name: uuid}   (above threshold)
        unmatched — [{scraped, best_match, score}] (below threshold)
    """
    corpus = list(candidates.keys())
    mapping: dict[str, str] = {}
    unmatched: list[dict] = []

    for clean_scraped, original in scraped_names.items():
        result = fuzz_process.extractOne(clean_scraped, corpus, score_cutoff=threshold)
        if result:
            best_match, score, *_ = result
            uuid = candidates[best_match]
            mapping[clean_scraped] = uuid
            print(f"  ✓  [{score:3d}]  '{original}'  →  '{best_match}'  ({uuid})")
        else:
            # Get best attempt for logging even if below threshold
            best_attempt = fuzz_process.extractOne(clean_scraped, corpus)
            best_str = f"{best_attempt[0]} ({best_attempt[1]})" if best_attempt else "n/a"
            unmatched.append({
                "scraped": original,
                "clean_scraped": clean_scraped,
                "best_attempt": best_str,
            })
            print(f"  ✗  UNMATCHED  '{original}'  (best: {best_str})")

    return mapping, unmatched


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("Connecting to Supabase…")
    client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("Fetching DB facilities…")
    facilities = fetch_db_facilities(client)
    candidates = build_match_candidates(facilities)
    print(f"  {len(candidates)} facilities loaded from DB.\n")

    print("Scraping ERstat…")
    erstat_data = scrape_erstat()
    erstat_names = {k: v["official_name"] for k, v in erstat_data.items()}
    print(f"  {len(erstat_names)} hospitals from ERstat.\n")

    print("Scraping HowLongWillIWait…")
    hlwiw_data = scrape_howlongwilliwait()
    hlwiw_names = {k: v["hlwiw_name"] for k, v in hlwiw_data.items()}
    print(f"  {len(hlwiw_names)} hospitals from HowLongWillIWait.\n")

    # Combine both source name sets (union)
    all_scraped: dict[str, str] = {}
    all_scraped.update(erstat_names)
    # HLWIW may have same clean name with different original — keep ERstat wins
    for clean, orig in hlwiw_names.items():
        if clean not in all_scraped:
            all_scraped[clean] = orig

    print(f"Total unique scraped names to match: {len(all_scraped)}\n")
    print("Fuzzy matching…")
    mapping, unmatched = fuzzy_match_sources(all_scraped, candidates, FUZZY_THRESHOLD)

    print(f"\n{'─' * 60}")
    print(f"Matched:   {len(mapping)}")
    print(f"Unmatched: {len(unmatched)}")

    if unmatched:
        print("\nUnmatched entries (add manually or lower FUZZY_THRESHOLD):")
        for u in unmatched:
            print(f"  - '{u['scraped']}'  best: {u['best_attempt']}")

    # Write mapping file
    with open(OUTPUT_FILE, "w") as f:
        json.dump(mapping, f, indent=2, sort_keys=True)

    print(f"\nMapping written to {OUTPUT_FILE}")

    # Non-zero exit if any unmatched so CI can flag it
    if unmatched:
        sys.exit(1)


if __name__ == "__main__":
    main()
