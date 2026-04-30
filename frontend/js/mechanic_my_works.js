function loadMyWork() {
    const container = document.getElementById('myWorkContent');
    if (!container) return;
    container.innerHTML = `<div class="text-center text-muted py-4">
        <i class="bi bi-tools"></i><br>
        Вы пока не взяли ни одного заказа в работу.
    </div>`;
}