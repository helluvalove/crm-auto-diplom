// Показать ошибку под полем ввода
function showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const errorId = inputId + 'Error';

    // Удаляем старую ошибку
    const oldError = document.getElementById(errorId);
    if (oldError) oldError.remove();

    // Сбрасываем классы
    input.classList.remove('is-valid', 'is-invalid');

    if (message) {
        // Ошибка
        input.classList.add('is-invalid');
        const errorDiv = document.createElement('div');
        errorDiv.id = errorId;
        errorDiv.className = 'invalid-feedback';
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        input.parentNode.appendChild(errorDiv);
    } else if (input.value.trim()) {
        // Успех (только если поле не пустое)
        input.classList.add('is-valid');
    }
}

// ==================== УПРАВЛЕНИЕ ВКЛАДКАМИ ====================
function showTab(tabName, event = null) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.style.display = 'none';
    });

    // Убираем активный класс у всех кнопок
    document.querySelectorAll('#mainTabs .nav-link').forEach(btn => {
        btn.classList.remove('active');
    });

    // Показываем нужную вкладку
    const targetTab = document.getElementById(`${tabName}Tab`);
    if (targetTab) targetTab.style.display = 'block';

    // Активируем кнопку вкладки
    const tabButton = document.querySelector(`#mainTabs button[onclick*="showTab('${tabName}'"]`);
    if (tabButton) tabButton.classList.add('active');

    // Если кликнули по кнопке — тоже активируем
    if (event?.target) event.target.classList.add('active');

    // Автозагрузка данных для конкретных вкладок
    switch (tabName) {
        case 'cars':
            loadAllCarsInService();
            break;
        case 'requests':
            loadRequests();
            break;
        case 'archive':
            loadArchive();
            break;
        case 'mechanics':
            loadMechanicsList();
            break;
        case 'statistics':
            updateStatistics();
            break;
        case 'orders':
            loadOrders('active');
            break;
        case 'clients':
            loadClients();
            break;
        case 'newOrder':
            // Загружаем клиентов и сбрасываем форму
            fetch(`${API_URL}/clients`)
                .then(res => res.ok ? res.json() : [])
                .then(clients => {
                    if (clients.length > 0) {
                        updateClientSelects(clients);
                        document.getElementById('orderClientSelect').value = '';
                        const carSelect = document.getElementById('orderCarSelect');
                        if (carSelect) carSelect.innerHTML = '<option value="">Сначала выберите клиента</option>';
                        document.getElementById('orderProblem').value = '';
                        document.getElementById('orderPrice').value = '';
                    }
                })
                .catch(err => console.error('Ошибка загрузки клиентов для новой заявки:', err));
            break;
    }
}

function filterOrders(status, event = null) {
    // Сбрасываем активные кнопки
    document.querySelectorAll('#ordersTab .btn-group button').forEach(btn => {
        btn.classList.remove('active');
    });

    if (event?.target) event.target.classList.add('active');

    loadOrders(status === 'all' ? 'all' : status);
}

function updateClientSelects(clients) {
    const carSelect = document.getElementById('carClientSelect');
    const orderSelect = document.getElementById('orderClientSelect');

    [carSelect, orderSelect].forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">Выберите клиента</option>';
        clients.forEach(client => {
            select.innerHTML += `<option value="${client.client_id}">${client.name} (${client.phone})</option>`;
        });
    });

    // Добавляем обработчик изменения клиента в форме нового заказа
    if (orderSelect) {
        orderSelect.removeEventListener('change', handleClientSelectChange);
        orderSelect.addEventListener('change', handleClientSelectChange);
    }
}

// Обработчик выбора клиента -> загрузка его автомобилей
async function handleClientSelectChange() {
    const clientId = this.value;
    const carSelect = document.getElementById('orderCarSelect');
    if (!carSelect) return;

    if (!clientId) {
        carSelect.innerHTML = '<option value="">Сначала выберите клиента</option>';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/cars/client/${clientId}`);
        if (!response.ok) throw new Error();

        const cars = await response.json();
        carSelect.innerHTML = '<option value="">Выберите автомобиль</option>';

        cars.forEach(car => {
            const text = `${car.model} ${car.vin ? '(VIN: ' + car.vin + ')' : ''} ${car.gos_number ? '(' + car.gos_number + ')' : ''}`;
            carSelect.innerHTML += `<option value="${car.car_id}">${text}</option>`;
        });
    } catch (error) {
        console.error('Ошибка загрузки автомобилей клиента:', error);
        carSelect.innerHTML = '<option value="">Ошибка загрузки автомобилей</option>';
    }
}

// ==================== УТИЛИТЫ ====================
function showSuccess(message) {
    showAlert(message, 'success');
}

function showError(message) {
    showAlert(message, 'danger');
}

function showInfo(message) {
    showAlert(message, 'info');
}

function showAlert(message, type) {
    // Удаляем старые уведомления
    document.querySelectorAll('.alert-notification').forEach(alert => alert.remove());

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-notification alert-dismissible fade show`;
    alertDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';

    const icon = type === 'success' ? 'check-circle-fill' :
                 type === 'danger' ? 'exclamation-triangle-fill' : 'info-circle-fill';

    alertDiv.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi bi-${icon} me-2 fs-5"></i>
            <div class="flex-grow-1">
                <strong>${type === 'success' ? 'Успех!' : type === 'danger' ? 'Ошибка!' : 'Информация!'}</strong><br>
                <span class="small">${message}</span>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;

    document.body.appendChild(alertDiv);

    // Автоскрытие через 5 секунд
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 300);
        }
    }, 5000);
}

