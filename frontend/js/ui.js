// Показать ошибку под полем ввода
function showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const errorId = inputId + 'Error';
    const oldError = document.getElementById(errorId);
    if (oldError) oldError.remove();
    input.classList.remove('is-valid', 'is-invalid');
    if (message) {
        input.classList.add('is-invalid');
        const errorDiv = document.createElement('div');
        errorDiv.id = errorId;
        errorDiv.className = 'invalid-feedback';
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        input.parentNode.appendChild(errorDiv);
    } else if (input.value.trim()) {
        input.classList.add('is-valid');
    }
}

// ==================== УПРАВЛЕНИЕ ВКЛАДКАМИ (ОБЩЕЕ) ====================
function showTab(tabName, event = null, options = {}) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.style.display = 'none';
    });

    // Снимаем активный класс со всех кнопок в обеих панелях
    document.querySelectorAll('#mainTabs .nav-link, #mobileNav .nav-link').forEach(btn => {
        btn.classList.remove('active');
    });

    // Показываем нужную вкладку
    const targetTab = document.getElementById(`${tabName}Tab`);
    if (targetTab) targetTab.style.display = 'block';

    // Ищем кнопку, соответствующую вкладке, в обеих панелях и делаем её активной
    const buttonSelector = `#mainTabs button[onclick*="showTab('${tabName}'"], #mobileNav button[onclick*="showTab('${tabName}'"]`;
    const tabButton = document.querySelector(buttonSelector);
    if (tabButton) tabButton.classList.add('active');
    // Дополнительно, если передан event, то активируем и его цель (на случай прямого клика)
    if (event?.target) event.target.classList.add('active');

    // Автозагрузка данных для конкретных вкладок
    switch (tabName) {
        case 'cars':
            if (typeof resetCarForm === 'function') resetCarForm();
            const resultsContainer = document.getElementById('clientSearchResults');
            if (resultsContainer) resultsContainer.style.display = 'none';
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
            setDefaultAvailabilityDate();
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
            if (!options.skipReset) {
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
                            initNewOrderPriceFormatting();
                        }
                    })
                    .catch(err => console.error('Ошибка загрузки клиентов для новой заявки:', err));
            }
            break;
        case 'availableOrders':
            loadAvailableOrders();
            break;
        case 'myWorks':
            loadMyWork();
            break;
        case 'mechanicProfile':
            loadMechanicProfile();
            break;
    }
}

function filterOrders(status, event = null) {
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
            select.innerHTML += `<option value="${client.client_id}">${client.name} (${formatPhone(client.phone)})</option>`;
        });
    });
    if (orderSelect) {
        orderSelect.removeEventListener('change', handleClientSelectChange);
        orderSelect.addEventListener('change', handleClientSelectChange);
    }
}

