// ==================== ПРОФИЛЬ МЕХАНИКА ====================

async function loadMechanicProfile() {
    const container = document.getElementById('mechanicProfileContent');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<p class="text-muted">Нет данных профиля.</p>';
        return;
    }

    container.innerHTML = `
        <div class="text-center text-muted py-4">
            <div class="spinner-border spinner-border-sm me-2"></div>
            Загрузка...
        </div>`;

    try {
        // Считаем выполненные заказы механика
        const response = await fetch(`${API_URL}/orders`);
        const allOrders = response.ok ? await response.json() : [];

        const myOrders   = allOrders.filter(o => o.mechanic_id === currentUser.user_id);
        const completed  = myOrders.filter(o => o.status === 'Выполнен').length;
        const inProgress = myOrders.filter(o => ['В работе', 'На диагностике', 'Создан'].includes(o.status)).length;

        container.innerHTML = `
            <div class="text-center mb-4">
                <div class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                     style="width:72px;height:72px;font-size:2rem;">
                    <i class="bi bi-person-fill"></i>
                </div>
                <h5 class="mb-0">${currentUser.full_name}</h5>
                <span class="badge bg-secondary mt-1">Автомеханик</span>
            </div>

            <div class="row g-3 mb-4">
                <div class="col-6">
                    <div class="p-3 bg-light rounded text-center">
                        <div class="fs-3 fw-bold text-success">${completed}</div>
                        <div class="small text-muted">Выполнено</div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="p-3 bg-light rounded text-center">
                        <div class="fs-3 fw-bold text-warning">${inProgress}</div>
                        <div class="small text-muted">В работе</div>
                    </div>
                </div>
            </div>

            <ul class="list-group list-group-flush">
                <li class="list-group-item d-flex justify-content-between px-0">
                    <span class="text-muted"><i class="bi bi-person me-2"></i>Логин</span>
                    <span class="fw-semibold">${currentUser.login || '—'}</span>
                </li>
                <li class="list-group-item d-flex justify-content-between px-0">
                    <span class="text-muted"><i class="bi bi-telephone me-2"></i>Телефон</span>
                    <span class="fw-semibold">${currentUser.phone || '—'}</span>
                </li>
            </ul>`;

    } catch (e) {
        container.innerHTML = `
            <div class="text-center mb-3">
                <div class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                     style="width:72px;height:72px;font-size:2rem;">
                    <i class="bi bi-person-fill"></i>
                </div>
                <h5>${currentUser.full_name}</h5>
                <span class="badge bg-secondary">Автомеханик</span>
            </div>`;
    }
}