from flask import Blueprint, request, jsonify, render_template, make_response, send_file, current_app
from datetime import datetime
from models import db, WorkOrder, Client, Car, User, Role
import pdfkit, os

# ---------- Конфигурация pdfkit для Windows ----------
PDFKIT_CONFIG = pdfkit.configuration(
    wkhtmltopdf=r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe'
)

orders_bp = Blueprint('orders', __name__, url_prefix='/api/orders')

def save_order_pdf(order_id, template_name, suffix):
    """Генерирует PDF из шаблона и сохраняет в static/pdf, возвращает путь к файлу."""
    order = WorkOrder.query.get(order_id)
    if not order:
        return None
    client = Client.query.get(order.client_id)
    car = Car.query.get(order.car_id)
    manager = User.query.get(order.manager_id) if order.manager_id else User.query.first()
    ### ДОБАВЛЕНО: получаем механика
    mechanic = User.query.get(order.mechanic_id) if order.mechanic_id else None

    html = render_template(template_name,
                           order=order, client=client, car=car,
                           manager=manager, mechanic=mechanic)    # mechanic передан
    pdf_dir = os.path.join(current_app.root_path, 'static', 'pdf')
    os.makedirs(pdf_dir, exist_ok=True)
    pdf_path = os.path.join(pdf_dir, f'order_{order_id}_{suffix}.pdf')

    options = {
        'enable-local-file-access': True,
        'page-size': 'A4',
        'encoding': 'UTF-8'
    }
    pdfkit.from_string(html, pdf_path, options=options, configuration=PDFKIT_CONFIG)
    return pdf_path

@orders_bp.route('/', methods=['GET', 'POST'])
def handle_orders():
    if request.method == 'GET':
        return get_orders()
    elif request.method == 'POST':
        return create_order()

