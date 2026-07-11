"""
Creates disposable, pre-confirmed test accounts directly in the eval
Supabase project via GoTrue's admin endpoint (bypasses email
verification — fine for a throwaway eval project only). Never reads or
copies any account from preview/prod. Intended invocation:

    doppler run --config eval -- python scripts/eval_seed/create_eval_test_accounts.py --count 5

Writes credentials to eval_test_accounts.json (gitignored) for Phase B's
load scripts to authenticate with.
"""
import argparse
import json
import logging
import os
import secrets
import sys

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from db import SUPABASE_URL, HEADERS  # noqa: E402

logger = logging.getLogger(__name__)

ACCOUNTS_PATH = os.path.join(os.path.dirname(__file__), "eval_test_accounts.json")


def generate_test_email(index: int) -> str:
    return f"eval-test-{index}@medicoord-eval.test"


def create_test_account(email: str, password: str) -> dict:
    payload = {"email": email, "password": password, "email_confirm": True}

    resp = requests.post(f"{SUPABASE_URL}/auth/v1/admin/users", headers=HEADERS, json=payload, timeout=10)
    resp.raise_for_status()
    user = resp.json()

    return {"id": user["id"], "email": email, "password": password}


def write_accounts(accounts: list[dict], filename: str) -> str:
    with open(filename, "w") as f:
        json.dump(accounts, f, indent=2)
    return filename


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=5)
    args = parser.parse_args()

    accounts = []
    for i in range(args.count):
        email = generate_test_email(i)
        password = secrets.token_urlsafe(16)
        try:
            account = create_test_account(email, password)
        except requests.HTTPError as exc:
            # ponytail: skip-and-continue, not retry/resume — re-running with the
            # same --count after a partial failure just skips already-existing
            # indices again; delete them in the Supabase dashboard to recreate.
            logger.warning("account_creation_failed", extra={"email": email, "error": str(exc)})
            continue
        logger.info("created_test_account", extra={"email": email})
        accounts.append(account)

    path = write_accounts(accounts, ACCOUNTS_PATH)
    print(f"{len(accounts)}/{args.count} test accounts written to {path}")


if __name__ == "__main__":
    main()
