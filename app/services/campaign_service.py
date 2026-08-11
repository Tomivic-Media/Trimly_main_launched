import json
import random
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.barber import Barber
from app.models.booking import Booking
from app.models.campaign import Campaign, CampaignApplication, CampaignAuditLog, CampaignBarber, CampaignWinner
from app.models.user import User, UserRole
from app.services.notification_service import create_notification, notify_admins
from app.utils.email import send_trimly_html_email

CAMPAIGN_ACTIVE_STATUSES = {"live"}
CAMPAIGN_CLOSED_STATUSES = {"closed", "completed"}
CAMPAIGN_REWARD_VALIDITY_DAYS = 30
CAMPAIGN_ELIGIBLE_SERVICE_MODE = "shop_visit"
CAMPAIGN_ELIGIBLE_SERVICE_LABEL = "Haircut"
DEFAULT_CAMPAIGN_TITLE = "Trimly Free Haircut Campaign"
DEFAULT_CAMPAIGN_DESCRIPTION = (
    "Apply for one free in-shop haircut. Once 50 valid applications are in, "
    "Trimly automatically selects 25 customers and assigns them to participating barbers."
)
DEFAULT_CAMPAIGN_MAX_APPLICATIONS = 50
DEFAULT_CAMPAIGN_MAX_WINNERS = 25
DEFAULT_CAMPAIGN_DURATION_DAYS = 30
DEFAULT_CAMPAIGN_BARBERS = [
    "lakeside barbers",
    "ellabarbera",
    "smart barbers",
    "jam jam in oxygen",
]


def _normalize_barber_label(value: str | None) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _campaign_slug_for_today() -> str:
    return f"free-haircut-campaign-{datetime.utcnow().strftime('%Y%m%d')}"


def ensure_default_live_campaign(db: Session) -> Campaign | None:
    existing_live = (
        db.query(Campaign)
        .filter(Campaign.status == "live")
        .order_by(Campaign.created_at.desc())
        .first()
    )
    if existing_live:
        return existing_live

    now = datetime.utcnow()
    candidate_barbers = db.query(Barber).order_by(Barber.created_at.asc()).all()
    selected_barbers: list[Barber] = []
    seen_ids: set[int] = set()

    for preferred_name in DEFAULT_CAMPAIGN_BARBERS:
        preferred_normalized = _normalize_barber_label(preferred_name)
        match = next(
            (
                barber
                for barber in candidate_barbers
                if barber.id not in seen_ids
                and (
                    preferred_normalized in _normalize_barber_label(barber.shop_name)
                    or preferred_normalized in _normalize_barber_label(barber.barber_name)
                )
            ),
            None,
        )
        if match:
            selected_barbers.append(match)
            seen_ids.add(match.id)

    if not selected_barbers:
        return None

    slug = _campaign_slug_for_today()
    while db.query(Campaign).filter(Campaign.slug == slug).first():
        slug = f"{slug}-{secrets.token_hex(2)}"

    campaign = Campaign(
        title=DEFAULT_CAMPAIGN_TITLE,
        slug=slug,
        description=DEFAULT_CAMPAIGN_DESCRIPTION,
        status="live",
        max_applications=DEFAULT_CAMPAIGN_MAX_APPLICATIONS,
        max_winners=DEFAULT_CAMPAIGN_MAX_WINNERS,
        starts_at=now,
        ends_at=now + timedelta(days=DEFAULT_CAMPAIGN_DURATION_DAYS),
        auto_notify_non_winners=True,
        application_count=0,
        winner_count=0,
    )
    db.add(campaign)
    db.flush()

    for barber in selected_barbers:
        db.add(CampaignBarber(campaign_id=campaign.id, barber_id=barber.id, allocation_count=0))

    log_campaign_event(
        db,
        campaign_id=campaign.id,
        action="campaign_auto_bootstrapped",
        payload={
            "slug": slug,
            "barber_ids": [barber.id for barber in selected_barbers],
            "barber_count": len(selected_barbers),
        },
    )
    db.commit()
    db.refresh(campaign)
    return campaign


def get_live_campaign(db: Session) -> Campaign | None:
    campaign = (
        db.query(Campaign)
        .filter(Campaign.status == "live")
        .order_by(Campaign.created_at.desc())
        .first()
    )
    if not campaign:
        campaign = ensure_default_live_campaign(db)
    if campaign:
        ensure_campaign_selection_if_due(db, campaign)
    return campaign


def log_campaign_event(
    db: Session,
    *,
    campaign_id: int,
    action: str,
    actor_user_id: int | None = None,
    payload: dict | None = None,
) -> None:
    db.add(
        CampaignAuditLog(
            campaign_id=campaign_id,
            actor_user_id=actor_user_id,
            action=action,
            payload_json=json.dumps(payload or {}, default=str),
        )
    )


