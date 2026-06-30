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
    console.log("post voucher worked", form);
    
    // =============================================================
    // 🔒 CHECK FOR HIDDEN UpdateStatus FIELD
    // =============================================================
    
    // Check if hidden UpdateStatus field exists and has value
    const updateStatusField = form.querySelector('[name="UpdateStatus"]');
    if (updateStatusField) {
        console.warn(`[PostVoucher] 🔒 UpdateStatus field found with value: ${updateStatusField.value}`);
        console.warn(`[PostVoucher] 🔒 This is an UPDATE operation. PostVoucher() is for CREATE only.`);
        
        if (typeof App !== 'undefined' && App.UI) {
            App.UI.Notify('Blocked', 'This is an update operation. Use the Update button.', 'warning');
        } else {
            alert('This is an update operation. Please use the Update button.');
        }
        
        return false; // Prevent posting - this is an update, not a create
    }
    
    // =============================================================
    // ALSO CHECK IF WE'RE IN EDIT MODE VIA URL PARAMS
    // =============================================================
    
    const urlParams = new URLSearchParams(window.location.search);
    const vchKey = urlParams.get('key');
    const formType = urlParams.get('type');
    
    if (vchKey && formType) {
        console.warn(`[PostVoucher] 🔒 URL params indicate EDIT mode (key: ${vchKey}, type: ${formType})`);
        console.warn(`[PostVoucher] 🔒 PostVoucher() is for CREATE only. Use UpdateVoucher() for updates.`);
        
        if (typeof App !== 'undefined' && App.UI) {
            App.UI.Notify('Blocked', 'Cannot create new record in edit mode. Use Update.', 'warning');
        } else {
            alert('Cannot create new record in edit mode. Please use the Update button.');
        }
        
        return false; // Prevent posting - this is an edit mode
    }
    
    // =============================================================
    // CHECK INTERNAL LOCK (if exists)
    // =============================================================
    
    if (typeof INTERNAL !== 'undefined') {
        if (INTERNAL.isAlreadyUpdated) {
            console.warn(`[PostVoucher] 🔒 INTERNAL.isAlreadyUpdated is true. Ignoring.`);
            if (typeof App !== 'undefined' && App.UI) {
                App.UI.Notify('Locked', 'This record has already been updated.', 'warning');
            }
            return false;
        }
        
        if (INTERNAL.isUpdating) {
            console.warn(`[PostVoucher] 🔒 INTERNAL.isUpdating is true. Update in progress.`);
            if (typeof App !== 'undefined' && App.UI) {
                App.UI.Notify('Please Wait', 'Update already in progress.', 'info');
            }
            return false;
        }
    }
    
    // Check hidden internal lock field
    try {
        const lockField = document.getElementById('_internal_lock');
        if (lockField && lockField.value === 'locked') {
            console.warn(`[PostVoucher] 🔒 Hidden lock field indicates record is locked. Ignoring.`);
            if (typeof App !== 'undefined' && App.UI) {
                App.UI.Notify('Locked', 'This record has already been updated.', 'warning');
            }
            return false;
        }
    } catch (e) {
        // Ignore if element not found
    }
    
    // =============================================================
    // CONTINUE WITH NORMAL PROCESSING (CREATE MODE)
    // =============================================================
    
    const formData = new FormData(form);
    const raw = Object.fromEntries(formData.entries());
    const formId = form.id || form.getAttribute('id');
    const rawDocNo = raw.Invoice || raw.paymentRef || raw.supplier_bill_no || `VCH-${Math.floor(Math.random() * 100000)}`;
    
    if (formId.includes('Sale') || formId.includes('Purchase')) {
        await this.EnsureSystemLedgers();
    }

    // --- EXTRACT ADDITIONAL DYNAMIC DATA FOR META ---
    const standardKeys = [
        'Invoice', 'paymentRef', 'supplier_bill_no', 'customer_ledger', 'gl_account',
        'voucher_date', 'valueDate', 'project', 'CompanyName', 'instrumentDate', 'narration'
    ];
    
    const dynamicMetaData = {};
    for (let key in raw) {
        if (!standardKeys.includes(key) && !key.includes('[]')) {
            dynamicMetaData[key] = raw[key];
        }
    }

    // --- CALCULATE STOCK ACCUMULATED AMOUNT ---
    const items = this._GetGridItems(form);
    let subTotal = 0;
    let taxTotal = 0;
    
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
        primaryDebit = entity;
        primaryCredit = "Sales Account";
    } 
    else if (formId.toLowerCase().includes('purchase')) {
        primaryDebit = "Purchase Account";
        primaryCredit = entity;
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
            subTotal: subTotal,
            taxTotal: taxTotal,
            grandTotal: grandTotal,
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
            ...dynamicMetaData
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
        console.log("Save master ran")
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
    async Delete(endpoint) {
        try {
            console.log('🗑️ API.Delete called with endpoint:', endpoint);
            
            // ==========================================
            // METHOD 1: Native Firebase SDK (Preferred & Fastest)
            // ==========================================
            if (this.DB) {
                // Ensure it routes to the correct user's database node
                let dbPath = endpoint;
                if (typeof App !== 'undefined' && App.State && App.State.userId) {
                    // Prevent double-prefixing if endpoint already contains userId
                    if (!dbPath.startsWith(App.State.userId)) {
                        dbPath = `${App.State.userId}/${dbPath}`;
                    }
                }
                
                await this.DB.ref(dbPath).remove();
                console.log('✅ Delete successful via Firebase SDK');
                return true;
            }

            // ==========================================
            // METHOD 2: Firebase REST API Fallback (fetch)
            // ==========================================
            // Firebase Realtime DB REST requires ".json" at the end of the URL
            let targetUrl = `${this.baseURL}/${endpoint}.json`;
            
            // Firebase REST auth uses query parameters, not Bearer headers
            const token = localStorage.getItem('token') || localStorage.getItem('idToken');
            if (token) {
                targetUrl += `?auth=${token}`;
            }

            const response = await fetch(targetUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('📊 Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Delete failed with status:', response.status, errorText);
                throw new Error(`Delete failed: ${response.status} ${errorText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const result = await response.json();
                console.log('✅ REST Delete successful, result:', result);
                return result;
            }
            
            console.log('✅ REST Delete successful (no content)');
            return true;
            
        } catch (error) {
            console.error('❌ API.Delete error:', error);
            throw error;
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
    console.log("UpdateTransaction:", { formId, key, updatedData });

    try {
        if (!formId) throw new Error("Missing formId.");
        if (!key) throw new Error("Missing record key.");
        if (!updatedData || typeof updatedData !== "object") {
            throw new Error("Invalid update data.");
        }

        // Update timestamp automatically
        updatedData.updated_at = Date.now();

        const ref = this.DB.ref(
            `${App.State.userId}/Transactions/${formId}/${key}`
        );

        // Only updates the supplied fields
        await ref.update(updatedData);

        App.UI.Notify(
            "Success",
            "Transaction Updated Successfully",
            "success"
        );

        return {
            success: true,
            id: key
        };

    } catch (error) {
        console.error("UpdateTransaction Error:", error);

        App.UI.Notify(
            "Error",
            error.message || "Update failed",
            "danger"
        );

        return {
            success: false,
            error: error.message
        };
    }
},
    async Update(endpoint, payload) {
        try {
            console.log('🔄 API.Update called with endpoint:', endpoint);

            // ==========================================
            // METHOD 1: Native Firebase SDK (Preferred & Fastest)
            // ==========================================
            if (this.DB) {
                // Ensure correct user routing
                let dbPath = endpoint;
                if (typeof App !== 'undefined' && App.State && App.State.userId) {
                    if (!dbPath.startsWith(App.State.userId)) {
                        dbPath = `${App.State.userId}/${dbPath}`;
                    }
                }

                const targetRef = this.DB.ref(dbPath);

                // 🛑 SAFETY CHECK: Ensure the record already exists to prevent duplication
                const snapshot = await targetRef.once('value');
                if (!snapshot.exists()) {
                    console.error(`❌ Update aborted: No existing record found at path -> ${dbPath}`);
                    throw new Error("Record does not exist. Cannot update.");
                }

                // Perform the update safely
                await targetRef.update(payload);
                console.log('✅ Update successful via Firebase SDK');
                return true;
            }

            // ==========================================
            // METHOD 2: Firebase REST API Fallback (fetch)
            // ==========================================
            let targetUrl = `${this.baseURL}/${endpoint}.json`;
            const token = localStorage.getItem('token') || localStorage.getItem('idToken');
            if (token) {
                targetUrl += `?auth=${token}`;
            }

            // 🛑 SAFETY CHECK (REST): Fetch first to ensure it exists
            const checkResponse = await fetch(targetUrl);
            const existingData = await checkResponse.json();
            if (existingData === null) {
                console.error(`❌ REST Update aborted: No existing record found at -> ${endpoint}`);
                throw new Error("Record does not exist. Cannot update.");
            }

            // Perform PATCH request
            // Note: We use PATCH instead of PUT. PUT deletes everything and replaces it. PATCH only updates provided keys.
            const response = await fetch(targetUrl, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            console.log('📊 Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Update failed with status:', response.status, errorText);
                throw new Error(`Update failed: ${response.status} ${errorText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const result = await response.json();
                console.log('✅ REST Update successful, result:', result);
                return result;
            }
            
            console.log('✅ REST Update successful (no content)');
            return true;
            
        } catch (error) {
            console.error('❌ API.Update error:', error);
            throw error;
        }
    },
   
    async SecureMasterUpdate(moduleName, recordId, payload) {
        console.log(`[SecureMasterUpdate] Initiating for ${moduleName} / ${recordId}`);

        // 1. Strict Input Sanitization
        const cleanId = typeof recordId === 'string' ? recordId.trim() : recordId;
        if (!cleanId || cleanId === 'undefined' || cleanId === 'null') {
            throw new Error("Invalid Record ID provided. Update aborted to prevent phantom duplication.");
        }

        const cleanModule = String(moduleName).trim();
        const basePath = (typeof App !== 'undefined' && App.State && App.State.userId) ? App.State.userId : '';
        const dbPath = basePath ? `${basePath}/Masters/${cleanModule}/${cleanId}` : `Masters/${cleanModule}/${cleanId}`;

        // Inject timestamp automatically
        const finalPayload = { ...payload, updated_at: new Date().toISOString() };

        // 2. Firebase SDK Approach (Primary)
        if (this.DB) {
            const targetRef = this.DB.ref(dbPath);

            // READ-BEFORE-WRITE LOCK: The ultimate anti-duplicate shield
            const snapshot = await targetRef.once('value');
            if (!snapshot.exists()) {
                throw new Error(`Record ID '${cleanId}' does not exist in ${cleanModule}. Cannot update a ghost record.`);
            }

            await targetRef.update(finalPayload);
            console.log(`[SecureMasterUpdate] ✅ Successfully updated via SDK`);
            return true;
        }

        // 3. REST API Fallback
        let targetUrl = `${this.baseURL}/${dbPath}.json`;
        const token = localStorage.getItem('token') || localStorage.getItem('idToken');
        if (token) targetUrl += `?auth=${token}`;

        // Check existence first
        const checkRes = await fetch(targetUrl);
        const existingData = await checkRes.json();
        if (existingData === null) {
            throw new Error(`Record ID '${cleanId}' does not exist in ${cleanModule}. Update aborted.`);
        }

        // Execute PATCH (Not PUT, so it only updates specific fields)
        const response = await fetch(targetUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload)
        });

        if (!response.ok) throw new Error(`REST Update failed with status: ${response.status}`);
        return true;
    },

    /**
     * Deletes a Master record safely.
     * @param {String} moduleName - e.g., 'Companies', 'Ledgers', 'Stock'
     * @param {String} recordId - The exact Firebase Key
     */
    async SafeMasterDelete(moduleName, recordId) {
        console.log(`[SafeMasterDelete] Initiating for ${moduleName} / ${recordId}`);

        // 1. Strict Input Sanitization
        const cleanId = typeof recordId === 'string' ? recordId.trim() : recordId;
        if (!cleanId || cleanId === 'undefined' || cleanId === 'null') {
            throw new Error("Invalid Record ID. Deletion aborted.");
        }

        const cleanModule = String(moduleName).trim();
        const basePath = (typeof App !== 'undefined' && App.State && App.State.userId) ? App.State.userId : '';
        const dbPath = basePath ? `${basePath}/Masters/${cleanModule}/${cleanId}` : `Masters/${cleanModule}/${cleanId}`;

        // 2. Firebase SDK Approach (Primary)
        if (this.DB) {
            await this.DB.ref(dbPath).remove();
            console.log(`[SafeMasterDelete] ✅ Successfully deleted via SDK`);
            return true;
        }

        // 3. REST API Fallback
        let targetUrl = `${this.baseURL}/${dbPath}.json`;
        const token = localStorage.getItem('token') || localStorage.getItem('idToken');
        if (token) targetUrl += `?auth=${token}`;

        const response = await fetch(targetUrl, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`REST Delete failed with status: ${response.status}`);
        return true;
    },
    // Add to API object in api.js
    async UpdateVoucher(form, formId, passedKey) {
        console.log("calling update voucher")
    // 1. Hunt for the key: Check the parameter first, then check the hidden input
    const key = passedKey || form.querySelector('[name="voucher_key"]')?.value || document.getElementById('active_voucher_key')?.value;

    // 2. SAFETY CATCH: Prevent creating a new voucher if the key is lost
    if (!key || key === 'undefined' || key === 'null') {
        console.error("CRITICAL ERROR: The Voucher Key was lost by the offcanvas!");
        App.UI.Notify('Error', 'System lost the document ID. Update cancelled to prevent duplicates.', 'danger');
        return false; 
    }

    const items = this._GetGridItems(form);
    
    const headerData = {
        doc_no: form.querySelector('[name="doc_no"]')?.value || 'N/A',
        date: form.querySelector('[name="voucher_date"]')?.value || new Date().toISOString().split('T')[0],
        entity: form.querySelector('[name="customer_ledger"]')?.value || form.querySelector('[name="gl_account"]')?.value || "Unknown",
        narration: form.querySelector('[name="narration"]')?.value || '',
        posted_at: firebase.database.ServerValue.TIMESTAMP,
        status: 'UPDATED'
    };

    const metaData = { updated_by: App.State.userId };

    try {
        // 3. Update using the strictly verified key
        await this.DB.ref(`${App.State.userId}/Transactions/${formId}/${key}`).update({
            header: headerData,
            items: items,
            meta: metaData
        });

        App.UI.Notify('Success', 'Document Updated Successfully', 'success');
        return true;
    } catch (e) {
        App.UI.Notify('Error', 'Update failed: ' + e.message, 'danger');
        return false;
    }
},
};