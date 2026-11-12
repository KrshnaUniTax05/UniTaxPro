/**
 * UNITAX PRO - Enterprise Data Viewer & Reporting Engine (Enterprise Grade)
 * Features: Criteria-First Retrieval, Multi-Criteria Popovers, Dynamic Column Chooser,
 * Instant Filtering, Multi-Row Selection, Subtotals & Totals, CSV/Print Export.
 */

class UniTaxViewer {
    /**
     * @param {Object} config
     * - containerId: DOM element ID to render the viewer inside
     * - moduleKey: Module registry key (e.g., 'Companies', 'SalesInvoiceForm', etc.)
     * - title: Report / Viewer title
     * - subtitle: Secondary description
     * - columns: Array of column definitions: { key, label, type, sortable, defaultVisible, formatter, align }
     * - criteriaDefs: Array of criteria inputs: { key, label, type, defaultVal, placeholder, options, rangeSupport }
     * - onRowClick: callback when a row is clicked
     * - onRowDblClick: callback when a row is double-clicked (e.g. drilldown)
     */
    constructor(config) {
        this.containerId = config.containerId;
        this.container = document.getElementById(config.containerId);
        this.moduleKey = config.moduleKey;
        this.title = config.title || 'Data Viewer';
        this.subtitle = config.subtitle || 'Criteria-First Record Browser';
        this.columns = config.columns || [];
        this.criteriaDefs = config.criteriaDefs || [];
        this.onRowClick = config.onRowClick || null;
        this.onRowDblClick = config.onRowDblClick || null;

        // Active State
        this.selectedColumns = this.columns.filter(c => c.defaultVisible !== false).map(c => c.key);
        this.activeCriteria = {};
        this.allData = [];
        this.filteredData = [];
        this.selectedRowIds = new Set();
        this.currentPage = 1;
        this.pageSize = config.defaultPageSize || 25;
        this.sortKey = null;
        this.sortOrder = 'asc';
        this.searchQuery = '';
        this.isLoading = false;

        this.init();
    }

    init() {
        if (!this.container) {
            console.error(`UniTaxViewer: Container #${this.containerId} not found.`);
            return;
        }
        this.renderShell();
        this.bindEvents();
    }