def campaign_remaining_slots(campaign: Campaign) -> int:
    return max(int(campaign.max_applications or 0) - int(campaign.application_count or 0), 0)


def active_campaign_barbers(db: Session, campaign_id: int) -> list[CampaignBarber]:
    return db.query(CampaignBarber).filter(CampaignBarber.campaign_id == campaign_id).order_by(CampaignBarber.id.asc()).all()


def application_for_user(db: Session, campaign_id: int, user_id: int) -> CampaignApplication | None:
    return (
        db.query(CampaignApplication)
        .filter(CampaignApplication.campaign_id == campaign_id, CampaignApplication.user_id == user_id)
        .first()
    )


def winner_for_user(db: Session, campaign_id: int, user_id: int) -> CampaignWinner | None:
    return (
        db.query(CampaignWinner)
        .filter(CampaignWinner.campaign_id == campaign_id, CampaignWinner.user_id == user_id)
        .first()
    )


def generate_campaign_coupon_code(campaign_slug: str) -> str:
    return f"{campaign_slug[:6].upper()}-{secrets.token_hex(4).upper()}"


def ensure_campaign_selection_if_due(db: Session, campaign: Campaign) -> None:
    if not campaign or campaign.status not in CAMPAIGN_ACTIVE_STATUSES:
        return

    now = datetime.utcnow()
    application_count = (
        db.query(CampaignApplication)
        .filter(CampaignApplication.campaign_id == campaign.id, CampaignApplication.status == "submitted")
        .count()
    )
    campaign.application_count = application_count

    if campaign.selection_ran_at:
        return

    if application_count >= int(campaign.max_applications or 0):
        finalize_campaign_selection(db, campaign, reason="max_applications_reached")
        return

    if campaign.ends_at and now >= campaign.ends_at:
        finalize_campaign_selection(db, campaign, reason="deadline_reached")


def finalize_campaign_selection(db: Session, campaign: Campaign, *, reason: str) -> None:
    if campaign.selection_ran_at:
        return

    applications = (
        db.query(CampaignApplication)
        .filter(CampaignApplication.campaign_id == campaign.id, CampaignApplication.status == "submitted")
        .order_by(CampaignApplication.submitted_at.asc())
        .all()
    )
    if not applications:
        campaign.status = "completed"
        campaign.selection_ran_at = datetime.utcnow()
        campaign.application_count = 0
        campaign.winner_count = 0
        log_campaign_event(db, campaign_id=campaign.id, action="selection_completed_empty", payload={"reason": reason})
        db.commit()
        return

    target_winners = min(int(campaign.max_winners or 0), len(applications))
    selected_applications = applications if len(applications) <= target_winners else random.SystemRandom().sample(applications, target_winners)
    selected_ids = {item.id for item in selected_applications}
    now = datetime.utcnow()

    campaign_barbers = active_campaign_barbers(db, campaign.id)
    if not campaign_barbers:
        raise HTTPException(status_code=400, detail="Campaign has no participating barbers")

    shuffled_selected = list(selected_applications)
    random.SystemRandom().shuffle(shuffled_selected)

    for index, application in enumerate(shuffled_selected):
        assignment = campaign_barbers[index % len(campaign_barbers)]
        barber = db.query(Barber).filter(Barber.id == assignment.barber_id).first()
        if not barber:
            continue
        assignment.allocation_count = int(assignment.allocation_count or 0) + 1
        application.status = "selected"
        application.selected_at = now
        coupon_code = generate_campaign_coupon_code(campaign.slug)
        while db.query(CampaignWinner).filter(CampaignWinner.coupon_code == coupon_code).first():
            coupon_code = generate_campaign_coupon_code(campaign.slug)
        db.add(
            CampaignWinner(
                campaign_id=campaign.id,
                application_id=application.id,
                user_id=application.user_id,
                barber_id=barber.id,
                coupon_code=coupon_code,
                reward_status="issued",
                coupon_expires_at=now + timedelta(days=CAMPAIGN_REWARD_VALIDITY_DAYS),
            )
        )

    for application in applications:
        if application.id not in selected_ids:
            application.status = "not_selected"

    campaign.selection_ran_at = now
    campaign.application_count = len(applications)
    campaign.winner_count = len(selected_ids)
    campaign.status = "completed"

    log_campaign_event(
        db,
        campaign_id=campaign.id,
        action="selection_completed",
        payload={"reason": reason, "applications": len(applications), "winners": len(selected_ids)},
    )
    db.commit()
    notify_campaign_results(db, campaign.id)


