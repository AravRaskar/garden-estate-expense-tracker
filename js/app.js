// ============================================
// App Controller: Routing, Init, State
// ============================================

import { signIn, signOut, onAuthStateChange, getDistinctYears } from './supabase.js';
import { renderDashboard, destroyCharts } from './dashboard.js';
import { renderBuildingsOverview, renderBuildingDetail, clearBuildingsCache } from './buildings.js';
import { renderIndividuals } from './individuals.js';
import { renderExpenses } from './expenses.js';
import { renderTimetable } from './timetable.js';
import { openImportModal, handleExport } from './import-export.js';
import { initSearch } from './search.js';
import { renderPublicPortal } from './public-portal.js';
import { getCurrentYear, showToast, escapeHtml } from './utils.js';
import { icon } from './icons.js';
import { initEasterEggs } from './easter-eggs.js';

let currentYear = getCurrentYear();
let isAuthenticated = false;
let appInitialized = false;

export function getAppBase() {
    if (window.location.protocol === 'file:') return '';
    const routes = ['dashboard', 'buildings', 'individuals', 'expenses', 'timetable', 'public', 'login'];
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => routes.includes(p.toLowerCase()) || p.toLowerCase() === 'index.html');
    if (idx > 0) {
        return '/' + parts.slice(0, idx).join('/');
    }
    if (parts.length === 1 && !routes.includes(parts[0].toLowerCase()) && parts[0].toLowerCase() !== 'index.html') {
        return '/' + parts[0];
    }
    return '';
}

export function normalizePath(path) {
    if (!path) return '/';
    // Remove query params and hash if included
    let clean = path.split('?')[0].split('#')[0];
    // Remove index.html suffix
    clean = clean.replace(/\/index\.html$/i, '');
    // Remove trailing slash if longer than 1 character
    if (clean.length > 1 && clean.endsWith('/')) {
        clean = clean.slice(0, -1);
    }
    return clean || '/';
}

export function navigateTo(path) {
    if (window.location.protocol === 'file:') {
        window.location.hash = path.startsWith('/') ? `#${path.slice(1)}` : `#${path}`;
    } else {
        const base = getAppBase();
        const cleanRelative = normalizePath(path);
        const target = base ? `${base}${cleanRelative}` : cleanRelative;
        if (normalizePath(window.location.pathname) !== target) {
            history.pushState(null, '', target);
        }
        handleRoute();
    }
}
window.navigateTo = navigateTo;

export function getCurrentRoute() {
    const base = getAppBase();
    // 1. Check for 404 fallback redirect stored in sessionStorage
    const redirect = sessionStorage.getItem('modak_redirect_route');
    if (redirect) {
        sessionStorage.removeItem('modak_redirect_route');
        let clean = normalizePath(redirect);
        if (base && clean.startsWith(base)) {
            clean = normalizePath(clean.slice(base.length));
        }
        const target = base ? `${base}${clean}` : clean;
        if (window.location.pathname !== target) {
            history.replaceState(null, '', target);
        }
        return clean;
    }

    // 2. Fallback for hash routing or file:// protocol
    if (window.location.hash && window.location.hash.length > 1) {
        return normalizePath('/' + window.location.hash.slice(1).replace(/^\//, ''));
    }

    // 3. Clean pathname stripped of any repo/app base
    let path = normalizePath(window.location.pathname);
    if (base && path.startsWith(base)) {
        path = normalizePath(path.slice(base.length));
    }
    return path;
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initAuth();
});

export function initTheme() {
    const saved = localStorage.getItem('modak_theme');
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = saved || (systemDark ? 'dark' : 'light');
    setTheme(initialTheme, false);

    // Global listener for all theme toggle buttons across pages (topbar, login, public)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#btn-theme-toggle-topbar, #btn-theme-toggle-login, #btn-theme-toggle-public');
        if (btn) {
            e.preventDefault();
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            setTheme(next);
            showToast(`${next === 'dark' ? 'Dark' : 'Light'} theme activated`);
        }
    });

    // Listen to system preference changes if user hasn't explicitly overridden
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('modak_theme')) {
                setTheme(e.matches ? 'dark' : 'light', false);
            }
        });
    }
}

export function setTheme(theme, triggerReRender = true) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('modak_theme', theme);
    updateThemeToggleUI(theme);

    // If on dashboard, re-render charts to update grid and tooltip styling
    if (triggerReRender && isAuthenticated) {
        const route = getCurrentRoute();
        if (route === '/dashboard' || route === '/') {
            const container = document.getElementById('main-content');
            if (container && document.getElementById('chart-income-vs-expense')) {
                renderDashboard(container, currentYear);
            }
        }
    }
}

