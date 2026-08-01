from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from jose import jwt

from app.core.config import (
    XEELAA_EMBED_SHARE_EMAIL,
    XEELAA_EMBED_SIGNING_SECRET,
    XEELAA_EMBED_TOKEN_TTL_SECONDS,
    XEELAA_PUBLIC_TOKEN,
    XEELAA_WIDGET_BASE_URL,
)
from app.core.security import ALGORITHM
from app.models.user import User

XEELAA_EMBED_AUDIENCE = "xeelaa-embed"
XEELAA_EMBED_ISSUER = "trimly"
XEELAA_EMBED_SCOPE = "widget:embed"


def is_xeelaa_embed_configured() -> bool:
    return bool(XEELAA_PUBLIC_TOKEN and XEELAA_EMBED_SIGNING_SECRET)


def _effective_embed_ttl_seconds() -> int:
    # Keep the token short-lived even if the environment value is misconfigured.
    return max(60, min(int(XEELAA_EMBED_TOKEN_TTL_SECONDS or 300), 900))


def _widget_script_url() -> str:
    return f"{XEELAA_WIDGET_BASE_URL}/widget.js?key={XEELAA_PUBLIC_TOKEN}"


def _normalized_role(user: User) -> str:
    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    return str(role_value or "").strip().lower()


def build_xeelaa_embed_token(user: User) -> tuple[str, int]:
    ttl_seconds = _effective_embed_ttl_seconds()
    issued_at = datetime.utcnow()
    expires_at = issued_at + timedelta(seconds=ttl_seconds)

    payload = {
        "iss": XEELAA_EMBED_ISSUER,
        "aud": XEELAA_EMBED_AUDIENCE,
        "sub": str(user.id),
        "iat": issued_at,
        "exp": expires_at,
        "jti": secrets.token_urlsafe(12),
        "scope": XEELAA_EMBED_SCOPE,
        "platform": "trimly",
        "name": str(user.full_name or "").strip(),
        "role": _normalized_role(user),
    }
    if XEELAA_EMBED_SHARE_EMAIL:
        payload["email"] = str(user.email or "").strip()

    return jwt.encode(payload, XEELAA_EMBED_SIGNING_SECRET, algorithm=ALGORITHM), ttl_seconds


def build_xeelaa_embed_payload(user: User) -> dict:
    embed_token, ttl_seconds = build_xeelaa_embed_token(user)
    role_value = _normalized_role(user)
    user_payload = {
        "id": str(user.id),
        "name": str(user.full_name or "").strip() or None,
        "role": role_value or None,
    }
    if XEELAA_EMBED_SHARE_EMAIL:
        user_payload["email"] = str(user.email or "").strip() or None

    return {
        "enabled": True,
        "provider": "xeelaa",
        "base_url": XEELAA_WIDGET_BASE_URL,
        "public_token": XEELAA_PUBLIC_TOKEN,
        "widget_script_url": _widget_script_url(),
        "embed_token": embed_token,
        "expires_in_seconds": ttl_seconds,
        "user": user_payload,
    }
