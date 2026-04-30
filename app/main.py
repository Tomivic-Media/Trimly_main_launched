from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text

from app.core.config import (
    BOOTSTRAP_SUPER_ADMIN_EMAIL,
    BOOTSTRAP_SUPER_ADMIN_NAME,
    BOOTSTRAP_SUPER_ADMIN_PASSWORD,
    BOOKINGS_REQUIRE_BARBER_APPROVAL,
)
from app.core.security import get_admin_user_from_cookie, hash_password
from app.db.session import Base, engine
from app.db.session import SessionLocal

# Import models so SQLAlchemy registers tables
from app.models import barber, barber_kyc, barber_service, booking, booking_service, chat, dispute, notification, review, user, user_session, wallet
from app.models.user import User, UserRole

# Import routers
from app.routes import auth
from app.routes import account as account_routes
from app.routes import barber as barber_routes
from app.routes import booking as booking_routes
from app.routes import chat as chat_routes
from app.routes import dispute as dispute_routes
from app.routes import notification as notification_routes
from app.routes import payment
from app.routes import policy as policy_routes
from app.routes import review as review_routes

load_dotenv()

app = FastAPI()
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
PROJECT_STATIC_DIR = BASE_DIR / "STATIC"
PROTECTED_FRONTEND_DIR = BASE_DIR / "protected_frontend"


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://trimly.com.ng",
        "https://www.trimly.com.ng",
        "https://app.trimly.com.ng",
        "https://api.trimly.com.ng",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HtmlNoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path.lower()
        content_type = (response.headers.get("content-type") or "").lower()
        is_html_request = (
            path == "/"
            or path == "/admin"
            or path.endswith(".html")
            or "text/html" in content_type
        )
        if is_html_request:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


app.add_middleware(HtmlNoCacheMiddleware)


def ensure_runtime_schema() -> None:
    """Apply lightweight, idempotent schema patches for existing databases."""
    statements = [
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_name VARCHAR",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_mode VARCHAR",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_address_line VARCHAR",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_address_area VARCHAR",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_address_landmark VARCHAR",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_address_note VARCHAR",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS barber_shop_address VARCHAR",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS barber_shop_landmark VARCHAR",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_reference VARCHAR",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20)",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_due_at TIMESTAMP",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_reminder_count INTEGER DEFAULT 0",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payout_status VARCHAR(64)",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transfer_reference VARCHAR",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMP",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS barber_payout_amount DOUBLE PRECISION",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS escrow_amount DOUBLE PRECISION",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS escrow_released BOOLEAN DEFAULT FALSE",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_requested BOOLEAN DEFAULT FALSE",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_reminder_sent_at TIMESTAMP",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS barber_reminder_sent_at TIMESTAMP",
        "ALTER TABLE bookings ALTER COLUMN payment_status SET DEFAULT 'unpaid'",
        "ALTER TABLE bookings ALTER COLUMN payout_status TYPE VARCHAR(64)",
        "ALTER TABLE bookings ALTER COLUMN payout_status SET DEFAULT 'pending'",
        "UPDATE bookings SET service_name = 'Haircut' WHERE service_name IS NULL",
        "UPDATE bookings SET payment_status = 'unpaid' WHERE payment_status IS NULL",
        "UPDATE bookings SET payment_reminder_count = 0 WHERE payment_reminder_count IS NULL",
        "UPDATE bookings SET payout_status = 'pending' WHERE payout_status IS NULL",
        "UPDATE bookings SET escrow_released = FALSE WHERE escrow_released IS NULL",
        "UPDATE bookings SET refund_requested = FALSE WHERE refund_requested IS NULL",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS beard_trim_price DOUBLE PRECISION",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS other_services VARCHAR",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS barber_name VARCHAR",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS shop_address VARCHAR",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS shop_landmark VARCHAR",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS portfolio_image_urls VARCHAR",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS transfer_recipient_code VARCHAR",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS paystack_subaccount_code VARCHAR",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS available_days VARCHAR",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS available_start_time TIME",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS available_end_time TIME",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS is_available BOOLEAN",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS kyc_status VARCHAR DEFAULT 'pending'",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMP",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR",
        "ALTER TABLE barbers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP",
        "UPDATE barbers SET is_available = TRUE WHERE is_available IS NULL",
        "UPDATE barbers SET available_days = '' WHERE available_days IS NULL",
        "UPDATE barbers SET kyc_status = 'pending' WHERE kyc_status IS NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token_hash VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS address_area VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS address_landmark VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS address_note VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id INTEGER",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_reward_granted BOOLEAN DEFAULT FALSE",
        "UPDATE users SET accepted_terms = FALSE WHERE accepted_terms IS NULL",
        "UPDATE users SET admin_approved = FALSE WHERE admin_approved IS NULL",
        "UPDATE users SET loyalty_points = 0 WHERE loyalty_points IS NULL",
        "UPDATE users SET referral_reward_granted = FALSE WHERE referral_reward_granted IS NULL",
        "ALTER TABLE barber_services ADD COLUMN IF NOT EXISTS duration_minutes INTEGER",
        "UPDATE barber_services SET duration_minutes = 60 WHERE duration_minutes IS NULL OR duration_minutes <= 0",
        "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS receiver_id INTEGER",
        (
            "UPDATE chat_messages SET receiver_id = bookings.customer_id "
            "FROM bookings JOIN barbers ON bookings.barber_id = barbers.id "
            "WHERE chat_messages.booking_id = bookings.id "
            "AND receiver_id IS NULL "
            "AND chat_messages.sender_role = 'barber'"
        ),
        (
            "UPDATE chat_messages SET receiver_id = barbers.user_id "
            "FROM bookings JOIN barbers ON bookings.barber_id = barbers.id "
            "WHERE chat_messages.booking_id = bookings.id "
            "AND receiver_id IS NULL "
            "AND chat_messages.sender_role = 'customer'"
        ),
        (
            "DO $$ BEGIN "
            "IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bookingstatus') THEN "
            "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'approved'; "
            "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'paid'; "
            "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'expired'; "
            "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'disputed'; "
            "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'refunded'; "
            "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'no_show'; "
            "END IF; "
            "END $$;"
        ),
        (
            "DO $$ BEGIN "
            "IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN "
            "ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'super_admin'; "
            "END IF; "
            "END $$;"
        ),
    ]

    for statement in statements:
        try:
            with engine.begin() as connection:
                connection.execute(text(statement))
        except Exception:
            continue


