# backend/routes/vk/handlers/callback_handler.py
import json
import logging

from ..vk_api_client import get_vk
from ..helpers import clear_inline_buttons
from ..utils import send_message
from ..keyboards import kb_main_menu, kb_empty
from ..state import _AWAITING_PROBLEM_DESC, _CAR_DATA, _AWAITING_CAR_STEP
from ..services import (
    get_or_create_client,
    accept_rules,
    has_accepted_rules,
    decline_rules,
    cancel_order
)
from .message_handler import process_message, show_orders

logger = logging.getLogger(__name__)

def process_event(event):
    """Обрабатывает один message_event. Возвращает 'ok'."""
    event_id = event.get('event_id')
    user_id = event.get('user_id')
    peer_id = event.get('peer_id')
    payload = event.get('payload', {})

    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}

    command = payload.get('command')
    vk = get_vk()
    client = get_or_create_client(user_id)

    # Отвечаем на event
    try:
        vk.messages.sendMessageEventAnswer(
            event_id=event_id,
            user_id=user_id,
            peer_id=peer_id
        )
    except Exception as e:
        logger.error(f"VK event error: {e}")

    # Убираем кнопки
    clear_inline_buttons(vk, peer_id, event)

    # Маршрутизация команд
    if command == 'accept_rules':
        if has_accepted_rules(client):
            process_message(user_id, "начать", client)
            return 'ok'
        accept_rules(client)
        send_message(user_id,
                     "✅ Соглашение принято.\nТеперь вы можете пользоваться ботом.",
                     keyboard=kb_main_menu())

    elif command == 'decline_rules':
        if has_accepted_rules(client):
            send_message(user_id,
                         "✅ Вы уже приняли соглашение. Продолжайте пользоваться ботом.",
                         keyboard=kb_main_menu())
            return 'ok'
        if client.declined_rules is not None:
            send_message(user_id,
                         "❌ Вы уже ранее отказывались от соглашения.\n"
                         "Если вы хотите продолжить, нажмите «Принять» под предыдущим сообщением или отправьте «Начать».",
                         keyboard=kb_empty())
            return 'ok'
        decline_rules(client)
        send_message(user_id,
                     "❌ Вы отказались от соглашения об обработке персональных данных.\n\n"
                     "Без согласия мы не можем продолжить работу с вашими заявками и автомобилями, "
                     "так как это требует обработки персональной информации.\n\n"
                     "Если вы измените решение, просто отправьте «Начать» — и вы снова сможете принять условия и пользоваться ботом.",
                     keyboard=kb_empty())

    elif command == 'add_car':
        if not has_accepted_rules(client):
            return 'ok'
        _CAR_DATA[user_id] = {'context': 'add'}
        _AWAITING_CAR_STEP[user_id] = 'model'
        send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):", keyboard=kb_empty())

    elif command == 'cancel_and_create_new':
        order_id = payload.get('order_id')
        car_id = payload.get('car_id')
        try:
            cancel_order(order_id, user_id)
            _AWAITING_PROBLEM_DESC[user_id] = car_id
            send_message(user_id,
                         "📝 Кратко опишите проблему (например, «не заводится», «стук в подвеске»)\n"
                         "Или напишите «Пропустить», чтобы оставить без описания.",
                         keyboard=kb_empty())
        except Exception as e:
            logger.error(f"Cancel order error: {e}")
            send_message(user_id, "⚠ Не удалось отменить заявку. Возможно, она уже обработана.", keyboard=kb_main_menu())

    elif command == 'cancel_order':
        order_id = payload.get('order_id')
        try:
            cancel_order(order_id, user_id)
            send_message(user_id, f"✅ Заявка №{order_id} отменена.", keyboard=kb_main_menu())
            show_orders(user_id, client)
        except Exception as e:
            logger.error(f"Cancel order error: {e}")
            send_message(user_id, "⚠ Не удалось отменить заявку.", keyboard=kb_main_menu())

    elif command == 'to_menu':
        send_message(user_id, "Главное меню:", keyboard=kb_main_menu())

    return 'ok'