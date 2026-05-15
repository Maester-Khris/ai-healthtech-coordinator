from backend.db import get_supabase_client
from fastapi import HTTPException


def verify_token(token: str) -> object:
    """
    Verify a Supabase JWT and return the user object.
    Raises HTTPException 401 if the token is invalid or expired.
    """
    try:
        client = get_supabase_client()
        response = client.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return response.user
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token verification failed") from exc
