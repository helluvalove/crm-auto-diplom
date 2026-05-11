// ==================== ЗАКАЗЫ (ОТРИСОВКА)====================

/**
 * Загрузка и отображение заказов
 * @param {string} filter - 'active', 'archive', 'all' или конкретный статус
 */

async function loadOrders(filter = 'active') {
    try {
        const response = await fetch(`${API_URL}/orders`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);

        ordersData = await response.json();
        const ordersList = document.getElementById('ordersList');

        if (!ordersData || ordersData.length === 0) {
            ordersList.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> Заказы не найдены
                </div>
            `;
            return;
        }

        // Фильтрация заказов
        let filteredOrders = ordersData;
        if (filter === 'active') {
            filteredOrders = ordersData.filter(o => o.status !== 'Выполнен' && o.status !== 'Отменен' && o.status !== 'Отменена' && o.status !== 'Заявка');
        } else if (filter === 'archive') {
            filteredOrders = ordersData.filter(o => o.status === 'Выполнен' || o.status === 'Отменен');
        } else if (filter !== 'all') {
            filteredOrders = ordersData.filter(o => o.status === filter);
        }

        if (filteredOrders.length === 0) {
            ordersList.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> Нет заказов с выбранным статусом
                </div>
            `;
            return;
        }

        let html = '<div class="list-group">';
        filteredOrders.forEach(order => {
            const statusClass = getStatusClass(order.status);
            const price = order.total_price ? formatMoney(order.total_price) : '—';
            const estHours = order.estimated_hours ? `${order.estimated_hours} ч` : '—';

            html += `
                <div class="list-group-item list-group-item-action" id="order-${order.order_id}" title="Двойной клик — быстрый просмотр">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">Заказ-наряд #${order.order_id}</h6>
                        <div>
                            <span class="badge bg-primary rounded-pill me-1">${price}</span>
                            <span class="badge bg-info rounded-pill me-1">${estHours}</span>
                            <button class="btn btn-sm btn-outline-warning" onclick="editOrder(${order.order_id})" title="Редактировать">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteOrder(${order.order_id})" title="Удалить">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <p class="mb-1">
                        <span class="${statusClass}">
                            <i class="bi bi-circle-fill"></i> ${order.status}
                        </span>
                    </p>
                    <small class="text-muted">
                        <i class="bi bi-calendar"></i> ${new Date(order.created_date).toLocaleDateString()}
                        | Клиент: ${order.client_name || 'N/A'}
                        ${order.mechanic_id ? `| Механик: ${order.mechanic_name || 'Механик'} (ID: ${order.mechanic_id})` : ''}
                    </small>
                    <div class="mt-1">
                        <i class="bi bi-car-front"></i>
                        ${order.car_model || '—'}
                        ${order.car_year ? `(${order.car_year} г.)` : ''}
                        ${order.car_gos_number ? ` Госномер: ${order.car_gos_number}` : ''}
                    </div>
                    <div class="mt-2">
                        ${order.status === 'Готов к выдаче' 
                            ? `<button class="btn btn-sm btn-outline-success" onclick="completeOrder(${order.order_id})">
                                <i class="bi bi-check-lg"></i> Завершить
                               </button>` 
                            : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';

        ordersList.innerHTML = html;
        updateStatistics();

    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        showError('Ошибка загрузки заказов: ' + error.message);
    }
}

async function loadArchive() {
    try {
        const response = await fetch(`${API_URL}/orders/archive`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const archiveOrders = await response.json();
        const archiveList = document.getElementById('archiveList');
        
        const statusFilter = document.getElementById('archiveStatusFilter')?.value || 'all';
        const sortOrder = document.getElementById('archiveSortOrder')?.value || 'desc';
        
        let filtered = archiveOrders;
        if (statusFilter !== 'all') {
            filtered = archiveOrders.filter(o => o.status === statusFilter);
        }
        
        filtered.sort((a, b) => {
            const dateA = a.completed_date ? new Date(a.completed_date) : new Date(a.created_date);
            const dateB = b.completed_date ? new Date(b.completed_date) : new Date(b.created_date);
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
        
        if (!filtered || filtered.length === 0) {
            archiveList.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> Архив пуст или нет заказов с выбранным статусом
                </div>
            `;
            return;
        }
        
        let html = '<div class="list-group">';
        filtered.forEach(order => {
            const statusClass = order.status === 'Выполнен' ? 'status-completed' : 'status-cancelled';
            const price = order.total_price ? formatMoney(order.total_price) : '—';
            
            html += `
                <div class="list-group-item" id="archive-order-${order.order_id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">Архивный заказ #${order.order_id}</h6>
                        <div>
                            <span class="badge bg-secondary rounded-pill me-1">${price}</span>
                            ${order.status === 'Выполнен' && order.pdf_url ? `
                            <a href="${order.pdf_url}" target="_blank" class="btn btn-sm btn-outline-success" title="Открыть итоговый заказ-наряд">
                                <i class="bi bi-file-earmark-pdf"></i> <strong>ВЫПОЛНЕН</strong>
                                <br><small>${new Date(order.completed_date).toLocaleDateString()}</small>
                            </a>
                            ` : ''}
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteArchiveOrder(${order.order_id})" title="Удалить из архива">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <p class="mb-1">
                        <span class="${statusClass}">
                            <i class="bi bi-circle-fill"></i> ${order.status}
                        </span>
                        ${order.problem_description ? `<br>${order.problem_description.substring(0, 150)}${order.problem_description.length > 150 ? '...' : ''}` : ''}
                    </p>
                    <small class="text-muted">
                        <i class="bi bi-calendar"></i> Создан: ${new Date(order.created_date).toLocaleDateString()}
                        ${order.completed_date ? `| Завершен: ${new Date(order.completed_date).toLocaleDateString()}` : ''}
                    </small>
                </div>
            `;
        });
        html += '</div>';
        
        archiveList.innerHTML = html;
        
    } catch (error) {
        console.error('Ошибка загрузки архива:', error);
        showError('Ошибка загрузки архива: ' + error.message);
    }
}

// Функция быстрого просмотра заказа (read-only)
async function showOrderDetails(orderId) {
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`);
        if (!response.ok) throw new Error(`Ошибка загрузки заказа: ${response.status}`);
        const order = await response.json();

        const modalHtml = `
            <div class="modal fade" id="viewOrderModal" tabindex="-1">
                <div class="modal-dialog" style="max-width: 1050px;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Просмотр заказ-наряда #${order.order_id}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Клиент</label>
                                        <input class="form-control" value="${order.client?.name || '—'} ${formatPhone(order.client?.phone || '')}" disabled>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Статус</label>
                                        <input class="form-control" value="${order.status}" disabled>
                                    </div>
                                    ${order.appointment_datetime ? `
                                    <div class="mb-3">
                                        <label class="form-label"><i class="bi bi-calendar-check"></i> Дата и время записи</label>
                                        <input class="form-control" value="${new Date(order.appointment_datetime).toLocaleString('ru-RU')}" disabled>
                                    </div>
                                    ` : ''}
                                    ${order.estimated_hours ? `
                                    <div class="mb-3">
                                        <label class="form-label"><i class="bi bi-hourglass-split"></i> Примерное время</label>
                                        <input class="form-control" value="${order.estimated_hours} ч." disabled>
                                    </div>
                                    ` : ''}
                                    <div class="mb-3">
                                        <label class="form-label">Стоимость (руб)</label>
                                        <input class="form-control" value="${order.total_price ? formatMoney(order.total_price) : '—'}" disabled>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Механик</label>
                                        <input class="form-control" value="${order.mechanic?.full_name || 'Не назначен'}" disabled>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label fw-bold"><i class="bi bi-car-front"></i> Автомобиль</label>
                                        <div class="row g-2">
                                            <div class="col-md-6">
                                                <input type="text" class="form-control" value="${order.car ? order.car.model : 'Нет данных'}" disabled>
                                                <small class="text-muted">Модель</small>
                                            </div>
                                            <div class="col-md-3">
                                                <input type="text" class="form-control" value="${order.car ? order.car.year || '—' : '—'}" disabled>
                                                <small class="text-muted">Год</small>
                                            </div>
                                            <div class="col-md-3">
                                                <input type="text" class="form-control" value="${order.car ? order.car.gos_number || '—' : '—'}" disabled>
                                                <small class="text-muted">Госномер</small>
                                            </div>
                                        </div>
                                        <div class="row g-2 mt-2">
                                            <div class="col-md-9">
                                                <input type="text" class="form-control" value="${order.car ? order.car.vin || '—' : '—'}" disabled>
                                                <small class="text-muted">VIN</small>
                                            </div>
                                            <div class="col-md-3">
                                                <input type="text" class="form-control" value="${order.car ? (order.car.mileage ? order.car.mileage + ' км' : '—') : '—'}" disabled>
                                                <small class="text-muted">Пробег</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Описание проблемы</label>
                                <textarea class="form-control" rows="3" disabled>${order.problem_description || ''}</textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Описание работ</label>
                                <textarea class="form-control" rows="3" disabled>${order.work_description || ''}</textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <div class="me-auto">
                                <div class="btn-group">
                                    <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                        <i class="bi bi-file-earmark-pdf"></i> Документы
                                    </button>
                                    <ul class="dropdown-menu">
                                        <li><a class="dropdown-item" href="#" onclick="generatePDF(${order.order_id}, 'preliminary')">Предварительный заказ-наряд</a></li>
                                        <li><a class="dropdown-item" href="#" onclick="generatePDF(${order.order_id}, 'final')">Итоговый заказ-наряд</a></li>
                                        <li><a class="dropdown-item" href="#" onclick="generatePDF(${order.order_id}, 'acceptance')">Акт приёма-передачи</a></li>
                                    </ul>
                                </div>
                            </div>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const oldModal = document.getElementById('viewOrderModal');
        if (oldModal) oldModal.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = new bootstrap.Modal(document.getElementById('viewOrderModal'));
        modal.show();
    } catch (error) {
        console.error('Ошибка просмотра заказа:', error);
        showError('Не удалось загрузить информацию о заказе');
    }
}

