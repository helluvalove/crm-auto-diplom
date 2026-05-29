# backend/routes/vk/vk_notify.py
"""
Уведомления клиентам через VK — смена статуса заказа и отправка фото.
Вызывается из backend/routes/orders.py.

Использует get_vk_api() из utils.py, чтобы не дублировать инициализацию сессии.
"""

import logging
import time
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


def send_photos_to_client(
    vk_user_id: int,
    order_id: int,
    photo_urls: list,
    comment: str = '',
    order_info: dict = None,
) -> None:
    """
    Загружает список фото на серверы VK и отправляет клиенту одним сообщением-сеткой.

    :param vk_user_id:  VK ID клиента
    :param order_id:    ID заказа
    :param photo_urls:  список presigned URL (макс. 10 — ограничение VK)
    :param comment:     комментарий механика
    :param order_info:  dict с ключами car_model, car_gos_number, mechanic_name (необязательно)
    """
    if not vk_user_id or not photo_urls:
        return

    # VK принимает не более 10 вложений в одном сообщении
    photo_urls = photo_urls[:10]
    order_info = order_info or {}

    try:
        vk = get_vk_api()
        attachments = []

        for i, url in enumerate(photo_urls):
            # Небольшая пауза между загрузками чтобы не спамить VK
            if i > 0:
                time.sleep(0.5)

            uploaded = False
            for attempt in range(3):  # до 3 попыток на каждое фото
                try:
                    # Скачиваем с S3 (увеличен таймаут для тяжёлых фото с телефона)
                    resp = requests.get(url, timeout=90)
                    resp.raise_for_status()
                    photo_bytes = resp.content

                    # Каждый раз получаем свежий upload_url (он одноразовый)
                    upload_server = vk.photos.getMessagesUploadServer(peer_id=vk_user_id)

                    upload_resp = requests.post(
                        upload_server['upload_url'],
                        files={'photo': ('photo.jpg', photo_bytes, 'image/jpeg')},
                        timeout=120,
                    )
                    upload_resp.raise_for_status()
                    upload_data = upload_resp.json()

                    # Проверяем что VK вернул нужные поля — при 504 они отсутствуют
                    if not upload_data.get('photo') or not upload_data.get('server') or not upload_data.get('hash'):
                        raise ValueError(f"Неполный ответ VK upload: {upload_data}")

                    saved = vk.photos.saveMessagesPhoto(
                        photo=upload_data['photo'],
                        server=upload_data['server'],
                        hash=upload_data['hash'],
                    )
                    if saved:
                        p = saved[0]
                        attachments.append(f"photo{p['owner_id']}_{p['id']}")
                        uploaded = True
                        break  # успех

                except Exception as e:
                    logger.warning(f"[VK] Попытка {attempt + 1}/3 для фото {i + 1} (order={order_id}): {e}")
                    if attempt < 2:
                        # После 504 VK нужно дать время — увеличиваем паузу с каждой попыткой
                        time.sleep(5 * (attempt + 1))

            if not uploaded:
                logger.error(f"[VK] Фото {i + 1} не загружено после 3 попыток (order={order_id})")

        if not attachments:
            logger.error(f"[VK] Ни одно фото не загружено для order={order_id}")
            return

        # Формируем информативный текст сообщения
        car_info = ''
        if order_info.get('car_model') or order_info.get('car_gos_number'):
            car_parts = filter(None, [order_info.get('car_model'), order_info.get('car_gos_number')])
            car_info = f"\n🚗 Автомобиль: {' '.join(car_parts)}"

        mechanic_info = ''
        if order_info.get('mechanic_name'):
            mechanic_info = f"\n👨‍🔧 Механик: {order_info['mechanic_name']}"

        photo_count = len(attachments)
        photo_word = 'фото' if photo_count == 1 else ('фотографии' if photo_count < 5 else 'фотографий')

        user_comment = f"\n💬 {comment}" if comment else ''

        message = (
            f"📷 Фото по вашему заказу-наряду №{order_id}"
            f"{car_info}"
            f"{mechanic_info}"
            f"\n📎 Прикреплено {photo_count} {photo_word}"
            f"{user_comment}"
        )

        vk.messages.send(
            user_id=vk_user_id,
            message=message,
            attachment=','.join(attachments),
            random_id=vk_api.utils.get_random_id(),
        )
        logger.info(f"[VK] {photo_count} фото отправлено: user={vk_user_id}, order={order_id}")

    except Exception as e:
        logger.error(f"[VK] Ошибка отправки фото: {e}")