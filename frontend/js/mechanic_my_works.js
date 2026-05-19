// ==================== МОИ РАБОТЫ (механик) ====================

async function loadMyWork() {
    const container = document.getElementById('myWorkContent');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<p class="text-muted">Нет данных пользователя.</p>';
        return;
    }

    container.innerHTML = `
        <div class="text-center text-muted py-4">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Загрузка...
        </div>`;

    try {
        // Ищем заказы где mechanic_id == currentUser.user_id и статус активный
        const response = await fetch(`${API_URL}/orders`);
        if (!response.ok) throw new Error('Ошибка загрузки');

        const allOrders = await response.json();
        const activeStatuses = ['В работе', 'На диагностике', 'Создан'];
        const myOrder = allOrders.find(o =>
            o.mechanic_id === currentUser.user_id &&
            activeStatuses.includes(o.status)
        );

        if (!myOrder) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-tools display-6"></i>
                    <p class="mt-2 mb-0">У вас нет активного заказа</p>
                    <small>Возьмите заказ из раздела «Заказы»</small>
                </div>`;
            return;
        }

        container.innerHTML = renderMyWorkCard(myOrder);

    } catch (e) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>Ошибка загрузки
            </div>`;
    }
}

function renderMyWorkCard(order) {
    const statusColors = {
        'Создан': 'secondary',
        'На диагностике': 'info',
        'В работе': 'warning',
        'Готов к выдаче': 'success',
    };
    const badgeColor = statusColors[order.status] || 'secondary';

    return `
        <div class="card border-0 shadow-sm mb-3">
            <div class="card-body">

                <!-- Заголовок заказа -->
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0">
                        <i class="bi bi-file-earmark-text text-primary me-2"></i>
                        Заказ-наряд №${order.order_id}
                    </h5>
                    <span class="badge bg-${badgeColor} fs-6">${order.status}</span>
                </div>

                <!-- Информация -->
                <div class="row g-3 mb-3">
                    <div class="col-12 col-sm-6">
                        <div class="p-2 bg-light rounded">
                            <div class="text-muted small mb-1"><i class="bi bi-person me-1"></i>Клиент</div>
                            <div class="fw-semibold">${order.client_name || '—'}</div>
                            <div class="text-muted small">${order.client_phone || ''}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-6">
                        <div class="p-2 bg-light rounded">
                            <div class="text-muted small mb-1"><i class="bi bi-car-front me-1"></i>Автомобиль</div>
                            <div class="fw-semibold">${order.car_model || '—'}</div>
                            <div class="text-muted small">${order.car_gos_number || ''} ${order.car_year ? '· ' + order.car_year : ''}</div>
                        </div>
                    </div>
                </div>

                <!-- Описание проблемы -->
                ${order.problem_description ? `
                <div class="mb-3">
                    <div class="text-muted small mb-1"><i class="bi bi-chat-left-text me-1"></i>Описание проблемы</div>
                    <div class="bg-light rounded p-2 small">${order.problem_description}</div>
                </div>` : ''}

                <!-- Смена статуса -->
                <div class="mb-3">
                    <label class="form-label small text-muted">Изменить статус</label>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-sm btn-outline-info"
                                onclick="updateMyOrderStatus(${order.order_id}, 'На диагностике')"
                                ${order.status === 'На диагностике' ? 'disabled' : ''}>
                            🔍 На диагностике
                        </button>
                        <button class="btn btn-sm btn-outline-warning"
                                onclick="updateMyOrderStatus(${order.order_id}, 'В работе')"
                                ${order.status === 'В работе' ? 'disabled' : ''}>
                            🔧 В работе
                        </button>
                        <button class="btn btn-sm btn-outline-success"
                                onclick="updateMyOrderStatus(${order.order_id}, 'Готов к выдаче')"
                                ${order.status === 'Готов к выдаче' ? 'disabled' : ''}>
                            ✅ Готов к выдаче
                        </button>
                    </div>
                </div>

                <hr>

                <!-- Загрузка фото -->
                <div>
                    <h6 class="mb-3">
                        <i class="bi bi-camera text-primary me-2"></i>
                        Добавить фото
                    </h6>

                    <div class="mb-2">
                        <label class="form-label small text-muted">Фото (замена запчастей, результат работы)</label>
                        <input type="file"
                               class="form-control"
                               id="photoFileInput"
                               accept="image/*"
                               capture="environment">
                    </div>

                    <div class="mb-3">
                        <label class="form-label small text-muted">Комментарий к фото</label>
                        <input type="text"
                               class="form-control"
                               id="photoComment"
                               placeholder="Например: замена тормозных колодок">
                    </div>

                    <button class="btn btn-primary w-100"
                            id="uploadPhotoBtn"
                            onclick="uploadOrderPhoto(${order.order_id})">
                        <i class="bi bi-cloud-upload me-2"></i>Отправить фото клиенту
                    </button>

                    <div id="photoUploadResult" class="mt-2"></div>
                </div>
            </div>
        </div>`;
}

async function updateMyOrderStatus(orderId, newStatus) {
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();
        if (response.ok) {
            showSuccess(`Статус изменён на «${newStatus}»`);
            loadMyWork();
        } else {
            showError(data.error || 'Не удалось изменить статус');
        }
    } catch (e) {
        showError('Ошибка соединения');
    }
}

async function uploadOrderPhoto(orderId) {
    const fileInput   = document.getElementById('photoFileInput');
    const commentInput = document.getElementById('photoComment');
    const btn         = document.getElementById('uploadPhotoBtn');
    const resultDiv   = document.getElementById('photoUploadResult');

    if (!fileInput.files.length) {
        resultDiv.innerHTML = `<div class="alert alert-warning py-2 small">
            <i class="bi bi-exclamation-triangle me-1"></i>Выберите фото
        </div>`;
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Загрузка...';
    resultDiv.innerHTML = '';

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    formData.append('mechanic_id', currentUser.user_id);
    formData.append('comment', commentInput.value.trim());

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/photos`, {
            method: 'POST',
            body: formData   // Content-Type НЕ ставим — браузер сам добавит boundary
        });

        const data = await response.json();

        if (response.ok) {
            resultDiv.innerHTML = `<div class="alert alert-success py-2 small">
                <i class="bi bi-check-circle me-1"></i>Фото отправлено клиенту в VK
            </div>`;
            fileInput.value = '';
            commentInput.value = '';
        } else {
            resultDiv.innerHTML = `<div class="alert alert-danger py-2 small">
                <i class="bi bi-x-circle me-1"></i>${data.error || 'Ошибка загрузки'}
            </div>`;
        }
    } catch (e) {
        resultDiv.innerHTML = `<div class="alert alert-danger py-2 small">
            <i class="bi bi-x-circle me-1"></i>Ошибка соединения
        </div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Отправить фото клиенту';
    }
}