// ============================================
// Public Portal Module: QR Code Accessible
// ============================================

import { fetchExpenses, fetchTimetables, getSupabase, recordPublicPortalAccess } from './supabase.js';
import { formatCurrency, formatDate, escapeHtml, getCurrentYear } from './utils.js';
import { icon } from './icons.js';

let publicYear = getCurrentYear();
let pickerEvents;

export async function renderPublicPortal(container, year = null) {
    if (year) publicYear = year;
    container.innerHTML = '<div class="public-portal page-enter"><div class="loading-spinner"><div class="spinner-ring"></div></div></div>';

    try {
        const [{ data: allDonations, error: donationsError }, { data: individuals, error: individualsError }, expenses, timetables] = await Promise.all([
            getSupabase().from('donations').select('id, owner_name, donated, amount, transaction_type, date_given, buildings ( id, name ), flats ( id, flat_number )').eq('year', publicYear).order('owner_name'),
            getSupabase().from('individuals').select('id, name, amount, transaction_type, date_given').eq('year', publicYear).order('name'),
            fetchExpenses(publicYear),
            fetchTimetables(publicYear).catch(() => [])
        ]);
        if (donationsError) throw donationsError;
        if (individualsError) throw individualsError;

        const donations = allDonations || [];
        const individualRecords = individuals || [];
        const paidDonations = donations.filter(donation => donation.donated);
        const paidIndividuals = individualRecords.filter(individual => (individual.name || '').trim());
        const residentList = buildResidentList(donations, individualRecords);
        const donorList = buildDonorList(paidDonations, paidIndividuals);
        const buildingCollection = paidDonations.reduce((sum, donation) => sum + (parseFloat(donation.amount) || 0), 0);
        const individualCollection = paidIndividuals.reduce((sum, individual) => sum + (parseFloat(individual.amount) || 0), 0);
        const totalCollection = buildingCollection + individualCollection;
        const totalExpenses = expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
        const totalFlatsCount = 136;
        const percent = Math.min(100, Math.round((paidDonations.length / totalFlatsCount) * 100));

        container.innerHTML = `
            <div class="public-portal page-enter">
                <header class="public-header">
                    <div class="public-brand">
                        <div class="public-logo" id="modak-logo-public">${icon('modak', 'ui-icon-brand')}</div>
                        <div><h1>Modak</h1><p class="text-muted text-sm">Garden Estate · Festival & Society Fund ${publicYear}</p></div>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-theme-toggle-public" title="Toggle theme" aria-label="Toggle theme"></button>
                </header>

                <section class="public-access-gate" aria-labelledby="public-access-title">
                    <div class="public-access-icon">${icon('user')}</div>
                    <div>
                        <p class="public-eyebrow">Resident access</p>
                        <h2 id="public-access-title">View the society fund dashboard</h2>
                        <p class="text-muted">Select your name to continue. Your selection is recorded for the committee’s access register.</p>
                    </div>
                    <form id="public-access-form" class="public-access-form">
                        <label id="public-resident-picker-label">Your name</label>
                        ${renderSearchablePicker('public-resident', residentList, {
                            placeholder: 'Search and select your name',
                            emptyMessage: 'Resident names will appear after data is uploaded'
                        })}
                        <label class="public-consent"><input type="checkbox" id="public-access-consent" required ${residentList.length ? '' : 'disabled'}><span>I am viewing this as a Garden Estate resident.</span></label>
                        <p id="public-access-error" class="public-access-error" role="alert" hidden></p>
                        <button class="btn btn-primary public-access-submit" type="submit" ${residentList.length ? '' : 'disabled'}>Continue to dashboard ${icon('arrowLeft', 'public-arrow-right')}</button>
                    </form>
                </section>

                <main id="public-dashboard-details" class="public-dashboard-details" hidden>
                    <section class="public-hero-card">
                        <div class="hero-stats">
                            <div class="hero-stat-primary">
                                <div class="hero-label">Total Society Fund Raised</div><div class="hero-amount">${formatCurrency(totalCollection)}</div>
                                <div class="hero-meta"><span>${icon('building', 'ui-icon-sm')} Buildings: ${formatCurrency(buildingCollection)}</span><span>${icon('user', 'ui-icon-sm')} Individuals: ${formatCurrency(individualCollection)}</span></div>
                            </div>
                            <div class="hero-stat-flats"><div class="hero-flats-count">${paidDonations.length} / ${totalFlatsCount}</div><div class="hero-label">Flats Contributed (${percent}%)</div><div class="progress-bar" style="margin-top: 0.5rem; height: 8px;"><div class="progress-fill green" style="width: ${percent}%;"></div></div></div>
                        </div>
                    </section>

                    <section class="public-expenses-section" aria-labelledby="public-expenses-title">
                        <div class="section-heading"><div><p class="public-eyebrow">Transparency ledger</p><h2 id="public-expenses-title">Expense detail</h2></div><div class="public-expense-total">${formatCurrency(totalExpenses)} <span>Total spent</span></div></div>
                        ${expenses.length ? `<div class="public-expense-list">${expenses.map(expense => `
                            <article class="public-expense-row">
                                <div><span class="expense-label">Paid to</span><strong>${escapeHtml(expense.given_to || '—')}</strong></div>
                                <div><span class="expense-label">Purpose</span><strong>${escapeHtml(expense.spent_on || '—')}</strong></div>
                                <div class="public-expense-amount"><span class="expense-label">Amount</span><strong>${formatCurrency(expense.amount)}</strong></div>
                                <div class="public-expense-meta">${escapeHtml(expense.transaction_type || '—')} · ${formatDate(expense.date_spent)}</div>
                            </article>`).join('')}</div>` : '<p class="public-empty-note">No expenses have been recorded for this year.</p>'}
                    </section>

                    <section class="public-contributor-section">
                        <div class="contributor-card">
                            <div class="contributor-header"><div class="contributor-icon">${icon('fileText')}</div><div><h2>Confirmed contribution</h2><p class="text-muted text-sm">Select a contributor to view the recorded receipt.</p></div></div>
                            <div class="form-group"><label id="donor-picker-label">Select a verified contributor</label>${renderSearchablePicker('donor', donorList, { placeholder: 'Search a contributor', emptyMessage: 'No confirmed contributions yet' })}</div>
                            <div id="verified-receipt-box" class="verified-box" style="display: none;"><div class="verified-badge"><span class="badge-check">${icon('checkCircle')}</span><span>Confirmed Contribution</span></div><div class="verified-grid"><div><span class="v-label">Contributor name</span><h3 id="v-name" class="v-value">—</h3></div><div><span class="v-label">Allocation / unit</span><div id="v-unit" class="v-value">—</div></div><div><span class="v-label">Amount paid</span><div id="v-amount" class="v-amount-highlight">—</div></div><div><span class="v-label">Mode & date</span><div id="v-mode" class="v-value">—</div></div></div></div>
                        </div>
                    </section>

                    ${timetables.length ? `<section class="public-timetables-section"><div class="section-heading"><h2>${icon('calendar')} Event schedule</h2></div><div class="public-timetables-grid">${timetables.map(timetable => `<div class="public-tt-card" data-url="${escapeHtml(timetable.image_url)}" data-title="${escapeHtml(timetable.title)}"><div class="public-tt-img-wrap"><img src="${escapeHtml(timetable.image_url)}" alt="${escapeHtml(timetable.title)}" loading="lazy"></div><div class="public-tt-info"><h4>${escapeHtml(timetable.title)}</h4><span class="text-muted text-xs">${icon('calendar', 'ui-icon-sm')} ${formatDate(timetable.event_date)}</span></div></div>`).join('')}</div></section>` : ''}

                    <section class="public-list-section">
                        <div class="section-heading"><div><p class="public-eyebrow">Contributions</p><h2>${icon('building')} Verified contributors</h2></div><input type="text" id="public-search-filter" class="search-input" placeholder="Filter by name or flat" aria-label="Filter by name or flat"></div>
                        <div class="flats-table-wrapper"><table class="flats-table"><thead><tr><th>Contributor</th><th>Unit / type</th><th>Amount</th><th class="hide-mobile">Payment mode</th><th class="hide-mobile">Date</th></tr></thead><tbody>${donorList.map(donor => `<tr class="donor-row" data-text="${escapeHtml(`${donor.name} ${donor.unit}`.toLowerCase())}"><td style="font-weight: 600; color: var(--slate-900);">${escapeHtml(donor.name)}</td><td><span class="badge badge-success" style="font-size: 0.7rem;">${escapeHtml(donor.unit)}</span></td><td class="amount-cell" style="color: var(--primary-700);">${formatCurrency(donor.amount)}</td><td class="hide-mobile text-muted">${escapeHtml(donor.paymentMode || '—')}</td><td class="hide-mobile text-muted">${formatDate(donor.date)}</td></tr>`).join('')}</tbody></table></div>
                    </section>
                </main>
                <footer class="public-footer"><p>Modak Expense Tracker · Managed by Garden Estate Society Committee</p></footer>
            </div>`;

        pickerEvents?.abort();
        pickerEvents = new AbortController();
        setupPublicAccessGate(residentList);
        setupDropdownEvents(donorList);
        setupSearchFilter();
        setupImageModalHandlers();
    } catch (error) {
        console.error('Failed to load public portal:', error);
        container.innerHTML = `<div class="public-portal page-enter"><div class="empty-state"><div class="empty-icon">${icon('alert', 'ui-icon-xl')}</div><h2>Unable to load portal</h2><p class="text-muted">Please refresh and try again.</p></div></div>`;
    }
}

