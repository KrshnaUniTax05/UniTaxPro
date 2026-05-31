/**
 * UNITAX PRO - Core Application Brain (Final Stable)
 * Handles: Routing, Logic Injection, Auto-Fill, Uniqueness, and UI Themes
 */
const App = {
    State: {
        userId: localStorage.getItem('userloginid'),
        userName: localStorage.getItem('userName'),
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
        // 1. Auth Guard
        if (!this.State.userId) { 
            window.location.href = 'login.html'; 
            return; 
        }
        
        // 2. Initialize Sub-Systems
        API.Init();
        this.UI.InitTheme();
        this.UI.StartClock();
        this.BindGlobalEvents();
        

        // 3. PRE-FETCH COMPANY DATA ON STARTUP
        // This makes sure it's ready for any statement or report immediately
        // this.GetPersistentData(`${this.State.userId}/Masters/Companies`, 'Company');

        // 3. Set Header Displays
        document.getElementById('usernameDisplay').innerText = this.State.userName || "User";
        const userIdEl = document.getElementById('main_userid_show');
        if(userIdEl) userIdEl.innerText = `ID: ${this.State.userId}`;

        // 🚀 FIXED STARTUP LOGIC
        const pinnedModule = localStorage.getItem('pinnedModule');
        if (pinnedModule) {
            console.log(`📡 [App] Loading pinned module: ${pinnedModule}`);
            await this.Router(pinnedModule);
        } else {
            await this.Router('dashboard');
        }

        // 5. Remove Loader
        const loader = document.getElementById('app-loader');
        if(loader) loader.style.display = 'none';
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
        const toggle = document.getElementById('darkModeToggle');
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



// 1. Open Modal
window.opentaskmodal = function() {
    new bootstrap.Modal(document.getElementById('taskModal')).show();
};

// 2. Save Task to LocalStorage
window.saveTask = function() {
    const input = document.getElementById('taskInput');
    if (!input.value.trim()) return;

    let tasks = JSON.parse(localStorage.getItem('userTasks') || '[]');
    tasks.push({ id: Date.now(), text: input.value, done: false });
    localStorage.setItem('userTasks', JSON.stringify(tasks));
    
    input.value = '';
    bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
    renderTasks();
};

// 3. Render Tasks from LocalStorage
window.renderTasks = function() {
    const tbody = document.getElementById('taskTableBody');
    const tasks = JSON.parse(localStorage.getItem('userTasks') || '[]');
    
    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td class="text-center text-muted py-3">No active tasks</td></tr>';
        return;
    }

    tbody.innerHTML = tasks.map(t => `
        <tr class="align-middle">
            <td class="ps-2">${t.text}</td>
            <td class="text-end pe-2">
                <button class="btn btn-xs btn-outline-danger py-0 px-1" onclick="deleteTask(${t.id})"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join('');
};

window.deleteTask = function(id) {
    let tasks = JSON.parse(localStorage.getItem('userTasks') || '[]');
    tasks = tasks.filter(t => t.id !== id);
    localStorage.setItem('userTasks', JSON.stringify(tasks));
    renderTasks();
};

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


// search
