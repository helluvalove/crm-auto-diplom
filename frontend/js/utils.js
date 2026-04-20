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
        case 'В работе':        return 'status-in-progress';
        case 'На диагностике':  return 'status-diagnostic';
        case 'Готов к выдаче':  return 'status-ready';
        case 'Выполнен':        return 'status-completed';
        case 'Отменен':         return 'status-cancelled';
        default:                return 'status-created';
    }
}