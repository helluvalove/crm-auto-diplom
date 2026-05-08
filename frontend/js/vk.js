// ==================== ЗАЯВКИ ИЗ ВК ====================
async function loadRequests() {
    const container = document.getElementById('requestsList');
    container.innerHTML = '<div class="text-center text-muted py-4">Загрузка заявок...</div>';

    try {
        const token = localStorage.getItem('access_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${API_URL}/orders?status=Заявка`, { headers });
        if (!response.ok) throw new Error(`Ошибка ${response.status}`);
        const orders = await response.json();

        if (orders.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Нет новых заявок</div>';
            return;
        }

        let html = '<div class="list-group">';
        orders.forEach(order => {
            const date = new Date(order.created_date).toLocaleString('ru-RU');
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between">
                        <strong>ID: ${order.order_id}</strong>
                        <small class="text-muted">${date}</small>
                    </div>
                    <p class="mb-1">${escapeHtml(order.problem_description || '')}</p>
                    <span class="badge bg-primary">${order.status || 'Заявка'}</span>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="alert alert-warning">Ошибка загрузки заявок: ${escapeHtml(e.message)}</div>`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}