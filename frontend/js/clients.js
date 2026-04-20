// ==================== КЛИЕНТЫ ====================
async function loadClients() {
    try {
        const response = await fetch(`${API_URL}/clients`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);

        let clients = await response.json();
        const clientsList = document.getElementById('clientsList');

        if (!clients || clients.length === 0) {
            clientsList.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> Клиенты не найдены. Создайте первого клиента.
                </div>
            `;
            return;
        }

        // Обогащаем каждого клиента количеством машин и их статусом
        const clientsWithCarCount = await Promise.all(
            clients.map(async (client) => {
                try {
                    const carsResponse = await fetch(`${API_URL}/cars/client/${client.client_id}`);
                    if (!carsResponse.ok) throw new Error();

                    const cars = await carsResponse.json();
                    client.car_count = cars.length;

                    // Получаем активные заказы один раз (оптимизация)
                    const ordersResponse = await fetch(`${API_URL}/orders`);
                    const allOrders = ordersResponse.ok ? await ordersResponse.json() : [];
                    const activeOrders = allOrders.filter(o => 
                        o.status !== 'Выполнен' && o.status !== 'Отменен'
                    );

                    let carsInWork = 0, carsReady = 0, carsDiagnostic = 0;

                    cars.forEach(car => {
                        const carOrders = activeOrders.filter(o => o.car_id === car.car_id);
                        if (carOrders.some(o => o.status === 'В работе')) carsInWork++;
                        if (carOrders.some(o => o.status === 'Готов к выдаче')) carsReady++;
                        if (carOrders.some(o => o.status === 'На диагностике')) carsDiagnostic++;
                    });

                    client.cars_in_work = carsInWork;
                    client.cars_ready = carsReady;
                    client.cars_diagnostic = carsDiagnostic;

                } catch {
                    client.car_count = 0;
                    client.cars_in_work = client.cars_ready = client.cars_diagnostic = 0;
                }
                return client;
            })
        );

        // Формируем HTML
        let html = '<div class="list-group">';
        clientsWithCarCount.forEach(client => {
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
                        <i class="bi bi-telephone"></i> ${formatPhone(client.phone)}
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
    if (!confirm('Вы уверены, что хотите удалить клиента?')) return;

    try {
        const response = await fetch(`${API_URL}/clients/${clientId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess(`Клиент удален. Удалено ${data.deleted_cars || 0} авто и ${data.deleted_orders || 0} заказов.`);
            document.getElementById(`client-${clientId}`)?.remove();
            loadClients();
        } else {
            if (data.error?.includes('Доступ запрещен')) {
                showError('У вас недостаточно прав для удаления клиентов.');
            } else if (data.active_orders) {
                showError(`Нельзя удалить клиента с активными заказами (ID: ${data.active_orders.join(', ')}).`);
            } else if (data.error?.includes('Требуется авторизация')) {
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

    if (!nameInput || !phoneInput) {
        showError('Ошибка формы. Обновите страницу.');
        return;
    }

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    // Валидация клиента
    const validation = validateClientOnClient(name, phone);
    if (!validation.isValid) {
        showError('Исправьте ошибки в форме клиента');
        return;
    }

    // Данные автомобиля (если заполнены)
    const carModel = document.getElementById('newClientCarModel')?.value.trim() || '';
    const carVin = document.getElementById('newClientCarVin')?.value.trim().toUpperCase() || '';
    const carGosNumber = document.getElementById('newClientCarGosNumber')?.value.trim().toUpperCase() || '';
    const carYear = parseInt(document.getElementById('newClientCarYear')?.value) || null;
    const carMileage = parseInt(document.getElementById('newClientCarMileage')?.value) || null;

    const hasCarData = !!(carModel || carVin || carGosNumber || carYear || carMileage);

    // Валидация автомобиля, если данные введены
    if (hasCarData) {
        const errors = [];

        if (!carModel) errors.push('Поле "Модель автомобиля" обязательно');
        if (!carVin || !/^[A-HJ-NPR-Z0-9]{17}$/.test(carVin)) {
            errors.push('Неверный формат VIN номера (ровно 17 символов)');
        }
        if (!carGosNumber || !/^[А-Я][0-9]{3}[А-Я]{2}[0-9]{2,3}$|^[А-Я]{2}[0-9]{3}[0-9]{2,3}$/.test(carGosNumber)) {
            errors.push('Неверный формат госномера (примеры: А123БВ77, ВС12345)');
        }
        if (!carYear || carYear < 1900 || carYear > new Date().getFullYear() + 1) {
            errors.push(`Год выпуска должен быть от 1900 до ${new Date().getFullYear() + 1}`);
        }
        if (!carMileage || carMileage < 0 || carMileage > 1000000) {
            errors.push('Пробег должен быть от 0 до 1 000 000 км');
        }

        if (errors.length > 0) {
            showError(errors.join('<br>'));
            return;
        }
    }

    const clientData = { name: validation.name, phone: validation.phone };

    try {
        // 1. Создаём клиента
        const clientRes = await fetch(`${API_URL}/clients`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(clientData)
        });

        const clientDataRes = await clientRes.json();

        if (!clientRes.ok) {
            if (clientRes.status === 401) {
                showError('Ошибка авторизации. Войдите заново.');
                logout();
                return;
            }
            throw new Error(clientDataRes.error || 'Ошибка создания клиента');
        }

        const newClientId = clientDataRes.client.client_id;

        // 2. Если есть данные автомобиля — создаём его
        if (hasCarData && newClientId) {
            const carData = {
                client_id: newClientId,
                model: carModel,
                vin: carVin,
                gos_number: carGosNumber,
                year: carYear,
                mileage: carMileage
            };

            const carRes = await fetch(`${API_URL}/cars`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(carData)
            });

            if (!carRes.ok) {
                // Откат: удаляем только что созданного клиента
                await fetch(`${API_URL}/clients/${newClientId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const carError = await carRes.json();
                throw new Error(`Автомобиль не создан: ${carError.details?.vin || carError.error}. Клиент удалён.`);
            }
        }

        showSuccess(hasCarData 
            ? `Клиент "${validation.name}" и автомобиль "${carModel}" созданы!` 
            : `Клиент "${validation.name}" создан!`);

        // Очистка формы
        nameInput.value = '';
        phoneInput.value = '';
        ['newClientCarModel', 'newClientCarVin', 'newClientCarGosNumber', 'newClientCarYear', 'newClientCarMileage']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

        showFieldError('newClientName', null);
        showFieldError('newClientPhone', null);

        loadClients();

    } catch (error) {
        showError(error.message);
    }
}