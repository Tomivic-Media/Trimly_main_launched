from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user, get_user_from_token
from app.db.session import SessionLocal, get_db
from app.enums.booking_status import BookingStatus
from app.models.barber import Barber
from app.models.booking import Booking
from app.models.chat import ChatMessage
from app.models.user import UserRole
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse

router = APIRouter()

ALLOWED_CHAT_STATUSES = {BookingStatus.approved}


class ConnectionManager:
    def __init__(self):
        self.connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, booking_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[booking_id].add(websocket)

    def disconnect(self, booking_id: int, websocket: WebSocket) -> None:
        if booking_id in self.connections:
            self.connections[booking_id].discard(websocket)
            if not self.connections[booking_id]:
                self.connections.pop(booking_id, None)

    async def broadcast(self, booking_id: int, payload: dict) -> None:
        stale_connections = []
        for websocket in list(self.connections.get(booking_id, set())):
            try:
                await websocket.send_json(payload)
            except Exception:
                stale_connections.append(websocket)

        for websocket in stale_connections:
            self.disconnect(booking_id, websocket)


manager = ConnectionManager()


def _normalize_role(role_value) -> str:
    if role_value is None:
        return ""
    if hasattr(role_value, "value"):
        return str(role_value.value).lower()
    role_text = str(role_value).strip().lower()
    if "." in role_text:
        role_text = role_text.split(".")[-1]
    return role_text


def _load_booking(booking_id: int, db: Session) -> Booking:
    booking = (
        db.query(Booking)
        .options(
            joinedload(Booking.customer),
            joinedload(Booking.barber).joinedload(Barber.user),
        )
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


def _assert_chat_access(booking: Booking, user) -> None:
    role = _normalize_role(user.role)
    barber_user_id = booking.barber.user_id if booking.barber else None

    is_customer = role == UserRole.customer.value and booking.customer_id == user.id
    is_barber = role == UserRole.barber.value and barber_user_id == user.id

    if not (is_customer or is_barber):
        raise HTTPException(status_code=403, detail="Not allowed to access this chat")

    booking_status = booking.status
    if isinstance(booking_status, str):
        booking_status = booking_status.lower()
    elif hasattr(booking_status, "value"):
        booking_status = str(booking_status.value).lower()

    allowed_values = {
        status.value if hasattr(status, "value") else str(status).lower()
        for status in ALLOWED_CHAT_STATUSES
    }

    if booking_status not in allowed_values:
        raise HTTPException(status_code=400, detail="Chat is only available for approved bookings")


def _resolve_receiver_id(booking: Booking, sender_user) -> int:
    barber_user_id = booking.barber.user_id if booking.barber else None
    if sender_user.id == booking.customer_id and barber_user_id:
        return barber_user_id
    if sender_user.id == barber_user_id:
        return booking.customer_id
    raise HTTPException(status_code=403, detail="Not allowed to send messages for this booking")


def _message_to_response(message: ChatMessage) -> ChatMessageResponse:
    sender_name = message.sender.full_name if message.sender else "Trimly User"
    return ChatMessageResponse(
        id=message.id,
        booking_id=message.booking_id,
        sender_id=message.sender_id,
        receiver_id=message.receiver_id,
        sender_user_id=message.sender_id,
        sender_role=message.sender_role,
        sender_name=sender_name,
        content=message.content,
        message=message.content,
        created_at=message.created_at,
    )


@router.get("/bookings/{booking_id}/messages", response_model=list[ChatMessageResponse])
@router.get("/chat/messages/{booking_id}", response_model=list[ChatMessageResponse])
def get_booking_messages(
    booking_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _load_booking(booking_id, db)
    _assert_chat_access(booking, current_user)

    messages = (
        db.query(ChatMessage)
        .options(joinedload(ChatMessage.sender))
        .filter(ChatMessage.booking_id == booking_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .all()
    )
    return [_message_to_response(message) for message in messages]


@router.post("/bookings/{booking_id}/messages", response_model=ChatMessageResponse)
async def create_booking_message(
    booking_id: int,
    payload: ChatMessageCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = _load_booking(booking_id, db)
    _assert_chat_access(booking, current_user)

    message_text = str(payload.content or payload.message or "").strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    receiver_id = payload.receiver_id or _resolve_receiver_id(booking, current_user)
    message = ChatMessage(
        booking_id=booking_id,
        sender_id=current_user.id,
        receiver_id=receiver_id,
        sender_role=_normalize_role(current_user.role),
        content=message_text,
    )

    db.add(message)
    db.commit()
    db.refresh(message)
    db.refresh(current_user)
    message.sender = current_user

    response = _message_to_response(message)
    await manager.broadcast(
        booking_id,
        {
            "type": "chat_message",
            "message": response.model_dump(mode="json"),
        },
    )
    return response


@router.post("/chat/send-message", response_model=ChatMessageResponse)
async def send_chat_message(
    payload: ChatMessageCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.booking_id:
        raise HTTPException(status_code=400, detail="booking_id is required")
    return await create_booking_message(payload.booking_id, payload, current_user, db)


@router.websocket("/ws/bookings/{booking_id}/messages")
async def booking_messages_websocket(
    websocket: WebSocket,
    booking_id: int,
    token: str = Query(default=""),
):
    if not token:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        try:
            user = get_user_from_token(token, db)
            booking = _load_booking(booking_id, db)
            _assert_chat_access(booking, user)
        except HTTPException:
            await websocket.close(code=4403)
            return

        await manager.connect(booking_id, websocket)

        while True:
            data = await websocket.receive_json()
            message_text = str(data.get("message", "")).strip()
            if not message_text:
                continue

            message = ChatMessage(
                booking_id=booking_id,
                sender_id=user.id,
                receiver_id=_resolve_receiver_id(booking, user),
                sender_role=_normalize_role(user.role),
                content=message_text,
            )
            db.add(message)
            db.commit()
            db.refresh(message)
            db.refresh(user)
            message.sender = user

            response = _message_to_response(message)
            await manager.broadcast(
                booking_id,
                {
                    "type": "chat_message",
                    "message": response.model_dump(mode="json"),
                },
            )
    except WebSocketDisconnect:
        manager.disconnect(booking_id, websocket)
    finally:
        manager.disconnect(booking_id, websocket)
        db.close()
