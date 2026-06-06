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

def kb_inline_my_cars(cars):
    """Клавиатура для экрана 'Мои авто': кнопка «Добавить авто» и кнопки удаления для каждого авто."""
    buttons = [
        [
            {
                "action": {
                    "type": "callback",
                    "label": "➕ Добавить авто",
                    "payload": "{\"command\":\"add_car\"}"
                },
                "color": "positive"
            }
        ]
    ]
    for car in cars:
        model = car.model or 'без модели'
        gos = car.gos_number or ''
        label = f"🗑 {model} ({gos})" if gos else f"🗑 {model}"
        buttons.append([
            {
                "action": {
                    "type": "callback",
                    "label": label,
                    "payload": json.dumps({
                        "command": "delete_car",
                        "car_id": car.car_id
                    })
                },
                "color": "negative"
            }
        ])
    return json.dumps({
        "inline": True,
        "buttons": buttons
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

def kb_inline_cancel_process():
    """Inline-кнопка возврата в главное меню (серая)."""
    return json.dumps({
        "inline": True,
        "buttons": [
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Назад в меню",
                        "payload": "{\"command\":\"cancel_process\"}"
                    },
                    "color": "secondary"
                }
            ]
        ]
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

def kb_inline_skip_or_cancel():
    """Кнопки: Пропустить шаг и Назад в меню."""
    return json.dumps({
        "inline": True,
        "buttons": [
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Пропустить",
                        "payload": "{\"command\":\"skip_datetime\"}"
                    },
                    "color": "secondary"
                }
            ],
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Назад в меню",
                        "payload": "{\"command\":\"cancel_process\"}"
                    },
                    "color": "negative"
                }
            ]
        ]
    })

def kb_inline_profile_actions():
    """Кнопки в профиле: Отозвать согласие и Назад в меню."""
    return json.dumps({
        "inline": True,
        "buttons": [
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Отозвать согласие",
                        "payload": "{\"command\":\"revoke_consent\"}"
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

def kb_inline_skip_problem():
    """Кнопки: Пропустить описание проблемы и Назад в меню."""
    return json.dumps({
        "inline": True,
        "buttons": [
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Пропустить",
                        "payload": "{\"command\":\"skip_problem\"}"
                    },
                    "color": "secondary"
                }
            ],
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Назад в меню",
                        "payload": "{\"command\":\"cancel_process\"}"
                    },
                    "color": "negative"
                }
            ]
        ]
    })


def kb_inline_skip_vin():
    """Кнопки: Пропустить VIN и Назад в меню."""
    return json.dumps({
        "inline": True,
        "buttons": [
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Пропустить",
                        "payload": "{\"command\":\"skip_vin\"}"
                    },
                    "color": "secondary"
                }
            ],
            [
                {
                    "action": {
                        "type": "callback",
                        "label": "Назад в меню",
                        "payload": "{\"command\":\"cancel_process\"}"
                    },
                    "color": "negative"
                }
            ]
        ]
    })