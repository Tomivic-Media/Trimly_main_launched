import logging
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)

_LOCK = threading.Lock()
_REQUEST_WINDOWS: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request | None) -> str:
    if request is None:
        return "unknown"
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded_for:
        return forwarded_for
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def enforce_rate_limit(
    request: Request | None,
    *,
    action: str,
    limit: int,
    window_seconds: int,
    subject: str | None = None,
) -> None:
    identifier = subject.strip().lower() if subject else _client_ip(request)
    key = f"{action}:{identifier}"
    now = time.time()

    with _LOCK:
        window = _REQUEST_WINDOWS[key]
        while window and (now - window[0]) >= window_seconds:
            window.popleft()

        if len(window) >= limit:
            logger.warning(
                "Rate limit exceeded for action=%s identifier=%s ip=%s",
                action,
                identifier,
                _client_ip(request),
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait a moment and try again.",
            )

        window.append(now)
