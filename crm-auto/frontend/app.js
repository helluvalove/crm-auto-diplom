// Конфигурация
const API_URL = '/api';
let token = null;
let currentUser = null;
let ordersData = [];


// ==================== ВАЛИДАЦИЯ ====================

// Валидация российского телефона
function validateRussianPhone(phone) {
    if (!phone) {
        return { isValid: false, message: 'Введите номер телефона' };
    }
    
    // Очищаем от пробелов, дефисов, скобок для проверки
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    // Проверяем формат
    if (!/^[\+\d]+$/.test(cleanPhone)) {
        return { isValid: false, message: 'Телефон может содержать только цифры и знак + в начале' };
    }
    
    if (cleanPhone.startsWith('+7') && cleanPhone.length === 12) {
        return { isValid: true, phone: cleanPhone };
    } else if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
        return { isValid: true, phone: '+7' + cleanPhone.slice(1) };
    } else if (cleanPhone.startsWith('7') && cleanPhone.length === 11) {
        return { isValid: true, phone: '+' + cleanPhone };
    } else {
        let message = '';
        if (!cleanPhone.startsWith('+7') && !cleanPhone.startsWith('8') && !cleanPhone.startsWith('7')) {
            message = 'Телефон должен начинаться с +7, 8 или 7';
        } else if (cleanPhone.length < 11) {
            const enteredDigits = cleanPhone.length - (cleanPhone.startsWith('+7') ? 2 : 
                            cleanPhone.startsWith('+') ? 1 : 0);
            const neededDigits = 11 - enteredDigits;
            message = `Введите еще ${neededDigits} цифр`;
        } else if (cleanPhone.length > 12) {
            message = 'Слишком много цифр. Должно быть 11 цифр после +7';
        } else {
            message = 'Неверный формат. Используйте +7XXX XXX-XX-XX, 8XXX XXX-XX-XX или 7XXX XXX-XX-XX';
        }
        return { isValid: false, message: message };
    }
}

// Валидация имени
function validateName(name) {
    if (!name) {
        return { isValid: false, message: 'Введите имя клиента' };
    }
    
    const trimmedName = name.trim();
    
    if (trimmedName.length < 2) {
        return { isValid: false, message: 'Имя должно содержать минимум 2 символа' };
    }
    
    if (trimmedName.length > 100) {
        return { isValid: false, message: 'Имя не должно превышать 100 символов' };
    }
    
    if (!/^[a-zA-Zа-яА-ЯёЁ\s\-]+$/.test(trimmedName)) {
        return { isValid: false, message: 'Имя может содержать только буквы, пробелы и дефисы' };
    }
    
    return { isValid: true, name: trimmedName };
}

// Форматирование телефона при вводе
function formatPhoneInput(input) {
    let value = input.value;
    
    // Удаляем все нецифровые символы кроме плюса в начале
    let cleaned = value.replace(/\D/g, '');
    
    // Сохраняем плюс если он был в начале
    if (value.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    
    // Если начинается с 8 или 7, заменяем на +7
    if (cleaned.startsWith('8') || cleaned.startsWith('7')) {
        cleaned = '+7' + cleaned.slice(1);
    }
    
    // Ограничиваем длину (максимум 12 символов: +7XXXXXXXXXX)
    if (cleaned.length > 12) {
        cleaned = cleaned.slice(0, 12);
    }
    
    // Форматируем только если есть хотя бы +7
    if (cleaned.startsWith('+7') && cleaned.length > 2) {
        let formatted = cleaned;
        const digits = cleaned.slice(2); // Берем только цифры после +7
        
        // Форматируем как +7 (XXX) XXX-XX-XX
        if (digits.length > 0) {
            formatted = '+7';
            if (digits.length > 0) formatted += ' (' + digits.slice(0, 3);
            if (digits.length > 3) formatted += ') ' + digits.slice(3, 6);
            if (digits.length > 6) formatted += '-' + digits.slice(6, 8);
            if (digits.length > 8) formatted += '-' + digits.slice(8, 10);
        }
        
        input.value = formatted;
    } else {
        input.value = cleaned;
    }
    
    // Валидируем после форматирования
    setTimeout(() => {
        const validation = validateRussianPhone(input.value);
        showFieldError(input.id, validation.isValid ? null : validation.message);
    }, 10);
}

// Показать ошибку под полем ввода
function showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const errorId = inputId + 'Error';
    
    // Удаляем старую ошибку если есть
    const oldError = document.getElementById(errorId);
    if (oldError) {
        oldError.remove();
    }
    
    // Убираем классы валидации
    input.classList.remove('is-valid', 'is-invalid');
    
    if (message) {
        // Добавляем класс ошибки
        input.classList.add('is-invalid');
        
        // Создаем элемент с ошибкой
        const errorDiv = document.createElement('div');
        errorDiv.id = errorId;
        errorDiv.className = 'invalid-feedback';
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Добавляем после поля ввода
        input.parentNode.appendChild(errorDiv);
    } else if (input.value.trim()) {
        // Если сообщения нет и поле не пустое, показываем успех
        input.classList.add('is-valid');
    }
}

// Валидация всего клиента на клиенте
function validateClientOnClient(name, phone) {
    const nameValidation = validateName(name);
    const phoneValidation = validateRussianPhone(phone);
    
    let isValid = true;
    
    // Показываем ошибки
    showFieldError('newClientName', nameValidation.isValid ? null : nameValidation.message);
    showFieldError('newClientPhone', phoneValidation.isValid ? null : phoneValidation.message);
    
    if (!nameValidation.isValid || !phoneValidation.isValid) {
        isValid = false;
    }
    
    return {
        isValid,
        name: nameValidation.name,
        phone: phoneValidation.phone
    };
}

