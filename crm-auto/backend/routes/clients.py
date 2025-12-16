from flask import Blueprint, request, jsonify
from models import db, Client, WorkOrder
import re

clients_bp = Blueprint('clients', __name__, url_prefix='/api/clients')

def validate_russian_phone(phone):
    """
    Валидация российского номера телефона.
    Поддерживает форматы:
    - +7XXXXXXXXXX
    - 8XXXXXXXXXX
    - 7XXXXXXXXXX
    Где X - цифры от 0 до 9
    """
    if not phone:
        return None, "Телефон не может быть пустым"
    
    # Удаляем все пробелы, дефисы и скобки
    phone = re.sub(r'[\s\-\(\)]', '', phone)
    
    # Проверяем, что после очистки остались только цифры и возможно знак +
    if not re.match(r'^[\+\d]+$', phone):
        return None, "Телефон может содержать только цифры и знак '+' в начале"
    
    # Проверяем российский формат
    if phone.startswith('+7') and len(phone) == 12:
        return phone, None  # Формат +7XXXXXXXXXX
    elif phone.startswith('8') and len(phone) == 11:
        validated_phone = '+7' + phone[1:]  # Конвертируем 8XXXXXXXXXX в +7XXXXXXXXXX
        return validated_phone, None
    elif phone.startswith('7') and len(phone) == 11:
        validated_phone = '+' + phone  # Конвертируем 7XXXXXXXXXX в +7XXXXXXXXXX
        return validated_phone, None
    else:
        # Определяем конкретную ошибку
        if not phone.startswith(('+7', '8', '7')):
            return None, "Телефон должен начинаться с +7, 8 или 7"
        elif len(phone) < 11:
            return None, "Телефон слишком короткий. Должно быть 11 цифр"
        elif len(phone) > 12:
            return None, "Телефон слишком длинный. Должно быть 11 цифр"
        else:
            return None, "Неверный формат телефона. Используйте +7XXXXXXXXXX, 8XXXXXXXXXX или 7XXXXXXXXXX"

