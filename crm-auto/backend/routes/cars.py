from flask import Blueprint, request, jsonify
from models import db, Car, Client, WorkOrder
import re

cars_bp = Blueprint('cars', __name__, url_prefix='/api/cars')

def validate_car_data(data, is_update=False, car_id=None):
    """Валидация данных автомобиля"""
    errors = {}
    
    # Проверка обязательных полей при создании
    if not is_update:
        if 'client_id' not in data or not data['client_id']:
            errors['client_id'] = 'ID клиента является обязательным полем'
        if 'model' not in data or not data['model']:
            errors['model'] = 'Модель автомобиля является обязательным полем'
    
    # Валидация модели
    if 'model' in data and data['model']:
        model = data['model'].strip()
        if len(model) < 1:
            errors['model'] = 'Модель автомобиля не может быть пустой'
        elif len(model) > 100:
            errors['model'] = 'Модель автомобиля не должна превышать 100 символов'
    
    # Валидация VIN номера
    if 'vin' in data and data['vin']:
        vin = data['vin'].strip().upper()
        if len(vin) > 0:
            # VIN должен быть 17 символов (стандарт ISO 3779)
            if len(vin) != 17:
                errors['vin'] = 'VIN номер должен содержать 17 символов'
            # Проверка на недопустимые символы (I, O, Q обычно не используются)
            elif re.search(r'[IOQ]', vin):
                errors['vin'] = 'VIN номер содержит недопустимые символы (I, O, Q)'
            else:
                # Проверяем уникальность VIN
                query = Car.query.filter_by(vin=vin)
                if car_id:
                    query = query.filter(Car.id != car_id)
                
                existing_car = query.first()
                if existing_car:
                    errors['vin'] = f'Автомобиль с VIN {vin} уже существует (ID: {existing_car.id})'
    
    # Валидация года выпуска
    if 'year' in data and data['year']:
        try:
            year = int(data['year'])
            current_year = 2024
            if year < 1900 or year > current_year + 1:
                errors['year'] = f'Год выпуска должен быть между 1900 и {current_year + 1}'
        except ValueError:
            errors['year'] = 'Год выпуска должен быть числом'
    
    # Валидация пробега
    if 'mileage' in data and data['mileage']:
        try:
            mileage = float(data['mileage'])
            if mileage < 0 or mileage > 1000000:
                errors['mileage'] = 'Пробег должен быть между 0 и 1,000,000 км'
        except ValueError:
            errors['mileage'] = 'Пробег должен быть числом'
    
    # Валидация госномера
    if 'gos_number' in data and data['gos_number']:
        gos_number = data['gos_number'].strip().upper()
        if len(gos_number) > 0:
            # Российский формат госномера: А123БВ77
            if not re.match(r'^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$', gos_number):
                errors['gos_number'] = 'Неверный формат госномера. Пример: А123БВ77'
            else:
                # Проверяем уникальность госномера
                query = Car.query.filter_by(gos_number=gos_number)
                if car_id:
                    query = query.filter(Car.id != car_id)
                
                existing_car = query.first()
                if existing_car:
                    errors['gos_number'] = f'Автомобиль с госномером {gos_number} уже существует (ID: {existing_car.id})'
    
    return errors

@cars_bp.route('/', methods=['GET', 'POST'])
def handle_cars():
    if request.method == 'GET':
        return get_cars()
    elif request.method == 'POST':
        return create_car()

@cars_bp.route('/<int:car_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_car(car_id):
    if request.method == 'GET':
        return get_car(car_id)
    elif request.method == 'PUT':
        return update_car(car_id)
    elif request.method == 'DELETE':
        return delete_car(car_id)

@cars_bp.route('/client/<int:client_id>', methods=['GET'])
def get_client_cars(client_id):
    """Получить все автомобили клиента"""
    try:
        # Проверяем существование клиента
        client = Client.query.get_or_404(client_id)
        
        cars = Car.query.filter_by(client_id=client_id).all()
        cars_list = [car.to_dict() for car in cars]
        
        return jsonify(cars_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_cars():
    """Получить все автомобили"""
    try:
        cars = Car.query.all()
        cars_list = [car.to_dict() for car in cars]
        return jsonify(cars_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_car(car_id):
    """Получить автомобиль по ID"""
    try:
        car = Car.query.get_or_404(car_id)
        
        # Получаем информацию о клиенте
        client_data = None
        if car.client:
            client_data = {
                'id': car.client.id,
                'name': car.client.name,
                'phone': car.client.phone
            }
        
        car_data = car.to_dict()
        car_data['client'] = client_data
        
        return jsonify(car_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def create_car():
    """Создать новый автомобиль"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Отсутствуют данные'}), 400
        
        # Валидация данных
        errors = validate_car_data(data)
        if errors:
            return jsonify({
                'error': 'Ошибки валидации', 
                'details': errors,
                'message': 'Пожалуйста, исправьте ошибки в форме'
            }), 400
        
        # Проверяем существование клиента
        client_id = data.get('client_id')
        client = Client.query.get(client_id)
        if not client:
            return jsonify({'error': f'Клиент с ID {client_id} не найден'}), 404
        
        # Создаем автомобиль
        car = Car(
            client_id=client_id,
            model=data['model'].strip(),
            vin=data.get('vin', '').strip().upper() or None,
            gos_number=data.get('gos_number', '').strip().upper() or None,
            year=data.get('year'),
            mileage=data.get('mileage')
        )
        
        db.session.add(car)
        db.session.commit()
        
        return jsonify({
            'message': 'Автомобиль успешно создан', 
            'car': car.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def update_car(car_id):
    """Обновить информацию об автомобиле"""
    try:
        car = Car.query.get_or_404(car_id)
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Отсутствуют данные для обновления'}), 400
        
        # Валидация данных с учетом обновления
        errors = validate_car_data(data, is_update=True, car_id=car_id)
        if errors:
            return jsonify({
                'error': 'Ошибки валидации', 
                'details': errors,
                'message': 'Пожалуйста, исправьте ошибки в форме'
            }), 400
        
        # Обновление полей
        if 'client_id' in data:
            # Проверяем существование нового клиента
            new_client_id = data['client_id']
            client = Client.query.get(new_client_id)
            if not client:
                return jsonify({'error': f'Клиент с ID {new_client_id} не найден'}), 404
            car.client_id = new_client_id
        
        if 'model' in data and data['model']:
            car.model = data['model'].strip()
        
        if 'vin' in data:
            car.vin = data['vin'].strip().upper() if data['vin'] else None
        
        if 'gos_number' in data:
            car.gos_number = data['gos_number'].strip().upper() if data['gos_number'] else None
        
        if 'year' in data:
            car.year = data['year'] if data['year'] else None
        
        if 'mileage' in data:
            car.mileage = data['mileage'] if data['mileage'] else None
        
        db.session.commit()
        
        return jsonify({
            'message': 'Автомобиль успешно обновлен', 
            'car': car.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def delete_car(car_id):
    """Удалить автомобиль"""
    try:
        car = Car.query.get_or_404(car_id)
        
        # Проверяем, есть ли активные заказы для этого автомобиля
        active_orders = WorkOrder.query.filter_by(car_id=car_id).filter(
            WorkOrder.status.notin_(['Выполнен', 'Отменен'])
        ).first()
        
        if active_orders:
            return jsonify({
                'error': 'Нельзя удалить автомобиль с активными заказами',
                'active_orders': True
            }), 400
        
        db.session.delete(car)
        db.session.commit()
        
        return jsonify({'message': 'Автомобиль удален'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500