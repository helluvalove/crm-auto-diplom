# backend/routes/vk/utils.py
import vk_api
import logging
from flask import current_app

logger = logging.getLogger(__name__)

# Кэшируем сессию — не создаём новую на каждый вызов.
# Раньше каждый вызов get_vk_api() делал новую VkApi() сессию,
# из-за чего параллельные потоки получали разные соединения
# и VK раздавал им разные (часто сломанные) upload-серверы.
_vk_instance = None
_vk_token_used = None


def get_vk_api():
    global _vk_instance, _vk_token_used
    token = current_app.config['VK_ACCESS_TOKEN']
    # Пересоздаём если токен сменился (например hot-reload конфига)
    if _vk_instance is None or token != _vk_token_used:
        session = vk_api.VkApi(token=token)
        _vk_instance = session.get_api()
        _vk_token_used = token
        logger.info("[VK] Сессия VK API создана")
    return _vk_instance


def send_message(user_id, text, keyboard=None):
    try:
        vk = get_vk_api()
        vk.messages.send(
            user_id=user_id,
            message=text,
            random_id=vk_api.utils.get_random_id(),
            keyboard=keyboard
        )
    except Exception as e:
        logger.error(f"Ошибка отправки: {e}")