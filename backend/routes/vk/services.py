from models import db, Client
from datetime import datetime, timezone

def get_or_create_client(vk_user_id):
    client = Client.query.filter_by(vk_user_id=vk_user_id).first()
    if not client:
        client = Client(
            vk_user_id=vk_user_id,
            date_reg=datetime.now(timezone.utc)
            # name, phone, phone_hash будут None
        )
        db.session.add(client)
        db.session.commit()
    return client

def has_accepted_rules(client):
    return client.accepted_rules is not None

def accept_rules(client):
    client.accepted_rules = datetime.now(timezone.utc)
    db.session.commit()