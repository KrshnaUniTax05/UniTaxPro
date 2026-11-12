# UniTax Pro — End-to-End Test Infrastructure & Specification (Tiers 1–4)

## 1. Test Philosophy & Guiding Principles

### 1.1 Opaque-Box & Requirement-Driven Architecture
The UniTax Pro test infrastructure is engineered strictly as an **opaque-box, requirement-driven test suite**. Tests are derived directly from authoritative requirements specified in `ORIGINAL_REQUEST.md` and the interface contracts in `PROJECT.md`. The test harness interacts with the application through its observable interfaces:
- **DOM & Visual Hierarchy**: HTML5 markup semantics, mandatory form inputs, required attributes, table structures, column headers, and responsive layout invariants.
- **CSS Design System & Token Integrity**: Verification of master design tokens (`--erp-*`), typography hierarchy, elevation, and absolute prohibition of layout anti-patterns (such as hardcoded `calc(100vh - 80px)`, global `i { display: flex }`, or brittle `:has()` hacks).
- **Transaction & Data Access Contracts**: Validation rules in `API.PostVoucher()` and `UniTaxCRUD`, compulsory posting date persistence in voucher headers (`YYYY-MM-DD`), and rejection of malformed or missing posting dates.
- **Financial Statement Synthesis Engine**: Double-entry journal impact calculation, strict posting date period filtering, and universal historical record exclusion (`records lacking postingDate must be ignored without throwing errors`).
- **General Ledger Search State Engine**: Dual-mode querying supporting Primary Search (Posting Date range, GL Account, Company) when granular toggle is off, and Conjunctive Granular Filtering (Doc No, Voucher Type, Narration, Contra Account, Amount Ranges, Project, Status) when toggle is on.

### 1.2 Strict Vanilla Constraint
In compliance with project requirements (R4), the entire test infrastructure uses **zero npm packages, zero external bundlers, and zero third-party testing dependencies**. The test runner and harness execute directly on standard Node.js (`node tests/test_runner.js`) utilizing built-in modules (`node:fs`, `node:path`, `node:vm`, `node:assert`).

### 1.3 Test Integrity & Real Logic Execution
- **Anti-Facade Rule**: Facade tests that trivially assert `true === true` without exercising production code, markup, or contracts are strictly forbidden.
- **Defect Detection**: Tests assert expected specifications. If implementation code has not yet satisfied a requirement (e.g. unmigrated forms or legacy report filters), the test asserts the correct specification and exposes the deficiency for QA escalation.
- **Independence & Isolation**: Every test case initializes its own isolated state, independent of execution order or prior state mutations.

---

## 2. Feature Inventory Table (All 21 Features)

The matrix below maps all 21 features defined in `PROJECT.md` to their verification scope across Tier 1 (Feature Coverage) and Tier 2 (Boundary & Corner Cases):