// Функция редактирования заказа
async function editOrder(orderId) {
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`);
        if (!response.ok) throw new Error(`Ошибка загрузки заказа: ${response.status}`);
        
        const order = await response.json();
        
        const clientsResponse = await fetch(`${API_URL}/clients`);
        const clients = clientsResponse.ok ? await clientsResponse.json() : [];
        
        const mechanicsResponse = await fetch(`${API_URL}/mechanics`);
        const mechanics = mechanicsResponse.ok ? await mechanicsResponse.json() : [];
        
        const modalHtml = `
            <div class="modal fade" id="editOrderModal" tabindex="-1" aria-labelledby="editOrderModalLabel" aria-hidden="true">
                <div class="modal-dialog" style="max-width: 990px;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="editOrderModalLabel">Редактировать заказ-наряд #${order.order_id}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Клиент</label>
                                        <select class="form-select" id="editOrderClientSelect">
                                            ${clients.map(client => 
                                                `<option value="${client.client_id}" ${client.client_id === order.client_id ? 'selected' : ''}>${client.name} (${formatPhone(client.phone)})</option>`
                                            ).join('')}
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Статус</label>
                                        <select class="form-select" id="editOrderStatus">
                                            <option value="Забронирован" ${order.status === 'Забронирован' ? 'selected' : ''}>Забронирован</option>
                                            <option value="Создан" ${order.status === 'Создан' ? 'selected' : ''}>Создан</option>
                                            <option value="На диагностике" ${order.status === 'На диагностике' ? 'selected' : ''}>На диагностике</option>
                                            <option value="В работе" ${order.status === 'В работе' ? 'selected' : ''}>В работе</option>
                                            <option value="Готов к выдаче" ${order.status === 'Готов к выдаче' ? 'selected' : ''}>Готов к выдаче</option>
                                            <option value="Отменен" ${order.status === 'Отменен' ? 'selected' : ''}>Отменен</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Механик</label>
                                        <select class="form-select" id="editOrderMechanicSelect">
                                            <option value="">Не назначен</option>
                                            ${mechanics.map(mechanic => 
                                                `<option value="${mechanic.user_id}" ${mechanic.user_id === order.mechanic_id ? 'selected' : ''}>${mechanic.full_name}</option>`
                                            ).join('')}
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Стоимость (руб)</label>
                                        <input type="number" class="form-control" id="editOrderPrice" value="${order.total_price || ''}" step="0.01" min="0" max="99999999.99">
                                        <div class="form-text text-success" id="editOrderPriceFormatted">${order.total_price ? formatMoney(order.total_price) : ''}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Объединённый ряд: Дата и время записи + Примерное время -->
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Дата и время записи</label>
                                        <input type="datetime-local" class="form-control" id="editOrderAppointment"
                                               value="${order.appointment_datetime ? order.appointment_datetime.slice(0, 16) : ''}">
                                        <div class="form-text">Оставьте пустым, если заказ без предв. записи</div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Примерное время (часов)</label>
                                        <input type="number" class="form-control" id="editOrderEstimatedHours"
                                            value="${order.estimated_hours || ''}" step="0.5" min="0" max="24">
                                        <div class="form-text">Оставьте пустым, если точное время неизвестно</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Компактная информация об автомобиле (VIN и Год поменяны местами) -->
                            <div class="mb-3">
                                <label class="form-label fw-bold"><i class="bi bi-car-front"></i> Автомобиль</label>
                                <div class="row g-2">
                                    <div class="col-md-6">
                                        <input type="text" class="form-control bg-light" value="${order.car ? order.car.model : 'Нет данных'}" readonly>
                                        <small class="text-muted">Модель</small>
                                    </div>
                                    <div class="col-md-3">
                                        <input type="text" class="form-control bg-light" value="${order.car ? order.car.year || '—' : '—'}" readonly>
                                        <small class="text-muted">Год</small>
                                    </div>
                                    <div class="col-md-3">
                                        <input type="text" class="form-control bg-light" value="${order.car ? order.car.gos_number || '—' : '—'}" readonly>
                                        <small class="text-muted">Госномер</small>
                                    </div>
                                </div>
                                <div class="row g-2 mt-2">
                                    <div class="col-md-9">
                                        <input type="text" class="form-control bg-light" value="${order.car ? order.car.vin || '—' : '—'}" readonly>
                                        <small class="text-muted">VIN</small>
                                    </div>
                                    <div class="col-md-3">
                                        <input type="text" class="form-control bg-light" value="${order.car ? (order.car.mileage ? order.car.mileage + ' км' : '—') : '—'}" readonly>
                                        <small class="text-muted">Пробег</small>
                                    </div>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label">Описание проблемы</label>
                                <textarea class="form-control" id="editOrderProblem" rows="3">${order.problem_description || ''}</textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Описание работ</label>
                                <textarea class="form-control" id="editOrderWork" rows="3">${order.work_description || ''}</textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            ${order.status === 'Готов к выдаче' ? `
                            <button type="button" class="btn btn-success" onclick="completeOrder(${order.order_id})">
                                <i class="bi bi-check-lg"></i> Завершить и отправить в архив
                            </button>
                            ` : ''}
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                            <button type="button" class="btn btn-primary" onclick="updateOrder(${order.order_id})">Сохранить</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const oldModal = document.getElementById('editOrderModal');
        if (oldModal) oldModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const editPriceInput = document.getElementById('editOrderPrice');
        const editPriceFormatted = document.getElementById('editOrderPriceFormatted');
        if (editPriceInput) {
            editPriceInput.setAttribute('max', '99999999.99');
            if (editPriceFormatted) {
                editPriceInput.addEventListener('input', function() {
                    enforceMaxPrice(this, 99999999.99);     
                    const val = parseFloat(this.value);
                    editPriceFormatted.textContent = (!isNaN(val) && this.value.trim() !== '') ? formatMoney(val) : '';
                });
            }
        }
        
        const modal = new bootstrap.Modal(document.getElementById('editOrderModal'));
        modal.show();
        
        document.getElementById('editOrderClientSelect').addEventListener('change', async function() {
            const clientId = this.value;
            if (!clientId) return;
            try {
                await fetch(`${API_URL}/cars/client/${clientId}`).then(r => r.json());
            } catch (error) {
                console.error('Ошибка загрузки автомобилей:', error);
            }
        });
        
    } catch (error) {
        console.error('Ошибка загрузки данных заказа:', error);
        showError('Ошибка загрузки данных заказа: ' + error.message);
    }
}

