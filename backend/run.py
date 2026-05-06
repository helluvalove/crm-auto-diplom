import sys
import os
import threading
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db, User
from werkzeug.security import generate_password_hash

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        try:
            # Простая проверка подключения к БД
            db.session.execute(text('SELECT 1'))
            print("✅ Подключение к БД успешно")
            
            # Проверяем есть ли базовые пользователи
            admin_user = User.query.filter_by(login='admin').first()
            mechanic_user = User.query.filter_by(login='mechanic').first()
            
            # Создаем админа если нет
            if not admin_user:
                admin = User(
                    login='admin',
                    full_name='Администратор системы',
                    role_name='manager'
                )
                admin.password_hash = generate_password_hash('admin123')
                db.session.add(admin)
                print("✅ Создан администратор: admin / admin123")
            
            # Создаем механика если нет
            if not mechanic_user:
                mechanic = User(
                    login='mechanic',
                    full_name='Петров Алексей Иванович',
                    role_name='mechanic',
                    phone='+79991234567'
                )
                mechanic.password_hash = generate_password_hash('mechanic123')
                db.session.add(mechanic)
                print("✅ Создан механик: mechanic / mechanic123")
            
            if not admin_user or not mechanic_user:
                db.session.commit()
            
        except Exception as e:
            print(f"❌ Ошибка подключения к БД: {e}")
            exit(1)
    
    print("\n" + "=" * 60)
    print("🚀 CRM Система Автомастерской запущена!")
    print("=" * 60)
    print("🌐 ВЕБ-ИНТЕРФЕЙС:  http://localhost:5000/")
    print("📱 МОБИЛЬНЫЙ:     http://192.168.0.104:5000/")
    print("🔧 API ДОКУМЕНТАЦИЯ: http://localhost:5000/api")
    print("=" * 60)
    print("\nДля остановки сервера нажмите Ctrl+C\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)