function buildResidentList(donations, individuals) {
    const residents = [];
    donations.forEach(donation => {
        const name = (donation.owner_name || '').trim();
        if (!name) return;
        const unit = [donation.buildings?.name, donation.flats?.flat_number].filter(Boolean).join(' · ');
        residents.push({ type: 'building', id: donation.id, name, unit, label: unit ? `${name} (${unit})` : name });
    });
    individuals.forEach(individual => {
        const name = (individual.name || '').trim();
        if (!name) return;
        residents.push({ type: 'individual', id: individual.id, name, unit: 'Individual contributor', label: `${name} (Individual contributor)` });
    });
    return residents.sort((a, b) => a.name.localeCompare(b.name));
}

function buildDonorList(donations, individuals) {
    const donors = [];
    donations.forEach(donation => {
        const name = (donation.owner_name || '').trim();
        if (!name) return;
        const unit = [donation.buildings?.name, donation.flats?.flat_number].filter(Boolean).join(' · ');
        donors.push({ name, unit, label: unit ? `${name} (${unit})` : name, amount: donation.amount, paymentMode: donation.transaction_type, date: donation.date_given });
    });
    individuals.forEach(individual => {
        const name = (individual.name || '').trim();
        if (!name) return;
        donors.push({ name, unit: 'Individual contributor', label: `${name} (Individual contributor)`, amount: individual.amount, paymentMode: individual.transaction_type, date: individual.date_given });
    });
    return donors.sort((a, b) => a.name.localeCompare(b.name));
}

