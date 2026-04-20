// ==================== БЭКАП БАЗЫ ДАННЫХ ====================
let selectedBackupOption = '';

// Показать модальное окно бэкапа
function showBackupModal() {
    selectedBackupOption = '';

    // Сброс интерфейса
    document.querySelectorAll('.backup-option').forEach(opt => opt.classList.remove('active'));
    const customSection = document.getElementById('customTablesSection');
    if (customSection) customSection.style.display = 'none';

    const statusEl = document.getElementById('backupStatus');
    if (statusEl) {
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
    }

    const startBtn = document.getElementById('startBackupBtn');
    if (startBtn) startBtn.disabled = true;

    // Показываем модалку
    const modalEl = document.getElementById('backupModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// Выбор опции бэкапа
function selectBackupOption(option) {
    selectedBackupOption = option;

    // Сброс активных стилей
    document.querySelectorAll('.backup-option').forEach(opt => opt.classList.remove('active'));

    if (option === 'quick') {
        document.getElementById('quickBackupOption')?.classList.add('active');
    } else if (option === 'full') {
        document.getElementById('fullBackupOption')?.classList.add('active');
    } else if (option === 'custom') {
        document.getElementById('customBackupOption')?.classList.add('active');
        document.getElementById('customTablesSection').style.display = 'block';
    }

    document.getElementById('startBackupBtn').disabled = false;
}

// Начать процесс бэкапа
async function startBackup() {
    if (!selectedBackupOption) {
        showError('Выберите вариант бэкапа');
        return;
    }

    const statusEl = document.getElementById('backupStatus');
    const startBtn = document.getElementById('startBackupBtn');

    if (!statusEl || !startBtn) return;

    // Показываем процесс
    statusEl.innerHTML = `
        <div class="text-center">
            <div class="spinner-border text-primary mb-2" role="status"></div>
            <p class="mb-0">Создание резервной копии...</p>
            <small class="text-muted">Пожалуйста, подождите</small>
        </div>
    `;
    statusEl.className = 'backup-status alert alert-info';
    statusEl.style.display = 'block';

    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="bi bi-hourglass"></i> Выполняется...';

    try {
        let backupData = {
            type: selectedBackupOption,
            timestamp: new Date().toISOString(),
            user: currentUser?.full_name || 'Неизвестный пользователь'
        };

        if (selectedBackupOption === 'custom') {
            backupData.tables = {
                clients:   document.getElementById('backupClients')?.checked || false,
                orders:    document.getElementById('backupOrders')?.checked || false,
                cars:      document.getElementById('backupCars')?.checked || false,
                mechanics: document.getElementById('backupMechanics')?.checked || false,
                archive:   document.getElementById('backupArchive')?.checked || false,
                users:     document.getElementById('backupUsers')?.checked || false,
            };
        }

        const response = await fetch(`${API_URL}/backup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(backupData)
        });

        if (response.ok) {
            const result = await response.json();

            statusEl.innerHTML = `
                <div class="text-center">
                    <i class="bi bi-check-circle-fill text-success display-4 mb-3"></i>
                    <h5>Бэкап успешно создан!</h5>
                    <p>Файл: <code>${result.filename || 'backup.sql'}</code></p>
                    ${result.size ? `<p>Размер: ${result.size}</p>` : ''}
                    <p>Дата создания: ${new Date(result.timestamp || Date.now()).toLocaleString()}</p>
                    <div class="mt-3">
                        <button class="btn btn-success btn-sm me-2" onclick="downloadBackup('${result.filename || 'backup.sql'}')">
                            <i class="bi bi-download"></i> Скачать
                        </button>
                        <button class="btn btn-outline-primary btn-sm" onclick="viewBackupInfo('${result.filename || 'backup.sql'}')">
                            <i class="bi bi-info-circle"></i> Информация
                        </button>
                    </div>
                </div>
            `;
            statusEl.className = 'backup-status alert alert-success';

            showSuccess('Резервная копия успешно создана!');
        } else {
            const errorText = await response.text();
            let errorMessage = 'Неизвестная ошибка';
            try {
                const err = JSON.parse(errorText);
                errorMessage = err.error || err.message || errorText;
            } catch {
                errorMessage = errorText || `Ошибка ${response.status}`;
            }

            statusEl.innerHTML = `
                <div class="text-center">
                    <i class="bi bi-x-circle-fill text-danger display-4 mb-3"></i>
                    <h5>Ошибка создания бэкапа</h5>
                    <p>${errorMessage}</p>
                    <button class="btn btn-warning btn-sm mt-2" onclick="startBackup()">
                        <i class="bi bi-arrow-clockwise"></i> Попробовать снова
                    </button>
                </div>
            `;
            statusEl.className = 'backup-status alert alert-danger';

            showError(`Ошибка создания резервной копии: ${errorMessage}`);
        }
    } catch (error) {
        console.error('Ошибка при выполнении бэкапа:', error);

        statusEl.innerHTML = `
            <div class="text-center">
                <i class="bi bi-exclamation-triangle-fill text-warning display-4 mb-3"></i>
                <h5>Ошибка подключения</h5>
                <p>${error.message}</p>
                <button class="btn btn-warning btn-sm mt-2" onclick="startBackup()">
                    <i class="bi bi-arrow-clockwise"></i> Попробовать снова
                </button>
            </div>
        `;
        statusEl.className = 'backup-status alert alert-warning';

        showError('Ошибка подключения к серверу: ' + error.message);
    } finally {
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="bi bi-cloud-download"></i> Начать бэкап';
    }
}

// Скачать файл бэкапа
function downloadBackup(filename) {
    if (!filename) {
        showError('Имя файла не указано');
        return;
    }
    if (!token) {
        showError('Требуется авторизация для скачивания');
        return;
    }

    const url = `${API_URL}/backup/download/${encodeURIComponent(filename)}`;

    fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
    })
    .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);

        showSuccess(`Файл ${filename} скачивается...`);
    })
    .catch(err => {
        console.error('Ошибка скачивания:', err);
        showError(`Ошибка скачивания: ${err.message}`);
    });
}

// Показать список бэкапов
async function showBackupList() {
    try {
        if (!token) {
            showError('Требуется авторизация');
            return;
        }
        
        showInfo('Загрузка списка бэкапов...');
        
        const response = await fetch(`${API_URL}/backup/list`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.backups || data.backups.length === 0) {
            showInfo('Нет доступных бэкапов');
            return;
        }
        
        // Создаем модальное окно со списком
        let backupListHtml = '<div class="list-group">';
        
        data.backups.forEach(backup => {
            backupListHtml += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${backup.filename}</h6>
                        <small class="text-muted">
                            Создан: ${new Date(backup.created).toLocaleString()}<br>
                            Размер: ${backup.size}
                        </small>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-success" onclick="downloadBackup('${backup.filename}')">
                            <i class="bi bi-download"></i> Скачать
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteBackupFile('${backup.filename}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        backupListHtml += `</div>
            <div class="mt-3 text-center">
                <small class="text-muted">Всего файлов: ${data.count}</small>
            </div>`;
        
        // Показываем в модальном окне бэкапа
        const backupStatus = document.getElementById('backupStatus');
        if (backupStatus) {
            backupStatus.innerHTML = `
                <div class="alert alert-info">
                    <h6><i class="bi bi-list"></i> Список бэкапов</h6>
                    ${backupListHtml}
                </div>
            `;
            backupStatus.style.display = 'block';
            backupStatus.className = 'backup-status alert alert-info';
        }
        
    } catch (error) {
        console.error('Ошибка загрузки списка бэкапов:', error);
        showError('Ошибка загрузки списка бэкапов: ' + error.message);
    }
}

// Удалить файл бэкапа
async function deleteBackupFile(filename) {
    if (!confirm(`Вы уверены, что хотите удалить файл ${filename}?`)) {
        return;
    }
    
    try {
        if (!token) {
            showError('Требуется авторизация');
            return;
        }
        
        const response = await fetch(`${API_URL}/backup/${encodeURIComponent(filename)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            showSuccess(`Файл ${filename} удален`);
            // Обновляем список
            showBackupList();
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Ошибка удаления файла');
        }
    } catch (error) {
        showError('Ошибка удаления файла: ' + error.message);
    }
}

// Показать информацию о бэкапе
function viewBackupInfo(filename) {
    showInfo(`Информация о файле бэкапа: ${filename || 'Неизвестный файл'}`);
}

// Показать информацию о бэкапах
function showBackupInfo() {
    const statusEl = document.getElementById('backupStatus');
    if (!statusEl) return;

    statusEl.innerHTML = `
        <div class="alert alert-info">
            <h6><i class="bi bi-info-circle"></i> Информация о резервном копировании</h6>
            <p>Резервное копирование — создание копии данных для восстановления при утере или повреждении.</p>
            <p><strong>Рекомендации:</strong></p>
            <ul>
                <li>Выполняйте полный бэкап ежедневно</li>
                <li>Храните бэкапы в надёжном месте</li>
                <li>Проверяйте созданные файлы</li>
                <li>Не храните бэкапы на том же сервере, что и основная БД</li>
            </ul>
            <p><strong>Формат:</strong> SQL-файлы</p>
        </div>
    `;
    statusEl.style.display = 'block';
    statusEl.className = 'backup-status';
}