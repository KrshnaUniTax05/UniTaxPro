/**
 * UNITAX PRO - Data Access Layer (Sanitized for Firebase)
 * Fixed: Illegal character stripping and empty key prevention
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

    Init() {
        if (!firebase.apps.length) firebase.initializeApp(this.Config.firebase);
        this.DB = firebase.database();
        console.log("%c📡 [API] Database Engine Synchronized", "color: #0d6efd; font-weight: bold;");
    },

    async CheckUniqueness(sheetName, column, value) {
        try {
            const snapshot = await this.DB.ref(`${App.State.userId}/Masters/${sheetName}`).once('value');
            const data = snapshot.val();
            if (!data) return false;
            return Object.values(data).some(record => 
                String(record[column] || "").trim().toLowerCase() === value.trim().toLowerCase()
            );
        } catch (e) { return false; }
    },

    async PopulateAllDatalists(form) {
        const lookupInputs = form.querySelectorAll('[data-fetch_column]');
        for (const input of lookupInputs) {
            const sheet = input.dataset.sheet_name;
            const colDef = input.dataset.column_name;
            const listId = input.getAttribute('list');
            if (!sheet || !listId) continue;

            let data = this._MasterCache[sheet];
            if (!data) {
                const snap = await this.DB.ref(`${App.State.userId}/Masters/${sheet}`).once('value');
                data = snap.val();
                this._MasterCache[sheet] = data;
            }

            const datalist = document.getElementById(listId);
            if (datalist && data) {
                datalist.innerHTML = "";
                const cols = colDef.split('&').map(c => c.trim());
                Object.values(data).forEach(record => {
                    // Use the last column in the definition as the primary value (e.g. itemName)
                    const mainVal = record[cols[cols.length-1]];
                    if (mainVal) {
                        let opt = document.createElement('option');
                        opt.value = mainVal;
                        opt.textContent = cols.map(c => record[c]).filter(v => v).join(' | ');
                        datalist.appendChild(opt);
                    }
                });
            }
        }
    },

    async HandleLookup(input) {
        const val = input.value.trim();
        const sheet = input.dataset.sheet_name;
        const colDef = input.dataset.column_name;
        const sourceName = input.name.replace('[]', '');

        if (!val || !this._MasterCache[sheet]) return;

        const columns = colDef.split('&').map(c => c.trim());
        let match = null;
        Object.values(this._MasterCache[sheet]).forEach(record => {
            if (columns.some(col => String(record[col] || "").toLowerCase() === val.toLowerCase())) match = record;
        });

        if (match) {
            const scope = input.closest('tr') || input.closest('form');
            Object.entries(match).forEach(([key, value]) => {
                // Sanitize the key to match how the HTML names are written
                const safeKey = key.replace(/\s+/g, '_');
                const targets = scope.querySelectorAll(`[name="auto_${sourceName}_${safeKey}"]`);
                targets.forEach(el => { 
                    el.value = value; 
                    el.classList.add('bg-info-subtle'); 
                    setTimeout(() => el.classList.remove('bg-info-subtle'), 500); 
                });
            });
            if(window.recalculateVoucher) window.recalculateVoucher();
        }
    },

    /**
     * 🚀 FIXED VOUCHER POSTING
     */
    async PostVoucher(form) {
        // Collect Header Data
        const formData = new FormData(form);
        const raw = Object.fromEntries(formData.entries());

        // Standardize the Transaction Object
        const transaction = {
            header: {
                doc_no: Utils.GenerateDocID(raw.documentType || 'VCH'),
                date: raw.voucher_date || new Date().toISOString().split('T')[0],
                entity: raw.customer_ledger || raw.gl_account || "Unknown",
                project: raw.project || 'General',
                narration: raw.narration || '',
                posted_at: firebase.database.ServerValue.TIMESTAMP,
                status: 'POSTED'
            },
            // Get clean sanitized items
            items: this._GetGridItems(form),
            meta: { 
                user: App.State.userId, 
                form_id: form.id 
            }
        };

        try {
            const path = `${App.State.userId}/Transactions/${form.id}`;
            await this.DB.ref(path).push(transaction);
            App.UI.Notify('Success', `Document ${transaction.header.doc_no} Posted`, 'success');
            return true;
        } catch (e) {
            console.error("Firebase Push Error:", e);
            App.UI.Notify('Firebase Error', "Invalid data format in rows.", 'danger');
            return false;
        }
    },

    async SaveMaster(formId, data) {
        try {
            // Sanitize all keys in the Master object
            const sanitizedData = {};
            Object.entries(data).forEach(([k, v]) => {
                const safeK = k.replace(/[\.\#\$\/\[\]\s]/g, '_');
                sanitizedData[safeK] = v;
            });

            const path = `${App.State.userId}/Masters/${formId}`;
            await this.DB.ref(path).push({
                ...sanitizedData,
                created_at: firebase.database.ServerValue.TIMESTAMP
            });
            delete this._MasterCache[formId]; 
            App.UI.Notify('Success', 'Master Record Created', 'success');
            return true;
        } catch (e) {
            App.UI.Notify('Error', e.message, 'danger');
            return false;
        }
    },

    /**
     * 🛠️ INTERNAL HELPER: SANITIZE GRID DATA
     * Ensures keys don't contain spaces or illegal Firebase characters
     */
    _GetGridItems(form) {
        const items = [];
        form.querySelectorAll('tbody tr').forEach(row => {
            const item = {};
            let hasValidData = false;

            row.querySelectorAll('input, select, textarea').forEach(i => {
                if (!i.name) return; // Skip inputs without names (decorative)

                // 1. Remove brackets from array names (item_name[] -> item_name)
                // 2. Replace spaces/dots/illegal chars with underscores for Firebase
                const safeKey = i.name.replace(/\[\]/g, '').replace(/[\.\#\$\/\[\]\s]/g, '_');
                
                if (safeKey) {
                    item[safeKey] = i.value;
                    if (i.value.trim() !== "") hasValidData = true;
                }
            });

            // Only push the row if it contains at least one piece of actual data
            if (hasValidData) items.push(item);
        });
        return items;
    }
};