def validate_client_data(data, is_update=False, client_id=None):
    """Валидация данных клиента с подробными сообщениями об ошибках"""
    errors = {}
    
    # Проверка обязательных полей при создании
    if not is_update:
        if 'name' not in data or not data['name']:
            errors['name'] = 'Имя является обязательным полем'
        if 'phone' not in data or not data['phone']:
            errors['phone'] = 'Телефон является обязательным полем'
    
    # Валидация имени (если передано)
    if 'name' in data and data['name']:
        name = data['name'].strip()
        if len(name) < 2:
            errors['name'] = 'Имя должно содержать минимум 2 символа'
        elif len(name) > 100:
            errors['name'] = 'Имя не должно превышать 100 символов'
        # Проверка на недопустимые символы
        elif not re.match(r'^[a-zA-Zа-яА-ЯёЁ\s\-]+$', name):
            errors['name'] = 'Имя может содержать только буквы, пробелы и дефисы'
    
    # Валидация телефона (если передано)
    if 'phone' in data and data['phone']:
        phone = data['phone'].strip()
        
        # Получаем результат валидации телефона
        validation_result = validate_russian_phone(phone)
        
        if validation_result[1]:  # Если есть ошибка (второй элемент кортежа)
            errors['phone'] = validation_result[1]
        else:
            validated_phone = validation_result[0]  # Первый элемент - валидированный телефон
            
            # Проверяем уникальность телефона
            query = Client.query.filter_by(phone=validated_phone)
            if client_id:
                # При обновлении исключаем текущего клиента из проверки
                query = query.filter(Client.client_id != client_id)  # Исправлено здесь
            
            existing_client = query.first()
            if existing_client:
                # Используем правильное имя поля из модели
                errors['phone'] = f'Клиент с таким номером телефона уже существует (ID: {existing_client.client_id}, Имя: {existing_client.name})'
            else:
                # Сохраняем валидированный телефон в данные
                data['_validated_phone'] = validated_phone
    
    # Валидация telegram_chat_id (если передано)
    if 'telegram_chat_id' in data and data['telegram_chat_id']:
        telegram_chat_id = str(data['telegram_chat_id']).strip()
        if telegram_chat_id:
            # Проверяем формат
            if not (telegram_chat_id.isdigit() or (telegram_chat_id.startswith('@') and len(telegram_chat_id) > 1)):
                errors['telegram_chat_id'] = 'Telegram Chat ID должен быть числовым идентификатором или начинаться с @username'
            elif telegram_chat_id.isdigit() and len(telegram_chat_id) > 20:
                errors['telegram_chat_id'] = 'Telegram Chat ID слишком длинный'
    
    return errors

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
        # Используем правильное имя поля для поиска
        client = Client.query.filter_by(client_id=client_id).first_or_404()
        client_data = client.to_dict()
        
        cars = [car.to_dict() for car in client.cars]
        client_data['cars'] = cars
        
        return jsonify(client_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def create_client():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Отсутствуют данные'}), 400
        
        # Валидация данных
        errors = validate_client_data(data)
        if errors:
            return jsonify({
                'error': 'Ошибки валидации', 
                'details': errors,
                'message': 'Пожалуйста, исправьте ошибки в форме'
            }), 400
        
        # Используем валидированный телефон
        validated_phone = data.get('_validated_phone', data.get('phone'))
        
        # Дополнительная проверка на случай если validate_client_data не сработала
        existing_client = Client.query.filter_by(phone=validated_phone).first()
        if existing_client:
            return jsonify({
                'error': 'Клиент с таким номером телефона уже существует',
                'details': {
                    'phone': f'Клиент с номером {validated_phone} уже существует (ID: {existing_client.client_id}, Имя: {existing_client.name})'
                },
                'message': 'Клиент с таким номером телефона уже существует'
            }), 400
        
        client = Client(
            name=data['name'].strip(),
            phone=validated_phone,
            telegram_chat_id=data.get('telegram_chat_id', '').strip() or None
        )
        
        db.session.add(client)
        db.session.commit()
        
        return jsonify({
            'message': 'Клиент успешно создан', 
            'client': client.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        # Если это ошибка уникальности (например, дублирование телефона)
        if 'UNIQUE constraint failed' in str(e) or 'duplicate key' in str(e).lower():
            return jsonify({
                'error': 'Клиент с таким номером телефона уже существует',
                'message': 'Клиент с таким номером телефона уже существует'
            }), 400
        return jsonify({'error': str(e)}), 500

def update_client(client_id):
    try:
        client = Client.query.filter_by(client_id=client_id).first_or_404()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Отсутствуют данные для обновления'}), 400
        
        # Валидация данных с учетом обновления
        errors = validate_client_data(data, is_update=True, client_id=client_id)
        if errors:
            return jsonify({
                'error': 'Ошибки валидации', 
                'details': errors,
                'message': 'Пожалуйста, исправьте ошибки в форме'
            }), 400
        
        # Обновление полей
        if 'name' in data and data['name']:
            client.name = data['name'].strip()
        
        if 'phone' in data and data['phone']:
            # Используем валидированный телефон
            validated_phone = data.get('_validated_phone', data.get('phone'))
            if validated_phone:
                client.phone = validated_phone
        
        if 'telegram_chat_id' in data:
            telegram_chat_id = data['telegram_chat_id']
            if isinstance(telegram_chat_id, str):
                telegram_chat_id = telegram_chat_id.strip()
            client.telegram_chat_id = telegram_chat_id if telegram_chat_id else None
        
        db.session.commit()
        
        return jsonify({
            'message': 'Клиент успешно обновлен', 
            'client': client.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def delete_client(client_id):
    """Удалить клиента"""
    try:
        client = Client.query.filter_by(client_id=client_id).first_or_404()
        
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