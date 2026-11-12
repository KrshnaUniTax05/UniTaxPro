/**
 * UNITAX PRO - Central Financial Accounting & Drill-Down Engine
 * Interlinks: Balance Sheet, Profit & Loss, Trial Balance, GL Statements & Transactions
 */

window.UniTaxAccountingEngine = {
    _cache: null,
    _lastFetchTime: 0,
    _isSyncing: false,
    _listenersBound: false,
    _subscribers: new Set(),

    /**
     * Initialize real-time background Firebase database listeners.
     * Continuously updates data in the background with ZERO page reloads.
     */
    InitLiveListeners() {
        if (this._listenersBound) return;
        if (typeof firebase === 'undefined' || !firebase.database) return;
        this._listenersBound = true;

        try {
            const db = firebase.database();
            const wsUserId = String(localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid') || (typeof App !== 'undefined' && App.State && App.State.userId) || '').trim().replace(/^#/, '');

            let debounceTimer = null;
            // Suppress initial snapshot fires that Firebase RTDB executes immediately upon attaching .on('value')
            let isInitialSyncSuppressed = true;
            setTimeout(() => {
                isInitialSyncSuppressed = false;
            }, 2500);

            const scheduleBackgroundSync = () => {
                // Ignore initial snapshot storm from attaching listeners - prevents 1-2s duplicate reload!
                if (isInitialSyncSuppressed) return;
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.LoadWorkspaceData(true).catch(e => console.warn("Background workspace sync:", e));
                }, 1000);
            };

            // Bind real-time background listeners to transactions and masters
            db.ref('Transactions').on('value', () => scheduleBackgroundSync());
            if (wsUserId) {
                db.ref(`${wsUserId}/Transactions`).on('value', () => scheduleBackgroundSync());
            }
            db.ref('Masters/LedgerCreation').on('value', () => scheduleBackgroundSync());
            db.ref('Masters/Stock').on('value', () => scheduleBackgroundSync());
            db.ref('Masters/Companies').on('value', () => scheduleBackgroundSync());

            console.log("%c⚡ [AccountingEngine] Background Live Data Synchronization Active (Zero Page Reload)", "color: #10b981; font-weight: bold;");
        } catch (err) {
            console.warn("AccountingEngine live listener error:", err);
        }
    },

    /**
     * Subscribe to live workspace data changes.
     * Allows UI components to update dynamically in place without page reloads.
     */
    Subscribe(callback) {
        if (typeof callback !== 'function') return () => {};
        this._subscribers.add(callback);
        // Do NOT trigger immediate synthetic callback to avoid duplicate reload on mount
        return () => this._subscribers.delete(callback);
    },

    /**
     * Notify all subscribers and dispatch background custom event.
     */
    _NotifySubscribers() {
        if (!this._cache) return;
        try {
            document.dispatchEvent(new CustomEvent('unitax:workspace-data-updated', { detail: this._cache }));
        } catch (e) {}

        this._subscribers.forEach(cb => {
            try {
                cb(this._cache);
            } catch (err) {
                console.warn("Subscriber callback error:", err);
            }
        });
    },

    /**
     * Trigger a silent background refresh of workspace data.
     */
    TriggerBackgroundRefresh() {
        return this.LoadWorkspaceData(true).catch(e => console.warn("Background refresh error:", e));
    },

    /**
     * Fetch all masters and all transaction vouchers across the workspace.
     * Updates in the background silently - NEVER reloads the page.
     */
    async LoadWorkspaceData(forceRefresh = false) {
        // Ensure background listeners are active for continuous live sync
        if (!this._listenersBound) {
            this.InitLiveListeners();
        }

        // Return warm in-memory cache immediately if available and fresh
        if (!forceRefresh && this._cache) {
            return this._cache;
        }

        // Avoid parallel duplicate network requests
        if (this._isSyncing && this._cache) {
            return this._cache;
        }

        this._isSyncing = true;
        try {
            const [ledgers, stock, companies, rootTransactions] = await Promise.all([
                API.Fetch('Masters/LedgerCreation').catch(() => ({})),
                API.Fetch('Masters/Stock').catch(() => ({})),
                API.Fetch('Masters/Companies').catch(() => ({})),
                API.Fetch('Transactions').catch(() => ({}))
            ]);

            // Flatten all transactions from all forms into a unified list
            const transactions = [];
            if (rootTransactions && typeof rootTransactions === 'object') {
                Object.entries(rootTransactions).forEach(([formType, formRecords]) => {
                    if (formRecords && typeof formRecords === 'object') {
                        Object.entries(formRecords).forEach(([key, vch]) => {
                            if (!vch || typeof vch !== 'object') return;
                            const isDeleted = vch.is_deleted === true || (vch.header && vch.header.is_deleted === true) || vch.status === 'DELETED' || (vch.header && vch.header.status === 'DELETED');
                            const isDraftOrPending = vch.status === 'DRAFT' || vch.status === 'PENDING_APPROVAL' || (vch.header && (vch.header.status === 'DRAFT' || vch.header.status === 'PENDING_APPROVAL'));
                            if (!isDeleted && !isDraftOrPending) {
                                transactions.push({
                                    ...vch,
                                    key: key,
                                    formType: formType,
                                    header: vch.header || vch || {}
                                });
                            }
                        });
                    }
                });
            }

            this._cache = {
                ledgers: ledgers || {},
                stock: stock || {},
                companies: companies || {},
                transactions: transactions
            };
            this._lastFetchTime = Date.now();

            // Background notification without reloading page
            this._NotifySubscribers();

            return this._cache;
        } finally {
            this._isSyncing = false;
        }
    },

    /**
     * Compute comprehensive financial aggregates as of a target date
     */
    async ComputeFinancials(asOnDate = null) {
        const data = await this.LoadWorkspaceData();
        const cutoff = asOnDate || new Date().toISOString().split('T')[0];

        const ledgerMaster = data.ledgers;
        const txns = data.transactions;

        // Categorized transaction breakdown buckets for drill-down
        const buckets = {
            fixed_assets: [],
            debtors: [],
            stock: [],
            bank: [],
            cash: [],
            advances: [],
            capital: [],
            reserves: [],
            creditors: [],
            duties_taxes: [],
            current_liabilities: [],
            loans: [],
            sales: [],
            purchases: [],
            sales_returns: [],
            purchase_returns: [],
            operating_inflow: [],
            operating_outflow: [],
            direct_expenses: [],
            indirect_expenses: [],
            direct_incomes: [],
            indirect_incomes: []
        };

        // 1. Process Master Opening Balances
        let totalCapital = 0;
        let totalFixedAssets = 0;
        let totalDutiesTaxes = 0;
        let totalOpeningDebtors = 0;
        let totalOpeningCreditors = 0;
        let totalOpeningBank = 0;
        let totalOpeningCash = 0;

        Object.values(ledgerMaster).forEach(l => {
            if (!l || typeof l !== 'object') return;
            const name = (l.name || '').trim();
            const group = (l.ledgerType || l.ledgerGroup || '').trim().toLowerCase();
            const nature = (l.ledgerNature || '').trim().toLowerCase();
            const ob = parseFloat(l.openingBalance || 0) || 0;
            const balType = l.balanceType || (nature === 'credit' ? 'Cr' : 'Dr');

            if (ob !== 0) {
                const item = {
                    key: 'OB-' + (l.ledgerCode || name),
                    formType: 'OpeningBalance',
                    header: {
                        doc_no: 'OPENING-BAL',
                        posting_date: '0000-00-00',
                        date: '0000-00-00',
                        entity: name,
                        grandTotal: ob,
                        narration: `Opening balance for ${name}`,
                        posted_by_name: 'Master Data / Initial Balance'
                    },
                    debit: balType === 'Dr' ? ob : 0,
                    credit: balType === 'Cr' ? ob : 0
                };

                if (group.includes('capital') || group.includes('equity')) {
                    totalCapital += ob;
                    buckets.capital.push(item);
                } else if (group.includes('fixed asset')) {
                    totalFixedAssets += ob;
                    buckets.fixed_assets.push(item);
                } else if (group.includes('duty') || group.includes('tax')) {
                    totalDutiesTaxes += ob;
                    buckets.duties_taxes.push(item);
                } else if (group.includes('debtor')) {
                    totalOpeningDebtors += ob;
                    buckets.debtors.push(item);
                } else if (group.includes('creditor')) {
                    totalOpeningCreditors += ob;
                    buckets.creditors.push(item);
                } else if (group.includes('bank')) {
                    totalOpeningBank += ob;
                    buckets.bank.push(item);
                } else if (group.includes('cash')) {
                    totalOpeningCash += ob;
                    buckets.cash.push(item);
                }
            }
        });

        // 2. Process Stock Valuation
        let stockValuation = 0;
        Object.values(data.stock).forEach(s => {
            if (!s || typeof s !== 'object') return;
            const qty = parseFloat(s.openingQuantity || s.currentStock || s.quantity || 0) || 0;
            const rate = parseFloat(s.costPrice || s.purchaseRate || s.rate || 0) || 0;
            const val = qty * rate;
            stockValuation += val;
            if (val > 0) {
                buckets.stock.push({
                    key: 'STOCK-' + (s.Stock_Code || s.itemName),
                    formType: 'StockInventory',
                    header: {
                        doc_no: s.Stock_Code || 'STOCK',
                        posting_date: cutoff,
                        date: cutoff,
                        entity: s.itemName || 'Inventory Item',
                        grandTotal: val,
                        narration: `Inventory Valuation: ${qty} ${s.unit || 'units'} @ ₹${rate}`,
                        posted_by_name: 'Inventory Engine'
                    },
                    debit: val,
                    credit: 0
                });
            }
        });

        // 3. Process All Transactions
        let totalSales = 0;
        let totalPurchases = 0;
        let customerReceipts = 0;
        let supplierPayments = 0;
        let bankMovements = totalOpeningBank;
        let cashMovements = totalOpeningCash;
        let totalExpenses = 0;
        let totalOtherIncomes = 0;

        txns.forEach(vch => {
            const h = vch.header || {};
            const vchDate = h.posting_date || vch.posting_date || h.date || vch.date || h.voucher_date;
            if (vchDate && vchDate > cutoff) return;

            const formType = (vch.formType || '').toLowerCase();
            const amt = parseFloat(h.grandTotal || h.total_amount || h.amount || 0) || 0;
            const docNo = h.doc_no || h.Invoice || h.paymentRef || h.supplier_bill_no || 'VCH';
            const entity = h.entity || h.customer_ledger || h.supplier_ledger || h.gl_account || 'General Party';

            const item = {
                ...vch,
                docNo,
                entity,
                amount: amt,
                postingDate: vchDate || cutoff,
                postedBy: h.posted_by_name || 'Authorized User'
            };

            // Sales / Inward Supplies
            if (formType.includes('sale') && !formType.includes('return') && !formType.includes('creditnote')) {
                totalSales += amt;
                buckets.sales.push({ ...item, debit: 0, credit: amt });
                buckets.debtors.push({ ...item, debit: amt, credit: 0 });
            }
            // Credit Notes / Sales Return
            else if (formType.includes('salesreturn') || formType.includes('creditnote')) {
                totalSales -= amt;
                buckets.sales.push({ ...item, debit: amt, credit: 0 });
                buckets.sales_returns.push({ ...item, debit: amt, credit: 0 });
                buckets.debtors.push({ ...item, debit: 0, credit: amt });
            }
            // Purchases
            else if (formType.includes('purchase') && !formType.includes('return') && !formType.includes('debitnote')) {
                totalPurchases += amt;
                buckets.purchases.push({ ...item, debit: amt, credit: 0 });
                buckets.creditors.push({ ...item, debit: 0, credit: amt });
            }
            // Debit Notes / Purchase Return
            else if (formType.includes('purchasereturn') || formType.includes('debitnote')) {
                totalPurchases -= amt;
                buckets.purchases.push({ ...item, debit: 0, credit: amt });
                buckets.purchase_returns.push({ ...item, debit: 0, credit: amt });
                buckets.creditors.push({ ...item, debit: amt, credit: 0 });
            }
            // Customer Receipts
            else if (formType.includes('receipt') && !formType.includes('pay')) {
                customerReceipts += amt;
                buckets.debtors.push({ ...item, debit: 0, credit: amt });
                buckets.operating_inflow.push({ ...item, debit: 0, credit: amt });
                const gl = (h.gl_account || '').toLowerCase();
                if (gl.includes('cash')) {
                    cashMovements += amt;
                    buckets.cash.push({ ...item, debit: amt, credit: 0 });
                } else {
                    bankMovements += amt;
                    buckets.bank.push({ ...item, debit: amt, credit: 0 });
                }
            }
            // Vendor Payments
            else if (formType.includes('payment')) {
                supplierPayments += amt;
                buckets.creditors.push({ ...item, debit: amt, credit: 0 });
                buckets.operating_outflow.push({ ...item, debit: amt, credit: 0 });
                const gl = (h.gl_account || '').toLowerCase();
                if (gl.includes('cash')) {
                    cashMovements -= amt;
                    buckets.cash.push({ ...item, debit: 0, credit: amt });
                } else {
                    bankMovements -= amt;
                    buckets.bank.push({ ...item, debit: 0, credit: amt });
                }
            }
            // Cash / Bank Contra Movement
            else if (formType.includes('receiptpay')) {
                const isRec = (h.documentType || '').toUpperCase() === 'RECEIPT';
                if (isRec) {
                    bankMovements += amt;
                    buckets.bank.push({ ...item, debit: amt, credit: 0 });
                } else {
                    bankMovements -= amt;
                    buckets.bank.push({ ...item, debit: 0, credit: amt });
                }
            }
            // General Journal Voucher
            else if (formType.includes('journal')) {
                const lines = Array.isArray(vch.items) ? vch.items : (vch.items ? Object.values(vch.items) : []);
                lines.forEach(line => {
                    const amtDr = parseFloat(line.amount_dr || 0);
                    const amtCr = parseFloat(line.amount_cr || 0);
                    const lineAmt = amtDr || amtCr || parseFloat(line.amount || line.rate || 0) || 0;
                    const acc = line.offset_account || line.account || 'Journal Account';
                    const accLower = acc.toLowerCase();
                    const isDr = (line.drcr_type === 'DR' || amtDr > 0);

                    const lineItem = {
                        ...item,
                        entity: acc,
                        debit: isDr ? lineAmt : 0,
                        credit: !isDr ? lineAmt : 0
                    };

                    if (accLower.includes('capital') || accLower.includes('equity')) {
                        buckets.capital.push(lineItem);
                        totalCapital += (!isDr ? lineAmt : -lineAmt);
                    } else if (accLower.includes('asset') || accLower.includes('machine') || accLower.includes('plant') || accLower.includes('computer')) {
                        buckets.fixed_assets.push(lineItem);
                        totalFixedAssets += (isDr ? lineAmt : -lineAmt);
                    } else if (accLower.includes('bank')) {
                        buckets.bank.push(lineItem);
                        bankMovements += (isDr ? lineAmt : -lineAmt);
                    } else if (accLower.includes('cash')) {
                        buckets.cash.push(lineItem);
                        cashMovements += (isDr ? lineAmt : -lineAmt);
                    } else if (accLower.includes('debtor') || accLower.includes('customer')) {
                        buckets.debtors.push(lineItem);
                    } else if (accLower.includes('creditor') || accLower.includes('vendor')) {
                        buckets.creditors.push(lineItem);
                    } else if (accLower.includes('tax') || accLower.includes('duty') || accLower.includes('gst')) {
                        buckets.duties_taxes.push(lineItem);
                        totalDutiesTaxes += (!isDr ? lineAmt : -lineAmt);
                    }
                });
            }
        });

        // 4. Calculate Final Balances
        const finalDebtors = Math.max(0, totalOpeningDebtors + totalSales - customerReceipts);
        const finalCreditors = Math.max(0, totalOpeningCreditors + totalPurchases - supplierPayments);
        const retainedProfit = totalSales - totalPurchases - totalExpenses + totalOtherIncomes;

        const currentAssets = finalDebtors + stockValuation + Math.max(0, bankMovements) + Math.max(0, cashMovements);
        const totalAssets = totalFixedAssets + currentAssets;
        const totalLiabilities = totalCapital + retainedProfit + finalCreditors + totalDutiesTaxes;

        return {
            asOnDate: cutoff,
            totalAssets,
            totalLiabilities,
            fixedAssets: totalFixedAssets,
            debtors: finalDebtors,
            stockValuation: stockValuation,
            bankBalance: Math.max(0, bankMovements),
            cashBalance: Math.max(0, cashMovements),
            capital: totalCapital,
            retainedProfit,
            creditors: finalCreditors,
            dutiesTaxes: totalDutiesTaxes,
            totalSales,
            totalPurchases,
            buckets
        };
    }
};