def notify_campaign_results(db: Session, campaign_id: int) -> None:
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        return

    winners = (
        db.query(CampaignWinner, CampaignApplication, Barber, User)
        .join(CampaignApplication, CampaignApplication.id == CampaignWinner.application_id)
        .join(Barber, Barber.id == CampaignWinner.barber_id)
        .join(User, User.id == CampaignWinner.user_id)
        .filter(CampaignWinner.campaign_id == campaign_id)
        .all()
    )
    for winner, application, barber, user in winners:
        barber_name = barber.barber_name or barber.shop_name
        create_notification(
            db,
            user_id=user.id,
            notification_type="campaign_winner",
            title="You were selected for a free haircut",
            message=f"You were selected for {campaign.title}. Your assigned barber is {barber_name}.",
            link="/free-haircut-campaign/reward",
        )
        try:
            send_trimly_html_email(
                to_email=user.email,
                subject="You were selected for a free Trimly haircut",
                html=(
                    f"<div style='font-family:Arial,sans-serif;padding:24px;color:#143b2e;'>"
                    f"<h2>You were selected for a free haircut</h2>"
                    f"<p>Hello {application.first_name},</p>"
                    f"<p>You made it into the selected Trimly campaign winners.</p>"
                    f"<p><strong>Assigned barber:</strong> {barber_name}</p>"
                    f"<p><strong>Coupon code:</strong> {winner.coupon_code}</p>"
                    f"<p><strong>Valid until:</strong> {winner.coupon_expires_at.strftime('%b %d, %Y')}</p>"
                    f"<p>Log in to Trimly to book your in-shop haircut. The reward also applies automatically on your account.</p>"
                    f"</div>"
                ),
            )
        except Exception:
            pass

    if campaign.auto_notify_non_winners:
        selected_app_ids = [winner.application_id for winner, *_ in winners]
        non_winners = (
            db.query(CampaignApplication, User)
            .join(User, User.id == CampaignApplication.user_id)
            .filter(CampaignApplication.campaign_id == campaign_id, CampaignApplication.status == "not_selected")
            .all()
        )
        for application, user in non_winners:
            create_notification(
                db,
                user_id=user.id,
                notification_type="campaign_not_selected",
                title="Campaign update",
                message="Thanks for applying. This round is full and you were not selected.",
                link="/free-haircut-campaign",
            )
            try:
                send_trimly_html_email(
                    to_email=user.email,
                    subject="Trimly campaign update",
                    html=(
                        "<div style='font-family:Arial,sans-serif;padding:24px;color:#143b2e;'>"
                        "<h2>Trimly campaign update</h2>"
                        "<p>Thanks for applying. This round is full and you were not selected.</p>"
                        "</div>"
                    ),
                )
            except Exception:
                pass

    notify_admins(
        db,
        notification_type="campaign_selection_completed",
        title="Campaign selection completed",
        message=f"{campaign.title} selection completed with {campaign.winner_count} winners.",
        link="/admin",
    )
    db.commit()


def get_customer_campaign_reward(db: Session, user_id: int, barber_id: int | None = None, coupon_code: str | None = None) -> CampaignWinner | None:
    query = db.query(CampaignWinner).filter(CampaignWinner.user_id == user_id)
    if barber_id:
        query = query.filter(CampaignWinner.barber_id == barber_id)
    if coupon_code:
        query = query.filter(CampaignWinner.coupon_code == coupon_code)
    winner = query.order_by(CampaignWinner.created_at.desc()).first()
    if not winner:
        return None
    if winner.reward_status in {"redeemed", "revoked", "expired"}:
        return None
    if winner.coupon_expires_at and winner.coupon_expires_at < datetime.utcnow():
        winner.reward_status = "expired"
        db.commit()
        return None
    return winner


def validate_campaign_reward_for_booking(
    db: Session,
    *,
    current_user: User,
    barber_id: int,
    selected_service_mode: str,
    campaign_coupon_code: str | None = None,
) -> CampaignWinner | None:
    reward = get_customer_campaign_reward(db, current_user.id, barber_id=barber_id, coupon_code=campaign_coupon_code)
    if not reward and campaign_coupon_code:
        raise HTTPException(status_code=400, detail="Invalid or expired campaign coupon code")
    if not reward:
        return None
    if selected_service_mode != CAMPAIGN_ELIGIBLE_SERVICE_MODE:
        raise HTTPException(status_code=400, detail="This campaign reward is only valid for in-shop bookings")
    return reward


def redeem_campaign_reward(db: Session, reward: CampaignWinner, booking: Booking) -> None:
    reward.reward_status = "redeemed"
    reward.redeemed_at = datetime.utcnow()
    reward.booking_id = booking.id
    log_campaign_event(
        db,
        campaign_id=reward.campaign_id,
        action="reward_redeemed",
        actor_user_id=reward.user_id,
        payload={"booking_id": booking.id, "barber_id": reward.barber_id},
    )
