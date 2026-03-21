from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    user_id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    login = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # manager, mechanic
    phone = db.Column(db.String(20))
    specialization = db.Column(db.String(100))
    employee_number = db.Column('tabel_number', db.String(50))
    
    def set_password(self, password):
        """Установить хешированный пароль"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Проверить пароль - работает с любым форматом"""
        # Пробуем как хешированный пароль
        try:
            if check_password_hash(self.password_hash, password):
                return True
        except:
            pass
        
        # Пробуем как обычный текст
        return self.password_hash == password
    
    def to_dict(self):
        return {
            'user_id': self.user_id,
            'full_name': self.full_name,
            'login': self.login,
            'role': self.role,
            'phone': self.phone,
            'specialization': self.specialization,
            'employee_number': self.employee_number,
        }

class Client(db.Model):
    __tablename__ = 'clients'
    
    client_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    telegram_chat_id = db.Column(db.BigInteger)
    
    # Отношения
    cars = db.relationship('Car', backref='client', lazy=True)
    orders = db.relationship('WorkOrder', backref='client', lazy=True)
    
    def to_dict(self):
        return {
            'client_id': self.client_id,
            'name': self.name,
            'phone': self.phone,
            'telegram_chat_id': str(self.telegram_chat_id) if self.telegram_chat_id else None,
            # Убираем car_count, будем считать на фронте или отдельным запросом
        }
    
    def get_car_count(self):
        """Получить количество автомобилей клиента"""
        try:
            return len(self.cars) if self.cars else 0
        except:
            return 0
    
class Car(db.Model):
    __tablename__ = 'cars'
    
    car_id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.client_id'), nullable=False)
    model = db.Column(db.String(100))
    vin = db.Column(db.String(17))
    gos_number = db.Column(db.String(20))
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
    client_id = db.Column(db.Integer, db.ForeignKey('clients.client_id'), nullable=False)
    car_id = db.Column(db.Integer, db.ForeignKey('cars.car_id'), nullable=False)
    manager_id = db.Column(db.Integer, db.ForeignKey('users.user_id'))
    mechanic_id = db.Column(db.Integer, db.ForeignKey('users.user_id'))
    status = db.Column(db.String(50), default='Создан')
    problem_description = db.Column(db.Text)
    work_description = db.Column(db.Text)
    total_price = db.Column(db.Numeric(10, 2))
    created_date = db.Column(db.DateTime, default=datetime.now)
    completed_date = db.Column(db.DateTime)
    
    # Отношения (уже есть через backref в Client и Car)
    
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
            'completed_date': self.completed_date.isoformat() if self.completed_date else None
        }