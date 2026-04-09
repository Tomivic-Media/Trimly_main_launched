from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user, require_any_role
from app.db.session import get_db
from app.enums.booking_status import BookingStatus
from app.models.barber import Barber
from app.models.booking import Booking
from app.models.review import Review
from app.models.user import UserRole
from app.schemas.review import ReviewCreate, ReviewListResponse, ReviewModerationUpdate, ReviewResponse
from app.services.notification_service import create_notifications, notify_admins

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


def _serialize_review(review: Review) -> ReviewResponse:
    return ReviewResponse(
        id=review.id,
        booking_id=review.booking_id,
        customer_id=review.customer_id,
        barber_id=review.barber_id,
        rating=review.rating,
        review_text=review.review_text,
        is_visible=bool(review.is_visible),
        admin_note=review.admin_note,
        customer_name=review.customer.full_name if review.customer else None,
        service_name=review.booking.service_name if review.booking else None,
        created_at=review.created_at,
    )


def _review_list_payload(reviews: list[Review]) -> ReviewListResponse:
    visible = [review for review in reviews if bool(review.is_visible)]
    average = round(sum(review.rating for review in visible) / len(visible), 1) if visible else 0
    return ReviewListResponse(
        items=[_serialize_review(review) for review in reviews],
        average_rating=average,
        review_count=len(visible),
    )


@router.post("/bookings/{booking_id}/review", response_model=ReviewResponse)
def create_booking_review(
    booking_id: int,
    payload: ReviewCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _normalize_role(current_user.role) != UserRole.customer.value:
        raise HTTPException(status_code=403, detail="Only customers can leave reviews")

    booking = (
        db.query(Booking)
        .options(joinedload(Booking.barber).joinedload(Barber.user), joinedload(Booking.review))
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if str(booking.status.value if hasattr(booking.status, "value") else booking.status).lower() != BookingStatus.completed.value:
        raise HTTPException(status_code=400, detail="Reviews can only be left after a completed booking")
    if booking.review:
        raise HTTPException(status_code=400, detail="You have already reviewed this booking")

    review = Review(
        booking_id=booking.id,
        customer_id=current_user.id,
        barber_id=booking.barber_id,
        rating=payload.rating,
        review_text=(payload.review_text or "").strip() or None,
        is_visible=True,
    )
    db.add(review)
    db.flush()

    recipient_ids = []
    if booking.barber and booking.barber.user_id:
        recipient_ids.append(booking.barber.user_id)

    create_notifications(
        db,
        user_ids=recipient_ids,
        notification_type="review_created",
        title="New customer review",
        message=f"{current_user.full_name} left a {payload.rating}-star review on your completed booking.",
        link=f"/static/barber-profile.html?id={booking.barber_id}",
        booking_id=booking.id,
    )
    notify_admins(
        db,
        notification_type="review_created_admin",
        title="New barber review submitted",
        message=f"A {payload.rating}-star review was submitted for barber #{booking.barber_id}.",
        link=f"/admin?barber={booking.barber_id}&focus=reviews",
        booking_id=booking.id,
    )

    db.commit()
    db.refresh(review)
    return _serialize_review(review)


@router.get("/barbers/{barber_id}/reviews", response_model=ReviewListResponse)
def get_barber_reviews(barber_id: int, db: Session = Depends(get_db)):
    reviews = (
        db.query(Review)
        .options(joinedload(Review.customer), joinedload(Review.booking))
        .filter(Review.barber_id == barber_id, Review.is_visible.is_(True))
        .order_by(Review.created_at.desc())
        .all()
    )
    return _review_list_payload(reviews)


@router.get("/admin/reviews", response_model=ReviewListResponse)
def get_admin_reviews(
    barber_id: int | None = Query(default=None),
    visibility: str = Query(default="all"),
    current_user=Depends(require_any_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Review)
        .options(joinedload(Review.customer), joinedload(Review.booking))
        .order_by(Review.created_at.desc())
    )
    if barber_id:
        query = query.filter(Review.barber_id == barber_id)

    normalized_visibility = str(visibility or "all").lower()
    if normalized_visibility == "visible":
        query = query.filter(Review.is_visible.is_(True))
    elif normalized_visibility == "hidden":
        query = query.filter(Review.is_visible.is_(False))

    reviews = query.all()
    return _review_list_payload(reviews)


@router.patch("/admin/reviews/{review_id}", response_model=ReviewResponse)
def moderate_review(
    review_id: int,
    payload: ReviewModerationUpdate,
    current_user=Depends(require_any_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    review = (
        db.query(Review)
        .options(joinedload(Review.customer), joinedload(Review.booking), joinedload(Review.barber).joinedload(Barber.user))
        .filter(Review.id == review_id)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    action = str(payload.action or "").strip().lower()
    if action not in {"hide", "show"}:
        raise HTTPException(status_code=400, detail="Action must be hide or show")

    review.is_visible = action == "show"
    review.admin_note = (payload.admin_note or "").strip() or None

    if review.barber and review.barber.user_id:
        create_notifications(
            db,
            user_ids=[review.barber.user_id],
            notification_type="review_moderated",
            title="Review visibility updated",
            message=(
                "One of your customer reviews has been hidden by admin review."
                if action == "hide"
                else "A customer review on your profile has been restored."
            ),
            link=f"/static/barber-profile.html?id={review.barber_id}",
            booking_id=review.booking_id,
        )

    notify_admins(
        db,
        notification_type="review_moderated_admin",
        title="Review moderation updated",
        message=(
            f"Review #{review.id} was hidden by {_normalize_role(current_user.role)}."
            if action == "hide"
            else f"Review #{review.id} was made visible again."
        ),
        link=f"/admin?barber={review.barber_id}&focus=reviews",
        booking_id=review.booking_id,
    )

    db.commit()
    db.refresh(review)
    return _serialize_review(review)
