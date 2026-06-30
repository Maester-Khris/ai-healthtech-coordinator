import types
from fastapi import HTTPException

from db import supabase_auth_get_user


def verify_token(token: str) -> object:
    """
    Verify a Supabase JWT and return a user object exposing .id and .email.
    Raises HTTPException 401 if the token is invalid, expired, or unverifiable.
    """
    try:
        data = supabase_auth_get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token verification failed") from exc

    if not data.get("id"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return types.SimpleNamespace(id=data["id"], email=data.get("email"))
