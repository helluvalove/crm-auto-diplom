// ==================== АВТОМОБИЛИ ====================

let currentClients = [];

// ========== ОБЩАЯ ВАЛИДАЦИЯ ДАННЫХ АВТОМОБИЛЯ ==========
function validateCarData(data, checkClientId = false, clientId = null) {
    const errors = [];
    const { model, vin, gosNumber, year, mileage } = data;

    if (checkClientId && !clientId) {
        errors.push('Выберите клиента');
    }

    if (!model) {
        errors.push('Поле "Модель автомобиля" обязательно');
    }

    if (!vin) {
        errors.push('Поле "VIN номер" обязательно');
    } else if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        errors.push('VIN должен содержать 17 символов (без I, O, Q)');
    }

    if (!gosNumber) {
        errors.push('Поле "Госномер" обязательно');
    } else if (!/^[АВЕКМНОРСТУХ][0-9]{3}[АВЕКМНОРСТУХ]{2}[0-9]{2,3}$/.test(gosNumber)) {
        errors.push('Неверный формат госномера (пример: А123БВ77)');
    }

    if (!year) {
        errors.push('Поле "Год" обязательно');
    } else {
        const yearNum = parseInt(year);
        const currentYear = new Date().getFullYear();
        if (yearNum < 1900 || yearNum > currentYear + 1) {
            errors.push(`Год должен быть от 1900 до ${currentYear + 1}`);
        }
    }

    if (!mileage) {
        errors.push('Поле "Пробег" обязательно');
    } else {
        const mileageNum = parseInt(mileage);
        if (mileageNum < 0 || mileageNum > 1000000 || isNaN(mileageNum)) {
            errors.push('Пробег должен быть от 0 до 1 000 000');
        }
    }

    return errors;
}

// ========== LIVE-ПОИСК КЛИЕНТОВ ==========
function setupClientSearch() {
    const input = document.getElementById('carClientSearch');
    const resultsContainer = document.getElementById('clientSearchResults');

    if (!input || !resultsContainer) return;
    if (input.dataset.searchInitialized === 'true') return;

    input.dataset.searchInitialized = 'true';

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        resultsContainer.innerHTML = '';

        delete input.dataset.clientId;

        if (query.length < 2) {
            resultsContainer.style.display = 'none';
            return;
        }

        const filtered = currentClients.filter(client =>
            client.name.toLowerCase().includes(query) ||
            client.phone.toLowerCase().includes(query)
        );

        if (filtered.length === 0) {
            resultsContainer.style.display = 'none';
            return;
        }

        filtered.forEach(client => {
            const displayPhone = formatPhone ? formatPhone(client.phone) : client.phone;
            const item = document.createElement('div');
            item.className = 'list-group-item list-group-item-action px-3 py-2';
            item.style.cursor = 'pointer';
            item.innerHTML = `<strong>${client.name}</strong><br><small class="text-muted">${displayPhone}</small>`;

            item.onclick = () => {
                input.value = `${client.name} (${displayPhone})`;
                input.dataset.clientId = client.client_id;
                resultsContainer.style.display = 'none';
            };
            resultsContainer.appendChild(item);
        });

        resultsContainer.style.display = 'block';
    });

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.style.display = 'none';
        }
    });
}

function getSelectedClientFromSearch() {
    const input = document.getElementById('carClientSearch');
    return input && input.dataset.clientId ? parseInt(input.dataset.clientId) : null;
}

function viewAllClientCars() {
    const input = document.getElementById('carClientSearch');
    if (!input || !input.value.trim()) {
        showError('Сначала выберите клиента из списка');
        return;
    }

    const clientId = getSelectedClientFromSearch();
    if (!clientId) {
        showError('Сначала выберите клиента из списка');
        return;
    }
    loadClientCars(clientId);
}

