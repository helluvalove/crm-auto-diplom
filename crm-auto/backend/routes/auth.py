from flask import Blueprint, request, jsonify
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
        
        # Создаем JWT токен
        from app import create_app
        app = create_app()
        
        token = jwt.encode({
            'user_id': user.user_id,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            'token': token,
            'user': user.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500