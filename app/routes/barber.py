from datetime import datetime, time
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlencode
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user, require_any_role, require_role
from app.db.session import SessionLocal
from app.models.barber_kyc import BarberKYC
from app.models.barber import Barber
from app.models.barber_service import BarberService
from app.models.user import User, UserRole
from app.schemas.barber import (
    AdminBarberReviewResponse,
    BarberAvailabilityUpdate,
    BarberCreate,
    BarberKYCResponse,
    BarberKYCSubmit,
    BarberPublicResponse,
    BarberProfileUpdate,
    BarberResponse,
    BarberServiceCreate,
    BarberServiceResponse,
    BarberServiceUpdate,
    BarberStatusUpdate,
    BarberVerificationUpdate,
)
from app.services.notification_service import create_notifications, notify_admins
from app.services.paystack_subaccount_service import ensure_barber_subaccount

router = APIRouter()
BASE_DIR = Path(__file__).resolve().parent.parent.parent
BARBER_UPLOADS_DIR = BASE_DIR / "frontend" / "uploads" / "barbers"

DAY_ORDER = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]
DAY_ALIASES = {
    "mon": "monday",
    "monday": "monday",
    "tue": "tuesday",
    "tues": "tuesday",
    "tuesday": "tuesday",
    "wed": "wednesday",
    "wednesday": "wednesday",
    "thu": "thursday",
    "thur": "thursday",
    "thurs": "thursday",
    "thursday": "thursday",
    "fri": "friday",
    "friday": "friday",
    "sat": "saturday",
    "saturday": "saturday",
    "sun": "sunday",
    "sunday": "sunday",
}

MAX_BARBER_SERVICES = 15
DEFAULT_HAIRCUT_SERVICE_NAME = "Haircut"
DEFAULT_BEARD_SERVICE_NAME = "Beard Trim"
DEFAULT_HOME_SERVICE_NAME = "Home Service"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _normalize_role(role_value) -> str:
    if role_value is None:
        return ""

    if hasattr(role_value, "value"):
        return str(role_value.value).lower()

    role_text = str(role_value).strip().lower()
    if "." in role_text:
        role_text = role_text.split(".")[-1]

    return role_text


def _normalize_day(value: str) -> Optional[str]:
    normalized = DAY_ALIASES.get(str(value).strip().lower())
    return normalized


def _normalize_days(values: list[str]) -> list[str]:
    seen = set()
    ordered: list[str] = []

    for value in values:
        day = _normalize_day(value)
        if day and day not in seen:
            seen.add(day)
            ordered.append(day)

    ordered.sort(key=lambda day: DAY_ORDER.index(day))
    return ordered


def _dashboard_link(section: str = "overview", **params) -> str:
    query = urlencode({key: value for key, value in params.items() if value is not None})
    target = {
        "overview": "/static/barber-dashboard.html",
        "queue": "/static/barber-queue.html",
        "records": "/static/barber-records.html",
    }.get(section, "/static/barber-dashboard.html")
    return f"{target}{f'?{query}' if query else ''}"


def _parse_days(raw_days: Optional[str]) -> list[str]:
    if not raw_days:
        return []

    parts = [item.strip() for item in raw_days.split(",") if item.strip()]
    return _normalize_days(parts)


def _serialize_days(days: list[str]) -> str:
    if not days:
        return ""
    return ",".join(_normalize_days(days))


def _parse_portfolio(raw_urls: Optional[str]) -> list[str]:
    if not raw_urls:
        return []
    return [item.strip() for item in raw_urls.split(",") if item.strip()]


def _serialize_portfolio(urls: list[str]) -> str:
    if not urls:
        return ""
    return ",".join([str(url).strip() for url in urls if str(url).strip()])


def _service_name_key(value: str | None) -> str:
    return str(value or "").strip().lower()


def _service_sort_key(service: BarberService) -> tuple[int, str, int]:
    return (
        1 if not bool(service.is_active) else 0,
        _service_name_key(service.name),
        int(service.id or 0),
    )


def _serialize_service(service: BarberService) -> BarberServiceResponse:
    return BarberServiceResponse(
        id=service.id,
        barber_id=service.barber_id,
        name=str(service.name or "").strip(),
        price=float(service.price or 0),
        duration_minutes=max(int(service.duration_minutes or 60), 15),
        is_home_service=bool(service.is_home_service),
        is_active=bool(service.is_active),
    )


