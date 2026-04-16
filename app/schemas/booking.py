from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.enums.booking_status import BookingStatus
from app.enums.payment_status import PaymentStatus


class BookingCreate(BaseModel):
    barber_id: int
    scheduled_time: datetime
    service_name: Optional[str] = "Haircut"
    service_ids: list[int] = Field(default_factory=list)


class BookingServiceSelection(BaseModel):
    service_id: int
    name: str
    price: float
    duration_minutes: int = 60
    is_home_service: bool = False


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: int
    customer_id: int
    barber_id: int
    scheduled_time: datetime
    service_name: str = "Haircut"

    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    barber_user_id: Optional[int] = None
    barber_name: Optional[str] = None
    barber_location: Optional[str] = None
    review_exists: bool = False
    review_id: Optional[int] = None
    service_ids: list[int] = Field(default_factory=list)
    selected_services: list[BookingServiceSelection] = Field(default_factory=list)

    price: float
    commission_amount: Optional[float] = 0
    barber_earnings: Optional[float] = 0
    escrow_amount: Optional[float] = None
    barber_payout_amount: Optional[float] = None
    escrow_released: bool = False
    refund_requested: bool = False

    status: BookingStatus

    payment_status: PaymentStatus = PaymentStatus.unpaid
    payment_reference: Optional[str] = None
    paid_at: Optional[datetime] = None

    payout_status: Optional[str] = None
    transfer_reference: Optional[str] = None
    transferred_at: Optional[datetime] = None

    created_at: Optional[datetime] = None
