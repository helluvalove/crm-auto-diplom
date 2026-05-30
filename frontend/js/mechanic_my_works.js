// ==================== МОИ РАБОТЫ (механик) ====================

const PHOTO_MAX = 10;
const PHOTO_ACCEPT = ['image/jpeg','image/jpg','image/png','image/webp','image/heic'];

let currentSelectedFiles = [];

async function loadMyWork() {
    const container = document.getElementById('myWorkContent');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<p class="text-muted text-center">Нет данных пользователя.</p>';
        return;
    }

    // Показываем индикатор загрузки
    container.innerHTML = `
        <div class="text-center text-muted py-4">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Загрузка активного заказа...
        </div>`;

    try {
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
                    <i class="bi bi-tools display-6 d-block mb-2"></i>
                    <p class="mb-1">Нет активного заказа</p>
                    <small>Перейдите во вкладку «Заказы»</small>
                </div>`;
            return;
        }

        container.innerHTML = renderMyWorkCard(myOrder);
        // Сбрасываем массив фото и превью
        currentSelectedFiles = [];
        updatePhotoPreview();

    } catch (e) {
        console.error('loadMyWork error:', e);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>Ошибка загрузки данных
            </div>`;
    }
}

// Функция для ручного обновления (вызывается из кнопки в card-header)
async function refreshMyWork() {
    showInfo('Обновление данных...');
    await loadMyWork();
}