function initializeValidation() {
    // Валидация телефона при вводе
    const phoneInput = document.getElementById('newClientPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            // Разрешаем ввод любых символов, но форматируем
            formatPhoneInput(this);
        });
        
        phoneInput.addEventListener('keydown', function(e) {
            // Разрешаем: цифры, Backspace, Delete, Tab, стрелки
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
            
            // Разрешаем Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            if (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
                return;
            }
            
            // Разрешаем цифры
            if (e.key >= '0' && e.key <= '9') {
                return;
            }
            
            // Разрешаем + только в начале
            if (e.key === '+' && (this.selectionStart === 0 || this.value === '')) {
                return;
            }
            
            // Разрешаем специальные клавиши
            if (allowedKeys.includes(e.key)) {
                return;
            }
            
            // Блокируем все остальное
            e.preventDefault();
        });
        
        phoneInput.addEventListener('blur', function() {
            const validation = validateRussianPhone(this.value);
            showFieldError('newClientPhone', validation.isValid ? null : validation.message);
            
            // Если поле пустое, сбрасываем форматирование
            if (!this.value) {
                showFieldError('newClientPhone', null);
            }
        });
        
        phoneInput.addEventListener('focus', function() {
            // При фокусе, если поле пустое, ставим +7
            if (!this.value) {
                this.value = '+7 ';
            }
        });
    }
    
    // Валидация имени при вводе
    const nameInput = document.getElementById('newClientName');
    if (nameInput) {
        nameInput.addEventListener('input', function() {
            const validation = validateName(this.value);
            showFieldError('newClientName', validation.isValid ? null : validation.message);
        });
        
        nameInput.addEventListener('blur', function() {
            const validation = validateName(this.value);
            showFieldError('newClientName', validation.isValid ? null : validation.message);
        });
    }
    
    // Добавляем валидацию для телефона механика
    const mechanicPhoneInput = document.getElementById('newMechanicPhone');
    if (mechanicPhoneInput) {
        mechanicPhoneInput.addEventListener('input', function(e) {
            formatPhoneInput(this);
        });
        
        mechanicPhoneInput.addEventListener('keydown', function(e) {
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
            
            if (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
                return;
            }
            
            if (e.key >= '0' && e.key <= '9') {
                return;
            }
            
            if (e.key === '+' && (this.selectionStart === 0 || this.value === '')) {
                return;
            }
            
            if (allowedKeys.includes(e.key)) {
                return;
            }
            
            e.preventDefault();
        });
        
        mechanicPhoneInput.addEventListener('focus', function() {
            if (!this.value) {
                this.value = '+7 ';
            }
        });
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', function() {
    checkAPIStatus();
    loadMechanics();
    initializeValidation();
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

async function showClientCarsModal(clientId, clientName) {
    try {
        // Загружаем автомобили клиента
        const response = await fetch(`${API_URL}/cars/client/${clientId}`);
        if (!response.ok) {
            throw new Error(`Ошибка загрузки автомобилей: ${response.status}`);
        }
        
        const cars = await response.json();
        
        // Загружаем активные заказы для определения статуса автомобилей
        const ordersResponse = await fetch(`${API_URL}/orders`);
        const allOrders = ordersResponse.ok ? await ordersResponse.json() : [];
        const activeOrders = allOrders.filter(order => 
            order.status !== 'Выполнен' && order.status !== 'Отменен'
        );
        
        // Создаем модальное окно
        let carsHtml = '';
        
        if (!cars || cars.length === 0) {
            carsHtml = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> У клиента нет автомобилей
                </div>
            `;
        } else {
            carsHtml = '<div class="list-group">';
            
            cars.forEach(car => {
                // Находим активные заказы для этого автомобиля
                const carOrders = activeOrders.filter(order => order.car_id === car.car_id);
                const hasActiveOrders = carOrders.length > 0;
                const hasOrderInWork = carOrders.some(o => o.status === 'В работе');
                const hasOrderReady = carOrders.some(o => o.status === 'Готов к выдаче');
                const hasOrderDiagnostic = carOrders.some(o => o.status === 'На диагностике');
                
                // Определяем статус автомобиля
                let carStatus = 'Свободен';
                let statusBadge = '<span class="badge bg-success">Свободен</span>';
                let statusIcon = '<i class="bi bi-check-circle text-success"></i>';
                
                if (hasOrderInWork) {
                    carStatus = 'В работе';
                    statusBadge = '<span class="badge bg-warning">В работе</span>';
                    statusIcon = '<i class="bi bi-tools text-warning"></i>';
                } else if (hasOrderReady) {
                    carStatus = 'Готов к выдаче';
                    statusBadge = '<span class="badge bg-success">Готов</span>';
                    statusIcon = '<i class="bi bi-check-circle-fill text-success"></i>';
                } else if (hasOrderDiagnostic) {
                    carStatus = 'На диагностике';
                    statusBadge = '<span class="badge bg-info">Диагностика</span>';
                    statusIcon = '<i class="bi bi-clipboard-pulse text-info"></i>';
                } else if (hasActiveOrders) {
                    carStatus = 'В сервисе';
                    statusBadge = '<span class="badge bg-secondary">В сервисе</span>';
                    statusIcon = '<i class="bi bi-clock-history text-secondary"></i>';
                }
                
                // Информация о заказах
                let ordersInfo = '';
                if (carOrders.length > 0) {
                    ordersInfo = '<div class="small mt-2"><strong>Активные заказы:</strong><br>';
                    carOrders.forEach(order => {
                        const orderDate = new Date(order.created_date).toLocaleDateString();
                        ordersInfo += `• #${order.order_id}: ${order.status} (${orderDate})<br>`;
                    });
                    ordersInfo += '</div>';
                }
                
                carsHtml += `
                    <div class="list-group-item">
                        <div class="d-flex w-100 justify-content-between">
                            <h6 class="mb-1">
                                ${statusIcon} ${car.model || 'Модель не указана'}
                            </h6>
                            <div>
                                ${statusBadge}
                            </div>
                        </div>
                        <p class="mb-1">
                            ${car.vin ? `<i class="bi bi-upc"></i> VIN: ${car.vin}<br>` : ''}
                            ${car.gos_number ? `<i class="bi bi-123"></i> Госномер: ${car.gos_number}<br>` : ''}
                            ${car.year ? `<i class="bi bi-calendar"></i> Год: ${car.year}<br>` : ''}
                            ${car.mileage ? `<i class="bi bi-speedometer2"></i> Пробег: ${car.mileage} км<br>` : ''}
                            <strong>Статус:</strong> ${carStatus}<br>
                            <strong>Активных заказов:</strong> ${carOrders.length}
                        </p>
                        ${ordersInfo}
                        <div class="mt-2">
                            <button class="btn btn-sm btn-outline-primary" onclick="closeModalAndLoadClientCars(${clientId})" title="Подробнее">
                                <i class="bi bi-info-circle"></i> Подробнее
                            </button>
                            <button class="btn btn-sm btn-outline-success" onclick="createOrderForCar(${car.car_id}, ${clientId})" 
                                    title="Создать заказ" ${hasOrderInWork ? 'disabled' : ''}>
                                <i class="bi bi-plus-circle"></i> Новый заказ
                            </button>
                            ${hasOrderInWork ? '<small class="text-danger ms-2">Автомобиль уже в работе!</small>' : ''}
                        </div>
                    </div>
                `;
            });
            
            carsHtml += '</div>';
        }
        
        const modalHtml = `
            <div class="modal fade" id="clientCarsModal" tabindex="-1" aria-labelledby="clientCarsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="clientCarsModalLabel">
                                <i class="bi bi-person"></i> Автомобили клиента: ${clientName}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info mb-3">
                                <i class="bi bi-info-circle"></i> Здесь отображаются все автомобили клиента и их текущий статус в сервисе.
                            </div>
                            ${carsHtml}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
                            <button type="button" class="btn btn-primary" onclick="closeModalAndLoadClientCars(${clientId})">
                                <i class="bi bi-arrow-right"></i> Перейти к автомобилям
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Удаляем старые модальные окна если есть
        const oldModal = document.getElementById('clientCarsModal');
        if (oldModal) oldModal.remove();
        
        // Добавляем модальное окно в DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Показываем модальное окно
        const modal = new bootstrap.Modal(document.getElementById('clientCarsModal'));
        modal.show();
        
    } catch (error) {
        console.error('Ошибка загрузки автомобилей клиента:', error);
        showError('Ошибка загрузки автомобилей клиента: ' + error.message);
    }
}

function closeModalAndLoadClientCars(clientId) {
    // Закрываем модальное окно
    const modalElement = document.getElementById('clientCarsModal');
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
        // Удаляем элемент из DOM
        modalElement.remove();
    }
    
    // Ждем немного, чтобы модальное окно успело закрыться
    setTimeout(() => {
        // Загружаем автомобили клиента
        loadClientCars(clientId);
    }, 300);
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
                    
                    // Загружаем информацию о статусе автомобилей
                    const ordersResponse = await fetch(`${API_URL}/orders`);
                    const allOrders = ordersResponse.ok ? await ordersResponse.json() : [];
                    const activeOrders = allOrders.filter(order => 
                        order.status !== 'Выполнен' && order.status !== 'Отменен'
                    );
                    
                    // Считаем автомобили в работе
                    let carsInWork = 0;
                    let carsReady = 0;
                    let carsDiagnostic = 0;
                    
                    cars.forEach(car => {
                        const carOrders = activeOrders.filter(order => order.car_id === car.car_id);
                        if (carOrders.some(o => o.status === 'В работе')) carsInWork++;
                        if (carOrders.some(o => o.status === 'Готов к выдаче')) carsReady++;
                        if (carOrders.some(o => o.status === 'На диагностике')) carsDiagnostic++;
                    });
                    
                    client.cars_in_work = carsInWork;
                    client.cars_ready = carsReady;
                    client.cars_diagnostic = carsDiagnostic;
                    
                } else {
                    client.car_count = 0;
                    client.cars_in_work = 0;
                    client.cars_ready = 0;
                    client.cars_diagnostic = 0;
                }
            } catch {
                client.car_count = 0;
                client.cars_in_work = 0;
                client.cars_ready = 0;
                client.cars_diagnostic = 0;
            }
            return client;
        }));
        
        let html = '<div class="list-group">';
        clientsWithCarCount.forEach(client => {
            // Определяем цвет иконки в зависимости от статуса авто
            let carIconClass = 'bi-car-front';
            let carIconColor = 'text-primary';
            let carStatusBadge = '';
            
            if (client.cars_in_work > 0) {
                carIconClass = 'bi-tools';
                carIconColor = 'text-warning';
                carStatusBadge = `<span class="badge bg-warning ms-1">${client.cars_in_work} в работе</span>`;
            } else if (client.cars_ready > 0) {
                carIconClass = 'bi-check-circle';
                carIconColor = 'text-success';
                carStatusBadge = `<span class="badge bg-success ms-1">${client.cars_ready} готовы</span>`;
            } else if (client.cars_diagnostic > 0) {
                carIconClass = 'bi-clipboard-pulse';
                carIconColor = 'text-info';
                carStatusBadge = `<span class="badge bg-info ms-1">${client.cars_diagnostic} на диагностике</span>`;
            } else if (client.car_count > 0) {
                carIconClass = 'bi-car-front';
                carIconColor = 'text-secondary';
                carStatusBadge = `<span class="badge bg-secondary ms-1">${client.car_count} авто</span>`;
            }
            
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
                        <button class="btn btn-sm btn-outline-primary" onclick="showClientCarsModal(${client.client_id}, '${client.name.replace(/'/g, "\\'")}')">
                            <i class="bi ${carIconClass} ${carIconColor}"></i> Авто (${client.car_count || 0}) ${carStatusBadge}
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
    console.log('=== DEBUG DELETE CLIENT ===');
    console.log('Client ID to delete:', clientId);
    console.log('Current token:', token);
    console.log('Current user:', currentUser);
    
    if (!confirm('Вы уверены, что хотите удалить клиента?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/clients/${clientId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok) {
            showSuccess(`Клиент удален. Удалено ${data.deleted_cars} авто и ${data.deleted_orders} заказов.`);
            document.getElementById(`client-${clientId}`).remove();
            loadClients();
        } else {
            // Проверяем разные типы ошибок
            console.log('Error data:', data);
            
            if (data.error && data.error.includes('Доступ запрещен')) {
                showError('У вас недостаточно прав для удаления клиентов. Обратитесь к менеджеру.');
            } else if (data.active_orders) {
                showError(`Нельзя удалить клиента с активными заказами (ID: ${data.active_orders.join(', ')}). Сначала завершите или удалите эти заказы.`);
            } else if (data.error && data.error.includes('Требуется авторизация')) {
                showError('Ошибка авторизации. Пожалуйста, войдите заново.');
                logout();
            } else {
                showError(data.error || 'Ошибка удаления клиента');
            }
        }
    } catch (error) {
        console.error('Network error:', error);
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

async function createClient() {
    const nameInput = document.getElementById('newClientName');
    const phoneInput = document.getElementById('newClientPhone');
    const carModelInput = document.getElementById('newClientCarModel');
    const carVinInput = document.getElementById('newClientCarVin');
    const carGosNumberInput = document.getElementById('newClientCarGosNumber');
    const carYearInput = document.getElementById('newClientCarYear');
    const carMileageInput = document.getElementById('newClientCarMileage');
    
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    
    // Клиентская валидация
    const validation = validateClientOnClient(name, phone);
    if (!validation.isValid) {
        showError('Исправьте ошибки в форме клиента');
        return;
    }
    
    const carModel = carModelInput.value.trim();
    const carVin = carVinInput.value.trim().toUpperCase();
    const carGosNumber = carGosNumberInput.value.trim().toUpperCase();
    const carYear = carYearInput.value ? parseInt(carYearInput.value.trim()) : null;
    const carMileage = carMileageInput.value ? parseInt(carMileageInput.value.trim()) : null;
    
    // Проверяем, заполнены ли хоть какие-то поля автомобиля
    const hasCarData = carModel || carVin || carGosNumber || carYear || carMileage;
    
    // Если заполнено хоть одно поле автомобиля, проверяем все обязательные
    if (hasCarData) {
        const errors = [];
        
        if (!carModel) {
            errors.push('Поле "Модель автомобиля" обязательно для заполнения');
        }
        
        if (!carVin) {
            errors.push('Поле "VIN номер" обязательно для заполнения');
        } else if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(carVin)) {
            errors.push('Неверный формат VIN номера автомобиля. Должно быть ровно 17 символов (цифры и заглавные латинские буквы, кроме I, O, Q)');
        }
        
        if (!carGosNumber) {
            errors.push('Поле "Госномер" обязательно для заполнения');
        } else if (!/^[А-Я][0-9]{3}[А-Я]{2}[0-9]{2,3}$|^[А-Я]{2}[0-9]{3}[0-9]{2,3}$/.test(carGosNumber)) {
            errors.push('Неверный формат госномера автомобиля. Примеры: А123БВ77, ВС12345');
        }
        
        if (!carYear) {
            errors.push('Поле "Год выпуска" обязательно для заполнения');
        } else if (carYear < 1900 || carYear > new Date().getFullYear() + 1) {
            errors.push(`Год выпуска автомобиля должен быть в диапазоне от 1900 до ${new Date().getFullYear() + 1}`);
        }
        
        if (!carMileage) {
            errors.push('Поле "Пробег" обязательно для заполнения');
        } else if (carMileage < 0 || carMileage > 1000000) {
            errors.push('Пробег автомобиля должен быть в диапазоне от 0 до 1,000,000 км');
        }
        
        if (errors.length > 0) {
            showError(errors.join('<br>'));
            return;
        }
    }
    
    const clientData = { 
        name: validation.name, 
        phone: validation.phone 
    };
    
    try {
        // 1. Сначала создаем клиента (с авторизацией)
        const clientResponse = await fetch(`${API_URL}/clients`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(clientData)
        });
        
        const clientResponseData = await clientResponse.json();
        
        if (!clientResponse.ok) {
            // Обработка ошибок клиента
            if (clientResponse.status === 401) {
                showError('Ошибка авторизации. Пожалуйста, войдите заново.');
                logout();
                return;
            }
            throw new Error(clientResponseData.error || 'Ошибка создания клиента');
        }
        
        const newClientId = clientResponseData.client.client_id;
        
        // 2. Если есть данные об автомобиле, создаем его (тоже с авторизацией)
        if (hasCarData && newClientId) {
            const carData = {
                client_id: newClientId,
                model: carModel,
                vin: carVin,
                gos_number: carGosNumber,
                year: carYear,
                mileage: carMileage
            };
            
            const carResponse = await fetch(`${API_URL}/cars`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(carData)
            });
            
            const carResponseData = await carResponse.json();
            
            if (!carResponse.ok) {
                // Если авто не создалось, удаляем клиента
                await fetch(`${API_URL}/clients/${newClientId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                // Показываем конкретную ошибку
                if (carResponseData.details && carResponseData.details.vin) {
                    throw new Error(`Автомобиль не создан: ${carResponseData.details.vin}. Клиент также удален.`);
                } else {
                    throw new Error(`Автомобиль не создан: ${carResponseData.error || 'Неизвестная ошибка'}. Клиент также удален.`);
                }
            }
            
            // Успех - клиент и авто созданы
            showSuccess(`Клиент "${validation.name}" и его автомобиль "${carModel}" созданы!`);
        } else {
            // Успех - только клиент создан
            showSuccess(`Клиент "${validation.name}" создан!`);
        }
        
        // 3. Очищаем форму
        nameInput.value = '';
        phoneInput.value = '';
        carModelInput.value = '';
        carVinInput.value = '';
        if (carGosNumberInput) carGosNumberInput.value = '';
        carYearInput.value = '';
        carMileageInput.value = '';
        
        // Очищаем ошибки
        showFieldError('newClientName', null);
        showFieldError('newClientPhone', null);
        
        loadClients();
        
    } catch (error) {
        // Обработка всех ошибок
        showError(error.message);
    }
}

