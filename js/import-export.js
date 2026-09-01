// ============================================
// Import / Export Module
// ============================================

import {
    fetchAllBuildingsAndFlats, bulkUpsertDonations, exportAllData
} from './supabase.js';
import {
    parseCSV, showToast, matchColumnHeader, normalizeOwnerName, escapeHtml
} from './utils.js';

/**
 * Open the import modal
 */
export function openImportModal(year) {
    const overlay = document.getElementById('import-modal-overlay');
    overlay.classList.add('active');

    // Reset state
    document.getElementById('import-sheets-url').value = '';
    document.getElementById('import-file-input').value = '';
    hideImportResult();

    // Set up tabs
    setupImportTabs();

    // Set up Google Sheets import
    setupSheetsImport(year);

    // Set up Excel import
    setupExcelImport(year);

    // Close handlers
    document.getElementById('import-modal-close').onclick = closeImportModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeImportModal(); };
}

function closeImportModal() {
    document.getElementById('import-modal-overlay').classList.remove('active');
}

function setupImportTabs() {
    const tabs = document.querySelectorAll('.import-tab');
    const contents = document.querySelectorAll('.import-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
            hideImportResult();
        });
    });
}

function setupSheetsImport(year) {
    const btn = document.getElementById('import-sheets-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', async () => {
        const url = document.getElementById('import-sheets-url').value.trim();
        if (!url) {
            showToast('Please enter a Google Sheets URL', 'error');
            return;
        }

        // Extract sheet ID from URL
        const sheetId = extractSheetId(url);
        if (!sheetId) {
            showToast('Invalid Google Sheets URL', 'error');
            return;
        }

        newBtn.disabled = true;
        newBtn.textContent = 'Importing...';

        try {
            // Fetch as CSV
            const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
            const response = await fetch(csvUrl);

            if (!response.ok) {
                throw new Error('Could not fetch sheet. Make sure it\'s publicly shared (Anyone with the link can view).');
            }

            const csvText = await response.text();
            const rows = parseCSV(csvText);

            if (rows.length === 0) {
                throw new Error('Sheet appears to be empty');
            }

            const result = await processImportRows(rows, year);
            showImportResult(result);

        } catch (err) {
            console.error('Sheets import error:', err);
            showImportResult({ success: false, message: err.message });
        } finally {
            newBtn.disabled = false;
            newBtn.textContent = 'Import from Sheets';
        }
    });
}

function setupExcelImport(year) {
    const dropzone = document.getElementById('import-file-dropzone');
    const fileInput = document.getElementById('import-file-input');

    // Click to upload
    dropzone.onclick = () => fileInput.click();

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleExcelFile(file, year);
    });

    // File input change
    const newInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newInput, fileInput);
    newInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleExcelFile(file, year);
    });
}

async function handleExcelFile(file, year) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        showToast('Please upload an .xlsx, .xls, or .csv file', 'error');
        return;
    }

    const dropzone = document.getElementById('import-file-dropzone');
    const originalHTML = dropzone.innerHTML;
    dropzone.innerHTML = `
        <div class="dropzone-icon">⏳</div>
        <div class="dropzone-text">Processing ${escapeHtml(file.name)}...</div>
    `;

    try {
        let rows;

        if (file.name.endsWith('.csv')) {
            const text = await file.text();
            rows = parseCSV(text);
        } else {
            // Use SheetJS
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            // Convert to our row format (lowercase keys)
            rows = jsonData.map(row => {
                const normalized = {};
                Object.keys(row).forEach(key => {
                    const mappedKey = matchColumnHeader(key);
                    if (mappedKey) {
                        normalized[mappedKey] = String(row[key]).trim();
                    }
                });
                return normalized;
            });
        }

        if (rows.length === 0) {
            throw new Error('File appears to be empty');
        }

        const result = await processImportRows(rows, year);
        showImportResult(result);

    } catch (err) {
        console.error('Excel import error:', err);
        showImportResult({ success: false, message: err.message });
    } finally {
        dropzone.innerHTML = originalHTML;
    }
}

/**
 * Process parsed rows and upsert into Supabase
 */
