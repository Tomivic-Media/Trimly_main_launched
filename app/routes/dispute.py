from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from urllib.parse import urlencode

from app.core.security import get_current_user, require_any_role, require_role
from app.db.session import get_db
from app.enums.booking_status import BookingStatus
from app.enums.payment_status import PaymentStatus
from app.models.barber import Barber
from app.models.booking import Booking
from app.models.dispute import Dispute
from app.models.user import UserRole
from app.schemas.dispute import DisputeCreate, DisputeResolveRequest, DisputeResponse
from app.services.escrow_service import PAYOUT_STATUS_PENDING, PAYOUT_STATUS_REFUNDED
from app.services.notification_service import create_notifications, format_notification_time, notify_admins

router = APIRouter()


def _normalize_role(role_value) -> str:
    if role_value is None:
        return ""
    if hasattr(role_value, "value"):
        return str(role_value.value).lower()
    role_text = str(role_value).strip().lower()
    if "." in role_text:
        role_text = role_text.split(".")[-1]
    return role_text


ADMIN_ROLES = {UserRole.admin.value, UserRole.super_admin.value}


def _dashboard_link(**params) -> str:
    query = urlencode({key: value for key, value in params.items() if value is not None})
    return f"/static/dashboard.html{f'?{query}' if query else ''}"


def _get_booking_or_404(db: Session, booking_id: int) -> Booking:
    booking = (
        db.query(Booking)
        .options(joinedload(Booking.barber).joinedload(Barber.user))
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.post("/disputes", response_model=DisputeResponse)
def raise_dispute(
    payload: DisputeCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _get_booking_or_404(db, payload.booking_id)
    role = _normalize_role(current_user.role)

    is_customer = booking.customer_id == current_user.id and role == UserRole.customer.value
    is_barber = bool(booking.barber and booking.barber.user_id == current_user.id and role == UserRole.barber.value)
    if not (is_customer or is_barber):
        raise HTTPException(status_code=403, detail="Only the booking customer or barber can raise a dispute")

    if booking.status not in {BookingStatus.completed, BookingStatus.no_show, BookingStatus.cancelled}:
        raise HTTPException(
            status_code=400,
            detail="Disputes can only be raised for completed, no_show, or cancelled bookings",
        )

    existing = db.query(Dispute).filter(Dispute.booking_id == booking.id, Dispute.status.in_(["open", "investigating"])).first()
    if existing:
        raise HTTPException(status_code=400, detail="An active dispute already exists for this booking")

    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Dispute reason is required")

    dispute = Dispute(
        booking_id=booking.id,
        customer_id=booking.customer_id,
        barber_id=booking.barber_id,
        reason=reason,
        status="open",
    )
    db.add(dispute)
    db.flush()
    booking.status = BookingStatus.disputed
    counterpart_ids = [booking.customer_id]
    if booking.barber and booking.barber.user_id:
        counterpart_ids.append(booking.barber.user_id)
    create_notifications(
        db,
        user_ids=counterpart_ids,
        notification_type="dispute_opened",
        title="Dispute opened",
        message=(
            f"A dispute was opened for booking #{booking.id} scheduled "
            f"{format_notification_time(booking.scheduled_time)}."
        ),
        link=_dashboard_link(dispute=dispute.id, focus="dispute"),
        booking_id=booking.id,
    )
    notify_admins(
        db,
        notification_type="dispute_opened",
        title="New dispute requires review",
        message=(
            f"Booking #{booking.id} now has an open dispute for "
            f"{booking.service_name} on {format_notification_time(booking.scheduled_time)}."
        ),
        link=f"/admin?{urlencode({'dispute': dispute.id, 'focus': 'dispute'})}",
        booking_id=booking.id,
    )
    db.commit()
    db.refresh(dispute)
    return DisputeResponse.model_validate(dispute)


@router.get("/disputes/my", response_model=list[DisputeResponse])
def get_my_disputes(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = _normalize_role(current_user.role)

    if role in ADMIN_ROLES:
        disputes = db.query(Dispute).order_by(Dispute.created_at.desc()).all()
        return [DisputeResponse.model_validate(item) for item in disputes]

    if role == UserRole.customer.value:
        disputes = db.query(Dispute).filter(Dispute.customer_id == current_user.id).order_by(Dispute.created_at.desc()).all()
        return [DisputeResponse.model_validate(item) for item in disputes]

    if role == UserRole.barber.value:
        barber = db.query(Barber).filter(Barber.user_id == current_user.id).first()
        if not barber:
            return []
        disputes = db.query(Dispute).filter(Dispute.barber_id == barber.id).order_by(Dispute.created_at.desc()).all()
        return [DisputeResponse.model_validate(item) for item in disputes]

    raise HTTPException(status_code=403, detail="Not allowed")


@router.patch("/admin/disputes/{dispute_id}/resolve", response_model=DisputeResponse)
def resolve_dispute(
    dispute_id: int,
    payload: DisputeResolveRequest,
    current_user=Depends(require_any_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    booking = db.query(Booking).filter(Booking.id == dispute.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    resolution = str(payload.resolution or "").strip().lower()
    if resolution not in {"refunded", "rejected", "resolved"}:
        raise HTTPException(status_code=400, detail="Resolution must be refunded, rejected, or resolved")

    dispute.status = resolution
    dispute.admin_note = payload.admin_note

    if resolution == "refunded":
        booking.status = BookingStatus.refunded
        booking.payment_status = PaymentStatus.refunded
        booking.refund_requested = False
        booking.escrow_released = False
        booking.payout_status = PAYOUT_STATUS_REFUNDED
    else:
        booking.status = BookingStatus.completed if booking.payment_status == PaymentStatus.paid else BookingStatus.cancelled
        if resolution == "rejected":
            booking.payout_status = booking.payout_status or PAYOUT_STATUS_PENDING

    recipient_ids = [booking.customer_id]
    barber = db.query(Barber).filter(Barber.id == booking.barber_id).first()
    if barber and barber.user_id:
        recipient_ids.append(barber.user_id)
    create_notifications(
        db,
        user_ids=recipient_ids,
        notification_type="dispute_resolved",
        title="Dispute updated",
        message=(
            f"The dispute for booking #{booking.id} has been marked {resolution}."
        ),
        link=_dashboard_link(dispute=dispute.id, focus="dispute"),
        booking_id=booking.id,
    )
    notify_admins(
        db,
        notification_type="dispute_resolved_admin",
        title="Dispute resolved",
        message=f"Dispute #{dispute.id} for booking #{booking.id} was marked {resolution}.",
        link=f"/admin?{urlencode({'dispute': dispute.id, 'focus': 'dispute'})}",
        booking_id=booking.id,
    )

    db.commit()
    db.refresh(dispute)
    return DisputeResponse.model_validate(dispute)
