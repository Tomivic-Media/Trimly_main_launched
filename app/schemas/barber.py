from datetime import datetime, time
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class BarberServiceCreate(BaseModel):
    name: str
    price: float
    duration_minutes: int = 60
    is_home_service: bool = False
    is_active: bool = True


class BarberServiceUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None


class BarberServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    barber_id: int
    name: str
    price: float
    duration_minutes: int = 60
    is_home_service: bool = False
    is_active: bool = True


class BarberCreate(BaseModel):
    shop_name: str
    location: str
    shop_address: Optional[str] = None
    shop_landmark: Optional[str] = None
    bio: Optional[str] = None
    haircut_price: float
    beard_trim_price: Optional[float] = None
    other_services: Optional[str] = None
    barber_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    portfolio_image_urls: list[str] = Field(default_factory=list)
    available_days: list[str] = Field(default_factory=list)
    available_start_time: Optional[time] = None
    available_end_time: Optional[time] = None
    is_available: bool = True


class BarberProfileUpdate(BaseModel):
    shop_name: str
    location: str
    shop_address: Optional[str] = None
    shop_landmark: Optional[str] = None
    bio: Optional[str] = None
    haircut_price: float
    beard_trim_price: Optional[float] = None
    other_services: Optional[str] = None
    barber_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    portfolio_image_urls: list[str] = Field(default_factory=list)


class BarberAvailabilityUpdate(BaseModel):
    available_days: list[str] = Field(default_factory=list)
    available_start_time: time
    available_end_time: time


class BarberStatusUpdate(BaseModel):
    is_available: bool


class BarberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    shop_name: str
    location: str
    shop_address: Optional[str] = None
    shop_landmark: Optional[str] = None
    bio: Optional[str] = None
    haircut_price: float
    beard_trim_price: Optional[float] = None
    other_services: Optional[str] = None
    barber_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    portfolio_image_urls: list[str] = Field(default_factory=list)
    is_available: bool
    kyc_status: str
    kyc_submitted_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    available_days: list[str] = Field(default_factory=list)
    available_start_time: Optional[time] = None
    available_end_time: Optional[time] = None
    average_rating: float = 0
    review_count: int = 0
    hidden_review_count: int = 0
    paystack_subaccount_code: Optional[str] = None
    services: list[BarberServiceResponse] = Field(default_factory=list)


class BarberPublicResponse(BarberResponse):
    user_id: int
    email: Optional[str] = None


class BarberKYCSubmit(BaseModel):
    phone_number: str
    shop_address: str
    shop_photo_url: str
    bank_account_number: str
    bank_name: str
    account_name: str


class BarberKYCResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    barber_id: int
    phone_number: str
    shop_address: str
    shop_photo_url: str
    bank_account_number: str
    bank_name: str
    account_name: str
    created_at: Optional[datetime] = None


class BarberVerificationUpdate(BaseModel):
    action: str
    rejection_reason: Optional[str] = None


class AdminBarberReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    barber_id: int
    user_id: int
    barber_name: Optional[str] = None
    shop_name: str
    email: Optional[str] = None
    location: str
    public_shop_address: Optional[str] = None
    public_shop_landmark: Optional[str] = None
    bio: Optional[str] = None
    haircut_price: float
    beard_trim_price: Optional[float] = None
    other_services: Optional[str] = None
    profile_image_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    portfolio_image_urls: list[str] = Field(default_factory=list)
    is_available: bool
    kyc_status: str
    kyc_submitted_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    available_days: list[str] = Field(default_factory=list)
    available_start_time: Optional[time] = None
    available_end_time: Optional[time] = None
    phone_number: Optional[str] = None
    shop_address: Optional[str] = None
    shop_photo_url: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    average_rating: float = 0
    review_count: int = 0
    hidden_review_count: int = 0
    paystack_subaccount_code: Optional[str] = None
    services: list[BarberServiceResponse] = Field(default_factory=list)
