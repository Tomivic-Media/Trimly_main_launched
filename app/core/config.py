import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
env_path = BASE_DIR / ".env"

load_dotenv(dotenv_path=env_path)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "trimly123")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
PAYSTACK_PUBLIC_KEY = os.getenv("PAYSTACK_PUBLIC_KEY", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "")
DEFAULT_PASSWORD_RESET_URL = "https://trimly.com.ng/static/reset-password.html"


def _normalize_password_reset_url(raw_value: str) -> str:
    value = str(raw_value or "").strip()
    if not value:
        return DEFAULT_PASSWORD_RESET_URL

    if value in {
        "http://localhost:3000/reset-password",
        "http://localhost:5173/reset-password",
        "/reset-password",
        "reset-password",
    }:
        return DEFAULT_PASSWORD_RESET_URL

    try:
        parsed = urlparse(value)
    except Exception:
        return DEFAULT_PASSWORD_RESET_URL

    if not parsed.scheme or not parsed.netloc:
        return DEFAULT_PASSWORD_RESET_URL

    hostname = str(parsed.hostname or "").lower()
    if hostname in {"trimly.com.ng", "www.trimly.com.ng", "app.trimly.com.ng", "api.trimly.com.ng"}:
        return DEFAULT_PASSWORD_RESET_URL

    return value


PASSWORD_RESET_URL = _normalize_password_reset_url(
    os.getenv("PASSWORD_RESET_URL", DEFAULT_PASSWORD_RESET_URL)
)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ADMIN_SESSION_COOKIE_NAME = os.getenv("ADMIN_SESSION_COOKIE_NAME", "trimly_admin_session")
BOOTSTRAP_SUPER_ADMIN_EMAIL = os.getenv("BOOTSTRAP_SUPER_ADMIN_EMAIL", "")
BOOTSTRAP_SUPER_ADMIN_PASSWORD = os.getenv("BOOTSTRAP_SUPER_ADMIN_PASSWORD", "")
BOOTSTRAP_SUPER_ADMIN_NAME = os.getenv("BOOTSTRAP_SUPER_ADMIN_NAME", "Trimly Super Admin")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


BOOKINGS_REQUIRE_BARBER_APPROVAL = _env_bool("BOOKINGS_REQUIRE_BARBER_APPROVAL", False)
