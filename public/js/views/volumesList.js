// public/js/views/volumesList.js

import { initListPage, reloadCatalog, setCatalogPublisherIds } from '../components/catalog.js';
import { cv_img_path_small } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { createItem, updateItem, deleteItem } from '../api/api.js';
import { openModal } from '../components/modal.js';
import { clearFiltersPanel, getFiltersPanel } from '../components/filtersPanel.js';
import { mountPublisherFilter } from '../components/publisherFilterPanel.js';

function getFormHTML(volume = null) {
  return `
    <form id="edit-form">
      <div class="form-group">
        <label>CV ID *</label>
        <input type="number" name="cv_id" value="${volume?.cv_id || ''}" required>
      </div>
      <div class="form-group">
        <label>CV Slug *</label>
        <input type="text" name="cv_slug" value="${volume?.cv_slug || ''}" required>
      </div>
      <div class="form-group">
        <label>Назва *</label>
        <input type="text" name="name" value="${volume?.name || ''}" required>
      </div>
      <div class="form-group">
        <label>URL зображення</label>
        <input type="text" name="cv_img" value="${volume?.cv_img || ''}">
      </div>
      <div class="form-group">
        <label>Мова</label>
        <input type="text" name="lang" value="${volume?.lang || ''}" placeholder="напр. en, uk">
      </div>
    </form>
  `;
}

async function handleAdd() {
  openModal('Додати том', getFormHTML(), async (data) => {
    await createItem('volumes', data);
    await window.updateStats();
    await reloadCatalog();
  });
}

async function handleEdit(id) {
  const res = await fetch(`http://localhost:7000/api/volumes/${id}`);
  const volume = await res.json();
  openModal('Редагувати том', getFormHTML(volume), async (data) => {
    await updateItem('volumes', id, data);
    await window.updateStats();
    await reloadCatalog();
  });
}

async function handleDelete(id) {
  if (!confirm('Видалити цей том?')) return;
  await deleteItem('volumes', id);
  await window.updateStats();
  await reloadCatalog();
}

export async function renderVolumesList() {
  clearFiltersPanel();

  await initListPage({
    title:       'Томи',
    endpoint:    'volumes',
    imageKey:    'cv_img',
    imagePrefix: cv_img_path_small,
    titleKey:    'name',
    defaultIcon: '📚',
    gridMeta: [
      { key: 'lang',           prefix: '',      badge: true, badgeClass: 'badge-lang',        badgePosition: 'left:0.5rem' },
      { key: 'issue_count',    prefix: '📖 ',   badge: true, badgeClass: 'badge-issue-count', badgePosition: 'right:0.5rem' },
      { key: 'themes',         prefix: '',      badge: true, badgeClass: 'badge-theme',        badgePosition: 'bottom:0.5rem; left:0.5rem;' },
      { key: 'publisher_name', prefix: ''       },
      { key: 'cv_id',          prefix: 'CV ID: '},
      { key: 'created_at',     prefix: '➕ ',   type: 'date' }
    ],
    tableColumns: [
      { key: 'cv_img',         label: 'Обкладинка', type: 'image' },
      { key: 'name',           label: 'Назва'       },
      { key: 'lang',           label: 'Мова'        },
      { key: 'issue_count',    label: '📖'          },
      { key: 'publisher_name', label: 'Видавець'    },
      { key: 'cv_id',          label: 'CV ID'       },
      { key: 'cv_slug',        label: 'Slug'        },
      { key: 'created_at',     label: 'Додано', type: 'date' }
    ],
    onAdd:      handleAdd,
    onEdit:     handleEdit,
    onDelete:   handleDelete,
    onNavigate: (id, cv_id, cv_slug) => navigate('volume-detail', { id, cv_id, cv_slug })
  });

  // Монтуємо фільтр видавництва в панель фільтрів
  getFiltersPanel(); // показує панель
  mountPublisherFilter({
    panelId: 'volumes-publisher-filter',
    selectedPubs: [],
    onChange: (pubs) => { setCatalogPublisherIds(pubs.map(p => p.id)); },
  });
}