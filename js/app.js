// Field Vision CRM V2 â Main Application
import { TABS, TAB_COLUMNS } from './config.js';
import * as db from './db.js';

// ââ State ââ
let activeTab = 'bd';
let rows = [];
let showHidden = false;
let searchQuery = '';
let editingCell = null; // { id, key }
let saveTimeout = null;

// ââ Init ââ
document.addEventListener('DOMContentLoaded', () => {
  renderTabs();
  bindGlobalEvents();
  switchTab('bd');
});

// ââ Tab Navigation ââ
function renderTabs() {
  const nav = document.getElementById('tab-nav');
  nav.innerHTML = TABS.map(t =>
    `<button class="tab-btn ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`
  ).join('');
}

function switchTab(tabId) {
  activeTab = tabId;
  showHidden = false;
  searchQuery = '';
  document.getElementById('search-input').value = '';
  document.getElementById('toggle-hidden').textContent = 'Show Hidden';
  renderTabs();
  loadData();
}

// ââ Data Loading ââ
async function loadData() {
  const tableBody = document.getElementById('table-body');
  const tableHead = document.getElementById('table-head');
  tableBody.innerHTML = '<tr><td colspan="20" class="loading-cell">Loading...</td></tr>';

  try {
    rows = await db.fetchContacts(activeTab, true); // always fetch all, filter in UI
    renderTableHeader();
    renderTableBody();
    updateCounts();
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="20" class="loading-cell error">Error: ${err.message}</td></tr>`;
    console.error(err);
  }
}

// ââ Table Header ââ
function renderTableHeader() {
  const cols = TAB_COLUMNS[activeTab];
  const head = document.getElementById('table-head');
  head.innerHTML = `<tr>
    <th class="row-actions-col">#</th>
    ${cols.map(c => `<th style="min-width:${c.width}">${c.label}</th>`).join('')}
    <th class="row-actions-col"></th>
  </tr>`;
}

// ââ Table Body ââ
function renderTableBody() {
  const cols = TAB_COLUMNS[activeTab];
  const tbody = document.getElementById('table-body');
  const query = searchQuery.toLowerCase();

  const filtered = rows.filter(r => {
    if (!showHidden && r.hidden) return false;
    if (query) {
      return cols.some(c => {
        const v = r[c.key];
        return v && String(v).toLowerCase().includes(query);
      });
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${cols.length + 2}" class="loading-cell">No contacts found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((row, idx) => {
    const hiddenClass = row.hidden ? 'row-hidden' : '';
    return `<tr class="${hiddenClass}" data-id="${row.id}">
      <td class="row-num">${idx + 1}</td>
      ${cols.map(c => renderCell(row, c)).join('')}
      <td class="row-actions">
        <button class="btn-icon btn-hide" data-id="${row.id}" title="${row.hidden ? 'Unhide' : 'Hide'}">
          ${row.hidden ? 'ð' : 'ð'}
        </button>
      </td>
    </tr>`;
  }).join('');
}

function renderCell(row, col) {
  const value = row[col.key];
  const isEditing = editingCell && editingCell.id === row.id && editingCell.key === col.key;

  if (col.type === 'link') {
    if (value) {
      return `<td class="cell-link"><a href="${escapeHtml(value)}" target="_blank" rel="noopener" title="${escapeHtml(value)}">ð</a></td>`;
    }
    return `<td class="cell-link cell-empty" data-id="${row.id}" data-key="${col.key}">â</td>`;
  }

  if (col.type === 'priority') {
    const cls = value ? `priority-${value.toLowerCase()}` : '';
    if (isEditing) {
      return `<td class="cell-editing"><select class="cell-select" data-id="${row.id}" data-key="${col.key}" onchange="window._saveSelect(this)" onblur="window._closeEdit()">
        <option value="">â</option>
        ${['High', 'Mid', 'Low'].map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select></td>`;
    }
    return `<td class="cell-priority ${cls}" data-id="${row.id}" data-key="${col.key}">${value || 'â'}</td>`;
  }

  if (col.type === 'select') {
    if (isEditing) {
      return `<td class="cell-editing"><select class="cell-select" data-id="${row.id}" data-key="${col.key}" onchange="window._saveSelect(this)" onblur="window._closeEdit()">
        <option value="">â</option>
        ${(col.options || []).map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select></td>`;
    }
    return `<td class="cell-text" data-id="${row.id}" data-key="${col.key}">${escapeHtml(value || 'â')}</td>`;
  }

  if (col.type === 'date') {
    if (isEditing) {
      const dateVal = value || '';
      return `<td class="cell-editing"><input type="date" class="cell-date" value="${dateVal}" data-id="${row.id}" data-key="${col.key}" onchange="window._saveInput(this)" onblur="window._closeEdit()"></td>`;
    }
    const display = value ? formatDate(value) : 'â';
    const age = value ? getDaysSince(value) : null;
    const ageClass = age !== null ? (age > 30 ? 'date-stale' : age > 14 ? 'date-aging' : 'date-fresh') : '';
    return `<td class="cell-date-display ${ageClass}" data-id="${row.id}" data-key="${col.key}">${display}</td>`;
  }

  // Text
  if (isEditing) {
    return `<td class="cell-editing"><input type="text" class="cell-input" value="${escapeAttr(value || '')}" data-id="${row.id}" data-key="${col.key}" onblur="window._saveAndClose(this)" onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){window._cancelEdit();}" autofocus></td>`;
  }
  const displayText = value || '';
  const truncated = displayText.length > 60 ? displayText.substring(0, 57) + '...' : displayText;
  return `<td class="cell-text" data-id="${row.id}" data-key="${col.key}" title="${escapeAttr(displayText)}">${escapeHtml(truncated) || '<span class="cell-placeholder">â</span>'}</td>`;
}

// ââ Cell Editing ââ
function startEdit(id, key) {
  editingCell = { id, key };
  renderTableBody();
  // Focus the input
  setTimeout(() => {
    const input = document.querySelector('.cell-editing input, .cell-editing select');
    if (input) {
      input.focus();
      if (input.type === 'text') input.select();
    }
  }, 10);
}

window._saveSelect = function(el) {
  const id = el.dataset.id;
  const key = el.dataset.key;
  const value = el.value || null;
  saveCell(id, key, value);
};

window._saveInput = function(el) {
  const id = el.dataset.id;
  const key = el.dataset.key;
  const value = el.value || null;
  saveCell(id, key, value);
};

window._saveAndClose = function(el) {
  const id = el.dataset.id;
  const key = el.dataset.key;
  const value = el.value || null;
  saveCell(id, key, value);
  editingCell = null;
  renderTableBody();
};

window._closeEdit = function() {
  setTimeout(() => {
    editingCell = null;
    renderTableBody();
  }, 150);
};

window._cancelEdit = function() {
  editingCell = null;
  renderTableBody();
};

async function saveCell(id, key, value) {
  // Optimistic update
  const row = rows.find(r => r.id === id);
  if (row) row[key] = value;

  try {
    await db.updateContact(id, { [key]: value });
    showToast('Saved');
  } catch (err) {
    console.error('Save failed:', err);
    showToast('Save failed!', true);
    loadData(); // reload to get correct state
  }
}

// ââ Row Actions ââ
async function toggleHide(id) {
  const row = rows.find(r => r.id === id);
  if (!row) return;
  const newHidden = !row.hidden;
  row.hidden = newHidden;
  renderTableBody();
  updateCounts();

  try {
    await db.updateContact(id, { hidden: newHidden });
    showToast(newHidden ? 'Row hidden' : 'Row visible');
  } catch (err) {
    console.error('Toggle hide failed:', err);
    row.hidden = !newHidden;
    renderTableBody();
    updateCounts();
  }
}

async function addNewRow() {
  try {
    const maxSort = await db.getMaxSortOrder(activeTab);
    const newRow = {
      tab: activeTab,
      sort_order: maxSort + 1,
      company: 'New Contact',
      hidden: false,
    };
    const result = await db.createContact(newRow);
    if (result && result.length > 0) {
      rows.push(result[0]);
      renderTableBody();
      updateCounts();
      showToast('Row added');
      // Start editing the company name
      startEdit(result[0].id, 'company');
    }
  } catch (err) {
    console.error('Add row failed:', err);
    showToast('Failed to add row', true);
  }
}

// ââ Counts ââ
function updateCounts() {
  const visible = rows.filter(r => !r.hidden).length;
  const hidden = rows.filter(r => r.hidden).length;
  const total = rows.length;
  document.getElementById('row-count').textContent = `${visible} visible${hidden > 0 ? ` Â· ${hidden} hidden` : ''} Â· ${total} total`;
}

// ââ Event Binding ââ
function bindGlobalEvents() {
  // Tab clicks
  document.getElementById('tab-nav').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.dataset.tab);
  });

  // Cell clicks for editing
  document.getElementById('table-body').addEventListener('click', e => {
    const cell = e.target.closest('td[data-id][data-key]');
    if (cell && !cell.classList.contains('cell-editing')) {
      startEdit(cell.dataset.id, cell.dataset.key);
      return;
    }
    // Hide/unhide button
    const hideBtn = e.target.closest('.btn-hide');
    if (hideBtn) {
      toggleHide(hideBtn.dataset.id);
    }
  });

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderTableBody();
  });

  // Toggle hidden
  document.getElementById('toggle-hidden').addEventListener('click', () => {
    showHidden = !showHidden;
    document.getElementById('toggle-hidden').textContent = showHidden ? 'Hide Hidden' : 'Show Hidden';
    renderTableBody();
  });

  // Add row
  document.getElementById('add-row').addEventListener('click', addNewRow);

  // Refresh
  document.getElementById('refresh-btn').addEventListener('click', loadData);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && editingCell) {
      editingCell = null;
      renderTableBody();
    }
  });
}

// ââ Utilities ââ
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function getDaysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${isError ? 'toast-error' : 'toast-success'} toast-show`;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    toast.className = 'toast';
  }, 2000);
}
