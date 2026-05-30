// ==================== ИСТОРИЯ ЗАКАЗОВ (механик) ====================

async function loadMechanicHistory() {
    const container = document.getElementById('mechanicHistoryContent');
    if (!container || !currentUser) return;

    // Фильтр по одной дате завершения
    const dateFilter = document.getElementById('historyDateFilter')?.value;

    container.innerHTML = `<div class="text-center py-4">
        <div class="spinner-border spinner-border-sm text-primary me-2"></div>Загрузка...
    </div>`;

    try {
        const response = await fetch(`${API_URL}/orders`);
        if (!response.ok) throw new Error();

        const allOrders = await response.json();

        let myDone = allOrders.filter(o =>
            o.mechanic_id === currentUser.user_id &&
            ['Выполнен', 'Отменен'].includes(o.status)
        );

        // Фильтр по конкретной дате завершения
        if (dateFilter) {
            myDone = myDone.filter(o => {
                if (!o.completed_date) return false;
                // Сравниваем только дату (без времени)
                return o.completed_date.slice(0, 10) === dateFilter;
            });
        }

        // Сортировка — новые сверху
        myDone.sort((a, b) => new Date(b.completed_date || b.created_date) - new Date(a.completed_date || a.created_date));

        if (!myDone.length) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-inbox display-6 d-block mb-2"></i>
                    ${dateFilter ? `За ${new Date(dateFilter).toLocaleDateString('ru-RU')} заказов нет` : 'Выполненных заказов пока нет'}
                </div>`;
            return;
        }

        container.innerHTML = myDone.map(order => renderHistoryCard(order)).join('');

    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger py-2 small">
            <i class="bi bi-exclamation-triangle me-1"></i>Ошибка загрузки
        </div>`;
    }
}

function renderHistoryCard(order) {
    const isDone = order.status === 'Выполнен';
    const dateStr = order.completed_date
        ? new Date(order.completed_date).toLocaleDateString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric'})
        : order.created_date
        ? new Date(order.created_date).toLocaleDateString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric'})
        : '—';

    const price = order.total_price
        ? Number(order.total_price).toLocaleString('ru-RU') + ' ₽'
        : null;

    return `
        <div class="border-bottom py-2 px-1">
            <div class="d-flex justify-content-between align-items-start">
                <div style="min-width:0;flex:1;">
                    <div class="d-flex align-items-center gap-2 mb-1">
                        <span class="fw-semibold small">№${order.order_id}</span>
                        <span class="badge ${isDone?'bg-success':'bg-secondary'}" style="font-size:10px;">${order.status}</span>
                        ${price ? `<span class="text-success small fw-semibold">${price}</span>` : ''}
                    </div>
                    <div class="text-muted small text-truncate">
                        <i class="bi bi-car-front me-1"></i>${order.car_model || '—'} ${order.car_gos_number ? '('+order.car_gos_number+')' : ''}
                    </div>
                    <div class="text-muted small text-truncate">
                        <i class="bi bi-person me-1"></i>${order.client_name || '—'}
                    </div>
                    ${order.work_description ? `
                    <div class="text-muted mt-1" style="font-size:11px;">${order.work_description.slice(0,80)}${order.work_description.length>80?'...':''}</div>` : ''}
                </div>
                <div class="text-end flex-shrink-0 ms-2">
                    <div class="text-muted" style="font-size:11px;">${dateStr}</div>
                    ${order.pdf_url ? `
                    <a href="${order.pdf_url}" target="_blank"
                       class="btn btn-outline-primary btn-sm mt-1 px-2 py-0" style="font-size:11px;">
                        <i class="bi bi-file-pdf me-1"></i>PDF
                    </a>` : ''}
                </div>
            </div>
        </div>`;
}