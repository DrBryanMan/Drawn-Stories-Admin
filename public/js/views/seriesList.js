import { initListPage, reloadCatalog } from '../components/catalog.js';
import { navigate, buildUrl } from '../utils/router.js';
import { createItem, updateItem, deleteItem } from '../api/api.js';
import { openModal } from '../components/modal.js';

function getFormHTML(series = null) {
  return `
    <form id="edit-form">
      <div class="form-group">
        <label>Назва *</label>
        <input type="text" name="name" value="${series?.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Опис</label>
        <textarea name="description">${series?.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label>URL зображення</label>
        <input type="text" name="cv_img" value="${series?.cv_img || ''}">
      </div>
    </form>
  `;
}

async function handleAdd() {
  openModal('Додати серію', getFormHTML(), async (data) => {
    await createItem('series', data);
    await window.updateStats();
    await reloadCatalog();
  });
}

async function handleEdit(id) {
  const res = await fetch(`http://localhost:7000/api/series/${id}`);
  const series = await res.json();
  openModal('Редагувати серію', getFormHTML(series), async (data) => {
    await updateItem('series', id, data);
    await reloadCatalog();
  });
}

async function handleDelete(id) {
  if (!confirm('Видалити цю серію? Томи залишаться, але зв\'язки з серією буде видалено.')) return;
  await deleteItem('series', id);
  await window.updateStats();
  await reloadCatalog();
}

export async function renderSeriesList() {
  await initListPage({
    title:      'Серії',
    endpoint:   'series',
    imageKey:   'cv_img',
    imagePrefix: null,   // серії зберігають повний URL
    titleKey:   'name',
    defaultIcon: '📚',
    gridMeta: [
      { key: 'description', prefix: '' }
    ],
    tableColumns: [
      { key: 'cv_img',      label: 'Обкладинка', type: 'image' },
      { key: 'name',        label: 'Назва'   },
      { key: 'description', label: 'Опис'    }
    ],
    onAdd:      handleAdd,
    onEdit:     handleEdit,
    onDelete:   handleDelete,
    onNavigate: (id) => navigate('series-detail', { id }),
    buildUrl: (id) => buildUrl('series-detail', { id }),
  });
}
