# vk/vk_api_client.py
import logging
from flask import current_app
from vk_api import VkApi

logger = logging.getLogger(__name__)
_vk = None

def get_vk():
    global _vk
    if _vk is None:
        token = current_app.config.get('VK_ACCESS_TOKEN')
        if not token:
            raise RuntimeError("VK_ACCESS_TOKEN is not set in config")
        vk_session = VkApi(token=token)
        _vk = vk_session.get_api()
    return _vk