def _barber_services_payload(barber: Barber, *, active_only: bool = False) -> list[BarberServiceResponse]:
    services = list(getattr(barber, "services", []) or [])
    if active_only:
        services = [service for service in services if bool(service.is_active)]
    services.sort(key=_service_sort_key)
    return [_serialize_service(service) for service in services]


def _count_active_services(barber: Barber) -> int:
    return sum(1 for service in getattr(barber, "services", []) if bool(service.is_active))


def _find_service(
    barber: Barber,
    name: str,
    *,
    is_home_service: Optional[bool] = None,
) -> Optional[BarberService]:
    target_name = _service_name_key(name)
    for service in getattr(barber, "services", []) or []:
        if _service_name_key(service.name) != target_name:
            continue
        if is_home_service is not None and bool(service.is_home_service) != bool(is_home_service):
            continue
        return service
    return None


def _upsert_default_service(
    barber: Barber,
    db: Session,
    *,
    name: str,
    price: float,
    duration_minutes: int = 60,
    is_home_service: bool = False,
    default_active: bool = True,
) -> BarberService:
    existing = _find_service(barber, name, is_home_service=is_home_service)
    if existing:
        existing.price = float(price or 0)
        existing.duration_minutes = max(int(duration_minutes or 60), 15)
        if existing.is_active is None:
            existing.is_active = bool(default_active)
        return existing

    service = BarberService(
        barber_id=barber.id,
        name=name,
        price=float(price or 0),
        duration_minutes=max(int(duration_minutes or 60), 15),
        is_home_service=bool(is_home_service),
        is_active=bool(default_active),
    )
    db.add(service)
    barber.services.append(service)
    return service


def _sync_default_barber_services(barber: Barber, db: Session) -> None:
    _upsert_default_service(
        barber,
        db,
        name=DEFAULT_HAIRCUT_SERVICE_NAME,
        price=barber.haircut_price,
        duration_minutes=60,
        is_home_service=False,
        default_active=True,
    )

    if barber.beard_trim_price is not None:
        _upsert_default_service(
            barber,
            db,
            name=DEFAULT_BEARD_SERVICE_NAME,
            price=barber.beard_trim_price,
            duration_minutes=45,
            is_home_service=False,
            default_active=True,
        )

    _upsert_default_service(
        barber,
        db,
        name=DEFAULT_HOME_SERVICE_NAME,
        price=0,
        duration_minutes=90,
        is_home_service=True,
        default_active=False,
    )
    db.flush()


def _public_upload_url(user_id: int, filename: str) -> str:
    return f"/static/uploads/barbers/{int(user_id)}/{filename}"


def _first_uploaded_barber_image_url(user_id: int) -> Optional[str]:
    upload_dir = BARBER_UPLOADS_DIR / str(int(user_id))
    if not upload_dir.exists() or not upload_dir.is_dir():
        return None

    candidates = [
        path for path in upload_dir.iterdir()
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    ]
    if not candidates:
        return None

    candidates.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    return _public_upload_url(int(user_id), candidates[0].name)


def backfill_legacy_barber_card_images(db: Session) -> int:
    """One-off cleanup for older barber records created before card images were separated."""
    updated = 0
    barbers = db.query(Barber).all()

    for barber in barbers:
        cover_value = str(barber.cover_image_url or "").strip()
        if cover_value:
            continue

        portfolio_urls = _parse_portfolio(barber.portfolio_image_urls)
        fallback_cover = (
            str(barber.profile_image_url or "").strip()
            or (portfolio_urls[0] if portfolio_urls else "")
            or _first_uploaded_barber_image_url(barber.user_id)
            or ""
        ).strip()

        if not fallback_cover:
            continue

        barber.cover_image_url = fallback_cover
        updated += 1

    if updated:
        db.commit()

    return updated


def _validate_time_range(start_time: Optional[time], end_time: Optional[time]) -> None:
    if start_time and end_time and start_time >= end_time:
        raise HTTPException(status_code=400, detail="Start time must be before end time")


def _barber_review_metrics(barber: Barber) -> tuple[float, int, int]:
    visible_reviews = [review for review in getattr(barber, "reviews", []) if bool(getattr(review, "is_visible", True))]
    hidden_reviews = [review for review in getattr(barber, "reviews", []) if not bool(getattr(review, "is_visible", True))]
    if not visible_reviews:
        return 0, 0, len(hidden_reviews)
    average_rating = round(
        sum(int(getattr(review, "rating", 0) or 0) for review in visible_reviews) / len(visible_reviews),
        1,
    )
    return average_rating, len(visible_reviews), len(hidden_reviews)


