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
                <span id="statusDot" class="text-success">●</span> 
                <i class="bi bi-person-circle"></i> 
                ${currentUser.full_name} (${currentUser.role})
                <button class="btn btn-sm btn-outline-light ms-2" onclick="logout()">
                    <i class="bi bi-box-arrow-right"></i> Выйти
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

    document.getElementById('authPanel').style.display = 'block';
    document.getElementById('mainInterface').style.display = 'none';

    document.getElementById('userInfo').innerHTML = `
        <span id="statusDot" class="text-warning">●</span> Не авторизован
    `;

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