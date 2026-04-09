from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DisputeCreate(BaseModel):
    booking_id: int
    reason: str


class DisputeResolveRequest(BaseModel):
    resolution: str
    admin_note: Optional[str] = None


class DisputeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int
    customer_id: int
    barber_id: int
    reason: str
    status: str
    admin_note: Optional[str] = None
    created_at: datetime
