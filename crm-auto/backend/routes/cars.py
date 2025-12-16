from flask import Blueprint, request, jsonify
from models import db, Car, WorkOrder

cars_bp = Blueprint('cars', __name__, url_prefix='/api/cars')

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
    try:
        cars = Car.query.filter_by(client_id=client_id).all()
        cars_list = [car.to_dict() for car in cars]
        return jsonify(cars_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_cars():
    try:
        cars = Car.query.all()
        cars_list = [car.to_dict() for car in cars]
        return jsonify(cars_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_car(car_id):
    try:
        car = Car.query.get_or_404(car_id)
        return jsonify(car.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def create_car():
    try:
        data = request.get_json()
        
        if not data.get('client_id') or not data.get('model'):
            return jsonify({'error': 'Отсутствуют обязательные поля: client_id, model'}), 400
        
        # Проверяем уникальность VIN если он указан
        vin = data.get('vin')
        if vin:
            existing_car = Car.query.filter_by(vin=vin).first()
            if existing_car:
                return jsonify({'error': 'Автомобиль с таким VIN уже существует'}), 400
        
        car = Car(
            client_id=data['client_id'],
            model=data['model'],
            vin=vin,
            gos_number=data.get('gos_number'),
            year=data.get('year'),
            mileage=data.get('mileage')
        )
        
        db.session.add(car)
        db.session.commit()
        
        return jsonify({'message': 'Автомобиль добавлен', 'car': car.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def update_car(car_id):
    try:
        car = Car.query.get_or_404(car_id)
        data = request.get_json()
        
        if 'model' in data:
            car.model = data['model']
        
        if 'vin' in data and data['vin'] != car.vin:
            # Проверяем уникальность нового VIN
            existing_car = Car.query.filter_by(vin=data['vin']).first()
            if existing_car and existing_car.car_id != car_id:
                return jsonify({'error': 'Автомобиль с таким VIN уже существует'}), 400
            car.vin = data['vin']
        
        if 'gos_number' in data:
            car.gos_number = data['gos_number']
        
        if 'year' in data:
            car.year = data['year']
        
        if 'mileage' in data:
            car.mileage = data['mileage']
        
        db.session.commit()
        
        return jsonify({'message': 'Автомобиль обновлен', 'car': car.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def delete_car(car_id):
    """Удалить автомобиль"""
    try:
        car = Car.query.get_or_404(car_id)
        
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