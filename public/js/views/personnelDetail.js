// personnelDetail.js — public/js/views/personnelDetail.js

import { fetchItem } from '../api/api.js';
import { formatDate, showError, showLoading, cleanupCatalogUI } from '../utils/helpers.js';
import { navigate } from '../utils/router.js';
import { openModal } from '../components/modal.js';

const API_BASE = 'http://localhost:7000/api';

export async function renderPersonnelDetail(params) {
  const id = params.id;
  if (!id) { navigate('personnel'); return; }

  cleanupCatalogUI();
  showLoading();

  try {
    const person = await fetchItem('personnel', id);

    document.getElementById('page-title').innerHTML = `
      <a href="#" onclick="event.preventDefault(); navigateBack()" style="color:var(--text-secondary); text-decoration:none;">
        ← Персонал
      </a> / ${person.name}
    `;

    const content = document.getElementById('content');
    content.innerHTML = `
      <div style="max-width:900px;">
        <div style="display:flex; gap:2rem; margin-bottom:2rem; align-items:flex-start;">
          <div style="flex-shrink:0;">
            ${person.cv_img
              ? `<img src="${person.cv_img}" alt="${person.name}" style="width:200px; border-radius:8px; box-shadow:var(--shadow-lg);">`
              : '<div style="width:200px; height:260px; background:var(--bg-secondary); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:5rem;">👤</div>'}
          </div>
          <div style="flex:1;">
            <h1 style="font-size:2rem; margin-bottom:1rem;">${person.name}</h1>
            <div style="display:grid; gap:0.5rem; color:var(--text-secondary); margin-bottom:1.5rem;">
              ${person.cv_id ? `<div><strong>CV ID:</strong> ${person.cv_id}</div>` : ''}
              ${person.cv_slug ? `<div><strong>CV Slug:</strong> ${person.cv_slug}</div>` : ''}
              <div><strong>Дата додавання:</strong> ${formatDate(person.created_at)}</div>
            </div>
            ${person.bio ? `
              <div style="background:var(--bg-secondary); border-radius:8px; padding:1rem; margin-bottom:1.5rem; line-height:1.6;">
                ${person.bio}
              </div>
            ` : ''}
            <div style="display:flex; gap:0.75rem;">
              <button class="btn btn-secondary" onclick="editPersonnel(${person.id})">Редагувати</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Помилка завантаження персони:', error);
    showError('Помилка завантаження даних');
  }
}

window.navigateBack = () => window.history.back();

window.editPersonnel = async (id) => {
  const person = await fetch(`${API_BASE}/personnel/${id}`).then(r => r.json());
  const formHTML = `
    <form id="edit-form">
      <div class="form-group">
        <label>Ім'я *</label>
        <input type="text" name="name" value="${person.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Біографія</label>
        <textarea name="bio" rows="4">${person.bio || ''}</textarea>
      </div>
      <div class="form-group">
        <label>URL зображення</label>
        <input type="url" name="cv_img" value="${person.cv_img || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>CV ID</label>
          <input type="number" name="cv_id" value="${person.cv_id || ''}">
        </div>
        <div class="form-group">
          <label>CV Slug</label>
          <input type="text" name="cv_slug" value="${person.cv_slug || ''}">
        </div>
      </div>
    </form>
  `;
  const { openModal } = await import('../components/modal.js');
  openModal('Редагувати персону', formHTML, async (data) => {
    await fetch(`${API_BASE}/personnel/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    await renderPersonnelDetail({ id });
    await window.updateStats();
  });
};