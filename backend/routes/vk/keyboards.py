import json


def kb_inline_accept_decline():
    return json.dumps({
        "inline": True,
        "buttons": [
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Принять",
                        "payload": "{\"command\":\"accept_rules\"}"
                    },
                    "color": "positive"
                },
                {
                    "action": {
                        "type": "callback",
                        "label": "Отклонить",
                        "payload": "{\"command\":\"decline_rules\"}"
                    },
                    "color": "negative"
                }
            ]
        ]
    })


def kb_main_menu():
    return json.dumps({
        "one_time": False,
        "buttons": [
            [
                {
                    "action": {
                        "type": "text",
                        "label": "Запись"
                    },
                    "color": "positive"
                },
                {
                    "action": {
                        "type": "text",
                        "label": "Мои заявки"
                    },
                    "color": "primary"
                }
            ],
            [
                {
                    "action": {
                        "type": "text",
                        "label": "Мои авто"
                    },
                    "color": "primary"
                },
                {
                    "action": {
                        "type": "text",
                        "label": "Профиль"
                    },
                    "color": "secondary"
                }
            ],
            [
                {
                    "action": {
                        "type": "text",
                        "label": "Помощь"
                    },
                    "color": "primary"
                }
            ]
        ]
    })


def kb_empty():
    return json.dumps({
        "buttons": []
    })


def kb_inline_add_car():
    """Inline-кнопка «Добавить авто» для экранов с машинами."""
    return json.dumps({
        "inline": True,
        "buttons": [
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Добавить авто",
                        "payload": "{\"command\":\"add_car\"}"
                    },
                    "color": "positive"
                }
            ]
        ]
    })

def kb_inline_cancel_and_new(order_id, car_id):
    """Кнопки: 'Отменить заявку и продолжить', 'Назад в меню'."""
    return json.dumps({
        "inline": True,
        "buttons": [
            [
                {
                    "action": {
                        "type": "callback",
                        "label": f"Отменить заявку №{order_id} и продолжить",
                        "payload": json.dumps({
                            "command": "cancel_and_create_new",
                            "order_id": order_id,
                            "car_id": car_id
                        })
                    },
                    "color": "negative"
                }
            ],
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Назад в меню",
                        "payload": "{\"command\":\"to_menu\"}"
                    },
                    "color": "secondary"
                }
            ]
        ]
    })


def kb_inline_cancel_orders(orders):
    """Генерирует клавиатуру с кнопками отмены для переданных заявок (ожидается список объектов WorkOrder)."""
    buttons = []
    for order in orders:
        buttons.append([
            {
                "action": {
                    "type": "callback",
                    "label": f"Отменить заявку №{order.order_id}",
                    "payload": json.dumps({
                        "command": "cancel_order",
                        "order_id": order.order_id
                    })
                },
                "color": "negative"
            }
        ])
    return json.dumps({
        "inline": True,
        "buttons": buttons
    })


def kb_inline_back_to_menu():
    """Просто кнопка 'Назад в меню'."""
    return json.dumps({
        "inline": True,
        "buttons": [
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Назад в меню",
                        "payload": "{\"command\":\"to_menu\"}"
                    },
                    "color": "secondary"
                }
            ]
        ]
    })