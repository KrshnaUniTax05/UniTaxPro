/**
 * UNITAX PRO — SERVER-AUTHORITATIVE AUTHORIZATION (AuthZ)
 * ------------------------------------------------------------------
 * The browser is treated as untrusted. Role, status, permission matrix and
 * data scope are re-read from Firebase RTDB for the signed-in identity before
 * any mutation is accepted. localStorage is only a *login hint*: it is never
 * used to grant an action when a server snapshot is available.
 *
 * Design contract
 *  - Fail closed : no verified snapshot  ->  no write.
 *  - TTL cache   : 20s fresh window, 5 min degraded window while offline.
 *  - Tamper trap : local role higher than server role -> audited + server wins.
 *  - Guest mode  : only when the SERVER record itself declares guest.
 *
 * Public API
 *  - AuthZ.Fetch(force)                  -> Promise<snapshot|null>
 *  - AuthZ.SnapshotPerms()               -> perms|null   (sync, last known)
 *  - AuthZ.Require(action, ctx)          -> Promise<{ok, code, message, perms}>
 *  - AuthZ.RequireApproval(doc, action)  -> Promise<{ok, ...}>
 *  - AuthZ.CanSync(action)               -> true|false|null (null = unknown)
 *  - AuthZ.Invalidate()
 */
