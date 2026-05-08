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
                }
            ],
            [
                {
                    "action": {
                        "type": "text",
                        "label": "Статус"
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