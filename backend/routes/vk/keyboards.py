import json

def kb_accept_rules():
    """Кнопка для принятия ПД (показывается только до принятия)"""
    return json.dumps({
        "one_time": False,
        "buttons": [
            [{
                "action": {
                    "type": "text",
                    "label": "Принять"
                },
                "color": "positive"
            }]
        ]
    })

def kb_main_menu():
    """Основное меню после принятия ПД"""
    return json.dumps({
        "one_time": False,
        "buttons": [
            [{
                "action": {
                    "type": "text",
                    "label": "Запись"
                },
                "color": "positive"
            }],
            [{
                "action": {
                    "type": "text",
                    "label": "Статус"
                },
                "color": "secondary"
            }],
            [{
                "action": {
                    "type": "text",
                    "label": "Помощь"
                },
                "color": "primary"
            }]
        ]
    })

def kb_empty():
    """Пустая клавиатура (убирает текущую)"""
    return json.dumps({"buttons": []})