from .services import accept_rules
from .utils import send_message
from .keyboards import kb_main_menu

def handle_accept(user_id, client):
    accept_rules(client)
    send_message(
        user_id,
        "✅ Спасибо! Теперь вы можете пользоваться ботом.\n"
        "Выберите действие в меню.",
        keyboard=kb_main_menu()
    )