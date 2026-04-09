from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: UserRole = UserRole.customer
    accepted_terms: bool
    referral_code: Optional[str] = None


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


class ResetPasswordResponse(BaseModel):
    message: str


class UserProfileUpdateRequest(BaseModel):
    full_name: str
    phone: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ChangePasswordResponse(BaseModel):
    message: str
