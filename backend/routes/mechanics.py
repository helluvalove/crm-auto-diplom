from flask import Blueprint, request, jsonify
from models import db, User, Role, WorkOrder
from crypto import hash_phone            # <-- добавлен импорт

mechanics_bp = Blueprint('mechanics', __name__, url_prefix='/api/mechanics')

# Вспомогательная функция для получения роли "mechanic"
def get_mechanic_role():
    role = Role.query.filter_by(role_name='mechanic').first()
    if not role:
        # На случай, если роль не создана (должна быть при миграции)
        role = Role(role_name='mechanic')
        db.session.add(role)
        db.session.commit()
    return role

@mechanics_bp.route('/', methods=['GET', 'POST'])
def handle_mechanics():
    if request.method == 'GET':
        return get_mechanics()
    elif request.method == 'POST':
        return create_mechanic()

@mechanics_bp.route('/<int:mechanic_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_mechanic(mechanic_id):
    if request.method == 'GET':
        return get_mechanic(mechanic_id)
    elif request.method == 'PUT':
        return update_mechanic(mechanic_id)
    elif request.method == 'DELETE':
        return delete_mechanic(mechanic_id)

def get_mechanics():
    """Получить всех механиков"""
    try:
        # Фильтрация через JOIN с таблицей roles
        mechanics = User.query.join(Role).filter(Role.role_name == 'mechanic').all()
        mechanics_list = [mechanic.to_dict() for mechanic in mechanics]
        return jsonify(mechanics_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_mechanic(mechanic_id):
    """Получить конкретного механика"""
    try:
        mechanic = User.query.join(Role).filter(
            User.user_id == mechanic_id,
            Role.role_name == 'mechanic'
        ).first_or_404()
        return jsonify(mechanic.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def create_mechanic():
    """Создать нового механика"""
    try:
        data = request.get_json()
        
        required_fields = ['full_name', 'phone', 'login', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Отсутствует обязательное поле: {field}'}), 400
        
        existing_user = User.query.filter_by(login=data['login']).first()
        if existing_user:
            return jsonify({'error': 'Пользователь с таким логином уже существует'}), 400
        
        # Проверка уникальности телефона по хэшу
        if User.query.filter_by(phone_hash=hash_phone(data['phone'])).first():
            return jsonify({'error': 'Пользователь с таким телефоном уже существует'}), 400
        
        mechanic = User(
            full_name=data['full_name'],
            phone=data['phone'],
            login=data['login'],
            specialization=data.get('specialization')
        )
        
        # Устанавливаем роль через свойство role_name
        mechanic.role_name = 'mechanic'   # сеттер сам найдёт роль по имени
        
        mechanic.set_password(data['password'])
        
        db.session.add(mechanic)
        db.session.commit()
        
        return jsonify({
            'message': 'Механик создан',
            'mechanic': mechanic.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def update_mechanic(mechanic_id):
    """Обновить механика с проверкой на уникальность телефона и логина"""
    try:
        mechanic = User.query.join(Role).filter(
            User.user_id == mechanic_id,
            Role.role_name == 'mechanic'
        ).first_or_404()
        
        data = request.get_json()
        
        # Проверка уникальности телефона через хэш
        if 'phone' in data and data['phone'] != mechanic.phone:
            existing = User.query.filter_by(phone_hash=hash_phone(data['phone'])).first()
            if existing and existing.user_id != mechanic_id:
                return jsonify({
                    'error': 'Пользователь с таким номером телефона уже существует',
                    'duplicate_phone': True
                }), 400
        
        # Проверка уникальности логина (логин не шифруется, оставляем как есть)
        if 'login' in data and data['login'] != mechanic.login:
            existing = User.query.filter_by(login=data['login']).first()
            if existing and existing.user_id != mechanic_id:
                return jsonify({
                    'error': 'Логин уже занят',
                    'duplicate_login': True
                }), 400
        
        update_fields = ['full_name', 'phone', 'specialization']
        for field in update_fields:
            if field in data:
                setattr(mechanic, field, data[field])
        
        if 'login' in data:
            mechanic.login = data['login']
        
        if 'password' in data and data['password']:
            mechanic.set_password(data['password'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Механик обновлен',
            'mechanic': mechanic.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def delete_mechanic(mechanic_id):
    """Удалить механика"""
    try:
        mechanic = User.query.join(Role).filter(
            User.user_id == mechanic_id,
            Role.role_name == 'mechanic'
        ).first_or_404()
        
        # Проверка на активные заказы
        active_orders = WorkOrder.query.filter_by(mechanic_id=mechanic_id).filter(
            WorkOrder.status.notin_(['Выполнен', 'Отменен'])
        ).first()
        
        if active_orders:
            return jsonify({
                'error': 'Нельзя удалить механика с активными заказами',
                'active_orders': True
            }), 400
        
        db.session.delete(mechanic)
        db.session.commit()
        
        return jsonify({'message': 'Механик удален'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500