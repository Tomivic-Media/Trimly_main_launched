from fastapi import APIRouter

router = APIRouter()


@router.get("/policies/acceptable-use")
def get_acceptable_use_policy():
    return {
        "title": "Trimly Acceptable Use Policy",
        "version": "1.0",
        "summary": "Trimly users must use the marketplace lawfully, respectfully, and without fraud or abuse.",
        "rules": [
            "Users must provide accurate identity and booking information.",
            "Barbers must only offer lawful services and truthful pricing.",
            "Customers must not abuse, harass, or impersonate barbers or support staff.",
            "Fraudulent bookings, payment abuse, and chargeback abuse are prohibited.",
            "Platform messaging must not be used for threats, hate speech, or unlawful content.",
            "Trimly may suspend or remove accounts that violate trust, safety, or payment policies.",
        ],
    }
