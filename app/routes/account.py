from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user, get_user_from_token, hash_session_id, oauth2_scheme, require_any_role
from app.db.session import get_db
from app.models.barber import Barber
from app.models.booking import Booking
from app.models.review import Review
from app.models.user import User, UserRole
from app.models.user_session import UserSession
from app.enums.payment_status import PaymentStatus
from app.schemas.insights import (
    BarberInsightsResponse,
    CustomerInsightsResponse,
    PayoutReportItem,
    PayoutReportResponse,
    ReferralSummaryResponse,
)
from app.schemas.session import SessionListResponse, SessionRevokeResponse, UserSessionResponse

router = APIRouter()


def _normalize_role(role_value) -> str:
    if hasattr(role_value, "value"):
        return str(role_value.value).lower()
    return str(role_value or "").lower()


def _booking_query(db: Session):
    return db.query(Booking).options(joinedload(Booking.customer), joinedload(Booking.barber).joinedload(Barber.user))


def _serialize_payout_report(bookings: list[Booking]) -> PayoutReportResponse:
    items = [
        PayoutReportItem(
            booking_id=booking.id,
            scheduled_time=booking.scheduled_time.isoformat() if booking.scheduled_time else None,
            customer_name=booking.customer.full_name if booking.customer else None,
            barber_name=(booking.barber.barber_name or booking.barber.shop_name) if booking.barber else None,
            amount=float(booking.price or 0),
            commission_amount=float(booking.commission_amount or 0),
            barber_payout_amount=float(booking.barber_payout_amount or 0),
            payment_status=str(getattr(booking.payment_status, "value", booking.payment_status or "")),
            booking_status=str(getattr(booking.status, "value", booking.status or "")),
            payout_status=booking.payout_status,
            paid_at=booking.paid_at.isoformat() if booking.paid_at else None,
        )
        for booking in bookings
    ]
    return PayoutReportResponse(
        total_volume=round(sum(item.amount for item in items), 2),
        total_commission=round(sum(item.commission_amount for item in items), 2),
        total_barber_payout=round(sum(item.barber_payout_amount for item in items), 2),
        items=items,
    )


@router.get("/me/customer-insights", response_model=CustomerInsightsResponse)
def get_customer_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _normalize_role(current_user.role) != UserRole.customer.value:
        raise HTTPException(status_code=403, detail="Only customers can access this endpoint")

    bookings = _booking_query(db).filter(Booking.customer_id == current_user.id).all()
    completed = [booking for booking in bookings if _normalize_role(booking.status) == "completed"]
    favorite_barbers = len({int(booking.barber_id) for booking in completed if booking.barber_id})
    referrals_joined = db.query(User).filter(User.referred_by_user_id == current_user.id).count()
    referrals_rewarded = db.query(User).filter(User.referred_by_user_id == current_user.id, User.referral_reward_granted.is_(True)).count()

    return CustomerInsightsResponse(
        total_appointments=len(bookings),
        completed_haircuts=len(completed),
        favorite_barbers=favorite_barbers,
        loyalty_points=int(current_user.loyalty_points or 0),
        referral_code=current_user.referral_code,
        referrals_joined=referrals_joined,
        referrals_rewarded=referrals_rewarded,
    )


