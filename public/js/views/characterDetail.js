import { fetchItem, updateItem } from '../api/api.js';
import { formatDate, showError, showLoading, initDetailPage } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { openModal } from '../components/modal.js';

export async function renderCharacterDetail(params) {
    const characterId = params.id;
    
    if (!characterId) {
        navigate('characters');
        return;
    }
    
    initDetailPage();
    showLoading();
    
    try {
        const character = await fetchItem('characters', characterId);
        
        document.getElementById('page-title').innerHTML = `
            <a href="#" onclick="event.preventDefault(); navigateToParent()" style="color: var(--text-secondary); text-decoration: none;">
                ← Персонажі
            </a> / ${character.name || 'Персонаж'}
        `;
        
        const content = document.getElementById('content');
        content.innerHTML = `
            <div style="max-width: 1200px;">
                <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
                    <div style="flex-shrink: 0;">
                        ${character.cv_img 
                            ? `<img src="${character.cv_img}" alt="${character.name}" 
                                style="width: 300px; border-radius: 8px; box-shadow: var(--shadow-lg);">` 
                            : '<div style="width: 300px; height: 450px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 4rem;">🦸</div>'}
                    </div>
                    <div style="flex: 1;">
                        <h1 style="font-size: 2rem; margin-bottom: 1rem;">${character.name || 'Без імені'}</h1>
                        ${character.real_name ? `<h2 style="font-size: 1.25rem; color: var(--text-secondary); margin-bottom: 1.5rem;">${character.real_name}</h2>` : ''}
                        
                        <div style="display: grid; gap: 0.5rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                            <div><strong>CV ID:</strong> ${character.cv_id}</div>
                            <div><strong>CV Slug:</strong> ${character.cv_slug}</div>
                            <div><strong>Дата створення:</strong> ${formatDate(character.created_at)}</div>
                        </div>
                        
                        <button class="btn btn-secondary" onclick="editCharacterDetail(${character.id})">
                            Редагувати персонажа
                        </button>
                        
                        ${character.description ? `
                            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 6px; margin-top: 1.5rem;">
                                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem;">Опис</h3>
                                <p style="line-height: 1.6; white-space: pre-wrap;">${character.description}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Помилка завантаження персонажа:', error);
        showError('Помилка завантаження даних');
    }
}

function getCharacterFormHTML(character = null) {
    return `
        <form id="edit-form">
            <div class="form-row">
                <div class="form-group">
                    <label>CV ID *</label>
                    <input type="number" name="cv_id" value="${character?.cv_id || ''}" required>
                </div>
                <div class="form-group">
                    <label>CV Slug *</label>
                    <input type="text" name="cv_slug" value="${character?.cv_slug || ''}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Ім'я персонажа *</label>
                <input type="text" name="name" value="${character?.name || ''}" required>
            </div>
            <div class="form-group">
                <label>Справжнє ім'я</label>
                <input type="text" name="real_name" value="${character?.real_name || ''}">
            </div>
            <div class="form-group">
                <label>URL зображення</label>
                <input type="url" name="cv_img" value="${character?.cv_img || ''}">
            </div>
            <div class="form-group">
                <label>Опис</label>
                <textarea name="description">${character?.description || ''}</textarea>
            </div>
        </form>
    `;
}

window.editCharacterDetail = async (id) => {
    try {
        const response = await fetch(`http://localhost:7000/api/characters/${id}`);
        const character = await response.json();
        
        openModal('Редагувати персонажа', getCharacterFormHTML(character), async (data) => {
            await updateItem('characters', id, data);
            await renderCharacterDetail({ id });
            await window.updateStats();
        });
    } catch (error) {
        console.error('Помилка:', error);
        alert('Помилка завантаження даних');
    }
};