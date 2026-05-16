import os
import signal
import subprocess
from flask import Blueprint, request, jsonify, send_from_directory
from .auth import check_superadmin_credentials, create_superadmin_token, require_superadmin
from .config_manager import write_env_key, get_config_for_section, read_env, SECRET_KEYS

superadmin_bp = Blueprint('superadmin', __name__, url_prefix='/superadmin')

FRONTEND_SUPERADMIN = os.path.join(
    os.path.dirname(__file__), '..', '..', 'frontend', 'superadmin'
)

# ── Отдаём HTML-страницу ──────────────────────────────────────────
@superadmin_bp.route('/')
@superadmin_bp.route('/panel')
def panel():
    return send_from_directory(FRONTEND_SUPERADMIN, 'index.html')

# ── Вход ─────────────────────────────────────────────────────────
@superadmin_bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400
    
    login = data.get('login', '').strip()
    password = data.get('password', '')
    
    if not check_superadmin_credentials(login, password):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    token = create_superadmin_token()
    return jsonify({'token': token})

# ── Получить конфиг секции ────────────────────────────────────────
@superadmin_bp.route('/api/config/<section>', methods=['GET'])
@require_superadmin
def get_config(section):
    config = get_config_for_section(section)
    if not config:
        return jsonify({'error': 'Unknown section'}), 404
    return jsonify(config)

# ── Сохранить одно значение ───────────────────────────────────────
@superadmin_bp.route('/api/config', methods=['POST'])
@require_superadmin
def save_config():
    data = request.get_json()
    key = data.get('key', '').strip()
    value = data.get('value', '').strip()
    
    if not key:
        return jsonify({'error': 'Key is required'}), 400
    
    # Не даём менять суперадмин-ключи через панель
    forbidden = {'SUPERADMIN_LOGIN', 'SUPERADMIN_PASSWORD', 'SUPERADMIN_JWT_SECRET'}
    if key in forbidden:
        return jsonify({'error': 'Cannot change this key via panel'}), 403
    
    write_env_key(key, value)
    return jsonify({'ok': True, 'key': key})

# ── Список бэкапов ────────────────────────────────────────────────
@superadmin_bp.route('/api/backups', methods=['GET'])
@require_superadmin
def list_backups():
    backup_dir = os.path.join(os.path.dirname(__file__), '..', 'backups')
    if not os.path.exists(backup_dir):
        return jsonify({'backups': []})
    
    files = []
    for fname in sorted(os.listdir(backup_dir), reverse=True):
        if fname.endswith('.sql') or fname.endswith('.sql.gz'):
            fpath = os.path.join(backup_dir, fname)
            stat = os.stat(fpath)
            files.append({
                'filename': fname,
                'size_bytes': stat.st_size,
                'size': f"{stat.st_size / 1024:.0f} KB",
                'modified': stat.st_mtime
            })
    return jsonify({'backups': files})

# ── Скачать бэкап ─────────────────────────────────────────────────
@superadmin_bp.route('/api/backups/download/<filename>', methods=['GET'])
@require_superadmin
def download_backup(filename):
    backup_dir = os.path.join(os.path.dirname(__file__), '..', 'backups')
    # Защита от path traversal
    if '..' in filename or '/' in filename:
        return jsonify({'error': 'Invalid filename'}), 400
    return send_from_directory(backup_dir, filename, as_attachment=True)

# ── Удалить бэкап ─────────────────────────────────────────────────
@superadmin_bp.route('/api/backups/<filename>', methods=['DELETE'])
@require_superadmin
def delete_backup(filename):
    backup_dir = os.path.join(os.path.dirname(__file__), '..', 'backups')
    if '..' in filename or '/' in filename:
        return jsonify({'error': 'Invalid filename'}), 400
    fpath = os.path.join(backup_dir, filename)
    if not os.path.exists(fpath):
        return jsonify({'error': 'File not found'}), 404
    os.remove(fpath)
    return jsonify({'ok': True})

# ── Статус системы ────────────────────────────────────────────────
@superadmin_bp.route('/api/status', methods=['GET'])
@require_superadmin
def system_status():
    env = read_env()
    
    # Проверяем БД
    db_ok = False
    try:
        from models import db
        db.session.execute(db.text('SELECT 1'))
        db_ok = True
    except Exception:
        pass
    
    # Проверяем VK
    vk_configured = bool(env.get('VK_ACCESS_TOKEN')) and env.get('VK_GROUP_ID', '0') != '0'
    
    return jsonify({
        'database': {'ok': db_ok, 'label': 'PostgreSQL'},
        'vk': {'ok': vk_configured, 'label': 'VK Bot'},
        'backup_count': len(os.listdir(
            os.path.join(os.path.dirname(__file__), '..', 'backups')
        )) if os.path.exists(os.path.join(os.path.dirname(__file__), '..', 'backups')) else 0
    })