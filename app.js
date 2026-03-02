/* ==========================================================================
   Tulum Dinner Club — App Logic
   Fetches data from a published Google Sheet and renders restaurant cards.
   ========================================================================== */

(function () {
    'use strict';

    // ── Configuration ────────────────────────────────────────────────────
    // Replace PUBLISHED_CSV_URL with the "Publish to web" CSV link from
    // Google Sheets (File → Share → Publish to web → CSV).
    // The SHEET_ID approach uses the gviz endpoint as a fallback.

    // Published CSV URL (File → Share → Publish to web → CSV)
    const PUBLISHED_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQDu7HJMRZGU3fUamw2h_r7ovTpEXvOmu_PFJNFsxnA1CPKBC13ZHc5OgNf92WCnV_67aQgPfKNq4d_/pub?output=csv';

    // Fallback: gviz JSON endpoint
    const SHEET_ID = '1q2sIFDtXAfe-2TNAjHg9FDHzO-BFXyDXE_0Gb8-PXMc';
    const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

    // Cache settings
    const CACHE_KEY = 'tdc_restaurants';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    // ── DOM References ───────────────────────────────────────────────────

    const grid          = document.getElementById('restaurantGrid');
    const searchInput   = document.getElementById('searchInput');
    const filterButtons = document.querySelectorAll('.btn-filter');
    const loadingState  = document.getElementById('loadingState');
    const emptyState    = document.getElementById('emptyState');
    const errorState    = document.getElementById('errorState');
    const visibleCount  = document.getElementById('visibleCount');
    const totalCount    = document.getElementById('totalCount');

    // ── State ────────────────────────────────────────────────────────────

    let allRestaurants = [];
    let activeFilter   = 'all';

    // ── Bootstrap ────────────────────────────────────────────────────────

    init();

    async function init() {
        bindEvents();
        allRestaurants = await loadSheetData();
        render();
    }

    function bindEvents() {
        searchInput.addEventListener('input', debounce(render, 200));

        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.filter;
                render();
            });
        });
    }

    // ── Data Loading ─────────────────────────────────────────────────────

    async function loadSheetData() {
        // Check cache first
        const cached = getCache();
        if (cached) {
            hideLoading();
            return cached;
        }

        showLoading();

        try {
            // Try the published CSV first
            let data = await fetchCSV(PUBLISHED_CSV_URL);
            if (!data || data.length === 0) {
                // Fallback to gviz JSON
                data = await fetchGviz(GVIZ_URL);
            }
            if (data && data.length > 0) {
                // Sort by date, most recent first
                data.sort((a, b) => {
                    if (!a.date && !b.date) return 0;
                    if (!a.date) return 1;   // no date → end
                    if (!b.date) return -1;
                    return b.date.localeCompare(a.date);
                });
                setCache(data);
                hideLoading();
                return data;
            }
            throw new Error('No data returned');
        } catch (err) {
            console.error('Failed to load sheet data:', err);
            hideLoading();
            showError();
            return [];
        }
    }

    // Expose globally for the retry button
    window.loadSheetData = async function () {
        clearCache();
        allRestaurants = await loadSheetData();
        render();
    };

    /** Parse a published Google Sheets CSV. */
    async function fetchCSV(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
        const text = await res.text();
        return parseCSV(text);
    }

    /** Parse Google Sheets gviz JSON (JSONP-style wrapper). */
    async function fetchGviz(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Gviz fetch failed: ${res.status}`);
        let text = await res.text();

        // Strip the JSONP wrapper: google.visualization.Query.setResponse({...})
        const start = text.indexOf('{');
        const end   = text.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error('Invalid gviz response');
        const json = JSON.parse(text.substring(start, end + 1));

        const cols = json.table.cols.map(c => c.label);
        const rows = json.table.rows.map(row => {
            const obj = {};
            row.c.forEach((cell, i) => {
                obj[cols[i]] = cell ? (cell.v || '') : '';
            });
            return normalizeRow(obj);
        });

        return rows;
    }

    // ── CSV Parser ───────────────────────────────────────────────────────

    function parseCSV(text) {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) return [];

        const headers = parseCSVLine(lines[0]);
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === 0) continue;
            const obj = {};
            headers.forEach((h, idx) => {
                obj[h] = (values[idx] || '').trim();
            });
            rows.push(normalizeRow(obj));
        }

        return rows;
    }

    /** Handle quoted CSV fields properly. */
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < line.length && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += ch;
                }
            }
        }
        result.push(current.trim());
        return result;
    }

    // ── Data Normalization ───────────────────────────────────────────────
    // Maps whatever column names exist in the sheet to a consistent schema.

    function normalizeRow(raw) {
        const keys = Object.keys(raw);

        // Actual sheet columns:
        // Venue Name | Date | Maps Link | Instagram | Instagram Link | Is Rooftop? | Is Hotel? | In Market?
        return {
            name:       findVal(raw, keys, ['venue name', 'restaurant', 'name', 'restaurant name']),
            date:       findVal(raw, keys, ['date', 'visit date', 'last visit']),
            mapsUrl:    findVal(raw, keys, ['maps link', 'google maps', 'maps', 'map', 'google maps url']),
            instagram:  findVal(raw, keys, ['instagram', 'ig', 'instagram id', 'insta']),
            isRooftop:  toBool(findVal(raw, keys, ['is rooftop?', 'is rooftop', 'rooftop'])),
            isHotel:    toBool(findVal(raw, keys, ['is hotel?', 'is hotel', 'hotel'])),
            foodCourt:  findVal(raw, keys, ['in market?', 'in market', 'food court', 'market',
                                             'food court / open air market', 'open air market']),
        };
    }

    /** Fuzzy-match a column header (case-insensitive, trimmed). */
    function findVal(obj, keys, candidates) {
        for (const c of candidates) {
            const match = keys.find(k => k.toLowerCase().trim() === c.toLowerCase());
            if (match) return obj[match];
        }
        // Partial match fallback
        for (const c of candidates) {
            const match = keys.find(k => k.toLowerCase().includes(c.toLowerCase()));
            if (match) return obj[match];
        }
        return '';
    }

    function toBool(val) {
        if (typeof val === 'boolean') return val;
        return String(val).trim().toLowerCase() === 'yes';
    }

    /** Format a date string like "2025-12-01" → "Last Visit, Monday, December 1, 2025" */
    function formatVisitDate(dateStr) {
        if (!dateStr) return '';
        try {
            // Handle YYYY-MM-DD format (add T00:00 to avoid timezone shift)
            const d = new Date(dateStr + 'T00:00:00');
            if (isNaN(d.getTime())) return '';
            const formatted = d.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            return `Last Visit, ${formatted}`;
        } catch {
            return '';
        }
    }

    // ── Rendering ────────────────────────────────────────────────────────

    function render() {
        const query = searchInput.value.trim().toLowerCase();
        const filtered = allRestaurants.filter(r => {
            // Text search
            if (query && !r.name.toLowerCase().includes(query) &&
                !r.foodCourt.toLowerCase().includes(query)) {
                return false;
            }
            // Category filter
            if (activeFilter === 'rooftop'  && !r.isRooftop) return false;
            if (activeFilter === 'hotel'    && !r.isHotel)   return false;
            if (activeFilter === 'foodcourt' && !r.foodCourt) return false;
            return true;
        });

        totalCount.textContent   = allRestaurants.length;
        visibleCount.textContent = filtered.length;

        if (filtered.length === 0 && allRestaurants.length > 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('d-none');
            errorState.classList.add('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        errorState.classList.add('d-none');
        grid.innerHTML = filtered.map(cardHTML).join('');
    }

    function cardHTML(r) {
        const badges = [];

        if (r.isRooftop) {
            badges.push('<span class="badge-tdc badge-rooftop"><i class="fas fa-cloud-sun"></i> Rooftop</span>');
        }
        if (r.isHotel) {
            badges.push('<span class="badge-tdc badge-hotel"><i class="fas fa-hotel"></i> Hotel</span>');
        }
        if (r.foodCourt) {
            const label = escapeHTML(r.foodCourt);
            badges.push(`<span class="badge-tdc badge-foodcourt"><i class="fas fa-store"></i> ${label}</span>`);
        }

        const badgeRow = badges.length
            ? `<div class="badge-row">${badges.join('')}</div>`
            : '';

        const actions = [];

        if (r.mapsUrl) {
            actions.push(`
                <a href="${escapeHTML(r.mapsUrl)}" target="_blank" rel="noopener"
                   class="card-action-link action-maps" title="Open in Google Maps">
                    <i class="fas fa-map-marker-alt"></i> Map
                </a>
            `);
        }

        if (r.instagram) {
            const handle = r.instagram.replace(/^@/, '');
            actions.push(`
                <a href="https://www.instagram.com/${encodeURIComponent(handle)}/"
                   target="_blank" rel="noopener"
                   class="card-action-link action-instagram" title="View on Instagram">
                    <i class="fab fa-instagram"></i> ${escapeHTML(handle)}
                </a>
            `);
        }

        // Restaurant name links to Google Maps if URL exists
        const nameHTML = r.mapsUrl
            ? `<a href="${escapeHTML(r.mapsUrl)}" target="_blank" rel="noopener" class="restaurant-name-link"><h3 class="restaurant-name">${escapeHTML(r.name)}</h3></a>`
            : `<h3 class="restaurant-name">${escapeHTML(r.name)}</h3>`;

        // Visit date line
        const visitDate = formatVisitDate(r.date);
        const dateHTML = visitDate
            ? `<p class="visit-date">${escapeHTML(visitDate)}</p>`
            : '';

        return `
        <div class="col-12 col-sm-6 col-lg-4 col-card">
            <div class="restaurant-card">
                <div class="card-body-inner">
                    ${nameHTML}
                    ${dateHTML}
                    ${badgeRow}
                    <div class="card-actions">
                        ${actions.join('')}
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    // ── Cache Helpers ────────────────────────────────────────────────────

    function getCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const { ts, data } = JSON.parse(raw);
            if (Date.now() - ts > CACHE_TTL) return null;
            return data;
        } catch {
            return null;
        }
    }

    function setCache(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        } catch { /* localStorage full — ignore */ }
    }

    function clearCache() {
        localStorage.removeItem(CACHE_KEY);
    }

    // ── UI State Helpers ─────────────────────────────────────────────────

    function showLoading() {
        loadingState.classList.remove('d-none');
        emptyState.classList.add('d-none');
        errorState.classList.add('d-none');
        grid.innerHTML = '';
    }

    function hideLoading() {
        loadingState.classList.add('d-none');
    }

    function showError() {
        errorState.classList.remove('d-none');
        loadingState.classList.add('d-none');
        emptyState.classList.add('d-none');
    }

    // ── Utilities ────────────────────────────────────────────────────────

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

})();
