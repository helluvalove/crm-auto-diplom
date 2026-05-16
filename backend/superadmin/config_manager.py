import os
import re

ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '.env')

def read_env():
    """Читаем .env и возвращаем словарь {ключ: значение}"""
    result = {}
    if not os.path.exists(ENV_PATH):
        return result
    with open(ENV_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                result[key.strip()] = value.strip()
    return result

def write_env_key(key, value):
    """Обновляем одно значение в .env. Если ключа нет — добавляем."""
    if not os.path.exists(ENV_PATH):
        with open(ENV_PATH, 'w') as f:
            f.write(f"{key}={value}\n")
        return

    with open(ENV_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    pattern = rf'^{re.escape(key)}=.*$'
    replacement = f'{key}={value}'

    if re.search(pattern, content, flags=re.MULTILINE):
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    else:
        content = content.rstrip('\n') + f'\n{replacement}\n'

    with open(ENV_PATH, 'w', encoding='utf-8') as f:
        f.write(content)

# Какие ключи показываем в панели (и как они называются для человека)
EDITABLE_KEYS = {
    'database': {
        'label': 'Database',
        'keys': ['DATABASE_URL', 'ENCRYPTION_KEY']
    },
    'vk': {
        'label': 'VK Bot',
        'keys': ['VK_GROUP_ID', 'VK_ACCESS_TOKEN', 'VK_SECRET_KEY', 'VK_CONFIRMATION_CODE']
    },
    'auth': {
        'label': 'Auth / JWT',
        'keys': ['SECRET_KEY', 'JWT_SECRET_KEY']
    }
}

# Эти ключи никогда не отправляем на фронтенд в открытом виде
SECRET_KEYS = {}

def get_config_for_section(section):
    """Возвращаем конфиг для секции, секреты маскируем"""
    if section not in EDITABLE_KEYS:
        return {}
    env = read_env()
    result = {}
    for key in EDITABLE_KEYS[section]['keys']:
        value = env.get(key, '')
        result[key] = {
            'value': '' if key in SECRET_KEYS else value,
            'is_secret': key in SECRET_KEYS,
            'is_set': bool(value)
        }
    return result