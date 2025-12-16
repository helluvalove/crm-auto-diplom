from flask import Blueprint, request, jsonify
from models import db, User, WorkOrder

mechanics_bp = Blueprint('mechanics', __name__, url_prefix='/api/mechanics')

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
        mechanics = User.query.filter_by(role='mechanic').all()
        mechanics_list = [mechanic.to_dict() for mechanic in mechanics]
        return jsonify(mechanics_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_mechanic(mechanic_id):
    """Получить конкретного механика"""
    try:
        mechanic = User.query.filter_by(user_id=mechanic_id, role='mechanic').first_or_404()
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
        
        mechanic = User(
            full_name=data['full_name'],
            phone=data['phone'],
            login=data['login'],
            role='mechanic',
            specialization=data.get('specialization'),
            employee_number=data.get('employee_number')
        )
        
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
    """Обновить механика"""
    try:
        mechanic = User.query.filter_by(user_id=mechanic_id, role='mechanic').first_or_404()
        data = request.get_json()
        
        if 'full_name' in data:
            mechanic.full_name = data['full_name']
        
        if 'phone' in data:
            mechanic.phone = data['phone']
        
        if 'specialization' in data:
            mechanic.specialization = data['specialization']
        
        if 'employee_number' in data:
            mechanic.employee_number = data['employee_number']
        
        if 'login' in data and data['login'] != mechanic.login:
            existing_user = User.query.filter_by(login=data['login']).first()
            if existing_user and existing_user.user_id != mechanic_id:
                return jsonify({'error': 'Логин уже занят'}), 400
            mechanic.login = data['login']
        
        if 'password' in data:
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
        mechanic = User.query.filter_by(user_id=mechanic_id, role='mechanic').first_or_404()
        
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