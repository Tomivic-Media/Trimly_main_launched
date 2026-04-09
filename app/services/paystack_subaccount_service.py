import re
from typing import Any

import requests

from app.core.config import PAYSTACK_SECRET_KEY
from app.models.barber import Barber
from app.models.barber_kyc import BarberKYC
from app.models.user import User
from app.services.escrow_service import COMMISSION_RATE


def _headers() -> dict[str, str]:
    if not PAYSTACK_SECRET_KEY:
        raise RuntimeError("PAYSTACK_SECRET_KEY is not configured")
    return {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }


def _normalize_bank_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def resolve_bank_code(bank_value: str) -> str:
    raw_value = str(bank_value or "").strip()
    if not raw_value:
        raise RuntimeError("Bank name is required for Paystack subaccount creation")

    if raw_value.isdigit():
        return raw_value

    response = requests.get(
        "https://api.paystack.co/bank",
        headers=_headers(),
        params={"country": "nigeria", "currency": "NGN"},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    banks = payload.get("data") or []
    normalized_target = _normalize_bank_token(raw_value)

    for bank in banks:
        code = str(bank.get("code") or "").strip()
        name = _normalize_bank_token(str(bank.get("name") or ""))
        slug = _normalize_bank_token(str(bank.get("slug") or ""))
        if normalized_target == code or normalized_target in name or normalized_target in slug:
            return code

    raise RuntimeError(f"Could not resolve bank code for '{raw_value}'")


def create_paystack_subaccount(barber: Barber, user: User, kyc: BarberKYC) -> dict[str, Any]:
    if not kyc.bank_name:
        raise RuntimeError("Bank name is missing")
    if not kyc.bank_account_number:
        raise RuntimeError("Bank account number is missing")

    bank_code = resolve_bank_code(kyc.bank_name)
    business_name = str(barber.shop_name or barber.barber_name or user.full_name or "Trimly Barber").strip()

    payload = {
        "business_name": business_name,
        "bank_code": bank_code,
        "account_number": str(kyc.bank_account_number).strip(),
        "percentage_charge": round(COMMISSION_RATE * 100, 2),
        "description": f"Trimly barber subaccount for {business_name}",
        "primary_contact_email": user.email,
        "primary_contact_name": str(kyc.account_name or user.full_name or business_name).strip(),
        "primary_contact_phone": str(kyc.phone_number or user.phone or "").strip() or None,
        "metadata": {
            "barber_id": barber.id,
            "user_id": barber.user_id,
            "shop_name": barber.shop_name,
        },
    }

    response = requests.post(
        "https://api.paystack.co/subaccount",
        json=payload,
        headers=_headers(),
        timeout=30,
    )

    try:
        result = response.json()
    except ValueError as exc:
        raise RuntimeError("Paystack returned an invalid subaccount response") from exc

    if response.status_code >= 400:
        raise RuntimeError(result.get("message") or response.text or "Failed to create Paystack subaccount")
    if not result.get("status") or not result.get("data", {}).get("subaccount_code"):
        raise RuntimeError(result.get("message") or "Failed to create Paystack subaccount")

    return result["data"]


def ensure_barber_subaccount(barber: Barber, user: User, kyc: BarberKYC) -> str:
    if barber.paystack_subaccount_code:
        return barber.paystack_subaccount_code

    subaccount = create_paystack_subaccount(barber, user, kyc)
    code = str(subaccount.get("subaccount_code") or "").strip()
    if not code:
        raise RuntimeError("Paystack did not return a subaccount code")

    barber.paystack_subaccount_code = code
    return code
