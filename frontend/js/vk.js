// ==================== АВТООБНОВЛЕНИЕ И УВЕДОМЛЕНИЯ О НОВЫХ ЗАЯВКАХ ====================
//
// Без изменений на backend: периодический опрос уже существующего
// GET /orders?status=Заявка. Список «увиденных» ID храним в localStorage,
// поэтому счётчик переживает перезагрузку страницы.
//
// ВАЖНО: видимость вкладки «Заявки» определяется напрямую по элементу #requestsList
// (он гарантированно существует — его использует loadRequests() ниже).
// А вот бейдж-счётчик всё ещё ищет ссылку вкладки по onclick="showTab('requests'...)" —
// если бейдж у вас не появляется на вкладке, пришлите кусок HTML с навигацией (<nav>/<ul>),
// и я подправлю селектор под вашу реальную разметку.

const VK_POLL_INTERVAL_MS = 20000;       // опрос каждые 20 секунд
const VK_SEEN_KEY = 'vkSeenRequestIds';  // localStorage: какие заявки уже видели
let _vkNotifiedIds = new Set();          // чтобы не дублировать уведомления в рамках одной сессии

function getSeenVkIds() {
    try {
        return new Set(JSON.parse(localStorage.getItem(VK_SEEN_KEY) || '[]'));
    } catch (e) {
        return new Set();
    }
}

function saveSeenVkIds(idsSet) {
    localStorage.setItem(VK_SEEN_KEY, JSON.stringify([...idsSet]));
}

function isRequestsTabActive() {
    // Проверяем видимость самого #requestsList (он точно существует — его использует loadRequests()),
    // а не угаданный id вкладки-обёртки. offsetParent === null означает, что элемент
    // (или один из родителей) скрыт через display:none / не отрендерен.
    const listEl = document.getElementById('requestsList');
    return !!listEl && listEl.offsetParent !== null;
}

/** Лёгкий фоновый опрос: получаем список заявок, но НЕ перерисовываем DOM без необходимости */
async function pollVkRequests() {
    try {
        const token = localStorage.getItem('access_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${API_URL}/orders?status=Заявка`, { headers });
        if (!response.ok) return;
        const orders = await response.json();
        const currentIds = orders.map(o => o.order_id);

        const seen = getSeenVkIds();
        const unread = currentIds.filter(id => !seen.has(id));
        updateVkRequestsBadge(unread.length);

        const freshlyArrived = unread.filter(id => !_vkNotifiedIds.has(id));
        if (freshlyArrived.length > 0) {
            freshlyArrived.forEach(id => _vkNotifiedIds.add(id));
            notifyNewVkRequests(freshlyArrived.length, orders.filter(o => freshlyArrived.includes(o.order_id)));

            // Если вкладка «Заявки» уже открыта — сразу подгружаем новые заявки в список
            if (isRequestsTabActive()) {
                loadRequests();
            }
        }
    } catch (e) {
        console.warn('Опрос новых заявок ВК не удался:', e);
    }
}

/** Создаёт/обновляет красный счётчик на вкладке «Заявки» */
function updateVkRequestsBadge(count) {
    let badge = document.getElementById('vkRequestsBadge');
    const navLink = document.querySelector(
        '[onclick*="showTab(\'requests\'"], [onclick*=\'showTab("requests"\']' // <-- проверь это имя вкладки
    );
    if (!badge && navLink) {
        badge = document.createElement('span');
        badge.id = 'vkRequestsBadge';
        badge.className = 'badge rounded-pill bg-danger ms-1';
        badge.style.fontSize = '0.7rem';
        navLink.appendChild(badge);
    }
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

/** Браузерное уведомление + всплывающее сообщение внутри интерфейса */
function notifyNewVkRequests(count, orders) {
    const label = count === 1
        ? `Новая заявка №${orders[0].order_id} из ВКонтакте`
        : `${count} новых заявок из ВКонтакте`;

    if (window.Notification && Notification.permission === 'granted') {
        try {
            new Notification('Автосервис CRM', {
                body: label,
                tag: 'vk-new-request'
            });
        } catch (e) { /* не критично */ }
    }

    if (typeof showInfo === 'function') {
        showInfo(label);
    } else if (typeof showSuccess === 'function') {
        showSuccess(label);
    }
}

/** Запрашиваем разрешение на уведомления при первом клике пользователя по странице */
function requestVkNotificationPermission() {
    if (window.Notification && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}
document.addEventListener('click', requestVkNotificationPermission, { once: true });

/** Помечает все переданные заявки как просмотренные и гасит счётчик */
function markVkRequestsSeen(orders) {
    const seen = getSeenVkIds();
    orders.forEach(o => seen.add(o.order_id));
    saveSeenVkIds(seen);
    updateVkRequestsBadge(0);
}

// Запускаем периодический опрос сразу после загрузки скрипта и далее по таймеру
pollVkRequests();
setInterval(pollVkRequests, VK_POLL_INTERVAL_MS);

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
        markVkRequestsSeen(orders); // открыли вкладку — все текущие заявки считаются просмотренными

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
                    <div class="mb-2 text-body-secondary small">
                        <i class="bi bi-car-front me-1"></i>
                        ${order.car_model ? escapeHtml(order.car_model) : '—'}
                        ${order.car_year ? `(${order.car_year} г.)` : ''}
                        ${order.car_gos_number ? `· Госномер: ${escapeHtml(order.car_gos_number)}` : ''}
                        ${order.car_vin ? `· VIN: ${escapeHtml(order.car_vin)}` : ''}
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