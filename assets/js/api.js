/**
 * UNITAX PRO - Data Access Layer (Final Stable)
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

    _Cache: {}, // Stores fetched master data to avoid redundant network hits

    Init() {
        if (!firebase.apps.length) firebase.initializeApp(this.Config.firebase);
        this.DB = firebase.database();
        console.log("📡 API Engine: Online");
    },

    /**
     * 1. UNIVERSAL DATALIST POPULATOR
     * Scans form for inputs requiring server data and fills their <datalist>
     */
    async PopulateAllDatalists(form) {
        const lookupInputs = form.querySelectorAll('[data-fetch_column]');
        
        for (const input of lookupInputs) {
            const sheetName = input.dataset.sheet_name;
            const columnDef = input.dataset.column_name; // e.g. "itemName & Stock Code"
            const listId = input.getAttribute('list');

            if (!sheetName || !listId) continue;

            // Fetch data (check cache first)
            let data = this._Cache[sheetName];
            if (!data) {
                const snapshot = await this.DB.ref(`${App.State.userId}/Masters/${sheetName}`).once('value');
                data = snapshot.val();
                this._Cache[sheetName] = data; // Cache for other rows
            }

            if (!data) continue;

            const datalist = document.getElementById(listId);
            if (datalist) {
                datalist.innerHTML = ""; // Clear old
                const searchCols = columnDef.split('&').map(c => c.trim());

                Object.values(data).forEach(record => {
                    searchCols.forEach(col => {
                        if (record[col]) {
                            const opt = document.createElement('option');
                            opt.value = record[col];
                            datalist.appendChild(opt);
                        }
                    });
                });
            }
        }
    },

    /**
     * 2. RECORD LOOKUP & AUTO-FILL
     * Triggered on input 'change'. Finds the full record and fills "auto_" fields.
     */
    async HandleLookup(input) {
        const val = input.value.trim();
        const sheetName = input.dataset.sheet_name;
        const columnDef = input.dataset.column_name;
        const sourceName = input.name.replace('[]', ''); // Clean name for array inputs

        if (!val || !sheetName) return;

        // Visual "Working" State
        input.classList.add('is-loading-field');

        // Fetch sheet data (from cache or server)
        let data = this._Cache[sheetName];
        if (!data) {
            const snapshot = await this.DB.ref(`${App.State.userId}/Masters/${sheetName}`).once('value');
            data = snapshot.val();
            this._Cache[sheetName] = data;
        }

        if (!data) return;

        // Search logic
        const searchCols = columnDef.split('&').map(c => c.trim());
        let foundRecord = null;

        Object.values(data).forEach(record => {
            const isMatch = searchCols.some(col => 
                String(record[col]).toLowerCase() === val.toLowerCase()
            );
            if (isMatch) foundRecord = record;
        });

        if (foundRecord) {
            const scope = input.closest('tr') || input.closest('form');
            this._PopulateFields(scope, sourceName, foundRecord);
            input.style.borderLeft = "4px solid #198754"; // Success Green
            App.Log(`Fetched: ${val}`);
        } else {
            input.style.borderLeft = "4px solid #dc3545"; // Error Red
        }
        
        input.classList.remove('is-loading-field');
    },

    // Internal helper to map data to UI
    _PopulateFields(container, sourceName, record) {
        Object.entries(record).forEach(([key, value]) => {
            const targetName = `auto_${sourceName}_${key}`;
            const targets = container.querySelectorAll(`[name="${targetName}"]`);
            targets.forEach(el => {
                el.value = value;
                el.classList.add('bg-success-subtle');
                setTimeout(() => el.classList.remove('bg-success-subtle'), 1000);
            });
        });
    },

    /**
     * 3. VOUCHER POSTING
     * Saves the entire form (Header + Rows) as one transaction object
     */
    async PostVoucher(form) {
        const formData = new FormData(form);
        const raw = Object.fromEntries(formData.entries());

        const transaction = {
            header: {
                doc_no: Utils.GenerateDocID(raw.documentType || 'VCH'),
                date: raw.voucher_date || new Date().toISOString().split('T')[0],
                entity: raw.customer_ledger || raw.gl_account,
                project: raw.project || 'General',
                narration: raw.narration || '',
                posted_at: firebase.database.ServerValue.TIMESTAMP
            },
            items: this._GetGridItems(form),
            meta: { user: App.State.userId, form: form.id }
        };

        try {
            await this.DB.ref(`${App.State.userId}/Transactions/${form.id}`).push(transaction);
            App.UI.Notify('System', 'Voucher Posted Successfully!', 'success');
            form.reset();
            if(window.recalculateVoucher) recalculateVoucher();
            return true;
        } catch (e) {
            App.UI.Notify('Critical Error', e.message, 'danger');
            return false;
        }
    },

    _GetGridItems(form) {
        const items = [];
        form.querySelectorAll('tbody tr').forEach(row => {
            const item = {};
            row.querySelectorAll('input, select').forEach(i => {
                const key = i.name.replace('[]', '');
                item[key] = i.value;
            });
            if (item[Object.keys(item)[0]]) items.push(item);
        });
        return items;
    }
};