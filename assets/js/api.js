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
  // 1. AUTO-CREATE SYSTEM LEDGERS (Including Tax)
    async EnsureSystemLedgers() {
        const userId = App.State.userId;
        if (window._systemLedgersVerified) return;

        const systemLedgers = [
            { code: "SYS-SALES", name: "Sales Account", ledgerType: "Direct Incomes", ledgerNature: "Credit" },
            { code: "SYS-PURCH", name: "Purchase Account", ledgerType: "Direct Expenses", ledgerNature: "Debit" },
            { code: "SYS-TAX", name: "Duties and Taxes", ledgerType: "Duties & Taxes", ledgerNature: "Credit" }
        ];

        try {
            const existingData = await API.Fetch(`Masters/LedgerCreation`);
            const existingNames = existingData ? Object.values(existingData).map(l => l.name.toLowerCase()) : [];

            for (let led of systemLedgers) {
                if (!existingNames.includes(led.name.toLowerCase())) {
                    await this.DB.ref(`${userId}/Masters/LedgerCreation`).push({
                        ledgerCode: led.code,
                        name: led.name,
                        ledgerType: led.ledgerType,
                        ledgerNature: led.ledgerNature,
                        isSystem: true
                    });
                }
            }
            window._systemLedgersVerified = true;
        } catch (e) { }
    },

// 2. UPDATED POST VOUCHER (Calculates Subtotal, Taxes & Dynamic Meta)
    async PostVoucher(form) {
        const formData = new FormData(form);
        const raw = Object.fromEntries(formData.entries());
        const formId = form.id || form.getAttribute('id');
        const rawDocNo = raw.Invoice || raw.paymentRef || raw.supplier_bill_no || `VCH-${Math.floor(Math.random() * 100000)}`;
        
        if (formId.includes('Sale') || formId.includes('Purchase')) {
            await this.EnsureSystemLedgers();
        }

        // --- EXTRACT ADDITIONAL DYNAMIC DATA FOR META ---
        // List of known standard fields to exclude from the meta dump
        const standardKeys = [
            'Invoice', 'paymentRef', 'supplier_bill_no', 'customer_ledger', 'gl_account',
            'voucher_date', 'valueDate', 'project', 'CompanyName', 'instrumentDate', 'narration'
        ];
        
        const dynamicMetaData = {};
        for (let key in raw) {
            // Include only if it's NOT a standard header key, and NOT an item array field (which have '[]' in their names)
            if (!standardKeys.includes(key) && !key.includes('[]')) {
                dynamicMetaData[key] = raw[key];
            }
        }

        // --- CALCULATE STOCK ACCUMULATED AMOUNT ---
        const items = this._GetGridItems(form);
        let subTotal = 0; // The pure stock/item amount
        let taxTotal = 0; // The tax amount
        
        items.forEach(i => {
            const qty = parseFloat(i.qty) || 1;
            const rate = parseFloat(i.rate) || parseFloat(i.amount) || 0;
            const tax = parseFloat(i.auto_item_name_ItemTax) || parseFloat(i.taxRate) || 0;
            
            const base = qty * rate;
            subTotal += base;
            taxTotal += base * (tax / 100);
        });
        
        const grandTotal = subTotal + taxTotal;

        // --- DOUBLE ENTRY ROUTING ---
        let primaryDebit = "";
        let primaryCredit = "";
        let taxLedger = "Duties and Taxes";
        let entity = raw.customer_ledger || raw.gl_account || "Unknown";

        if (formId.toLowerCase().includes('sale')) {
            primaryDebit = entity;             // Customer gets Grand Total
            primaryCredit = "Sales Account";   // Sales gets SubTotal
        } 
        else if (formId.toLowerCase().includes('purchase')) {
            primaryDebit = "Purchase Account"; // Purchase gets SubTotal
            primaryCredit = entity;            // Supplier gets Grand Total
        } 
        else if (formId.toLowerCase().includes('receipt')) {
            primaryDebit = entity;             
            primaryCredit = "MULTIPLE";        
        } 
        else if (formId.toLowerCase().includes('payment')) {
            primaryDebit = "MULTIPLE";         
            primaryCredit = entity;            
        }

        const transaction = {
            header: {
                doc_no: rawDocNo.toUpperCase(),
                date: raw.voucher_date || raw.valueDate || new Date().toISOString().split('T')[0],
                entity: entity,
                debitLedger: primaryDebit,   
                creditLedger: primaryCredit, 
                taxLedger: taxLedger,
                subTotal: subTotal,     // Saved securely to database
                taxTotal: taxTotal,     // Saved securely to database
                grandTotal: grandTotal, // Saved securely to database
                project: raw.project || 'General',
                CompanyCode: raw.CompanyName || '',
                instrumentDate: raw.instrumentDate || '',
                narration: raw.narration || '',
                posted_at: firebase.database.ServerValue.TIMESTAMP,
                status: 'POSTED'
            },
            items: items,
            meta: { 
                user: App.State.userId, 
                form_id: formId,
                ...dynamicMetaData // Automatically spreads fields like lr_no, vehicle_no, transporter into the DB
            }
        };

        try {
            const path = `${App.State.userId}/Transactions/${formId}`;
            await this.DB.ref(path).push(transaction);
            App.UI.Notify('Success', `Document ${transaction.header.doc_no} Posted`, 'success');
            return true;
        } catch (e) {
            App.UI.Notify('Firebase Error', "Invalid data format.", 'danger');
            return false;
        }
    },

    async SaveMaster(formId, data) {
        try {
            // --- 1. STRICT AUTO-LIST VALIDATION ---
            // Grab the form element from the DOM (assuming formId matches the HTML id)
            const formElement = document.getElementById(formId) || document.querySelector('form');

            if (formElement) {
                // Find all inputs that have a 'list' attribute (HTML5 datalists)
                const listInputs = formElement.querySelectorAll('input[list]');

                for (let input of listInputs) {
                    const dataListId = input.getAttribute('list');
                    const dataList = document.getElementById(dataListId);

                    if (dataList) {
                        // Create an array of all valid values from the datalist options (lowercased for safe matching)
                        const validOptions = Array.from(dataList.options).map(opt => opt.value.trim().toLowerCase());
                        
                        // Get what the user actually submitted
                        const submittedValue = (data[input.name] || "").trim().toLowerCase();

                        // If they submitted a value, check if it exists in the valid array
                        if (submittedValue && !validOptions.includes(submittedValue)) {
                            const fieldName = input.getAttribute('placeholder') || input.name || "the field";
                            App.UI.Notify('Validation Error', `Invalid entry for "${fieldName}". Please select an option from the list.`, 'warning');
                            
                            return false; // Abort the save entirely
                        }
                    }
                }
            }
            // --- END VALIDATION ---

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