def barber_payload(barber: Barber) -> dict:
    average_rating, review_count, hidden_review_count = _barber_review_metrics(barber)
    return {
        "id": barber.id,
        "shop_name": barber.shop_name,
        "location": barber.location,
        "shop_address": barber.shop_address,
        "shop_landmark": barber.shop_landmark,
        "bio": barber.bio,
        "haircut_price": barber.haircut_price,
        "beard_trim_price": barber.beard_trim_price,
        "other_services": barber.other_services,
        "barber_name": barber.barber_name,
        "profile_image_url": barber.profile_image_url,
        "cover_image_url": barber.cover_image_url,
        "portfolio_image_urls": _parse_portfolio(barber.portfolio_image_urls),
        "is_available": barber.is_available,
        "kyc_status": barber.kyc_status,
        "kyc_submitted_at": barber.kyc_submitted_at,
        "verified_at": barber.verified_at,
        "rejection_reason": barber.rejection_reason,
        "available_days": _parse_days(barber.available_days),
        "available_start_time": barber.available_start_time,
        "available_end_time": barber.available_end_time,
        "average_rating": average_rating,
        "review_count": review_count,
        "hidden_review_count": hidden_review_count,
        "paystack_subaccount_code": barber.paystack_subaccount_code,
        "services": _barber_services_payload(barber),
    }


def _latest_kyc(barber: Barber) -> Optional[BarberKYC]:
    if not barber.kyc_records:
        return None
    return max(barber.kyc_records, key=lambda record: record.created_at or datetime.min)


def serialize_barber_profile(barber: Barber) -> BarberPublicResponse:
    user = barber.user
    payload = barber_payload(barber)
    payload["services"] = _barber_services_payload(barber, active_only=True)
    payload["user_id"] = barber.user_id
    payload["barber_name"] = payload["barber_name"] or (user.full_name if user else barber.shop_name)
    payload["email"] = user.email if user else None
    return BarberPublicResponse(**payload)