@orders_bp.route('/<int:order_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_order(order_id):
    if request.method == 'GET':
        return get_order(order_id)
    elif request.method == 'PUT':
        return update_order(order_id)
    elif request.method == 'DELETE':
        return delete_order(order_id)

@orders_bp.route('/archive', methods=['GET'])
def get_archive():
    """Получить архивные заказы"""
    try:
        archive_orders = WorkOrder.query.filter(
            WorkOrder.status.in_(['Выполнен', 'Отменен'])
        ).all()
        
        orders_list = []
        for order in archive_orders:
            order_data = {
                'order_id': order.order_id,
                'client_id': order.client_id,
                'car_id': order.car_id,
                'status': order.status,
                'problem_description': order.problem_description,
                'total_price': float(order.total_price) if order.total_price else None,
                'created_date': order.created_date.isoformat() if order.created_date else None,
                'completed_date': order.completed_date.isoformat() if order.completed_date else None,
                'pdf_url': order.pdf_url
            }
            
            if order.client:
                order_data['client_name'] = order.client.name
                order_data['client_phone'] = order.client.phone
            
            if order.car:
                order_data['car_model'] = order.car.model
                order_data['car_vin'] = order.car.vin
                order_data['car_gos_number'] = order.car.gos_number
            
            orders_list.append(order_data)
        
        return jsonify(orders_list)
    except Exception as e:
        print(f"❌ Ошибка в get_archive: {e}")
        return jsonify({'error': str(e)}), 500

def get_orders():
    """Получить все заказы"""
    try:
        orders = WorkOrder.query.all()

        mechanic_ids = list(set(o.mechanic_id for o in orders if o.mechanic_id))
        mechanic_names = {}
        if mechanic_ids:
            mechanics = User.query.join(Role).filter(
                User.user_id.in_(mechanic_ids),
                Role.role_name == 'mechanic'
            ).all()
            mechanic_names = {m.user_id: m.full_name for m in mechanics}

        orders_list = []
        for order in orders:
            order_data = {
                'order_id': order.order_id,
                'client_id': order.client_id,
                'car_id': order.car_id,
                'manager_id': order.manager_id,
                'mechanic_id': order.mechanic_id,
                'mechanic_name': mechanic_names.get(order.mechanic_id) if order.mechanic_id else None,
                'status': order.status,
                'problem_description': order.problem_description,
                'work_description': order.work_description,
                'total_price': float(order.total_price) if order.total_price else None,
                'created_date': order.created_date.isoformat() if order.created_date else None,
                'completed_date': order.completed_date.isoformat() if order.completed_date else None,
                'pdf_url': order.pdf_url
            }

            if order.client:
                order_data['client_name'] = order.client.name
                order_data['client_phone'] = order.client.phone

            if order.car:
                order_data['car_model'] = order.car.model
                order_data['car_vin'] = order.car.vin
                order_data['car_gos_number'] = order.car.gos_number
                order_data['car_year'] = order.car.year

            orders_list.append(order_data)

        return jsonify(orders_list)
    except Exception as e:
        print(f"❌ Ошибка в get_orders: {e}")
        return jsonify({'error': str(e)}), 500

def get_order(order_id):
    """Получить конкретный заказ"""
    try:
        order = WorkOrder.query.get_or_404(order_id)
        order_data = {
            'order_id': order.order_id,
            'client_id': order.client_id,
            'car_id': order.car_id,
            'manager_id': order.manager_id,
            'mechanic_id': order.mechanic_id,
            'status': order.status,
            'problem_description': order.problem_description,
            'work_description': order.work_description,
            'total_price': float(order.total_price) if order.total_price else None,
            'created_date': order.created_date.isoformat() if order.created_date else None,
            'completed_date': order.completed_date.isoformat() if order.completed_date else None,
            'pdf_url': order.pdf_url
        }
        
        if order.client:
            order_data['client'] = {
                'client_id': order.client.client_id,
                'name': order.client.name,
                'phone': order.client.phone,
                'vk_user_id': order.client.vk_user_id
            }
        
        if order.car:
            order_data['car'] = {
                'car_id': order.car.car_id,
                'model': order.car.model,
                'vin': order.car.vin,
                'gos_number': order.car.gos_number,
                'year': order.car.year,
                'mileage': order.car.mileage
            }
        
        if order.mechanic_id:
            mechanic = User.query.join(Role).filter(
                User.user_id == order.mechanic_id,
                Role.role_name == 'mechanic'
            ).first()
            if mechanic:
                order_data['mechanic'] = {
                    'user_id': mechanic.user_id,
                    'full_name': mechanic.full_name,
                    'phone': mechanic.phone,
                    'specialization': mechanic.specialization
                }
        
        return jsonify(order_data)
    except Exception as e:
        print(f"❌ Ошибка в get_order: {e}")
        return jsonify({'error': str(e)}), 500

def create_order():
    """Создать новый заказ"""
    try:
        data = request.get_json()
        
        if not data.get('client_id') or not data.get('car_id') or not data.get('problem_description'):
            return jsonify({'error': 'Отсутствуют обязательные поля: client_id, car_id, problem_description'}), 400
        
        client = Client.query.get(data['client_id'])
        if not client:
            return jsonify({'error': 'Клиент не найден'}), 404
            
        car = Car.query.get(data['car_id'])
        if not car:
            return jsonify({'error': 'Автомобиль не найден'}), 404
        
        active_order = WorkOrder.query.filter(
            WorkOrder.car_id == data['car_id'],
            WorkOrder.status.notin_(['Выполнен', 'Отменен'])
        ).first()
        if active_order:
            return jsonify({'error': 'У этого автомобиля уже есть активный заказ.'}), 409

        mechanic_id = data.get('mechanic_id')
        if mechanic_id:
            try:
                mechanic_id = int(mechanic_id)
                mechanic = User.query.join(Role).filter(User.user_id == mechanic_id, Role.role_name == 'mechanic').first()
                if not mechanic:
                    mechanic_id = None
                else:
                    active_order_mech = WorkOrder.query.filter(
                        WorkOrder.mechanic_id == mechanic_id,
                        WorkOrder.status.notin_(['Выполнен', 'Отменен'])
                    ).first()
                    if active_order_mech:
                        return jsonify({'error': 'Механик уже имеет активный заказ.', 'busy_mechanic': True}), 409
            except:
                mechanic_id = None

        total_price = data.get('total_price')
        total_price_val = None
        if total_price is not None and str(total_price).strip() != '':
            try:
                total_price_val = float(total_price)
                if total_price_val < 0:
                    return jsonify({'error': 'Сумма не может быть отрицательной'}), 400
                if total_price_val > 99999999.99:
                    return jsonify({'error': 'Сумма превышает максимально допустимую'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'Некорректное значение суммы'}), 400
        
        order = WorkOrder(
            client_id=data['client_id'],
            car_id=data['car_id'],
            mechanic_id=mechanic_id,
            status=data.get('status', 'Создан'),
            problem_description=data['problem_description'],
            work_description=data.get('work_description'),
            total_price=total_price_val,
            created_date=datetime.now(),
            pdf_url=data.get('pdf_url')
        )
        
        db.session.add(order)
        db.session.commit()
        
        return jsonify({
            'message': 'Заказ создан',
            'order': {
                'order_id': order.order_id,
                'client_id': order.client_id,
                'car_id': order.car_id,
                'status': order.status,
                'problem_description': order.problem_description,
                'pdf_url': order.pdf_url
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"❌ Ошибка в create_order: {e}")
        return jsonify({'error': str(e)}), 500

def update_order(order_id):
    """Обновить заказ"""
    try:
        order = WorkOrder.query.get_or_404(order_id)
        data = request.get_json()
        
        if 'status' in data:
            order.status = data['status']
            if data['status'] == 'Выполнен' and not order.completed_date:
                order.completed_date = datetime.now()
                # Автоматически генерируем и сохраняем итоговый PDF
                pdf_path = save_order_pdf(order_id, 'itogoviy_zakaznaryad.html', 'final')
                if pdf_path:
                    order.pdf_url = f'/api/orders/{order_id}/pdf/final'
        
        if 'problem_description' in data:
            order.problem_description = data['problem_description']
        
        if 'work_description' in data:
            order.work_description = data['work_description']
        
        if 'total_price' in data:
            price = data['total_price']
            if price is not None and str(price).strip() != '':
                try:
                    price_val = float(price)
                    if price_val < 0:
                        return jsonify({'error': 'Сумма не может быть отрицательной'}), 400
                    if price_val > 99999999.99:
                        return jsonify({'error': 'Сумма превышает максимально допустимую'}), 400
                    order.total_price = price_val
                except (ValueError, TypeError):
                    return jsonify({'error': 'Некорректное значение суммы'}), 400
            else:
                order.total_price = None
        
        if 'pdf_url' in data:
            order.pdf_url = data['pdf_url']
        
        if 'mechanic_id' in data:
            mechanic_id = data['mechanic_id']
            if mechanic_id:
                try:
                    mechanic_id = int(mechanic_id)
                    mechanic = User.query.join(Role).filter(User.user_id == mechanic_id, Role.role_name == 'mechanic').first()
                    if mechanic:
                        active_order = WorkOrder.query.filter(
                            WorkOrder.mechanic_id == mechanic_id,
                            WorkOrder.order_id != order_id,
                            WorkOrder.status.notin_(['Выполнен', 'Отменен'])
                        ).first()
                        if active_order:
                            return jsonify({'error': 'Механик уже имеет другой активный заказ.', 'busy_mechanic': True}), 409
                        order.mechanic_id = mechanic_id
                    else:
                        order.mechanic_id = None
                except:
                    order.mechanic_id = None
            else:
                order.mechanic_id = None
        
        db.session.commit()
        
        return jsonify({
            'message': 'Заказ обновлен',
            'order': {
                'order_id': order.order_id,
                'status': order.status,
                'mechanic_id': order.mechanic_id,
                'pdf_url': order.pdf_url
            }
        })
    except Exception as e:
        db.session.rollback()
        print(f"❌ Ошибка в update_order: {e}")
        return jsonify({'error': str(e)}), 500

def delete_order(order_id):
    """Удалить заказ"""
    try:
        order = WorkOrder.query.get_or_404(order_id)
        db.session.delete(order)
        db.session.commit()
        return jsonify({'message': 'Заказ удален'})
    except Exception as e:
        db.session.rollback()
        print(f"❌ Ошибка в delete_order: {e}")
        return jsonify({'error': str(e)}), 500

@orders_bp.route('/<int:order_id>/complete', methods=['POST'])
def complete_order(order_id):
    try:
        order = WorkOrder.query.get_or_404(order_id)
        order.status = 'Выполнен'
        order.completed_date = datetime.now()
        # Генерируем PDF
        pdf_path = save_order_pdf(order_id, 'itogoviy_zakaznaryad.html', 'final')
        if pdf_path:
            order.pdf_url = f'/api/orders/{order_id}/pdf/final'
        db.session.commit()
        return jsonify({
            'message': 'Заказ завершен и перемещен в архив',
            'order': {
                'order_id': order.order_id,
                'status': order.status,
                'completed_date': order.completed_date.isoformat() if order.completed_date else None,
                'pdf_url': order.pdf_url
            }
        })
    except Exception as e:
        db.session.rollback()
        print(f"❌ Ошибка в complete_order: {e}")
        return jsonify({'error': str(e)}), 500

@orders_bp.route('/<int:order_id>/pdf/preliminary')
def preliminary_pdf(order_id):
    order = WorkOrder.query.get_or_404(order_id)
    client = Client.query.get(order.client_id)
    car = Car.query.get(order.car_id)
    manager = User.query.get(order.manager_id) if order.manager_id else User.query.first()
    ### ДОБАВЛЕНО
    mechanic = User.query.get(order.mechanic_id) if order.mechanic_id else None

    html = render_template('predv_zakaznaryad.html',
                           order=order, client=client, car=car,
                           manager=manager, mechanic=mechanic)
    options = {'enable-local-file-access': True, 'page-size': 'A4'}
    pdf = pdfkit.from_string(html, False, options=options, configuration=PDFKIT_CONFIG)
    response = make_response(pdf)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'inline'
    return response

@orders_bp.route('/<int:order_id>/pdf/final')
def final_pdf(order_id):
    order = WorkOrder.query.get_or_404(order_id)
    # Ищем файл на диске
    pdf_path = os.path.join(current_app.root_path, 'static', 'pdf', f'order_{order_id}_final.pdf')
    if not os.path.exists(pdf_path):
        # Генерируем на лету (механик уже будет передан через save_order_pdf)
        pdf_path = save_order_pdf(order_id, 'itogoviy_zakaznaryad.html', 'final')
        if not pdf_path:
            return "PDF file not found", 404
    return send_file(pdf_path, mimetype='application/pdf')

@orders_bp.route('/<int:order_id>/pdf/acceptance')
def acceptance_pdf(order_id):
    order = WorkOrder.query.get_or_404(order_id)
    client = Client.query.get(order.client_id)
    car = Car.query.get(order.car_id)
    manager = User.query.get(order.manager_id) if order.manager_id else User.query.first()
    ### ДОБАВЛЕНО
    mechanic = User.query.get(order.mechanic_id) if order.mechanic_id else None

    completeness = request.args.get('completeness', '')
    damages = request.args.get('damages', '')
    client_parts = request.args.get('client_parts', '')

    html = render_template('akt_priema_peredachi.html',
                           order=order, client=client, car=car,
                           manager=manager, mechanic=mechanic,
                           completeness=completeness, damages=damages, client_parts=client_parts)
    options = {'enable-local-file-access': True, 'page-size': 'A4'}
    pdf = pdfkit.from_string(html, False, options=options, configuration=PDFKIT_CONFIG)
    response = make_response(pdf)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'inline'
    return response