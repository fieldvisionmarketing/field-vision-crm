// Field Vision CRM V2 - Main Application
import { TABS, TAB_COLUMNS } from './config.js';
import * as db from './db.js';

// -- State --
let activeTab = 'bd';
let rows = [];
let showHidden = false;
let searchQuery = '';
let editingCell = null; // { id, key }
let saveTimeout = null;
let dragSrcId = null;
let collapsedTiers = {}; // { tierName: true/false }

// -- Init --
document.addEventListener('DOMContentLoaded', () => {
  renderTabs();
  bindGlobalEvents();
  switchTab('bd');
});

// -- Tab Navigation --
function renderTabs() {
  const nav = document.getElementById('tab-nav');
  nav.innerHTML = TABS.map(t =>
    '<button class="tab-btn ' + (t.id === activeTab ? 'active' : '') + '" data-tab="' + t.id + '">' + t.label + '</button>'
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

// -- Data Loading --
async function loadData() {
  const tableBody = document.getElementById('table-body');
  tableBody.innerHTML = '<tr><td colspan="20" class="loading-cell">Loading...</td></tr>';

  try {
    rows = await db.fetchContacts(activeTab, true); // always fetch all, filter in UI
    renderTableHeader();
    renderTableBody();
    updateCounts();
  } catch (err) {
    tableBody.innerHTML = '<tr><td colspan="20" class="loading-cell error">Error: ' + err.message + '</td></tr>';
    console.error(err);
  }
}

// -- Table Header --
function renderTableHeader() {
  const cols = TAB_COLUMNS[activeTab];
  const head = document.getElementById('table-head');
  head.innerHTML = '<tr>' +
    '<th class="row-actions-col"></th>' +
    '<th class="row-actions-col">#</th>' +
    cols.map(c => '<th style="min-width:' + c.width + '">' + c.label + '</th>').join('') +
    '<th class="row-actions-col"></th>' +
    '</tr>';
}

// -- Table Body --
function renderTableBody() {
  const cols = TAB_COLUMNS[activeTab];
  const tbody = document.getElementById('table-body');
  const query = searchQuery.toLowerCase();

  let filtered = rows.filter(r => {
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
    tbody.innerHTML = '<tr><td colspan="' + (cols.length + 3) + '" class="loading-cell">No contacts found</td></tr>';
    return;
  }

  // Protemoi tab: group by tier
  if (activeTab === 'protemoi') {
    renderProtemoi(filtered, cols, tbody);
    return;
  }

  // Standard tab rendering
  tbody.innerHTML = filtered.map((row, idx) => renderRow(row, idx, cols)).join('');
}

// -- Protemoi Tier Rendering --
const TIER_ORDER = ['Tier One', 'Tier Two', 'Keeping Warm', 'Up Next', 'Shelved'];

function renderProtemoi(filtered, cols, tbody) {
  const tierGroups = {};
  TIER_ORDER.forEach(t => { tierGroups[t] = []; });
  tierGroups['Unassigned'] = [];

  filtered.forEach(r => {
    const tier = r.tier;
    // Handle legacy numeric tiers
    if (tier === 1 || tier === '1') tierGroups['Tier One'].push(r);
    else if (tier === 2 || tier === '2') tierGroups['Tier Two'].push(r);
    else if (tier && TIER_ORDER.includes(tier)) tierGroups[tier].push(r);
    else if (tier === 'Keeping Warm') tierGroups['Keeping Warm'].push(r);
    else if (tier === 'Up Next') tierGroups['Up Next'].push(r);
    else if (tier === 'Shelved') tierGroups['Shelved'].push(r);
    else tierGroups['Unassigned'].push(r);
  });

  let html = '';
  const allTiers = [...TIER_ORDER, 'Unassigned'];

  allTiers.forEach(tierName => {
    const group = tierGroups[tierName];
    if (group.length === 0) return;

    const isCollapsed = collapsedTiers[tierName] === true;
    const arrow = isCollapsed ? '&#9654;' : '&#9660;';
    html += '<tr class="tier-header-row" data-tier="' + tierName + '">' +
      '<td colspan="' + (cols.length + 3) + '">' +
      '<span class="tier-toggle">' + arrow + '</span> ' +
      tierName + ' (' + group.length + ')' +
      '</td></tr>';

    if (!isCollapsed) {
      html += group.map((row, idx) => renderRow(row, idx, cols)).join('');
    }
  });

  tbody.innerHTML = html;
}

// -- Render Single Row --
function renderRow(row, idx, cols) {
  const hiddenClass = row.hidden ? 'row-hidden' : '';

  return '<tr class="' + hiddenClass + '" data-id="' + row.id + '" draggable="true">' +
    '<td class="drag-handle" title="Drag to reorder">&#9776;</td>' +
    '<td class="row-num">' + (idx + 1) + '</td>' +
    cols.map(c => renderCell(row, c)).join('') +
    '<td class="row-actions">' +
      '<button class="btn-icon btn-hide" data-id="' + row.id + '" title="' + (row.hidden ? 'Unhide' : 'Hide') + '">' +
        (row.hidden ? '&#128065;' : '&#128064;') +
      '</button>' +
    '</td>' +
  '</tr>';
}

function renderCell(row, col) {
  const value = row[col.key];
  const isEditing = editingCell && editingCell.id === row.id && editingCell.key === col.key;

  if (col.type === 'link') {
    if (value) {
      return '<td class="cell-link"><a href="' + escapeHtml(value) + '" target="_blank" rel="noopener" title="' + escapeHtml(value) + '">&#128279;</a></td>';
    }
    return '<td class="cell-link cell-empty" data-id="' + row.id + '" data-key="' + col.key + '">-</td>';
  }

  if (col.type === 'priority') {
    const cls = value ? 'priority-' + value.toLowerCase() : '';
    if (isEditing) {
      return '<td class="cell-editing"><select class="cell-select" data-id="' + row.id + '" data-key="' + col.key + '" onchange="window._saveSelect(this)" onblur="window._closeEdit()">' +
        '<option value="">-</option>' +
        ['High', 'Mid', 'Low'].map(o => '<option value="' + o + '"' + (value === o ? ' selected' : '') + '>' + o + '</option>').join('') +
      '</select></td>';
    }
    return '<td class="cell-priority ' + cls + '" data-id="' + row.id + '" data-key="' + col.key + '">' + (value || '-') + '</td>';
  }

  if (col.type === 'select') {
    if (isEditing) {
      return '<td class="cell-editing"><select class="cell-select" data-id="' + row.id + '" data-key="' + col.key + '" onchange="window._saveSelect(this)" onblur="window._closeEdit()">' +
        '<option value="">-</option>' +
        (col.options || []).map(o => '<option value="' + o + '"' + (value === o ? ' selected' : '') + '>' + o + '</option>').join('') +
      '</select></td>';
    }
    return '<td class="cell-text" data-id="' + row.id + '" data-key="' + col.key + '">' + escapeHtml(value || '-') + '</td>';
  }

  if (col.type === 'date') {
    if (isEditing) {
      const dateVal = value || '';
      return '<td class="cell-editing"><input type="date" class="cell-date" value="' + dateVal + '" data-id="' + row.id + '" data-key="' + col.key + '" onchange="window._saveInput(this)" onblur="window._closeEdit()"></td>';
    }
    const display = value ? formatDate(value) : '-';
    const age = value ? getDaysSince(value) : null;
    const ageClass = age !== null ? (age > 30 ? 'date-stale' : age > 14 ? 'date-aging' : 'date-fresh') : '';
    return '<td class="cell-date-display ' + ageClass + '" data-id="' + row.id + '" data-key="' + col.key + '">' + display + '</td>';
  }

  // Text
  if (isEditing) {
    return '<td class="cell-editing"><input type="text" class="cell-input" value="' + escapeAttr(value || '') + '" data-id="' + row.id + '" data-key="' + col.key + '" onblur="window._saveAndClose(this)" onkeydown="if(event.key===\'Enter\')this.blur();if(event.key===\'Escape\'){window._cancelEdit();}" autofocus></td>';
  }
  const displayText = value || '';
  const truncated = displayText.length > 60 ? displayText.substring(0, 57) + '...' : displayText;
  return '<td class="cell-text" data-id="' + row.id + '" data-key="' + col.key + '" title="' + escapeAttr(displayText) + '">' + (escapeHtml(truncated) || '<span class="cell-placeholder">-</span>') + '</td>';
}

// -- Cell Editing --
function startEdit(id, key) {
  editingCell = { id, key };
  renderTableBody();
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
  const row = rows.find(r => r.id === id);
  if (row) row[key] = value;

  try {
    await db.updateContact(id, { [key]: value });
    showToast('Saved');
  } catch (err) {
    console.error('Save failed:', err);
    showToast('Save failed!', true);
    loadData();
  }
}

// -- Drag and Drop Reordering --
function handleDragStart(e) {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  dragSrcId = tr.dataset.id;
  tr.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcId);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const tr = e.target.closest('tr[data-id]');
  if (!tr || tr.dataset.id === dragSrcId) return;

  // Remove existing drop indicators
  document.querySelectorAll('.drop-above, .drop-below').forEach(el => {
    el.classList.remove('drop-above', 'drop-below');
  });

  // Determine if dropping above or below
  const rect = tr.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  if (e.clientY < midY) {
    tr.classList.add('drop-above');
  } else {
    tr.classList.add('drop-below');
  }
}

function handleDragLeave(e) {
  const tr = e.target.closest('tr[data-id]');
  if (tr) {
    tr.classList.remove('drop-above', 'drop-below');
  }
}

async function handleDrop(e) {
  e.preventDefault();
  document.querySelectorAll('.drop-above, .drop-below, .dragging').forEach(el => {
    el.classList.remove('drop-above', 'drop-below', 'dragging');
  });

  const targetTr = e.target.closest('tr[data-id]');
  if (!targetTr || !dragSrcId) return;

  const targetId = targetTr.dataset.id;
  if (targetId === dragSrcId) return;

  const srcRow = rows.find(r => r.id === dragSrcId);
  const targetRow = rows.find(r => r.id === targetId);
  if (!srcRow || !targetRow) return;

  // Get visible (filtered) rows to determine order
  const filtered = rows.filter(r => !r.hidden || showHidden);

  const srcIdx = filtered.indexOf(srcRow);
  const targetIdx = filtered.indexOf(targetRow);
  if (srcIdx === -1 || targetIdx === -1) return;

  // Remove src from array and insert at target position
  filtered.splice(srcIdx, 1);
  const insertIdx = e.clientY < (targetTr.getBoundingClientRect().top + targetTr.getBoundingClientRect().height / 2) ? targetIdx : targetIdx;
  filtered.splice(insertIdx > srcIdx ? insertIdx - 1 : insertIdx, 0, srcRow);

  // Update sort_order for all affected rows
  const updates = [];
  filtered.forEach((r, i) => {
    const newOrder = i + 1;
    if (r.sort_order !== newOrder) {
      r.sort_order = newOrder;
      updates.push(db.updateContact(r.id, { sort_order: newOrder }));
    }
  });

  rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  renderTableBody();
  dragSrcId = null;

  if (updates.length > 0) {
    try {
      await Promise.all(updates);
      showToast('Reordered');
    } catch (err) {
      console.error('Reorder failed:', err);
      showToast('Reorder failed!', true);
      loadData();
    }
  }
}

function handleDragEnd() {
  dragSrcId = null;
  document.querySelectorAll('.drop-above, .drop-below, .dragging').forEach(el => {
    el.classList.remove('drop-above', 'drop-below', 'dragging');
  });
}

// -- Row Actions --
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
      startEdit(result[0].id, 'company');
    }
  } catch (err) {
    console.error('Add row failed:', err);
    showToast('Failed to add row', true);
  }
}