function renderMyWorkCard(order) {
    const statusColors = {
        'Создан': 'secondary',
        'На диагностике': 'info',
        'В работе': 'warning',
        'Готов к выдаче': 'success',
    };
    const badgeColor = statusColors[order.status] || 'secondary';

    const appointment = order.appointment_datetime
        ? new Date(order.appointment_datetime).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
        : null;

    return `
        <div class="card border-0 mb-3">
            <div class="card-body px-3 pt-3 pb-2">

                <!-- Заголовок карточки -->
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0 fw-bold">
                        <i class="bi bi-file-earmark-text text-primary me-2"></i>
                        №${order.order_id}
                    </h5>
                    <span class="badge bg-${badgeColor} px-3 py-2">${order.status}</span>
                </div>

                <!-- Клиент и авто -->
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <div class="p-2 bg-light rounded h-100">
                            <div class="text-muted" style="font-size:11px;margin-bottom:2px;">
                                <i class="bi bi-person me-1"></i>КЛИЕНТ
                            </div>
                            <div class="fw-semibold small">${order.client_name || '—'}</div>
                            <div class="text-muted" style="font-size:11px;">${order.client_phone || ''}</div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="p-2 bg-light rounded h-100">
                            <div class="text-muted" style="font-size:11px;margin-bottom:2px;">
                                <i class="bi bi-car-front me-1"></i>АВТОМОБИЛЬ
                            </div>
                            <div class="fw-semibold small">${order.car_model || '—'}</div>
                            <div class="text-muted" style="font-size:11px;">${order.car_gos_number || ''}${order.car_year ? ' · '+order.car_year : ''}</div>
                        </div>
                    </div>
                </div>

                ${appointment ? `
                <div class="d-flex align-items-center gap-2 mb-3 p-2 bg-success bg-opacity-10 rounded">
                    <i class="bi bi-calendar-check text-success"></i>
                    <span class="small">Запись: <strong>${appointment}</strong></span>
                </div>` : ''}

                ${order.problem_description ? `
                <div class="mb-3">
                    <div class="text-muted small mb-1"><i class="bi bi-chat-left-text me-1"></i>Проблема</div>
                    <div class="bg-light rounded p-2 small">${order.problem_description}</div>
                </div>` : ''}

                <!-- Смена статуса -->
                <div class="mb-3">
                    <div class="text-muted small mb-2">Изменить статус</div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-sm btn-outline-info ${order.status==='На диагностике'?'active':''}"
                                ${order.status==='На диагностике'?'disabled':''}
                                onclick="updateMyOrderStatus(${order.order_id}, 'На диагностике')">
                            🔍 Диагностика
                        </button>
                        <button class="btn btn-sm btn-outline-warning ${order.status==='В работе'?'active':''}"
                                ${order.status==='В работе'?'disabled':''}
                                onclick="updateMyOrderStatus(${order.order_id}, 'В работе')">
                            🔧 В работе
                        </button>
                        <button class="btn btn-sm btn-outline-success ${order.status==='Готов к выдаче'?'active':''}"
                                ${order.status==='Готов к выдаче'?'disabled':''}
                                onclick="updateMyOrderStatus(${order.order_id}, 'Готов к выдаче')">
                            ✅ Готов
                        </button>
                    </div>
                </div>

                <hr class="my-3">

                <!-- Загрузка фото -->
                <div>
                    <h6 class="mb-1 fw-bold">
                        <i class="bi bi-camera text-primary me-2"></i>Отправить фото клиенту
                    </h6>
                    <p class="text-muted small mb-3">До ${PHOTO_MAX} фотографий · Видео не принимается</p>

                    <!-- Зона выбора фото -->
                    <label for="photoFileInput" class="d-block border border-2 border-dashed rounded-3 text-center p-3 mb-2"
                           style="cursor:pointer;border-color:#0d6efd!important;background:#f8f9ff;"
                           id="photoDropLabel">
                        <i class="bi bi-cloud-arrow-up text-primary" style="font-size:1.8rem;"></i>
                        <div class="small text-primary fw-semibold mt-1">Нажмите чтобы выбрать фото</div>
                        <div class="text-muted" style="font-size:11px;">JPEG, PNG, WEBP · Макс. ${PHOTO_MAX} шт.</div>
                    </label>
                    <input type="file"
                           class="d-none"
                           id="photoFileInput"
                           accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                           multiple
                           onchange="onPhotoSelected(this)">

                    <!-- Счётчик и превью -->
                    <div id="photoCounter" class="small text-muted mb-2" style="display:none;">
                        Выбрано: <span id="photoCountNum">0</span> из ${PHOTO_MAX}
                    </div>
                    <div id="photoPreviews" class="d-flex flex-wrap gap-2 mb-2"></div>
                    <div id="photoWarning" class="mb-2"></div>
                    <div class="text-end mb-2">
                        <button type="button" class="btn btn-sm btn-outline-danger" id="clearAllPhotosBtn" style="display:none;" onclick="clearAllPhotos()">
                            <i class="bi bi-trash3 me-1"></i>Очистить все
                        </button>
                    </div>

                    <!-- Прогресс -->
                    <div id="photoProgress" class="mb-2" style="display:none;">
                        <div class="d-flex justify-content-between small mb-1">
                            <span id="photoProgressLabel" class="text-muted">Подготовка...</span>
                            <span id="photoProgressPct" class="fw-semibold">0%</span>
                        </div>
                        <div class="progress" style="height:5px;">
                            <div id="photoProgressBar" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" style="width:0%"></div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <input type="text"
                               class="form-control form-control-sm"
                               id="photoComment"
                               placeholder="Комментарий (необязательно)">
                    </div>

                    <button class="btn btn-primary w-100"
                            id="uploadPhotoBtn"
                            onclick="uploadOrderPhotos(${order.order_id})">
                        <i class="bi bi-send me-2"></i>Отправить клиенту в VK
                    </button>

                    <div id="photoUploadResult" class="mt-2"></div>
                </div>
            </div>
        </div>`;
}

// ── Вспомогательные функции для фото (без изменений) ────────────────────────

