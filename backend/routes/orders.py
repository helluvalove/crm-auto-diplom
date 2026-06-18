from flask import Blueprint, request, jsonify, render_template, make_response, send_file, current_app
from datetime import datetime, timedelta
from models import db, WorkOrder, Client, Car, User, Role, OrderPhoto
import pdfkit, os, sys, platform, threading
import storage    
import io                           
from routes.vk.vk_notify import notify_status_change
from routes.vk.vk_photo_sender import send_photos_to_client

NON_BUSY_STATUSES = {'Выполнен', 'Отменен', 'Готов к выдаче'}

# ---------- Конфигурация pdfkit для Windows ----------
if platform.system() == 'Windows':
    PDFKIT_CONFIG = pdfkit.configuration(
        wkhtmltopdf=r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe'
    )
else:
    PDFKIT_CONFIG = pdfkit.configuration(
        wkhtmltopdf=r'/usr/bin/wkhtmltopdf'
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
    mechanic = User.query.get(order.mechanic_id) if order.mechanic_id else None

    # Вытаскиваем только текст проблемы из problem_description
    # Формат строки: "Клиент: ...\nVK ID 123456: текст проблемы\nВремя: ..."
    problem_text = ''
    if order.problem_description:
        for line in order.problem_description.splitlines():
            line = line.strip()
            if line.startswith('VK ID'):
                parts = line.split(':', 1)
                if len(parts) == 2:
                    problem_text = parts[1].strip()
                break
        # Если блока "VK ID" нет — описание уже чистое, берём как есть
        if not problem_text:
            problem_text = order.problem_description.strip()

    html = render_template(template_name,
                           order=order, client=client, car=car,
                           manager=manager, mechanic=mechanic,
                           problem_text=problem_text)
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

@orders_bp.route('/<int:order_id>/moderate', methods=['POST'])
def moderate_order(order_id):
    """
    Модерация заявки из ВК: принять (→ Забронирован/Создан) или отклонить (→ Отменена).

    Тело запроса:
        action      : "accept" | "reject"   (обязательно)
        reject_reason: str                  (обязательно при action=reject)
        # При принятии — те же поля, что у create_order:
        mechanic_id, appointment_datetime, estimated_hours, work_description
    """
    try:
        order = WorkOrder.query.get_or_404(order_id)

        if order.status != 'Заявка':
            return jsonify({'error': 'Можно модерировать только заявки со статусом «Заявка»'}), 400

        data = request.get_json() or {}
        action = data.get('action')

        if action not in ('accept', 'reject'):
            return jsonify({'error': 'Поле action должно быть "accept" или "reject"'}), 400

        # ── ОТКЛОНЕНИЕ ──────────────────────────────────────────────────────
        if action == 'reject':
            reason = (data.get('reject_reason') or '').strip()
            if not reason:
                return jsonify({'error': 'Укажите причину отклонения'}), 400

            order.status = 'Отменена'
            db.session.commit()

            if order.client and order.client.vk_user_id:
                try:
                    from routes.vk.vk_notify import _send_plain_message
                    msg = (
                        f"❌ Ваша заявка №{order_id} отклонена.\n\n"
                        f"Причина: {reason}\n\n"
                        f"Если у вас остались вопросы, свяжитесь с нами напрямую."
                    )
                    _send_plain_message(order.client.vk_user_id, msg)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(f"[moderate] VK reject notify error: {e}")

            return jsonify({'message': f'Заявка №{order_id} отклонена', 'status': 'Отменена'}), 200

        # ── ПРИНЯТИЕ ────────────────────────────────────────────────────────
        mechanic_id = data.get('mechanic_id')
        if not mechanic_id:
            return jsonify({'error': 'Для принятия заявки укажите механика'}), 400
        try:
            mechanic_id = int(mechanic_id)
        except (ValueError, TypeError):
            return jsonify({'error': 'Некорректный ID механика'}), 400

        mechanic = User.query.join(Role).filter(
            User.user_id == mechanic_id, Role.role_name == 'mechanic'
        ).first()
        if not mechanic:
            return jsonify({'error': 'Механик не найден'}), 404

        appointment_dt = None
        appointment_str = data.get('appointment_datetime')
        if appointment_str:
            try:
                appointment_dt = datetime.fromisoformat(appointment_str)
            except Exception:
                return jsonify({'error': 'Неверный формат даты записи'}), 400
            if appointment_dt < datetime.now():
                return jsonify({'error': 'Дата записи не может быть в прошлом'}), 400
            if appointment_dt.weekday() == 6:
                return jsonify({'error': 'Запись невозможна: воскресенье выходной'}), 400
            if appointment_dt.hour < 10 or appointment_dt.hour >= 20:
                return jsonify({'error': 'Время записи должно быть с 10:00 до 20:00'}), 400

        est_hours = None
        if data.get('estimated_hours') not in (None, ''):
            try:
                est_hours = float(data['estimated_hours'])
                if est_hours < 0:
                    return jsonify({'error': 'Оценка времени не может быть отрицательной'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'Некорректное значение estimated_hours'}), 400

        new_status = 'Забронирован' if appointment_dt else 'Создан'

        is_available, err_msg = check_mechanic_availability(
            mechanic_id, appointment_dt, est_hours
        )
        if not is_available:
            return jsonify({'error': err_msg, 'busy_mechanic': True}), 409

        order.mechanic_id = mechanic_id
        order.appointment_datetime = appointment_dt
        order.estimated_hours = est_hours
        order.status = new_status
        if data.get('work_description'):
            order.work_description = data['work_description']

        db.session.commit()

        # Генерируем предварительный PDF
        try:
            prelim_path = save_order_pdf(order_id, 'predv_zakaznaryad.html', 'prelim')
            if prelim_path:
                order.pdf_prelim_url = f'/api/orders/{order_id}/pdf/prelim'
                db.session.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"[moderate] PDF prelim error: {e}")

        # Уведомляем клиента в ВК
        if order.client and order.client.vk_user_id:
            try:
                notify_status_change(order.client.vk_user_id, order_id, new_status)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"[moderate] VK accept notify error: {e}")

        warning_msg = get_indefinite_warning(mechanic_id, appointment_dt, est_hours,
                                             exclude_order_id=order_id)

        return jsonify({
            'message': f'Заявка №{order_id} принята → {new_status}',
            'status': new_status,
            'order_id': order_id,
            'warning': warning_msg
        }), 200

    except Exception as e:
        db.session.rollback()
        import logging
        logging.getLogger(__name__).error(f"[moderate_order] {e}")
        return jsonify({'error': str(e)}), 500

