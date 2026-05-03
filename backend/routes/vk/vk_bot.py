import time
import logging
import vk_api
from flask import request, current_app
from . import vk_bp

logger = logging.getLogger(__name__)

_LAST_MESSAGE_TIME = {}

def get_vk_api():
    token = current_app.config['VK_ACCESS_TOKEN']
    if not token:
        raise RuntimeError("VK_ACCESS_TOKEN не задан")
    session = vk_api.VkApi(token=token)
    return session.get_api()

def send_message(user_id, text):
    try:
        vk = get_vk_api()
        vk.messages.send(
            user_id=user_id,
            message=text,
            random_id=vk_api.utils.get_random_id()
        )
    except Exception as e:
        logger.error(f"Ошибка отправки: {e}")

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
    if text in ['начать', 'start']:
        send_message(user_id, "🚗 Добро пожаловать в сообщество «Автомастерская 43 | КИРОВ»!\nНапишите «Помощь».")
    elif text == 'помощь':
        send_message(user_id, "📋 Пока доступны:\n• Начать\n• Запись (скоро)\n• Статус (скоро)")
    else:
        send_message(user_id, "Введите «Начать» для начала.")

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