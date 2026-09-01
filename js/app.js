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

    initSearch(() => currentYear);
    setupToolbar();
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
    const addYearBtn = document.getElementById('add-year-btn');
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

    select.onchange = (e) => {
        currentYear = parseInt(e.target.value, 10);
        clearBuildingsCache();
        handleRoute();
    };

    addYearBtn.onclick = () => {
        openAddYearModal((yearNum) => {
            const options = [...select.options].map(o => parseInt(o.value, 10));
            if (!options.includes(yearNum)) {
                options.push(yearNum);
                options.sort((a, b) => b - a);

                select.innerHTML = options.map(y =>
                    `<option value="${y}">${y}</option>`
                ).join('');
            }
            select.value = yearNum;
            currentYear = yearNum;
            clearBuildingsCache();
            handleRoute();
            showToast(`Year ${yearNum} selected`);
        });
    };
}

function openAddYearModal(onSave) {
    const overlay = document.getElementById('year-modal-overlay');
    const input = document.getElementById('year-input');
    input.value = currentYear + 1;

    overlay.classList.add('active');

    const saveBtn = document.getElementById('year-save-btn');
    saveBtn.onclick = () => {
        const yearNum = parseInt(input.value, 10);
        if (!isNaN(yearNum) && yearNum >= 2020 && yearNum <= 2100) {
            overlay.classList.remove('active');
            onSave(yearNum);
        } else {
            showToast('Please enter a valid year between 2020 and 2100', 'error');
        }
    };

    const close = () => overlay.classList.remove('active');
    document.getElementById('year-modal-close').onclick = close;
    document.getElementById('year-cancel-btn').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
}

function setupToolbar() {
    document.getElementById('btn-import').onclick = () => openImportModal(currentYear);
    document.getElementById('btn-export').onclick = () => handleExport(currentYear);
    document.getElementById('btn-logout').onclick = async () => {
        try {
            await signOut();
            showToast('Signed out');
        } catch (err) {
            showToast('Failed to sign out', 'error');
        }
    };
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
    } else if (hash === '#buildings' || hash.startsWith('#buildings/')) {
        document.querySelector('[href="#buildings"]')?.classList.add('active');
    } else if (hash === '#individuals') {
        document.querySelector('[href="#individuals"]')?.classList.add('active');
    } else if (hash === '#expenses') {
        document.querySelector('[href="#expenses"]')?.classList.add('active');
    } else if (hash === '#timetable') {
        document.querySelector('[href="#timetable"]')?.classList.add('active');
    }
}
