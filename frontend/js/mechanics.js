// ==================== АВТОМЕХАНИКИ ====================
async function loadMechanicsList() {
    try {
        const response = await fetch(`${API_URL}/mechanics`);

        let mechanics = [];

        if (response.ok) {
            mechanics = await response.json();
        } else {
            // Fallback для демо/теста
            mechanics = [
                { user_id: 2, full_name: 'Петров Алексей', phone: '+79991234567', specialization: 'Двигатель', employee_number: '001', login: 'mechanic' }
            ];
        }

        renderMechanicsList(mechanics);
        updateMechanicSelect(mechanics);

    } catch (error) {
        console.error('Ошибка загрузки механиков:', error);
        showError('Ошибка загрузки механиков: ' + error.message);
    }
}

async function createMechanic() {
    const fullName = document.getElementById('newMechanicName').value.trim();
    const phone = document.getElementById('newMechanicPhone').value.trim();
    const specialization = document.getElementById('newMechanicSpecialization').value.trim();
    const employeeNumber = document.getElementById('newMechanicEmployeeNumber').value.trim();
    const login = document.getElementById('newMechanicLogin').value.trim();
    const password = document.getElementById('newMechanicPassword').value;

    // === Валидация ===
    let isValid = true;

    if (!fullName) {
        showFieldError('newMechanicName', 'Введите ФИО механика');
        isValid = false;
    } else {
        showFieldError('newMechanicName', null);
    }

    const phoneValidation = validateRussianPhone(phone);
    if (!phoneValidation.isValid) {
        showFieldError('newMechanicPhone', phoneValidation.message);
        isValid = false;
    } else {
        showFieldError('newMechanicPhone', null);
    }

    if (!login) {
        showFieldError('newMechanicLogin', 'Введите логин');
        isValid = false;
    } else {
        showFieldError('newMechanicLogin', null);
    }

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

        const responseText = await response.text();
        let errorData = null;
        try { errorData = responseText ? JSON.parse(responseText) : null; } catch {}

        if (response.ok) {
            showSuccess(`Механик "${fullName}" добавлен!`);

            // Очистка формы
            ['newMechanicName', 'newMechanicPhone', 'newMechanicSpecialization',
             'newMechanicEmployeeNumber', 'newMechanicLogin', 'newMechanicPassword']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });

            clearMechanicCreationErrors();
            loadMechanicsList();

        } else {
            if (errorData) {
                if (errorData.error?.includes('телефон')) {
                    showFieldError('newMechanicPhone', 'Механик с таким номером телефона уже существует');
                    showError('Механик с таким номером телефона уже существует');
                } else if (errorData.error?.includes('логин')) {
                    showFieldError('newMechanicLogin', 'Логин уже занят');
                    showError('Логин уже занят');
                } else {
                    showError(errorData.error || 'Ошибка добавления механика');
                }
            } else {
                showError('Ошибка добавления механика');
            }
        }
    } catch (error) {
        console.error('Create mechanic error:', error);
        showError('Ошибка добавления механика: ' + error.message);
    }
}

async function deleteMechanic(mechanicId) {
    if (!confirm('Вы уверены, что хотите удалить механика?')) return;

    try {
        const response = await fetch(`${API_URL}/mechanics/${mechanicId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showSuccess('Механик удален');
            document.getElementById(`mechanic-${mechanicId}`)?.remove();
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

function renderMechanicsList(mechanics) {
    const list = document.getElementById('mechanicsList');
    if (!list) return;

    if (!mechanics || mechanics.length === 0) {
        list.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> Механики не найдены
            </div>
        `;
        return;
    }

    let html = '<div class="list-group">';
    mechanics.forEach(mechanic => {
        const activeOrders = ordersData?.filter(order =>
            order.mechanic_id === mechanic.user_id &&
            order.status !== 'Выполнен' &&
            order.status !== 'Отменен'
        ).length || 0;

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
                    <i class="bi bi-telephone"></i> ${formatPhone(mechanic.phone)}<br>
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

    list.innerHTML = html;
}

function updateMechanicSelect(mechanics) {
    const select = document.getElementById('orderMechanicSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Не назначен</option>';
    mechanics.forEach(mech => {
        select.innerHTML += `<option value="${mech.user_id}">${mech.full_name}</option>`;
    });
}

// Очистка ошибок при создании механика
function clearMechanicCreationErrors() {
    const fields = ['newMechanicName', 'newMechanicPhone', 'newMechanicSpecialization', 
                   'newMechanicEmployeeNumber', 'newMechanicLogin', 'newMechanicPassword'];
    fields.forEach(fieldId => {
        showFieldError(fieldId, null);
    });
}

// Функция для загрузки механиков в выпадающий список
async function loadMechanics() {
    try {
        const response = await fetch(`${API_URL}/mechanics`);
        const mechanics = response.ok ? await response.json() : [];
        updateMechanicSelect(mechanics);
    } catch (error) {
        console.error('Ошибка загрузки механиков для селекта:', error);
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
                                           value="${formatPhone(mechanic.phone)}" required>
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