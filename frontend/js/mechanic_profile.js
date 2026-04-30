function loadMechanicProfile() {
    const container = document.getElementById('mechanicProfileContent');
    if (!container) return;
    if (currentUser) {
        container.innerHTML = `
            <h5>${currentUser.full_name}</h5>
            <p>Специализация: ${currentUser.specialization || 'не указана'}</p>
            <p>Выполнено заказов: <span class="badge bg-primary">0</span></p>
        `;
    } else {
        container.innerHTML = '<p>Нет данных профиля.</p>';
    }
}