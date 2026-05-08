import time
import json
import logging
from datetime import datetime, timezone

from flask import request, current_app
from vk_api import VkApi

from . import vk_bp
from .middleware import require_rules
from .utils import send_message
from .keyboards import kb_main_menu, kb_empty
from models import db, WorkOrder
from .services import (
    get_or_create_car_for_client,
    is_valid_gos_number,
    get_or_create_client,
    accept_rules,
    has_accepted_rules,
    decline_rules
)

logger = logging.getLogger(__name__)

# ----------------- GLOBAL STATE -----------------
_LAST_MESSAGE_TIME = {}
_PROCESSED_MESSAGES = set()
_PROCESSED_EVENTS = set()

_AWAITING_CAR_NUMBER = {}
_AWAITING_PROBLEM_DESC = {}

# ----------------- VK INIT (singleton) -----------------
_vk = None


def get_vk():
    global _vk

    if _vk is None:
        token = current_app.config.get('VK_ACCESS_TOKEN')

        if not token:
            raise RuntimeError("VK_ACCESS_TOKEN is not set in config")

        vk_session = VkApi(token=token)
        _vk = vk_session.get_api()

    return _vk


# ----------------- UTIL -----------------
def is_spam(user_id):
    now = time.time()
    last = _LAST_MESSAGE_TIME.get(user_id, 0)

    if now - last < 1.5:
        return True

    _LAST_MESSAGE_TIME[user_id] = now
    return False


def handle_message(user_id, text):
    if is_spam(user_id):
        send_message(user_id, "⏳ Слишком частые сообщения.")
        return

    process_message(user_id, text)


# ----------------- ROUTE -----------------
@vk_bp.route('/callback', methods=['POST'])
def vk_callback():
    data = request.get_json(silent=True) or request.form.to_dict()

    if not data:
        return 'ok', 200

    secret = current_app.config.get('VK_SECRET_KEY')

    if secret and data.get('secret') != secret:
        logger.warning("Invalid VK secret")
        return 'forbidden', 403

    event_type = data.get('type')

    # ----------------- CONFIRMATION -----------------
    if event_type == 'confirmation':
        return current_app.config.get('VK_CONFIRMATION_CODE', ''), 200

    # ----------------- MESSAGE NEW -----------------
    if event_type == 'message_new':
        obj = data.get('object', {})
        msg = obj.get('message', {})

        user_id = msg.get('from_id')
        text = msg.get('text', '')
        msg_id = msg.get('id')

        if not msg_id or msg_id in _PROCESSED_MESSAGES:
            return 'ok', 200

        _PROCESSED_MESSAGES.add(msg_id)

        if user_id and text:
            handle_message(user_id, text)

        return 'ok', 200

    # ----------------- MESSAGE EVENT (inline buttons) -----------------
    if event_type == 'message_event':

        event = data.get('object', {})
        event_id = event.get('event_id')
        user_id = event.get('user_id')
        peer_id = event.get('peer_id')
        payload = event.get('payload', {})

        if event_id in _PROCESSED_EVENTS:
            return 'ok', 200

        _PROCESSED_EVENTS.add(event_id)

        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {}

        command = payload.get('command')

        vk = get_vk()
        client = get_or_create_client(user_id)

        try:
            vk.messages.sendMessageEventAnswer(
                event_id=event_id,
                user_id=user_id,
                peer_id=peer_id
            )
        except Exception as e:
            logger.error(f"VK event error: {e}")

        # ---------------- ACCEPT ----------------
