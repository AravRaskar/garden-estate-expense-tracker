// ============================================
// Dashboard / Analytics Module
// ============================================

import { fetchBuildings, fetchAllDonations, fetchIndividuals, fetchExpenses } from './supabase.js';
import { formatCurrency, getBuildingIcon, getProgressColor, getTransactionClass, escapeHtml } from './utils.js';

export async function renderDashboard(container, year) {
    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1><span class="header-icon">📊</span> Analytics & Dashboard</h1>
            </div>
            <div class="loading-spinner"><div class="spinner-ring"></div></div>
        </div>
    `;

    try {
        const [buildings, donations, individuals, expenses] = await Promise.all([
            fetchBuildings(),
            fetchAllDonations(year),
            fetchIndividuals(year),
            fetchExpenses(year)
        ]);

        const buildingCollection = donations.reduce((sum, d) => sum + (d.donated ? parseFloat(d.amount) || 0 : 0), 0);
        const individualCollection = individuals.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
        const totalCollection = buildingCollection + individualCollection;
        const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const netBalance = totalCollection - totalExpenses;

        const totalFlats = buildings.length * 16;
        const totalDonatedFlats = donations.filter(d => d.donated).length;
        const totalPendingFlats = totalFlats - totalDonatedFlats;
        const collectionRate = totalFlats > 0 ? Math.round((totalDonatedFlats / totalFlats) * 100) : 0;

        // Per-building breakdown
        const buildingStats = buildings.map(b => {
            const bDonations = donations.filter(d => d.building_id === b.id);
            const donated = bDonations.filter(d => d.donated).length;
            const amount = bDonations.reduce((sum, d) => sum + (d.donated ? parseFloat(d.amount) || 0 : 0), 0);
            const percent = Math.round((donated / 16) * 100);
            return { ...b, donated, amount, percent };
        });

        // Expenses breakdown by purpose/spent_on
        const expenseCategoryMap = {};
        expenses.forEach(e => {
            const category = e.spent_on.trim() || 'General';
            expenseCategoryMap[category] = (expenseCategoryMap[category] || 0) + (parseFloat(e.amount) || 0);
        });

        container.innerHTML = `
            <div class="page-enter">
                <div class="page-header">
                    <h1><span class="header-icon">📊</span> Analytics & Dashboard (${year})</h1>
                </div>

                <!-- Global Financial KPIs -->
                <div class="kpi-grid">
                    <div class="kpi-card kpi-total">
                        <div class="kpi-header">
                            <span class="kpi-label">Total Collection</span>
                            <div class="kpi-icon">💰</div>
                        </div>
                        <div class="kpi-value">${formatCurrency(totalCollection)}</div>
                        <div class="kpi-sub">Buildings (₹${(buildingCollection/1000).toFixed(1)}k) + Ind. (₹${(individualCollection/1000).toFixed(1)}k)</div>
                    </div>
                    <div class="kpi-card kpi-pending" style="border-top-color: var(--error);">
                        <div class="kpi-header">
                            <span class="kpi-label">Total Expenses</span>
                            <div class="kpi-icon">💸</div>
                        </div>
                        <div class="kpi-value" style="color: var(--error);">${formatCurrency(totalExpenses)}</div>
                        <div class="kpi-sub">${expenses.length} expense logs</div>
                    </div>
                    <div class="kpi-card ${netBalance >= 0 ? 'kpi-received' : 'kpi-pending'}">
                        <div class="kpi-header">
                            <span class="kpi-label">Net Surplus / Balance</span>
                            <div class="kpi-icon">⚖️</div>
                        </div>
                        <div class="kpi-value" style="color: ${netBalance >= 0 ? 'var(--success)' : 'var(--error)'};">
                            ${formatCurrency(netBalance)}
                        </div>
                        <div class="kpi-sub">${netBalance >= 0 ? 'Positive balance' : 'Deficit'}</div>
                    </div>
                    <div class="kpi-card kpi-flats">
                        <div class="kpi-header">
                            <span class="kpi-label">Flat Collection Rate</span>
                            <div class="kpi-icon">🏠</div>
                        </div>
                        <div class="kpi-value">${collectionRate}%</div>
                        <div class="kpi-sub">${totalDonatedFlats} of ${totalFlats} flats</div>
                    </div>
                </div>

                <!-- Financial Comparison & Expenses Pie Chart Row -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <!-- Collection vs Expenditure Visual -->
                    <div class="chart-section" style="margin-top: 0;">
                        <h3>⚖️ Collection vs Expenditure</h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span>Total Income (Collection)</span>
                                    <strong>${formatCurrency(totalCollection)}</strong>
                                </div>
                                <div class="progress-bar" style="height: 12px;">
                                    <div class="progress-fill green" style="width: 100%;"></div>
                                </div>
                            </div>
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <span>Total Expenses</span>
                                    <strong style="color: var(--error);">${formatCurrency(totalExpenses)}</strong>
                                </div>
                                <div class="progress-bar" style="height: 12px;">
                                    <div class="progress-fill red" style="width: ${totalCollection > 0 ? Math.min(100, Math.round((totalExpenses / totalCollection) * 100)) : 0}%;"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Expenses Breakdown Pie / Donut Visual -->
                    <div class="chart-section" style="margin-top: 0;">
                        <h3>📊 Expenses Breakdown</h3>
                        ${Object.keys(expenseCategoryMap).length === 0 ? `
                            <p class="text-muted text-sm" style="padding: 1rem 0;">No expenses recorded to build chart.</p>
                        ` : renderExpensePieChart(expenseCategoryMap, totalExpenses)}
                    </div>
                </div>

                <!-- Building Collection Breakdown Bar Chart -->
                <div class="chart-section" style="margin-bottom: 2rem;">
                    <h3>🏢 Collection by Building & Individuals</h3>
                    <div class="bar-chart" style="margin-top: 1rem;">
                        ${renderBuildingCollectionChart(buildingStats, individualCollection)}
                    </div>
                </div>

                <!-- Per-Building KPI Grid -->
                <h2 style="margin-bottom: 1rem;">Building Status Overview</h2>
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
        console.error('Dashboard error:', err);
        container.innerHTML = `<div class="empty-state"><h3>Failed to load dashboard</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
}

function renderBuildingCollectionChart(buildingStats, individualCollection) {
    const items = [
        ...buildingStats.map(b => ({ label: b.name, amount: b.amount, isBuilding: true })),
        { label: 'Individuals', amount: individualCollection, isBuilding: false }
    ].sort((a, b) => b.amount - a.amount);

    const maxAmount = Math.max(...items.map(i => i.amount), 1);

    return items.map(item => {
        const pct = Math.round((item.amount / maxAmount) * 100);
        return `
            <div class="bar-row">
                <div class="bar-label">${escapeHtml(item.label)}</div>
                <div class="bar-track">
                    <div class="bar-fill ${item.isBuilding ? 'upi' : 'cash'}" style="width: ${pct}%;">
                        ${pct > 15 ? formatCurrency(item.amount) : ''}
                    </div>
                </div>
                <div class="bar-value">${formatCurrency(item.amount)}</div>
            </div>
        `;
    }).join('');
}

function renderExpensePieChart(categoryMap, totalExpenses) {
    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#64748b'];
    const entries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

    let cumulativePercent = 0;
    const slices = entries.map(([category, amount], idx) => {
        const pct = (amount / totalExpenses) * 100;
        const color = colors[idx % colors.length];
        const start = cumulativePercent;
        cumulativePercent += pct;
        return { category, amount, pct, color, start, end: cumulativePercent };
    });

    // Create SVG Donut Chart
    let svgSegments = '';
    slices.forEach(slice => {
        const startAngle = (slice.start / 100) * 360;
        const endAngle = (slice.end / 100) * 360;

        const x1 = 50 + 40 * Math.cos((Math.PI * (startAngle - 90)) / 180);
        const y1 = 50 + 40 * Math.sin((Math.PI * (startAngle - 90)) / 180);
        const x2 = 50 + 40 * Math.cos((Math.PI * (endAngle - 90)) / 180);
        const y2 = 50 + 40 * Math.sin((Math.PI * (endAngle - 90)) / 180);

        const largeArcFlag = slice.pct > 50 ? 1 : 0;
        const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

        svgSegments += `<path d="${pathData}" fill="${slice.color}" />`;
    });

    return `
        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
            <svg viewBox="0 0 100 100" style="width: 140px; height: 140px; border-radius: 50%; transform: rotate(-90deg); flex-shrink: 0;">
                ${svgSegments}
                <circle cx="50" cy="50" r="24" fill="white" />
            </svg>
            <div style="flex: 1; min-width: 180px;">
                ${slices.map(s => `
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8125rem; margin-bottom: 0.375rem;">
                        <span style="display: flex; align-items: center; gap: 0.375rem;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${s.color}; display: inline-block;"></span>
                            ${escapeHtml(s.category)}
                        </span>
                        <strong>${formatCurrency(s.amount)} (${Math.round(s.pct)}%)</strong>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
