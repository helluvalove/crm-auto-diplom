// ==================== ДОСТУПНЫЕ ЗАКАЗЫ (механик) ====================

async function loadAvailableOrders() {
    const container = document.getElementById('availableOrdersList');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center text-muted py-4">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Загрузка заказов...
        </div>`;

    try {
        const response = await fetch(`${API_URL}/orders?status=Создан`);
        if (!response.ok) throw new Error('Ошибка загрузки');

        const orders = await response.json();

        if (!orders.length) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-clipboard-check display-6"></i>
                    <p class="mt-2 mb-0">Нет доступных заказов</p>
                </div>`;
            return;
        }

        container.innerHTML = orders.map(order => renderAvailableOrderCard(order)).join('');

    } catch (e) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>Ошибка загрузки заказов
            </div>`;
    }
}

function renderAvailableOrderCard(order) {
    const created = order.created_date
        ? new Date(order.created_date).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
        : '—';

    const appointment = order.appointment_datetime
        ? new Date(order.appointment_datetime).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
        : 'не указана';

    return `
        <div class="card mb-3 border-start border-primary border-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="card-title mb-0">
                        <i class="bi bi-file-text text-primary me-1"></i>
                        Заказ-наряд №${order.order_id}
                    </h6>
                    <span class="badge bg-primary">${order.status}</span>
                </div>

                <div class="row g-2 small text-muted mb-2">
                    <div class="col-6">
                        <i class="bi bi-person me-1"></i>
                        ${order.client_name || '—'}
                    </div>
                    <div class="col-6">
                        <i class="bi bi-car-front me-1"></i>
                        ${order.car_model || '—'} ${order.car_gos_number ? '(' + order.car_gos_number + ')' : ''}
                    </div>
                    <div class="col-6">
                        <i class="bi bi-calendar me-1"></i>
                        Создан: ${created}
                    </div>
                    <div class="col-6">
                        <i class="bi bi-clock me-1"></i>
                        Запись: ${appointment}
                    </div>
                </div>

                ${order.problem_description ? `
                <div class="bg-light rounded p-2 small mb-3">
                    <i class="bi bi-chat-left-text me-1 text-muted"></i>
                    ${order.problem_description}
                </div>` : ''}

                <button class="btn btn-success btn-sm w-100"
                        onclick="takeMechanicOrder(${order.order_id})">
                    <i class="bi bi-play-fill me-1"></i>Взять в работу
                </button>
            </div>
        </div>`;
}

async function takeMechanicOrder(orderId) {
    if (!currentUser) return;

    const btn = event.target.closest('button');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Обработка...';

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'В работе' })
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess(`Заказ-наряд №${orderId} взят в работу`);
            // Обновляем обе вкладки
            loadAvailableOrders();
            loadMyWork();
            // Переключаемся на "Мои работы"
            showTab('myWorks', { target: document.querySelector('[onclick*="myWorks"]') });
        } else {
            showError(data.error || 'Не удалось взять заказ');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-play-fill me-1"></i>Взять в работу';
        }
    } catch (e) {
        showError('Ошибка соединения');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-play-fill me-1"></i>Взять в работу';
    }
}