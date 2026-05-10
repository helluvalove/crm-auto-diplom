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
    client.declined_rules = None          # сброс, если до этого отказывался
    db.session.commit()


def decline_rules(client):
    client.accepted_rules = None          # если было принято – сбрасываем
    client.declined_rules = datetime.now(timezone.utc)
    db.session.commit()


def get_or_create_car_for_client(client, gos_number):
    car = Car.query.filter_by(client_id=client.client_id, gos_number=gos_number).first()

    if car:
        return car

    car = Car.query.filter_by(gos_number=gos_number).first()

    if car:
        return car

    car = Car(
        client_id=client.client_id,
        model="Не указана",
        vin=None,
        gos_number=gos_number,
        year=datetime.now(timezone.utc).year,
        mileage=0
    )

    db.session.add(car)
    db.session.commit()

    return car


def is_valid_gos_number(gos_number: str) -> bool:
    pattern = r'^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$'
    return bool(re.match(pattern, gos_number.upper()))

def get_active_order_for_car(car_id):
    """Возвращает активную заявку (статус 'Заявка') для указанного авто или None."""
    return WorkOrder.query.filter_by(car_id=car_id, status='Заявка').first()


def cancel_order(order_id, user_id):
    """Отменяет заявку, если она принадлежит user_id и статус 'Заявка'."""
    client = get_or_create_client(user_id)
    order = WorkOrder.query.filter_by(order_id=order_id, client_id=client.client_id).first()
    if not order:
        raise ValueError("Заявка не найдена или не принадлежит вам.")
    if order.status != 'Заявка':
        raise ValueError("Заявку нельзя отменить, статус уже изменён.")
    order.status = 'Отменена'
    db.session.commit()