// ==================== АВТОМОБИЛИ (ИСПРАВЛЕННАЯ ВЕРСИЯ) ====================
async function loadAllCarsInService() {
    try {
        const carsList = document.getElementById('carsList');
        carsList.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Загрузка...</span>
                </div>
                <p class="text-muted mt-2">Загрузка автомобилей в сервисе...</p>
            </div>
        `;
        
        // 1. Загружаем все активные заказы
        const ordersResponse = await fetch(`${API_URL}/orders`);
        if (!ordersResponse.ok) {
            throw new Error(`HTTP error ${ordersResponse.status}`);
        }
        
        const allOrders = await ordersResponse.json();
        const activeOrders = allOrders.filter(order => 
            order.status !== 'Выполнен' && order.status !== 'Отменен'
        );
        
        if (!activeOrders || activeOrders.length === 0) {
            carsList.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> Сейчас нет автомобилей в сервисе
                </div>
            `;
            return;
        }
        
        // 2. Собираем уникальные car_id из активных заказов
        const carIds = [...new Set(activeOrders.map(order => order.car_id))];
        
        // 3. Загружаем информацию об автомобилях
        const carsWithOwners = await Promise.all(
            carIds.map(async (carId) => {
                try {
                    // Загружаем информацию об автомобиле
                    const carResponse = await fetch(`${API_URL}/cars/${carId}`);
                    if (!carResponse.ok) {
                        console.error(`Ошибка загрузки автомобиля ${carId}`);
                        return null;
                    }
                    
                    const car = await carResponse.json();
                    
                    // Загружаем информацию о владельце
                    const clientResponse = await fetch(`${API_URL}/clients/${car.client_id}`);
                    if (!clientResponse.ok) {
                        console.error(`Ошибка загрузки клиента ${car.client_id}`);
                        return null;
                    }
                    
                    const client = await clientResponse.json();
                    
                    // Находим все активные заказы для этого автомобиля
                    const carOrders = activeOrders.filter(order => order.car_id === carId);
                    
                    return {
                        car: car,
                        client: client,
                        orders: carOrders,
                        active_orders_count: carOrders.length
                    };
                } catch (error) {
                    console.error(`Ошибка загрузки данных для автомобиля ${carId}:`, error);
                    return null;
                }
            })
        );
        
        // 4. Фильтруем null значения и проверяем, есть ли данные
        const validCars = carsWithOwners.filter(item => item !== null);
        
        if (validCars.length === 0) {
            carsList.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> Не удалось загрузить данные об автомобилях в сервисе
                </div>
            `;
            return;
        }
        
        // 5. Отображаем список автомобилей
        let html = '<div class="list-group">';
        
        validCars.forEach(item => {
            const car = item.car;
            const client = item.client;
            const orders = item.orders;
            
            // Определяем статус автомобиля на основе статусов заказов
            let carStatus = 'Создан';
            let statusBadge = '';
            
            if (orders.some(o => o.status === 'В работе')) {
                carStatus = 'В работе';
                statusBadge = '<span class="badge bg-warning">В работе</span>';
            } else if (orders.some(o => o.status === 'Готов к выдаче')) {
                carStatus = 'Готов к выдаче';
                statusBadge = '<span class="badge bg-success">Готов</span>';
            } else if (orders.some(o => o.status === 'Создан' || o.status === 'На диагностике')) {
                carStatus = 'На диагностике';
                statusBadge = '<span class="badge bg-info">Диагностика</span>';
            } else {
                carStatus = 'В сервисе';
                statusBadge = '<span class="badge bg-secondary">В сервисе</span>';
            }
            
            // Информация о заказах
            let ordersInfo = '';
            if (orders.length > 0) {
                ordersInfo = '<div class="small mt-2"><strong>Заказы:</strong><br>';
                orders.forEach(order => {
                    const orderDate = new Date(order.created_date).toLocaleDateString();
                    ordersInfo += `• #${order.order_id}: ${order.status} (${orderDate})<br>`;
                });
                ordersInfo += '</div>';
            }
            
            html += `
                <div class="list-group-item" id="car-service-${car.car_id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${car.model || 'Модель не указана'}</h6>
                        <div>
                            ${statusBadge}
                            <button class="btn btn-sm btn-outline-warning ms-1" onclick="editCar(${car.car_id})" title="Редактировать">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteCar(${car.car_id})" title="Удалить">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <p class="mb-1">
                        <strong>Владелец:</strong> ${client.name} (тел: ${client.phone})<br>
                        ${car.vin ? `<i class="bi bi-upc"></i> VIN: ${car.vin}<br>` : ''}
                        ${car.gos_number ? `<i class="bi bi-123"></i> Госномер: ${car.gos_number}<br>` : ''}
                        ${car.year ? `<i class="bi bi-calendar"></i> Год: ${car.year}<br>` : ''}
                        ${car.mileage ? `<i class="bi bi-speedometer2"></i> Пробег: ${car.mileage} км<br>` : ''}
                        <strong>Статус:</strong> ${carStatus}<br>
                        <strong>Активных заказов:</strong> ${item.active_orders_count}
                    </p>
                    ${ordersInfo}
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="loadClientCars(${client.client_id})" title="Показать все авто клиента">
                            <i class="bi bi-person"></i> Все авто клиента
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="createOrderForCar(${car.car_id}, ${client.client_id})" title="Создать заказ">
                            <i class="bi bi-plus-circle"></i> Новый заказ
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        carsList.innerHTML = html;
        
        // Если мы уже на вкладке автомобилей, обновляем выпадающий список клиентов
        if (document.getElementById('carsTab').style.display === 'block') {
            const clientsResponse = await fetch(`${API_URL}/clients`);
            if (clientsResponse.ok) {
                const clients = await clientsResponse.json();
                updateClientSelectsForCars(clients);
            }
        }
        
    } catch (error) {
        console.error('Ошибка загрузки автомобилей в сервисе:', error);
        showError('Ошибка загрузки автомобилей в сервисе: ' + error.message);
        
        // Показываем альтернативный интерфейс в случае ошибки
        document.getElementById('carsList').innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Не удалось загрузить список автомобилей в сервисе.
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="loadAllCarsInService()">
                    <i class="bi bi-arrow-clockwise"></i> Попробовать снова
                </button>
            </div>
        `;
    }
}

