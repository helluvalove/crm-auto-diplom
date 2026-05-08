from models import db, Client, Car
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