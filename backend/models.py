from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from crypto import encrypt_data, decrypt_data, hash_phone

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
    _full_name = db.Column('full_name', db.String(255), nullable=False)  # шифрованное
    login = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    _phone = db.Column('phone', db.String(255))                         # шифрованное, длина увеличена под base64
    phone_hash = db.Column(db.String(64), unique=True, nullable=True)   # хэш для поиска
    role_id = db.Column(db.Integer, db.ForeignKey('roles.role_id'), nullable=False)

    # Отношение к роли
    role = db.relationship('Role', backref='users', lazy=True)

    # ------- шифрованные свойства -------
    @property
    def full_name(self):
        return decrypt_data(self._full_name)

    @full_name.setter
    def full_name(self, value):
        self._full_name = encrypt_data(value)

    @property
    def phone(self):
        return decrypt_data(self._phone)

    @phone.setter
    def phone(self, value):
        self._phone = encrypt_data(value)
        self.phone_hash = hash_phone(value)  # автоматически обновляем хэш

    # ------- роль как строка -------
    @property
    def role_name(self):
        return self.role.role_name if self.role else None

    @role_name.setter
    def role_name(self, value):
        if value:
            r = Role.query.filter_by(role_name=value).first()
            if not r:
                raise ValueError(f"Role '{value}' does not exist")
            self.role_id = r.role_id

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
            'full_name': self.full_name,   # расшифрованное
            'login': self.login,
            'role': self.role_name,
            'phone': self.phone,           # расшифрованное
        }


class Client(db.Model):
    __tablename__ = 'clients'

    client_id = db.Column(db.Integer, primary_key=True)
    _name = db.Column('name', db.String(255), nullable=True)          # было nullable=False
    _phone = db.Column('phone', db.String(255), nullable=True)        # было nullable=False
    phone_hash = db.Column(db.String(64), unique=True, nullable=True) # было nullable=False
    vk_user_id = db.Column(db.BigInteger)
    date_reg = db.Column(db.DateTime, nullable=False, default=datetime.now)
    accepted_rules = db.Column(db.DateTime, nullable=True)            # уже было True
    declined_rules = db.Column(db.DateTime(timezone=True), nullable=True)

    # ------- шифрованные свойства -------
    @property
    def name(self):
        return decrypt_data(self._name) if self._name else None

    @name.setter
    def name(self, value):
        if value is None:
            self._name = None
        else:
            self._name = encrypt_data(value)

    @property
    def phone(self):
        return decrypt_data(self._phone) if self._phone else None

    @phone.setter
    def phone(self, value):
        if value is None:
            self._phone = None
            self.phone_hash = None
        else:
            self._phone = encrypt_data(value)
            self.phone_hash = hash_phone(value)

    # Отношения
    cars = db.relationship('Car', backref='client', lazy=True)
    orders = db.relationship('WorkOrder', backref='client', lazy=True)

    def to_dict(self):
        return {
            'client_id': self.client_id,
            'name': self.name,          # расшифрованное
            'phone': self.phone,        # расшифрованное
            'vk_user_id': str(self.vk_user_id) if self.vk_user_id else None,
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
    car_id = db.Column(db.Integer, db.ForeignKey('cars.car_id', ondelete='CASCADE'), nullable=True)
    manager_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='SET NULL'))
    mechanic_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='SET NULL'))
    status = db.Column(db.String(30), nullable=False, default='Создан')
    problem_description = db.Column(db.Text)
    work_description = db.Column(db.Text)
    total_price = db.Column(db.Numeric(10, 2))
    created_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    completed_date = db.Column(db.DateTime)
    pdf_url = db.Column(db.String(500))
    appointment_datetime = db.Column(db.DateTime, nullable=True)
    estimated_hours = db.Column(db.Float, nullable=True)

    # Отношения к пользователям (менеджер и механик)
    manager = db.relationship('User', foreign_keys=[manager_id], backref='managed_orders')
    mechanic = db.relationship('User', foreign_keys=[mechanic_id], backref='assigned_orders')
    
    # Каскадное удаление фотографий при удалении заказа
    photos = db.relationship('OrderPhoto', backref='order', cascade='all, delete-orphan')

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
            'pdf_url': self.pdf_url,
            'appointment_datetime': self.appointment_datetime.isoformat() if self.appointment_datetime else None,
            'estimated_hours': self.estimated_hours,
        }


class OrderPhoto(db.Model):
    __tablename__ = 'order_photos'

    photo_id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('work_orders.order_id', ondelete='CASCADE'), nullable=False)
    mechanic_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='SET NULL'))
    file_url = db.Column(db.String(500), nullable=False)
    comment = db.Column(db.Text)
    uploaded_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Отношения (связь с WorkOrder уже определена через WorkOrder.photos, поэтому здесь не дублируем)
    mechanic = db.relationship('User', foreign_keys=[mechanic_id], backref='uploaded_photos')
    # Строка order = db.relationship(...) удалена, так как она перенесена в WorkOrder

    def to_dict(self):
        return {
            'photo_id': self.photo_id,
            'order_id': self.order_id,
            'mechanic_id': self.mechanic_id,
            'file_url': self.file_url,
            'comment': self.comment,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None
        }