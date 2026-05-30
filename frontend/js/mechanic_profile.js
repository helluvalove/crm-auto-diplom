// ==================== ПРОФИЛЬ МЕХАНИКА ====================

async function loadMechanicProfile() {
    const container = document.getElementById('mechanicProfileContent');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<p class="text-muted">Нет данных профиля.</p>';
        return;
    }

    container.innerHTML = `<div class="text-center py-3">
        <div class="spinner-border spinner-border-sm text-primary"></div>
    </div>`;

    try {
        const response = await fetch(`${API_URL}/orders`);
        const allOrders = response.ok ? await response.json() : [];

        const myOrders    = allOrders.filter(o => o.mechanic_id === currentUser.user_id);
        const completed   = myOrders.filter(o => o.status === 'Выполнен');
        const inProgress  = myOrders.filter(o => ['В работе','На диагностике','Создан'].includes(o.status));
        const thisMonth   = completed.filter(o => {
            const d = new Date(o.completed_date);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const initials = (currentUser.full_name || 'М')
            .split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

        container.innerHTML = `
            <!-- Аватар и имя -->
            <div class="text-center mb-4">
                <div class="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center mb-3 fw-bold"
                     style="width:72px;height:72px;font-size:1.6rem;">${initials}</div>
                <h5 class="mb-0 fw-bold">${currentUser.full_name}</h5>
                <span class="badge bg-secondary mt-1">Автомеханик</span>
            </div>

            <!-- Статистика -->
            <div class="row g-2 mb-4">
                <div class="col-4">
                    <div class="p-2 bg-success bg-opacity-10 rounded text-center">
                        <div class="fs-3 fw-bold text-success">${completed.length}</div>
                        <div style="font-size:11px;" class="text-muted">Выполнено</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="p-2 bg-warning bg-opacity-10 rounded text-center">
                        <div class="fs-3 fw-bold text-warning">${inProgress.length}</div>
                        <div style="font-size:11px;" class="text-muted">В работе</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="p-2 bg-primary bg-opacity-10 rounded text-center">
                        <div class="fs-3 fw-bold text-primary">${thisMonth.length}</div>
                        <div style="font-size:11px;" class="text-muted">В этом мес.</div>
                    </div>
                </div>
            </div>

            <!-- Данные -->
            <ul class="list-group list-group-flush mb-4">
                <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                    <span class="text-muted small"><i class="bi bi-person me-2"></i>Логин</span>
                    <span class="fw-semibold">${currentUser.login || '—'}</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                    <span class="text-muted small"><i class="bi bi-telephone me-2"></i>Телефон</span>
                    <span class="fw-semibold">${currentUser.phone || '—'}</span>
                </li>
                <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                    <span class="text-muted small"><i class="bi bi-shield-check me-2"></i>Роль</span>
                    <span class="badge bg-primary">Автомеханик</span>
                </li>
            </ul>

            <!-- Последние выполненные -->
            ${completed.length ? `
            <div>
                <h6 class="text-muted mb-2 small fw-semibold text-uppercase">Последние выполненные</h6>
                ${completed.slice(-3).reverse().map(o => `
                <div class="d-flex justify-content-between align-items-center py-2 border-bottom small">
                    <div>
                        <span class="fw-semibold">Заказ №${o.order_id}</span>
                        <span class="text-muted ms-2">${o.car_model || ''}</span>
                    </div>
                    <span class="text-muted" style="font-size:11px;">
                        ${o.completed_date ? new Date(o.completed_date).toLocaleDateString('ru-RU') : ''}
                    </span>
                </div>`).join('')}
            </div>` : ''}

            <button class="btn btn-outline-danger btn-sm w-100 mt-4" onclick="logout()">
                <i class="bi bi-box-arrow-right me-2"></i>Выйти из системы
            </button>`;

    } catch (e) {
        container.innerHTML = `
            <div class="text-center mb-3">
                <div class="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center mb-3"
                     style="width:72px;height:72px;font-size:2rem;">
                    <i class="bi bi-person-fill"></i>
                </div>
                <h5>${currentUser.full_name}</h5>
                <span class="badge bg-secondary">Автомеханик</span>
            </div>`;
    }
}