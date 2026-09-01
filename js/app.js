// ============================================
// App Controller — Routing, Init, State
// ============================================

import { getSession, signIn, signOut, onAuthStateChange, getDistinctYears, fetchBuildings } from './supabase.js';
import { renderDashboard } from './dashboard.js';
import { renderBuildingsOverview, renderBuildingDetail, clearBuildingsCache } from './buildings.js';
import { renderIndividuals } from './individuals.js';
import { renderExpenses } from './expenses.js';
import { renderTimetable } from './timetable.js';
import { openImportModal, handleExport } from './import-export.js';
import { initSearch } from './search.js';
import { getCurrentYear, showToast, escapeHtml } from './utils.js';

let currentYear = getCurrentYear();
let isAuthenticated = false;

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

function initAuth() {
    onAuthStateChange(async (event, session) => {
        if (session) {
            isAuthenticated = true;
            showApp();
        } else {
            isAuthenticated = false;
            showLogin();
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        const btn = document.getElementById('login-btn');

        if (!email || !password) {
            errorEl.textContent = 'Please enter email and password';
            errorEl.classList.add('visible');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Signing in...';
        errorEl.classList.remove('visible');

        try {
            await signIn(email, password);
        } catch (err) {
            console.error('Login error:', err);
            errorEl.textContent = err.message || 'Invalid email or password';
            errorEl.classList.add('visible');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    });
}

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-layout').classList.add('hidden');
}

async function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-layout').classList.remove('hidden');
    await initApp();
}

async function initApp() {
    await loadYearSelector();
    await loadSidebarBuildings();

    initSearch(() => currentYear);
    setupToolbar();
    setupSidebarToggle();
    setupMobileMenu();

    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('data-imported', () => handleRoute());

    if (!window.location.hash || window.location.hash === '#') {
        window.location.hash = '#dashboard';
    } else {
        handleRoute();
    }
}

async function loadYearSelector() {
    const select = document.getElementById('year-select');
    const current = getCurrentYear();

    try {
        const existingYears = await getDistinctYears();
        const years = new Set([...existingYears, current, current + 1]);
        const sortedYears = [...years].sort((a, b) => b - a);

        select.innerHTML = sortedYears.map(y =>
            `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
        ).join('');

    } catch (err) {
        select.innerHTML = `
            <option value="${current}" selected>${current}</option>
            <option value="${current + 1}">${current + 1}</option>
        `;
    }

    select.addEventListener('change', (e) => {
        currentYear = parseInt(e.target.value, 10);
        clearBuildingsCache();
        handleRoute();
    });

    document.getElementById('add-year-btn').addEventListener('click', () => {
        const newYear = prompt('Enter a year to add (e.g., 2028):');
        if (newYear) {
            const yearNum = parseInt(newYear, 10);
            if (yearNum >= current && yearNum <= current + 10) {
                const exists = [...select.options].some(o => parseInt(o.value) === yearNum);
                if (!exists) {
                    const option = document.createElement('option');
                    option.value = yearNum;
                    option.textContent = yearNum;
                    select.appendChild(option);
                }
                select.value = yearNum;
                currentYear = yearNum;
                clearBuildingsCache();
                handleRoute();
                showToast(`Year ${yearNum} selected`);
            } else {
                showToast('Please enter a valid future year', 'error');
            }
        }
    });
}

async function loadSidebarBuildings() {
    const list = document.getElementById('sidebar-buildings-list');

    try {
        const buildings = await fetchBuildings();
        list.innerHTML = buildings.map(b => `
            <a class="nav-item" href="#buildings/${encodeURIComponent(b.name)}" data-building="${escapeHtml(b.name)}">
                <span class="nav-dot"></span>
                <span class="nav-text">${escapeHtml(b.name)}</span>
            </a>
        `).join('');
    } catch (err) {
        list.innerHTML = '<div class="text-sm text-muted" style="padding: 0.5rem 0.75rem;">Failed to load</div>';
    }
}

function setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const appLayout = document.getElementById('app-layout');
    const buildingsToggle = document.getElementById('sidebar-buildings-toggle');
    const buildingsList = document.getElementById('sidebar-buildings-list');

    toggleBtn?.addEventListener('click', () => {
        appLayout.classList.toggle('sidebar-collapsed');
    });

    buildingsToggle?.addEventListener('click', () => {
        buildingsToggle.classList.toggle('open');
        buildingsList.classList.toggle('open');
    });
}

function setupToolbar() {
    document.getElementById('btn-import').addEventListener('click', () => openImportModal(currentYear));
    document.getElementById('btn-export').addEventListener('click', () => handleExport(currentYear));
    document.getElementById('btn-logout').addEventListener('click', async () => {
        try {
            await signOut();
            showToast('Signed out');
        } catch (err) {
            showToast('Failed to sign out', 'error');
        }
    });
}

function setupMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    menuBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    });

    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
}

function handleRoute() {
    const hash = window.location.hash || '#dashboard';
    const container = document.getElementById('main-content');

    updateSidebarActive(hash);

    if (hash === '#dashboard') {
        renderDashboard(container, currentYear);
    } else if (hash === '#buildings') {
        renderBuildingsOverview(container, currentYear);
    } else if (hash.startsWith('#buildings/')) {
        const buildingName = decodeURIComponent(hash.replace('#buildings/', ''));
        renderBuildingDetail(container, buildingName, currentYear);
    } else if (hash === '#individuals') {
        renderIndividuals(container, currentYear);
    } else if (hash === '#expenses') {
        renderExpenses(container, currentYear);
    } else if (hash === '#timetable') {
        renderTimetable(container, currentYear);
    } else {
        renderDashboard(container, currentYear);
    }
}

function updateSidebarActive(hash) {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.classList.remove('active');
    });

    if (hash === '#dashboard') {
        document.querySelector('[href="#dashboard"]')?.classList.add('active');
    } else if (hash === '#buildings') {
        document.getElementById('sidebar-buildings-toggle')?.classList.add('active');
    } else if (hash.startsWith('#buildings/')) {
        const name = decodeURIComponent(hash.replace('#buildings/', ''));
        document.getElementById('sidebar-buildings-toggle')?.classList.add('active');
        document.querySelector(`[data-building="${name}"]`)?.classList.add('active');

        // Ensure dropdown is open
        document.getElementById('sidebar-buildings-toggle')?.classList.add('open');
        document.getElementById('sidebar-buildings-list')?.classList.add('open');
    } else if (hash === '#individuals') {
        document.querySelector('[href="#individuals"]')?.classList.add('active');
    } else if (hash === '#expenses') {
        document.querySelector('[href="#expenses"]')?.classList.add('active');
    } else if (hash === '#timetable') {
        document.querySelector('[href="#timetable"]')?.classList.add('active');
    }
}
