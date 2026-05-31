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
    
    // Step 1: Set all inputs to readonly with loading placeholder
    for (const input of lookupInputs) {
        const sheet = input.dataset.sheet_name;
        const listId = input.getAttribute('list');
        if (!sheet || !listId) continue;
        
        // Store original placeholder
        input.dataset.originalPlaceholder = input.placeholder || 'Search...';
        
        // Set loading state
        input.readOnly = true;
        input.placeholder = 'Loading...';
        
        // Add loading class for styling
        input.classList.add('loading-input');
    }
    
    // Step 2: Process each input (fetch data)
    for (const input of lookupInputs) {
        const sheet = input.dataset.sheet_name;
        const colDef = input.dataset.column_name;
        const listId = input.getAttribute('list');
        
        if (!sheet || !listId) continue;
        
        try {
            let data = this._MasterCache[sheet];
            
            if (!data) {
                // Show loading indicator on specific input
                input.style.opacity = '0.7';
                
                const snap = await this.DB.ref(`${App.State.userId}/Masters/${sheet}`).once('value');
                data = snap.val();
                this._MasterCache[sheet] = data;
                
                input.style.opacity = '';
            }
            
            const datalist = document.getElementById(listId);
            if (datalist && data && typeof data === 'object') {
                datalist.innerHTML = "";
                const cols = colDef.split('&').map(c => c.trim());
                
                // Convert data to array if it's an object
                const dataArray = Array.isArray(data) ? data : Object.values(data);
                
                dataArray.forEach(record => {
                    if (cols.length === 1) {
                        // Single column case
                        const value = record[cols[0]];
                        if (value) {
                            const option = document.createElement('option');
                            option.value = value;
                            option.textContent = value;
                            datalist.appendChild(option);
                        }
                    } 
                    else if (cols.length >= 2) {
                        // Multi-column case (display text & value)
                        const textPart = record[cols[0]];
                        const valuePart = record[cols[1]];
                        
                        if (textPart && valuePart) {
                            const option = document.createElement('option');
                            option.value = valuePart;
                            option.textContent = textPart;
                            option.setAttribute('data-value', valuePart);
                            option.setAttribute('data-text', textPart);
                            datalist.appendChild(option);
                        }
                    }
                });
                
                // Dispatch event that datalist is populated
                const event = new CustomEvent('datalistPopulated', { 
                    detail: { sheet: sheet, listId: listId, count: dataArray.length }
                });
                input.dispatchEvent(event);
            }
        } catch (error) {
            console.error(`Error populating ${sheet}:`, error);
            
            // Show error state
            input.placeholder = 'Error loading data';
            input.classList.add('error-input');
            
            // Show temporary error message
            if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                App.UI.Notify('Error', `Failed to load ${sheet}`, 'danger');
            }
        } finally {
            // Step 3: Restore input to normal state
            input.readOnly = false;
            input.classList.remove('loading-input');
            
            // Restore original placeholder
            if (input.dataset.originalPlaceholder) {
                input.placeholder = input.dataset.originalPlaceholder;
            } else {
                input.placeholder = 'Search...';
            }
            
            // Remove error class if exists
            setTimeout(() => {
                input.classList.remove('error-input');
            }, 3000);
        }
    }
    
    // Step 4: Trigger global event that all datalists are populated
    const completeEvent = new CustomEvent('allDatalistsPopulated', {
        detail: { total: lookupInputs.length }
    });
    document.dispatchEvent(completeEvent);
    
    console.log(`All ${lookupInputs.length} datalists populated successfully`);
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
                doc_no: raw.Invoice.toUpperCase() || 'VCH',
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
    },
    // Add this inside the API object
    async Fetch(path) {
        try {
            // Ensure path starts from userId. If it already includes it, remove it.
            // Based on your previous code, path looks like 'Transactions/SalesInvoiceForm'
            const fullPath = `${App.State.userId}/${path}`;
            const snap = await this.DB.ref(fullPath).once('value');
            return snap.val();
        } catch (e) {
            console.error("API Fetch Error:", e);
            return null;
        }
    },

    async DeleteTransaction(formId, key) {
        try {
            await this.DB.ref(`${App.State.userId}/Transactions/${formId}/${key}`).remove();
            App.UI.Notify('Success', 'Transaction Deleted', 'success');
            return true;
        } catch (e) {
            App.UI.Notify('Error', 'Could not delete.', 'danger');
            return false;
        }
    },
    // Add to API object in api.js
    async GetAllTransactionTypes() {
        try {
            const path = `${App.State.userId}/Transactions`;
            const snap = await this.DB.ref(path).once('value');
            return snap.exists() ? Object.keys(snap.val()) : [];
        } catch (e) {
            console.error("Error fetching transaction types:", e);
            return [];
        }
    },
    // Add to API object
    async UpdateTransaction(formId, key, updatedData) {
        try {
            await this.DB.ref(`${App.State.userId}/Transactions/${formId}/${key}`).update(updatedData);
            App.UI.Notify('Success', 'Transaction Updated', 'success');
            return true;
        } catch (e) {
            App.UI.Notify('Error', 'Update failed', 'danger');
            return false;
        }
    },
    // Add to API object in api.js
    async UpdateVoucher(form, formId, key) {
        const items = this._GetGridItems(form);
        
        // Standardize the Transaction Object
        const transaction = {
            header: {
                doc_no: form.querySelector('[name="doc_no"]')?.value || 'N/A',
                date: form.querySelector('[name="voucher_date"]')?.value || new Date().toISOString().split('T')[0],
                entity: form.querySelector('[name="customer_ledger"]')?.value || form.querySelector('[name="gl_account"]')?.value || "Unknown",
                narration: form.querySelector('[name="narration"]')?.value || '',
                posted_at: firebase.database.ServerValue.TIMESTAMP,
                status: 'UPDATED'
            },
            items: items,
            meta: { updated_by: App.State.userId }
        };

        try {
            await this.DB.ref(`${App.State.userId}/Transactions/${formId}/${key}`).update(transaction);
            App.UI.Notify('Success', 'Document Updated Successfully', 'success');
            return true;
        } catch (e) {
            App.UI.Notify('Error', 'Update failed: ' + e.message, 'danger');
            return false;
        }
    },
};