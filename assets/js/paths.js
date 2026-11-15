/**
 * UniTax Pro — Path Compatibility Mapper
 *
 * Transparently reroutes every RTDB path into the two-key layout:
 *   Utilities/{…}    — global / shared (Users, PlatformMaster, Broadcasts, Updates, Notifications, HelpCenter, MasterAuditLogs, Sessions)
 *   Workspaces/{id}/ — EVERYTHING a workspace owns (Masters, Transactions, Governance, Tasks, AuditLogs, Members, Settings, Requests)
 *
 * No module needs rewriting — this wraps firebase.database().ref() and rewrites inputs.
 * legacy  →  new
 *   Transactions/{f}/{k}         → Workspaces/{ws}/Transactions/{f}/{k}
 *   Masters/{s}/{k}              → Workspaces/{ws}/Masters/{s}/{k}
 *   Governance/…                 → Workspaces/{ws}/Governance/…
 *   Tasks/…                      → Workspaces/{ws}/Tasks/…
 *   Users                        → Utilities/Users
 *   Users/{id}                   → Utilities/Users/{id}
 *   Users/{ws}/workspace/Members → Workspaces/{ws}/Members
 *   Users/{ws}/workspace/Members/{m} → Workspaces/{ws}/Members/{m}
 *   Users/{ws}/workspace/WorkspaceSettings      → Workspaces/{ws}/Settings
 *   Users/{ws}/workspace/{any}   → Workspaces/{ws}/Workspace/{any}
 *   Utilities/Requests           → Workspaces/{ws}/Requests
 *   Utilities/Notifications      → Workspaces/{ws}/Notifications
 *   Utilities/Broadcasts         → Utilities/Broadcasts (kept global)
 *   Utilities/Updates            → Utilities/Updates (kept global)
 *   PlatformMaster/…             → Utilities/PlatformMaster/…
 *   MasterAuditLogs              → Utilities/MasterAuditLogs
 *   HelpCenter/…                 → Utilities/HelpCenter/…
 *   .info/… (Firebase internal)  → passed through untouched
 */
