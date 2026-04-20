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

// ==================== ОБНОВЛЯЕМ ФУНКЦИИ ВХОДА/ВЫХОДА ====================

// Переопределяем функцию login для добавления кнопки бэкапа
const originalLoginFunction = window.login;

window.login = async function() {
    // Вызываем оригинальную функцию
    await originalLoginFunction.apply(this, arguments);
    
    console.log('=== DEBUG LOGIN FUNCTION ===');
    console.log('Current user:', currentUser);
    console.log('User role:', currentUser?.role);
    console.log('User login:', currentUser?.login);
    
    // Проверяем роль и показываем кнопку
    const isAdminOrManager = currentUser?.role === 'менеджер' || 
                           currentUser?.login === 'admin';
    
    console.log('Is admin or manager?', isAdminOrManager);
    
    if (isAdminOrManager) {
        // Сначала удаляем старую кнопку если есть
        const oldBackupBtn = document.getElementById('backupBtn');
        if (oldBackupBtn) {
            oldBackupBtn.remove();
        }
        
        // Добавляем новую кнопку
        const userInfo = document.getElementById('userInfo');
        const backupBtnHtml = `
            <button id="backupBtn" class="btn btn-sm btn-primary ms-2" onclick="showBackupModal()">
                <i class="bi bi-cloud-arrow-down"></i> Бэкап БД
            </button>
        `;
        
        // Просто добавляем в конец userInfo
        userInfo.insertAdjacentHTML('beforeend', backupBtnHtml);
        
        console.log('Backup button added to userInfo');
    }
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
// Оставляем только ОДИН обработчик DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    checkAPIStatus();
    loadMechanics();
    initializeValidation();
    
    // Добавляем обработчики для модального окна бэкапа
    const backupModal = document.getElementById('backupModal');
    if (backupModal) {
        backupModal.addEventListener('hidden.bs.modal', function() {
            // Сбросить состояние при закрытии модального окна
            selectedBackupOption = '';
            const startBtn = document.getElementById('startBackupBtn');
            if (startBtn) {
                startBtn.disabled = true;
            }
            document.querySelectorAll('.backup-option').forEach(option => {
                option.classList.remove('active');
            });
            const customSection = document.getElementById('customTablesSection');
            if (customSection) {
                customSection.style.display = 'none';
            }
            
            const backupStatus = document.getElementById('backupStatus');
            if (backupStatus) {
                backupStatus.innerHTML = '';
                backupStatus.style.display = 'none';
            }
        });
    }
});