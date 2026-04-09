from datetime import datetime

from pydantic import BaseModel, ConfigDict
from typing import Optional


class ChatMessageCreate(BaseModel):
    booking_id: int | None = None
    receiver_id: int | None = None
    content: str | None = None
    message: str | None = None


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int
    sender_id: int
    receiver_id: Optional[int] = None
    sender_user_id: int
    sender_role: str
    sender_name: str
    content: str
    message: str
    created_at: datetime
