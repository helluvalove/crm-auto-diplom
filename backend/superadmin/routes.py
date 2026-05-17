import os
import subprocess
from pathlib import Path
from flask import Blueprint, request, jsonify, send_from_directory
from .auth import check_superadmin_credentials, create_superadmin_token, require_superadmin
from .config_manager import write_env_key, get_config_for_section, read_env

superadmin_bp = Blueprint('superadmin', __name__, url_prefix='/superadmin')

FRONTEND_SUPERADMIN = os.path.join(
    os.path.dirname(__file__), '..', '..', 'frontend', 'superadmin'
)

# Путь к файлу соглашения о персональных данных (privacy.html)
PRIVACY_HTML_PATH = Path(__file__).parent.parent.parent / 'frontend' / 'public' / 'privacy.html'


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

    forbidden = {'SUPERADMIN_LOGIN', 'SUPERADMIN_PASSWORD', 'SUPERADMIN_JWT_SECRET'}
    if key in forbidden:
        return jsonify({'error': 'Cannot change this key via panel'}), 403

    write_env_key(key, value)
    return jsonify({'ok': True, 'key': key})


# ── Список бэкапов ────────────────────────────────────────────────
@superadmin_bp.route('/api/backups', methods=['GET'])
@require_superadmin
def list_backups():
    backup_dir = Path(__file__).parent / '..' / 'backups'
    if not backup_dir.exists():
        return jsonify({'backups': []})

    files = []
    for fname in sorted(backup_dir.iterdir(), key=lambda p: p.name, reverse=True):
        if fname.suffix in ('.sql', '.gz'):
            stat = fname.stat()
            import datetime
            files.append({
                'filename': fname.name,
                'size_bytes': stat.st_size,
                'size': f"{stat.st_size / 1024:.1f} KB",
                'created': datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'modified': stat.st_mtime,
            })
    return jsonify({'backups': files})


# ── Скачать бэкап ─────────────────────────────────────────────────
@superadmin_bp.route('/api/backups/download/<filename>', methods=['GET'])
@require_superadmin
def download_backup(filename):
    backup_dir = Path(__file__).parent / '..' / 'backups'
    if '..' in filename or '/' in filename or '\\' in filename:
        return jsonify({'error': 'Invalid filename'}), 400
    safe_path = backup_dir / filename
    if not safe_path.exists() or not safe_path.is_file():
        return jsonify({'error': 'File not found'}), 404
    return send_from_directory(backup_dir, filename, as_attachment=True)


# ── Удалить бэкап ─────────────────────────────────────────────────
@superadmin_bp.route('/api/backups/<filename>', methods=['DELETE'])
@require_superadmin
def delete_backup(filename):
    backup_dir = Path(__file__).parent / '..' / 'backups'
    if '..' in filename or '/' in filename or '\\' in filename:
        return jsonify({'error': 'Invalid filename'}), 400
    fpath = backup_dir / filename
    if not fpath.exists():
        return jsonify({'error': 'File not found'}), 404
    fpath.unlink()
    return jsonify({'ok': True})


# ── Статус системы ────────────────────────────────────────────────
@superadmin_bp.route('/api/status', methods=['GET'])
@require_superadmin
def system_status():
    env = read_env()

    db_ok = False
    try:
        from models import db
        db.session.execute(db.text('SELECT 1'))
        db_ok = True
    except Exception:
        pass

    vk_configured = bool(env.get('VK_ACCESS_TOKEN')) and env.get('VK_GROUP_ID', '0') != '0'

    backup_dir = Path(__file__).parent / '..' / 'backups'
    backup_count = len(list(backup_dir.glob('*.sql*'))) if backup_dir.exists() else 0

    return jsonify({
        'database': {'ok': db_ok, 'label': 'PostgreSQL'},
        'vk': {'ok': vk_configured, 'label': 'VK Bot'},
        'backup_count': backup_count
    })


