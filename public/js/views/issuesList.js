// issuesList.js — Розташування: public/js/views/issuesList.js

import { initListPage, reloadCatalog } from '../components/catalog.js';
import { cv_img_path_small } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { createItem, updateItem, deleteItem } from '../api/api.js';
import { openModal } from '../components/modal.js';

function getFormHTML(issue = null) {
  return `
    <form id="edit-form">
      <div class="form-row">
        <div class="form-group">
          <label>CV ID</label>
          <input type="number" name="cv_id" value="${issue?.cv_id || ''}">
        </div>
        <div class="form-group">
          <label>CV Slug</label>
          <input type="text" name="cv_slug" value="${issue?.cv_slug || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Назва</label>
        <input type="text" name="name" value="${issue?.name || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Volume CV ID</label>
          <input type="number" name="cv_vol_id" value="${issue?.cv_vol_id || ''}">
        </div>
        <div class="form-group">
          <label>Номер випуску</label>
          <input type="text" name="issue_number" value="${issue?.issue_number || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Дата обкладинки</label>
          <input type="date" name="cover_date" value="${issue?.cover_date || ''}">
        </div>
        <div class="form-group">
          <label>Дата випуску</label>
          <input type="date" name="release_date" value="${issue?.release_date || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>URL зображення</label>
        <input type="url" name="cv_img" value="${issue?.cv_img || ''}">
      </div>
    </form>
  `;
}

async function handleAdd() {
  openModal('Додати випуск', getFormHTML(), async (data) => {
    await createItem('issues', data);
    await window.updateStats();
    await reloadCatalog();
  });
}

async function handleEdit(id) {
  const res = await fetch(`http://localhost:7000/api/issues/${id}`);
  const issue = await res.json();
  openModal('Редагувати випуск', getFormHTML(issue), async (data) => {
    await updateItem('issues', id, data);
    await reloadCatalog();
  });
}

async function handleDelete(id) {
  if (!confirm('Видалити цей випуск?')) return;
  await deleteItem('issues', id);
  await window.updateStats();
  await reloadCatalog();
}

export async function renderIssuesList() {
  await initListPage({
    title:      'Випуски',
    endpoint:   'issues',
    imageKey:   'cv_img',
    imagePrefix: cv_img_path_small,
    titleKey:   'name',
    defaultIcon: '📖',
    gridMeta: [
      { key: 'volume_name',  prefix: '', class: 'vol-name' },
      { key: 'cv_vol_id',    prefix: 'Vol: ', class: 'cv-vol-id' },
      { key: 'issue_number', prefix: '#', class: 'issue-number'},
      // { key: 'cover_date',   prefix: 'Дата: '   },
      // { key: 'created_at',   prefix: '➕ ', type: 'date'}
    ],
    tableColumns: [
      { key: 'cv_img',       label: 'Обкладинка',   type: 'image' },
      { key: 'name',         label: 'Назва'        },
      { key: 'volume_name',  label: 'Vol'          },
      { key: 'cv_vol_id',    label: 'Vol ID'       },
      { key: 'issue_number', label: '№'            },
      { key: 'cover_date',   label: 'Дата обкл.'   },
      { key: 'release_date', label: 'Дата випуску' },
      { key: 'created_at',   label: 'Додано', type: 'date'}
    ],
    onAdd:      handleAdd,
    onEdit:     handleEdit,
    onDelete:   handleDelete,
    onNavigate: (id, cv_id, cv_slug) => navigate('issue-detail', { id, cv_id, cv_slug })
  });
}