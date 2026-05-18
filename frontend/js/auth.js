// ==================== АУТЕНТИФИКАЦИЯ ====================

// Вход в систему
async function login() {
    const loginInput = document.getElementById('loginInput')?.value.trim();
    const passwordInput = document.getElementById('passwordInput')?.value;

    if (!loginInput || !passwordInput) {
        showError('Введите логин и пароль');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                login: loginInput, 
                password: passwordInput 
            })
        });

        const data = await response.json();

        if (response.ok && data.token) {
            setAuthData(data.token, data.user);

            // Скрываем панель входа, показываем основной интерфейс
            document.getElementById('authPanel').style.display = 'none';
            document.getElementById('mainInterface').style.display = 'block';

            // Обновляем информацию о пользователе
            document.getElementById('userInfo').innerHTML = `
                <span id="statusDot" class="user-status-dot status-online"></span>
                <span class="user-status-text">
                    <i class="bi bi-person-circle"></i>
                    ${currentUser.full_name} (${currentUser.role})
                </span>
                <button id="logoutBtn" class="user-logout-btn" onclick="logout()">
                    <i class="bi bi-box-arrow-right"></i>
                </button>
            `;

            // Настраиваем интерфейс и загружаем стартовые данные в зависимости от роли
            applyRoleUI(currentUser);

            showSuccess('Успешный вход в систему!');
        } else {
            showError(data.error || 'Ошибка аутентификации');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Ошибка подключения к серверу: ' + error.message);
    }
}

// Выход из системы
function logout() {
    setAuthData(null, null);

    const authPanel = document.getElementById('authPanel');
    // Сбрасываем все inline-стили и возвращаем исходные классы
    authPanel.style.cssText = '';
    authPanel.className = 'row mb-4';
    
    // Восстанавливаем классы у колонок
    const leftCol = authPanel.querySelector('.col-md-6:first-child');
    const rightCol = authPanel.querySelector('.col-md-6:last-child');
    if (leftCol) leftCol.className = 'col-md-6';
    if (rightCol) rightCol.className = 'col-md-6';
    
    // Скрываем основной интерфейс и показываем панель входа
    document.getElementById('mainInterface').style.display = 'none';
    authPanel.style.display = '';  // сброс инлайн-стиля, Bootstrap .row восстановит display:flex
    
    // Обновляем информацию о пользователе в navbar
    document.getElementById('userInfo').innerHTML = `
        <span id="statusDot" class="user-status-dot status-offline"></span>
        <span class="user-status-text">Не авторизован</span>
    `;
    
    // Удаляем возможные остатки модальных окон (backdrop)
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    
    showSuccess('Вы успешно вышли из системы');
}

// ==================== ПРИМЕНЕНИЕ ИНТЕРФЕЙСА ПО РОЛИ ====================
function applyRoleUI(user) {
    const desktopTabs = document.getElementById('mainTabs');
    const mobileNav = document.getElementById('mobileNav');

    // Явно перечисляем все вкладки, чтобы гарантированно скрыть
    const allTabIds = [
        'clientsTab', 'ordersTab', 'newOrderTab', 'requestsTab',
        'carsTab', 'archiveTab', 'mechanicsTab', 'statisticsTab',
        'availableOrdersTab', 'myWorksTab', 'mechanicProfileTab'
    ];

    // Скрываем все вкладки
    allTabIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Снимаем активность со всех кнопок
    document.querySelectorAll('#mainTabs .nav-link, #mobileNav .nav-link')
        .forEach(btn => btn.classList.remove('active'));

    if (user.role === 'mechanic') {
        // Скрываем десктопную панель через классы Bootstrap
        if (desktopTabs) {
            desktopTabs.classList.add('d-none');
            desktopTabs.classList.remove('d-flex');
        }
        // Показываем мобильную панель (инлайн‑стиль работает)
        if (mobileNav) mobileNav.style.display = 'flex';

        // Показываем первую вкладку механика
        document.getElementById('availableOrdersTab').style.display = 'block';
        // Активируем кнопку "Заказы"
        const firstBtn = mobileNav?.querySelector('.nav-link');
        if (firstBtn) firstBtn.classList.add('active');
        // Загружаем доступные заказы
        if (typeof loadAvailableOrders === 'function') loadAvailableOrders();
    } else {
        // Менеджер: показываем десктопную панель
        if (desktopTabs) {
            desktopTabs.classList.remove('d-none');
            desktopTabs.classList.add('d-flex');
        }
        // Скрываем мобильную панель
        if (mobileNav) mobileNav.style.display = 'none';

        // Показываем первую вкладку "Клиенты"
        document.getElementById('clientsTab').style.display = 'block';
        const clientsBtn = desktopTabs?.querySelector('.nav-link');
        if (clientsBtn) clientsBtn.classList.add('active');

        // Загружаем данные менеджера
        loadClients();
        loadOrders('active');
        loadRequests();
        loadMechanicsList();
    }
}