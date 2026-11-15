/**
 * UNITAX PRO - SAP-STYLE MASTER DRILL-DOWN
 * ---------------------------------------------------------------------------
 * Double-click any read-only / disabled master-backed field (static metadata,
 * posted voucher lines, approval snapshots) to inspect the record it came from
 * inside the source master form, rendered in read-only view mode.
 *
 * Usage:
 *   <input data-master-sheet="LedgerCreation" readonly value="HDFC Bank (1002001)">
 *   <input data-master-sheet="Companies" disabled value="Unitax Pvt Ltd (CMP-01)">
 *
 * Behaviour:
 *   - readonly / disabled inputs open on double-click.
 *   - editable master-backed inputs open on Ctrl (or Cmd) + double-click.
 *   - the source master definition is fetched once and cached per session.
 */
(function () {
    'use strict';

    const REGISTRY = {
        ledgercreation: {
            module: 'modules/masters/ledger-cw.html',
            route: 'masters/ledger-cw',
            formId: 'LedgerCreation',
            title: 'General Ledger',
            aliases: ['ledger', 'ledgers', 'accounts', 'account', 'chartofaccounts'],
            codeFields: ['ledgerCode', 'ledger_code', 'code', 'LedgerCode'],
            nameFields: ['name', 'ledgerName', 'ledger_name', 'accountName']
        },
        companies: {
            module: 'modules/masters/company-cw.html',
            route: 'masters/company-cw',
            formId: 'Companies',
            title: 'Company Master',
            aliases: ['company', 'companymaster', 'organisation', 'organization'],
            codeFields: ['CompanyCode', 'companyCode', 'code'],
            nameFields: ['companyName', 'CompanyName', 'name']
        },
        projects: {
            module: 'modules/masters/project-cw.html',
            route: 'masters/project-cw',
            formId: 'Projects',
            title: 'Profit Center / Project',
            aliases: ['project', 'profitcenter', 'costcenter', 'projectmaster'],
            codeFields: ['ProjectCode', 'projectCode', 'code'],
            nameFields: ['ProjectName', 'projectName', 'name']
        },
        stock: {
            module: 'modules/masters/stock-cw.html',
            route: 'masters/stock-cw',
            formId: 'Stock',
            title: 'Stock / Material',
            aliases: ['stock', 'item', 'items', 'material', 'inventory', 'stockmaster'],
            codeFields: ['Stock_Code', 'stockCode', 'itemCode', 'code'],
            nameFields: ['itemName', 'name', 'stockName', 'item_name']
        }
    };

    const norm = (v) => String(v == null ? '' : v)
        .toLowerCase()
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
    const key = (v) => norm(v).replace(/[^a-z0-9]/g, '');
    const esc = (v) => String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const htmlCache = Object.create(null);
    const htmlInflight = Object.create(null);
    const recordCache = Object.create(null);

    function registryFor(sheet) {
        if (!sheet) return null;
        const k = key(sheet);
        for (const entry of Object.values(REGISTRY)) {
            if (key(entry.formId) === k) return entry;
            if ((entry.aliases || []).some((a) => key(a) === k)) return entry;
        }
        return null;
    }

    function sheetFor(input) {
        const direct = input.dataset.masterSheet
            || input.dataset.sheetName
            || input.dataset.sheet_name
            || input.getAttribute('data-master-sheet')
            || input.getAttribute('data-sheet_name');
        if (direct && registryFor(direct)) return direct;
        return null;
    }

    function candidatesFromValue(raw) {
        const value = String(raw || '').trim();
        if (!value) return [];
        const out = [value];
        const groups = value.match(/\(([^()]+)\)/g) || [];
        groups.forEach((g) => {
            const inner = g.slice(1, -1).trim();
            if (inner) out.push(inner);
        });
        const head = value.replace(/\([^()]*\)/g, '').trim();
        if (head && head !== value) out.push(head);
        const tail = value.split(/[-–—|/]/).pop();
        if (tail && tail.trim() && tail.trim() !== value) out.push(tail.trim());
        return Array.from(new Set(out.map((x) => x.trim()).filter(Boolean)));
    }

    function toRecords(data) {
        if (!data || typeof data !== 'object') return [];
        if (Array.isArray(data)) return data.filter((r) => r && typeof r === 'object');
        return Object.entries(data)
            .map(([k, v]) => (v && typeof v === 'object' ? Object.assign({ __key: k }, v) : null))
            .filter(Boolean);
    }

    function fetchJson(path) {
        if (!window.API || typeof API.Fetch !== 'function') return Promise.resolve(null);
        return Promise.resolve(API.Fetch(path)).catch(() => null);
    }

    async function loadRecords(sheet, entry) {
        const ck = key(sheet);
        if (recordCache[ck]) return recordCache[ck];

        let data = (window.API && API._MasterCache && API._MasterCache[sheet]) || null;
        if (!data && window.API && API._MasterCache) {
            const hit = Object.keys(API._MasterCache).find((k) => key(k) === ck);
            if (hit) data = API._MasterCache[hit];
        }
        if (!data) data = await fetchJson(`Masters/${sheet}`);
        if (!data && entry && entry.formId !== sheet) data = await fetchJson(`Masters/${entry.formId}`);

        // Some tenants wrap the register payload as { data: ... } / { result: ... }.
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            const inner = data.data || data.result;
            if (inner && typeof inner === 'object' && Object.keys(inner).length > 0) data = inner;
        }

        // Ledger register fallback mirrors the datalist engine.
        const empty = !data || (typeof data === 'object' && Object.keys(data).length === 0);
        if (empty && key(sheet) === 'ledgercreation') {
            for (const alt of ['Ledgers', 'Ledger', 'Accounts']) {
                const altData = await fetchJson(`Masters/${alt}`);
                if (altData && typeof altData === 'object' && Object.keys(altData).length > 0) {
                    data = altData;
                    break;
                }
            }
        }
        if (empty && key(sheet) === 'stock' && window.API && Array.isArray(API._MasterCache.Stock)) {
            data = API._MasterCache.Stock;
        }

        const records = toRecords(data);
        if (records.length) recordCache[ck] = records;
        return records;
    }

    function fieldsOf(record, names) {
        const wanted = names.map(key);
        const out = [];
        Object.keys(record).forEach((k) => {
            if (wanted.includes(key(k))) out.push(record[k]);
        });
        return out.filter((v) => v != null && String(v).trim() !== '');
    }

    function findRecord(records, rawValue, entry) {
        const needles = candidatesFromValue(rawValue);
        if (!needles.length) return null;
        const needleKeys = needles.map(key);
        const needleNorms = needles.map(norm);
        const codeHints = (entry.codeFields || []).map(key);
        const nameHints = (entry.nameFields || []).map(key);

        const score = (record) => {
            let best = 0;
            Object.entries(record).forEach(([field, raw]) => {
                if (raw == null || typeof raw === 'object') return;
                const fk = key(field);
                const vk = key(raw);
                if (!vk) return;
                const isCode = codeHints.includes(fk) || /code$|number$|no$/.test(fk);
                const isName = nameHints.includes(fk) || /name$/.test(fk);
                const weight = isCode ? 6 : (isName ? 4 : 1);
                if (needleKeys.includes(vk)) best = Math.max(best, 100 * weight);
                else if (needleNorms.some((n) => n === norm(raw))) best = Math.max(best, 60 * weight);
                else if (needleKeys.some((n) => n.length > 3 && vk.includes(n))) best = Math.max(best, 10 * weight);
            });
            return best;
        };

        let winner = null;
        let winnerScore = 0;
        records.forEach((record) => {
            const s = score(record);
            if (s > winnerScore) { winnerScore = s; winner = record; }
        });
        return winnerScore > 0 ? winner : null;
    }

    function valueFor(record, name) {
        if (!record || typeof record !== 'object') return '';
        const target = key(name);
        if (!target) return '';
        if (record[name] != null) return record[name];
        const hit = Object.keys(record).find((k) => key(k) === target);
        return hit ? record[hit] : '';
    }

    function loadMasterMarkup(entry) {
        const path = entry.module;
        if (htmlCache[path]) return Promise.resolve(htmlCache[path]);
        if (htmlInflight[path]) return htmlInflight[path];
        htmlInflight[path] = fetch(path)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            })
            .then((text) => {
                htmlCache[path] = text;
                delete htmlInflight[path];
                return text;
            })
            .catch((err) => {
                delete htmlInflight[path];
                throw err;
            });
        return htmlInflight[path];
    }

    function buildFormView(markup, entry, record) {
        const parsed = new DOMParser().parseFromString(String(markup || ''), 'text/html');
        let form = parsed.getElementById(entry.formId);
        if (!form) {
            form = Array.from(parsed.querySelectorAll('form'))
                .find((f) => key(f.id) === key(entry.formId)) || parsed.querySelector('form');
        }
        if (!form) return null;

        const clone = form.cloneNode(true);

        clone.querySelectorAll('script, style, datalist, button, .unitax-header, .card-header, .modal-header, .modal-footer, .offcanvas-header')
            .forEach((el) => el.remove());
        clone.querySelectorAll('[onclick], [onchange], [oninput], [onsubmit]')
            .forEach((el) => {
                el.removeAttribute('onclick');
                el.removeAttribute('onchange');
                el.removeAttribute('oninput');
                el.removeAttribute('onsubmit');
            });

        clone.querySelectorAll('input, select, textarea').forEach((ctrl) => {
            if (ctrl.tagName === 'INPUT' && (ctrl.type === 'hidden' || ctrl.type === 'file')) {
                ctrl.remove();
                return;
            }
            const name = ctrl.getAttribute('name') || '';
            let value = valueFor(record, name);

            if (ctrl.tagName === 'SELECT') {
                const wanted = norm(value);
                if (wanted) {
                    const opt = Array.from(ctrl.options || [])
                        .find((o) => norm(o.value) === wanted || norm(o.textContent) === wanted);
                    if (opt) value = opt.textContent.trim();
                } else {
                    const sel = ctrl.options && ctrl.selectedIndex >= 0 ? ctrl.options[ctrl.selectedIndex] : null;
                    value = sel ? sel.textContent.trim() : '';
                }
            } else if (ctrl.type === 'checkbox') {
                value = (value === true || norm(value) === 'true' || norm(value) === 'yes') ? 'Yes' : 'No';
            } else if (ctrl.type === 'radio') {
                if (ctrl.checked && !value) value = ctrl.value;
            }

            const present = value != null && String(value).trim() !== '';
            const out = parsed.createElement('div');
            out.className = 'ut-dd-static' + (present ? '' : ' is-empty');
            out.textContent = present ? String(value) : '—';
            ctrl.replaceWith(out);
        });

        clone.querySelectorAll('.form-label').forEach((label) => {
            if (!norm(label.textContent)) label.remove();
        });
        clone.querySelectorAll('input[type="hidden"]').forEach((el) => el.remove());

        return clone.innerHTML;
    }

    /* ------------------------------ MODAL UI ------------------------------ */
    const STYLES = `
    .ut-dd .modal-content { border: 0; border-radius: 14px; overflow: hidden; box-shadow: 0 30px 80px -30px rgba(15,23,42,.55); }
    .ut-dd .modal-header { background: #0f172a; color: #f8fafc; border: 0; padding: 14px 18px; align-items: flex-start; }
    .ut-dd .ut-dd-eyebrow { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: #93c5fd; }
    .ut-dd .ut-dd-title { font-size: 1rem; font-weight: 700; line-height: 1.3; margin: 2px 0 0; }
    .ut-dd .ut-dd-sub { font-size: 11px; color: #cbd5e1; margin-top: 2px; }
    .ut-dd .btn-close { filter: invert(1) grayscale(1) brightness(2); opacity: .75; }
    .ut-dd .modal-body { padding: 16px 18px; background: #f8fafc; }
    .ut-dd .ut-dd-sheet { background: #fff; border: 1px solid #e6ebf2; border-radius: 10px; padding: 14px 16px; }
    .ut-dd .ut-dd-sheet h6 { font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: #2563eb; font-weight: 700; margin: 14px 0 8px; }
    .ut-dd .ut-dd-sheet h6:first-child { margin-top: 0; }
    .ut-dd .ut-dd-sheet .form-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; font-weight: 700; margin-bottom: 2px; }
    .ut-dd .ut-dd-static { font-size: 12.5px; font-weight: 600; color: #0f172a; background: #f8fafc; border: 1px solid #eef2f7; border-radius: 7px; padding: 5px 9px; min-height: 30px; word-break: break-word; }
    .ut-dd .ut-dd-static.is-empty { color: #94a3b8; font-weight: 500; }
    .ut-dd .modal-footer { background: #fff; border-top: 1px solid #e6ebf2; padding: 10px 18px; gap: 8px; }
    .ut-dd .ut-dd-hint { margin-right: auto; font-size: 10.5px; color: #94a3b8; }
    .ut-dd .modal-body .row { --bs-gutter-x: .8rem; --bs-gutter-y: .55rem; }
    body.dark-mode .ut-dd .modal-body { background: #0b1220; }
    body.dark-mode .ut-dd .ut-dd-sheet { background: #111a2b; border-color: #1f2b3e; }
    body.dark-mode .ut-dd .ut-dd-static { background: #0f172a; border-color: #1f2b3e; color: #e2e8f0; }
    body.dark-mode .ut-dd .modal-footer { background: #111a2b; border-color: #1f2b3e; }
    `;

    let modalEl = null;
    let lastEntry = null;

    function ensureModal() {
        if (modalEl && document.body.contains(modalEl)) return modalEl;
        if (!document.getElementById('utDrilldownStyles')) {
            const style = document.createElement('style');
            style.id = 'utDrilldownStyles';
            style.textContent = STYLES;
            document.head.appendChild(style);
        }
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <div class="modal fade ut-dd" id="utDrilldownModal" tabindex="-1" aria-hidden="true" aria-labelledby="utDrilldownTitle">
                <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div>
                                <div class="ut-dd-eyebrow">Source master record</div>
                                <h5 class="ut-dd-title" id="utDrilldownTitle">Master</h5>
                                <div class="ut-dd-sub" id="utDrilldownSub"></div>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="utDrilldownBody"></div>
                        <div class="modal-footer">
                            <span class="ut-dd-hint"><i class="bi bi-info-circle me-1"></i>Read-only snapshot from the master definition</span>
                            <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary btn-sm" id="utDrilldownOpen"><i class="bi bi-box-arrow-up-right me-1"></i>Open master</button>
                        </div>
                    </div>
                </div>
            </div>`;
        modalEl = wrap.firstElementChild;
        document.body.appendChild(modalEl);
        return modalEl;
    }

    function showModal() {
        const el = ensureModal();
        if (window.bootstrap && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(el, { backdrop: true, keyboard: true }).show();
        } else {
            el.classList.add('show');
            el.style.display = 'block';
            el.removeAttribute('aria-hidden');
        }
    }

    function setBody(html) {
        const el = ensureModal();
        const body = el.querySelector('#utDrilldownBody');
        if (body) body.innerHTML = html;
    }

    function toast(message) {
        try {
            if (window.App && App.UI && typeof App.UI.Notify === 'function') {
                App.UI.Notify('Master Lookup', message, 'warning');
                return;
            }
        } catch (e) {}
        console.warn('[Drilldown]', message);
    }

    async function open(input) {
        const sheet = sheetFor(input);
        if (!sheet) { toast('No source master is mapped to this field.'); return; }
        const entry = registryFor(sheet);
        const rawValue = input.value != null ? String(input.value) : '';
        if (!entry || !norm(rawValue)) { toast('This field has no value to inspect.'); return; }

        const el = ensureModal();
        const titleEl = el.querySelector('#utDrilldownTitle');
        const subEl = el.querySelector('#utDrilldownSub');
        const openBtn = el.querySelector('#utDrilldownOpen');
        lastEntry = entry;

        if (titleEl) titleEl.textContent = entry.title;
        if (subEl) subEl.textContent = `Resolving “${rawValue}” from ${entry.formId}…`;
        if (openBtn) openBtn.disabled = true;
        setBody('<div class="text-center text-muted small py-5"><span class="spinner-border spinner-border-sm me-2"></span>Loading master definition…</div>');
        showModal();

        let records = [];
        let markup = '';
        try {
            [records, markup] = await Promise.all([
                loadRecords(sheet, entry).catch(() => []),
                loadMasterMarkup(entry).catch(() => '')
            ]);
        } catch (e) {
            records = []; markup = '';
        }

        const record = findRecord(records, rawValue, entry);
        const display = record
            ? (fieldsOf(record, entry.nameFields)[0] || fieldsOf(record, entry.codeFields)[0] || rawValue)
            : rawValue;
        const code = record ? (fieldsOf(record, entry.codeFields)[0] || '') : '';

        if (titleEl) titleEl.textContent = String(display);
        if (subEl) {
            subEl.textContent = [
                entry.title,
                code ? `Code ${code}` : '',
                record ? 'Record found' : 'Record not found in master'
            ].filter(Boolean).join(' · ');
        }

        const header = `
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-mono">${esc(sheet)}</span>
                ${code ? `<span class="badge bg-light text-dark border font-mono">${esc(code)}</span>` : ''}
                <span class="badge ${record ? 'bg-success-subtle text-success border-success-subtle' : 'bg-warning-subtle text-warning border-warning-subtle'} border">
                    ${record ? '<i class="bi bi-check2-circle me-1"></i>Verified master record' : '<i class="bi bi-exclamation-circle me-1"></i>No exact match'}
                </span>
            </div>`;

        let formHtml = '';
        if (markup) {
            formHtml = buildFormView(markup, entry, record || {}) || '';
        }
        if (!formHtml) {
            formHtml = `<div class="text-muted small py-4 text-center">The ${esc(entry.title)} definition could not be rendered. Open the master to inspect it directly.</div>`;
        }

        setBody(`${header}<div class="ut-dd-sheet">${formHtml}</div>`);

        if (openBtn) {
            openBtn.disabled = false;
            openBtn.onclick = function () {
                const router = window.UniTaxRouter;
                try {
                    if (router && typeof router.Navigate === 'function' && entry.route) {
                        router.Navigate(entry.route);
                    } else {
                        location.hash = '#/' + entry.route;
                    }
                    const el2 = ensureModal();
                    if (window.bootstrap && bootstrap.Modal) bootstrap.Modal.getOrCreateInstance(el2).hide();
                } catch (e) {
                    toast('Unable to open the master module.');
                }
            };
        }
    }

    document.addEventListener('dblclick', function (event) {
        const input = event.target && event.target.closest
            ? event.target.closest('input, textarea')
            : null;
        if (!input || input.tagName !== 'INPUT') return;
        const type = (input.getAttribute('type') || 'text').toLowerCase();
        if (['checkbox', 'radio', 'file', 'range', 'color', 'password', 'submit', 'button'].includes(type)) return;

        const locked = input.readOnly || input.disabled;
        const forced = event.ctrlKey || event.metaKey;
        if (!locked && !forced) return;
        if (!sheetFor(input)) return;
        if (!String(input.value || '').trim()) return;

        event.preventDefault();
        event.stopPropagation();
        open(input).catch((err) => console.warn('[Drilldown] failed:', err));
    }, true);

    // Expose a programmatic hook for grids / custom widgets.
    window.UniTaxDrilldown = {
        open: function (inputOrSheet, value) {
            if (inputOrSheet instanceof Element) return open(inputOrSheet);
            const probe = document.createElement('input');
            probe.dataset.masterSheet = String(inputOrSheet || '');
            probe.value = value == null ? '' : String(value);
            return open(probe);
        },
        register: function (sheet, config) {
            if (!sheet || !config || !config.module) return;
            REGISTRY[key(sheet)] = Object.assign({}, config, { formId: config.formId || sheet });
            delete recordCache[key(sheet)];
            delete htmlCache[config.module];
        },
        clearCache: function () {
            Object.keys(recordCache).forEach((k) => delete recordCache[k]);
        }
    };
})();
