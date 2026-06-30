import os
import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].strip()
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip()

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def supabase_select(table: str, params: dict, single: bool = False) -> list[dict] | dict | None:
    headers = dict(HEADERS)
    if single:
        headers["Accept"] = "application/vnd.pgrst.object+json"

    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, params=params, timeout=10)

    if single and r.status_code in (404, 406):
        return None

    r.raise_for_status()
    return r.json()


def supabase_insert(table: str, rows: list[dict]) -> list[dict]:
    headers = dict(HEADERS)
    headers["Prefer"] = "return=representation"

    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, json=rows, timeout=10)
    r.raise_for_status()
    return r.json()


def supabase_rpc(fn_name: str, payload: dict) -> list[dict]:
    r = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/{fn_name}", headers=HEADERS, json=payload, timeout=10)
    r.raise_for_status()
    return r.json()


def supabase_auth_get_user(token: str) -> dict:
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}",
    }
    r = requests.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()
