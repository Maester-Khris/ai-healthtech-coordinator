"""
Conftest for eval_seed tests.

db.py reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY at import time.
Set stub values so the module can be imported during test collection;
the actual HTTP calls are always patched in each test via unittest.mock.
"""
import os

os.environ.setdefault("SUPABASE_URL", "https://stub.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "stub-key")
