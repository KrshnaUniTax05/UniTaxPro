# Project: UniTax Pro Enterprise Re-skinning & Posting Date Engine

## Architecture
- **Front-End Architecture**: 100% Vanilla HTML5, CSS3, ES6+ JavaScript, Bootstrap 5.3.2, Font Awesome 6.5.0, Bootstrap Icons. Zero npm packages, zero bundlers, zero build tools.
- **Data Layer**: Firebase Realtime Database (RTDB) v8.10.1. Client-side state managed via `API.Fetch`, `API.PostVoucher`, and `UniTaxCRUD`.
- **Navigation & Shell**: Dynamic client-side routing in `assets/js/router.js` loading module views into `#contentArea` within `index.html`.
- **Transaction Engine**: 7 transaction posting forms + `edit.html` submitting through `API.PostVoucher()` and `crud.js` to Firebase path `{userId}/Transactions/{formId}/{key}`.
- **Reporting Engine**: Dynamic client-side synthesis from transaction collections into financial statements (Balance Sheet, Profit & Loss, Trial Balance, Cash Flow, Statutory, Reconcilation, and General Ledger Statement).
- **Design System**: Enterprise master design system (`--erp-*` tokens) applied across global stylesheets (`variables.css`, `style.css`), root pages (`index.html`, `login.html`, `admin.html`), and all submodules.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Enterprise Design Tokens & Theme | Unify CSS color palette, typography hierarchy, elevation, borders, and spacing tokens in `variables.css` matching SAP Horizon / Zoho Books / Oracle Redwood | M1 | ORIGINAL_REQUEST §R3 |
| 2 | CSS Layout Bug Fixes & Reset | Eliminate destructive `height: calc(100vh - 80px)`, nested `overflow: scroll !important`, `i { display: flex }`, and brittle `:has()` hacks in `style.css` | M1 | ORIGINAL_REQUEST §R3, Survey 1, Survey 3 |
| 3 | Application Shell Re-Skinning | Modernize header, navigation sidebar, company selector, breadcrumbs, search palette, and footer across `index.html`, `login.html`, and `admin.html` | M1 | ORIGINAL_REQUEST §R3, Survey 1 |
| 4 | Mandatory Posting Date Field in Transaction Forms | Add compulsory `<input type="date" name="posting_date" id="postingDate" required>` to all 7 transaction forms (`sales-inv`, `purchase-inv`, `salesret-inv`, `purchaseret-inv`, `receipt-vch`, `payment-vch`, `receipt-pay`) | M2 | ORIGINAL_REQUEST §R1 |
| 5 | Posting Date Form Validation & Submission Handling | Form validation prevents submission if posting date is empty; `API.PostVoucher()` stores mandatory `postingDate` in voucher `header` | M2 | ORIGINAL_REQUEST §R1, Survey 2 |
| 6 | Edit Workspace Posting Date Integration | Add posting date input and update `dbToHtmlMap` / save logic in `modules/transactions/edit.html` to read, display, and update `postingDate` | M2 | ORIGINAL_REQUEST §R1, Survey 2 |
| 7 | Posting Date Columns in Viewer Modules | Add `Posting Date` column to tables in `gl-statement.html`, `dashboard.html`, `reconcilation.html`, `gstr1.html`, and `inventoryreturn.html` | M3 | ORIGINAL_REQUEST §R1, Survey 2 |
| 8 | General Ledger Primary Search Mode | Primary filter in `gl-statement.html` covering Posting Date range (`fromPostingDate`, `toPostingDate`), GL Account (`targetAccount` / All Accounts), and Company (`targetCompany`) | M3 | ORIGINAL_REQUEST §R2, Survey 3 |
| 9 | General Ledger Granular Search Toggle & UI Panel | Collapsible granular search panel with individual inputs for Voucher Type, Doc No, Narration, Contra Account, Min Debit, Max Debit, Min Credit, Max Credit, Project, and Status | M3 | ORIGINAL_REQUEST §R2, Survey 3 |
| 10 | General Ledger Granular Filter Engine | Dual-mode filtering: when toggle disabled, filter strictly by primary fields; when toggle enabled, filter by conjunction of active granular fields + primary boundaries | M3 | ORIGINAL_REQUEST §R2, Survey 3 |
| 11 | Balance Sheet Posting Date Calculation & Historical Exclusion | Calculate Balance Sheet asset/liability balances by `postingDate` as-on selected date; ignore any records lacking `postingDate` without errors | M4 | ORIGINAL_REQUEST §R1, Survey 2 |
| 12 | Profit & Loss Posting Date Calculation & Historical Exclusion | Calculate income and expense accounts by `postingDate` within date range; ignore any records lacking `postingDate` without errors | M4 | ORIGINAL_REQUEST §R1, Survey 2 |
| 13 | Trial Balance Posting Date Calculation & Historical Exclusion | Compute opening, debit, credit, and closing balances by `postingDate`; ignore any records lacking `postingDate` without errors | M4 | ORIGINAL_REQUEST §R1, Survey 2 |
| 14 | Cash Flow & Statutory Posting Date Calculation & Historical Exclusion | Filter cash flow movements and tax/statutory computations by `postingDate`; ignore any records lacking `postingDate` without errors | M4 | ORIGINAL_REQUEST §R1, Survey 2 |
| 15 | General Ledger Opening & Period Posting Date Recalculation | Compute GL opening balance (`postingDate < fromPostingDate`) and period entries (`fromPostingDate <= postingDate <= toPostingDate`); strictly ignore records lacking `postingDate` | M4 | ORIGINAL_REQUEST §R1, Survey 2, Survey 3 |
| 16 | Reconcilation Posting Date Recalculation & Historical Exclusion | Update bank reconciliation queries to filter transactions by `postingDate`; ignore records lacking `postingDate` | M4 | ORIGINAL_REQUEST §R1, Survey 2 |
| 17 | Enterprise Re-Skinning of Masters Modules | Apply enterprise styling to all 8 master modules (`company-cw/list`, `ledger-cw/list`, `project-cw/list`, `stock-cw/list`) with compact 36px tables, sticky headers, and unified form inputs | M5 | ORIGINAL_REQUEST §R3, Survey 1 |
| 18 | Enterprise Re-Skinning of Utilities, Print & Secondary Modules | Apply enterprise styling to `settings.html`, `useradmincontrolpanel.html`, `notification.html`, `profile.html`, `aboutus.html`, `mastermanager.html`, `approvalmanagementsystem.html`, and print templates | M5 | ORIGINAL_REQUEST §R3, Survey 1 |
| 19 | UI Bug Fixes & Code Cleanup | Fix `payment-vch.html` calculation selector/ID bug, `purchase-inv.html` Bill To/Customer label copy-paste error, `UIUtils` missing reference bug, and GitHub Pages asset pathing | M5 | ORIGINAL_REQUEST §R3, Survey 1, Survey 2 |
| 20 | E2E Test Suite Execution & Acceptance (Tiers 1-4) | Execute 100% of requirement-driven E2E tests covering posting date validation, historical record exclusion, GL search modes, and UI integrity | M6 | ORIGINAL_REQUEST §AC, Project Pattern |
| 21 | Adversarial Coverage Hardening (Tier 5) | White-box stress testing, corner cases, edge date boundaries, and adversarial verification | M6 | Project Pattern Final Milestone |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Enterprise Master Design System & Core Styles | `variables.css`, `style.css`, `index.html`, `login.html`, `admin.html`, shell components, typography, tables, buttons, cards, modals | none | PLANNED |
| M2 | Mandatory Posting Date Engine & Transaction Forms | All 7 transaction forms, `edit.html`, `api.js` (`PostVoucher`), `crud.js` header validation, form submit validation | M1 | PLANNED |
| M3 | General Ledger Granular Search & Viewer Modules | `gl-statement.html` 2-tier search UI and filtering engine; Posting Date columns in `gl-statement`, `dashboard`, `reconcilation`, `gstr1`, `inventoryreturn` | M1, M2 | PLANNED |
| M4 | Financial Reports Posting Date Recalculation & Historical Exclusion | Recalculate `balance-sheet`, `profit-loss`, `trial-balance`, `cash-flow`, `statutory`, `reconcilation`, and GL by `postingDate`; strictly exclude records lacking `postingDate` | M2 | PLANNED |
| M5 | Enterprise Re-Skinning of Masters, Utilities & Secondary Modules | All 8 master modules, utility pages, print templates, approval management, and UI defect resolutions | M1 | PLANNED |
| M6 | Final Milestone: E2E Verification & Adversarial Hardening | Phase 1: 100% pass of E2E test suite (Tiers 1-4); Phase 2: Adversarial Coverage Hardening (Tier 5) | M1, M2, M3, M4, M5, E2E Testing Track | PLANNED |

