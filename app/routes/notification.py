from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.schemas.notification import (
    NotificationListResponse,
    NotificationMarkReadResponse,
    NotificationResponse,
)
from app.services.reminder_service import dispatch_due_booking_reminders

router = APIRouter()


def _unread_count(db: Session, user_id: int) -> int:
    return db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read.is_(False)).count()


@router.get("/notifications", response_model=NotificationListResponse)
def list_notifications(
    limit: int = Query(default=12, ge=1, le=50),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dispatch_due_booking_reminders(db)
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    items = query.order_by(Notification.is_read.asc(), Notification.created_at.desc()).limit(limit).all()
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(item) for item in items],
        unread_count=_unread_count(db, current_user.id),
    )


@router.patch("/notifications/{notification_id}/read", response_model=NotificationMarkReadResponse)
def mark_notification_read(
    notification_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    return NotificationMarkReadResponse(
        message="Notification marked as read",
        unread_count=_unread_count(db, current_user.id),
    )


@router.patch("/notifications/read-all", response_model=NotificationMarkReadResponse)
def mark_all_notifications_read(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read.is_(False),
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return NotificationMarkReadResponse(
        message="All notifications marked as read",
        unread_count=0,
    )
