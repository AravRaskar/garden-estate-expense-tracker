// ============================================
// Expenses Module
// ============================================

import { fetchExpenses, saveExpense, deleteExpense } from './supabase.js';
import { formatCurrency, formatDate, escapeHtml, showToast, showConfirmModal } from './utils.js';

export async function renderExpenses(container, year) {
    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1><span class="header-icon">💸</span> Expenses Tracker</h1>
                <button class="btn btn-primary" id="btn-add-expense">+ Log Expense</button>
            </div>
            <div class="loading-spinner"><div class="spinner-ring"></div></div>
        </div>
    `;

    try {
        const items = await fetchExpenses(year);
        const totalExpenses = items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

        container.innerHTML = `
            <div class="page-enter">
                <div class="page-header">
                    <div>
                        <h1><span class="header-icon">💸</span> Expenses Tracker</h1>
                        <p class="text-muted text-sm">Track money given to personnel, contractors, or spent on event operations</p>
                    </div>
                    <button class="btn btn-primary" id="btn-add-expense">+ Log New Expense</button>
                </div>

                <div class="building-summary" style="margin-bottom: 1.5rem;">
                    <div class="summary-card">
                        <div class="summary-value" style="color: var(--error);">${formatCurrency(totalExpenses)}</div>
                        <div class="summary-label">Total Expenditure (${year})</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${items.length}</div>
                        <div class="summary-label">Total Expenses Logged</div>
                    </div>
                </div>

                <div class="flats-table-wrapper">
                    <table class="flats-table">
                        <thead>
                            <tr>
                                <th>Given To (Recipient)</th>
                                <th>Spent On (Purpose)</th>
                                <th>Amount</th>
                                <th>Payment Type</th>
                                <th>Date Spent</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `
                                <tr>
                                    <td colspan="6" style="text-align: center; padding: 2rem;" class="text-muted">
                                        No expenses logged for ${year}.
                                    </td>
                                </tr>
                            ` : items.map(item => `
                                <tr>
                                    <td class="owner-name">${escapeHtml(item.given_to)}</td>
                                    <td style="font-weight: 500;">${escapeHtml(item.spent_on)}</td>
                                    <td class="amount-cell" style="color: var(--error);">${formatCurrency(item.amount)}</td>
                                    <td class="transaction-type">${escapeHtml(item.transaction_type || '—')}</td>
                                    <td>${formatDate(item.date_spent)}</td>
                                    <td>
                                        <div style="display: flex; gap: 0.5rem;">
                                            <button class="btn-edit btn-edit-exp" data-id="${item.id}">✏️ Edit</button>
                                            <button class="btn-edit btn-del-exp" data-id="${item.id}" style="background: var(--error-light); color: var(--error); border-color: var(--error-border);">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-expense').onclick = () => openExpenseModal(null, year, () => renderExpenses(container, year));

        container.querySelectorAll('.btn-edit-exp').forEach(btn => {
            btn.onclick = () => {
                const item = items.find(i => i.id === btn.dataset.id);
                if (item) openExpenseModal(item, year, () => renderExpenses(container, year));
            };
        });

        container.querySelectorAll('.btn-del-exp').forEach(btn => {
            btn.onclick = async () => {
                const confirmed = await showConfirmModal('Are you sure you want to delete this expense record?', 'Delete Expense');
                if (confirmed) {
                    try {
                        await deleteExpense(btn.dataset.id);
                        showToast('Expense entry deleted');
                        renderExpenses(container, year);
                    } catch (err) {
                        showToast('Error deleting expense: ' + err.message, 'error');
                    }
                }
            };
        });

    } catch (err) {
        console.error('Expenses module error:', err);
        container.innerHTML = `<div class="empty-state"><h3>Failed to load expenses</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
}

function openExpenseModal(item, year, onSave) {
    const overlay = document.getElementById('expense-modal-overlay');
    const isEdit = !!item;

    document.getElementById('exp-modal-title').textContent = isEdit ? 'Edit Expense Record' : 'Log New Expense';
    document.getElementById('exp-given-to').value = item?.given_to || '';
    document.getElementById('exp-spent-on').value = item?.spent_on || '';
    document.getElementById('exp-amount').value = item?.amount || '';
    document.getElementById('exp-transaction-type').value = item?.transaction_type || 'Cash';
    document.getElementById('exp-date-spent').value = item?.date_spent || new Date().toISOString().split('T')[0];

    overlay.classList.add('active');

    const saveBtn = document.getElementById('exp-save-btn');
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.onclick = async () => {
        const given_to = document.getElementById('exp-given-to').value.trim();
        const spent_on = document.getElementById('exp-spent-on').value.trim();
        const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
        const transaction_type = document.getElementById('exp-transaction-type').value;
        const date_spent = document.getElementById('exp-date-spent').value;

        if (!given_to || !spent_on || amount <= 0) {
            showToast('Please fill out recipient, purpose, and amount', 'error');
            return;
        }

        newBtn.disabled = true;
        try {
            await saveExpense({
                id: item?.id || undefined,
                year,
                given_to,
                spent_on,
                amount,
                transaction_type,
                date_spent
            });
            showToast(isEdit ? 'Expense updated' : 'Expense recorded');
            overlay.classList.remove('active');
            onSave();
        } catch (err) {
            showToast('Save failed: ' + err.message, 'error');
        } finally {
            newBtn.disabled = false;
        }
    };

    const close = () => overlay.classList.remove('active');
    document.getElementById('exp-modal-close').onclick = close;
    document.getElementById('exp-cancel-btn').onclick = close;
}
