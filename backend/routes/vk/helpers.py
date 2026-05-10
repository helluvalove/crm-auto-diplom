# vk/helpers.py
import time
import logging
from .state import _LAST_MESSAGE_TIME
from .keyboards import kb_empty

logger = logging.getLogger(__name__)

def is_spam(user_id):
    now = time.time()
    last = _LAST_MESSAGE_TIME.get(user_id, 0)
    if now - last < 1.5:
        return True
    _LAST_MESSAGE_TIME[user_id] = now
    return False

def clear_inline_buttons(vk, peer_id, event):
    cmid = event.get('conversation_message_id')
    if cmid:
        try:
            vk.messages.edit(
                peer_id=peer_id,
                conversation_message_id=cmid,
                message=event.get('text', ''),
                keyboard=kb_empty()
            )
        except Exception as e:
            logger.warning(f"Не удалось убрать кнопки: {e}")