/**
 * UniTax Approval Engine — single source of truth for the approval subsystem.
 *
 * STATE MACHINE
 * ────────────
 *   DRAFT / PENDING_APPROVAL → PENDING_APPROVAL (hierarchy, level by level)
 *   last level approves      → state=APPROVED, status=POSTED (voucher) / APPROVED (request)
 *   ANY level rejects        → state=RETURNED_TO_CREATOR, status=REJECTED
 *                              initiator edits & resubmits; flow resumes AT the rejecting level
 *   initiator/admin delete   → tombstoned (is_deleted, removed from ALL queues)
 *
 * Rejection ALWAYS returns the document to the INITIATOR (for both vouchers and
 * requisitions). No general / counter-party line items, vouchers or GL entries are
 * created on rejection — only the request record's state is flipped.
 */
(function (global) {
    const APPROVAL_STATES = {
        PENDING: 'PENDING',
        APPROVED: 'APPROVED',
        POSTED: 'POSTED',
        RETURNED: 'RETURNED_TO_CREATOR',
        REJECTED: 'REJECTED',
        DELETED: 'DELETED'
    };

    const isValidKey = (key) => !!key && !/[.#$/\[\]\u0000-\u001f]/.test(String(key));

    /** Firebase serialises sparse arrays as objects — always work with dense arrays. */
    const toHierarchyArray = (value) => {
        if (Array.isArray(value)) return value.filter(Boolean);
        if (!value || typeof value !== 'object') return [];
        return Object.keys(value)
            .sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0))
            .map(k => value[k])
            .filter(Boolean);
    };

    /** Normalise any request/requisition record. */
    const normalizeRequest = (rec) => {
        if (!rec || typeof rec !== 'object') return rec;
        rec.hierarchy = toHierarchyArray(rec.hierarchy);
        const idx = parseInt(rec.currentLevelIndex, 10);
        rec.currentLevelIndex = Number.isInteger(idx) && idx >= 0 ? Math.min(idx, Math.max(0, rec.hierarchy.length - 1)) : 0;
        return rec;
    };

    /** Derive a coarse lifecycle for UI grouping. */
    const lifecycleOf = (rec) => {
        if (!rec || typeof rec !== 'object') return 'OTHER';
        if (rec.is_deleted === true || rec.is_deleted === 'true') return 'DELETED';
        const status = String(rec.status || '').toUpperCase();
        const state = String(rec.state || '').toUpperCase();
        if (['DELETED', 'PURGED'].includes(status) || state === 'DELETED') return 'DELETED';
        if (['POSTED', 'APPROVED', 'VERIFIED', 'COMPLETED'].includes(status) || state === 'APPROVED') return 'APPROVED';
        if (['REJECTED', 'RETURNED', 'RETURNED_TO_CREATOR', 'CANCELLED'].includes(status) || ['REJECTED', 'RETURNED_TO_CREATOR'].includes(state)) return 'RETURNED';
        return 'PENDING';
    };

    const matchesUser = (id, name, me) => {
        if (!me) return false;
        const tId = String(id || '').trim().toLowerCase();
        const tName = String(name || '').trim().toLowerCase();
        const mId = String(me.userId || '').trim().toLowerCase();
        const mWs = String(me.wsId || '').trim().toLowerCase();
        const mName = String(me.userName || '').trim().toLowerCase();
        if (tId && (tId === mId || tId === mWs)) return true;
        if (tName && mName && tName === mName) return true;
        return false;
    };

    /** Who is the current approver? */
    const currentApproverOf = (req) => {
        if (!req || !Array.isArray(req.hierarchy)) return null;
        return req.hierarchy[req.currentLevelIndex] || null;
    };

    /** How many contiguous levels are approved? */
    const contiguousApprovedPrefix = (hierarchy) => {
        let n = 0;
        for (let i = 0; i < (hierarchy || []).length; i++) {
            if (String(hierarchy[i].status || '').toUpperCase() === 'APPROVED') n++;
            else break;
        }
        return n;
    };

    const getApprovalVerdict = (req, me) => {
        req = normalizeRequest(req);
        const cur = currentApproverOf(req);
        const isAssignedToMe = req.hierarchy.length > 0 && req.currentLevelIndex < req.hierarchy.length &&
            cur && matchesUser(cur.userId, cur.userName || cur.name, me);
        const lowerApproved = req.hierarchy.slice(0, req.currentLevelIndex).every(h => String(h.status || '').toUpperCase() === 'APPROVED');
        const isCreator = matchesUser(req.requesterId, req.requesterName, me) ||
            matchesUser(req.posted_by, req.posted_by_name, me);
        const isAdmin = !!me.isAdmin;
        return {
            isAssignedToMe,
            isCreator,
            isAdmin,
            canAct: (isAssignedToMe || isAdmin) && lowerApproved &&
                String(req.state || 'PENDING').toUpperCase() === 'PENDING',
            isLastLevel: req.hierarchy.length === 0 || req.currentLevelIndex >= req.hierarchy.length - 1
        };
    };

    const decisionFor = (role) => {
        // Human-friendly consequence table for the UI (documented in UI tooltips).
        switch (role) {
            case 'initiator': return 'Returns to you for revision; no ledger/posting changes are made.';
            case 'approval': return 'Advances to the next hierarchy level.';
            case 'finalApproval': return 'Approves and posts the document to the General Ledger.';
            case 'rejection': return 'Rejects; document returns to the initiator. No line items are created.';
            case 'resubmit': return 'Initiator edits and resubmits; flow resumes from the rejecting level.';
            case 'delete': return 'Deletes for ALL users and every queue. Cannot be undone.';
            default: return '';
        }
    };

    const wsIdOf = () => String(
        (typeof App !== 'undefined' && App.State && App.State.userId) ||
        localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid') || ''
    ).trim().replace(/^#/, '');

    const userIdOf = () => String(
        (typeof App !== 'undefined' && App.State && (App.State.currentuserId || App.State.currentUserId)) ||
        localStorage.getItem('userloginid') || localStorage.getItem('userId') || ''
    ).trim().replace(/^#/, '');

    const userNameOf = () => String(
        (typeof App !== 'undefined' && App.State && App.State.userName) ||
        localStorage.getItem('userName') || localStorage.getItem('username') || 'User'
    ).trim();

    const isAdminUser = () => {
        const role = String((typeof App !== 'undefined' && App.State && App.State.userRole) || localStorage.getItem('userrole') || '').trim().toLowerCase();
        const masterControl = String(localStorage.getItem('masterControl') || '').trim().toLowerCase();
        const me = userIdOf();
        const ws = wsIdOf();
        return ['administrator', 'super_administrator', 'admin', 'co_useradmin', 'co_admin', 'workspaceowner', 'owner', 'master_admin', 'platform_admin'].includes(role) ||
            masterControl === 'administration' || masterControl === 'master' || (me && ws && me === ws);
    };

    /** Read state for the current user (server-first, local fallback). */
    const readPath = () => {
        const ws = wsIdOf();
        const uid = userIdOf();
        if (!ws || !uid) return null;
        return `Users/${ws}/workspace/NotificationReadState/${uid}`;
    };

    const getLocalReadSet = () => {
        try { return new Set(JSON.parse(localStorage.getItem('unitax_notif_read') || '[]')); } catch (e) { return new Set(); }
    };

    const saveLocalReadSet = (set) => {
        try { localStorage.setItem('unitax_notif_read', JSON.stringify(Array.from(set))); } catch (e) {}
    };

    const markNotifRead = (id) => {
        if (!id) return;
        const local = getLocalReadSet();
        local.add(id);
        saveLocalReadSet(local);
        const path = readPath();
        if (!path || typeof firebase === 'undefined') return;
        const updates = {};
        updates[id] = true;
        firebase.database().ref(path).update(updates).catch(() => {});
    };

    /** Push a notification to both global + workspace scopes. */
    const notify = async (targetUserId, { title, message, link, tab, typeoft, dedupeKey }) => {
        if (typeof firebase === 'undefined' || !firebase.database) return null;
        if (!targetUserId) return null;
        const db = firebase.database();
        const wsScope = wsIdOf();
        const sender = userIdOf() || 'system';
        const senderName = userNameOf();
        const payload = {
            title: title,
            belonging: 'Approval Notification',
            message: message,
            link: link || 'reports/approvalmanagementsystem',
            sender: sender,
            senderName: senderName,
            target: targetUserId,
            timestamp: Date.now(),
            type: typeoft || 'task',
            tab: tab || '',
            dedupeKey: dedupeKey || ('approval-' + Date.now()),
            ReadStatus: { [sender]: 'read' }
        };
        try { await db.ref('Utilities/Notifications').push(payload); } catch (e) {}
        if (wsScope) { try { await db.ref(`${wsScope}/Utilities/Notifications`).push(payload); } catch (e) {} }
        return payload;
    };

    /** Build multi-path updates for a notification to the current user ONLY (public API). */
    const notifyCurrentUser = async (opts) => notify(userIdOf(), opts);

    /** Resolve real Firebase keys for a voucher description (never synthesise from doc number). */
    const resolveTransactionKeys = async (formId, txnKey, docNo) => {
        const wsScope = wsIdOf();
        const candidates = [txnKey, docNo].filter(Boolean).map(String);
        const bases = [];
        if (wsScope) bases.push(`${wsScope}/Transactions/${formId}`);
        bases.push(`Transactions/${formId}`);
        if (wsScope) bases.push(`Users/${wsScope}/Transactions/${formId}`);
        const found = new Set();
        for (const base of bases) {
            try {
                const snap = await firebase.database().ref(base).once('value');
                const val = snap && snap.val();
                if (!val || typeof val !== 'object') continue;
                Object.entries(val).forEach(([key, rec]) => {
                    if (!isValidKey(key)) return;
                    const hdr = (rec && rec.header) || rec || {};
                    const doc = String(hdr.doc_no || hdr.docNo || (rec && rec.docNo) || '');
                    if (candidates.includes(key) || (doc && candidates.includes(doc))) found.add(key);
                });
            } catch (e) {}
        }
        if (found.size === 0 && isValidKey(txnKey)) found.add(String(txnKey));
        return Array.from(found).filter(isValidKey);
    };

    /** Resolve request-record keys that actually exist (never synthesise VCH-*). */
    const resolveRequestIds = async (formId, txnKeys, reqId) => {
        const wsScope = wsIdOf();
        const bases = ['Utilities/Requests'];
        if (wsScope) bases.push(`${wsScope}/Utilities/Requests`);
        const found = new Set();
        for (const base of bases) {
            try {
                const snap = await firebase.database().ref(base).once('value');
                const val = snap && snap.val();
                if (!val || typeof val !== 'object') continue;
                Object.entries(val).forEach(([key, rec]) => {
                    if (!isValidKey(key) || !rec || typeof rec !== 'object') return;
                    const matches = (reqId && String(key) === String(reqId)) ||
                        (txnKeys && txnKeys.includes(String(rec.transactionKey))) ||
                        (formId && rec.formId === formId && txnKeys && txnKeys.includes(String(rec.transactionKey))) ||
                        (rec.docNo && txnKeys && txnKeys.includes(String(rec.docNo)));
                    if (matches) found.add(key);
                });
            } catch (e) {}
        }
        return Array.from(found);
    };

    const transactionBases = (formId) => {
        const ws = wsIdOf();
        const bases = [];
        if (ws) bases.push(`${ws}/Transactions/${formId}`);
        bases.push(`Transactions/${formId}`);
        if (ws) bases.push(`Users/${ws}/Transactions/${formId}`);
        return bases;
    };

    const requestBases = () => {
        const ws = wsIdOf();
        const bases = ['Utilities/Requests'];
        if (ws) bases.push(`${ws}/Utilities/Requests`);
        return bases;
    };

    /** Write decision (never posts/rejects outside own routes). */
    const me = () => ({ wsId: wsIdOf(), userId: userIdOf(), userName: userNameOf(), isAdmin: isAdminUser() });

    const approveRequirement = () => {
        return { mode: 'SEQUENTIAL', description: 'Level-by-level, contiguous prefix must approve.' };
    };

    const $ = {
        APPROVAL_STATES,
        isValidKey,
        toHierarchyArray,
        normalizeRequest,
        lifecycleOf,
        matchesUser,
        currentApproverOf,
        contiguousApprovedPrefix,
        getApprovalVerdict,
        decisionFor,
        wsIdOf,
        userIdOf,
        userNameOf,
        isAdminUser,
        readPath,
        getLocalReadSet,
        saveLocalReadSet,
        markNotifRead,
        notify,
        notifyCurrentUser,
        resolveTransactionKeys,
        resolveRequestIds,
        transactionBases,
        requestBases,
        me,
        approveRequirement
    };

    global.ApprovalEngine = $;
})(typeof window !== 'undefined' ? window : globalThis);
