// personnelList.js — public/js/views/personnelList.js

import { initListPage, reloadCatalog } from '../components/catalog.js';
import { navigate } from '../utils/router.js';
import { createItem, updateItem, deleteItem } from '../api/api.js';
import { openModal } from '../components/modal.js';

function getFormHTML(person = null) {
  return `
    <form id="edit-form">
      <div class="form-group">
        <label>Ім'я *</label>
        <input type="text" name="name" value="${person?.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Біографія</label>
        <textarea name="bio" rows="4">${person?.bio || ''}</textarea>
      </div>
      <div class="form-group">
        <label>URL зображення</label>
        <input type="url" name="cv_img" value="${person?.cv_img || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>CV ID</label>
          <input type="number" name="cv_id" value="${person?.cv_id || ''}">
        </div>
        <div class="form-group">
          <label>CV Slug</label>
          <input type="text" name="cv_slug" value="${person?.cv_slug || ''}">
        </div>
      </div>
    </form>
  `;
}

async function handleAdd() {
  openModal('Додати персону', getFormHTML(), async (data) => {
    await createItem('personnel', data);
    await window.updateStats();
    await reloadCatalog();
  });
}

async function handleEdit(id) {
  const res = await fetch(`http://localhost:7000/api/personnel/${id}`);
  const person = await res.json();
  openModal('Редагувати персону', getFormHTML(person), async (data) => {
    await updateItem('personnel', id, data);
    await reloadCatalog();
  });
}

async function handleDelete(id) {
  if (!confirm('Видалити цю персону?')) return;
  await deleteItem('personnel', id);
  await window.updateStats();
  await reloadCatalog();
}

export async function renderPersonnelList() {
  await initListPage({
    title:       'Персонал',
    endpoint:    'personnel',
    imageKey:    'cv_img',
    imagePrefix: null,
    titleKey:    'name',
    defaultIcon: '👤',
    gridMeta: [
      { key: 'bio', prefix: '' }
    ],
    tableColumns: [
      { key: 'cv_img', label: 'Фото',  type: 'image' },
      { key: 'name',   label: 'Ім\'я' },
      { key: 'bio',    label: 'Біо'   },
      { key: 'cv_id',  label: 'CV ID' }
    ],
    onAdd:      handleAdd,
    onEdit:     handleEdit,
    onDelete:   handleDelete,
    onNavigate: (id, cv_id) => navigate('personnel-detail', { id, cv_id })
  });
}