function onPhotoSelected(input) {
    const warning   = document.getElementById('photoWarning');
    const label     = document.getElementById('photoDropLabel');

    warning.innerHTML = '';

    if (!input.files.length) {
        currentSelectedFiles = [];
        updatePhotoPreview();
        if (label) label.style.borderColor = '#0d6efd!important';
        return;
    }

    const allFiles = Array.from(input.files);
    const videos = allFiles.filter(f => f.type.startsWith('video/'));
    const nonImages = allFiles.filter(f => !f.type.startsWith('image/'));
    if (videos.length || nonImages.length) {
        warning.innerHTML = `<div class="alert alert-danger py-2 small">
            <i class="bi bi-x-circle me-1"></i>Видео и другие файлы не принимаются — только фотографии (JPEG, PNG, WEBP)
        </div>`;
        input.value = '';
        currentSelectedFiles = [];
        updatePhotoPreview();
        if (label) label.style.borderColor = '#0d6efd!important';
        return;
    }

    if (allFiles.length > PHOTO_MAX) {
        warning.innerHTML = `<div class="alert alert-warning py-2 small">
            <i class="bi bi-exclamation-triangle me-1"></i>
            Выбрано ${allFiles.length} фото — максимум ${PHOTO_MAX}. Будут отправлены первые ${PHOTO_MAX}.
        </div>`;
    }

    currentSelectedFiles = allFiles.slice(0, PHOTO_MAX);
    updatePhotoPreview();
    input.value = '';
    if (label) label.style.borderColor = '#198754!important';
}

function updatePhotoPreview() {
    const previewsDiv = document.getElementById('photoPreviews');
    const counterDiv = document.getElementById('photoCounter');
    const countNumSpan = document.getElementById('photoCountNum');
    const warningDiv = document.getElementById('photoWarning');
    const clearAllBtn = document.getElementById('clearAllPhotosBtn');
    const label = document.getElementById('photoDropLabel');

    if (!previewsDiv) return;
    previewsDiv.innerHTML = '';
    const count = currentSelectedFiles.length;

    if (count === 0) {
        counterDiv.style.display = 'none';
        if (clearAllBtn) clearAllBtn.style.display = 'none';
        if (label) label.style.borderColor = '#0d6efd!important';
        if (warningDiv) warningDiv.innerHTML = '';
        return;
    }

    counterDiv.style.display = 'block';
    countNumSpan.textContent = count;
    if (clearAllBtn) clearAllBtn.style.display = 'inline-block';

    currentSelectedFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = e => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'position:relative;width:70px;height:70px;flex-shrink:0;';
            wrap.innerHTML = `
                <img src="${e.target.result}"
                    style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:2px solid #dee2e6;">
                <button type="button"
                        class="btn btn-sm btn-danger rounded-circle"
                        style="position:absolute;top:-6px;right:-6px;width:24px;height:24px;padding:0;margin:0;border:none;display:inline-flex;align-items:center;justify-content:center;"
                        onclick="removePhoto(${idx})">
                    <i class="bi bi-x" style="font-size:16px;line-height:1;"></i>
                </button>
                <span style="position:absolute;bottom:2px;right:4px;background:rgba(0,0,0,0.6);color:#fff;font-size:9px;padding:1px 4px;border-radius:10px;">${idx+1}</span>`;
            previewsDiv.appendChild(wrap);
        };
        reader.readAsDataURL(file);
    });
}

function removePhoto(index) {
    if (index >= 0 && index < currentSelectedFiles.length) {
        currentSelectedFiles.splice(index, 1);
        updatePhotoPreview();
        const fileInput = document.getElementById('photoFileInput');
        if (fileInput) fileInput.value = '';
    }
}

function clearAllPhotos() {
    currentSelectedFiles = [];
    updatePhotoPreview();
    const fileInput = document.getElementById('photoFileInput');
    if (fileInput) fileInput.value = '';
    const warningDiv = document.getElementById('photoWarning');
    if (warningDiv) warningDiv.innerHTML = '';
}

