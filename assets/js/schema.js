/**
 * UniTax Pro — Database Schema (single source of truth)
 *
 * Rules of the model
 * -----------------
 * 1. /Utilities/…      — global, shared application data (notifications,
 *                         broadcasts, users directory, help center, sessions,
 *                         master audit log, updates, knowledge base).
 *                         No workspace-specific data lives here.
 * 2. /Workspaces/{id}/… — EVERYTHING a workspace owns (owner's data AND
 *                         member/guest data). {id} = the workspace owner's
 *                         userId (the same value stored in
 *                         localStorage('workspaceId' / 'workspaceUserId')
 *                         for both owner and member sessions).
 * 3. /Sessions/…        — live session registry lives under Utilities/Sessions.
 *                         One record per open tab; expires after 60 s of silence.
 *
 * Never construct paths by hand in modules — use these helpers.
 */
(function () {
    'use strict';

    const UniPaths = {
        /* ---------- Layout switch ---------- */
        useV3Layout() {
            try { return localStorage.getItem('unitax_layout') === 'v3'; } catch (e) { return false; }
        },
        enableV3Layout() { try { localStorage.setItem('unitax_layout', 'v3'); } catch (e) {} },
        disableV3Layout() { try { localStorage.removeItem('unitax_layout'); } catch (e) {} },

        /* ---------- Workspace identity ---------- */
        workspaceId() {
            try {
                return (typeof App !== 'undefined' && App.State && (App.State.workspaceId || App.State.workspaceUserId))
                    || localStorage.getItem('workspaceId')
                    || localStorage.getItem('workspaceUserId')
                    || localStorage.getItem('userloginid')
                    || 'default-workspace';
            } catch (e) { return 'default-workspace'; }
        },

        /* ---------- Global utilities ---------- */
        utilitiesRoot() { return 'Utilities'; },
        util(...segs)   { return ['Utilities'].concat(segs).join('/'); },

        // shared app data
        notifications()  { return this.util('Notifications'); },
        notification(id) { return this.util('Notifications', id); },
        broadcasts()     { return this.util('Broadcasts'); },
        updates()        { return this.util('Updates'); },
        users()          { return this.util('Users'); },
        user(id)         { return this.util('Users', id); },
        masterAudit()    { return this.util('MasterAuditLogs'); },
        helpCenter()     { return this.util('HelpCenter'); },
        knowledgeBase()  { return this.util('HelpCenter', 'Articles'); },
        platformMaster() { return this.util('PlatformMaster'); },
        admins()         { return this.util('PlatformMaster', 'Admins'); },

        /* ---------- Workspace-scoped data ---------- */
        workspaceRoot()  { return 'Workspaces/' + this.workspaceId(); },
        ws(...segs)      { return ['Workspaces', this.workspaceId()].concat(segs).join('/'); },

        /* Path-aware transaction location (v3 layout when flag is on, legacy otherwise). */
        txPath(formId, key) {
            if (this.useV3Layout()) {
                return key ? this.ws('Transactions', formId, key) : this.ws('Transactions', formId);
            }
            // Legacy per-user root path — mirrors current production writes
            const uid = this.userId();
            return key ? `${uid}/Transactions/${formId}/${key}` : `${uid}/Transactions/${formId}`;
        },

        settings()       { return this.ws('Settings'); },
        settingsKey(k)   { return this.ws('Settings', k); },
        members()        { return this.ws('Members'); },
        member(id)       { return this.ws('Members', id); },
        memberPermissions(id) { return this.ws('Members', id, 'permissions'); },
        auditLogs()      { return this.ws('AuditLogs'); },
        masters(sheet)   { return sheet ? this.ws('Masters', sheet) : this.ws('Masters'); },
        mastersRecord(sheet, id) { return this.ws('Masters', sheet, id); },
        transactions(formId)    { return formId ? this.ws('Transactions', formId) : this.ws('Transactions'); },
        transaction(formId, id) { return this.ws('Transactions', formId, id); },
        voucherApprovalFlow(userId) { return this.ws('Users', userId || this.userId(), 'voucherApprovalFlow'); },
        customWidgets(userId)       { return this.ws('Users', userId || this.userId(), 'CustomDashboardWidgets'); },
        requests()       { return this.ws('Requests'); },
        request(id)      { return this.ws('Requests', id); },
        notificationsWS(){ return this.util('Notifications'); /* shared feed — kept global */ },
        postingPeriod()  { return this.ws('Settings', 'PostingPeriod'); },

        /* ---------- Identity ---------- */
        userId() {
            try {
                return (typeof App !== 'undefined' && App.State && App.State.userId)
                    || localStorage.getItem('userloginid') || localStorage.getItem('workspaceUserId') || '';
            } catch (e) { return ''; }
        },

        /* ---------- Legacy path landing map (used by compat + migration) ---------- */
        legacyMap: [
            { from: /^Transactions(\/.*)?$/,                    to: (m) => 'Workspaces/{ws}/Transactions' + (m[1] || '') },
            { from: /^Masters(\/.*)?$/,                         to: (m) => 'Workspaces/{ws}/Masters' + (m[1] || '') },
            { from: /^Users$/,                                  to: () => 'Utilities/Users' },
            { from: /^Users\/([^/]+)$/,                         to: (m) => 'Utilities/Users/' + m[1] },
            { from: /^Users\/([^/]+)\/workspace\/Members$/,     to: (m) => 'Workspaces/' + m[1] + '/Members' },
            { from: /^Users\/([^/]+)\/workspace\/Members\/(.+)$/, to: (m) => 'Workspaces/' + m[1] + '/Members/' + m[2] },
            { from: /^Users\/([^/]+)\/workspace\/WorkspaceSettings$/, to: (m) => 'Workspaces/' + m[1] + '/Settings/Workspace' },
            { from: /^Users\/([^/]+)\/workspace\/(.+)$/,        to: (m) => 'Workspaces/' + m[1] + '/Workspace/' + m[2] },
            { from: /^HelpCenter(\/.*)?$/,                      to: (m) => 'Utilities/HelpCenter' + (m[1] || '') },
            { from: /^PlatformMaster(\/.*)?$/,                  to: (m) => 'Utilities/PlatformMaster' + (m[1] || '') },
            { from: /^MasterAuditLogs(\/.*)?$/,                 to: (m) => 'Utilities/MasterAuditLogs' + (m[1] || '') },
            { from: /^Governance(\/.*)?$/,                      to: (m) => 'Workspaces/{ws}/Governance' + (m[1] || '') },
            { from: /^Tasks(\/.*)?$/,                           to: (m) => 'Workspaces/{ws}/Tasks' + (m[1] || '') },
            { from: /^Utilities\/Notifications(\/.*)?$/,        to: () => 'Utilities/Notifications' },
            { from: /^Utilities\/Sessions$/,                    to: () => 'Utilities/Sessions' }
        ],

        /** Convert a legacy root-level path into the new layout. */
        fromLegacy(path) {
            const clean = String(path || '').replace(/^\/+|\/+$/g, '');
            for (const rule of this.legacyMap) {
                const m = clean.match(rule.from);
                if (m) return rule.to(m).replace('{ws}', this.workspaceId());
            }
            return null;
        }
    };

    window.UniPaths = UniPaths;
})();
