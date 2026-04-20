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
            // Используем функцию из config.js
            setAuthData(data.token, data.user);

            // Переключаем интерфейс
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

            // Загружаем начальные данные
            loadClients();
            loadOrders('active');
            loadRequests();
            loadMechanicsList();

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
    // Сбрасываем авторизацию
    setAuthData(null, null);   // или token = null; currentUser = null;

    // Переключаем интерфейс обратно на форму входа
    document.getElementById('authPanel').style.display = 'block';
    document.getElementById('mainInterface').style.display = 'none';

    // Очищаем информацию о пользователе
    document.getElementById('userInfo').innerHTML = `
        <span id="statusDot" class="text-warning">●</span> Не авторизован
    `;

    showSuccess('Вы успешно вышли из системы');
}