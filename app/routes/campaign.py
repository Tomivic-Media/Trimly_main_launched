from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_any_role
from app.db.session import get_db
from app.models.barber import Barber
from app.models.campaign import Campaign, CampaignApplication, CampaignAuditLog, CampaignBarber, CampaignWinner
from app.models.user import User, UserRole
from app.schemas.campaign import (
    CampaignAdminDetailResponse,
    CampaignApplicationCreate,
    CampaignApplicationResponse,
    CampaignCreateRequest,
    CampaignPublicResponse,
    CampaignStatusResponse,
    CampaignWinnerResponse,
)
from app.services.campaign_service import (
    application_for_user,
    campaign_remaining_slots,
    ensure_campaign_selection_if_due,
    get_live_campaign,
    log_campaign_event,
    winner_for_user,
)

router = APIRouter()


def _normalize_role(role_value) -> str:
    if hasattr(role_value, "value"):
        return str(role_value.value).lower()
    return str(role_value or "").lower()


def _serialize_campaign_public(db: Session, campaign: Campaign) -> CampaignPublicResponse:
    campaign_barbers = (
        db.query(CampaignBarber, Barber)
        .join(Barber, Barber.id == CampaignBarber.barber_id)
        .filter(CampaignBarber.campaign_id == campaign.id)
        .all()
    )
    participating = [
        {
            "barber_id": barber.id,
            "shop_name": barber.shop_name,
            "barber_name": barber.barber_name,
            "location": barber.location,
            "allocation_count": item.allocation_count,
        }
        for item, barber in campaign_barbers
    ]
    campaign.application_count = (
        db.query(CampaignApplication)
        .filter(CampaignApplication.campaign_id == campaign.id)
        .count()
    )
    campaign.winner_count = db.query(CampaignWinner).filter(CampaignWinner.campaign_id == campaign.id).count()
    return CampaignPublicResponse(
        id=campaign.id,
        title=campaign.title,
        slug=campaign.slug,
        description=campaign.description,
        status=campaign.status,
        max_applications=campaign.max_applications,
        max_winners=campaign.max_winners,
        starts_at=campaign.starts_at,
        ends_at=campaign.ends_at,
        application_count=campaign.application_count,
        winner_count=campaign.winner_count,
        remaining_slots=campaign_remaining_slots(campaign),
        participating_barbers=participating,
    )


def _serialize_winner(db: Session, winner: CampaignWinner) -> CampaignWinnerResponse:
    barber = db.query(Barber).filter(Barber.id == winner.barber_id).first()
    return CampaignWinnerResponse(
        id=winner.id,
        campaign_id=winner.campaign_id,
        application_id=winner.application_id,
        user_id=winner.user_id,
        barber_id=winner.barber_id,
        barber_name=barber.barber_name if barber else None,
        barber_shop_name=barber.shop_name if barber else None,
        coupon_code=winner.coupon_code,
        reward_status=winner.reward_status,
        coupon_expires_at=winner.coupon_expires_at,
        redeemed_at=winner.redeemed_at,
        booking_id=winner.booking_id,
    )


def _resolve_customer_campaign_for_status(db: Session, current_user: User) -> Campaign | None:
    live_campaign = get_live_campaign(db)
    if live_campaign:
        return live_campaign

    winner_campaign = (
        db.query(Campaign)
        .join(CampaignWinner, CampaignWinner.campaign_id == Campaign.id)
        .filter(CampaignWinner.user_id == current_user.id)
        .order_by(Campaign.created_at.desc())
        .first()
    )
    if winner_campaign:
        return winner_campaign

    applied_campaign = (
        db.query(Campaign)
        .join(CampaignApplication, CampaignApplication.campaign_id == Campaign.id)
        .filter(CampaignApplication.user_id == current_user.id)
        .order_by(Campaign.created_at.desc())
        .first()
    )
    if applied_campaign:
        return applied_campaign

    return (
        db.query(Campaign)
        .order_by(Campaign.created_at.desc())
        .first()
    )


@router.get("/campaigns/active/public", response_model=CampaignStatusResponse)
def get_active_campaign_public(db: Session = Depends(get_db)):
    campaign = get_live_campaign(db)
    if not campaign:
        return CampaignStatusResponse(has_live_campaign=False)
    return CampaignStatusResponse(has_live_campaign=True, campaign=_serialize_campaign_public(db, campaign))


@router.get("/campaigns/active/status", response_model=CampaignStatusResponse)
def get_active_campaign_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = _resolve_customer_campaign_for_status(db, current_user)
    if not campaign:
        return CampaignStatusResponse(has_live_campaign=False)

    application = application_for_user(db, campaign.id, current_user.id)
    winner = winner_for_user(db, campaign.id, current_user.id)
    assigned_barber = db.query(Barber).filter(Barber.id == winner.barber_id).first() if winner else None

    if winner and winner.reward_status == "issued":
        winner.reward_status = "viewed"
        db.commit()

    return CampaignStatusResponse(
        has_live_campaign=True,
        campaign=_serialize_campaign_public(db, campaign),
        already_applied=bool(application),
        application_status=application.status if application else None,
        selected=bool(winner),
        not_selected=bool(application and application.status == "not_selected"),
        reward_status=winner.reward_status if winner else None,
        assigned_barber_id=winner.barber_id if winner else None,
        assigned_barber_name=assigned_barber.barber_name if assigned_barber else None,
        assigned_barber_shop_name=assigned_barber.shop_name if assigned_barber else None,
        coupon_code=winner.coupon_code if winner else None,
        coupon_expires_at=winner.coupon_expires_at if winner else None,
    )