function renderSearchablePicker(id, options, { placeholder, emptyMessage }) {
    const disabled = options.length === 0;
    const optionMarkup = options.map((option, index) => `
        <button type="button" class="custom-picker-option" role="option" data-value="${index}" data-search="${escapeHtml(option.label.toLowerCase())}" aria-selected="false">
            <span>${escapeHtml(option.name)}</span>${option.unit ? `<small>${escapeHtml(option.unit)}</small>` : ''}
        </button>`).join('');

    return `<div id="${id}-picker" class="custom-picker${disabled ? ' is-disabled' : ''}" aria-labelledby="${id}-picker-label">
        <input type="hidden" id="${id}-select" value="" ${disabled ? 'disabled' : ''}>
        <button type="button" class="custom-picker-toggle" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-picker-options" ${disabled ? 'disabled' : ''}>
            <span class="custom-picker-toggle-value">${escapeHtml(disabled ? emptyMessage : placeholder)}</span>
            <span class="custom-picker-search-button">${icon('search', 'ui-icon-sm')}<span>Search</span></span>
        </button>
        <div class="custom-picker-panel" hidden>
            <label class="sr-only" for="${id}-picker-search">Search names</label>
            <div class="custom-picker-search-wrap">${icon('search', 'ui-icon-sm')}<input id="${id}-picker-search" type="search" autocomplete="off" placeholder="Type a name or unit"></div>
            <div id="${id}-picker-options" class="custom-picker-options" role="listbox">${optionMarkup}</div>
            <p class="custom-picker-empty" hidden>No matching name found.</p>
        </div>
    </div>`;
}

function setupPublicAccessGate(residentList) {
    const form = document.getElementById('public-access-form');
    const select = document.getElementById('public-resident-select');
    const error = document.getElementById('public-access-error');
    const details = document.getElementById('public-dashboard-details');
    const submitButton = form?.querySelector('button[type="submit"]');
    if (!form || !select || !details) return;

    setupSearchablePicker('public-resident', residentList);

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const resident = residentList[Number(select.value)];
        if (!resident) {
            error.textContent = 'Please search for and select your name to continue.';
            error.hidden = false;
            document.querySelector('#public-resident-picker .custom-picker-toggle')?.focus();
            return;
        }
        submitButton.disabled = true;
        error.hidden = true;
        try {
            await recordPublicPortalAccess(resident);
            details.hidden = false;
            form.closest('.public-access-gate')?.classList.add('public-access-complete');
            details.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (recordError) {
            console.error('Failed to record public portal access:', recordError);
            error.textContent = 'We could not record your access. Please try again.';
            error.hidden = false;
            submitButton.disabled = false;
        }
    });
}

