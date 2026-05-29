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
                        Отправить фото клиенту
                    </h6>

                    <div class="mb-2">
                        <label class="form-label small text-muted">Фото до 10 штук</label>
                        <input type="file"
                               class="form-control"
                               id="photoFileInput"
                               accept="image/*"
                               multiple
                               onchange="previewPhotos(this)">
                    </div>

                    <!-- Превью -->
                    <div id="photoPreviews" class="d-flex flex-wrap gap-2 mb-2"></div>

                    <!-- Прогресс сжатия/загрузки -->
                    <div id="photoProgress" class="mb-2" style="display:none">
                        <div class="d-flex justify-content-between small text-muted mb-1">
                            <span id="photoProgressLabel">Подготовка...</span>
                            <span id="photoProgressPct">0%</span>
                        </div>
                        <div class="progress" style="height:6px">
                            <div id="photoProgressBar" class="progress-bar progress-bar-striped progress-bar-animated"
                                 style="width:0%"></div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label small text-muted">Комментарий (необязательно)</label>
                        <input type="text"
                               class="form-control"
                               id="photoComment"
                               placeholder="Например: замена тормозных колодок">
                    </div>

                    <button class="btn btn-primary w-100"
                            id="uploadPhotoBtn"
                            onclick="uploadOrderPhotos(${order.order_id})">
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

// ── Превью выбранных фото ────────────────────────────────────────────────
function previewPhotos(input) {
    const container = document.getElementById('photoPreviews');
    if (!container) return;
    container.innerHTML = '';
    if (!input.files.length) return;

    Array.from(input.files).slice(0, 10).forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = e => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:relative;width:64px;height:64px;flex-shrink:0';
            wrapper.innerHTML = `
                <img src="${e.target.result}"
                     style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid #dee2e6">
                <span class="badge bg-primary"
                      style="position:absolute;bottom:2px;right:2px;font-size:9px">${i + 1}</span>`;
            container.appendChild(wrapper);
        };
        reader.readAsDataURL(file);
    });
}

// ── Сжатие одного файла через Canvas (браузер, без сервера) ─────────────
function compressImage(file, maxWidth, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }

                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);

                canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

// ── Обновление прогресс-бара ─────────────────────────────────────────────
function setProgress(label, pct) {
    const bar   = document.getElementById('photoProgressBar');
    const lbl   = document.getElementById('photoProgressLabel');
    const pctEl = document.getElementById('photoProgressPct');
    const wrap  = document.getElementById('photoProgress');
    if (!bar) return;
    wrap.style.display = 'block';
    bar.style.width    = pct + '%';
    if (lbl)   lbl.textContent  = label;
    if (pctEl) pctEl.textContent = pct + '%';
}

// ── Основная функция отправки ─────────────────────────────────────────────
async function uploadOrderPhotos(orderId) {
    const fileInput    = document.getElementById('photoFileInput');
    const commentInput = document.getElementById('photoComment');
    const btn          = document.getElementById('uploadPhotoBtn');
    const resultDiv    = document.getElementById('photoUploadResult');
    const progressWrap = document.getElementById('photoProgress');

    if (!fileInput.files.length) {
        resultDiv.innerHTML = `<div class="alert alert-warning py-2 small">
            <i class="bi bi-exclamation-triangle me-1"></i>Выберите хотя бы одно фото</div>`;
        return;
    }

    const files = Array.from(fileInput.files).slice(0, 10);
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Подготовка...';
    resultDiv.innerHTML = '';
    progressWrap.style.display = 'block';

    // ── 1. Сжатие на фронте (Canvas) ─────────────────────────────────────
    // Сжимаем до 1280px / quality 0.75 — уменьшает типичный файл с 4-6 МБ до ~300-500 кб
    // Это экономит 30-50 секунд на передаче с телефона на сервер
    const compressed = [];
    for (let i = 0; i < files.length; i++) {
        setProgress(`Сжатие ${i + 1} из ${files.length}...`, Math.round((i / files.length) * 40));
        const blob = await compressImage(files[i], 1280, 0.75);
        compressed.push(blob);
    }
    setProgress('Загрузка на сервер...', 40);

    // ── 2. Отправка на сервер ─────────────────────────────────────────────
    const formData = new FormData();
    compressed.forEach((blob, i) => formData.append('photos', blob, `photo_${i + 1}.jpg`));
    formData.append('mechanic_id', currentUser.user_id);
    formData.append('comment', commentInput.value.trim());

    try {
        // XHR вместо fetch — даёт реальный progress upload
        const result = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = e => {
                if (e.lengthComputable) {
                    const pct = 40 + Math.round((e.loaded / e.total) * 55);
                    setProgress(`Загрузка... ${Math.round(e.loaded / 1024)}кб / ${Math.round(e.total / 1024)}кб`, pct);
                }
            };

            xhr.onload = () => {
                try { resolve({ ok: xhr.status === 201, data: JSON.parse(xhr.responseText) }); }
                catch { reject(new Error('Ошибка ответа сервера')); }
            };
            xhr.onerror = () => reject(new Error('Ошибка соединения'));

            xhr.open('POST', `${API_URL}/orders/${orderId}/photos`);
            xhr.send(formData);
        });

        setProgress('Готово', 100);

        if (result.ok) {
            resultDiv.innerHTML = `<div class="alert alert-success py-2 small">
                <i class="bi bi-check-circle me-1"></i>
                ${files.length > 1 ? files.length + ' фото отправляются клиенту в VK' : 'Фото отправляется клиенту в VK'}
                <br><small class="text-muted">Доставка занимает до 1 минуты</small>
            </div>`;
            fileInput.value = '';
            commentInput.value = '';
            document.getElementById('photoPreviews').innerHTML = '';
        } else {
            resultDiv.innerHTML = `<div class="alert alert-danger py-2 small">
                <i class="bi bi-x-circle me-1"></i>${result.data.error || 'Ошибка загрузки'}</div>`;
        }
    } catch (e) {
        resultDiv.innerHTML = `<div class="alert alert-danger py-2 small">
            <i class="bi bi-x-circle me-1"></i>Ошибка соединения</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-cloud-upload me-2"></i>Отправить фото клиенту';
        setTimeout(() => { if (progressWrap) progressWrap.style.display = 'none'; }, 3000);
    }
}