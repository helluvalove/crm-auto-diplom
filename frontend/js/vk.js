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
            container.innerHTML = '<div class="alert alert-info"><i class="bi bi-inbox me-2"></i>Нет новых заявок</div>';
            return;
        }

        let html = '<div class="list-group">';
        orders.forEach(order => {
            const date = new Date(order.created_date).toLocaleString('ru-RU');
            const desc = order.problem_description || '';

            // Формат из message_handler.py:
            // "Клиент: ФИО, тел.: PHONE\nVK ID 12345: ТЕКСТ\nЖелаемая дата и время: ..."
            const clientMatch = desc.match(/^Клиент:\s*(.+?),\s*тел\.:\s*(.+)/m);
            const name  = clientMatch ? clientMatch[1].trim() : '—';
            const phone = clientMatch ? clientMatch[2].trim() : '—';

            const vkMatch = desc.match(/VK ID (\d+):\s*([^\n]*)/);
            const vkId    = vkMatch ? vkMatch[1] : '?';
            const problem = vkMatch ? (vkMatch[2].trim() || 'Без описания') : '—';

            const dtMatch = desc.match(/Желаемая дата и время:\s*(.+)/);
            const preferredDt = dtMatch ? dtMatch[1].trim() : null;

            const safeData = JSON.stringify({
                orderId:     order.order_id,
                clientId:    order.client_id,
                carId:       order.car_id,
                problem:     problem,
                preferredDt: preferredDt || ''
            }).replace(/'/g, '&#39;');

            html += `
                <div class="list-group-item" id="request-item-${order.order_id}">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <strong class="fs-6">Заявка №${order.order_id}</strong>
                        <small class="text-muted">${date}</small>
                    </div>
                    <div class="mb-2 text-body-secondary small">
                        <span class="me-3"><i class="fas fa-user me-1"></i>${escapeHtml(name)}</span>
                        <span class="me-3"><i class="fas fa-phone me-1"></i>${escapeHtml(phone)}</span>
                        <span><i class="fab fa-vk me-1"></i>VK ID: ${escapeHtml(vkId)}</span>
                    </div>
                    <p class="mb-2"><i class="fas fa-file-alt me-1 text-muted"></i>${escapeHtml(problem)}</p>
                    ${preferredDt
                        ? `<div class="mb-2">
                               <span class="badge bg-warning text-dark"><i class="fas fa-calendar-alt me-1"></i>${escapeHtml(preferredDt)}</span>
                               <small class="text-muted ms-1">— желаемое время клиента</small>
                           </div>`
                        : `<div class="mb-2"><span class="badge bg-light text-secondary border"><i class="fas fa-calendar-alt me-1"></i>Время не указано</span></div>`
                    }
                    <div class="d-flex gap-2 mt-1">
                        <button class="btn btn-success btn-sm"
                            onclick='acceptVkRequest(${safeData})'>
                            <i class="bi bi-check-lg me-1"></i>Принять → Новый заказ
                        </button>
                        <button class="btn btn-outline-danger btn-sm"
                            onclick="openRejectModal(${order.order_id})">
                            <i class="bi bi-x-lg me-1"></i>Отклонить
                        </button>
                    </div>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="alert alert-warning">Ошибка загрузки заявок: ${escapeHtml(e.message)}</div>`;
    }
}

/**
 * Принять заявку — переходим на вкладку «Новый заказ».
 * Форма работает в режиме обновления: кнопка «Создать заказ-наряд»
 * сделает PUT /orders/{orderId} вместо POST.
 */
async function acceptVkRequest(dataArg) {
    const d = (typeof dataArg === 'string') ? JSON.parse(dataArg) : dataArg;
    const { orderId, clientId, carId, problem, preferredDt } = d;

    // Устанавливаем режим принятия — createOrder() увидит этот флаг
    window._acceptingVkOrderId = orderId;

    // Используем готовую функцию перехода (закрывает модалки, грузит клиентов, переключает вкладку)
    await createOrderForCar(carId, clientId);

    // Небольшая пауза — ждём пока подгрузятся автомобили клиента
    await new Promise(r => setTimeout(r, 400));

    // Подставляем описание проблемы из заявки
    const problemField = document.getElementById('orderProblem');
    if (problemField && problem) problemField.value = problem;

    // Если клиент указал желаемую дату — подставляем в поле даты
    if (preferredDt) {
        const parsed = parsePreferredDate(preferredDt);
        if (parsed) {
            const dateInput = document.getElementById('orderAppointmentDate');
            if (dateInput) {
                dateInput.value = parsed.date;
                dateInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    // Показываем информационный баннер
    showVkAcceptBanner(orderId, preferredDt);
}

/** Парсит «дд.мм.гггг чч:мм» → { date: 'YYYY-MM-DD', time: 'HH:MM' } */
function parsePreferredDate(str) {
    if (!str) return null;
    const m = str.match(/(\d{2})\.(\d{2})\.(\d{4})[\s,T]+(\d{2}):(\d{2})/);
    if (!m) return null;
    return { date: `${m[3]}-${m[2]}-${m[1]}`, time: `${m[4]}:${m[5]}` };
}

/** Синий баннер в начале card-body вкладки «Новый заказ» */
function showVkAcceptBanner(orderId, preferredDt) {
    document.getElementById('vkAcceptBanner')?.remove();
    const cardBody = document.querySelector('#newOrderTab .card .card-body');
    if (!cardBody) return;

    const banner = document.createElement('div');
    banner.id = 'vkAcceptBanner';
    banner.className = 'alert alert-primary d-flex align-items-start gap-3 mb-3';
    banner.innerHTML = `
        <i class="fab fa-vk fs-4 mt-1 flex-shrink-0"></i>
        <div class="flex-grow-1">
            <strong>Принятие заявки №${orderId} из ВКонтакте</strong><br>
            <span class="small">
                Клиент и автомобиль подставлены автоматически.
                ${preferredDt
                    ? `Желаемое время клиента: <strong>${escapeHtml(preferredDt)}</strong> — дата выбрана, выберите слот ниже.`
                    : 'Клиент не указал желаемое время — выберите дату и слот самостоятельно.'
                }<br>
                Нажмите «Создать заказ-наряд» — заявка №${orderId} получит выбранный статус,
                клиент получит уведомление в ВК.
            </span>
        </div>
        <button type="button" class="btn-close flex-shrink-0" onclick="cancelVkAccept()"></button>
    `;
    cardBody.prepend(banner);
}

/** Отмена принятия — сбросить флаг и баннер */
function cancelVkAccept() {
    window._acceptingVkOrderId = null;
    document.getElementById('vkAcceptBanner')?.remove();
}

// ── Перехват showTab: предупреждение при уходе с формы принятия ───────────────
(function patchShowTab() {
    const interval = setInterval(() => {
        if (typeof window.showTab !== 'function') return;
        clearInterval(interval);

        const _orig = window.showTab;
        window.showTab = function(tabName, event, opts) {
            if (tabName !== 'newOrder' && window._acceptingVkOrderId) {
                const ok = confirm(
                    `Вы уходите с формы принятия заявки №${window._acceptingVkOrderId}.\n` +
                    'Введённые данные будут сброшены. Продолжить?'
                );
                if (!ok) return;
                cancelVkAccept();
            }
            _orig.apply(this, arguments);
        };
    }, 50);
})();

// ── Модалка отклонения ────────────────────────────────────────────────────────

let _rejectOrderId = null;

function openRejectModal(orderId) {
    _rejectOrderId = orderId;
    const input = document.getElementById('rejectReasonInput');
    if (input) { input.value = ''; input.classList.remove('is-invalid'); }
    new bootstrap.Modal(document.getElementById('rejectModal')).show();
}

async function confirmReject() {
    const reason = (document.getElementById('rejectReasonInput')?.value || '').trim();
    if (!reason) {
        document.getElementById('rejectReasonInput')?.classList.add('is-invalid');
        return;
    }
    document.getElementById('rejectReasonInput')?.classList.remove('is-invalid');

    const orderId = _rejectOrderId;
    bootstrap.Modal.getInstance(document.getElementById('rejectModal'))?.hide();

    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_URL}/orders/${orderId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ reject_reason: reason })
        });

        const data = await res.json();
        if (!res.ok) { showError(data.error || `Ошибка ${res.status}`); return; }

        const item = document.getElementById(`request-item-${orderId}`);
        if (item) {
            item.style.transition = 'opacity .3s';
            item.style.opacity = '0';
            setTimeout(() => { item.remove(); checkRequestsEmpty(); }, 320);
        }
        showSuccess(`Заявка №${orderId} отклонена. Клиент уведомлён в ВК.`);

    } catch (e) {
        showError(`Ошибка: ${e.message}`);
    }
}

function checkRequestsEmpty() {
    const container = document.getElementById('requestsList');
    if (container && !container.querySelector('.list-group-item')) {
        container.innerHTML = '<div class="alert alert-info"><i class="bi bi-inbox me-2"></i>Нет новых заявок</div>';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text)));
    return div.innerHTML;
}