function setupDropdownEvents(donorList) {
    const select = document.getElementById('donor-select');
    const box = document.getElementById('verified-receipt-box');
    if (!select || !box) return;
    setupSearchablePicker('donor', donorList, value => {
        const donor = donorList[Number(value)];
        if (!donor) { box.style.display = 'none'; return; }
        document.getElementById('v-name').textContent = donor.name;
        document.getElementById('v-unit').textContent = donor.unit || '—';
        document.getElementById('v-amount').textContent = formatCurrency(donor.amount);
        document.getElementById('v-mode').textContent = `${donor.paymentMode || '—'} · ${formatDate(donor.date)}`;
        box.style.display = 'block';
    });
}

function setupSearchablePicker(id, options, onSelect = () => {}) {
    const root = document.getElementById(`${id}-picker`);
    const input = document.getElementById(`${id}-select`);
    const toggle = root?.querySelector('.custom-picker-toggle');
    const panel = root?.querySelector('.custom-picker-panel');
    const search = root?.querySelector('.custom-picker-search-wrap input');
    const optionButtons = [...(root?.querySelectorAll('.custom-picker-option') || [])];
    const empty = root?.querySelector('.custom-picker-empty');
    if (!root || !input || !toggle || !panel || !search || toggle.disabled) return;

    const close = () => {
        root.classList.remove('is-open');
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
        root.classList.add('is-open');
        panel.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        search.focus();
    };
    const filter = () => {
        const query = search.value.trim().toLowerCase();
        let visible = 0;
        optionButtons.forEach(button => {
            const matches = (button.dataset.search || '').includes(query);
            button.hidden = !matches;
            if (matches) visible += 1;
        });
        empty.hidden = visible > 0;
    };
    const choose = value => {
        const selected = options[Number(value)];
        if (!selected) return;
        input.value = value;
        toggle.querySelector('.custom-picker-toggle-value').textContent = selected.label;
        optionButtons.forEach(button => button.setAttribute('aria-selected', String(button.dataset.value === String(value))));
        close();
        onSelect(value);
    };

    toggle.addEventListener('click', () => (panel.hidden ? open() : close()), { signal: pickerEvents.signal });
    search.addEventListener('input', filter, { signal: pickerEvents.signal });
    search.addEventListener('keydown', event => {
        if (event.key === 'Escape') { close(); toggle.focus(); }
        if (event.key === 'ArrowDown') { event.preventDefault(); optionButtons.find(button => !button.hidden)?.focus(); }
    }, { signal: pickerEvents.signal });
    optionButtons.forEach(button => {
        button.addEventListener('click', () => choose(button.dataset.value), { signal: pickerEvents.signal });
        button.addEventListener('keydown', event => {
            if (event.key === 'Escape') { close(); toggle.focus(); }
        }, { signal: pickerEvents.signal });
    });
    document.addEventListener('click', event => { if (!root.contains(event.target)) close(); }, { signal: pickerEvents.signal });
}

function setupSearchFilter() {
    const input = document.getElementById('public-search-filter');
    const rows = document.querySelectorAll('.donor-row');
    if (!input) return;
    input.addEventListener('input', event => {
        const query = event.target.value.trim().toLowerCase();
        rows.forEach(row => { row.style.display = (row.dataset.text || '').includes(query) ? '' : 'none'; });
    });
}

function setupImageModalHandlers() {
    document.querySelectorAll('.public-tt-card').forEach(card => {
        card.addEventListener('click', () => {
            const overlay = document.getElementById('image-modal-overlay');
            const image = document.getElementById('img-modal-src');
            if (!overlay || !image) return;
            image.src = card.dataset.url;
            document.getElementById('img-modal-title').textContent = card.dataset.title || '';
            overlay.classList.add('active');
            const close = () => overlay.classList.remove('active');
            document.getElementById('img-modal-close').onclick = close;
            overlay.onclick = event => { if (event.target === overlay) close(); };
        });
    });
}
