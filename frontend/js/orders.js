// ==================== ЗАКАЗЫ ====================

async function updateOrder(orderId) {
    const clientId = document.getElementById('editOrderClientSelect').value;
    const status = document.getElementById('editOrderStatus').value;
    const problem = document.getElementById('editOrderProblem').value.trim();
    
    if (!clientId || !problem) {
        showError('Заполните обязательные поля');
        return;
    }

    // --- 1. Проверка максимальной суммы ---
    const priceInput = document.getElementById('editOrderPrice');
    const priceVal = parseFloat(priceInput.value);
    if (!isNaN(priceVal) && priceVal > 99999999.99) {
        showError('Сумма превышает максимально допустимую (99 999 999,99 ₽)');
        return;
    }
    
    // --- 2. Валидация даты и времени записи ---
    const appointmentInput = document.getElementById('editOrderAppointment');
    const appointmentDatetime = appointmentInput?.value || null;

    if (appointmentDatetime) {
        const d = new Date(appointmentDatetime);
        // Проверка на валидность даты
        if (isNaN(d.getTime())) {
            showError('Некорректная дата и время. Укажите существующую дату.');
            return;
        }
        // Год в разумных пределах (чтобы не было "date value out of range")
        const year = d.getFullYear();
        if (year < 2020 || year > 2100) {
            showError('Год даты должен быть в диапазоне от 2020 до 2100');
            return;
        }
        // Рабочие часы: с 10:00 до 19:30
        const hours = d.getHours();
        const minutes = d.getMinutes();
        if (hours < 10 || hours > 19 || (hours === 19 && minutes > 30)) {
            showError('Рабочие часы: с 10:00 до 19:30. Выберите другое время.');
            return;
        }
        // Воскресенье — выходной
        if (d.getDay() === 0) {
            showError('Воскресенье — выходной, запись невозможна.');
            return;
        }
    }

    // --- 3. Валидация примерного времени (estimated_hours) ---
    const estimatedHoursInput = document.getElementById('editOrderEstimatedHours');
    let estimatedHours = null;
    if (estimatedHoursInput) {
        const raw = estimatedHoursInput.value.trim();
        if (raw !== '') {
            const parsed = parseFloat(raw);
            if (isNaN(parsed) || parsed < 0 || parsed > 24) {
                showError('Примерное время должно быть числом от 0 до 24');
                return;
            }
            estimatedHours = parsed;
        }
    }

    // --- 4. Подготовка данных для отправки ---
    // Сериализуем таблицу позиций в поле work_description
    if (typeof serializeLineItemsToWork === 'function') serializeLineItemsToWork();

    const orderData = {
        client_id: parseInt(clientId),
        status: status,
        problem_description: problem,
        work_description: document.getElementById('editOrderWork').value.trim() || null,
        mechanic_id: document.getElementById('editOrderMechanicSelect').value || null,
        total_price: priceInput.value || null,
        appointment_datetime: appointmentDatetime,
        estimated_hours: estimatedHours
    };

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            const data = await response.json();
            showSuccess('Заказ-наряд обновлен!');

            if (data.warning) {
                setTimeout(() => showInfo(data.warning), 300);
            }

            const modal = bootstrap.Modal.getInstance(document.getElementById('editOrderModal'));
            modal.hide();
            loadOrders('active');

        } else {
            const errorData = await response.json();
            if (errorData.busy_mechanic) {
                const mechSelect = document.getElementById('editOrderMechanicSelect');
                if (mechSelect) mechSelect.classList.add('is-invalid');
            }
            showError(errorData.error || 'Ошибка обновления заказа');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Вы уверены, что хотите удалить заказ-наряд?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showSuccess('Заказ-наряд удален');
            document.getElementById(`order-${orderId}`).remove();
            loadOrders('active');
            loadAllCarsInService();
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Ошибка удаления заказа');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

async function completeOrder(orderId) {
    if (!confirm('Завершить заказ-наряд и переместить в архив?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/complete`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showSuccess('Заказ-наряд завершен и перемещен в архив');
            loadOrders('active');
            loadArchive();
            loadAllCarsInService();
            
            const modal = document.getElementById('editOrderModal');
            if (modal) {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            }
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Ошибка завершения заказа');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

// ID заявки из ВК которую сейчас принимают (если установлен — форма работает в режиме принятия)
window._acceptingVkOrderId = null;

async function createOrder() {
    const priceVal = parseFloat(document.getElementById('orderPrice').value);
    if (priceVal > 99999999.99) {
        showError('Сумма превышает максимально допустимую (99 999 999,99 ₽)');
        return;
    }

    const mechanicId = document.getElementById('orderMechanicSelect').value;
    if (!mechanicId) {
        showError('Выберите механика');
        return;
    }

    const selectedStatus = document.getElementById('orderStatus').value;
    
    const appointmentDate = document.getElementById('orderAppointmentDate')?.value || null;
    const appointmentDatetime = document.getElementById('orderAppointmentTime').value || null;

    // Если дата выбрана, но время не выбрано — значит либо воскресенье, либо не кликнули на слот
    if (appointmentDate && !appointmentDatetime) {
        const selected = new Date(appointmentDate + 'T00:00:00');
        if (selected.getDay() === 0) {
            showError('Запись невозможна: воскресенье — выходной.');
        } else {
            showError('Выберите время записи из сетки слотов.');
        }
        return;
    }

    const estimatedHoursInput = document.getElementById('orderEstimatedHours') || document.getElementById('editOrderEstimatedHours');
    let estimatedHours = null;
    if (estimatedHoursInput) {
        const raw = estimatedHoursInput.value.trim();
        if (raw !== '') {
            const parsed = parseFloat(raw);
            if (isNaN(parsed) || parsed < 0 || parsed > 24) {
                showError('Примерное время должно быть числом от 0 до 24');
                return;
            }
            estimatedHours = parsed;
        }
    }

    // ── РЕЖИМ ПРИНЯТИЯ ВК-ЗАЯВКИ: PUT /orders/{id} ────────────────────────────
    const vkOrderId = window._acceptingVkOrderId;
    if (vkOrderId) {
        const body = {
            mechanic_id:          parseInt(mechanicId),
            status:               selectedStatus,
            appointment_datetime: appointmentDatetime,
            estimated_hours:      estimatedHours,
            total_price:          document.getElementById('orderPrice').value || null
        };

        // Проверка: если статус не «Забронирован» — у механика не должно быть других активных заказов
        if (selectedStatus !== 'Забронирован') {
            const activeCheck = ordersData.filter(o =>
                o.mechanic_id == mechanicId &&
                !['Выполнен','Отменен','Отменена','Забронирован','Готов к выдаче','Заявка'].includes(o.status)
            );
            if (activeCheck.length > 0) {
                showError('У этого механика уже есть активный заказ. Выберите статус «Забронирован».');
                return;
            }
        }

        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${API_URL}/orders/${vkOrderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!res.ok) {
                if (data.busy_mechanic) document.getElementById('orderMechanicSelect')?.classList.add('is-invalid');
                showError(data.error || `Ошибка ${res.status}`);
                return;
            }

            showSuccess(`Заявка №${vkOrderId} принята → ${selectedStatus}. Клиент уведомлён в ВК.`);
            if (data.warning) setTimeout(() => showInfo(data.warning), 300);

            // Сброс режима принятия
            window._acceptingVkOrderId = null;
            document.getElementById('vkAcceptBanner')?.remove();

            // Очистка формы
            _clearNewOrderForm(estimatedHoursInput);
            loadOrders('active');
            loadAllCarsInService();
            showTab('orders');

        } catch (e) {
            showError('Ошибка подключения к серверу: ' + e.message);
        }
        return;
    }

    // ── ОБЫЧНЫЙ РЕЖИМ: POST /orders ────────────────────────────────────────────
    const clientId = document.getElementById('orderClientSelect').value;
    const carId = document.getElementById('orderCarSelect').value;
    const problem = document.getElementById('orderProblem').value.trim();

    if (!clientId || !carId || !problem) {
        showError('Заполните все обязательные поля');
        return;
    }

    // Проверка активного заказа у авто (только в обычном режиме)
    try {
        const ordersResponse = await fetch(`${API_URL}/orders`);
        if (ordersResponse.ok) {
            const allOrders = await ordersResponse.json();
            const carActiveOrders = allOrders.filter(o =>
                o.car_id == carId &&
                !['Выполнен','Отменен','Отменена','Заявка'].includes(o.status)
            );
            if (carActiveOrders.length > 0) {
                showError('Нельзя создать заказ: у этого автомобиля уже есть активный заказ.');
                return;
            }
        }
    } catch (error) {
        console.error('Ошибка проверки заказов:', error);
    }

    // Проверка занятости механика (только если статус не «Забронирован»)
    if (selectedStatus !== 'Забронирован') {
        const mechanicActiveOrders = ordersData.filter(o =>
            o.mechanic_id == mechanicId &&
            !['Выполнен','Отменен','Отменена','Забронирован','Готов к выдаче'].includes(o.status)
        );
        if (mechanicActiveOrders.length > 0) {
            showError('У этого механика уже есть активный заказ. Вы можете создать только бронь (статус «Забронирован»).');
            return;
        }
    }

    const orderData = {
        client_id:            parseInt(clientId),
        car_id:               parseInt(carId),
        problem_description:  problem,
        mechanic_id:          parseInt(mechanicId),
        total_price:          document.getElementById('orderPrice').value || null,
        status:               selectedStatus,
        appointment_datetime: appointmentDatetime,
        estimated_hours:      estimatedHours
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            const data = await response.json();
            showSuccess(`Заказ-наряд #${data.order.order_id} создан!`);
            if (data.warning) setTimeout(() => showInfo(data.warning), 300);

            _clearNewOrderForm(estimatedHoursInput);
            loadOrders('active');
            loadAllCarsInService();
            showTab('orders');

        } else {
            const errorData = await response.json();
            if (errorData.busy_mechanic) document.getElementById('orderMechanicSelect')?.classList.add('is-invalid');
            showError(errorData.error || 'Ошибка создания заказа');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

function _clearNewOrderForm(estimatedHoursInput) {
    document.getElementById('orderProblem').value = '';
    document.getElementById('orderPrice').value = '';
    const dateF = document.getElementById('orderAppointmentDate');
    if (dateF) dateF.value = '';
    const slotsContainer = document.getElementById('timeSlotsContainer');
    if (slotsContainer) slotsContainer.innerHTML = '<div class="text-muted small text-center py-3">Выберите дату</div>';
    document.getElementById('orderAppointmentTime').value = '';
    if (estimatedHoursInput) estimatedHoursInput.value = '';
}

function createOrderForClient(clientId, clientName) {
    document.querySelectorAll('.modal.show').forEach(modal => {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
    });

    fetch(`${API_URL}/clients`)
        .then(res => res.ok ? res.json() : [])
        .then(clients => {
            showTab('newOrder', null, { skipReset: true });
            updateClientSelects(clients);

            const clientSelect = document.getElementById('orderClientSelect');
            if (clientSelect) {
                clientSelect.value = clientId;
                clientSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            document.getElementById('orderProblem')?.focus();
            showInfo(`Создание заказа для клиента: ${clientName}`);
        })
        .catch(err => {
            console.error('Ошибка загрузки клиентов:', err);
            showError('Не удалось подготовить форму заказа');
        });
}

async function createOrderForCar(carId, clientId) {
    document.querySelectorAll('.modal.show').forEach(modal => {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
    });

    // Пропускаем проверку активных заказов если это принятие ВК-заявки
    // (заявка и есть тот самый "активный" заказ, мы просто меняем её статус)
    if (!window._acceptingVkOrderId) {
        try {
            const res = await fetch(`${API_URL}/orders`);
            if (res.ok) {
                const orders = await res.json();
                const active = orders.filter(o =>
                    o.car_id == carId &&
                    !['Выполнен','Отменен','Отменена','Заявка'].includes(o.status)
                );
                if (active.length > 0) {
                    showError('Нельзя создать заказ: у этого автомобиля уже есть активный заказ.');
                    return;
                }
            }
        } catch (e) {
            console.error('Ошибка проверки заказов:', e);
        }
    }

    try {
        const clientsRes = await fetch(`${API_URL}/clients`);
        const clients = clientsRes.ok ? await clientsRes.json() : [];
        
        showTab('newOrder', null, { skipReset: true });
        updateClientSelects(clients);

        const clientSelect = document.getElementById('orderClientSelect');
        if (clientSelect) {
            clientSelect.value = clientId;
            clientSelect.dispatchEvent(new Event('change', { bubbles: true }));

            await new Promise(resolve => setTimeout(resolve, 300));
            const carSelect = document.getElementById('orderCarSelect');
            if (carSelect) carSelect.value = carId;
        }

        document.getElementById('orderProblem')?.focus();
        showInfo('Создание заказа для выбранного автомобиля');
    } catch (e) {
        console.error('Ошибка подготовки формы заказа:', e);
        showError('Не удалось подготовить форму заказа');
    }
}

async function deleteArchiveOrder(orderId) {
    if (!confirm('Вы уверены, что хотите удалить этот заказ из архива?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showSuccess('Заказ удален из архива');
            document.getElementById(`archive-order-${orderId}`).remove();
            loadArchive();
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Ошибка удаления заказа из архива');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

function initNewOrderPriceFormatting() {
    const priceInput = document.getElementById('orderPrice');
    const priceFormatted = document.getElementById('orderPriceFormatted');
    if (!priceInput || !priceFormatted) return;

    priceInput.setAttribute('max', '99999999.99');

    priceInput.removeEventListener('input', handlePriceInput);
    priceInput.addEventListener('input', handlePriceInput);
    handlePriceInput.call(priceInput);
}

// Обработчик двойного клика для быстрого просмотра заказа + инициализация слотов
document.addEventListener('DOMContentLoaded', () => {
    // --- Старый обработчик двойного клика ---
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
        ordersList.addEventListener('dblclick', function(e) {
            const card = e.target.closest('.list-group-item-action');
            if (!card) return;
            const orderId = card.id?.replace('order-', '');
            if (orderId) showOrderDetails(orderId);
        });
    }

    // --- Активация сетки временных слотов ---
    setupSlotListeners();
});