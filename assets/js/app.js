/**
 * UNITAX PRO - Core Application Brain (Final Stable)
 * Handles: Routing, Logic Injection, Auto-Fill, Uniqueness, and UI Themes
 */
// console.log('App.js initialized')
const App = {
    State: {
        userId: localStorage.getItem('userloginid'),
        userName: localStorage.getItem('userName'),
        userRole: localStorage.getItem('userrole'),
        activeModule: null,
        isDarkMode: localStorage.getItem('darkMode') === 'enabled'
    },
    
    async GetPersistentData(path, stateKey) {
    // 1. Check if already in memory
    if (this.State[stateKey]) {
        console.log(`[Cache Hit] Using cached data for: ${stateKey}`);
        return this.State[stateKey];
    }

    // 2. DEBUG: Log the path we are trying to fetch
    console.log(`[Database Fetch] Attempting to fetch path: ${path}`);
    
    try {
        const data = await API.Fetch(path);
        
        // 3. DEBUG: Check if response is empty
        if (!data) {
            console.error(`[Database Error] No data found at path: ${path}. Verify the userId and node structure.`);
            return null;
        }

        console.log(`[Database Success] Successfully cached ${stateKey}`);
        this.State[stateKey] = data;
        return data;
    } catch (err) {
        console.error(`[Database Error] Exception while fetching ${path}:`, err);
        return null;
    }
},


    async Init() {
    try {
        // 1. Auth Guard
        if (!this.State.userId) { 
            window.location.href = 'login.html'; 
            return; 
        }
        
        // 2. Initialize Sub-Systems (Sequential dependencies)
        API.Init();
        this.UI.InitTheme();
        this.UI.StartClock();
        this.BindGlobalEvents();

        // 🎯 FIX: Wrap notification engines in a safe block 
        // We don't necessarily need to 'await' these unless they perform critical DB syncs,
        // but we ensure they are called safely.
        try {
            NotificationEngine.Init();
            BrowserNotificationEngine.Init();
        } catch (notifErr) {
            console.error("⚠️ [App] Notification Engine failed to start:", notifErr);
        }

        // 3. Set Header Displays
        // Safely check if elements exist before setting innerText
        const nameEl = document.getElementById('usernameDisplay');
        const roleEl = document.getElementById('main_role_show');
        const userIdEl = document.getElementById('main_userid_show');

        if(nameEl) nameEl.innerText = this.State.userName || "User";
        if(roleEl) roleEl.innerText = (this.State.userRole || "User").toUpperCase();
        if(userIdEl) userIdEl.innerText = `ID: ${this.State.userId}`;

        // 4. Handle Routing
        const pinnedModule = localStorage.getItem('pinnedModule');
        if (pinnedModule) {
            console.log(`📡 [App] Loading pinned module: ${pinnedModule}`);
            await this.Router(pinnedModule);
        } else {
            await this.Router('dashboard');
        }

    } catch (err) {
        console.error("🔴 [App] Critical Startup Failure:", err);
    } finally {
        // 5. Always remove loader, even if something fails
        const loader = document.getElementById('app-loader');
        if(loader) loader.style.display = 'none';
    }
},
    Search: {
        Registry: {
            "dash": "dashboard",
            "comp": "masters/company-cw",
            "ledger": "masters/ledger-cw",
            "stock": "masters/stock-cw",
            "project": "masters/project-cw",
            "sales": "transactions/sales-inv",
            "pur": "transactions/purchase-inv",
            "bank": "transactions/receipt-pay",
            "gl": "reports/gl-statement"
        },

        HandleSearch(query) {
            const input = query.toLowerCase().trim();
            if (!input) return;

            const registryList = document.getElementById('moduleRegistry');
            const allOptions = registryList ? Array.from(registryList.querySelectorAll('option')).map(o => o.value) : [];
            const aliasPath = this.Registry[input];

            if (allOptions.includes(input)) {
                App.Router(input);
                this.Clear();
            } else if (aliasPath) {
                App.Router(aliasPath);
                this.Clear();
            } else {
                App.UI.Notify('Navigation', `Module "${input}" not found.`, 'warning');
            }
        },

        Clear() {
            const s = document.getElementById('globalSearch');
            if (s) { s.value = ""; s.blur(); }
        }
    },
    /**
     * AJAX ROUTER (Force Script Execution)
     * This ensures JS inside modules like sales-inv.html actually runs.
     */
    async Router(path) {
        const viewport = document.getElementById('main-content');
        const loader = document.getElementById('section-loader');
        
        if(loader) loader.style.display = 'block';
        viewport.style.opacity = '0.5';

        try {
            const res = await fetch(`modules/${path}.html`);
            if(!res.ok) throw new Error("Module not found");
            const html = await res.text();
            
            // 1. Inject HTML content
            viewport.innerHTML = html;
            this.State.activeModule = path;

            // 2. 🔥 THE SCRIPT FIX: Manually find and execute scripts in the injected HTML
            const scripts = viewport.querySelectorAll("script");
            scripts.forEach(oldScript => {
                const newScript = document.createElement("script");
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            // 3. Initialize ERP Logic (Lookups, Uniqueness, etc.)
            this.InitERPLogic(path);

        } catch (e) {
            console.error("Router Failure:", e);
            viewport.innerHTML = `<div class="alert alert-danger m-3">Critical Error: Module [${path}] failed to load.</div>`;
        } finally {
            if(loader) loader.style.display = 'none';
            viewport.style.opacity = '1';
        }
    },

    /**
     * ERP MODULE INITIALIZER
     * Binds all advanced ERP behaviors to the current module form.
     */
    async InitERPLogic(path) {
        const form = document.querySelector('form');
        if (!form) return;

        // 1. Populate Datalists immediately from Firebase (Masters)
        await API.PopulateAllDatalists(form);

        // 2. Debounced Uniqueness Check (e.g., prevents duplicate CompanyCode)
        form.querySelectorAll('[data-check-unique="true"]').forEach(input => {
            input.addEventListener('input', Utils.Debounce(async (e) => {
                const val = e.target.value.trim();
                const sheet = e.target.dataset.sheet_name;
                const col = e.target.dataset.column_name;
                const saveBtn = form.querySelector('[type="submit"]');

                if (val.length < 3) return;

                e.target.style.borderRight = "3px solid #ffc107"; // Yellow: Checking...

                const isDuplicate = await API.CheckUniqueness(sheet, col, val);
                
                e.target.classList.toggle('is-invalid', isDuplicate);
                e.target.classList.toggle('is-valid', !isDuplicate);
                e.target.style.borderRight = isDuplicate ? "3px solid #dc3545" : "3px solid #198754";
                
                if(saveBtn) saveBtn.disabled = isDuplicate;
                if(isDuplicate) this.UI.Notify('Validation', `Value "${val}" already exists in ${sheet}`, 'danger');
            }, 500));
        });

        // 3. Auto-Lookup & Calculation Observer
        form.addEventListener('input', (e) => {
            const input = e.target;
            
            // A. Trigger Auto-Fill when typing matches a list item
            if (input.hasAttribute('data-fetch_column')) {
                const listId = input.getAttribute('list');
                const list = document.getElementById(listId);
                if (list) {
                    const options = Array.from(list.options).map(o => o.value);
                    if (options.includes(input.value)) {
                        API.HandleLookup(input);
                    }
                }
            }

            // B. Trigger Real-time Math for Transactions
            if (path.includes('transactions/')) {
                if (input.classList.contains('qty') || input.classList.contains('rate')) {
                    if (typeof window.recalculateVoucher === 'function') window.recalculateVoucher();
                }
            }
        });

        // 4. Submission Handler (Masters vs. Transactions)
        // 4. Submission Handler (Masters, Transactions, or Updates)
    form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type="submit"]');
        const originalBtnHtml = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Processing...`;

        // Detect if we are in "Edit Mode"
        const urlParams = new URLSearchParams(window.location.search);
        const vchKey = urlParams.get('key'); // Firebase key
        const formType = urlParams.get('type'); // e.g., SalesInvoiceForm

        const isMaster = form.dataset.category === 'Masters';
        const data = Object.fromEntries(new FormData(form).entries());
        
        let success = false;

        if (isMaster) {
            success = await API.SaveMaster(form.id, data);
        } else if (vchKey && formType) {
            // 🚀 UPDATE MODE: Use the new UpdateVoucher function
            success = await API.UpdateVoucher(form, formType, vchKey);
        } else {
            // 🚀 CREATE MODE
            success = await API.PostVoucher(form);
        }

        if (success) {
            if (!vchKey) form.reset(); // Don't reset if we were editing
            if (typeof window.recalculateVoucher === 'function') window.recalculateVoucher();
            if (vchKey) App.Router(path); // Return to list view after edit
        }
        
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
    };

        this.Log(`Module Ready: ${path}`);
    },

    BindGlobalEvents() {
        const searchInput = document.getElementById('globalSearch');

        // Global Shortcut: /
        document.addEventListener('keydown', (e) => {
            if (e.key === '/') {
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    searchInput?.focus();
                    searchInput?.select();
                }
            }
            if (e.key === 'Escape' && document.activeElement === searchInput) {
                App.Search.Clear();
            }
        });

        // Add this logic to your App initialization or where you fetch user data
        const userEmail = App.State.userId || "user@example.com";
        const userName = App.State.userName || "User";

        // Update the Initial
        document.getElementById('userInitial').innerText = userName.charAt(0).toUpperCase();

        // Update the Profile display info
        document.getElementById('userNameDisplay').innerText = userName;
        document.getElementById('userEmailDisplay').innerText = userEmail;

        // Handle Logout - Hook into your existing logic
        document.getElementById('logoutButton').addEventListener('click', (e) => {
            e.preventDefault();
            App.Auth.Logout(); 
            // if (confirm("Are you sure you want to logout?")) {
            //     // Call your existing logout function here
            // }
        });

        // Global Shortcut: Enter
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                App.Search.HandleSearch(searchInput.value);
            }
        })
        // Module Navigation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-module]');
            if (link) { 
                e.preventDefault(); 
                this.Router(link.dataset.module); 
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'F10') {
                e.preventDefault();
                const current = this.State.activeModule;
                const pinned = localStorage.getItem('pinnedModule');

                if (pinned === current) {
                    // Remove Pin
                    localStorage.removeItem('pinnedModule');
                    this.UI.Notify('System', `Module '${current}' unpinned.`, 'warning');
                } else {
                    // Set Pin
                    localStorage.setItem('pinnedModule', current);
                    this.UI.Notify('System', `Module '${current}' fixed. It will load on startup.`, 'success');
                }
            }
        })
        
     

        

        // Dark Mode Toggle
        const toggle = document.getElementById('darkModeToggleset');
        if(toggle) {
            toggle.addEventListener('change', (e) => {
                this.UI.ToggleDarkMode(e.target.checked);
            });
        }

        // Global Shortcuts (/) for Search
        document.addEventListener('keydown', (e) => {
            if (e.key === '/') {
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    document.getElementById('globalSearch')?.focus();
                }
            }
        });

        // Logout
        const logoutBtn = document.getElementById('logoutButton');
        if(logoutBtn) {
            logoutBtn.onclick = () => {
                if(confirm("Sign out of UniTax Pro?")) {
                    localStorage.clear(); 
                    window.location.href = 'login.html';
                }
            };
        }
    },

    UI: {
 Notify(title, message, type = 'primary') {
    const box = document.getElementById('errorNotificationBox');
    const titleEl = document.getElementById('notifyTitle');
    const msgEl = document.getElementById('notifyMessage');
    const iconEl = document.getElementById('notifyIcon');

    if (!box) return;

    // 1. Clear any existing hide-timer to prevent premature sliding down
    if (window._notifyTimeout) clearTimeout(window._notifyTimeout);

    // 2. Set Content
    // titleEl.innerText = title;
    msgEl.innerText = message;

    // 3. Set Professional Icon based on Type
    let iconClass = "bi-info-circle-fill";
    if (type === 'success') iconClass = "bi-check-circle-fill";
    if (type === 'danger' || type === 'error') iconClass = "bi-exclamation-triangle-fill";
    if (type === 'warning') iconClass = "bi-exclamation-circle-fill";
    iconEl.className = `bi ${iconClass} me-3 fs-5`;

    // 4. Set Background Color (using Bootstrap classes)
    const bgClass = type === 'error' ? 'danger' : type; 
    box.className = `error-notification-bar slide-up bg-${bgClass} text-white shadow-lg`;

    // 5. Auto-Hide Logic: Slide down after 5 seconds
    window._notifyTimeout = setTimeout(() => {
        box.classList.remove('slide-up');
        box.classList.add('slide-down');
        
        // Remove animation classes after they finish
        setTimeout(() => {
            box.className = 'error-notification-bar';
        }, 500); 
    }, 5000);
},
        StartClock() {
            setInterval(() => {
                const n = new Date();
                const t = document.getElementById('liveTime');
                const d = document.getElementById('liveDate');
                if(t) t.innerText = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if(d) d.innerText = n.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
            }, 1000);
        },
        InitTheme() {
            const isEnabled = localStorage.getItem('darkMode') === 'enabled';
            if (isEnabled) {
                document.body.classList.add('dark-mode');
                const toggle = document.getElementById('darkModeToggle');
                if(toggle) toggle.checked = true;
            }
        },
        
        ToggleDarkMode(enable) {
            if (enable) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'enabled');
                App.UI.Notify('Appearance', 'Dark Mode Enabled', 'info');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'disabled');
                App.UI.Notify('Appearance', 'Light Mode Enabled', 'info');
            }
        },
    },

    Log(msg) {
        const logger = document.getElementById('systemLogging');
        if (logger) {
            logger.innerHTML += `<div><span class="opacity-50">[${new Date().toLocaleTimeString()}]</span> > ${msg}</div>`;
            logger.scrollTop = logger.scrollHeight;
        }
    }
};


// 1. Open Modal (Unchanged)
window.opentaskmodal = function() {
    new bootstrap.Modal(document.getElementById('taskModal')).show();
};

// 2. Save Task (Now syncs to Firebase)
window.saveTask = async function() {
    const input = document.getElementById('taskInput');
    const taskText = input.value.trim();
    if (!taskText) return;

    // Get current user details from local storage
    const currentUserId = localStorage.getItem('userloginid');
    const currentUserName = localStorage.getItem('userName') || "User";

    // Task Payload
    // Note: Since you are building the Manager UI later, this function 
    // currently defaults to creating a "Self-Assigned" task for the active user.
    const taskData = {
        text: taskText,
        assignedTo: currentUserId, // Who has to do the task
        assignedBy: "Self",        // System flag (Self vs Manager)
        assignerName: currentUserName, // Name to display
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        done: false
    };

    try {
        const db = firebase.database();
        await db.ref('Tasks').push(taskData);
        
        input.value = '';
        bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
        // Note: We don't need to manually call renderTasks() here because 
        // the real-time listener below will detect the new task and auto-update.
    } catch (error) {
        console.error("Task Save Error:", error);
        alert("Failed to save task.");
    }
};

// 3. Render Tasks (Real-time listener from Firebase)
window.renderTasks = function() {
    const tbody = document.getElementById('taskTableBody');
    const currentUserId = localStorage.getItem('userloginid');

    if (!currentUserId || !tbody) return;

    // Show loading skeleton initially
    tbody.innerHTML = '<tr><td class="text-center text-muted py-3"><span class="spinner-border spinner-border-sm"></span> Syncing tasks...</td></tr>';

    const db = firebase.database();
    
    // Listen ONLY for tasks assigned to the currently logged-in user
    db.ref('Tasks').orderByChild('assignedTo').equalTo(currentUserId).on('value', (snapshot) => {
        const tasks = snapshot.val() || {};
        
        if (Object.keys(tasks).length === 0) {
    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="text-center py-4">
                <div class="d-flex flex-column align-items-center justify-content-center text-muted">
                    <i class="bi bi-check-circle-fill fs-2 text-success mb-2 opacity-75"></i>
                    <p class="mb-0 fw-bold">All caught up!</p>
                    <small class="small">No pending tasks found.</small>
                </div>
            </td>
        </tr>
    `;
    return;
}

        // Sort tasks: Newest first
        const sortedTasks = Object.entries(tasks).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

        tbody.innerHTML = sortedTasks.map(([taskId, t]) => {
            // Format Timestamp (e.g., "Oct 12, 10:30 AM")
            const dateStr = t.timestamp ? new Date(t.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Just now';
            
            // UI Logic: Check if it's assigned by a Manager or Self
            let metaHtml = '';
            if (t.assignedBy !== "Self") {
                // Task from Manager: Show Blue Badge with Manager's Name
                metaHtml = `<div class="text-primary mt-1" style="font-size: 0.7rem; font-weight: 600;">
                                <i class="bi bi-person-workspace me-1"></i>Assigned by ${t.assignerName} • ${dateStr}
                            </div>`;
            } else {
                // Personal Task: Show simple grey timestamp
                metaHtml = `<div class="text-muted mt-1" style="font-size: 0.7rem;">
                                <i class="bi bi-clock me-1"></i>Personal Task • ${dateStr}
                            </div>`;
            }

            return `
                <tr class="align-middle border-bottom">
                    <td class="ps-3 py-3">
                        <div class="fw-bold text-dark" style="font-size: 0.9rem;">${t.text}</div>
                        ${metaHtml}
                    </td>
                    <td class="text-end pe-3" style="width: 60px;">
                        <button class="btn btn-sm btn-outline-success py-1 px-2 shadow-sm" onclick="deleteTask('${taskId}')" title="Mark as Done">
                            <i class="bi bi-check2-all"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    });
};

// 4. Delete / Mark as Done Task
window.deleteTask = async function(taskId) {
    try {
        const db = firebase.database();
        // Remove the task from Firebase
        await db.ref(`Tasks/${taskId}`).remove();
        
        // Optional: Trigger your UI Notification if you have it loaded
        if (typeof App !== 'undefined' && App.UI) {
            App.UI.Notify('Task Completed', 'Marked Done!', 'success');
        }
    } catch (error) {
        console.error("Task Delete Error:", error);
    }
};

// 5. Auto-start the task fetcher when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Adding a slight delay ensures Firebase initializes first
    setTimeout(() => {
        if (typeof firebase !== 'undefined') {
            renderTasks();
        }
    }, 300);
});


/**
 * 9. Unified Print Engine
 */
App.PrintEngine = {
    async Render(templateName, data) {
        try {
            // 1. Fetch the template
            const response = await fetch(`modules/print/${templateName}.html`);
            if (!response.ok) throw new Error("Print template not found");
            let html = await response.text();

            // 2. Map the data
            Object.entries(data).forEach(([key, value]) => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                html = html.replace(regex, value || '');
            });

            // 3. Open in a NEW FULL TAB (no size restrictions)
            const printWindow = window.open('', '_blank');
            
            // 4. Write the document
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>Print Document - ${data.doc_no || 'Document'}</title>
                        <meta charset="utf-8">
                    </head>
                    <body>${html}</body>
                </html>
            `);
            printWindow.document.close();
            
            // Note: We NO LONGER call printWindow.print() or close().
            // The user will click the button inside the new tab.

        } catch (err) {
            console.error("Print Engine Error:", err);
            if(App.UI) App.UI.Notify("Print Error", "Could not load print template.", "danger");
        }
    }
};


// Example usage from your Transaction screen:
async function PrintReceipt(transactionKey) {
    // 1. Fetch the raw data
    const data = await API.Fetch(`Transactions/ReceiptVoucherForm/${transactionKey}`);
    
    // 2. Map data to your template placeholders
    const printData = {
        companyName: "NEXUS LEDGER SOLUTIONS",
        companyAddress: "Cyber City, Gurgaon, Haryana",
        date: data.header.date,
        doc_no: data.header.doc_no,
        customer_name: data.header.entity,
        grandTotal: Utils.FormatINR(data.header.grandTotal || 0),
        narration: data.header.narration
    };

    // 3. Render using your new PrintEngine
    App.PrintEngine.Render('receipt-vch', printData);
}


// 4. F5 Keyboard Listener (Add to app.js - BindGlobalEvents)
document.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
        e.preventDefault();
        window.opentaskmodal();
        // App.UI.Notify('Task Manager', 'F5 Pressed: Creating new task', 'info');
    }
});

