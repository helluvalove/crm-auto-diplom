from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from models import db, User
from config import Config
import os
import logging
from logging.handlers import TimedRotatingFileHandler

# Не используем basicConfig, чтобы не было конфликта с RotatingFileHandler
# logging.basicConfig(filename='app.log', level=logging.DEBUG)


def create_app():
    app = Flask(__name__, static_folder='../frontend')
    app.config.from_object(Config)

    CORS(app)
    db.init_app(app)

    # Импортируем маршруты
    from routes.auth import auth_bp
    from routes.clients import clients_bp
    from routes.cars import cars_bp
    from routes.orders import orders_bp
    from routes.mechanics import mechanics_bp
    from routes.backup import backup_bp
    from superadmin.routes import superadmin_bp
    from routes.vk import vk_bp

    app.register_blueprint(vk_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(clients_bp)
    app.register_blueprint(cars_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(mechanics_bp)
    app.register_blueprint(backup_bp)
    app.register_blueprint(superadmin_bp, url_prefix='/superadmin')

    # ========== НАСТРОЙКА ЛОГИРОВАНИЯ В ФАЙЛ ==========
    # Создаём папку logs в той же директории, где находится app.py (папка backend)
    if not os.path.exists('logs'):
        os.mkdir('logs')
    # TimedRotatingFileHandler вместо RotatingFileHandler — не блокирует файл на Windows.
    # RotatingFileHandler делает os.rename() пока файл открыт другим потоком → PermissionError
    # → каждый logger.info() из фонового потока зависает на обработке ошибки (~несколько сек).
    file_handler = TimedRotatingFileHandler(
        'logs/app.log', when='midnight', backupCount=10, encoding='utf-8', delay=True
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('Сервер запущен')

    # Подключаем root logger к тому же хендлеру — теперь все модули
    # (vk_photo_sender, vk_notify и др.) пишут INFO в консоль и файл.
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter('%(levelname)s [%(name)s] %(message)s'))

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    # =================================================

    @app.route('/privacy')
    def privacy_policy():
        return send_from_directory(os.path.join(app.static_folder, 'public'), 'privacy.html')

    @app.route('/')
    def index():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/<path:path>')
    def static_files(path):
        return send_from_directory(app.static_folder, path)

    @app.route('/api')
    def api_info():
        return jsonify({
            'name': 'CRM Автомастерская API',
            'version': '1.0.0',
            'endpoints': {
                '/api/auth/login': 'POST - Аутентификация',
                '/api/clients': 'GET, POST - Клиенты',
                '/api/clients/<id>': 'GET, PUT, DELETE - Конкретный клиент',
                '/api/cars': 'GET, POST - Автомобили',
                '/api/cars/<id>': 'GET, PUT, DELETE - Конкретный автомобиль',
                '/api/cars/client/<id>': 'GET - Автомобили клиента',
                '/api/orders': 'GET, POST - Заказы',
                '/api/orders/<id>': 'GET, PUT, DELETE - Конкретный заказ',
                '/api/orders/archive': 'GET - Архив заказов',
                '/api/orders/<id>/complete': 'POST - Завершить заказ',
                '/api/users': 'GET - Все пользователи',
                '/api/backup': 'POST - Создание резервной копии',
                '/api/backup/list': 'GET - Список бэкапов',
                '/api/backup/download/<filename>': 'GET - Скачивание бэкапа',
                '/api/backup/<filename>': 'DELETE - Удаление бэкапа'
            }
        })

    @app.route('/api/users')
    def get_users():
        users = User.query.all()
        return jsonify([user.to_dict() for user in users])

    return app