from flask import Blueprint, request, jsonify, current_app
from models import db, Client, WorkOrder, Car
from crypto import hash_phone            # <-- добавлен импорт
import re
import jwt

clients_bp = Blueprint('clients', __name__, url_prefix='/api/clients')

# Функция для проверки авторизации и ролей
def check_auth_and_role(required_role=None):
    """Проверяет авторизацию и роль пользователя"""
    auth_header = request.headers.get('Authorization')
    print(f"=== DEBUG AUTH CHECK ===")
    print(f"Authorization header: {auth_header}")
    print(f"Required role: {required_role}")
    
    if not auth_header:
        print("No authorization header")
        return None, 'Требуется авторизация', 401
    
    try:
        token = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
        print(f"Token extracted: {token[:20]}...")
        
        decoded_token = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        print(f"Decoded token: {decoded_token}")
        
        user_id = decoded_token.get('user_id')
        user_role = decoded_token.get('role')
        
        print(f"User ID: {user_id}, Role: {user_role}")
        
        if required_role and user_role != required_role:
            print(f"Role mismatch: user has {user_role}, required {required_role}")
            return None, f'Доступ запрещен. Требуется роль: {required_role}', 403
        
        return {'user_id': user_id, 'role': user_role}, None, None
        
    except jwt.ExpiredSignatureError:
        print("Token expired")
        return None, 'Токен истек', 401
    except jwt.InvalidTokenError as e:
        print(f"Invalid token: {str(e)}")
        return None, 'Неверный токен', 401
    except Exception as e:
        print(f"Other error: {str(e)}")
        return None, f'Ошибка проверки токена: {str(e)}', 401


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
        elif not re.match(r'^[a-zA-Zа-яА-ЯёЁ\s\-]+$', name):
            errors['name'] = 'Имя может содержать только буквы, пробелы и дефисы'
    
    # Валидация телефона (если передано)
    if 'phone' in data and data['phone']:
        phone = data['phone'].strip()
        validation_result = validate_russian_phone(phone)
        
        if validation_result[1]:  # Есть ошибка
            errors['phone'] = validation_result[1]
        else:
            validated_phone = validation_result[0]
            
            # Проверяем уникальность телефона по ХЭШУ
            query = Client.query.filter_by(phone_hash=hash_phone(validated_phone))
            if client_id:
                query = query.filter(Client.client_id != client_id)
            
            existing_client = query.first()
            if existing_client:
                # existing_client.name вернёт расшифрованное имя
                errors['phone'] = f'Клиент с таким номером телефона уже существует (ID: {existing_client.client_id}, Имя: {existing_client.name})'
            else:
                data['_validated_phone'] = validated_phone
    
    # Валидация vk_user_id (если передано)
    if 'vk_user_id' in data and data['vk_user_id']:
        vk_id = str(data['vk_user_id']).strip()
        if vk_id:
            if not vk_id.isdigit():
                errors['vk_user_id'] = 'VK User ID должен быть числовым идентификатором'
            elif len(vk_id) > 20:
                errors['vk_user_id'] = 'VK User ID слишком длинный'
    
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
        # Не показываем клиентов, у которых нет ни имени, ни телефона (пустые из ВК)
        clients = Client.query.filter(
            db.or_(Client._name != None, Client._phone != None)
        ).all()
        clients_list = [client.to_dict() for client in clients]
        return jsonify(clients_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def get_client(client_id):
    try:
        client = Client.query.filter_by(client_id=client_id).first_or_404()
        client_data = client.to_dict()
        cars = [car.to_dict() for car in client.cars]
        client_data['cars'] = cars
        return jsonify(client_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def create_client():
    try:
        auth_result, error_message, status_code = check_auth_and_role('manager')
        if error_message:
            return jsonify({'error': error_message}), status_code
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Отсутствуют данные'}), 400
        
        errors = validate_client_data(data)
        if errors:
            return jsonify({
                'error': 'Ошибки валидации',
                'details': errors,
                'message': 'Пожалуйста, исправьте ошибки в форме'
            }), 400
        
        validated_phone = data.get('_validated_phone', data.get('phone'))
        
        # Дополнительная проверка уникальности по хэшу
        existing_client = Client.query.filter_by(phone_hash=hash_phone(validated_phone)).first()
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
            vk_user_id=data.get('vk_user_id')
        )
        
        db.session.add(client)
        db.session.commit()
        
        return jsonify({
            'message': 'Клиент успешно создан',
            'client': client.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        if 'UNIQUE constraint failed' in str(e) or 'duplicate key' in str(e).lower():
            return jsonify({
                'error': 'Клиент с таким номером телефона уже существует',
                'message': 'Клиент с таким номером телефона уже существует'
            }), 400
        return jsonify({'error': str(e)}), 500


def update_client(client_id):
    try:
        auth_result, error_message, status_code = check_auth_and_role('manager')
        if error_message:
            return jsonify({'error': error_message}), status_code
        
        client = Client.query.filter_by(client_id=client_id).first_or_404()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Отсутствуют данные для обновления'}), 400
        
        errors = validate_client_data(data, is_update=True, client_id=client_id)
        if errors:
            return jsonify({
                'error': 'Ошибки валидации',
                'details': errors,
                'message': 'Пожалуйста, исправьте ошибки в форме'
            }), 400
        
        if 'name' in data and data['name']:
            client.name = data['name'].strip()
        
        if 'phone' in data and data['phone']:
            validated_phone = data.get('_validated_phone', data.get('phone'))
            if validated_phone:
                client.phone = validated_phone
        
        if 'vk_user_id' in data:
            vk_id = data['vk_user_id']
            if vk_id is not None and str(vk_id).strip() == '':
                client.vk_user_id = None
            else:
                client.vk_user_id = int(vk_id) if vk_id else None
        
        db.session.commit()
        
        return jsonify({
            'message': 'Клиент успешно обновлен',
            'client': client.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def delete_client(client_id):
    """Удалить клиента (только для менеджеров)"""
    try:
        auth_result, error_message, status_code = check_auth_and_role('manager')
        if error_message:
            return jsonify({'error': error_message}), status_code
        
        client = Client.query.filter_by(client_id=client_id).first_or_404()
        
        # Проверяем, есть ли активные заказы у клиента
        active_orders = WorkOrder.query.filter_by(client_id=client_id).filter(
            WorkOrder.status.in_(['Создан', 'На диагностике', 'В работе', 'Готов к выдаче'])
        ).all()
        
        if active_orders:
            order_ids = [order.order_id for order in active_orders]
            return jsonify({
                'error': 'Нельзя удалить клиента с активными заказами',
                'active_orders': order_ids,
                'message': f'У клиента есть {len(active_orders)} активных заказов. Сначала завершите или удалите их.'
            }), 400
        
        # Удаляем все автомобили клиента
        cars = Car.query.filter_by(client_id=client_id).all()
        car_ids = [car.car_id for car in cars]
        
        for car in cars:
            car_orders = WorkOrder.query.filter_by(car_id=car.car_id).all()
            for order in car_orders:
                db.session.delete(order)
            db.session.delete(car)
        
        all_client_orders = WorkOrder.query.filter_by(client_id=client_id).all()
        for order in all_client_orders:
            db.session.delete(order)
        
        db.session.delete(client)
        db.session.commit()
        
        return jsonify({
            'message': 'Клиент и все связанные данные удалены',
            'deleted_cars': len(cars),
            'deleted_car_ids': car_ids,
            'deleted_orders': len(all_client_orders)
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500