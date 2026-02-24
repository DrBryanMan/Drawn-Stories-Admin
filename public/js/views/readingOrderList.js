import { initListPage, reloadCatalog } from '../components/catalog.js';
import { navigate } from '../utils/router.js';
import { createItem, updateItem, deleteItem } from '../api/api.js';
import { openModal } from '../components/modal.js';

function getFormHTML(order = null) {
  return `
    <form id="edit-form">
      <div class="form-group">
        <label>Назва *</label>
        <input type="text" name="name" value="${order?.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Опис</label>
        <textarea name="description">${order?.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label>URL зображення</label>
        <input type="url" name="cv_img" value="${order?.cv_img || ''}">
      </div>
    </form>
  `;
}

async function handleAdd() {
  openModal('Додати порядок читання', getFormHTML(), async (data) => {
    await createItem('reading-orders', data);
    await window.updateStats();
    await reloadCatalog();
  });
}

async function handleEdit(id) {
  const res = await fetch(`http://localhost:7000/api/reading-orders/${id}`);
  const order = await res.json();
  openModal('Редагувати порядок читання', getFormHTML(order), async (data) => {
    await updateItem('reading-orders', id, data);
    await reloadCatalog();
  });
}

async function handleDelete(id) {
  if (!confirm('Видалити цей порядок читання? Всі зв\'язки з випусками буде видалено.')) return;
  await deleteItem('reading-orders', id);
  await window.updateStats();
  await reloadCatalog();
}

export async function renderReadingOrderList() {
  await initListPage({
    title:       'Порядок читання',
    endpoint:    'reading-orders',
    imageKey:    'cv_img',
    imagePrefix: null,
    titleKey:    'name',
    defaultIcon: '📋',
    gridMeta: [
      { key: 'description',  prefix: '' },
      { key: 'issue_count',  prefix: '📖 ' }
    ],
    tableColumns: [
      { key: 'cv_img',       label: 'Обкладинка', type: 'image' },
      { key: 'name',         label: 'Назва'   },
      { key: 'description',  label: 'Опис'    },
      { key: 'issue_count',  label: 'Випусків' }
    ],
    onAdd:       handleAdd,
    onEdit:      handleEdit,
    onDelete:    handleDelete,
    onNavigate:  (id) => navigate('reading-order-detail', { id })
  });
}