(function () {
    'use strict';

    const workspaceId = () => {
        try {
            return localStorage.getItem('workspaceUserId') ||
                   localStorage.getItem('userloginid') ||
                   localStorage.getItem('workspaceId') ||
                   'default-workspace';
        } catch (e) { return 'default-workspace'; }
    };

    const ROOTS = [
        // Workspace identity — no workspace prefix
        { from: /^Transactions(\/|$)/,          to: () => `Workspaces/${workspaceId()}/Transactions` },
        { from: /^Masters(\/|$)/,               to: () => `Workspaces/${workspaceId()}/Masters` },
        { from: /^Governance(\/|$)/,            to: () => `Workspaces/${workspaceId()}/Governance` },
        { from: /^Tasks(\/|$)/,                 to: () => `Workspaces/${workspaceId()}/Tasks` },

        // Per-workspace legacy prefix — any uid root like EE9PSSUIB7/Masters/... → Workspaces/<uid>/Masters/...
        { from: /^Users\/([^/]+)\/(Masters|Transactions|Governance|Tasks|AuditLogs)(\/|$)/, to: (m) => `Workspaces/${m[1]}/${m[2]}` },
        { from: /^([A-Za-z0-9_-]{6,})\/(Masters|Transactions|Governance|Tasks|AuditLogs)(\/|$)/, to: (m) => `Workspaces/${m[1]}/${m[2]}` },
        // Per-workspace per-user prefix
        { from: /^([A-Za-z0-9_-]{6,})\/Utilities\/(Notifications|Requests|Updates|Broadcasts)(\/|$)/, to: (m) => `Workspaces/${m[1]}/${m[2]}` },
        { from: /^([A-Za-z0-9_-]{6,})\/(AuditLogs|Workspace|Tasks)(\/|$)/, to: (m) => `Workspaces/${m[1]}/${m[2]}` },
        { from: /^([A-Za-z0-9_-]{6,})\/(PlatformMaster|HelpCenter)(\/|$)/, to: (m) => `Utilities/${m[2]}` },
        { from: /^Utilities\/Requests(\/|$)/,   to: () => `Workspaces/${workspaceId()}/Requests` },
        { from: /^Utilities\/Notifications(\/|$)/, to: () => `Workspaces/${workspaceId()}/Notifications` },
        { from: /^Publisher\/.*$/,              to: () => `Workspaces/${workspaceId()}` }, // safety net

        // Users split: owner workspace tree → Members/Settings; everything else → Utilities/Users
        { from: /^Users\/([^/]+)\/workspace\/Members(\/|$)/, to: (m) => `Workspaces/${m[1]}/Members` },
        { from: /^Users\/([^/]+)\/workspace\/Settings(\/|$)/, to: (m) => `Workspaces/${m[1]}/Settings` },
        { from: /^Users\/([^/]+)\/workspace\/WorkspaceSettings(\/|$)/, to: (m) => `Workspaces/${m[1]}/Settings` },
        { from: /^Users\/([^/]+)\/workspace\/UploadPermissions(\/|$)/, to: (m) => `Workspaces/${m[1]}/Settings/UploadPermissions` },
        { from: /^Users\/([^/]+)\/workspace\/Permissions(\/|$)/, to: (m) => `Workspaces/${m[1]}/Settings/Permissions` },
        { from: /^Users\/([^/]+)\/workspace\/ApprovalWorkflows(\/|$)/, to: (m) => `Workspaces/${m[1]}/Settings/ApprovalWorkflows` },
        { from: /^Users\/([^/]+)\/workspace\/CustomDashboardWidgets(\/|$)/, to: (m) => `Workspaces/${m[1]}/Settings/CustomDashboardWidgets` },
        { from: /^Users\/([^/]+)\/workspace\/([A-Za-z0-9_]+)$/, to: (m) => `Workspaces/${m[1]}/Settings/${m[2]}` },
        { from: /^Users\/([^/]+)\/CustomDashboardWidgets(\/|$)/, to: (m) => `Workspaces/${m[1]}/Settings/CustomDashboardWidgets` },
        { from: /^Users\/([^/]+)\/voucherApprovalFlow(\/|$)/, to: (m) => `Workspaces/${m[1]}/Settings/VoucherApprovalFlow` },
        { from: /^Users\/([^/]+)\/workspace\//, to: (m) => `Workspaces/${m[1]}/Settings/` },
        { from: /^TargetSheet$/,                to: () => `Workspaces/${workspaceId()}/Masters` },

        // Global utilities
        { from: /^Utilities\/Broadcasts(\/|$)/, to: () => 'Utilities/Broadcasts' },
        { from: /^Broadcasts(\/|$)/,            to: () => 'Utilities/Broadcasts' },
        { from: /^Utilities\/Updates(\/|$)/,    to: () => 'Utilities/Updates' },
        { from: /^Utilities\/Sessions(\/|$)/,   to: () => 'Utilities/Sessions' },
        { from: /^PlatformMaster(\/|$)/,        to: () => 'Utilities/PlatformMaster' },
        { from: /^MasterAuditLogs(\/|$)/,       to: () => 'Utilities/MasterAuditLogs' },
        { from: /^HelpCenter(\/|$)/,            to: () => 'Utilities/HelpCenter' },
        { from: /^Notifications(\/|$)/,         to: () => `Workspaces/${workspaceId()}/Notifications` },
        { from: /^Users$/,                      to: () => 'Utilities/Users' },
        { from: /^Users\/([^/]+)\/?$/,          to: (m) => `Utilities/Users/${m[1]}` },
        { from: /^Utilities\/Broadcasts(\/|$)/, to: () => 'Utilities/Broadcasts' }
    ];

    const mapPath = (p) => {
        const clean = String(p || '').replace(/^\/+|\/+$/g, '');
        if (!clean) return '/';
        if (clean === '.info' || clean.startsWith('.info/')) return clean;   // Firebase internal — pass through

        for (const rule of ROOTS) {
            const m = clean.match(rule.from);
            if (m) {
                const mapped = typeof rule.to === 'function' ? rule.to(m) : rule.to;
                const rest = clean.slice(m[0].length).replace(/^\/+/, '');
                return (mapped + (rest && !mapped.endsWith('/') ? '/' : '') + rest).replace(/\/+/g, '/');
            }
        }
        return clean;
    };

    if (window.firebase && typeof firebase.database === 'function' && !window.__unitaxPathMapperInstalled) {
        window.__unitaxPathMapperInstalled = true;
        // 1. Capture the ORIGINAL firebase.database function BEFORE we replace anything
        const _origDb = firebase.database;
        const _origServerValue = _origDb.ServerValue;
        const _origSdkVersion = _origDb.SdkVersion;

        // 2. Replace it with a wrapper — path-mapping ONLY, statics reattached directly
        const mapper = function (...args) {
            const raw = _origDb(...args);
            const origRef = raw.ref.bind(raw);
            raw.ref = function (p) { return origRef(mapPath(p)); };
            return raw;
        };
        // Copy own statics + inherit prototype-chain statics
        try { Object.setPrototypeOf(mapper, _origDb); } catch (e) {}
        try {
            Object.getOwnPropertyNames(_origDb).forEach(k => {
                if (k === 'prototype' || k === 'length' || k === 'name') return;
                try { mapper[k] = _origDb[k]; } catch (e) {}
            });
        } catch (e) {}
        firebase.database = mapper;
        window.UniPathMapper = { mapPath, workspaceId, raw: _origDb };
    }
})();