    renderShell() {
        this.container.innerHTML = `
        <div class="unitax-viewer-wrapper card border-0 shadow-sm overflow-hidden mb-4">
            <!-- Header Bar -->
            <div class="card-header bg-white border-bottom p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                    <h5 class="fw-bold mb-0 text-dark"><i class="bi bi-table text-primary me-2"></i>${Utils.EscapeHTML(this.title)}</h5>
                    <p class="text-muted small mb-0">${Utils.EscapeHTML(this.subtitle)}</p>
                </div>
                <div class="d-flex flex-wrap align-items-center gap-2">
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="${this.containerId}_btnCols" title="Choose Columns">
                        <i class="bi bi-columns-gap me-1"></i> Columns (<span id="${this.containerId}_colCount">${this.selectedColumns.length}</span>)
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="${this.containerId}_btnExportCSV" title="Export CSV">
                        <i class="bi bi-file-earmark-spreadsheet me-1"></i> Export CSV
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="${this.containerId}_btnPrint" title="Print View">
                        <i class="bi bi-printer me-1"></i> Print
                    </button>
                    <button type="button" class="btn btn-sm btn-primary fw-bold px-3 shadow-sm" id="${this.containerId}_btnExecute">
                        <i class="bi bi-play-fill me-1"></i> Execute
                    </button>
                </div>
            </div>

            <!-- Dynamic Selection Screen (Criteria Panel) -->
            <div class="bg-light p-3 border-bottom" id="${this.containerId}_criteriaPanel">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="small fw-bold text-uppercase text-muted" style="letter-spacing: 0.5px;">
                        <i class="bi bi-funnel me-1"></i> Selection Criteria
                    </span>
                    <button type="button" class="btn btn-link btn-sm text-decoration-none p-0 text-muted" id="${this.containerId}_btnClearCriteria">
                        <i class="bi bi-x-circle me-1"></i> Reset Criteria
                    </button>
                </div>
                <form id="${this.containerId}_criteriaForm" class="row g-2 align-items-end">
                    ${this.renderCriteriaInputs()}
                </form>
            </div>

            <!-- Controls & Fast Search Bar -->
            <div class="p-2 border-bottom bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div class="d-flex align-items-center gap-2">
                    <div class="input-group input-group-sm" style="max-width: 260px;">
                        <span class="input-group-text bg-light border-end-0"><i class="bi bi-search text-muted"></i></span>
                        <input type="text" class="form-control border-start-0" id="${this.containerId}_fastFilter" placeholder="Filter results...">
                    </div>
                    <span class="badge bg-light text-dark border py-2 px-3 fw-normal" id="${this.containerId}_recordCount">
                        0 records
                    </span>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <label class="small text-muted mb-0">Page size:</label>
                    <select class="form-select form-select-sm" id="${this.containerId}_pageSize" style="width: 80px;">
                        <option value="10" ${this.pageSize === 10 ? 'selected' : ''}>10</option>
                        <option value="25" ${this.pageSize === 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${this.pageSize === 100 ? 'selected' : ''}>100</option>
                        <option value="999999">All</option>
                    </select>
                </div>
            </div>

            <!-- Table Result Viewport -->
            <div class="table-responsive" style="max-height: calc(100vh - 350px); min-height: 250px;">
                <table class="table table-sm table-hover align-middle mb-0 master-print-table" id="${this.containerId}_table">
                    <thead class="table-light sticky-top shadow-sm text-muted small" style="z-index: 5;">
                        <tr id="${this.containerId}_theadRow">
                            <!-- Injected dynamically -->
                        </tr>
                    </thead>
                    <tbody id="${this.containerId}_tbody">
                        <tr>
                            <td colspan="10" class="text-center py-5 text-muted">
                                <i class="bi bi-arrow-up-circle fs-3 d-block mb-2 text-primary opacity-50"></i>
                                Set your selection criteria above and click <strong>Execute</strong> to retrieve records.
                            </td>
                        </tr>
                    </tbody>
                    <tfoot class="table-light fw-bold border-top" id="${this.containerId}_tfoot" style="display: none;">
                        <!-- Subtotals/Totals injected here -->
                    </tfoot>
                </table>
            </div>

            <!-- Pagination Bar -->
            <div class="card-footer bg-white border-top p-2 d-flex flex-wrap justify-content-between align-items-center gap-2" id="${this.containerId}_paginationBar">
                <div class="small text-muted" id="${this.containerId}_pageInfo">Showing 0 of 0</div>
                <div class="btn-group btn-group-sm" id="${this.containerId}_pageBtns">
                    <button class="btn btn-outline-secondary" id="${this.containerId}_btnPrev" disabled><i class="bi bi-chevron-left"></i> Prev</button>
                    <button class="btn btn-outline-secondary" id="${this.containerId}_btnNext" disabled>Next <i class="bi bi-chevron-right"></i></button>
                </div>
            </div>
        </div>

        <!-- Column Chooser Modal (Bootstrap 5 standard) -->
        <div class="modal fade" id="${this.containerId}_colModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header bg-primary text-white">
                        <h6 class="modal-title fw-bold"><i class="bi bi-columns-gap me-2"></i>Select Columns to Display</h6>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-3">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <input type="text" class="form-control form-control-sm me-2" id="${this.containerId}_colSearch" placeholder="Search columns...">
                            <div class="btn-group btn-group-sm">
                                <button type="button" class="btn btn-outline-secondary" id="${this.containerId}_btnSelectAllCols">All</button>
                                <button type="button" class="btn btn-outline-secondary" id="${this.containerId}_btnResetCols">Reset</button>
                            </div>
                        </div>
                        <div class="list-group" id="${this.containerId}_colList">
                            <!-- Column checkboxes injected dynamically -->
                        </div>
                    </div>
                    <div class="modal-footer bg-light p-2">
                        <button type="button" class="btn btn-sm btn-primary w-100 fw-bold" data-bs-dismiss="modal" id="${this.containerId}_btnApplyCols">Apply Columns</button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    renderCriteriaInputs() {
        if (!this.criteriaDefs || this.criteriaDefs.length === 0) {
            return `
            <div class="col-md-3">
                <label class="form-label small fw-bold">From Date</label>
                <input type="date" name="fromDate" class="form-control form-control-sm">
            </div>
            <div class="col-md-3">
                <label class="form-label small fw-bold">To Date</label>
                <input type="date" name="toDate" class="form-control form-control-sm">
            </div>
            <div class="col-md-3">
                <label class="form-label small fw-bold">Search Text</label>
                <input type="text" name="keyword" class="form-control form-control-sm" placeholder="Any identifier...">
            </div>
            `;
        }

        return this.criteriaDefs.map(c => {
            const widthClass = c.width || 'col-md-3';
            if (c.type === 'select') {
                const optionsHtml = (c.options || []).map(opt => {
                    const val = typeof opt === 'object' ? opt.value : opt;
                    const text = typeof opt === 'object' ? opt.label : opt;
                    return `<option value="${Utils.EscapeHTML(val)}">${Utils.EscapeHTML(text)}</option>`;
                }).join('');
                return `
                <div class="${widthClass}">
                    <label class="form-label small fw-bold text-muted">${Utils.EscapeHTML(c.label)}</label>
                    <select name="${Utils.EscapeHTML(c.key)}" class="form-select form-select-sm">
                        <option value="ALL">All ${Utils.EscapeHTML(c.label)}</option>
                        ${optionsHtml}
                    </select>
                </div>`;
            }

            if (c.type === 'date') {
                return `
                <div class="${widthClass}">
                    <label class="form-label small fw-bold text-muted">${Utils.EscapeHTML(c.label)}</label>
                    <input type="date" name="${Utils.EscapeHTML(c.key)}" class="form-control form-control-sm" value="${c.defaultVal || ''}">
                </div>`;
            }

            return `
            <div class="${widthClass}">
                <label class="form-label small fw-bold text-muted">${Utils.EscapeHTML(c.label)}</label>
                <input type="${c.type || 'text'}" name="${Utils.EscapeHTML(c.key)}" class="form-control form-control-sm" placeholder="${Utils.EscapeHTML(c.placeholder || '')}">
            </div>`;
        }).join('');
    }

    bindEvents() {
        const getEl = id => document.getElementById(`${this.containerId}_${id}`);

        // Execute query
        getEl('btnExecute')?.addEventListener('click', () => this.execute());

        // Reset criteria
        getEl('btnClearCriteria')?.addEventListener('click', () => {
            const form = getEl('criteriaForm');
            if (form) form.reset();
            this.activeCriteria = {};
        });

        // Fast in-table filter
        getEl('fastFilter')?.addEventListener('input', Utils.Debounce((e) => {
            this.searchQuery = e.target.value.toLowerCase().trim();
            this.applyLocalFilter();
        }, 200));

        // Page Size
        getEl('pageSize')?.addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value, 10);
            this.currentPage = 1;
            this.renderTable();
        });

        // Pagination buttons
        getEl('btnPrev')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderTable();
            }
        });

        getEl('btnNext')?.addEventListener('click', () => {
            const maxPage = Math.ceil(this.filteredData.length / this.pageSize);
            if (this.currentPage < maxPage) {
                this.currentPage++;
                this.renderTable();
            }
        });

        // Column chooser button
        getEl('btnCols')?.addEventListener('click', () => this.openColumnChooser());

        // Export CSV
        getEl('btnExportCSV')?.addEventListener('click', () => this.exportCSV());

        // Print view
        getEl('btnPrint')?.addEventListener('click', () => window.print());
    }

    /**
     * Read criteria form and fetch data via UniTaxCRUD
     */
    async execute() {
        const form = document.getElementById(`${this.containerId}_criteriaForm`);
        const criteria = {};
        if (form) {
            const formData = new FormData(form);
            for (const [k, v] of formData.entries()) {
                const val = v.trim();
                if (val !== '' && val !== 'ALL') {
                    criteria[k] = val;
                }
            }
        }

        this.activeCriteria = criteria;
        this.isLoading = true;
        this.renderLoading();

        try {
            // Criteria-first bounded query using UniTaxCRUD
            const result = await UniTaxCRUD.read(this.moduleKey, criteria, {
                includeDeleted: false
            });

            this.allData = result.data || [];
            this.applyLocalFilter();
        } catch (error) {
            console.error("Viewer fetch error:", error);
            this.renderError(error.message || "Failed to retrieve records.");
        } finally {
            this.isLoading = false;
        }
    }

    applyLocalFilter() {
        if (!this.searchQuery) {
            this.filteredData = [...this.allData];
        } else {
            this.filteredData = this.allData.filter(row => {
                return Object.values(row).some(val => {
                    if (val === null || val === undefined) return false;
                    if (typeof val === 'object') {
                        return Object.values(val).some(nested => String(nested).toLowerCase().includes(this.searchQuery));
                    }
                    return String(val).toLowerCase().includes(this.searchQuery);
                });
            });
        }

        this.currentPage = 1;
        this.renderTable();
    }

    renderLoading() {
        const tbody = document.getElementById(`${this.containerId}_tbody`);
        if (tbody) {
            tbody.innerHTML = `
            <tr>
                <td colspan="15" class="text-center py-5">
                    <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                    <span class="text-muted">Querying database for selected criteria...</span>
                </td>
            </tr>`;
        }
    }

    renderError(msg) {
        const tbody = document.getElementById(`${this.containerId}_tbody`);
        if (tbody) {
            tbody.innerHTML = `
            <tr>
                <td colspan="15" class="text-center py-5 text-danger">
                    <i class="bi bi-exclamation-triangle fs-3 d-block mb-2"></i>
                    <strong>Query Error:</strong> ${Utils.EscapeHTML(msg)}
                </td>
            </tr>`;
        }
    }

    renderTable() {
        const theadRow = document.getElementById(`${this.containerId}_theadRow`);
        const tbody = document.getElementById(`${this.containerId}_tbody`);
        const tfoot = document.getElementById(`${this.containerId}_tfoot`);
        const recordCount = document.getElementById(`${this.containerId}_recordCount`);
        const pageInfo = document.getElementById(`${this.containerId}_pageInfo`);
        const btnPrev = document.getElementById(`${this.containerId}_btnPrev`);
        const btnNext = document.getElementById(`${this.containerId}_btnNext`);

        const activeCols = this.columns.filter(c => this.selectedColumns.includes(c.key));

        // 1. Render Table Headers with Sorting
        if (theadRow) {
            theadRow.innerHTML = `
                <th width="3%" class="text-center ps-2">#</th>
                ${activeCols.map(col => {
                    const isSorted = this.sortKey === col.key;
                    const icon = isSorted ? (this.sortOrder === 'asc' ? 'bi-sort-up' : 'bi-sort-down') : 'bi-arrow-down-up opacity-25';
                    const align = col.align === 'end' ? 'text-end' : (col.align === 'center' ? 'text-center' : 'text-start');
                    return `
                    <th class="${align} user-select-none" style="cursor: pointer;" data-col="${col.key}">
                        ${Utils.EscapeHTML(col.label)} <i class="bi ${icon} ms-1" style="font-size: 10px;"></i>
                    </th>`;
                }).join('')}
            `;

            // Bind sort listeners
            theadRow.querySelectorAll('th[data-col]').forEach(th => {
                th.onclick = () => this.handleSort(th.getAttribute('data-col'));
            });
        }

        // 2. Empty State
        if (!this.filteredData || this.filteredData.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="${activeCols.length + 1}" class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>
                    No records found matching criteria.
                </td>
            </tr>`;
            if (tfoot) tfoot.style.display = 'none';
            if (recordCount) recordCount.innerText = '0 records';
            if (pageInfo) pageInfo.innerText = 'Showing 0 of 0';
            if (btnPrev) btnPrev.disabled = true;
            if (btnNext) btnNext.disabled = true;
            return;
        }

