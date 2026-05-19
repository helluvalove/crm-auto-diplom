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

            document.getElementById('authPanel').style.display = 'none';

            document.getElementById('userInfo').innerHTML = `
                <span id="statusDot" class="user-status-dot status-online"></span>
                <span class="user-status-text">
                    <i class="bi bi-person-circle"></i>
                    ${data.user.full_name} (${data.user.role})
                </span>
                <button id="logoutBtn" class="user-logout-btn" onclick="logout()">
                    <i class="bi bi-box-arrow-right"></i>
                </button>
            `;

            applyRoleUI(data.user);
            document.getElementById('mainInterface').style.display = 'block';
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
    authPanel.style.cssText = '';
    authPanel.className = 'row mb-4';
    
    const leftCol = authPanel.querySelector('.col-md-6:first-child');
    const rightCol = authPanel.querySelector('.col-md-6:last-child');
    if (leftCol) leftCol.className = 'col-md-6';
    if (rightCol) rightCol.className = 'col-md-6';
    
    document.getElementById('mainInterface').style.display = 'none';
    authPanel.style.display = '';
    
    document.getElementById('userInfo').innerHTML = `
        <span id="statusDot" class="user-status-dot status-offline"></span>
        <span class="user-status-text">Не авторизован</span>
    `;
    
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    
    // Показать футер (был скрыт для механика)
    const footer = document.querySelector('.crm-footer');
    if (footer) footer.style.display = '';
    
    showSuccess('Вы успешно вышли из системы');
}

// ==================== ПРИМЕНЕНИЕ ИНТЕРФЕЙСА ПО РОЛИ ====================
function applyRoleUI(user) {
    console.log('[applyRoleUI] вызов с user:', user);

    if (!user) {
        console.error('[applyRoleUI] ОШИБКА: user is null/undefined!');
        return;
    }

    const desktopTabs = document.getElementById('mainTabs');
    const mobileNav   = document.getElementById('mobileNav');
    const footer      = document.querySelector('.crm-footer');

    // Скрываем все tab-pane
    const allTabIds = [
        'clientsTab', 'ordersTab', 'newOrderTab', 'requestsTab',
        'carsTab', 'archiveTab', 'mechanicsTab', 'statisticsTab',
        'availableOrdersTab', 'myWorksTab', 'mechanicProfileTab'
    ];
    allTabIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Снимаем активность со всех кнопок навигации
    document.querySelectorAll('#mainTabs .nav-link, #mobileNav .nav-link')
        .forEach(btn => btn.classList.remove('active'));

    const isMechanic = user.role === 'mechanic' || 
                       user.role === 'механик' || 
                       user.role?.toLowerCase() === 'mechanic';

    if (isMechanic) {
        console.log('[applyRoleUI] → роль: механик');

        // Жёстко скрываем десктопную панель
        if (desktopTabs) {
            desktopTabs.classList.add('d-none');
            desktopTabs.classList.remove('d-flex');
            desktopTabs.setAttribute('style', 'display: none !important');
        }

        // Показываем мобильную панель, не трогая остальные inline-стили (justify-content, padding)
        if (mobileNav) {
            mobileNav.style.display = 'flex';
            // НЕ используем setAttribute, чтобы не стереть выравнивание
        }

        // Скрываем футер для механика
        if (footer) footer.style.display = 'none';

        // Показываем первую вкладку механика
        const availTab = document.getElementById('availableOrdersTab');
        if (availTab) availTab.style.display = 'block';

        const firstBtn = mobileNav?.querySelector('.nav-link');
        if (firstBtn) firstBtn.classList.add('active');

        if (typeof loadAvailableOrders === 'function') loadAvailableOrders();

    } else {
        console.log('[applyRoleUI] → роль: менеджер');

        // Показываем десктопную панель
        if (desktopTabs) {
            desktopTabs.classList.remove('d-none');
            desktopTabs.classList.add('d-flex');
            desktopTabs.style.display = '';
            desktopTabs.removeAttribute('style');
        }

        // Скрываем мобильную панель
        if (mobileNav) {
            mobileNav.style.display = 'none';
        }

        // Показываем футер для менеджера
        if (footer) footer.style.display = '';

        const clientsTab = document.getElementById('clientsTab');
        if (clientsTab) clientsTab.style.display = 'block';

        const clientsBtn = desktopTabs?.querySelector('.nav-link');
        if (clientsBtn) clientsBtn.classList.add('active');

        loadClients();
        loadOrders('active');
        loadRequests();
        loadMechanicsList();
    }
}