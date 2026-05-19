# backend/routes/vk/vk_notify.py
"""
Уведомления клиентам через VK — смена статуса заказа и отправка фото.
Вызывается из backend/routes/orders.py.

Использует get_vk_api() из utils.py, чтобы не дублировать инициализацию сессии.
"""

import logging
import requests
import vk_api.utils

from .utils import get_vk_api

logger = logging.getLogger(__name__)

# ---------- тексты уведомлений по статусам ----------

STATUS_MESSAGES = {
    'Забронирован':   '📅 Ваша запись подтверждена. Ждём вас!',
    'Создан':         '📋 Ваш заказ-наряд создан. Скоро начнём работу.',
    'На диагностике': '🔍 Ваш автомобиль принят на диагностику.',
    'В работе':       '🔧 Ремонт вашего автомобиля начат.',
    'Готов к выдаче': '✅ Ваш автомобиль готов! Приезжайте забирать.',
    'Выполнен':       '🎉 Заказ завершён. Спасибо, что выбрали нас!',
    'Отменен':        '❌ Ваш заказ отменён. По вопросам звоните нам.',
}


def notify_status_change(vk_user_id: int, order_id: int, new_status: str) -> None:
    """
    Отправляет клиенту текстовое уведомление о смене статуса заказа.
    Не бросает исключения — все ошибки только логируются,
    чтобы не ронять основной запрос из orders.py.
    """
    text = STATUS_MESSAGES.get(new_status)
    if not text or not vk_user_id:
        return

    message = f"Заказ-наряд #{order_id}\n{text}"

    try:
        vk = get_vk_api()
        vk.messages.send(
            user_id=vk_user_id,
            message=message,
            random_id=vk_api.utils.get_random_id(),
        )
        logger.info(
            f"[VK] Статус отправлен: user={vk_user_id}, order={order_id}, status={new_status}"
        )
    except Exception as e:
        logger.error(f"[VK] Ошибка уведомления о статусе: {e}")


def send_photo_to_client(vk_user_id: int, order_id: int, photo_url: str, comment: str = '') -> None:
    """
    Скачивает фото с presigned URL (Yandex Object Storage) и отправляет клиенту в VK.

    Алгоритм VK API:
      1. photos.getMessagesUploadServer — получаем адрес загрузки
      2. POST с файлом на этот адрес
      3. photos.saveMessagesPhoto — сохраняем, получаем attachment
      4. messages.send с attachment

    Не бросает исключения — все ошибки только логируются.
    """
    if not vk_user_id:
        return

    try:
        vk = get_vk_api()

        # 1. Скачиваем фото с нашего S3 по presigned URL
        resp = requests.get(photo_url, timeout=30)
        resp.raise_for_status()
        photo_bytes = resp.content

        # 2. Получаем адрес загрузки на серверы VK
        upload_server = vk.photos.getMessagesUploadServer(peer_id=vk_user_id)
        upload_url = upload_server['upload_url']

        # 3. Загружаем байты фото на сервер VK
        upload_resp = requests.post(
            upload_url,
            files={'photo': ('photo.jpg', photo_bytes, 'image/jpeg')},
            timeout=60,
        )
        upload_resp.raise_for_status()
        upload_data = upload_resp.json()

        # 4. Сохраняем фото в VK
        saved = vk.photos.saveMessagesPhoto(
            photo=upload_data['photo'],
            server=upload_data['server'],
            hash=upload_data['hash'],
        )
        if not saved:
            raise ValueError('photos.saveMessagesPhoto вернул пустой список')

        photo_obj = saved[0]
        attachment = f"photo{photo_obj['owner_id']}_{photo_obj['id']}"

        # 5. Отправляем сообщение с фото
        caption = comment.strip() if comment else f'📷 Фото по заказу-наряду #{order_id}'
        vk.messages.send(
            user_id=vk_user_id,
            message=caption,
            attachment=attachment,
            random_id=vk_api.utils.get_random_id(),
        )
        logger.info(f"[VK] Фото отправлено: user={vk_user_id}, order={order_id}")

    except Exception as e:
        logger.error(f"[VK] Ошибка отправки фото: {e}")