// -- Counts --
function updateCounts() {
  const visible = rows.filter(r => !r.hidden).length;
  const hidden = rows.filter(r => r.hidden).length;
  const total = rows.length;
  const dot = String.fromCharCode(183);
  document.getElementById('row-count').textContent = visible + ' visible' + (hidden > 0 ? ' ' + dot + ' ' + hidden + ' hidden' : '') + ' ' + dot + ' ' + total + ' total';
}

// -- Event Binding --
function bindGlobalEvents() {
  // Tab clicks
  document.getElementById('tab-nav').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.dataset.tab);
  });

  const tableBody = document.getElementById('table-body');

  // Drag and drop events
  tableBody.addEventListener('dragstart', handleDragStart);
  tableBody.addEventListener('dragover', handleDragOver);
  tableBody.addEventListener('dragleave', handleDragLeave);
  tableBody.addEventListener('drop', handleDrop);
  tableBody.addEventListener('dragend', handleDragEnd);

  // Cell clicks for editing + hide buttons + tier toggles
  tableBody.addEventListener('click', e => {
    // Tier header toggle (collapsible)
    const tierRow = e.target.closest('.tier-header-row');
    if (tierRow) {
      const tierName = tierRow.dataset.tier;
      collapsedTiers[tierName] = !collapsedTiers[tierName];
      renderTableBody();
      return;
    }

    // Hide/unhide button
    const hideBtn = e.target.closest('.btn-hide');
    if (hideBtn) {
      toggleHide(hideBtn.dataset.id);
      return;
    }

    // Drag handle - don't start edit
    if (e.target.closest('.drag-handle')) return;

    // Cell clicks for editing
    const cell = e.target.closest('td[data-id][data-key]');
    if (cell && !cell.classList.contains('cell-editing')) {
      startEdit(cell.dataset.id, cell.dataset.key);
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

// -- Utilities --
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
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
}

function getDaysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

function showToast(message, isError) {
  isError = isError || false;
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + (isError ? 'toast-error' : 'toast-success') + ' toast-show';
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(function() {
    toast.className = 'toast';
  }, 2000);
}
