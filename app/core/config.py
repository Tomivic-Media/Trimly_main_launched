import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
env_path = BASE_DIR / ".env"

load_dotenv(dotenv_path=env_path)

DEFAULT_JWT_SECRET = "trimly123"
DEFAULT_PASSWORD_RESET_URL = "https://trimly.com.ng/static/reset-password.html"


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _env_csv(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name, "")
    if not raw.strip():
        return list(default)
    return [item.strip() for item in raw.split(",") if item.strip()]


APP_ENV = (
    os.getenv("APP_ENV")
    or os.getenv("ENVIRONMENT")
    or os.getenv("RAILWAY_ENVIRONMENT_NAME")
    or "development"
).strip().lower()
IS_PRODUCTION = APP_ENV in {"production", "prod", "live"}

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", DEFAULT_JWT_SECRET)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
PAYSTACK_PUBLIC_KEY = os.getenv("PAYSTACK_PUBLIC_KEY", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "")


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
PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "https://api.trimly.com.ng").rstrip("/")
ADMIN_SESSION_COOKIE_NAME = os.getenv("ADMIN_SESSION_COOKIE_NAME", "trimly_admin_session")
USER_SESSION_COOKIE_NAME = os.getenv("USER_SESSION_COOKIE_NAME", "trimly_session")
SESSION_COOKIE_SECURE = _env_bool("SESSION_COOKIE_SECURE", IS_PRODUCTION)
SESSION_COOKIE_SAMESITE = os.getenv(
    "SESSION_COOKIE_SAMESITE",
    "strict" if IS_PRODUCTION else "lax",
).strip().lower()
if SESSION_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    SESSION_COOKIE_SAMESITE = "strict" if IS_PRODUCTION else "lax"
ADMIN_SESSION_COOKIE_MAX_AGE = ACCESS_TOKEN_EXPIRE_MINUTES * 60
USER_SESSION_COOKIE_MAX_AGE = ACCESS_TOKEN_EXPIRE_MINUTES * 60
PASSWORD_MIN_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "10"))
EMAIL_VERIFICATION_REQUIRED = _env_bool("EMAIL_VERIFICATION_REQUIRED", IS_PRODUCTION)
EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS = int(os.getenv("EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS", "24"))
BOOTSTRAP_SUPER_ADMIN_EMAIL = os.getenv("BOOTSTRAP_SUPER_ADMIN_EMAIL", "")
BOOTSTRAP_SUPER_ADMIN_PASSWORD = os.getenv("BOOTSTRAP_SUPER_ADMIN_PASSWORD", "")
BOOTSTRAP_SUPER_ADMIN_NAME = os.getenv("BOOTSTRAP_SUPER_ADMIN_NAME", "Trimly Super Admin")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")
ALLOWED_CORS_ORIGINS = _env_csv(
    "ALLOWED_CORS_ORIGINS",
    [
        "https://trimly.com.ng",
        "https://www.trimly.com.ng",
        "https://app.trimly.com.ng",
        "https://api.trimly.com.ng",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
        "http://localhost:8002",
        "http://127.0.0.1:8002",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
)
ALLOWED_CORS_ORIGIN_REGEX = os.getenv(
    "ALLOWED_CORS_ORIGIN_REGEX",
    r"https://.*\.vercel\.app" if not IS_PRODUCTION else "",
).strip()
TRUSTED_HOSTS = _env_csv(
    "TRUSTED_HOSTS",
    [
        "trimly.com.ng",
        "www.trimly.com.ng",
        "app.trimly.com.ng",
        "api.trimly.com.ng",
        "localhost",
        "127.0.0.1",
        "*.railway.app",
        "*.up.railway.app",
    ],
)
DEBUG_SECURITY_ENDPOINTS_ENABLED = _env_bool(
    "DEBUG_SECURITY_ENDPOINTS_ENABLED",
    not IS_PRODUCTION,
)
ENFORCE_STRONG_JWT_SECRET = _env_bool("ENFORCE_STRONG_JWT_SECRET", IS_PRODUCTION)
EMAIL_VERIFICATION_SUCCESS_URL = os.getenv(
    "EMAIL_VERIFICATION_SUCCESS_URL",
    "https://trimly.com.ng/static/login.html?verified=1",
).strip()
EMAIL_VERIFICATION_FAILURE_URL = os.getenv(
    "EMAIL_VERIFICATION_FAILURE_URL",
    "https://trimly.com.ng/static/login.html?verification_error=1",
).strip()


BOOKINGS_REQUIRE_BARBER_APPROVAL = _env_bool("BOOKINGS_REQUIRE_BARBER_APPROVAL", False)


def has_strong_jwt_secret() -> bool:
    value = str(JWT_SECRET_KEY or "")
    if value == DEFAULT_JWT_SECRET:
        return False
    return len(value) >= 32


SECURITY_CONFIGURATION_WARNINGS: list[str] = []
if not has_strong_jwt_secret():
    if ENFORCE_STRONG_JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET_KEY is weak or using the default value. Set a strong random secret before starting production."
        )
    SECURITY_CONFIGURATION_WARNINGS.append(
        "JWT_SECRET_KEY is weak or using the default value. Set a long random secret in the environment."
    )