## Interface Contracts

### Transaction Posting Contract (`Transaction Forms` ↔ `api.js` / `crud.js`)
- **Voucher Data Model**:
  ```json
  {
    "header": {
      "doc_no": "INV-2026-001",
      "date": "2026-11-08",
      "postingDate": "2026-11-08",
      "entity": "ACME Corp",
      "company": "COMPANY_CODE",
      "project": "PROJECT_CODE",
      "narration": "Transaction particulars",
      "posted_at": 1731063600000
    },
    "rows": [...]
  }
  ```
- **Validation Rule**: If `postingDate` is missing, empty, or whitespace, `API.PostVoucher()` rejects with an Error(`"Mandatory field 'postingDate' is missing"`), and form submission is halted with visual validation feedback (`is-invalid`).
- **Persistence**: `header.postingDate` stored in ISO format (`YYYY-MM-DD`).

### Financial Reporting Contract (`Reports` ↔ `Firebase RTDB Data Model`)
- **Query Filter Rule**:
  ```javascript
  const postingDate = vch.header?.postingDate;
  // Historical data or newly unposted data lacking postingDate MUST be ignored
  if (!postingDate) {
    return; // Ignore completely from calculation
  }
  // Period check strictly on postingDate
  if (fromDate && postingDate < fromDate) return;
  if (toDate && postingDate > toDate) return;
  ```

