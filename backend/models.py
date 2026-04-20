from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# ============================================================
# Вспомогательные функции для совместимости со старой схемой
# ============================================================

class Role(db.Model):
    __tablename__ = 'roles'

    role_id = db.Column(db.Integer, primary_key=True)
    role_name = db.Column(db.String(20), unique=True, nullable=False)

    def __repr__(self):
        return f'<Role {self.role_name}>'


class User(db.Model):
    __tablename__ = 'users'

    user_id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(255), nullable=False)
    login = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20))
    specialization = db.Column(db.Text)                     # было db.String(100), теперь TEXT
    role_id = db.Column(db.Integer, db.ForeignKey('roles.role_id'), nullable=False)
    # Поле tabel_number удалено (в новой схеме отсутствует)

    # Отношение к роли
    role = db.relationship('Role', backref='users', lazy=True)

    # Свойство для обратной совместимости (role как строка)
    @property
    def role_name(self):
        return self.role.role_name if self.role else None

    @role_name.setter
    def role_name(self, value):
        # При установке строки ищем соответствующую роль
        if value:
            r = Role.query.filter_by(role_name=value).first()
            if not r:
                raise ValueError(f"Role '{value}' does not exist")
            self.role_id = r.role_id

    # Для совместимости со старым кодом, где использовалось self.role (строка)
    # Можно оставить как свойство, но осторожно: теперь self.role – объект.
    # Лучше использовать role_name, а в коде заменить обращения.

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        try:
            if check_password_hash(self.password_hash, password):
                return True
        except:
            pass
        return self.password_hash == password

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'full_name': self.full_name,
            'login': self.login,
            'role': self.role_name,          # возвращаем строку роли
            'phone': self.phone,
            'specialization': self.specialization,
            # 'employee_number': ...         # удалено
        }


class Client(db.Model):
    __tablename__ = 'clients'

    client_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20), nullable=False, unique=True)
    vk_user_id = db.Column(db.BigInteger)            # новое поле вместо telegram_chat_id
    date_reg = db.Column(db.DateTime, nullable=False, default=datetime.now)
    accepted_rules = db.Column(db.DateTime)

    # Свойство для обратной совместимости: telegram_chat_id -> vk_user_id
    @property
    def telegram_chat_id(self):
        return self.vk_user_id

    @telegram_chat_id.setter
    def telegram_chat_id(self, value):
        self.vk_user_id = value

    # Отношения
    cars = db.relationship('Car', backref='client', lazy=True)
    orders = db.relationship('WorkOrder', backref='client', lazy=True)

    def to_dict(self):
        return {
            'client_id': self.client_id,
            'name': self.name,
            'phone': self.phone,
            'telegram_chat_id': str(self.telegram_chat_id) if self.telegram_chat_id else None,
            'date_reg': self.date_reg.isoformat() if self.date_reg else None,
            'accepted_rules': self.accepted_rules.isoformat() if self.accepted_rules else None
        }

    def get_car_count(self):
        try:
            return len(self.cars)
        except:
            return 0


class Car(db.Model):
    __tablename__ = 'cars'

    car_id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.client_id', ondelete='CASCADE'), nullable=False)
    model = db.Column(db.String(100))
    vin = db.Column(db.String(17))
    gos_number = db.Column(db.String(9))      # длина ограничена 9 (было 20)
    year = db.Column(db.Integer)
    mileage = db.Column(db.Integer)

    # Отношения
    orders = db.relationship('WorkOrder', backref='car', lazy=True)

    def to_dict(self):
        return {
            'car_id': self.car_id,
            'client_id': self.client_id,
            'model': self.model,
            'vin': self.vin,
            'gos_number': self.gos_number,
            'year': self.year,
            'mileage': self.mileage
        }


class WorkOrder(db.Model):
    __tablename__ = 'work_orders'

    order_id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.client_id', ondelete='CASCADE'), nullable=False)
    car_id = db.Column(db.Integer, db.ForeignKey('cars.car_id', ondelete='CASCADE'), nullable=False)
    manager_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='SET NULL'))
    mechanic_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='SET NULL'))
    status = db.Column(db.String(30), nullable=False, default='Создан')   # длина уменьшена до 30
    problem_description = db.Column(db.Text)
    work_description = db.Column(db.Text)
    total_price = db.Column(db.Numeric(10, 2))
    created_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    completed_date = db.Column(db.DateTime)
    pdf_url = db.Column(db.String(500))      # новое поле

    # Отношения к пользователям (менеджер и механик)
    manager = db.relationship('User', foreign_keys=[manager_id], backref='managed_orders')
    mechanic = db.relationship('User', foreign_keys=[mechanic_id], backref='assigned_orders')

    def to_dict(self):
        return {
            'order_id': self.order_id,
            'client_id': self.client_id,
            'car_id': self.car_id,
            'manager_id': self.manager_id,
            'mechanic_id': self.mechanic_id,
            'status': self.status,
            'problem_description': self.problem_description,
            'work_description': self.work_description,
            'total_price': float(self.total_price) if self.total_price else None,
            'created_date': self.created_date.isoformat() if self.created_date else None,
            'completed_date': self.completed_date.isoformat() if self.completed_date else None,
            'pdf_url': self.pdf_url
        }


class OrderPhoto(db.Model):
    __tablename__ = 'order_photos'

    photo_id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('work_orders.order_id', ondelete='CASCADE'), nullable=False)
    mechanic_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='SET NULL'))
    file_url = db.Column(db.String(500), nullable=False)
    comment = db.Column(db.Text)
    uploaded_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Отношения
    order = db.relationship('WorkOrder', backref='photos')
    mechanic = db.relationship('User', foreign_keys=[mechanic_id], backref='uploaded_photos')

    def to_dict(self):
        return {
            'photo_id': self.photo_id,
            'order_id': self.order_id,
            'mechanic_id': self.mechanic_id,
            'file_url': self.file_url,
            'comment': self.comment,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None
        }