// Конфигурация
const API_URL = '/api';
let token = null;
let currentUser = null;
let ordersData = [];

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', function() {
    checkAPIStatus();
    loadMechanics();
});

// ==================== ПРОВЕРКА СТАТУСА API ====================
async function checkAPIStatus() {
    try {
        const response = await fetch('/api');
        if (response.ok) {
            const data = await response.json();
            document.getElementById('systemStatus').innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle-fill"></i> API доступен<br>
                    <small class="text-muted">Версия: ${data.version}</small>
                </div>
            `;
        } else {
            const rootResponse = await fetch('/');
            if (rootResponse.ok) {
                document.getElementById('systemStatus').innerHTML = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle-fill"></i> API доступен (базовая проверка)<br>
                        <small class="text-muted">Сервер запущен</small>
                    </div>
                `;
            } else {
                throw new Error('API недоступен');
            }
        }
    } catch (error) {
        document.getElementById('systemStatus').innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-x-circle-fill"></i> Ошибка подключения<br>
                <small class="text-muted">Проверьте запущен ли сервер</small>
            </div>
        `;
    }
}

// ==================== АУТЕНТИФИКАЦИЯ ====================
async function login() {
    const loginInput = document.getElementById('loginInput').value;
    const passwordInput = document.getElementById('passwordInput').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: loginInput, password: passwordInput })
        });
        
        const data = await response.json();
        
        if (response.ok && data.token) {
            token = data.token;
            currentUser = data.user;
            
            document.getElementById('authPanel').style.display = 'none';
            document.getElementById('mainInterface').style.display = 'block';
            
            document.getElementById('userInfo').innerHTML = `
                <span id="statusDot" class="text-success">●</span> 
                <i class="bi bi-person-circle"></i> ${currentUser.full_name} (${currentUser.role})
                <button class="btn btn-sm btn-outline-light ms-2" onclick="logout()">
                    <i class="bi bi-box-arrow-right"></i> Выйти
                </button>
            `;
            
            loadClients();
            loadOrders('active');
            loadRequests();
            loadMechanicsList();
            
            showSuccess('Успешный вход в систему!');
        } else {
            showError(data.error || 'Ошибка аутентификации');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

// ==================== ВЫХОД ИЗ СИСТЕМЫ ====================
function logout() {
    token = null;
    currentUser = null;
    
    document.getElementById('authPanel').style.display = 'block';
    document.getElementById('mainInterface').style.display = 'none';
    
    document.getElementById('userInfo').innerHTML = `
        <span id="statusDot" class="text-warning">●</span> Не авторизован
        <button id="logoutBtn" class="btn btn-sm btn-outline-light ms-2" style="display: none;" onclick="logout()">
            <i class="bi bi-box-arrow-right"></i> Выйти
        </button>
    `;
    
    showSuccess('Вы успешно вышли из системы');
}

// ==================== КЛИЕНТЫ ====================
async function loadClients() {
    try {
        const response = await fetch(`${API_URL}/clients`);
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const clients = await response.json();
        const clientsList = document.getElementById('clientsList');
        
        if (!clients || clients.length === 0) {
            clientsList.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> Клиенты не найдены. Создайте первого клиента.
                </div>
            `;
            return;
        }
        
        // Загружаем количество машин для каждого клиента отдельно
        const clientsWithCarCount = await Promise.all(clients.map(async client => {
            try {
                const carsResponse = await fetch(`${API_URL}/cars/client/${client.client_id}`);
                if (carsResponse.ok) {
                    const cars = await carsResponse.json();
                    client.car_count = cars.length;
                } else {
                    client.car_count = 0;
                }
            } catch {
                client.car_count = 0;
            }
            return client;
        }));
        
        let html = '<div class="list-group">';
        clientsWithCarCount.forEach(client => {
            html += `
                <div class="list-group-item list-group-item-action" id="client-${client.client_id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${client.name}</h6>
                        <div>
                            <small class="text-muted me-2">ID: ${client.client_id}</small>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteClient(${client.client_id})" title="Удалить">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <p class="mb-1">
                        <i class="bi bi-telephone"></i> ${client.phone}
                        ${client.telegram_chat_id ? `<br><i class="bi bi-telegram"></i> Chat ID: ${client.telegram_chat_id}` : ''}
                    </p>
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="loadClientCars(${client.client_id})">
                            <i class="bi bi-car-front"></i> Авто (${client.car_count || 0})
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="createOrderForClient(${client.client_id}, '${client.name.replace(/'/g, "\\'")}')">
                            <i class="bi bi-plus-circle"></i> Новый заказ
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        clientsList.innerHTML = html;
        
        updateClientSelects(clientsWithCarCount);
        
    } catch (error) {
        console.error('Ошибка загрузки клиентов:', error);
        showError('Ошибка загрузки клиентов: ' + error.message);
    }
}

async function deleteClient(clientId) {
    if (!confirm('Вы уверены, что хотите удалить клиента? Все его автомобили и заказы также будут удалены.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/clients/${clientId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showSuccess('Клиент удален');
            document.getElementById(`client-${clientId}`).remove();
            loadClients();
        } else {
            const errorData = await response.json();
            if (errorData.active_orders) {
                showError('Нельзя удалить клиента с активными заказами');
            } else {
                showError(errorData.error || 'Ошибка удаления клиента');
            }
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

async function createClient() {
    const name = document.getElementById('newClientName').value.trim();
    const phone = document.getElementById('newClientPhone').value.trim();
    
    if (!name || !phone) {
        showError('Заполните все обязательные поля');
        return;
    }
    
    const carModel = document.getElementById('newClientCarModel').value.trim();
    const carVin = document.getElementById('newClientCarVin').value.trim();
    const carYear = document.getElementById('newClientCarYear').value.trim();
    const carMileage = document.getElementById('newClientCarMileage').value.trim();
    
    const hasCar = carModel || carVin;
    
    const clientData = { name, phone };
    
    try {
        const response = await fetch(`${API_URL}/clients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        
        if (response.ok) {
            const data = await response.json();
            const newClientId = data.client.client_id;
            
            if (hasCar && newClientId) {
                const carData = {
                    client_id: newClientId,
                    model: carModel || 'Не указана',
                    vin: carVin || null,
                    year: carYear || null,
                    mileage: carMileage || null
                };
                
                try {
                    await fetch(`${API_URL}/cars`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(carData)
                    });
                    
                    showSuccess(`Клиент "${name}" и его автомобиль созданы!`);
                } catch (carError) {
                    showSuccess(`Клиент "${name}" создан, но произошла ошибка при добавлении автомобиля`);
                }
            } else {
                showSuccess(`Клиент "${name}" создан!`);
            }
            
            document.getElementById('newClientName').value = '';
            document.getElementById('newClientPhone').value = '';
            document.getElementById('newClientCarModel').value = '';
            document.getElementById('newClientCarVin').value = '';
            document.getElementById('newClientCarYear').value = '';
            document.getElementById('newClientCarMileage').value = '';
            
            loadClients();
            
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Ошибка создания клиента');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

// ==================== АВТОМОБИЛИ ====================
async function loadClientCars(clientId) {
    try {
        const carsList = document.getElementById('carsList');
        carsList.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Загрузка...</span>
                </div>
                <p class="text-muted mt-2">Загрузка автомобилей...</p>
            </div>
        `;
        
        const response = await fetch(`${API_URL}/cars/client/${clientId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const cars = await response.json();
        
        if (!cars || cars.length === 0) {
            carsList.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> У клиента нет автомобилей
                </div>
            `;
            return;
        }
        
        let html = '<div class="list-group">';
        cars.forEach(car => {
            html += `
                <div class="list-group-item" id="car-${car.car_id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${car.model || 'Модель не указана'}</h6>
                        <div>
                            <small class="text-muted me-2">ID: ${car.car_id}</small>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteCar(${car.car_id})" title="Удалить">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <p class="mb-1">
                        ${car.vin ? `<i class="bi bi-upc"></i> VIN: ${car.vin}<br>` : ''}
                        ${car.gos_number ? `<i class="bi bi-123"></i> Госномер: ${car.gos_number}<br>` : ''}
                        ${car.year ? `<i class="bi bi-calendar"></i> Год: ${car.year}<br>` : ''}
                        ${car.mileage ? `<i class="bi bi-speedometer2"></i> Пробег: ${car.mileage} км` : ''}
                    </p>
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-success" onclick="createOrderForCar(${car.car_id}, ${car.client_id})" title="Создать заказ">
                            <i class="bi bi-plus-circle"></i> Создать заказ
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        carsList.innerHTML = html;
        
        // Показываем вкладку с автомобилями - без передачи event
        showTab('cars');
        
    } catch (error) {
        console.error('Ошибка загрузки автомобилей:', error);
        showError('Ошибка загрузки автомобилей: ' + error.message);
    }
}

async function deleteCar(carId) {
    if (!confirm('Вы уверены, что хотите удалить автомобиль? Все заказы для этого автомобиля также будут удалены.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/cars/${carId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showSuccess('Автомобиль удален');
            document.getElementById(`car-${carId}`).remove();
        } else {
            const errorData = await response.json();
            if (errorData.active_orders) {
                showError('Нельзя удалить автомобиль с активными заказами');
            } else {
                showError(errorData.error || 'Ошибка удаления автомобиля');
            }
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

async function createCar() {
    const clientId = document.getElementById('carClientSelect').value;
    const model = document.getElementById('newCarModel').value.trim();
    
    if (!clientId || !model) {
        showError('Заполните обязательные поля: клиент и модель');
        return;
    }
    
    const carData = {
        client_id: parseInt(clientId),
        model: model,
        vin: document.getElementById('newCarVin').value.trim() || null,
        gos_number: document.getElementById('newCarGosNumber').value.trim() || null,
        year: document.getElementById('newCarYear').value || null,
        mileage: document.getElementById('newCarMileage').value || null
    };
    
    try {
        const response = await fetch(`${API_URL}/cars`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(carData)
        });
        
        if (response.ok) {
            const data = await response.json();
            showSuccess(`Автомобиль "${model}" добавлен!`);
            
            document.getElementById('newCarModel').value = '';
            document.getElementById('newCarVin').value = '';
            document.getElementById('newCarGosNumber').value = '';
            document.getElementById('newCarYear').value = '';
            document.getElementById('newCarMileage').value = '';
            
            loadClientCars(clientId);
            
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Ошибка добавления автомобиля');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

// ==================== ЗАКАЗЫ ====================
async function loadOrders(filter = 'active') {
    try {
        const response = await fetch(`${API_URL}/orders`);
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
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
        
        let filteredOrders = ordersData;
        if (filter === 'active') {
            filteredOrders = ordersData.filter(order => 
                order.status !== 'Выполнен' && order.status !== 'Отменен'
            );
        } else if (filter === 'archive') {
            filteredOrders = ordersData.filter(order => 
                order.status === 'Выполнен' || order.status === 'Отменен'
            );
        } else if (filter !== 'all') {
            filteredOrders = ordersData.filter(order => order.status === filter);
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
            const price = order.total_price ? `${parseFloat(order.total_price).toFixed(2)} ₽` : '—';
            
            html += `
                <div class="list-group-item list-group-item-action" onclick="viewOrder(${order.order_id})" id="order-${order.order_id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">Заказ-наряд #${order.order_id}</h6>
                        <div>
                            <span class="badge bg-primary rounded-pill me-2">${price}</span>
                            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteOrder(${order.order_id})" title="Удалить">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <p class="mb-1">
                        <span class="${statusClass}">
                            <i class="bi bi-circle-fill"></i> ${order.status}
                        </span>
                        ${order.problem_description ? `<br>${order.problem_description.substring(0, 100)}${order.problem_description.length > 100 ? '...' : ''}` : ''}
                    </p>
                    <small class="text-muted">
                        <i class="bi bi-calendar"></i> ${new Date(order.created_date).toLocaleDateString()}
                        | Клиент: ${order.client_name || 'N/A'}
                        ${order.mechanic_id ? `| Механик ID: ${order.mechanic_id}` : ''}
                    </small>
                    <div class="mt-2">
                        ${order.status === 'Готов к выдаче' ? `
                        <button class="btn btn-sm btn-outline-success" onclick="event.stopPropagation(); completeOrder(${order.order_id})">
                            <i class="bi bi-check-lg"></i> Завершить
                        </button>
                        ` : ''}
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

function getStatusClass(status) {
    switch(status) {
        case 'Создан': return 'status-created';
        case 'В работе': return 'status-in-progress';
        case 'На диагностике': return 'status-diagnostic';
        case 'Готов к выдаче': return 'status-ready';
        case 'Выполнен': return 'status-completed';
        case 'Отменен': return 'status-cancelled';
        default: return 'status-created';
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
    document.getElementById('orderClientSelect').value = clientId;
    
    if (document.getElementById('orderClientSelect').dispatchEvent) {
        document.getElementById('orderClientSelect').dispatchEvent(new Event('change'));
    }
    
    showTab('newOrder');
    document.getElementById('orderProblem').focus();
    
    showInfo(`Создание заказа для клиента: ${clientName}`);
}

function createOrderForCar(carId, clientId) {
    document.getElementById('orderClientSelect').value = clientId;
    
    if (document.getElementById('orderClientSelect').dispatchEvent) {
        document.getElementById('orderClientSelect').dispatchEvent(new Event('change'));
    }
    
    setTimeout(() => {
        document.getElementById('orderCarSelect').value = carId;
    }, 500);
    
    showTab('newOrder');
    document.getElementById('orderProblem').focus();
    
    showInfo('Создание заказа для выбранного автомобиля');
}

// ==================== ЗАЯВКИ ИЗ TELEGRAM ====================
async function loadRequests() {
    try {
        const requestsList = document.getElementById('requestsList');
        
        requestsList.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> Интеграция с Telegram в разработке
            </div>
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        requestsList.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Ошибка загрузки заявок
            </div>
        `;
    }
}

// ==================== АРХИВ ====================
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
            const price = order.total_price ? `${parseFloat(order.total_price).toFixed(2)} ₽` : '—';
            
            html += `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">Архивный заказ #${order.order_id}</h6>
                        <div>
                            <span class="badge bg-secondary rounded-pill">${price}</span>
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

// ==================== АВТОМЕХАНИКИ ====================
async function loadMechanicsList() {
    try {
        const response = await fetch(`${API_URL}/mechanics`);
        
        if (!response.ok) {
            const mechanics = [
                { user_id: 2, full_name: 'Петров Алексей', phone: '+79991234567', specialization: 'Двигатель', employee_number: '001', login: 'mechanic' }
            ];
            
            const mechanicsList = document.getElementById('mechanicsList');
            renderMechanicsList(mechanics);
            updateMechanicSelect(mechanics);
            return;
        }
        
        const mechanics = await response.json();
        const mechanicsList = document.getElementById('mechanicsList');
        
        renderMechanicsList(mechanics);
        updateMechanicSelect(mechanics);
        
    } catch (error) {
        console.error('Ошибка загрузки механиков:', error);
        showError('Ошибка загрузки механиков: ' + error.message);
    }
}

function renderMechanicsList(mechanics) {
    const mechanicsList = document.getElementById('mechanicsList');
    
    if (!mechanics || mechanics.length === 0) {
        mechanicsList.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> Механики не найдены
            </div>
        `;
        return;
    }
    
    let html = '<div class="list-group">';
    mechanics.forEach(mechanic => {
        const activeOrders = ordersData ? ordersData.filter(order => 
            order.mechanic_id === mechanic.user_id && 
            order.status !== 'Выполнен' && 
            order.status !== 'Отменен'
        ).length : 0;
        
        html += `
            <div class="list-group-item" id="mechanic-${mechanic.user_id}">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${mechanic.full_name}</h6>
                    <div>
                        <span class="badge ${activeOrders > 0 ? 'bg-warning' : 'bg-success'} me-2">
                            ${activeOrders} активных заказов
                        </span>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteMechanic(${mechanic.user_id})" title="Удалить">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <p class="mb-1">
                    <i class="bi bi-telephone"></i> ${mechanic.phone}<br>
                    <i class="bi bi-wrench"></i> ${mechanic.specialization || 'Не указана'}<br>
                    <i class="bi bi-123"></i> Табельный номер: ${mechanic.employee_number || 'Не указан'}
                </p>
                <div class="mt-2">
                    <button class="btn btn-sm btn-outline-warning" onclick="editMechanic(${mechanic.user_id})">
                        <i class="bi bi-pencil"></i> Редактировать
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    mechanicsList.innerHTML = html;
}

function updateMechanicSelect(mechanics) {
    const mechanicSelect = document.getElementById('orderMechanicSelect');
    mechanicSelect.innerHTML = '<option value="">Не назначен</option>';
    mechanics.forEach(mech => {
        mechanicSelect.innerHTML += `<option value="${mech.user_id}">${mech.full_name}</option>`;
    });
}

async function createMechanic() {
    const fullName = document.getElementById('newMechanicName').value.trim();
    const phone = document.getElementById('newMechanicPhone').value.trim();
    const specialization = document.getElementById('newMechanicSpecialization').value.trim();
    const employeeNumber = document.getElementById('newMechanicEmployeeNumber').value.trim();
    const login = document.getElementById('newMechanicLogin').value.trim();
    const password = document.getElementById('newMechanicPassword').value;
    
    if (!fullName || !phone || !specialization || !employeeNumber || !login || !password) {
        showError('Заполните все поля');
        return;
    }
    
    const mechanicData = {
        full_name: fullName,
        phone: phone,
        specialization: specialization,
        employee_number: employeeNumber,
        login: login,
        password: password
    };
    
    try {
        const response = await fetch(`${API_URL}/mechanics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mechanicData)
        });
        
        if (response.ok) {
            const data = await response.json();
            showSuccess(`Механик "${fullName}" добавлен!`);
            
            document.getElementById('newMechanicName').value = '';
            document.getElementById('newMechanicPhone').value = '';
            document.getElementById('newMechanicSpecialization').value = '';
            document.getElementById('newMechanicEmployeeNumber').value = '';
            document.getElementById('newMechanicLogin').value = '';
            document.getElementById('newMechanicPassword').value = '';
            
            loadMechanicsList();
            
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Ошибка добавления механика');
        }
    } catch (error) {
        showError('Ошибка добавления механика: ' + error.message);
    }
}

async function deleteMechanic(mechanicId) {
    if (!confirm('Вы уверены, что хотите удалить механика?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/mechanics/${mechanicId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showSuccess('Механик удален');
            document.getElementById(`mechanic-${mechanicId}`).remove();
            loadMechanicsList();
        } else {
            const errorData = await response.json();
            if (errorData.active_orders) {
                showError('Нельзя удалить механика с активными заказами');
            } else {
                showError(errorData.error || 'Ошибка удаления механика');
            }
        }
    } catch (error) {
        showError('Ошибка удаления механика: ' + error.message);
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

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function showTab(tabName, event = null) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Убираем активный класс у всех кнопок
    document.querySelectorAll('#mainTabs .nav-link').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показываем выбранную вкладку
    document.getElementById(`${tabName}Tab`).style.display = 'block';
    
    // Активируем кнопку если есть event
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Загружаем данные для определенных вкладок
    switch(tabName) {
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
    }
}

function filterOrders(status, event = null) {
    // Обновляем активную кнопку
    document.querySelectorAll('#ordersTab .btn-group button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Загружаем отфильтрованные заказы
    loadOrders(status === 'all' ? 'all' : status);
}

function updateClientSelects(clients) {
    const carClientSelect = document.getElementById('carClientSelect');
    const orderClientSelect = document.getElementById('orderClientSelect');
    
    [carClientSelect, orderClientSelect].forEach(select => {
        select.innerHTML = '<option value="">Выберите клиента</option>';
        clients.forEach(client => {
            select.innerHTML += `<option value="${client.client_id}">${client.name} (${client.phone})</option>`;
        });
    });
    
    orderClientSelect.addEventListener('change', async function() {
        const clientId = this.value;
        if (!clientId) return;
        
        try {
            const response = await fetch(`${API_URL}/cars/client/${clientId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const cars = await response.json();
            const carSelect = document.getElementById('orderCarSelect');
            
            carSelect.innerHTML = '<option value="">Выберите автомобиль</option>';
            cars.forEach(car => {
                const displayText = `${car.model} ${car.vin ? '(VIN: ' + car.vin + ')' : ''} ${car.gos_number ? '(' + car.gos_number + ')' : ''}`;
                carSelect.innerHTML += `<option value="${car.car_id}">${displayText}</option>`;
            });
        } catch (error) {
            console.error('Ошибка загрузки автомобилей:', error);
            const carSelect = document.getElementById('orderCarSelect');
            carSelect.innerHTML = '<option value="">Ошибка загрузки автомобилей</option>';
        }
    });
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
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    alertDiv.innerHTML = `
        <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-circle' : 'info-circle'}"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Функция для загрузки механиков в выпадающий список
async function loadMechanics() {
    try {
        const response = await fetch(`${API_URL}/mechanics`);
        
        if (!response.ok) {
            const mechanics = [
                { user_id: 2, full_name: 'Петров Алексей' }
            ];
            
            const select = document.getElementById('orderMechanicSelect');
            mechanics.forEach(mech => {
                select.innerHTML += `<option value="${mech.user_id}">${mech.full_name}</option>`;
            });
            return;
        }
        
        const mechanics = await response.json();
        const select = document.getElementById('orderMechanicSelect');
        select.innerHTML = '<option value="">Не назначен</option>';
        mechanics.forEach(mech => {
            select.innerHTML += `<option value="${mech.user_id}">${mech.full_name}</option>`;
        });
    } catch (error) {
        console.error('Ошибка загрузки механиков:', error);
    }
}

// Заглушки для нереализованных функций
function editMechanic(id) { 
    showInfo('Функция редактирования механика в разработке. Используйте удаление и создание нового.'); 
}
function viewOrder(id) { 
    showInfo('Функция детального просмотра заказа в разработке'); 
}