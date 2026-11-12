/**
 * UniTax Pro — Vanilla E2E Test Harness & Verification Framework
 * Zero external npm dependencies. Standard Node.js only.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

// Project root directory
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ANSI Color Codes
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    gray: '\x1b[90m'
};

// Global Test Registry
class TestSuite {
    constructor() {
        this.tests = [];
        this.currentTier = null;
        this.currentSuite = null;
        this.currentFeature = null;
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };
    }

    setTier(tier) {
        this.currentTier = tier;
    }

    setFeature(featureNum, featureName) {
        this.currentFeature = { num: featureNum, name: featureName };
    }

    describe(name, fn) {
        const prevSuite = this.currentSuite;
        this.currentSuite = name;
        try {
            fn();
        } finally {
            this.currentSuite = prevSuite;
        }
    }

    it(name, fn) {
        this.tests.push({
            name,
            fn,
            tier: this.currentTier,
            feature: this.currentFeature,
            suite: this.currentSuite
        });
    }

    async run(options = {}) {
        const {
            tierFilter = null,
            featureFilter = null,
            patternFilter = null,
            verbose = false
        } = options;

        let filteredTests = this.tests;

        if (tierFilter !== null) {
            filteredTests = filteredTests.filter(t => t.tier === tierFilter);
        }
        if (featureFilter !== null) {
            filteredTests = filteredTests.filter(t => t.feature && t.feature.num === featureFilter);
        }
        if (patternFilter) {
            const re = new RegExp(patternFilter, 'i');
            filteredTests = filteredTests.filter(t => re.test(t.name) || (t.suite && re.test(t.suite)));
        }

        this.results.total = filteredTests.length;
        const startTime = Date.now();

        let currentTierGroup = null;
        let currentSuiteGroup = null;

        for (const test of filteredTests) {
            if (test.tier !== currentTierGroup) {
                currentTierGroup = test.tier;
                console.log(`\n${COLORS.bright}${COLORS.cyan}========================================================================${COLORS.reset}`);
                console.log(`${COLORS.bright}${COLORS.cyan}▶ TIER ${currentTierGroup}: ${this.getTierTitle(currentTierGroup)}${COLORS.reset}`);
                console.log(`${COLORS.bright}${COLORS.cyan}========================================================================${COLORS.reset}`);
            }

            if (test.suite !== currentSuiteGroup) {
                currentSuiteGroup = test.suite;
                console.log(`\n  ${COLORS.bright}${COLORS.white}${currentSuiteGroup}${COLORS.reset}`);
            }

            const tStart = Date.now();
            try {
                await test.fn();
                const duration = Date.now() - tStart;
                this.results.passed++;
                console.log(`    ${COLORS.green}✓${COLORS.reset} ${COLORS.gray}[${duration}ms]${COLORS.reset} ${test.name}`);
            } catch (err) {
                const duration = Date.now() - tStart;
                this.results.failed++;
                const failureObj = {
                    test: test.name,
                    suite: test.suite,
                    tier: test.tier,
                    feature: test.feature,
                    error: err,
                    duration
                };
                this.results.errors.push(failureObj);
                console.log(`    ${COLORS.red}✗${COLORS.reset} ${COLORS.gray}[${duration}ms]${COLORS.reset} ${COLORS.red}${test.name}${COLORS.reset}`);
                if (verbose) {
                    console.log(`      ${COLORS.red}Error: ${err.message}${COLORS.reset}`);
                    if (err.stack) {
                        const stackLines = err.stack.split('\n').slice(1, 4).join('\n      ');
                        console.log(`      ${COLORS.gray}${stackLines}${COLORS.reset}`);
                    }
                }
            }
        }

        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
        return { ...this.results, duration: totalDuration };
    }

    getTierTitle(tier) {
        switch (tier) {
            case 1: return 'Feature Coverage (>=5 tests per feature across all 21 features)';
            case 2: return 'Boundary & Corner Cases (Edge dates, missing fields, extreme numbers)';
            case 3: return 'Cross-Feature Combinations (Pairwise integration & reporting)';
            case 4: return 'Real-World Workflows (Multi-step accounting lifecycles)';
            default: return `Tier ${tier}`;
        }
    }
}

const suite = new TestSuite();

/**
 * File System & Static Inspection Utilities
 */
