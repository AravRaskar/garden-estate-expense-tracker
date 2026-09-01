// ============================================
// Dashboard / Analytics Module (Chart.js Interactive)
// ============================================

import { fetchBuildings, fetchAllDonations, fetchIndividuals, fetchExpenses } from './supabase.js';
import { formatCurrency, getBuildingIcon, getProgressColor, escapeHtml } from './utils.js';

let chartInstances = {};

export async function renderDashboard(container, year) {
    // Destroy previous chart instances if re-rendering
    Object.values(chartInstances).forEach(c => c?.destroy());
    chartInstances = {};

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
            const category = e.spent_on.trim() || 'General Operations';
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
                        <div class="kpi-sub">${netBalance >= 0 ? 'Positive Balance' : 'Deficit'}</div>
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

                <!-- Interactive Charts Row 1: Collection vs Expenses + Expense Pie Chart -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <!-- Collection vs Expenditure Bar Chart -->
                    <div class="chart-section" style="margin-top: 0; padding: 1.5rem;">
                        <h3 style="margin-bottom: 1rem;">⚖️ Collection vs Expenditure</h3>
                        <div style="height: 260px; position: relative;">
                            <canvas id="chart-income-vs-expense"></canvas>
                        </div>
                    </div>

                    <!-- Expenses Breakdown Donut Chart -->
                    <div class="chart-section" style="margin-top: 0; padding: 1.5rem;">
                        <h3 style="margin-bottom: 1rem;">📊 Expenses Breakdown</h3>
                        <div style="height: 260px; position: relative;">
                            <canvas id="chart-expenses-pie"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Interactive Charts Row 2: Building Collection Bar + Payment Mode Donut -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <!-- Collection by Building Bar Chart -->
                    <div class="chart-section" style="margin-top: 0; padding: 1.5rem; flex: 2;">
                        <h3 style="margin-bottom: 1rem;">🏢 Collection by Building & Individuals</h3>
                        <div style="height: 300px; position: relative;">
                            <canvas id="chart-building-collection"></canvas>
                        </div>
                    </div>

                    <!-- Payment Mode Breakdown -->
                    <div class="chart-section" style="margin-top: 0; padding: 1.5rem; flex: 1;">
                        <h3 style="margin-bottom: 1rem;">💳 Collection by Payment Type</h3>
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
                window.location.hash = `#buildings/${encodeURIComponent(name)}`;
            });
        });

    } catch (err) {
        console.error('Dashboard error:', err);
        container.innerHTML = `<div class="empty-state"><h3>Failed to load dashboard</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
}

function initCharts({ totalCollection, totalExpenses, buildingStats, individualCollection, expenseCategoryMap, txModeMap }) {
    if (typeof Chart === 'undefined') return;

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
                        'rgba(13, 148, 136, 0.85)', // Teal
                        'rgba(239, 68, 68, 0.85)',   // Red
                        'rgba(34, 197, 94, 0.85)'    // Green
                    ],
                    borderColor: ['#0d9488', '#ef4444', '#22c55e'],
                    borderWidth: 2,
                    borderRadius: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ₹${ctx.raw.toLocaleString('en-IN')}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
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
        const vibrantColors = [
            '#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6',
            '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'
        ];

        chartInstances.expensesPie = new Chart(ctxExpenses, {
            type: 'doughnut',
            data: {
                labels: expLabels.length > 0 ? expLabels : ['No Expenses Yet'],
                datasets: [{
                    data: expValues.length > 0 ? expValues : [1],
                    backgroundColor: expValues.length > 0 ? vibrantColors.slice(0, expLabels.length) : ['#e2e8f0'],
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 14, font: { size: 12 } }
                    },
                    tooltip: {
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
                    backgroundColor: bLabels.map(l => l === 'Individuals' ? 'rgba(245, 158, 11, 0.85)' : 'rgba(20, 184, 166, 0.85)'),
                    borderColor: bLabels.map(l => l === 'Individuals' ? '#f59e0b' : '#0d9488'),
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` Collected: ₹${ctx.raw.toLocaleString('en-IN')}`
                        }
                    }
                },
                scales: {
                    x: { ticks: { font: { size: 11 } } },
                    y: {
                        beginAtZero: true,
                        ticks: {
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
            'UPI': '#3b82f6',
            'Cash': '#22c55e',
            'Bank Transfer': '#8b5cf6',
            'Cheque': '#f59e0b',
            'Other': '#64748b'
        };

        chartInstances.paymentTypes = new Chart(ctxPayment, {
            type: 'doughnut',
            data: {
                labels: payLabels.length > 0 ? payLabels : ['No Payments Yet'],
                datasets: [{
                    data: payValues.length > 0 ? payValues : [1],
                    backgroundColor: payLabels.length > 0 ? payLabels.map(l => modeColors[l] || '#06b6d4') : ['#e2e8f0'],
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ₹${ctx.raw.toLocaleString('en-IN')}`
                        }
                    }
                }
            }
        });
    }
}
