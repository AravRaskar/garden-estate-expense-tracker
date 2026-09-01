// ============================================
// Buildings Module
// ============================================

import { fetchBuildings, fetchFlats, fetchDonations, upsertDonation, deleteDonation } from './supabase.js';
import {
    formatCurrency, formatDate, getBuildingIcon, getProgressColor,
    escapeHtml, normalizeOwnerName, showToast
} from './utils.js';

let buildingsCache = null;

export async function renderBuildingsOverview(container, year) {
    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1><span class="header-icon">🏢</span> Buildings Overview</h1>
            </div>
            <div class="loading-spinner"><div class="spinner-ring"></div></div>
        </div>
    `;

    try {
        const buildings = await fetchBuildings();
        buildingsCache = buildings;

        const { fetchAllDonations } = await import('./supabase.js');
        const allDonations = await fetchAllDonations(year);

        const buildingStats = buildings.map(b => {
            const bDonations = allDonations.filter(d => d.building_id === b.id);
            const donated = bDonations.filter(d => d.donated).length;
            const amount = bDonations.reduce((sum, d) => sum + (d.donated ? parseFloat(d.amount) || 0 : 0), 0);
            const percent = Math.round((donated / 16) * 100);
            return { ...b, donated, amount, percent };
        });

        container.innerHTML = `
            <div class="page-enter">
                <div class="page-header">
                    <h1><span class="header-icon">🏢</span> Buildings Overview</h1>
                </div>
                <div class="buildings-grid">
                    ${buildingStats.map(b => `
                        <div class="building-card" data-building-id="${b.id}" data-building-name="${escapeHtml(b.name)}">
                            <div class="building-header">
                                <div class="building-icon">${getBuildingIcon(b.name)}</div>
                                <div>
                                    <div class="building-name">${escapeHtml(b.name)}</div>
                                    <div class="building-flats-count">16 Flats</div>
                                </div>
                            </div>
                            <div class="building-stats">
                                <div class="stat">
                                    <div class="stat-value">${formatCurrency(b.amount)}</div>
                                    <div class="stat-label">Collected</div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value">${b.donated}/16</div>
                                    <div class="stat-label">Donated</div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value">${b.percent}%</div>
                                    <div class="stat-label">Rate</div>
                                </div>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill ${getProgressColor(b.percent)}" style="width: ${b.percent}%;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.querySelectorAll('.building-card').forEach(card => {
            card.addEventListener('click', () => {
                const name = card.dataset.buildingName;
                window.location.hash = `#buildings/${encodeURIComponent(name)}`;
            });
        });

    } catch (err) {
        console.error('Buildings overview error:', err);
        container.innerHTML = `<div class="empty-state"><h3>Failed to load buildings</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
}

export async function renderBuildingDetail(container, buildingName, year) {
    container.innerHTML = `
        <div class="page-enter">
            <button class="back-btn" onclick="window.location.hash='#buildings'">← Back to Buildings</button>
            <div class="page-header">
                <h1><span class="header-icon">${getBuildingIcon(buildingName)}</span> ${escapeHtml(buildingName)}</h1>
            </div>
            <div class="loading-spinner"><div class="spinner-ring"></div></div>
        </div>
    `;

    try {
        if (!buildingsCache) {
            buildingsCache = await fetchBuildings();
        }
        const building = buildingsCache.find(b => b.name === buildingName);
        if (!building) {
            container.innerHTML = `
                <div class="page-enter">
                    <button class="back-btn" onclick="window.location.hash='#buildings'">← Back to Buildings</button>
                    <div class="empty-state"><h3>Building not found</h3></div>
                </div>
            `;
            return;
        }

        const [flats, donations] = await Promise.all([
            fetchFlats(building.id),
            fetchDonations(building.id, year)
        ]);

        const flatData = flats.map(flat => {
            const donation = donations.find(d => d.flat_id === flat.id);
            return { flat, donation: donation || null };
        });

        const donated = flatData.filter(f => f.donation?.donated).length;
        const totalAmount = flatData.reduce((sum, f) => sum + (f.donation?.donated ? parseFloat(f.donation.amount) || 0 : 0), 0);
        const percent = Math.round((donated / 16) * 100);

        container.innerHTML = `
            <div class="page-enter">
                <button class="back-btn" id="back-to-buildings">← Back to Buildings</button>
                <div class="page-header">
                    <h1><span class="header-icon">${getBuildingIcon(buildingName)}</span> ${escapeHtml(buildingName)}</h1>
                </div>

                <div class="building-summary">
                    <div class="summary-card">
                        <div class="summary-value">${formatCurrency(totalAmount)}</div>
                        <div class="summary-label">Total Collected</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${donated}/16</div>
                        <div class="summary-label">Donations Received</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${16 - donated}</div>
                        <div class="summary-label">Pending</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${percent}%</div>
                        <div class="summary-label">Collection Rate</div>
                    </div>
                </div>

                <div class="flats-table-wrapper">
                    <table class="flats-table">
                        <thead>
                            <tr>
                                <th>Flat</th>
                                <th>Owner Name</th>
                                <th>Status</th>
                                <th>Amount</th>
                                <th class="hide-mobile">Transaction</th>
                                <th class="hide-mobile">Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${flatData.map(({ flat, donation }) => {
                                const d = donation || {};
                                const isDonated = d.donated === true;
                                return `
                                    <tr data-flat-id="${flat.id}">
                                        <td class="flat-number">${escapeHtml(flat.flat_number)}</td>
                                        <td class="owner-name ${!d.owner_name ? 'empty' : ''}">${d.owner_name ? escapeHtml(d.owner_name) : 'Not assigned'}</td>
                                        <td>
                                            <span class="badge ${isDonated ? 'badge-success' : 'badge-pending'}">
                                                <span class="badge-dot"></span>
                                                ${isDonated ? 'Donated' : 'Pending'}
                                            </span>
                                        </td>
                                        <td class="amount-cell ${!isDonated ? 'empty' : ''}">${isDonated ? formatCurrency(d.amount) : '—'}</td>
                                        <td class="transaction-type hide-mobile">${isDonated && d.transaction_type ? escapeHtml(d.transaction_type) : '—'}</td>
                                        <td class="hide-mobile">${isDonated ? formatDate(d.date_given) : '—'}</td>
                                        <td>
                                            <div style="display: flex; gap: 0.375rem;">
                                                <button class="btn-edit btn-edit-flat" data-flat-id="${flat.id}" data-flat-number="${escapeHtml(flat.flat_number)}">
                                                    ✏️ Edit
                                                </button>
                                                ${d.id ? `
                                                    <button class="btn-edit btn-del-flat" data-flat-id="${flat.id}" style="background: var(--error-light); color: var(--error); border-color: var(--error-border);" title="Clear donation record">
                                                        🗑️ Reset
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.querySelector('#back-to-buildings').addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = '#buildings';
        });

        container.querySelectorAll('.btn-edit-flat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const flatId = btn.dataset.flatId;
                const fd = flatData.find(f => f.flat.id === flatId);
                openEditModal(building, fd.flat, fd.donation, year, () => {
                    renderBuildingDetail(container, buildingName, year);
                });
            });
        });

        container.querySelectorAll('.btn-del-flat').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const flatId = btn.dataset.flatId;
                if (confirm('Are you sure you want to reset/clear donation record for this flat?')) {
                    try {
                        await deleteDonation(flatId, year);
                        showToast('Flat record cleared');
                        renderBuildingDetail(container, buildingName, year);
                    } catch (err) {
                        showToast('Error resetting flat: ' + err.message, 'error');
                    }
                }
            });
        });

    } catch (err) {
        console.error('Building detail error:', err);
        container.innerHTML = `<div class="empty-state"><h3>Failed to load building data</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
}

function openEditModal(building, flat, donation, year, onSave) {
    const overlay = document.getElementById('edit-modal-overlay');
    const d = donation || {};

    document.getElementById('edit-modal-title').textContent = `${flat.flat_number} — ${building.name}`;
    document.getElementById('edit-owner-name').value = d.owner_name || '';
    document.getElementById('edit-donated-yes').checked = d.donated === true;
    document.getElementById('edit-donated-no').checked = d.donated !== true;
    document.getElementById('edit-amount').value = d.donated ? (d.amount || '') : '';
    document.getElementById('edit-transaction-type').value = d.transaction_type || '';
    document.getElementById('edit-date-given').value = d.date_given || '';

    toggleDonationFields(d.donated === true);
    overlay.classList.add('active');

    const yesRadio = document.getElementById('edit-donated-yes');
    const noRadio = document.getElementById('edit-donated-no');
    const radioHandler = () => toggleDonationFields(yesRadio.checked);
    yesRadio.onchange = radioHandler;
    noRadio.onchange = radioHandler;

    const saveBtn = document.getElementById('edit-save-btn');
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.onclick = async () => {
        const ownerName = normalizeOwnerName(document.getElementById('edit-owner-name').value);
        const donated = document.getElementById('edit-donated-yes').checked;
        const amount = document.getElementById('edit-amount').value;
        const transactionType = document.getElementById('edit-transaction-type').value;
        const dateGiven = document.getElementById('edit-date-given').value;

        if (donated && (!amount || parseFloat(amount) <= 0)) {
            showToast('Please enter a valid amount', 'error');
            return;
        }

        newBtn.disabled = true;
        newBtn.textContent = 'Saving...';

        try {
            await upsertDonation(flat.id, building.id, year, {
                ownerName,
                donated,
                amount: donated ? parseFloat(amount) : 0,
                transactionType: donated ? transactionType : '',
                dateGiven: donated ? dateGiven : null
            });

            showToast('Flat details saved!');
            closeEditModal();
            if (onSave) onSave();
        } catch (err) {
            showToast('Failed to save: ' + err.message, 'error');
        } finally {
            newBtn.disabled = false;
            newBtn.textContent = 'Save Changes';
        }
    };

    const closeHandler = () => closeEditModal();
    document.getElementById('edit-cancel-btn').onclick = closeHandler;
    document.getElementById('edit-modal-close').onclick = closeHandler;
    overlay.onclick = (e) => { if (e.target === overlay) closeHandler(); };
}

function toggleDonationFields(isDonated) {
    const amountField = document.getElementById('edit-amount');
    const typeField = document.getElementById('edit-transaction-type');
    const dateField = document.getElementById('edit-date-given');

    amountField.disabled = !isDonated;
    typeField.disabled = !isDonated;
    dateField.disabled = !isDonated;

    if (!isDonated) {
        amountField.value = '';
        typeField.value = '';
        dateField.value = '';
    }
}

function closeEditModal() {
    document.getElementById('edit-modal-overlay').classList.remove('active');
}

export function clearBuildingsCache() {
    buildingsCache = null;
}