// Новая функция для обновления выпадающего списка клиентов на вкладке автомобилей
function updateClientSelectsForCars(clients) {
    const carClientSelect = document.getElementById('carClientSelect');
    
    if (carClientSelect) {
        carClientSelect.innerHTML = '<option value="">Выберите клиента</option>';
        clients.forEach(client => {
            carClientSelect.innerHTML += `<option value="${client.client_id}">${client.name} (${client.phone})</option>`;
        });
    }
}

// Оставляем старую функцию loadClientCars для использования из других мест
async function loadClientCars(clientId) {
    try {
        const carsList = document.getElementById('carsList');
        carsList.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Загрузка...</span>
                </div>
                <p class="text-muted mt-2">Загрузка автомобилей клиента...</p>
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
        
        // Получаем информацию о клиенте
        const clientResponse = await fetch(`${API_URL}/clients/${clientId}`);
        const client = clientResponse.ok ? await clientResponse.json() : { name: 'Неизвестный клиент', phone: 'N/A' };
        
        // Загружаем активные заказы для определения статуса автомобилей
        const ordersResponse = await fetch(`${API_URL}/orders`);
        const allOrders = ordersResponse.ok ? await ordersResponse.json() : [];
        const activeOrders = allOrders.filter(order => 
            order.status !== 'Выполнен' && order.status !== 'Отменен'
        );
        
        let html = `
            <div class="mb-3">
                <div class="alert alert-primary">
                    <i class="bi bi-person"></i> Клиент: <strong>${client.name}</strong> (тел: ${client.phone})
                    <button class="btn btn-sm btn-outline-primary float-end" onclick="loadAllCarsInService()">
                        <i class="bi bi-arrow-left"></i> Все авто в сервисе
                    </button>
                </div>
            </div>
            <div class="list-group">
        `;
        
        cars.forEach(car => {
            // Находим активные заказы для этого автомобиля
            const carOrders = activeOrders.filter(order => order.car_id === car.car_id);
            const hasActiveOrders = carOrders.length > 0;
            const hasOrderInWork = carOrders.some(o => o.status === 'В работе');
            
            // Определяем статус автомобиля
            let carStatus = 'Нет активных заказов';
            let statusBadge = '';
            
            if (hasOrderInWork) {
                carStatus = 'В работе';
                statusBadge = '<span class="badge bg-warning ms-1">В работе</span>';
            } else if (hasActiveOrders) {
                carStatus = 'В сервисе';
                statusBadge = '<span class="badge bg-secondary ms-1">В сервисе</span>';
            }
            
            html += `
                <div class="list-group-item" id="car-${car.car_id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${car.model || 'Модель не указана'} ${statusBadge}</h6>
                        <div>
                            <small class="text-muted me-2">ID: ${car.car_id}</small>
                            <button class="btn btn-sm btn-outline-warning" onclick="editCar(${car.car_id})" title="Редактировать">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteCar(${car.car_id})" title="Удалить">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <p class="mb-1">
                        ${car.vin ? `<i class="bi bi-upc"></i> VIN: ${car.vin}<br>` : ''}
                        ${car.gos_number ? `<i class="bi bi-123"></i> Госномер: ${car.gos_number}<br>` : ''}
                        ${car.year ? `<i class="bi bi-calendar"></i> Год: ${car.year}<br>` : ''}
                        ${car.mileage ? `<i class="bi bi-speedometer2"></i> Пробег: ${car.mileage} км<br>` : ''}
                        <strong>Статус:</strong> ${carStatus}<br>
                        <strong>Активных заказов:</strong> ${carOrders.length}
                    </p>
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-success" onclick="createOrderForCar(${car.car_id}, ${car.client_id})" 
                                title="Создать заказ" ${hasOrderInWork ? 'disabled' : ''}>
                            <i class="bi bi-plus-circle"></i> Новый заказ
                        </button>
                        ${hasOrderInWork ? '<small class="text-danger ms-2">Автомобиль уже в работе!</small>' : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        carsList.innerHTML = html;
        
        // Переключаемся на вкладку автомобилей
        showTab('cars', null);
        
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
            // Обновляем список автомобилей в сервисе
            loadAllCarsInService();
        } else {
            const errorData = await response.json();
            if (errorData.active_orders) {
                showError('Нельзя удалить автомобиль с активными заказами. Сначала завершите или удалите заказы.');
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
    const vin = document.getElementById('newCarVin').value.trim().toUpperCase();
    const gosNumber = document.getElementById('newCarGosNumber').value.trim().toUpperCase();
    const year = document.getElementById('newCarYear').value;
    const mileage = document.getElementById('newCarMileage').value;
    
    // Проверка обязательных полей
    const errors = [];
    
    if (!clientId) {
        errors.push('Выберите клиента');
    }
    
    if (!model) {
        errors.push('Поле "Модель автомобиля" обязательно для заполнения');
    }
    
    if (!vin) {
        errors.push('Поле "VIN номер" обязательно для заполнения');
    } else if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        errors.push('Неверный формат VIN номера. Должно быть ровно 17 символов (цифры и заглавные латинские буквы, кроме I, O, Q)');
    }
    
    if (!gosNumber) {
        errors.push('Поле "Госномер" обязательно для заполнения');
    } else if (!/^[А-Я][0-9]{3}[А-Я]{2}[0-9]{2,3}$|^[А-Я]{2}[0-9]{3}[0-9]{2,3}$/.test(gosNumber)) {
        errors.push('Неверный формат госномера. Примеры правильных форматов: А123БВ77, ВС12345');
    }
    
    if (!year) {
        errors.push('Поле "Год выпуска" обязательно для заполнения');
    } else {
        const currentYear = new Date().getFullYear();
        const yearNum = parseInt(year);
        if (yearNum < 1900 || yearNum > currentYear + 1) {
            errors.push(`Год выпуска должен быть в диапазоне от 1900 до ${currentYear + 1}`);
        } else if (isNaN(yearNum)) {
            errors.push('Год выпуска должен быть числом');
        }
    }
    
    if (!mileage) {
        errors.push('Поле "Пробег" обязательно для заполнения');
    } else {
        const mileageNum = parseInt(mileage);
        if (mileageNum < 0 || mileageNum > 1000000) {
            errors.push('Пробег должен быть в диапазоне от 0 до 1,000,000 км');
        } else if (isNaN(mileageNum)) {
            errors.push('Пробег должен быть числом');
        }
    }
    
    // Если есть ошибки, показываем их
    if (errors.length > 0) {
        showError(errors.join('<br>'));
        return;
    }
    
    const carData = {
        client_id: parseInt(clientId),
        model: model,
        vin: vin,
        gos_number: gosNumber,
        year: parseInt(year),
        mileage: parseInt(mileage)
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
            
            // Очищаем форму
            document.getElementById('newCarModel').value = '';
            document.getElementById('newCarVin').value = '';
            document.getElementById('newCarGosNumber').value = '';
            document.getElementById('newCarYear').value = '';
            document.getElementById('newCarMileage').value = '';
            
            // Показываем автомобили этого клиента
            loadClientCars(clientId);
            
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Ошибка добавления автомобиля');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

// Функция редактирования автомобиля
async function editCar(carId) {
    try {
        // Загружаем информацию об автомобиле
        const response = await fetch(`${API_URL}/cars/${carId}`);
        if (!response.ok) {
            throw new Error(`Ошибка загрузки автомобиля: ${response.status}`);
        }
        
        const car = await response.json();
        
        // Загружаем информацию о владельце
        const clientResponse = await fetch(`${API_URL}/clients/${car.client_id}`);
        const client = clientResponse.ok ? await clientResponse.json() : { name: 'Неизвестный клиент', phone: 'N/A' };
        
        // Создаем модальное окно для редактирования
        const modalHtml = `
            <div class="modal fade" id="editCarModal" tabindex="-1" aria-labelledby="editCarModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="editCarModalLabel">Редактировать автомобиль</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info mb-3">
                                <i class="bi bi-person"></i> <strong>Владелец:</strong> ${client.name} (тел: ${client.phone})
                                <br><small class="text-muted">Сменить владельца можно только через удаление и добавление нового автомобиля</small>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Модель автомобиля *</label>
                                <input type="text" class="form-control" id="editCarModel" value="${car.model || ''}" required>
                                <div class="form-text">Обязательное поле</div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">VIN номер *</label>
                                        <input type="text" class="form-control" id="editCarVin" value="${car.vin || ''}" 
                                               maxlength="17" required
                                               pattern="[A-HJ-NPR-Z0-9]{17}"
                                               title="Ровно 17 символов: цифры и заглавные латинские буквы (кроме I, O, Q)">
                                        <div class="form-text">
                                            <span class="text-danger"><i class="bi bi-exclamation-circle"></i> Обязательное поле</span><br>
                                            <span id="vinCounter" class="text-muted">Символов: ${car.vin ? car.vin.length : 0}/17</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Госномер *</label>
                                        <input type="text" class="form-control" id="editCarGosNumber" value="${car.gos_number || ''}" 
                                               maxlength="9" required
                                               pattern="[А-Я][0-9]{3}[А-Я]{2}[0-9]{2,3}|[А-Я]{2}[0-9]{3}[0-9]{2,3}"
                                               title="Примеры: А123БВ77, ВС12345">
                                        <div class="form-text">
                                            <span class="text-danger"><i class="bi bi-exclamation-circle"></i> Обязательное поле</span><br>
                                            Примеры: А123БВ77, ВС12345
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Год выпуска *</label>
                                        <input type="number" class="form-control" id="editCarYear" value="${car.year || ''}" 
                                               min="1900" max="${new Date().getFullYear() + 1}" required>
                                        <div class="form-text">
                                            <span class="text-danger"><i class="bi bi-exclamation-circle"></i> Обязательное поле</span><br>
                                            От 1900 до ${new Date().getFullYear() + 1}
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Пробег (км) *</label>
                                        <input type="number" class="form-control" id="editCarMileage" value="${car.mileage || ''}" 
                                               min="0" max="1000000" required>
                                        <div class="form-text">
                                            <span class="text-danger"><i class="bi bi-exclamation-circle"></i> Обязательное поле</span><br>
                                            От 0 до 1,000,000 км
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="alert alert-warning mt-3">
                                <i class="bi bi-exclamation-triangle"></i> <strong>Внимание!</strong> Все поля отмеченные * являются обязательными для заполнения.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                            <button type="button" class="btn btn-danger" onclick="showDeleteCarConfirmation(${carId})">
                                <i class="bi bi-trash"></i> Удалить авто
                            </button>
                            <button type="button" class="btn btn-primary" onclick="validateAndUpdateCar(${carId})">Сохранить изменения</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Удаляем старые модальные окна если есть
        const oldModal = document.getElementById('editCarModal');
        if (oldModal) oldModal.remove();
        
        // Добавляем модальное окно в DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Добавляем счетчик символов для VIN
        const vinInput = document.getElementById('editCarVin');
        const vinCounter = document.getElementById('vinCounter');
        
        if (vinInput && vinCounter) {
            vinInput.addEventListener('input', function() {
                const length = this.value.length;
                vinCounter.textContent = `Символов: ${length}/17`;
                
                if (length === 17) {
                    vinCounter.className = 'text-success';
                } else if (length > 0) {
                    vinCounter.className = 'text-warning';
                } else {
                    vinCounter.className = 'text-danger';
                }
            });
            
            // Инициализируем счетчик
            vinInput.dispatchEvent(new Event('input'));
        }
        
        // Показываем модальное окно
        const modal = new bootstrap.Modal(document.getElementById('editCarModal'));
        modal.show();
        
    } catch (error) {
        console.error('Ошибка загрузки данных автомобиля:', error);
        showError('Ошибка загрузки данных автомобиля: ' + error.message);
    }
}

// Функция валидации и обновления автомобиля
async function validateAndUpdateCar(carId) {
    const model = document.getElementById('editCarModel').value.trim();
    const vin = document.getElementById('editCarVin').value.trim().toUpperCase(); // Приводим к верхнему регистру
    const gosNumber = document.getElementById('editCarGosNumber').value.trim().toUpperCase(); // Приводим к верхнему регистру
    const year = document.getElementById('editCarYear').value;
    const mileage = document.getElementById('editCarMileage').value;
    
    // Проверка обязательных полей
    const errors = [];
    
    if (!model) {
        errors.push('Поле "Модель автомобиля" обязательно для заполнения');
    }
    
    if (!vin) {
        errors.push('Поле "VIN номер" обязательно для заполнения');
    } else if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        errors.push('Неверный формат VIN номера. Должно быть ровно 17 символов (цифры и заглавные латинские буквы, кроме I, O, Q)');
    }
    
    if (!gosNumber) {
        errors.push('Поле "Госномер" обязательно для заполнения');
    } else if (!/^[А-Я][0-9]{3}[А-Я]{2}[0-9]{2,3}$|^[А-Я]{2}[0-9]{3}[0-9]{2,3}$/.test(gosNumber)) {
        errors.push('Неверный формат госномера. Примеры правильных форматов: А123БВ77, ВС12345');
    }
    
    if (!year) {
        errors.push('Поле "Год выпуска" обязательно для заполнения');
    } else {
        const currentYear = new Date().getFullYear();
        const yearNum = parseInt(year);
        if (yearNum < 1900 || yearNum > currentYear + 1) {
            errors.push(`Год выпуска должен быть в диапазоне от 1900 до ${currentYear + 1}`);
        }
    }
    
    if (!mileage) {
        errors.push('Поле "Пробег" обязательно для заполнения');
    } else {
        const mileageNum = parseInt(mileage);
        if (mileageNum < 0 || mileageNum > 1000000) {
            errors.push('Пробег должен быть в диапазоне от 0 до 1,000,000 км');
        } else if (isNaN(mileageNum)) {
            errors.push('Пробег должен быть числом');
        }
    }
    
    // Если есть ошибки, показываем их
    if (errors.length > 0) {
        showError(errors.join('<br>'));
        return;
    }
    
    // Все проверки пройдены, обновляем автомобиль
    const carData = {
        model: model,
        vin: vin,
        gos_number: gosNumber,
        year: parseInt(year),
        mileage: parseInt(mileage)
    };
    
    try {
        const response = await fetch(`${API_URL}/cars/${carId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(carData)
        });
        
        if (response.ok) {
            showSuccess('Автомобиль обновлен!');
            
            // Закрываем модальное окно
            const modal = bootstrap.Modal.getInstance(document.getElementById('editCarModal'));
            modal.hide();
            
            // Обновляем список автомобилей
            setTimeout(() => {
                if (document.getElementById('carsTab').style.display === 'block') {
                    loadAllCarsInService();
                }
            }, 500);
            
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Ошибка обновления автомобиля');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

function showDeleteCarConfirmation(carId) {
    // Закрываем текущее модальное окно
    const modal = bootstrap.Modal.getInstance(document.getElementById('editCarModal'));
    if (modal) modal.hide();
    
    // Показываем подтверждение удаления
    if (confirm('Вы уверены, что хотите удалить этот автомобиль? Все связанные заказы также будут удалены!')) {
        deleteCar(carId);
    } else {
        // Если отмена, показываем модальное окно редактирования снова
        setTimeout(() => editCar(carId), 300);
    }
}

async function updateCar(carId) {
    const model = document.getElementById('editCarModel').value.trim();
    
    if (!model) {
        showError('Поле "Модель автомобиля" обязательно для заполнения');
        return;
    }
    
    const vin = document.getElementById('editCarVin').value.trim();
    const gosNumber = document.getElementById('editCarGosNumber').value.trim();
    const year = document.getElementById('editCarYear').value;
    const mileage = document.getElementById('editCarMileage').value;
    
    // Валидация VIN (если введен)
    if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
        showError('Неверный формат VIN номера. Должно быть ровно 17 символов (цифры и заглавные буквы, кроме I, O, Q)');
        return;
    }
    
    // Валидация госномера (если введен)
    if (gosNumber && !/^[А-Я0-9]{6,9}$/i.test(gosNumber)) {
        showError('Неверный формат госномера. Используйте русские буквы и цифры (6-9 символов)');
        return;
    }
    
    // Валидация года
    if (year) {
        const currentYear = new Date().getFullYear();
        const yearNum = parseInt(year);
        if (yearNum < 1900 || yearNum > currentYear + 1) {
            showError(`Год выпуска должен быть в диапазоне от 1900 до ${currentYear + 1}`);
            return;
        }
    }
    
    // Валидация пробега
    if (mileage) {
        const mileageNum = parseInt(mileage);
        if (mileageNum < 0 || mileageNum > 1000000) {
            showError('Пробег должен быть в диапазоне от 0 до 1,000,000 км');
            return;
        }
    }
    
    // Подтверждение удаления важных полей
    let warningMessage = '';
    const originalVin = await getOriginalCarField(carId, 'vin');
    const originalGosNumber = await getOriginalCarField(carId, 'gos_number');
    
    if (originalVin && !vin) {
        warningMessage += 'Вы удаляете VIN номер автомобиля. Это важный идентификатор!\n';
    }
    
    if (originalGosNumber && !gosNumber) {
        warningMessage += 'Вы удаляете госномер автомобиля. Это важный идентификатор!\n';
    }
    
    if (warningMessage) {
        warningMessage += '\nВы уверены, что хотите продолжить?';
        if (!confirm(warningMessage)) {
            return;
        }
    }
    
    const carData = {
        model: model,
        vin: vin || null,  // Если поле пустое, отправляем null
        gos_number: gosNumber || null,
        year: year || null,
        mileage: mileage || null
    };
    
    try {
        const response = await fetch(`${API_URL}/cars/${carId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(carData)
        });
        
        if (response.ok) {
            showSuccess('Автомобиль обновлен!');
            
            // Закрываем модальное окно
            const modal = bootstrap.Modal.getInstance(document.getElementById('editCarModal'));
            modal.hide();
            
            // Обновляем список автомобилей
            setTimeout(() => {
                if (document.getElementById('carsTab').style.display === 'block') {
                    loadAllCarsInService();
                }
            }, 500);
            
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Ошибка обновления автомобиля');
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

async function getOriginalCarField(carId, fieldName) {
    try {
        const response = await fetch(`${API_URL}/cars/${carId}`);
        if (response.ok) {
            const car = await response.json();
            return car[fieldName] || null;
        }
    } catch (error) {
        console.error('Ошибка получения данных автомобиля:', error);
    }
    return null;
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
                        ${order.problem_description ? `<br>${order.problem_description.substring(0, 100)}${order.problem_description.length > 100 ? '...' : ''}` : ''}
                    </p>
                    <small class="text-muted">
                        <i class="bi bi-calendar"></i> ${new Date(order.created_date).toLocaleDateString()}
                        | Клиент: ${order.client_name || 'N/A'}
                        ${order.mechanic_id ? `| Механик ID: ${order.mechanic_id}` : ''}
                    </small>
                    <div class="mt-2">
                        ${order.status === 'Готов к выдаче' ? `
                        <button class="btn btn-sm btn-outline-success" onclick="completeOrder(${order.order_id})">
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
                <div class="modal-dialog modal-lg">
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
                                                `<option value="${client.client_id}" ${client.client_id === order.client_id ? 'selected' : ''}>${client.name} (${client.phone})</option>`
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
    // Сначала переключаемся на вкладку нового заказа
    showTab('newOrder');
    
    // Даем время для переключения вкладки и загрузки списка клиентов
    setTimeout(() => {
        const clientSelect = document.getElementById('orderClientSelect');
        if (clientSelect) {
            clientSelect.value = clientId;
            
            // Форсируем событие change
            const event = new Event('change', { bubbles: true });
            clientSelect.dispatchEvent(event);
            
            console.log(`Клиент выбран: ${clientId} - ${clientName}`);
        } else {
            console.error('Элемент orderClientSelect не найден');
        }
        
        // Фокусируемся на поле описания проблемы
        document.getElementById('orderProblem').focus();
        
        showInfo(`Создание заказа для клиента: ${clientName}`);
    }, 100);
}

async function createOrderForCar(carId, clientId) {
    // Сначала проверяем, есть ли у автомобиля активные заказы
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
    
    // Сначала переключаемся на вкладку нового заказа
    showTab('newOrder');
    
    // Даем время для переключения вкладки
    setTimeout(async () => {
        const clientSelect = document.getElementById('orderClientSelect');
        if (clientSelect) {
            clientSelect.value = clientId;
            
            // Форсируем событие change для загрузки автомобилей клиента
            const changeEvent = new Event('change', { bubbles: true });
            clientSelect.dispatchEvent(changeEvent);
            
            // Ждем загрузки автомобилей (можно добавить небольшую задержку)
            setTimeout(() => {
                const carSelect = document.getElementById('orderCarSelect');
                if (carSelect) {
                    carSelect.value = carId;
                    console.log(`Автомобиль выбран: ${carId}`);
                } else {
                    console.error('Элемент orderCarSelect не найден');
                }
            }, 300);
        }
        
        document.getElementById('orderProblem').focus();
        showInfo('Создание заказа для выбранного автомобиля');
    }, 100);
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
    if (mechanicSelect) {
        mechanicSelect.innerHTML = '<option value="">Не назначен</option>';
        mechanics.forEach(mech => {
            mechanicSelect.innerHTML += `<option value="${mech.user_id}">${mech.full_name}</option>`;
        });
    }
}

async function createMechanic() {
    const fullName = document.getElementById('newMechanicName').value.trim();
    const phone = document.getElementById('newMechanicPhone').value.trim();
    const specialization = document.getElementById('newMechanicSpecialization').value.trim();
    const employeeNumber = document.getElementById('newMechanicEmployeeNumber').value.trim();
    const login = document.getElementById('newMechanicLogin').value.trim();
    const password = document.getElementById('newMechanicPassword').value;
    
    // Валидация
    let isValid = true;
    
    // Валидация имени
    if (!fullName) {
        showFieldError('newMechanicName', 'Введите ФИО механика');
        isValid = false;
    } else {
        showFieldError('newMechanicName', null);
    }
    
    // Валидация телефона
    const phoneValidation = validateRussianPhone(phone);
    if (!phoneValidation.isValid) {
        showFieldError('newMechanicPhone', phoneValidation.message);
        isValid = false;
    } else {
        showFieldError('newMechanicPhone', null);
    }
    
    // Валидация логина
    if (!login) {
        showFieldError('newMechanicLogin', 'Введите логин');
        isValid = false;
    } else {
        showFieldError('newMechanicLogin', null);
    }
    
    // Валидация пароля
    if (!password) {
        showFieldError('newMechanicPassword', 'Введите пароль');
        isValid = false;
    } else if (password.length < 6) {
        showFieldError('newMechanicPassword', 'Пароль должен содержать минимум 6 символов');
        isValid = false;
    } else {
        showFieldError('newMechanicPassword', null);
    }
    
    if (!isValid) {
        showError('Исправьте ошибки в форме');
        return;
    }
    
    const mechanicData = {
        full_name: fullName,
        phone: phoneValidation.phone || phone,
        specialization: specialization || null,
        employee_number: employeeNumber || null,
        login: login,
        password: password
    };
    
    try {
        const response = await fetch(`${API_URL}/mechanics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mechanicData)
        });
        
        console.log("Create mechanic response status:", response.status);
        
        // Для отладки
        const responseText = await response.text();
        console.log("Create mechanic response text:", responseText);
        
        let errorData = null;
        try {
            errorData = responseText ? JSON.parse(responseText) : null;
        } catch (parseError) {
            console.error("Error parsing response:", parseError);
        }
        
        if (response.ok) {
            const data = errorData || await response.json();
            showSuccess(`Механик "${fullName}" добавлен!`);
            
            // Очищаем форму
            document.getElementById('newMechanicName').value = '';
            document.getElementById('newMechanicPhone').value = '';
            document.getElementById('newMechanicSpecialization').value = '';
            document.getElementById('newMechanicEmployeeNumber').value = '';
            document.getElementById('newMechanicLogin').value = '';
            document.getElementById('newMechanicPassword').value = '';
            
            // Очищаем ошибки
            clearMechanicCreationErrors();
            
            loadMechanicsList();
            
        } else {
            if (errorData) {
                // Обработка ошибок дублирования
                if (errorData.error && errorData.error.includes('телефон')) {
                    showFieldError('newMechanicPhone', 'Механик с таким номером телефона уже существует');
                    showError('Механик с таким номером телефона уже существует');
                } else if (errorData.error && errorData.error.includes('логин')) {
                    showFieldError('newMechanicLogin', 'Логин уже занят');
                    showError('Логин уже занят');
                } else if (errorData.error) {
                    showError(errorData.error);
                }
            } else {
                showError('Ошибка добавления механика');
            }
        }
    } catch (error) {
        console.error("Create mechanic error:", error);
        showError('Ошибка добавления механика: ' + error.message);
    }
}

// Очистка ошибок при создании механика
function clearMechanicCreationErrors() {
    const fields = ['newMechanicName', 'newMechanicPhone', 'newMechanicSpecialization', 
                   'newMechanicEmployeeNumber', 'newMechanicLogin', 'newMechanicPassword'];
    fields.forEach(fieldId => {
        showFieldError(fieldId, null);
    });
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
    
    // Убираем активный класс у всех кнопок в главных вкладках
    document.querySelectorAll('#mainTabs .nav-link').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показываем выбранную вкладку
    document.getElementById(`${tabName}Tab`).style.display = 'block';
    
    // Находим и активируем соответствующую кнопку в главных вкладках
    const tabButton = document.querySelector(`#mainTabs button[onclick*="showTab('${tabName}'"]`);
    if (tabButton) {
        tabButton.classList.add('active');
    }
    
    // Если передан event (клик по кнопке), тоже активируем
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Загружаем данные для определенных вкладок
    switch(tabName) {
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
            // Загружаем клиентов для выпадающих списков
            fetch(`${API_URL}/clients`)
                .then(response => response.ok ? response.json() : [])
                .then(clients => {
                    if (clients && clients.length > 0) {
                        updateClientSelects(clients);
                        // Сбросить выбранные значения при открытии вкладки
                        document.getElementById('orderClientSelect').value = '';
                        document.getElementById('orderCarSelect').innerHTML = '<option value="">Сначала выберите клиента</option>';
                        document.getElementById('orderProblem').value = '';
                        document.getElementById('orderPrice').value = '';
                    }
                })
                .catch(error => console.error('Ошибка загрузки клиентов:', error));
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
        if (select) {
            select.innerHTML = '<option value="">Выберите клиента</option>';
            clients.forEach(client => {
                select.innerHTML += `<option value="${client.client_id}">${client.name} (${client.phone})</option>`;
            });
        }
    });
    
    if (orderClientSelect) {
        // Удаляем старый обработчик если есть
        orderClientSelect.removeEventListener('change', handleClientSelectChange);
        
        // Добавляем новый обработчик
        orderClientSelect.addEventListener('change', handleClientSelectChange);
    }
}

