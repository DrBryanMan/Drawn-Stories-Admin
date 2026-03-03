// public/js/components/filtersPanel.js
// Керує панеллю фільтрів (#filters-panel) — окрема від header-actions

/**
 * Повністю очищає панель фільтрів і ховає її.
 * Викликати на початку кожного renderXxxList().
 */
export function clearFiltersPanel() {
  const panel = document.getElementById('filters-panel');
  if (!panel) return;
  panel.innerHTML = '';
  panel.style.display = 'none';
}

/**
 * Повертає елемент панелі фільтрів (відображає її).
 * Використовувати для вставки фільтрів.
 * @returns {HTMLElement}
 */
export function getFiltersPanel() {
  const panel = document.getElementById('filters-panel');
  if (!panel) return null;
  panel.style.display = 'flex';
  return panel;
}