/**
 * FINANCIAL DRILL-DOWN INSPECTION ENGINE
 * Interactive modal that reveals transaction source breakdown on double-click
 */
window.UniTaxDrilldown = {
    _modalEl: null,

    Init() {
        if (document.getElementById('financialDrilldownModal')) return;

        const modalHtml = `
            <div class="modal fade" id="financialDrilldownModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content border-0 shadow-lg">
                        <div class="modal-header bg-light border-bottom py-3 px-4">
                            <div>
                                <h5 class="fw-bold text-dark mb-0" id="drilldownTitle">
                                    <i class="bi bi-search text-primary me-2"></i>Financial Audit Breakdown
                                </h5>
                                <p class="text-muted small mb-0" id="drilldownSubtitle">Inspecting contributing transaction entries</p>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-primary fs-6 px-3 py-2 font-mono" id="drilldownAmountBadge">₹ 0.00</span>
                                <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal" title="Close">
                                    <i class="bi bi-x-lg"></i>
                                </button>
                            </div>
                        </div>

                        <div class="modal-body p-0">
                            <!-- Quick Filter Ribbon -->
                            <div class="p-3 bg-white border-bottom d-flex justify-content-between align-items-center gap-3">
                                <div class="input-group input-group-sm" style="max-width: 320px;">
                                    <span class="input-group-text bg-light border-end-0 text-muted"><i class="bi bi-search"></i></span>
                                    <input type="text" id="drilldownSearch" class="form-control border-start-0" placeholder="Filter by voucher, party..." oninput="UniTaxDrilldown.FilterRows()">
                                </div>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-sm btn-outline-primary" onclick="UniTaxDrilldown.OpenInGL()" title="Open Full Account in General Ledger">
                                        <i class="bi bi-journal-text me-1"></i> Open in Ledger
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="UniTaxDrilldown.ExportCSV()" title="Export contributing records to CSV">
                                        <i class="bi bi-download me-1"></i> Export CSV
                                    </button>
                                </div>
                            </div>

                            <!-- Transaction Records Grid -->
                            <div class="table-responsive">
                                <table class="table table-hover align-middle mb-0" style="width: 100%; font-size: 0.85rem;" id="drilldownTable">
                                    <thead class="table-light text-muted small text-uppercase sticky-top">
                                        <tr>
                                            <th style="width: 45px;" class="ps-3 text-center">#</th>
                                            <th style="width: 110px;">Posting Date</th>
                                            <th style="width: 140px;">Voucher No</th>
                                            <th style="width: 130px;">Voucher Type</th>
                                            <th>Counterparty / Account Entity</th>
                                            <th style="width: 130px;" class="text-end">Debit (₹)</th>
                                            <th style="width: 130px;" class="text-end">Credit (₹)</th>
                                            <th style="width: 160px;">Posted By</th>
                                            <th style="width: 70px;" class="text-center pe-3">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody id="drilldownTableBody">
                                        <!-- Injected dynamically -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="modal-footer bg-light py-2 px-4 justify-content-between">
                            <span class="small text-muted" id="drilldownRecordCount">0 records contributing to line total</span>
                            <button type="button" class="btn btn-sm btn-secondary px-3" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    currentRecords: [],
    currentTitle: '',

    async Open(title, categoryKey, lineAmount) {
        this.Init();
        const modalEl = document.getElementById('financialDrilldownModal');
        const modal = new bootstrap.Modal(modalEl);

        document.getElementById('drilldownTitle').innerHTML = `<i class="bi bi-search text-primary me-2"></i>Audit Breakdown: ${title}`;
        document.getElementById('drilldownSubtitle').innerText = `Double-click drill-down: All verified transactional postings contributing to this balance`;
        document.getElementById('drilldownAmountBadge').innerText = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(lineAmount || 0);

        this.currentTitle = title;
        const tbody = document.getElementById('drilldownTableBody');
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div> Extracting contributing transactions...</td></tr>`;
        modal.show();

        const financials = await UniTaxAccountingEngine.ComputeFinancials();
        const records = financials.buckets[categoryKey] || [];
        this.currentRecords = records;

        this.RenderTable(records);
    },

    RenderTable(records) {
        const tbody = document.getElementById('drilldownTableBody');
        tbody.innerHTML = '';

        if (!records || records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted">No underlying transactions found for this account balance.</td></tr>`;
            document.getElementById('drilldownRecordCount').innerText = '0 records';
            return;
        }

        const formatINR = (val) => val === 0 || !val ? '-' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

        records.forEach((rec, idx) => {
            const h = rec.header || {};
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.title = 'Click to open and inspect voucher';

            const formTypeClean = (rec.formType || 'Transaction').replace('Form', '');
            const postDate = rec.postingDate || h.posting_date || h.date || '-';
            const docNo = rec.docNo || h.doc_no || rec.key || '-';
            const entity = rec.entity || h.entity || '-';
            const dr = rec.debit || 0;
            const cr = rec.credit || 0;
            const poster = rec.postedBy || h.posted_by_name || 'System / Authorized';

            tr.innerHTML = `
                <td class="text-center text-muted fw-bold ps-3">${idx + 1}</td>
                <td class="font-mono small">${postDate}</td>
                <td class="font-mono fw-bold text-primary">${docNo}</td>
                <td><span class="badge bg-light text-dark border small">${formTypeClean}</span></td>
                <td class="fw-semibold text-dark">${entity}</td>
                <td class="text-end font-mono ${dr > 0 ? 'text-danger fw-bold' : 'text-muted'}">${formatINR(dr)}</td>
                <td class="text-end font-mono ${cr > 0 ? 'text-success fw-bold' : 'text-muted'}">${formatINR(cr)}</td>
                <td class="small text-muted"><i class="bi bi-person-circle me-1 text-primary"></i>${poster}</td>
                <td class="text-center pe-3">
                    <button class="btn btn-sm btn-primary py-0 px-2 fw-semibold" onclick="UniTaxDrilldown.OpenTransaction('${rec.formType}', '${rec.key}')" title="Inspect Document">
                        View
                    </button>
                </td>
            `;

            tr.ondblclick = () => UniTaxDrilldown.OpenTransaction(rec.formType, rec.key);
            tbody.appendChild(tr);
        });

        document.getElementById('drilldownRecordCount').innerText = `${records.length} transactions contributing to total`;
    },

    FilterRows() {
        const query = (document.getElementById('drilldownSearch')?.value || '').toLowerCase();
        const filtered = this.currentRecords.filter(r => {
            const str = JSON.stringify(r).toLowerCase();
            return str.includes(query);
        });
        this.RenderTable(filtered);
    },

    OpenTransaction(formType, key) {
        if (!key || key.startsWith('OB-') || key.startsWith('STOCK-')) {
            App.UI.Notify('Master Item', 'This balance originates from Master Setup or Stock valuation.', 'info');
            return;
        }

        // Close modal
        const modalEl = document.getElementById('financialDrilldownModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        // Navigate to edit/view mode
        localStorage.setItem('editContext', JSON.stringify({ type: formType, key: key }));
        App.Router(`transactions/edit?type=${formType}&key=${key}`);
    },

    OpenInGL() {
        const modalEl = document.getElementById('financialDrilldownModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        App.Router('reports/gl-statement');
    },

    ExportCSV() {
        if (!this.currentRecords || this.currentRecords.length === 0) return;
        let csv = 'SNo,PostingDate,VoucherNo,VoucherType,Entity,Debit,Credit,PostedBy\n';
        this.currentRecords.forEach((r, i) => {
            const h = r.header || {};
            csv += `"${i+1}","${r.postingDate || h.posting_date || ''}","${r.docNo || h.doc_no || ''}","${r.formType || ''}","${(r.entity || h.entity || '').replace(/"/g, '""')}","${r.debit || 0}","${r.credit || 0}","${(r.postedBy || h.posted_by_name || '').replace(/"/g, '""')}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Drilldown_${this.currentTitle.replace(/\s+/g, '_')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};
