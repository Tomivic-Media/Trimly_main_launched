import requests

from app.core.config import PAYSTACK_SECRET_KEY


def send_barber_payout(recipient_code: str, amount: float) -> dict:
    headers = {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "source": "balance",
        "amount": int(amount * 100),
        "recipient": recipient_code,
        "reason": "Trimly barber payout",
    }

    response = requests.post(
        "https://api.paystack.co/transfer",
        json=payload,
        headers=headers,
        timeout=30,
    )
    return response.json()


def create_transfer_recipient(name: str, account_number: str, bank_code: str) -> dict:
    headers = {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "type": "nuban",
        "name": name,
        "account_number": account_number,
        "bank_code": bank_code,
        "currency": "NGN",
    }

    response = requests.post(
        "https://api.paystack.co/transferrecipient",
        json=payload,
        headers=headers,
        timeout=30,
    )
    return response.json()
