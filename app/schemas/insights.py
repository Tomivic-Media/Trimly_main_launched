from pydantic import BaseModel


class CustomerInsightsResponse(BaseModel):
    total_appointments: int
    completed_haircuts: int
    favorite_barbers: int
    loyalty_points: int
    referral_code: str | None = None
    referrals_joined: int
    referrals_rewarded: int


class BarberInsightsResponse(BaseModel):
    total_bookings: int
    completed_jobs: int
    pending_requests: int
    today_earnings: float
    weekly_earnings: float
    lifetime_earnings: float
    awaiting_payout_review: float
    average_rating: float
    review_count: int


class PayoutReportItem(BaseModel):
    booking_id: int
    scheduled_time: str | None = None
    customer_name: str | None = None
    barber_name: str | None = None
    amount: float
    commission_amount: float
    barber_payout_amount: float
    payment_status: str
    booking_status: str
    payout_status: str | None = None
    paid_at: str | None = None


class PayoutReportResponse(BaseModel):
    total_volume: float
    total_commission: float
    total_barber_payout: float
    items: list[PayoutReportItem]


class ReferralSummaryResponse(BaseModel):
    referral_code: str | None = None
    referred_by_user_id: int | None = None
    referrals_joined: int
    referrals_rewarded: int
    loyalty_points: int
