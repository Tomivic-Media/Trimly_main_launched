from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CampaignCreateRequest(BaseModel):
    title: str
    slug: str = "free-haircut-campaign"
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime
    barber_ids: list[int] = Field(default_factory=list)
    max_applications: int = 50
    max_winners: int = 25
    auto_notify_non_winners: bool = True


class CampaignPublicResponse(BaseModel):
    id: int
    title: str
    slug: str
    description: str | None = None
    status: str
    max_applications: int
    max_winners: int
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    application_count: int
    winner_count: int
    remaining_slots: int
    participating_barbers: list[dict] = Field(default_factory=list)


class CampaignApplicationCreate(BaseModel):
    first_name: str
    surname: str
    address: str
    email: EmailStr
    phone: str | None = None
    social_handles: str | None = None
    how_heard_about_us: str


class CampaignApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    user_id: int
    email: EmailStr
    first_name: str
    surname: str
    address: str
    phone: str | None = None
    social_handles: str | None = None
    how_heard_about_us: str
    status: str
    submitted_at: datetime
    selected_at: datetime | None = None


class CampaignWinnerResponse(BaseModel):
    id: int
    campaign_id: int
    application_id: int
    user_id: int
    barber_id: int
    barber_name: str | None = None
    barber_shop_name: str | None = None
    coupon_code: str
    reward_status: str
    coupon_expires_at: datetime | None = None
    redeemed_at: datetime | None = None
    booking_id: int | None = None


class CampaignStatusResponse(BaseModel):
    has_live_campaign: bool
    campaign: CampaignPublicResponse | None = None
    already_applied: bool = False
    application_status: str | None = None
    selected: bool = False
    not_selected: bool = False
    reward_status: str | None = None
    assigned_barber_id: int | None = None
    assigned_barber_name: str | None = None
    assigned_barber_shop_name: str | None = None
    coupon_code: str | None = None
    coupon_expires_at: datetime | None = None


class CampaignAdminDetailResponse(BaseModel):
    campaign: CampaignPublicResponse
    applications: list[CampaignApplicationResponse] = Field(default_factory=list)
    winners: list[CampaignWinnerResponse] = Field(default_factory=list)
    audit_logs: list[dict] = Field(default_factory=list)