# ── Запустить бэкап ───────────────────────────────────────────────
@superadmin_bp.route('/api/backups/run', methods=['POST'])
@require_superadmin
def run_backup():
    import datetime
    import shutil
    from pathlib import Path

    data = request.get_json() or {}
    backup_type = data.get('type', 'full')

    backup_dir = Path(__file__).parent / '..' / 'backups'
    backup_dir.mkdir(exist_ok=True)

    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'backup_{backup_type}_{ts}.sql'
    backup_path = backup_dir / filename

    # --- Поиск pg_dump в системе (кроссплатформенно) ---
    pg_dump_path = shutil.which('pg_dump')
    if not pg_dump_path:
        # fallback для Windows, если pg_dump не в PATH
        common_paths = [
            r'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe',
            r'C:\Program Files\PostgreSQL\16\bin\pg_dump.exe',
            r'C:\Program Files\PostgreSQL\15\bin\pg_dump.exe',
            r'C:\Program Files\PostgreSQL\14\bin\pg_dump.exe',
        ]
        for p in common_paths:
            if os.path.exists(p):
                pg_dump_path = p
                break
    if not pg_dump_path:
        return jsonify({'error': 'pg_dump not found in PATH or common locations'}), 500

    # --- Парсим DATABASE_URL из .env ---
    env_vars = read_env()
    db_url = env_vars.get('DATABASE_URL', '')
    db_host, db_port, db_user, db_password, db_name = 'localhost', '5432', 'postgres', '', 'car_service_db'
    if db_url.startswith('postgresql://'):
        try:
            rest = db_url[len('postgresql://'):]
            auth, hostpart = rest.split('@', 1)
            db_user, db_password = (auth.split(':', 1) if ':' in auth else (auth, ''))
            hostdb = hostpart.split('/', 1)
            db_name = hostdb[1] if len(hostdb) > 1 else db_name
            hp = hostdb[0].split(':', 1)
            db_host = hp[0]
            if len(hp) > 1:
                db_port = hp[1]
        except Exception:
            pass

    env = os.environ.copy()
    if db_password:
        env['PGPASSWORD'] = db_password

    cmd = [
        pg_dump_path,
        '-h', db_host, '-p', db_port,
        '-U', db_user, '-d', db_name,
        '-f', str(backup_path),
        '--no-password',
    ]
    if backup_type == 'quick':
        for tbl in ['clients', 'cars', 'orders', 'mechanics', 'users']:
            cmd += ['-t', tbl]

    try:
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
            shell=False          # безопасно, кроссплатформенно
        )
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Timeout (120s) during pg_dump'}), 500
    except Exception as e:
        return jsonify({'error': f'Failed to run pg_dump: {e}'}), 500

    if result.returncode != 0:
        return jsonify({'error': f'pg_dump error: {result.stderr[:400]}'}), 500

    if not backup_path.exists() or backup_path.stat().st_size == 0:
        return jsonify({'error': 'Backup file is empty or not created'}), 500

    size_bytes = backup_path.stat().st_size
    size_str = f'{size_bytes / 1024:.1f} KB' if size_bytes < 1024 * 1024 else f'{size_bytes / 1024 / 1024:.2f} MB'

    return jsonify({
        'success': True,
        'filename': filename,
        'size': size_str,
        'timestamp': datetime.datetime.now().isoformat(),
        'type': backup_type,
    })


# ── Шаблоны: получить ────────────────────────────────────────────
@superadmin_bp.route('/api/templates/<name>', methods=['GET'])
@require_superadmin
def get_template(name):
    safe = os.path.basename(name)
    tpl_dir = Path(__file__).parent / '..' / 'templates'
    tpl_path = tpl_dir / f'{safe}.html'

    if not tpl_path.exists():
        return jsonify({'error': f'Template {safe}.html not found in {tpl_dir.resolve()}'}), 404

    with open(tpl_path, encoding='utf-8') as f:
        content = f.read()

    stat = tpl_path.stat()
    return jsonify({
        'name': safe,
        'content': content,
        'path': str(tpl_path.resolve()),
        'size': f'{stat.st_size / 1024:.1f} KB',
    })


# ── Шаблоны: сохранить ───────────────────────────────────────────
@superadmin_bp.route('/api/templates/<name>', methods=['POST'])
@require_superadmin
def save_template(name):
    safe = os.path.basename(name)
    tpl_dir = Path(__file__).parent / '..' / 'templates'
    tpl_dir.mkdir(parents=True, exist_ok=True)
    tpl_path = tpl_dir / f'{safe}.html'

    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({'error': 'Content field is required'}), 400

    with open(tpl_path, 'w', encoding='utf-8') as f:
        f.write(data['content'])

    return jsonify({'ok': True, 'saved': str(tpl_path.resolve())})


