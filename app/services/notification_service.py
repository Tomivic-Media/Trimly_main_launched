from datetime import datetime

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User, UserRole


def format_notification_time(value: datetime | None) -> str:
    if not value:
        return "soon"
    return value.strftime("%b %d, %I:%M %p")


def create_notification(
    db: Session,
    *,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    link: str | None = None,
    booking_id: int | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        booking_id=booking_id,
        type=notification_type,
        title=title,
        message=message,
        link=link,
        is_read=False,
    )
    db.add(notification)
    return notification


def create_notifications(
    db: Session,
    *,
    user_ids: list[int],
    notification_type: str,
    title: str,
    message: str,
    link: str | None = None,
    booking_id: int | None = None,
) -> None:
    unique_ids = {int(user_id) for user_id in user_ids if int(user_id or 0) > 0}
    for user_id in unique_ids:
        create_notification(
            db,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            booking_id=booking_id,
        )


def notify_admins(
    db: Session,
    *,
    notification_type: str,
    title: str,
    message: str,
    link: str | None = None,
    booking_id: int | None = None,
) -> None:
    admins = (
        db.query(User.id)
        .filter(
            User.role.in_([UserRole.admin, UserRole.super_admin]),
            User.is_active.is_(True),
            User.admin_approved.is_(True),
        )
        .all()
    )
    create_notifications(
        db,
        user_ids=[row[0] for row in admins],
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
        booking_id=booking_id,
    )
