from .services import get_or_create_client, has_accepted_rules
from .utils import send_message
from .keyboards import kb_accept_rules

def require_rules(handler):
    def wrapper(user_id, text):
        client = get_or_create_client(user_id)
        text = text.strip().lower()

        if not has_accepted_rules(client):
            if text == "принять":
                return handler(user_id, text, client)

            # Правила не приняты – показываем сообщение с кнопкой
            send_message(
                user_id,
                "📄 Перед началом работы необходимо принять соглашение "
                "об обработке персональных данных в соответствии с федеральным законом РФ №152-ФЗ 'О персональных данных' :\n"
                "http://crm-auto43.ru/privacy\n\n"
                "Нажмите кнопку «Принять», чтобы продолжить.",
                keyboard=kb_accept_rules()
            )
            return

        # Правила уже приняты – передаём управление
        return handler(user_id, text, client)

    return wrapper