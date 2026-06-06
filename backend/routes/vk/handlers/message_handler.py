# backend/routes/vk/handlers/message_handler.py
import logging
import re
from datetime import datetime, timezone

from ..middleware import require_rules
from ..utils import send_message
from ..keyboards import (
    kb_main_menu, kb_inline_add_car,
    kb_inline_cancel_and_new, kb_inline_cancel_process,
    kb_inline_my_cars, kb_inline_skip_or_cancel,
    kb_inline_profile_actions, kb_empty,
    kb_inline_skip_problem, kb_inline_skip_vin
)
from ..state import (
    _AWAITING_NAME, _AWAITING_PHONE, _AWAITING_CAR_SELECTION,
    _CAR_DATA, _AWAITING_CAR_STEP, _AWAITING_PROBLEM_DESC,
    _AWAITING_CONTACT_DATA, _AWAITING_PREFERRED_TIME, 
    _AWAITING_REVOKE_CONFIRMATION
)
from ..services import (
    is_valid_gos_number,
    has_contact_info,
    update_client_info,
    get_active_order_for_car
)
from models import db, WorkOrder, Car

logger = logging.getLogger(__name__)


def _create_order(user_id, client, car_id, desc, preferred_dt=None):
    """Создаёт заявку в БД и отправляет подтверждение пользователю.
    Возвращает True, если заявка успешно создана, иначе False."""
    if get_active_order_for_car(car_id):
        send_message(user_id, "❌ На этот автомобиль кто-то уже создал заявку. Операция отменена.", keyboard=kb_main_menu())
        return False

    contact_info = f"Клиент: {client.name or 'не указано'}, тел.: {client.phone or 'не указано'}"
    dt_line = f"\nЖелаемая дата и время: {preferred_dt}" if preferred_dt else "\nВремя: не указано"
    full_desc = f"{contact_info}\nVK ID {user_id}: {desc}{dt_line}"

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

        confirm_text = f"✅ Заявка №{order.order_id} принята!\n"
        if preferred_dt:
            confirm_text += f"📅 Желаемая дата/время: {preferred_dt}\n"
        confirm_text += "\nМенеджер свяжется с вами для подтверждения."
        send_message(user_id, confirm_text, keyboard=kb_main_menu())
        return True
    except Exception as e:
        logger.error(f"Order error: {e}")
        send_message(user_id, "⚠ Ошибка создания заявки", keyboard=kb_main_menu())
        return False


