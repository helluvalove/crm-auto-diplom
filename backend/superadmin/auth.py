import os
import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify

def check_superadmin_credentials(login, password):
    return (
        login == os.environ.get('SUPERADMIN_LOGIN') and
        password == os.environ.get('SUPERADMIN_PASSWORD')
    )

def create_superadmin_token():
    secret = os.environ.get('SUPERADMIN_JWT_SECRET')
    return jwt.encode({
        'is_superuser': True,
        'exp': datetime.now() + timedelta(hours=8)
    }, secret, algorithm='HS256')

def require_superadmin(f):
    """Декоратор — вешаем на маршруты, которые только для суперадмина"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No token'}), 401
        try:
            secret = os.environ.get('SUPERADMIN_JWT_SECRET')
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            if not payload.get('is_superuser'):
                return jsonify({'error': 'Forbidden'}), 403
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except Exception:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated