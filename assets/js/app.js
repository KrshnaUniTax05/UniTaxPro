/**
 * UNITAX PRO - Core Application Brain (Enterprise Edition)
 * Orchestrates: State, Lifecycle, Router, RBAC, Error Boundary, Notification & Theme
 */

const App = {
    State: {
        userId: localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid'),
        workspaceUserId: localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid'),
        currentuserId: localStorage.getItem('userloginid'),
        userName: localStorage.getItem('userName') || 'User',
        userRole: localStorage.getItem('userrole') || 'operator',
        workspaceId: localStorage.getItem('workspaceId') || '',
        activeModule: null,
        isDarkMode: localStorage.getItem('darkMode') === 'enabled'
    },

    _isInitialized: false,

    /**
     * INITIALIZE APPLICATION LIFECYCLE
     */
    async Init() {
        if (this._isInitialized) return;
        this._isInitialized = true;

        try {
            // 1. Synchronize State from Local Storage
            this.State.userId = localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');
            this.State.workspaceUserId = localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');
            this.State.currentuserId = localStorage.getItem('userloginid');
            this.State.userName = localStorage.getItem('userName') || 'User';
            this.State.userRole = localStorage.getItem('userrole') || 'operator';
            this.State.workspaceId = localStorage.getItem('workspaceId') || '';

            // 2. Authentication Guard
            if (!this.State.userId) {
                window.location.href = 'login.html';
                return;
            }

            // 3. Global Error Boundary
            this.InitErrorBoundary();

            // 4. Sub-Systems Initialization
            if (window.API && typeof API.Init === 'function') {
                API.Init();
            }

            // 4b. Live RBAC permission synchronisation + suspension guard listeners
            try {
                if (window.UniTaxAuth && typeof UniTaxAuth.SyncLivePermissions === 'function') {
                    UniTaxAuth.SyncLivePermissions().then(() => {
                        try { this.UpdateHeaderDisplays(); } catch (e) {}
                    }).catch(() => {});
                }
                if (window.UniTaxOperations && typeof UniTaxOperations.InstallRealtimeSync === 'function') {
                    UniTaxOperations.InstallRealtimeSync();
                }
            } catch (syncErr) {
                console.warn('[App] Live permission / operations sync non-critical error:', syncErr);
            }


            this.HideStartupLoader();
            this.UI.InitTheme();
            this.UI.StartClock();
            this.BindGlobalEvents();

            // 5. Update Header Displays
            this.UpdateHeaderDisplays();

            // 6. Initialize Safe Notification Engines
            try {
                if (typeof NotificationEngine !== 'undefined' && NotificationEngine.Init) {
                    NotificationEngine.Init();
                }
                if (typeof BrowserNotificationEngine !== 'undefined' && BrowserNotificationEngine.Init) {
                    BrowserNotificationEngine.Init();
                }
            } catch (notifErr) {
                console.warn("Notification system non-critical error:", notifErr);
            }

            // 7. Router Initialization
            if (window.UniTaxRouter && typeof UniTaxRouter.Init === 'function') {
                UniTaxRouter.Init();
            }

           

        } catch (criticalErr) {
            console.error("Critical Application Startup Failure:", criticalErr);
            this.UI.Notify('Startup Error', 'System initialization error. Please refresh.', 'danger');
        } finally {
            this.HideStartupLoader();
        }
    },

    /**
     * Safely hide & purge full-screen startup loader
     */
    HideStartupLoader() {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.transition = 'opacity 0.25s ease-out';
            loader.style.opacity = '0';
            loader.style.pointerEvents = 'none';
            setTimeout(() => {
                loader.classList.remove('d-flex');
                loader.classList.add('d-none');
                loader.style.setProperty('display', 'none', 'important');
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
            }, 250);
        }
    },

    /**
     * GLOBAL ERROR BOUNDARY (Phase 11)
     * Catches uncaught runtime exceptions and unhandled promise rejections
     */
    InitErrorBoundary() {
        window.onerror = (message, source, lineno, colno, error) => {
            console.warn("[Global Error Boundary]", { message, source, lineno, colno, error });
            // Suppress non-fatal intrusive toast notifications during background operations
            return false; // Let browser keep diagnostic logs in developer console
        };

        window.addEventListener('unhandledrejection', (event) => {
            console.warn("[Unhandled Promise Rejection]", event.reason);
            // Suppress non-fatal intrusive toast notifications during background async operations
        });
    },

    /**
     * Update Navigation Header Displays
     */
    UpdateHeaderDisplays() {
        const nameEl = document.getElementById('usernameDisplay');
        const roleEl = document.getElementById('main_role_show');
        const userInitial = document.getElementById('userInitial');
        const userNameDisplay = document.getElementById('userNameDisplay');
        const userEmailDisplay = document.getElementById('userEmailDisplay');
        const realUserEl = document.getElementById('realUser');

        const userName = this.State.userName || 'User';
        const userRole = this.State.userRole || 'Operator';
        const userEmail = localStorage.getItem('useremail_we') || `${this.State.currentuserId}@unitax.local`;

        if (nameEl) nameEl.innerText = userName;
        if (roleEl) roleEl.innerText = `Role: ${userRole}`;
        if (userInitial) userInitial.innerText = userName.charAt(0).toUpperCase();
        if (userNameDisplay) userNameDisplay.innerText = userName;
        if (userEmailDisplay) userEmailDisplay.innerText = userName;
        if (realUserEl) realUserEl.innerText = `ID: ${this.State.currentuserId}`;

        this.DisplayWorkspaceName();

        // Update sidebar and menu links visual indication based on RBAC permissions
        if (window.UniTaxAuth && typeof UniTaxAuth.CanAccessModule === 'function') {
            const roleStr = (this.State.userRole || localStorage.getItem('userrole') || 'operator').toLowerCase();
            const isAdmin = ['administrator', 'super_administrator', 'co_useradmin', 'co_admin', 'workspaceowner'].includes(roleStr) || localStorage.getItem('masterControl') === 'administration';

            // Query all sidebar and navigation links across desktop and mobile
            document.querySelectorAll('.sidebar-desktop [data-route], #sidebarOffcanvas [data-route], [data-route]').forEach(link => {
                const route = link.dataset.route || link.dataset.module;
                if (!route) return;

                // Specific hard restriction for User Admin Control Panel: hide completely for non-admins
                if (route.includes('useradmin')) {
                    link.style.display = isAdmin ? 'flex' : 'none';
                    return;
                }

                if (!UniTaxAuth.CanAccessModule(route)) {
                    link.classList.add('opacity-50');
                    if (!link.querySelector('.bi-lock-fill')) {
                        const lock = document.createElement('i');
                        lock.className = 'bi bi-lock-fill text-muted ms-auto small';
                        lock.style.fontSize = '10px';
                        link.appendChild(lock);
                    }
                } else {
                    link.classList.remove('opacity-50');
                    const existingLock = link.querySelector('.bi-lock-fill');
                    if (existingLock) existingLock.remove();
                }
            });

            // Also hide Admin Control from top-right user menu if not admin
            document.querySelectorAll('a[href*="useradmincontrolpanel"]').forEach(link => {
                if (link.closest('li')) {
                    link.closest('li').style.display = isAdmin ? 'block' : 'none';
                }
            });
        }
    },

    /**
     * Display Workspace Anchor / Organization Name
     */
    DisplayWorkspaceName(elId = 'main_userid_show') {
        const el = document.getElementById(elId);
        if (!el) return;
        const wsId = this.State.userId;
        if (!wsId) {
            el.innerText = 'Guest';
            return;
        }

        if (typeof firebase !== 'undefined' && firebase.database) {
            firebase.database().ref(`Users/${wsId}/workspace/WorkspaceSettings`).once('value')
                .then(snap => {
                    const wsData = snap.val() || {};
                    const name = wsData.workspaceName || wsData.companyName;
                    el.innerText = name ? `Org: ${name}` : `WS: #${wsId.substring(0, 10)}`;
                    if (wsData.postingPeriod) {
                        localStorage.setItem('workspacePostingPeriod', JSON.stringify(wsData.postingPeriod));
                    }
                })
                .catch(() => {
                    el.innerText = `WS: #${wsId.substring(0, 10)}`;
                });
        } else {
            el.innerText = `WS: #${wsId.substring(0, 10)}`;
        }
    },

    /**
     * Central Router Alias for backward compatibility
     */
    Router(path) {
        if (window.UniTaxRouter && typeof UniTaxRouter.Navigate === 'function') {
            UniTaxRouter.Navigate(path);
        }
    },

    goBack() {
        const prev = localStorage.getItem('PreviousPath') || 'dashboard';
        this.Router(prev);
    },

    /**
     * ERP Form & Grid Initializer
     */
    async InitERPLogic(modulePath) {
        if (!modulePath) return;
        const cleanMod = modulePath.toLowerCase().replace(/^\/+/, '');

        // Exclude overview dashboard, utility panels, user admin panel, and settings from ERP voucher post logic
        if (cleanMod === 'dashboard' || cleanMod.startsWith('utilities/') || cleanMod.startsWith('settings') || cleanMod.startsWith('help')) {
            return;
        }

        const form = document.querySelector('#main-content form');
        if (!form) return;

        // Prevent duplicate listener attachments and event multiplication
        if (form._erpLogicInitialized && form._erpCurrentModule === cleanMod) {
            return;
        }
        form._erpLogicInitialized = true;
        form._erpCurrentModule = cleanMod;

        // Skip non-ERP forms that have their own custom handlers
        if (form.classList.contains('nosubmit') || form.id === 'provisionForm' || form.id === 'editUserForm' || form.id === 'wsSettingsForm') {
            return;
        }

        // 1. Populate Datalists for Lookups
        if (window.API && API.PopulateAllDatalists) {
            await API.PopulateAllDatalists(form);
        }

        // 1b. Field-Level Authorization & Form Pre-fill Enforcement
        if (window.UniTaxAuth && typeof UniTaxAuth.GetEffectivePermissions === 'function') {
            const perms = UniTaxAuth.GetEffectivePermissions();
            const rules = perms.fieldRestrictions || [];
            const curMod = (modulePath || (window.UniTaxRouter && UniTaxRouter.currentRoute) || '').toLowerCase();

            rules.forEach(rule => {
                if (!rule || !rule.field) return;
                const ruleMod = (rule.module || 'ALL').trim().toLowerCase();
                if (ruleMod !== 'all' && !curMod.includes(ruleMod) && !ruleMod.includes(curMod)) return;

                const fieldName = rule.field.trim();
                const accessMode = (rule.accessMode || 'EDITABLE').toUpperCase();
                const condition = (rule.condition || 'EQUALS').toUpperCase();
                const val = (rule.value || '').trim();

                const targets = form.querySelectorAll(`[name="${fieldName}"], [id="${fieldName}"], [data-field="${fieldName}"]`);
                targets.forEach(el => {
                    // Field visibility
                    if (accessMode === 'HIDDEN') {
                        const parentCol = el.closest('.col, .col-1, .col-2, .col-3, .col-4, .col-5, .col-6, .col-7, .col-8, .col-9, .col-10, .col-11, .col-12, .mb-3, .form-group');
                        if (parentCol) parentCol.style.display = 'none';
                        else el.style.display = 'none';
                    } else if (accessMode === 'LOCKED_READONLY') {
                        el.readOnly = true;
                        if (el.tagName === 'SELECT') el.disabled = true;
                        el.classList.add('bg-light');
                    }

                    // Pre-fill fixed value
                    if (condition === 'EQUALS' && val && val !== '*') {
                        if (!el.value) el.value = val;
                        if (accessMode === 'LOCKED_READONLY') {
                            el.readOnly = true;
                            if (el.tagName === 'SELECT') el.disabled = true;
                        }
                    }

                    // Datalist and Select filtering for IN_LIST
                    if (condition === 'IN_LIST' && val && val !== '*' && !val.includes('*')) {
                        const allowedList = val.split(',').map(s => s.trim().toLowerCase());
                        const matchesAllowed = (optionEl, optVal) => {
                            const candidates = [
                                optVal,
                                (optionEl.getAttribute('data-value') || '').trim(),
                                (optionEl.getAttribute('data-text') || '').trim(),
                                (optionEl.label || '').trim()
                            ].filter(Boolean).map(v => v.toLowerCase());

                            if (candidates.some(c => allowedList.includes(c))) return true;

                            // "Name (Code)" canonical -> accept a name-only or code-only allow entry
                            const pm = (optVal || '').match(/^(.*?)\s*\((.*?)\)$/);
                            if (pm) {
                                const namePart = pm[1].trim().toLowerCase();
                                const codePart = pm[2].trim().toLowerCase();
                                if (allowedList.includes(namePart) || allowedList.includes(codePart)) return true;
                            }
                            return false;
                        };

                        const listId = el.getAttribute('list');
                        if (listId) {
                            const dl = document.getElementById(listId);
                            if (dl) {
                                Array.from(dl.options).forEach(opt => {
                                    const optVal = (opt.value || '').trim();
                                    if (!matchesAllowed(opt, optVal)) {
                                        opt.remove();
                                    }
                                });
                            }
                        } else if (el.tagName === 'SELECT') {
                            Array.from(el.options).forEach(opt => {
                                const optVal = (opt.value || '').trim();
                                if (optVal && !matchesAllowed(opt, optVal)) {
                                    opt.disabled = true;
                                    opt.style.display = 'none';
                                }
                            });
                        }
                    }
                });
            });
        }

        // 2. Uniqueness Checker
        if (window.UniquenessChecker && UniquenessChecker.init) {
            UniquenessChecker.init(form);
        }

        // 3. Grid Row Recalculation Listener
        form.addEventListener('input', (e) => {
            const input = e.target;
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

            if (modulePath.includes('transactions/')) {
                if (input.classList.contains('qty') || input.classList.contains('rate') || input.classList.contains('tax-val')) {
                    if (typeof window.recalculateVoucher === 'function') window.recalculateVoucher();
                }
            }
        });

        // 4. Form Submit Listener
        form.onsubmit = async (e) => {
            e.preventDefault();

            // Strict Input List Master Validation
            if (window.API && typeof API.ValidateInputLists === 'function') {
                const listCheck = await API.ValidateInputLists(form);
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
            }

            const submitBtn = form.querySelector('[type="submit"]');
            const originalHtml = submitBtn ? submitBtn.innerHTML : 'Submit';

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Processing...`;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const vchKey = urlParams.get('key');
            const formType = urlParams.get('type');
            const isMaster = form.dataset.category === 'Masters';
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            let success = false;
            try {
                if (isMaster) {
                    success = await API.SaveMaster(form.id, data);
                    if (success) {
                        if (window.API && window.API._MasterCache) {
                            delete window.API._MasterCache[form.id];
                            delete window.API._MasterCache['Stock'];
                            delete window.API._MasterCache['stock'];
                            delete window.API._MasterCache['LedgerCreation'];
                            delete window.API._MasterCache['CompanyCreation'];
                            delete window.API._MasterCache['Projects'];
                        }
                        // Transition to the registry view so user immediately sees the new record
                        if (form.id === 'Stock' && window.UniTaxRouter) {
                            UniTaxRouter.Navigate('masters/stock-list');
                        } else if (form.id === 'LedgerCreation' && window.UniTaxRouter) {
                            UniTaxRouter.Navigate('masters/ledger-list');
                        } else if (form.id === 'CompanyCreation' && window.UniTaxRouter) {
                            UniTaxRouter.Navigate('masters/company-list');
                        } else if (form.id === 'Projects' && window.UniTaxRouter) {
                            UniTaxRouter.Navigate('masters/project-list');
                        }
                    }
                } else if (vchKey && formType) {
                    success = await API.UpdateVoucher(form, formType, vchKey);
                } else {
                    success = await API.PostVoucher(form);
                }

                if (success) {
                    if (!vchKey) form.reset();
                    if (typeof window.recalculateVoucher === 'function') window.recalculateVoucher();
                }
            } catch (err) {
                console.error("Form submission failure:", err);
                App.UI.Notify('Error', err.message || 'Operation failed.', 'danger');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                }
            }
        };
    },

    /**
     * BIND GLOBAL APPLICATION EVENTS & SHORTCUTS
     */
    BindGlobalEvents() {
        const searchInput = document.getElementById('globalSearch');

        // Global Command Search Shortcut: '/'
        document.addEventListener('keydown', (e) => {
            if (e.key === '/') {
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                    }
                }
            }
            if (e.key === 'Escape' && document.activeElement === searchInput) {
                searchInput.value = '';
                searchInput.blur();
            }
        });

        // Search execution
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                App.Search.HandleSearch(searchInput.value);
            }
        });
        searchInput?.addEventListener('change', () => {
            if (searchInput.value && searchInput.value.trim().length > 0) {
                App.Search.HandleSearch(searchInput.value);
            }
        });

        // Pin Active Module: F10
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F10') {
                e.preventDefault();
                const current = UniTaxRouter.currentRoute || 'dashboard';
                const pinned = localStorage.getItem('pinnedModule');

                if (pinned === current) {
                    localStorage.removeItem('pinnedModule');
                    this.UI.Notify('System', 'Module unpinned from startup.', 'info');
                } else {
                    localStorage.setItem('pinnedModule', current);
                    this.UI.Notify('System', `Module [${current}] pinned as startup view.`, 'success');
                }
            }
        });

        // Logout
        const logoutBtn = document.getElementById('logoutButton');
        if (logoutBtn) {
            logoutBtn.onclick = (e) => {
                e.preventDefault();
                if (confirm("Sign out of UniTax Pro?")) {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = 'login.html';
                }
            };
        }
    },

    /**
     * SEARCH COMMAND ENGINE
     */
    Search: {
        Registry: {
            "dash": "dashboard",
            "overview": "dashboard",
            "comp": "masters/company-cw",
            "companies": "masters/company-list",
            "ledger": "masters/ledger-cw",
            "ledgers": "masters/ledger-list",
            "stock": "masters/stock-cw",
            "inventory": "masters/stock-list",
            "project": "masters/project-cw",
            "projects": "masters/project-list",
            "sales": "transactions/sales-inv",
            "purchase": "transactions/purchase-inv",
            "receipt": "transactions/receipt-vch",
            "payment": "transactions/payment-vch",
            "credit note": "transactions/salesret-inv",
            "debit note": "transactions/purchaseret-inv",
            "gl": "reports/gl-statement",
            "statement": "reports/gl-statement",
            "gstr1": "reports/gstr1",
            "approvals": "reports/approvalmanagementsystem",
            "users": "utilities/useradmincontrolpanel",
            "admin": "utilities/useradmincontrolpanel",
            "settings": "settings",
            "profile": "utilities/profile"
        },

        HandleSearch(query) {
            const input = (query || '').toLowerCase().trim();
            if (!input) return;

            const target = this.Registry[input];
            if (target) {
                UniTaxRouter.Navigate(target);
                this.Clear();
                return;
            }

            // Direct route search
            if (UniTaxRouter.Routes[input]) {
                UniTaxRouter.Navigate(input);
                this.Clear();
                return;
            }

            App.UI.Notify('Navigation', `No module found matching "${input}".`, 'warning');
        },

        Clear() {
            const s = document.getElementById('globalSearch');
            if (s) { s.value = ""; s.blur(); }
        }
    },

    /**
     * UI & NOTIFICATION HELPERS
     */
    UI: {
        Notify(title, message, type = 'primary') {
            const box = document.getElementById('errorNotificationBox');
            const titleEl = document.getElementById('notifyTitle');
            const msgEl = document.getElementById('notifyMessage');
            const iconEl = document.getElementById('notifyIcon');

            if (!box) {
                console.log(`[Notification ${type}] ${title}: ${message}`);
                return;
            }

            // Reset animation & classes
            box.classList.remove('slide-down', 'slide-up', 'show', 'bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info');

            const bgClass = type === 'danger' ? 'bg-danger' :
                            type === 'success' ? 'bg-success' :
                            type === 'warning' ? 'bg-warning' :
                            type === 'info' ? 'bg-info' : 'bg-primary';

            const iconClass = type === 'danger' ? 'bi-x-circle-fill' :
                              type === 'success' ? 'bi-check-circle-fill' :
                              type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';

            box.classList.add(bgClass);
            if (titleEl) titleEl.innerText = title;
            if (msgEl) msgEl.innerText = message;
            if (iconEl) iconEl.className = `bi ${iconClass} me-2 fs-5`;

            // Trigger slide-up animation
            box.style.display = 'flex';
            requestAnimationFrame(() => {
                box.classList.add('slide-up');
                box.classList.add('show');
            });

            clearTimeout(window._notifyTimer);
            window._notifyTimer = setTimeout(() => {
                box.classList.remove('slide-up');
                box.classList.add('slide-down');
                setTimeout(() => {
                    box.classList.remove('slide-down', 'show');
                }, 350);
            }, 4000);
        },

        StartClock() {
            const liveTime = document.getElementById('liveTime');
            const liveDate = document.getElementById('liveDate');
            if (!liveTime && !liveDate) return;

            const updateClock = () => {
                const now = new Date();
                if (liveTime) {
                    liveTime.innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                }
                if (liveDate) {
                    liveDate.innerText = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                }
            };
            updateClock();
            setInterval(updateClock, 1000);
        },

        InitTheme() {
            if (localStorage.getItem('darkMode') === 'enabled') {
                document.body.classList.add('dark-mode');
            }
        },

        ToggleDarkMode(enable) {
            document.body.classList.toggle('dark-mode', enable);
            localStorage.setItem('darkMode', enable ? 'enabled' : 'disabled');
        }
    }
};

/**
 * SYSTEM ALERTS & NOTIFICATION ENGINE
 * Strictly filters and appends ONLY:
 * 1. Platform Promotions & Feature Releases from Master Admin
 * 2. Approvals assigned to user or rejected
 * Each notification card is rendered as a single clickable anchor tag <a> without badges or inner buttons.
 */
NotificationEngine = {
    _items: [],
    _unreadCount: 0,
    _bound: false,
    _readSet: new Set(),
    _readPath: null,

    _CurrentUserId() {
        return String(localStorage.getItem('userloginid') || localStorage.getItem('userId') || (typeof App !== 'undefined' && App.State && App.State.userId) || '').trim().replace(/^#/, '');
    },

    _WorkspaceId() {
        return String(localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid') || (typeof App !== 'undefined' && App.State && App.State.userId) || '').trim().replace(/^#/, '');
    },

    _GetReadPath() {
        const wsId = this._WorkspaceId();
        const uid = this._CurrentUserId();
        if (!wsId || !uid) return null;
        return `Users/${wsId}/workspace/NotificationReadState/${uid}`;
    },

    _LocalReadKey() { return 'unitax_notif_read'; },

    _GetLocalReadSet() {
        try { return new Set(JSON.parse(localStorage.getItem(this._LocalReadKey()) || '[]')); } catch (e) { return new Set(); }
    },

    _SaveLocalReadSet(set) {
        try { localStorage.setItem(this._LocalReadKey(), JSON.stringify(Array.from(set))); } catch (e) {}
    },

    BindReadStateListener() {
        if (typeof firebase === 'undefined' || !firebase.database) return;
        const path = this._GetReadPath();
        if (!path || this._readPath === path) return;
        this._readPath = path;
        try {
            firebase.database().ref(path).on('value', (snap) => {
                const val = snap && snap.val();
                const next = new Set();
                if (val && typeof val === 'object') {
                    Object.entries(val).forEach(([k, v]) => { if (v) next.add(k); });
                }
                this._GetLocalReadSet().forEach(id => next.add(id));
                this._readSet = next;
                this.Render();
            }, (err) => {
                console.warn('Notification read-state listener denied:', err);
                this._readSet = this._GetLocalReadSet();
                this.Render();
            });
        } catch (e) {
            console.warn('Notification read-state binding failed:', e);
            this._readSet = this._GetLocalReadSet();
            this.Render();
        }
    },

    MarkReadOnServer(id) {
        if (!id || typeof firebase === 'undefined' || !firebase.database) return;
        const path = this._GetReadPath();
        if (!path) return;
        try {
            const uid = this._CurrentUserId();
            const updates = {};
            updates[id] = true;
            const local = this._GetLocalReadSet();
            local.add(id);
            this._SaveLocalReadSet(local);
            firebase.database().ref(path).update(updates).catch(() => {});
            // Keep Utilities/Notifications ReadStatus in sync for direct alert records
            if (String(id).startsWith('notif_') || String(id).startsWith('alert-')) {
                const rawId = String(id).replace(/^(notif_|alert-)/, '');
                const wsId = this._WorkspaceId();
                if (uid && rawId) {
                    const rs = {};
                    rs[`ReadStatus/${uid}`] = 'read';
                    firebase.database().ref(`Utilities/Notifications/${rawId}`).update(rs).catch(() => {});
                    if (wsId) firebase.database().ref(`${wsId}/Utilities/Notifications/${rawId}`).update(rs).catch(() => {});
                }
            }
        } catch (e) {}
    },

    _UpdateBellIndicator(unreadCount) {
        // Unread styling removed: read/unread state is now synchronized server-side and surfaced via the dropdown list.
        const btn = document.getElementById('notificationDropdown');
        const countEl = document.getElementById('notificationCount');
        const dotEl = document.getElementById('notificationDot');
        if (countEl) {
            countEl.style.display = 'none';
        }
        if (dotEl) {
            dotEl.style.display = 'none';
            dotEl.setAttribute('aria-hidden', 'true');
        }
        if (btn) {
            btn.classList.remove('is-unread');
            btn.setAttribute('aria-label', 'Notifications');
            btn.setAttribute('title', 'Notifications');
            const icon = btn.querySelector('i');
            if (icon) icon.className = 'bi bi-bell text-muted';
        }
    },

    IsMasterAdmin() {
        const role = String(localStorage.getItem('userrole') || localStorage.getItem('role') || '').toLowerCase();
        const masterControl = String(localStorage.getItem('masterControl') || '').toLowerCase();
        const email = String(localStorage.getItem('useremail') || localStorage.getItem('email') || '').toLowerCase();
        return role === 'master_admin' || role === 'super_administrator' || role === 'platform_admin' 
            || masterControl === 'administration' || masterControl === 'master' || email.includes('admin@unitax');
    },

    Init() {
        if (this._bound) return;
        this._bound = true;
        this._readSet = this._GetLocalReadSet();
        this.BindReadStateListener();
        this.BindFirebaseListeners();
        this.Render();
    },

    BindFirebaseListeners() {
        if (typeof firebase === 'undefined' || !firebase.database) return;
        try {
            const db = firebase.database();
            const wsUserId = String(localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid') || (typeof App !== 'undefined' && App.State && App.State.userId) || '').trim().replace(/^#/, '');
            const currentUserId = String(localStorage.getItem('userloginid') || localStorage.getItem('userId') || (typeof App !== 'undefined' && App.State && App.State.userId) || '').trim().replace(/^#/, '');
            const currentUserRole = String(localStorage.getItem('userrole') || localStorage.getItem('role') || '').trim().toLowerCase();
            const isApproverOrAdmin = ['administrator', 'co_useradmin', 'co_admin', 'approver', 'manager', 'owner', 'super_administrator', 'master_admin'].includes(currentUserRole);

            // 1. Process Platform Promotions & Feature Releases from Master Admin
            const processBroadcasts = (snap) => {
                if (!snap || !snap.exists()) return;
                const data = snap.val();
                if (!data || typeof data !== 'object') return;

                const promotions = [];
                Object.entries(data).forEach(([id, item]) => {
                    if (!item || typeof item !== 'object') return;
                    if (item.status && item.status !== 'active' && item.status !== 'published') return;

                    // Workspace or user targeting filter
                    if (item.audience === 'workspace' && item.targetWorkspaceId && item.targetWorkspaceId !== wsUserId) {
                        return;
                    }
                    if (item.audience === 'specific_user' && item.targetUserId && item.targetUserId !== currentUserId) {
                        return;
                    }

                    const time = Number(item.timestamp || item.createdAt || item.created_at || Date.now());
                    promotions.push({
                        id: 'promo-' + id,
                        category: 'promotion',
                        isPromotion: true,
                        title: item.title || 'Platform Promotion & Release',
                        subtitle: item.narration || item.message || item.description || 'Master Admin feature announcement & platform update',
                        author: item.author || 'Master Platform Admin',
                        icon: item.icon || 'bi-megaphone-fill text-primary',
                        ts: time,
                        time: this._FormatRelativeTime(time),
                        route: item.route || item.redirect || 'dashboard',
                        tab: item.tab || '',
                        link: item.link || ''
                    });
                });

                this.MergeNotifications(promotions);
            };

            // 2. Process Approvals assigned to user or rejected
            const processApprovals = (snap) => {
                if (!snap || !snap.exists()) return;
                const data = snap.val();
                if (!data || typeof data !== 'object') return;

                const approvalNotifs = [];

                Object.entries(data).forEach(([id, req]) => {
                    if (!req || typeof req !== 'object') return;
                    const hdr = req.header || req;
                    const time = Number(req.updatedAt || req.createdAt || hdr.timestamp || hdr.updatedAt || Date.now());
                    const docNo = req.docNo || hdr.doc_no || id;
                    const entity = req.entity || hdr.party_name || hdr.customer_name || hdr.supplier_name || 'Voucher';
                    const rawAmt = req.amount || hdr.grand_total || hdr.amount || 0;
                    const amtFormatted = rawAmt ? ` (₹${Number(rawAmt).toLocaleString('en-IN')})` : '';

                    const status = String(req.status || hdr.status || '').toUpperCase();
                    const state = String(req.state || hdr.state || '').toUpperCase();

                    const isRejected = status === 'REJECTED' || status === 'RETURNED' || state === 'RETURNED_TO_CREATOR' || state === 'REJECTED';
                    const isPending = status === 'PENDING' || status === 'PENDING_APPROVAL' || state === 'PENDING' || hdr.is_draft === true || req.is_draft === true;

                    const creatorId = String(req.creatorId || req.requesterId || hdr.created_by || hdr.posted_by || hdr.posted_by_id || hdr.user_id || '').trim().replace(/^#/, '');
                    const userEmail = String(localStorage.getItem('useremail') || '').trim().toLowerCase();
                    const isUserCreator = creatorId && (creatorId === currentUserId || creatorId.toLowerCase() === userEmail);
                    const isApproved = status === 'APPROVED' || state === 'APPROVED' || status === 'POSTED';

                    // 1. Rejection: Notify creator AND all below-level approvers
                    if (isRejected) {
                        const rejLevel = (req.rejectedByLevelIndex !== undefined) ? req.rejectedByLevelIndex : 0;
                        const isBelowLevelApprover = req.hierarchy && Array.isArray(req.hierarchy) && req.hierarchy.some(h => (h.levelIndex < rejLevel) && (h.userId === currentUserId || (userEmail && h.userId === userEmail)));
                        
                        if (isUserCreator || isBelowLevelApprover || isApproverOrAdmin) {
                            const reason = req.rejectionReason || hdr.rejection_reason || 'Requisition returned for originator correction.';
                            approvalNotifs.push({
                                id: 'approval-rej-' + id,
                                category: 'approval',
                                type: 'approval_rejected',
                                title: `Approval Rejected: ${docNo}`,
                                subtitle: `Returned with reason: ${reason}`,
                                author: req.rejectedByUserName || req.rejectedBy || hdr.rejected_by || 'Approving Authority',
                                icon: 'bi-x-circle-fill text-danger',
                                ts: time,
                                time: this._FormatRelativeTime(time),
                                route: 'reports/approvalmanagementsystem',
                                tab: isUserCreator ? 'creator-view' : 'inbox-view',
                                link: ''
                            });
                        }
                    } else if (isApproved) {
                        // 2. Full Approval: Statutory Governance requires notifying Initiator ONLY
                        if (isUserCreator) {
                            approvalNotifs.push({
                                id: 'approval-appr-' + id,
                                category: 'approval',
                                type: 'approval_completed',
                                title: `Application Fully Approved: ${docNo}`,
                                subtitle: `Verified and fully authorized across all hierarchy levels.`,
                                author: 'Governance Matrix',
                                icon: 'bi-check-circle-fill text-success',
                                ts: time,
                                time: this._FormatRelativeTime(time),
                                route: 'reports/approvalmanagementsystem',
                                tab: 'creator-view',
                                link: ''
                            });
                        }
                    } else if (isPending && !isRejected) {
                        // 3. Assignment: Sequential alert to newly assigned level approver
                        let assignedTo = '';
                        if (req.hierarchy && Array.isArray(req.hierarchy) && req.currentLevelIndex !== undefined && req.hierarchy[req.currentLevelIndex]) {
                            assignedTo = String(req.hierarchy[req.currentLevelIndex].userId || '').trim().replace(/^#/, '');
                        } else {
                            assignedTo = String(req.assignedTo || req.assignedManagerId || req.assignedUserId || req.currentAssignee || hdr.assigned_manager_id || '').trim().replace(/^#/, '');
                        }

                        const isAssigned = (assignedTo && (assignedTo === currentUserId || (userEmail && assignedTo.toLowerCase() === userEmail))) 
                            || (isApproverOrAdmin && (!assignedTo || assignedTo === currentUserId || assignedTo === 'Administrator'));

                        if (isAssigned) {
                            approvalNotifs.push({
                                id: 'approval-asn-' + id,
                                category: 'approval',
                                type: 'approval_assigned',
                                title: `Approval Assigned: ${docNo}${amtFormatted}`,
                                subtitle: `${entity} draft awaiting your authorization and approval.`,
                                author: req.requesterName || hdr.posted_by_name || 'Workflow System',
                                icon: 'bi-shield-exclamation text-warning',
                                ts: time,
                                time: this._FormatRelativeTime(time),
                                route: 'reports/approvalmanagementsystem',
                                tab: (req.voucherType || req.formId) ? 'vouchers-view' : 'inbox-view',
                                link: ''
                            });
                        }
                    }
                });

                this.MergeNotifications(approvalNotifs);
            };

            // Approvals listeners
            db.ref('Utilities/Requests').limitToLast(30).on('value', processApprovals);
            db.ref('Governance/Approvals').limitToLast(30).on('value', processApprovals);
            if (wsUserId) {
                db.ref(`${wsUserId}/Utilities/Requests`).limitToLast(30).on('value', processApprovals);
                db.ref(`${wsUserId}/Governance/Approvals`).limitToLast(30).on('value', processApprovals);
            }

            // Master Admin Platform Promotions & Releases listeners
            db.ref('PlatformMaster/Promotions').limitToLast(25).on('value', processBroadcasts);
            db.ref('PlatformMaster/Broadcasts').limitToLast(25).on('value', processBroadcasts);
            db.ref('Utilities/Broadcasts').limitToLast(25).on('value', processBroadcasts);
            if (wsUserId) {
                db.ref(`${wsUserId}/PlatformMaster/Broadcasts`).limitToLast(25).on('value', processBroadcasts);
                db.ref(`${wsUserId}/Utilities/Broadcasts`).limitToLast(25).on('value', processBroadcasts);
            }

            // Direct System Alert Notifications (Utilities/Notifications)
            const processNotifications = (snap) => {
                if (!snap || !snap.exists()) return;
                const data = snap.val();
                if (!data || typeof data !== 'object') return;
                const directNotifs = [];
                const userEmail = String(localStorage.getItem('useremail') || '').trim().toLowerCase();
                const userName = String(localStorage.getItem('userName') || localStorage.getItem('username') || '').trim().toLowerCase();
                const myIds = [currentUserId, wsUserId, userEmail, userName].filter(Boolean).map(x => String(x).trim().toLowerCase());

                Object.entries(data).forEach(([id, n]) => {
                    if (!n || typeof n !== 'object') return;
                    const target = String(n.target || n.userId || '').trim().toLowerCase();
                    const isForMe = target === 'all' || myIds.includes(target) || (target && myIds.some(m => m && (m === target || m.includes(target) || target.includes(m))));
                    if (!isForMe) return;

                    const time = Number(n.timestamp || Date.now());
                    const type = String(n.type || '').toLowerCase();
                    const isError = type === 'error' || type === 'danger' || type === 'warning';
                    const isSuccess = type === 'success';
                    const claimedId = n.dedupeKey ? String(n.dedupeKey) : ('notif_' + id);

                    directNotifs.push({
                        id: claimedId,
                        category: 'approval',
                        type: isError ? 'approval_rejected' : (isSuccess ? 'approval_completed' : 'approval_assigned'),
                        title: n.title || 'Approval System Alert',
                        subtitle: n.message || n.text || '',
                        author: n.sender || 'Governance Authority',
                        icon: isError ? 'bi-x-circle-fill text-danger' : (isSuccess ? 'bi-check-circle-fill text-success' : 'bi-shield-check text-warning'),
                        ts: time,
                        time: this._FormatRelativeTime(time),
                        route: n.link || 'reports/approvalmanagementsystem',
                        tab: n.tab || 'inbox-view',
                        link: n.link || '',
                        sourceId: id
                    });
                });

                this.MergeNotifications(directNotifs);
            };

            db.ref('Utilities/Notifications').limitToLast(30).on('value', processNotifications);
            if (wsUserId) {
                db.ref(`${wsUserId}/Utilities/Notifications`).limitToLast(30).on('value', processNotifications);
            }

            // Default fallback master promotion
            setTimeout(async () => {
                if (this._items.length === 0) {
                    const defaultNotice = {
                        id: 'promo-welcome',
                        category: 'promotion',
                        isPromotion: true,
                        title: 'Platform Feature Release: Governance & Approval Hub Active',
                        subtitle: 'Review multi-tier approval matrix, pending voucher drafts, and initiate requests.',
                        author: 'Master Platform Admin',
                        icon: 'bi-megaphone-fill text-primary',
                        time: 'Just now',
                        route: 'reports/approvalmanagementsystem',
                        tab: 'vouchers-view'
                    };
                    this.MergeNotifications([defaultNotice]);
                }
            }, 1200);

        } catch (e) {
            console.warn('NotificationEngine init error:', e);
        }
    },

    _FormatRelativeTime(ts) {
        if (!ts) return 'Recent';
        const diff = Math.floor((Date.now() - Number(ts)) / 1000);
        if (isNaN(diff) || diff < 0) return 'Just now';
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    },

    MergeNotifications(newItems) {
        if (!Array.isArray(newItems)) return;
        const existingMap = new Map();
        this._items.forEach(it => existingMap.set(it.id, it));

        newItems.forEach(it => {
            if (!it || !it.id) return;
            // STRICT FILTER:
            // 1. Platform Promotions & Feature Releases from Master Admin
            // 2. Any approval assigned to user or rejected
            const isPromo = it.category === 'promotion' || it.isPromotion || it.source === 'PlatformMaster';
            const isApproval = it.category === 'approval' || it.type === 'approval_assigned' || it.type === 'approval_rejected' || it.type === 'approval_completed';
            if (isPromo || isApproval) {
                existingMap.set(it.id, it);
            }
        });

        const validItems = Array.from(existingMap.values()).filter(it => {
            const isPromo = it.category === 'promotion' || it.isPromotion || it.source === 'PlatformMaster';
            const isApproval = it.category === 'approval' || it.type === 'approval_assigned' || it.type === 'approval_rejected' || it.type === 'approval_completed';
            return isPromo || isApproval;
        });

        this._items = validItems
            .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))
            .slice(0, 30);
        this.Render();
    },

    // Strict push filter: allows platform promotions and approval assignment/rejection/completion
    Push(customAlert) {
        if (!customAlert) return;
        if (customAlert.category === 'setting_update' || customAlert.source === 'settings') return;

        const isPromo = customAlert.category === 'promotion' || customAlert.isPromotion || customAlert.source === 'PlatformMaster';
        const isApproval = customAlert.category === 'approval' || customAlert.type === 'approval_assigned' || customAlert.type === 'approval_rejected' || customAlert.type === 'approval_completed';

        if (!isPromo && !isApproval) return;

        const id = customAlert.id || (isPromo ? 'promo-' : 'approval-') + Date.now();
        const ts = Number(customAlert.ts || customAlert.timestamp || Date.now());
        this._items.unshift({
            id: id,
            category: isPromo ? 'promotion' : 'approval',
            isPromotion: isPromo,
            type: customAlert.type || (isPromo ? 'promotion' : 'approval_assigned'),
            title: customAlert.title || (isPromo ? 'Platform Promotion & Release' : 'Approval Update'),
            subtitle: customAlert.message || customAlert.subtitle || '',
            author: customAlert.author || (isPromo ? 'Master Platform Admin' : 'Governance Authority'),
            icon: customAlert.icon || (isPromo ? 'bi-megaphone-fill text-primary' : 'bi-shield-check text-warning'),
            ts: ts,
            time: this._FormatRelativeTime(ts),
            route: customAlert.route || 'reports/approvalmanagementsystem',
            tab: customAlert.tab || '',
            link: customAlert.link || ''
        });
        this.MergeNotifications([]);
    },

    OpenNotice(route, tab, link, event, id) {
        if (id) {
            try {
                // Optimistic local state; authoritative read/unread comes from server listener.
                this._readSet.add(id);
                this.MarkReadOnServer(id);
                this.Render();
            } catch(e) {}
        }

        // 1. Close dropdown if open
        const notifBtn = document.getElementById('notificationDropdown');
        if (notifBtn && typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
            const bsDropdown = bootstrap.Dropdown.getInstance(notifBtn);
            if (bsDropdown) bsDropdown.hide();
        }

        // 2. Handle external link
        if (link && link.startsWith('http')) {
            if (event) event.preventDefault();
            window.open(link, '_blank');
            return;
        }

        const targetRoute = route || (link ? link.replace(/^#\/?/, '').split('?')[0] : 'dashboard');
        
        // 3. Navigate to module via router
        if (window.App && typeof App.Router === 'function') {
            if (event) event.preventDefault();
            App.Router(targetRoute);
        } else {
            window.location.hash = '#/' + targetRoute;
        }

        // 4. Switch tab if tab specified
        if (tab) {
            const activateTab = () => {
                const tabBtn = document.querySelector(`[data-bs-target="#${tab}"]`)
                            || document.querySelector(`[data-bs-target="${tab}"]`)
                            || document.querySelector(`button[onclick*="${tab}"]`)
                            || document.getElementById(tab);
                if (tabBtn) {
                    tabBtn.click();
                    if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                        const bsTab = bootstrap.Tab.getOrCreateInstance(tabBtn);
                        bsTab.show();
                    }
                }
            };
            setTimeout(activateTab, 200);
            setTimeout(activateTab, 500);
        }
    },

    OpenBroadcastModal() {
        if (!this.IsMasterAdmin()) {
            if (typeof App !== 'undefined' && App.UI && typeof App.UI.Notify === 'function') {
                App.UI.Notify('Permission Denied', 'Broadcast announcements are strictly restricted to the Master Platform Admin.', 'danger');
            } else {
                alert('Broadcast announcements are strictly restricted to the Master Platform Admin.');
            }
            return;
        }
        let modalEl = document.getElementById('adminBroadcastModal');
        if (!modalEl) {
            const div = document.createElement('div');
            div.innerHTML = `
                <div class="modal fade" id="adminBroadcastModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content border-0 shadow">
                            <div class="modal-header bg-primary text-white py-3">
                                <h6 class="modal-title fw-bold"><i class="bi bi-broadcast me-2"></i>Master Admin Platform Broadcast</h6>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-4">
                                <form id="broadcastAlertForm" onsubmit="event.preventDefault(); NotificationEngine.SubmitBroadcast();">
                                    <div class="mb-3">
                                        <label class="form-label small fw-bold">Broadcast Subject / Title <span class="text-danger">*</span></label>
                                        <input type="text" id="bcTitle" class="form-control form-control-sm" placeholder="e.g. Platform Feature Release: Automated E-Invoicing" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label small fw-bold">Message / Announcement Content <span class="text-danger">*</span></label>
                                        <textarea id="bcMessage" class="form-control form-control-sm" rows="3" placeholder="Provide clear instructions or operational directive for team members..." required></textarea>
                                    </div>
                                    <div class="row g-2 mb-3">
                                        <div class="col-7">
                                            <label class="form-label small fw-bold">Destination Module Route</label>
                                            <select id="bcRoute" class="form-select form-select-sm">
                                                <option value="reports/approvalmanagementsystem" selected>Governance & Approval Center</option>
                                                <option value="masters/project-list">Profit Center Registry</option>
                                                <option value="masters/company-list">Company Registry</option>
                                                <option value="reports/balance-sheet">Balance Sheet Statement</option>
                                                <option value="reports/profit-loss">Profit & Loss Statement</option>
                                                <option value="reports/cash-flow">Cash Flow Statement</option>
                                                <option value="utilities/useradmincontrolpanel">User Admin Control Panel</option>
                                            </select>
                                        </div>
                                        <div class="col-5">
                                            <label class="form-label small fw-bold">Destination Tab</label>
                                            <select id="bcTab" class="form-select form-select-sm">
                                                <option value="vouchers-view">Voucher Approvals</option>
                                                <option value="creator-view">Initiator Hub</option>
                                                <option value="inbox-view">Approver Review</option>
                                                <option value="create-view">New Request</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="row g-2 mb-3">
                                        <div class="col-6">
                                            <label class="form-label small fw-bold">Priority / Urgency</label>
                                            <select id="bcPriority" class="form-select form-select-sm">
                                                <option value="normal" selected>Standard Notice</option>
                                                <option value="urgent">Urgent Directive</option>
                                            </select>
                                        </div>
                                        <div class="col-6">
                                            <label class="form-label small fw-bold">Broadcast Category</label>
                                            <input type="text" id="bcCategory" class="form-control form-control-sm" value="Platform Release">
                                        </div>
                                    </div>
                                    <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
                                        <button type="button" class="btn btn-light btn-sm px-3" data-bs-dismiss="modal">Cancel</button>
                                        <button type="submit" class="btn btn-primary btn-sm px-4 fw-bold">
                                            <i class="bi bi-broadcast me-1"></i> Broadcast to Workspace
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(div);
            modalEl = document.getElementById('adminBroadcastModal');
        }

        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
    },

    async SubmitBroadcast() {
        if (!this.IsMasterAdmin()) {
            alert('Broadcast announcements are strictly restricted to the Master Platform Admin.');
            return;
        }
        const title = document.getElementById('bcTitle')?.value?.trim();
        const message = document.getElementById('bcMessage')?.value?.trim();
        const route = document.getElementById('bcRoute')?.value?.trim() || 'reports/approvalmanagementsystem';
        const tab = document.getElementById('bcTab')?.value?.trim() || '';
        const priority = document.getElementById('bcPriority')?.value || 'normal';
        const category = document.getElementById('bcCategory')?.value?.trim() || 'Platform Release';

        if (!title || !message) {
            alert('Title and Message are required.');
            return;
        }

        const author = localStorage.getItem('username') || localStorage.getItem('userName') || 'Master Platform Admin';
        const wsUserId = String(localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid') || (typeof App !== 'undefined' && App.State && App.State.userId) || '').trim().replace(/^#/, '');

        const payload = {
            title: title,
            message: message,
            narration: message,
            route: route,
            tab: tab,
            author: author,
            priority: priority,
            category: category,
            timestamp: Date.now()
        };

        try {
            if (typeof firebase !== 'undefined' && firebase.database) {
                const db = firebase.database();
                await db.ref('PlatformMaster/Promotions').push(payload);
                await db.ref('PlatformMaster/Broadcasts').push(payload);
                await db.ref('Utilities/Broadcasts').push(payload);
                if (wsUserId) {
                    await db.ref(`${wsUserId}/PlatformMaster/Broadcasts`).push(payload);
                    await db.ref(`${wsUserId}/Utilities/Broadcasts`).push(payload);
                }
            }
            const modalEl = document.getElementById('adminBroadcastModal');
            if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            if (typeof App !== 'undefined' && App.UI && typeof App.UI.Notify === 'function') {
                App.UI.Notify('Broadcast Published', 'Announcement broadcasted to all workspace users with direct deep-links.', 'success');
            } else {
                alert('Broadcast published successfully.');
            }
        } catch (err) {
            console.error('Broadcast failed:', err);
            alert('Failed to publish broadcast: ' + err.message);
        }
    },

    Render() {
        const bcBtn = document.getElementById('btnAdminBroadcast');
        if (bcBtn) {
            bcBtn.style.display = this.IsMasterAdmin() ? 'inline-block' : 'none';
        }

        const listEl = document.getElementById('notificationList');
        if (!listEl) return;

        const readSet = this._readSet || new Set();
        // Latest-first presentation (authoritative sort by generated timestamp)
        const items = (this._items || []).slice().sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
        const unreadItems = items.filter(it => !readSet.has(it.id));
        this._unreadCount = unreadItems.length;
        this._UpdateBellIndicator(this._unreadCount);

        if (items.length === 0) {
            listEl.innerHTML = `
                <div class="text-center p-3 text-muted small" id="emptyNotificationMessage">
                    <i class="bi bi-bell-slash d-block fs-4 text-muted mb-1"></i> No broadcasts or pending approvals
                </div>
            `;
            return;
        }

        const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        let html = '';
        items.forEach(item => {
            const isRead = readSet.has(item.id);
            const targetHref = item.link || ('#/' + (item.route || 'dashboard'));
            
            // Entire div of single notification acts as an anchor tag; no inner buttons or badges
            html += `
                <a href="${esc(targetHref)}" 
                   class="dropdown-item p-2 border-bottom text-decoration-none d-block notification-anchor-item ${isRead ? 'opacity-75' : 'bg-light bg-opacity-25'}" 
                   style="cursor: pointer; transition: background 0.15s, opacity 0.15s; white-space: normal;"
                   onclick="NotificationEngine.OpenNotice('${esc(item.route || '')}', '${esc(item.tab || '')}', '${esc(item.link || '')}', event, '${esc(item.id || '')}')">
                    <div class="d-flex align-items-start gap-2 h-100">
                        <i class="bi ${esc(item.icon || 'bi-bell-fill')} fs-5 mt-1 flex-shrink-0"></i>
                        <div class="flex-grow-1 overflow-hidden d-flex flex-column justify-content-center">
                            <div class="d-flex justify-content-between align-items-baseline">
                                <span class="fw-bold text-dark text-truncate d-block" style="font-size: 12px;">${esc(item.title)}</span>
                                <span class="text-muted font-mono ms-2 flex-shrink-0" style="font-size: 10px;">${esc(item.time)}</span>
                            </div>
                            <div class="text-secondary small mt-1 notification-anchor-subtitle">${esc(item.subtitle)}</div>
                        </div>
                    </div>
                </a>
            `;
        });
        listEl.innerHTML = html;
    }
};
const BrowserNotificationEngine = {
    Init() {
        // Browser notification engine hook
    }
};

// Auto-boot: immediate if DOM is already parsed, or listen for DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.Init());
} else {
    App.Init();
}

window.App = App;

