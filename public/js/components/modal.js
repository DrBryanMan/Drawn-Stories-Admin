// public/js/components/modal.js

let currentModal = null;
let saveCallback = null;

/**
 * Відкриває модалку.
 * @param {string} title
 * @param {string} formHTML
 * @param {Function} onSave
 * @param {Object} [options] — { wide: true } для ширшої модалки (760px)
 */
export function openModal(title, formHTML, onSave, options = {}) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalContent = modal.querySelector('.modal-content');

    modalTitle.textContent = title;
    modalBody.innerHTML = formHTML;
    modal.classList.add('active');

    // Ширина модалки
    if (modalContent) {
        modalContent.style.maxWidth = options.wide ? '760px' : '600px';
    }

    currentModal = modal;
    saveCallback = onSave;
}

export function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('active');
    currentModal = null;
    saveCallback = null;
}

export async function handleModalSave() {
    const form = document.getElementById('edit-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Конвертувати порожні рядки в null
    Object.keys(data).forEach(key => {
        if (data[key] === '') data[key] = null;
    });

    if (saveCallback) {
        try {
            await saveCallback(data);
            closeModal();
        } catch (error) {
            console.error('Помилка збереження:', error);
            alert('Помилка збереження даних');
        }
    }
}

export function initModalHandlers() {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', handleModalSave);

    // Закриття кліком на фон
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') {
            closeModal();
        }
    });

    // Закриття на Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentModal?.classList.contains('active')) {
            closeModal();
        }
    });
}