@require_rules
def process_message(user_id, text, client):
    text_lower = text.strip().lower()

    # -------- waiting name --------
    if user_id in _AWAITING_NAME:
        raw_name = text.strip()
        words = raw_name.split()

        if len(words) != 3:
            send_message(user_id,
                        "❌ Введите ФИО полностью (три слова через пробел): Фамилия Имя Отчество.",
                        keyboard=kb_inline_cancel_process())
            return

        valid_pattern = re.compile(r'^[а-яё-]+$', re.IGNORECASE)
        for word in words:
            if not valid_pattern.match(word):
                send_message(user_id,
                            "❌ ФИО должно содержать только русские буквы и дефисы. Например: Иванов-Петров Иван Иванович.",
                            keyboard=kb_inline_cancel_process())
                return
            if word.startswith('-') or word.endswith('-') or '--' in word:
                send_message(user_id,
                            "❌ Дефис в фамилии/имени/отчестве используется некорректно.",
                            keyboard=kb_inline_cancel_process())
                return

        formatted_name = raw_name.title()
        _AWAITING_NAME.pop(user_id)
        _AWAITING_CONTACT_DATA[user_id] = {'name': formatted_name}
        _AWAITING_PHONE[user_id] = True
        send_message(user_id, "📞 Введите ваш номер телефона (например, +79123456789):", keyboard=kb_inline_cancel_process())
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
                "+7XXXXXXXXXX (11 цифр) или 8XXXXXXXXXX",
                keyboard=kb_inline_cancel_process()
            )
            return
        _AWAITING_PHONE.pop(user_id)
        contact_data = _AWAITING_CONTACT_DATA.pop(user_id, {})
        name = contact_data.get('name', client.name)
        update_client_info(client, name=name, phone=clean_phone)

        cars = client.cars
        if cars:
            show_car_selection(user_id, client)
        else:
            _CAR_DATA[user_id] = {'context': 'order'}
            _AWAITING_CAR_STEP[user_id] = 'model'
            send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):", keyboard=kb_inline_cancel_process())
        return

    # -------- waiting car selection --------
    if user_id in _AWAITING_CAR_SELECTION:
        choice = text.strip()
        car_ids = _AWAITING_CAR_SELECTION.pop(user_id)
        if choice.lower() == 'новая':
            _CAR_DATA[user_id] = {'context': 'order'}
            _AWAITING_CAR_STEP[user_id] = 'model'
            send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):", keyboard=kb_inline_cancel_process())
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
                    "📝 Кратко опишите проблему (например, «не заводится», «стук в подвеске»).",
                    keyboard=kb_inline_skip_problem()
                )
                return
            else:
                send_message(user_id, "❌ Неверный номер. Выберите число из списка или напишите «Новая».", keyboard=kb_inline_cancel_process())
                _AWAITING_CAR_SELECTION[user_id] = car_ids
                return
        except ValueError:
            send_message(user_id, "❌ Введите число, соответствующее автомобилю, или слово «Новая».", keyboard=kb_inline_cancel_process())
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
            send_message(user_id, "🚘 Введите госномер автомобиля (например, А123ВВ77):", keyboard=kb_inline_cancel_process())
            return

        elif step == 'gos_number':
            gos_number = text.strip().upper()
            if not is_valid_gos_number(gos_number):
                send_message(user_id, "❌ Неверный формат госномера.\nПример: А123ВВ77", keyboard=kb_inline_cancel_process())
                return
            data['gos_number'] = gos_number
            _AWAITING_CAR_STEP[user_id] = 'year'
            send_message(user_id, "📅 Введите год выпуска (например, 2020):", keyboard=kb_inline_cancel_process())
            return

        elif step == 'year':
            year_str = text.strip()
            if not year_str.isdigit():
                send_message(user_id, "❌ Введите год числом, например: 2020", keyboard=kb_inline_cancel_process())
                return
            year_val = int(year_str)
            current_year = datetime.now(timezone.utc).year
            if not (1900 <= year_val <= current_year + 1):
                send_message(
                    user_id,
                    f"❌ Год должен быть от 1900 до {current_year + 1}. Попробуйте ещё раз.",
                    keyboard=kb_inline_cancel_process()
                )
                return
            data['year'] = year_val
            _AWAITING_CAR_STEP[user_id] = 'mileage'
            send_message(user_id, "🛞 Введите пробег в километрах (например, 45000):", keyboard=kb_inline_cancel_process())
            return

        elif step == 'mileage':
            mileage_str = text.strip()
            if not mileage_str.isdigit():
                send_message(user_id, "❌ Введите число (только цифры), например: 45000", keyboard=kb_inline_cancel_process())
                return
            mileage_val = int(mileage_str)
            MAX_MILEAGE = 1_000_000
            if mileage_val > MAX_MILEAGE:
                send_message(
                    user_id,
                    f"❌ Пробег не может быть больше {MAX_MILEAGE:,} км. Пожалуйста, введите корректное значение.",
                    keyboard=kb_inline_cancel_process()
                )
                return
            if mileage_val < 0:
                send_message(user_id, "❌ Пробег не может быть отрицательным. Введите ещё раз.", keyboard=kb_inline_cancel_process())
                return
            data['mileage'] = mileage_val
            _AWAITING_CAR_STEP[user_id] = 'vin'
            send_message(user_id, "🔢 Введите VIN-номер автомобиля (17 символов):", keyboard=kb_inline_skip_vin())
            return

        elif step == 'vin':
            vin = text.strip()
            if vin and len(vin) != 17:
                send_message(user_id, "❌ VIN должен содержать ровно 17 символов. Попробуйте ещё раз или нажмите «Пропустить».", keyboard=kb_inline_skip_vin())
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
                        "📝 Кратко опишите проблему (например, «не заводится», «стук в подвеске»).",
                        keyboard=kb_inline_skip_problem()
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

        # Переходим к шагу выбора даты
        _AWAITING_PREFERRED_TIME[user_id] = {'car_id': car_id, 'desc': desc, 'step': 'date'}
        send_message(
            user_id,
            "📅 Укажите удобную дату записи в формате ДД.ММ.ГГГГ\n"
            "Например: 20.06.2025\n"
            "❕ Воскресенье — выходной день автосервиса.\n\n"
            "Или нажмите «Пропустить» — менеджер согласует время с вами.",
            keyboard=kb_inline_skip_or_cancel()
        )
        return

    # -------- waiting preferred datetime --------
    if user_id in _AWAITING_PREFERRED_TIME:
        data = _AWAITING_PREFERRED_TIME[user_id]
        step = data.get('step')

        if step == 'date':
            raw = text.strip()
            try:
                parsed_date = datetime.strptime(raw, '%d.%m.%Y')
                # Проверка на прошлое
                if parsed_date.date() < datetime.now().date():
                    send_message(
                        user_id,
                        "❌ Дата не может быть в прошлом. Введите корректную дату (ДД.ММ.ГГГГ):",
                        keyboard=kb_inline_skip_or_cancel()
                    )
                    return
                
                # Проверка на слишком далёкое будущее
                if parsed_date.year > 2027:
                    send_message(
                        user_id,
                        "❌ Запись доступна только до конца 2027 года. Введите корректную дату (ДД.ММ.ГГГГ):",
                        keyboard=kb_inline_skip_or_cancel()
                    )
                    return
                # Проверка на воскресенье (weekday: понедельник=0, воскресенье=6)
                if parsed_date.weekday() == 6:
                    send_message(
                        user_id,
                        "❌ В воскресенье автосервис не работает. Пожалуйста, выберите другой день.",
                        keyboard=kb_inline_skip_or_cancel()
                    )
                    return
                data['date'] = parsed_date.strftime('%d.%m.%Y')
                data['step'] = 'time'
                send_message(
                    user_id,
                    "🕐 Теперь укажите удобное время в формате ЧЧ:ММ\n"
                    "⏰ Время работы: с 10:00 до 20:00 (последняя запись в 19:00)\n"
                    "Например: 10:00 или 15:30",
                    keyboard=kb_inline_skip_or_cancel()
                )
            except ValueError:
                send_message(
                    user_id,
                    "❌ Неверный формат даты. Введите в формате ДД.ММ.ГГГГ, например: 20.06.2025",
                    keyboard=kb_inline_skip_or_cancel()
                )
            return

        if step == 'time':
            raw = text.strip()
            if not re.match(r'^\d{1,2}:\d{2}$', raw):
                send_message(
                    user_id,
                    "❌ Неверный формат времени. Введите в формате ЧЧ:ММ, например: 10:00",
                    keyboard=kb_inline_skip_or_cancel()
                )
                return
            h, m = map(int, raw.split(':'))
            # Проверка на допустимое рабочее время: 10:00 - 20:00 (последняя запись в 19:00)
            if h < 10 or h > 19 or (h == 19 and m > 0):
                send_message(
                    user_id, 
                    "❌ Автосервис работает с 10:00 до 20:00 (последняя запись в 19:00). Пожалуйста, выберите время в этом промежутке.",
                    keyboard=kb_inline_skip_or_cancel()
                )
                return
            data['time'] = f"{h:02d}:{m:02d}"
            preferred_dt = f"{data['date']} {data['time']}"
            _AWAITING_PREFERRED_TIME.pop(user_id)
            _create_order(user_id, client, data['car_id'], data['desc'], preferred_dt=preferred_dt)
            return

        # -------- подтверждение отзыва согласия --------
    if user_id in _AWAITING_REVOKE_CONFIRMATION:
        phone_input = text.strip()
        clean_input = phone_input.replace(' ', '').replace('(', '').replace(')', '').replace('-', '')
        if clean_input.startswith('8') and len(clean_input) == 11 and clean_input[1:].isdigit():
            clean_input = '+7' + clean_input[1:]
        if clean_input != client.phone:
            send_message(user_id, "❌ Введённый номер не совпадает с номером в профиле. Отзыв согласия отменён.",
                         keyboard=kb_main_menu())
            _AWAITING_REVOKE_CONFIRMATION.pop(user_id, None)
            return

        # Удаление всех данных клиента
        try:
            WorkOrder.query.filter_by(client_id=client.client_id).delete()
            Car.query.filter_by(client_id=client.client_id).delete()
            db.session.delete(client)
            db.session.commit()
        except Exception as e:
            logger.error(f"Revoke consent deletion error: {e}")
            db.session.rollback()
            send_message(user_id, "⚠ Произошла ошибка при удалении данных. Попробуйте позже.", keyboard=kb_main_menu())
            _AWAITING_REVOKE_CONFIRMATION.pop(user_id, None)
            return

        # Сброс всех состояний
        for d in (_AWAITING_NAME, _AWAITING_PHONE, _AWAITING_CAR_SELECTION,
                  _CAR_DATA, _AWAITING_CAR_STEP, _AWAITING_PROBLEM_DESC,
                  _AWAITING_CONTACT_DATA, _AWAITING_PREFERRED_TIME,
                  _AWAITING_REVOKE_CONFIRMATION):
            d.pop(user_id, None)

        send_message(user_id,
                     "✅ Ваши данные полностью удалены.\n"
                     "Вы можете заново принять соглашение об обработке персональных данных, отправив «Начать».",
                     keyboard=kb_empty())
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
        help_text = (
            "🔧 Автомастерская 43 | КИРОВ\n"
            "📋 Что умеет наш бот:\n\n"
            "🟢 Запись — создать заявку на ремонт или обслуживание\n\n"
            "📄 Мои заявки — посмотреть статус ваших обращений:\n"
            "   🟢 Заявка принята\n"
            "   ✅ Выполнена\n"
            "   ❌ Отменена\n\n"
            "🚗 Мои авто — список ваших автомобилей,\n"
            "   добавление и удаление\n\n"
            "👤 Профиль — ваши контактные данные\n\n"
            "🕐 Время работы: пн–сб с 10:00 до 20:00\n"
            "   Последняя запись принимается в 19:00\n"
            "   Воскресенье — выходной\n\n"
            "📞 Телефон менеджера: 67-87-09\n\n"
            "Выберите нужное действие в меню 👇"
        )
        send_message(user_id, help_text, keyboard=kb_main_menu())

    elif text_lower == 'запись':
        if not has_contact_info(client):
            _AWAITING_NAME[user_id] = True
            send_message(user_id, "📝 Для создания заявки нам нужны ваши контактные данные.\nВведите ваше ФИО полностью:", keyboard=kb_inline_cancel_process())
            return
        cars = client.cars
        if cars:
            show_car_selection(user_id, client)
        else:
            _CAR_DATA[user_id] = {'context': 'order'}
            _AWAITING_CAR_STEP[user_id] = 'model'
            send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):", keyboard=kb_inline_cancel_process())
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
                keyboard=kb_inline_my_cars(cars)
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
        send_message(user_id, msg, keyboard=kb_inline_profile_actions())
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
        keyboard=kb_inline_cancel_process()
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

        car_info = ""
        if o.car:
            model = o.car.model or 'модель не указана'
            gos = o.car.gos_number or 'без номера'
            car_info = f"\n   🚘 {model} ({gos})"

        # Извлекаем желаемую дату и время из описания
        desc = o.problem_description or ''
        preferred_dt = None
        if 'Желаемая дата и время:' in desc:
            idx = desc.find('Желаемая дата и время:')
            line = desc[idx:].split('\n')[0]
            preferred_dt = line.replace('Желаемая дата и время:', '').strip()
        elif 'Время: не указано' in desc:
            preferred_dt = 'не указано'

        if preferred_dt:
            car_info += f"\n   📅 Желаемая дата/время: {preferred_dt}"

        lines.append(f"{icon} Заявка №{o.order_id} от {dt} — {status}{car_info}")

    message_text = "📋 Ваши заявки:\n\n" + "\n\n".join(lines)
    keyboard = kb_inline_cancel_orders(cancel_orders) if cancel_orders else kb_main_menu()
    send_message(user_id, message_text, keyboard=keyboard)