# ---------------- ACCEPT ----------------
        if command == 'accept_rules':
            if has_accepted_rules(client):
                # отправляем такое же приветствие, как при команде «Начать»
                process_message(user_id, "начать", client)
                return 'ok', 200

            accept_rules(client)
            send_message(
                user_id,
                "✅ Соглашение принято.\nТеперь вы можете пользоваться ботом.",
                keyboard=kb_main_menu()
            )

        # ---------------- DECLINE ----------------
        elif command == 'decline_rules':
            if client.declined_rules is not None:
                # Пользователь уже отказывался ранее — напомним, без дублирования длинного текста
                send_message(
                    user_id,
                    "❌ Вы уже ранее отказывались от соглашения.\n"
                    "Если вы хотите продолжить, нажмите «Принять» под предыдущим сообщением или отправьте «Начать».",
                    keyboard=kb_empty()
                )
                return 'ok', 200

            # Первый отказ
            decline_rules(client)
            send_message(
                user_id,
                "❌ Вы отказались от соглашения об обработке персональных данных.\n\n"
                "Без согласия мы не можем продолжить работу с вашими заявками и автомобилями, "
                "так как это требует обработки персональной информации.\n\n"
                "Если вы измените решение, просто отправьте «Начать» — и вы снова сможете принять условия и пользоваться ботом.",
                keyboard=kb_empty()
            ) 
        return 'ok', 200

    return 'ok', 200


# ----------------- BUSINESS LOGIC -----------------
@require_rules
def process_message(user_id, text, client):
    text_lower = text.strip().lower()

    # -------- waiting car number --------
    if user_id in _AWAITING_CAR_NUMBER:
        gos_number = text.strip().upper()

        if not is_valid_gos_number(gos_number):
            send_message(
                user_id,
                "❌ Неверный формат госномера.\nПример: А123БВ77",
                keyboard=kb_empty()
            )
            return

        _AWAITING_CAR_NUMBER.pop(user_id)

        try:
            car = get_or_create_car_for_client(client, gos_number)
        except Exception as e:
            logger.error(f"Car create error: {e}")
            send_message(user_id, "⚠ Ошибка обработки госномера", keyboard=kb_main_menu())
            return

        _AWAITING_PROBLEM_DESC[user_id] = car.car_id

        send_message(
            user_id,
            "📝 Опишите проблему или напишите «Пропустить».",
            keyboard=kb_empty()
        )
        return

    # -------- waiting problem description --------
    if user_id in _AWAITING_PROBLEM_DESC:
        car_id = _AWAITING_PROBLEM_DESC.pop(user_id)
        desc = text.strip()

        if desc.lower() in ['пропустить', 'нет', '-']:
            desc = "Без описания"

        try:
            order = WorkOrder(
                client_id=client.client_id,
                car_id=car_id,
                status='Заявка',
                problem_description=f"VK ID {user_id}: {desc}",
                created_date=datetime.now(timezone.utc)
            )

            db.session.add(order)
            db.session.commit()

            send_message(user_id, "✅ Заявка принята!", keyboard=kb_main_menu())

        except Exception as e:
            logger.error(f"Order error: {e}")
            send_message(user_id, "⚠ Ошибка создания заявки", keyboard=kb_main_menu())

        return

    # -------- main menu --------
    if text_lower in ['начать', 'start']:
        send_message(
            user_id,
            "🚗 Добро пожаловать в Автомастерскую 43 | КИРОВ!\n\n"
            "✅ Вы уже приняли соглашение об обработке персональных данных.\n\n"
            "📋 Что я умею:\n"
            "• «Запись» — создать заявку на ремонт или обслуживание.\n"
            "• «Статус» — узнать статус ранее созданной заявки (скоро).\n"
            "• «Помощь» — показать список доступных команд.\n\n"
            "Выберите нужное действие в меню 👇",
            keyboard=kb_main_menu()
        )
        return

    elif text_lower == 'помощь':
        send_message(user_id, "📋 Команды:\n• Запись\n• Статус \n\nДля уточнения каких-либо вопросов вы можете позвонить нашему менеджеру по телефону: 67-87-09", keyboard=kb_main_menu())

    elif text_lower == 'запись':
        _AWAITING_CAR_NUMBER[user_id] = True
        send_message(user_id, "🚘 Введите госномер:", keyboard=kb_empty())

    elif text_lower == 'статус':
        send_message(user_id, "Статус появится позже", keyboard=kb_main_menu())

    else:
        send_message(user_id, "Используйте кнопки меню", keyboard=kb_main_menu())