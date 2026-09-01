// ============================================
// Utility Functions
// ============================================

/**
 * Format a number as Indian Rupee currency
 */
export function formatCurrency(amount) {
    if (amount === null || amount === undefined || amount === '') return '—';
    const num = parseFloat(amount);
    if (isNaN(num)) return '—';
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
 * Normalize owner name — trim and title case
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

    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
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
            <span style="background: var(--error-light); padding: 0.375rem; border-radius: var(--radius-md);">⚠️</span>
            ${escapeHtml(title)}
        `;
        document.getElementById('confirm-modal-message').textContent = message;

        overlay.classList.add('active');

        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        const closeBtn = document.getElementById('confirm-modal-close');

        const cleanup = (result) => {
            overlay.classList.remove('active');
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
    if (!dateStr) return '—';
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
 * Get a building icon/emoji based on building name
 */
export function getBuildingIcon(name) {
    return '🏢';
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