async function processImportRows(rows, year) {
    // Fetch building and flat lookup data
    const { buildings, flats } = await fetchAllBuildingsAndFlats();

    // Create lookup maps
    const buildingMap = {};
    buildings.forEach(b => {
        buildingMap[b.name.toLowerCase()] = b;
    });

    const flatMap = {};
    flats.forEach(f => {
        const key = `${f.building_id}_${f.flat_number.toLowerCase()}`;
        flatMap[key] = f;
    });

    const records = [];
    let skipped = 0;
    let errors = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // +2 because row 1 is header

        // Find building
        const buildingName = row.building || row.building_name || '';
        const building = buildingMap[buildingName.toLowerCase()];
        if (!building) {
            errors.push(`Row ${rowNum}: Unknown building "${buildingName}"`);
            skipped++;
            continue;
        }

        // Find flat
        let flatNumber = row.flat || row.flat_number || row.flat_no || '';
        // Normalize flat number: "1" → "Flat 01", "Flat 1" → "Flat 01", "Flat 01" stays
        flatNumber = normalizeFlatNumber(flatNumber);

        const flatKey = `${building.id}_${flatNumber.toLowerCase()}`;
        const flat = flatMap[flatKey];
        if (!flat) {
            errors.push(`Row ${rowNum}: Unknown flat "${flatNumber}" in ${buildingName}`);
            skipped++;
            continue;
        }

        // Parse donation data
        const donatedStr = (row.donated || row.donation_given || row.status || '').toLowerCase();
        const donated = ['yes', 'true', '1', 'y', 'done', 'paid'].includes(donatedStr);

        const amount = parseFloat(row.amount || row.amount_given || 0) || 0;
        const ownerName = normalizeOwnerName(row.owner_name || row.owner || row.name || '');
        const transactionType = row.transaction_type || row.transaction || row.type || row.payment_mode || row.mode || '';
        const dateGiven = row.date_given || row.date || row.date_of_payment || null;

        records.push({
            flat_id: flat.id,
            building_id: building.id,
            year: year,
            owner_name: ownerName,
            donated: donated,
            amount: donated ? amount : 0,
            transaction_type: donated ? transactionType : '',
            date_given: dateGiven || null,
        });
    }

    if (records.length === 0) {
        return {
            success: false,
            message: `No valid records found. ${errors.length > 0 ? errors.slice(0, 5).join('; ') : 'Check your sheet format.'}`
        };
    }

    // Bulk upsert
    const result = await bulkUpsertDonations(records);

    return {
        success: true,
        message: `Successfully imported ${result.length} records. ${skipped > 0 ? `${skipped} rows skipped.` : ''}`,
        details: errors.length > 0 ? errors.slice(0, 5) : null
    };
}

/**
 * Normalize flat number to "Flat 01" format
 */
function normalizeFlatNumber(input) {
    if (!input) return '';
    const str = input.toString().trim();

    // Extract the numeric part
    const match = str.match(/(\d+)/);
    if (match) {
        const num = parseInt(match[1], 10);
        return `Flat ${String(num).padStart(2, '0')}`;
    }

    return str;
}

/**
 * Extract Google Sheets ID from various URL formats
 */
function extractSheetId(url) {
    // https://docs.google.com/spreadsheets/d/SHEET_ID/edit
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

function showImportResult(result) {
    const el = document.getElementById('import-result');
    el.className = `import-result ${result.success ? 'success' : 'error'}`;
    let html = result.message;
    if (result.details && result.details.length > 0) {
        html += '<br><small>' + result.details.map(d => escapeHtml(d)).join('<br>') + '</small>';
    }
    el.innerHTML = html;
    el.style.display = 'block';

    if (result.success) {
        showToast(result.message);
        // Trigger a refresh of the current view
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('data-imported'));
        }, 500);
    }
}

function hideImportResult() {
    const el = document.getElementById('import-result');
    if (el) {
        el.style.display = 'none';
        el.className = 'import-result';
    }
}

/**
 * Export all data for a year as Excel file
 */
export async function handleExport(year) {
    try {
        showToast('Preparing export...', 'info');

        const data = await exportAllData(year);

        if (!data || data.length === 0) {
            showToast('No data to export for this year', 'error');
            return;
        }

        // Transform to flat rows
        const rows = data.map(d => ({
            'Building': d.buildings?.name || '',
            'Flat': d.flats?.flat_number || '',
            'Owner Name': d.owner_name || '',
            'Donated': d.donated ? 'Yes' : 'No',
            'Amount': d.donated ? d.amount : 0,
            'Transaction Type': d.transaction_type || '',
            'Date': d.date_given || ''
        }));

        // Sort by building, then flat
        rows.sort((a, b) => {
            if (a.Building !== b.Building) return a.Building.localeCompare(b.Building);
            return a.Flat.localeCompare(b.Flat);
        });

        // Create workbook using SheetJS
        const ws = XLSX.utils.json_to_sheet(rows);

        // Set column widths
        ws['!cols'] = [
            { wch: 14 },  // Building
            { wch: 10 },  // Flat
            { wch: 20 },  // Owner Name
            { wch: 10 },  // Donated
            { wch: 12 },  // Amount
            { wch: 16 },  // Transaction Type
            { wch: 14 },  // Date
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Donations ${year}`);

        // Download
        XLSX.writeFile(wb, `Garden_Estate_Donations_${year}.xlsx`);

        showToast('Export downloaded successfully!');

    } catch (err) {
        console.error('Export error:', err);
        showToast('Export failed: ' + err.message, 'error');
    }
}
