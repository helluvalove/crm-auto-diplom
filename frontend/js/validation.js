// ==================== ВАЛИДАЦИЯ ====================
/**
 * Валидация российского номера телефона
 * Поддерживает форматы: +7XXXXXXXXXX, 8XXXXXXXXXX, 7XXXXXXXXXX
 * @returns {{ isValid: boolean, message?: string, phone?: string }}
 */
function validateRussianPhone(phone) {
    if (!phone) {
        return { isValid: false, message: 'Введите номер телефона' };
    }

    // Очищаем от всех символов кроме цифр и +
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Разрешены только цифры и + в начале
    if (!/^[\+\d]+$/.test(cleanPhone)) {
        return { isValid: false, message: 'Телефон может содержать только цифры и знак + в начале' };
    }

    // Приводим к единому формату +7XXXXXXXXXX
    let normalized = cleanPhone;
    if (normalized.startsWith('8')) normalized = '+7' + normalized.slice(1);
    if (normalized.startsWith('7')) normalized = '+' + normalized;

    if (normalized.startsWith('+7') && normalized.length === 12) {
        return { isValid: true, phone: normalized };
    }

    // Формируем понятное сообщение об ошибке
    let message = '';
    if (!normalized.startsWith('+7')) {
        message = 'Телефон должен начинаться с +7, 8 или 7';
    } else if (normalized.length < 12) {
        const needed = 12 - normalized.length;
        message = `Введите ещё ${needed} цифр`;
    } else if (normalized.length > 12) {
        message = 'Слишком много цифр. Должно быть 11 цифр после +7';
    } else {
        message = 'Неверный формат. Используйте +7 (XXX) XXX-XX-XX';
    }

    return { isValid: false, message };
}

// Валидация имени
function validateName(name) {
    if (!name) {
        return { isValid: false, message: 'Введите имя клиента' };
    }

    const trimmed = name.trim();

    if (trimmed.length < 2) {
        return { isValid: false, message: 'Имя должно содержать минимум 2 символа' };
    }
    if (trimmed.length > 100) {
        return { isValid: false, message: 'Имя не должно превышать 100 символов' };
    }
    if (!/^[a-zA-Zа-яА-ЯёЁ\s\-]+$/.test(trimmed)) {
        return { isValid: false, message: 'Имя может содержать только буквы, пробелы и дефисы' };
    }

    return { isValid: true, name: trimmed };
}

/**
 * Комплексная валидация клиента (имя + телефон) + показ ошибок в форме
 */
function validateClientOnClient(name, phone) {
    const nameValidation = validateName(name);
    const phoneValidation = validateRussianPhone(phone);

    // Показываем ошибки сразу в полях
    showFieldError('newClientName', nameValidation.isValid ? null : nameValidation.message);
    showFieldError('newClientPhone', phoneValidation.isValid ? null : phoneValidation.message);

    return {
        isValid: nameValidation.isValid && phoneValidation.isValid,
        name: nameValidation.name,
        phone: phoneValidation.phone
    };
}

/**
 * Инициализация обработчиков валидации на форме
 * (вызывается один раз при загрузке страницы)
 */
function initializeValidation() {
    // === Телефон клиента ===
    const phoneInput = document.getElementById('newClientPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function () {
            formatPhoneInput(this);
        });

        phoneInput.addEventListener('keydown', function (e) {
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

            if (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;
            if (e.key >= '0' && e.key <= '9') return;
            if (e.key === '+' && (this.selectionStart === 0 || !this.value)) return;
            if (allowedKeys.includes(e.key)) return;

            e.preventDefault();
        });

        phoneInput.addEventListener('blur', function () {
            const validation = validateRussianPhone(this.value);
            showFieldError('newClientPhone', validation.isValid ? null : validation.message);

            if (!this.value) showFieldError('newClientPhone', null);
        });

        phoneInput.addEventListener('focus', function () {
            if (!this.value) this.value = '+7 ';
        });
    }

    // === Имя клиента ===
    const nameInput = document.getElementById('newClientName');
    if (nameInput) {
        nameInput.addEventListener('input', function () {
            const validation = validateName(this.value);
            showFieldError('newClientName', validation.isValid ? null : validation.message);
        });

        nameInput.addEventListener('blur', function () {
            const validation = validateName(this.value);
            showFieldError('newClientName', validation.isValid ? null : validation.message);
        });
    }

    // === Телефон механика ===
    const mechanicPhoneInput = document.getElementById('newMechanicPhone');
    if (mechanicPhoneInput) {
        mechanicPhoneInput.addEventListener('input', function () {
            formatPhoneInput(this);
        });

        mechanicPhoneInput.addEventListener('keydown', function (e) {
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

            if (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;
            if (e.key >= '0' && e.key <= '9') return;
            if (e.key === '+' && (this.selectionStart === 0 || !this.value)) return;
            if (allowedKeys.includes(e.key)) return;

            e.preventDefault();
        });

        mechanicPhoneInput.addEventListener('focus', function () {
            if (!this.value) this.value = '+7 ';
        });
    }
}