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
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="editClient(${client.client_id})" title="Редактировать">
                                <i class="bi bi-pencil"></i>
                            </button>
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

// ========== СБРОС ФОРМЫ КЛИЕНТА ==========
function resetClientForm() {
    const nameInput = document.getElementById('newClientName');
    const phoneInput = document.getElementById('newClientPhone');
    const carFields = ['newClientCarModel', 'newClientCarVin', 'newClientCarGosNumber', 'newClientCarYear', 'newClientCarMileage'];

    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '+7 ';
    carFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Сброс всех подсветок
    showFieldError('newClientName', null);
    showFieldError('newClientPhone', null);
    showFieldDuplicate('newClientPhone', null);
    showFieldDuplicate('newClientCarVin', null);
    showFieldDuplicate('newClientCarGosNumber', null);
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

    const validation = validateClientOnClient(name, phone);
    if (!validation.isValid) {
        showError('Исправьте ошибки в форме клиента');
        return;
    }

    // === Данные автомобиля ===
    const carModelInput = document.getElementById('newClientCarModel');
    const carVinInput = document.getElementById('newClientCarVin');
    const carGosNumberInput = document.getElementById('newClientCarGosNumber');
    const carYearInput = document.getElementById('newClientCarYear');
    const carMileageInput = document.getElementById('newClientCarMileage');

    const carModel = carModelInput?.value.trim() || '';
    const carVin = carVinInput?.value.trim().toUpperCase() || '';
    const carGosNumber = carGosNumberInput?.value.trim().toUpperCase() || '';
    const carYear = carYearInput?.value || '';
    const carMileage = carMileageInput?.value || '';

    const hasCarData = !!(carModel || carVin || carGosNumber || carYear || carMileage);

    // Валидация автомобиля
    if (hasCarData) {
        const carData = {
            model: carModel,
            vin: carVin,
            gosNumber: carGosNumber,
            year: carYear,
            mileage: carMileage
        };
        
        const errors = validateCarData(carData);
        
        if (errors.length > 0) {
            showError(errors.join('<br>'));
            return;
        }
    }

    const clientData = { name: validation.name, phone: validation.phone };

    try {
        // 1. Создаём клиента
        const clientRes = await fetch(`${API_URL}/clients/`, {
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

            if (clientRes.status === 400 && clientDataRes.details?.phone) {
                showFieldDuplicate('newClientPhone', clientDataRes.details.phone);
                showError('Клиент с таким номером телефона уже существует');
                return;
            }

            console.error('Неожиданная ошибка создания клиента:', clientRes.status, clientDataRes);
            showError(clientDataRes.error || 'Ошибка создания клиента');
            return;
        }

        const newClientId = clientDataRes.client.client_id;

        // 2. Создаём автомобиль (если есть данные)
        if (hasCarData && newClientId) {
            const carData = {
                client_id: newClientId,
                model: carModel,
                vin: carVin,
                gos_number: carGosNumber,
                year: parseInt(carYear),
                mileage: parseInt(carMileage)
            };

            const carRes = await fetch(`${API_URL}/cars/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(carData)
            });

            if (!carRes.ok) {
                const carError = await carRes.json();

                // ❗️ ВАЖНО: всегда удаляем клиента при ошибке создания автомобиля
                try {
                    await fetch(`${API_URL}/clients/${newClientId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    console.log(`Клиент ${newClientId} удалён из-за ошибки создания автомобиля`);
                } catch (deleteError) {
                    console.error('Ошибка при удалении клиента:', deleteError);
                }

                // Обрабатываем конкретные ошибки дубликатов
                if (carRes.status === 400) {
                    if (carError.details?.vin) {
                        showFieldDuplicate('newClientCarVin', carError.details.vin);
                        showError('Автомобиль с таким VIN уже существует. Клиент НЕ создан.');
                        return;
                    }
                    if (carError.details?.gos_number) {
                        showFieldDuplicate('newClientCarGosNumber', carError.details.gos_number);
                        showError('Автомобиль с таким госномером уже существует. Клиент НЕ создан.');
                        return;
                    }
                }

                // Другие ошибки
                showError(carError.error || 'Ошибка создания автомобиля. Клиент НЕ создан.');
                return;
            }
        }

        // Успех
        showSuccess(hasCarData 
            ? `Клиент "${validation.name}" и автомобиль "${carModel}" созданы!` 
            : `Клиент "${validation.name}" создан!`);

        resetClientForm();
        loadClients();

    } catch (error) {
        console.error('Критическая ошибка в createClient:', error);
        showError(error.message);
    }
}

// Открытие модального окна редактирования клиента
async function editClient(clientId) {
    try {
        const response = await fetch(`${API_URL}/clients/${clientId}`);
        if (!response.ok) throw new Error('Ошибка загрузки данных клиента');
        
        const client = await response.json();
        
        document.getElementById('editClientId').value = client.client_id;
        document.getElementById('editClientName').value = client.name || '';
        
        const phoneField = document.getElementById('editClientPhone');
        // Устанавливаем отформатированное значение сразу
        phoneField.value = formatPhone(client.phone) || '+7 ';
        
        // Удаляем старые обработчики (чтобы не дублировались)
        phoneField.removeEventListener('input', formatPhoneInputHandler);
        phoneField.addEventListener('input', function(e) {
            formatPhoneInput(e.target);
            showFieldDuplicate('editClientPhone', null); // сброс жёлтой подсветки
        });
        
        document.getElementById('editClientVkId').value = client.vk_user_id || '';
        
        clearEditFormErrors();
        
        const modal = new bootstrap.Modal(document.getElementById('editClientModal'));
        modal.show();
        
    } catch (error) {
        console.error('Ошибка при загрузке клиента для редактирования:', error);
        showError('Не удалось загрузить данные клиента');
    }
}

// Вспомогательная функция-обёртка для передачи this в formatPhoneInput
function formatPhoneInputHandler(e) {
    formatPhoneInput(e.target);
}

// Очистка ошибок в форме редактирования
function clearEditFormErrors() {
    ['editClientName', 'editClientPhone', 'editClientVkId'].forEach(id => {
        const input = document.getElementById(id);
        input.classList.remove('is-invalid', 'is-duplicate');
        const errorEl = document.getElementById(id.replace('edit', '') + 'Error');
        if (errorEl) errorEl.textContent = '';
        // Удаляем возможное сообщение о дубликате
        const duplicateMsg = input.parentNode.querySelector('.duplicate-feedback');
        if (duplicateMsg) duplicateMsg.remove();
    });
}

// Сохранение изменений клиента
async function saveEditedClient() {
    const clientId = document.getElementById('editClientId').value;
    const nameInput = document.getElementById('editClientName');
    const phoneInput = document.getElementById('editClientPhone');
    const vkIdInput = document.getElementById('editClientVkId');
    
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    let vkId = vkIdInput.value.trim();
    
    // Валидация на стороне клиента
    let hasErrors = false;
    clearEditFormErrors();
    
    if (!name || name.length < 2) {
        nameInput.classList.add('is-invalid');
        document.getElementById('editNameError').textContent = 'Имя должно содержать минимум 2 символа';
        hasErrors = true;
    }
    
    if (!phone) {
        phoneInput.classList.add('is-invalid');
        document.getElementById('editPhoneError').textContent = 'Телефон обязателен';
        hasErrors = true;
    }
    
    if (vkId && !/^\d+$/.test(vkId)) {
        vkIdInput.classList.add('is-invalid');
        document.getElementById('editVkIdError').textContent = 'VK ID должен содержать только цифры';
        hasErrors = true;
    }
    
    if (hasErrors) return;
    
    // Подготовка данных
    const updateData = {
        name: name,
        phone: phone,
        vk_user_id: vkId ? parseInt(vkId) : null
    };
    
    try {
        const response = await fetch(`${API_URL}/clients/${clientId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Данные клиента обновлены');
            // Закрываем модальное окно
            bootstrap.Modal.getInstance(document.getElementById('editClientModal')).hide();
            // Обновляем список клиентов
            loadClients();
        } else {
            // Обработка ошибок валидации от сервера
            if (data.details) {
                if (data.details.name) {
                    nameInput.classList.add('is-invalid');
                    document.getElementById('editNameError').textContent = data.details.name;
                }
                if (data.details.phone) {
                    // Жёлтая подсветка для дубликата (как при создании клиента)
                    showFieldDuplicate('editClientPhone', data.details.phone);
                    // Дополнительно можно вывести текст ошибки, но showFieldDuplicate уже создаёт блок
                } else if (data.details.phone === undefined && data.error?.includes('телефон')) {
                    // На случай, если ошибка пришла в другом формате
                    showFieldDuplicate('editClientPhone', 'Клиент с таким телефоном уже существует');
                }
                if (data.details.vk_user_id) {
                    vkIdInput.classList.add('is-invalid');
                    document.getElementById('editVkIdError').textContent = data.details.vk_user_id;
                }
                showError(data.message || 'Ошибка валидации данных');
            } else if (data.error) {
                showError(data.error);
            } else {
                showError('Ошибка при обновлении клиента');
            }
        }
    } catch (error) {
        console.error('Ошибка при сохранении клиента:', error);
        showError('Ошибка соединения с сервером');
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ СБРОСА ПРИ ВВОДЕ И ОТКРЫТИИ ВКЛАДКИ ==========
document.addEventListener('DOMContentLoaded', () => {
    // Обработчики сброса дубликата при вводе в поля клиента
    const phoneInput = document.getElementById('newClientPhone');
    const nameInput = document.getElementById('newClientName');
    const vinInput = document.getElementById('newClientCarVin');
    const gosInput = document.getElementById('newClientCarGosNumber');

    if (phoneInput) {
        // Уже есть в validation.js, но продублируем сброс дубликата на всякий случай
        phoneInput.addEventListener('input', () => {
            showFieldDuplicate('newClientPhone', null);
        });
    }
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            showFieldError('newClientName', null);
        });
    }
    if (vinInput) {
        vinInput.addEventListener('input', () => {
            showFieldDuplicate('newClientCarVin', null);
        });
    }
    if (gosInput) {
        gosInput.addEventListener('input', () => {
            showFieldDuplicate('newClientCarGosNumber', null);
        });
    }

    // При открытии вкладки "Клиенты" сбрасываем форму и подсветки
    const clientsTabButton = document.querySelector('button[onclick="showTab(\'clients\', event)"]');
    if (clientsTabButton) {
        clientsTabButton.addEventListener('click', () => {
            setTimeout(() => {
                if (document.getElementById('clientsTab').style.display === 'block') {
                    resetClientForm();
                }
            }, 100);
        });
    }
});