def _require_barber_profile(current_user, db: Session) -> Barber:
    if _normalize_role(current_user.role) != UserRole.barber.value:
        raise HTTPException(status_code=403, detail="Only barbers can access this endpoint")

    barber = db.query(Barber).filter(Barber.user_id == current_user.id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barber profile not found")

    _sync_default_barber_services(barber, db)
    return barber


@router.post("/barber/profile", response_model=BarberResponse)
def create_barber_profile(
    barber_data: BarberCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _normalize_role(current_user.role) != UserRole.barber.value:
        raise HTTPException(status_code=403, detail="Only barbers can create profile")

    existing_profile = db.query(Barber).filter(Barber.user_id == current_user.id).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="Profile already exists")

    normalized_days = _normalize_days(barber_data.available_days)
    _validate_time_range(barber_data.available_start_time, barber_data.available_end_time)

    new_barber = Barber(
        user_id=current_user.id,
        shop_name=barber_data.shop_name,
        location=barber_data.location,
        shop_address=barber_data.shop_address,
        shop_landmark=barber_data.shop_landmark,
        bio=barber_data.bio,
        haircut_price=barber_data.haircut_price,
        beard_trim_price=barber_data.beard_trim_price,
        other_services=barber_data.other_services,
        barber_name=barber_data.barber_name or current_user.full_name,
        profile_image_url=barber_data.profile_image_url,
        cover_image_url=barber_data.cover_image_url,
        portfolio_image_urls=_serialize_portfolio(barber_data.portfolio_image_urls),
        is_available=barber_data.is_available,
        kyc_status="pending",
        available_days=_serialize_days(normalized_days),
        available_start_time=barber_data.available_start_time,
        available_end_time=barber_data.available_end_time,
    )

    db.add(new_barber)
    db.flush()
    _sync_default_barber_services(new_barber, db)
    db.commit()
    db.refresh(new_barber)

    return BarberResponse(**barber_payload(new_barber))


@router.get("/barber/profile/me", response_model=BarberResponse)
def get_my_barber_profile(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barber = _require_barber_profile(current_user, db)
    return BarberResponse(**barber_payload(barber))


@router.patch("/barber/profile", response_model=BarberResponse)
def update_my_barber_profile(
    payload: BarberProfileUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barber = _require_barber_profile(current_user, db)

    barber.shop_name = payload.shop_name.strip()
    barber.location = payload.location.strip()
    barber.shop_address = payload.shop_address.strip() if payload.shop_address else None
    barber.shop_landmark = payload.shop_landmark.strip() if payload.shop_landmark else None
    barber.bio = payload.bio.strip() if payload.bio else None
    barber.haircut_price = payload.haircut_price
    barber.beard_trim_price = payload.beard_trim_price
    barber.other_services = payload.other_services.strip() if payload.other_services else None
    barber.barber_name = payload.barber_name.strip() if payload.barber_name else current_user.full_name
    barber.profile_image_url = payload.profile_image_url.strip() if payload.profile_image_url else None
    barber.cover_image_url = payload.cover_image_url.strip() if payload.cover_image_url else None
    barber.portfolio_image_urls = _serialize_portfolio(payload.portfolio_image_urls)

    _sync_default_barber_services(barber, db)
    db.commit()
    db.refresh(barber)
    return BarberResponse(**barber_payload(barber))


@router.post("/barber/profile/upload-image")
async def upload_barber_profile_image(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    if _normalize_role(current_user.role) != UserRole.barber.value:
        raise HTTPException(status_code=403, detail="Only barbers can upload images")

    content_type = str(file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported")

    original_name = Path(file.filename or "upload").name
    extension = Path(original_name).suffix.lower() or ".jpg"
    if extension not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    user_upload_dir = BARBER_UPLOADS_DIR / str(current_user.id)
    user_upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{extension}"
    destination = user_upload_dir / filename
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    destination.write_bytes(contents)
    return {"url": _public_upload_url(current_user.id, filename)}


@router.patch("/barber/profile/availability", response_model=BarberResponse)
def update_barber_availability(
    availability_data: BarberAvailabilityUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barber = _require_barber_profile(current_user, db)
    _validate_time_range(availability_data.available_start_time, availability_data.available_end_time)

    barber.available_days = _serialize_days(availability_data.available_days)
    barber.available_start_time = availability_data.available_start_time
    barber.available_end_time = availability_data.available_end_time

    _sync_default_barber_services(barber, db)
    db.commit()
    db.refresh(barber)

    return BarberResponse(**barber_payload(barber))


@router.patch("/barber/profile/status", response_model=BarberResponse)
def update_barber_status(
    status_data: BarberStatusUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barber = _require_barber_profile(current_user, db)
    barber.is_available = bool(status_data.is_available)

    _sync_default_barber_services(barber, db)
    db.commit()
    db.refresh(barber)

    return BarberResponse(**barber_payload(barber))


@router.post("/barber/kyc/submit", response_model=BarberKYCResponse)
def submit_barber_kyc(
    payload: BarberKYCSubmit,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barber = _require_barber_profile(current_user, db)

    existing = db.query(BarberKYC).filter(BarberKYC.barber_id == barber.id).first()
    if existing:
        existing.phone_number = payload.phone_number
        existing.shop_address = payload.shop_address
        existing.shop_photo_url = payload.shop_photo_url
        existing.bank_account_number = payload.bank_account_number
        existing.bank_name = payload.bank_name
        existing.account_name = payload.account_name
        record = existing
    else:
        record = BarberKYC(barber_id=barber.id, **payload.model_dump())
        db.add(record)

    barber.kyc_status = "pending"
    barber.kyc_submitted_at = datetime.utcnow()
    barber.verified_at = None
    barber.rejection_reason = None
    barber.transfer_recipient_code = None
    barber.paystack_subaccount_code = None
    notify_admins(
        db,
        notification_type="kyc_submitted",
        title="New barber KYC submitted",
        message=f"{barber.shop_name or barber.barber_name or f'Barber #{barber.id}'} submitted KYC for review.",
        link=f"/admin?{urlencode({'barber': barber.id, 'focus': 'barber'})}",
    )
    db.commit()
    db.refresh(record)
    db.refresh(barber)
    return BarberKYCResponse.model_validate(record)


@router.patch("/admin/barbers/{barber_id}/verify", response_model=BarberResponse)
def verify_barber_kyc(
    barber_id: int,
    payload: BarberVerificationUpdate,
    current_user=Depends(require_any_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    barber = db.query(Barber).filter(Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barber not found")

    action = str(payload.action or "").strip().lower()
    if action not in {"verified", "rejected", "pending", "suspended"}:
        raise HTTPException(status_code=400, detail="Action must be verified, rejected, pending, or suspended")

    if action == "verified":
        role = getattr(current_user.role, "value", str(current_user.role)).split(".")[-1].lower()
        kyc = db.query(BarberKYC).filter(BarberKYC.barber_id == barber.id).first()
        if not kyc and role != "super_admin":
            raise HTTPException(status_code=400, detail="Barber has not submitted KYC")

        if kyc:
            try:
                ensure_barber_subaccount(barber, barber.user, kyc)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Paystack subaccount setup failed: {exc}") from exc

        barber.kyc_status = "verified"
        barber.verified_at = datetime.utcnow()
        barber.rejection_reason = None
        create_notifications(
            db,
            user_ids=[barber.user_id],
            notification_type="barber_verified",
            title="Barber profile approved",
            message="Your barber profile has been approved. You can now appear in search and accept bookings.",
            link=_dashboard_link(section="overview", focus="kyc"),
        )
        notify_admins(
            db,
            notification_type="barber_review_action",
            title="Barber approved",
            message=f"{barber.shop_name or barber.barber_name or 'A barber'} was approved for marketplace access.",
            link=f"/admin?{urlencode({'barber': barber.id, 'focus': 'barber'})}",
        )
    elif action == "rejected":
        barber.kyc_status = "rejected"
        barber.verified_at = None
        barber.rejection_reason = payload.rejection_reason or "KYC verification rejected"
        create_notifications(
            db,
            user_ids=[barber.user_id],
            notification_type="barber_rejected",
            title="Barber profile rejected",
            message=payload.rejection_reason or "Your barber verification was rejected. Please review the admin note and update your details.",
            link=_dashboard_link(section="overview", focus="kyc"),
        )
        notify_admins(
            db,
            notification_type="barber_review_action",
            title="Barber rejected",
            message=f"{barber.shop_name or barber.barber_name or 'A barber'} was rejected during review.",
            link=f"/admin?{urlencode({'barber': barber.id, 'focus': 'barber'})}",
        )
    elif action == "pending":
        barber.kyc_status = "pending"
        barber.verified_at = None
        barber.rejection_reason = payload.rejection_reason or "Barber moved back to pending review"
        create_notifications(
            db,
            user_ids=[barber.user_id],
            notification_type="barber_pending_review",
            title="Barber profile moved to pending",
            message=payload.rejection_reason or "Your barber profile has been moved back to pending review.",
            link=_dashboard_link(section="overview", focus="kyc"),
        )
        notify_admins(
            db,
            notification_type="barber_review_action",
            title="Barber moved to pending",
            message=f"{barber.shop_name or barber.barber_name or 'A barber'} was moved back to pending review.",
            link=f"/admin?{urlencode({'barber': barber.id, 'focus': 'barber'})}",
        )
    else:
        barber.kyc_status = "suspended"
        barber.verified_at = None
        barber.is_available = False
        barber.rejection_reason = payload.rejection_reason or "Barber access suspended pending further review"
        create_notifications(
            db,
            user_ids=[barber.user_id],
            notification_type="barber_suspended",
            title="Barber access suspended",
            message=payload.rejection_reason or "Your barber profile has been suspended pending further review.",
            link=_dashboard_link(section="overview", focus="kyc"),
        )
        notify_admins(
            db,
            notification_type="barber_review_action",
            title="Barber suspended",
            message=f"{barber.shop_name or barber.barber_name or 'A barber'} was suspended from active marketplace access.",
            link=f"/admin?{urlencode({'barber': barber.id, 'focus': 'barber'})}",
        )

    db.commit()
    db.refresh(barber)
    return BarberResponse(**barber_payload(barber))


@router.get("/barber/kyc/me", response_model=BarberKYCResponse)
def get_my_barber_kyc(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barber = _require_barber_profile(current_user, db)
    record = db.query(BarberKYC).filter(BarberKYC.barber_id == barber.id).order_by(BarberKYC.created_at.desc()).first()
    if not record:
        raise HTTPException(status_code=404, detail="KYC not found")
    return BarberKYCResponse.model_validate(record)


@router.get("/barber/services", response_model=List[BarberServiceResponse])
def list_my_barber_services(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barber = _require_barber_profile(current_user, db)
    db.commit()
    db.refresh(barber)
    return _barber_services_payload(barber)


@router.post("/barber/services", response_model=BarberServiceResponse)
def add_barber_service(
    payload: BarberServiceCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barber = _require_barber_profile(current_user, db)

    if _count_active_services(barber) >= MAX_BARBER_SERVICES:
        raise HTTPException(status_code=400, detail=f"Maximum of {MAX_BARBER_SERVICES} active services allowed")

    service_name = str(payload.name or "").strip()
    if not service_name:
        raise HTTPException(status_code=400, detail="Service name is required")

    existing = _find_service(barber, service_name, is_home_service=payload.is_home_service)
    if existing and bool(existing.is_active):
        raise HTTPException(status_code=400, detail="A service with this name already exists")

    if payload.is_home_service:
        existing_home = next((service for service in barber.services if bool(service.is_home_service) and service.id != getattr(existing, "id", None)), None)
        if existing_home and bool(existing_home.is_active):
            raise HTTPException(status_code=400, detail="Only one active home service can exist")

    if existing:
        existing.name = service_name
        existing.price = float(payload.price or 0)
        existing.duration_minutes = max(int(payload.duration_minutes or 60), 15)
        existing.is_home_service = bool(payload.is_home_service)
        existing.is_active = bool(payload.is_active)
        service = existing
    else:
        service = BarberService(
            barber_id=barber.id,
            name=service_name,
            price=float(payload.price or 0),
            duration_minutes=max(int(payload.duration_minutes or 60), 15),
            is_home_service=bool(payload.is_home_service),
            is_active=bool(payload.is_active),
        )
        db.add(service)

    db.commit()
    db.refresh(service)
    return _serialize_service(service)


@router.patch("/barber/services/{service_id}", response_model=BarberServiceResponse)
def update_barber_service(
    service_id: int,
    payload: BarberServiceUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barber = _require_barber_profile(current_user, db)
    service = (
        db.query(BarberService)
        .filter(BarberService.id == service_id, BarberService.barber_id == barber.id)
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    if payload.name is not None:
        service_name = str(payload.name or "").strip()
        if not service_name:
            raise HTTPException(status_code=400, detail="Service name is required")
        duplicate = next(
            (
                item
                for item in barber.services
                if item.id != service.id
                and _service_name_key(item.name) == _service_name_key(service_name)
                and bool(item.is_home_service) == bool(service.is_home_service)
                and bool(item.is_active)
            ),
            None,
        )
        if duplicate:
            raise HTTPException(status_code=400, detail="A service with this name already exists")
        service.name = service_name

    if payload.price is not None:
        service.price = float(payload.price or 0)

    if payload.duration_minutes is not None:
        service.duration_minutes = max(int(payload.duration_minutes or 60), 15)

    if payload.is_active is not None:
        if payload.is_active and not bool(service.is_active) and _count_active_services(barber) >= MAX_BARBER_SERVICES:
            raise HTTPException(status_code=400, detail=f"Maximum of {MAX_BARBER_SERVICES} active services allowed")
        service.is_active = bool(payload.is_active)

    if _service_name_key(service.name) == _service_name_key(DEFAULT_HAIRCUT_SERVICE_NAME) and not bool(service.is_home_service):
        barber.haircut_price = float(service.price or 0)
    elif _service_name_key(service.name) == _service_name_key(DEFAULT_BEARD_SERVICE_NAME) and not bool(service.is_home_service):
        barber.beard_trim_price = float(service.price or 0)

    db.commit()
    db.refresh(service)
    return _serialize_service(service)


@router.delete("/barber/services/{service_id}")
def deactivate_barber_service(
    service_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barber = _require_barber_profile(current_user, db)
    service = (
        db.query(BarberService)
        .filter(BarberService.id == service_id, BarberService.barber_id == barber.id)
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    service.is_active = False
    db.commit()
    return {"message": "Service deactivated", "service_id": service.id}


@router.get("/admin/barbers", response_model=List[AdminBarberReviewResponse])
def list_barbers_for_admin(
    current_user=Depends(require_any_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    barbers = db.query(Barber).options(joinedload(Barber.user), joinedload(Barber.reviews), joinedload(Barber.services)).all()
    barber_by_user_id = {barber.user_id: barber for barber in barbers}
    barber_users = db.query(User).filter(User.role == UserRole.barber).order_by(User.created_at.desc(), User.id.desc()).all()
    response = []
    for user in barber_users:
        barber = barber_by_user_id.get(user.id)
        if barber:
            kyc = _latest_kyc(barber)
            response.append(
                AdminBarberReviewResponse(
                    barber_id=barber.id,
                    user_id=barber.user_id,
                    barber_name=barber.barber_name,
                    shop_name=barber.shop_name,
                    email=barber.user.email if barber.user else None,
                    location=barber.location,
                    public_shop_address=barber.shop_address,
                    public_shop_landmark=barber.shop_landmark,
                    bio=barber.bio,
                    haircut_price=barber.haircut_price,
                    beard_trim_price=barber.beard_trim_price,
                    other_services=barber.other_services,
                    profile_image_url=barber.profile_image_url,
                    cover_image_url=barber.cover_image_url,
                    portfolio_image_urls=_parse_portfolio(barber.portfolio_image_urls),
                    is_available=bool(barber.is_available),
                    kyc_status=barber.kyc_status,
                    kyc_submitted_at=barber.kyc_submitted_at,
                    verified_at=barber.verified_at,
                    rejection_reason=barber.rejection_reason,
                    available_days=_parse_days(barber.available_days),
                    available_start_time=barber.available_start_time,
                    available_end_time=barber.available_end_time,
                    phone_number=kyc.phone_number if kyc else None,
                    shop_address=kyc.shop_address if kyc else None,
                    shop_photo_url=kyc.shop_photo_url if kyc else None,
                    bank_account_number=kyc.bank_account_number if kyc else None,
                    bank_name=kyc.bank_name if kyc else None,
                    account_name=kyc.account_name if kyc else None,
                    average_rating=barber_payload(barber)["average_rating"],
                    review_count=barber_payload(barber)["review_count"],
                    hidden_review_count=barber_payload(barber)["hidden_review_count"],
                    paystack_subaccount_code=barber.paystack_subaccount_code,
                    services=_barber_services_payload(barber),
                )
            )
            continue

        response.append(
            AdminBarberReviewResponse(
                barber_id=-int(user.id),
                user_id=user.id,
                barber_name=user.full_name,
                shop_name="Profile setup not completed",
                email=user.email,
                location="Awaiting barber profile setup",
                public_shop_address=None,
                public_shop_landmark=None,
                bio="This barber account has been created but the public barber profile has not been completed yet.",
                haircut_price=0,
                beard_trim_price=None,
                other_services=None,
                profile_image_url=None,
                cover_image_url=None,
                portfolio_image_urls=[],
                is_available=False,
                kyc_status="pending_setup",
                kyc_submitted_at=None,
                verified_at=None,
                rejection_reason=None,
                available_days=[],
                available_start_time=None,
                available_end_time=None,
                phone_number=user.phone,
                shop_address=None,
                shop_photo_url=None,
                bank_account_number=None,
                bank_name=None,
                account_name=None,
                average_rating=0,
                review_count=0,
                hidden_review_count=0,
                paystack_subaccount_code=None,
            )
        )
    return response


@router.get("/barbers", response_model=List[BarberPublicResponse])
def list_barbers(
    location: Optional[str] = Query(default=None),
    available: Optional[bool] = Query(default=None),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Barber).options(joinedload(Barber.user), joinedload(Barber.reviews), joinedload(Barber.services)).filter(Barber.kyc_status == "verified")

    if location:
        query = query.filter(Barber.location.ilike(f"%{location.strip()}%"))

    if available is not None:
        query = query.filter(Barber.is_available == available)
    else:
        # Public search should only show online barbers by default.
        query = query.filter(Barber.is_available.is_(True))

    if min_price is not None:
        query = query.filter(Barber.haircut_price >= min_price)

    if max_price is not None:
        query = query.filter(Barber.haircut_price <= max_price)

    barbers = query.order_by(Barber.id.asc()).all()
    for barber in barbers:
        _sync_default_barber_services(barber, db)
    db.commit()
    return [serialize_barber_profile(barber) for barber in barbers]


@router.get("/barbers/{barber_id}", response_model=BarberPublicResponse)
def get_barber_detail(barber_id: int, db: Session = Depends(get_db)):
    barber = (
        db.query(Barber)
        .options(joinedload(Barber.user), joinedload(Barber.reviews), joinedload(Barber.services))
        .filter(Barber.id == barber_id, Barber.kyc_status == "verified")
        .first()
    )
    if not barber:
        raise HTTPException(status_code=404, detail="Barber not found")

    _sync_default_barber_services(barber, db)
    db.commit()
    db.refresh(barber)
    return serialize_barber_profile(barber)
