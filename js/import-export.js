// ============================================
// Import / Export Module
// ============================================

import {
    fetchAllBuildingsAndFlats, bulkUpsertDonations, bulkUpsertIndividuals,
    bulkUpsertExpenses, exportAllData
} from './supabase.js';
import {
    parseCSV, showToast, matchColumnHeader, normalizeOwnerName, escapeHtml
} from './utils.js';
import { icon } from './icons.js';

let currentImportYear = null;
let importTabsInitialized = false;
let excelImportInitialized = false;
let selectedExcelFile = null;
let isExcelImporting = false;

/**
 * Open the import modal
 */
export function openImportModal(year) {
    currentImportYear = year;
    const overlay = document.getElementById('import-modal-overlay');
    overlay.classList.add('active');

    // Reset state
    document.getElementById('import-sheets-url').value = '';
    document.getElementById('import-file-input').value = '';
    selectedExcelFile = null;
    hideImportResult();

    // Set up tabs (one-time init)
    setupImportTabs();

    // Set up Google Sheets import
    setupSheetsImport(year);

    // Set up Excel import
    setupExcelImport();
    updateExcelFileSelection();

    // Set up template download button
    setupTemplateDownload();

    // Close handlers
    document.getElementById('import-modal-close').onclick = closeImportModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeImportModal(); };
}

function setupTemplateDownload() {
    const btn = document.getElementById('btn-download-template');
    if (!btn) return;

    btn.onclick = () => {
        const sampleData = [
            { 'Building': 'Mayflower', 'Flat': 'Flat 01', 'Owner Name': 'Rajesh Kumar', 'Donated': 'Yes', 'Amount': 5000, 'Transaction Type': 'UPI', 'Date Given': '2026-03-15' },
            { 'Building': 'Mayflower', 'Flat': 'Flat 02', 'Owner Name': 'Sunita Rao', 'Donated': 'No', 'Amount': 0, 'Transaction Type': '', 'Date Given': '' },
            { 'Building': 'Pink Rose', 'Flat': 'Flat 01', 'Owner Name': 'Amit Patel', 'Donated': 'Yes', 'Amount': 3000, 'Transaction Type': 'Cash', 'Date Given': '2026-03-16' },
            { 'Building': 'White Rose', 'Flat': 'Flat 05', 'Owner Name': 'Vikram Singh', 'Donated': 'Yes', 'Amount': 4500, 'Transaction Type': 'Bank Transfer', 'Date Given': '2026-03-18' }
        ];

        const ws = XLSX.utils.json_to_sheet(sampleData);
        ws['!cols'] = [
            { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 14 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sample Template');
        XLSX.writeFile(wb, 'Modak_Import_Template.xlsx');
        showToast('Sample template downloaded!');
    };
}

function closeImportModal() {
    document.getElementById('import-modal-overlay').classList.remove('active');
}

function setupImportTabs() {
    if (importTabsInitialized) return;
    importTabsInitialized = true;

    const tabs = document.querySelectorAll('.import-tab');
    const contents = document.querySelectorAll('.import-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab)?.classList.add('active');
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

function setupExcelImport() {
    const dropzone = document.getElementById('import-file-dropzone');
    const fileInput = document.getElementById('import-file-input');
    const importButton = document.getElementById('btn-import-selected-file');
    if (!dropzone || !fileInput || !importButton) return;

    if (!excelImportInitialized) {
        excelImportInitialized = true;
        // Look up the input at click time because the modal may be reopened.
        dropzone.onclick = () => document.getElementById('import-file-input')?.click();

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
            if (file) selectExcelFile(file);
        });
    }

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) selectExcelFile(file);
    };
    importButton.onclick = () => {
        if (selectedExcelFile && !isExcelImporting) {
            handleExcelFile(selectedExcelFile, currentImportYear);
        }
    };
}

function selectExcelFile(file) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        showToast('Please choose an .xlsx, .xls, or .csv file', 'error');
        return;
    }
    selectedExcelFile = file;
    hideImportResult();
    updateExcelFileSelection();
}

function updateExcelFileSelection(status = '') {
    const fileName = document.getElementById('import-selected-file-name');
    const statusEl = document.getElementById('import-file-status');
    const importButton = document.getElementById('btn-import-selected-file');
    if (fileName) fileName.textContent = selectedExcelFile ? selectedExcelFile.name : 'No file selected';
    if (statusEl) {
        statusEl.textContent = status;
        statusEl.hidden = !status;
    }
    if (importButton) importButton.disabled = !selectedExcelFile || isExcelImporting;
}

