// ==================== ЗАЯВКИ ИЗ ВК ====================
async function loadRequests() {
    try {
        const requestsList = document.getElementById('requestsList');
        
        requestsList.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> Интеграция с ВКонтакте в разработке
            </div>
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        requestsList.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Ошибка загрузки заявок
            </div>
        `;
    }
}