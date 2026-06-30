import types
import requests
from fastapi import HTTPException

from db import supabase_auth_get_user


def verify_token(token: str) -> object:
    """
    Verify a Supabase JWT and return a user object exposing .id and .email.
    Raises HTTPException 401 if Supabase says the token is invalid/expired,
    or 503 if Supabase itself is unreachable/erroring (distinct failure
    modes — a 503 means "try again," a 401 means "log in again").
    """
    try:
        data = supabase_auth_get_user(token)
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 503
        if status == 401:
            raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
        raise HTTPException(status_code=503, detail="Auth service unavailable") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=503, detail="Auth service unavailable") from exc

    if not data.get("id"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return types.SimpleNamespace(id=data["id"], email=data.get("email"))
