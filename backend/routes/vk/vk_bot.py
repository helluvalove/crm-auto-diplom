# vk/vk_bot.py
import json
import logging
from flask import request, current_app

from . import vk_bp
from .state import _PROCESSED_MESSAGES, _PROCESSED_EVENTS
from .helpers import is_spam
from .utils import send_message
from .handlers.message_handler import process_message
from .handlers.callback_handler import process_event

logger = logging.getLogger(__name__)

def handle_message(user_id, text):
    if is_spam(user_id):
        send_message(user_id, "⏳ Слишком частые сообщения.")
        return
    process_message(user_id, text)

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

    if event_type == 'confirmation':
        return current_app.config.get('VK_CONFIRMATION_CODE', ''), 200

    if event_type == 'message_new':
        obj = data.get('object', {})
        msg = obj.get('message', {})
        user_id = msg.get('from_id')
        text = msg.get('text', '')
        msg_id = msg.get('id')

        if not msg_id or msg_id in _PROCESSED_MESSAGES:
            return 'ok', 200
        if len(_PROCESSED_MESSAGES) > 5_000:
            _PROCESSED_MESSAGES.clear()
        _PROCESSED_MESSAGES.add(msg_id)

        if user_id and text:
            handle_message(user_id, text)
        return 'ok', 200

    if event_type == 'message_event':
        event = data.get('object', {})
        event_id = event.get('event_id')
        if event_id in _PROCESSED_EVENTS:
            return 'ok', 200
        if len(_PROCESSED_EVENTS) > 5_000:
            _PROCESSED_EVENTS.clear()
        _PROCESSED_EVENTS.add(event_id)
        return process_event(event)

    return 'ok', 200