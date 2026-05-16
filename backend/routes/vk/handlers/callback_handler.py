# backend/routes/vk/handlers/callback_handler.py
import json
import logging

from ..vk_api_client import get_vk
from ..helpers import clear_inline_buttons
from ..utils import send_message
from ..keyboards import kb_main_menu, kb_empty, kb_inline_cancel_process, kb_inline_my_cars, kb_inline_add_car
from ..state import ( 
    _AWAITING_PROBLEM_DESC, _CAR_DATA, _AWAITING_CAR_STEP,
    _AWAITING_NAME, _AWAITING_PHONE, _AWAITING_CAR_SELECTION,
    _AWAITING_CONTACT_DATA, _AWAITING_PREFERRED_TIME,
    _AWAITING_REVOKE_CONFIRMATION
)
from ..services import (
    get_or_create_client,
    accept_rules,
    has_accepted_rules,
    decline_rules,
    cancel_order,
    get_active_order_for_car
)
from .message_handler import process_message, show_orders, _create_order

from models import db, Car, WorkOrder

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
        send_message(user_id, "🚙 Введите модель автомобиля (например, Lada Granta):",
                     keyboard=kb_inline_cancel_process())

    elif command == 'cancel_and_create_new':
        order_id = payload.get('order_id')
        car_id = payload.get('car_id')
        try:
            cancel_order(order_id, user_id)
            _AWAITING_PROBLEM_DESC[user_id] = car_id
            send_message(user_id,
                         "📝 Кратко опишите проблему (например, «не заводится», «стук в подвеске»)\n"
                         "Или напишите «Пропустить», чтобы оставить без описания.",
                         keyboard=kb_inline_cancel_process())
        except Exception as e:
            logger.error(f"Cancel order error: {e}")
            send_message(user_id, "⚠ Не удалось отменить заявку. Возможно, она уже обработана.", keyboard=kb_main_menu())

    elif command == 'skip_datetime':
        data = _AWAITING_PREFERRED_TIME.get(user_id)
        if data:
            step = data.get('step')
            if step == 'time':
                preferred_dt = data.get('date')
            else:
                preferred_dt = None
            # Сбрасываем состояние В ЛЮБОМ случае — и при успехе, и при ошибке
            _AWAITING_PREFERRED_TIME.pop(user_id, None)
            _create_order(user_id, client, data['car_id'], data['desc'], preferred_dt=preferred_dt)

    elif command == 'revoke_consent':
        if not client.phone:
            send_message(user_id,
                         "❌ В вашем профиле отсутствует номер телефона. Невозможно подтвердить отзыв согласия.",
                         keyboard=kb_main_menu())
            return 'ok'
        _AWAITING_REVOKE_CONFIRMATION[user_id] = True
        send_message(user_id,
                     "⚠ Вы запросили отзыв согласия и полное удаление всех ваших данных (профиль, автомобили, заявки).\n\n"
                     "Для подтверждения введите ваш номер телефона, указанный в профиле:",
                     keyboard=kb_inline_cancel_process())
        return 'ok'

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

    elif command == 'delete_car':
        car_id = payload.get('car_id')
        if not car_id:
            send_message(user_id, "⚠ Ошибка: не указан автомобиль.", keyboard=kb_main_menu())
            return 'ok'

        car = Car.query.filter_by(car_id=car_id, client_id=client.client_id).first()
        if not car:
            send_message(user_id, "⚠ Автомобиль не найден или уже удалён.", keyboard=kb_main_menu())
            return 'ok'

        car_model = car.model or 'без модели'
        car_gos = car.gos_number or 'без номера'

        active_order = get_active_order_for_car(car_id)
        if active_order:
            send_message(
                user_id,
                f"❌ Нельзя удалить автомобиль {car_model} ({car_gos}) — "
                f"на него есть активная заявка №{active_order.order_id}.\n"
                "Сначала отмените или завершите заявку.",
                keyboard=kb_main_menu()
            )
            return 'ok'

        try:
            # Удаляем все заявки по этому авто
            WorkOrder.query.filter_by(car_id=car_id, client_id=client.client_id).delete()
            db.session.delete(car)
            db.session.commit()

            # Формируем итоговое сообщение
            message = f"✅ Автомобиль {car_model} ({car_gos}) успешно удалён из профиля."

            # Если остались другие машины, покажем их краткий список
            remaining_cars = client.cars  # связь обновлена
            if remaining_cars:
                lines = []
                for i, c in enumerate(remaining_cars, 1):
                    lines.append(f"{i}. {c.model or '—'} ({c.gos_number or 'без номера'})")
                message += "\n\n🚗 Оставшиеся авто:\n" + "\n".join(lines)
            else:
                message += "\n\n🚘 Теперь у вас нет добавленных автомобилей."

            send_message(user_id, message, keyboard=kb_main_menu())

        except Exception as e:
            logger.error(f"Delete car error: {e}")
            db.session.rollback()
            send_message(user_id, "⚠ Ошибка при удалении автомобиля.", keyboard=kb_main_menu())

    elif command == 'cancel_process':
        # Проверяем, есть ли только что созданная машина без заявки
        car_id = _AWAITING_PROBLEM_DESC.get(user_id)
        if car_id:
            car = Car.query.filter_by(car_id=car_id, client_id=client.client_id).first()
            if car:
                # Если на эту машину ещё нет ни одной заявки — удаляем её
                has_orders = WorkOrder.query.filter_by(car_id=car_id).first()
                if not has_orders:
                    try:
                        db.session.delete(car)
                        db.session.commit()
                    except Exception as e:
                        logger.warning(f"Не удалось удалить машину {car_id} при отмене: {e}")
                        db.session.rollback()

        # Сброс всех состояний пользователя
        for d in (_AWAITING_NAME, _AWAITING_PHONE, _AWAITING_CAR_SELECTION,
                  _CAR_DATA, _AWAITING_CAR_STEP, _AWAITING_PROBLEM_DESC,
                  _AWAITING_CONTACT_DATA, _AWAITING_PREFERRED_TIME, _AWAITING_REVOKE_CONFIRMATION):
            d.pop(user_id, None)
        send_message(user_id,
                     "❌ Процесс отменён. Вы вернулись в главное меню.",
                     keyboard=kb_main_menu())
    return 'ok'