const FileUtil = {
    resolvePath(...segments) {
        return path.resolve(PROJECT_ROOT, ...segments);
    },

    read(relativePath) {
        const full = path.resolve(PROJECT_ROOT, relativePath);
        if (!fs.existsSync(full)) {
            throw new Error(`File not found: ${relativePath}`);
        }
        return fs.readFileSync(full, 'utf8');
    },

    exists(relativePath) {
        return fs.existsSync(path.resolve(PROJECT_ROOT, relativePath));
    }
};

/**
 * HTML Inspection Utilities (Zero-dependency AST/Regex analyzer)
 */
const HTMLInspector = {
    extractInputs(htmlContent) {
        const inputs = [];
        const regex = /<input\b([^>]*)>/gi;
        let match;
        while ((match = regex.exec(htmlContent)) !== null) {
            const attrStr = match[1];
            const attrs = {};
            const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
            let aMatch;
            while ((aMatch = attrRegex.exec(attrStr)) !== null) {
                const key = aMatch[1].toLowerCase();
                const val = aMatch[2] !== undefined ? aMatch[2] : (aMatch[3] !== undefined ? aMatch[3] : (aMatch[4] !== undefined ? aMatch[4] : true));
                attrs[key] = val;
            }
            inputs.push(attrs);
        }
        return inputs;
    },

    hasPostingDateInput(htmlContent) {
        const inputs = this.extractInputs(htmlContent);
        return inputs.some(i => {
            const name = (i.name || '').toLowerCase();
            const id = (i.id || '').toLowerCase();
            const isPostingField = name === 'posting_date' || name === 'postingdate' || id === 'postingdate';
            return isPostingField && i.type === 'date';
        });
    },

    isPostingDateRequired(htmlContent) {
        const inputs = this.extractInputs(htmlContent);
        const postingInput = inputs.find(i => {
            const name = (i.name || '').toLowerCase();
            const id = (i.id || '').toLowerCase();
            return (name === 'posting_date' || name === 'postingdate' || id === 'postingdate');
        });
        if (!postingInput) return false;
        return postingInput.required !== undefined;
    },

    extractTableHeaders(htmlContent) {
        const thTexts = [];
        const thRegex = /<th\b[^>]*>([\s\S]*?)<\/th>/gi;
        let match;
        while ((match = thRegex.exec(htmlContent)) !== null) {
            const cleaned = match[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
            thTexts.push(cleaned);
        }
        return thTexts;
    },

    hasPostingDateColumn(htmlContent) {
        const headers = this.extractTableHeaders(htmlContent);
        return headers.some(h => /posting\s*date/i.test(h));
    },

    hasElementWithId(htmlContent, id) {
        const regex = new RegExp(`id=["']${id}["']`, 'i');
        return regex.test(htmlContent);
    },

    hasElementWithClass(htmlContent, className) {
        const regex = new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`, 'i');
        return regex.test(htmlContent);
    }
};

/**
 * CSS Design System Inspection Utilities
 */
const CSSInspector = {
    extractVariables(cssContent) {
        const vars = {};
        const varRegex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
        let match;
        while ((match = varRegex.exec(cssContent)) !== null) {
            vars[match[1].trim()] = match[2].trim();
        }
        return vars;
    },

    containsRule(cssContent, selectorRegex, propertyRegex) {
        const rules = cssContent.split('}');
        for (const rule of rules) {
            const parts = rule.split('{');
            if (parts.length === 2) {
                const sel = parts[0].trim();
                const body = parts[1].trim();
                if (selectorRegex.test(sel) && (!propertyRegex || propertyRegex.test(body))) {
                    return true;
                }
            }
        }
        return false;
    },

    findForbiddenPatterns(cssContent) {
        const findings = [];
        if (/height\s*:\s*calc\s*\(\s*100vh\s*-\s*80px\s*\)/i.test(cssContent)) {
            findings.push('calc(100vh - 80px) height hack present');
        }
        if (/i\s*\{\s*display\s*:\s*flex/i.test(cssContent) || /i\s*\{[^}]*display\s*:\s*flex/i.test(cssContent)) {
            findings.push('Destructive global i { display: flex } rule present');
        }
        if (/:has\(\.settings-wrapper\)/i.test(cssContent)) {
            findings.push('Brittle :has(.settings-wrapper) selector present');
        }
        return findings;
    }
};

/**
 * Accounting Math & Financial Synthesis Engine (Contract Oracle Simulator)
 */
const AccountingEngine = {
    /**
     * Validates posting date according to PROJECT.md interface contracts:
     * - Must be non-empty string
     * - Must strictly match YYYY-MM-DD format
     * - Must be a valid calendar date (e.g. rejects 2026-02-31)
     */
    validatePostingDate(postingDate) {
        if (!postingDate || typeof postingDate !== 'string') {
            return { valid: false, error: "Mandatory field 'postingDate' is missing" };
        }
        const trimmed = postingDate.trim();
        if (trimmed === '') {
            return { valid: false, error: "Mandatory field 'postingDate' is missing" };
        }
        const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        if (!isoMatch) {
            return { valid: false, error: "Invalid postingDate format. Expected YYYY-MM-DD" };
        }
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);

        if (month < 1 || month > 12 || day < 1 || day > 31) {
            return { valid: false, error: "Invalid calendar date for postingDate" };
        }

        const dateObj = new Date(year, month - 1, day);
        if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
            return { valid: false, error: "Invalid calendar date for postingDate (day does not exist in month)" };
        }

        return { valid: true, date: trimmed };
    },

    /**
     * Simulates DAL Voucher Posting contract:
     * Validates posting date, constructs voucher payload, throws if invalid.
     */
    postVoucherContract(formId, rawData) {
        const dateVal = rawData.posting_date || rawData.postingDate;
        const validation = this.validatePostingDate(dateVal);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const docNo = rawData.Invoice || rawData.paymentRef || rawData.doc_no || 'VCH-001';
        const entity = rawData.customer_ledger || rawData.supplier_ledger || rawData.gl_account || rawData.entity || 'General Entity';

        const voucher = {
            header: {
                doc_no: String(docNo).toUpperCase(),
                date: rawData.voucher_date || rawData.date || validation.date,
                postingDate: validation.date,
                entity: entity,
                CompanyCode: rawData.CompanyName || rawData.company || 'COMP-001',
                project: rawData.project || 'General',
                narration: rawData.narration || '',
                status: rawData.status || 'POSTED',
                subTotal: parseFloat((Number(rawData.subTotal) || 0).toFixed(2)),
                taxTotal: parseFloat((Number(rawData.taxTotal) || 0).toFixed(2)),
                grandTotal: parseFloat((Number(rawData.grandTotal) || (Number(rawData.subTotal) || 0) + (Number(rawData.taxTotal) || 0)).toFixed(2))
            },
            items: rawData.items || [],
            meta: {
                form_id: formId
            }
        };

        return voucher;
    },

    /**
     * Double-Entry Parser:
     * Derives debits, credits, and contra entries for any transaction type.
     */
    processDoubleEntry(voucher) {
        const h = voucher.header || {};
        const formId = voucher.meta?.form_id || '';
        const grandTotal = Number(h.grandTotal) || 0;
        const entity = h.entity || 'Generic Party';

        let debits = [];
        let credits = [];

        if (formId.includes('Sale') && !formId.includes('Return')) {
            // Sales Invoice: Dr Debtor (entity), Cr Sales Account
            debits.push({ account: entity, amount: grandTotal });
            credits.push({ account: 'SYS-SALES', amount: grandTotal });
        } else if (formId.includes('Purchase') && !formId.includes('Return')) {
            // Purchase Invoice: Dr Purchase Account, Cr Creditor (entity)
            debits.push({ account: 'SYS-PURCH', amount: grandTotal });
            credits.push({ account: entity, amount: grandTotal });
        } else if (formId.includes('SalesReturn') || formId.includes('CreditNote')) {
            // Sales Return / Credit Note: Dr Sales Return, Cr Debtor
            debits.push({ account: 'SYS-SALES-RET', amount: grandTotal });
            credits.push({ account: entity, amount: grandTotal });
        } else if (formId.includes('PurchaseReturn') || formId.includes('DebitNote')) {
            // Purchase Return / Debit Note: Dr Creditor, Cr Purchase Return
            debits.push({ account: entity, amount: grandTotal });
            credits.push({ account: 'SYS-PURCH-RET', amount: grandTotal });
        } else if (formId.includes('Receipt')) {
            // Receipt: Dr Bank/Cash, Cr Offset Account (entity)
            debits.push({ account: 'SYS-BANK', amount: grandTotal });
            credits.push({ account: entity, amount: grandTotal });
        } else if (formId.includes('Payment')) {
            // Payment: Dr Offset Account (entity), Cr Bank/Cash
            debits.push({ account: entity, amount: grandTotal });
            credits.push({ account: 'SYS-BANK', amount: grandTotal });
        } else {
            // Default Journal / General
            const drLeg = h.debitLedger || 'SYS-EXPENSE';
            const crLeg = h.creditLedger || 'SYS-BANK';
            debits.push({ account: drLeg, amount: grandTotal });
            credits.push({ account: crLeg, amount: grandTotal });
        }

        return { debits, credits, grandTotal };
    },

    /**
     * General Ledger Filtering Engine:
     * Implements Contract R1 (historical exclusion) and R2 (Dual-mode search).
     */
    executeGLSearch(vouchers, searchState) {
        const {
            isGranular = false,
            primary = {},
            granular = {}
        } = searchState;

        const {
            fromPostingDate = '',
            toPostingDate = '',
            company = 'ALL',
            account = 'ALL'
        } = primary;

        return vouchers.filter(vch => {
            const h = vch.header || {};
            const postingDate = h.postingDate;

            // Strict R1 Rule: Any historical or new record lacking postingDate must be ignored
            if (!postingDate || typeof postingDate !== 'string' || !postingDate.trim()) {
                return false;
            }

            // Primary Posting Date Boundaries
            if (fromPostingDate && postingDate < fromPostingDate) return false;
            if (toPostingDate && postingDate > toPostingDate) return false;

            // Primary Company Filter
            if (company && company !== 'ALL' && h.CompanyCode !== company) {
                return false;
            }

            // Primary Account Filter
            if (account && account !== 'ALL') {
                const entry = this.processDoubleEntry(vch);
                const matchesDr = entry.debits.some(d => d.account.toLowerCase() === account.toLowerCase());
                const matchesCr = entry.credits.some(c => c.account.toLowerCase() === account.toLowerCase());
                if (!matchesDr && !matchesCr && h.entity.toLowerCase() !== account.toLowerCase()) {
                    return false;
                }
            }

            // If Granular Search is Disabled: Primary filters are sufficient
            if (!isGranular) {
                return true;
            }

            // If Granular Search is Enabled: Conjunction of all active granular fields
            if (granular.voucherType && granular.voucherType !== 'ALL') {
                if (vch.meta?.form_id !== granular.voucherType) return false;
            }

            if (granular.docNo && granular.docNo.trim()) {
                const qDoc = granular.docNo.trim().toLowerCase();
                if (!String(h.doc_no || '').toLowerCase().includes(qDoc)) return false;
            }

            if (granular.narration && granular.narration.trim()) {
                const qNarr = granular.narration.trim().toLowerCase();
                if (!String(h.narration || '').toLowerCase().includes(qNarr)) return false;
            }

            if (granular.contraAccount && granular.contraAccount.trim()) {
                const qContra = granular.contraAccount.trim().toLowerCase();
                const entry = this.processDoubleEntry(vch);
                const hasContra = [...entry.debits, ...entry.credits].some(leg =>
                    leg.account.toLowerCase().includes(qContra)
                );
                if (!hasContra) return false;
            }

            const total = Number(h.grandTotal) || 0;
            if (granular.minDr !== null && granular.minDr !== undefined && granular.minDr !== '') {
                if (total < Number(granular.minDr)) return false;
            }
            if (granular.maxDr !== null && granular.maxDr !== undefined && granular.maxDr !== '') {
                if (total > Number(granular.maxDr)) return false;
            }

            if (granular.project && granular.project.trim() && granular.project !== 'ALL') {
                if (String(h.project || '').toLowerCase() !== granular.project.toLowerCase()) return false;
            }

            if (granular.status && granular.status !== 'ALL') {
                if (h.status !== granular.status) return false;
            }

            return true;
        });
    },

    /**
     * Synthesize General Ledger Statement:
     * Computes opening balance, period line items, and closing balance.
     */
    synthesizeGLStatement(vouchers, targetAccount, fromPostingDate, toPostingDate, company = 'ALL', initialOpeningBalance = 0, initialType = 'Dr') {
        let runningBalance = initialType === 'Dr' ? initialOpeningBalance : -initialOpeningBalance;
        let openingPeriodBalance = runningBalance;
        const periodEntries = [];
        let totalDebit = 0;
        let totalCredit = 0;

        // Sort chronologically by postingDate
        const sorted = [...vouchers].sort((a, b) => {
            const dA = a.header?.postingDate || '';
            const dB = b.header?.postingDate || '';
            return dA.localeCompare(dB);
        });

        for (const vch of sorted) {
            const h = vch.header || {};
            const pDate = h.postingDate;

            // Rule R1: Exclude records lacking postingDate
            if (!pDate || typeof pDate !== 'string' || !pDate.trim()) {
                continue;
            }

            // Company boundary check
            if (company && company !== 'ALL' && h.CompanyCode !== company) {
                continue;
            }

            const entry = this.processDoubleEntry(vch);
            let dr = 0;
            let cr = 0;
            let contra = '';

            for (const d of entry.debits) {
                if (d.account.toLowerCase() === targetAccount.toLowerCase()) {
                    dr += d.amount;
                    contra = entry.credits[0]?.account || 'Offset';
                }
            }
            for (const c of entry.credits) {
                if (c.account.toLowerCase() === targetAccount.toLowerCase()) {
                    cr += c.amount;
                    contra = entry.debits[0]?.account || 'Offset';
                }
            }

            if (dr === 0 && cr === 0) continue;

            // Prior to period: Affects opening balance
            if (fromPostingDate && pDate < fromPostingDate) {
                runningBalance += (dr - cr);
                openingPeriodBalance = runningBalance;
            } else if (!toPostingDate || pDate <= toPostingDate) {
                // In period
                runningBalance += (dr - cr);
                totalDebit += dr;
                totalCredit += cr;
                periodEntries.push({
                    postingDate: pDate,
                    docNo: h.doc_no,
                    type: vch.meta?.form_id,
                    contraAccount: contra,
                    narration: h.narration,
                    dr,
                    cr,
                    balance: runningBalance
                });
            }
        }

        return {
            openingBalance: openingPeriodBalance,
            periodEntries,
            totalDebit,
            totalCredit,
            closingBalance: runningBalance,
            closingType: runningBalance >= 0 ? 'Dr' : 'Cr'
        };
    },

    /**
     * Synthesize Trial Balance:
     * Computes opening, debit movements, credit movements, and closing balance for each account.
     */
    synthesizeTrialBalance(vouchers, asOnPostingDate, masterLedgers = []) {
        const accounts = {};

        // Initialize masters
        masterLedgers.forEach(m => {
            accounts[m.name] = {
                code: m.ledgerCode,
                name: m.name,
                nature: m.ledgerNature || 'Asset',
                opening: Number(m.openingBalance) || 0,
                openingType: m.balanceType || 'Dr',
                debit: 0,
                credit: 0
            };
        });

        vouchers.forEach(vch => {
            const h = vch.header || {};
            const pDate = h.postingDate;

            // Rule R1: Exclude historical or undated records
            if (!pDate || typeof pDate !== 'string' || !pDate.trim()) {
                return;
            }

            if (asOnPostingDate && pDate > asOnPostingDate) {
                return;
            }

            const entry = this.processDoubleEntry(vch);
            entry.debits.forEach(d => {
                if (!accounts[d.account]) {
                    accounts[d.account] = { name: d.account, debit: 0, credit: 0, opening: 0 };
                }
                accounts[d.account].debit += d.amount;
            });
            entry.credits.forEach(c => {
                if (!accounts[c.account]) {
                    accounts[c.account] = { name: c.account, debit: 0, credit: 0, opening: 0 };
                }
                accounts[c.account].credit += c.amount;
            });
        });

        let grandDebit = 0;
        let grandCredit = 0;

        Object.values(accounts).forEach(acc => {
            grandDebit += acc.debit;
            grandCredit += acc.credit;
        });

        return {
            accounts: Object.values(accounts),
            totalDebit: parseFloat(grandDebit.toFixed(2)),
            totalCredit: parseFloat(grandCredit.toFixed(2)),
            isBalanced: Math.abs(grandDebit - grandCredit) < 0.001
        };
    },

    /**
     * Synthesize Profit & Loss:
     * Revenue minus Cost of Goods Sold & Expenses.
     */
    synthesizeProfitLoss(vouchers, fromPostingDate, toPostingDate) {
        let salesRevenue = 0;
        let salesReturn = 0;
        let purchaseCost = 0;
        let purchaseReturn = 0;
        let operatingExpenses = 0;

        vouchers.forEach(vch => {
            const h = vch.header || {};
            const pDate = h.postingDate;

            // Rule R1: Exclude records lacking postingDate
            if (!pDate || typeof pDate !== 'string' || !pDate.trim()) {
                return;
            }

            if (fromPostingDate && pDate < fromPostingDate) return;
            if (toPostingDate && pDate > toPostingDate) return;

            const formId = vch.meta?.form_id || '';
            const amount = Number(h.grandTotal) || 0;

            if (formId.includes('Sale') && !formId.includes('Return')) {
                salesRevenue += amount;
            } else if (formId.includes('SalesReturn') || formId.includes('CreditNote')) {
                salesReturn += amount;
            } else if (formId.includes('Purchase') && !formId.includes('Return')) {
                purchaseCost += amount;
            } else if (formId.includes('PurchaseReturn') || formId.includes('DebitNote')) {
                purchaseReturn += amount;
            } else if (formId.includes('Payment')) {
                operatingExpenses += amount;
            }
        });

        const netSales = salesRevenue - salesReturn;
        const netCost = purchaseCost - purchaseReturn;
        const grossProfit = netSales - netCost;
        const netProfit = grossProfit - operatingExpenses;

        return {
            salesRevenue,
            salesReturn,
            netSales,
            purchaseCost,
            purchaseReturn,
            netCost,
            operatingExpenses,
            grossProfit,
            netProfit
        };
    },

    /**
     * Synthesize Balance Sheet:
     * Assets, Liabilities, and Equity (including Net Profit).
     */
    synthesizeBalanceSheet(vouchers, asOnPostingDate, initialMasters = {}) {
        let debtors = 0;
        let creditors = 0;
        let bankCash = initialMasters.cash || 0;

        vouchers.forEach(vch => {
            const h = vch.header || {};
            const pDate = h.postingDate;

            // Rule R1: Exclude records lacking postingDate
            if (!pDate || typeof pDate !== 'string' || !pDate.trim()) {
                return;
            }

            if (asOnPostingDate && pDate > asOnPostingDate) {
                return;
            }

            const formId = vch.meta?.form_id || '';
            const amount = Number(h.grandTotal) || 0;

            if (formId.includes('Sale') && !formId.includes('Return')) {
                debtors += amount;
            } else if (formId.includes('SalesReturn') || formId.includes('CreditNote')) {
                debtors -= amount;
            } else if (formId.includes('Purchase') && !formId.includes('Return')) {
                creditors += amount;
            } else if (formId.includes('PurchaseReturn') || formId.includes('DebitNote')) {
                creditors -= amount;
            } else if (formId.includes('Receipt')) {
                debtors -= amount;
                bankCash += amount;
            } else if (formId.includes('Payment')) {
                creditors -= amount;
                bankCash -= amount;
            }
        });

        const pl = this.synthesizeProfitLoss(vouchers, '', asOnPostingDate);
        const totalAssets = debtors + bankCash;
        const totalLiabilitiesAndEquity = creditors + pl.netProfit;

        return {
            assets: { debtors, bankCash, total: totalAssets },
            liabilities: { creditors, retainedEarnings: pl.netProfit, total: totalLiabilitiesAndEquity },
            isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.001
        };
    }
};

module.exports = {
    suite,
    describe: suite.describe.bind(suite),
    it: suite.it.bind(suite),
    setTier: suite.setTier.bind(suite),
    setFeature: suite.setFeature.bind(suite),
    assert,
    COLORS,
    PROJECT_ROOT,
    FileUtil,
    HTMLInspector,
    CSSInspector,
    AccountingEngine
};
