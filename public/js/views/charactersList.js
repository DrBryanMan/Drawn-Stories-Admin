// charactersList.js — Розташування: public/js/views/charactersList.js

import { initListPage, reloadCatalog } from '../components/catalog.js';
import { navigate } from '../utils/router.js';
import { createItem, updateItem, deleteItem } from '../api/api.js';
import { openModal } from '../components/modal.js';

function getFormHTML(char = null) {
  return `
    <form id="edit-form">
      <div class="form-row">
        <div class="form-group">
          <label>CV ID *</label>
          <input type="number" name="cv_id" value="${char?.cv_id || ''}" required>
        </div>
        <div class="form-group">
          <label>CV Slug *</label>
          <input type="text" name="cv_slug" value="${char?.cv_slug || ''}" required>
        </div>
      </div>
      <div class="form-group">
        <label>Ім'я персонажа *</label>
        <input type="text" name="name" value="${char?.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Справжнє ім'я</label>
        <input type="text" name="real_name" value="${char?.real_name || ''}">
      </div>
      <div class="form-group">
        <label>URL зображення</label>
        <input type="url" name="cv_img" value="${char?.cv_img || ''}">
      </div>
      <div class="form-group">
        <label>Опис</label>
        <textarea name="description">${char?.description || ''}</textarea>
      </div>
    </form>
  `;
}

async function handleAdd() {
  openModal('Додати персонажа', getFormHTML(), async (data) => {
    await createItem('characters', data);
    await window.updateStats();
    await reloadCatalog();
  });
}

async function handleEdit(id) {
  const res = await fetch(`http://localhost:7000/api/characters/${id}`);
  const char = await res.json();
  openModal('Редагувати персонажа', getFormHTML(char), async (data) => {
    await updateItem('characters', id, data);
    await reloadCatalog();
  });
}

async function handleDelete(id) {
  if (!confirm('Видалити цього персонажа?')) return;
  await deleteItem('characters', id);
  await window.updateStats();
  await reloadCatalog();
}

export async function renderCharactersList() {
  await initListPage({
    title:      'Персонажі',
    endpoint:   'characters',
    imageKey:   'cv_img',
    imagePrefix: null,   // у персонажів cv_img — повний URL
    titleKey:   'name',
    defaultIcon: '🦸',
    gridMeta: [
      { key: 'real_name', prefix: '' },
      { key: 'cv_id',     prefix: 'CV ID: ' }
    ],
    tableColumns: [
      { key: 'cv_img',     label: 'Фото',         type: 'image' },
      { key: 'name',       label: 'Ім\'я'         },
      { key: 'real_name',  label: 'Справжнє ім\'я' },
      { key: 'cv_id',      label: 'CV ID'         }
    ],
    onAdd:      handleAdd,
    onEdit:     handleEdit,
    onDelete:   handleDelete,
    onNavigate: (id, cv_id) => navigate('character-detail', { id, cv_id })
  });
}