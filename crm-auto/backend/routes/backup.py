from flask import Blueprint, request, jsonify, current_app, send_file
from models import db
import jwt
import os
import subprocess
import datetime
from pathlib import Path
import shutil

backup_bp = Blueprint('backup', __name__, url_prefix='/api/backup')

def check_auth_and_role(required_role=None):
    """Проверяет авторизацию и роль пользователя"""
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return None, 'Требуется авторизация', 401
    
    try:
        token = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
        decoded_token = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        
        user_id = decoded_token.get('user_id')
        user_role = decoded_token.get('role')
        
        if required_role and user_role != required_role:
            return None, f'Доступ запрещен. Требуется роль: {required_role}', 403
        
        return {'user_id': user_id, 'role': user_role}, None, None
        
    except jwt.ExpiredSignatureError:
        return None, 'Токен истек', 401
    except jwt.InvalidTokenError as e:
        return None, 'Неверный токен', 401
    except Exception as e:
        return None, f'Ошибка проверки токена: {str(e)}', 401

def get_db_config():
    """Получает конфигурацию базы данных из Flask app"""
    app_config = current_app.config
    
    # Получаем URL базы данных из конфигурации
    db_url = app_config.get('SQLALCHEMY_DATABASE_URI', '')
    
    if db_url.startswith('postgresql://'):
        # Формат: postgresql://user:password@host:port/database
        db_url = db_url.replace('postgresql://', '')
        
        # Разбираем URL
        if '@' in db_url:
            auth_part, host_part = db_url.split('@')
            user, password = auth_part.split(':') if ':' in auth_part else (auth_part, '')
            host_port_db = host_part
        else:
            user = password = ''
            host_port_db = db_url
        
        # Разбираем хост:порт/база
        if '/' in host_port_db:
            host_port, database = host_port_db.split('/', 1)
            if ':' in host_port:
                host, port = host_port.split(':', 1)
            else:
                host = host_port
                port = '5432'
        else:
            host = 'localhost'
            port = '5432'
            database = host_port_db
        
        return {
            'host': host,
            'port': port,
            'database': database,
            'user': user,
            'password': password
        }
    else:
        # Возвращаем значения по умолчанию
        return {
            'host': 'localhost',
            'port': '5432',
            'database': 'car_service_db',
            'user': 'postgres',
            'password': ''
        }

def ensure_backup_dir():
    """Создает директорию для бэкапов если её нет"""
    backup_dir = Path(current_app.root_path) / 'backups'
    backup_dir.mkdir(exist_ok=True)
    return backup_dir

def format_file_size(bytes_size):
    """Форматирует размер файла в читаемый вид"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} TB"

def find_pg_dump():
    """Находит pg_dump - явно указываем ваш путь"""
    # Ваш путь к PostgreSQL 17
    your_pg_dump_path = r"Z:\PostgreSQL\17\bin\pg_dump.exe"
    
    if os.path.exists(your_pg_dump_path):
        print(f"✅ Найден pg_dump по вашему пути: {your_pg_dump_path}")
        return your_pg_dump_path
    
    # Проверяем другие возможные пути (на всякий случай)
    possible_paths = [
        r"Z:\PostgreSQL\17\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            print(f"Найден pg_dump: {path}")
            return path
    
    # Проверяем PATH как последний вариант
    pg_dump_path = shutil.which('pg_dump')
    if pg_dump_path:
        print(f"Найден pg_dump в PATH: {pg_dump_path}")
        return pg_dump_path
    
    print("❌ pg_dump не найден ни по одному из путей")
    return None

def test_pg_dump_connection(pg_dump_path, db_config):
    """Тестирует подключение pg_dump к базе данных"""
    try:
        # Тест 1: Проверяем версию pg_dump
        print(f"\n=== Тест 1: Проверка версии pg_dump ===")
        version_cmd = [pg_dump_path, '--version']
        result = subprocess.run(version_cmd, capture_output=True, text=True, shell=True)
        
        if result.returncode == 0:
            print(f"✅ pg_dump версия: {result.stdout.strip()}")
        else:
            print(f"❌ Ошибка проверки версии: {result.stderr}")
            return False
        
        # Тест 2: Проверяем подключение к базе (пробуем получить список таблиц)
        print(f"\n=== Тест 2: Проверка подключения к БД ===")
        
        env = os.environ.copy()
        if db_config['password']:
            env['PGPASSWORD'] = db_config['password']
        
        # Команда для получения списка таблиц (используем -s для только структуры и ограничиваем время)
        test_cmd = [
            pg_dump_path,
            '-h', db_config['host'],
            '-p', db_config['port'],
            '-U', db_config['user'],
            '-d', db_config['database'],
            '--schema-only',
            '-t', 'clients'  # Пробуем одну таблицу
        ]
        
        print(f"Тестовая команда: {' '.join(test_cmd[:6])} ...")
        
        result = subprocess.run(
            test_cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=10,
            shell=True
        )
        
        if result.returncode == 0:
            print("✅ Успешное подключение к базе данных")
            return True
        else:
            print(f"❌ Ошибка подключения к БД: {result.stderr[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ Исключение при тесте: {str(e)}")
        return False

@backup_bp.route('/', methods=['POST'])
def create_backup():
    """Создание резервной копии базы данных"""
    try:
        # Проверяем авторизацию - только менеджеры могут делать бэкапы
        auth_result, error_message, status_code = check_auth_and_role('manager')
        if error_message:
            return jsonify({'error': error_message}), status_code
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Отсутствуют данные'}), 400
        
        backup_type = data.get('type', 'full')
        tables = data.get('tables', {})
        
        # Создаем директорию для бэкапов
        backup_dir = ensure_backup_dir()
        
        # Генерируем имя файла
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'backup_{timestamp}.sql'
        backup_path = backup_dir / filename
        
        # Получаем конфигурацию БД
        db_config = get_db_config()
        print(f"\n=== НАЧАЛО СОЗДАНИЯ БЭКАПА ===")
        print(f"Тип бэкапа: {backup_type}")
        print(f"Выбранные таблицы: {tables}")
        print(f"Путь к файлу: {backup_path}")
        print(f"Конфигурация БД: {db_config}")
        
        # Находим pg_dump
        pg_dump_path = find_pg_dump()
        if not pg_dump_path:
            return jsonify({
                'error': 'pg_dump не найден',
                'hint': 'Убедитесь что PostgreSQL установлен по пути Z:\\PostgreSQL\\17\\'
            }), 500
        
        # Строим команду pg_dump
        pg_dump_cmd = [
            pg_dump_path,
            '-h', db_config['host'],
            '-p', db_config['port'],
            '-U', db_config['user'],
            '-d', db_config['database'],
            '-f', str(backup_path),
            '--verbose'  # Добавляем подробный вывод
        ]
        
        # Добавляем опции в зависимости от типа бэкапа
        if backup_type == 'quick':
            pg_dump_cmd.extend(['--schema-only'])  # Только структура
            print(f"Режим: Только структура БД (без данных)")
            
        elif backup_type == 'custom' and tables:
            # Для выборочного бэкапа указываем конкретные таблицы
            selected_tables = []
            table_mapping = {
                'clients': 'clients',
                'cars': 'cars',
                'orders': 'work_orders',
                'mechanics': 'users',  # Внимание: механики в таблице users!
                'archive': 'work_orders',
                'users': 'users'
            }
            
            # Проверяем какие таблицы выбраны
            for table_name, include in tables.items():
                if include and table_name in table_mapping:
                    selected_tables.append(table_mapping[table_name])
            
            if selected_tables:
                print(f"Выбранные таблицы для бэкапа: {selected_tables}")
                
                # ВАЖНО: pg_dump принимает таблицы через отдельные флаги -t
                for table in selected_tables:
                    pg_dump_cmd.extend(['-t', table])
                
                # ИЛИ можно через запятую:
                # tables_str = ','.join(selected_tables)
                # pg_dump_cmd.extend(['-t', tables_str])
                
                print(f"Таблицы добавлены в команду")
            else:
                print("⚠️ Не выбрано ни одной таблицы для кастомного бэкапа")
                return jsonify({
                    'error': 'Для кастомного бэкапа нужно выбрать хотя бы одну таблицу'
                }), 400
        else:
            print(f"Режим: Полный бэкап (все таблицы)")
        
        # Устанавливаем переменную окружения с паролем
        env = os.environ.copy()
        if db_config['password']:
            env['PGPASSWORD'] = db_config['password']
            print(f"Пароль установлен в переменную окружения")
        else:
            print("⚠️ Пароль не указан в конфигурации")
        
        # Логируем команду (без пароля)
        safe_cmd = pg_dump_cmd.copy()
        print(f"\n=== КОМАНДА PГ_DUMP ===")
        print(f"Полная команда: {' '.join(safe_cmd)}")
        print(f"Текущая директория: {os.getcwd()}")
        print(f"Директория для бэкапов: {backup_dir}")
        
        # Выполняем команду
        try:
            print(f"\n=== ВЫПОЛНЕНИЕ PГ_DUMP ===")
            result = subprocess.run(
                pg_dump_cmd,
                env=env,
                capture_output=True,
                text=True,
                encoding='utf-8',
                timeout=300,  # Таймаут 5 минут
                shell=True  # Важно для Windows!
            )
            
            print(f"Код возврата: {result.returncode}")
            
            if result.stdout:
                print(f"Вывод stdout ({len(result.stdout)} символов):")
                # Показываем только важные части вывода
                lines = result.stdout.split('\n')
                for line in lines:
                    if 'dumping' in line.lower() or 'table' in line.lower() or 'error' in line.lower():
                        print(f"  {line}")
            
            if result.stderr:
                print(f"Ошибки stderr ({len(result.stderr)} символов):")
                # Показываем полный stderr для отладки
                print(f"  {result.stderr[:1000]}")  # Первые 1000 символов
            
            if result.returncode != 0:
                error_msg = f"Ошибка выполнения pg_dump (код {result.returncode})"
                
                # Анализируем ошибку
                error_lower = result.stderr.lower() if result.stderr else ""
                
                if "authentication failed" in error_lower:
                    error_msg = "Ошибка аутентификации PostgreSQL. Проверьте логин и пароль."
                elif "does not exist" in error_lower:
                    error_msg = "База данных или таблица не существует."
                elif "could not connect" in error_lower:
                    error_msg = "Не удалось подключиться к серверу PostgreSQL."
                elif "no matching tables" in error_lower:
                    error_msg = "Указанные таблицы не найдены в базе данных."
                elif "invalid option" in error_lower:
                    error_msg = "Некорректные параметры команды pg_dump."
                
                print(f"❌ {error_msg}")
                return jsonify({
                    'error': error_msg,
                    'details': result.stderr[:500],
                    'command': ' '.join(pg_dump_cmd[:8]) + ' ...',
                    'debug_info': {
                        'selected_tables': selected_tables if 'selected_tables' in locals() else [],
                        'table_mapping': table_mapping
                    }
                }), 500
                
        except subprocess.TimeoutExpired:
            print("❌ Таймаут при создании бэкапа")
            return jsonify({'error': 'Таймаут при создании бэкапа'}), 500
        except Exception as e:
            print(f"❌ Исключение при выполнении pg_dump: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'Ошибка выполнения pg_dump: {str(e)}'}), 500
        
        # Проверяем создан ли файл
        print(f"\n=== ПРОВЕРКА СОЗДАННОГО ФАЙЛА ===")
        print(f"Путь к файлу: {backup_path}")
        print(f"Файл существует: {backup_path.exists()}")
        
        if backup_path.exists():
            file_size = backup_path.stat().st_size
            formatted_size = format_file_size(file_size)
            
            # Читаем первые несколько строк для проверки
            try:
                with open(backup_path, 'r', encoding='utf-8', errors='ignore') as f:
                    first_lines = ''.join([f.readline() for _ in range(10)])
                print(f"Первые 10 строк файла:\n{first_lines}")
            except Exception as e:
                print(f"Не удалось прочитать файл: {e}")
            
            print(f"✅ Бэкап успешно создан!")
            print(f"Размер: {formatted_size}")
            print(f"Имя файла: {filename}")
            
            return jsonify({
                'success': True,
                'filename': filename,
                'size': formatted_size,
                'size_bytes': file_size,
                'timestamp': datetime.datetime.now().isoformat(),
                'type': backup_type,
                'message': f'Резервная копия успешно создана: {filename} ({formatted_size})',
                'file_path': str(backup_path)
            })
        else:
            print("❌ Файл бэкапа не был создан")
            return jsonify({
                'error': 'Файл бэкапа не был создан',
                'debug_info': {
                    'backup_path': str(backup_path),
                    'backup_dir': str(backup_dir),
                    'backup_dir_exists': backup_dir.exists(),
                    'pg_dump_path': pg_dump_path,
                    'command': ' '.join(pg_dump_cmd[:8]) + ' ...'
                }
            }), 500
            
    except Exception as e:
        print(f"\n=== ОБЩАЯ ОШИБКА ===")
        print(f"Ошибка: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Ошибка при создании бэкапа: {str(e)}'}), 500
    
@backup_bp.route('/test', methods=['GET'])
def test_backup():
    """Тестовый эндпоинт для проверки pg_dump и подключения"""
    try:
        # Проверяем авторизацию
        auth_result, error_message, status_code = check_auth_and_role('manager')
        if error_message:
            return jsonify({'error': error_message}), status_code
        
        pg_dump_path = find_pg_dump()
        db_config = get_db_config()
        
        result_info = {
            'pg_dump': {
                'found': bool(pg_dump_path),
                'path': pg_dump_path,
                'exists': os.path.exists(pg_dump_path) if pg_dump_path else False
            },
            'database_config': {
                'host': db_config['host'],
                'port': db_config['port'],
                'database': db_config['database'],
                'user': db_config['user'],
                'has_password': bool(db_config['password'])
            },
            'directories': {
                'current': os.getcwd(),
                'backup': str(ensure_backup_dir()),
                'backup_exists': ensure_backup_dir().exists()
            },
            'tests': {}
        }
        
        # Тест 1: Версия pg_dump
        if pg_dump_path:
            try:
                version_result = subprocess.run(
                    [pg_dump_path, '--version'],
                    capture_output=True,
                    text=True,
                    shell=True
                )
                result_info['tests']['version'] = {
                    'success': version_result.returncode == 0,
                    'output': version_result.stdout.strip() if version_result.stdout else version_result.stderr,
                    'returncode': version_result.returncode
                }
            except Exception as e:
                result_info['tests']['version'] = {
                    'success': False,
                    'error': str(e)
                }
        
        return jsonify(result_info)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/download/<path:filename>', methods=['GET'])
def download_backup(filename):
    """Скачивание файла бэкапа"""
    try:
        # Проверяем авторизацию - только менеджеры могут скачивать бэкапы
        auth_result, error_message, status_code = check_auth_and_role('manager')
        if error_message:
            return jsonify({'error': error_message}), status_code
        
        # Проверяем безопасность имени файла
        if '..' in filename or filename.startswith('/'):
            return jsonify({'error': 'Некорректное имя файла'}), 400
        
        backup_dir = ensure_backup_dir()
        backup_path = backup_dir / filename
        
        if not backup_path.exists():
            return jsonify({'error': 'Файл бэкапа не найден'}), 404
        
        return send_file(
            backup_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/sql'
        )
        
    except Exception as e:
        print(f"Ошибка при скачивании бэкапа: {str(e)}")
        return jsonify({'error': f'Ошибка при скачивании бэкапа: {str(e)}'}), 500

@backup_bp.route('/list', methods=['GET'])
def list_backups():
    """Получение списка доступных бэкапов"""
    try:
        # Проверяем авторизацию - только менеджеры могут видеть список бэкапов
        auth_result, error_message, status_code = check_auth_and_role('manager')
        if error_message:
            return jsonify({'error': error_message}), status_code
        
        backup_dir = ensure_backup_dir()
        backups = []
        
        for file_path in backup_dir.glob('backup_*.sql'):
            stat = file_path.stat()
            backups.append({
                'filename': file_path.name,
                'size': format_file_size(stat.st_size),
                'created': datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'modified': datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
        
        # Сортируем по дате создания (новые первыми)
        backups.sort(key=lambda x: x['created'], reverse=True)
        
        return jsonify({
            'backups': backups,
            'count': len(backups)
        })
        
    except Exception as e:
        print(f"Ошибка при получении списка бэкапов: {str(e)}")
        return jsonify({'error': f'Ошибка при получении списка бэкапов: {str(e)}'}), 500

@backup_bp.route('/<path:filename>', methods=['DELETE'])
def delete_backup(filename):
    """Удаление файла бэкапа"""
    try:
        # Проверяем авторизацию - только менеджеры могут удалять бэкапы
        auth_result, error_message, status_code = check_auth_and_role('manager')
        if error_message:
            return jsonify({'error': error_message}), status_code
        
        # Проверяем безопасность имени файла
        if '..' in filename or filename.startswith('/'):
            return jsonify({'error': 'Некорректное имя файла'}), 400
        
        backup_dir = ensure_backup_dir()
        backup_path = backup_dir / filename
        
        if not backup_path.exists():
            return jsonify({'error': 'Файл бэкапа не найден'}), 404
        
        # Удаляем файл
        backup_path.unlink()
        
        return jsonify({
            'success': True,
            'message': f'Файл бэкапа {filename} успешно удален'
        })
        
    except Exception as e:
        print(f"Ошибка при удалении бэкапа: {str(e)}")
        return jsonify({'error': f'Ошибка при удалении бэкапа: {str(e)}'}), 500