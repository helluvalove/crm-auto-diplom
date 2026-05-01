import time
import logging
import vk_api
from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType

logger = logging.getLogger(__name__)

# Временно hardcode, потом вынести в config/.env
GROUP_ID = 123456789         # ID твоего сообщества (цифры)
ACCESS_TOKEN = 'vk1.a...'    # Ключ доступа с правами на сообщения

vk_session = vk_api.VkApi(token=ACCESS_TOKEN)
vk = vk_session.get_api()
longpoll = VkBotLongPoll(vk_session, GROUP_ID)

# Защита от спама: не чаще 1 сообщения в 1.5 секунды
_LAST_MESSAGE_TIME = {}      # {user_id: timestamp}

def send_message(user_id, text):
    """Отправка простого сообщения."""
    try:
        vk.messages.send(user_id=user_id, message=text, random_id=0)
    except Exception as e:
        logger.error(f"Ошибка отправки: {e}")

def is_spam(user_id):
    now = time.time()
    last = _LAST_MESSAGE_TIME.get(user_id, 0)
    if now - last < 1.5:
        return True
    _LAST_MESSAGE_TIME[user_id] = now
    return False

def handle_message(event):
    msg = event.obj.message
    user_id = msg['from_id']
    text = msg['text'].strip()

    if is_spam(user_id):
        send_message(user_id, "⏳ Слишком частые сообщения. Подождите немного.")
        return

    if text.lower() in ['начать', 'start']:
        send_message(user_id, "🚗 Добро пожаловать в автосервис «Киров 43»!\nНапишите «Помощь» для списка команд.")
    elif text.lower() == 'помощь':
        send_message(user_id, "📋 Пока доступны:\n• Начать\n• Запись (скоро)\n• Статус (скоро)")
    else:
        send_message(user_id, "Введите «Начать» для начала.")

def start_bot_polling():
    """Фоновый цикл Long Poll с авторестартом при ошибке."""
    while True:
        try:
            logger.info("VK бот слушает события...")
            for event in longpoll.listen():
                if event.type == VkBotEventType.MESSAGE_NEW:
                    handle_message(event)
        except Exception as e:
            logger.error(f"Ошибка Long Poll: {e}")
            time.sleep(5)