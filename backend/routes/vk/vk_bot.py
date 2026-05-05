import time
import logging
from flask import request, current_app
from . import vk_bp

from .middleware import require_rules
from .handlers import handle_accept
from .utils import send_message
from .keyboards import kb_main_menu

logger = logging.getLogger(__name__)

_LAST_MESSAGE_TIME = {}

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
    text = text.strip().lower()
    process_message(user_id, text)

@vk_bp.route('/callback', methods=['POST'])
def vk_callback():
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return 'Invalid request', 400

    secret = current_app.config['VK_SECRET_KEY']
    if secret and data.get('secret') != secret:
        logger.warning("Неверный секретный ключ")
        return 'Invalid secret', 403

    if data.get('type') == 'confirmation':
        code = current_app.config['VK_CONFIRMATION_CODE']
        return code, 200, {'Content-Type': 'text/plain'}

    if data.get('type') == 'message_new':
        obj = data.get('object', {})
        msg = obj.get('message', {})
        user_id = msg.get('from_id')
        text = msg.get('text', '')
        if user_id and text:
            handle_message(user_id, text)
        return 'ok', 200

    return 'ok', 200

@require_rules
def process_message(user_id, text, client):
    # client передан декоратором, правила уже приняты
    if text == "принять":
        handle_accept(user_id, client)
        return

    if text in ['начать', 'start']:
        send_message(
            user_id,
            "🚗 Добро пожаловать в автомастерскую! Выберите действие:",
            keyboard=kb_main_menu()
        )
    elif text == 'помощь':
        send_message(
            user_id,
            "📋 Команды:\n• Запись – создать заявку\n• Статус – проверить статус",
            keyboard=kb_main_menu()
        )
    elif text == 'запись':
        send_message(
            user_id,
            "Функция записи в разработке. Пожалуйста, подождите.",
            keyboard=kb_main_menu()
        )
    elif text == 'статус':
        send_message(
            user_id,
            "Раздел статуса появится позже.",
            keyboard=kb_main_menu()
        )
    else:
        send_message(
            user_id,
            "Пожалуйста, используйте кнопки меню.",
            keyboard=kb_main_menu()
        )