# ── Соглашение о персональных данных (privacy.html) ──────────────────────────
@superadmin_bp.route('/api/privacy', methods=['GET'])
@require_superadmin
def get_privacy():
    """Вернуть содержимое privacy.html"""
    try:
        # Если файл не существует – создать заглушку
        if not PRIVACY_HTML_PATH.exists():
            default_content = """<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Соглашение о персональных данных</title>
    <style>body { font-family: sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }</style>
</head>
<body>
    <h1>Соглашение о персональных данных</h1>
    <p>Текст политики конфиденциальности ещё не загружен. Пожалуйста, обратитесь к администратору.</p>
</body>
</html>"""
            PRIVACY_HTML_PATH.parent.mkdir(parents=True, exist_ok=True)
            PRIVACY_HTML_PATH.write_text(default_content, encoding='utf-8')

        content = PRIVACY_HTML_PATH.read_text(encoding='utf-8')
        return jsonify({'content': content})
    except Exception as e:
        return jsonify({'error': f'Failed to read privacy.html: {str(e)}'}), 500


@superadmin_bp.route('/api/privacy', methods=['POST'])
@require_superadmin
def save_privacy():
    """Сохранить содержимое privacy.html"""
    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({'error': 'Missing content'}), 400

    try:
        # Создать директорию, если её нет
        PRIVACY_HTML_PATH.parent.mkdir(parents=True, exist_ok=True)
        PRIVACY_HTML_PATH.write_text(data['content'], encoding='utf-8')
        return jsonify({'ok': True, 'message': 'Privacy policy saved'})
    except Exception as e:
        return jsonify({'error': f'Failed to write privacy.html: {str(e)}'}), 500


# ── Пользователи: редактировать ───────────────────────────────────
@superadmin_bp.route('/api/users/<int:user_id>', methods=['PUT'])
@require_superadmin
def update_user(user_id):
    from models import db, User
    from werkzeug.security import generate_password_hash

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json() or {}

    if 'login' in data and data['login'].strip():
        user.login = data['login'].strip()
    if 'full_name' in data:
        user.full_name = data['full_name']
    if 'role_name' in data:
        user.role_name = data['role_name']
    if 'phone' in data:
        user.phone = data['phone']
    if data.get('password'):
        user.password_hash = generate_password_hash(data['password'])

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Database error: {e}'}), 500

    return jsonify({'ok': True, 'user': user.to_dict()})


@superadmin_bp.route('/api/users', methods=['GET'])
@require_superadmin
def get_users():
    from models import User
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])


# ── Получить логи приложения ─────────────────────────────────────
@superadmin_bp.route('/api/logs', methods=['GET'])
@require_superadmin
def get_logs():
    """Возвращает последние 200 строк из файла логов."""
    import traceback

    try:
        backend_dir = Path(__file__).parent          # папка superadmin
        project_root = backend_dir.parent.parent     # корень проекта

        # Возможные пути к лог-файлу
        candidates = [
            backend_dir.parent / 'logs' / 'app.log',   # backend/logs/app.log
            backend_dir.parent / 'app.log',            # backend/app.log
            project_root / 'app.log',                  # корень/app.log
            project_root / 'logs' / 'app.log',         # корень/logs/app.log
        ]

        log_file = None
        for cand in candidates:
            if cand.exists():
                log_file = cand
                break

        if not log_file:
            return jsonify({'error': 'Log file not found', 'checked_paths': [str(p) for p in candidates], 'lines': []}), 404

        content = None
        for encoding in ['utf-8', 'cp1251', 'latin-1']:
            try:
                with open(log_file, 'r', encoding=encoding) as f:
                    content = f.read()
                break
            except UnicodeDecodeError:
                continue
            except Exception as e:
                return jsonify({'error': f'Error opening file: {e}', 'lines': []}), 500

        if content is None:
            return jsonify({'error': 'Cannot decode log file with any encoding', 'lines': []}), 500

        lines = content.splitlines()
        last_lines = lines[-200:] if len(lines) > 200 else lines
        result = []
        start_line = len(lines) - len(last_lines) + 1
        for i, line in enumerate(last_lines, start=start_line):
            result.append({'line_num': i, 'text': line.rstrip('\n')})

        return jsonify({
            'lines': result,
            'total': len(lines),
            'returned': len(result),
            'file': str(log_file)
        })

    except Exception as e:
        print("=== ERROR in /api/logs ===")
        traceback.print_exc()
        return jsonify({'error': f'Internal error: {e}', 'traceback': traceback.format_exc(), 'lines': []}), 500