function compressImage(file, maxWidth, quality) {
    return new Promise(resolve => {
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

function setProgress(label, pct) {
    const el = {
        wrap: document.getElementById('photoProgress'),
        bar:  document.getElementById('photoProgressBar'),
        lbl:  document.getElementById('photoProgressLabel'),
        pct:  document.getElementById('photoProgressPct'),
    };
    if (!el.wrap) return;
    el.wrap.style.display = 'block';
    el.bar.style.width  = pct + '%';
    el.lbl.textContent  = label;
    el.pct.textContent  = pct + '%';
}

async function uploadOrderPhotos(orderId) {
    const commentInput = document.getElementById('photoComment');
    const btn          = document.getElementById('uploadPhotoBtn');
    const resultDiv    = document.getElementById('photoUploadResult');
    const warningDiv   = document.getElementById('photoWarning');

    resultDiv.innerHTML = '';

    if (!currentSelectedFiles.length) {
        warningDiv.innerHTML = `<div class="alert alert-warning py-2 small">
            <i class="bi bi-exclamation-triangle me-1"></i>Сначала выберите фотографии
        </div>`;
        const label = document.getElementById('photoDropLabel');
        if (label) label.classList.add('border-warning');
        return;
    }

    const hasVideo = currentSelectedFiles.some(f => f.type.startsWith('video/') || !f.type.startsWith('image/'));
    if (hasVideo) {
        warningDiv.innerHTML = `<div class="alert alert-danger py-2 small">
            <i class="bi bi-x-circle me-1"></i>Видео не принимаются — только фотографии
        </div>`;
        return;
    }

    const files = currentSelectedFiles.slice(0, PHOTO_MAX);
    btn.disabled = true;
    warningDiv.innerHTML = '';
    document.getElementById('photoProgress').style.display = 'block';

    const compressed = [];
    for (let i = 0; i < files.length; i++) {
        setProgress(`Сжатие ${i+1} из ${files.length}...`, Math.round((i / files.length) * 40));
        const blob = await compressImage(files[i], 1280, 0.75);
        compressed.push(blob);
    }
    setProgress('Загрузка на сервер...', 40);

    const formData = new FormData();
    compressed.forEach((blob, i) => formData.append('photos', blob, `photo_${i+1}.jpg`));
    formData.append('mechanic_id', currentUser.user_id);
    formData.append('comment', commentInput.value.trim());

    try {
        const result = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = e => {
                if (e.lengthComputable) {
                    const pct = 40 + Math.round((e.loaded / e.total) * 55);
                    const kb = Math.round(e.loaded / 1024);
                    const total = Math.round(e.total / 1024);
                    setProgress(`Загрузка... ${kb} / ${total} кб`, pct);
                }
            };
            xhr.onload = () => {
                try { resolve({ status: xhr.status, data: JSON.parse(xhr.responseText) }); }
                catch { reject(new Error('Ошибка ответа сервера')); }
            };
            xhr.onerror = () => reject(new Error('Нет соединения с сервером'));
            xhr.ontimeout = () => reject(new Error('Превышено время ожидания'));
            xhr.timeout = 120000;
            xhr.open('POST', `${API_URL}/orders/${orderId}/photos`);
            xhr.send(formData);
        });

        setProgress('Готово!', 100);

        if (result.status === 201) {
            resultDiv.innerHTML = `
                <div class="alert alert-success py-2 small">
                    <i class="bi bi-check-circle-fill me-1"></i>
                    <strong>${files.length} ${files.length===1?'фото отправлено':'фото отправлены'}</strong> — клиент получит в VK в течение минуты
                </div>`;
            currentSelectedFiles = [];
            updatePhotoPreview();
            commentInput.value = '';
            const fileInput = document.getElementById('photoFileInput');
            if (fileInput) fileInput.value = '';
            const label = document.getElementById('photoDropLabel');
            if (label) label.style.borderColor = '#0d6efd!important';
        } else {
            resultDiv.innerHTML = `<div class="alert alert-danger py-2 small">
                <i class="bi bi-x-circle me-1"></i>${result.data?.error || 'Ошибка загрузки'}
            </div>`;
        }
    } catch (e) {
        resultDiv.innerHTML = `<div class="alert alert-danger py-2 small">
            <i class="bi bi-x-circle me-1"></i>${e.message}
        </div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send me-2"></i>Отправить клиенту в VK';
        setTimeout(() => {
            const prog = document.getElementById('photoProgress');
            if (prog) prog.style.display = 'none';
        }, 3000);
    }
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
            showSuccess(`Статус: «${newStatus}»`);
            loadMyWork(); // перезагружаем вкладку после смены статуса
        } else {
            showError(data.error || 'Не удалось изменить статус');
        }
    } catch (e) {
        showError('Ошибка соединения');
    }
}