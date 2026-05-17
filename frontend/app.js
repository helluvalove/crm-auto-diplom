// ==================== ИНИЦИАЛИЗАЦИЯ ДИНАМИЧЕСКИХ ЗНАЧЕНИЙ ====================
// Устанавливаем динамические значения для полей года выпуска
document.addEventListener('DOMContentLoaded', function() {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    
    // Устанавливаем max атрибут для полей года
    const clientCarYearInput = document.getElementById('newClientCarYear');
    if (clientCarYearInput) {
        clientCarYearInput.max = nextYear;
    }
    
    const carYearInput = document.getElementById('newCarYear');
    if (carYearInput) {
        carYearInput.max = nextYear;
    }
    
    // Обновляем текст подсказок
    const clientYearHint = document.getElementById('newClientCarYearHint');
    if (clientYearHint) {
        clientYearHint.textContent = `От 1900 до ${nextYear}`;
    }
    
    const carYearHint = document.getElementById('newCarYearHint');
    if (carYearHint) {
        carYearHint.textContent = `От 1900 до ${nextYear}`;
    }
});

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
// Оставляем только ОДИН обработчик DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    checkAPIStatus();
    loadMechanics();
    initializeValidation();
});