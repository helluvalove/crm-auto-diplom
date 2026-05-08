import time
import json
import logging
from datetime import datetime, timezone

from flask import request, current_app
from vk_api import VkApi

from . import vk_bp
from .middleware import require_rules
from .utils import send_message
from .keyboards import kb_main_menu, kb_empty, kb_inline_add_car
from models import db, WorkOrder, Car
from .services import (
    get_or_create_car_for_client,
    is_valid_gos_number,
    get_or_create_client,
    accept_rules,
    has_accepted_rules,
    decline_rules,
    has_contact_info,
    update_client_info
)

logger = logging.getLogger(__name__)

# ----------------- GLOBAL STATE -----------------
_LAST_MESSAGE_TIME = {}
_PROCESSED_MESSAGES = set()
_PROCESSED_EVENTS = set()

_AWAITING_PROBLEM_DESC = {}
_AWAITING_NAME = {}
_AWAITING_PHONE = {}
_AWAITING_CAR_SELECTION = {}    # user_id -> список car_id для выбора

# Единый процесс сбора данных автомобиля
_CAR_DATA = {}                 # user_id -> dict с полями (включая 'context')
_AWAITING_CAR_STEP = {}        # user_id -> 'model' / 'gos_number' / 'year' / 'mileage' / 'vin'

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
        if command == 'accept_rules':
            if has_accepted_rules(client):
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
                send_message(
                    user_id,
                    "❌ Вы уже ранее отказывались от соглашения.\n"
                    "Если вы хотите продолжить, нажмите «Принять» под предыдущим сообщением или отправьте «Начать».",
                    keyboard=kb_empty()
                )
                return 'ok', 200

            decline_rules(client)
            send_message(
                user_id,
                "❌ Вы отказались от соглашения об обработке персональных данных.\n\n"
                "Без согласия мы не можем продолжить работу с вашими заявками и автомобилями, "
                "так как это требует обработки персональной информации.\n\n"
                "Если вы измените решение, просто отправьте «Начать» — и вы снова сможете принять условия и пользоваться ботом.",
                keyboard=kb_empty()
            )

        # ---------------- ADD CAR (inline) ----------------
        elif command == 'add_car':
            if not has_accepted_rules(client):
                return 'ok', 200
            # Запускаем сбор данных (без заявки)
            _CAR_DATA[user_id] = {'context': 'add'}
            _AWAITING_CAR_STEP[user_id] = 'model'
            send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):", keyboard=kb_empty())

        return 'ok', 200

    return 'ok', 200