// ==================== ПРОВЕРКА СТАТУСА API ====================
async function checkAPIStatus() {
    const statusElement = document.getElementById('systemStatus');
    if (!statusElement) {
        console.warn('Элемент #systemStatus не найден в DOM');
        return;
    }

    statusElement.innerHTML = `
        <div class="alert alert-info">
            <i class="bi bi-hourglass-split"></i> Проверка подключения к API...
        </div>
    `;

    try {
        // Основная проверка API
        const apiResponse = await fetch('/api', { 
            method: 'GET',
            cache: 'no-cache',
            headers: { 'Accept': 'application/json' }
        });

        if (apiResponse.ok) {
            const data = await apiResponse.json();
            statusElement.innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle-fill"></i> API доступен<br>
                    <small class="text-muted">Версия: ${data.version || 'неизвестна'}</small>
                </div>
            `;
            return;
        }

        // Если /api не ответил — проверяем корень сайта
        const rootResponse = await fetch('/', { 
            method: 'GET',
            cache: 'no-cache'
        });

        if (rootResponse.ok) {
            statusElement.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle-fill"></i> API доступен (базовая проверка)<br>
                    <small class="text-muted">Сервер запущен, но /api вернул ошибку</small>
                </div>
            `;
        } else {
            throw new Error('Сервер не отвечает');
        }

    } catch (error) {
        console.error('checkAPIStatus error:', error);
        statusElement.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-x-circle-fill"></i> Ошибка подключения к API<br>
                <small class="text-muted">Проверьте, запущен ли сервер</small>
            </div>
        `;
    }
}

// ==================== СТАТИСТИКА ====================
function updateStatistics() {
    if (!ordersData || ordersData.length === 0) {
        document.getElementById('statisticsContent').innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> Нет данных для статистики
            </div>
        `;
        return;
    }
    
    const completedOrders = ordersData.filter(order => order.status === 'Выполнен').length;
    const activeOrders = ordersData.filter(order => 
        order.status !== 'Выполнен' && order.status !== 'Отменен'
    ).length;
    
    const totalRevenue = ordersData
        .filter(order => order.status === 'Выполнен' && order.total_price)
        .reduce((sum, order) => sum + parseFloat(order.total_price), 0);
    
    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;
    
    const period = document.getElementById('statisticsPeriod').value;
    let periodText = 'за все время';
    if (period === 'week') periodText = 'за неделю';
    if (period === 'month') periodText = 'за месяц';
    if (period === 'year') periodText = 'за год';
    
    const html = `
        <div class="row">
            <div class="col-md-3 mb-3">
                <div class="card text-center bg-light">
                    <div class="card-body">
                        <h1 class="display-5 text-primary">${completedOrders}</h1>
                        <p class="card-text">Выполнено заказов</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center bg-light">
                    <div class="card-body">
                        <h1 class="display-5 text-warning">${activeOrders}</h1>
                        <p class="card-text">Активных заказов</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center bg-light">
                    <div class="card-body">
                        <h1 class="display-5 text-success">${document.querySelectorAll('#mechanicsList .list-group-item').length || 0}</h1>
                        <p class="card-text">Механиков в штате</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center bg-light">
                    <div class="card-body">
                        <h1 class="display-5 text-info">${totalRevenue.toFixed(2)} ₽</h1>
                        <p class="card-text">Общая выручка</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-body">
                        <h6>Дополнительная статистика ${periodText}:</h6>
                        <ul class="mb-0">
                            <li>Средний чек: <strong>${averageOrderValue.toFixed(2)} ₽</strong></li>
                            <li>Количество клиентов: <strong>${document.querySelectorAll('#clientsList .list-group-item').length || 0}</strong></li>
                            <li>Количество автомобилей: <strong>${document.querySelectorAll('#carsList .list-group-item').length || 0}</strong></li>
                            <li>Общее количество заказов: <strong>${ordersData.length}</strong></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('statisticsContent').innerHTML = html;
}
