// ============================================
// Global Search Module
// ============================================

import { searchDonations } from './supabase.js';
import { debounce, escapeHtml, getBuildingIcon } from './utils.js';

let searchActive = false;

/**
 * Initialize the global search functionality
 */
export function initSearch(getYear) {
    const input = document.getElementById('global-search');
    const resultsContainer = document.getElementById('search-results');

    if (!input || !resultsContainer) return;

    const performSearch = debounce(async (query) => {
        if (!query || query.length < 2) {
            resultsContainer.classList.remove('active');
            return;
        }

        try {
            const year = getYear();
            const results = await searchDonations(query, year);

            if (results.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="search-no-results">No results found for "${escapeHtml(query)}"</div>
                `;
            } else {
                resultsContainer.innerHTML = results.map(d => `
                    <div class="search-result-item"
                         data-building-name="${escapeHtml(d.buildings?.name || '')}"
                         data-flat-id="${d.flat_id}">
                        <div class="result-icon">${getBuildingIcon(d.buildings?.name)}</div>
                        <div class="result-info">
                            <div class="result-name">${escapeHtml(d.owner_name)}</div>
                            <div class="result-detail">${escapeHtml(d.buildings?.name)} · ${escapeHtml(d.flats?.flat_number)}</div>
                        </div>
                    </div>
                `).join('');
            }

            resultsContainer.classList.add('active');
            searchActive = true;

        } catch (err) {
            console.error('Search error:', err);
            resultsContainer.innerHTML = `
                <div class="search-no-results">Search failed. Please try again.</div>
            `;
            resultsContainer.classList.add('active');
        }
    }, 300);

    // Input handler
    input.addEventListener('input', (e) => {
        performSearch(e.target.value.trim());
    });

    // Focus handler
    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) {
            resultsContainer.classList.add('active');
            searchActive = true;
        }
    });

    // Click on result → navigate
    resultsContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.search-result-item');
        if (item) {
            const buildingName = item.dataset.buildingName;
            if (buildingName) {
                window.location.hash = `#buildings/${encodeURIComponent(buildingName)}`;
            }
            resultsContainer.classList.remove('active');
            searchActive = false;
            input.value = '';
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (searchActive && !input.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.remove('active');
            searchActive = false;
        }
    });

    // Close on Escape
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            resultsContainer.classList.remove('active');
            searchActive = false;
            input.blur();
        }
    });
}