@router.post("/campaigns/active/apply", response_model=CampaignApplicationResponse)
def apply_to_active_campaign(
    payload: CampaignApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _normalize_role(current_user.role) != UserRole.customer.value:
        raise HTTPException(status_code=403, detail="Only customer accounts can apply")
    if str(payload.email or "").strip().lower() != str(current_user.email or "").strip().lower():
        raise HTTPException(status_code=400, detail="Use the same email address as your Trimly account to apply.")

    campaign = get_live_campaign(db)
    if not campaign:
        raise HTTPException(status_code=404, detail="No live campaign available right now")

    ensure_campaign_selection_if_due(db, campaign)
    if campaign.status != "live":
        raise HTTPException(status_code=400, detail="This campaign is no longer accepting applications")

    if campaign.ends_at and datetime.utcnow() >= campaign.ends_at:
        raise HTTPException(status_code=400, detail="This campaign has already closed")

    if application_for_user(db, campaign.id, current_user.id):
        raise HTTPException(status_code=400, detail="You have already applied for this campaign.")

    duplicate_email = (
        db.query(CampaignApplication)
        .filter(CampaignApplication.campaign_id == campaign.id, CampaignApplication.email == current_user.email)
        .first()
    )
    if duplicate_email:
        raise HTTPException(status_code=400, detail="You have already applied for this campaign.")

    current_count = db.query(CampaignApplication).filter(CampaignApplication.campaign_id == campaign.id).count()
    if current_count >= campaign.max_applications:
        raise HTTPException(status_code=400, detail="This campaign is now full.")

    application = CampaignApplication(
        campaign_id=campaign.id,
        user_id=current_user.id,
        email=current_user.email,
        first_name=payload.first_name.strip(),
        surname=payload.surname.strip(),
        address=payload.address.strip(),
        phone=(payload.phone or current_user.phone or "").strip() or None,
        social_handles=(payload.social_handles or "").strip() or None,
        how_heard_about_us=payload.how_heard_about_us.strip(),
        status="submitted",
    )
    db.add(application)
    db.flush()
    campaign.application_count = current_count + 1
    log_campaign_event(
        db,
        campaign_id=campaign.id,
        actor_user_id=current_user.id,
        action="application_submitted",
        payload={"application_id": application.id, "email": current_user.email},
    )
    db.commit()
    db.refresh(application)

    ensure_campaign_selection_if_due(db, campaign)

    return CampaignApplicationResponse.model_validate(application)


@router.get("/admin/campaigns", response_model=list[CampaignPublicResponse])
def list_campaigns(
    current_user: User = Depends(require_any_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).all()
    return [_serialize_campaign_public(db, item) for item in campaigns]


@router.post("/admin/campaigns", response_model=CampaignPublicResponse)
def create_campaign(
    payload: CampaignCreateRequest,
    current_user: User = Depends(require_any_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    live_campaign = db.query(Campaign).filter(Campaign.status == "live").first()
    if live_campaign:
        raise HTTPException(status_code=400, detail="A live campaign already exists. Complete or close it before creating another one.")
    existing = db.query(Campaign).filter(Campaign.slug == payload.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="A campaign with this slug already exists")
    if len(payload.barber_ids) < 1:
        raise HTTPException(status_code=400, detail="Select at least one participating barber")

    campaign = Campaign(
        title=payload.title.strip(),
        slug=payload.slug.strip(),
        description=(payload.description or "").strip() or None,
        status="live",
        max_applications=payload.max_applications,
        max_winners=payload.max_winners,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        auto_notify_non_winners=payload.auto_notify_non_winners,
        created_by_admin_id=current_user.id,
    )
    db.add(campaign)
    db.flush()

    added_barber_ids: set[int] = set()
    for barber_id in payload.barber_ids:
        barber = db.query(Barber).filter(Barber.id == barber_id).first()
        if not barber:
            continue
        db.add(CampaignBarber(campaign_id=campaign.id, barber_id=barber.id))
        added_barber_ids.add(barber.id)

    if not added_barber_ids:
        db.delete(campaign)
        db.commit()
        raise HTTPException(status_code=400, detail="None of the selected barbers could be added to this campaign")

    log_campaign_event(db, campaign_id=campaign.id, actor_user_id=current_user.id, action="campaign_created")
    db.commit()
    db.refresh(campaign)
    return _serialize_campaign_public(db, campaign)


@router.get("/admin/campaigns/{campaign_id}", response_model=CampaignAdminDetailResponse)
def get_campaign_detail(
    campaign_id: int,
    current_user: User = Depends(require_any_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    ensure_campaign_selection_if_due(db, campaign)
    applications = (
        db.query(CampaignApplication)
        .filter(CampaignApplication.campaign_id == campaign.id)
        .order_by(CampaignApplication.submitted_at.asc())
        .all()
    )
    winners = (
        db.query(CampaignWinner)
        .filter(CampaignWinner.campaign_id == campaign.id)
        .order_by(CampaignWinner.created_at.asc())
        .all()
    )
    logs = (
        db.query(CampaignAuditLog)
        .filter(CampaignAuditLog.campaign_id == campaign.id)
        .order_by(CampaignAuditLog.created_at.desc())
        .all()
    )
    return CampaignAdminDetailResponse(
        campaign=_serialize_campaign_public(db, campaign),
        applications=[CampaignApplicationResponse.model_validate(item) for item in applications],
        winners=[_serialize_winner(db, item) for item in winners],
        audit_logs=[
            {
                "id": log.id,
                "action": log.action,
                "actor_user_id": log.actor_user_id,
                "payload_json": log.payload_json,
                "created_at": log.created_at,
            }
            for log in logs
        ],
    )