        // 3. Paginate
        const total = this.filteredData.length;
        const totalPages = Math.ceil(total / this.pageSize);
        const start = (this.currentPage - 1) * this.pageSize;
        const pageRecords = this.filteredData.slice(start, start + this.pageSize);

        // 4. Render Rows
        tbody.innerHTML = pageRecords.map((row, idx) => {
            const rowIndex = start + idx + 1;
            const cells = activeCols.map(col => {
                let val = row[col.key];
                if (val === undefined && row.header) {
                    val = row.header[col.key];
                }
                const formatted = col.formatter ? col.formatter(val, row) : (val !== undefined && val !== null ? Utils.EscapeHTML(val) : '-');
                const align = col.align === 'end' ? 'text-end font-mono' : (col.align === 'center' ? 'text-center' : 'text-start');
                return `<td class="${align}">${formatted}</td>`;
            }).join('');

            return `
            <tr data-id="${row.ID || ''}" style="cursor: pointer;">
                <td class="text-center ps-2 text-muted small">${rowIndex}</td>
                ${cells}
            </tr>`;
        }).join('');

        // 5. Bind Row Events
        tbody.querySelectorAll('tr[data-id]').forEach(tr => {
            const id = tr.getAttribute('data-id');
            const rowData = this.filteredData.find(r => r.ID === id);

            tr.onclick = (e) => {
                if (typeof this.onRowClick === 'function') this.onRowClick(rowData, e);
            };

            tr.ondblclick = (e) => {
                if (typeof this.onRowDblClick === 'function') this.onRowDblClick(rowData, e);
            };
        });