| # | Feature Name | Description | T1 Target (>=5 tests) | T2 Target (>=5 tests) | Core Acceptance Criteria | Verification Mechanism |
|---|---|---|---|---|---|---|
| **F1** | Enterprise Design Tokens & Theme | Master `--erp-*` CSS variable suite in `variables.css` matching SAP/Zoho/Oracle | Primary brand, surface, semantic status, text hierarchy, typography tokens | Missing fallbacks, invalid hex codes, contrast ratios, border radius scale, dark mode tokens | Design system unified with `--erp-*` tokens; no conflicting legacy variables | CSS Token AST Parser (`variables.css`) |
| **F2** | CSS Layout Bug Fixes & Reset | Eliminate destructive layout hacks in `style.css` | Absence of `calc(100vh - 80px)`, absence of global `i { display: flex }`, absence of `:has()`, clean `.content-viewport` | Extreme viewport heights, nested scrollbar prevention, flex icon regressions, box-sizing, focus outlines | Clean scrolling, single scrollbar on main viewport, icons display inline | CSS Rule Scanner & Layout Validator (`style.css`) |
| **F3** | Application Shell Re-Skinning | Modernize header, navigation sidebar, company selector, breadcrumbs, search palette | Header height (54px), sidebar navigation active states, brand logo rendering, breadcrumb container, search palette datalist | Collapsed sidebar state, long company names, missing avatars, keyboard shortcuts, mobile drawer toggle | Shell layout matches enterprise standards across `index.html`, `login.html`, `admin.html` | DOM Parser (`index.html`, `login.html`, `admin.html`) |
| **F4** | Mandatory Posting Date Field in Transaction Forms | Add compulsory `<input type="date" name="posting_date" id="postingDate" required>` across all 7 transaction forms | Form presence for sales-inv, purchase-inv, salesret-inv, purchaseret-inv, receipt-vch, payment-vch, receipt-pay | Input ID collision, `required` attribute enforcement, `type="date"` validation, label association, tab index | Every transaction posting form contains mandatory posting date input | Form Schema Inspector (`modules/transactions/*.html`) |
| **F5** | Posting Date Form Validation & Submission | Form validation prevents submission on empty date; `API.PostVoucher()` persists `header.postingDate` | Standard ISO date submission, header payload structure, status code, success notification, date persistence | Empty string `""`, whitespace only `"   "`, `null`, `undefined`, malformed date `"2026/11/08"`, future dates | Submission blocked on missing posting date; `API.PostVoucher` throws error if postingDate omitted | DAL Sandbox & Form Submit Validator (`api.js`) |
| **F6** | Edit Workspace Posting Date Integration | Add posting date input and update `dbToHtmlMap` / save logic in `modules/transactions/edit.html` | Input presence in edit template, `dbToHtmlMap` includes `postingDate`, populating existing record, lock/unlock toggle, delta save | Legacy records with missing posting date, date mutation persistence, invalid date in edit form, cancel edit revert, dirty state | Edit workspace reads, displays, and updates `postingDate` | Module DOM & Script Inspector (`modules/transactions/edit.html`) |
| **F7** | Posting Date Columns in Viewer Modules | Add `Posting Date` column to tables in viewer and listing modules | Table header in `gl-statement`, `dashboard`, `reconcilation`, `gstr1`, `inventoryreturn` | Missing header index, column order alignment, empty cell formatting, date sorting attribute, responsive wrapping | Viewer modules display dedicated `Posting Date` table column | Table Column Validator (`modules/reports/*.html`, `modules/dashboard.html`) |
| **F8** | General Ledger Primary Search Mode | Primary filter in `gl-statement.html` covering Posting Date range, GL Account, Company | Date range filtering, exact account filtering, all accounts option, company selector, basic execution | Inverted date range (`to < from`), missing company (`ALL`), null account, single day query, empty ledger directory | Primary search extracts records matching posting date, account, and company | GL Filter Simulator (`modules/reports/gl-statement.html`) |
| **F9** | General Ledger Granular Search Toggle & UI Panel | Collapsible granular search panel with individual inputs for 8+ secondary dimensions | Toggle switch element `#glGranularToggle`, panel collapse state `#glGranularPanel`, 8 granular inputs present, label accuracy, reset button | Rapid toggle state flipping, persistence across rerender, initial collapsed state, input clearing on toggle off, accessibility ARIA | Granular search UI toggleable; panel expands/collapses dynamically | DOM Inspector & Event Handler (`gl-statement.html`) |
| **F10** | General Ledger Granular Filter Engine | Dual-mode filtering: when toggle disabled, filter by primary; when enabled, filter by conjunction | Conjunction match (Doc No + Type), Narration substring match, Min/Max Debit range, Contra account match, Status match | Case-insensitive matching, negative amounts, decimal boundary matches, multiple active filters, zero-match result set | Disjunctive/conjunctive filtering matches active granular fields when enabled | GL Engine Evaluator (`gl-statement.html`) |
| **F11** | Balance Sheet Posting Date Calculation & Historical Exclusion | Calculate Balance Sheet balances strictly by `postingDate` as-on selected date; ignore missing dates | Asset balances as-on date, Liability balances, Equity/Retained earnings, Date cutoff enforcement, Net profit integration | Record with `postingDate: null`, record with missing `postingDate` key, future posting dates, leap year dates, zero balance accounts | Strictly excludes records lacking `postingDate`; as-on date calculation accurate | Report Synthesis Simulator (`balance-sheet.html`) |
| **F12** | Profit & Loss Posting Date Calculation & Historical Exclusion | Calculate income and expense accounts by `postingDate` within date range; ignore missing dates | Revenue from sales, COGS from purchases, Operating expenses, Date window inclusion, Net Profit invariant | Omission of undated sales, omission of undated expenses, leap day `2028-02-29`, single day range, empty period | Excludes historical records lacking posting date without runtime exceptions | Report Synthesis Simulator (`profit-loss.html`) |
| **F13** | Trial Balance Posting Date Calculation & Historical Exclusion | Compute opening, debit, credit, and closing balances by `postingDate`; ignore missing dates | Debit/Credit balance equality, opening balance transition, cumulative debit totals, cumulative credit totals, account code grouping | Undated vouchers ignored from opening and period totals, negative amounts, extreme balances, boundary dates, empty ledger master | Total debits equal total credits; undated records excluded | Report Synthesis Simulator (`trial-balance.html`) |
| **F14** | Cash Flow & Statutory Posting Date Calculation & Historical Exclusion | Filter cash movements and tax calculations by `postingDate`; ignore missing dates | Direct cash receipts, cash disbursements, Output GST calculation, Input GST Credit, Net tax liability | Undated cash vouchers excluded, cash movements across fiscal years, nil-rated tax vouchers, refund transactions, negative cash | Excludes undated vouchers; accurate tax and cash flow calculations | Report Synthesis Simulator (`cash-flow.html`, `statutory.html`) |
| **F15** | General Ledger Opening & Period Posting Date Recalculation | Compute GL opening balance (`postingDate < fromPostingDate`) and period entries (`from <= postingDate <= to`) | Opening balance calculation, running balance continuity, closing balance matches summary card, Dr/Cr sign convention, period rows | Undated transactions skipped from both opening balance and period rows, sign flip (Dr to Cr), zero net change, boundary start date | Strictly ignores records lacking `postingDate`; running balance continuous | Report Synthesis Simulator (`gl-statement.html`) |
| **F16** | Reconcilation Posting Date Recalculation & Historical Exclusion | Update bank reconciliation queries to filter transactions by `postingDate`; ignore missing dates | Matched bank transactions, unmatched items, posting date range filtering, cleared balance calculation, book balance | Undated bank vouchers excluded, reconciliation date differing from posting date, future reconciliation date, zero amount items | Reconciles using posting date; historical undated transactions excluded | Report Synthesis Simulator (`reconcilation.html`) |
| **F17** | Enterprise Re-Skinning of Masters Modules | Apply enterprise styling to 8 master modules (`company-cw/list`, `ledger-cw/list`, `project-cw/list`, `stock-cw/list`) | 32px inputs, sticky table headers, unified search bar, master action buttons, form card elevation | Missing table data, extreme string lengths in codes/names, special characters in descriptions, active badge styling | Unified enterprise design system applied across all 8 master modules | Master Views Inspector (`modules/masters/*.html`) |
| **F18** | Enterprise Re-Skinning of Utilities, Print & Secondary Modules | Apply enterprise styling to utilities (`settings`, `profile`, `notification`, `admin`, print views) | Settings form layout, notification card hierarchy, profile layout, admin control panel, print preview styles | Print media query isolation, page break rules, unstyled flash elements, button states in utilities, dark mode toggles | Consistent enterprise UI across secondary modules and print templates | Utility Views Inspector (`modules/utilities/*.html`, `modules/print/*.html`) |
| **F19** | UI Bug Fixes & Code Cleanup | Fix payment voucher calculation bug, purchase invoice customer label bug, and CSS errors | Fix `.row-amt` vs `.row-amt-pv` in `payment-vch.html`, fix Supplier label in `purchase-inv.html`, fix viewport scrollbar | Rapid row addition/deletion in payment grid, null check on DOM elements, dynamic grand total recalculation, table cell alignment | All identified UI defects resolved with zero functional regressions | Code Defect & Regression Scanner |
| **F20** | E2E Test Suite Execution & Acceptance (Tiers 1-4) | Complete execution of Tiers 1-4 test suites with 100% pass verification | Test runner execution, suite registration, ANSI reporting output, pass counter tracking, exit code 0 on pass | Malformed test file recovery, asynchronous test failure capture, timeout detection, runner CLI argument parsing | Full test suite runs automatically; clear diagnostic reports generated | Automated Test Runner (`tests/test_runner.js`) |
| **F21** | Adversarial Coverage Hardening (Tier 5) | White-box stress testing, corner cases, edge date boundaries, and adversarial verification | Leap year bounds, ISO 8601 boundary timestamps, decimal floating-point precision, extreme transaction volume | Cross-site scripting strings (`<script>`), SQL/NoSQL injection payloads, unicode characters, empty arrays, malformed JSON | System resists adversarial input without memory leaks, crashes, or math drift | Adversarial Engine & Fuzz Simulator |