async function handleExcelFile(file, year) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        showToast('Please upload an .xlsx, .xls, or .csv file', 'error');
        return;
    }

    isExcelImporting = true;
    const dropzone = document.getElementById('import-file-dropzone');
    dropzone?.classList.add('is-processing');
    dropzone?.setAttribute('aria-busy', 'true');
    updateExcelFileSelection(`Reading ${file.name}…`);

    try {
        let rows;

        if (file.name.endsWith('.csv')) {
            const text = await file.text();
            rows = parseCSV(text);
        } else {
            // Use SheetJS with cellDates: true to avoid numeric date serials
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const firstSheet = workbook.Sheets[firstSheetName];

            const ganeshotsavData = parseGaneshotsavExpenseSheet(firstSheet);
            if (ganeshotsavData) {
                const result = await processGaneshotsavImport(ganeshotsavData, year);
                showImportResult(result);
                updateExcelFileSelection(result.success ? 'Import complete.' : 'Import could not be completed.');
                return;
            }

            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });

            // Helper to format values and handle Date objects without UTC off-by-one timezone shift
            const formatVal = (val) => {
                if (val instanceof Date) {
                    const y = val.getFullYear();
                    const m = String(val.getMonth() + 1).padStart(2, '0');
                    const d = String(val.getDate()).padStart(2, '0');
                    return `${y}-${m}-${d}`;
                }
                if (typeof val === 'number' && val > 30000 && val < 60000) {
                    try {
                        const date = new Date((val - 25569) * 86400 * 1000);
                        const y = date.getUTCFullYear();
                        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
                        const d = String(date.getUTCDate()).padStart(2, '0');
                        return `${y}-${m}-${d}`;
                    } catch (e) {}
                }
                return String(val ?? '').trim();
            };

            // Convert to flexible row format
            rows = jsonData.map(row => {
                const normalized = {};
                Object.keys(row).forEach(originalKey => {
                    const cleanKey = originalKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                    const mappedKey = matchColumnHeader(originalKey);
                    const formatted = formatVal(row[originalKey]);

                    // Set both the mapped standard key AND the cleaned original key as fallback
                    if (mappedKey) {
                        normalized[mappedKey] = formatted;
                    }
                    normalized[cleanKey] = formatted;
                });
                return normalized;
            });
        }

        if (rows.length === 0) {
            throw new Error('File appears to be empty');
        }

        const result = await processImportRows(rows, year);
        showImportResult(result);
        updateExcelFileSelection(result.success ? 'Import complete.' : 'Import could not be completed.');

    } catch (err) {
        console.error('Excel import error:', err);
        showImportResult({ success: false, message: err.message });
        updateExcelFileSelection('Import could not be completed.');
    } finally {
        isExcelImporting = false;
        dropzone?.classList.remove('is-processing');
        dropzone?.removeAttribute('aria-busy');
        if (selectedExcelFile === file) selectedExcelFile = null;
        document.getElementById('import-file-input').value = '';
        const statusEl = document.getElementById('import-file-status');
        const completedStatus = statusEl?.textContent || '';
        updateExcelFileSelection(completedStatus);
    }
}

function parseGaneshotsavExpenseSheet(sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    const labels = rows.flat().filter(value => typeof value === 'string').map(value => value.trim().toLowerCase());
    if (!labels.includes('detailed expenses') || !labels.includes('mode of payment') || !labels.includes('flat no')) {
        return null;
    }

    const result = { donations: [], individuals: [], expenses: [], issues: [] };
    const contributionBlocks = [
        { building: 'Lotus', startRow: 6, endRow: 21, startColumn: 0 },
        { building: 'Blossom', startRow: 6, endRow: 21, startColumn: 4 },
        { building: 'Orchid', startRow: 6, endRow: 21, startColumn: 8 },
        { building: 'Sunflower', startRow: 6, endRow: 21, startColumn: 12 },
        { building: 'May Flower', startRow: 6, endRow: 21, startColumn: 16 },
        { building: 'Pink Rose', startRow: 27, endRow: 42, startColumn: 0 },
        { building: 'White Rose', startRow: 27, endRow: 42, startColumn: 4 },
        { building: 'Red Rose', startRow: 27, endRow: 42, startColumn: 8 },
        { building: 'Tulip', startRow: 27, endRow: 34, startColumn: 12 },
    ];

    contributionBlocks.forEach(block => {
        for (let rowIndex = block.startRow; rowIndex <= block.endRow; rowIndex++) {
            const row = rows[rowIndex] || [];
            const flatNumber = row[block.startColumn];
            const ownerName = textValue(row[block.startColumn + 1]);
            const amount = positiveAmount(row[block.startColumn + 2]);
            if (ownerName && amount) {
                result.donations.push({ building: block.building, flat: flatNumber, ownerName, amount, sourceRow: rowIndex + 1 });
            } else if (ownerName || amount) {
                result.issues.push(`Row ${rowIndex + 1}: incomplete contribution in ${block.building}.`);
            }
        }
    });

    for (let rowIndex = 27; rowIndex <= 34; rowIndex++) {
        const row = rows[rowIndex] || [];
        const name = textValue(row[17]);
        const amount = positiveAmount(row[18]);
        if (name && amount) {
            result.individuals.push({ name, amount, sourceRow: rowIndex + 1 });
        } else if (name || amount) {
            result.issues.push(`Row ${rowIndex + 1}: incomplete individual contribution.`);
        }
    }

    for (let rowIndex = 5; rowIndex <= 18; rowIndex++) {
        const row = rows[rowIndex] || [];
        const description = textValue(row[22]);
        const amount = positiveAmount(row[23]);
        if (description && amount && !['total', 'balance', 'expenses'].includes(description.toLowerCase())) {
            result.expenses.push({
                spentOn: description,
                amount,
                transactionType: '',
                dateSpent: null,
                notes: 'Imported from Major Expense section',
                sourceRow: rowIndex + 1,
            });
        }
    }

    let activeDate = null;
    for (let rowIndex = 6; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex] || [];
        const rowDate = toIsoDate(row[26]);
        if (rowDate) activeDate = rowDate;
        const description = textValue(row[27]);
        const amount = positiveAmount(row[28]);
        const transactionType = textValue(row[29]);
        if (description && amount) {
            result.expenses.push({
                spentOn: description,
                amount,
                transactionType,
                dateSpent: activeDate,
                notes: 'Imported from Detailed Expenses section',
                sourceRow: rowIndex + 1,
            });
        } else if (description || (row[28] !== null && row[28] !== undefined && textValue(row[28]))) {
            result.issues.push(`Row ${rowIndex + 1}: incomplete detailed expense.`);
        }
    }

    return result;
}

