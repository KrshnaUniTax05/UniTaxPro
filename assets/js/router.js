/**
 * UNITAX PRO - Centralized Application Router & Navigation Engine
 * Architecture: Hash-Based URL Routing (GitHub Pages Native), Deep Linking,
 * Route Guards, Breadcrumb Generation, and State Preservation across Refreshes.
 */

const UniTaxRouter = {
    /**
     * ROUTE REGISTRY
     * Maps canonical route URLs to module files, business metadata, and access rules
     */
    Routes: {
        // --- OVERVIEW ---
        'dashboard': {
            path: 'modules/dashboard.html',
            title: 'Financial Overview',
            category: 'Overview',
            icon: 'bi-speedometer2',
            permission: 'reports'
        },

        // --- FINANCIAL MANAGEMENT & STATEMENTS (Requirement #8) ---
        'reports/gl-statement': {
            path: 'modules/reports/gl-statement.html',
            title: 'General Ledger Statement',
            category: 'Financial Statements',
            icon: 'bi-journal-text',
            permission: 'reports'
        },
        'reports/balance-sheet': {
            path: 'modules/reports/balance-sheet.html',
            title: 'Balance Sheet Statement',
            category: 'Financial Statements',
            icon: 'bi-bank',
            permission: 'reports'
        },
        'reports/profit-loss': {
            path: 'modules/reports/profit-loss.html',
            title: 'Profit & Loss Statement (P&L)',
            category: 'Financial Statements',
            icon: 'bi-graph-up-arrow',
            permission: 'reports'
        },
        'reports/trial-balance': {
            path: 'modules/reports/trial-balance.html',
            title: 'Trial Balance',
            category: 'Financial Statements',
            icon: 'bi-calculator',
            permission: 'reports'
        },
        'reports/cash-flow': {
            path: 'modules/reports/cash-flow.html',
            title: 'Cash Flow Statement',
            category: 'Financial Statements',
            icon: 'bi-currency-exchange',
            permission: 'reports'
        },
        'reports/statutory': {
            path: 'modules/reports/statutory.html',
            title: 'Statutory & Tax Returns',
            category: 'Financial Statements',
            icon: 'bi-file-earmark-check',
            permission: 'reports'
        },
        'reports/reconcilation': {
            path: 'modules/reports/reconcilation.html',
            title: 'Account Reconciliation',
            category: 'Financial Statements',
            icon: 'bi-check2-circle',
            permission: 'reports'
        },

        // --- ACCOUNTS RECEIVABLE & SALES ---
        'transactions/sales-inv': {
            path: 'modules/transactions/sales-inv.html',
            title: 'Sales Tax Invoice',
            category: 'Accounts Receivable',
            icon: 'bi-receipt',
            permission: 'transactions'
        },
        'transactions/salesret-inv': {
            path: 'modules/transactions/salesret-inv.html',
            title: 'Credit Note / Sales Return',
            category: 'Accounts Receivable',
            icon: 'bi-arrow-return-left',
            permission: 'transactions'
        },

        // --- ACCOUNTS PAYABLE & PURCHASES ---
        'transactions/purchase-inv': {
            path: 'modules/transactions/purchase-inv.html',
            title: 'Purchase Voucher',
            category: 'Accounts Payable',
            icon: 'bi-bag-check',
            permission: 'transactions'
        },
        'transactions/purchaseret-inv': {
            path: 'modules/transactions/purchaseret-inv.html',
            title: 'Debit Note / Purchase Return',
            category: 'Accounts Payable',
            icon: 'bi-arrow-return-right',
            permission: 'transactions'
        },

        // --- BANKING & CASH ---
        'transactions/receipt-vch': {
            path: 'modules/transactions/receipt-vch.html',
            title: 'Receipt Voucher',
            category: 'Banking & Cash',
            icon: 'bi-cash-coin',
            permission: 'transactions'
        },
        'transactions/payment-vch': {
            path: 'modules/transactions/payment-vch.html',
            title: 'Payment Voucher',
            category: 'Banking & Cash',
            icon: 'bi-credit-card-2-front',
            permission: 'transactions'
        },
        'transactions/receipt-pay': {
            path: 'modules/transactions/receipt-vch.html',
            title: 'Receipt Voucher',
            category: 'Banking & Cash',
            icon: 'bi-cash-coin',
            permission: 'transactions'
        },

        // --- MASTER DATA MANAGEMENT ---
        'masters/ledger-cw': {
            path: 'modules/masters/ledger-cw.html',
            title: 'Ledger Creation',
            category: 'Masters',
            icon: 'bi-person-plus',
            permission: 'masters'
        },
        'masters/ledger-list': {
            path: 'modules/masters/ledger-list.html',
            title: 'Ledgers Directory',
            category: 'Masters',
            icon: 'bi-people',
            permission: 'masters'
        },
        'masters/stock-cw': {
            path: 'modules/masters/stock-cw.html',
            title: 'Stock Item Creation',
            category: 'Masters',
            icon: 'bi-box-seam',
            permission: 'masters'
        },
        'masters/stock-list': {
            path: 'modules/masters/stock-list.html',
            title: 'Inventory Registry',
            category: 'Masters',
            icon: 'bi-boxes',
            permission: 'masters'
        },
        'masters/company-cw': {
            path: 'modules/masters/company-cw.html',
            title: 'Company Creation',
            category: 'Masters',
            icon: 'bi-building-add',
            permission: 'masters'
        },
        'masters/company-list': {
            path: 'modules/masters/company-list.html',
            title: 'Company Registry',
            category: 'Masters',
            icon: 'bi-building',
            permission: 'masters'
        },
        'masters/project-cw': {
            path: 'modules/masters/project-cw.html',
            title: 'Project / Profit Center Creation',
            category: 'Masters',
            icon: 'bi-kanban',
            permission: 'masters'
        },
        'masters/project-list': {
            path: 'modules/masters/project-list.html',
            title: 'Profit Center Registry',
            category: 'Masters',
            icon: 'bi-diagram-3',
            permission: 'masters'
        },
        'reports/mastermanager': {
            path: 'modules/reports/mastermanager.html',
            title: 'Master Data Manager',
            category: 'Masters',
            icon: 'bi-pencil-square',
            permission: 'masters'
        },

        // --- GOVERNANCE & OPERATIONS ---
        'reports/approvalmanagementsystem': {
            path: 'modules/reports/approvalmanagementsystem.html',
            title: 'Governance & Approvals',
            category: 'Governance',
            icon: 'bi-shield-check',
            permission: 'governance'
        },
        'transactions/mgrtaskassignment': {
            path: 'modules/transactions/mgrtaskassignment.html',
            title: 'Task Assignment',
            category: 'Governance',
            icon: 'bi-list-task',
            permission: 'governance'
        },
        'transactions/edit': {
            path: 'modules/transactions/edit.html',
            title: 'Transaction Audit & Detail View',
            category: 'Governance',
            icon: 'bi-eye'
        },

        // --- TAXATION & COMPLIANCE ---
        'reports/gstr1': {
            path: 'modules/reports/gstr1.html',
            title: 'GSTR-1 Outward Supplies',
            category: 'Taxation & Compliance',
            icon: 'bi-file-earmark-spreadsheet',
            permission: 'taxation'
        },
        'reports/inventoryreturn': {
            path: 'modules/reports/inventoryreturn.html',
            title: 'Stock Valuation & Return',
            category: 'Taxation & Compliance',
            icon: 'bi-archive',
            permission: 'reports'
        },

        // --- ADMINISTRATION & UTILITIES ---
        'utilities/useradmincontrolpanel': {
            path: 'modules/utilities/useradmincontrolpanel.html',
            title: 'User Administration Control Panel',
            category: 'Administration',
            icon: 'bi-shield-lock-fill',
            permission: 'admin'
        },
        'settings': {
            path: 'modules/settings.html',
            title: 'System Settings',
            category: 'Utilities',
            icon: 'bi-gear-wide-connected',
            permission: 'all'
        },
        'utilities/notification': {
            path: 'modules/utilities/notification.html',
            title: 'Notification Center',
            category: 'Utilities',
            icon: 'bi-bell',
            permission: 'all'
        },
        'utilities/profile': {
            path: 'modules/utilities/profile.html',
            title: 'User Profile & Identity',
            category: 'Utilities',
            icon: 'bi-person-badge',
            permission: 'all'
        },
        'utilities/aboutus': {
            path: 'modules/utilities/aboutus.html',
            title: 'About UniTax Pro',
            category: 'Utilities',
            icon: 'bi-info-circle',
            permission: 'all'
        },
        'help': {
            path: 'modules/help/article.html',
            title: 'Help Center & Tutorials',
            category: 'Help Center',
            icon: 'bi-question-circle',
            permission: 'all'
        },
        'help/article': {
            path: 'modules/help/article.html',
            title: 'Tutorial & Knowledge Base',
            category: 'Help Center',
            icon: 'bi-book-half',
            permission: 'all'
        },
        'help/knowledgebase': {
            path: 'modules/help/article.html',
            title: 'Help Center & Tutorials',
            category: 'Help Center',
            icon: 'bi-question-circle',
            permission: 'all'
        }
    },

    currentRoute: null,
    currentParams: {},
    _lastParamsKey: null,
    _isInitialized: false,
    _isLoading: false,

    /**
     * INITIALIZE ROUTER
     * Binds hashchange listeners, handles direct route on page refresh
     */
    Init() {
        if (this._isInitialized) return;
        this._isInitialized = true;

        window.addEventListener('hashchange', () => this.HandleHashChange());

        // Process initial URL hash or fallback to dashboard
        const initialHash = window.location.hash.replace(/^#\/?/, '').trim();
        if (initialHash) {
            this.Navigate(initialHash, false);
        } else {
            const pinned = localStorage.getItem('pinnedModule') || 'dashboard';
            this.Navigate(pinned, true);
        }

        // Global delegate for [data-route] and [data-module] clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-route], [data-module]');
            if (link) {
                e.preventDefault();
                const route = link.dataset.route || link.dataset.module;
                if (route) {
                    this.Navigate(route);
                }
            }
        });

        console.log("%c🧭 [UniTaxRouter] Enterprise Router Synchronized", "color: #0d6efd; font-weight: bold;");
    },

    /**
     * Programmatic Navigation
     */
    Navigate(routeString, replaceHash = false) {
        if (!routeString) return;
        const cleanRoute = routeString.replace(/^#\/?/, '').trim();
        const targetHash = `#/${cleanRoute}`;

        // Deduplicate: If already on target route and not loading, do not trigger duplicate module reload
        if (this.currentRoute === cleanRoute && window.location.hash === targetHash && !this._isLoading) {
            return;
        }

        if (window.location.hash !== targetHash) {
            if (replaceHash) {
                history.replaceState(null, '', targetHash);
                this.HandleHashChange();
            } else {
                window.location.hash = targetHash;
            }
        } else {
            this.HandleHashChange();
        }
    },

    /**
     * Process Route on Hash Change
     */
    async HandleHashChange() {
        const rawHash = window.location.hash.replace(/^#\/?/, '').trim() || 'dashboard';
        const [cleanPath, queryString] = rawHash.split('?');

        // Parse query params
        const params = {};
        if (queryString) {
            new URLSearchParams(queryString).forEach((val, key) => {
                params[key] = val;
            });
        }
        this.currentParams = params;

        // Route Guard: Authentication Check (Bypass for Help Center & Tutorials: everyone can view, read, and access without restriction)
        const isHelpRoute = cleanPath.startsWith('help') || cleanPath.includes('help');
        const userId = localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid') || localStorage.getItem('currentUser') || localStorage.getItem('userEmail');
        if (!isHelpRoute && !userId && !window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
            return;
        }

        // Route Guard: Permission Check (Universal view access for help pages and transactions/edit)
        if (!isHelpRoute && cleanPath !== 'transactions/edit' && window.UniTaxAuth && typeof UniTaxAuth.CanAccessModule === 'function') {
            if (!UniTaxAuth.CanAccessModule(cleanPath)) {
                if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                    App.UI.Notify('Access Denied', `You do not have permission to view [${cleanPath}].`, 'danger');
                }
                this.RenderAccessDenied(cleanPath);
                return;
            }
        }   

        // Deduplicate: Prevent redundant re-execution if already on this exact clean route with identical query params
        const paramKey = JSON.stringify(params || {});
        if (this.currentRoute === cleanPath && this._lastParamsKey === paramKey && !this._isLoading && !params._force) {
            return;
        }

        await this.LoadModule(cleanPath, params);
    },

    /**
     * Load Module HTML and inject into viewport
     */
    async LoadModule(routePath, params = {}) {
        const viewport = document.getElementById('main-content');
        const loader = document.getElementById('section-loader');

        if (!viewport) return;
        
        // Prevent concurrent duplicate loads of the same route
        if (this._isLoading && this._loadingRoute === routePath) return;
        
        // Prevent reload if already active on this route with identical parameters unless forced
        const paramKey = JSON.stringify(params || {});
        if (this.currentRoute === routePath && this._lastParamsKey === paramKey && !this._isLoading && !params._force) return;

        this._isLoading = true;
        this._loadingRoute = routePath;
        this._lastParamsKey = paramKey;

        const routeDef = this.Routes[routePath] || {
            path: `modules/${routePath}.html`,
            title: routePath,
            category: 'Workspace'
        };

        if (loader) loader.style.display = 'flex';
        viewport.style.opacity = '0.4';

        try {
            const response = await fetch(routeDef.path);
            if (!response.ok) {
                throw new Error(`Module file not found: ${routeDef.path} (HTTP ${response.status})`);
            }

            const html = await response.text();
            viewport.innerHTML = html;
            this.currentRoute = routePath;

            // Safe script re-execution
            const scripts = viewport.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                if (oldScript.src) {
                    newScript.src = oldScript.src;
                } else {
                    newScript.textContent = oldScript.textContent;
                }
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            // Trigger module ready custom event
            try {
                document.dispatchEvent(new CustomEvent('moduleReady', { detail: { route: routePath } }));
            } catch (evErr) {}

            // Update UI State: Title, Breadcrumbs, Active Sidebar link
            this.UpdateNavigationUI(routePath, routeDef);

            // Trigger ERP form lookups & uniqueness
            if (typeof App !== 'undefined' && App.InitERPLogic) {
                App.InitERPLogic(routePath);
            }

            // Uniqueness Checker auto-init
            if (window.UniquenessChecker && window.UniquenessChecker.init) {
                window.UniquenessChecker.init(viewport);
            }

            // Save previous route
            localStorage.setItem('PreviousPath', routePath);

        } catch (error) {
            console.error("Router load failure:", error);
            this.Render404(routePath, error.message);
        } finally {
            this._isLoading = false;
            this._loadingRoute = null;
            if (loader) loader.style.display = 'none';
            viewport.style.opacity = '1';
        }
    },

    /**
     * Update Breadcrumbs, Top Title & Sidebar Active Menu
     */
    UpdateNavigationUI(routePath, routeDef) {
        // 1. Bottom Breadcrumbs (Requirement #4)
        const catEl = document.getElementById('bottomCategoryName');
        const modEl = document.getElementById('bottomModuleName');
        if (catEl) catEl.innerText = routeDef.category || 'Workspace';
        if (modEl) modEl.innerText = routeDef.title || 'Overview';

        const topBreadcrumb = document.getElementById('topNavBreadcrumb');
        if (topBreadcrumb) {
            topBreadcrumb.innerHTML = `
                <li class="breadcrumb-item"><a href="#/dashboard" class="text-decoration-none text-muted">Home</a></li>
                <li class="breadcrumb-item text-muted">${Utils.EscapeHTML(routeDef.category || 'Workspace')}</li>
                <li class="breadcrumb-item active fw-bold text-primary" aria-current="page">${Utils.EscapeHTML(routeDef.title)}</li>
            `;
        }

        // 2. Active Sidebar link
        document.querySelectorAll('[data-route], [data-module]').forEach(el => {
            const elRoute = el.dataset.route || el.dataset.module;
            const isActive = elRoute === routePath;
            el.classList.toggle('active', isActive);
            if (isActive) {
                el.classList.add('bg-primary-subtle', 'text-primary', 'fw-bold');
            } else {
                el.classList.remove('bg-primary-subtle', 'text-primary', 'fw-bold');
            }
        });

        // 3. Document Title
        document.title = `${routeDef.title} | UniTax Pro`;
    },

    Render404(routePath, message) {
        const viewport = document.getElementById('main-content');
        if (viewport) {
            viewport.innerHTML = `
            <div class="card border-0 shadow-sm p-5 text-center my-4">
                <i class="bi bi-compass display-1 text-muted opacity-50 mb-3"></i>
                <h3 class="fw-bold text-dark">Route Not Found</h3>
                <p class="text-muted small">Could not locate resource for route <code>#/${Utils.EscapeHTML(routePath)}</code></p>
                <div class="alert alert-light border d-inline-block mx-auto text-start small font-mono">
                    ${Utils.EscapeHTML(message)}
                </div>
                <div class="mt-4">
                    <button class="btn btn-primary btn-sm px-4 fw-bold" onclick="UniTaxRouter.Navigate('dashboard')">
                        <i class="bi bi-house me-1"></i> Return to Dashboard
                    </button>
                </div>
            </div>`;
        }
    },

    RenderAccessDenied(routePath) {
        const viewport = document.getElementById('main-content');
        if (viewport) {
            viewport.innerHTML = `
            <div class="access-denied-page d-flex flex-column justify-content-center align-items-center text-center h-100 w-100 m-0 p-4">
                <i class="bi bi-shield-x display-1 text-danger opacity-75 mb-3"></i>
                <h3 class="fw-bold text-dark mb-2">Access Restricted</h3>
                <p class="text-muted small mb-2">Your assigned role does not permit access to <code class="px-2 py-1 bg-light border rounded">#/${Utils.EscapeHTML(routePath)}</code>.</p>
                <p class="text-muted small mb-4">Contact your workspace administrator to request permission.</p>
                <div>
                    <button class="btn btn-primary btn-sm px-4 fw-bold" onclick="UniTaxRouter.Navigate('dashboard')">
                        <i class="bi bi-house me-1"></i> Return to Dashboard
                    </button>
                </div>
            </div>`;
        }
    }
};

window.UniTaxRouter = UniTaxRouter;
