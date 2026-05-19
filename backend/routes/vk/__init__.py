from flask import Blueprint

vk_bp = Blueprint('vk', __name__, url_prefix='/vk')

from . import vk_bot
from . import vk_notify