from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from models import db, User
from config import Config
import os

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
    from routes.backup import backup_bp  # <-- Добавьте эту строку

    from routes.vk import vk_bp
    
    app.register_blueprint(vk_bp)

    app.register_blueprint(auth_bp)
    app.register_blueprint(clients_bp)
    app.register_blueprint(cars_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(mechanics_bp)
    app.register_blueprint(backup_bp)  # <-- Добавьте эту строку
    
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
                '/api/backup': 'POST - Создание резервной копии',  # <-- Добавьте
                '/api/backup/list': 'GET - Список бэкапов',  # <-- Добавьте
                '/api/backup/download/<filename>': 'GET - Скачивание бэкапа',  # <-- Добавьте
                '/api/backup/<filename>': 'DELETE - Удаление бэкапа'  # <-- Добавьте
            }
        })
    
    @app.route('/api/users')
    def get_users():
        users = User.query.all()
        return jsonify([user.to_dict() for user in users])
    
    return app