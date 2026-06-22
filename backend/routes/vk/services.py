from models import db, Client, Car, WorkOrder
from datetime import datetime, timezone
import re


def get_or_create_client(vk_user_id):
    client = Client.query.filter_by(vk_user_id=vk_user_id).first()
    if not client:
        client = Client(
            vk_user_id=vk_user_id,
            date_reg=datetime.now(timezone.utc),
            accepted_rules=None
        )
        db.session.add(client)
        db.session.commit()
    return client


def has_contact_info(client):
    return bool(client.name and client.phone)


def update_client_info(client, name=None, phone=None):
    if name:
        client.name = name
    if phone:
        client.phone = phone
    db.session.commit()


def has_accepted_rules(client):
    return client.accepted_rules is not None


def accept_rules(client):
    client.accepted_rules = datetime.now(timezone.utc)
    client.declined_rules = None
    db.session.commit()


def decline_rules(client):
    client.accepted_rules = None
    client.declined_rules = datetime.now(timezone.utc)
    db.session.commit()


def is_valid_gos_number(gos_number: str) -> bool:
    pattern = r'^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$'
    return bool(re.match(pattern, gos_number.upper()))


# Заказ считается завершённым/неактивным только в этих статусах.
# Любой другой статус ('Заявка', 'Забронирован', 'Создан', 'На диагностике',
# 'В работе', 'Готов к выдаче') означает, что по машине сейчас ведётся
# работа или она ожидает её начала — значит, новую заявку создавать нельзя.
# Учитываем оба варианта написания отмены ('Отменена'/'Отменен'), так как
# в разных местах кода используются разные формы.
_INACTIVE_ORDER_STATUSES = {'Выполнен', 'Отменена', 'Отменен'}


def get_active_order_for_car(car_id):
    return (
        WorkOrder.query
        .filter_by(car_id=car_id)
        .filter(~WorkOrder.status.in_(_INACTIVE_ORDER_STATUSES))
        .first()
    )


def cancel_order(order_id, user_id):
    client = get_or_create_client(user_id)
    order = WorkOrder.query.filter_by(order_id=order_id, client_id=client.client_id).first()
    if not order:
        raise ValueError("Заявка не найдена или не принадлежит вам.")
    if order.status != 'Заявка':
        raise ValueError("Заявку нельзя отменить, статус уже изменён.")
    order.status = 'Отменена'
    db.session.commit()


# ---------- ГЛОБАЛЬНЫЕ ПРОВЕРКИ ----------
def is_gos_number_taken(gos_number: str) -> bool:
    return Car.query.filter_by(gos_number=gos_number).first() is not None


def is_vin_taken(vin: str) -> bool:
    if not vin:
        return False
    return Car.query.filter_by(vin=vin).first() is not None