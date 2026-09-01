// ============================================
// Individuals Module
// ============================================

import { fetchIndividuals, saveIndividual, deleteIndividual } from './supabase.js';
import { formatCurrency, formatDate, escapeHtml, showToast, showConfirmModal } from './utils.js';

export async function renderIndividuals(container, year) {
    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1><span class="header-icon">👤</span> Individuals Collection</h1>
                <button class="btn btn-primary" id="btn-add-individual">+ Add Individual</button>
            </div>
            <div class="loading-spinner"><div class="spinner-ring"></div></div>
        </div>
    `;

    try {
        const items = await fetchIndividuals(year);
        const totalAmount = items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

        container.innerHTML = `
            <div class="page-enter">
                <div class="page-header">
                    <div>
                        <h1><span class="header-icon">👤</span> Individuals Collection</h1>
                        <p class="text-muted text-sm">Donations received from non-building / external individual donors</p>
                    </div>
                    <button class="btn btn-primary" id="btn-add-individual">+ Add Individual Donor</button>
                </div>

                <div class="building-summary" style="margin-bottom: 1.5rem;">
                    <div class="summary-card">
                        <div class="summary-value">${formatCurrency(totalAmount)}</div>
                        <div class="summary-label">Total Individual Collection</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${items.length}</div>
                        <div class="summary-label">Total Donors</div>
                    </div>
                </div>

                <div class="flats-table-wrapper">
                    <table class="flats-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Amount</th>
                                <th>Transaction Type</th>
                                <th>Date Given</th>
                                <th>Notes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `
                                <tr>
                                    <td colspan="6" style="text-align: center; padding: 2rem;" class="text-muted">
                                        No individual donations recorded for ${year}.
                                    </td>
                                </tr>
                            ` : items.map(item => `
                                <tr>
                                    <td class="owner-name">${escapeHtml(item.name)}</td>
                                    <td class="amount-cell">${formatCurrency(item.amount)}</td>
                                    <td class="transaction-type">${escapeHtml(item.transaction_type || '—')}</td>
                                    <td>${formatDate(item.date_given)}</td>
                                    <td class="text-muted text-sm">${escapeHtml(item.notes || '—')}</td>
                                    <td>
                                        <div style="display: flex; gap: 0.5rem;">
                                            <button class="btn-edit btn-edit-ind" data-id="${item.id}">✏️ Edit</button>
                                            <button class="btn-edit btn-del-ind" data-id="${item.id}" style="background: var(--error-light); color: var(--error); border-color: var(--error-border);">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Handlers
        document.getElementById('btn-add-individual').onclick = () => openIndividualModal(null, year, () => renderIndividuals(container, year));

        container.querySelectorAll('.btn-edit-ind').forEach(btn => {
            btn.onclick = () => {
                const item = items.find(i => i.id === btn.dataset.id);
                if (item) openIndividualModal(item, year, () => renderIndividuals(container, year));
            };
        });

        container.querySelectorAll('.btn-del-ind').forEach(btn => {
            btn.onclick = async () => {
                const confirmed = await showConfirmModal('Are you sure you want to delete this individual record?', 'Delete Record');
                if (confirmed) {
                    try {
                        await deleteIndividual(btn.dataset.id);
                        showToast('Record deleted');
                        renderIndividuals(container, year);
                    } catch (err) {
                        showToast('Error deleting record: ' + err.message, 'error');
                    }
                }
            };
        });

    } catch (err) {
        console.error('Individuals module error:', err);
        container.innerHTML = `<div class="empty-state"><h3>Failed to load individuals</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
}

function openIndividualModal(item, year, onSave) {
    const overlay = document.getElementById('individual-modal-overlay');
    const isEdit = !!item;

    document.getElementById('ind-modal-title').textContent = isEdit ? 'Edit Individual Donor' : 'Add Individual Donor';
    document.getElementById('ind-name').value = item?.name || '';
    document.getElementById('ind-amount').value = item?.amount || '';
    document.getElementById('ind-transaction-type').value = item?.transaction_type || 'Cash';
    document.getElementById('ind-date-given').value = item?.date_given || new Date().toISOString().split('T')[0];
    document.getElementById('ind-notes').value = item?.notes || '';

    overlay.classList.add('active');

    const saveBtn = document.getElementById('ind-save-btn');
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.onclick = async () => {
        const name = document.getElementById('ind-name').value.trim();
        const amount = parseFloat(document.getElementById('ind-amount').value) || 0;
        const transaction_type = document.getElementById('ind-transaction-type').value;
        const date_given = document.getElementById('ind-date-given').value;
        const notes = document.getElementById('ind-notes').value.trim();

        if (!name || amount <= 0) {
            showToast('Please provide a valid name and amount', 'error');
            return;
        }

        newBtn.disabled = true;
        try {
            await saveIndividual({
                id: item?.id || undefined,
                year,
                name,
                amount,
                transaction_type,
                date_given,
                notes
            });
            showToast(isEdit ? 'Updated successfully' : 'Added successfully');
            overlay.classList.remove('active');
            onSave();
        } catch (err) {
            showToast('Save failed: ' + err.message, 'error');
        } finally {
            newBtn.disabled = false;
        }
    };

    const close = () => overlay.classList.remove('active');
    document.getElementById('ind-modal-close').onclick = close;
    document.getElementById('ind-cancel-btn').onclick = close;
}
