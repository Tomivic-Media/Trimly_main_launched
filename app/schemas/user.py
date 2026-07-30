from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.core.config import PASSWORD_MIN_LENGTH
from app.models.user import UserRole


def _validate_password_strength(value: str) -> str:
    password = str(value or "")
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters")
    if not any(char.islower() for char in password):
        raise ValueError("Password must include at least one lowercase letter")
    if not any(char.isupper() for char in password):
        raise ValueError("Password must include at least one uppercase letter")
    if not any(char.isdigit() for char in password):
        raise ValueError("Password must include at least one number")
    return password


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: UserRole = UserRole.customer
    accepted_terms: bool
    referral_code: Optional[str] = None

    _validate_password = field_validator("password")(_validate_password_strength)


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    phone: Optional[str]
    role: UserRole
    accepted_terms: bool
    admin_approved: bool
    referral_code: Optional[str] = None
    loyalty_points: int = 0

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class CurrentUserResponse(BaseModel):
    logged_in_as: EmailStr
    role: UserRole
    full_name: str
    phone: Optional[str] = None
    address_line: Optional[str] = None
    address_area: Optional[str] = None
    address_landmark: Optional[str] = None
    address_note: Optional[str] = None
    accepted_terms: bool
    admin_approved: bool
    referral_code: Optional[str] = None
    loyalty_points: int = 0


class AdminAccountCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: UserRole

    _validate_password = field_validator("password")(_validate_password_strength)


class AdminApprovalUpdate(BaseModel):
    approved: bool


class AdminUserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    phone: Optional[str]
    role: UserRole
    admin_approved: bool
    approved_by_user_id: Optional[int] = None

    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    _validate_password = field_validator("new_password")(_validate_password_strength)


class ResetPasswordResponse(BaseModel):
    message: str


class UserProfileUpdateRequest(BaseModel):
    full_name: str
    phone: Optional[str] = None
    address_line: Optional[str] = None
    address_area: Optional[str] = None
    address_landmark: Optional[str] = None
    address_note: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    _validate_password = field_validator("new_password")(_validate_password_strength)


class ChangePasswordResponse(BaseModel):
    message: str
