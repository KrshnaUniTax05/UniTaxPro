/* UniTax List Viewer
   - Receives JSON payloads from any calling function.
   - Appends / shows JSON line items in a uniform list/table manner.
   - Shortcut (Ctrl|Cmd + Shift + L) triggers Print / Export for the currently shown data.
   - On open, captures the calling location (activeElement) and restores focus on hide.
   - Press Escape to leave (close) and return focus exactly where it was opened.
   - Global facade: window.UniTaxList
*/
(function () {
    'use strict';

    const state = {
        data: [],
        title: 'List',
        origin: null,
        lastFocused: null,
        seq: 0
    };

    let modalEl = null;
    let bodyEl = null;
    let titleEl = null;
    let exportBtn = null;
    let printBtn = null;

    const esc = (v) => {
        try {
            if (window.UniTaxUtils && typeof window.UniTaxUtils.EscapeHTML === 'function') return window.UniTaxUtils.EscapeHTML(String(v == null ? '' : v));
        } catch (e) {}
        return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    };

    function ensureModal() {
        if (modalEl && modalEl.isConnected) return modalEl;
        let el = document.getElementById('utListViewerModal');
        if (!el) {
            el = document.createElement('div');
            el.className = 'modal fade';
            el.id = 'utListViewerModal';
            el.tabIndex = -1;
            el.setAttribute('aria-hidden', 'true');
            el.innerHTML = `
                <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable" style="max-width: 960px;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="utListViewerTitle">List</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="utListViewerBody" style="background:#fff;">
                            <div class="text-center text-muted py-5"><i class="bi bi-inbox fs-4 d-block mb-2"></i>No list data.</div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary btn-sm" id="utListViewerExportJson"><i class="bi bi-file-earmark-code me-1"></i>Export JSON</button>
                            <button type="button" class="btn btn-outline-secondary btn-sm" id="utListViewerPrint"><i class="bi bi-printer me-1"></i>Print</button>
                            <button type="button" class="btn btn-primary btn-sm" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(el);
        }
        modalEl = el;
        bodyEl = document.getElementById('utListViewerBody');
        titleEl = document.getElementById('utListViewerTitle');
        exportBtn = document.getElementById('utListViewerExportJson');
        printBtn = document.getElementById('utListViewerPrint');
        if (exportBtn) exportBtn.onclick = () => window.UniTaxList.Export();
        if (printBtn) printBtn.onclick = () => window.UniTaxList.Print();
        return modalEl;
    }

    function collectKeys(rows) {
        const HIDDEN = ['key', 'formid']; // internal routing ids — never displayed
        const keys = [];
        (Array.isArray(rows) ? rows : [rows]).forEach(r => {
            const o = (r && typeof r === 'object') ? r : { value: r };
            Object.keys(o).forEach(k => { if (k && HIDDEN.indexOf(String(k).toLowerCase()) === -1 && keys.indexOf(k) === -1) keys.push(k); });
        });
        if (!keys.length) keys.push('value');
        return keys;
    }

    function render() {
        const el = ensureModal();
        const data = Array.isArray(state.data) ? state.data : (state.data ? [state.data] : []);
        if (!bodyEl) return;
        if (!data.length) {
            bodyEl.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-inbox fs-4 d-block mb-2"></i>No list data.</div>`;
        } else {
            const keys = collectKeys(data);
            const itemsHtml = data.map((r, i) => {
                const o = (r && typeof r === 'object') ? r : { value: r };
                const firstKey = keys[0] || 'value';
                const keyVal = String(o.key != null ? o.key : (o.id != null ? o.id : (o[firstKey] == null ? (o.value == null ? `ROW-${i + 1}` : o.value) : o[firstKey])));
                const formIdVal = String(o.formId != null ? o.formId : '');
                const checkCell = `<div class="px-3 py-2" style="vertical-align:middle;background:#fff;"><input type="checkbox" class="ut-lv-check form-check-input" data-lv-key="${esc(keyVal)}" data-lv-idx="${i}"></div>`;
                const valCells = keys.map(k => `<div class="px-3 py-2" style="vertical-align:top;background:#fff;"><span class="text-muted me-1" style="font-size:10px;">${esc(k)}:</span> ${esc(o[k])}</div>`);
                const hamCell = `<div class="px-3 py-2 text-end" style="background:#fff;"><button type="button" class="btn btn-sm btn-outline-secondary" data-lv-ham-toggle="1" data-lv-key="${esc(keyVal)}" data-lv-idx="${i}" title="Row actions"><i class="bi bi-list"></i></button><div class="ut-lv-menu d-none" style="position:absolute;z-index:1050;"><button type="button" class="dropdown-item ut-lv-act" data-lv-act="append">Append</button><button type="button" class="dropdown-item ut-lv-act" data-lv-act="open">Open in Edit</button><button type="button" class="dropdown-item ut-lv-act" data-lv-act="print">Print Row</button></div></div>`;
                const cells = [checkCell].concat(valCells, [hamCell]);
                const rowOpen = `<div class="list-group-item px-3 py-2 ut-lv-row" data-lv-open="1" data-lv-key="${esc(keyVal)}" data-lv-formid="${esc(formIdVal)}" data-lv-idx="${i}" style="background:#fff; display:block;">${cells.join('')}</div>`;
                return rowOpen;
            }).join('');
            bodyEl.innerHTML = `
                <div class="mb-2 small text-muted">Showing ${data.length} item(s)</div>
                <div class="list-group list-group-flush border rounded shadow-sm" style="max-height: 55vh; overflow:auto;">
                    ${itemsHtml}
                </div>`;
        }
        if (titleEl) titleEl.textContent = state.title || 'List';
    }

    function show(payload, opts) {
        state.data = payload == null ? [] : (Array.isArray(payload) ? payload.slice() : [payload]);
        if (opts && opts.title) state.title = opts.title;
        state.seq += 1;
        const el = ensureModal();
        render();
        state.lastFocused = document.activeElement;
        if (!state.origin) state.origin = document.activeElement;
        try { (window.bootstrap && window.bootstrap.Modal) ? window.bootstrap.Modal.getOrCreateInstance(el).show() : (window.bootstrap && bootstrap.Modal ? bootstrap.Modal.getOrCreateInstance(el).show() : el.classList.add('show')); } catch (e) { try { el.classList.add('show'); } catch (e2) {} }
        return true;
    }

    function append(payload, opts) {
        const incoming = payload == null ? [] : (Array.isArray(payload) ? payload : [payload]);
        const prev = Array.isArray(state.data) ? state.data : [];
        state.data = prev.concat(incoming);
        if (opts && opts.title) state.title = opts.title;
        state.seq += 1;
        render();
        const el = ensureModal();
        try { (window.bootstrap && window.bootstrap.Modal) ? window.bootstrap.Modal.getOrCreateInstance(el).show() : (window.bootstrap && bootstrap.Modal ? bootstrap.Modal.getOrCreateInstance(el).show() : el.classList.add('show')); } catch (e) { try { el.classList.add('show'); } catch (e2) {} }
        return true;
    }

    function hide() {
        const el = ensureModal();
        try { if (window.bootstrap && window.bootstrap.Modal) window.bootstrap.Modal.getOrCreateInstance(el).hide(); else if (window.bootstrap && bootstrap.Modal) bootstrap.Modal.getOrCreateInstance(el).hide(); else { el.classList.remove('show'); el.style.display = 'none'; } } catch (e) {}
        if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
            try { state.lastFocused.focus(); } catch (e2) {}
        }
        state.lastFocused = null;
        state.origin = null;
    }

    function exportJson() {
        const data = Array.isArray(state.data) ? state.data : (state.data ? [state.data] : []);
        try {
            const blob = new Blob([JSON.stringify({ module: 'list-viewer', seq: state.seq, data }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `list-export-${state.seq}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {}
        return data;
    }

    function print() { try { window.print(); } catch (e) {} return state.data; }

    function install() {
        const onKey = (e) => {
            const key = e.key || e.keyIdentifier || '';
            const mod = e.ctrlKey || e.metaKey;
            const inListShow = /utilities\/list-show/.test((window.location && window.location.hash) || '');
            if (e.key === 'Escape') {
                const sharedMenu = document.getElementById('lsRowMenu');
                if (sharedMenu && sharedMenu.style.display === 'block') { sharedMenu.style.display = 'none'; return; }
                if (inListShow) { goBackToOrigin(); } else { hide(); } return;
            }
            if (mod && (e.shiftKey) && (String(key).toLowerCase() === 'l')) { e.preventDefault(); exportJson(); return; }
        };
        document.addEventListener('keydown', onKey, true);

        const onClick = async (e) => {
            const actEl = e.target && e.target.closest ? e.target.closest('[data-lv-act]') : null;
            const hamEl = e.target && e.target.closest ? e.target.closest('[data-lv-ham-toggle]') : null;
            const openEl = e.target && e.target.closest ? e.target.closest('[data-lv-open]') : null;
            if (actEl) {
                const act = String(actEl.getAttribute('data-lv-act') || '');
                const keyVal = actEl.closest('[data-lv-open]') ? (actEl.closest('[data-lv-open]').getAttribute('data-lv-key') || '') : '';
                const idxRaw = actEl.closest('[data-lv-open]') ? (actEl.closest('[data-lv-open]').getAttribute('data-lv-idx') || '') : '';
                const idx = parseInt(idxRaw || '0', 10);
                const data = Array.isArray(state.data) ? state.data : [];
                const row = (Number.isInteger(idx) && idx >= 0 && idx < data.length) ? data[idx] : null;
                if (act === 'append') { if (row) window.UniTaxList.Append([row], { title: state.title + ' Row ' + (idx + 1) }); return; }
                if (act === 'open') { const openEl = actEl.closest('[data-lv-open]'); const fk = openEl ? (openEl.getAttribute('data-lv-formid') || '') : ''; window.UniTaxList.OpenInEdit(row ? String((row && typeof row === 'object') ? (row.key || row.id || row.docNo || '') : '') : '', fk); return; }
                if (act === 'print') { if (row) window.UniTaxList.Print(); return; }
                return;
            }
            if (hamEl) {
                const wrap = hamEl.closest ? hamEl.closest('.ut-lv-ham-wrap') || hamEl.parentElement : hamEl.parentElement;
                const menu = wrap ? wrap.querySelector('[data-lv-menu]') : null;
                if (menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
                return;
            }
        };
        const onDbl = async (e) => {
            const openEl = e.target && e.target.closest ? e.target.closest('[data-lv-open]') : null;
            if (!openEl) return;
            const keyVal = openEl.getAttribute('data-lv-key') || '';
            const formId = openEl.getAttribute('data-lv-formid') || '';
            window.UniTaxList.OpenInEdit(keyVal, formId);
        };
        document.addEventListener('click', onClick, true);
        document.addEventListener('dblclick', onDbl, true);
        return () => { try { document.removeEventListener('keydown', onKey, true); } catch (e) {} try { document.removeEventListener('click', onClick, true); } catch (e) {} try { document.removeEventListener('dblclick', onDbl, true); } catch (e) {} };
    }

    // Generic adapter: capture a DOM table (thead labels become column defs, tbody rows become uniform rows)
    // and route it through the routed List Viewer window. Skips pure-action/checkbox/empty/loading columns.
    const openTable = (selector, opts) => {
        try {
            const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (!el) return false;
            const ths = Array.from(el.querySelectorAll('thead th'));
            const columns = [];
            ths.forEach((th, i) => {
                const label = String((th && (th.innerText || th.textContent)) || '').trim();
                if (!label || /^(#|sr\.?\s*no\.?|action|actions|view|edit|delete|print|options?)$/i.test(label)) return;
                columns.push({
                    key: 'c' + i,
                    label,
                    num: /(amount|debit|credit|balance|qty|quantity|rate|tax|total|value|opening|closing|stock)/i.test(label),
                    cls: ''
                });
            });
            if (!columns.length) return false;
            const rows = [];
            el.querySelectorAll('tbody tr').forEach(tr => {
                const tds = Array.from(tr.querySelectorAll('td'));
                if (tds.length !== tds.length) return; // noop guard
                if (tds.length < 2) return;           // loading / empty placeholder rows with colspan
                const colspanOnly = tds.length === 1 && (tds[0].colSpan || 1) > 1;
                if (colspanOnly) return;
                const row = {};
                tds.forEach((td, i) => { row['c' + i] = String((td && (td.innerText || td.textContent)) || '').replace(/\s+/g, ' ').trim(); });
                columns.forEach(c => { if (row[c.key] === undefined) row[c.key] = ''; });
                row.key = (opts && opts.keyFromCell != null) ? (row['c' + opts.keyFromCell] || '') : '';
                row.formId = (opts && opts.formIdFromCell != null) ? (row['c' + opts.formIdFromCell] || '') : '';
                rows.push(row);
            });
            return openWindow(rows, {
                title: opts && opts.title,
                meta: {
                    columns,
                    onOpen: opts && opts.onOpen,
                    onDelete: opts && opts.onDelete
                }
            });
        } catch (e) { return false; }
    };

    function openInEdit(key, type) {
        try {
            const k = String(key || '');
            const t = String(type || '');
            if (!k) return false;
            try { localStorage.setItem('editContext', JSON.stringify({ type: t, key: k, returnRoute: 'utilities/list-show' })); } catch (e2) {}
            const qs = t ? `type=${encodeURIComponent(t)}&key=${encodeURIComponent(k)}` : `key=${encodeURIComponent(k)}`;
            if (window.UniTaxRouter && typeof window.UniTaxRouter.Navigate === 'function') window.UniTaxRouter.Navigate(`transactions/edit?${qs}`);
            else if (window.location) window.location.hash = `#/transactions/edit?${qs}`;
        } catch (e) {}
        return true;
    }

    function openWindow(payload, opts) {
        state.data = payload == null ? [] : (Array.isArray(payload) ? payload.slice() : [payload]);
        if (opts && opts.title) state.title = opts.title;
        state.seq += 1;
        state.WindowData = state.data;
        state.meta = (opts && opts.meta) || null;
        try { window.UniTaxList.WindowData = state.data; } catch (e) {}
        try { window.UniTaxList.Meta = state.meta; } catch (e) {}
        try { state.originHash = (window.location && window.location.hash) ? window.location.hash : ''; } catch (e) {}
        const route = 'utilities/list-show';
        if (window.UniTaxRouter && typeof window.UniTaxRouter.Navigate === 'function') window.UniTaxRouter.Navigate(route);
        else if (window.location) window.location.hash = `#/${route}`;
        return true;
    }

    function goBackToOrigin() {
        hide();
        const h = state.originHash || '';
        try {
            if (window.UniTaxRouter && typeof window.UniTaxRouter.Navigate === 'function') {
                const mod = h ? h.replace(/^#\/?/, '').split('?')[0] : 'dashboard';
                window.UniTaxRouter.Navigate(mod);
            } else if (window.location) {
                if (h) window.location.hash = h;
                else window.location.hash = '#/dashboard';
            }
        } catch (e) {}
        return true;
    }

    window.UniTaxList = {
        Show: show,
        Append: append,
        OpenWindow: openWindow,
        Hide: hide,
        Export: exportJson,
        Print: print,
        Install: install,
        OpenInEdit: openInEdit,
        OpenWindow: openWindow,
        OpenTable: openTable,
        GoBackToOrigin: goBackToOrigin,
        State: () => ({ data: state.data, title: state.title, origin: state.origin, meta: state.meta })
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.UniTaxList.Install());
    } else {
        window.UniTaxList.Install();
    }
})();
