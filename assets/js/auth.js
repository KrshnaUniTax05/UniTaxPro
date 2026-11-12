/**
 * UNITAX PRO - Enterprise Role-Based Access Control (RBAC) & Audit System
 * Enforces: Multi-Tier Matrix (Module, Action, Data Scope, Field Level) + Audit Logging
 */

const UniTaxAuth = {
    /**
     * STANDARD ROLE DEFINITION TEMPLATES
     */
    RoleTemplates: {
        'super_administrator': {
            name: 'Super Administrator',
            description: 'Full unconstrained platform & system control',
            modules: ['all'],
            actions: ['create', 'read', 'update', 'delete', 'post', 'approve', 'reject', 'export', 'print', 'admin', 'view_metadata'],
            dataScope: 'all',
            canPostDirectly: true,
            canApprove: true,
            sensitiveFields: { showFinancialAmounts: true, showProfitMargins: true, showBankAccounts: true }
        },
        'administrator': {
            name: 'Administrator',
            description: 'Full workspace operations & user management control',
            modules: ['all'],
            actions: ['create', 'read', 'update', 'delete', 'post', 'approve', 'reject', 'export', 'print', 'admin', 'view_metadata'],
            dataScope: 'all',
            canPostDirectly: true,
            canApprove: true,
            sensitiveFields: { showFinancialAmounts: true, showProfitMargins: true, showBankAccounts: true }
        },
        'co_useradmin': {
            name: 'Co-User Admin',
            description: 'Workspace administration and team management co-pilot',
            modules: ['all'],
            actions: ['create', 'read', 'update', 'delete', 'post', 'approve', 'reject', 'export', 'print', 'admin', 'view_metadata'],
            dataScope: 'all',
            canPostDirectly: true,
            canApprove: true,
            sensitiveFields: { showFinancialAmounts: true, showProfitMargins: true, showBankAccounts: true }
        },
        'co_admin': {
            name: 'Co-User Admin',
            description: 'Workspace administration and team management co-pilot',
            modules: ['all'],
            actions: ['create', 'read', 'update', 'delete', 'post', 'approve', 'reject', 'export', 'print', 'admin', 'view_metadata'],
            dataScope: 'all',
            canPostDirectly: true,
            canApprove: true,
            sensitiveFields: { showFinancialAmounts: true, showProfitMargins: true, showBankAccounts: true }
        },
        'manager': {
            name: 'Manager / Senior Accountant',
            description: 'Operations, Vouchers, Ledger Statements, and Approvals',
            modules: ['masters', 'transactions', 'reports', 'governance', 'taxation'],
            actions: ['create', 'read', 'update', 'post', 'approve', 'reject', 'export', 'print', 'view_metadata'],
            dataScope: 'all',
            canPostDirectly: true,
            canApprove: true,
            sensitiveFields: { showFinancialAmounts: true, showProfitMargins: true, showBankAccounts: true }
        },
        'operator': {
            name: 'Data Entry Operator',
            description: 'Draft voucher creation and basic entry (requires review)',
            modules: ['masters', 'transactions', 'reports'],
            actions: ['create', 'read', 'update', 'print'],
            dataScope: 'own',
            canPostDirectly: false,
            canApprove: false,
            sensitiveFields: { showFinancialAmounts: true, showProfitMargins: false, showBankAccounts: false }
        },
        'approver': {
            name: 'Financial Approver',
            description: 'Review and authorization of transactions and vouchers',
            modules: ['transactions', 'reports', 'governance'],
            actions: ['read', 'approve', 'reject', 'print', 'view_metadata'],
            dataScope: 'all',
            canPostDirectly: false,
            canApprove: true,
            sensitiveFields: { showFinancialAmounts: true, showProfitMargins: true, showBankAccounts: true }
        },
        'viewer': {
            name: 'Restricted Viewer',
            description: 'Read-only visibility without modification powers',
            modules: ['reports', 'masters'],
            actions: ['read', 'print'],
            dataScope: 'all',
            canPostDirectly: false,
            canApprove: false,
            sensitiveFields: { showFinancialAmounts: false, showProfitMargins: false, showBankAccounts: false }
        },
        'auditor': {
            name: 'Statutory Auditor',
            description: 'Compliance & audit examination (read-only + export)',
            modules: ['reports', 'masters', 'transactions', 'taxation', 'governance'],
            actions: ['read', 'export', 'print', 'view_metadata'],
            dataScope: 'all',
            canPostDirectly: false,
            canApprove: false,
            sensitiveFields: { showFinancialAmounts: true, showProfitMargins: true, showBankAccounts: true }
        },
        'custom': {
            name: 'Custom Defined Role',
            description: 'Custom security profile with tailored granular matrix permissions',
            modules: [],
            actions: ['create', 'read'],
            dataScope: 'own',
            canPostDirectly: false,
            canApprove: false,
            sensitiveFields: { showFinancialAmounts: true, showProfitMargins: false, showBankAccounts: false }
        }
    },

    /**
     * Get active user's effective permissions
     */
    GetEffectivePermissions() {
        const rawRole = (localStorage.getItem('userrole') || 'user').toLowerCase().replace(/\s+/g, '_');
        const template = this.RoleTemplates[rawRole] || this.RoleTemplates['operator'] || this.RoleTemplates['viewer'];
        
        let customOverrides = {};
        try {
            const raw = localStorage.getItem('userPermissionsOverride');
            if (raw) customOverrides = JSON.parse(raw);
        } catch (e) {}

        const canPostDirectLocal = localStorage.getItem('canPostDirect');
        const effectiveCanPostDirect = canPostDirectLocal !== null 
            ? (canPostDirectLocal === 'true') 
            : (customOverrides.canPostDirectly ?? template.canPostDirectly);

        const canViewMetadataLocal = localStorage.getItem('canViewMetadata');
        const effectiveCanViewMetadata = canViewMetadataLocal !== null
            ? (canViewMetadataLocal === 'true')
            : (customOverrides.canViewMetadata ?? (template.actions && template.actions.includes('view_metadata')));

        const effectiveActions = customOverrides.actions || template.actions || [];
        const hasApproveAction = effectiveActions.includes('approve');

        return {
            role: rawRole,
            roleName: customOverrides.customRoleName || customOverrides.roleTitle || template.name,
            modules: customOverrides.modules || template.modules,
            actions: effectiveActions,
            dataScope: customOverrides.dataScope || template.dataScope,
            canPostDirectly: effectiveCanPostDirect,
            canApprove: hasApproveAction,
            canReject: effectiveActions.includes('reject'),
            canDelete: effectiveActions.includes('delete'),
            canUpdate: effectiveActions.includes('update') || effectiveActions.includes('edit'),
            canViewMetadata: effectiveCanViewMetadata,
            postingLimit: parseFloat(localStorage.getItem('postingLimit')) || 0,
            canBackdate: localStorage.getItem('canBackdate') === 'true',
            allowedProfitCenter: localStorage.getItem('allowedProfitCenter') || customOverrides.allowedProfitCenter || '*',
            allowedLedger: localStorage.getItem('allowedLedger') || customOverrides.allowedLedger || '*',
            assignedManagerId: localStorage.getItem('assignedManagerId') || '',
            assignedManagerName: localStorage.getItem('assignedManagerName') || '',
            allowedDateFrom: customOverrides.allowedDateFrom || localStorage.getItem('allowedDateFrom') || '',
            allowedDateTo: customOverrides.allowedDateTo || localStorage.getItem('allowedDateTo') || '',
            enforceDateRange: customOverrides.enforceDateRange === true || localStorage.getItem('enforceDateRange') === 'true',
            sensitiveFields: {
                ...template.sensitiveFields,
                ...(customOverrides.sensitiveFields || {})
            },
            fieldRestrictions: customOverrides.fieldRestrictions || []
        };
    },

    /**
     * Live permission synchronisation for the signed-in user.
     * Keeps the browser cache in lock-step with the permission matrix saved by an administrator.
     */
    async SyncLivePermissions() {
        try {
            if (typeof firebase === 'undefined' || !firebase.database) return false;
            const wsId = String((typeof App !== 'undefined' && App.State && App.State.userId) || localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid') || '').trim();
            const userId = String((typeof App !== 'undefined' && App.State && App.State.currentuserId) || localStorage.getItem('userloginid') || '').trim();
            if (!wsId || !userId) return false;

            const db = firebase.database();
            const read = (path) => db.ref(path).once('value').then(s => s.val()).catch(() => null);

            const isMember = userId !== wsId;
            const [memberRec, topRec] = await Promise.all([
                isMember ? read(`Users/${wsId}/workspace/Members/${userId}`) : Promise.resolve(null),
                read(`Users/${userId}`)
            ]);

            const source = (memberRec && typeof memberRec === 'object') ? memberRec : (topRec || {});
            const perms = (source.permissions && typeof source.permissions === 'object') ? source.permissions : null;

            const setIfDefined = (storageKey, value, stringifyBoolean) => {
                if (value === undefined || value === null || value === '') return;
                localStorage.setItem(storageKey, stringifyBoolean ? String(value === true || value === 'true') : String(value));
            };

            if (perms) {
                localStorage.setItem('userPermissionsOverride', JSON.stringify(perms));
                const actions = Array.isArray(perms.actions) ? perms.actions : [];
                localStorage.setItem('userCanApprove', String(actions.includes('approve')));
                localStorage.setItem('userCanReject', String(actions.includes('reject')));
                if (perms.allowedDateFrom !== undefined) localStorage.setItem('allowedDateFrom', perms.allowedDateFrom || '');
                if (perms.allowedDateTo !== undefined) localStorage.setItem('allowedDateTo', perms.allowedDateTo || '');
                if (perms.enforceDateRange !== undefined) localStorage.setItem('enforceDateRange', String(perms.enforceDateRange === true));
            }

            setIfDefined('postingLimit', source.postingLimit);
            setIfDefined('canPostDirect', source.canPostDirect, true);
            setIfDefined('canBackdate', source.canBackdate, true);
            setIfDefined('allowedProfitCenter', source.allowedProfitCenter);
            setIfDefined('allowedLedger', source.allowedLedger);
            setIfDefined('assignedManagerId', source.assignedManagerId);
            setIfDefined('assignedManagerName', source.assignedManagerName);

            if (source.voucherApprovalFlow && Array.isArray(source.voucherApprovalFlow)) {
                localStorage.setItem('userVoucherApprovalFlow', JSON.stringify(source.voucherApprovalFlow));
            }

            return true;
        } catch (e) {
            console.warn('[RBAC] Live permission sync skipped:', e);
            return false;
        }
    },

    /**
     * Check if user can access a module route
     */
    CanAccessModule(routePath) {
        if (!routePath) return true;
        const clean = routePath.toLowerCase().replace(/^\/+/, '').split('?')[0].trim();
        const perms = this.GetEffectivePermissions();

        // Admin & Co-User Admin override (strict check: non-admin roles cannot be bypassed by stale masterControl)
        const role = String(perms.role || '').toLowerCase();
        const isAdminRole = ['super_administrator', 'administrator', 'co_useradmin', 'co_admin'].includes(role);
        const isNonAdminRole = ['operator', 'viewer', 'auditor', 'accountant'].includes(role);
        if (isAdminRole || (!isNonAdminRole && localStorage.getItem('masterControl') === 'administration')) {
            return true;
        }

        // Whitelisted universal routes (every user can access dashboard, settings, profile, and view entries in edit.html)
        if (clean === 'dashboard') return true;
        if (clean.startsWith('settings')) return true;
        if (clean.startsWith('utilities/profile') || clean.startsWith('utilities/notification') || clean.startsWith('utilities/aboutus')) return true;
        if (clean === 'transactions/edit' || clean.startsWith('transactions/edit')) return true;
        if (clean === 'help/article' || clean.startsWith('help/article')) return true;
        if (clean.startsWith('help') || clean.includes('help')) return true;
        if (clean.startsWith('help') || clean.startsWith('help/')) return true;
        // Admin Panel restricted to administrators
        if (clean.startsWith('utilities/useradmin')) {
            return perms.role === 'administrator' || perms.role === 'co_useradmin' || perms.role === 'co_admin' || perms.actions.includes('admin');
        }

        // Universal wildcard
        if (perms.modules.includes('all')) return true;

        // Exact canonical route match (e.g. 'transactions/purchase-inv', 'reports/balance-sheet')
        if (perms.modules.includes(clean)) return true;

        // Category wildcard match (e.g. 'transactions', 'masters', 'reports', 'governance', 'taxation', 'utilities')
        const category = clean.split('/')[0];
        if (perms.modules.includes(category)) return true;

        return false;
    },

    /**
     * Check if user can perform a specific operation
     */
    CanPerformAction(actionName) {
        const perms = this.GetEffectivePermissions();
        if (perms.role === 'super_administrator' || perms.role === 'administrator' || perms.role === 'co_useradmin' || perms.role === 'co_admin') return true;
        const norm = (actionName || '').toLowerCase().trim();
        if (norm === 'edit' || norm === 'update') return perms.actions.includes('update') || perms.actions.includes('edit');
        if (norm === 'view' || norm === 'read') return perms.actions.includes('read') || perms.actions.includes('view');
        if (norm === 'view_metadata' || norm === 'inspect_metadata' || norm === 'metadata') {
            return perms.canViewMetadata || perms.actions.includes('view_metadata') || perms.actions.includes('admin') || perms.role === 'administrator';
        }
        return perms.actions.includes(norm);
    },

    /**
     * Check if user can view a sensitive field
     */
    CanViewField(fieldName) {
        const perms = this.GetEffectivePermissions();
        if (perms.role === 'super_administrator' || perms.role === 'administrator' || perms.role === 'co_useradmin' || perms.role === 'co_admin') return true;
        return !!perms.sensitiveFields[fieldName];
    }
};

/**
 * Enterprise Audit Logger
 */
const UniTaxAudit = {
    async Log(entry) {
        const workspaceUserId = (typeof App !== 'undefined' && App.State && App.State.userId)
            ? App.State.userId
            : localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');

        if (!workspaceUserId) return;

        const currentUserId = (typeof App !== 'undefined' && App.State)
            ? App.State.currentuserId
            : localStorage.getItem('userloginid') || 'unknown';

        const currentUserName = (typeof App !== 'undefined' && App.State)
            ? App.State.userName
            : localStorage.getItem('userName') || 'User';

        const auditPayload = {
            timestamp: (typeof firebase !== 'undefined' && firebase.database && firebase.database.ServerValue) 
                ? firebase.database.ServerValue.TIMESTAMP 
                : Date.now(),
            actorId: currentUserId,
            actorName: currentUserName,
            action: entry.action || 'INFO',
            module: entry.module || 'System',
            recordId: entry.recordId || '',
            details: entry.details || '',
            outcome: entry.outcome || 'SUCCESS',
            userAgent: navigator.userAgent.substring(0, 120)
        };

        try {
            if (typeof firebase !== 'undefined' && firebase.database) {
                await firebase.database().ref(`${workspaceUserId}/AuditLogs`).push(auditPayload);
            }
        } catch (e) {
            console.warn("Audit logging non-critical failure:", e);
        }
    },

    async FetchLogs(limit = 100) {
        const workspaceUserId = (typeof App !== 'undefined' && App.State && App.State.userId)
            ? App.State.userId
            : localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');

        if (!workspaceUserId) return [];

        try {
            if (typeof firebase !== 'undefined' && firebase.database) {
                const snap = await firebase.database().ref(`${workspaceUserId}/AuditLogs`)
                    .limitToLast(limit)
                    .once('value');

                const val = snap.val();
                if (!val) return [];

                return Object.entries(val).map(([id, item]) => ({ ID: id, ...item })).reverse();
            }
            return [];
        } catch (e) {
            console.error("Error fetching audit logs:", e);
            return [];
        }
    }
};

/**
 * CENTRAL OPERATIONS WRITE-GUARD
 * Blocks voucher / approval document writes while the platform, the workspace,
 * or the signed-in user is inside an active suspension window.
 *
 * Suspension window = [suspensionFrom, suspensionUntil)
 *  - suspensionFrom missing  -> suspension is considered active immediately
 *  - suspensionUntil missing -> suspension remains active until explicitly resumed
 */
const UniTaxOperations = {
    _state: {
        loaded: false,
        loadedAt: 0,
        settings: {},
        workspace: {},
        owner: {},
        member: {},
        userId: '',
        wsId: ''
    },
    _listenersInstalled: false,
    _serverOffset: 0,
    _refs: [],

    _now() {
        return Date.now() + (Number(this._serverOffset) || 0);
    },

    _storageKey() {
        return 'unitax_operations_state';
    },

    _ids() {
        const wsId = String(
            (typeof App !== 'undefined' && App.State && App.State.userId) ||
            localStorage.getItem('workspaceUserId') ||
            localStorage.getItem('userloginid') || ''
        ).trim().replace(/^#/, '');
        const userId = String(
            (typeof App !== 'undefined' && App.State && App.State.currentuserId) ||
            localStorage.getItem('userloginid') || wsId || ''
        ).trim().replace(/^#/, '');
        return { wsId, userId };
    },

    _db() {
        if (typeof firebase === 'undefined' || !firebase.database) return null;
        return firebase.database();
    },

    _read(path) {
        const db = this._db();
        if (!db) return Promise.resolve(null);
        return db.ref(path).once('value').then(s => s.val()).catch(() => null);
    },

    _parseTime(value) {
        if (value === undefined || value === null || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const str = String(value).trim();
        if (!str) return null;
        if (/^\d+$/.test(str)) {
            // 12+ digit strings are epoch milliseconds; 8-digit strings are YYYYMMDD.
            if (str.length >= 12) {
                const n = parseInt(str, 10);
                return Number.isFinite(n) ? n : null;
            }
            if (str.length === 8) {
                const y = parseInt(str.slice(0, 4), 10);
                const m = parseInt(str.slice(4, 6), 10) - 1;
                const d = parseInt(str.slice(6, 8), 10);
                const dt = Date.UTC(y, m, d);
                return Number.isNaN(dt) ? null : dt;
            }
        }
        const parsed = Date.parse(str);
        return Number.isNaN(parsed) ? null : parsed;
    },

    /**
     * Persist a snapshot for child pages / reloads before the async refresh completes.
     */
    _persist() {
        try {
            localStorage.setItem(this._storageKey(), JSON.stringify({
                savedAt: Date.now(),
                settings: this._state.settings,
                workspace: this._state.workspace,
                owner: this._state.owner,
                member: this._state.member,
                userId: this._state.userId,
                wsId: this._state.wsId
            }));
        } catch (e) {}
    },

    _hydrate() {
        try {
            const raw = localStorage.getItem(this._storageKey());
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;
            this._state.settings = parsed.settings || {};
            this._state.workspace = parsed.workspace || {};
            this._state.owner = parsed.owner || {};
            this._state.member = parsed.member || {};
            this._state.loaded = true;
        } catch (e) {}
    },

    /**
     * Re-read platform + workspace + user suspension state from Firebase.
     */
    async Refresh(force = false) {
        const db = this._db();
        const { wsId, userId } = this._ids();
        if (!db || !wsId) {
            this._hydrate();
            return this._state;
        }

        if (!force && this._state.loaded && (Date.now() - this._state.loadedAt) < 15000) {
            return this._state;
        }

        const isMember = !!userId && userId !== wsId;

        const [settings, workspaceSettings, ownerRec, memberRec] = await Promise.all([
            this._read('PlatformMaster/Settings/operations'),
            this._read(`Users/${wsId}/workspace/WorkspaceSettings`),
            this._read(`Users/${wsId}`),
            isMember ? this._read(`Users/${wsId}/workspace/Members/${userId}`) : Promise.resolve(null)
        ]);

        this._state.settings = (settings && typeof settings === 'object') ? settings : {};
        this._state.workspace = (workspaceSettings && typeof workspaceSettings === 'object') ? workspaceSettings : {};
        this._state.owner = (ownerRec && typeof ownerRec === 'object') ? ownerRec : {};
        this._state.member = (memberRec && typeof memberRec === 'object') ? memberRec : {};
        this._state.userId = userId;
        this._state.wsId = wsId;
        this._state.loaded = true;
        this._state.loadedAt = Date.now();
        this._persist();
        return this._state;
    },

    _windowFor(record, statusKeys) {
        if (!record || typeof record !== 'object') return null;

        const statuses = statusKeys
            .map(k => record[k])
            .filter(v => v !== undefined && v !== null && v !== '')
            .map(v => String(v).toLowerCase());

        const reasons = {
            maintenance: 'Platform maintenance mode',
            suspended: 'Account suspension',
            inactive: 'Workspace deactivation',
            disabled: 'Account disabled',
            locked: 'Account locked'
        };

        const from = this._parseTime(record.suspensionFrom ?? record.suspendFrom ?? record.suspendedAt ?? record.startAt ?? record.from);
        const until = this._parseTime(record.suspensionUntil ?? record.suspendUntil ?? record.resumeAt ?? record.endAt ?? record.until);
        const statusSuspended = statuses.some(s => ['suspended', 'inactive', 'disabled', 'locked', 'maintenance'].includes(s));
        const statusActive = statuses.length > 0 && statuses.every(s => ['active', 'enabled', 'normal', 'operational', 'resumed'].includes(s));

        if (!statusSuspended && from === null) return null;

        const now = this._now();
        // A stale start timestamp on an explicitly active record must not keep the user locked.
        if (!statusSuspended && statusActive && from !== null && (until === null || until <= now)) return null;

        // Status-only suspension (no explicit start) begins immediately.
        const effectiveFrom = from !== null ? from : (statusSuspended ? now : null);
        if (effectiveFrom !== null && now < effectiveFrom) return null;
        if (until !== null && now >= until) return null;

        return {
            from: effectiveFrom,
            until,
            reason: record.suspensionReason || record.reason || reasons[statuses.find(s => reasons[s])] || 'Operations suspended'
        };
    },

    /**
     * Resolve all active suspension sources for the current session.
     */
    Evaluate() {
        this._hydrate();
        const state = this._state;
        const verdict = {
            suspended: false,
            reason: '',
            from: null,
            until: null,
            source: '',
            maintenance: false,
            workspace: false,
            user: false
        };

        // 1. Platform maintenance mode OR an explicitly configured suspension window
        const ops = state.settings || {};
        const maintenanceFlag = ops.maintenanceMode ?? ops.maintenance ?? ops.enabled;
        const maintenanceEnabled = maintenanceFlag === true || String(maintenanceFlag).toLowerCase() === 'enabled';
        const opsFrom = this._parseTime(ops.suspensionFrom ?? ops.startAt ?? ops.from);
        const opsUntil = this._parseTime(ops.suspensionUntil ?? ops.endAt ?? ops.until);
        // A configured window is authoritative on its own: the exact start/end timestamps
        // must lock writes even when the maintenance toggle was left disabled.
        const windowConfigured = opsFrom !== null || opsUntil !== null;
        if (maintenanceEnabled || windowConfigured) {
            const now = this._now();
            let active = false;
            let effectiveFrom = opsFrom;
            if (maintenanceEnabled) {
                // Explicit maintenance switch is immediate; an end time still releases it.
                active = (opsUntil === null || now < opsUntil);
                if (effectiveFrom === null) effectiveFrom = now;
            } else {
                const start = opsFrom !== null ? opsFrom : now;
                active = now >= start && (opsUntil === null || now < opsUntil);
                effectiveFrom = start;
            }
            if (active) {
                verdict.suspended = true;
                verdict.maintenance = true;
                verdict.source = 'maintenance';
                verdict.from = effectiveFrom;
                verdict.until = opsUntil;
                verdict.reason = ops.suspensionReason || ops.reason || 'Platform maintenance mode is active';
            }
        }

        // 2. Workspace suspension
        const wsWindow = this._windowFor(state.workspace, ['workspaceStatus', 'status'])
            || this._windowFor(state.owner, ['status', 'workspaceStatus']);
        if (wsWindow) {
            verdict.suspended = true;
            verdict.workspace = true;
            if (!verdict.source) {
                verdict.source = 'workspace';
                verdict.reason = wsWindow.reason;
                verdict.from = wsWindow.from;
                verdict.until = wsWindow.until;
            }
        }

        // 3. Signed-in user suspension
        const userWindow = this._windowFor(state.member, ['status'])
            || (state.userId && state.userId === state.wsId ? this._windowFor(state.owner, ['status']) : null);
        if (userWindow) {
            verdict.suspended = true;
            verdict.user = true;
            if (!verdict.source) {
                verdict.source = 'user';
                verdict.reason = userWindow.reason;
                verdict.from = userWindow.from;
                verdict.until = userWindow.until;
            }
        }

        return verdict;
    },

    _formatWindow(verdict) {
        const fmt = (ts) => {
            if (ts === null || ts === undefined) return 'until resumed';
            try {
                return new Date(ts).toLocaleString();
            } catch (e) {
                return String(ts);
            }
        };
        const base = verdict.reason || 'Operations are suspended';
        if (verdict.from || verdict.until) {
            return `${base}. Active ${fmt(verdict.from)} — ${fmt(verdict.until)}.`;
        }
        return `${base}. All create, update and delete operations are locked until resumed.`;
    },

    /**
     * Guard any mutating operation. Returns true when the write is allowed.
     * @param {string} operation - create | update | delete | approve | reject | post | restore
     * @param {string} label - human readable document label for the notification
     */
    AssertWrite(operation = 'update', label = 'document') {
        const verdict = this.Evaluate();
        if (!this._state.loaded) {
            const msg = `Write blocked: authorization state is unavailable while offline. Reconnect and retry this ${operation}.`;
            try {
                if (typeof App !== 'undefined' && App.UI && typeof App.UI.Notify === 'function') {
                    App.UI.Notify('Write Blocked', msg, 'danger');
                } else {
                    alert(msg);
                }
            } catch (e) { console.warn('[OperationsGuard]', msg); }
            return false;
        }
        if (!verdict.suspended) return true;

        const message = `You cannot ${operation} this ${label}. ${this._formatWindow(verdict)}`;
        try {
            if (typeof App !== 'undefined' && App.UI && typeof App.UI.Notify === 'function') {
                App.UI.Notify('Operations Suspended', message, 'danger');
            } else {
                alert(message);
            }
        } catch (e) {
            console.warn('[OperationsGuard]', message);
        }
        try {
            if (window.UniTaxAudit && typeof UniTaxAudit.Log === 'function') {
                UniTaxAudit.Log({
                    action: `SUSPENDED_WRITE_BLOCKED_${String(operation).toUpperCase()}`,
                    module: 'OperationsGuard',
                    details: `${label}: ${this._formatWindow(verdict)}`,
                    outcome: 'BLOCKED'
                });
            }
        } catch (e) {}
        return false;
    },

    /**
     * Attach realtime listeners so a suspension activated by an administrator takes
     * effect without requiring the user to sign out / refresh.
     */
    InstallRealtimeSync() {
        const db = this._db();
        const { wsId, userId } = this._ids();
        if (!db || !wsId || this._listenersInstalled) return;

        this._hydrate();
        this._state.wsId = wsId;
        this._state.userId = userId;
        this._listenersInstalled = true;

        const applySettings = (snap) => {
            const val = snap.val();
            this._state.settings = (val && typeof val === 'object') ? val : {};
            this._state.loaded = true;
            this._state.loadedAt = Date.now();
            this._persist();
        };
        const applyWorkspace = (snap) => {
            const val = snap.val();
            this._state.workspace = (val && typeof val === 'object') ? val : {};
            this._persist();
        };
        const applyOwner = (snap) => {
            const val = snap.val();
            this._state.owner = (val && typeof val === 'object') ? val : {};
            if ((!this._state.workspace || !Object.keys(this._state.workspace).length) &&
                val && val.workspace && typeof val.workspace === 'object' && val.workspace.WorkspaceSettings) {
                this._state.workspace = val.workspace.WorkspaceSettings;
            }
            this._persist();
        };
        const applyMember = (snap) => {
            const val = snap.val();
            this._state.member = (val && typeof val === 'object') ? val : {};
            this._persist();
        };
        const applyServerOffset = (snap) => {
            const offset = Number(snap.val());
            this._serverOffset = Number.isFinite(offset) ? offset : 0;
        };
        const applyConnection = (snap) => {
            if (snap.val() === true) this.Refresh(true).catch(() => {});
        };

        const attach = (path, handler) => {
            try {
                const ref = db.ref(path);
                ref.on('value', handler);
                this._refs.push({ ref, handler });
            } catch (e) {}
        };

        attach('PlatformMaster/Settings/operations', applySettings);
        attach(`Users/${wsId}/workspace/WorkspaceSettings`, applyWorkspace);
        attach(`Users/${wsId}`, applyOwner);
        if (userId && userId !== wsId) {
            attach(`Users/${wsId}/workspace/Members/${userId}`, applyMember);
        }
        attach('.info/serverTimeOffset', applyServerOffset);
        attach('.info/connected', applyConnection);

        this.Refresh(true);
    },

    /**
     * Full state snapshot for UI consumers (e.g. banners, admin panels).
     */
    GetState() {
        this._hydrate();
        return {
            state: this._state,
            verdict: this.Evaluate()
        };
    },

    /**
     * Convert a Date/ISO/epoch value to a millisecond timestamp.
     */
    ToTimestamp(value) {
        return this._parseTime(value);
    }
};

/**
 * LIGHTWEIGHT NETWORK RESILIENCE
 * Firebase already queues writes while offline; this wrapper covers the cases where
 * a promise rejects because the socket is reconnecting or a read was issued offline.
 * All retried operations here are idempotent (full-path updates / reads).
 */
const UniTaxNet = {
    _db() {
        if (typeof firebase === 'undefined' || !firebase.database) return null;
        return firebase.database();
    },

    isOnline() {
        try { return typeof navigator === 'undefined' || navigator.onLine !== false; }
        catch (e) { return true; }
    },

    WaitForConnection(timeout = 8000) {
        const db = this._db();
        if (!db) return Promise.resolve(false);
        return new Promise((resolve) => {
            let settled = false;
            let timer = null;
            const done = (val) => {
                if (settled) return;
                settled = true;
                try { ref.off('value', handler); } catch (e) {}
                if (timer) clearTimeout(timer);
                resolve(val);
            };
            const handler = (snap) => { if (snap.val() === true) done(true); };
            let ref = null;
            try {
                ref = db.ref('.info/connected');
                ref.on('value', handler);
                timer = setTimeout(() => done(false), Math.max(1000, timeout));
            } catch (e) {
                done(false);
            }
        });
    },

    async WithRetry(fn, options = {}) {
        const attempts = Math.max(1, Number(options.attempts) || 4);
        const base = Math.max(100, Number(options.baseDelay) || 400);
        let lastError = null;
        for (let i = 0; i < attempts; i++) {
            try {
                if (!this.isOnline()) {
                    const ok = await this.WaitForConnection(Math.min(8000, base * (i + 1)));
                    if (!ok && i === attempts - 1) {
                        throw new Error('Device is offline. Reconnect and retry.');
                    }
                }
                return await fn(i);
            } catch (err) {
                lastError = err;
                if (i === attempts - 1) break;
                await this.WaitForConnection(Math.min(6000, base * (i + 1)));
                await new Promise(r => setTimeout(r, Math.min(4000, base * Math.pow(2, i)) + Math.floor(Math.random() * 200)));
            }
        }
        throw lastError || new Error('Network operation failed');
    },

    Once(ref, options = {}) {
        return this.WithRetry(() => ref.once('value'), options);
    },

    Update(ref, updates, options = {}) {
        return this.WithRetry(() => ref.update(updates), options);
    }
};

window.UniTaxAuth = UniTaxAuth;
window.UniTaxAudit = UniTaxAudit;
window.UniTaxOperations = UniTaxOperations;
window.UniTaxNet = UniTaxNet;
