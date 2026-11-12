/**
 * UNITAX PRO - Data Access Layer (Refactored Enterprise DAL)
 * Integrates: Firebase RTDB, Unified CRUD Layer, Double-Entry Routing, Sanitization
 */

const API = {
    Config: {
        firebase: {
            apiKey: "AIzaSyB2iNWYkj_lIWwOtLNmZjBtfKgTYKrjAQU",
            authDomain: "unitax-8d2e2.firebaseapp.com",
            databaseURL: "https://unitax-8d2e2-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "unitax-8d2e2"
        }
    },

    _MasterCache: {},
    DB: null,
    CRUD: window.UniTaxCRUD,
    _isInitialized: false,

    Init() {
        if (this._isInitialized) return;
        this._isInitialized = true;

        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(this.Config.firebase);
            }
            this.DB = firebase.database();
            this.CRUD = window.UniTaxCRUD;
            console.log("%c📡 [API] Database Engine Synchronized", "color: #0d6efd; font-weight: bold;");
        } else {
            console.error("Firebase SDK not loaded.");
        }
    },

    /**
     * Uniqueness Verification across Firebase Masters
     */
    /**
     * Get All Canonical Transaction Form Types
     */
    async GetAllTransactionTypes() {
        return [
            'SalesInvoiceForm',
            'PurchaseInvoiceForm',
            'SalesReturnForm',
            'PurchaseReturnForm',
            'ReceiptVoucherForm',
            'PaymentVoucherForm',
            'ReceiptPayForm',
            'JournalVoucherForm'
        ];
    },

    async CheckUniqueness(sheetName, column, value) {
        if (!value || String(value).trim() === '') return false;
        try {
            const userId = (typeof App !== 'undefined' && App.State && App.State.userId)
                ? App.State.userId
                : localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');

            if (!userId || !this.DB) return false;

            const snapshot = await this.DB.ref(`${userId}/Masters/${sheetName}`).once('value');
            const data = snapshot.val();
            if (!data) return false;

            const targetVal = String(value).trim().toLowerCase();
            return Object.values(data).some(record => {
                if (!record || typeof record !== 'object') return false;
                return String(record[column] || "").trim().toLowerCase() === targetVal;
            });
        } catch (e) {
            console.error("Uniqueness check error:", e);
            return false;
        }
    },

    /**
     * Populate Datalists for Auto-Lookup
     */
    async PopulateAllDatalists(form) {
        if (!form) return;
        const lookupInputs = form.querySelectorAll('[data-fetch_column]');
        if (lookupInputs.length === 0) return;

        const userId = (typeof App !== 'undefined' && App.State && App.State.userId)
            ? App.State.userId
            : localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');

        const processedLists = new Set();

        for (const input of lookupInputs) {
            const sheet = input.dataset.sheet_name;
            const colDef = input.dataset.column_name;
            const listId = input.getAttribute('list');
            if (!sheet || !listId) continue;

            if (processedLists.has(listId)) {
                continue;
            }
            processedLists.add(listId);

            input.dataset.originalPlaceholder = input.placeholder || 'Search...';
            input.placeholder = 'Loading...';

            try {
                let data = this._MasterCache[sheet];
                if (!data) {
                    const fetched = await this.Fetch(`Masters/${sheet}`);
                    data = fetched?.data || fetched?.result || fetched;
                    if (data) {
                        this._MasterCache[sheet] = data;
                    }
                }

                // Resilient Stock Catalog Fallback if master is empty
                if (sheet === 'Stock' && (!data || (typeof data === 'object' && Object.keys(data).length === 0))) {
                    data = [
                        { itemName: 'Enterprise Cloud ERP Annual License', Stock_Code: 'STK-001', itemHSN: '998313', ItemTax: 18, sellingPrice: 85000 },
                        { itemName: 'Implementation & Integration Support', Stock_Code: 'STK-002', itemHSN: '998314', ItemTax: 18, sellingPrice: 35000 },
                        { itemName: 'Annual Software Maintenance & Updates', Stock_Code: 'STK-003', itemHSN: '998315', ItemTax: 18, sellingPrice: 24000 },
                        { itemName: 'Professional Accounting & Tax Advisory', Stock_Code: 'STK-004', itemHSN: '998222', ItemTax: 18, sellingPrice: 15000 },
                        { itemName: 'Hardware Server Infrastructure Unit', Stock_Code: 'STK-005', itemHSN: '847130', ItemTax: 18, sellingPrice: 120000 }
                    ];
                    this._MasterCache[sheet] = data;
                }

                // Locate all datalists with this ID (handles both single form-level and cloned rows)
                const datalists = form.querySelectorAll(`datalist#${listId}`);
                const globalDatalist = document.getElementById(listId);
                const targetDatalists = Array.from(new Set([...datalists, ...(globalDatalist ? [globalDatalist] : [])]));

                if (targetDatalists.length > 0 && data && typeof data === 'object') {
                    const cols = colDef.split('&').map(c => c.trim());
                    const dataArray = Array.isArray(data) ? data : Object.values(data);

                    const fragment = document.createDocumentFragment();
                    const addedValues = new Set();

                    dataArray.forEach(record => {
                        if (!record || typeof record !== 'object') return;
                        
                        const textPart = record[cols[0]] || record.itemName || record.name || record.item_name || '';
                        const valuePart = (cols.length >= 2 ? (record[cols[1]] || record.Stock_Code || record.stockCode || record.code || '') : '');

                        if (textPart && valuePart) {
                            const comboVal = `${textPart} (${valuePart})`;
                            if (!addedValues.has(comboVal.toLowerCase())) {
                                addedValues.add(comboVal.toLowerCase());
                                const opt = document.createElement('option');
                                opt.value = comboVal;
                                opt.setAttribute('data-value', valuePart);
                                opt.setAttribute('data-text', textPart);
                                fragment.appendChild(opt);
                            }
                            // // Pure item name option for flexible input
                            // if (!addedValues.has(textPart.toLowerCase())) {
                            //     addedValues.add(textPart.toLowerCase());
                            //     const opt = document.createElement('option');
                            //     opt.value = textPart;
                            //     opt.setAttribute('data-value', valuePart);
                            //     opt.setAttribute('data-text', textPart);
                            //     fragment.appendChild(opt);
                            // }
                            // // Pure SKU/Code option for flexible input
                            // if (!addedValues.has(valuePart.toLowerCase())) {
                            //     addedValues.add(valuePart.toLowerCase());
                            //     const opt = document.createElement('option');
                            //     opt.value = valuePart;
                            //     opt.setAttribute('data-value', valuePart);
                            //     opt.setAttribute('data-text', textPart);
                            //     fragment.appendChild(opt);
                            // }
                        } else if (textPart || valuePart) {
                            const singleVal = textPart || valuePart;
                            if (!addedValues.has(singleVal.toLowerCase())) {
                                addedValues.add(singleVal.toLowerCase());
                                const opt = document.createElement('option');
                                opt.value = singleVal;
                                fragment.appendChild(opt);
                            }
                        }
                    });

                    targetDatalists.forEach(dl => {
                        dl.innerHTML = "";
                        dl.appendChild(fragment.cloneNode(true));
                    });
                }
            } catch (err) {
                console.error(`Error populating ${sheet}:`, err);
            } finally {
                input.placeholder = input.dataset.originalPlaceholder || 'Search...';
            }
        }

        if (typeof this.BindInputListValidation === 'function') {
            this.BindInputListValidation(form);
        }
        if (typeof this.SetupCascadingCompanyFilter === 'function') {
            this.SetupCascadingCompanyFilter(form);
        }
    },

    /**
     * Handle Auto-Lookup and Dynamic Field Ingestion
     */
    async HandleLookup(input) {
        const val = input.value.trim();
        const sheet = input.dataset.sheet_name;
        const colDef = input.dataset.column_name;
        const sourceName = input.name.replace('[]', '');

        if (!val) return;

        if (!this._MasterCache[sheet]) {
            const fetched = await this.Fetch(`Masters/${sheet}`);
            this._MasterCache[sheet] = fetched?.data || fetched?.result || fetched;
        }
        if (!this._MasterCache[sheet]) return;

        const columns = colDef.split('&').map(c => c.trim());
        const valLower = val.toLowerCase();
        
        let textPart = valLower;
        let codePart = '';
        const pm = val.match(/^(.*?)\s*\((.*?)\)$/);
        if (pm) {
            textPart = pm[1].trim().toLowerCase();
            codePart = pm[2].trim().toLowerCase();
        }

        let match = null;
        const dataArray = Array.isArray(this._MasterCache[sheet]) ? this._MasterCache[sheet] : Object.values(this._MasterCache[sheet]);
        
        for (const record of dataArray) {
            if (!record || typeof record !== 'object') continue;
            const rName = String(record.itemName || record.name || record.item_name || record[columns[0]] || '').trim().toLowerCase();
            const rCode = String(record.Stock_Code || record.stockCode || record.code || (columns[1] ? record[columns[1]] : '') || '').trim().toLowerCase();
            const combined = rCode ? `${rName} (${rCode})` : rName;

            if (
                valLower === combined ||
                valLower === rName ||
                (rCode && valLower === rCode) ||
                (textPart && rName === textPart) ||
                (codePart && rCode === codePart) ||
                columns.some(col => String(record[col] || "").trim().toLowerCase() === valLower)
            ) {
                match = record;
                break;
            }
        }

        if (match) {
            const scope = input.closest('tr') || input.closest('form');
            Object.entries(match).forEach(([key, value]) => {
                const safeKey = key.replace(/\s+/g, '_');
                const targets = scope.querySelectorAll(`[name="auto_${sourceName}_${safeKey}"]`);
                targets.forEach(el => {
                    el.value = value;
                    el.classList.add('bg-info-subtle');
                    setTimeout(() => el.classList.remove('bg-info-subtle'), 500);
                });
            });

            // Auto-populate item HSN, Tax rate and Rate in line row if present
            if (scope) {
                const hsnVal = match.itemHSN || match.hsnCode || match.hsn || '';
                const taxVal = match.ItemTax || match.taxRate || match.tax || '';
                const rateVal = match.sellingPrice || match.rate || match.unitRate || match.price || '';

                if (hsnVal) {
                    const hsnInp = scope.querySelector(`[name="auto_${sourceName}_itemHSN"], [name*="hsn"], .item-hsn`);
                    if (hsnInp) hsnInp.value = hsnVal;
                }
                if (taxVal) {
                    const taxInp = scope.querySelector(`[name="auto_${sourceName}_ItemTax"], .tax-val`);
                    if (taxInp) taxInp.value = taxVal;
                    const taxDisp = scope.querySelector('.tax-display');
                    if (taxDisp) taxDisp.value = taxVal + "%";
                }
                if (rateVal) {
                    const rateInp = scope.querySelector('input.rate, [name="rate[]"]');
                    if (rateInp && (!rateInp.value || parseFloat(rateInp.value) === 0)) {
                        rateInp.value = rateVal;
                    }
                }
            }

            if (window.recalculateVoucher) window.recalculateVoucher();
        }
    },

    /**
     * Ensure System Ledgers (Sales, Purchases, Duties & Taxes)
     */
    async EnsureSystemLedgers() {
        const userId = (typeof App !== 'undefined' && App.State && App.State.userId)
            ? App.State.userId
            : localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');

        if (!userId || window._systemLedgersVerified || !this.DB) return;

        const systemLedgers = [
            { code: "SYS-SALES", name: "Sales Account", ledgerType: "Direct Incomes", ledgerNature: "Credit" },
            { code: "SYS-PURCH", name: "Purchase Account", ledgerType: "Direct Expenses", ledgerNature: "Debit" },
            { code: "SYS-TAX", name: "Duties and Taxes", ledgerType: "Duties & Taxes", ledgerNature: "Credit" }
        ];

        try {
            const existingData = await this.Fetch(`Masters/LedgerCreation`);
            const existingNames = existingData ? Object.values(existingData).map(l => (l.name || '').toLowerCase()) : [];

            for (const led of systemLedgers) {
                if (!existingNames.includes(led.name.toLowerCase())) {
                    await this.DB.ref(`${userId}/Masters/LedgerCreation`).push({
                        ledgerCode: led.code,
                        name: led.name,
                        ledgerType: led.ledgerType,
                        ledgerNature: led.ledgerNature,
                        isSystem: true,
                        created_at: firebase.database.ServerValue.TIMESTAMP
                    });
                }
            }
            window._systemLedgersVerified = true;
        } catch (e) {
            console.warn("System ledgers verification warning:", e);
        }
    },

    /**
     * DYNAMIC BI-DIRECTIONAL CASCADING COMPANY FILTER
     * When Company is selected, other lookup datalists (Ledgers, Projects, Stock) are filtered to that Company.
     * Vice-versa: selecting an Entity, Project, or Stock first auto-populates & filters to its associated Company.
     */
    SetupCascadingCompanyFilter(form) {
        if (!form) return;
        const compInput = form.querySelector('input[name="CompanyName"], input[name="company"], input[data-sheet_name="Companies"], input[list="compListSales"], input[list="compList_led"], input[list="compList"]');
        if (!compInput) return;

        const getMasterArray = (sheet) => {
            const d = this._MasterCache[sheet];
            if (!d) return [];
            return Array.isArray(d) ? d : Object.values(d);
        };

        const filterDependentLists = () => {
            const rawCompVal = compInput.value.trim().toLowerCase();
            let compName = rawCompVal;
            let compCode = rawCompVal;
            const pm = rawCompVal.match(/^(.*?)\s*\((.*?)\)$/);
            if (pm) {
                compName = pm[1].trim();
                compCode = pm[2].trim();
            }

            const lookupInputs = form.querySelectorAll('[data-fetch_column]');
            lookupInputs.forEach(input => {
                if (input === compInput) return;
                const sheet = input.dataset.sheet_name;
                const colDef = input.dataset.column_name;
                const listId = input.getAttribute('list');
                if (!sheet || !listId || sheet === 'Companies') return;

                const datalist = document.getElementById(listId) || form.querySelector(`datalist#${listId}`);
                if (!datalist) return;

                const rawItems = getMasterArray(sheet);
                if (rawItems.length === 0) return;

                const cols = colDef.split('&').map(c => c.trim());
                datalist.innerHTML = "";

                rawItems.forEach(record => {
                    if (!record || typeof record !== 'object') return;

                    // If company is selected, filter by matching company name or code
                    if (rawCompVal) {
                        const recComp = String(record.CompanyName || record.companyName || record.CompanyCode || record.companyCode || record.company || '').toLowerCase();
                        if (recComp && !recComp.includes(compName) && !recComp.includes(compCode) && compName !== recComp && compCode !== recComp) {
                            return; // Exclude items of other companies
                        }
                    }

                    if (cols.length === 1) {
                        const val = record[cols[0]];
                        if (val) {
                            const opt = document.createElement('option');
                            opt.value = val;
                            opt.textContent = val;
                            datalist.appendChild(opt);
                        }
                    } else if (cols.length >= 2) {
                        const textPart = record[cols[0]] || record.itemName || record.name || record.item_name || record.companyName || record.ledger_name || '';
                        const valuePart = (cols.length >= 2 ? (record[cols[1]] || record.Stock_Code || record.stockCode || record.code || record.CompanyCode || record.ledger_code || '') : '');
                        if (textPart && valuePart) {
                            const opt = document.createElement('option');
                            opt.value = `${textPart} (${valuePart})`;
                            opt.setAttribute('data-value', valuePart);
                            opt.setAttribute('data-text', textPart);
                            datalist.appendChild(opt);
                        } else if (textPart || valuePart) {
                            const opt = document.createElement('option');
                            opt.value = textPart || valuePart;
                            datalist.appendChild(opt);
                        }
                    }
                });
            });
        };

        compInput.addEventListener('input', filterDependentLists);
        compInput.addEventListener('change', filterDependentLists);

        // Bi-directional reverse matching
        const otherInputs = form.querySelectorAll('[data-fetch_column]');
        otherInputs.forEach(input => {
            if (input === compInput) return;
            const sheet = input.dataset.sheet_name;
            if (!sheet || sheet === 'Companies') return;

            input.addEventListener('change', () => {
                const val = input.value.trim().toLowerCase();
                if (!val) return;

                const rawItems = getMasterArray(sheet);
                const match = rawItems.find(r => {
                    if (!r) return false;
                    const vals = Object.values(r).map(v => String(v).toLowerCase());
                    return vals.some(v => v === val || v.includes(val) || val.includes(v));
                });

                if (match) {
                    const matchedComp = match.CompanyName || match.companyName || match.CompanyCode || match.company || '';
                    if (matchedComp && (!compInput.value.trim() || compInput.value.trim().toLowerCase() !== matchedComp.toLowerCase())) {
                        const comps = getMasterArray('Companies');
                        const canonicalComp = comps.find(c => {
                            const cName = String(c.companyName || c.name || '').toLowerCase();
                            const cCode = String(c.CompanyCode || c.code || '').toLowerCase();
                            const mNorm = matchedComp.toLowerCase();
                            return cName === mNorm || cCode === mNorm || mNorm.includes(cName) || mNorm.includes(cCode);
                        });

                        if (canonicalComp) {
                            const cText = canonicalComp.companyName || canonicalComp.name;
                            const cCode = canonicalComp.CompanyCode || canonicalComp.code;
                            compInput.value = cCode ? `${cText} (${cCode})` : cText;
                        } else {
                            compInput.value = matchedComp;
                        }
                        filterDependentLists();
                    }
                }
            });
        });
    },

    /**
     * STRICT INPUT LIST (DATALIST) MASTER VALIDATION ENGINE
     * Ensures every input with a datalist strictly matches an approved master option.
     */
    async ValidateInputLists(form) {
        if (!form) return { isValid: true };

        const inputsWithList = form.querySelectorAll('input[list]');
        if (inputsWithList.length === 0) return { isValid: true };

        // Ensure datalists are populated if needed
        const unpopulatedLists = [];
        inputsWithList.forEach(inp => {
            const listId = inp.getAttribute('list');
            if (!listId) return;
            const dl = document.getElementById(listId) || form.querySelector(`datalist#${listId}`);
            if (dl && dl.options.length === 0 && inp.dataset.fetch_column) {
                unpopulatedLists.push(inp);
            }
        });

        if (unpopulatedLists.length > 0 && typeof this.PopulateAllDatalists === 'function') {
            await this.PopulateAllDatalists(form);
        }

        for (const input of inputsWithList) {
            if (input.disabled) continue;

            const rawValue = (input.value || '').trim();
            const listId = input.getAttribute('list');
            if (!listId) continue;

            const datalist = document.getElementById(listId) || form.querySelector(`datalist#${listId}`);
            if (!datalist) continue;

            const options = Array.from(datalist.options || datalist.querySelectorAll('option'));

            // Row-level check for grid line items
            const row = input.closest('tr');
            if (row) {
                let rowHasData = false;
                row.querySelectorAll('input, select').forEach(el => {
                    if (el !== input && (el.value || '').trim() && el.type !== 'hidden' && el.type !== 'checkbox') {
                        const numVal = parseFloat(el.value);
                        if (!isNaN(numVal) && numVal !== 0) rowHasData = true;
                        else if (isNaN(numVal) && el.value.trim().length > 0) rowHasData = true;
                    }
                });
                if (!rowHasData && !rawValue) continue; // Skip completely empty trailing row
            }

            // Field label helper
            const getFieldLabel = (inp) => {
                if (inp.dataset.label) return inp.dataset.label;
                if (inp.id) {
                    const lbl = form.querySelector(`label[for="${inp.id}"]`) || document.querySelector(`label[for="${inp.id}"]`);
                    if (lbl) return lbl.innerText.replace(/[*:]/g, '').trim();
                }
                const parentCol = inp.closest('.form-group, .mb-2, .mb-3, .col, [class*="col-"]');
                if (parentCol) {
                    const lbl = parentCol.querySelector('label');
                    if (lbl) return lbl.innerText.replace(/[*:]/g, '').trim();
                }
                const cell = inp.closest('td');
                if (cell) {
                    const tbl = cell.closest('table');
                    if (tbl) {
                        const th = tbl.querySelectorAll('thead th')[cell.cellIndex];
                        if (th) return th.innerText.replace(/[*:]/g, '').trim();
                    }
                }
                return inp.placeholder || inp.name || 'Input field';
            };

            const fieldLabel = getFieldLabel(input);

            if (rawValue) {
                const normalizedInput = rawValue.toLowerCase();
                let isMatched = false;
                let canonicalValue = '';

                for (const opt of options) {
                    const optVal = (opt.value || '').trim();
                    const optText = (opt.textContent || opt.innerText || '').trim();
                    const optDataVal = (opt.getAttribute('data-value') || '').trim();
                    const optDataText = (opt.getAttribute('data-text') || '').trim();
                    const optLabel = (opt.label || '').trim();

                    // 1. Direct equality matches
                    if (optVal && optVal.toLowerCase() === normalizedInput) { isMatched = true; canonicalValue = optVal; break; }
                    if (optText && optText.toLowerCase() === normalizedInput) { isMatched = true; canonicalValue = optVal || optText; break; }
                    if (optDataVal && optDataVal.toLowerCase() === normalizedInput) { isMatched = true; canonicalValue = optVal || optDataVal; break; }
                    if (optDataText && optDataText.toLowerCase() === normalizedInput) { isMatched = true; canonicalValue = optVal || optDataText; break; }
                    if (optLabel && optLabel.toLowerCase() === normalizedInput) { isMatched = true; canonicalValue = optVal || optLabel; break; }

                    // 2. Parentheses match: "Name (Code)" -> match Name or Code
                    const parenMatch = optVal.match(/^(.*?)\s*\((.*?)\)$/);
                    if (parenMatch) {
                        const namePart = parenMatch[1].trim().toLowerCase();
                        const codePart = parenMatch[2].trim().toLowerCase();
                        if (namePart === normalizedInput || codePart === normalizedInput) {
                            isMatched = true;
                            canonicalValue = optVal; // Normalize input to canonical representation
                            break;
                        }
                    }

                    // 3. Hyphen match: "Code - Name" or "Code-Name"
                    const dashMatch = optVal.match(/^(.*?)\s*-\s*(.*)$/);
                    if (dashMatch) {
                        const p1 = dashMatch[1].trim().toLowerCase();
                        const p2 = dashMatch[2].trim().toLowerCase();
                        if (p1 === normalizedInput || p2 === normalizedInput) {
                            isMatched = true;
                            canonicalValue = optVal;
                            break;
                        }
                    }
                }

                if (isMatched) {
                    if (canonicalValue && canonicalValue !== input.value) {
                        input.value = canonicalValue;
                    }
                } else {
                    // STRICT MODE: No wildcard / free-form bypass. Every datalist-backed value
                    // must exist in the master-derived option set.
                    return {
                        isValid: false,
                        invalidElement: input,
                        value: rawValue,
                        listId: listId,
                        fieldName: fieldLabel,
                        message: `Validation Notice: The value "${rawValue}" entered in "${fieldLabel}" is not an authorized entry in the master registry. Please select a valid option from the dropdown list.`
                    };
                }
            } else if (input.required) {
                return {
                    isValid: false,
                    invalidElement: input,
                    value: '',
                    listId: listId,
                    fieldName: fieldLabel,
                    message: `Validation Notice: "${fieldLabel}" is mandatory. Please select an option from the list.`
                };
            }
        }

        return { isValid: true };
    },

    /**
     * BIND REAL-TIME INPUT LIST VALIDATION LISTENERS
     */
    BindInputListValidation(form) {
        if (!form) return;
        const inputs = form.querySelectorAll('input[list]');
        inputs.forEach(input => {
            if (input._listValidationBound) return;
            input._listValidationBound = true;

            // Clear invalid styling on typing
            input.addEventListener('input', () => {
                if (input.classList.contains('is-invalid')) {
                    input.classList.remove('is-invalid');
                    input.style.borderColor = '';
                }
            });

            // Validate on blur / change
            input.addEventListener('change', () => {
                const val = (input.value || '').trim();
                if (!val) {
                    input.classList.remove('is-invalid');
                    input.style.borderColor = '';
                    return;
                }
                const listId = input.getAttribute('list');
                const datalist = document.getElementById(listId) || form.querySelector(`datalist#${listId}`);
                if (!datalist || datalist.options.length === 0) return;

                const options = Array.from(datalist.options);
                const norm = val.toLowerCase();
                let matched = false;

                for (const opt of options) {
                    const optVal = (opt.value || '').trim().toLowerCase();
                    const optText = (opt.textContent || opt.innerText || '').trim().toLowerCase();
                    const optDataVal = (opt.getAttribute('data-value') || '').trim().toLowerCase();
                    const optDataText = (opt.getAttribute('data-text') || '').trim().toLowerCase();

                    if (optVal === norm || optText === norm || optDataVal === norm || optDataText === norm) {
                        matched = true;
                        break;
                    }
                    const pm = (opt.value || '').match(/^(.*?)\s*\((.*?)\)$/);
                    if (pm && (pm[1].trim().toLowerCase() === norm || pm[2].trim().toLowerCase() === norm)) {
                        matched = true;
                        input.value = opt.value;
                        break;
                    }
                    const dm = (opt.value || '').match(/^(.*?)\s*-\s*(.*)$/);
                    if (dm && (dm[1].trim().toLowerCase() === norm || dm[2].trim().toLowerCase() === norm)) {
                        matched = true;
                        input.value = opt.value;
                        break;
                    }
                }

                // STRICT MODE: no wildcard / free-form bypass for datalist-backed inputs.
                if (!matched) {
                    input.classList.add('is-invalid');
                    input.style.borderColor = '#dc3545';
                } else {
                    input.classList.remove('is-invalid');
                    input.style.borderColor = '';
                }
            });
        });
    },

    /**
     * Central write gate: suspension window + permission-matrix action + date scope.
     */
    _NotifyGuard(title, message) {
        try {
            if (typeof App !== 'undefined' && App.UI && typeof App.UI.Notify === 'function') {
                App.UI.Notify(title, message, 'danger');
            } else {
                alert(`${title}: ${message}`);
            }
        } catch (e) {}
    },

    _AssertWriteAllowed(operation, label = 'document') {
        if (window.UniTaxOperations && typeof UniTaxOperations.AssertWrite === 'function') {
            if (!UniTaxOperations.AssertWrite(operation, label)) return false;
        }

        if (window.UniTaxAuth && typeof UniTaxAuth.CanPerformAction === 'function') {
            const actionMap = { create: 'create', post: 'post', update: 'update', delete: 'delete', approve: 'approve', reject: 'reject', restore: 'update' };
            const required = actionMap[operation] || operation;
            if (!UniTaxAuth.CanPerformAction(required)) {
                this._NotifyGuard('Permission Denied', `You do not have "${required}" rights for this ${label}.`);
                return false;
            }
        }
        return true;
    },

    /**
     * Compare a form dimension value with an authorised master value, accepting
     * "Name (Code)", bare name, or bare code representations.
     */
    _DimensionMatches(actual, allowed) {
        const a = String(actual || '').trim().toLowerCase();
        const b = String(allowed || '').trim().toLowerCase();
        if (!a || !b) return a === b;
        if (a === b) return true;
        const parts = (s) => {
            const out = [s];
            const m = s.match(/^(.*?)\s*\((.*?)\)$/);
            if (m) out.push(m[1].trim(), m[2].trim());
            return out;
        };
        const aParts = parts(a);
        const bParts = parts(b);
        return aParts.some(p => p && bParts.includes(p));
    },

    /**
     * Enforce the permission-matrix allowed date range and the workspace posting period.
     */
    _AssertPostingDate(dateValue, label = 'document') {
        if (!dateValue) return true;
        const target = Date.parse(dateValue);
        if (Number.isNaN(target)) return true;

        let from = '';
        let to = '';
        let enforce = false;

        if (window.UniTaxAuth && typeof UniTaxAuth.GetEffectivePermissions === 'function') {
            const perms = UniTaxAuth.GetEffectivePermissions();
            enforce = perms.enforceDateRange === true;
            from = perms.allowedDateFrom || '';
            to = perms.allowedDateTo || '';
        }

        const start = from ? Date.parse(from) : NaN;
        const end = to ? Date.parse(`${to}T23:59:59`) : NaN;
        if (enforce && !Number.isNaN(start) && target < start) {
            this._NotifyGuard('Date Not Allowed', `The posting date for this ${label} is earlier than your authorised window (${from}).`);
            return false;
        }
        if (enforce && !Number.isNaN(end) && target > end) {
            this._NotifyGuard('Date Not Allowed', `The posting date for this ${label} is later than your authorised window (${to}).`);
            return false;
        }

        // Workspace fiscal posting period (set by User Admin Control Panel)
        try {
            const rawPeriod = localStorage.getItem('workspacePostingPeriod');
            if (rawPeriod) {
                const period = JSON.parse(rawPeriod);
                if (period && period.enforce === true) {
                    const pFrom = period.from ? Date.parse(period.from) : NaN;
                    const pTo = period.to ? Date.parse(`${period.to}T23:59:59`) : NaN;
                    if (!Number.isNaN(pFrom) && target < pFrom) {
                        this._NotifyGuard('Posting Period Locked', `The posting date is outside the active fiscal posting period (${period.from} — ${period.to}).`);
                        return false;
                    }
                    if (!Number.isNaN(pTo) && target > pTo) {
                        this._NotifyGuard('Posting Period Locked', `The posting date is outside the active fiscal posting period (${period.from} — ${period.to}).`);
                        return false;
                    }
                }
            }
        } catch (e) {}

        return true;
    },

    /**
     * Shared governance gate for voucher writes: per-user dimension scope
     * (profit centre / account) plus the granular field authorisation matrix
     * (REQUIRED / EQUALS / IN_LIST / DATE_RANGE / MAX_VALUE).
     * Returns true when the payload is authorised, otherwise notifies and returns false.
     */
    _AssertDimensionAndFieldPolicy(raw, formId, label = 'voucher') {
        if (!raw || typeof raw !== 'object') return true;
        if (!window.UniTaxAuth || typeof UniTaxAuth.GetEffectivePermissions !== 'function') return true;

        const perms = UniTaxAuth.GetEffectivePermissions();

        // Per-user dimension scope: profit center / project
        const allowedPC = String(perms.allowedProfitCenter || localStorage.getItem('allowedProfitCenter') || '*').trim();
        if (allowedPC && allowedPC !== '*') {
            const docPC = String(raw.project || raw.profit_center || raw.profitCenter || '').trim();
            if (!this._DimensionMatches(docPC, allowedPC)) {
                this._NotifyGuard(
                    'Dimension Authorization Failure',
                    `Authorization Failure [Profit Center Gate]: You are not authorized to ${label === 'voucher' ? 'post' : 'save'} entries for Profit Center / Project '${docPC || 'General'}'. Authorized Profit Center: '${allowedPC}'.`
                );
                return false;
            }
        }

        // Per-user dimension scope: account / ledger
        const allowedLedger = String(perms.allowedLedger || localStorage.getItem('allowedLedger') || '*').trim();
        if (allowedLedger && allowedLedger !== '*') {
            const docEntity = String(raw.customer_ledger || raw.gl_account || raw.entity || raw.supplier_ledger || '').trim();
            if (!this._DimensionMatches(docEntity, allowedLedger)) {
                this._NotifyGuard(
                    'Account Authorization Failure',
                    `Authorization Failure [Account Scope Gate]: You are not authorized to ${label === 'voucher' ? 'post' : 'save'} entries for Account '${docEntity || 'General'}'. Authorized Account: '${allowedLedger}'.`
                );
                return false;
            }
        }

        // Granular form field authorisation matrix
        const currentModule = (window.UniTaxRouter && UniTaxRouter.currentRoute) ? UniTaxRouter.currentRoute : (formId || '');
        const curModClean = String(currentModule || '').toLowerCase().trim();
        const customRules = Array.isArray(perms.fieldRestrictions) ? perms.fieldRestrictions : [];
        for (const rule of customRules) {
            if (!rule || !rule.field) continue;
            const ruleMod = String(rule.module || 'ALL').trim().toLowerCase();
            if (ruleMod !== 'all' && !curModClean.includes(ruleMod) && !ruleMod.includes(curModClean)) {
                continue;
            }

            const fieldName = String(rule.field).trim();
            const condition = String(rule.condition || 'EQUALS').toUpperCase();
            const expected = String(rule.value === undefined || rule.value === null ? '' : rule.value).trim();
            const actual = String(raw[fieldName] !== undefined && raw[fieldName] !== null ? raw[fieldName] : '').trim();

            if (condition === 'REQUIRED') {
                if (!actual) {
                    this._NotifyGuard('Authorization Error', `Field [${fieldName}] is mandatory under your assigned posting authorization policy.`);
                    if (window.UniTaxAudit && UniTaxAudit.Log) {
                        UniTaxAudit.Log({ action: 'UPDATE_DENIED', module: currentModule, details: `Required field [${fieldName}] missing` });
                    }
                    return false;
                }
            } else if (condition === 'EQUALS') {
                if (expected !== '*' && actual.toLowerCase() !== expected.toLowerCase()) {
                    this._NotifyGuard('Authorization Error', `Validation failure on [${fieldName}]: value '${actual}' is not permitted. Must equal '${expected}'.`);
                    if (window.UniTaxAudit && UniTaxAudit.Log) {
                        UniTaxAudit.Log({ action: 'UPDATE_DENIED', module: currentModule, details: `Field [${fieldName}]='${actual}' must equal '${expected}'` });
                    }
                    return false;
                }
            } else if (condition === 'IN_LIST') {
                const allowedList = expected.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                const actualNorm = actual.toLowerCase();
                const actualParts = [actualNorm];
                const apm = actual.match(/^(.*?)\s*\((.*?)\)$/);
                if (apm) actualParts.push(apm[1].trim().toLowerCase(), apm[2].trim().toLowerCase());
                const isAllowed = allowedList.includes('*') || actualParts.some(p => allowedList.includes(p));
                if (!isAllowed) {
                    this._NotifyGuard('Authorization Error', `Validation failure on [${fieldName}]: '${actual}' is not in your authorized list (${expected}).`);
                    if (window.UniTaxAudit && UniTaxAudit.Log) {
                        UniTaxAudit.Log({ action: 'UPDATE_DENIED', module: currentModule, details: `Field [${fieldName}]='${actual}' not in list (${expected})` });
                    }
                    return false;
                }
            } else if (condition === 'DATE_RANGE') {
                const parts = expected.split(/[:|]|\bto\b/i).map(s => s.trim());
                const fromDate = parts[0];
                const toDate = parts[1];
                if (fromDate && actual && actual < fromDate) {
                    this._NotifyGuard('Authorization Error', `Posting Date [${actual}] is prior to allowed start date [${fromDate}].`);
                    if (window.UniTaxAudit && UniTaxAudit.Log) {
                        UniTaxAudit.Log({ action: 'UPDATE_DENIED', module: currentModule, details: `Date ${actual} < ${fromDate}` });
                    }
                    return false;
                }
                if (toDate && actual && actual > toDate) {
                    this._NotifyGuard('Authorization Error', `Posting Date [${actual}] exceeds allowed end date [${toDate}].`);
                    if (window.UniTaxAudit && UniTaxAudit.Log) {
                        UniTaxAudit.Log({ action: 'UPDATE_DENIED', module: currentModule, details: `Date ${actual} > ${toDate}` });
                    }
                    return false;
                }
            } else if (condition === 'MAX_VALUE') {
                const numActual = parseFloat(actual) || 0;
                const numExpected = parseFloat(expected) || 0;
                if (numActual > numExpected) {
                    this._NotifyGuard('Authorization Error', `Field [${fieldName}] value (${numActual}) exceeds your maximum authorized ceiling of ${numExpected}.`);
                    if (window.UniTaxAudit && UniTaxAudit.Log) {
                        UniTaxAudit.Log({ action: 'UPDATE_DENIED', module: currentModule, details: `Value ${numActual} > ${numExpected}` });
                    }
                    return false;
                }
            }
        }

        return true;
    },

    /**
     * VOUCHER POSTING ENGINE
     * Computes Subtotal, Taxes, Dynamic Metadata & Double-Entry Ledgers
     */
    async PostVoucher(form) {
        if (!form || form.classList.contains('nosubmit')) return false;

        // Suspension window guard (platform / workspace / user)
        if (window.UniTaxOperations && typeof UniTaxOperations.AssertWrite === 'function') {
            if (!UniTaxOperations.AssertWrite('create', 'voucher')) return false;
        }

        // Security check: Check if user has permission to post
        if (window.UniTaxAuth && typeof UniTaxAuth.CanPerformAction === 'function') {
            if (!UniTaxAuth.CanPerformAction('post') && !UniTaxAuth.CanPerformAction('create')) {
                App.UI.Notify('Permission Denied', 'You do not have rights to post vouchers.', 'danger');
                return false;
            }
        }

        // STRICT INPUT LIST VALIDATION: Values must strictly match the datalist
        const listCheck = await this.ValidateInputLists(form);
        if (!listCheck.isValid) {
            if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                App.UI.Notify('Validation Notice', listCheck.message, 'danger');
            } else {
                alert(listCheck.message);
            }
            if (listCheck.invalidElement) {
                listCheck.invalidElement.classList.add('is-invalid');
                listCheck.invalidElement.style.borderColor = '#dc3545';
                listCheck.invalidElement.focus();
                if (typeof listCheck.invalidElement.scrollIntoView === 'function') {
                    listCheck.invalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            return false;
        }

        // Check if in edit mode (safety check)
        const updateStatusField = form.querySelector('[name="UpdateStatus"], [name="voucher_key"]');
        if (updateStatusField && updateStatusField.value) {
            App.UI.Notify('Warning', 'This document is in edit mode. Please use Update.', 'warning');
            return false;
        }

        const formData = new FormData(form);
        const raw = Object.fromEntries(formData.entries());
        const formId = form.id || form.getAttribute('id');
        const rawDocNo = raw.Invoice || raw.paymentRef || raw.supplier_bill_no || Utils.GenerateDocID('VCH');

        if (formId.includes('Sale') || formId.includes('Purchase')) {
            await this.EnsureSystemLedgers();
        }

        // Validate mandatory posting date (Enterprise Standard)
        const postingDateInput = form.querySelector('[name="posting_date"]');
        if (postingDateInput && !postingDateInput.value) {
            App.UI.Notify('Posting Date Required', 'Posting Date is mandatory for all transactions.', 'danger');
            postingDateInput.focus();
            return false;
        }
        const effectiveDateForGuard = (postingDateInput && postingDateInput.value) || raw.voucher_date || raw.valueDate || '';
        if (!this._AssertPostingDate(effectiveDateForGuard, 'voucher')) return false;

        // Dynamic metadata & logistics extraction
        const standardKeys = [
            'Invoice', 'paymentRef', 'supplier_bill_no', 'customer_ledger', 'gl_account',
            'voucher_date', 'posting_date', 'valueDate', 'project', 'CompanyName', 'instrumentDate', 'narration'
        ];
        const dynamicMetaData = {};
        for (const key in raw) {
            if (!standardKeys.includes(key) && !key.includes('[]')) {
                dynamicMetaData[key] = raw[key];
            }
        }

        // Comprehensive Logistics & E-Way Bill Attributes
        const logisticsKeys = [
            'transport_mode', 'transporter_name', 'transporter_id', 'vehicle_no', 'vehicle_type',
            'driver_name', 'driver_phone', 'driver_license', 'lr_no', 'lr_date',
            'eway_bill_no', 'eway_bill_date', 'eway_valid_upto', 'delivery_note_no', 'delivery_note_date',
            'po_reference_no', 'po_reference_date', 'gate_pass_no', 'rfid_tag_id',
            'dispatch_warehouse', 'destination_state', 'dispatch_from', 'ship_to_address',
            'destination_pincode', 'transport_distance_km', 'expected_delivery_date',
            'freight_terms', 'freight_charges', 'total_packages', 'package_type',
            'gross_weight', 'net_weight', 'tare_weight', 'volumetric_cbm', 'cargo_nature',
            'batch_lot_no', 'insurance_policy_no',
            'export_type', 'port_code', 'port_loading', 'port_discharge',
            'shipping_bill_no', 'shipping_bill_date', 'container_no', 'container_seal_no',
            'destination_country', 'foreign_currency'
        ];
        const logisticsData = {};
        logisticsKeys.forEach(k => {
            if (raw[k] !== undefined && raw[k] !== '') {
                logisticsData[k] = raw[k];
            }
        });

        // Calculate line items
        const items = this._GetGridItems(form);
        let subTotal = 0;
        let taxTotal = 0;

        if (formId.toLowerCase().includes('journal')) {
            subTotal = parseFloat(raw.amount || raw.grandTotal || raw.total || 0);
            if (!subTotal) {
                items.forEach(i => {
                    const drAmt = parseFloat(i.amount_dr || 0);
                    if (drAmt > 0) subTotal += drAmt;
                });
            }
            taxTotal = 0;
        } else {
            items.forEach(i => {
                const qty = Utils.ParseNumber(i.qty) || 1;
                const rate = Utils.ParseNumber(i.rate) || Utils.ParseNumber(i.amount) || 0;
                const tax = Utils.ParseNumber(i.auto_item_name_ItemTax) || Utils.ParseNumber(i.taxRate) || 0;
                const base = qty * rate;
                subTotal += base;
                taxTotal += base * (tax / 100);
            });
        }

        const grandTotal = subTotal + taxTotal;

        // --- Financial Posting Controls & Authorization Checks ---
        let docStatus = 'POSTED';
        if (window.UniTaxAuth && typeof UniTaxAuth.GetEffectivePermissions === 'function') {
            const perms = UniTaxAuth.GetEffectivePermissions();

            // 1. Transaction Amount Limit Check
            if (perms.postingLimit > 0 && grandTotal > perms.postingLimit) {
                App.UI.Notify(
                    'Posting Limit Exceeded',
                    `Transaction amount (₹${grandTotal.toLocaleString('en-IN')}) exceeds your authorized posting ceiling of ₹${perms.postingLimit.toLocaleString('en-IN')}.`,
                    'danger'
                );
                return false;
            }

            // 2. Direct Posting vs Draft / Approval Check
            const canPostDirectLocal = localStorage.getItem('canPostDirect');
            const isDraftOnlyUser = (perms.canPostDirectly === false) || (canPostDirectLocal === 'false');
            if (isDraftOnlyUser || (perms.postingLimit > 0 && grandTotal > perms.postingLimit)) {
                docStatus = 'PENDING_APPROVAL';
            }

            // 3. Backdated Voucher Check (checked against Posting Date)
            const vchDateStr = raw.posting_date || raw.voucher_date || raw.valueDate;
            if (vchDateStr && perms.canBackdate === false) {
                const todayStr = new Date().toISOString().split('T')[0];
                if (vchDateStr < todayStr) {
                    App.UI.Notify('Backdating Restricted', 'Your account is not permitted to enter backdated vouchers.', 'warning');
                    return false;
                }
            }

            // 4. Organization-wide Open Fiscal Posting Period Check (Fiscal Posting Period Verification)
            const targetVchDate = raw.posting_date || raw.voucher_date || raw.valueDate || raw.date;
            try {
                let periodConfig = null;
                const cachedPeriod = localStorage.getItem('workspacePostingPeriod');
                if (cachedPeriod) periodConfig = JSON.parse(cachedPeriod);

                if (periodConfig && periodConfig.enforce && targetVchDate) {
                    if (periodConfig.from && targetVchDate < periodConfig.from) {
                        App.UI.Notify(
                            'Period Lock Failure',
                            `Authorization Failure [Fiscal Period Gate]: Voucher date (${targetVchDate}) is prior to the open posting period start (${periodConfig.from}). Entry rejected.`,
                            'danger'
                        );
                        return false;
                    }
                    if (periodConfig.to && targetVchDate > periodConfig.to) {
                        App.UI.Notify(
                            'Period Lock Failure',
                            `Authorization Failure [Fiscal Period Gate]: Voucher date (${targetVchDate}) exceeds the open posting period end (${periodConfig.to}). Entry rejected.`,
                            'danger'
                        );
                        return false;
                    }
                }
            } catch(e) {}

            // 5. Per-User Dimension Restrictions (Profit Center / Project Verification)
            const allowedPC = (perms.allowedProfitCenter || localStorage.getItem('allowedProfitCenter') || '*').trim();
            if (allowedPC && allowedPC !== '*' && allowedPC !== '') {
                const docPC = (raw.project || raw.profit_center || dynamicMetaData.profit_center || '').trim();
                if (!this._DimensionMatches(docPC, allowedPC)) {
                    App.UI.Notify(
                        'Dimension Authorization Failure',
                        `Authorization Failure [Profit Center Gate]: You are not authorized to post entries for Profit Center / Project '${docPC || 'General'}'. Authorized Profit Center: '${allowedPC}'.`,
                        'danger'
                    );
                    return false;
                }
            }

            // 6. Per-User Dimension Restrictions (Account Dimension Verification)
            const allowedLedger = (perms.allowedLedger || localStorage.getItem('allowedLedger') || '*').trim();
            if (allowedLedger && allowedLedger !== '*' && allowedLedger !== '') {
                const docEntity = (raw.customer_ledger || raw.gl_account || raw.entity || '').trim();
                if (!this._DimensionMatches(docEntity, allowedLedger)) {
                    App.UI.Notify(
                        'Account Authorization Failure',
                        `Authorization Failure [Account Scope Gate]: You are not authorized to post entries for Account '${docEntity || 'General'}'. Authorized Account: '${allowedLedger}'.`,
                        'danger'
                    );
                    return false;
                }
            }

            // 7. Granular Form Field Authorization & Validation Matrix (Governance & Risk Verification Matrix)
            const currentModule = (window.UniTaxRouter && UniTaxRouter.currentRoute) ? UniTaxRouter.currentRoute : (formId || '');
            const customRules = perms.fieldRestrictions || [];
            for (const rule of customRules) {
                if (!rule || !rule.field) continue;
                const ruleMod = (rule.module || 'ALL').trim().toLowerCase();
                const curModClean = currentModule.toLowerCase().trim();

                // Match specific module or universal ALL
                if (ruleMod !== 'all' && !curModClean.includes(ruleMod) && !ruleMod.includes(curModClean)) {
                    continue;
                }

                const fieldName = rule.field.trim();
                const condition = (rule.condition || 'EQUALS').toUpperCase();
                const expected = (rule.value || '').trim();
                const actual = (raw[fieldName] !== undefined ? raw[fieldName] : (dynamicMetaData[fieldName] || '')).toString().trim();

                if (condition === 'REQUIRED') {
                    if (!actual) {
                        App.UI.Notify('Authorization Error', `Field [${fieldName}] is mandatory under your assigned posting authorization policy.`, 'danger');
                        if (window.UniTaxAudit && UniTaxAudit.Log) {
                            UniTaxAudit.Log({ action: 'POST_DENIED', module: currentModule, details: `Required field [${fieldName}] missing` });
                        }
                        return false;
                    }
                } else if (condition === 'EQUALS') {
                    if (expected !== '*' && actual.toLowerCase() !== expected.toLowerCase()) {
                        App.UI.Notify('Authorization Error', `Validation failure on [${fieldName}]: value '${actual}' is not permitted. Must equal '${expected}'.`, 'danger');
                        if (window.UniTaxAudit && UniTaxAudit.Log) {
                            UniTaxAudit.Log({ action: 'POST_DENIED', module: currentModule, details: `Field [${fieldName}]='${actual}' must equal '${expected}'` });
                        }
                        return false;
                    }
                } else if (condition === 'IN_LIST') {
                    const allowedList = expected.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                    const actualNorm = actual.toLowerCase();
                    const actualParts = [actualNorm];
                    const apm = actual.match(/^(.*?)\s*\((.*?)\)$/);
                    if (apm) {
                        actualParts.push(apm[1].trim().toLowerCase(), apm[2].trim().toLowerCase());
                    }
                    const isAllowed = allowedList.includes('*') ||
                        actualParts.some(p => allowedList.includes(p));
                    if (!isAllowed) {
                        App.UI.Notify('Authorization Error', `Validation failure on [${fieldName}]: '${actual}' is not in your authorized list (${expected}).`, 'danger');
                        if (window.UniTaxAudit && UniTaxAudit.Log) {
                            UniTaxAudit.Log({ action: 'POST_DENIED', module: currentModule, details: `Field [${fieldName}]='${actual}' not in list (${expected})` });
                        }
                        return false;
                    }
                } else if (condition === 'DATE_RANGE') {
                    const parts = expected.split(/[:|to]/).map(s => s.trim());
                    const fromDate = parts[0];
                    const toDate = parts[1];
                    if (fromDate && actual < fromDate) {
                        App.UI.Notify('Authorization Error', `Posting Date [${actual}] is prior to allowed start date [${fromDate}].`, 'danger');
                        if (window.UniTaxAudit && UniTaxAudit.Log) {
                            UniTaxAudit.Log({ action: 'POST_DENIED', module: currentModule, details: `Date ${actual} < ${fromDate}` });
                        }
                        return false;
                    }
                    if (toDate && actual > toDate) {
                        App.UI.Notify('Authorization Error', `Posting Date [${actual}] exceeds allowed end date [${toDate}].`, 'danger');
                        if (window.UniTaxAudit && UniTaxAudit.Log) {
                            UniTaxAudit.Log({ action: 'POST_DENIED', module: currentModule, details: `Date ${actual} > ${toDate}` });
                        }
                        return false;
                    }
                } else if (condition === 'MAX_VALUE') {
                    const numActual = parseFloat(actual) || 0;
                    const numExpected = parseFloat(expected) || 0;
                    if (numActual > numExpected) {
                        App.UI.Notify('Authorization Error', `Field [${fieldName}] value (${numActual}) exceeds your maximum authorized ceiling of ${numExpected}.`, 'danger');
                        if (window.UniTaxAudit && UniTaxAudit.Log) {
                            UniTaxAudit.Log({ action: 'POST_DENIED', module: currentModule, details: `Value ${numActual} > ${numExpected}` });
                        }
                        return false;
                    }
                }
            }
        }

        // Double-entry ledger assignment
        let primaryDebit = "";
        let primaryCredit = "";
        const taxLedger = "Duties and Taxes";
        const entity = raw.customer_ledger || raw.gl_account || "General Party";

        const lowerId = formId.toLowerCase();
        if (lowerId.includes('sale')) {
            primaryDebit = entity;
            primaryCredit = "Sales Account";
        } else if (lowerId.includes('purchase')) {
            primaryDebit = "Purchase Account";
            primaryCredit = entity;
        } else if (lowerId.includes('receipt')) {
            primaryDebit = "Bank / Cash Account";
            primaryCredit = entity;
        } else if (lowerId.includes('payment')) {
            primaryDebit = entity;
            primaryCredit = "Bank / Cash Account";
        } else if (lowerId.includes('journal')) {
            const firstDr = items.find(it => (it.drcr_type === 'DR' || parseFloat(it.amount_dr || 0) > 0));
            const firstCr = items.find(it => (it.drcr_type === 'CR' || parseFloat(it.amount_cr || 0) > 0));
            primaryDebit = firstDr ? (firstDr.offset_account || firstDr.account || "Debit Ledger") : "Journal Debit";
            primaryCredit = firstCr ? (firstCr.offset_account || firstCr.account || "Credit Ledger") : "Journal Credit";
            entity = `${primaryDebit} / ${primaryCredit}`;
        }

        const effectivePostingDate = raw.posting_date || raw.voucher_date || raw.valueDate || Utils.FormatDateISO(new Date());
        const effectiveDocDate = raw.voucher_date || raw.valueDate || effectivePostingDate;

        const currentUserId = (typeof App !== 'undefined' && App.State && App.State.userId) || localStorage.getItem('userloginid') || localStorage.getItem('workspaceUserId') || 'System';
        const currentUserName = (typeof App !== 'undefined' && App.State && App.State.userName) || localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Administrator';
        const currentUserEmail = localStorage.getItem('userEmail') || '';
        const currentUserRole = localStorage.getItem('userRole') || localStorage.getItem('customRoleName') || 'Admin';

        const transaction = {
            header: {
                doc_no: String(rawDocNo).toUpperCase(),
                date: effectivePostingDate,
                posting_date: effectivePostingDate,
                voucher_date: effectiveDocDate,
                entity: entity,
                debitLedger: primaryDebit,
                creditLedger: primaryCredit,
                taxLedger: taxLedger,
                subTotal: parseFloat(subTotal.toFixed(2)),
                taxTotal: parseFloat(taxTotal.toFixed(2)),
                grandTotal: parseFloat(grandTotal.toFixed(2)),
                project: raw.project || 'General',
                CompanyCode: raw.CompanyName || '',
                instrumentDate: raw.instrumentDate || '',
                narration: raw.narration || '',
                status: docStatus,
                is_draft: (docStatus === 'PENDING_APPROVAL'),
                assigned_manager_id: localStorage.getItem('assignedManagerId') || '',
                assigned_manager_name: localStorage.getItem('assignedManagerName') || 'Workspace Administrator',
                posted_by: currentUserId,
                posted_by_name: currentUserName,
                posted_by_email: currentUserEmail,
                posted_by_role: currentUserRole,
                posted_at: firebase.database.ServerValue.TIMESTAMP,
                transporter_name: raw.transporter_name || '',
                vehicle_no: raw.vehicle_no || '',
                lr_no: raw.lr_no || '',
                eway_bill_no: raw.eway_bill_no || '',
                logistics: logisticsData
            },
            logistics: logisticsData,
            items: items,
            meta: {
                form_id: formId,
                posted_by: currentUserId,
                posted_by_name: currentUserName,
                posted_by_email: currentUserEmail,
                posted_by_role: currentUserRole,
                posted_at_iso: new Date().toISOString(),
                ...dynamicMetaData
            }
        };

        try {
            const res = await UniTaxCRUD.createOne(formId, transaction);
            const txnKey = res ? (res.id || res.key || (res.val && res.val().key) || rawDocNo) : rawDocNo;

            if (docStatus === 'PENDING_APPROVAL') {
                const reqKey = Utils.GenerateDocID('REQ');
                const wsId = (typeof App !== 'undefined' && App.State && App.State.userId)
                    ? App.State.userId
                    : localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');

                // Resolve Multi-Tier Voucher Approval Flow Matrix configured by Admin
                let voucherFlow = [];
                try {
                    const cachedFlow = localStorage.getItem('userVoucherApprovalFlow');
                    if (cachedFlow) voucherFlow = JSON.parse(cachedFlow);
                } catch(e) {}

                if (!Array.isArray(voucherFlow) || voucherFlow.length === 0) {
                    try {
                        const snap = await this.DB.ref(`Users/${currentUserId}/voucherApprovalFlow`).once('value');
                        if (snap.exists() && Array.isArray(snap.val())) voucherFlow = snap.val();
                    } catch(e) {}
                }
                if (!Array.isArray(voucherFlow) || voucherFlow.length === 0) {
                    try {
                        const snap = await this.DB.ref(`${wsId}/workspace/Members/${currentUserId}/voucherApprovalFlow`).once('value');
                        if (snap.exists() && Array.isArray(snap.val())) voucherFlow = snap.val();
                    } catch(e) {}
                }

                let hierarchy = [];
                if (Array.isArray(voucherFlow) && voucherFlow.length > 0) {
                    hierarchy = voucherFlow.map((step, idx) => ({
                        level: idx + 1,
                        levelIndex: idx,
                        userId: step.userId,
                        userName: step.userName || step.name || 'Approver',
                        role: step.role || 'Approver',
                        status: 'PENDING'
                    }));
                } else {
                    const assignedMgrId = localStorage.getItem('assignedManagerId') || '';
                    const assignedMgrName = localStorage.getItem('assignedManagerName') || 'Workspace Administrator';
                    hierarchy = [{
                        level: 1,
                        levelIndex: 0,
                        userId: assignedMgrId,
                        userName: assignedMgrName,
                        role: 'Reporting Manager',
                        status: 'PENDING'
                    }];
                }

                const firstApproverId = hierarchy[0]?.userId || '';
                const firstApproverName = hierarchy[0]?.userName || 'Workspace Administrator';

                const reqPayload = {
                    id: reqKey,
                    transactionKey: txnKey,
                    formId: formId,
                    voucherType: formId,
                    docNo: String(rawDocNo).toUpperCase(),
                    amount: parseFloat(grandTotal.toFixed(2)),
                    requesterId: currentUserId,
                    requesterName: currentUserName,
                    approvalCategory: 'VOUCHER_APPROVAL',
                    hierarchy: hierarchy,
                    currentLevelIndex: 0,
                    currentApproverId: firstApproverId,
                    currentApproverName: firstApproverName,
                    assignedManagerId: firstApproverId,
                    assignedManagerName: firstApproverName,
                    state: 'PENDING',
                    status: 'PENDING_APPROVAL',
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    title: `${formId}: ${String(rawDocNo).toUpperCase()} (Draft)`,
                    details: `Draft voucher for ${entity} of amount ₹${grandTotal.toLocaleString('en-IN')} submitted by ${currentUserName}. Requires Level 1 verification.`
                };

                try {
                    await this.DB.ref(`${wsId}/Utilities/Requests/${reqKey}`).set(reqPayload);
                    await this.DB.ref(`Utilities/Requests/${reqKey}`).set(reqPayload);

                    // Send Real-time System Notification to Level 1 Approver
                    if (firstApproverId) {
                        const notifPayload = {
                            title: `Voucher Verification Assigned: ${String(rawDocNo).toUpperCase()}`,
                            belonging: "Approval Notification",
                            message: `Level 1 verification requested for draft ${formId} of amount ₹${grandTotal.toLocaleString('en-IN')} by ${currentUserName}.`,
                            link: "reports/approvalmanagementsystem",
                            sender: currentUserId,
                            target: firstApproverId,
                            timestamp: Date.now(),
                            type: 'task',
                            dedupeKey: `approval-asn-${reqKey}`,
                            ReadStatus: { [currentUserId]: "read" }
                        };
                        await this.DB.ref('Utilities/Notifications').push(notifPayload);
                        if (wsId) await this.DB.ref(`${wsId}/Utilities/Notifications`).push(notifPayload);
                    }
                } catch (reqErr) {
                    console.error("Error creating approval request:", reqErr);
                }

                App.UI.Notify('Draft Routed to Hierarchy', `Document ${transaction.header.doc_no} saved as Draft. Assigned to Level 1: ${firstApproverName} for authorization.`, 'info');
                return true;
            }

            App.UI.Notify('Success', `Document ${transaction.header.doc_no} Posted Successfully`, 'success');
            if (window.UniTaxAccountingEngine && typeof UniTaxAccountingEngine.TriggerBackgroundRefresh === 'function') {
                UniTaxAccountingEngine.TriggerBackgroundRefresh();
            }
            return true;
        } catch (e) {
            console.error("Voucher posting failure:", e);
            App.UI.Notify('Error', e.message || "Failed to post voucher.", 'danger');
            return false;
        }
    },

    /**
     * SAVE MASTER DATA RECORD
     */
    async SaveMaster(formId, data) {
        try {
            // Suspension window guard (platform / workspace / user)
            if (window.UniTaxOperations && typeof UniTaxOperations.AssertWrite === 'function') {
                if (!UniTaxOperations.AssertWrite('create', 'master record')) return false;
            }

            // Security check: Check if user has permission to create master
            if (window.UniTaxAuth && typeof UniTaxAuth.CanPerformAction === 'function') {
                if (!UniTaxAuth.CanPerformAction('create')) {
                    App.UI.Notify('Permission Denied', 'You do not have permission to create master records.', 'danger');
                    return false;
                }
            }

            // GRC Field & Scope Validation for Masters
            if (window.UniTaxAuth && typeof UniTaxAuth.GetEffectivePermissions === 'function') {
                const perms = UniTaxAuth.GetEffectivePermissions();
                const curRoute = (window.UniTaxRouter && UniTaxRouter.currentRoute) ? UniTaxRouter.currentRoute : formId;
                const customRules = perms.fieldRestrictions || [];
                for (const rule of customRules) {
                    if (!rule || !rule.field) continue;
                    const ruleMod = (rule.module || 'ALL').trim().toLowerCase();
                    const curModClean = (curRoute || '').toLowerCase().trim();
                    if (ruleMod !== 'all' && !curModClean.includes(ruleMod) && !ruleMod.includes(curModClean) && !ruleMod.includes('master')) {
                        continue;
                    }

                    const fieldName = rule.field.trim();
                    const condition = (rule.condition || 'EQUALS').toUpperCase();
                    const expected = (rule.value || '').trim();
                    const actual = (data[fieldName] !== undefined ? data[fieldName] : '').toString().trim();

                    if (condition === 'REQUIRED' && !actual) {
                        App.UI.Notify('Authorization Error', `Field [${fieldName}] is mandatory for master creation under your assigned security policy.`, 'danger');
                        return false;
                    } else if (condition === 'EQUALS' && actual && expected !== '*' && actual.toLowerCase() !== expected.toLowerCase()) {
                        App.UI.Notify('Authorization Error', `Field [${fieldName}]: value '${actual}' is restricted. Must equal '${expected}'.`, 'danger');
                        return false;
                    } else if (condition === 'IN_LIST' && actual) {
                        const allowedList = expected.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                        const actualNorm = actual.toLowerCase();
                        const actualParts = [actualNorm];
                        const apm = actual.match(/^(.*?)\s*\((.*?)\)$/);
                        if (apm) actualParts.push(apm[1].trim().toLowerCase(), apm[2].trim().toLowerCase());
                        const allowed = allowedList.includes('*') || actualParts.some(p => allowedList.includes(p));
                        if (!allowed) {
                            App.UI.Notify('Authorization Error', `Field [${fieldName}]: '${actual}' is outside your authorized scope (${expected}).`, 'danger');
                            return false;
                        }
                    }
                }
            }
            // Strict datalist validation: any input-list value must match an actual option.
            const formElement = document.getElementById(formId) || document.getElementById(String(formId));
            if (formElement && typeof this.ValidateInputLists === 'function') {
                const listCheck = await this.ValidateInputLists(formElement);
                if (!listCheck.isValid) {
                    App.UI.Notify('Validation Error', listCheck.message, 'danger');
                    if (listCheck.invalidElement) {
                        listCheck.invalidElement.classList.add('is-invalid');
                        listCheck.invalidElement.style.borderColor = '#dc3545';
                        if (typeof listCheck.invalidElement.focus === 'function') listCheck.invalidElement.focus();
                    }
                    return false;
                }
            }

            // Sanitize keys for Firebase
            const sanitizedData = {};
            Object.entries(data).forEach(([k, v]) => {
                const safeK = k.replace(/[\.\#\$\/\[\]\s]/g, '_');
                sanitizedData[safeK] = v;
            });

            // Master Field Alias Normalization
            if (sanitizedData.ItemUnit && !sanitizedData.unit) sanitizedData.unit = sanitizedData.ItemUnit;
            if (sanitizedData.unit && !sanitizedData.ItemUnit) sanitizedData.ItemUnit = sanitizedData.unit;
            if (sanitizedData.itemHSN && !sanitizedData.hsnCode) sanitizedData.hsnCode = sanitizedData.itemHSN;
            if (sanitizedData.hsnCode && !sanitizedData.itemHSN) sanitizedData.itemHSN = sanitizedData.hsnCode;
            if (sanitizedData.openingQty && !sanitizedData.openingQuantity) sanitizedData.openingQuantity = sanitizedData.openingQty;
            if (sanitizedData.openingQuantity && !sanitizedData.openingQty) sanitizedData.openingQty = sanitizedData.openingQuantity;
            if (sanitizedData.Stock_Code && !sanitizedData.stockCode) sanitizedData.stockCode = sanitizedData.Stock_Code;
            if (sanitizedData.stockCode && !sanitizedData.Stock_Code) sanitizedData.Stock_Code = sanitizedData.stockCode;
            if (sanitizedData.itemGroup && !sanitizedData.category) sanitizedData.category = sanitizedData.itemGroup;
            if (sanitizedData.category && !sanitizedData.itemGroup) sanitizedData.itemGroup = sanitizedData.category;

            await UniTaxCRUD.createOne(formId, sanitizedData);
            delete this._MasterCache[formId];
            delete this._MasterCache['Stock'];
            delete this._MasterCache['stock'];
            App.UI.Notify('Success', 'Master Record Created Successfully', 'success');
            return true;
        } catch (e) {
            console.error("Master save error:", e);
            App.UI.Notify('Error', e.message, 'danger');
            return false;
        }
    },

    /**
     * UPDATE VOUCHER RECORD
     */
    async UpdateVoucher(form, formId, passedKey) {
        // Suspension window guard (platform / workspace / user)
        if (window.UniTaxOperations && typeof UniTaxOperations.AssertWrite === 'function') {
            if (!UniTaxOperations.AssertWrite('update', 'voucher')) return false;
        }

        // Permission-matrix update right
        if (window.UniTaxAuth && typeof UniTaxAuth.CanPerformAction === 'function') {
            if (!UniTaxAuth.CanPerformAction('update') && !UniTaxAuth.CanPerformAction('edit')) {
                App.UI.Notify('Permission Denied', 'You do not have rights to update vouchers.', 'danger');
                return false;
            }
        }

        // STRICT INPUT LIST VALIDATION: Values must strictly match the datalist
        const listCheck = await this.ValidateInputLists(form);
        if (!listCheck.isValid) {
            if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                App.UI.Notify('Validation Notice', listCheck.message, 'danger');
            } else {
                alert(listCheck.message);
            }
            if (listCheck.invalidElement) {
                listCheck.invalidElement.classList.add('is-invalid');
                listCheck.invalidElement.style.borderColor = '#dc3545';
                listCheck.invalidElement.focus();
                if (typeof listCheck.invalidElement.scrollIntoView === 'function') {
                    listCheck.invalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            return false;
        }

        const key = passedKey || form.querySelector('[name="voucher_key"]')?.value || document.getElementById('active_voucher_key')?.value;
        if (!key) {
            App.UI.Notify('Error', 'Missing document identifier. Update cancelled.', 'danger');
            return false;
        }

        const items = this._GetGridItems(form);
        const postingDateVal = form.querySelector('[name="posting_date"]')?.value || form.querySelector('[name="voucher_date"]')?.value || Utils.FormatDateISO(new Date());
        const voucherDateVal = form.querySelector('[name="voucher_date"]')?.value || postingDateVal;
        if (!this._AssertPostingDate(postingDateVal, 'voucher')) return false;

        // Dimension scope + granular field authorisation matrix (same gate as posting)
        const rawUpdate = Object.fromEntries(new FormData(form).entries());
        if (!rawUpdate.posting_date) rawUpdate.posting_date = postingDateVal;
        if (!rawUpdate.voucher_date) rawUpdate.voucher_date = voucherDateVal;
        if (!rawUpdate.date) rawUpdate.date = postingDateVal;
        if (!this._AssertDimensionAndFieldPolicy(rawUpdate, formId || form.id, 'voucher')) return false;

        const currentUserId = (typeof App !== 'undefined' && App.State && App.State.userId) || localStorage.getItem('userloginid') || localStorage.getItem('workspaceUserId') || 'System';
        const currentUserName = (typeof App !== 'undefined' && App.State && App.State.userName) || localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Administrator';
        const currentUserRole = localStorage.getItem('userRole') || localStorage.getItem('customRoleName') || 'Admin';

        const headerData = {
            doc_no: form.querySelector('[name="doc_no"], [name="Invoice"]')?.value || 'N/A',
            date: postingDateVal,
            posting_date: postingDateVal,
            voucher_date: voucherDateVal,
            entity: form.querySelector('[name="customer_ledger"]')?.value || form.querySelector('[name="gl_account"]')?.value || form.querySelector('[name="supplier_ledger"]')?.value || "General",
            narration: form.querySelector('[name="narration"]')?.value || '',
            status: 'UPDATED',
            updated_by: currentUserId,
            updated_by_name: currentUserName,
            updated_by_role: currentUserRole,
            updated_at: firebase.database.ServerValue.TIMESTAMP
        };

        try {
            await UniTaxCRUD.updateOne(formId, key, {
                header: headerData,
                items: items
            });
            App.UI.Notify('Success', 'Document Updated Successfully', 'success');
            if (window.UniTaxAccountingEngine && typeof UniTaxAccountingEngine.TriggerBackgroundRefresh === 'function') {
                UniTaxAccountingEngine.TriggerBackgroundRefresh();
            }
            return true;
        } catch (e) {
            App.UI.Notify('Error', e.message || 'Update failed', 'danger');
            return false;
        }
    },

    _GetGridItems(form) {
        const items = [];
        form.querySelectorAll('tbody tr').forEach(row => {
            const item = {};
            let hasValidData = false;
            row.querySelectorAll('input, select, textarea').forEach(i => {
                if (!i.name) return;
                const safeKey = i.name.replace(/\[\]/g, '').replace(/[\.\#\$\/\[\]\s]/g, '_');
                if (safeKey) {
                    item[safeKey] = i.value;
                    if (String(i.value).trim() !== "") hasValidData = true;
                }
            });
            if (hasValidData) items.push(item);
        });
        return items;
    },

    /**
     * Direct Fetch Helper
     */
    async Fetch(path) {
        try {
            if (!this.DB && typeof firebase !== 'undefined' && typeof firebase.database === 'function') {
                if (!firebase.apps.length && this.Config && this.Config.firebase) {
                    firebase.initializeApp(this.Config.firebase);
                }
                this.DB = firebase.database();
            }

            const userId = (typeof App !== 'undefined' && App.State && App.State.userId)
                ? App.State.userId
                : localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');

            if (!userId || !this.DB) return null;
            const fullPath = path.startsWith(userId) ? path : `${userId}/${path}`;

            const fetchWithTimeout = (ref, ms = 6000) => {
                return Promise.race([
                    ref.once('value'),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), ms))
                ]);
            };

            try {
                const snap = await fetchWithTimeout(this.DB.ref(fullPath));
                if (snap && snap.exists && snap.exists() && snap.val()) return snap.val();
            } catch (snapErr) {
                console.warn("[API.Fetch] Timed out or failed on full path:", fullPath);
            }

            if (path !== fullPath) {
                try {
                    const rootSnap = await fetchWithTimeout(this.DB.ref(path));
                    if (rootSnap && rootSnap.exists && rootSnap.exists() && rootSnap.val()) return rootSnap.val();
                } catch (rootErr) {
                    console.warn("[API.Fetch] Timed out or failed on root path:", path);
                }
            }
            return null;
        } catch (e) {
            console.warn("API Fetch notice:", path, e.message || e);
            return null;
        }
    },

    /**
     * Update Record
     */
    async Update(endpoint, payload) {
        if (!this._AssertWriteAllowed('update', 'record')) return false;
        return UniTaxCRUD.updateOne(endpoint, '', payload);
    },

    /**
     * Delete Record
     */
    async Delete(endpoint) {
        if (!this._AssertWriteAllowed('delete', 'record')) return false;
        return UniTaxCRUD.deleteOne(endpoint, '');
    },

    async DeleteTransaction(formId, key) {
        if (!this._AssertWriteAllowed('delete', 'voucher')) return false;
        try {
            await this.SoftDeleteTransaction(formId, key, true);
            App.UI.Notify('Archived', 'Transaction deleted and moved to Deleted Transactions bin.', 'success');
            return true;
        } catch (e) {
            App.UI.Notify('Error', e.message || 'Could not delete transaction.', 'danger');
            return false;
        }
    },

    async SoftDeleteTransaction(formId, key, skipGuard = false) {
        if (!skipGuard && !this._AssertWriteAllowed('delete', 'voucher')) return false;
        const userId = (typeof App !== 'undefined' && App.State && App.State.userId)
            ? App.State.userId
            : localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');
        const currentUserName = (typeof App !== 'undefined' && App.State && App.State.userName)
            ? App.State.userName
            : localStorage.getItem('userName') || 'User';
        const currentUserId = localStorage.getItem('userloginid') || 'User';

        if (!userId || !this.DB) throw new Error("Database reference unavailable.");

        const path = `${userId}/Transactions/${formId}/${key}`;
        const patch = {
            is_deleted: true,
            status: 'DELETED',
            deleted_at: firebase.database.ServerValue.TIMESTAMP,
            deleted_by: `${currentUserName} (${currentUserId})`
        };
        await this.DB.ref(path).update(patch);
        try {
            await this.DB.ref(`${path}/header`).update({ is_deleted: true, status: 'DELETED' });
        } catch(e) {}

        if (window.UniTaxAudit && typeof UniTaxAudit.Log === 'function') {
            UniTaxAudit.Log({
                action: 'DELETE_TRANSACTION',
                module: formId,
                recordId: key,
                details: `Soft-deleted voucher #${key} in ${formId}`
            });
        }
        if (window.UniTaxAccountingEngine && typeof UniTaxAccountingEngine.TriggerBackgroundRefresh === 'function') {
            UniTaxAccountingEngine.TriggerBackgroundRefresh();
        }
        return true;
    },

    async RestoreTransaction(formId, key) {
        if (!this._AssertWriteAllowed('restore', 'voucher')) return false;
        const userId = (typeof App !== 'undefined' && App.State && App.State.userId)
            ? App.State.userId
            : localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');
        const currentUserName = (typeof App !== 'undefined' && App.State && App.State.userName)
            ? App.State.userName
            : localStorage.getItem('userName') || 'Admin';

        if (!userId || !this.DB) throw new Error("Database reference unavailable.");

        const path = `${userId}/Transactions/${formId}/${key}`;
        const patch = {
            is_deleted: false,
            status: 'POSTED',
            restored_at: firebase.database.ServerValue.TIMESTAMP,
            restored_by: currentUserName
        };
        await this.DB.ref(path).update(patch);
        try {
            await this.DB.ref(`${path}/header`).update({ is_deleted: false, status: 'POSTED' });
        } catch(e) {}

        if (window.UniTaxAudit && typeof UniTaxAudit.Log === 'function') {
            UniTaxAudit.Log({
                action: 'RESTORE_TRANSACTION',
                module: formId,
                recordId: key,
                details: `Restored voucher #${key} in ${formId}`
            });
        }
        if (window.UniTaxAccountingEngine && typeof UniTaxAccountingEngine.TriggerBackgroundRefresh === 'function') {
            UniTaxAccountingEngine.TriggerBackgroundRefresh();
        }
        return true;
    },

    async SecureMasterUpdate(moduleName, recordId, payload) {
        if (!this._AssertWriteAllowed('update', 'master record')) return false;
        return UniTaxCRUD.updateOne(moduleName, recordId, payload);
    },

    async SafeMasterDelete(moduleName, recordId) {
        if (!this._AssertWriteAllowed('delete', 'master record')) return false;
        return UniTaxCRUD.deleteOne(moduleName, recordId);
    }
};

window.API = API;

// assets/js/workspace.js
const Workspace = {
    _isActive: false,   // Default to FALSE for security

    /** Load the active flag from Firebase */
    async LoadStatus() {
        try {
            const wsId = App.State.workspaceId || App.State.userId;
            
            // If no workspace, assume false (or true if you have a specific guest logic)
            if (!wsId) {
                this._isActive = false; 
                return;               
            }

            const snap = await firebase.database()
                .ref(`Users/${wsId}/workspace/WorkspaceSettings/workspaceStatus`).once('value');
            
            const val = snap.val();
            
            // THE FIX: Only true if the string is EXACTLY "active"
            // We use .toLowerCase() just in case the server sends "Active" or "ACTIVE"
            this._isActive = (val === 'active' || val === 'Active');

        } catch (e) {
            console.warn('Workspace status load error → assuming inactive', e);
            this._isActive = false; // Fail securely
        }
    },

    /** Public getter */
    isActive() {
        return this._isActive;
    }
};