// Показать предупреждение о дублировании значения
function showFieldDuplicate(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const errorId = inputId + 'Error';
    const oldError = document.getElementById(errorId);
    if (oldError) oldError.remove();
    input.classList.remove('is-valid', 'is-invalid', 'is-duplicate');
    if (message) {
        input.classList.add('is-duplicate');
        const errorDiv = document.createElement('div');
        errorDiv.id = errorId;
        errorDiv.className = 'duplicate-feedback';
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        input.parentNode.appendChild(errorDiv);
    } else {
        input.classList.remove('is-duplicate');
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
function showSuccess(message) { showAlert(message, 'success'); }
function showError(message) { showAlert(message, 'danger'); }
function showInfo(message) { showAlert(message, 'info'); }

function showAlert(message, type) {
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
        const rootResponse = await fetch('/', { method: 'GET', cache: 'no-cache' });
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
// Вспомогательная: определение дат периода
function getDateRange(period, subperiod) {
    const now = new Date();
    let start, end;

    // Нормализуем время до полночи для корректного сравнения
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    switch (period) {
        case 'day':
            if (subperiod === 'current') {
                start = todayStart;
                end = todayEnd;
            } else { // прошлый день
                const yesterday = new Date(todayStart);
                yesterday.setDate(yesterday.getDate() - 1);
                start = yesterday;
                end = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1);
            }
            break;

        case 'week':
            const dayOfWeek = now.getDay(); // 0 = вс
            const mondayThisWeek = new Date(todayStart);
            mondayThisWeek.setDate(todayStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

            if (subperiod === 'current') {
                start = mondayThisWeek;
                end = new Date(mondayThisWeek.getTime() + 6 * 24 * 60 * 60 * 1000 - 1);
            } else { // прошлая неделя
                const mondayLastWeek = new Date(mondayThisWeek);
                mondayLastWeek.setDate(mondayLastWeek.getDate() - 7);
                start = mondayLastWeek;
                end = new Date(mondayLastWeek.getTime() + 6 * 24 * 60 * 60 * 1000 - 1);
            }
            break;

        case 'month':
            if (subperiod === 'current') {
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            } else { // прошлый месяц
                const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                start = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1);
                end = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0, 23, 59, 59);
            }
            break;

        case 'year':
            if (subperiod === 'current') {
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            } else { // прошлый год
                start = new Date(now.getFullYear() - 1, 0, 1);
                end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
            }
            break;

        default: // 'all'
            return null;
    }
    return { start, end };
}

// Основная функция статистики
async function updateStatistics() {
    const mainBtns = document.querySelectorAll('#periodMainGroup .btn');
    const subBtns = document.querySelectorAll('#periodSubGroup .btn');

    // Определяем активный период
    let period = 'all';
    let subperiod = 'current';
    mainBtns.forEach(btn => {
        if (btn.classList.contains('active')) period = btn.dataset.period;
    });
    subBtns.forEach(btn => {
        if (btn.classList.contains('active')) subperiod = btn.dataset.subperiod;
    });

    // Показываем/скрываем группу "Текущий/Прошлый"
    const subGroup = document.getElementById('periodSubGroup');
    if (period === 'all') {
        subGroup.style.display = 'none';
    } else {
        subGroup.style.display = '';
    }

    // Параллельно загружаем заказы, клиентов и автомобили
    const [ordersRes, clientsRes, carsRes] = await Promise.all([
        fetch(`${API_URL}/orders`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_URL}/clients`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_URL}/cars`).then(r => r.ok ? r.json() : []).catch(() => [])
    ]);

    const allOrders = ordersRes.length > 0 ? ordersRes : (ordersData || []);
    const clientsCount = clientsRes.length;
    const carsCount = carsRes.length;

    if (!allOrders || allOrders.length === 0) {
        document.getElementById('statisticsContent').innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> Нет данных для статистики
            </div>
        `;
        return;
    }

    const range = getDateRange(period, subperiod);

    // Функция для релевантной даты заказа
    const getOrderDate = (order) => {
        if (order.status === 'Выполнен' && order.completed_date) {
            return new Date(order.completed_date).getTime();
        }
        return order.created_date ? new Date(order.created_date).getTime() : null;
    };

    // Фильтрация по периоду
    let filteredOrders = allOrders;
    if (range) {
        const start = range.start.getTime();
        const end = range.end.getTime();
        filteredOrders = allOrders.filter(order => {
            const date = getOrderDate(order);
            return date && date >= start && date <= end;
        });
    }

    // Метрики
    const completedOrders = filteredOrders.filter(o => o.status === 'Выполнен').length;
    const activeOrders = filteredOrders.filter(o =>
        o.status !== 'Выполнен' && o.status !== 'Отменен'
    ).length;
    const cancelledOrders = filteredOrders.filter(o => o.status === 'Отменен').length;
    const totalRevenue = filteredOrders
        .filter(o => o.status === 'Выполнен' && o.total_price)
        .reduce((sum, o) => sum + parseFloat(o.total_price), 0);
    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // Описание периода
    let periodText = '';
    let extraInfo = '';
    const formatDate = (date) =>
        date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    if (period === 'all') {
        periodText = 'за всё время';
        const allCompleted = allOrders.filter(o => o.status === 'Выполнен');
        if (allCompleted.length > 0) {
            allCompleted.sort((a, b) => {
                const getDate = o => o.completed_date || o.created_date;
                return new Date(getDate(a)) - new Date(getDate(b));
            });
            const firstDate = new Date(allCompleted[0].completed_date || allCompleted[0].created_date);
            extraInfo = `<small class="text-muted">Первый заказ выполнен: ${formatDate(firstDate)}</small>`;
        }
    } else {
        const periodNames = {
            day: { current: 'за сегодня', last: 'за вчера' },
            week: { current: 'за текущую неделю', last: 'за прошлую неделю' },
            month: { current: 'за текущий месяц', last: 'за прошлый месяц' },
            year: { current: 'за текущий год', last: 'за прошлый год' }
        };
        periodText = periodNames[period]?.[subperiod] || '';
        if (range) {
            extraInfo = `<small class="text-muted">${formatDate(range.start)} – ${formatDate(range.end)}</small>`;
        }
    }

    // Количество механиков — можно тоже из API, но пока оставим из DOM (если список загружен)
    const mechanicsCount = document.querySelectorAll('#mechanicsList .list-group-item').length || 0;

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
                        <h1 class="display-5 text-success">${mechanicsCount}</h1>
                        <p class="card-text">Механиков в штате</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center bg-light">
                    <div class="card-body">
                        <h1 class="display-5 text-info">${formatMoney(totalRevenue)}</h1>
                        <p class="card-text">Общая выручка</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-body">
                        <h6>Дополнительная статистика ${periodText}</h6>
                        ${extraInfo ? `<div class="mb-2">${extraInfo}</div>` : ''}
                        <ul class="mb-0 list-unstyled">
                            <li class="mb-2">
                                <i class="bi bi-cash-stack text-success me-2"></i> Средний чек: <strong style="color: #198754;">${formatMoney(averageOrderValue)}</strong>
                            </li>
                            <li class="mb-2">
                                <i class="bi bi-people text-primary me-2"></i> Количество клиентов (всего): <strong>${clientsCount}</strong>
                            </li>
                            <li class="mb-2">
                                <i class="bi bi-car-front text-primary me-2"></i> Количество автомобилей (всего): <strong>${carsCount}</strong>
                            </li>
                            <li class="mb-2">
                                <i class="bi bi-x-circle text-danger me-2"></i> Количество отменённых заказов: <strong style="color: #dc3545;">${cancelledOrders}</strong>
                            </li>
                            <li class="mb-2">
                                <i class="bi bi-clipboard-check text-primary me-2"></i> Общее количество заказов (за период): <strong>${filteredOrders.length}</strong>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('statisticsContent').innerHTML = html;
}

// Инициализация обработчиков кнопок периодов
function initPeriodButtons() {
    const mainGroup = document.getElementById('periodMainGroup');
    const subGroup = document.getElementById('periodSubGroup');

    if (!mainGroup) return;

    mainGroup.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function() {
            mainGroup.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // При переключении на период, не равный 'all', показываем подгруппу и активируем "Текущий"
            if (this.dataset.period !== 'all') {
                subGroup.style.display = '';
                // Сбрасываем выбор на "Текущий"
                subGroup.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
                subGroup.querySelector('[data-subperiod="current"]').classList.add('active');
            } else {
                subGroup.style.display = 'none';
            }
            updateStatistics();
        });
    });

    if (subGroup) {
        subGroup.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', function() {
                subGroup.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                updateStatistics();
            });
        });
    }
}

// Вызовем инициализацию после загрузки страницы (или при открытии вкладки)
document.addEventListener('DOMContentLoaded', () => {
    initPeriodButtons();
});