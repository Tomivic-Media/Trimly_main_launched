from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    review_text: Optional[str] = None


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int
    customer_id: int
    barber_id: int
    rating: int
    review_text: Optional[str] = None
    is_visible: bool = True
    admin_note: Optional[str] = None
    customer_name: Optional[str] = None
    service_name: Optional[str] = None
    created_at: Optional[datetime] = None


class ReviewModerationUpdate(BaseModel):
    action: str
    admin_note: Optional[str] = None


class ReviewListResponse(BaseModel):
    items: list[ReviewResponse] = Field(default_factory=list)
    average_rating: float = 0
    review_count: int = 0

