# backend/routes/vk/handlers/message_handler.py
import logging
from datetime import datetime, timezone

from ..middleware import require_rules
from ..utils import send_message
from ..keyboards import (
    kb_main_menu, kb_empty, kb_inline_add_car,
    kb_inline_cancel_and_new
)
from ..state import (
    _AWAITING_NAME, _AWAITING_PHONE, _AWAITING_CAR_SELECTION,
    _CAR_DATA, _AWAITING_CAR_STEP, _AWAITING_PROBLEM_DESC
)
from ..services import (
    is_valid_gos_number,
    has_contact_info,
    update_client_info,
    get_active_order_for_car
)
from models import db, WorkOrder, Car

logger = logging.getLogger(__name__)

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
        phone_raw = text.strip()
        clean_phone = phone_raw.replace(' ', '').replace('(', '').replace(')', '').replace('-', '')
        if clean_phone.startswith('8') and len(clean_phone) == 11 and clean_phone[1:].isdigit():
            clean_phone = '+7' + clean_phone[1:]
        if not (clean_phone.startswith('+7') and len(clean_phone) == 12 and clean_phone[2:].isdigit()):
            send_message(
                user_id,
                "❌ Введите корректный российский номер:\n"
                "• +7XXXXXXXXXX (11 цифр) или 8XXXXXXXXXX",
                keyboard=kb_empty()
            )
            return
        _AWAITING_PHONE.pop(user_id)
        update_client_info(client, phone=clean_phone)
        cars = client.cars
        if cars:
            show_car_selection(user_id, client)
        else:
            _CAR_DATA[user_id] = {'context': 'order'}
            _AWAITING_CAR_STEP[user_id] = 'model'
            send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):", keyboard=kb_empty())
        return

    # -------- waiting car selection --------
    if user_id in _AWAITING_CAR_SELECTION:
        choice = text.strip()
        car_ids = _AWAITING_CAR_SELECTION.pop(user_id)
        if choice.lower() == 'новая':
            _CAR_DATA[user_id] = {'context': 'order'}
            _AWAITING_CAR_STEP[user_id] = 'model'
            send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):", keyboard=kb_empty())
            return
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(car_ids):
                car_id = car_ids[idx]
                active_order = get_active_order_for_car(car_id)
                if active_order:
                    send_message(
                        user_id,
                        f"❌ На этот автомобиль уже есть активная заявка №{active_order.order_id}.\n"
                        "Вы не можете создать новую, пока предыдущая не отменена или завершена.\n\n"
                        "Что хотите сделать?",
                        keyboard=kb_inline_cancel_and_new(active_order.order_id, car_id)
                    )
                    return
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

        if step == 'model':
            model = text.strip()
            data['model'] = model
            _AWAITING_CAR_STEP[user_id] = 'gos_number'
            send_message(user_id, "🚘 Введите госномер автомобиля (например, А123БВ77):", keyboard=kb_empty())
            return

        elif step == 'gos_number':
            gos_number = text.strip().upper()
            if not is_valid_gos_number(gos_number):
                send_message(user_id, "❌ Неверный формат госномера.\nПример: А123БВ77", keyboard=kb_empty())
                return
            data['gos_number'] = gos_number
            _AWAITING_CAR_STEP[user_id] = 'year'
            send_message(user_id, "📅 Введите год выпуска (например, 2020):", keyboard=kb_empty())
            return

        elif step == 'year':
            year_str = text.strip()
            if not year_str.isdigit():
                send_message(user_id, "❌ Введите год числом, например: 2020", keyboard=kb_empty())
                return
            year_val = int(year_str)
            current_year = datetime.now(timezone.utc).year
            if not (1900 <= year_val <= current_year + 1):
                send_message(
                    user_id,
                    f"❌ Год должен быть от 1900 до {current_year + 1}. Попробуйте ещё раз.",
                    keyboard=kb_empty()
                )
                return
            data['year'] = year_val
            _AWAITING_CAR_STEP[user_id] = 'mileage'
            send_message(user_id, "🛞 Введите пробег в километрах (например, 45000):", keyboard=kb_empty())
            return

        elif step == 'mileage':
            mileage_str = text.strip()
            if not mileage_str.isdigit():
                send_message(user_id, "❌ Введите число (только цифры), например: 45000", keyboard=kb_empty())
                return
            mileage_val = int(mileage_str)
            MAX_MILEAGE = 1_000_000
            if mileage_val > MAX_MILEAGE:
                send_message(
                    user_id,
                    f"❌ Пробег не может быть больше {MAX_MILEAGE:,} км. Пожалуйста, введите корректное значение.",
                    keyboard=kb_empty()
                )
                return
            if mileage_val < 0:
                send_message(user_id, "❌ Пробег не может быть отрицательным. Введите ещё раз.", keyboard=kb_empty())
                return
            data['mileage'] = mileage_val
            _AWAITING_CAR_STEP[user_id] = 'vin'
            send_message(user_id, "🔢 Введите VIN (17 символов) или напишите «Пропустить»:", keyboard=kb_empty())
            return

        elif step == 'vin':
            vin = text.strip()
            if vin.lower() in ['пропустить', 'нет', '-']:
                vin = None
            if vin and len(vin) != 17:
                send_message(user_id, "❌ VIN должен содержать ровно 17 символов. Попробуйте ещё раз или напишите «Пропустить».", keyboard=kb_empty())
                return

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

                context = data.get('context', 'add')
                _AWAITING_CAR_STEP.pop(user_id)
                _CAR_DATA.pop(user_id)

                if context == 'order':
                    active_order = get_active_order_for_car(car.car_id)
                    if active_order:
                        send_message(
                            user_id,
                            f"❌ На этот автомобиль уже есть активная заявка №{active_order.order_id}.\n"
                            "Вы не можете создать новую.",
                            keyboard=kb_inline_cancel_and_new(active_order.order_id, car.car_id)
                        )
                        return
                    _AWAITING_PROBLEM_DESC[user_id] = car.car_id
                    send_message(
                        user_id,
                        "📝 Кратко опишите проблему (например, «не заводится», «стук в подвеске»)\n"
                        "Или напишите «Пропустить», чтобы оставить без описания.",
                        keyboard=kb_empty()
                    )
                else:
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

        if get_active_order_for_car(car_id):
            send_message(user_id, "❌ На этот автомобиль кто-то уже создал заявку. Операция отменена.", keyboard=kb_main_menu())
            return

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
            send_message(user_id, f"✅ Заявка №{order.order_id} принята!", keyboard=kb_main_menu())
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
            _CAR_DATA[user_id] = {'context': 'order'}
            _AWAITING_CAR_STEP[user_id] = 'model'
            send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):", keyboard=kb_empty())
        return

    elif text_lower == 'мои заявки':
        show_orders(user_id, client)
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


def show_car_selection(user_id, client):
    from ..state import _AWAITING_CAR_SELECTION
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


def show_orders(user_id, client):
    from ..keyboards import kb_main_menu, kb_inline_cancel_orders
    orders = WorkOrder.query.filter_by(client_id=client.client_id)\
                            .order_by(WorkOrder.created_date.desc())\
                            .limit(10).all()
    if not orders:
        send_message(user_id, "📭 У вас пока нет заявок.", keyboard=kb_main_menu())
        return

    lines = []
    cancel_orders = []
    for o in orders:
        dt = o.created_date.strftime('%d.%m.%Y %H:%M') if o.created_date else '—'
        status = o.status or 'Заявка'
        if status == 'Заявка':
            icon = "🟢"
            cancel_orders.append(o)
        elif status == 'Отменена':
            icon = "❌"
        else:
            icon = "✅"
        lines.append(f"{icon} Заявка №{o.order_id} от {dt} — {status}")

    message_text = "📋 Ваши заявки:\n\n" + "\n".join(lines)
    keyboard = kb_inline_cancel_orders(cancel_orders) if cancel_orders else kb_main_menu()
    send_message(user_id, message_text, keyboard=keyboard)