// Выносим обработчик в отдельную функцию
async function handleClientSelectChange() {
    const clientId = this.value;
    if (!clientId) {
        const carSelect = document.getElementById('orderCarSelect');
        if (carSelect) {
            carSelect.innerHTML = '<option value="">Сначала выберите клиента</option>';
        }
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/cars/client/${clientId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const cars = await response.json();
        const carSelect = document.getElementById('orderCarSelect');
        
        if (carSelect) {
            carSelect.innerHTML = '<option value="">Выберите автомобиль</option>';
            cars.forEach(car => {
                const displayText = `${car.model} ${car.vin ? '(VIN: ' + car.vin + ')' : ''} ${car.gos_number ? '(' + car.gos_number + ')' : ''}`;
                carSelect.innerHTML += `<option value="${car.car_id}">${displayText}</option>`;
            });
            
            console.log(`Загружено ${cars.length} автомобилей для клиента ${clientId}`);
        }
    } catch (error) {
        console.error('Ошибка загрузки автомобилей:', error);
        const carSelect = document.getElementById('orderCarSelect');
        if (carSelect) {
            carSelect.innerHTML = '<option value="">Ошибка загрузки автомобилей</option>';
        }
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
    const oldAlerts = document.querySelectorAll('.alert-notification');
    oldAlerts.forEach(alert => {
        if (alert.parentNode) {
            alert.remove();
        }
    });
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-notification alert-dismissible fade show`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    
    const icon = type === 'success' ? 'check-circle-fill' : 
                type === 'danger' ? 'exclamation-triangle-fill' : 
                'info-circle-fill';
    
    alertDiv.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi bi-${icon} me-2 fs-5"></i>
            <div class="flex-grow-1">
                <strong>${type === 'success' ? 'Успех!' : type === 'danger' ? 'Ошибка!' : 'Информация!'}</strong><br>
                <span class="small">${message}</span>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Автоматически скрываем через 5 секунд
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.classList.remove('show');
            alertDiv.classList.add('fade');
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 300);
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
            if (select) {
                mechanics.forEach(mech => {
                    select.innerHTML += `<option value="${mech.user_id}">${mech.full_name}</option>`;
                });
            }
            return;
        }
        
        const mechanics = await response.json();
        const select = document.getElementById('orderMechanicSelect');
        if (select) {
            select.innerHTML = '<option value="">Не назначен</option>';
            mechanics.forEach(mech => {
                select.innerHTML += `<option value="${mech.user_id}">${mech.full_name}</option>`;
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки механиков:', error);
    }
}

// Функция редактирования механика
async function editMechanic(mechanicId) {
    try {
        // Загружаем информацию о механике
        const response = await fetch(`${API_URL}/mechanics/${mechanicId}`);
        if (!response.ok) {
            throw new Error(`Ошибка загрузки механика: ${response.status}`);
        }
        
        const mechanic = await response.json();
        
        // Создаем модальное окно для редактирования
        const modalHtml = `
            <div class="modal fade" id="editMechanicModal" tabindex="-1" aria-labelledby="editMechanicModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="editMechanicModalLabel">Редактировать механика</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editMechanicForm">
                                <div class="mb-3">
                                    <label class="form-label">ФИО *</label>
                                    <input type="text" class="form-control" id="editMechanicName" 
                                           value="${mechanic.full_name}" required>
                                    <div class="invalid-feedback" id="editMechanicNameError"></div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Телефон *</label>
                                    <input type="tel" class="form-control" id="editMechanicPhone" 
                                           value="${mechanic.phone}" required>
                                    <div class="invalid-feedback" id="editMechanicPhoneError"></div>
                                    <div class="form-text">В формате: +7XXX XXX-XX-XX</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Специализация</label>
                                    <input type="text" class="form-control" id="editMechanicSpecialization" 
                                           value="${mechanic.specialization || ''}">
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Табельный номер</label>
                                    <input type="text" class="form-control" id="editMechanicEmployeeNumber" 
                                           value="${mechanic.employee_number || ''}">
                                    <div class="invalid-feedback" id="editMechanicEmployeeNumberError"></div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Логин *</label>
                                    <input type="text" class="form-control" id="editMechanicLogin" 
                                           value="${mechanic.login}" required>
                                    <div class="invalid-feedback" id="editMechanicLoginError"></div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Пароль</label>
                                    <input type="password" class="form-control" id="editMechanicPassword" 
                                           placeholder="Оставьте пустым, если не нужно менять">
                                    <div class="form-text">Минимум 6 символов</div>
                                </div>
                                
                                <div class="alert alert-warning mt-3">
                                    <i class="bi bi-exclamation-triangle"></i> Поля отмеченные * обязательны для заполнения
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                            <button type="button" class="btn btn-danger" onclick="confirmDeleteMechanic(${mechanicId})">
                                <i class="bi bi-trash"></i> Удалить
                            </button>
                            <button type="button" class="btn btn-primary" onclick="validateAndUpdateMechanic(${mechanicId})">Сохранить</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Удаляем старые модальные окна если есть
        const oldModal = document.getElementById('editMechanicModal');
        if (oldModal) oldModal.remove();
        
        // Добавляем модальное окно в DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Инициализируем валидацию телефона
        const phoneInput = document.getElementById('editMechanicPhone');
        if (phoneInput) {
            phoneInput.addEventListener('input', function(e) {
                formatPhoneInput(this);
            });
            
            phoneInput.addEventListener('keydown', function(e) {
                const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                
                if (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
                    return;
                }
                
                if (e.key >= '0' && e.key <= '9') {
                    return;
                }
                
                if (e.key === '+' && (this.selectionStart === 0 || this.value === '')) {
                    return;
                }
                
                if (allowedKeys.includes(e.key)) {
                    return;
                }
                
                e.preventDefault();
            });
            
            phoneInput.addEventListener('focus', function() {
                if (!this.value) {
                    this.value = '+7 ';
                }
            });
            
            phoneInput.addEventListener('blur', function() {
                const validation = validateRussianPhone(this.value);
                const errorElement = document.getElementById('editMechanicPhoneError');
                if (errorElement) {
                    errorElement.textContent = validation.isValid ? '' : validation.message;
                    this.classList.toggle('is-invalid', !validation.isValid);
                    this.classList.toggle('is-valid', validation.isValid && this.value);
                }
            });
        }
        
        // Показываем модальное окно
        const modal = new bootstrap.Modal(document.getElementById('editMechanicModal'));
        modal.show();
        
    } catch (error) {
        console.error('Ошибка загрузки данных механика:', error);
        showError('Ошибка загрузки данных механика: ' + error.message);
    }
}

// Валидация и обновление механика
async function validateAndUpdateMechanic(mechanicId) {
    const name = document.getElementById('editMechanicName').value.trim();
    const phone = document.getElementById('editMechanicPhone').value.trim();
    const specialization = document.getElementById('editMechanicSpecialization').value.trim();
    const employeeNumber = document.getElementById('editMechanicEmployeeNumber').value.trim();
    const login = document.getElementById('editMechanicLogin').value.trim();
    const password = document.getElementById('editMechanicPassword').value;
    
    // Сбрасываем ошибки
    clearMechanicValidationErrors();
    
    // Валидация
    let isValid = true;
    const errors = {};
    
    // Валидация имени
    if (!name) {
        errors.name = 'Введите ФИО механика';
        isValid = false;
    } else if (name.length < 2) {
        errors.name = 'ФИО должно содержать минимум 2 символа';
        isValid = false;
    }
    
    // Валидация телефона
    const phoneValidation = validateRussianPhone(phone);
    if (!phoneValidation.isValid) {
        errors.phone = phoneValidation.message;
        isValid = false;
    }
    
    // Валидация логина
    if (!login) {
        errors.login = 'Введите логин';
        isValid = false;
    } else if (login.length < 3) {
        errors.login = 'Логин должен содержать минимум 3 символа';
        isValid = false;
    }
    
    // Валидация пароля (если указан)
    if (password && password.length < 6) {
        errors.password = 'Пароль должен содержать минимум 6 символов';
        isValid = false;
    }
    
    // Показываем ошибки валидации клиента
    if (!isValid) {
        showMechanicValidationErrors(errors);
        showError('Исправьте ошибки в форме');
        return;
    }
    
    // Подготовка данных
    const mechanicData = {
        full_name: name,
        phone: phoneValidation.isValid ? phoneValidation.phone : phone,
        specialization: specialization || null,
        employee_number: employeeNumber || null,
        login: login
    };
    
    // Добавляем пароль только если он указан
    if (password) {
        mechanicData.password = password;
    }
    
    console.log("Sending update request:", mechanicData);
    
    // Отправка данных на сервер
    try {
        const response = await fetch(`${API_URL}/mechanics/${mechanicId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mechanicData)
        });
        
        console.log("Response status:", response.status);
        
        // Получаем текст ответа для отладки
        const responseText = await response.text();
        console.log("Response text:", responseText);
        
        let errorData = null;
        try {
            errorData = responseText ? JSON.parse(responseText) : null;
            console.log("Parsed error data:", errorData);
        } catch (parseError) {
            console.error("Error parsing response:", parseError);
        }
        
        if (response.ok) {
            const data = errorData || await response.json();
            console.log("Update successful:", data);
            showSuccess('Данные механика обновлены!');
            
            // Закрываем модальное окно
            const modalElement = document.getElementById('editMechanicModal');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) modal.hide();
            }
            
            // Обновляем список механиков
            setTimeout(() => {
                loadMechanicsList();
            }, 300);
            
        } else {
            // Специальная обработка для ошибок валидации с сервера
            if (errorData) {
                console.log("Server error details:", errorData);
                
                // Показываем конкретные ошибки от сервера
                if (errorData.duplicate_phone) {
                    showMechanicValidationErrors({ 
                        phone: 'Механик с таким номером телефона уже существует'
                    });
                    showError('Механик с таким номером телефона уже существует');
                } else if (errorData.duplicate_login) {
                    showMechanicValidationErrors({ 
                        login: 'Логин уже занят другим пользователем'
                    });
                    showError('Логин уже занят другим пользователем');
                } else if (errorData.duplicate_employee_number) {
                    showMechanicValidationErrors({ 
                        employee_number: 'Механик с таким табельным номером уже существует'
                    });
                    showError('Механик с таким табельным номером уже существует');
                } else if (errorData.error) {
                    showError(errorData.error);
                } else {
                    showError('Неизвестная ошибка сервера');
                }
            } else {
                showError(`Ошибка сервера: ${response.status} ${response.statusText}`);
            }
        }
    } catch (error) {
        console.error("Network error:", error);
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

// Очистка ошибок валидации
function clearMechanicValidationErrors() {
    const fields = ['name', 'phone', 'login', 'password', 'employee_number'];
    fields.forEach(field => {
        const input = document.getElementById(`editMechanic${field.charAt(0).toUpperCase() + field.slice(1)}`);
        const errorElement = document.getElementById(`editMechanic${field.charAt(0).toUpperCase() + field.slice(1)}Error`);
        
        if (input) {
            input.classList.remove('is-invalid', 'is-valid');
        }
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    });
}

// Показ ошибок валидации
function showMechanicValidationErrors(errors) {
    console.log("Validation errors:", errors); // Debug
    
    for (const [field, message] of Object.entries(errors)) {
        const input = document.getElementById(`editMechanic${field.charAt(0).toUpperCase() + field.slice(1)}`);
        const errorElement = document.getElementById(`editMechanic${field.charAt(0).toUpperCase() + field.slice(1)}Error`);
        
        if (input && errorElement) {
            input.classList.add('is-invalid');
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Прокрутка к ошибке
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    // Показываем общее уведомление
    if (Object.keys(errors).length > 0) {
        showError('Исправьте ошибки в форме');
    }
}

// Подтверждение удаления механика
function confirmDeleteMechanic(mechanicId) {
    // Закрываем модальное окно редактирования
    const modal = bootstrap.Modal.getInstance(document.getElementById('editMechanicModal'));
    if (modal) modal.hide();
    
    // Показываем подтверждение
    setTimeout(() => {
        if (confirm('Вы уверены, что хотите удалить механика? Это действие нельзя отменить.')) {
            deleteMechanic(mechanicId);
        } else {
            // Если отмена, показываем модальное окно снова
            setTimeout(() => editMechanic(mechanicId), 300);
        }
    }, 300);
}