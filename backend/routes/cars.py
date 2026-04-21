from flask import Blueprint, request, jsonify
from models import db, Car, Client, WorkOrder
import re
from datetime import datetime   # <-- добавить импорт

cars_bp = Blueprint('cars', __name__, url_prefix='/api/cars')

def validate_car_data(data, is_update=False, car_id=None):
    """Валидация данных автомобиля"""
    errors = {}
    
    # === ОБЯЗАТЕЛЬНЫЕ ПОЛЯ ===
    required_fields = ['client_id', 'model', 'vin', 'gos_number', 'year', 'mileage']
    
    if not is_update:
        for field in required_fields:
            if field not in data or not data[field]:
                errors[field] = f'Поле обязательно для заполнения'
    
    # === МОДЕЛЬ ===
    if 'model' in data and data['model']:
        model = data['model'].strip()
        if len(model) > 100:
            errors['model'] = 'Модель не должна превышать 100 символов'
    
    # === VIN (ОБЯЗАТЕЛЬНЫЙ) ===
    if 'vin' in data:
        vin = data['vin'].strip().upper() if data['vin'] else ''
        
        if not vin:
            errors['vin'] = 'VIN обязателен'
        elif len(vin) != 17:
            errors['vin'] = 'VIN должен содержать 17 символов'
        elif re.search(r'[IOQ]', vin):
            errors['vin'] = 'VIN содержит недопустимые символы (I, O, Q)'
        else:
            query = Car.query.filter_by(vin=vin)
            if car_id:
                query = query.filter(Car.car_id != car_id)
            
            if query.first():
                errors['vin'] = f'Автомобиль с VIN {vin} уже существует'
    
    # === ГОСНОМЕР (ОБЯЗАТЕЛЬНЫЙ) ===
    if 'gos_number' in data:
        gos = data['gos_number'].strip().upper() if data['gos_number'] else ''
        
        if not gos:
            errors['gos_number'] = 'Госномер обязателен'
        elif not re.match(r'^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$', gos):
            errors['gos_number'] = 'Неверный формат госномера (пример: А123БВ77)'
        else:
            query = Car.query.filter_by(gos_number=gos)
            if car_id:
                query = query.filter(Car.car_id != car_id)
            
            if query.first():
                errors['gos_number'] = f'Автомобиль с госномером {gos} уже существует'
    
    # === ГОД (исправленная проверка) ===
    if 'year' in data:
        try:
            year = int(data['year'])
            current_year = datetime.now().year
            if year < 1900 or year > current_year + 1:
                errors['year'] = f'Год должен быть между 1900 и {current_year + 1}'
        except:
            errors['year'] = 'Год должен быть числом'
    
    # === ПРОБЕГ ===
    if 'mileage' in data:
        try:
            mileage = float(data['mileage'])
            if mileage < 0 or mileage > 1000000:
                errors['mileage'] = 'Пробег должен быть от 0 до 1 000 000'
        except:
            errors['mileage'] = 'Пробег должен быть числом'
    
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
        client = Client.query.filter_by(client_id=client_id).first()
        if not client:
            return jsonify({'error': f'Клиент с ID {client_id} не найден'}), 404
        
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
        car = Car.query.filter_by(car_id=car_id).first_or_404()
        
        # Получаем информацию о клиенте
        client_data = None
        if car.client:
            client_data = {
                'client_id': car.client.client_id,
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
        client = Client.query.filter_by(client_id=client_id).first()
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
        car = Car.query.filter_by(car_id=car_id).first_or_404()
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
            client = Client.query.filter_by(client_id=new_client_id).first()
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
        
        # Проверяем есть ли активные заказы у автомобиля
        active_orders = WorkOrder.query.filter_by(car_id=car_id).filter(
            WorkOrder.status.in_(['Создан', 'На диагностике', 'В работе', 'Готов к выдаче'])
        ).all()
        
        if active_orders:
            order_ids = [order.order_id for order in active_orders]
            return jsonify({
                'error': 'Нельзя удалить автомобиль с активными заказами',
                'active_orders': order_ids,
                'message': f'У автомобиля есть {len(active_orders)} активных заказов. Сначала завершите или удалите их.'
            }), 400
        
        # Удаляем все заказы для этого автомобиля
        all_car_orders = WorkOrder.query.filter_by(car_id=car_id).all()
        for order in all_car_orders:
            db.session.delete(order)
        
        # Удаляем автомобиль
        db.session.delete(car)
        db.session.commit()
        
        return jsonify({
            'message': 'Автомобиль и все связанные заказы удалены',
            'deleted_orders': len(all_car_orders)
        })
    except Exception as e:
        db.session.rollback()
        print(f"❌ Ошибка в delete_car: {e}")
        return jsonify({'error': str(e)}), 500