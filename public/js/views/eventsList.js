// eventsList.js — public/js/views/eventsList.js

import { initListPage, reloadCatalog } from '../components/catalog.js';
import { navigate } from '../utils/router.js';
import { createItem, updateItem, deleteItem } from '../api/api.js';
import { openModal } from '../components/modal.js';

function getFormHTML(event = null) {
  return `
    <form id="edit-form">
      <div class="form-group">
        <label>Назва *</label>
        <input type="text" name="name" value="${event?.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Опис</label>
        <textarea name="description" rows="3">${event?.description || ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Рік початку</label>
          <input type="number" name="start_year" value="${event?.start_year || ''}" min="1900" max="2100">
        </div>
        <div class="form-group">
          <label>Рік кінця</label>
          <input type="number" name="end_year" value="${event?.end_year || ''}" min="1900" max="2100">
        </div>
      </div>
      <div class="form-group">
        <label>URL зображення</label>
        <input type="url" name="cv_img" value="${event?.cv_img || ''}">
      </div>
    </form>
  `;
}

async function handleAdd() {
  openModal('Додати подію', getFormHTML(), async (data) => {
    await createItem('events', data);
    await window.updateStats();
    await reloadCatalog();
  });
}

async function handleEdit(id) {
  const res = await fetch(`http://localhost:7000/api/events/${id}`);
  const event = await res.json();
  openModal('Редагувати подію', getFormHTML(event), async (data) => {
    await updateItem('events', id, data);
    await reloadCatalog();
  });
}

async function handleDelete(id) {
  if (!confirm('Видалити цю подію? Всі зв\'язки з випусками та збірниками буде видалено.')) return;
  await deleteItem('events', id);
  await window.updateStats();
  await reloadCatalog();
}

export async function renderEventsList() {
  await initListPage({
    title:       'Події',
    endpoint:    'events',
    imageKey:    'cv_img',
    imagePrefix: null,
    titleKey:    'name',
    defaultIcon: '⚡',
    gridMeta: [
      { key: 'start_year', prefix: '' },
      { key: 'issue_count', prefix: '📖 ' },
      { key: 'collection_count', prefix: '📗 ' }
    ],
    tableColumns: [
      { key: 'cv_img',           label: 'Обкладинка',  type: 'image' },
      { key: 'name',             label: 'Назва'        },
      { key: 'start_year',       label: 'Рік'          },
      { key: 'issue_count',      label: 'Випусків'     },
      { key: 'collection_count', label: 'Збірників'    }
    ],
    onAdd:      handleAdd,
    onEdit:     handleEdit,
    onDelete:   handleDelete,
    onNavigate: (id) => navigate('event-detail', { id })
  });
}