async function renderTimeSlots() {
    const dateInput = document.getElementById('orderAppointmentDate');
    const container = document.getElementById('timeSlotsContainer');
    const mechanicSelect = document.getElementById('orderMechanicSelect');
    const hiddenTime = document.getElementById('orderAppointmentTime');

    if (!dateInput || !container) return;

    const date = dateInput.value; // YYYY-MM-DD
    const mechanicId = mechanicSelect ? mechanicSelect.value : null;

    if (!date) {
        container.innerHTML = '<div class="text-muted small text-center py-3">Сначала выберите дату</div>';
        hiddenTime.value = '';
        return;
    }

    // Показываем индикатор загрузки
    container.innerHTML = `
        <div class="d-flex justify-content-center align-items-center py-3 w-100">
            <div class="spinner-border spinner-border-sm text-primary me-2"></div>
            <span class="small">Загрузка...</span>
        </div>`;

    try {
        // Получаем занятые слоты для выбранного механика (если механик выбран)
        let busySlots = [];
        if (mechanicId) {
            const resp = await fetch(`${API_URL}/mechanics/availability?date=${date}`);
            if (resp.ok) {
                const allMechanics = await resp.json();
                // Находим нужного механика в ответе
                const mechanic = allMechanics.find(m => m.user_id == mechanicId);
                if (mechanic && mechanic.busy_slots) {
                    busySlots = mechanic.busy_slots;
                }
            }
        }

        // Проверяем день недели (воскресенье — выходной)
        const selectedDate = new Date(date + 'T00:00:00');
        const dayOfWeek = selectedDate.getDay(); // 0 = вс, 6 = сб
        if (dayOfWeek === 0) {
            container.innerHTML = '<div class="text-danger small text-center py-3">Воскресенье — выходной</div>';
            hiddenTime.value = '';
            return;
        }

        // Генерируем все слоты дня (10:00–19:30, шаг 30 минут)
        const slots = [];
        for (let h = 10; h < 20; h++) {
            for (let m = 0; m < 60; m += 30) {
                if (h === 19 && m > 30) continue; // последний слот 19:30
                const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                const slotDateTime = new Date(`${date}T${time}:00`);
                const slotISO = `${date}T${time}:00`;

                // Проверяем, занят ли этот слот
                const isOccupied = busySlots.some(busy => {
                    const busyStart = new Date(busy.start);
                    const busyEnd = new Date(busy.end);
                    // Слот считается занятым, если его время попадает в интервал [start, end)
                    return slotDateTime >= busyStart && slotDateTime < busyEnd;
                });

                slots.push({
                    time: time,
                    iso: slotISO,
                    occupied: isOccupied
                });
            }
        }

        // Отрисовываем сетку
        container.innerHTML = slots.map(slot => {
            const cls = slot.occupied ? 'occupied' : '';
            const title = slot.occupied ? 'Занято другим заказом' : 'Свободно';
            return `<div class="time-slot ${cls}" 
                         data-time="${slot.iso}" 
                         title="${title}">
                    ${slot.time}
                    </div>`;
        }).join('');

        // Сбрасываем скрытое поле
        hiddenTime.value = '';

        // Добавляем обработчики клика на свободные слоты
        container.querySelectorAll('.time-slot:not(.occupied)').forEach(el => {
            el.addEventListener('click', function () {
                // Снимаем выделение со всех
                container.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
                // Выделяем текущий
                this.classList.add('selected');
                // Сохраняем значение в скрытое поле (ISO-строка)
                hiddenTime.value = this.dataset.time;
            });
        });

    } catch (err) {
        console.error('Ошибка загрузки занятости:', err);
        container.innerHTML = '<div class="text-danger small text-center py-3">Ошибка загрузки слотов</div>';
    }
}

/**
 * Вешает обработчики: при смене даты или механика перерисовывает слоты
 */
function setupSlotListeners() {
    const dateInput = document.getElementById('orderAppointmentDate');
    const mechanicSelect = document.getElementById('orderMechanicSelect');

    if (dateInput) {
        // Запрещаем выбирать прошедшие даты
        dateInput.min = new Date().toISOString().split('T')[0];
        dateInput.addEventListener('change', renderTimeSlots);
    }
    if (mechanicSelect) {
        mechanicSelect.addEventListener('change', renderTimeSlots);
    }
}