// Initial load
document.addEventListener('DOMContentLoaded', renderTasks);
// Start Engine
document.addEventListener('DOMContentLoaded', () => App.Init());

// --- UNIVERSAL DYNAMIC PRINT FUNCTION (Must be in global scope) ---
window.printTransaction = async function(type, key) {
    try {
        const printMap = {
            "SalesInvoiceForm": "tax-invoice",
            "PurchaseInvoiceForm": "tax-invoice",
            "ReceiptVoucherForm": "receipt-vch",
            "PaymentVoucherForm": "payment-vch",
            "ReceiptPaymentForm": "receipt-pay"
        };
        const templateName = printMap[type] || "receipt-vch";
        const isInvoice = type.includes("Invoice");

        const data = await API.Fetch(`Transactions/${type}/${key}`);
        if (!data) throw new Error("Transaction data missing.");
        console.log(data)
        // 1. LOAD SYSTEM SETTINGS
        let sysSettings = {};
        try { sysSettings = JSON.parse(localStorage.getItem('ERP_Settings')) || {}; } catch(e){}

        // 2. FETCH MASTERS
        const ledgerData = await API.Fetch('Masters/LedgerCreation') || {};
        const stockData = await API.Fetch('Masters/Stock') || {}; 
        const companiesData = await API.Fetch('Masters/Companies') || {};

        // 3. FIND COMPANY CODE
        let companyCode = data.header.CompanyCode || data.header.companyCode || data.header.CompanyName;
        let projectName = data.header.project || data.header.Project;
        
        if (projectName) {
            try {
                const projectData = await API.Fetch('Masters/Projects') || {};
                const projectInfo = Object.values(projectData).find(p =>
                    (p.ProjectName && p.ProjectName.toString().toLowerCase() === projectName.toString().toLowerCase()) ||
                    (p.name && p.name.toString().toLowerCase() === projectName.toString().toLowerCase()) ||
                    (p.ProjectCode && p.ProjectCode.toString().toLowerCase() === projectName.toString().toLowerCase())
                );
                if (projectInfo) companyCode = projectInfo.CompanyName || projectInfo.CompanyCode || projectInfo.companyCode || companyCode;
            } catch (err) { console.warn("Could not fetch project data:", err); }
        }

        // 4. RESOLVE COMPANY INFO
        let companyInfo = null;
        if (companyCode) {
            companyInfo = Object.values(companiesData).find(c =>
                c.CompanyCode?.toString() === companyCode.toString() ||
                c.companyCode?.toString() === companyCode.toString() ||
                c.CompanyName?.toString().toLowerCase() === companyCode.toString().toLowerCase() ||
                c.companyName?.toString().toLowerCase() === companyCode.toString().toLowerCase()
            );
        }

        let compName = companyInfo?.companyName || companyInfo?.CompanyName || sysSettings.companyName || "YOUR COMPANY NAME".toUpperCase();
        let compAddress = sysSettings.companyAddress || "Company Address not set.";
        if (companyInfo) {
            const addrParts = [companyInfo.companyAddress1 || companyInfo.Address1 || companyInfo.address1, companyInfo.companyAddress2 || companyInfo.Address2 || companyInfo.address2, companyInfo.Company_State || companyInfo.State || companyInfo.state, companyInfo.pin || companyInfo.PinCode || companyInfo.pincode].filter(Boolean);
            if (addrParts.length) compAddress = addrParts.join(", ");
        }
        
        let compGST = companyInfo?.GSTIN || companyInfo?.GstNo || companyInfo?.gstin || sysSettings.companyGST || "";
        let compEmail = companyInfo?.email || companyInfo?.Email || sysSettings.companyEmail || "";
        let compPhone = companyInfo?.companyPhone || companyInfo?.mobile || companyInfo?.Mobile || companyInfo?.Phone || sysSettings.companyPhone || "";
        let compState = (companyInfo?.Company_State || companyInfo?.State || companyInfo?.state || "delhi").toLowerCase().trim();

        // 5. RESOLVE PARTY INFO
        let rawPartyName = data.header.customer_ledger || data.header.entity || data.header.PartyName || "";
        let partyName = rawPartyName, partyCode = "N/A", partyAddress = "N/A", partyGST = "N/A", partyState = "N/A", cleanPartyState = "";
        let partyemail = "", partyphone = "";

        if (rawPartyName && Object.keys(ledgerData).length > 0) {
            Object.values(ledgerData).forEach(l => {
                const ledgerName = (l.name || l.ledgerName || "").toLowerCase();
                const ledgerCode = (l.ledgerCode || l.code || "").toLowerCase();
                const searchTerm = rawPartyName.toLowerCase();
                
                if (ledgerName === searchTerm || ledgerCode === searchTerm) {
                    partyName = l.name || l.ledgerName.toUpperCase();
                    partyCode = l.ledgerCode || l.code || "N/A";
                    partyGST = l.GST || l.gstNo || "N/A".toUpperCase();
                    partyemail = (l.email || "").toLowerCase();
                    partyphone = l.Mobile || "";
                    partyAccountNumber = l.accountNumber || "";
                    partyIFSC = l.ifscCode || "";
                    partyAccountBranch = l.branchName || "";
                    partySWIFT = l.SwiftCode || "";
                    const addrParts = [l.address1, l.address2, l.state, l.pin].filter(Boolean);
                    if (addrParts.length) partyAddress = addrParts.join(", ");
                    if (l.state) {
                        partyState = l.state;
                        cleanPartyState = l.state.toLowerCase().trim();
                    }
                }
            });
        }

        const isInterState = (compState !== cleanPartyState && cleanPartyState !== "");

        // 6. GENERATE ITEMS & HSN SUMMARY
        let itemsHtml = "";
        let hsnSummary = {};
        let rawSubTotal = parseFloat(data.header.subTotal || data.header.SubTotal || 0);
        let rawTaxTotal = parseFloat(data.header.taxTotal || data.header.TaxTotal || 0);
        let actionTerm = type.includes("Payment") ? "Account Debited" : "Account Credited";

        if (data.items && data.items.length) {
            data.items.forEach((item, idx) => {
                let iCode = item.item_name || item.itemName || item.offset_account || "Unknown";
                let iName = iCode, iSku = iCode, iDesc = (item.description || item.Description || item.row_narration || "").trim(), iHSN = item.itemHSN || item.HSN || item.auto_item_name_ItemHSN || "N/A";

                let searchKey = String(iCode).toLowerCase().trim();
                if (Object.keys(stockData).length > 0) {
                    Object.values(stockData).forEach(s => {
                        let serverSku = String(s.Stock_Code || s.ItemCode || s.Sku || "").toLowerCase().trim();
                        let serverName = String(s.itemName || s.ItemName || s.name || "").toLowerCase().trim();
                        if (serverSku === searchKey || serverName === searchKey) {
                            iName = s.itemName || s.ItemName || s.name || iName;
                            iSku = s.Stock_Code || s.ItemCode || s.Sku || iSku;
                            if (s.itemHSN || s.HSN) iHSN = s.itemHSN || s.HSN;
                            if (!iDesc && (s.Description || s.description)) iDesc = (s.Description || s.description).trim();
                        }
                    });
                }

                let qty = parseFloat(item.qty || item.quantity || 1);
                let rate = parseFloat(item.rate || item.price || item.amount || 0);
                let taxPrc = parseFloat(item.taxRate || item.tax || item.auto_item_name_ItemTax || 0);
                let lineAmount = qty * rate;

                let hsnKey = `${iHSN}_${taxPrc}`;
                if (!hsnSummary[hsnKey]) hsnSummary[hsnKey] = { hsn: iHSN, rate: taxPrc, taxable: 0, taxAmt: 0 };
                hsnSummary[hsnKey].taxable += lineAmount;
                hsnSummary[hsnKey].taxAmt += lineAmount * (taxPrc / 100);

                if (!data.header.subTotal && !data.header.SubTotal) rawSubTotal += lineAmount;
                if (!data.header.taxTotal && !data.header.TaxTotal) rawTaxTotal += lineAmount * (taxPrc / 100);

                if (isInvoice) {
                    let itemDisplay = `<strong>${iName} ${iSku !== iName ? `(${iSku})` : ''}</strong>`;
                    if (iDesc !== "") itemDisplay += `<br><small style="color:#666; font-size:8.5pt;">${iDesc}</small>`;
                    itemsHtml += `<tr><td class="text-center">${idx + 1}</td><td>${itemDisplay}</td><td class="text-center">${iHSN}</td><td class="text-center">${qty.toFixed(2)}</td><td class="text-right">${Utils.FormatINR(rate)}</td><td class="text-center">${taxPrc}%</td><td class="text-right"><strong>${Utils.FormatINR(lineAmount)}</strong></td></tr>`;
                } else {
                    let itemDisplay = `<strong>${actionTerm}:</strong> ${iName} ${iSku !== iName ? `(${iSku})` : ''}`;
                    if (iDesc !== "") itemDisplay += `<br><small style="color:#666; font-size:8.5pt;">${iDesc}</small>`;
                    itemsHtml += `<tr><td class="text-center">${idx + 1}</td><td>${itemDisplay}</td><td style="float:right;" class="text-end"><strong>${Utils.FormatINR(lineAmount)}</strong></td></tr>`;
                }
            });
        }

        let hsnHtml = "";
        if (Object.keys(hsnSummary).length > 0) {
            Object.values(hsnSummary).forEach(row => {
                let igstR = "-", igstA = "-", cgstR = "-", cgstA = "-", sgstR = "-", sgstA = "-";
                if (isInterState) { igstR = row.rate + '%'; igstA = '₹ ' + Utils.FormatINR(row.taxAmt); } 
                else { cgstR = (row.rate / 2) + '%'; cgstA = '₹ ' + Utils.FormatINR(row.taxAmt / 2); sgstR = (row.rate / 2) + '%'; sgstA = '₹ ' + Utils.FormatINR(row.taxAmt / 2); }
                hsnHtml += `<tr><td style="text-align: left;">${row.hsn}</td><td style="text-align: right;">₹ ${Utils.FormatINR(row.taxable)}</td><td style="text-align: center;">${igstR}</td><td style="text-align: right;">${igstA}</td><td style="text-align: center;">${cgstR}</td><td style="text-align: right;">${cgstA}</td><td style="text-align: center;">${sgstR}</td><td style="text-align: right;">${sgstA}</td><td style="text-align: right; font-weight:bold;">₹ ${Utils.FormatINR(row.taxAmt)}</td></tr>`;
            });
        } else { hsnHtml = `<tr><td colspan="9" class="text-center">No Tax Details Found</td></tr>`; }

        // 7. DISPLAY TOGGLES
        const dBank = sysSettings.enableBankingInfo ? "flex" : "none";
        const dTerms = (sysSettings.enableTerms && sysSettings.invoiceTerms) ? "block" : "none";
        const dSign = sysSettings.showSignatory !== false ? "flex" : "none";
        const dWords = sysSettings.showAmountInWords !== false ? "block" : "none";

        let upiDisplay = "none", upiLink = "", qrUrl = "";
        let rawTotal = parseFloat(data.header.grandTotal || data.header.GrandTotal || (rawSubTotal + rawTaxTotal));

        if (sysSettings.enableBankingInfo && sysSettings.upiid && sysSettings.upiid.trim() !== "") {
            upiDisplay = "block";
            upiLink = `upi://pay?pa=${sysSettings.upiid.trim()}&pn=${encodeURIComponent(compName)}&am=${rawTotal}&cu=INR`;
            qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiLink)}`;
        }

        const safeDeliveryAddr = [data.meta?.delivery_address, data.meta?.delivery_state, data.meta?.delivery_pin].filter(Boolean).join(", ");
        
        const printData = {
            display_bank: dBank, display_terms: dTerms, display_sign: dSign, display_words: dWords, display_upi: upiDisplay,
            companyName: compName.toUpperCase(), companyAddress: compAddress, gstin: compGST.toUpperCase(), companyEmail: compEmail.toLowerCase(), companyPhone: compPhone,
            bank_name: sysSettings.enableBankingInfo ? (sysSettings.bankName || "Not Set") : "", bank_ac_name: sysSettings.enableBankingInfo ? (sysSettings.bankAccountName || "Not Set") : "", bank_ac: sysSettings.enableBankingInfo ? (sysSettings.bankAccountNumber || "Not Set") : "", bank_ifsc: sysSettings.enableBankingInfo ? (sysSettings.bankIFSC || "Not Set") : "", invoice_terms: sysSettings.enableTerms ? (sysSettings.invoiceTerms || "") : "", upi_id: (sysSettings.enableBankingInfo && sysSettings.upiid) ? sysSettings.upiid.trim() : "", qr_url: qrUrl,
            date: Utils.FormatDate(data.header.date || data.header.voucher_date || data.header.valueDate || data.header.Date),
            doc_no: data.header.doc_no || data.header.Invoice || data.header.DocNo || "N/A",
            customer_name: partyName.toUpperCase(), customer_code: partyCode.toUpperCase(), customer_address: partyAddress.trim(), customer_gst: partyGST.toUpperCase(), customer_state: partyState, customer_email: partyemail, customer_phone: partyphone, ledger_IFSC:partyIFSC.toUpperCase(),ledger_code:partyCode, ledger_AccountNumber:partyAccountNumber,ledger_Branch:partyAccountBranch,ledger_swift:partySWIFT.toUpperCase(), ledger_name:partyName.toUpperCase(),
            consignee_name: (data.meta?.consignee_name || "").toUpperCase(), Ledger_gst:partyGST, delivery_address: safeDeliveryAddr, vehicle_no: (data.meta?.vehicle_no || "").toUpperCase(), LR_No: (data.meta?.lr_no || "").toUpperCase(), delivery_phone: data.meta?.delivery_phone || "", delivery_email: data.meta?.delivery_email || "", Valuedate: Utils.FormatDate(data.header.date) , Instdate:Utils.FormatDate(data.header.instrumentDate) ,
            subTotal: Utils.FormatINR(rawSubTotal), taxTotal: Utils.FormatINR(rawTaxTotal), grandTotal: Utils.FormatINR(rawTotal),
            amountInWords: (typeof window.NumberToWords === 'function') ? window.NumberToWords(Math.round(rawTotal)) : "Amount in words...",
            narration: data.header.narration || data.header.Narration || "",
            items_html: itemsHtml || '<tr><td colspan="7" class="text-center">No Items Found</td></tr>', hsn_html: hsnHtml,
            // --- CORRECTED BANK FIELDS ---
            bank_code: data.items && data.items.length > 0 ? (data.items[0].offset_account || data.items[0].item_name || "N/A").toUpperCase() : "N/A",
            bank_gst: compGST.toUpperCase(),
            bank_state: compState.toUpperCase(),
        };

        if (App.PrintEngine && typeof App.PrintEngine.Render === 'function') {
            App.PrintEngine.Render(templateName, printData);
        } else {
            alert("PrintEngine is missing. Make sure your printing script is loaded.");
        }

    } catch (err) {
        console.error("Print Error:", err);
        alert("Error printing document: " + err.message);
    }
};


// search
/**
 * ==============================================================================
 * CLIENT NOTIFICATION ENGINE
 * Fetches, filters, and renders real-time notifications for the current user.
 * ==============================================================================
 */
const UIUtils = {
    GetIcon(type) {
        const map = {
            info: { bg: 'bg-info bg-opacity-10 text-info', icon: 'bi-info-circle', emoji: 'ℹ️' },
            task: { bg: 'bg-primary bg-opacity-10 text-primary', icon: 'bi-briefcase', emoji: '📋' },
            success: { bg: 'bg-success bg-opacity-10 text-success', icon: 'bi-check-circle', emoji: '✅' },
            warning: { bg: 'bg-warning bg-opacity-10 text-warning', icon: 'bi-exclamation-triangle', emoji: '⚠️' },
            error: { bg: 'bg-danger bg-opacity-10 text-danger', icon: 'bi-x-circle', emoji: '❌' },
            payment: { bg: 'bg-success bg-opacity-10 text-success', icon: 'bi-wallet2', emoji: '💰' }
        };
        return map[type?.toLowerCase()] || { bg: 'bg-secondary bg-opacity-10 text-secondary', icon: 'bi-bell', emoji: '🔔' };
    }
};

const NotificationEngine = {
    userId: localStorage.getItem('userloginid'),

    Init() {
        if (!this.userId) return;
        this.ListenToDatabase();
    },

    ListenToDatabase() {
        firebase.database().ref('Notifications').orderByChild('timestamp').limitToLast(50).on('value', (snapshot) => {
            this.ProcessAndRender(snapshot.val());
        });
    },

    ProcessAndRender(data) {
        const list = document.getElementById('notificationList');
        const dot = document.getElementById('notificationDot');
        const countBadge = document.getElementById('notificationCount');
        if (!list) return;
        list.innerHTML = '';

        if (!data) { list.innerHTML = `<li class="p-3 text-muted small text-center">No notifications</li>`; return; }

        let unreadCount = 0;
        Object.entries(data)
            .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
            .forEach(([id, notif]) => {
                if (notif.target !== 'all' && notif.target !== this.userId) return;

                const hasSeen = notif.ReadStatus?.[this.userId] === true;
                if (!hasSeen) unreadCount++;

                const icon = UIUtils.GetIcon(notif.type);

                list.innerHTML += `
                    <li>
                        <div class="dropdown-item py-2 border-bottom ${!hasSeen ? 'bg-primary bg-opacity-10' : ''}" 
                             style="cursor: pointer;" 
                             onclick="NotificationEngine.MarkAsSeen('${id}', '${notif.link || ''}')">
                            <div class="d-flex align-items-center">
                                <i class="bi ${icon.icon} ${icon.bg.split(' ')[2]} me-2"></i>
                                <span class="fw-bold small text-truncate">${notif.title}</span>
                            </div>
                            <div class="text-muted small ms-4 ps-1">${notif.message}</div>
                        </div>
                    </li>
                `;
            });

        if (countBadge) countBadge.innerText = unreadCount;
        if (dot) dot.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    },

    async MarkAsSeen(id, link) {
        await firebase.database().ref(`Notifications/${id}/ReadStatus/${this.userId}`).set(true);
        if (link && typeof App !== 'undefined') App.Router(link);
    }
};

const BrowserNotificationEngine = {
    userId: localStorage.getItem('userloginid'),
    shownTimeouts: new Set(),

    Init() {
        if (!("Notification" in window)) return;
        if (Notification.permission === "default") Notification.requestPermission();
        
        // 🎯 POINT TO Broadcast-Services, not Notifications
        firebase.database().ref('Broadcast-Services').on('child_added', (snapshot) => {
            const notif = snapshot.val();
            const id = snapshot.key;

            // 🎯 Check if targeted to ALL or if this userId is in the target array
            const isForMe = notif.target === 'all' || (Array.isArray(notif.target) && notif.target.includes(this.userId));
            if (!isForMe) return;
            
            // Check status: ReadStatus is stored under this specific broadcast ID
            const hasSeen = notif.ReadStatus?.[this.userId] === true;
            
            if (!hasSeen && !this.shownTimeouts.has(id)) {
                this.shownTimeouts.add(id);
                // Trigger 30s timer
                setTimeout(() => this.Show(id, notif), 30000);
            }
        });
    },

    async Show(id, notif) {
    // 1. Double-check status in DB before showing
    const snap = await firebase.database().ref(`Broadcast-Services/${id}/ReadStatus/${this.userId}`).once('value');
    if (snap.val() === true) return;

    if (Notification.permission === "granted") {
        const icon = UIUtils.GetIcon(notif.type);
        const n = new Notification(`${icon.emoji} ${notif.title}`, { 
            body: notif.message, 
            icon: '/favicon.ico' 
        });

        // 🎯 INSTANT MARK AS SEEN:
        // As soon as the notification appears on the screen, 
        // we mark it as 'true' so no other browser tab shows it.
        firebase.database().ref(`Broadcast-Services/${id}/ReadStatus/${this.userId}`).set(true);

        n.onclick = () => {
            window.focus();
            // Redirect logic
            if (notif.link && typeof App !== 'undefined') {
                App.Router(notif.link);
            }
            n.close();
        };
    }
}
};



const UserProfileController = {
    userId: localStorage.getItem('userloginid'),
    userData: null,

    Init() {
        if (!this.userId) {
            console.error("[Profile] User ID not found.");
            this.Notify("Error", "You must be logged in to view this page.", "danger");
            return;
        }
        this.LoadUserData();
    },

    Notify(title, message, type) {
        // Safe fallback notification system
        if (window.App && window.App.UI && window.App.UI.Notify) {
            window.App.UI.Notify(title, message, type);
        } else if (window.UIUtils && window.UIUtils.Notify) {
            window.UIUtils.Notify(title, message, type);
        } else {
            alert(`${title}: ${message}`);
        }
    },

    // 1. Fetch data from Firebase
    async LoadUserData() {
        try {
            const db = firebase.database();
            const snap = await db.ref(`Users/${this.userId}`).once('value');
            
            if (!snap.exists()) {
                this.Notify("Error", "User profile not found in database.", "danger");
                window.location.replace("./login.html");
                return;
            }

            this.userData = snap.val();
            this.RenderProfile();

        } catch (err) {
            console.error("Failed to load profile:", err);
            this.Notify("Error", "Could not connect to the database.", "danger");
        }
    },

    // 2. Populate all UI and Form Fields
    RenderProfile() {
        const name = this.userData.name || this.userData.legalName || 'Unknown User';
        const email = this.userData.email || 'No Email Provided';
        const role = this.userData.role || 'User';
        const status = this.userData.status || 'Active';
        
        // Generate Initials (e.g., "Krishna Mishra" -> "KM")
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

        // Format Account Creation Date
        let joinedDate = 'Unknown';
        if (this.userData.created_at) {
            const dateObj = new Date(this.userData.created_at);
            joinedDate = dateObj.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        }

        // Fill Summary Card Elements (Safely checking if they exist)
        const elInitials = document.getElementById('profileInitials');
        const elName = document.getElementById('profileDisplayName');
        const elEmail = document.getElementById('profileDisplayEmail');
        const elRole = document.getElementById('profileRoleBadge');
        const elJoined = document.getElementById('profileAccountCreated');
        const elStatus = document.getElementById('profileStatusText');

        if(elInitials) elInitials.innerText = initials;
        if(elName) elName.innerText = name;
        if(elEmail) elEmail.innerText = email;
        if(elRole) elRole.innerText = role;
        if(elJoined) elJoined.innerText = joinedDate;
        
        if(elStatus) {
            elStatus.innerText = status.charAt(0).toUpperCase() + status.slice(1);
            elStatus.className = status === 'active' ? 'fw-bold text-success mb-0' : 'fw-bold text-danger mb-0';
        }

        // Fill Form Inputs
        const inputName = document.getElementById('inputProfileName');
        const inputEmail = document.getElementById('inputProfileEmail');
        
        if(inputName) inputName.value = name;
        if(inputEmail) inputEmail.value = email;
    },

    // 3. Save Personal Info (Name)
    async UpdateProfile() {
        const nameInput = document.getElementById('inputProfileName');
        if (!nameInput) return;

        const newName = nameInput.value.trim();
        const btn = document.getElementById('btnSaveProfile');

        if (!newName) {
            this.Notify("Validation", "Name cannot be empty.", "warning");
            return;
        }

        if (newName === this.userData.name || newName === this.userData.legalName) {
            this.Notify("Info", "No changes were made.", "info");
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
        }

        try {
            await firebase.database().ref(`Users/${this.userId}`).update({
                name: newName,
                updated_at: firebase.database.ServerValue.TIMESTAMP
            });

            // Update local memory and re-render UI live
            this.userData.name = newName;
            this.RenderProfile();
            
            // Sync with local storage for app-wide consistency
            localStorage.setItem('userName', newName);

            this.Notify("Success", "Profile updated successfully.", "success");
        } catch (err) {
            console.error("Update Error:", err);
            this.Notify("Error", "Failed to update profile.", "danger");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-save me-1"></i> Save Changes';
            }
        }
    },

    // 4. Validate and Update Password
    async UpdatePassword() {
        const currentPassInput = document.getElementById('inputCurrentPassword');
        const newPassInput = document.getElementById('inputNewPassword');
        const confirmPassInput = document.getElementById('inputConfirmPassword');
        const btn = document.getElementById('btnSavePassword');

        if (!currentPassInput || !newPassInput || !confirmPassInput) return;

        const currentPass = currentPassInput.value;
        const newPass = newPassInput.value;
        const confirmPass = confirmPassInput.value;

        // Security Validations
        if (!currentPass || !newPass || !confirmPass) {
            this.Notify("Validation", "Please fill out all password fields.", "warning");
            return;
        }
        if (newPass !== confirmPass) {
            this.Notify("Validation", "New passwords do not match.", "warning");
            return;
        }
        if (newPass.length < 6) {
            this.Notify("Validation", "Password must be at least 6 characters long.", "warning");
            return;
        }
        // Validate against the exact password stored in Firebase
        if (currentPass !== this.userData.password) {
            this.Notify("Security", "Current password is incorrect.", "danger");
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';
        }

        try {
            await firebase.database().ref(`Users/${this.userId}`).update({
                password: newPass,
                updated_at: firebase.database.ServerValue.TIMESTAMP
            });

            // Keep local memory synced so user can change it again if needed without refreshing
            this.userData.password = newPass;

            // Clear the password form fields securely
            const form = document.getElementById('passwordUpdateForm');
            if (form) form.reset();

            this.Notify("Success", "Password updated successfully.", "success");

        } catch (err) {
            console.error("Password Update Error:", err);
            this.Notify("Error", "Failed to update password.", "danger");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-shield-check me-1"></i> Update Password';
            }
        }
    }
};


/**
 * ========================================================================
 * UNIVERSAL MASTER DATA ENGINE & OBSERVER
 * ========================================================================
 */

// Global Form Hydrator
const FormObserver = new MutationObserver(() => {
    const masterForms = document.querySelectorAll('form[data-category="Masters"]:not([data-bound="true"])');
    
    masterForms.forEach(form => {
        form.dataset.bound = "true"; 
        
        const formId = form.id; 
        const sheetName = form.dataset.sheet_name || formId; 
        
        const context = MasterEngine.State.Load(formId);
        
        if (context) {
            // A. Inject Hidden ID
            let hiddenId = document.createElement('input');
            hiddenId.type = 'hidden';
            hiddenId.name = 'hiddenRecordId'; 
            hiddenId.value = context.id;
            form.appendChild(hiddenId);

            // B. Deep fill every input type correctly
            Object.entries(context.payload).forEach(([key, value]) => {
                const inputs = form.querySelectorAll(`[name="${key}"]`);
                inputs.forEach(input => {
                    if (input.type === 'radio') {
                        input.checked = (input.value === String(value));
                    } 
                    else if (input.type === 'checkbox') {
                        input.checked = (value === true || value === 'true' || value === '1' || value === input.value);
                    } 
                    else {
                        input.value = value;
                    }
                });
            });

            // C. Update UI Button
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i> Update Record';
                submitBtn.classList.replace('btn-success', 'btn-primary');
            }

            const title = form.closest('.card-body')?.querySelector('h5');
            if (title) title.innerHTML = `Edit ${title.innerText}`;

            MasterEngine.State.Clear(formId);
        }

        // Universal Submit Listener
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalHtml = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
            submitBtn.disabled = true;

            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());
            
            form.querySelectorAll('input[type="checkbox"]:not(:checked)').forEach(cb => {
                if (cb.name) payload[cb.name] = false; 
            });

            const recordId = payload.hiddenRecordId;
            delete payload.hiddenRecordId; 

            try {
                if (recordId) {
                    await API.Update(`Masters/${sheetName}/${recordId}`, payload);
                    alert(`${formId} Updated Successfully!`);
                } else {
                    payload.createdAt = new Date().toISOString();
                    await API.Create(`Masters/${sheetName}`, payload);
                    alert(`${formId} Created Successfully!`);
                }
                
                const listRoute = `masters/${formId.toLowerCase()}-list`;
                if (typeof App !== 'undefined' && App.Router) App.Router(listRoute); 
                
            } catch (error) {
                alert('Error saving data: ' + error.message);
                submitBtn.innerHTML = originalHtml;
                submitBtn.disabled = false;
            }
        });
    });
});

FormObserver.observe(document.body, { childList: true, subtree: true });


// Delay initialization slightly to ensure Firebase is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof firebase !== 'undefined') {
            // UserProfileController.LoadUserData();
            NotificationEngine.Init();
            // NotificationPageController.Init();

        } else {
            console.error("Firebase is not loaded! Notifications cannot start.");
        }
    }, 500);
});