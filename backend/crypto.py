import os
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from config_base import Config

# Инициализация Fernet с ключом из конфига
def _get_fernet() -> Fernet:
    key = Config.ENCRYPTION_KEY
    if isinstance(key, str):
        key = key.encode()
    # Fernet требует ключ в формате base64-urlsafe 32 байта
    # Если ключ передан как строка-пароль, можно привести к нужному формату
    try:
        return Fernet(key)
    except Exception:
        # Автоматически преобразуем произвольный пароль в Fernet-ключ
        key = base64.urlsafe_b64encode(hashlib.sha256(key).digest())
        return Fernet(key)


def encrypt_data(plaintext: str | None) -> str | None:
    """Шифрует строку и возвращает base64-строку."""
    if plaintext is None:
        return None
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_data(ciphertext: str | None) -> str | None:
    """Расшифровывает base64-строку. Если данные не зашифрованы – возвращает как есть."""
    if ciphertext is None:
        return None
    f = _get_fernet()
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception):
        # Считаем, что это старые открытые данные
        return ciphertext


def hash_phone(phone: str) -> str:
    """SHA-256 хэш телефона для точного поиска."""
    if not phone:
        return None
    return hashlib.sha256(phone.encode()).hexdigest()