import os
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken

_ENV_PATH = os.path.join(os.path.dirname(__file__), '.env')

def _read_encryption_key() -> str:
    """Читаем ENCRYPTION_KEY напрямую из .env при каждом вызове."""
    try:
        with open(_ENV_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('ENCRYPTION_KEY='):
                    return line.partition('=')[2].strip()
    except Exception:
        pass
    return os.environ.get('ENCRYPTION_KEY', 'change-me-in-production-32bytes!')

def _get_fernet() -> Fernet:
    key = _read_encryption_key()
    if isinstance(key, str):
        key = key.encode()
    try:
        return Fernet(key)
    except Exception:
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
        return ciphertext


def hash_phone(phone: str) -> str:
    """SHA-256 хэш телефона для точного поиска."""
    if not phone:
        return None
    return hashlib.sha256(phone.encode()).hexdigest()