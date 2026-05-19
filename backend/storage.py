# backend/storage.py
"""
Работа с Yandex Object Storage (S3-совместимый).
Кладётся в backend/ рядом с models.py и app.py.

Переменные окружения (добавить в .env / config):
    YC_ACCESS_KEY   — access key сервисного аккаунта
    YC_SECRET_KEY   — secret key сервисного аккаунта
    YC_BUCKET       — имя бакета (например: autoservice-photos)
    YC_ENDPOINT     — https://storage.yandexcloud.net  (дефолт)
    YC_PRESIGN_TTL  — срок жизни ссылки в секундах (дефолт: 604800 = 7 дней)
"""

import os
import logging
from uuid import uuid4

import boto3
from botocore.client import Config

logger = logging.getLogger(__name__)

# ---------- инициализация клиента ----------

_s3 = None


def _get_s3():
    """Ленивая инициализация — не падает при импорте без переменных окружения."""
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            's3',
            endpoint_url=os.environ.get('YC_ENDPOINT', 'https://storage.yandexcloud.net'),
            aws_access_key_id=os.environ['YC_ACCESS_KEY'],
            aws_secret_access_key=os.environ['YC_SECRET_KEY'],
            config=Config(signature_version='s3v4'),
            region_name='ru-central1',
        )
    return _s3


def upload_photo(file_obj, order_id: int, original_filename: str = '') -> str:
    """
    Загружает файл в бакет и возвращает presigned URL.

    :param file_obj:          file-like объект (например, request.files['photo'])
    :param order_id:          ID заказа — используется как часть пути в бакете
    :param original_filename: оригинальное имя файла (для определения расширения)
    :return:                  presigned URL, действительный YC_PRESIGN_TTL секунд
    """
    bucket = os.environ['YC_BUCKET']
    ttl    = int(os.environ.get('YC_PRESIGN_TTL', 604800))

    # Определяем расширение; если непонятно — jpg
    ext = 'jpg'
    if original_filename and '.' in original_filename:
        candidate = original_filename.rsplit('.', 1)[-1].lower()
        if candidate in ('jpg', 'jpeg', 'png', 'webp', 'heic'):
            ext = candidate

    key = f"orders/{order_id}/{uuid4()}.{ext}"

    s3 = _get_s3()
    s3.upload_fileobj(
        file_obj,
        bucket,
        key,
        ExtraArgs={'ContentType': f'image/{ext}'},
    )

    presigned_url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket, 'Key': key},
        ExpiresIn=ttl,
    )

    logger.info(f"[S3] Загружено: {key}")
    return presigned_url