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
            const desc = order.problem_description || '';

            // Желаемая дата и время
            const dtMatch = desc.match(/Желаемая дата и время:\s*(.+)/);
            const preferredDt = dtMatch ? dtMatch[1].trim() : null;

            // Убираем строку с датой
            let cleanDesc = desc.replace(/\n?Желаемая дата и время:.+/, '').trim();

            // Парсим контакты и описание
            const clientMatch = cleanDesc.match(/^Клиент:\s*(.+?),\s*тел\.:\s*(.+)/m);
            const vkMatch = cleanDesc.match(/VK ID (\d+):\s*([\s\S]*)/);

            const name = clientMatch ? clientMatch[1] : 'не указано';
            const phone = clientMatch ? clientMatch[2] : 'не указан';
            const vkId = vkMatch ? vkMatch[1] : '?';
            const problem = vkMatch ? vkMatch[2].trim() || 'Без описания' : cleanDesc;

            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <strong>Заявка №${order.order_id}</strong>
                        <small class="text-muted ms-2">${date}</small>
                    </div>
                    <div class="mb-1">
                        <div class="text-body-secondary mb-1">
                            <span class="me-3"><i class="fas fa-user me-1"></i> ${escapeHtml(name)}</span>
                            <span class="me-3"><i class="fas fa-phone me-1"></i> ${escapeHtml(phone)}</span>
                            <span><i class="fab fa-vk me-1"></i> VK ID: ${escapeHtml(vkId)}</span>
                        </div>
                        <p class="mb-1"><i class="fas fa-file-alt me-1"></i> ${escapeHtml(problem)}</p>
                    </div>
                    ${preferredDt
                        ? `<div class="mt-1"><span class="badge bg-warning text-dark"><i class="fas fa-calendar-alt me-1"></i>${escapeHtml(preferredDt)}</span></div>`
                        : `<div class="mt-1"><span class="badge bg-light text-secondary"><i class="fas fa-calendar-alt me-1"></i>Время не указано</span></div>`
                    }
                    <span class="badge bg-primary mt-1">${order.status || 'Заявка'}</span>
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