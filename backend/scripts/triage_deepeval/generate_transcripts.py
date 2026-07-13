"""
Phase B, stage 1: authenticates as disposable eval-project test accounts
(created by scripts/eval_seed/create_eval_test_accounts.py) and drives real
/chat/sessions + /chat/message calls against the eval-project preview backend
with synthetic emergent-sounding symptom messages. Saves each conversation's
response and recommended facility for stage 2's offline DeepEval pass.

Never targets main or real user data — eval Supabase project + preview
backend only.

Invocation:
    doppler run --config eval -- python scripts/triage_deepeval/generate_transcripts.py --count 20
"""
import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from db import SUPABASE_URL, SUPABASE_KEY  # noqa: E402
from scripts.triage_deepeval.symptom_scenarios import SYMPTOM_SCENARIOS  # noqa: E402

logger = logging.getLogger(__name__)

ACCOUNTS_PATH = os.path.join(
    os.path.dirname(__file__), "..", "eval_seed", "eval_test_accounts.json"
)
TRANSCRIPTS_DIR = os.path.join(os.path.dirname(__file__), "transcripts")


def load_accounts() -> list[dict]:
    with open(ACCOUNTS_PATH) as f:
        return json.load(f)


def login(email: str, password: str) -> str:
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def create_session(base_url: str, token: str, first_message: str) -> str:
    resp = requests.post(
        f"{base_url}/chat/sessions",
        headers={"Authorization": f"Bearer {token}"},
        json={"first_message": first_message},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["id"]


def send_message(base_url: str, token: str, session_id: str, scenario: dict) -> dict:
    resp = requests.post(
        f"{base_url}/chat/message",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "session_id": session_id,
            "content": scenario["message"],
            "lat": scenario["lat"],
            "lng": scenario["lng"],
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def build_transcript_row(scenario: dict, chat_response: dict) -> dict:
    triage = chat_response.get("triage")
    return {
        "message": scenario["message"],
        "response_text": chat_response["assistant_message"]["content"],
        "severity": triage["severity"] if triage else None,
        "recommended_facility": triage["recommended_facility"] if triage else None,
    }


def run(count: int, base_url: str) -> list[dict]:
    accounts = load_accounts()
    if not accounts:
        raise RuntimeError(
            f"No eval test accounts found at {ACCOUNTS_PATH} — run "
            "create_eval_test_accounts.py first."
        )

    transcripts: list[dict] = []
    for i in range(count):
        scenario = SYMPTOM_SCENARIOS[i % len(SYMPTOM_SCENARIOS)]
        account = accounts[i % len(accounts)]

        token = login(account["email"], account["password"])
        session_id = create_session(base_url, token, scenario["message"])
        chat_response = send_message(base_url, token, session_id, scenario)
        transcripts.append(build_transcript_row(scenario, chat_response))

        logger.info(
            "transcript_generated",
            extra={"index": i, "severity": transcripts[-1]["severity"]},
        )
        # ponytail: fixed pause, not adaptive backoff — Groq/Geoapify are both
        # free-tier per the Sprint 17 discussion notes; a flat pause keeps this
        # single-thread run well under either rate limit without new logic.
        time.sleep(1)

    return transcripts


def write_transcripts(transcripts: list[dict]) -> str:
    os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(TRANSCRIPTS_DIR, f"transcripts_{stamp}.json")
    with open(path, "w") as f:
        json.dump(transcripts, f, indent=2)
    return path


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("EVAL_API_BASE_URL"),
        help="Eval-project preview backend base URL (or set EVAL_API_BASE_URL)",
    )
    args = parser.parse_args()

    if not args.base_url:
        raise SystemExit("--base-url or EVAL_API_BASE_URL env var is required")

    transcripts = run(args.count, args.base_url)
    path = write_transcripts(transcripts)
    print(f"{len(transcripts)} transcripts written to {path}")


if __name__ == "__main__":
    main()
