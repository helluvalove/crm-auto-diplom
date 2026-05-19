// Глобальные настройки и переменные (доступны всем файлам)

const API_URL = '/api';

let token = null;
let currentUser = null;
let ordersData = [];

function setAuthData(newToken, user) {
    token = newToken;
    currentUser = user;
    // Обновляем window-переменные, чтобы все скрипты видели актуальные данные
    window.token = newToken;
    window.currentUser = user;
}

window.API_URL = API_URL;
window.token = token;
window.currentUser = currentUser;
window.ordersData = ordersData;
window.setAuthData = setAuthData;