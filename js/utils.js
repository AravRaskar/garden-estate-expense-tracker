// ============================================
// Utility Functions
// ============================================

/**
 * Format a number as Indian Rupee currency
 */
export function formatCurrency(amount) {
    if (amount === null || amount === undefined || amount === '') return '-';
    const num = parseFloat(amount);
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

/**
 * Debounce a function call
 */
export function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Normalize owner name: trim and title case
 */
export function normalizeOwnerName(name) {
    if (!name) return '';
    return name.trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Parse CSV text into array of objects
 */
export function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((header, index) => {
            const key = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            row[key] = values[index]?.trim() || '';
        });
        rows.push(row);
    }

    return rows;
}

/**
 * Parse a single CSV line respecting quoted fields
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

/**
 * Show a toast notification
 */
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const toastIcons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M20 6 9 17l-5-5"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>'
    };
    toast.innerHTML = `
        <span class="toast-icon">${toastIcons[type] || toastIcons.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });
    });

    // Auto dismiss
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Show a custom UI confirmation modal
 */
export function showConfirmModal(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-modal-overlay');
        if (!overlay) {
            resolve(window.confirm(message));
            return;
        }

        document.getElementById('confirm-modal-title').innerHTML = `
            <span style="background: var(--error-light); padding: 0.375rem; border-radius: var(--radius-md);"><span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg></span></span>
            ${escapeHtml(title)}
        `;
        document.getElementById('confirm-modal-message').textContent = message;

        overlay.classList.add('active');

        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        const closeBtn = document.getElementById('confirm-modal-close');

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') cleanup(false);
        };
        document.addEventListener('keydown', handleKeyDown);

        const cleanup = (result) => {
            overlay.classList.remove('active');
            document.removeEventListener('keydown', handleKeyDown);
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            closeBtn.onclick = null;
            overlay.onclick = null;
            resolve(result);
        };

        okBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
        closeBtn.onclick = () => cleanup(false);
        overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
    });
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Get current year as number
 */
export function getCurrentYear() {
    return new Date().getFullYear();
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, c => map[c]);
}

/**
 * Get a building icon based on building name
 */
export function getBuildingIcon(name) {
    // Lazy import to avoid circular dependency
    const { icon } = window.__modakIcons || {};
    if (icon) return icon('building');
    return '<span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M4 21h16M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M11 21v-3h2v3"/></svg></span>';
}

/**
 * Compute progress color class based on percentage
 */
export function getProgressColor(percent) {
    if (percent >= 75) return 'green';
    if (percent >= 40) return 'yellow';
    return 'red';
}

/**
 * Get the CSS class for bar chart based on transaction type
 */
export function getTransactionClass(type) {
    const map = {
        'Cash': 'cash',
        'UPI': 'upi',
        'Bank Transfer': 'bank',
        'Cheque': 'cheque'
    };
    return map[type] || 'other';
}

/**
 * Match a sheet column header to our expected fields
 */
export function matchColumnHeader(header) {
    if (!header) return null;
    const h = header.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const mappings = {
        'building': 'building',
        'buildings': 'building',
        'buildingname': 'building',
        'flat': 'flat',
        'flats': 'flat',
        'flatno': 'flat',
        'flatnumber': 'flat',
        'flatnum': 'flat',
        'owner': 'owner_name',
        'ownername': 'owner_name',
        'name': 'owner_name',
        'ownernameofflat': 'owner_name',
        'donated': 'donated',
        'donationgiven': 'donated',
        'donation': 'donated',
        'status': 'donated',
        'amount': 'amount',
        'amountgiven': 'amount',
        'amountrs': 'amount',
        'transactiontype': 'transaction_type',
        'transaction': 'transaction_type',
        'type': 'transaction_type',
        'paymentmode': 'transaction_type',
        'paymenttype': 'transaction_type',
        'mode': 'transaction_type',
        'date': 'date_given',
        'dategiven': 'date_given',
        'dateofpayment': 'date_given',
    };
    return mappings[h] || null;
}