async function loadAllCarsInService() {
    const carsList = document.getElementById('carsList');

    carsList.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Загрузка...</span>
            </div>
            <p class="text-muted mt-2">Загрузка автомобилей в сервисе...</p>
        </div>
    `;

    try {
        const ordersResponse = await fetch(`${API_URL}/orders`);
        if (!ordersResponse.ok) throw new Error(`HTTP error ${ordersResponse.status}`);

        const allOrders = await ordersResponse.json();
        const activeOrders = allOrders.filter(o => o.status !== 'Выполнен' && o.status !== 'Отменен');

        if (activeOrders.length === 0) {
            carsList.innerHTML = `<div class="alert alert-info"><i class="bi bi-info-circle"></i> Сейчас нет автомобилей в сервисе</div>`;
            const clientsRes = await fetch(`${API_URL}/clients`);
            if (clientsRes.ok) updateClientSearchForCars(await clientsRes.json());
            return;
        }

        const carIds = [...new Set(activeOrders.map(o => o.car_id))];

        const carsWithOwners = await Promise.all(
            carIds.map(async (carId) => {
                try {
                    const carRes = await fetch(`${API_URL}/cars/${carId}`);
                    if (!carRes.ok) return null;
                    const car = await carRes.json();

                    const clientRes = await fetch(`${API_URL}/clients/${car.client_id}`);
                    if (!clientRes.ok) return null;
                    const client = await clientRes.json();

                    const carOrders = activeOrders.filter(o => o.car_id === carId);

                    return { car, client, orders: carOrders, active_orders_count: carOrders.length };
                } catch (e) {
                    return null;
                }
            })
        );

        const validCars = carsWithOwners.filter(Boolean);
        if (validCars.length === 0) {
            carsList.innerHTML = `<div class="alert alert-info"><i class="bi bi-info-circle"></i> Не удалось загрузить данные</div>`;
            const clientsRes = await fetch(`${API_URL}/clients`);
            if (clientsRes.ok) updateClientSearchForCars(await clientsRes.json());
            return;
        }

        let html = '<div class="list-group">';
        validCars.forEach(({ car, client, orders, active_orders_count }) => {
            let statusBadge = '<span class="badge bg-secondary">В сервисе</span>';
            if (orders.some(o => o.status === 'В работе')) statusBadge = '<span class="badge bg-warning">В работе</span>';
            else if (orders.some(o => o.status === 'Готов к выдаче')) statusBadge = '<span class="badge bg-success">Готов</span>';
            else if (orders.some(o => o.status === 'На диагностике' || o.status === 'Создан')) statusBadge = '<span class="badge bg-info">Диагностика</span>';

            let ordersInfo = '';
            if (orders.length) {
                ordersInfo = '<div class="small mt-2"><strong>Заказы:</strong><br>';
                orders.forEach(order => {
                    const date = new Date(order.created_date).toLocaleDateString();
                    ordersInfo += `• #${order.order_id}: ${order.status} (${date})<br>`;
                });
                ordersInfo += '</div>';
            }

            html += `
                <div class="list-group-item" id="car-service-${car.car_id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${car.model || 'Модель не указана'}</h6>
                        <div>${statusBadge}
                            <button class="btn btn-sm btn-outline-warning ms-1" onclick="editCar(${car.car_id})" title="Редактировать"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteCar(${car.car_id})" title="Удалить"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                    <p class="mb-1">
                        <strong>Владелец:</strong> ${client.name} (тел: ${formatPhone(client.phone)})<br>
                        ${car.vin ? `VIN: ${car.vin}<br>` : ''}
                        ${car.gos_number ? `Госномер: ${car.gos_number}<br>` : ''}
                        ${car.year ? `Год: ${car.year}<br>` : ''}
                        ${car.mileage ? `Пробег: ${car.mileage} км<br>` : ''}
                        <strong>Активных заказов:</strong> ${active_orders_count}
                    </p>
                    ${ordersInfo}
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="loadClientCars(${client.client_id})">Все авто клиента</button>
                        <button class="btn btn-sm btn-outline-success" onclick="createOrderForCar(${car.car_id}, ${client.client_id})">Новый заказ</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        carsList.innerHTML = html;

        const clientsRes = await fetch(`${API_URL}/clients`);
        if (clientsRes.ok) updateClientSearchForCars(await clientsRes.json());

    } catch (error) {
        console.error('Ошибка загрузки автомобилей в сервисе:', error);
        showError('Ошибка загрузки автомобилей в сервисе: ' + error.message);
        carsList.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Не удалось загрузить список.
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="loadAllCarsInService()">Попробовать снова</button>
            </div>
        `;
    }
}