# ----------------- BUSINESS LOGIC -----------------
@require_rules
def process_message(user_id, text, client):
    text_lower = text.strip().lower()

    # -------- waiting name --------
    if user_id in _AWAITING_NAME:
        name = text.strip()
        _AWAITING_NAME.pop(user_id)
        update_client_info(client, name=name)
        _AWAITING_PHONE[user_id] = True
        send_message(user_id, "📞 Введите ваш номер телефона (например, +79123456789):", keyboard=kb_empty())
        return

    # -------- waiting phone --------
    if user_id in _AWAITING_PHONE:
        phone = text.strip()
        if not phone.startswith('+') or not phone[1:].isdigit():
            send_message(user_id, "❌ Неверный формат. Введите номер в международном формате: +79123456789", keyboard=kb_empty())
            return
        _AWAITING_PHONE.pop(user_id)
        update_client_info(client, phone=phone)
        cars = client.cars
        if cars:
            show_car_selection(user_id, client)
        else:
            # Нет машин – запускаем сбор данных для заявки
            _CAR_DATA[user_id] = {'context': 'order'}
            _AWAITING_CAR_STEP[user_id] = 'model'
            send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):", keyboard=kb_empty())
        return

    # -------- waiting car selection --------
    if user_id in _AWAITING_CAR_SELECTION:
        choice = text.strip()
        car_ids = _AWAITING_CAR_SELECTION.pop(user_id)
        if choice.lower() == 'новая':
            # Запускаем сбор данных для нового авто в заявке
            _CAR_DATA[user_id] = {'context': 'order'}
            _AWAITING_CAR_STEP[user_id] = 'model'
            send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):", keyboard=kb_empty())
            return
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(car_ids):
                car_id = car_ids[idx]
                _AWAITING_PROBLEM_DESC[user_id] = car_id
                send_message(
                    user_id,
                    "📝 Кратко опишите проблему (например, «не заводится», «стук в подвеске»)\n"
                    "Или напишите «Пропустить», чтобы оставить без описания.",
                    keyboard=kb_empty()
                )
                return
            else:
                send_message(user_id, "❌ Неверный номер. Выберите число из списка или напишите «Новая».", keyboard=kb_empty())
                _AWAITING_CAR_SELECTION[user_id] = car_ids
                return
        except ValueError:
            send_message(user_id, "❌ Введите число, соответствующее автомобилю, или слово «Новая».", keyboard=kb_empty())
            _AWAITING_CAR_SELECTION[user_id] = car_ids
            return

    # -------- Пошаговый сбор данных автомобиля ----------
    if user_id in _AWAITING_CAR_STEP:
        step = _AWAITING_CAR_STEP[user_id]
        data = _CAR_DATA.get(user_id, {})

        # --- шаг: model ---
        if step == 'model':
            model = text.strip()
            data['model'] = model
            _AWAITING_CAR_STEP[user_id] = 'gos_number'
            send_message(user_id, "🚘 Введите госномер автомобиля (например, А123БВ77):", keyboard=kb_empty())
            return

        # --- шаг: gos_number ---
        elif step == 'gos_number':
            gos_number = text.strip().upper()
            if not is_valid_gos_number(gos_number):
                send_message(user_id, "❌ Неверный формат госномера.\nПример: А123БВ77", keyboard=kb_empty())
                return
            data['gos_number'] = gos_number
            _AWAITING_CAR_STEP[user_id] = 'year'
            send_message(user_id, "📅 Введите год выпуска (например, 2020):", keyboard=kb_empty())
            return

        # --- шаг: year ---
        elif step == 'year':
            year_str = text.strip()
            if not year_str.isdigit():
                send_message(user_id, "❌ Введите год числом, например: 2020", keyboard=kb_empty())
                return
            data['year'] = int(year_str)
            _AWAITING_CAR_STEP[user_id] = 'mileage'
            send_message(user_id, "🛞 Введите пробег в километрах (например, 45000):", keyboard=kb_empty())
            return

        # --- шаг: mileage ---
        elif step == 'mileage':
            mileage_str = text.strip()
            if not mileage_str.isdigit():
                send_message(user_id, "❌ Введите число (только цифры), например: 45000", keyboard=kb_empty())
                return
            data['mileage'] = int(mileage_str)
            _AWAITING_CAR_STEP[user_id] = 'vin'
            send_message(user_id, "🔢 Введите VIN (17 символов) или напишите «Пропустить»:", keyboard=kb_empty())
            return

        # --- шаг: vin (опционально) ---
        elif step == 'vin':
            vin = text.strip()
            if vin.lower() in ['пропустить', 'нет', '-']:
                vin = None
            if vin and len(vin) != 17:
                send_message(user_id, "❌ VIN должен содержать ровно 17 символов. Попробуйте ещё раз или напишите «Пропустить».", keyboard=kb_empty())
                return

            # Все данные собраны — создаём автомобиль
            try:
                car = Car(
                    client_id=client.client_id,
                    model=data.get('model', 'Не указана'),
                    gos_number=data.get('gos_number'),
                    year=data.get('year'),
                    mileage=data.get('mileage', 0),
                    vin=vin
                )
                db.session.add(car)
                db.session.commit()
                db.session.refresh(client)

                # Очищаем временные состояния
                context = data.get('context', 'add')
                _AWAITING_CAR_STEP.pop(user_id)
                _CAR_DATA.pop(user_id)

                if context == 'order':
                    # Переходим к описанию проблемы
                    _AWAITING_PROBLEM_DESC[user_id] = car.car_id
                    send_message(
                        user_id,
                        "📝 Кратко опишите проблему (например, «не заводится», «стук в подвеске»)\n"
                        "Или напишите «Пропустить», чтобы оставить без описания.",
                        keyboard=kb_empty()
                    )
                else:
                    # Просто добавление авто
                    send_message(user_id, "✅ Автомобиль успешно добавлен!", keyboard=kb_main_menu())
            except Exception as e:
                logger.error(f"Error adding car: {e}")
                send_message(user_id, "⚠ Ошибка при добавлении автомобиля", keyboard=kb_main_menu())
            return

    # -------- waiting problem description --------
    if user_id in _AWAITING_PROBLEM_DESC:
        car_id = _AWAITING_PROBLEM_DESC.pop(user_id)
        desc = text.strip()

        if desc.lower() in ['пропустить', 'нет', '-']:
            desc = "Без описания"

        contact_info = f"Клиент: {client.name or 'не указано'}, тел.: {client.phone or 'не указано'}"
        full_desc = f"{contact_info}\nVK ID {user_id}: {desc}"

        try:
            order = WorkOrder(
                client_id=client.client_id,
                car_id=car_id,
                status='Заявка',
                problem_description=full_desc,
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
            "• «Мои заявки» — посмотреть историю ваших обращений.\n"
            "• «Мои авто» — список ваших автомобилей.\n"
            "• «Профиль» — ваши контактные данные.\n"
            "• «Помощь» — показать это сообщение.\n\n"
            "Выберите нужное действие в меню 👇",
            keyboard=kb_main_menu()
        )
        return

    elif text_lower == 'помощь':
        send_message(user_id, "📋 Команды:\n• Запись\n• Мои заявки\n• Мои авто\n• Профиль\n\nДля уточнения каких-либо вопросов вы можете позвонить нашему менеджеру по телефону: 67-87-09", keyboard=kb_main_menu())

    elif text_lower == 'запись':
        if not has_contact_info(client):
            _AWAITING_NAME[user_id] = True
            send_message(user_id, "📝 Для создания заявки нам нужны ваши контактные данные.\nВведите ваше ФИО полностью:", keyboard=kb_empty())
            return
        cars = client.cars
        if cars:
            show_car_selection(user_id, client)
        else:
            # Нет автомобилей — запускаем сбор данных для заявки
            _CAR_DATA[user_id] = {'context': 'order'}
            _AWAITING_CAR_STEP[user_id] = 'model'
            send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):", keyboard=kb_empty())
        return

    elif text_lower == 'мои заявки':
        orders = WorkOrder.query.filter_by(client_id=client.client_id)\
                                .order_by(WorkOrder.created_date.desc())\
                                .limit(5).all()
        if not orders:
            send_message(user_id, "📭 У вас пока нет заявок.", keyboard=kb_main_menu())
        else:
            lines = []
            for o in orders:
                dt = o.created_date.strftime('%d.%m.%Y %H:%M') if o.created_date else '—'
                lines.append(f"🔹 Заявка №{o.order_id} от {dt}\n   Статус: {o.status or 'Заявка'}")
            send_message(
                user_id,
                "📋 Ваши последние заявки:\n\n" + "\n\n".join(lines),
                keyboard=kb_main_menu()
            )
        return

    elif text_lower == 'мои авто':
        cars = client.cars
        if not cars:
            send_message(
                user_id,
                "🚘 У вас пока нет добавленных автомобилей.\nНажмите кнопку ниже, чтобы добавить.",
                keyboard=kb_inline_add_car()
            )
        else:
            lines = []
            for i, car in enumerate(cars, 1):
                lines.append(
                    f"{i}. {car.model or 'Модель не указана'}\n"
                    f"   Госномер: {car.gos_number or 'не указан'}\n"
                    f"   VIN: {car.vin or 'не указан'}\n"
                    f"   Год: {car.year or '—'}, Пробег: {car.mileage or 0} км"
                )
            send_message(
                user_id,
                "🚗 Ваши автомобили:\n\n" + "\n\n".join(lines),
                keyboard=kb_inline_add_car()
            )
        return

    elif text_lower == 'профиль':
        name = client.name or 'не указано'
        phone = client.phone or 'не указан'
        reg_date = client.date_reg.strftime('%d.%m.%Y %H:%M') if client.date_reg else '—'
        msg = (f"👤 Ваш профиль:\n"
               f"ФИО: {name}\n"
               f"Телефон: {phone}\n"
               f"Дата регистрации: {reg_date}")
        send_message(user_id, msg, keyboard=kb_main_menu())
        return

    else:
        send_message(user_id, "Используйте кнопки меню", keyboard=kb_main_menu())


# ----------------- Вспомогательная функция -----------------
def show_car_selection(user_id, client):
    """Отправляет список автомобилей клиента и переводит в ожидание выбора."""
    cars = client.cars
    lines = []
    car_ids = []
    for i, car in enumerate(cars, 1):
        car_ids.append(car.car_id)
        lines.append(f"{i}. {car.model or 'Модель не указана'} — {car.gos_number or 'без номера'}")
    _AWAITING_CAR_SELECTION[user_id] = car_ids
    send_message(
        user_id,
        "🚗 Выберите автомобиль, введя его номер, или напишите «Новая» для добавления нового:\n\n" + "\n".join(lines),
        keyboard=kb_empty()
    )