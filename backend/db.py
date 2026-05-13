import os
from supabase import create_client, Client


def get_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url:
        raise RuntimeError("SUPABASE_URL environment variable is not set")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY environment variable is not set")

    return create_client(url, key)
