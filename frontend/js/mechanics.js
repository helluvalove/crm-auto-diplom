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

async function createMechanic() {
    const fullName = document.getElementById('newMechanicName').value.trim();
    const phone = document.getElementById('newMechanicPhone').value.trim();
    // const employeeNumber = document.getElementById('newMechanicEmployeeNumber').value.trim(); ← УДАЛИТЬ
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
        // Бейдж занятости убран, теперь просто карточка с ФИО и действиями
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
    // Дополнительно сбрасываем жёлтую подсветку дубликата
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
                                    <div class="form-text">В формате: +7(XXX) XXX-XX-XX</div>
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
                showFieldDuplicate('editMechanicPhone', null);
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
            input.classList.remove('is-invalid', 'is-valid', 'is-duplicate'); // добавлен is-duplicate
        }
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    });
    // Дополнительно сбрасываем дубликат телефона
    showFieldDuplicate('editMechanicPhone', null);
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

// Сброс жёлтого дубликата при вводе в поле телефона (форма создания)
document.addEventListener('DOMContentLoaded', () => {
    const newPhone = document.getElementById('newMechanicPhone');
    if (newPhone) {
        newPhone.addEventListener('input', () => {
            showFieldDuplicate('newMechanicPhone', null);
        });
    }
});

function setDefaultAvailabilityDate() {
    const dateInput = document.getElementById('availabilityDate');
    if (!dateInput || dateInput.value) return; // если уже выбрано – не трогаем

    let d = new Date();
    // Если сегодня воскресенье (0), перескочим на понедельник
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
        // Воскресенье – выходной
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

    // Параметры рабочего дня
    const dayStartHour = 10, dayEndHour = 20;
    const dayStartMin = dayStartHour * 60;   // 600
    const dayEndMin   = dayEndHour * 60;     // 1200
    const totalMin    = dayEndMin - dayStartMin; // 600

    // Преобразуем выбранную дату в объекты начала и конца рабочего дня
    const selectedDate = new Date(date + 'T00:00:00'); // YYYY-MM-DD
    const dayBegin = new Date(selectedDate);
    dayBegin.setHours(dayStartHour, 0, 0, 0);
    const dayFinish = new Date(selectedDate);
    dayFinish.setHours(dayEndHour, 0, 0, 0);

    // Часовые метки для шапки
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
        // Фильтруем слоты: пересечение с рабочим днём (dayBegin, dayFinish)
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
                // Обрезаем до границ дня
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
            .filter(s => s.startMin < s.endMin)  // исключаем нулевые интервалы
            .sort((a, b) => a.startMin - b.startMin);

        // Строим интервалы (занятые / свободные)
        const intervals = [];
        let cursor = 0; // минуты от начала дня (0..600)

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

        // Генерация блоков на временной шкале
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

    html += `</div>`; // закрываем #availabilityChartBody

    container.innerHTML = html;

    // Делегированный обработчик двойного клика на занятые полоски
    container.querySelectorAll('.timeline-busy').forEach(el => {
        el.addEventListener('dblclick', function(e) {
            const orderId = this.dataset.orderId;
            if (orderId) {
                showOrderDetails(orderId);
            }
        });
    });
}

// Вспомогательная функция форматирования времени (часы:минуты)
function formatTime(date) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Свернуть / развернуть график занятости
function toggleAvailabilityChart() {
    const body = document.getElementById('availabilityChartBody');
    const icon = document.getElementById('availabilityToggleIcon');
    if (!body || !icon) return;

    const isCollapsed = body.style.display === 'none';
    body.style.display = isCollapsed ? '' : 'none';
    icon.className = isCollapsed ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
}