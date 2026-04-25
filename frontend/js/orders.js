// ==================== ЗАКАЗЫ ====================

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
            filteredOrders = ordersData.filter(o => o.status !== 'Выполнен' && o.status !== 'Отменен');
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

            html += `
                <div class="list-group-item list-group-item-action" id="order-${order.order_id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">Заказ-наряд #${order.order_id}</h6>
                        <div>
                            <span class="badge bg-primary rounded-pill me-1">${price}</span>
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
                        ${order.problem_description 
                            ? `<br>${order.problem_description.substring(0, 100)}${order.problem_description.length > 100 ? '...' : ''}` 
                            : ''}
                    </p>
                    <small class="text-muted">
                        <i class="bi bi-calendar"></i> ${new Date(order.created_date).toLocaleDateString()}
                        | Клиент: ${order.client_name || 'N/A'}
                        ${order.mechanic_id ? `| Механик ID: ${order.mechanic_id}` : ''}
                    </small>
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

// Функция редактирования заказа
async function editOrder(orderId) {
    try {
        // Загружаем информацию о заказе
        const response = await fetch(`${API_URL}/orders/${orderId}`);
        if (!response.ok) {
            throw new Error(`Ошибка загрузки заказа: ${response.status}`);
        }
        
        const order = await response.json();
        
        // Загружаем клиентов
        const clientsResponse = await fetch(`${API_URL}/clients`);
        const clients = clientsResponse.ok ? await clientsResponse.json() : [];
        
        // Загружаем механиков
        const mechanicsResponse = await fetch(`${API_URL}/mechanics`);
        const mechanics = mechanicsResponse.ok ? await mechanicsResponse.json() : [];
        
        // Создаем модальное окно для редактирования
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
                                        <input type="number" class="form-control" id="editOrderPrice" value="${order.total_price || ''}" step="0.01" min="0">
                                        <div class="form-text text-success" id="editOrderPriceFormatted">${order.total_price ? formatMoney(order.total_price) : ''}</div>
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
        
        // Удаляем старые модальные окна если есть
        const oldModal = document.getElementById('editOrderModal');
        if (oldModal) oldModal.remove();
        
        // Добавляем модальное окно в DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const editPriceInput = document.getElementById('editOrderPrice');
        const editPriceFormatted = document.getElementById('editOrderPriceFormatted');
        if (editPriceInput && editPriceFormatted) {
            editPriceInput.addEventListener('input', function() {
                const val = parseFloat(this.value);
                editPriceFormatted.textContent = (!isNaN(val) && this.value.trim() !== '') ? formatMoney(val) : '';
            });
        }

        // Показываем модальное окно
        const modal = new bootstrap.Modal(document.getElementById('editOrderModal'));
        modal.show();
        
        // Загружаем автомобили выбранного клиента
        document.getElementById('editOrderClientSelect').addEventListener('change', async function() {
            const clientId = this.value;
            if (!clientId) return;
            
            try {
                const carsResponse = await fetch(`${API_URL}/cars/client/${clientId}`);
                if (carsResponse.ok) {
                    const cars = await carsResponse.json();
                    // Можно добавить выпадающий список автомобилей если нужно
                }
            } catch (error) {
                console.error('Ошибка загрузки автомобилей:', error);
            }
        });
        
    } catch (error) {
        console.error('Ошибка загрузки данных заказа:', error);
        showError('Ошибка загрузки данных заказа: ' + error.message);
    }
}

async function updateOrder(orderId) {
    const clientId = document.getElementById('editOrderClientSelect').value;
    const status = document.getElementById('editOrderStatus').value;
    const problem = document.getElementById('editOrderProblem').value.trim();
    
    if (!clientId || !problem) {
        showError('Заполните обязательные поля');
        return;
    }
    
    const orderData = {
        client_id: parseInt(clientId),
        status: status,
        problem_description: problem,
        work_description: document.getElementById('editOrderWork').value.trim() || null,
        mechanic_id: document.getElementById('editOrderMechanicSelect').value || null,
        total_price: document.getElementById('editOrderPrice').value || null
    };
    
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        
        if (response.ok) {
            showSuccess('Заказ-наряд обновлен!');
            
            // Закрываем модальное окно
            const modal = bootstrap.Modal.getInstance(document.getElementById('editOrderModal'));
            modal.hide();
            
            // Обновляем список заказов
            loadOrders('active');
            
        } else {
            const errorData = await response.json();
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
            loadAllCarsInService(); // Обновляем список автомобилей в сервисе
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
            loadAllCarsInService(); // Обновляем список автомобилей в сервисе
            
            // Закрываем модальное окно если оно открыто
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

async function createOrder() {
    const clientId = document.getElementById('orderClientSelect').value;
    const carId = document.getElementById('orderCarSelect').value;
    const problem = document.getElementById('orderProblem').value.trim();
    
    if (!clientId || !carId || !problem) {
        showError('Заполните все обязательные поля');
        return;
    }
    
    // Проверяем, есть ли у автомобиля активные заказы
    try {
        const ordersResponse = await fetch(`${API_URL}/orders`);
        if (ordersResponse.ok) {
            const allOrders = await ordersResponse.json();
            const carActiveOrders = allOrders.filter(order => 
                order.car_id == carId && 
                order.status !== 'Выполнен' && 
                order.status !== 'Отменен'
            );
            
            const hasOrderInWork = carActiveOrders.some(o => o.status === 'В работе');
            
            if (hasOrderInWork) {
                showError('Нельзя создать заказ для автомобиля, который уже находится в работе!');
                return;
            }
        }
    } catch (error) {
        console.error('Ошибка проверки заказов:', error);
    }
    
    const orderData = {
        client_id: parseInt(clientId),
        car_id: parseInt(carId),
        problem_description: problem,
        mechanic_id: document.getElementById('orderMechanicSelect').value || null,
        total_price: document.getElementById('orderPrice').value || null,
        status: document.getElementById('orderStatus').value
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
            
            document.getElementById('orderProblem').value = '';
            document.getElementById('orderPrice').value = '';
            
            loadOrders('active');
            loadAllCarsInService(); // Обновляем список автомобилей в сервисе
            showTab('orders');
            
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Ошибка создания заказа');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

function createOrderForClient(clientId, clientName) {
    showTab('newOrder');

    setTimeout(() => {
        const clientSelect = document.getElementById('orderClientSelect');
        if (clientSelect) {
            clientSelect.value = clientId;
            clientSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        document.getElementById('orderProblem')?.focus();
        showInfo(`Создание заказа для клиента: ${clientName}`);
    }, 100);
}

async function createOrderForCar(carId, clientId) {
    // Проверка активных заказов
    try {
        const res = await fetch(`${API_URL}/orders`);
        if (res.ok) {
            const orders = await res.json();
            const active = orders.filter(o => 
                o.car_id == carId && 
                o.status !== 'Выполнен' && 
                o.status !== 'Отменен'
            );
            if (active.some(o => o.status === 'В работе')) {
                showError('Нельзя создать заказ — автомобиль уже в работе!');
                return;
            }
        }
    } catch (e) {
        console.error('Ошибка проверки заказов:', e);
    }

    showTab('newOrder');

    setTimeout(async () => {
        const clientSelect = document.getElementById('orderClientSelect');
        if (clientSelect) {
            clientSelect.value = clientId;
            clientSelect.dispatchEvent(new Event('change', { bubbles: true }));

            // Ждём обновления списка автомобилей
            setTimeout(() => {
                const carSelect = document.getElementById('orderCarSelect');
                if (carSelect) carSelect.value = carId;
            }, 300);
        }

        document.getElementById('orderProblem')?.focus();
        showInfo('Создание заказа для выбранного автомобиля');
    }, 100);
}

async function loadArchive() {
    try {
        const response = await fetch(`${API_URL}/orders/archive`);
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const archiveOrders = await response.json();
        const archiveList = document.getElementById('archiveList');
        
        if (!archiveOrders || archiveOrders.length === 0) {
            archiveList.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> Архив пуст
                </div>
            `;
            return;
        }
        
        let html = '<div class="list-group">';
        archiveOrders.forEach(order => {
            const statusClass = order.status === 'Выполнен' ? 'status-completed' : 'status-cancelled';
            const price = order.total_price ? formatMoney(order.total_price) : '—';
            
            html += `
                <div class="list-group-item" id="archive-order-${order.order_id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">Архивный заказ #${order.order_id}</h6>
                        <div>
                            <span class="badge bg-secondary rounded-pill me-1">${price}</span>
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

// Функция удаления заказа из архива
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

// Инициализация форматирования суммы на вкладке "Новый заказ"
function initNewOrderPriceFormatting() {
    const priceInput = document.getElementById('orderPrice');
    const priceFormatted = document.getElementById('orderPriceFormatted');
    if (!priceInput || !priceFormatted) return;

    // Удаляем старый обработчик, чтобы не дублировался при повторном вызове
    priceInput.removeEventListener('input', handlePriceInput);
    priceInput.addEventListener('input', handlePriceInput);

    // Вызовем один раз, если значение уже есть (например, при возврате на вкладку)
    handlePriceInput.call(priceInput);
}

// Вспомогательный обработчик
function handlePriceInput() {
    const val = parseFloat(this.value);
    const formatted = document.getElementById('orderPriceFormatted');
    if (formatted) {
        formatted.textContent = (!isNaN(val) && this.value.trim() !== '') ? formatMoney(val) : '';
    }
}