function updateThemeToggleUI(theme) {
    const isDark = theme === 'dark';
    const iconName = isDark ? 'sun' : 'moon';
    const label = isDark ? 'Light' : 'Dark';

    document.querySelectorAll('#btn-theme-toggle-topbar, #btn-theme-toggle-public').forEach(btn => {
        btn.innerHTML = `${icon(iconName)} <span class="hide-mobile" style="margin-left: 0.25rem;">${label}</span>`;
        btn.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
        btn.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    });

    document.querySelectorAll('#btn-theme-toggle-login').forEach(btn => {
        btn.innerHTML = icon(iconName);
        btn.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
        btn.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    });
}

function initAuth() {
    // HTML5 History & Popstate routing
    window.addEventListener('popstate', handleRoute);
    window.addEventListener('hashchange', handleRoute); // backward compatibility
    window.addEventListener('data-imported', () => {
        if (isAuthenticated) handleAdminRoute();
    });

    // Global Escape key handler to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(overlay => {
                overlay.classList.remove('active');
            });
            document.querySelectorAll('.search-results.active').forEach(results => {
                results.classList.remove('active');
            });
        }
    });

    // Intercept internal link clicks for smooth SPA transitions
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0 && link.target !== '_blank' && !link.hasAttribute('download')) {
            const rawHref = link.getAttribute('href');
            if (rawHref && (rawHref.startsWith('/') || (!rawHref.includes('://') && !rawHref.startsWith('mailto:') && !rawHref.startsWith('tel:') && !rawHref.startsWith('#')))) {
                e.preventDefault();
                const base = getAppBase();
                let clean = rawHref;
                if (base && clean.startsWith(base)) {
                    clean = clean.slice(base.length) || '/';
                }
                navigateTo(clean);
                return;
            }
        }

        const navBtn = e.target.closest('[data-navigate]');
        if (navBtn) {
            e.preventDefault();
            navigateTo(navBtn.getAttribute('data-navigate'));
        }
    });

    onAuthStateChange(async (event, session) => {
        if (session) {
            isAuthenticated = true;
            if (!appInitialized) {
                try {
                    await initApp();
                    appInitialized = true;
                } catch (err) {
                    console.error('Failed to initialize app:', err);
                    showToast('Failed to load initial data. Please refresh.', 'error');
                }
            }
            const current = getCurrentRoute();
            if (current === '/' || current === '/login' || current === '') {
                navigateTo('/dashboard');
            } else {
                handleRoute();
            }
        } else {
            isAuthenticated = false;
            handleRoute();
        }
    });

    setupLoginForm();
    setupQRFlyerModal();
    initEasterEggs();
}

function setupLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const autofillBtn = document.getElementById('btn-autofill-demo');
    autofillBtn?.addEventListener('click', () => {
        const emailEl = document.getElementById('login-email');
        const passEl = document.getElementById('login-password');
        if (emailEl) emailEl.value = 'admin@modak.com';
        if (passEl) passEl.value = 'admin';
        showToast('Demo credentials filled: admin@modak.com / admin');
    });

    form.addEventListener('submit', async (e) => {
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

function isPublicRoute(route = getCurrentRoute()) {
    const r = (route || '').toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return r === '/public' || r.endsWith('/public') || hash === '#public' || hash.startsWith('#public') || search.includes('view=public');
}

function handleRoute() {
    const route = getCurrentRoute();

    // Route 1: Public Portal (Only accessible via QR code route)
    if (isPublicRoute(route)) {
        destroyCharts();
        showPublicScreen();
        const container = document.getElementById('public-portal-screen');
        renderPublicPortal(container, currentYear)
            .then(() => {
                updateThemeToggleUI(document.documentElement.getAttribute('data-theme') || 'light');
            })
            .catch(err => {
                console.error('Public portal rendering failed:', err);
                if (container) {
                    container.innerHTML = `
                        <div class="empty-state" style="padding: 4rem 2rem; text-align: center;">
                            <h3 style="color: var(--pine-800); margin-bottom: 0.5rem;">Unable to load portal</h3>
                            <p style="color: var(--slate-500); margin-bottom: 1.5rem;">There was an issue connecting to the database. Please check your connection and refresh.</p>
                            <button class="btn btn-secondary" onclick="window.location.reload()">Refresh Page</button>
                        </div>
                    `;
                }
            });
        return;
    }

    // Route 2: Regular links (Defaults to Admin Login when unauthenticated)
    if (!isAuthenticated) {
        destroyCharts();
        showLoginScreen();
        updateThemeToggleUI(document.documentElement.getAttribute('data-theme') || 'light');
        return;
    }

    // Authenticated admin view
    showAdminLayout();
    updateThemeToggleUI(document.documentElement.getAttribute('data-theme') || 'light');
    handleAdminRoute(route);
}

function showPublicScreen() {
    document.getElementById('public-portal-screen')?.classList.remove('hidden');
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('app-layout')?.classList.add('hidden');
}

function showLoginScreen() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('public-portal-screen')?.classList.add('hidden');
    document.getElementById('app-layout')?.classList.add('hidden');
}

function showAdminLayout() {
    document.getElementById('app-layout')?.classList.remove('hidden');
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('public-portal-screen')?.classList.add('hidden');
}

async function initApp() {
    await loadYearSelector();
    initSearch(() => currentYear);
    setupToolbar();
    setupMobileMenu();
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
            navigateTo('/');
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

function handleAdminRoute(route = getCurrentRoute()) {
    const container = document.getElementById('main-content');
    const cleanRoute = normalizePath(route);
    updateSidebarActive(cleanRoute);

    // Destroy Chart.js instances if navigating away from dashboard
    if (cleanRoute !== '/dashboard' && cleanRoute !== '/') {
        destroyCharts();
    }

    if (cleanRoute === '/dashboard' || cleanRoute === '/') {
        renderDashboard(container, currentYear);
    } else if (cleanRoute === '/buildings') {
        renderBuildingsOverview(container, currentYear);
    } else if (cleanRoute.startsWith('/buildings/')) {
        const buildingName = decodeURIComponent(cleanRoute.replace('/buildings/', ''));
        renderBuildingDetail(container, buildingName, currentYear);
    } else if (cleanRoute === '/individuals') {
        renderIndividuals(container, currentYear);
    } else if (cleanRoute === '/expenses') {
        renderExpenses(container, currentYear);
    } else if (cleanRoute === '/timetable') {
        renderTimetable(container, currentYear);
    } else {
        renderDashboard(container, currentYear);
    }
}

function updateSidebarActive(route = getCurrentRoute()) {
    const cleanRoute = normalizePath(route);
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.classList.remove('active');
    });

    if (cleanRoute === '/dashboard' || cleanRoute === '/') {
        document.querySelector('[href="/dashboard"]')?.classList.add('active');
    } else if (cleanRoute === '/buildings' || cleanRoute.startsWith('/buildings/')) {
        document.querySelector('[href="/buildings"]')?.classList.add('active');
    } else if (cleanRoute === '/individuals') {
        document.querySelector('[href="/individuals"]')?.classList.add('active');
    } else if (cleanRoute === '/expenses') {
        document.querySelector('[href="/expenses"]')?.classList.add('active');
    } else if (cleanRoute === '/timetable') {
        document.querySelector('[href="/timetable"]')?.classList.add('active');
    }
}

function setupQRFlyerModal() {
    const btn = document.getElementById('btn-qr-flyer');
    const overlay = document.getElementById('qr-flyer-modal-overlay');
    const closeBtn = document.getElementById('qr-flyer-modal-close');
    const imgEl = document.getElementById('qr-flyer-img');
    const urlDisplay = document.getElementById('qr-flyer-url-display');
    const copyBtn = document.getElementById('qr-copy-link-btn');
    const printBtn = document.getElementById('qr-print-btn');

    if (!btn || !overlay) return;

    btn.addEventListener('click', () => {
        // Construct clean root URL (no /# needed)
        const origin = window.location.origin;
        let publicUrl;
        if (window.location.protocol === 'file:') {
            publicUrl = `${window.location.href.split('#')[0]}#public`;
        } else {
            const base = getAppBase();
            publicUrl = `${origin}${base}/public`;
        }

        // Generate QR Code via high-contrast QR service
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}&margin=10`;
        
        imgEl.src = qrApiUrl;
        urlDisplay.textContent = publicUrl;
        overlay.classList.add('active');
    });

    const closeModal = () => overlay.classList.remove('active');
    closeBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    copyBtn?.addEventListener('click', async () => {
        const url = urlDisplay.textContent;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = url;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            showToast('Public portal link copied to clipboard!');
        } catch (err) {
            showToast('Failed to copy link', 'error');
        }
    });

    printBtn?.addEventListener('click', () => {
        window.print();
    });
}