@orders_bp.route('/<int:order_id>/reject', methods=['POST'])
def reject_vk_order(order_id):
    """
    Отклонение заявки из ВК — меняет статус на 'Отменена' и отправляет клиенту причину в ВК.
    Тело: { "reject_reason": "текст причины" }
    """
    try:
        order = WorkOrder.query.get_or_404(order_id)

        if order.status != 'Заявка':
            return jsonify({'error': 'Можно отклонить только заявку со статусом «Заявка»'}), 400

        data = request.get_json() or {}
        reason = (data.get('reject_reason') or '').strip()
        if not reason:
            return jsonify({'error': 'Укажите причину отклонения'}), 400

        order.status = 'Отменена'
        db.session.commit()

        # Уведомляем клиента в ВК
        if order.client and order.client.vk_user_id:
            try:
                from routes.vk.vk_notify import _send_plain_message
                msg = (
                    f"❌ Ваша заявка №{order_id} отклонена.\n\n"
                    f"Причина: {reason}\n\n"
                    f"Если у вас остались вопросы — свяжитесь с нами напрямую."
                )
                _send_plain_message(order.client.vk_user_id, msg)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"[reject_vk_order] VK notify error: {e}")

        return jsonify({'message': f'Заявка №{order_id} отклонена', 'status': 'Отменена'}), 200

    except Exception as e:
        db.session.rollback()
        import logging
        logging.getLogger(__name__).error(f"[reject_vk_order] {e}")
        return jsonify({'error': str(e)}), 500


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
    """Получить все заказы (можно фильтровать по status)"""
    try:
        status_filter = request.args.get('status')          # <-- новое
        query = WorkOrder.query
        if status_filter:
            query = query.filter(WorkOrder.status == status_filter)
        orders = query.all()

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
                'pdf_url': order.pdf_url,
                'appointment_datetime': order.appointment_datetime.isoformat() if order.appointment_datetime else None,
                'estimated_hours': order.estimated_hours if order.estimated_hours else None
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
            'pdf_url': order.pdf_url,
            'appointment_datetime': order.appointment_datetime.isoformat() if order.appointment_datetime else None,
            'estimated_hours': order.estimated_hours if order.estimated_hours else None
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
                    'phone': mechanic.phone
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

        # Проверка, нет ли уже активного заказа у этого автомобиля
        active_order = WorkOrder.query.filter(
            WorkOrder.car_id == data['car_id'],
            WorkOrder.status.notin_(['Выполнен', 'Отменен'])
        ).first()
        if active_order:
            return jsonify({'error': 'У этого автомобиля уже есть активный заказ.'}), 409

        # --- Обработка даты/времени записи и автостатус ---
        appointment_str = data.get('appointment_datetime')
        appointment_dt = None
        status = data.get('status', 'Создан')

        if appointment_str:
            try:
                appointment_dt = datetime.fromisoformat(appointment_str)
            except:
                return jsonify({'error': 'Неверный формат даты/времени записи'}), 400
            if appointment_dt < datetime.now():
                return jsonify({'error': 'Дата записи не может быть в прошлом'}), 400

            if appointment_dt.weekday() == 6:
                return jsonify({'error': 'Запись невозможна: воскресенье выходной.'}), 400
            if appointment_dt.hour < 10 or appointment_dt.hour >= 20:
                return jsonify({'error': 'Время записи должно быть с 10:00 до 20:00.'}), 400

            if not data.get('status') or data.get('status') == 'Создан':
                status = 'Забронирован'

        # --- Механик (обязателен) ---
        mechanic_id = data.get('mechanic_id')
        if not mechanic_id:
            return jsonify({'error': 'Механик обязателен для создания заказа.'}), 400

        try:
            mechanic_id = int(mechanic_id)
            mechanic = User.query.join(Role).filter(User.user_id == mechanic_id, Role.role_name == 'mechanic').first()
            if not mechanic:
                return jsonify({'error': 'Указанный механик не найден.'}), 404
        except (ValueError, TypeError):
            return jsonify({'error': 'Некорректный ID механика.'}), 400

        # --- Оценка времени ---
        est_hours = None
        if 'estimated_hours' in data:
            raw = data['estimated_hours']
            if raw not in (None, ''):
                try:
                    est_hours = float(raw)
                    if est_hours < 0:
                        return jsonify({'error': 'Оценка времени не может быть отрицательной'}), 400
                except (ValueError, TypeError):
                    return jsonify({'error': 'Некорректное значение estimated_hours'}), 400

        # --- Запрет нескольких активных заказов (кроме брони) ---
        if status != 'Забронирован':
            truly_active_statuses = ['Создан', 'На диагностике', 'В работе']  # 'Готов к выдаче' НЕ блокирует
            existing_active = WorkOrder.query.filter(
                WorkOrder.mechanic_id == mechanic_id,
                WorkOrder.status.in_(truly_active_statuses)
            ).first()
            if existing_active:
                return jsonify({
                    'error': 'У механика уже есть активный заказ (не бронь). Новый заказ можно создать только со статусом «Забронирован».'
                }), 409

        # --- Проверка доступности механика ---
        is_available, error_msg = check_mechanic_availability(
            mechanic_id, appointment_dt, est_hours
        )
        if not is_available:
            return jsonify({'error': error_msg, 'busy_mechanic': True}), 409

        # --- Стоимость ---
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
            status=status,
            problem_description=data['problem_description'],
            work_description=data.get('work_description'),
            total_price=total_price_val,
            created_date=datetime.now(),
            appointment_datetime=appointment_dt,
            estimated_hours=est_hours,
            pdf_url=data.get('pdf_url')
        )

        db.session.add(order)
        db.session.commit()

        # --- Предупреждение о будущей бессрочной записи ---
        warning_msg = get_indefinite_warning(mechanic_id, appointment_dt, est_hours,
                                     exclude_order_id=order.order_id)

        return jsonify({
            'message': 'Заказ создан',
            'order': {
                'order_id': order.order_id,
                'client_id': order.client_id,
                'car_id': order.car_id,
                'status': order.status,
                'problem_description': order.problem_description,
                'pdf_url': order.pdf_url
            },
            'warning': warning_msg
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

        # --- Обработка даты/времени записи ---
        if 'appointment_datetime' in data:
            appointment_str = data['appointment_datetime']
            old_appointment = order.appointment_datetime   # текущее значение из БД

            if appointment_str:
                try:
                    new_dt = datetime.fromisoformat(appointment_str)
                except:
                    return jsonify({'error': 'Неверный формат даты/времени записи'}), 400

                # Проверки на прошлое, воскресенье и рабочие часы выполняем ТОЛЬКО если дата изменилась
                if old_appointment is None or new_dt != old_appointment:
                    if new_dt < datetime.now():
                        return jsonify({'error': 'Дата записи не может быть в прошлом'}), 400
                    if new_dt.weekday() == 6:
                        return jsonify({'error': 'Запись невозможна: воскресенье выходной.'}), 400
                    if new_dt.hour < 10 or new_dt.hour >= 20:
                        return jsonify({'error': 'Время записи должно быть с 10:00 до 20:00.'}), 400

                order.appointment_datetime = new_dt
            else:
                # Если прислали пустую строку или null — сбрасываем дату записи
                order.appointment_datetime = None

        # --- Статус ---
        if 'status' in data:
            new_status = data['status']
            status_changed = new_status != order.status
            order.status = new_status

            if new_status == 'Выполнен' and not order.completed_date:
                order.completed_date = datetime.now()
                pdf_path = save_order_pdf(order_id, 'itogoviy_zakaznaryad.html', 'final')
                if pdf_path:
                    order.pdf_url = f'/api/orders/{order_id}/pdf/final'

                if order.client and order.client.vk_user_id:
                    _vk_user_id = order.client.vk_user_id
                    _order_id = order_id
                    _pdf_final = pdf_path
                    app = current_app._get_current_object()
                    def _send_pdf(app, vk_user_id, order_id, pdf_final):
                        with app.app_context():
                            from routes.vk.vk_notify import send_pdfs_to_client
                            send_pdfs_to_client(vk_user_id, order_id, pdf_final)
                    threading.Thread(
                        target=_send_pdf,
                        args=(app, _vk_user_id, _order_id, _pdf_final),
                        daemon=True
                    ).start()

            if status_changed and order.client and order.client.vk_user_id:
                notify_status_change(order.client.vk_user_id, order_id, new_status)

        # --- Описание ---
        if 'problem_description' in data:
            order.problem_description = data['problem_description']
        if 'work_description' in data:
            order.work_description = data['work_description']

        # --- Стоимость ---
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

        # --- Оценка времени ---
        if 'estimated_hours' in data:
            raw = data['estimated_hours']
            if raw in (None, ''):
                order.estimated_hours = None
            else:
                try:
                    est = float(raw)
                    if est < 0:
                        return jsonify({'error': 'Оценка времени не может быть отрицательной'}), 400
                    order.estimated_hours = est
                except (ValueError, TypeError):
                    return jsonify({'error': 'Некорректное значение estimated_hours'}), 400

        # --- Механик ---
        if 'mechanic_id' in data:
            mechanic_id = data['mechanic_id']
            if not mechanic_id and order.status not in ['Выполнен', 'Отменен']:
                return jsonify({'error': 'Нельзя убрать механика у активного заказа.'}), 400

            if mechanic_id:
                try:
                    mechanic_id = int(mechanic_id)
                    mechanic = User.query.join(Role).filter(
                        User.user_id == mechanic_id, Role.role_name == 'mechanic').first()
                    if not mechanic:
                        order.mechanic_id = None
                    else:
                        order.mechanic_id = mechanic_id
                except (ValueError, TypeError):
                    return jsonify({'error': 'Некорректный ID механика.'}), 400
            else:
                order.mechanic_id = None

        # ========== ИТОГОВАЯ ПРОВЕРКА ДОСТУПНОСТИ МЕХАНИКА ==========
        if order.status not in NON_BUSY_STATUSES:
            if not order.mechanic_id:
                db.session.rollback()
                return jsonify({'error': 'Механик обязателен для активного заказа.'}), 400

            # --- Запрет нескольких активных заказов (кроме брони) ---
            if order.status != 'Забронирован':
                truly_active_statuses = ['Создан', 'На диагностике', 'В работе']  # 'Готов к выдаче' НЕ блокирует
                other_active = WorkOrder.query.filter(
                    WorkOrder.mechanic_id == order.mechanic_id,
                    WorkOrder.status.in_(truly_active_statuses),
                    WorkOrder.order_id != order_id
                ).first()
                if other_active:
                    db.session.rollback()
                    return jsonify({
                        'error': 'У механика уже есть другой активный заказ (не бронь). Можно перевести только в «Забронирован».'
                    }), 409

            is_available, error_msg = check_mechanic_availability(
                order.mechanic_id,
                order.appointment_datetime,
                order.estimated_hours,
                exclude_order_id=order_id
            )
            if not is_available:
                db.session.rollback()
                return jsonify({'error': error_msg, 'busy_mechanic': True}), 409

        db.session.commit()

        # --- Предупреждение при необходимости ---
        warning_msg = None
        if order.mechanic_id and order.appointment_datetime:
            warning_msg = get_indefinite_warning(
                order.mechanic_id, order.appointment_datetime, order.estimated_hours,
                exclude_order_id=order_id
            )

        return jsonify({
            'message': 'Заказ обновлен',
            'order': {
                'order_id': order.order_id,
                'status': order.status,
                'mechanic_id': order.mechanic_id,
                'pdf_url': order.pdf_url
            },
            'warning': warning_msg
        })
    except Exception as e:
        db.session.rollback()
        print(f"❌ Ошибка в update_order: {e}")
        return jsonify({'error': str(e)}), 500
    
def delete_order(order_id):
    try:
        order = WorkOrder.query.get_or_404(order_id)
        # Удаляем все фото, связанные с этим заказом
        OrderPhoto.query.filter_by(order_id=order_id).delete()
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

        pdf_path = save_order_pdf(order_id, 'itogoviy_zakaznaryad.html', 'final')
        if pdf_path:
            order.pdf_url = f'/api/orders/{order_id}/pdf/final'

        db.session.commit()

        # Отправка PDF и уведомления в ВК
        if order.client and order.client.vk_user_id:
            _vk_user_id = order.client.vk_user_id
            _order_id = order_id
            _pdf_final = pdf_path
            app = current_app._get_current_object()

            def _send_pdf(app, vk_user_id, order_id, pdf_final):
                with app.app_context():
                    from routes.vk.vk_notify import send_pdfs_to_client, notify_status_change
                    notify_status_change(vk_user_id, order_id, 'Выполнен')
                    if pdf_final:
                        send_pdfs_to_client(vk_user_id, order_id, pdf_final)

            threading.Thread(
                target=_send_pdf,
                args=(app, _vk_user_id, _order_id, _pdf_final),
                daemon=True
            ).start()

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
    mechanic = User.query.get(order.mechanic_id) if order.mechanic_id else None

    problem_text = ''
    if order.problem_description:
        for line in order.problem_description.splitlines():
            line = line.strip()
            if line.startswith('VK ID'):
                parts = line.split(':', 1)
                if len(parts) == 2:
                    problem_text = parts[1].strip()
                break
        if not problem_text:
            problem_text = order.problem_description.strip()

    html = render_template('predv_zakaznaryad.html',
                           order=order, client=client, car=car,
                           manager=manager, mechanic=mechanic,
                           problem_text=problem_text)
    options = {'enable-local-file-access': True, 'page-size': 'A4'}
    pdf = pdfkit.from_string(html, False, options=options, configuration=PDFKIT_CONFIG)
    response = make_response(pdf)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'inline'
    return response

@orders_bp.route('/<int:order_id>/pdf/final')
def final_pdf(order_id):
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

def get_indefinite_warning(mechanic_id, appointment_dt, estimated_hours, exclude_order_id=None):
    """
    Возвращает предупреждающее сообщение, если:
    - новый заказ бессрочный (estimated_hours пуст/<=0)
    - и у механика есть будущий бессрочный заказ, начинающийся позже appointment_dt.
    """
    if estimated_hours and estimated_hours > 0:
        return None  # заказ с оценкой времени – не бессрочный
    if not appointment_dt:
        return None  # без даты – не к чему привязываться

    now = datetime.now()
    future_indefinite = WorkOrder.query.filter(
        WorkOrder.mechanic_id == mechanic_id,
        WorkOrder.status.in_(['Забронирован', 'Создан', 'На диагностике', 'В работе']),
        db.or_(WorkOrder.estimated_hours.is_(None), WorkOrder.estimated_hours <= 0),
        WorkOrder.appointment_datetime > now
    )
    if exclude_order_id:
        future_indefinite = future_indefinite.filter(WorkOrder.order_id != exclude_order_id)
    future_indefinite = future_indefinite.order_by(WorkOrder.appointment_datetime.asc()).first()

    if future_indefinite and future_indefinite.appointment_datetime > appointment_dt:
        return (f"Внимание: у механика уже есть бессрочная запись на "
                f"{future_indefinite.appointment_datetime.strftime('%d.%m.%Y %H:%M')} "
                f"(заказ #{future_indefinite.order_id}). "
                f"Текущий заказ необходимо завершить до этого времени.")
    return None

def add_working_hours(start, hours, rest_minutes=30):
    """
    Прибавляет к start указанное количество рабочих часов,
    пропуская нерабочие интервалы (ночь, воскресенье).
    Возвращает (конец_работы, конец_с_перерывом).
    """
    remaining_minutes = int(hours * 60)
    current = start

    while remaining_minutes > 0:
        # --- Воскресенье пропускаем ---
        if current.weekday() == 6:
            current += timedelta(days=1)
            current = current.replace(hour=10, minute=0, second=0, microsecond=0)
            continue

        day_start = current.replace(hour=10, minute=0, second=0, microsecond=0)
        day_end = day_start.replace(hour=20)

        # Если мы до начала рабочего дня, переводим на 10:00
        if current < day_start:
            current = day_start
        # Если мы после/в точности в 20:00, переходим на следующий рабочий день
        if current >= day_end:
            current = day_start + timedelta(days=1)
            continue

        # Сколько минут осталось работать сегодня
        minutes_left = (day_end - current).total_seconds() / 60.0

        if remaining_minutes <= minutes_left:
            # Работа завершается в этот же день
            work_end = current + timedelta(minutes=remaining_minutes)
            return work_end, work_end + timedelta(minutes=rest_minutes)
        else:
            # Используем весь сегодняшний день и переходим на следующий
            remaining_minutes -= minutes_left
            current = day_start + timedelta(days=1)  # завтра в 10:00

    # Защита от нулевого остатка (теоретически не должно срабатывать)
    return current, current + timedelta(minutes=rest_minutes)

REST_MINUTES = 30  # окно отдыха/уборки рабочего места после окончания работы

def build_interval(order, next_order_start=None):
    now = datetime.now()

    # --- старт ---
    if order.appointment_datetime:
        start = order.appointment_datetime
    else:
        start = order.created_date if order.created_date else now

    # --- конец ---
    if order.estimated_hours and order.estimated_hours > 0:
        # Используем рабочие часы
        work_end, real_end = add_working_hours(start, order.estimated_hours, REST_MINUTES)
        # Для проверки доступности важен реальный конец (с учётом перерыва)
        end = real_end
    else:
        # бессрочный заказ
        if next_order_start:
            end = next_order_start
        else:
            end = datetime(2100, 1, 1)
    return start, end

def intervals_overlap(a_start, a_end, b_start, b_end):
    return a_start < b_end and a_end > b_start

def check_mechanic_availability(mechanic_id, appointment_dt, estimated_hours, exclude_order_id=None):
    busy_statuses = ['Забронирован', 'Создан', 'На диагностике', 'В работе']
    now = datetime.now()

    # --- создаём "виртуальный" заказ ---
    class TempOrder:
        pass

    new_order = TempOrder()
    new_order.appointment_datetime = appointment_dt
    new_order.estimated_hours = estimated_hours
    new_order.created_date = datetime.now()   # для новых заказов без даты бронирования

    # --- получаем все активные заказы механика ---
    query = WorkOrder.query.filter(
        WorkOrder.mechanic_id == mechanic_id,
        WorkOrder.status.in_(busy_statuses)
    )

    if exclude_order_id:
        query = query.filter(WorkOrder.order_id != exclude_order_id)

    orders = query.order_by(WorkOrder.appointment_datetime.asc().nullsfirst()).all()

    # --- строим интервалы существующих заказов ---
    intervals = []

    for i, order in enumerate(orders):
        next_order = orders[i + 1] if i + 1 < len(orders) else None
        next_start = next_order.appointment_datetime if next_order else None

        start, end = build_interval(order, next_start)
        intervals.append((start, end, order.order_id))

    # --- определяем следующий заказ для нового ---
    next_start = None
    for o in orders:
        if o.appointment_datetime and appointment_dt and o.appointment_datetime > appointment_dt:
            next_start = o.appointment_datetime
            break

    # --- строим интервал нового заказа ---
    new_start, new_end = build_interval(new_order, next_start)

    # --- проверяем пересечения ---
    for start, end, order_id in intervals:
        if intervals_overlap(new_start, new_end, start, end):
            return False, f"Механик занят (пересечение с заказом #{order_id})"

    return True, None

# ---------------------------------------------------------------------------
# Загрузка фото механиком (оптимизированная, параллельная)
# ---------------------------------------------------------------------------

@orders_bp.route('/<int:order_id>/photos', methods=['POST'])
def upload_photo(order_id):
    """
    Принимает несколько фото от механика (до 10), сохраняет в Yandex Object Storage,
    записывает в order_photos и отправляет клиенту в VK одним сообщением-сеткой.
    Загрузка в S3 выполняется параллельно (до 5 файлов одновременно).
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    files = request.files.getlist('photos')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'Не переданы файлы photos'}), 400

    comment = request.form.get('comment', '').strip()
    mechanic_id = request.form.get('mechanic_id')

    if not mechanic_id:
        return jsonify({'error': 'mechanic_id обязателен'}), 400
    try:
        mechanic_id = int(mechanic_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Некорректный mechanic_id'}), 400

    order = WorkOrder.query.get(order_id)
    if not order:
        return jsonify({'error': f'Заказ #{order_id} не найден'}), 404

    files = files[:10]
    total_files = len(files)

    # ---------- Читаем все файлы в память ДО параллельной загрузки ----------
    # FileStorage объекты нельзя читать из нескольких потоков одновременно —
    # они все читают из одного HTTP-сокета. Сначала читаем в bytes, потом параллельно в S3.
    file_data = []  # list of (filename, bytes)
    for f in files:
        try:
            file_data.append((f.filename, f.read()))
        except Exception as e:
            file_data.append((f.filename, None))

    # ---------- Параллельная загрузка в S3 ----------
    def upload_one(filename, raw_bytes):
        if raw_bytes is None:
            return None, 'Не удалось прочитать файл'
        try:
            url = storage.upload_photo(io.BytesIO(raw_bytes), order_id, filename)
            return url, None
        except Exception as e:
            return None, str(e)

    # Массив для результатов (сохраняем порядок)
    results = [None] * total_files
    errors = []

    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_index = {executor.submit(upload_one, fname, raw): idx
                           for idx, (fname, raw) in enumerate(file_data)}
        for future in as_completed(future_to_index):
            idx = future_to_index[future]
            url, err = future.result()
            if err:
                errors.append(f"Фото {idx+1}: {err}")
            else:
                results[idx] = url

    # Сохраняем только успешно загруженные
    saved_photos = []
    presigned_urls = []
    for idx, url in enumerate(results):
        if url is not None:
            presigned_urls.append(url)
            photo = OrderPhoto(
                order_id=order_id,
                mechanic_id=mechanic_id,
                file_url=url,
                comment=comment or None,
            )
            db.session.add(photo)
            saved_photos.append(photo)

    if not saved_photos:
        db.session.rollback()
        return jsonify({'error': 'Не удалось загрузить ни одного фото', 'details': errors}), 500

    db.session.commit()

    # ---------- Отправка в VK (фон) ----------
    if order.client and order.client.vk_user_id:
        order_info = {}
        if order.car:
            order_info['car_model'] = order.car.model or ''
            order_info['car_gos_number'] = order.car.gos_number or ''
        mechanic = User.query.get(mechanic_id)
        if mechanic:
            order_info['mechanic_name'] = mechanic.full_name

        app = current_app._get_current_object()
        vk_kwargs = dict(
            vk_user_id=order.client.vk_user_id,
            order_id=order_id,
            photo_urls=presigned_urls,
            comment=comment,
            order_info=order_info,
        )
        def _send_vk_photos(app, kwargs):
            with app.app_context():
                send_photos_to_client(**kwargs)

        threading.Thread(target=_send_vk_photos, args=(app, vk_kwargs), daemon=True).start()

    response_data = {
        'message': f'Загружено {len(saved_photos)} фото',
        'photos': [p.to_dict() for p in saved_photos],
    }
    if errors:
        response_data['warnings'] = errors
    return jsonify(response_data), 201

def notify_client_status_change(order: WorkOrder, new_status: str) -> None:
    """Вызывается после изменения статуса заказа — отправляет уведомление клиенту в VK."""
    if order.client and order.client.vk_user_id:
        notify_status_change(
            order.client.vk_user_id, order.order_id, new_status
        )