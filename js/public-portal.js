// ============================================
// Public Portal Module: QR Code Accessible
// Strict Read-Only Mode for Society Residents
// ============================================

import {
    fetchBuildings,
    fetchTimetables,
    getDistinctYears
} from './supabase.js';
import {
    formatCurrency,
    formatDate,
    escapeHtml,
    getCurrentYear
} from './utils.js';
import { icon } from './icons.js';

let publicYear = getCurrentYear();
let cachedData = null;

/**
 * Render the entire public portal into the specified container
 */
export async function renderPublicPortal(container, year = null) {
    if (year) publicYear = year;

    container.innerHTML = `
        <div class="public-portal page-enter">
            <div class="loading-spinner"><div class="spinner-ring"></div></div>
        </div>
    `;

    try {
        const { getSupabase } = await import('./supabase.js');

        // Parallel fetch for public data (read-only)
        const [buildings, { data: donations }, { data: individuals }, timetables] = await Promise.all([
            fetchBuildings().catch(() => []),
            getSupabase()
                .from('donations')
                .select(`
                    id, owner_name, donated, amount, transaction_type, date_given,
                    buildings ( id, name ),
                    flats ( id, flat_number )
                `)
                .eq('year', publicYear)
                .eq('donated', true)
                .order('owner_name'),
            getSupabase()
                .from('individuals')
                .select('id, name, amount, transaction_type, date_given')
                .eq('year', publicYear)
                .order('name'),
            fetchTimetables(publicYear).catch(() => [])
        ]);

        const paidDonations = donations || [];
        const paidIndividuals = individuals || [];
        const buildingCollection = paidDonations.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
        const indCollection = paidIndividuals.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const totalCollection = buildingCollection + indCollection;
        const totalFlatsCount = 136; // 8 buildings * 16 + 1 building * 8

        cachedData = {
            paidDonations,
            paidIndividuals,
            timetables,
            totalCollection,
            buildingCollection,
            indCollection,
            totalFlatsCount
        };

        // Combine all paid donors for the single dropdown
        const donorList = [];

        paidDonations.forEach(d => {
            const bName = d.buildings?.name || 'Building';
            const fNum = d.flats?.flat_number || 'Flat';
            const name = d.owner_name ? d.owner_name : `${bName} ${fNum}`;
            donorList.push({
                type: 'building',
                id: d.id,
                name: name,
                label: `${name} (${bName}, ${fNum})`,
                sub: `${bName}, ${fNum}`,
                amount: d.amount,
                paymentMode: d.transaction_type || 'Confirmed',
                date: d.date_given
            });
        });

        paidIndividuals.forEach(i => {
            donorList.push({
                type: 'individual',
                id: i.id,
                name: i.name,
                label: `${i.name} (Individual Contributor)`,
                sub: `Individual Contributor`,
                amount: i.amount,
                paymentMode: i.transaction_type || 'Confirmed',
                date: i.date_given
            });
        });

        // Sort alphabetically by name
        donorList.sort((a, b) => a.name.localeCompare(b.name));

        const percent = Math.min(100, Math.round((paidDonations.length / totalFlatsCount) * 100));

        container.innerHTML = `
            <div class="public-portal page-enter">
                <!-- Public Header -->
                <header class="public-header">
                    <div class="public-brand">
                        <div class="public-logo" id="modak-logo-public" title="Click for a Modak blessing!">${icon('modak', 'ui-icon-brand')}</div>
                        <div>
                            <h1>Modak</h1>
                            <p class="text-muted text-sm">Garden Estate • Festival & Society Fund ${publicYear}</p>
                        </div>
                    </div>
                    <div class="public-header-actions">
                        <button class="btn btn-secondary btn-sm" id="btn-theme-toggle-public" title="Toggle theme" aria-label="Toggle theme"></button>
                        <span class="badge badge-success">
                            <span class="badge-dot"></span> Verified Society Fund
                        </span>
                    </div>
                </header>

                <!-- Hero Collection Status -->
                <section class="public-hero-card">
                    <div class="hero-stats">
                        <div class="hero-stat-primary">
                            <div class="hero-label">Total Society Fund Raised</div>
                            <div class="hero-amount">${formatCurrency(totalCollection)}</div>
                            <div class="hero-meta">
                                <span>${icon('building', 'ui-icon-sm')} Buildings: ${formatCurrency(buildingCollection)}</span>
                                <span>•</span>
                                <span>${icon('user', 'ui-icon-sm')} Individuals: ${formatCurrency(indCollection)}</span>
                            </div>
                        </div>
                        <div class="hero-stat-flats">
                            <div class="hero-flats-count">${paidDonations.length} / ${totalFlatsCount}</div>
                            <div class="hero-label">Flats Contributed (${percent}%)</div>
                            <div class="progress-bar" style="margin-top: 0.5rem; height: 8px;">
                                <div class="progress-fill green" style="width: ${percent}%;"></div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Interactive Pop-up / Dropdown Form Section -->
                <section class="public-contributor-section">
                    <div class="contributor-card">
                        <div class="contributor-header">
                            <div class="contributor-icon">${icon('fileText')}</div>
                            <div>
                                <h2>Paid Contributors Directory</h2>
                                <p class="text-muted text-sm">Select any donor or flat to view confirmed contribution receipt</p>
                            </div>
                        </div>

                        <div class="form-group" style="margin-top: 1rem;">
                            <label for="donor-dropdown" style="font-weight: 700; color: var(--slate-800);">
                                Search & Select Contributor (${donorList.length} verified):
                            </label>
                            <select id="donor-dropdown" class="public-select">
                                <option value="">-- Select name from list (${donorList.length} donors) --</option>
                                ${donorList.map((d, idx) => `
                                    <option value="${idx}">${escapeHtml(d.label)}</option>
                                `).join('')}
                            </select>
                        </div>

                        <!-- Verified Contribution Display Box -->
                        <div id="verified-receipt-box" class="verified-box" style="display: none;">
                            <div class="verified-badge">
                                <span class="badge-check">${icon('checkCircle')}</span>
                                <span>Confirmed Contribution</span>
                            </div>
                            <div class="verified-grid">
                                <div>
                                    <span class="v-label">Contributor Name</span>
                                    <h3 id="v-name" class="v-value">-</h3>
                                </div>
                                <div>
                                    <span class="v-label">Allocation / Unit</span>
                                    <div id="v-unit" class="v-value">-</div>
                                </div>
                                <div>
                                    <span class="v-label">Amount Paid</span>
                                    <div id="v-amount" class="v-amount-highlight">-</div>
                                </div>
                                <div>
                                    <span class="v-label">Mode & Date</span>
                                    <div id="v-mode" class="v-value">-</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Event Schedule / Timetables Section -->
                ${timetables.length > 0 ? `
                    <section class="public-timetables-section">
                        <div class="section-heading">
                            <h2>${icon('calendar')} Event Schedule & Timetable</h2>
                            <p class="text-muted text-sm">Daily celebration programs and timings</p>
                        </div>
                        <div class="public-timetables-grid">
                            ${timetables.map(t => `
                                <div class="public-tt-card" data-url="${escapeHtml(t.image_url)}" data-title="${escapeHtml(t.title)}">
                                    <div class="public-tt-img-wrap">
                                        <img src="${escapeHtml(t.image_url)}" alt="${escapeHtml(t.title)}" loading="lazy">
                                    </div>
                                    <div class="public-tt-info">
                                        <h4>${escapeHtml(t.title)}</h4>
                                        <span class="text-muted text-xs">${icon('calendar', 'ui-icon-sm')} ${formatDate(t.event_date)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}

                <!-- Transparency List Tabs -->
                <section class="public-list-section">
                    <div class="section-heading" style="margin-bottom: 1rem;">
                        <h2>${icon('building')} Verified Contributors List</h2>
                        <input type="text" id="public-search-filter" class="search-input" placeholder="Quick filter by name or flat number..." aria-label="Quick filter by name or flat number" style="max-width: 320px; margin-top: 0.5rem;">
                    </div>
                    <div class="flats-table-wrapper">
                        <table class="flats-table" id="public-table">
                            <thead>
                                <tr>
                                    <th>Contributor</th>
                                    <th>Unit / Type</th>
                                    <th>Amount</th>
                                    <th class="hide-mobile">Payment Mode</th>
                                    <th class="hide-mobile">Date</th>
                                </tr>
                            </thead>
                            <tbody id="public-table-body">
                                ${donorList.map(d => `
                                    <tr class="donor-row" data-text="${escapeHtml(d.name.toLowerCase())} ${escapeHtml(d.sub.toLowerCase())}">
                                        <td style="font-weight: 600; color: var(--slate-900);">${escapeHtml(d.name)}</td>
                                        <td><span class="badge badge-success" style="font-size: 0.7rem;">${escapeHtml(d.sub)}</span></td>
                                        <td class="amount-cell" style="color: var(--primary-700);">${formatCurrency(d.amount)}</td>
                                        <td class="hide-mobile text-muted">${escapeHtml(d.paymentMode)}</td>
                                        <td class="hide-mobile text-muted">${formatDate(d.date)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- Footer -->
                <footer class="public-footer">
                    <p>Modak Expense Tracker • Managed by Garden Estate Society Committee</p>
                </footer>
            </div>
        `;

        // Attach event handlers
        setupDropdownEvents(donorList);
        setupSearchFilter();
        setupImageModalHandlers();

    } catch (err) {
        console.error('Failed to load public portal:', err);
        container.innerHTML = `
            <div class="public-portal page-enter">
                <div class="empty-state">
                    <div class="empty-icon">${icon('alert', 'ui-icon-xl')}</div>
                    <h2>Unable to load portal</h2>
                    <p class="text-muted">${escapeHtml(err.message)}</p>
                    <button class="btn btn-primary" onclick="window.location.reload()" style="margin-top: 1rem;">Try Again</button>
                </div>
            </div>
        `;
    }
}

function setupDropdownEvents(donorList) {
    const select = document.getElementById('donor-dropdown');
    const box = document.getElementById('verified-receipt-box');
    const nameEl = document.getElementById('v-name');
    const unitEl = document.getElementById('v-unit');
    const amountEl = document.getElementById('v-amount');
    const modeEl = document.getElementById('v-mode');

    if (!select || !box) return;

    select.addEventListener('change', (e) => {
        const idx = e.target.value;
        if (idx === '' || !donorList[idx]) {
            box.style.display = 'none';
            return;
        }

        const d = donorList[idx];
        nameEl.textContent = d.name;
        unitEl.textContent = d.sub;
        amountEl.textContent = formatCurrency(d.amount);
        modeEl.textContent = `${d.paymentMode} on ${formatDate(d.date)}`;

        box.style.display = 'block';
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

function setupSearchFilter() {
    const input = document.getElementById('public-search-filter');
    const rows = document.querySelectorAll('.donor-row');

    if (!input) return;

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        rows.forEach(row => {
            const text = row.dataset.text || '';
            row.style.display = text.includes(query) ? '' : 'none';
        });
    });
}

function setupImageModalHandlers() {
    const cards = document.querySelectorAll('.public-tt-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const url = card.dataset.url;
            const title = card.dataset.title;
            const overlay = document.getElementById('image-modal-overlay');
            const img = document.getElementById('img-modal-src');
            const titleEl = document.getElementById('img-modal-title');

            if (overlay && img) {
                img.src = url;
                if (titleEl) titleEl.textContent = title || '';
                overlay.classList.add('active');

                const close = () => overlay.classList.remove('active');
                document.getElementById('img-modal-close').onclick = close;
                overlay.onclick = (e) => { if (e.target === overlay) close(); };
            }
        });
    });
}