def ensure_bootstrap_super_admin() -> None:
    if not BOOTSTRAP_SUPER_ADMIN_EMAIL or not BOOTSTRAP_SUPER_ADMIN_PASSWORD:
        return

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == BOOTSTRAP_SUPER_ADMIN_EMAIL).first()
        if existing:
            if existing.role != UserRole.super_admin:
                existing.role = UserRole.super_admin
            if not existing.full_name and BOOTSTRAP_SUPER_ADMIN_NAME:
                existing.full_name = BOOTSTRAP_SUPER_ADMIN_NAME
            existing.admin_approved = True
            existing.accepted_terms = True
            db.commit()
            return

        user = User(
            full_name=BOOTSTRAP_SUPER_ADMIN_NAME,
            email=BOOTSTRAP_SUPER_ADMIN_EMAIL,
            hashed_password=hash_password(BOOTSTRAP_SUPER_ADMIN_PASSWORD),
            role=UserRole.super_admin,
            accepted_terms=True,
            admin_approved=True,
        )
        db.add(user)
        db.commit()
    finally:
        db.close()


def migrate_legacy_pending_bookings() -> None:
    """One-off runtime cleanup for legacy bookings created before approval was disabled."""
    if BOOKINGS_REQUIRE_BARBER_APPROVAL:
        return

    db = SessionLocal()
    try:
        migrated_count = booking_routes.migrate_pending_bookings_to_payment_ready(db)
        if migrated_count:
            db.commit()
        else:
            db.rollback()
    except Exception:
        db.rollback()
    finally:
        db.close()


def backfill_legacy_barber_card_images() -> None:
    """One-off runtime cleanup for older barber profiles missing a dedicated card image."""
    db = SessionLocal()
    try:
        barber_routes.backfill_legacy_barber_card_images(db)
    finally:
        db.close()


Base.metadata.create_all(bind=engine)
ensure_runtime_schema()
ensure_bootstrap_super_admin()
migrate_legacy_pending_bookings()
backfill_legacy_barber_card_images()

app.include_router(auth.router)
app.include_router(account_routes.router)
app.include_router(barber_routes.router)
app.include_router(booking_routes.router)
app.include_router(chat_routes.router)
app.include_router(dispute_routes.router)
app.include_router(notification_routes.router)
app.include_router(policy_routes.router)
app.include_router(payment.router)
app.include_router(review_routes.router)

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

if PROJECT_STATIC_DIR.exists():
    app.mount("/STATIC", StaticFiles(directory=str(PROJECT_STATIC_DIR)), name="project-static")


@app.get("/")
def serve_home():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/payment-success")
def serve_payment_success():
    return FileResponse(FRONTEND_DIR / "payment-status.html")


@app.get("/admin")
def serve_admin_page(current_user: User = Depends(get_admin_user_from_cookie)):
    return FileResponse(PROTECTED_FRONTEND_DIR / "admin.html")


@app.get("/health")
def health():
    return {"status": "ok"}
