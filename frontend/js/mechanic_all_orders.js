function loadAvailableOrders() {
    const container = document.getElementById('availableOrdersList');
    if (!container) return;
    container.innerHTML = `<div class="text-center text-muted py-4">
        <i class="bi bi-clipboard"></i><br>
        Здесь будут отображаться доступные заказы (статус «Создан»).
    </div>`;
}