@router.get("/barber/analytics", response_model=BarberInsightsResponse)
def get_barber_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _normalize_role(current_user.role) != UserRole.barber.value:
        raise HTTPException(status_code=403, detail="Only barbers can access this endpoint")

    barber = db.query(Barber).options(joinedload(Barber.reviews)).filter(Barber.user_id == current_user.id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barber profile not found")

    bookings = _booking_query(db).filter(Booking.barber_id == barber.id).all()
    now = datetime.utcnow()
    week_start = now - timedelta(days=7)
    completed = [booking for booking in bookings if _normalize_role(booking.status) == "completed"]
    pending = [booking for booking in bookings if _normalize_role(booking.status) == "pending"]
    today_earnings = sum(float(booking.barber_earnings or 0) for booking in completed if booking.scheduled_time and booking.scheduled_time.date() == now.date())
    weekly_earnings = sum(float(booking.barber_earnings or 0) for booking in completed if booking.scheduled_time and booking.scheduled_time >= week_start)
    lifetime_earnings = sum(float(booking.barber_earnings or 0) for booking in completed)
    awaiting = sum(float(booking.barber_payout_amount or 0) for booking in bookings if _normalize_role(booking.status) == "paid")
    visible_reviews = [review for review in getattr(barber, "reviews", []) if bool(getattr(review, "is_visible", True))]
    average = round(sum(int(review.rating or 0) for review in visible_reviews) / len(visible_reviews), 1) if visible_reviews else 0

    return BarberInsightsResponse(
        total_bookings=len(bookings),
        completed_jobs=len(completed),
        pending_requests=len(pending),
        today_earnings=round(today_earnings, 2),
        weekly_earnings=round(weekly_earnings, 2),
        lifetime_earnings=round(lifetime_earnings, 2),
        awaiting_payout_review=round(awaiting, 2),
        average_rating=average,
        review_count=len(visible_reviews),
    )


@router.get("/barber/payout-report", response_model=PayoutReportResponse)
def get_barber_payout_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _normalize_role(current_user.role) != UserRole.barber.value:
        raise HTTPException(status_code=403, detail="Only barbers can access this endpoint")
    barber = db.query(Barber).filter(Barber.user_id == current_user.id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barber profile not found")
    bookings = (
        _booking_query(db)
        .filter(Booking.barber_id == barber.id, Booking.payment_status.in_([PaymentStatus.paid, PaymentStatus.refunded]))
        .order_by(Booking.created_at.desc())
        .all()
    )
    return _serialize_payout_report(bookings)


@router.get("/admin/payout-report", response_model=PayoutReportResponse)
def get_admin_payout_report(
    current_user: User = Depends(require_any_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    bookings = (
        _booking_query(db)
        .filter(Booking.payment_status.in_([PaymentStatus.paid, PaymentStatus.refunded]))
        .order_by(Booking.created_at.desc())
        .all()
    )
    return _serialize_payout_report(bookings)


@router.get("/me/referrals", response_model=ReferralSummaryResponse)
def get_referral_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    referrals_joined = db.query(User).filter(User.referred_by_user_id == current_user.id).count()
    referrals_rewarded = db.query(User).filter(User.referred_by_user_id == current_user.id, User.referral_reward_granted.is_(True)).count()
    return ReferralSummaryResponse(
        referral_code=current_user.referral_code,
        referred_by_user_id=current_user.referred_by_user_id,
        referrals_joined=referrals_joined,
        referrals_rewarded=referrals_rewarded,
        loyalty_points=int(current_user.loyalty_points or 0),
    )


@router.get("/me/sessions", response_model=SessionListResponse)
def list_user_sessions(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payload_user = get_user_from_token(token, db)
    current_sid_hash = None
    # payload user already validated; decode sid via token helper path again is enough here
    from jose import jwt
    from app.core.security import ALGORITHM, JWT_SECRET_KEY

    token_payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    if token_payload.get("sid"):
        current_sid_hash = hash_session_id(str(token_payload["sid"]))

    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == current_user.id)
        .order_by(UserSession.last_seen_at.desc(), UserSession.created_at.desc())
        .all()
    )
    items = [
        UserSessionResponse.model_validate(session).model_copy(
            update={"is_current": session.session_id_hash == current_sid_hash}
        )
        for session in sessions
    ]
    return SessionListResponse(items=items)


@router.post("/me/sessions/{session_id}/revoke", response_model=SessionRevokeResponse)
def revoke_user_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(UserSession).filter(UserSession.id == session_id, UserSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.revoked_at = datetime.utcnow()
    db.commit()
    return SessionRevokeResponse(message="Session revoked")


@router.post("/me/sessions/revoke-others", response_model=SessionRevokeResponse)
def revoke_other_sessions(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from jose import jwt
    from app.core.security import ALGORITHM, JWT_SECRET_KEY

    token_payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    current_sid_hash = hash_session_id(str(token_payload["sid"])) if token_payload.get("sid") else ""
    (
        db.query(UserSession)
        .filter(UserSession.user_id == current_user.id, UserSession.session_id_hash != current_sid_hash, UserSession.revoked_at.is_(None))
        .update({"revoked_at": datetime.utcnow()}, synchronize_session=False)
    )
    db.commit()
    return SessionRevokeResponse(message="Other sessions revoked")
