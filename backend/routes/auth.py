from flask import Blueprint, request, jsonify, current_app
from models import db, User
from datetime import datetime, timedelta
import jwt

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data.get('login') or not data.get('password'):
            return jsonify({'error': 'Требуется логин и пароль'}), 400
        
        user = User.query.filter_by(login=data['login']).first()
        
        if not user or not user.check_password(data['password']):
            return jsonify({'error': 'Неверный логин или пароль'}), 401
        
        # Создаем JWT токен с ролью пользователя
        token = jwt.encode({
            'user_id': user.user_id,
            'role': user.role_name, 
            'exp': datetime.now() + timedelta(hours=24)
        }, current_app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            'token': token,
            'user': user.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500