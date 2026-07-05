import logging

from fastapi import Header, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from services.auth import verify_token

logger = logging.getLogger(__name__)


async def get_current_user(authorization: str = Header(...)) -> object:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or malformed Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    return verify_token(token)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        request.state.user_id = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.removeprefix("Bearer ").strip()
            try:
                user = verify_token(token)
                request.state.user_id = user.id
            except HTTPException as exc:
                if exc.status_code != 401:
                    # Raising here would escape FastAPI's exception handling:
                    # ExceptionMiddleware sits inside user middleware in the
                    # Starlette stack, so a raise from dispatch() surfaces as
                    # a raw 500 instead of the intended status code.
                    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
                logger.warning(
                    "auth_token_invalid",
                    extra={"path": request.url.path},
                )
        return await call_next(request)