function updateClientSearchForCars(clients) {
    currentClients = clients;
    setupClientSearch();
}

async function loadClientCars(clientId) {
    const carsList = document.getElementById('carsList');
    carsList.innerHTML = `<div class="text-center py-4">...загрузка...</div>`;

    try {
        const [carsRes, clientRes, ordersRes] = await Promise.all([
            fetch(`${API_URL}/cars/client/${clientId}`),
            fetch(`${API_URL}/clients/${clientId}`),
            fetch(`${API_URL}/orders`)
        ]);

        const cars = carsRes.ok ? await carsRes.json() : [];
        const client = clientRes.ok ? await clientRes.json() : { name: 'Неизвестный клиент', phone: 'N/A' };
        const allOrders = ordersRes.ok ? await ordersRes.json() : [];
        const activeOrders = allOrders.filter(o => o.status !== 'Выполнен' && o.status !== 'Отменен');

        if (cars.length === 0) {
            carsList.innerHTML = `<div class="alert alert-info"><i class="bi bi-info-circle"></i> У клиента нет автомобилей</div>`;
            return;
        }

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
            const carOrders = activeOrders.filter(o => o.car_id === car.car_id);
            const hasOrderInWork = carOrders.some(o => o.status === 'В работе');

            let carStatus = hasOrderInWork ? 'В работе' : (carOrders.length > 0 ? 'В сервисе' : 'Нет активных заказов');
            let statusBadge = hasOrderInWork
                ? '<span class="badge bg-warning ms-1">В работе</span>'
                : (carOrders.length > 0 ? '<span class="badge bg-secondary ms-1">В сервисе</span>' : '');

            html += `
                <div class="list-group-item" id="car-${car.car_id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${car.model || 'Модель не указана'} ${statusBadge}</h6>
                        <div>
                            <small class="text-muted me-2">ID: ${car.car_id}</small>
                            <button class="btn btn-sm btn-outline-warning" onclick="editCar(${car.car_id})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteCar(${car.car_id})"><i class="bi bi-trash"></i></button>
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
                                ${hasOrderInWork ? 'disabled' : ''}>
                            <i class="bi bi-plus-circle"></i> Новый заказ
                        </button>
                        ${hasOrderInWork ? '<small class="text-danger ms-2">Автомобиль уже в работе!</small>' : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        carsList.innerHTML = html;

    } catch (error) {
        console.error('Ошибка загрузки автомобилей клиента:', error);
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

// ========== СБРОС ФОРМЫ СОЗДАНИЯ АВТО ==========
function resetCarForm() {
    const model = document.getElementById('newCarModel');
    const vin = document.getElementById('newCarVin');
    const gos = document.getElementById('newCarGosNumber');
    const year = document.getElementById('newCarYear');
    const mileage = document.getElementById('newCarMileage');
    const searchInput = document.getElementById('carClientSearch');

    if (model) model.value = '';
    if (vin) vin.value = '';
    if (gos) gos.value = '';
    if (year) year.value = '';
    if (mileage) mileage.value = '';
    if (searchInput) {
        searchInput.value = '';
        delete searchInput.dataset.clientId;
    }

    // Сброс всех подсветок
    showFieldDuplicate('newCarVin', null);
    showFieldDuplicate('newCarGosNumber', null);
    showFieldError('newCarVin', null);
    showFieldError('newCarGosNumber', null);
    showFieldError('newCarModel', null);
    showFieldError('newCarYear', null);
    showFieldError('newCarMileage', null);
}

// ========== СОЗДАНИЕ НОВОГО АВТОМОБИЛЯ ==========
async function createCar() {
    const clientId = getSelectedClientFromSearch();
    const model = document.getElementById('newCarModel').value.trim();
    const vin = document.getElementById('newCarVin').value.trim().toUpperCase();
    const gosNumber = document.getElementById('newCarGosNumber').value.trim().toUpperCase();
    const year = document.getElementById('newCarYear').value;
    const mileage = document.getElementById('newCarMileage').value;

    const carData = { model, vin, gosNumber, year, mileage };
    const errors = validateCarData(carData, true, clientId);

    if (errors.length > 0) {
        showError(errors.join('<br>'));
        return;
    }

    const payload = {
        client_id: clientId,
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
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess(`Автомобиль "${model}" добавлен!`);
            resetCarForm();
            loadClientCars(clientId);
        } else {
            if (data.details) {
                if (data.details.vin) {
                    showFieldDuplicate('newCarVin', data.details.vin);
                }
                if (data.details.gos_number) {
                    showFieldDuplicate('newCarGosNumber', data.details.gos_number);
                }
                const errorMessages = Object.values(data.details).filter(msg => typeof msg === 'string');
                showError(errorMessages.join('<br>') || 'Ошибка валидации');
            } else if (data.message) {
                showError(data.message);
            } else {
                showError(data.error || 'Ошибка добавления автомобиля');
            }
            console.error('Ошибка создания авто:', data);
        }
    } catch (error) {
        console.error('Network error:', error);
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

// ========== РЕДАКТИРОВАНИЕ АВТОМОБИЛЯ ==========
async function editCar(carId) {
    try {
        const response = await fetch(`${API_URL}/cars/${carId}`);
        if (!response.ok) throw new Error(`Ошибка загрузки автомобиля: ${response.status}`);

        const car = await response.json();
        const clientResponse = await fetch(`${API_URL}/clients/${car.client_id}`);
        const client = clientResponse.ok ? await clientResponse.json() : { name: 'Неизвестный клиент', phone: 'N/A' };

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

        const oldModal = document.getElementById('editCarModal');
        if (oldModal) oldModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const vinInput = document.getElementById('editCarVin');
        const gosInput = document.getElementById('editCarGosNumber');
        const vinCounter = document.getElementById('vinCounter');

        // Сброс дубликата при вводе
        if (vinInput) {
            vinInput.addEventListener('input', function() {
                showFieldDuplicate('editCarVin', null);
                const length = this.value.length;
                if (vinCounter) {
                    vinCounter.textContent = `Символов: ${length}/17`;
                    vinCounter.className = length === 17 ? 'text-success' : (length > 0 ? 'text-warning' : 'text-danger');
                }
            });
            vinInput.dispatchEvent(new Event('input'));
        }

        if (gosInput) {
            gosInput.addEventListener('input', function() {
                showFieldDuplicate('editCarGosNumber', null);
            });
        }

        const modal = new bootstrap.Modal(document.getElementById('editCarModal'));
        modal.show();

    } catch (error) {
        console.error('Ошибка загрузки данных автомобиля:', error);
        showError('Ошибка загрузки данных автомобиля: ' + error.message);
    }
}

// ========== ВАЛИДАЦИЯ И ОБНОВЛЕНИЕ АВТОМОБИЛЯ ==========
async function validateAndUpdateCar(carId) {
    const model = document.getElementById('editCarModel').value.trim();
    const vin = document.getElementById('editCarVin').value.trim().toUpperCase();
    const gosNumber = document.getElementById('editCarGosNumber').value.trim().toUpperCase();
    const year = document.getElementById('editCarYear').value;
    const mileage = document.getElementById('editCarMileage').value;

    const carData = { model, vin, gosNumber, year, mileage };
    const errors = validateCarData(carData);

    if (errors.length > 0) {
        showError(errors.join('<br>'));
        return;
    }

    const payload = {
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
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showSuccess('Автомобиль обновлен!');

            const modal = bootstrap.Modal.getInstance(document.getElementById('editCarModal'));
            modal.hide();

            setTimeout(() => {
                if (document.getElementById('carsTab').style.display === 'block') {
                    loadAllCarsInService();
                }
            }, 500);
        } else {
            const errorData = await response.json();
            if (errorData.details) {
                if (errorData.details.vin) {
                    showFieldDuplicate('editCarVin', errorData.details.vin);
                }
                if (errorData.details.gos_number) {
                    showFieldDuplicate('editCarGosNumber', errorData.details.gos_number);
                }
                const errorMessages = Object.values(errorData.details).filter(msg => typeof msg === 'string');
                showError(errorMessages.join('<br>') || 'Ошибка обновления');
            } else {
                showError(errorData.error || 'Ошибка обновления автомобиля');
            }
        }
    } catch (error) {
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

// ========== УДАЛЕНИЕ АВТОМОБИЛЯ (подтверждение) ==========
function showDeleteCarConfirmation(carId) {
    const modal = bootstrap.Modal.getInstance(document.getElementById('editCarModal'));
    if (modal) modal.hide();

    if (confirm('Вы уверены, что хотите удалить этот автомобиль? Все связанные заказы также будут удалены!')) {
        deleteCar(carId);
    } else {
        setTimeout(() => editCar(carId), 300);
    }
}

// ========== МОДАЛЬНОЕ ОКНО АВТОМОБИЛЕЙ КЛИЕНТА ==========
async function showClientCarsModal(clientId, clientName) {
    try {
        const response = await fetch(`${API_URL}/cars/client/${clientId}`);
        if (!response.ok) throw new Error(`Ошибка загрузки автомобилей: ${response.status}`);

        const cars = await response.json();
        const ordersResponse = await fetch(`${API_URL}/orders`);
        const allOrders = ordersResponse.ok ? await ordersResponse.json() : [];
        const activeOrders = allOrders.filter(order =>
            order.status !== 'Выполнен' && order.status !== 'Отменен'
        );

        let carsHtml = '';

        if (!cars || cars.length === 0) {
            carsHtml = `<div class="alert alert-info"><i class="bi bi-info-circle"></i> У клиента нет автомобилей</div>`;
        } else {
            carsHtml = '<div class="list-group">';

            cars.forEach(car => {
                const carOrders = activeOrders.filter(order => order.car_id === car.car_id);
                const hasOrderInWork = carOrders.some(o => o.status === 'В работе');
                const hasOrderReady = carOrders.some(o => o.status === 'Готов к выдаче');
                const hasOrderDiagnostic = carOrders.some(o => o.status === 'На диагностике');

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
                } else if (carOrders.length > 0) {
                    carStatus = 'В сервисе';
                    statusBadge = '<span class="badge bg-secondary">В сервисе</span>';
                    statusIcon = '<i class="bi bi-clock-history text-secondary"></i>';
                }

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
                            <h6 class="mb-1">${statusIcon} ${car.model || 'Модель не указана'}</h6>
                            <div>${statusBadge}</div>
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

        const oldModal = document.getElementById('clientCarsModal');
        if (oldModal) oldModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = new bootstrap.Modal(document.getElementById('clientCarsModal'));
        modal.show();

    } catch (error) {
        console.error('Ошибка загрузки автомобилей клиента:', error);
        showError('Ошибка загрузки автомобилей клиента: ' + error.message);
    }
}

function closeModalAndLoadClientCars(clientId) {
    const modalElement = document.getElementById('clientCarsModal');
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) modal.hide();
        modalElement.remove();
    }

    setTimeout(() => {
        loadClientCars(clientId);
    }, 300);
}

// ========== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ==========
document.addEventListener('DOMContentLoaded', () => {
    // Обработчики сброса дубликата при вводе в поля создания
    const newVin = document.getElementById('newCarVin');
    const newGos = document.getElementById('newCarGosNumber');
    if (newVin) {
        newVin.addEventListener('input', () => showFieldDuplicate('newCarVin', null));
    }
    if (newGos) {
        newGos.addEventListener('input', () => showFieldDuplicate('newCarGosNumber', null));
    }

    const carsTabButton = document.querySelector('button[onclick="showTab(\'cars\', event)"]');
    if (carsTabButton) {
        carsTabButton.addEventListener('click', () => {
            setTimeout(() => {
                if (document.getElementById('carsTab').style.display === 'block') {
                    // Сброс формы и поиска при открытии вкладки
                    resetCarForm();
                    const resultsContainer = document.getElementById('clientSearchResults');
                    if (resultsContainer) resultsContainer.style.display = 'none';
                    loadAllCarsInService();
                }
            }, 300);
        });
    }
});