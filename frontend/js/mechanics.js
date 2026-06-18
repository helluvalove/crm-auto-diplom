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
                { user_id: 2, full_name: 'Петров Алексей Владимирович', phone: '+79991234567', login: 'mechanic' }
            ];
        }

        renderMechanicsList(mechanics);
        updateMechanicSelect(mechanics);

    } catch (error) {
        console.error('Ошибка загрузки механиков:', error);
        showError('Ошибка загрузки механиков: ' + error.message);
    }
}

// Лимиты полей механика (используются и при создании, и при редактировании)
const MECHANIC_LIMITS = {
    name:     { min: 2,  max: 40 },
    login:    { min: 6,  max: 15  },
    password: { min: 6,  max: 15  }
};

async function createMechanic() {
    const fullName = (document.getElementById('newMechanicName')?.value || '').trim();
    const phone    = (document.getElementById('newMechanicPhone')?.value || '').trim();
    const login    = (document.getElementById('newMechanicLogin')?.value || '').trim();
    const password = (document.getElementById('newMechanicPassword')?.value || '');

    // === Валидация ===
    let isValid = true;

    // ФИО
    if (!fullName) {
        showFieldError('newMechanicName', 'Введите ФИО механика');
        isValid = false;
    } else if (/\d/.test(fullName)) {
        showFieldError('newMechanicName', 'ФИО не должно содержать цифры');
        isValid = false;
    } else if (fullName.length < MECHANIC_LIMITS.name.min) {
        showFieldError('newMechanicName', `ФИО должно содержать минимум ${MECHANIC_LIMITS.name.min} символа`);
        isValid = false;
    } else if (fullName.length > MECHANIC_LIMITS.name.max) {
        showFieldError('newMechanicName', `ФИО не должно превышать ${MECHANIC_LIMITS.name.max} символов`);
        isValid = false;
    } else {
        showFieldError('newMechanicName', null);
    }

    // Телефон
    const phoneValidation = validateRussianPhone(phone);
    if (!phoneValidation.isValid) {
        showFieldError('newMechanicPhone', phoneValidation.message);
        isValid = false;
    } else {
        showFieldError('newMechanicPhone', null);
    }

    // Логин
    if (!login) {
        showFieldError('newMechanicLogin', 'Введите логин');
        isValid = false;
    } else if (login.length < MECHANIC_LIMITS.login.min || login.length > MECHANIC_LIMITS.login.max) {
        showFieldError('newMechanicLogin', `Логин: от ${MECHANIC_LIMITS.login.min} до ${MECHANIC_LIMITS.login.max} символов`);
        isValid = false;
    } else {
        showFieldError('newMechanicLogin', null);
    }

    // Пароль
    if (!password) {
        showFieldError('newMechanicPassword', 'Введите пароль');
        isValid = false;
    } else if (password.length < MECHANIC_LIMITS.password.min || password.length > MECHANIC_LIMITS.password.max) {
        showFieldError('newMechanicPassword', `Пароль: от ${MECHANIC_LIMITS.password.min} до ${MECHANIC_LIMITS.password.max} символов`);
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

            ['newMechanicName', 'newMechanicPhone',
             'newMechanicLogin', 'newMechanicPassword']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });

            clearMechanicCreationErrors();
            loadMechanicsList();

        } else {
            if (errorData) {
                if (errorData.error?.includes('телефон')) {
                    showFieldDuplicate('newMechanicPhone', 'Механик с таким номером телефона уже существует');
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
        html += `
            <div class="list-group-item" id="mechanic-${mechanic.user_id}">
                <div class="d-flex w-100 justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${mechanic.full_name}</h6>
                        <small class="text-muted">
                            <i class="bi bi-telephone"></i> ${formatPhone(mechanic.phone)}
                        </small>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-warning me-1" onclick="editMechanic(${mechanic.user_id})" title="Редактировать">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteMechanic(${mechanic.user_id})" title="Удалить">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
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
    const fields = ['newMechanicName', 'newMechanicPhone',
                    'newMechanicLogin', 'newMechanicPassword'];
    fields.forEach(fieldId => {
        showFieldError(fieldId, null);
    });
    showFieldDuplicate('newMechanicPhone', null);
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
        const response = await fetch(`${API_URL}/mechanics/${mechanicId}`);
        if (!response.ok) {
            throw new Error(`Ошибка загрузки механика: ${response.status}`);
        }
        
        const mechanic = await response.json();
        
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
                                           value="${mechanic.full_name}" maxlength="40" required>
                                    <div class="invalid-feedback" id="editMechanicNameError"></div>
                                    <div class="form-text d-flex justify-content-between">
                                        <span>От 2 до 40 символов</span>
                                        <span id="editMechanicNameCounter" class="text-muted">${mechanic.full_name.length}/40</span>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Телефон *</label>
                                    <input type="tel" class="form-control" id="editMechanicPhone" 
                                           value="${formatPhone(mechanic.phone)}" required>
                                    <div class="invalid-feedback" id="editMechanicPhoneError"></div>
                                    <div class="form-text">В формате: +7(XXX) XXX-XX-XX</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Логин *</label>
                                    <input type="text" class="form-control" id="editMechanicLogin" 
                                           value="${mechanic.login}" minlength="6" maxlength="15" required>
                                    <div class="invalid-feedback" id="editMechanicLoginError"></div>
                                    <div class="form-text d-flex justify-content-between">
                                        <span>От 6 до 15 символов</span>
                                        <span id="editMechanicLoginCounter" class="text-muted">${mechanic.login.length}/15</span>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Пароль</label>
                                    <input type="password" class="form-control" id="editMechanicPassword" 
                                           placeholder="Оставьте пустым, если не нужно менять"
                                           minlength="6" maxlength="15">
                                    <div class="invalid-feedback" id="editMechanicPasswordError"></div>
                                    <div class="form-text d-flex justify-content-between">
                                        <span>От 6 до 15 символов (оставьте пустым, чтобы не менять)</span>
                                        <span id="editMechanicPasswordCounter" class="text-muted">0/15</span>
                                    </div>
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
        
        const oldModal = document.getElementById('editMechanicModal');
        if (oldModal) oldModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Счётчики символов в модалке редактирования
        const nameInput = document.getElementById('editMechanicName');
        if (nameInput) {
            // Фильтрация цифр
            nameInput.addEventListener('input', function() {
                sanitizeNameInput(this);
                const nameCounter = document.getElementById('editMechanicNameCounter');
                if (nameCounter) nameCounter.textContent = `${this.value.length}/${MECHANIC_LIMITS.name.max}`;
                if (this.value.trim().length >= MECHANIC_LIMITS.name.min) {
                    this.classList.remove('is-invalid');
                    const err = document.getElementById('editMechanicNameError');
                    if (err) { err.textContent = ''; err.style.display = 'none'; }
                }
            });
        }

        const loginInput = document.getElementById('editMechanicLogin');
        if (loginInput) {
            const loginCounter = document.getElementById('editMechanicLoginCounter');
            loginInput.addEventListener('input', function() {
                if (loginCounter) loginCounter.textContent = `${this.value.length}/${MECHANIC_LIMITS.login.max}`;
            });
        }

        const passwordInput = document.getElementById('editMechanicPassword');
        if (passwordInput) {
            const passwordCounter = document.getElementById('editMechanicPasswordCounter');
            passwordInput.addEventListener('input', function() {
                if (passwordCounter) passwordCounter.textContent = `${this.value.length}/${MECHANIC_LIMITS.password.max}`;
            });
        }
        
        // Инициализация телефона
        const phoneInput = document.getElementById('editMechanicPhone');
        if (phoneInput) {
            phoneInput.addEventListener('input', function(e) {
                formatPhoneInput(this);
                showFieldDuplicate('editMechanicPhone', null);
            });
            
            phoneInput.addEventListener('keydown', function(e) {
                const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                if (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;
                if (e.key >= '0' && e.key <= '9') return;
                if (e.key === '+' && (this.selectionStart === 0 || this.value === '')) return;
                if (allowedKeys.includes(e.key)) return;
                e.preventDefault();
            });
            
            phoneInput.addEventListener('focus', function() {
                if (!this.value) this.value = '+7 ';
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
        
        const modal = new bootstrap.Modal(document.getElementById('editMechanicModal'));
        modal.show();
        
    } catch (error) {
        console.error('Ошибка загрузки данных механика:', error);
        showError('Ошибка загрузки данных механика: ' + error.message);
    }
}

// Валидация и обновление механика
async function validateAndUpdateMechanic(mechanicId) {
    const name  = (document.getElementById('editMechanicName')?.value || '').trim();
    const phone = (document.getElementById('editMechanicPhone')?.value || '').trim();
    const login = (document.getElementById('editMechanicLogin')?.value || '').trim();
    const password = (document.getElementById('editMechanicPassword')?.value || '');
    
    clearMechanicValidationErrors();
    
    let isValid = true;
    const errors = {};
    
    // ФИО
    if (!name) {
        errors.name = 'Введите ФИО механика';
        isValid = false;
    } else if (/\d/.test(name)) {
        errors.name = 'ФИО не должно содержать цифры';
        isValid = false;
    } else if (name.length < MECHANIC_LIMITS.name.min) {
        errors.name = `ФИО должно содержать минимум ${MECHANIC_LIMITS.name.min} символа`;
        isValid = false;
    } else if (name.length > MECHANIC_LIMITS.name.max) {
        errors.name = `ФИО не должно превышать ${MECHANIC_LIMITS.name.max} символов`;
        isValid = false;
    }
    
    // Телефон
    const phoneValidation = validateRussianPhone(phone);
    if (!phoneValidation.isValid) {
        errors.phone = phoneValidation.message;
        isValid = false;
    }
    
    // Логин
    if (!login) {
        errors.login = 'Введите логин';
        isValid = false;
    } else if (login.length < MECHANIC_LIMITS.login.min || login.length > MECHANIC_LIMITS.login.max) {
        errors.login = `Логин: от ${MECHANIC_LIMITS.login.min} до ${MECHANIC_LIMITS.login.max} символов`;
        isValid = false;
    }
    
    // Пароль (если указан)
    if (password && (password.length < MECHANIC_LIMITS.password.min || password.length > MECHANIC_LIMITS.password.max)) {
        errors.password = `Пароль: от ${MECHANIC_LIMITS.password.min} до ${MECHANIC_LIMITS.password.max} символов`;
        isValid = false;
    }
    
    if (!isValid) {
        showMechanicValidationErrors(errors);
        showError('Исправьте ошибки в форме');
        return;
    }
    
    const mechanicData = {
        full_name: name,
        phone: phoneValidation.isValid ? phoneValidation.phone : phone,
        login: login
    };
    
    if (password) {
        mechanicData.password = password;
    }
    
    console.log("Sending update request:", mechanicData);
    
    try {
        const response = await fetch(`${API_URL}/mechanics/${mechanicId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mechanicData)
        });
        
        console.log("Response status:", response.status);
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
            
            const modalElement = document.getElementById('editMechanicModal');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) modal.hide();
            }
            
            setTimeout(() => {
                loadMechanicsList();
            }, 300);
            
        } else {
            if (errorData) {
                console.log("Server error details:", errorData);
                if (errorData.duplicate_phone) {
                    showFieldDuplicate('editMechanicPhone', 'Механик с таким номером телефона уже существует');
                    showError('Механик с таким номером телефона уже существует');
                } else if (errorData.duplicate_login) {
                    showMechanicValidationErrors({ 
                        login: 'Логин уже занят другим пользователем'
                    });
                    showError('Логин уже занят другим пользователем');
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
    const fields = ['name', 'phone', 'login', 'password'];
    fields.forEach(field => {
        const input = document.getElementById(`editMechanic${field.charAt(0).toUpperCase() + field.slice(1)}`);
        const errorElement = document.getElementById(`editMechanic${field.charAt(0).toUpperCase() + field.slice(1)}Error`);
        if (input) {
            input.classList.remove('is-invalid', 'is-valid', 'is-duplicate');
        }
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    });
    showFieldDuplicate('editMechanicPhone', null);
}

// Показ ошибок валидации
function showMechanicValidationErrors(errors) {
    console.log("Validation errors:", errors);
    
    for (const [field, message] of Object.entries(errors)) {
        const input = document.getElementById(`editMechanic${field.charAt(0).toUpperCase() + field.slice(1)}`);
        const errorElement = document.getElementById(`editMechanic${field.charAt(0).toUpperCase() + field.slice(1)}Error`);
        
        if (input && errorElement) {
            input.classList.add('is-invalid');
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    if (Object.keys(errors).length > 0) {
        showError('Исправьте ошибки в форме');
    }
}

// Подтверждение удаления механика
function confirmDeleteMechanic(mechanicId) {
    const modal = bootstrap.Modal.getInstance(document.getElementById('editMechanicModal'));
    if (modal) modal.hide();
    
    setTimeout(() => {
        if (confirm('Вы уверены, что хотите удалить механика? Это действие нельзя отменить.')) {
            deleteMechanic(mechanicId);
        } else {
            setTimeout(() => editMechanic(mechanicId), 300);
        }
    }, 300);
}

// Счётчики символов и сброс дублей при вводе в форме создания
document.addEventListener('DOMContentLoaded', () => {
    // Телефон — сброс дубликата
    const newPhone = document.getElementById('newMechanicPhone');
    if (newPhone) {
        newPhone.addEventListener('input', () => {
            showFieldDuplicate('newMechanicPhone', null);
        });
    }

    // Счётчик ФИО + запрет цифр
    const newName = document.getElementById('newMechanicName');
    if (newName) {
        const counter = document.getElementById('newMechanicNameCounter');
        newName.addEventListener('input', function() {
            sanitizeNameInput(this);  // удаляем цифры
            if (counter) counter.textContent = `${this.value.length}/${MECHANIC_LIMITS.name.max}`;
            if (this.value.length > 0) showFieldError('newMechanicName', null);
        });
    }

    // Счётчик логина
    const newLogin = document.getElementById('newMechanicLogin');
    if (newLogin) {
        const counter = document.getElementById('newMechanicLoginCounter');
        newLogin.addEventListener('input', function() {
            if (counter) counter.textContent = `${this.value.length}/${MECHANIC_LIMITS.login.max}`;
            if (this.value.length >= MECHANIC_LIMITS.login.min) showFieldError('newMechanicLogin', null);
        });
    }

    // Счётчик пароля
    const newPassword = document.getElementById('newMechanicPassword');
    if (newPassword) {
        const counter = document.getElementById('newMechanicPasswordCounter');
        newPassword.addEventListener('input', function() {
            if (counter) counter.textContent = `${this.value.length}/${MECHANIC_LIMITS.password.max}`;
            if (this.value.length >= MECHANIC_LIMITS.password.min) showFieldError('newMechanicPassword', null);
        });
    }
});

function setDefaultAvailabilityDate() {
    const dateInput = document.getElementById('availabilityDate');
    if (!dateInput || dateInput.value) return;

    let d = new Date();
    if (d.getDay() === 0) {
        d.setDate(d.getDate() + 1);
    }
    const today = d.toISOString().slice(0, 10);
    dateInput.value = today;
}

async function loadAvailability() {
    const dateInput = document.getElementById('availabilityDate');
    if (!dateInput) return;
    const date = dateInput.value;
    if (!date) {
        showError('Выберите дату');
        return;
    }

    const d = new Date(date);
    if (d.getDay() === 0) {
        const container = document.getElementById('availabilityContainer');
        if (container) {
            container.innerHTML = `<div class="alert alert-warning"><i class="bi bi-calendar-x"></i> Воскресенье — выходной. Записи не принимаются.</div>`;
        }
        return;
    }

    try {
        const resp = await fetch(`${API_URL}/mechanics/availability?date=${date}`);
        if (!resp.ok) throw new Error();
        const data = await resp.json();
        renderAvailability(data, date);
    } catch (e) {
        showError('Ошибка загрузки занятости');
    }
}

function renderAvailability(mechanics, date) {
    const container = document.getElementById('availabilityContainer');
    if (!container) return;

    if (!mechanics || mechanics.length === 0) {
        container.innerHTML = `<div class="alert alert-info">Нет данных о механиках</div>`;
        return;
    }

    const dayStartHour = 10, dayEndHour = 20;
    const dayStartMin = dayStartHour * 60;
    const dayEndMin   = dayEndHour * 60;
    const totalMin    = dayEndMin - dayStartMin;

    const selectedDate = new Date(date + 'T00:00:00');
    const dayBegin = new Date(selectedDate);
    dayBegin.setHours(dayStartHour, 0, 0, 0);
    const dayFinish = new Date(selectedDate);
    dayFinish.setHours(dayEndHour, 0, 0, 0);

    const hourMarks = [];
    for (let h = 10; h <= 20; h++) hourMarks.push(`${h}:00`);

    let html = `
        <div class="d-flex align-items-center justify-content-between mb-2">
            <h6 class="mb-0"><i class="bi bi-calendar-week"></i> Занятость на ${date}</h6>
            <button class="btn btn-sm btn-outline-secondary" id="availabilityToggleBtn"
                onclick="toggleAvailabilityChart()"
                title="Свернуть / развернуть график">
                <i class="bi bi-chevron-up" id="availabilityToggleIcon"></i>
            </button>
        </div>
        <div id="availabilityChartBody">
        <div class="timeline-header-row">
            <div class="mechanic-name-placeholder">placeholder</div>
            <div class="timeline-marks">
                ${hourMarks.map(m => `<span>${m}</span>`).join('')}
            </div>
        </div>
    `;

    mechanics.forEach(m => {
        const relevantSlots = (m.busy_slots || [])
            .map(slot => ({
                start: new Date(slot.start),
                end: new Date(slot.end),
                order_id: slot.order_id,
                status: slot.status,
                indefinite: slot.indefinite
            }))
            .filter(s => s.start < dayFinish && s.end > dayBegin)
            .map(s => {
                const clippedStart = s.start < dayBegin ? dayBegin : s.start;
                const clippedEnd   = s.end   > dayFinish ? dayFinish : s.end;
                return {
                    ...s,
                    clippedStart,
                    clippedEnd,
                    startMin: (clippedStart.getHours() * 60 + clippedStart.getMinutes()) - dayStartMin,
                    endMin:   (clippedEnd.getHours()   * 60 + clippedEnd.getMinutes())   - dayStartMin
                };
            })
            .filter(s => s.startMin < s.endMin)
            .sort((a, b) => a.startMin - b.startMin);

        const intervals = [];
        let cursor = 0;

        relevantSlots.forEach(s => {
            if (s.startMin > cursor) {
                intervals.push({
                    type: 'free',
                    start: cursor,
                    end: s.startMin,
                    label: 'Свободно'
                });
            }
            intervals.push({
                type: 'busy',
                start: s.startMin,
                end: s.endMin,
                orderId: s.order_id,
                status: s.status,
                timeLabel: s.indefinite
                    ? 'бессрочно'
                    : `${formatTime(s.clippedStart)}–${formatTime(s.clippedEnd)}`
            });
            cursor = Math.max(cursor, s.endMin);
        });

        if (cursor < totalMin) {
            intervals.push({
                type: 'free',
                start: cursor,
                end: totalMin,
                label: 'Свободно'
            });
        }

        let blocksHtml = '';
        intervals.forEach(int => {
            const left = (int.start / totalMin) * 100;
            const width = ((int.end - int.start) / totalMin) * 100;
            if (int.type === 'free') {
                blocksHtml += `<div class="timeline-free" style="left:${left}%;width:${width}%;">${width > 10 ? int.label : ''}</div>`;
            } else {
                blocksHtml += `<div class="timeline-busy" 
                    style="left:${left}%;width:${width}%;" 
                    title="Заказ #${int.orderId}: ${int.timeLabel} (${int.status})"
                    data-order-id="${int.orderId}">${width > 10 ? int.timeLabel : ''}</div>`;
            }
        });

        html += `
            <div class="mechanic-row">
                <div class="mechanic-name" title="${m.full_name}">${m.full_name}</div>
                <div class="timeline">${blocksHtml}</div>
            </div>
        `;
    });

    html += `</div>`;

    container.innerHTML = html;

    container.querySelectorAll('.timeline-busy').forEach(el => {
        el.addEventListener('dblclick', function(e) {
            const orderId = this.dataset.orderId;
            if (orderId) {
                showOrderDetails(orderId);
            }
        });
    });
}

function formatTime(date) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function toggleAvailabilityChart() {
    const body = document.getElementById('availabilityChartBody');
    const icon = document.getElementById('availabilityToggleIcon');
    if (!body || !icon) return;

    const isCollapsed = body.style.display === 'none';
    body.style.display = isCollapsed ? '' : 'none';
    icon.className = isCollapsed ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
}