const UniTaxAuthZ = {
    VERSION: '1.0.0',
    CACHE_KEY: 'unitax_authz_snapshot_v2',
    FRESH_MS: 20000,
    DEGRADED_MS: 300000,
    READ_TIMEOUT_MS: 7000,

    _snapshot: null,
    _inflight: null,
    _inflightAt: 0,
    _realtimeInstalled: false,
    _tamperReported: false,

    /* ------------------------------------------------------------------ *
     * IDENTITY
     * ------------------------------------------------------------------ */
    Ids() {
        const pick = (v) => String(v || '').trim().replace(/^#/, '');
        let wsId = '';
        let userId = '';
        try {
            if (typeof App !== 'undefined' && App.State) {
                wsId = pick(App.State.userId || App.State.workspaceUserId);
                userId = pick(App.State.currentuserId);
            }
        } catch (e) {}
        if (!wsId) wsId = pick(localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid'));
        if (!userId) userId = pick(localStorage.getItem('userloginid'));
        if (!wsId) wsId = userId;
        return { wsId, userId, isOwner: !!wsId && wsId === userId };
    },

    Db() {
        try {
            if (typeof firebase !== 'undefined' && firebase.database) return firebase.database();
        } catch (e) {}
        return null;
    },

    _read(path) {
        const db = this.Db();
        if (!db || !path) return Promise.resolve(null);
        return new Promise((resolve) => {
            let settled = false;
            const done = (val) => {
                if (settled) return;
                settled = true;
                resolve(val);
            };
            const timer = setTimeout(() => done(null), this.READ_TIMEOUT_MS);
            try {
                db.ref(path).once('value').then((snap) => {
                    clearTimeout(timer);
                    done((snap && typeof snap.val === 'function') ? snap.val() : null);
                }).catch(() => {
                    clearTimeout(timer);
                    done(null);
                });
            } catch (e) {
                clearTimeout(timer);
                done(null);
            }
        });
    },

    /* ------------------------------------------------------------------ *
     * ROLE NORMALISATION
     * ------------------------------------------------------------------ */
    _normRole(role) {
        return String(role || '')
            .trim()
            .toLowerCase()
            .replace(/[\s/\-]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    },

    _canonicalRole(rawRole) {
        const role = this._normRole(rawRole);
        const aliases = {
            super_administrator: 'super_administrator',
            superadmin: 'super_administrator',
            root: 'super_administrator',
            administrator: 'administrator',
            admin: 'administrator',
            owner: 'administrator',
            workspace_owner: 'administrator',
            tenant_owner: 'administrator',
            co_useradmin: 'co_useradmin',
            co_user_admin: 'co_useradmin',
            co_admin: 'co_useradmin',
            couseradmin: 'co_useradmin',
            manager: 'manager',
            senior_accountant: 'manager',
            reporting_manager: 'manager',
            hod: 'manager',
            operator: 'operator',
            user: 'operator',
            plain_user: 'operator',
            staff: 'operator',
            accountant: 'operator',
            data_entry: 'operator',
            data_entry_operator: 'operator',
            approver: 'approver',
            financial_approver: 'approver',
            authorizer: 'approver',
            viewer: 'viewer',
            read_only: 'viewer',
            readonly: 'viewer',
            auditor: 'auditor',
            statutory_auditor: 'auditor',
            custom: 'custom',
            custom_role: 'custom',
            guest: 'guest'
        };
        return aliases[role] || '';
    },

    _templateFor(role) {
        const templates = (typeof UniTaxAuth !== 'undefined' && UniTaxAuth.RoleTemplates)
            ? UniTaxAuth.RoleTemplates
            : {};
        return templates[role] || templates.operator || {
            name: 'Operator',
            modules: ['masters', 'transactions', 'reports'],
            actions: ['create', 'read', 'update', 'print'],
            dataScope: 'own',
            canPostDirectly: false,
            sensitiveFields: {}
        };
    },

    /**
     * Build the authoritative permission envelope from the SERVER record.
     */
    BuildPermissions(role, record) {
        const rec = (record && typeof record === 'object') ? record : {};
        const stored = (rec.permissions && typeof rec.permissions === 'object') ? rec.permissions : {};
        const isCustom = role === 'custom';
        const tpl = this._templateFor(role);

        const arr = (v) => Array.isArray(v) ? v.map(x => String(x).trim().toLowerCase()).filter(Boolean) : null;
        const storedActions = arr(stored.actions);
        const storedModules = arr(stored.modules);
        // An explicit administrator-saved action/module set is authoritative for
        // every role (not only "custom"); an empty saved list means "no rights",
        // which must NOT silently fall back to the role template.
        let actions = (storedActions !== null ? storedActions : arr(tpl.actions)) || ['read'];
        let modules = (storedModules !== null ? storedModules : arr(tpl.modules)) || [];

        if (role === 'guest') {
            actions = ['create', 'read', 'update', 'delete', 'post', 'approve', 'reject', 'export', 'print', 'admin', 'view_metadata'];
            modules = ['all'];
        }

        const isAdminRole = ['super_administrator', 'administrator', 'co_useradmin'].includes(role);
        if (isAdminRole) {
            actions = ['create', 'read', 'update', 'delete', 'post', 'approve', 'reject', 'export', 'print', 'admin', 'view_metadata'];
            modules = ['all'];
        }

        const boolFrom = (serverVal, fallback) => {
            if (serverVal === true || serverVal === 'true') return true;
            if (serverVal === false || serverVal === 'false') return false;
            return fallback === true;
        };
        const numFrom = (serverVal, fallback) => {
            const n = parseFloat(serverVal);
            return Number.isFinite(n) ? n : (parseFloat(fallback) || 0);
        };

        const canPostDirectly = boolFrom(rec.canPostDirect, isAdminRole ? true : (stored.canPostDirectly ?? tpl.canPostDirectly));
        const canViewMetadata = boolFrom(rec.canViewMetadata, isAdminRole ? true : actions.includes('view_metadata'));

        return {
            role,
            roleName: isCustom ? (rec.customRoleName || stored.customRoleName || tpl.name || 'Custom Role')
                : (tpl.name || role),
            source: 'server',
            modules,
            actions,
            // True when an administrator saved an explicit action set for this
            // member (an empty saved list counts as an explicit restriction).
            actionsExplicit: Array.isArray(stored.actions),
            dataScope: isCustom ? (stored.dataScope || tpl.dataScope || 'own') : (tpl.dataScope || 'own'),
            canPostDirectly: isAdminRole ? true : canPostDirectly,
            canApprove: actions.includes('approve'),
            canReject: actions.includes('reject'),
            // Explicit admin-panel grant (default OFF): lets a user act on any
            // approval level even when they are not the assigned approver.
            approveOutsideHierarchy: boolFrom(stored.approveOutsideHierarchy ?? rec.approveOutsideHierarchy, false),
            canDelete: actions.includes('delete'),
            canUpdate: actions.includes('update') || actions.includes('edit'),
            canViewMetadata,
            postingLimit: numFrom(rec.postingLimit, stored.postingLimit || 0),
            canBackdate: boolFrom(rec.canBackdate, isAdminRole ? true : (stored.canBackdate ?? tpl.canBackdate)),
            allowedProfitCenter: String(rec.allowedProfitCenter || stored.allowedProfitCenter || '*'),
            allowedLedger: String(rec.allowedLedger || stored.allowedLedger || '*'),
            assignedManagerId: String(rec.assignedManagerId || stored.assignedManagerId || ''),
            assignedManagerName: String(rec.assignedManagerName || stored.assignedManagerName || ''),
            allowedDateFrom: String(rec.allowedDateFrom || stored.allowedDateFrom || ''),
            allowedDateTo: String(rec.allowedDateTo || stored.allowedDateTo || ''),
            enforceDateRange: rec.enforceDateRange === true || stored.enforceDateRange === true,
            sensitiveFields: Object.assign({}, tpl.sensitiveFields || {}, stored.sensitiveFields || {}),
            fieldRestrictions: Array.isArray(stored.fieldRestrictions) ? stored.fieldRestrictions
                : (Array.isArray(rec.fieldRestrictions) ? rec.fieldRestrictions : []),
            voucherApprovalFlow: Array.isArray(rec.voucherApprovalFlow) ? rec.voucherApprovalFlow
                : (Array.isArray(stored.voucherApprovalFlow) ? stored.voucherApprovalFlow : []),
            isAdmin: isAdminRole,
            isGuest: role === 'guest',
            status: String(rec.status || rec.accountStatus || 'active').toLowerCase(),
            email: String(rec.email || ''),
            name: String(rec.name || rec.userName || '')
        };
    },

    /* ------------------------------------------------------------------ *
     * SNAPSHOT CACHE
     * ------------------------------------------------------------------ */
    Hydrate() {
        if (this._snapshot) return this._snapshot;
        try {
            const raw = localStorage.getItem(this.CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.perms || !parsed.ids) return null;
            this._snapshot = parsed;
            return parsed;
        } catch (e) {
            return null;
        }
    },

    Persist() {
        try {
            if (!this._snapshot) {
                localStorage.removeItem(this.CACHE_KEY);
                return;
            }
            localStorage.setItem(this.CACHE_KEY, JSON.stringify({
                ids: this._snapshot.ids,
                perms: this._snapshot.perms,
                fetchedAt: this._snapshot.fetchedAt,
                degraded: this._snapshot.degraded === true
            }));
        } catch (e) {}
    },

    Invalidate() {
        this._snapshot = null;
        try { localStorage.removeItem(this.CACHE_KEY); } catch (e) {}
    },

    /** Last server-verified permission envelope (sync, may be stale). */
    SnapshotPerms() {
        const snap = this._snapshot || this.Hydrate();
        if (!snap || !snap.perms) return null;
        const ids = this.Ids();
        if (snap.ids && (snap.ids.wsId !== ids.wsId || snap.ids.userId !== ids.userId)) return null;
        return snap.perms;
    },

    SnapshotAge() {
        const snap = this._snapshot || this.Hydrate();
        if (!snap || !snap.fetchedAt) return Infinity;
        return Math.max(0, Date.now() - Number(snap.fetchedAt));
    },

    _recordPath(ids) {
        if (!ids.wsId || !ids.userId) return '';
        return ids.isOwner ? `Users/${ids.wsId}` : `Users/${ids.wsId}/workspace/Members/${ids.userId}`;
    },

    _withTimeout(promise, ms, label) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`${label || 'AuthZ'} verification timed out`)), ms))
        ]);
    },

    /**
     * Re-read the signed-in identity from the server and rebuild permissions.
     * @param {boolean} force bypass the fresh window
     */
    async Fetch(force = false) {
        const ids = this.Ids();
        if (!ids.wsId || !ids.userId) return null;

        if (!force) {
            const cached = this._snapshot || this.Hydrate();
            if (cached && cached.perms && cached.ids &&
                cached.ids.wsId === ids.wsId && cached.ids.userId === ids.userId &&
                this.SnapshotAge() < this.FRESH_MS) {
                return cached;
            }
        }

        const now = Date.now();
        if (this._inflight && (now - this._inflightAt) < 15000) return this._inflight;

        const path = this._recordPath(ids);
        this._inflightAt = now;
        this._inflight = (async () => {
            let record = null;
            let online = true;
            try {
                record = await this._read(path);
            } catch (e) {
                online = false;
            }

            if (!record || typeof record !== 'object' || Object.keys(record).length === 0) {
                // Owner record fallback for legacy tenants that keep role at Users/{uid}.
                if (!ids.isOwner) {
                    const fallback = await this._read(`Users/${ids.userId}`).catch(() => null);
                    if (fallback && typeof fallback === 'object' && fallback.role &&
                        String(fallback.workspaceOwnerId || '') === ids.wsId) {
                        record = fallback;
                    }
                }
            }

            if (!record || typeof record !== 'object' || Object.keys(record).length === 0) {
                const cached = this._snapshot || this.Hydrate();
                const sameIdentity = cached && cached.ids &&
                    cached.ids.wsId === ids.wsId && cached.ids.userId === ids.userId;
                if (sameIdentity && this.SnapshotAge() < this.DEGRADED_MS) {
                    const stale = Object.assign({}, cached, { degraded: true });
                    this._snapshot = stale;
                    return stale;
                }
                return null;
            }

            const serverRoleRaw = record.role || record.userRole || record.roleId ||
                (record.permissions && record.permissions.role) || '';
            let role = this._canonicalRole(serverRoleRaw);

            // Owner of the workspace is always an administrator unless the server
            // record explicitly demotes them to a lower, non-empty role.
            if (!role && ids.isOwner) role = 'administrator';
            if (!role) role = 'operator';

            this._detectTamper(serverRoleRaw, role);

            const perms = this.BuildPermissions(role, record);
            const snapshot = {
                ids,
                perms,
                fetchedAt: Date.now(),
                degraded: online === false
            };
            this._snapshot = snapshot;
            this.Persist();
            try {
                document.dispatchEvent(new CustomEvent('authz:updated', { detail: { perms } }));
            } catch (e) {}
            return snapshot;
        })().catch((err) => {
            console.warn('[AuthZ] Verification failure:', err && err.message ? err.message : err);
            const cached = this._snapshot || this.Hydrate();
            if (cached && cached.perms && this.SnapshotAge() < this.DEGRADED_MS) {
                return Object.assign({}, cached, { degraded: true });
            }
            return null;
        }).finally(() => {
            this._inflight = null;
        });

        return this._inflight;
    },

    /**
     * If the browser claims a privilege the server does not grant, record it.
     * Server always wins.
     */
    _detectTamper(serverRoleRaw, resolvedRole) {
        try {
            const localRole = this._canonicalRole(localStorage.getItem('userrole') || localStorage.getItem('role') || '');
            const ADMIN = ['super_administrator', 'administrator', 'co_useradmin'];
            const claimedAdmin = ADMIN.includes(localRole);
            const grantedAdmin = ADMIN.includes(resolvedRole);
            if (localRole && claimedAdmin && !grantedAdmin) {
                if (this._tamperReported) return;
                this._tamperReported = true;
                const message = `Security notice: the browser role "${localRole}" does not match your server role "${serverRoleRaw || resolvedRole}". Server permissions have been applied.`;
                try {
                    if (typeof App !== 'undefined' && App.UI && typeof App.UI.Notify === 'function') {
                        App.UI.Notify('Role Verification', message, 'warning');
                    }
                } catch (e) {}
                try {
                    if (window.UniTaxAudit && typeof UniTaxAudit.Log === 'function') {
                        UniTaxAudit.Log({
                            action: 'ROLE_TAMPER_BLOCKED',
                            module: 'AuthZ',
                            details: `local=${localRole}; server=${serverRoleRaw || resolvedRole}`,
                            outcome: 'BLOCKED'
                        });
                    }
                } catch (e) {}
            }
        } catch (e) {}
    },

    /* ------------------------------------------------------------------ *
     * ACTION EVALUATION
     * ------------------------------------------------------------------ */
    _normalizeAction(action) {
        const a = String(action || '').trim().toLowerCase();
        const aliases = {
            edit: 'update',
            modify: 'update',
            view: 'read',
            inspect: 'read',
            list: 'read',
            submit: 'create',
            save: 'create',
            remove: 'delete',
            destroy: 'delete',
            post_voucher: 'post',
            metadata: 'view_metadata',
            inspect_metadata: 'view_metadata'
        };
        return aliases[a] || a;
    },

    _allowsAction(perms, action) {
        if (!perms) return false;
        if (perms.isGuest) return true;
        if (perms.isAdmin) return true;
        const a = this._normalizeAction(action);
        if (!a) return false;
        if (a === 'read') return perms.actions.includes('read') || perms.actions.includes('view');
        if (a === 'update') return perms.actions.includes('update') || perms.actions.includes('edit');
        if (a === 'view_metadata') return perms.canViewMetadata === true || perms.actions.includes('view_metadata');
        return perms.actions.includes(a);
    },

    _moduleAllowed(perms, modulePath) {
        if (!perms || !modulePath) return true;
        if (perms.isGuest || perms.isAdmin) return true;
        if (Array.isArray(perms.modules) && perms.modules.includes('all')) return true;
        const clean = String(modulePath).toLowerCase().replace(/^\/+/, '').replace(/^#\/?/, '').split('?')[0].trim();
        if (!clean) return true;
        const modules = Array.isArray(perms.modules) ? perms.modules : [];
        if (modules.includes(clean)) return true;
        const category = clean.split('/')[0];
        if (modules.includes(category)) return true;
        return false;
    },

    _dateAllowed(perms, dateValue) {
        if (!perms || !perms.enforceDateRange || !dateValue) return true;
        const target = (typeof dateValue === 'number') ? dateValue : Date.parse(dateValue);
        if (!Number.isFinite(target)) return true;
        const from = perms.allowedDateFrom ? Date.parse(perms.allowedDateFrom) : NaN;
        const to = perms.allowedDateTo ? Date.parse(`${perms.allowedDateTo}T23:59:59`) : NaN;
        if (Number.isFinite(from) && target < from) return false;
        if (Number.isFinite(to) && target > to) return false;
        return true;
    },

    _dimensionAllowed(perms, ctx) {
        if (!perms) return true;
        const pc = String(ctx.profitCenter || ctx.project || '').trim();
        const ledger = String(ctx.ledger || ctx.account || '').trim();
        const unfolded = (actual, allowed) => {
            const a = String(actual || '').toLowerCase();
            const b = String(allowed || '').toLowerCase();
            if (!b || b === '*') return true;
            if (!a) return false;
            if (a === b) return true;
            const parts = (s) => {
                const out = [s];
                const m = s.match(/^(.*?)\s*\((.*?)\)$/);
                if (m) out.push(m[1].trim(), m[2].trim());
                return out;
            };
            const ap = parts(a);
            const bp = parts(b);
            return ap.some(p => p && bp.includes(p));
        };
        if (pc && !unfolded(pc, perms.allowedProfitCenter)) return false;
        if (ledger && !unfolded(ledger, perms.allowedLedger)) return false;
        return true;
    },

    _deny(ctx, code, message) {
        const payload = { ok: false, code, message };
        if (!(ctx && ctx.silent)) {
            try {
                if (typeof App !== 'undefined' && App.UI && typeof App.UI.Notify === 'function') {
                    App.UI.Notify('Authorization Denied', message, 'danger');
                } else {
                    alert(`Authorization Denied: ${message}`);
                }
            } catch (e) {}
        }
        try {
            if (window.UniTaxAudit && typeof UniTaxAudit.Log === 'function') {
                UniTaxAudit.Log({
                    action: `AUTHZ_DENIED_${String(code).toUpperCase()}`,
                    module: (ctx && ctx.module) || 'AuthZ',
                    recordId: (ctx && ctx.recordId) || '',
                    details: message,
                    outcome: 'BLOCKED'
                });
            }
        } catch (e) {}
        return payload;
    },

    /**
     * Verify one action against the server-side identity and permission matrix.
     * @param {string|string[]} action
     * @param {object} ctx { module, label, amount, date, project, ledger,
     *                       approval, assigneeId, silent, force }
     */
    async Require(action, ctx = {}) {
        const requested = Array.isArray(action) ? action : [action];
        let snap = null;
        try {
            snap = await this.Fetch(ctx.force === true);
        } catch (e) {
            snap = null;
        }

        if (!snap || !snap.perms) {
            return this._deny(ctx, 'UNVERIFIED',
                'Your authorization could not be verified with the server. Reconnect and retry — no changes were saved.');
        }

        const perms = snap.perms;

        // Suspended / disabled accounts cannot mutate anything.
        if (['suspended', 'inactive', 'disabled', 'locked', 'blocked'].includes(perms.status) && !perms.isGuest) {
            return this._deny(ctx, 'ACCOUNT_INACTIVE',
                `Your account is ${perms.status}. All create, update and delete operations are blocked.`);
        }

        const allowed = requested.some(a => this._allowsAction(perms, a));
        if (!allowed) {
            return this._deny(ctx, 'ACTION_FORBIDDEN',
                `Your assigned role "${perms.roleName || perms.role}" does not permit the "${requested.join('/')}" action${ctx.label ? ` on this ${ctx.label}` : ''}.`);
        }

        if (ctx.module && !this._moduleAllowed(perms, ctx.module)) {
            return this._deny(ctx, 'MODULE_FORBIDDEN',
                `Your role does not grant access to the "${ctx.module}" module.`);
        }

        if (!this._dateAllowed(perms, ctx.date)) {
            return this._deny(ctx, 'DATE_FORBIDDEN',
                `The selected date is outside your authorized posting window (${perms.allowedDateFrom || '…'} — ${perms.allowedDateTo || '…'}).`);
        }

        if (!this._dimensionAllowed(perms, ctx)) {
            return this._deny(ctx, 'DIMENSION_FORBIDDEN',
                `The selected profit centre / account is outside your authorized data scope.`);
        }

        if (Number(perms.postingLimit) > 0 && Number(ctx.amount) > 0 && Number(ctx.amount) > Number(perms.postingLimit)) {
            return this._deny(ctx, 'LIMIT_EXCEEDED',
                `The document value exceeds your authorized posting limit of ${Number(perms.postingLimit).toLocaleString('en-IN')}.`);
        }

        if (ctx.assigneeId && !perms.isAdmin && !perms.isGuest) {
            const ids = this.Ids();
            const mine = [ids.userId, localStorage.getItem('useremail_we') || ''].filter(Boolean).map(v => String(v).toLowerCase());
            if (!mine.includes(String(ctx.assigneeId).toLowerCase())) {
                return this._deny(ctx, 'NOT_ASSIGNED',
                    'This document is not assigned to you at the current approval level.');
            }
        }

        return { ok: true, code: 'OK', perms, degraded: snap.degraded === true };
    },

    /**
     * Verify an approval-chain action against server permissions AND the
     * live hierarchy stored on the request.
     */
    async RequireApproval(doc, action, ctx = {}) {
        const req = doc && (doc.request || doc) ? (doc.request || doc) : {};
        const ids = this.Ids();
        const localState = (typeof App !== 'undefined' && App.State) ? App.State : {};
        const mine = [
            ids.userId,
            localStorage.getItem('useremail_we'),
            localStorage.getItem('userEmail'),
            localStorage.getItem('useremail'),
            localState.userEmail
        ].filter(Boolean).map(v => String(v).trim().toLowerCase());
        // Only treat the workspace-owner identity as "me" when the signed-in user actually
        // IS the owner; members must never inherit the owner id as their own identity.
        if (ids.userId && ids.wsId && ids.userId.toLowerCase() === ids.wsId.toLowerCase()) {
            mine.push(ids.wsId);
        }
        const myNames = [
            localState.userName,
            localStorage.getItem('userName'),
            localStorage.getItem('username')
        ].filter(Boolean).map(v => String(v).trim().toLowerCase());
        const matches = (id, name) => {
            const tId = String(id || '').trim().toLowerCase();
            const tName = String(name || '').trim().toLowerCase();
            if (tId && mine.includes(tId)) return true;
            if (tName && (myNames.includes(tName) || mine.some(m => tName === m))) return true;
            return false;
        };

        const verdict = await this.Require(action, Object.assign({ label: 'approval document' }, ctx, { silent: true }));
        if (!verdict.ok) return verdict;

        // Only the person the chain is waiting on may decide. Administrative role
        // alone is NOT a bypass: an administrator must also be the assignee, or
        // hold the explicit "approve outside hierarchy" grant from the matrix.
        const override = verdict.perms.approveOutsideHierarchy === true;
        if (override) {
            const stateOv = String(req.state || req.status || '').toUpperCase();
            const pendingOv = ['PENDING', 'PENDING_APPROVAL', 'DRAFT'].includes(stateOv) || req.is_draft === true;
            if (!pendingOv) return this._deny(ctx, 'NOT_PENDING', 'This document is not awaiting a decision.');
            return verdict;
        }

        const normAction = this._normalizeAction(action);
        if (normAction !== 'approve' && normAction !== 'reject') {
            // withdraw / delete / reassign are handled by their own ownership helpers.
            return verdict;
        }

        const hierarchy = Array.isArray(req.hierarchy) ? req.hierarchy : [];
        const curLvl = Number(req.currentLevelIndex || 0);
        const current = hierarchy[curLvl] || {};
        const assignedId = req.currentApproverId || req.assignedManagerId || current.userId;
        const assignedName = req.currentApproverName || req.assignedManagerName || current.userName;

        const state = String(req.state || req.status || '').toUpperCase();
        const pending = ['PENDING', 'PENDING_APPROVAL', 'DRAFT'].includes(state) || req.is_draft === true;
        if (!pending) return this._deny(ctx, 'NOT_PENDING', 'This document is not awaiting a decision.');

        if (hierarchy.length > 0) {
            const lowerApproved = hierarchy.slice(0, curLvl).every(h => String(h.status || '').toUpperCase() === 'APPROVED');
            if (!matches(current.userId, current.userName) || !lowerApproved) {
                return this._deny(ctx, 'NOT_YOUR_TURN', 'This document is not at your approval level yet.');
            }
        } else if (!matches(assignedId, assignedName)) {
            return this._deny(ctx, 'NOT_ASSIGNED', 'This document is not assigned to you for approval.');
        }

        return verdict;
    },

    /**
     * Synchronous UI hint. Returns true/false when a verified snapshot exists,
     * or null when the caller should fall back to its optimistic default.
     */
    CanSync(action) {
        const perms = this.SnapshotPerms();
        if (!perms) return null;
        return this._allowsAction(perms, action);
    },

    /* ------------------------------------------------------------------ *
     * REALTIME INVALIDATION
     * ------------------------------------------------------------------ */
    Install() {
        try {
            this.Hydrate();
        } catch (e) {}

        // Refresh on reconnect + keep the snapshot warm.
        try {
            const db = this.Db();
            if (db && !this._realtimeInstalled) {
                this._realtimeInstalled = true;
                const ids = this.Ids();
                const path = this._recordPath(ids);
                if (path) {
                    try {
                        db.ref(path).on('value', () => { this.Fetch(true).catch(() => {}); });
                    } catch (e) {}
                }
                try {
                    db.ref('.info/connected').on('value', (snap) => {
                        if (snap && snap.val() === true) this.Fetch(true).catch(() => {});
                    });
                } catch (e) {}
            }
        } catch (e) {}

        const run = () => { this.Fetch(false).catch(() => {}); };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run, { once: true });
        } else {
            setTimeout(run, 0);
        }
    }
};

window.UniTaxAuthZ = UniTaxAuthZ;
