/**
 * UNITAX PRO - Core Application Brain (Final Stable)
 * Handles: Routing, Logic Injection, Auto-Fill, Uniqueness, and UI Themes
 */
// console.log('App.js initialized')
const App = {
   State: {
        userId: localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid'),
        currentuserId: localStorage.getItem('userloginid'),
        userName: localStorage.getItem('userName'),
        userRole: localStorage.getItem('userrole'),
        workspaceId: localStorage.getItem('workspaceId'),
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
        BrowserNotificationEngine.Init()
        // AccessTracker.Init()

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
        const designation = document.getElementById('main_role_show');
        const userIdEl = document.getElementById('main_userid_show');
        const realuser = document.getElementById('realUser');

        if(nameEl) nameEl.innerText = this.State.userName || "User";
        if(designation) designation.innerText = localStorage.getItem('designation')
        if(realuser) realuser.innerText =`ID: ${this.State.currentuserId} `;
        // if(userIdEl) userIdEl.innerText = `ID: ${this.State.workspaceId} `;
        App.displayWrokspaceName()
        // 4. Handle Routing
        const pinnedModule = localStorage.getItem('pinnedModule');
        if (pinnedModule) {
            // console.log(`📡 [App] Loading pinned module: ${pinnedModule}`);
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
        // 1. 🔥 NEW: Save the currently active route to localStorage before navigating away
        // It checks State first, falls back to the URL hash, or defaults to a safe string.
        const currentRoute = (this.State && this.State.activeModule) 
            || window.location.hash.replace('#', '') 
            || 'dashboard';
            
        localStorage.setItem('PreviousPath', currentRoute);

        const viewport = document.getElementById('main-content');
        const loader = document.getElementById('section-loader');
        
        if(loader) loader.style.display = 'block';
        viewport.style.opacity = '0.5';

        // 2. Separate the base module name from the URL parameters
        const [basePath, queryString] = path.split('?');

        try {
            // Fetch using only the base path so the network request doesn't fail
            const res = await fetch(`modules/${basePath}.html`);
            if(!res.ok) throw new Error("Module not found");
            const html = await res.text();
            
            // 3. Inject HTML content
            viewport.innerHTML = html;
            this.State.activeModule = basePath;

            // 4. 🔥 THE SCRIPT FIX: Manually find and execute scripts in the injected HTML
            const scripts = viewport.querySelectorAll("script");
            scripts.forEach(oldScript => {
                const newScript = document.createElement("script");
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            // 5. Initialize ERP Logic (Lookups, Uniqueness, etc.)
            this.InitERPLogic(basePath);

            // 6. 🔥 DEEP LINK HANDLER: If an ID was passed, open the document
            if (queryString) {
                const urlParams = new URLSearchParams(queryString);
                const docId = urlParams.get('id');
                
                if (docId) {
                    // Use a short timeout to ensure the module's scripts and Firebase have finished booting
                    setTimeout(() => {
                        if (typeof window.loadApprovalDoc === 'function') {
                            // Ensure the view switches to the document viewer
                            const tabToggle = document.querySelector('[data-bs-target="#inbox-view"]');
                            if (tabToggle) tabToggle.click();
                            
                            window.loadApprovalDoc(docId);
                        }
                    }, 500); 
                }
            }

        } catch (e) {
            console.error("Router Failure:", e);
            viewport.innerHTML = `<div class="alert alert-danger m-3">Critical Error: Module [${basePath}] failed to load.</div>`;
        } finally {
            if(loader) loader.style.display = 'none';
            viewport.style.opacity = '1';
        }
    },

    async goBack() {
        const previousPath = localStorage.getItem('PreviousPath') || 'dashboard';
        if (typeof App !== 'undefined' && App.Router) {
            App.Router(previousPath);
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
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>`;

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

    displayWrokspaceName: function(elId = 'main_userid_show') {
        const el = document.getElementById(elId);
        if (!el) return;
        const userId = App.State.userId ;
        if (!userId) { el.innerText = 'Guest'; return; }
        
        firebase.database().ref(`Users/${userId}/workspace/WorkspaceSettings/workspaceName`).once('value')
            .then(s => {
                const name = s.val();
                el.innerText = name || `ID: ${userId}`;
            })
            .catch(() => el.innerText = `ID: ${userId}`);
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
                    this.UI.Notify('System', `Module unpinned.`, 'warning');
                } else {
                    // Set Pin
                    localStorage.setItem('pinnedModule', current);
                    this.UI.Notify('System', `Module Pinned.`, 'success');
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
        await db.ref('Utilities/Tasks').push(taskData);
        
        input.value = '';
        bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
        // Note: We don't need to manually call renderTasks() here because 
        // the real-time listener below will detect the new task and auto-update.
    } catch (error) {
        console.error("Task Save Error:", error);
        alert("Failed to save task.");
    }
};

window.renderTasks = function() {
    const taskSection = document.getElementById('taskSection');
    const currentUserId = localStorage.getItem('userloginid');

    if (!currentUserId || !taskSection) return;

    // Clear existing content
    taskSection.innerHTML = '';

    // Create table container
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';
    tableContainer.style.cssText = `
        max-height: 100%;
        overflow-y: auto;
        position: relative;
        height: 100%;
    `;

    // Create table
    const table = document.createElement('table');
    table.className = 'table table-hover';
    table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 0;
    `;

    // Create thead with sticky positioning
    const thead = document.createElement('thead');
    thead.style.cssText = `
        position: sticky;
        top: 0;
        z-index: 10;
        background: white;
    `;
    thead.innerHTML = `
        <tr style="border-bottom: 2px solid rgba(0,0,0,0.08); background: white;">
            <th style="width: 30px; padding: 8px 12px; font-size: 0.75rem; font-weight: 600; color: #6c757d; text-align: left;">#</th>
            <th style="padding: 8px 12px; font-size: 0.75rem; font-weight: 600; color: #6c757d; text-align: left;">Task</th>
            <th style="width: 50px; padding: 8px 12px; font-size: 0.75rem; font-weight: 600; color: #6c757d; text-align: right;">Action</th>
        </tr>
    `;

    // Create tbody
    const tbody = document.createElement('tbody');
    tbody.id = 'taskTableBody';

    // Append thead and tbody to table
    table.appendChild(thead);
    table.appendChild(tbody);

    // Append table to container
    tableContainer.appendChild(table);

    // Append container to taskSection
    taskSection.appendChild(tableContainer);

    // Show loading skeleton
    tbody.innerHTML = `
        <tr>
            <td colspan="3" class="text-center text-muted py-3">
                <span class="spinner-border spinner-border-sm"></span> Syncing tasks...
            </td>
        </tr>
    `;

    // Firebase listener
    const db = firebase.database();
    
    db.ref('Utilities/Tasks').orderByChild('assignedTo').equalTo(currentUserId).on('value', (snapshot) => {
        const tasks = snapshot.val() || {};
        const taskEntries = Object.entries(tasks);

        if (taskEntries.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center py-4">
                        <div class="d-flex flex-column align-items-center text-muted">
                            <i class="bi bi-check-circle-fill fs-3 text-success opacity-75"></i>
                            <p class="mb-0 fw-bold mt-2">All caught up!</p>
                            <small class="small">No pending tasks found.</small>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const sorted = taskEntries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

        tbody.innerHTML = sorted.map(([taskId, t], index) => {
            const srNo = index + 1;

            const dateStr = t.timestamp
                ? new Date(t.timestamp).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : 'Just now';

            let metaHtml = '';
            if (t.assignedBy !== "Self") {
                metaHtml = `
                    <div class="text-primary mt-1" style="font-size: 0.65rem; font-weight: 500;">
                        <i class="bi bi-person-workspace me-1"></i>
                        Assigned by ${t.assignerName || 'Manager'} • ${dateStr}
                    </div>
                `;
            } else {
                metaHtml = `
                    <div class="text-muted mt-1" style="font-size: 0.65rem;">
                        <i class="bi bi-clock me-1"></i>
                        Personal • ${dateStr}
                    </div>
                `;
            }

            let priorityBadge = '';
            if (t.priority) {
                const priorityMap = {
                    high: 'danger',
                    medium: 'warning',
                    low: 'success'
                };
                const color = priorityMap[t.priority.toLowerCase()] || 'secondary';
                priorityBadge = `
                    <span class="badge bg-${color} bg-opacity-10 text-${color} rounded-pill ms-2" style="font-size: 0.6rem; border: 1px solid rgba(0,0,0,0.05);">
                        ${t.priority}
                    </span>
                `;
            }

            return `
                <tr class="task-row align-middle" style="border-bottom: 1px solid rgba(0,0,0,0.06);">
                    <td class="ps-3 py-2 text-muted small fw-bold" style="width: 30px; font-size: 0.75rem;">
                        ${srNo}
                    </td>
                    <td class="py-2 px-2">
                        <div class="d-flex align-items-center">
                            <span class="fw-bold text-dark" style="font-size: 0.9rem;">
                                ${t.text}
                            </span>
                            ${priorityBadge}
                        </div>
                        ${metaHtml}
                    </td>
                    <td class="pe-3 py-2 text-end" style="width: 50px;">
                        <button class="btn btn-sm btn-primary py-1 px-2" 
                                style="border: 1px solid rgba(0,0,0,0.1); background: transparent;"
                                onclick="deleteTask('${taskId}')" 
                                title="Mark as Done">
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
        await db.ref(`Utilities/Tasks/${taskId}`).remove();
        
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
            "PurchaseReturnForm": "tax-invoice",
            "SalesReturnForm": "tax-invoice",
            "ReceiptVoucherForm": "receipt-vch",
            "PaymentVoucherForm": "receipt-vch",
            "ReceiptPaymentForm": "receipt-pay"
        };
        
        const templateName = printMap[type] || "receipt-vch";
        const isInvoice = type.includes("Invoice");
        const isReturn = type.includes("Return");
        const isReceipt = type.includes("Receipt");
        const isPayment = type.includes("Payment");

        const data = await API.Fetch(`Transactions/${type}/${key}`);
        if (!data) throw new Error("Transaction data missing.");
        console.log(data);
        
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
        let partyAccountNumber = "", partyIFSC = "", partyAccountBranch = "", partySWIFT = "";

        if (rawPartyName && Object.keys(ledgerData).length > 0) {
            Object.values(ledgerData).forEach(l => {
                const ledgerName = (l.name || l.ledgerName || "").toLowerCase();
                const ledgerCode = (l.ledgerCode || l.code || "").toLowerCase();
                const searchTerm = rawPartyName.toLowerCase();
                
                if (ledgerName === searchTerm || ledgerCode === searchTerm) {
                    partyName = l.name || l.ledgerName || rawPartyName;
                    partyCode = l.ledgerCode || l.code || "N/A";
                    partyGST = l.GST || l.gstNo || "N/A";
                    partyemail = l.email ? "Email: " + l.email.toLowerCase() : "";
                    partyphone = l.Mobile ? "Phone: " + l.Mobile : "";
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
        const dSign = "flex" ;
        const dWords = sysSettings.showAmountInWords !== false ? "block" : "none";

        let upiDisplay = "none", upiLink = "", qrUrl = "";
        let rawTotal = parseFloat(data.header.grandTotal || data.header.GrandTotal || (rawSubTotal + rawTaxTotal));

        if (sysSettings.enableBankingInfo && sysSettings.upiid && sysSettings.upiid.trim() !== "") {
            upiDisplay = "block";
            upiLink = `upi://pay?pa=${sysSettings.upiid.trim()}&pn=${encodeURIComponent(compName)}&am=${rawTotal}&cu=INR`;
            qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiLink)}`;
        }

        const safeDeliveryAddr = [data.meta?.delivery_address, data.meta?.delivery_state, data.meta?.delivery_pin].filter(Boolean).join(", ");
        
        // ==========================================
        // TITLE DETERMINATION - FIXED
        // ==========================================
        let title;
        const meta = data.meta || {};
        const docType = meta.DocumentType || data.header.DocumentType || "";

        // Check by form type first (most reliable)
        if (type === "SalesInvoiceForm" || type === "PurchaseInvoiceForm") {
            title = "TAX INVOICE";
        } else if (type === "SalesReturnForm") {
            title = "CREDIT NOTE";
        } else if (type === "PurchaseReturnForm") {
            title = "DEBIT NOTE";
        } else if (type === "ReceiptVoucherForm" || type === "ReceiptPaymentForm") {
            title = "RECEIPT VOUCHER";
        } else if (type === "PaymentVoucherForm") {
            title = "PAYMENT VOUCHER";
        } else if (docType === "SALE" || docType === "PURCHASE" || docType === "SALES" || docType === "PURCHASES" || docType === "INVOICE") {
            title = "TAX INVOICE";
        } else if (docType === "SALES_RETURN" || docType === "SALESRETURN" || docType === "CREDIT_NOTE" || docType === "CREDITNOTE" || docType === "CREDIT") {
            title = "CREDIT NOTE";
        } else if (docType === "PURCHASE_RETURN" || docType === "PURCHASERETURN" || docType === "DEBIT_NOTE" || docType === "DEBITNOTE" || docType === "DEBIT") {
            title = "DEBIT NOTE";
        } else if (docType === "RECEIPT") {
            title = "RECEIPT VOUCHER";
        } else if (docType === "PAYMENT") {
            title = "PAYMENT VOUCHER";
        } else if (isInvoice) {
            title = "TAX INVOICE";
        } else if (isReturn) {
            // Check if it's a sales return (Credit Note) or purchase return (Debit Note)
            if (type.includes("Sales")) {
                title = "CREDIT NOTE";
            } else if (type.includes("Purchase")) {
                title = "DEBIT NOTE";
            } else {
                title = "DEBIT/CEDIT NOTE";
            }
        } else if (isReceipt) {
            title = "RECEIPT VOUCHER";
        } else if (isPayment) {
            title = "PAYMENT VOUCHER";
        } else {
            title = "DOCUMENT";
        }

        const printData = {
            display_bank: dBank, 
            display_terms: dTerms, 
            display_sign: dSign, 
            display_words: dWords, 
            display_upi: upiDisplay,
            companyName: compName.toUpperCase(), 
            companyAddress: compAddress, 
            gstin: compGST.toUpperCase(), 
            companyEmail: compEmail.toLowerCase(), 
            companyPhone: compPhone,
            bank_name: sysSettings.enableBankingInfo ? (sysSettings.bankName || "") : "", 
            bank_ac_name: sysSettings.enableBankingInfo ? (sysSettings.bankAccountName || "") : "", 
            bank_ac: sysSettings.enableBankingInfo ? (sysSettings.bankAccountNumber || "") : "", 
            bank_ifsc: sysSettings.enableBankingInfo ? (sysSettings.bankIFSC || "") : "", 
            invoiceTerms: sysSettings.enableTerms ? (sysSettings.invoiceTerms || "") : "", 
            upi_id: (sysSettings.enableBankingInfo && sysSettings.upiid) ? sysSettings.upiid.trim() : "", 
            qr_url: qrUrl, 
            Document_title: title,
            date: Utils.FormatDate(data.header.date || data.header.voucher_date || data.header.valueDate || data.header.Date),
            doc_no: data.header.doc_no || data.header.Invoice || data.header.DocNo || "N/A",
            customer_name: partyName.toUpperCase(), 
            customer_code: partyCode.toUpperCase(), 
            customer_address: partyAddress.trim(), 
            customer_gst: partyGST.toUpperCase(), 
            customer_state: partyState, 
            customer_email: partyemail, 
            customer_phone: partyphone, 
            ledger_IFSC: partyIFSC.toUpperCase(),
            ledger_code: partyCode, 
            ledger_AccountNumber: partyAccountNumber,
            ledger_Branch: partyAccountBranch,
            ledger_swift: partySWIFT.toUpperCase(), 
            ledger_name: partyName.toUpperCase(),
            consignee_name: (data.meta?.consignee_name || "").toUpperCase() , 
            Ledger_gst: partyGST, 
            delivery_address: safeDeliveryAddr,
            vehicle_no: data.meta?.vehicle_no ? "Vehicle No: " + data.meta.vehicle_no.toUpperCase() : "",
            LR_No: data.meta?.lr_no ? "LR No: " + data.meta.lr_no.toUpperCase() : "",
            delivery_phone: data.meta?.delivery_phone ? "Phone: " + data.meta.delivery_phone : "",
            delivery_email: data.meta?.delivery_email ? "Email: " + data.meta.delivery_email : "",
            Valuedate: Utils.FormatDate(data.header.date), 
            Instdate: Utils.FormatDate(data.header.instrumentDate),
            subTotal: Utils.FormatINR(rawSubTotal), 
            taxTotal: Utils.FormatINR(rawTaxTotal), 
            grandTotal: Utils.FormatINR(rawTotal),
            amountInWords: (typeof window.NumberToWords === 'function') ? window.NumberToWords(Math.round(rawTotal)) : "Amount in words...",
            narration: data.header.narration || data.header.Narration || "",
            items_html: itemsHtml || '<tr><td colspan="7" class="text-center">No Items Found</td></tr>', 
            hsn_html: hsnHtml,
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
        firebase.database().ref('Utilities/Notifications').orderByChild('timestamp').limitToLast(50).on('value', (snapshot) => {
            this.ProcessAndRender(snapshot.val());
        });
    },

    ProcessAndRender(data) {
    const list = document.getElementById('notificationList');
    const dot = document.getElementById('notificationDot');
    const countBadge = document.getElementById('notificationCount');
    if (!list) return;
    list.innerHTML = '';

    if (!data) { 
        list.innerHTML = `<li class="p-3 text-muted small text-center">No notifications</li>`; 
        return; 
    }

    let unreadCount = 0;
    Object.entries(data)
        .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
        .forEach(([id, notif]) => {
            if (notif.target !== 'all' && notif.target !== App.State.currentuserId) return;

            const hasSeen = notif.ReadStatus?.[this.userId] === true;
            if (!hasSeen) unreadCount++;

            const icon = UIUtils.GetIcon(notif.type);
            
            // Format timestamp
            let timeAgo = '';
            if (notif.timestamp) {
                const date = new Date(notif.timestamp);
                const now = new Date();
                const diffMs = now - date;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);
                
                if (diffMins < 1) {
                    timeAgo = 'Just now';
                } else if (diffMins < 60) {
                    timeAgo = `${diffMins}m ago`;
                } else if (diffHours < 24) {
                    timeAgo = `${diffHours}h ago`;
                } else if (diffDays < 7) {
                    timeAgo = `${diffDays}d ago`;
                } else {
                    timeAgo = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                }
            }

            list.innerHTML += `
                <li class="notification-items ">
                    <div class="dropdown-item rounded-2 p-2 h-100 border-bottom ${!hasSeen ? 'bg-secondary bg-opacity-10' : ''}" 
                         style="cursor: pointer;" 
                         onclick="NotificationEngine.MarkAsSeen('${id}', '${notif.link || ''}')">
                        <div class="d-flex align-items-center">
                            <i class="bi ${icon.icon} ${icon.bg.split(' ')[2]} me-2"></i>
                            <span class="fw-bold small text-truncate">${notif.title}</span>
                            <span class="ms-auto small text-muted" style="font-size: 9px; white-space: nowrap;">${timeAgo}</span>
                        </div>
                        <div class="text-muted small text-truncate ms-4 ps-1">${notif.message}</div>
                        
                    </div>
                </li>
            `;
        });

    if (countBadge) countBadge.innerText = unreadCount;
    if (dot) dot.style.display = unreadCount > 0 ? 'inline-block' : 'none';
},

    async MarkAsSeen(id, link) {
        await firebase.database().ref(`Utilities/Notifications/${id}/ReadStatus/${this.userId}`).set(true);
        if (link && typeof App !== 'undefined') App.Router(link);
    }
};

const BrowserNotificationEngine = {
    userId: localStorage.getItem('userloginid'),
    shownTimeouts: new Set(),
    hasAskedPermission: false,

    Init() {
        // Check if browser supports notifications
        if (!("Notification" in window)) {
            console.log('Browser does not support notifications');
            return;
        }

        // Listen for new broadcasts
        firebase.database().ref('Utilities/Broadcast-Services').on('child_added', (snapshot) => {
            const notif = snapshot.val();
            const id = snapshot.key;

            // Check if targeted to ALL or if this userId is in the target array
            const isForMe = notif.target === 'all' || (Array.isArray(notif.target) && notif.target.includes(this.userId));
            if (!isForMe) return;
            
            // Check if already seen
            const hasSeen = notif.ReadStatus?.[this.userId] === true;
            
            if (!hasSeen && !this.shownTimeouts.has(id)) {
                // Check permission status
                if (Notification.permission === "granted") {
                    // Permission already granted - show after 30s
                    this.shownTimeouts.add(id);
                    setTimeout(() => this.Show(id, notif), 30000);
                } else if (Notification.permission === "default" && !this.hasAskedPermission) {
                    // Permission not yet asked - request now
                    this.hasAskedPermission = true;
                    this.RequestPermission(id, notif);
                } else if (Notification.permission === "denied") {
                    console.log('Notifications blocked by user');
                    // Still mark as seen to prevent repeated attempts
                    firebase.database().ref(`Utilities/Broadcast-Services/${id}/ReadStatus/${this.userId}`).set(true);
                }
            }
        });
    },

    RequestPermission(id, notif) {
        // Show a friendly prompt before requesting
        if (confirm('🔔 Enable notifications to receive real-time alerts for approvals and updates?')) {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    console.log('Notification permission granted');
                    // Show the notification after permission is granted
                    this.shownTimeouts.add(id);
                    setTimeout(() => this.Show(id, notif), 1000);
                } else {
                    console.log('Notification permission denied');
                    // Mark as seen so we don't ask again for this notification
                    firebase.database().ref(`Utilities/Broadcast-Services/${id}/ReadStatus/${this.userId}`).set(true);
                }
            });
        } else {
            // User declined - mark as seen
            firebase.database().ref(`Utilities/Broadcast-Services/${id}/ReadStatus/${this.userId}`).set(true);
        }
    },

    async Show(id, notif) {
        // Double-check status in DB before showing
        const snap = await firebase.database().ref(`Utilities/Broadcast-Services/${id}/ReadStatus/${this.userId}`).once('value');
        if (snap.val() === true) return;

        // Check permission again
        if (Notification.permission !== "granted") {
            console.log('Notification permission not granted');
            return;
        }

        const icon = UIUtils?.GetIcon ? UIUtils.GetIcon(notif.type) : { emoji: '🔔' };
        const n = new Notification(`${icon.emoji} ${notif.title}`, { 
            body: notif.message, 
            icon: 'assets/img/logo.png',
            badge: '/favicon.ico',
            vibrate: [200, 100, 200],
            silent: false,
            tag: id, // Prevents duplicate notifications
            renotify: true
        });

        // Mark as seen immediately when notification appears
        firebase.database().ref(`Utilities/Broadcast-Services/${id}/ReadStatus/${this.userId}`).set(true);

        // Handle click event
        n.onclick = () => {
            window.focus();
            n.close();
            // Redirect logic
            if (notif.link) {
                if (typeof App !== 'undefined' && App.Router) {
                    App.Router(notif.link);
                } else if (notif.link.startsWith('http')) {
                    window.open(notif.link, '_blank');
                } else {
                    // Handle internal routing
                    const targetEl = document.querySelector(`[data-bs-target="${notif.link}"]`);
                    if (targetEl) {
                        targetEl.click();
                    } else {
                        window.location.hash = notif.link;
                    }
                }
            }
        };

        // Auto-close after 10 seconds
        setTimeout(() => {
            n.close();
        }, 10000);
    },

    // Helper function to check if notifications are enabled
    IsEnabled() {
        return "Notification" in window && Notification.permission === "granted";
    },

    // Helper function to get permission status
    GetPermissionStatus() {
        if (!("Notification" in window)) return 'unsupported';
        return Notification.permission;
    },

    // Helper function to request permission manually
    RequestManualPermission() {
        if (!("Notification" in window)) return Promise.reject('Not supported');
        if (Notification.permission === "granted") return Promise.resolve('granted');
        if (Notification.permission === "denied") return Promise.reject('denied');
        
        return new Promise((resolve, reject) => {
            if (confirm('🔔 Enable notifications to receive real-time alerts?')) {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        resolve('granted');
                    } else {
                        reject('denied');
                    }
                });
            } else {
                reject('declined');
            }
        });
    }
};

// Auto-initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait a moment before initializing
    setTimeout(() => {
        if (BrowserNotificationEngine.userId) {
            BrowserNotificationEngine.Init();
            console.log('BrowserNotificationEngine initialized');
        }
    }, 2000);
});



const UserProfileController = {
    userId: localStorage.getItem('userloginid'),
    userData: null,
    userSource: null, // 'users' or 'workspace_member'
    workspaceOwnerId: null,

    Init() {
        if (!this.userId) {
            console.error("[Profile] User ID not found.");
            this.Notify("Error", "You must be logged in to view this page.", "danger");
            return;
        }
        this.LoadUserData();
    },

    Notify(title, message, type) {
        if (window.App && window.App.UI && window.App.UI.Notify) {
            window.App.UI.Notify(title, message, type);
        } else if (window.UIUtils && window.UIUtils.Notify) {
            window.UIUtils.Notify(title, message, type);
        } else {
            alert(`${title}: ${message}`);
        }
    },

    // =========================================================
    // 1. FETCH USER DATA FROM BOTH LOCATIONS
    // =========================================================
    async LoadUserData() {
        try {
            const db = firebase.database();
            
            // 🔥 FIRST: Check if user exists in Users node
            const userSnap = await db.ref(`Users/${this.userId}`).once('value');
            
            if (userSnap.exists()) {
                this.userData = userSnap.val();
                this.userSource = 'users';
                this.workspaceOwnerId = null;
                console.log('✅ User found in Users node');
                this.RenderProfile();
                return;
            }

            // 🔥 SECOND: Search in all workspace/Members nodes
            console.log('⏳ User not in Users node, searching in workspace/Members...');
            
            const allUsersSnap = await db.ref('Users').once('value');
            const allUsers = allUsersSnap.val() || {};
            
            let found = false;
            for (const [ownerId, ownerData] of Object.entries(allUsers)) {
                const members = ownerData?.workspace?.Members || {};
                
                for (const [memberId, memberData] of Object.entries(members)) {
                    if (memberId === this.userId || memberData.userId === this.userId) {
                        // 🔥 Found user as workspace member
                        this.userData = {
                            ...memberData,
                            // Merge with workspace owner data for context
                            workspaceId: ownerData?.workspaceId || ownerId,
                            workspaceStatus: ownerData?.workspace?.WorkspaceSettings?.workspaceStatus || ownerData?.workspaceStatus || 'active',
                            workspaceOwnerId: ownerId,
                            workspaceOwnerName: ownerData?.name || 'Unknown',
                            isWorkspaceMember: true,
                            // Use member's status if available, else owner's status
                            status: memberData.status || ownerData?.status || 'active'
                        };
                        this.userSource = 'workspace_member';
                        this.workspaceOwnerId = ownerId;
                        found = true;
                        console.log('✅ User found in workspace/Members of:', ownerId);
                        break;
                    }
                }
                if (found) break;
            }

            if (!found) {
                this.Notify("Error", "User profile not found in database.", "danger");
                window.location.replace("./login.html");
                return;
            }

            this.RenderProfile();

        } catch (err) {
            console.error("Failed to load profile:", err);
            this.Notify("Error", "Could not connect to the database.", "danger");
        }
    },

    // =========================================================
    // 2. POPULATE UI AND FORM FIELDS
    // =========================================================
    RenderProfile() {
        const name = this.userData.name || this.userData.legalName || 'Unknown User';
        const email = this.userData.email || 'No Email Provided';
        const designation = this.userData.designation || this.userData.role || 'Designation not assigned';
        const role = this.userData.role || 'User';
        const status = this.userData.status || 'Active';
        
        // Generate Initials
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

        // Format Account Creation Date
        let joinedDate = 'Unknown';
        const createdAt = this.userData.created_at || this.userData.createdAt || this.userData.joinedAt;
        if (createdAt) {
            const dateObj = new Date(createdAt);
            joinedDate = dateObj.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        }

        // Fill Summary Card Elements
        const elInitials = document.getElementById('profileInitials');
        const elName = document.getElementById('profileDisplayName');
        const elEmail = document.getElementById('profileDisplayEmail');
        const elRole = document.getElementById('profileRoleBadge');
        const elJoined = document.getElementById('profileAccountCreated');
        const elStatus = document.getElementById('profileStatusText');
        const elUserSource = document.getElementById('profileUserSource');
        const elWorkspaceOwner = document.getElementById('profileWorkspaceOwner');

        if(elInitials) elInitials.innerText = initials;
        if(elName) elName.innerText = name;
        if(elEmail) elEmail.innerText = email;
        if(elRole) elRole.innerText = role;
        if(elJoined) elJoined.innerText = joinedDate;
        
        if(elStatus) {
            elStatus.innerText = status.charAt(0).toUpperCase() + status.slice(1);
            elStatus.className = status === 'active' ? 'fw-bold text-success mb-0' : 'fw-bold text-danger mb-0';
        }

        // Show user source
        if(elUserSource) {
            const sourceLabel = this.userSource === 'workspace_member' ? 'Workspace Member' : 'Primary User';
            elUserSource.innerText = sourceLabel;
            elUserSource.className = this.userSource === 'workspace_member' ? 'badge bg-info' : 'badge bg-primary';
        }

        // Show workspace owner info (if member)
        if(elWorkspaceOwner) {
            if (this.userSource === 'workspace_member' && this.workspaceOwnerId) {
                elWorkspaceOwner.innerHTML = `
                    <div class="small text-muted">
                        <i class="bi bi-person-workspace me-1"></i>
                        Workspace Owner: <strong>${this.userData.workspaceOwnerName || 'Unknown'}</strong>
                    </div>
                `;
            } else {
                elWorkspaceOwner.innerHTML = '';
            }
        }

        // Fill Form Inputs
        const inputName = document.getElementById('inputProfileName');
        const inputEmail = document.getElementById('inputProfileEmail');
        const inputDesig = document.getElementById('inputProfiledesignation');
        const inputRole = document.getElementById('inputProfileRole');
        const inputStatus = document.getElementById('inputProfileStatus');
        
        if(inputName) inputName.value = name;
        if(inputEmail) inputEmail.value = email;
        if(inputDesig) inputDesig.value = designation;
        if(inputRole) inputRole.value = role;
        if(inputStatus) inputStatus.value = status;

        // 🔥 Disable fields for workspace members (read-only)
        const isMember = this.userSource === 'workspace_member';
        if(inputName) inputName.disabled = isMember;
        if(inputEmail) inputEmail.disabled = isMember;
        if(inputDesig) inputDesig.disabled = isMember;
        if(inputRole) inputRole.disabled = isMember;
        if(inputStatus) inputStatus.disabled = isMember;

        // Show/hide save button for members
        const saveBtn = document.getElementById('btnSaveProfile');
        if(saveBtn) {
            saveBtn.style.display = isMember ? 'none' : 'block';
        }
    },

    // =========================================================
    // 3. SAVE PROFILE (Only for Users node users)
    // =========================================================
    async UpdateProfile() {
        // 🔥 Prevent workspace members from updating profile
        if (this.userSource === 'workspace_member') {
            this.Notify("Access Denied", "Workspace members cannot update their profile. Contact workspace owner.", "danger");
            return;
        }

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

            this.userData.name = newName;
            this.RenderProfile();
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

    // =========================================================
    // 4. UPDATE PASSWORD (Only for Users node users)
    // =========================================================
    async UpdatePassword() {
        // 🔥 Prevent workspace members from changing password
        if (this.userSource === 'workspace_member') {
            this.Notify("Access Denied", "Workspace members cannot change password. Contact workspace owner.", "danger");
            return;
        }

        const currentPassInput = document.getElementById('inputCurrentPassword');
        const newPassInput = document.getElementById('inputNewPassword');
        const confirmPassInput = document.getElementById('inputConfirmPassword');
        const btn = document.getElementById('btnSavePassword');

        if (!currentPassInput || !newPassInput || !confirmPassInput) return;

        const currentPass = currentPassInput.value;
        const newPass = newPassInput.value;
        const confirmPass = confirmPassInput.value;

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

            this.userData.password = newPass;

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
    },

    // =========================================================
    // 5. GET USER TYPE (Helper)
    // =========================================================
    getUserType() {
        if (this.userSource === 'workspace_member') {
            return 'workspace_member';
        }
        return 'primary_user';
    },

    isWorkspaceMember() {
        return this.userSource === 'workspace_member';
    },

    getWorkspaceOwner() {
        if (this.isWorkspaceMember()) {
            return {
                id: this.workspaceOwnerId,
                name: this.userData.workspaceOwnerName || 'Unknown'
            };
        }
        return null;
    }
};

/**
 * ========================================================================
 * UNIVERSAL MASTER DATA ENGINE & OBSERVER
 * ========================================================================
 */


const MasterEngine = {
    /**
     * Internal State Handler for Edit Contexts
     */
    State: {
        Key: 'master_edit_context',
        Load(formId) {
            const raw = localStorage.getItem(this.Key);
            if (!raw) return null;
            const data = JSON.parse(raw);
            return data.formId === formId ? data : null;
        },
        Clear() {
            localStorage.removeItem(this.Key);
        }
    }
};

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
                    await API.SaveMaster(`${sheetName}`, payload);
                    // alert(`${formId} Created Successfully!`);
                }
                
                var listRoute = `masters/${formId.toLowerCase()}-list`;
                listRoute= `masters/${form.getAttribute("data-listattribute")}-list`
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

