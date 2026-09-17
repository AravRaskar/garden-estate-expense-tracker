// ============================================
// Dashboard / Analytics Module (Chart.js Interactive)
// ============================================

import { fetchBuildings, fetchAllDonations, fetchIndividuals, fetchExpenses, fetchPublicPortalAccessLogs } from './supabase.js';
import { formatCurrency, getBuildingIcon, getProgressColor, escapeHtml } from './utils.js';
import { icon } from './icons.js';

let chartInstances = {};

export function destroyCharts() {
    Object.values(chartInstances).forEach(c => {
        try { c?.destroy(); } catch (e) {}
    });
    chartInstances = {};
}

export async function renderDashboard(container, year) {
    // Destroy previous chart instances if re-rendering
    destroyCharts();

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1><span class="header-icon">${icon('dashboard')}</span> Analytics & Dashboard</h1>
            </div>
            <div class="loading-spinner"><div class="spinner-ring"></div></div>
        </div>
    `;

    try {
        const [buildings, donations, individuals, expenses, publicPortalAccessLogs] = await Promise.all([
            fetchBuildings(),
            fetchAllDonations(year),
            fetchIndividuals(year),
            fetchExpenses(year),
            fetchPublicPortalAccessLogs().catch(() => [])
        ]);

        const buildingCollection = donations.reduce((sum, d) => sum + (d.donated ? parseFloat(d.amount) || 0 : 0), 0);
        const individualCollection = individuals.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
        const totalCollection = buildingCollection + individualCollection;
        const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const netBalance = totalCollection - totalExpenses;

        // Per-building breakdown (Tulip has 8 flats, others have 16)
        const buildingStats = buildings.map(b => {
            const totalFlatsCount = b.name === 'Tulip' ? 8 : 16;
            const bDonations = donations.filter(d => d.building_id === b.id);
            const donated = bDonations.filter(d => d.donated).length;
            const amount = bDonations.reduce((sum, d) => sum + (d.donated ? parseFloat(d.amount) || 0 : 0), 0);
            const percent = Math.round((donated / totalFlatsCount) * 100);
            return { ...b, donated, amount, percent, totalFlatsCount };
        });

        const totalFlats = buildingStats.reduce((sum, b) => sum + b.totalFlatsCount, 0); // 136 total flats
        const totalDonatedFlats = donations.filter(d => d.donated).length;
        const collectionRate = totalFlats > 0 ? Math.round((totalDonatedFlats / totalFlats) * 100) : 0;

        // Expenses category map
        const expenseCategoryMap = {};
        expenses.forEach(e => {
            const category = (e.spent_on || '').trim() || 'General Operations';
            expenseCategoryMap[category] = (expenseCategoryMap[category] || 0) + (parseFloat(e.amount) || 0);
        });

        // Transaction modes breakdown
        const txModeMap = {};
        donations.forEach(d => {
            if (d.donated && d.transaction_type) {
                txModeMap[d.transaction_type] = (txModeMap[d.transaction_type] || 0) + (parseFloat(d.amount) || 0);
            }
        });
        individuals.forEach(i => {
            if (i.transaction_type) {
                txModeMap[i.transaction_type] = (txModeMap[i.transaction_type] || 0) + (parseFloat(i.amount) || 0);
            }
        });

        container.innerHTML = `
            <div class="page-enter">
                <div class="page-header">
                    <h1><span class="header-icon">${icon('dashboard')}</span> Analytics & Dashboard (${year})</h1>
                </div>

                <!-- Global Financial KPIs -->
                <div class="kpi-grid">
                    <div class="kpi-card kpi-total">
                        <div class="kpi-header">
                            <span class="kpi-label">Total Collection</span>
                            <div class="kpi-icon">${icon('wallet')}</div>
                        </div>
                        <div class="kpi-value">${formatCurrency(totalCollection)}</div>
                        <div class="kpi-sub">Buildings (₹${(buildingCollection/1000).toFixed(1)}k) + Ind. (₹${(individualCollection/1000).toFixed(1)}k)</div>
                    </div>
                    <div class="kpi-card kpi-pending" style="border-top-color: var(--error);">
                        <div class="kpi-header">
                            <span class="kpi-label">Total Expenses</span>
                            <div class="kpi-icon">${icon('receipt')}</div>
                        </div>
                        <div class="kpi-value" style="color: var(--error);">${formatCurrency(totalExpenses)}</div>
                        <div class="kpi-sub">${expenses.length} expense logs</div>
                    </div>
                    <div class="kpi-card ${netBalance >= 0 ? 'kpi-received' : 'kpi-pending'}">
                        <div class="kpi-header">
                            <span class="kpi-label">Net Surplus / Balance</span>
                            <div class="kpi-icon">${icon('scale')}</div>
                        </div>
                        <div class="kpi-value" style="color: ${netBalance >= 0 ? 'var(--success)' : 'var(--error)'};">
                            ${formatCurrency(netBalance)}
                        </div>
                        <div class="kpi-sub">${netBalance >= 0 ? 'Positive Balance' : 'Deficit'}</div>
                    </div>
                    <div class="kpi-card kpi-flats">
                        <div class="kpi-header">
                            <span class="kpi-label">Flat Collection Rate</span>
                            <div class="kpi-icon">${icon('home')}</div>
                        </div>
                        <div class="kpi-value">${collectionRate}%</div>
                        <div class="kpi-sub">${totalDonatedFlats} of ${totalFlats} flats</div>
                    </div>
                </div>

                <!-- Interactive Charts Row 1: Collection vs Expenses + Expense Pie Chart -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <!-- Collection vs Expenditure Bar Chart -->
                    <div class="chart-section" style="margin-top: 0; padding: 1.5rem;">
                        <h3 style="margin-bottom: 1rem;">${icon('scale')} Collection vs Expenditure</h3>
                        <div style="height: 260px; position: relative;">
                            <canvas id="chart-income-vs-expense"></canvas>
                        </div>
                    </div>

                    <!-- Expenses Breakdown Donut Chart -->
                    <div class="chart-section" style="margin-top: 0; padding: 1.5rem;">
                        <h3 style="margin-bottom: 1rem;">${icon('dashboard')} Expenses Breakdown</h3>
                        <div style="height: 260px; position: relative;">
                            <canvas id="chart-expenses-pie"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Interactive Charts Row 2: Building Collection Bar + Payment Mode Donut -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <!-- Collection by Building Bar Chart -->
                    <div class="chart-section" style="margin-top: 0; padding: 1.5rem; flex: 2;">
                        <h3 style="margin-bottom: 1rem;">${icon('building')} Collection by Building & Individuals</h3>
                        <div style="height: 300px; position: relative;">
                            <canvas id="chart-building-collection"></canvas>
                        </div>
                    </div>

                    <!-- Payment Mode Breakdown -->
                    <div class="chart-section" style="margin-top: 0; padding: 1.5rem; flex: 1;">
                        <h3 style="margin-bottom: 1rem;">${icon('creditCard')} Collection by Payment Type</h3>
                        <div style="height: 300px; position: relative;">
                            <canvas id="chart-payment-types"></canvas>
                        </div>
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
                                    <div class="building-flats-count">${b.totalFlatsCount} Flats</div>
                                </div>
                            </div>
                            <div class="building-stats">
                                <div class="stat">
                                    <div class="stat-value">${formatCurrency(b.amount)}</div>
                                    <div class="stat-label">Collected</div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value">${b.donated}/${b.totalFlatsCount}</div>
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

                <section class="chart-section" style="margin-top: 2rem; padding: 1.5rem;">
                    <div class="section-heading" style="margin-bottom: 1rem;">
                        <div>
                            <h2 style="font-size: 1.1rem;">${icon('user')} Public dashboard access</h2>
                            <p class="text-muted text-sm">Most recent residents who opened the public financial dashboard.</p>
                        </div>
                    </div>
                    ${publicPortalAccessLogs.length ? `
                        <div class="flats-table-wrapper">
                            <table class="flats-table">
                                <thead><tr><th>Selected resident</th><th>Unit</th><th>Accessed</th></tr></thead>
                                <tbody>
                                    ${publicPortalAccessLogs.map(log => `
                                        <tr>
                                            <td style="font-weight: 600;">${escapeHtml(log.selected_name)}</td>
                                            <td>${escapeHtml(log.selected_unit || '—')}</td>
                                            <td class="text-muted">${formatAccessDate(log.accessed_at)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="text-muted text-sm">No public dashboard access has been recorded yet.</p>'}
                </section>
            </div>
        `;

        // Initialize Chart.js charts
        initCharts({
            totalCollection,
            totalExpenses,
            buildingStats,
            individualCollection,
            expenseCategoryMap,
            txModeMap
        });

        // Building card click listeners
        container.querySelectorAll('.building-card').forEach(card => {
            card.addEventListener('click', () => {
                const name = card.dataset.buildingName;
                if (window.navigateTo) {
                    window.navigateTo(`/buildings/${encodeURIComponent(name)}`);
                } else {
                    window.location.pathname = `/buildings/${encodeURIComponent(name)}`;
                }
            });
        });

    } catch (err) {
        console.error('Dashboard error:', err);
        container.innerHTML = `<div class="empty-state"><h3>Failed to load dashboard</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
}

function formatAccessDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function initCharts({ totalCollection, totalExpenses, buildingStats, individualCollection, expenseCategoryMap, txModeMap }) {
    if (typeof Chart === 'undefined') return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(226, 232, 240, 0.7)';
    const tickColor = isDark ? '#88a39a' : '#64748b';
    const xTickColor = isDark ? '#cbdad4' : '#475569';
    const doughnutBorder = isDark ? '#0e1715' : '#ffffff';

    const commonTooltip = {
        backgroundColor: isDark ? '#14201d' : '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#f8fafc',
        titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '600' },
        bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
        padding: 10,
        cornerRadius: 6,
        borderColor: isDark ? '#243631' : '#334155',
        borderWidth: 1
    };

    // Chart 1: Collection vs Expenditure (Bar)
    const ctxIncomeExpense = document.getElementById('chart-income-vs-expense')?.getContext('2d');
    if (ctxIncomeExpense) {
        chartInstances.incomeExpense = new Chart(ctxIncomeExpense, {
            type: 'bar',
            data: {
                labels: ['Total Income', 'Total Expenses', 'Net Balance'],
                datasets: [{
                    label: 'Amount (₹)',
                    data: [totalCollection, totalExpenses, Math.max(0, totalCollection - totalExpenses)],
                    backgroundColor: [
                        'rgba(15, 89, 72, 0.9)',   // Pine
                        'rgba(185, 28, 28, 0.9)',  // Terracotta
                        'rgba(21, 128, 61, 0.9)'   // Forest Emerald
                    ],
                    borderColor: ['#0f5948', '#b91c1c', '#15803d'],
                    borderWidth: 1.5,
                    borderRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        ...commonTooltip,
                        callbacks: {
                            label: (ctx) => ` ₹${ctx.raw.toLocaleString('en-IN')}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }, color: xTickColor }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: gridColor },
                        ticks: {
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
                            color: tickColor,
                            callback: (val) => '₹' + (val >= 1000 ? (val/1000) + 'k' : val)
                        }
                    }
                }
            }
        });
    }

    // Chart 2: Expenses Breakdown (Doughnut Chart)
    const ctxExpenses = document.getElementById('chart-expenses-pie')?.getContext('2d');
    if (ctxExpenses) {
        const expLabels = Object.keys(expenseCategoryMap);
        const expValues = Object.values(expenseCategoryMap);
        const refinedColors = [
            '#0f5948', '#b45309', '#1d4ed8', '#7c3aed', '#b91c1c',
            '#0284c7', '#15803d', '#c026d3', '#ea580c', '#475569'
        ];

        chartInstances.expensesPie = new Chart(ctxExpenses, {
            type: 'doughnut',
            data: {
                labels: expLabels.length > 0 ? expLabels : ['No Expenses Yet'],
                datasets: [{
                    data: expValues.length > 0 ? expValues : [1],
                    backgroundColor: expValues.length > 0 ? refinedColors.slice(0, expLabels.length) : ['#e2e8f0'],
                    borderWidth: 2,
                    borderColor: doughnutBorder,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
                            color: tickColor
                        }
                    },
                    tooltip: {
                        ...commonTooltip,
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ₹${ctx.raw.toLocaleString('en-IN')}`
                        }
                    }
                }
            }
        });
    }

    // Chart 3: Collection by Building & Individuals (Bar Chart)
    const ctxBuilding = document.getElementById('chart-building-collection')?.getContext('2d');
    if (ctxBuilding) {
        const sortedItems = [
            ...buildingStats.map(b => ({ label: b.name, amount: b.amount })),
            { label: 'Individuals', amount: individualCollection }
        ].sort((a, b) => b.amount - a.amount);

        const bLabels = sortedItems.map(i => i.label);
        const bValues = sortedItems.map(i => i.amount);

        chartInstances.buildingCollection = new Chart(ctxBuilding, {
            type: 'bar',
            data: {
                labels: bLabels,
                datasets: [{
                    label: 'Collection (₹)',
                    data: bValues,
                    backgroundColor: bLabels.map(l => l === 'Individuals' ? 'rgba(180, 83, 9, 0.9)' : 'rgba(15, 89, 72, 0.9)'),
                    borderColor: bLabels.map(l => l === 'Individuals' ? '#b45309' : '#0f5948'),
                    borderWidth: 1.5,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        ...commonTooltip,
                        callbacks: {
                            label: (ctx) => ` Collected: ₹${ctx.raw.toLocaleString('en-IN')}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '500' }, color: xTickColor }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: gridColor },
                        ticks: {
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
                            color: tickColor,
                            callback: (val) => '₹' + (val >= 1000 ? (val/1000) + 'k' : val)
                        }
                    }
                }
            }
        });
    }

    // Chart 4: Payment Types Breakdown (Doughnut Chart)
    const ctxPayment = document.getElementById('chart-payment-types')?.getContext('2d');
    if (ctxPayment) {
        const payLabels = Object.keys(txModeMap);
        const payValues = Object.values(txModeMap);
        const modeColors = {
            'UPI': '#1d4ed8',
            'Cash': '#15803d',
            'Bank Transfer': '#7c3aed',
            'Cheque': '#b45309',
            'Other': '#475569'
        };

        chartInstances.paymentTypes = new Chart(ctxPayment, {
            type: 'doughnut',
            data: {
                labels: payLabels.length > 0 ? payLabels : ['No Payments Yet'],
                datasets: [{
                    data: payValues.length > 0 ? payValues : [1],
                    backgroundColor: payLabels.length > 0 ? payLabels.map(l => modeColors[l] || '#0f5948') : ['#e2e8f0'],
                    borderWidth: 2,
                    borderColor: doughnutBorder,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 10,
                            padding: 8,
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
                            color: tickColor
                        }
                    },
                    tooltip: {
                        ...commonTooltip,
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ₹${ctx.raw.toLocaleString('en-IN')}`
                        }
                    }
                }
            }
        });
    }
}
