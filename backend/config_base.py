import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv() 

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("Переменная окружения SECRET_KEY не установлена. Проверьте .env файл.")
    
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    if not SQLALCHEMY_DATABASE_URI:
        raise ValueError("Переменная окружения DATABASE_URL не установлена.")
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', 'change-me-in-production-32bytes!')