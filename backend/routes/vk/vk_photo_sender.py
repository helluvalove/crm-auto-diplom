# backend/routes/vk/vk_photo_sender.py
"""
Финальная версия отправки фото клиентам через VK.

Архитектура:
  1. Параллельное скачивание с S3 (5 потоков)
  2. Параллельная заливка на VK батчами по 3 — порядок батчей строго
     последовательный, внутри батча параллельно → photo_id возрастают
     батчами → порядок у клиента сохраняется
  3. После основного прохода — fallback: повторная загрузка упавших фото
     последовательно с увеличенным таймаутом
  4. Чёрный список сломанных VK upload-серверов
  5. Сжатие до 500кб + EXIF-ориентация
"""

import io
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import vk_api.utils
from PIL import Image, ImageOps
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .utils import get_vk_api

logger = logging.getLogger(__name__)

# ---------- настройки ----------

MAX_S3_WORKERS    = 5
MAX_VK_BATCH      = 3        # фото параллельно внутри одного батча
MAX_FILE_SIZE     = 500_000  # байт — VK стабильно принимает до 500кб
JPEG_QUALITY      = 82
S3_TIMEOUT        = 20
VK_TIMEOUT        = 12       # 504 приходит быстро; 12с достаточно для 500кб
VK_TIMEOUT_RETRY  = 25       # fallback чуть щедрее
MAX_RETRIES       = 3

# ---------- чёрный список VK upload-серверов ----------
# Динамический список — серверы добавляются автоматически при 504/пустом ответе
# и удаляются через _BAD_SERVER_TTL секунд (обычно к тому времени уже работают).
# _HARDCODED_BAD — серверы стабильно мёртвые часами, хардкодим чтобы не тратить
# время после каждого рестарта Flask.

_HARDCODED_BAD: set[int] = {906428}   # стабильно мёртв — из ваших логов

_BAD_VK_SERVERS: set[int] = set(_HARDCODED_BAD)
_bad_server_times: dict[int, float] = {}
_BAD_SERVER_TTL = 60   # секунд — динамические серверы обычно быстро восстанавливаются


def _mark_bad_server(server_id: int) -> None:
    if not server_id:
        return
    _BAD_VK_SERVERS.add(server_id)
    _bad_server_times[server_id] = time.monotonic()
    logger.warning(f"[VK] Сервер {server_id} → чёрный список (всего: {len(_BAD_VK_SERVERS)})")


def _clean_bad_servers() -> None:
    now = time.monotonic()
    for s in [s for s, t in list(_bad_server_times.items()) if now - t > _BAD_SERVER_TTL]:
        if s not in _HARDCODED_BAD:   # хардкодные не сбрасываем никогда
            _BAD_VK_SERVERS.discard(s)
        _bad_server_times.pop(s, None)


def _server_id_from_url(url: str) -> int:
    m = re.search(r'/c(\d+)/', url)
    return int(m.group(1)) if m else 0


def _get_fresh_upload_server(vk, vk_user_id: int) -> dict:
    """Запрашивает upload_url, пропуская серверы из чёрного списка."""
    _clean_bad_servers()
    last = None
    for _ in range(8):
        srv = vk.photos.getMessagesUploadServer(peer_id=vk_user_id)
        last = srv
        sid = _server_id_from_url(srv.get('upload_url', ''))
        if sid and sid in _BAD_VK_SERVERS:
            logger.warning(f"[VK] Пропуск сервера {sid}")
            continue
        return srv
    logger.warning("[VK] Все попытки дали плохие серверы")
    return last


# ---------- обработка фото ----------

def _fix_and_compress(raw_bytes: bytes) -> bytes:
    """Исправляет EXIF-ориентацию и сжимает до MAX_FILE_SIZE."""
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        img = ImageOps.exif_transpose(img)
        img = img.convert('RGB')

        if img.width > 3840 or img.height > 3840:
            img.thumbnail((3840, 3840), Image.LANCZOS)

        quality = JPEG_QUALITY
        while quality >= 35:
            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=quality)
            data = buf.getvalue()
            if len(data) <= MAX_FILE_SIZE:
                logger.debug(f"[VK] {len(raw_bytes)//1024}кб → {len(data)//1024}кб (q={quality})")
                return data
            quality -= 10

        img = img.resize((img.width // 2, img.height // 2), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=55)
        return buf.getvalue()

    except Exception as e:
        logger.warning(f"[VK] Сжатие не удалось: {e}, отправляем оригинал")
        return raw_bytes


# ---------- S3 ----------

def _download_one(index: int, url: str, session: requests.Session) -> tuple[int, bytes | None]:
    """Скачивает и обрабатывает одно фото с S3. Параллельно."""
    for attempt in range(MAX_RETRIES):
        try:
            resp = session.get(url, timeout=S3_TIMEOUT)
            resp.raise_for_status()
            return index, _fix_and_compress(resp.content)
        except Exception as e:
            logger.warning(f"[VK] S3 фото {index+1}, попытка {attempt+1}: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(0.5 * (attempt + 1))
    logger.error(f"[VK] Фото {index+1}: не скачано с S3")
    return index, None


# ---------- VK upload ----------

def _upload_one_to_vk(
    index: int,
    photo_bytes: bytes,
    vk,
    vk_user_id: int,
    order_id: int,
    vk_session: requests.Session,
    timeout: int = VK_TIMEOUT,
) -> tuple[int, str | None]:
    """Заливает одно фото на VK. Без sleep между попытками — чёрный список сделает своё."""
    t0 = time.monotonic()
    for attempt in range(MAX_RETRIES):
        server_id = 0
        try:
            upload_server = _get_fresh_upload_server(vk, vk_user_id)
            server_id = _server_id_from_url(upload_server.get('upload_url', ''))

            upload_resp = vk_session.post(
                upload_server['upload_url'],
                files={'photo': ('photo.jpg', photo_bytes, 'image/jpeg')},
                timeout=timeout,
            )
            upload_resp.raise_for_status()
            upload_data = upload_resp.json()

            if not upload_data.get('photo') or not upload_data.get('server') or not upload_data.get('hash'):
                _mark_bad_server(server_id)
                raise ValueError(f"Неполный ответ VK (server={server_id})")

            saved = vk.photos.saveMessagesPhoto(
                photo=upload_data['photo'],
                server=upload_data['server'],
                hash=upload_data['hash'],
            )
            if saved:
                p = saved[0]
                att = f"photo{p['owner_id']}_{p['id']}"
                logger.info(f"[VK] Фото {index+1} ок за {time.monotonic()-t0:.1f}с (order={order_id}, attempt={attempt+1})")
                return index, att

        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 504:
                _mark_bad_server(server_id)
            logger.warning(f"[VK] Upload фото {index+1}, попытка {attempt+1}: {e}")

        except requests.exceptions.ReadTimeout:
            # Сервер принял соединение но завис — тот же класс что 504
            _mark_bad_server(server_id)
            logger.warning(f"[VK] Upload фото {index+1}, попытка {attempt+1}: ReadTimeout (сервер {server_id} → чёрный список)")

        except Exception as e:
            logger.warning(f"[VK] Upload фото {index+1}, попытка {attempt+1}: {e}")

    logger.error(f"[VK] Фото {index+1} не загружено после {MAX_RETRIES} попыток (order={order_id})")
    return index, None


# ---------- основная функция ----------

def send_photos_to_client(
    vk_user_id: int,
    order_id: int,
    photo_urls: list,
    comment: str = '',
    order_info: dict = None,
) -> None:
    """
    Этап 1: параллельное скачивание с S3 (5 потоков).
    Этап 2: заливка на VK батчами по 3 — батчи строго последовательны → порядок.
    Этап 3: fallback — повторная загрузка упавших фото последовательно.
    """
    if not vk_user_id or not photo_urls:
        return

    photo_urls = photo_urls[:10]
    order_info = order_info or {}
    total = len(photo_urls)
    t_start = time.monotonic()

    logger.info(f"[VK] Старт: {total} фото (order={order_id}), стоп-лист: {len(_BAD_VK_SERVERS)} серверов")

    vk = get_vk_api()

    s3_session = requests.Session()
    s3_session.mount("https://", HTTPAdapter(
        max_retries=Retry(total=2, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
    ))

    vk_session = requests.Session()
    vk_session.mount("https://", HTTPAdapter(max_retries=0, pool_connections=5, pool_maxsize=10))

    # ── Этап 1: параллельное скачивание с S3 ──────────────────────────────
    downloaded: dict[int, bytes | None] = {}

    with ThreadPoolExecutor(max_workers=MAX_S3_WORKERS) as pool:
        futures = {pool.submit(_download_one, i, url, s3_session): i for i, url in enumerate(photo_urls)}
        for future in as_completed(futures):
            i = futures[future]
            try:
                idx, data = future.result()
                if data:
                    downloaded[idx] = data
            except Exception as e:
                logger.error(f"[VK] Ошибка скачивания фото {i+1}: {e}")

    ok_s3 = len(downloaded)
    logger.info(f"[VK] S3: {ok_s3}/{total} за {time.monotonic()-t_start:.1f}с")

    if not downloaded:
        logger.error(f"[VK] Нет скачанных фото для order={order_id}")
        return

    # ── Этап 2: батчевая загрузка на VK ───────────────────────────────────
    # Батчи строго последовательны → photo_id возрастают → порядок у клиента сохраняется
    ready = sorted(downloaded.items())  # [(0, bytes), (1, bytes), ...]
    attachments_by_index: dict[int, str] = {}
    failed: list[tuple[int, bytes]] = []  # упавшие для fallback

    for batch_start in range(0, len(ready), MAX_VK_BATCH):
        batch = ready[batch_start: batch_start + MAX_VK_BATCH]
        t_batch = time.monotonic()

        with ThreadPoolExecutor(max_workers=len(batch)) as pool:
            futures = {
                pool.submit(_upload_one_to_vk, i, data, vk, vk_user_id, order_id, vk_session): i
                for i, data in batch
            }
            for future in as_completed(futures):
                i = futures[future]
                try:
                    idx, att = future.result()
                    if att:
                        attachments_by_index[idx] = att
                    else:
                        failed.append((i, downloaded[i]))
                except Exception as e:
                    logger.error(f"[VK] Ошибка upload фото {i+1}: {e}")
                    failed.append((i, downloaded[i]))
        logger.info(f"[VK] Батч {batch_start//MAX_VK_BATCH+1} завершён за {time.monotonic()-t_batch:.1f}с")

    # ── Этап 3: fallback для упавших фото ─────────────────────────────────
    if failed:
        logger.warning(f"[VK] Fallback для {len(failed)} фото (order={order_id})")
        # Небольшая пауза — даём VK время прийти в себя
        time.sleep(3)
        for idx, data in sorted(failed):
            _, att = _upload_one_to_vk(idx, data, vk, vk_user_id, order_id, vk_session, timeout=VK_TIMEOUT_RETRY)
            if att:
                attachments_by_index[idx] = att
                logger.info(f"[VK] Fallback фото {idx+1} успешно")
            else:
                logger.error(f"[VK] Fallback фото {idx+1} не удался")

    # Восстанавливаем порядок
    attachments = [attachments_by_index[i] for i in sorted(attachments_by_index)]

    elapsed = time.monotonic() - t_start
    logger.info(f"[VK] Итого: {len(attachments)}/{total} за {elapsed:.1f}с (order={order_id})")

    if not attachments:
        logger.error(f"[VK] Ни одно фото не загружено для order={order_id}")
        return

    # ── Отправляем сообщение клиенту ──────────────────────────────────────
    car_info = ''
    if order_info.get('car_model') or order_info.get('car_gos_number'):
        car_parts = list(filter(None, [order_info.get('car_model'), order_info.get('car_gos_number')]))
        car_info = f"\n🚗 Автомобиль: {' '.join(car_parts)}"

    mechanic_info = ''
    if order_info.get('mechanic_name'):
        mechanic_info = f"\n👨‍🔧 Механик: {order_info['mechanic_name']}"

    photo_count = len(attachments)
    photo_word = 'фото' if photo_count == 1 else ('фотографии' if photo_count < 5 else 'фотографий')
    user_comment = f"\n💬 {comment}" if comment else ''

    message = (
        f"📷 Фото по вашему заказу-наряду №{order_id}"
        f"{car_info}{mechanic_info}"
        f"\n📎 Прикреплено {photo_count} {photo_word}"
        f"{user_comment}"
    )

    try:
        vk.messages.send(
            user_id=vk_user_id,
            message=message,
            attachment=','.join(attachments),
            random_id=vk_api.utils.get_random_id(),
        )
        logger.info(f"[VK] Отправлено: user={vk_user_id}, order={order_id}, {photo_count} фото")
    except Exception as e:
        logger.error(f"[VK] Ошибка отправки сообщения: {e}")