async function processGaneshotsavImport(parsed, year) {
    const { buildings, flats } = await fetchAllBuildingsAndFlats();
    const buildingMap = new Map(buildings.map(building => [normalizeBuildingName(building.name), building]));
    const flatMap = new Map(flats.map(flat => [`${flat.building_id}_${flat.flat_number.toLowerCase()}`, flat]));
    const donationRecords = [];

    parsed.donations.forEach(entry => {
        const building = buildingMap.get(normalizeBuildingName(entry.building));
        const flatNumber = normalizeFlatNumber(entry.flat);
        const flat = building && flatMap.get(`${building.id}_${flatNumber.toLowerCase()}`);
        if (!building || !flat) {
            parsed.issues.push(`Row ${entry.sourceRow}: unknown building or flat.`);
            return;
        }
        donationRecords.push({
            flat_id: flat.id,
            building_id: building.id,
            year,
            owner_name: normalizeOwnerName(entry.ownerName),
            donated: true,
            amount: entry.amount,
            transaction_type: '',
            date_given: null,
        });
    });

    const individualRecords = parsed.individuals.map(entry => ({
        year,
        name: normalizeOwnerName(entry.name),
        amount: entry.amount,
        transaction_type: '',
        date_given: null,
        notes: 'Imported from Superstars section',
        import_key: `ganeshotsav-${year}-individual-${entry.sourceRow}`,
    }));
    const expenseRecords = parsed.expenses.map(entry => ({
        year,
        given_to: null,
        spent_on: entry.spentOn,
        amount: entry.amount,
        transaction_type: entry.transactionType,
        date_spent: entry.dateSpent,
        notes: entry.notes,
        import_key: `ganeshotsav-${year}-expense-${entry.sourceRow}-${entry.notes.includes('Major') ? 'major' : 'detailed'}`,
    }));

    const [donations, individuals, expenses] = await Promise.all([
        bulkUpsertDonations(donationRecords),
        bulkUpsertIndividuals(individualRecords),
        bulkUpsertExpenses(expenseRecords),
    ]);
    window.dispatchEvent(new CustomEvent('data-imported', {
        detail: { count: donations.length + individuals.length + expenses.length },
    }));

    return {
        success: true,
        message: `Imported ${donations.length} flat contributions, ${individuals.length} individual contributions, and ${expenses.length} expenses for ${year}.`,
        details: parsed.issues.length ? parsed.issues.slice(0, 5) : null,
    };
}

function textValue(value) {
    return String(value ?? '').trim();
}

function positiveAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function normalizeBuildingName(value) {
    return textValue(value).toLowerCase().replace(/\s+/g, ' ');
}

function toIsoDate(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    if (typeof value === 'number') {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    const asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString().slice(0, 10);
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

    // Dispatch custom event to notify router to refresh active view
    window.dispatchEvent(new CustomEvent('data-imported', { detail: { count: result.length, year } }));

    return {
        success: true,
        message: `Successfully imported ${result.length} records into year ${year}! ${skipped > 0 ? `${skipped} rows skipped.` : ''}`,
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
    }
}

function hideImportResult() {
    const el = document.getElementById('import-result');
    if (el) {
        el.style.display = 'none';
        el.className = 'import-result';
    }
}

let isExporting = false;

/**
 * Export all data for a year as Excel file
 */
export async function handleExport(year) {
    if (isExporting) return;
    isExporting = true;

    const btn = document.getElementById('btn-export');
    if (btn) btn.disabled = true;

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
        XLSX.writeFile(wb, `Modak_Donations_${year}.xlsx`);

        showToast('Export downloaded successfully!');

    } catch (err) {
        console.error('Export error:', err);
        showToast('Export failed: ' + err.message, 'error');
    } finally {
        isExporting = false;
        if (btn) btn.disabled = false;
    }
}
