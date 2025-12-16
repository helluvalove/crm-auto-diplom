from flask import Blueprint, request, jsonify
from models import db, Client, WorkOrder

clients_bp = Blueprint('clients', __name__, url_prefix='/api/clients')

@clients_bp.route('/', methods=['GET', 'POST'])
def handle_clients():
    if request.method == 'GET':
        return get_clients()
    elif request.method == 'POST':
        return create_client()

@clients_bp.route('/<int:client_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_client(client_id):
    if request.method == 'GET':
        return get_client(client_id)
    elif request.method == 'PUT':
        return update_client(client_id)
    elif request.method == 'DELETE':
        return delete_client(client_id)

def get_clients():
    try:
        clients = Client.query.all()
        clients_list = [client.to_dict() for client in clients]
        return jsonify(clients_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_client(client_id):
    try:
        client = Client.query.get_or_404(client_id)
        client_data = client.to_dict()
        
        cars = [car.to_dict() for car in client.cars]
        client_data['cars'] = cars
        
        return jsonify(client_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def create_client():
    try:
        data = request.get_json()
        
        if not data.get('name') or not data.get('phone'):
            return jsonify({'error': 'Отсутствуют обязательные поля: name, phone'}), 400
        
        client = Client(
            name=data['name'],
            phone=data['phone'],
            telegram_chat_id=data.get('telegram_chat_id')
        )
        
        db.session.add(client)
        db.session.commit()
        
        return jsonify({'message': 'Клиент создан', 'client': client.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def update_client(client_id):
    try:
        client = Client.query.get_or_404(client_id)
        data = request.get_json()
        
        if 'name' in data:
            client.name = data['name']
        
        if 'phone' in data:
            client.phone = data['phone']
        
        if 'telegram_chat_id' in data:
            client.telegram_chat_id = data['telegram_chat_id']
        
        db.session.commit()
        
        return jsonify({'message': 'Клиент обновлен', 'client': client.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def delete_client(client_id):
    """Удалить клиента"""
    try:
        client = Client.query.get_or_404(client_id)
        
        active_orders = WorkOrder.query.filter_by(client_id=client_id).filter(
            WorkOrder.status.notin_(['Выполнен', 'Отменен'])
        ).first()
        
        if active_orders:
            return jsonify({
                'error': 'Нельзя удалить клиента с активными заказами',
                'active_orders': True
            }), 400
        
        db.session.delete(client)
        db.session.commit()
        
        return jsonify({'message': 'Клиент удален'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500