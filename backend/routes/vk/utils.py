import vk_api
import logging
from flask import current_app

logger = logging.getLogger(__name__)

def get_vk_api():
    token = current_app.config['VK_ACCESS_TOKEN']
    session = vk_api.VkApi(token=token)
    return session.get_api()

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