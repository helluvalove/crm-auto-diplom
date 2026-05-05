from flask import Blueprint, request, jsonify
from models import db, User, Role, WorkOrder
from crypto import hash_phone     
from datetime import datetime, timedelta

mechanics_bp = Blueprint('mechanics', __name__, url_prefix='/api/mechanics')

REST_MINUTES = 30   # технологический перерыв после работы

# Вспомогательная функция для получения роли "mechanic"
def get_mechanic_role():
    role = Role.query.filter_by(role_name='mechanic').first()
    if not role:
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
        
        mechanic.role_name = 'mechanic'   # сеттер назначит роль
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
        
        # Проверка уникальности логина
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
    
@mechanics_bp.route('/availability', methods=['GET'])
def get_mechanics_availability():
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({'error': 'Параметр date обязателен (YYYY-MM-DD)'}), 400
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Неверный формат даты. Используйте YYYY-MM-DD'}), 400

    mechanics = User.query.join(Role).filter(Role.role_name == 'mechanic').all()
    busy_statuses = ['Забронирован', 'Создан', 'На диагностике', 'В работе']
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = datetime.combine(target_date, datetime.max.time())

    all_orders = WorkOrder.query.filter(
        WorkOrder.status.in_(busy_statuses),
        WorkOrder.mechanic_id.isnot(None)
    ).all()

    busy_intervals = []

    for order in all_orders:
        est = order.estimated_hours
        is_indefinite = (est is None or est <= 0)

        if is_indefinite:
            if order.appointment_datetime is None:
                # Бессрочный без даты – сразу действует, показываем всегда
                start = start_of_day.replace(hour=8, minute=0)
                end = start_of_day.replace(hour=20, minute=0)
                no_date = True
            else:
                order_date = order.appointment_datetime.date()
                if target_date < order_date:
                    continue    # Заказ ещё не начался
                # Показываем занятость на весь рабочий день начиная с даты заказа
                start = max(start_of_day.replace(hour=8, minute=0), order.appointment_datetime)
                end = start_of_day.replace(hour=20, minute=0)
                if start >= end:
                    continue
                no_date = False
        else:
            if order.appointment_datetime is None or order.appointment_datetime.date() != target_date:
                continue
            start = order.appointment_datetime
            end = start + timedelta(hours=est) + timedelta(minutes=REST_MINUTES)
            no_date = False

        if start < end_of_day and end > start_of_day:
            busy_intervals.append({
                'mechanic_id': order.mechanic_id,
                'start': start.isoformat(),
                'end': end.isoformat(),
                'order_id': order.order_id,
                'status': order.status,
                'time_range': f"{start.strftime('%H:%M')} – {end.strftime('%H:%M')}",
                'indefinite': is_indefinite,
                'no_date': no_date
            })

    result = []
    for m in mechanics:
        slots = [i for i in busy_intervals if i['mechanic_id'] == m.user_id]
        result.append({
            'user_id': m.user_id,
            'full_name': m.full_name,
            'phone': m.phone,
            'is_available': len(slots) == 0,
            'busy_slots': slots
        })

    return jsonify(result)