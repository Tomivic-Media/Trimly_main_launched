import os
from pathlib import Path

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
PASSWORD_RESET_URL = os.getenv("PASSWORD_RESET_URL", "http://localhost:3000/reset-password")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ADMIN_SESSION_COOKIE_NAME = os.getenv("ADMIN_SESSION_COOKIE_NAME", "trimly_admin_session")
BOOTSTRAP_SUPER_ADMIN_EMAIL = os.getenv("BOOTSTRAP_SUPER_ADMIN_EMAIL", "")
BOOTSTRAP_SUPER_ADMIN_PASSWORD = os.getenv("BOOTSTRAP_SUPER_ADMIN_PASSWORD", "")
BOOTSTRAP_SUPER_ADMIN_NAME = os.getenv("BOOTSTRAP_SUPER_ADMIN_NAME", "Trimly Super Admin")