        // 6. Subtotals & Totals Row
        const numericCols = activeCols.filter(c => c.type === 'currency' || c.type === 'number');
        if (numericCols.length > 0 && tfoot) {
            tfoot.style.display = '';
            tfoot.innerHTML = `
            <tr>
                <td class="ps-3 text-uppercase small text-muted">Total</td>
                ${activeCols.map(col => {
                    if (col.type === 'currency' || col.type === 'number') {
                        const sum = this.filteredData.reduce((acc, r) => {
                            const val = r[col.key] ?? (r.header ? r.header[col.key] : 0);
                            return acc + Utils.ParseNumber(val);
                        }, 0);
                        const formatted = col.type === 'currency' ? Utils.FormatINR(sum, true) : sum.toFixed(2);
                        return `<td class="text-end font-mono fw-bold">${formatted}</td>`;
                    }
                    return `<td></td>`;
                }).join('')}
            </tr>`;
        } else if (tfoot) {
            tfoot.style.display = 'none';
        }

        // 7. Update Footer Status
        if (recordCount) recordCount.innerText = `${total} records`;
        if (pageInfo) pageInfo.innerText = `Showing ${start + 1} to ${Math.min(start + this.pageSize, total)} of ${total}`;
        if (btnPrev) btnPrev.disabled = this.currentPage <= 1;
        if (btnNext) btnNext.disabled = this.currentPage >= totalPages;
    }

    handleSort(colKey) {
        if (this.sortKey === colKey) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortKey = colKey;
            this.sortOrder = 'asc';
        }

        const isAsc = this.sortOrder === 'asc';
        this.filteredData.sort((a, b) => {
            const valA = a[colKey] ?? (a.header ? a.header[colKey] : '');
            const valB = b[colKey] ?? (b.header ? b.header[colKey] : '');
            const numA = Utils.ParseNumber(valA);
            const numB = Utils.ParseNumber(valB);

            if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
                return isAsc ? numA - numB : numB - numA;
            }
            return isAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        });

        this.renderTable();
    }

    openColumnChooser() {
        const modalEl = document.getElementById(`${this.containerId}_colModal`);
        if (!modalEl) return;

        const colList = document.getElementById(`${this.containerId}_colList`);
        if (colList) {
            colList.innerHTML = this.columns.map(col => {
                const isChecked = this.selectedColumns.includes(col.key);
                return `
                <label class="list-group-item d-flex align-items-center gap-2 cursor-pointer">
                    <input class="form-check-input me-1" type="checkbox" value="${col.key}" ${isChecked ? 'checked' : ''}>
                    <span>${Utils.EscapeHTML(col.label)}</span>
                    <span class="badge bg-light text-muted ms-auto small">${col.type || 'text'}</span>
                </label>`;
            }).join('');
        }

        // Search in columns
        const searchInput = document.getElementById(`${this.containerId}_colSearch`);
        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = (e) => {
                const q = e.target.value.toLowerCase();
                colList.querySelectorAll('.list-group-item').forEach(item => {
                    item.style.display = item.innerText.toLowerCase().includes(q) ? '' : 'none';
                });
            };
        }

        // Select All / Reset
        document.getElementById(`${this.containerId}_btnSelectAllCols`).onclick = () => {
            colList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        };
        document.getElementById(`${this.containerId}_btnResetCols`).onclick = () => {
            const defaults = this.columns.filter(c => c.defaultVisible !== false).map(c => c.key);
            colList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = defaults.includes(cb.value);
            });
        };

        // Apply
        document.getElementById(`${this.containerId}_btnApplyCols`).onclick = () => {
            const checked = Array.from(colList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            if (checked.length === 0) {
                alert('At least one column must be selected.');
                return;
            }
            this.selectedColumns = checked;
            const countEl = document.getElementById(`${this.containerId}_colCount`);
            if (countEl) countEl.innerText = checked.length;
            this.renderTable();
        };

        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    exportCSV() {
        const activeCols = this.columns.filter(c => this.selectedColumns.includes(c.key));
        Utils.ExportToCSV(this.title.replace(/\s+/g, '_'), this.filteredData, activeCols);
    }
}

window.UniTaxViewer = UniTaxViewer;
