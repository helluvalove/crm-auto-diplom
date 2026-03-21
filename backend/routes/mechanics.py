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
    """Обновить механика с проверкой на уникальность телефона"""
    try:
        mechanic = User.query.filter_by(user_id=mechanic_id, role='mechanic').first_or_404()
        data = request.get_json()
        
        print(f"Updating mechanic {mechanic_id}")  # Debug
        print(f"Data received: {data}")  # Debug
        print(f"Current phone: {mechanic.phone}")  # Debug
        
        # Проверка уникальности телефона (если телефон изменился)
        if 'phone' in data and data['phone'] != mechanic.phone:
            print(f"Checking phone uniqueness: {data['phone']}")  # Debug
            # Ищем пользователя с таким телефоном (не только механиков)
            existing_phone = User.query.filter_by(phone=data['phone']).first()
            print(f"Existing phone found: {existing_phone}")  # Debug
            
            if existing_phone and existing_phone.user_id != mechanic_id:
                return jsonify({
                    'error': 'Механик с таким номером телефона уже существует',
                    'duplicate_phone': True
                }), 400
        
        # Проверка уникальности логина (если логин изменился)
        if 'login' in data and data['login'] != mechanic.login:
            print(f"Checking login uniqueness: {data['login']}")  # Debug
            existing_login = User.query.filter_by(login=data['login']).first()
            print(f"Existing login found: {existing_login}")  # Debug
            
            if existing_login and existing_login.user_id != mechanic_id:
                return jsonify({
                    'error': 'Логин уже занят',
                    'duplicate_login': True
                }), 400
        
        # Проверка уникальности табельного номера (если указан)
        if 'employee_number' in data and data['employee_number'] != mechanic.employee_number:
            if data['employee_number']:  # Проверяем только если указан
                print(f"Checking employee number uniqueness: {data['employee_number']}")  # Debug
                existing_employee_number = User.query.filter_by(
                    employee_number=data['employee_number'],
                    role='mechanic'
                ).first()
                print(f"Existing employee number found: {existing_employee_number}")  # Debug
                
                if existing_employee_number and existing_employee_number.user_id != mechanic_id:
                    return jsonify({
                        'error': 'Механик с таким табельным номером уже существует',
                        'duplicate_employee_number': True
                    }), 400
        
        # Обновление полей
        update_fields = ['full_name', 'phone', 'specialization', 'employee_number']
        for field in update_fields:
            if field in data:
                print(f"Setting {field} to {data[field]}")  # Debug
                setattr(mechanic, field, data[field])
        
        # Отдельная обработка логина
        if 'login' in data:
            print(f"Setting login to {data['login']}")  # Debug
            mechanic.login = data['login']
        
        # Отдельная обработка пароля (если нужно изменить)
        if 'password' in data and data['password']:
            print("Updating password")  # Debug
            mechanic.set_password(data['password'])
        
        db.session.commit()
        print(f"Mechanic {mechanic_id} updated successfully")  # Debug
        
        return jsonify({
            'message': 'Механик обновлен',
            'mechanic': mechanic.to_dict()
        })
    except Exception as e:
        print(f"Error updating mechanic: {str(e)}")  # Debug
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