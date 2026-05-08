from .services import get_or_create_client, has_accepted_rules
from .utils import send_message
from .keyboards import kb_inline_accept_decline


def require_rules(handler):
    def wrapper(user_id, text, client=None):
        client = get_or_create_client(user_id)

        # Если уже принял — передаём управление дальше
        if has_accepted_rules(client):
            return handler(user_id, text, client)

        # Правила не приняты: смотрим, был ли отказ ранее
        if client.declined_rules is not None:
            send_message(
                user_id,
                "❌ Вы ранее отказались от соглашения об обработке персональных данных.\n\n"
                "Для продолжения работы с ботом необходимо принять условия.\n"
                "Ознакомьтесь с подробной информацией о политике персональных данных: http://crm-auto43.ru/privacy\n\n"
                "Нажмите кнопку «Принять» под этим сообщением.",
                keyboard=kb_inline_accept_decline()
            )
        else:
            send_message(
                user_id,
                "📄 Перед началом работы необходимо принять соглашение "
                "об обработке персональных данных в соответствии с федеральным законом РФ №152-ФЗ 'О персональных данных' :\n"
                "http://crm-auto43.ru/privacy\n\n"
                "Нажмите кнопку под сообщением.",
                keyboard=kb_inline_accept_decline()
            )
        return

    return wrapper