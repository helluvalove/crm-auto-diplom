// Форматирование телефона при вводе
function formatPhoneInput(input) {
    let value = input.value;

    // Оставляем только цифры и возможный "+" в начале
    let cleaned = value.replace(/\D/g, '');

    // Сохраняем "+" если он был в начале
    const hadPlus = value.trim().startsWith('+');
    if (hadPlus && cleaned.length > 0) {
        cleaned = '+' + cleaned;
    }

    // === НОВАЯ ПРОВЕРКА: если нет цифр или только + / +7 — ставим базовую маску ===
    if (!cleaned || cleaned === '+' || cleaned === '+7' || /^\+?$/.test(cleaned)) {
        input.value = '+7 ';
        setTimeout(() => {
            const validation = validateRussianPhone(input.value);
            showFieldError(input.id, validation.isValid ? null : validation.message);
        }, 10);
        return;
    }

    // Приводим к формату +7
    if (cleaned.startsWith('8') || cleaned.startsWith('7')) {
        cleaned = '+7' + cleaned.slice(1);
    }

    // Ограничиваем максимальную длину (+7XXXXXXXXXX = 12 символов)
    if (cleaned.length > 12) {
        cleaned = cleaned.slice(0, 12);
    }

    // Красивое форматирование +7 (XXX) XXX-XX-XX
    if (cleaned.startsWith('+7') && cleaned.length > 2) {
        const digits = cleaned.slice(2);
        let formatted = '+7';

        if (digits.length > 0) formatted += ` (${digits.slice(0, 3)}`;
        if (digits.length > 3) formatted += `) ${digits.slice(3, 6)}`;
        if (digits.length > 6) formatted += `-${digits.slice(6, 8)}`;
        if (digits.length > 8) formatted += `-${digits.slice(8, 10)}`;

        input.value = formatted;
    } else {
        input.value = cleaned;
    }

    // Автоматическая валидация после форматирования
    setTimeout(() => {
        const validation = validateRussianPhone(input.value);
        showFieldError(input.id, validation.isValid ? null : validation.message);
    }, 10);
}

// Красивый вид номера телефона для отображения в интерфейсе
function formatPhone(phone) {
    if (!phone) return '';

    // Оставляем только цифры и +
    const cleaned = phone.replace(/[^\d+]/g, '');

    // Российский формат
    const match = cleaned.match(/^\+?7(\d{3})(\d{3})(\d{2})(\d{2})$/);
    if (match) {
        return `+7 (${match[1]}) ${match[2]}-${match[3]}-${match[4]}`;
    }

    return cleaned; // если формат не распознан — возвращаем как есть
}

function getStatusClass(status) {
    switch (status) {
        case 'Создан':          return 'status-created';
        case 'Забронирован':    return 'status-booked';   // <-- новая строка
        case 'В работе':        return 'status-in-progress';
        case 'На диагностике':  return 'status-diagnostic';
        case 'Готов к выдаче':  return 'status-ready';
        case 'Выполнен':        return 'status-completed';
        case 'Отменен':         return 'status-cancelled';
        default:                return 'status-created';
    }
}

function formatMoney(value) {
    if (value === null || value === undefined || isNaN(value)) return '0,00 ₽';
    return Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
}

function enforceMaxPrice(input, maxVal) {
    const val = parseFloat(input.value);
    if (!isNaN(val) && val > maxVal) {
        input.value = maxVal;
    }
}

function handlePriceInput() {
    enforceMaxPrice(this, 99999999.99);             
    const val = parseFloat(this.value);
    const formatted = document.getElementById('orderPriceFormatted');
    if (formatted) {
        formatted.textContent = (!isNaN(val) && this.value.trim() !== '') ? formatMoney(val) : '';
    }
}

function generatePDF(orderId, docType, extraParams = {}) {
    let url = `${API_URL}/orders/${orderId}/pdf/${docType}`;
    if (extraParams && Object.keys(extraParams).length > 0) {
        const qs = new URLSearchParams(extraParams).toString();
        url += '?' + qs;
    }
    window.open(url, '_blank');
}

function isWorkingTime(datetimeStr) {
    if (!datetimeStr) return { valid: true };
    const dt = new Date(datetimeStr);
    if (isNaN(dt.getTime())) return { valid: false, message: 'Неверная дата' };
    const day = dt.getDay();
    if (day === 0) {
        return { valid: false, message: 'Воскресенье — выходной день. Выберите другой день.' };
    }
    const hours = dt.getHours();
    const minutes = dt.getMinutes();
    if (hours < 10 || hours >= 20 || (hours === 20 && minutes > 0)) {
        return { valid: false, message: 'Время записи должно быть с 10:00 до 20:00 (пн-сб).' };
    }
    return { valid: true };
}

function sanitizeNameInput(input) {
    if (!input) return;
    const cleaned = input.value.replace(/\d/g, '');
    if (cleaned !== input.value) {
        input.value = cleaned;
        // Можно вызвать событие input для обновления счётчика, если есть
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}