### General Ledger Search Contract (`gl-statement.html`)
- **Search State Object**:
  ```javascript
  const glSearchState = {
    isGranular: false, // boolean toggle
    primary: {
      fromPostingDate: "2026-11-01",
      toPostingDate: "2026-11-30",
      company: "ALL" | "COMPANY_CODE",
      account: "ALL" | "LEDGER_CODE"
    },
    granular: {
      voucherType: "",
      docNo: "",
      narration: "",
      contraAccount: "",
      minDr: null,
      maxDr: null,
      minCr: null,
      maxCr: null,
      project: "",
      status: ""
    }
  };
  ```
- **Filtering Logic**:
  - Exclude any record where `!record.posting_date`.
  - When `!isGranular`: Match strictly on primary fields (`postingDate` in range, Company match, Account match if specified).
  - When `isGranular`: Primary field boundary AND conjunction of all non-empty granular fields.

## Code Layout
- `assets/css/variables.css`: Master enterprise design tokens (`--erp-*`).
- `assets/css/style.css`: Cleaned global styles, component utilities, table styles, card layouts, scrollbar rules.
- `assets/js/api.js`: Transaction posting, validation, Firebase communication.
- `assets/js/crud.js`: CRUD abstractions, header requirements, schema validators.
- `assets/js/router.js`: Route definitions, view loader.
- `assets/js/app.js`: Global app lifecycle, UI notifications, shortcuts.
- `modules/transactions/*.html`: Transaction posting forms (`sales-inv`, `purchase-inv`, `salesret-inv`, `purchaseret-inv`, `receipt-vch`, `payment-vch`, `receipt-pay`, `edit`).
- `modules/reports/*.html`: Financial reports & General Ledger statement (`gl-statement`, `balance-sheet`, `profit-loss`, `trial-balance`, `cash-flow`, `statutory`, `reconcilation`, `gstr1`, `inventoryreturn`).
- `modules/masters/*.html`: Master data management (`company-*`, `ledger-*`, `project-*`, `stock-*`).
- `modules/utilities/*.html`: Settings, notifications, profile, admin panel.
- `modules/print/*.html`: Print voucher templates.
