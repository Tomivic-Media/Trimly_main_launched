from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_type: str
    user_agent: str | None = None
    ip_address: str | None = None
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None
    is_current: bool = False


class SessionListResponse(BaseModel):
    items: list[UserSessionResponse]


class SessionRevokeResponse(BaseModel):
    message: str
