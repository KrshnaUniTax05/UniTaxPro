/**
 * UniTax Pro — Bulk Master Import Engine
 * ========================================
 * Shared validation & atomic-commit engine for the JSON (and later Excel)
 * bulk upload of Ledgers, Stock items and Profit Centers.
 *
 * It enforces the SAME rules the creation forms enforce, against the SAME data:
 *   • API.ValidateInputLists — datalist-backed inputs (CompanyName, ProfitCenter,
 *     DefaultBankLedger, ItemUnit, state) must match a real registry option.
 *     Matching semantics are byte-for-byte the same as the form: case-insensitive,
 *     parentheses "Name (Code)" matches either part, hyphen "Code - Name" matches either part,
 *     and the value is CANONICALIZED to the exact option value the form would store.
 *   • Select enums (StockType, ItemTax, Status, Currency, …) must equal an actual
 *     option value (case-insensitive input is canonicalized to the form's option).
 *   • Required fields, code lengths, number/date/email/GSTIN formats — the same
 *     constraints as the respective form input attributes.
 *   • Registry uniqueness (ledgerCode+name, Stock_Code+ProjectCode/ProjectName)
 *     checked BEFORE anything is written.
 *   • GRC field restrictions (REQUIRED / EQUALS / IN_LIST) — same semantics as API.SaveMaster.
 *   • Atomic commit: everything is written as ONE multi-path RTDB update under the
 *     mapped Masters parent path. Either every record lands, or NOTHING is written.
 *
 * Exposed as window.BulkImport so the Excel path can reuse it later
 * (parse .xlsx with SheetJS → produce the same row objects → same pipeline).
 */