---

## 3. Test Architecture & Runner Design

### 3.1 Architectural Diagram
```text
┌────────────────────────────────────────────────────────────────────────┐
│                      Vanilla Node.js CLI Runner                        │
│                       (tests/test_runner.js)                           │
│  Options: --tier=1..4 | --feature=1..21 | --pattern=<regex> | --verbose│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Tier 1 Suite    │      │  Tier 2 Suite    │      │  Tier 3 Suite    │
│(Feature Coverage)│      │(Boundary/Corner) │      │ (Cross-Feature)  │
│  >= 105 Tests    │      │  >= 105 Tests    │      │   >= 21 Tests    │
└──────────────────┘      └──────────────────┘      └──────────────────┘
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    ▼
                          ┌──────────────────┐
                          │  Tier 4 Suite    │
                          │   (Real-World    │
                          │   Workloads)     │
                          │   >= 11 Tests    │
                          └─────────┬────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Testing Core Harness                            │
│                         (tests/harness.js)                             │
│  - describe() / it() / assert utilities (strictEqual, throws, etc.)    │
│  - Static Code Inspectors (HTML AST/DOM scanner, CSS Token parser)     │
│  - Sandboxed Accounting Math & Financial Statement Synthesizer         │
│  - General Ledger Search Simulator (Primary vs Granular)               │
│  - Transaction DAL Contract Evaluator (API.PostVoucher validator)      │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Test Harness Components
The harness (`tests/harness.js`) encapsulates:
1. **Runner Runtime**: Execution lifecycle management, test registration, suite grouping, timeout safeguards, ANSI terminal color formatting (`\x1b[32mPASS\x1b[0m`, `\x1b[31mFAIL\x1b[0m`), and diagnostic stack trace rendering.
2. **DOM / HTML Inspector**: Lightweight, zero-dependency HTML analyzer capable of scanning tags, attributes, form controls, required validations, input types, IDs, labels, datalists, and table structures across all `.html` modules.
3. **CSS Design System Inspector**: Token extraction engine that parses CSS custom properties (`--erp-*`), verifies color contrast hierarchies, and detects forbidden CSS patterns (e.g. `calc(100vh - 80px)`, global `i { display: flex }`).
4. **Accounting Engine & Contract Evaluator**: In-memory simulation of double-entry transaction posting, posting date validation, historical record omission logic, GL search state conjunctions, and financial statement generation.

---

## 4. Real-World Accounting Scenarios (Tier 4 Matrix)

The table below catalogs the >= 11 realistic enterprise accounting workflows implemented in Tier 4:

| Scenario ID | Scenario Name | Accounting Workflow Description | Primary Features Exercised | Expected Financial Invariants |
|---|---|---|---|---|
| **RW-01** | Complete Standard Sales Cycle | Post Sales Invoice with `postingDate="2026-11-01"`, post Receipt Voucher with `postingDate="2026-11-05"`. Verify GL statement, Trial Balance, P&L, and Balance Sheet. | F4, F5, F8, F11, F12, F13, F15 | Total Dr = Total Cr in TB; Debtor balance returns to 0 after receipt; Revenue recognized in P&L; Bank balance reflects receipt in Balance Sheet. |
| **RW-02** | Complete Standard Purchase Cycle | Post Purchase Invoice with `postingDate="2026-11-02"`, post Payment Voucher with `postingDate="2026-11-07"`. Verify Vendor ledger, Cash Flow, and Balance Sheet. | F4, F5, F8, F11, F13, F14, F15 | Vendor balance returns to 0 after payment; Operating cash outflow reflected in Cash Flow; Purchase expense recorded; Trial balance remains balanced. |
| **RW-03** | Sales Return & Credit Note Adjustment | Post Sales Invoice, subsequent Credit Note (Sales Return) with different `postingDate`, then partial customer receipt. Verify GL statement contra account and Net Sales in P&L. | F4, F5, F10, F12, F13, F15 | Net Sales in P&L equals Gross Sales minus Return; Debtor balance accurately reflects net receivable; GL contra leg indicates Sales Return. |
| **RW-04** | Purchase Return & Debit Note Adjustment | Post Purchase Invoice, subsequent Debit Note (Purchase Return), and vendor settlement. Verify Vendor balance and inventory/purchase reductions. | F4, F5, F7, F11, F12, F13 | Net Purchase cost in P&L reflects debit note deduction; Vendor payable is reduced; Posting date column correctly reflects debit note date in viewers. |
| **RW-05** | Historical Data Migration with Missing Dates | Ingest mixed dataset: 10 historical vouchers with missing/null `postingDate` and 10 new vouchers with valid `postingDate`. Run all 7 financial reports and GL search. | F7, F8, F11, F12, F13, F14, F15, F16 | Undated historical records are 100% excluded from all report calculations without raising runtime exceptions; only the 10 valid vouchers affect financial balances. |
| **RW-06** | Multi-Period Financial Closing & Reporting | Transactions posted across three distinct calendar months. Execute GL Statement and P&L across Month 1, Month 2, and Month 3. | F8, F11, F12, F13, F15 | Month 2 GL opening balance equals Month 1 closing balance; P&L only includes revenues/expenses with `postingDate` in the selected month; Trial Balance reconciles for each period. |
| **RW-07** | Dual-Mode General Ledger Granular Audit | User filters GL by Company and Posting Date range (Primary Mode), then toggles Granular Search to isolate specific Voucher Type (`SalesInvoiceForm`) and Doc No pattern (`SL/2026/*`). | F8, F9, F10, F15 | Primary mode extracts all company entries; Granular mode restricts output to exact conjunction of active fields; Summary KPI strip recalculates dynamically. |
| **RW-08** | Multi-Entity / Intercompany Posting & Filtering | Transactions posted across two legal entities (`COMP-001` and `COMP-002`). GL and financial reports queried for `COMP-001`, `COMP-002`, and Consolidated (`ALL`). | F8, F10, F11, F13, F15 | Entity isolation preserved: querying `COMP-001` ignores `COMP-002` transactions; Consolidated view sums both; No data leakage between companies. |
| **RW-09** | Bank Account Reconciliation Cycle | Bank account transactions posted across November. External bank statement cleared up to Nov 15. Reconciliation module executed with posting date window. | F7, F8, F14, F16 | Cleared transactions marked; Unpresented cheques identified; Book balance vs Bank balance calculated accurately; Viewer displays Posting Date column. |
| **RW-10** | Statutory GST Liability & Tax Return Calculation | Sales invoices with 18% GST (CGST 9% + SGST 9%) and purchase invoices with Input Tax Credit posted. GSTR-1 and Statutory tax report executed by posting date. | F7, F12, F13, F14 | Output GST, Input Tax Credit, and Net GST Payable calculated strictly by posting date; GSTR-1 viewer displays Posting Date column; Historical undated tax entries ignored. |
| **RW-11** | End-to-End Enterprise Design & Navigation Consistency | Comprehensive audit traversing `index.html`, `login.html`, `admin.html`, 7 transaction forms, 8 master modules, and 7 report views. | F1, F2, F3, F17, F18, F19 | All modules adhere to `--erp-*` tokens; Zero double scrollbars; Table headers use `.erp-table` sticky styling; Form inputs adhere to 32px standard; No console errors. |

---

## 5. Coverage Thresholds & Target Metrics

| Testing Tier | Scope Description | Minimum Required Tests | Implemented Target | Target Pass Rate |
|---|---|---|---|---|
| **Tier 1: Feature Coverage** | Happy-path isolation verification across all 21 features (>= 5 tests per feature) | 105 | 110 | 100% |
| **Tier 2: Boundary & Corner Cases** | Edge dates, leap years, missing posting dates, extreme values, empty inputs, invalid types (>= 5 tests per feature) | 105 | 110 | 100% |
| **Tier 3: Cross-Feature Combinations** | Pairwise interactions between posting dates, GL search, transaction forms, and reports | 21 | 25 | 100% |
| **Tier 4: Real-World Scenarios** | Complex, multi-step accounting lifecycles and enterprise workflows | 11 | 12 | 100% |
| **Total Test Suite** | **Comprehensive E2E Test Suite (Tiers 1–4)** | **242** | **257** | **100%** |

### Execution Command
```bash
node tests/test_runner.js
```
The test runner exits with code `0` when all assertions succeed, or `1` with a comprehensive diagnostic breakdown if any regression is detected.