var BulkImport = (function () {
    'use strict';

    var UNITS = ['BAG-BAGS','BAL-BALE','BDL-BUNDLES','BKL-BUCKLES','BOU-BILLION OF UNITS','BOX-BOX','BTL-BOTTLES','BUN-BUNCHES','CAN-CANS','CBM-CUBIC METERS','CCM-CUBIC CENTIMETERS','CMS-CENTIMETERS','CTN-CARTONS','DOZ-DOZENS','DRM-DRUMS','GGK-GREAT GROSS','GMS-GRAMMES','GRS-GROSS','GYD-GROSS YARDS','KGS-KILOGRAMS','KLR-KILOLITRE','KME-KILOMETRE','LTR-LITRES','MLT-MILILITRE','MTR-METERS','MTS-METRIC TON','NOS-NUMBERS','PAC-PACKS','PCS-PIECES','PRS-PAIRS','QTL-QUINTAL','ROL-ROLLS','SET-SETS','SQF-SQUARE FEET','SQM-SQUARE METERS','SQY-SQUARE YARDS','TBS-TABLETS','TGM-TEN GROSS','THD-THOUSANDS','TON-TONNES','TUB-TUBES','UGS-US GALLONS','UNT-UNITS','YDS-YARDS','OTH-OTHERS'];

    var STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu and Kashmir','Ladakh','Chandigarh','Puducherry','Dadra and Nagar Haveli and Daman and Diu','Andaman and Nicobar Islands','Lakshadweep'];

    var LEDGER_GROUPS = ['Capital Account','Reserves & Surplus','Bank Accounts','Cash-in-Hand','Sundry Debtors','Sundry Creditors','Fixed Assets','Current Assets','Current Liabilities','Duties & Taxes','Secured Loans','Unsecured Loans','Investments','Direct Incomes','Indirect Incomes','Direct Expenses','Indirect Expenses'];

    var LEDGER_TYPES_WITH_DYNAMIC_REQUIRED = {
        'Bank Accounts': ['bankName', 'accountNumber', 'ifscCode'],
        'Sundry Debtors': ['creditLimit', 'creditDays'],
        'Sundry Creditors': ['vendorCode', 'creditPeriod'],
        'Direct Incomes': ['incomeCategory', 'taxRate'],
        'Fixed Assets': ['assetType', 'depreciationRate']
    };

    var BUSINESS_UNITS = ['Corporate Headquarters','Commercial Retail','B2B Enterprise Solutions','Digital & E-Commerce','Logistics & Supply Chain','Manufacturing & Plant Operations','Shared Services & HR','Research & Development (R&D)'];
    var SEGMENTS = ['Commercial & Retail Trade','Infrastructure & Real Estate','Technology & SaaS','Consumer Products & FMCG','Healthcare & Life Sciences','Financial & Treasury Services','Specialty Consulting','Automotive & Industrial'];
    var CENTER_TYPES = ['Profit Center (Revenue & Cost)','Cost Center (Expenditure Tracking Only)','Investment Center (ROIC & Capital Focus)','Revenue Center (Sales & Inflow Focus)'];
    var CURRENCIES = ['INR','USD','EUR','GBP','AED'];
    var ALLOCATION_BASES = ['Direct Headcount Proportion','Physical Floor Area / Sq. Ft.','Revenue Generation Ratio','Activity-Based Costing (ABC)','Equal Fixed Split'];
    var STATUSES = ['ACTIVE','UNDER_REVIEW','SUSPENDED','DECOMMISSIONED'];
    var REQUIRE_TAGGING = ['Yes','No'];
    var INCOME_CATEGORIES = ['Commission','Interest','Rent','Royalty','Dividend'];
    var ASSET_TYPES = ['Building','Machinery','Vehicles','Furniture','Computers','Other'];
    var STOCK_TYPES = ['Goods','Services'];
    var GST_RATES = ['0','5','12','18','28'];
    var BALANCE_TYPES = ['Dr','Cr'];
    var LEDGER_NATURES = ['Debit','Credit'];

    var GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    var HSN_RE = /^[0-9]{4,8}$/;

    var SHEETS = { ledger: 'LedgerCreation', stock: 'Stock', project: 'Projects' };
    var CODE_FIELD = { ledger: 'ledgerCode', stock: 'Stock_Code', project: 'ProjectCode' };
    var NAME_FIELD = { ledger: 'name', stock: 'itemName', project: 'ProjectName' };

    // ---------- structural helpers ----------

    function clean(s) { return String(s == null ? '' : s).trim(); }
    function lower(s) { return clean(s).toLowerCase(); }

    function extractRecords(json) {
        if (Array.isArray(json)) return json;
        if (json && typeof json === 'object') {
            var arrayKey = Object.keys(json).find(function (k) { return Array.isArray(json[k]); });
            if (arrayKey) return json[arrayKey];
            var values = Object.keys(json).map(function (k) { return json[k]; });
            if (values.length >= 2 && values.every(function (v) { return v && typeof v === 'object' && !Array.isArray(v); })) return values;
            return [json];
        }
        return [];
    }

    function trimRow(obj) {
        var out = {};
        Object.keys(obj || {}).forEach(function (k) {
            var v = obj[k];
            out[String(k).trim()] = (typeof v === 'string') ? v.trim() : v;
        });
        return out;
    }

    // Parity with API.SaveMaster sanitize + alias normalization, then CRUD aliases
    function sanitizeKeys(obj) {
        var out = {};
        Object.keys(obj).forEach(function (k) {
            var safeK = k.replace(/[\.\#\$\/\[\]\s]/g, '_');
            out[safeK] = obj[k];
        });
        return out;
    }
    function normalizeAliases(d) {
        var pairs = [['ItemUnit', 'unit'], ['itemHSN', 'hsnCode'], ['openingQty', 'openingQuantity'], ['Stock_Code', 'stockCode'], ['itemGroup', 'category'], ['companyName & CompanyCode', 'CompanyName']];
        pairs.forEach(function (p) {
            if (d[p[0]] && !d[p[1]]) d[p[1]] = d[p[0]];
            if (d[p[1]] && !d[p[0]]) d[p[0]] = d[p[1]];
        });
        return d;
    }
    function buildSavePayload(row) {
        var d = sanitizeKeys(row);
        d = normalizeAliases(d);
        var createdBy = (typeof App !== 'undefined' && App.State && App.State.userId)
            ? App.State.userId
            : (localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid') || 'system');
        if (window.firebase && firebase.database && firebase.database.ServerValue) {
            d.created_at = firebase.database.ServerValue.TIMESTAMP;
        } else {
            d.created_at = Date.now();
        }
        d.created_by = createdBy;
        d.is_deleted = false;
        return d;
    }

    // ---------- push key (valid RTDB key, unique enough; app-level uniqueness
    //            is enforced pre-flight against the registry) ----------
    var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    function generatePushKey() {
        var key = '', now = Date.now(), rest = now, i, j;
        for (i = 0; i < 8; i++) { key = PUSH_CHARS.charAt(rest % 64) + key; rest = Math.floor(rest / 64); }
        for (j = 0; j < 12; j++) { key += PUSH_CHARS.charAt(Math.floor(Math.random() * 64)); }
        return key;
    }

    // ---------- reference loading from the live registry ----------

    async function fetchSheet(name) {
        var raw = null;
        if (window.API && typeof API.Fetch === 'function') {
            try { raw = await API.Fetch('Masters/' + name); } catch (e) { raw = null; }
        }
        if (!raw && typeof firebase !== 'undefined' && firebase.database) {
            try {
                var snap = await firebase.database().ref('Masters/' + name).once('value');
                raw = snap.val();
            } catch (e) { raw = null; }
        }
        var data = raw && typeof raw === 'object' ? (raw.data || raw.result || raw) : raw;
        if (!data) return [];
        if (Array.isArray(data)) return data.filter(function (r) { return r && typeof r === 'object'; });
        return Object.keys(data).map(function (k) { return data[k]; }).filter(function (r) { return r && typeof r === 'object'; });
    }

    function companyOptions(list) {
        var seen = {}, out = [];
        list.forEach(function (r) {
            var name = clean(r.companyName || r.CompanyName || r['companyName & CompanyCode'] || '');
            var code = clean(r.CompanyCode || r.companyCode || '');
            if (!name && !code) return;
            var value = (name && code) ? (name + ' (' + code + ')') : (name || code);
            var dedupe = lower(value);
            if (seen[dedupe]) return;
            seen[dedupe] = true;
            out.push({ value: value, dataText: name, dataValue: code, label: '' });
        });
        return out;
    }
    function projectOptions(list) {
        var seen = {}, out = [];
        list.forEach(function (r) {
            var name = clean(r.ProjectName || r.projectName || '');
            var code = clean(r.ProjectCode || r.projectCode || '');
            if (!name && !code) return;
            var value = (name && code) ? (name + ' (' + code + ')') : (name || code);
            var dedupe = lower(value);
            if (seen[dedupe]) return;
            seen[dedupe] = true;
            out.push({ value: value, dataText: name, dataValue: code, label: '' });
        });
        return out;
    }
    function ledgerNameOptions(list) {
        var seen = {}, out = [];
        list.forEach(function (r) {
            var name = clean(r.name || r.ledgerName || '');
            if (!name) return;
            var dedupe = lower(name);
            if (seen[dedupe]) return;
            seen[dedupe] = true;
            out.push({ value: name, dataText: name, dataValue: '', label: '' });
        });
        return out;
    }

    async function loadReferenceSets() {
        var res = await Promise.all([
            fetchSheet('Companies'),
            fetchSheet('Projects'),
            fetchSheet('LedgerCreation'),
            fetchSheet('Stock')
        ]);
        var companies = res[0], projects = res[1], ledgers = res[2], stock = res[3];
        var lc = {};
        lc.companyOptions = companyOptions(companies);
        lc.projectOptions = projectOptions(projects);
        lc.ledgerNameOptions = ledgerNameOptions(ledgers);
        lc.codes = {
            ledgerCode: {}, ledgerName: {}, Stock_Code: {}, projectCode: {}, projectName: {}
        };
        ledgers.forEach(function (r) {
            if (r.ledgerCode) lc.codes.ledgerCode[lower(r.ledgerCode)] = true;
            if (r.name) lc.codes.ledgerName[lower(r.name)] = true;
        });
        stock.forEach(function (r) {
            var c = r.Stock_Code || r.stockCode;
            if (c) lc.codes.Stock_Code[lower(c)] = true;
        });
        projects.forEach(function (r) {
            if (r.ProjectCode) lc.codes.projectCode[lower(r.ProjectCode)] = true;
            if (r.ProjectName) lc.codes.projectName[lower(r.ProjectName)] = true;
        });
        return lc;
    }

    // ---------- option matching — mirrors API.ValidateInputLists exactly ----------
    function matchOptionValue(input, options) {
        var norm = lower(input);
        if (!norm) return null;
        for (var i = 0; i < options.length; i++) {
            var opt = options[i];
            var optVal = clean(opt.value);
            var normVal = lower(optVal);
            if (optVal && normVal === norm) return optVal;
            if (opt.dataValue && lower(opt.dataValue) === norm) return optVal;
            if (opt.dataText && lower(opt.dataText) === norm) return optVal;
            if (opt.label && lower(opt.label) === norm) return optVal;
            var pm = optVal.match(/^(.*?)\s*\((.*?)\)$/);
            if (pm && (lower(pm[1]) === norm || lower(pm[2]) === norm)) return optVal;
            var dm = optVal.match(/^(.*?)\s*-\s*(.*)$/);
            if (dm && (lower(dm[1]) === norm || lower(dm[2]) === norm)) return optVal;
        }
        return null;
    }

    // Enum canonicalizer — returns canonical option string or null when no exact match
    function canonEnum(input, options) {
        var norm = lower(input);
        for (var i = 0; i < options.length; i++) {
            if (lower(options[i]) === norm) return options[i];
        }
        return null;
    }

    // ---------- GRC field restrictions (mirrors API.SaveMaster) ----------
    function grcErrors(data, modulePath) {
        var errs = [];
        if (!window.UniTaxAuth || typeof UniTaxAuth.GetEffectivePermissions !== 'function') return errs;
        var perms;
        try { perms = UniTaxAuth.GetEffectivePermissions() || {}; } catch (e) { return errs; }
        var rules = perms.fieldRestrictions || [];
        var curMod = String(modulePath || 'masters/bulk-upload').toLowerCase().trim();
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (!rule || !rule.field) continue;
            var ruleMod = String(rule.module || 'ALL').trim().toLowerCase();
            if (ruleMod !== 'all' && curMod.indexOf(ruleMod) === -1 && ruleMod.indexOf(curMod) === -1 && ruleMod.indexOf('master') === -1) continue;
            var fieldName = String(rule.field).trim();
            var condition = String(rule.condition || 'EQUALS').toUpperCase();
            var expected = String(rule.value || '').trim();
            var actual = String(data[fieldName] !== undefined ? data[fieldName] : '').trim();
            if (condition === 'REQUIRED' && !actual) {
                errs.push({ field: fieldName, message: 'Required by your security policy' });
            } else if (condition === 'EQUALS' && actual && expected !== '*' && lower(actual) !== lower(expected)) {
                errs.push({ field: fieldName, message: "Value '" + actual + "' is restricted — must equal '" + expected + "'" });
            } else if (condition === 'IN_LIST' && actual) {
                var allowedList = expected.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
                var actualParts = [lower(actual)];
                var apm = actual.match(/^(.*?)\s*\((.*?)\)$/);
                if (apm) actualParts.push(lower(apm[1]), lower(apm[2]));
                var ok = allowedList.indexOf('*') !== -1 || actualParts.some(function (p) { return allowedList.indexOf(p) !== -1; });
                if (!ok) errs.push({ field: fieldName, message: "'" + actual + "' is outside your authorized scope (" + expected + ")" });
            }
        }
        return errs;
    }

    // ---------- STAGE 1 : format validation (pure, no DB) ----------
    // Modifies the row in place (canonicalizes enums). Returns {errors:[], warnings:[]}
    function validateFormat(row, key, seenCodes) {
        var errors = [], warnings = [];
        var add = function (f, m) { errors.push({ field: f, message: m }); };
        var warn = function (f, m) { warnings.push({ field: f, message: m }); };
        var cfg = {
            ledger: { code: 'ledgerCode', len: 8, name: 'name', required: ['ledgerCode', 'name', 'ledgerType', 'CompanyName', 'ProfitCenter'] },
            stock: { code: 'Stock_Code', len: 5, name: 'itemName', required: ['Stock_Code', 'itemName', 'itemHSN', 'ItemUnit', 'CompanyName'] },
            project: { code: 'ProjectCode', len: 12, name: 'ProjectName', required: ['ProjectCode', 'ProjectName', 'CompanyName'] }
        }[key];

        cfg.required.forEach(function (f) {
            if (clean(row[f]) === '') add(f, 'Missing ' + f);
        });

        var code = clean(row[cfg.code]);
        if (code) {
            if (key === 'ledger' && code.length !== 8) add(cfg.code, cfg.code + ' must be exactly 8 chars (got ' + code.length + ')');
            if (key === 'stock' && code.length !== 5) add(cfg.code, 'Stock_Code must be exactly 5 chars (got ' + code.length + ')');
            if (key === 'project' && code.length > 12) add(cfg.code, 'ProjectCode must be at most 12 chars');
            if (seenCodes[lower(code)]) add(cfg.code, 'Duplicate ' + cfg.code + ' in file: ' + code);
            seenCodes[lower(code)] = true;
        }

        if (key === 'ledger') {
            // Ledger group — warning only (form allows free input; dynamic fields just don't attach)
            if (clean(row.ledgerType) && LEDGER_GROUPS.indexOf(clean(row.ledgerType)) === -1) {
                warn('ledgerType', 'Ledger group not a known group (dynamic fields will not attach)');
            }
            // ledgerNature — auto-derived exactly like the form does on group change
            var group = lower(row.ledgerType);
            var creditKw = ['capital', 'reserve', 'creditor', 'duty', 'tax', 'liability', 'loan', 'income', 'sale'];
            var isCredit = creditKw.some(function (k) { return group.indexOf(k) !== -1; });
            if (row.ledgerNature === undefined || row.ledgerNature === '') {
                row.ledgerNature = isCredit ? 'Credit' : 'Debit';
                warn('ledgerNature', 'ledgerNature auto-derived from group = ' + row.ledgerNature);
            } else {
                var nat = canonEnum(row.ledgerNature, LEDGER_NATURES);
                if (!nat) add('ledgerNature', 'ledgerNature must be Debit or Credit (got ' + row.ledgerNature + ')');
                else row.ledgerNature = nat;
            }
            if (row.balanceType === undefined || row.balanceType === '') {
                row.balanceType = (row.ledgerNature === 'Credit') ? 'Cr' : 'Dr';
            } else {
                var bt = canonEnum(row.balanceType, BALANCE_TYPES);
                if (!bt) add('balanceType', 'balanceType must be Dr or Cr (got ' + row.balanceType + ')');
                else row.balanceType = bt;
            }
            // dynamic-group required fields (the groups that attach them in the form)
            var dyn = LEDGER_TYPES_WITH_DYNAMIC_REQUIRED[clean(row.ledgerType)];
            if (dyn) dyn.forEach(function (f) {
                if (clean(row[f]) === '') add(f, 'Required for group "' + clean(row.ledgerType) + '": ' + f);
            });
            // numeric fields
            ['openingBalance', 'creditLimit', 'creditDays', 'creditPeriod', 'taxRate', 'depreciationRate', 'purchaseValue'].forEach(function (f) {
                if (row[f] !== undefined && row[f] !== '' && isNaN(Number(row[f]))) add(f, f + ' must be numeric (got ' + row[f] + ')');
            });
            if (clean(row.state) && STATES.indexOf(clean(row.state)) === -1) {
                // case-insensitive rescue
                var canonState = STATES.find(function (s) { return lower(s) === lower(row.state); });
                if (canonState) row.state = canonState; else add('state', 'state must match the Indian states list (got ' + row.state + ')');
            }
            if (clean(row.incomeCategory) && INCOME_CATEGORIES.indexOf(clean(row.incomeCategory)) === -1) {
                var ic = canonEnum(row.incomeCategory, INCOME_CATEGORIES);
                if (ic) row.incomeCategory = ic; else add('incomeCategory', 'incomeCategory must be one of ' + INCOME_CATEGORIES.join(' | '));
            }
            if (clean(row.assetType) && ASSET_TYPES.indexOf(clean(row.assetType)) === -1) {
                var at = canonEnum(row.assetType, ASSET_TYPES);
                if (at) row.assetType = at; else add('assetType', 'assetType must be one of ' + ASSET_TYPES.join(' | '));
            }
            if (clean(row.GST) && !GSTIN_RE.test(clean(row.GST))) warn('GST', 'GST does not look like a GSTIN (15 chars)');
            if (clean(row.email) && !EMAIL_RE.test(clean(row.email))) add('email', 'email is not a valid email address');
        }

        if (key === 'stock') {
            if (clean(row.itemHSN) && !HSN_RE.test(clean(row.itemHSN))) add('itemHSN', 'itemHSN must be 4–8 digits (got ' + row.itemHSN + ')');
            var st = row.StockType === undefined || row.StockType === '' ? 'Goods' : canonEnum(row.StockType, STOCK_TYPES);
            if (!st) add('StockType', 'StockType must be Goods or Services');
            else row.StockType = st;
            var tax = row.ItemTax === undefined || row.ItemTax === '' ? '18' : canonEnum(String(row.ItemTax), GST_RATES);
            if (!tax) add('ItemTax', 'ItemTax must be one of 0 | 5 | 12 | 18 | 28');
            else row.ItemTax = tax;
            var unit = canonEnum(row.ItemUnit || '', UNITS);
            if (clean(row.ItemUnit) && !unit) add('ItemUnit', 'ItemUnit must match a UOM from the form list (got ' + row.ItemUnit + ')');
            else if (unit) row.ItemUnit = unit;
            ['minLevel', 'openingQty', 'openingAmount'].forEach(function (f) {
                if (row[f] !== undefined && row[f] !== '' && isNaN(Number(row[f]))) add(f, f + ' must be numeric (got ' + row[f] + ')');
            });
            if (row.minLevel === undefined || row.minLevel === '') row.minLevel = '0';
            if (row.openingQty === undefined || row.openingQty === '') row.openingQty = '0';
            if (row.openingAmount === undefined || row.openingAmount === '') row.openingAmount = '0';
        }

        if (key === 'project') {
            [['BusinessUnit', BUSINESS_UNITS], ['Segment', SEGMENTS], ['CenterType', CENTER_TYPES], ['Currency', CURRENCIES], ['AllocationBase', ALLOCATION_BASES], ['Status', STATUSES], ['RequireTagging', REQUIRE_TAGGING]].forEach(function (pair) {
                var f = pair[0];
                if (row[f] === undefined || row[f] === '') {
                    if (f === 'Status') row.Status = 'ACTIVE';
                    else if (f === 'RequireTagging') row.RequireTagging = 'Yes';
                    else if (f === 'Currency') row.Currency = 'INR';
                    return;
                }
                var canon = canonEnum(row[f], pair[1]);
                if (!canon) add(f, f + ' must be one of: ' + pair[1].join(' | '));
                else row[f] = canon;
            });
            if (clean(row.GSTIN) && clean(row.GSTIN).length > 15) add('GSTIN', 'GSTIN must be at most 15 characters');
            else if (clean(row.GSTIN) && !GSTIN_RE.test(clean(row.GSTIN))) warn('GSTIN', 'GSTIN does not match the 15-char GSTIN pattern');
            if (clean(row.ManagerEmail) && !EMAIL_RE.test(clean(row.ManagerEmail))) add('ManagerEmail', 'ManagerEmail is not a valid email address');
            ['AnnualRevenueTarget', 'AnnualBudgetCap', 'VarianceThreshold', 'TargetMarginPct'].forEach(function (f) {
                if (row[f] !== undefined && row[f] !== '' && isNaN(Number(row[f]))) add(f, f + ' must be numeric (got ' + row[f] + ')');
            });
            if (row.TargetMarginPct !== undefined && row.TargetMarginPct !== '') {
                var tm = Number(row.TargetMarginPct);
                if (!isNaN(tm) && (tm < 0 || tm > 100)) add('TargetMarginPct', 'TargetMarginPct must be between 0 and 100');
            }
            if (row.EffectiveDate && !DATE_RE.test(clean(row.EffectiveDate))) add('EffectiveDate', 'EffectiveDate must be YYYY-MM-DD (form uses a date input)');
            if (row.SunsetDate && !DATE_RE.test(clean(row.SunsetDate))) add('SunsetDate', 'SunsetDate must be YYYY-MM-DD (form uses a date input)');
            if (row.VarianceThreshold === undefined || row.VarianceThreshold === '') row.VarianceThreshold = '10';
        }

        var unknown = Object.keys(row).filter(function (k) { return KNOWN_FIELDS[key].indexOf(k) === -1; });
        unknown.forEach(function (k) { warn(k, 'Unknown field "' + k + '" (will be stored verbatim — form would not send it)'); });

        errors.forEach(function (e) { e.stage = 'format'; });
        warnings.forEach(function (w) { w.stage = 'format'; });
        return { errors: errors, warnings: warnings };
    }

    var KNOWN_FIELDS = {
        ledger: ['ledgerCode','name','ledgerType','ledgerNature','CompanyName','ProfitCenter','address1','address2','state','pin','email','GST','Mobile','website','openingBalance','balanceType','bankName','accountNumber','ifscCode','branchName','SwiftCode','creditLimit','creditDays','contactPerson','panNumber','vendorCode','creditPeriod','tdsApplicable','incomeCategory','taxRate','sacCode','assetType','depreciationRate','purchaseDate','purchaseValue'],
        stock: ['Stock_Code','stockCode','itemName','Description','itemGroup','category','itemHSN','hsnCode','StockType','ItemUnit','unit','ItemTax','minLevel','CompanyName','openingQty','openingAmount','openingQuantity','companyName & CompanyCode'],
        project: ['ProjectCode','ProjectName','CompanyName','BusinessUnit','Segment','ParentProject','ManagerName','ManagerEmail','ManagerPhone','CenterType','Location','GSTIN','AnnualRevenueTarget','AnnualBudgetCap','TargetMarginPct','Currency','AllocationBase','VarianceThreshold','DefaultBankLedger','EffectiveDate','SunsetDate','Status','RequireTagging','Narration']
    };

    // ---------- STAGE 2 : registry pre-flight (all rows, one pass) ----------
    // Mutates rows in place with canonical values. Returns array aligned to rows:
    // [{ errors:[{field,message}], warnings:[...] }]
    async function preflight(key, rows) {
        var refs = await loadReferenceSets();
        return rows.map(function (row) {
            var errors = [], warnings = [];
            var add = function (f, m) { errors.push({ field: f, message: m, stage: 'registry' }); };
            var warn = function (f, m) { warnings.push({ field: f, message: m, stage: 'registry' }); };

            // CompanyName — must exist in the Companies registry (strict, like the form's datalist)
            var cnRaw = clean(row.CompanyName || row['companyName & CompanyCode']);
            if (!cnRaw) add('CompanyName', 'Missing CompanyName');
            else {
                var canonCo = matchOptionValue(cnRaw, refs.companyOptions);
                if (!canonCo) add('CompanyName', 'Company not in registry: "' + cnRaw + '". Pick an existing company (e.g. "ARDENTA GLOBAL INDUSTRIES LIMITED (1000)")');
                else { row.CompanyName = canonCo; if (lower(row.CompanyName) !== lower(cnRaw)) warn('CompanyName', 'Normalized to registry value: ' + canonCo); }
            }

            // ProfitCenter — required for ledgers; must exist in Projects registry
            if (key === 'ledger') {
                var pcRaw = clean(row.ProfitCenter);
                if (!pcRaw) add('ProfitCenter', 'Missing ProfitCenter');
                else {
                    var canonPc = matchOptionValue(pcRaw, refs.projectOptions);
                    if (!canonPc) add('ProfitCenter', 'Profit center not in registry: "' + pcRaw + '". Pick an existing profit center (e.g. "ARG CONSUMER PRODUCTS (ARG-CP)")');
                    else { row.ProfitCenter = canonPc; if (lower(row.ProfitCenter) !== lower(pcRaw)) warn('ProfitCenter', 'Normalized to registry value: ' + canonPc); }
                }
            }

            // DefaultBankLedger — must exist in the LedgerCreation registry
            if (key === 'project' && clean(row.DefaultBankLedger)) {
                var dbl = clean(row.DefaultBankLedger);
                var canonLedger = matchOptionValue(dbl, refs.ledgerNameOptions);
                if (!canonLedger) add('DefaultBankLedger', 'DefaultBankLedger not in registry: "' + dbl + '". It must be an existing ledger name.');
                else row.DefaultBankLedger = canonLedger;
            }

            // Registry uniqueness — same fields the form enforces as unique
            if (key === 'ledger') {
                var lc = lower(row.ledgerCode);
                if (lc && refs.codes.ledgerCode[lc]) add('ledgerCode', 'ledgerCode "' + row.ledgerCode + '" already exists in the registry');
                var ln = lower(row.name);
                if (ln && refs.codes.ledgerName[ln]) add('name', 'A ledger named "' + row.name + '" already exists in the registry');
            } else if (key === 'stock') {
                var sc = lower(row.Stock_Code);
                if (sc && refs.codes.Stock_Code[sc]) add('Stock_Code', 'Stock_Code "' + row.Stock_Code + '" already exists in the registry');
            } else if (key === 'project') {
                var pc = lower(row.ProjectCode);
                if (pc && refs.codes.projectCode[pc]) add('ProjectCode', 'ProjectCode "' + row.ProjectCode + '" already exists in the registry');
                var pn = lower(row.ProjectName);
                if (pn && refs.codes.projectName[pn]) add('ProjectName', 'A profit center named "' + row.ProjectName + '" already exists in the registry');
            }

            // GRC field restrictions (same semantics as the form's save path)
            grcErrors(row, 'masters/bulk-upload').forEach(function (e) { errors.push({ field: e.field, message: e.message, stage: 'policy' }); });

            return { errors: errors, warnings: warnings };
        });
    }

    // ---------- atomic commit — ONE multi-path RTDB update, all-or-nothing ----------
    async function commitAtomic(key, records) {
        var sheet = SHEETS[key];
        if (!sheet) throw new Error('Unknown master type: ' + key);
        var db = firebase.database();

        // Exactly one mapped parent ref (paths.js maps Masters/* → Workspaces/{ws}/Masters/*)
        var parentRef = db.ref('Masters/' + sheet);
        var children = {};
        var keys = [];
        records.forEach(function (row) {
            var k = generatePushKey();
            keys.push(k);
            children[k] = buildSavePayload(row);
        });

        // Single atomic write — every record lands, or nothing does.
        await parentRef.update(children);

        // Post-commit bookkeeping (audit + cache bust); failure here must not corrupt the result
        try {
            if (window.UniTaxAudit && typeof UniTaxAudit.Log === 'function') {
                keys.forEach(function (k, i) {
                    UniTaxAudit.Log({ action: 'CREATE', module: sheet, recordId: k, details: 'Bulk import via JSON upload (' + SHEETS[key] + ')' });
                });
            }
        } catch (e) { console.warn('Audit log after bulk import failed:', e); }
        try {
            if (window.API && API._MasterCache) {
                delete API._MasterCache[sheet];
                delete API._MasterCache['Stock']; delete API._MasterCache['stock'];
                delete API._MasterCache['Companies']; delete API._MasterCache['Projects']; delete API._MasterCache['LedgerCreation'];
            }
        } catch (e) {}
        return keys;
    }

    return {
        SHEETS: SHEETS,
        CODE_FIELD: CODE_FIELD,
        NAME_FIELD: NAME_FIELD,
        UNITS: UNITS,
        STATES: STATES,
        KNOWN_FIELDS: KNOWN_FIELDS,
        extractRecords: extractRecords,
        trimRow: trimRow,
        validateFormat: validateFormat,
        preflight: preflight,
        loadReferenceSets: loadReferenceSets,
        matchOptionValue: matchOptionValue,
        buildSavePayload: buildSavePayload,
        generatePushKey: generatePushKey,
        commitAtomic: commitAtomic
    };
})();
