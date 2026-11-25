# UniTax Pro — Enterprise ERP & Financial Operations Platform

UniTax Pro is a browser-based ERP and financial operations platform for accounting, double-entry bookkeeping, Indian GST compliance, inventory, multi-level approvals, workspace governance, and automated email notifications.

It runs as a static site on GitHub Pages with no build step. Firebase Realtime Database stores application data, and a Google Apps Script web app provides server-side OTP and a free, template-driven email system built on Google Sheets, MailApp, and GmailApp.

Live application: <https://krshnaunitax05.github.io/UniTaxPro/>

---

## Table of contents

1. [Feature overview](#feature-overview)
2. [Financial ERP](#financial-erp)
3. [Masters and bulk import](#masters-and-bulk-import)
4. [Reports, analytics, and drill-down](#reports-analytics-and-drill-down)
5. [Approval workflow](#approval-workflow)
6. [Print and PDF engine](#print-and-pdf-engine)
7. [Authentication and security](#authentication-and-security)
8. [Freemium and licensing](#freemium-and-licensing)
9. [Platform master control](#platform-master-control)
10. [Automated email system](#automated-email-system)
11. [Data architecture](#data-architecture)
12. [Technology stack](#technology-stack)
13. [Repository structure](#repository-structure)
14. [Setup and deployment](#setup-and-deployment)
15. [Configuration reference](#configuration-reference)
16. [Verification checklist](#verification-checklist)
17. [Security notes](#security-notes)
18. [Documentation](#documentation)
19. [Current status and next steps](#current-status-and-next-steps)

---

## Feature overview

| Area | What UniTax Pro provides |
|---|---|
| Accounting | Double-entry vouchers, ledger posting, trial balance, profit & loss, balance sheet, cash flow |
| GST | Tax invoices, credit/debit notes, GSTR-1 oriented reporting, statutory reports, HSN and GSTIN validation |
| Inventory | Stock masters, item registry, stock summary, inventory returns |
| Multi-level approvals | Hierarchical approver chains, rejection-to-initiator flow, task assignment, approval audit trail |
| Masters | Companies, ledgers, stock items, projects/profit centers, create and list forms |
| Bulk import | JSON bulk upload for ledgers, stock, and projects with form-equivalent validation and atomic commit |
| Reporting | Live Firebase listeners, cached accounting engine, criterion-first data viewer, filters, pagination, export |
| Drill-down | Double-click master-backed fields to inspect the source record in read-only form view |
| Print/PDF | Statutory invoices, vouchers, GL statements, and approval audit certificates |
| Identity | Salted SHA-256 password hashing, server-side OTP, signed 7-day sessions, master 2FA |
| Authorization | Seven enterprise roles, action-scoped permissions, license-gated admin panel, audit logs |
| Licensing | Free `standard_user` accounts, paid multi-user license, 1/3/6/12 month or custom-day periods |
| Lifecycle automation | License purchase, renewal, reminders, expiry, and automatic revoke |
| Email | Free Apps Script gateway, 28 dynamic Sheet templates, Firebase queue, OTP and all system events |
| Platform governance | Master console with global analytics, directories, license control, promotions, Email Center |
| Hosting | Static GitHub Pages deployment with hash routing and refresh-safe deep links |

---

## Financial ERP

### Voucher and transaction modules

All accounting documents are created through dedicated modules and routed into a unified transaction stream.

| Module | Route | Purpose |
|---|---|---|
| Sales tax invoice | `#/transactions/sales-inv` | Domestic/export sales, GST lines, customer ledger posting |
| Credit note | `#/transactions/salesret-inv` | Sales return under statutory credit-note rules |
| Purchase voucher | `#/transactions/purchase-inv` | Inward supply, input tax credit tracking, supplier posting |
| Debit note | `#/transactions/purchaseret-inv` | Purchase return and supplier credit |
| Receipt voucher | `#/transactions/receipt-vch` | Cash/bank inflows and collections |
| Payment voucher | `#/transactions/payment-vch` | Cash/bank outflows and disbursements |
| Journal voucher | `#/transactions/journal-vch` | Manual double-entry balanced journal entries |
| Task assignment | `#/transactions/mgrtaskassignment` | Manager-level work allocation |

Key behaviors:

- Ledger-driven double-entry posting.
- Draft, pending-approval, posted, returned, and deleted states.
- Deleted and draft records are excluded from financial aggregates.
- Transaction records are flattened across form types by the accounting engine.
- Voucher data is available to the print engine, approval engine, and reports.

### Accounting engine

`assets/js/accounting-engine.js` is the central financial calculation layer.

- Attaches real-time Firebase listeners to transactions and masters.
- Debounces incoming snapshots to avoid duplicate reloads.
- Keeps a warm in-memory cache and refreshes silently in the background.
- Notifies subscribers through callbacks and `unitax:workspace-data-updated` events.
- Computes categorized financial buckets for drill-down:
  - fixed assets
  - debtors
  - stock
  - bank
  - cash
  - advances
  - capital
  - reserves
  - liabilities, incomes, and expenses
- Feeds balance sheet, profit & loss, trial balance, GL statements, and cash flow with the same underlying data.

---

## Masters and bulk import

### Master registries

| Master | Create form | List view |
|---|---|---|
| Company | `#/masters/company-cw` | `#/masters/company-list` |
| Ledger / chart of accounts | `#/masters/ledger-cw` | `#/masters/ledger-list` |
| Stock / material | `#/masters/stock-cw` | `#/masters/stock-list` |
| Project / profit center | `#/masters/project-cw` | `#/masters/project-list` |

Masters enforce:

- ledger groups and ledger natures
- GST rates and HSN codes
- GSTIN format validation
- bank, debtors, creditors, fixed asset, and income-specific required fields
- business units, segments, cost/profit center types
- currency and allocation bases
- active, under-review, suspended, and decommissioned statuses

### Bulk upload

`#/masters/bulk-upload` uses `assets/js/bulk-validate.js`.

- Accepts JSON arrays or wrapped arrays.
- Applies the exact rules used by the creation forms.
- Validates datalist-backed inputs case-insensitively and canonicalizes values.
- Validates select enums, required fields, code lengths, numbers, dates, emails, and GSTIN formats.
- Checks registry uniqueness before writing.
- Enforces GRC field restrictions: required, equals, and in-list.
- Commits all records as one multi-path Firebase update. Either every row lands or none do.

### Master drill-down

`assets/js/drilldown.js` provides SAP-style source inspection:

- Double-click a read-only or disabled master-backed field to open the source master in read-only mode.
- Ctrl/Cmd + double-click for editable master-backed fields.
- Supports ledger, company, project, and stock masters.
- Caches master definitions and records for the session.

---

## Reports, analytics, and drill-down

| Report | Route | Purpose |
|---|---|---|
| GL statement | `#/reports/gl-statement` | Ledger-wise transaction statement |
| Balance sheet | `#/reports/balance-sheet` | Assets, liabilities, and capital position |
| Profit & loss | `#/reports/profit-loss` | Income and expenditure performance |
| Trial balance | `#/reports/trial-balance` | Debit/credit equality check |
| Cash flow | `#/reports/cash-flow` | Cash inflow and outflow movement |
| Statutory | `#/reports/statutory` | Compliance-oriented outputs |
| Reconciliation | `#/reports/reconcilation` | Account and ledger matching |
| GSTR-1 | `#/reports/gstr1` | GST outward-supply reporting view |
| Inventory return | `#/reports/inventoryreturn` | Stock return analysis |
| Approval management | `#/reports/approvalmanagementsystem` | Approval queues and history |

### Data viewer

`assets/js/viewer.js` implements a SAP FBL3N-inspired viewer:

- criteria-first retrieval
- dynamic column chooser
- multi-select popovers
- in-table filters
- client/server pagination
- export support
- reusable list views for utilities and reports

`assets/js/list-viewer.js` provides additional list rendering support for utility screens such as notifications and directories.

---

## Approval workflow

`assets/js/approval-engine.js` is the single source of truth for approvals.

### State machine

```text
DRAFT / PENDING_APPROVAL
  -> PENDING_APPROVAL, level by level
  -> final approval: APPROVED + POSTED (voucher) or APPROVED (request)
  -> any rejection: RETURNED_TO_CREATOR / REJECTED
  -> delete: tombstoned and removed from all queues
```

### Rules

- Approvals advance through a hierarchy stored on each request.
- Only the current assigned approver, or an administrator, can act.
- Lower approval levels must be approved before the current level can act.
- Rejection always returns the document to the initiator.
- Rejection never creates counterparty lines, vouchers, or GL entries.
- The initiator edits and resubmits; the flow resumes at the rejecting level.
- Deletion removes the record from all user queues and marks it deleted.
- The approval UI exposes consequence tooltips for each possible action.

---

## Print and PDF engine

`assets/js/print-engine.js` and `assets/css/print.css` support statutory and financial printing.

Supported documents:

1. Sales tax invoice
2. Purchase voucher
3. Official receipt voucher
4. Payment disbursement voucher
5. General journal voucher
6. Debit note / purchase return
7. Credit note / sales return
8. General ledger statement of account
9. Governance audit certificate and approval matrix

Print templates live under `modules/print/`:

- `tax-invoice.html`
- `receipt-vch.html`
- `payment-vch.html`
- `journal-vch.html`
- `approval.html`

The engine normalizes many form-name aliases to the correct document type and database form ID.

---

## Authentication and security

### Login and signup

`login.html` provides:

- signup with workspace creation
- login with password verification
- forgot-password flow
- OTP verification for login, signup, resend, forgot-password, and master 2FA
- password change
- profile and security actions

Passwords are salted and hashed with SHA-256 in the browser before persistence. The salt is application-level; see [Security notes](#security-notes) for production hardening guidance.

### Server-side OTP

OTP generation and verification happen in Apps Script, not in browser code.

```js
UnitaxMail.otp.send(email, purpose, context)
UnitaxMail.otp.verify(email, otp, purpose)
```

Features:

- 10-minute OTP validity
- maximum 3 attempts
- per-email, per-purpose cooldown
- Firebase audit records in `System/OtpRequests`, `System/OtpCooldown`, and `System/OtpLogs`
- public IP and approximate location from free services:
  `ipwho.is`, `ipapi.co`, `freeipapi.com`, `api.ipify.org`
- browser geolocation permission is never requested
- failed IP lookup never blocks OTP delivery
- IP/location text is hidden on the login screen but shown as badges in security emails

### Signed sessions

`assets/js/secure-session.js` implements `Keep me signed in`:

- ECDSA P-256 key pair generated once per browser profile
- private key stored in IndexedDB as non-extractable
- session payload signed with the private key
- signature verified on every boot before trusting the cached session
- 7-day expiry
- manual localStorage edits break verification and force re-login

This protects against casual storage tampering. It is not a replacement for server-issued auth tokens.

### Role-based access control

`assets/js/auth.js` and `assets/js/authz.js` define the permission matrix.

Roles include:

- `super_administrator`
- `administrator`
- `co_useradmin`
- `co_admin`
- `accountant`
- `operator`
- `viewer`
- `auditor`
- `standard_user`

Permissions are action-scoped and include:

- module access
- data scope
- sensitive field restrictions
- audit logging for critical mutations

The User Admin panel requires **both** a paid multi-user license and an administrator/co-admin role. Role alone is not sufficient.

---

## Freemium and licensing

### Free account

A newly registered account is provisioned as:

```js
role: "standard_user"
masterControl: "operations"
multiUserLicensed: false
workspacePlan: "single_user"
multiUserQuota: 1
```

`free_owner` is retained only as a backward-compatible alias for `standard_user`.

Free accounts appear in:

- Paid & Multi-User Licensed Workspaces
- Companies & Workspaces Directory

This is intentional for platform governance. Visibility does not grant admin control.

### Paid multi-user license

Granting a license sets:

```js
role: "administrator"
masterControl: "administration"
multiUserLicensed: true
workspacePlan: "multi_user"
multiUserQuota: 25
licenseAutoRevoked: false
licenseValidUntil: <epoch milliseconds>
```

Available periods in the admin license modal:

- 1 month
- 3 months
- 6 months
- 12 months
- custom number of days

### Renewal and revocation

- Granting a period to an already licensed workspace is treated as a renewal.
- Renewal clears `licenseAutoRevoked`, replaces `licenseValidUntil`, and sends `license_renewed`.
- Manual revoke downgrades the owner to `standard_user`, sets `masterControl: "operations"`, resets quota to 1, and sends `workspace_license_revoked`.

### Automatic expiry revoke

The Apps Script trigger `checkLicenseExpiry()` runs daily at 06:00 IST.

On expiry it:

1. sends `license_expired`
2. calls `revokeExpiredLicense()`
3. downgrades the owner to `standard_user`
4. sets `masterControl: "operations"`
5. sets `multiUserQuota: 1`
6. sets `licenseAutoRevoked: true`

Auto-revoke happens once. A new grant or renewal is required to restore paid access.

### Expiry reminder milestones

| Days remaining | Template |
|---|---|
| 7 | `license_expiring_7day` |
| 3 | `license_expiring_3day` |
| 0 | `license_expiring_today` |
| expired | `license_expired` |
| missed milestone fallback | `license_expiring` |

---

## Platform master control

`admin.html` is the platform super-admin console.

Features:

- global analytics
- global user directory
- companies and workspaces directory
- paid and multi-user licensed workspaces
- license grant, renewal, and revoke controls with expiry column
- suspend/reactivate user
- suspend/reactivate whole workspace
- delete user or team member
- system broadcasts, in-app only
- promotions and releases
- tutorials and support CMS
- master audit logs
- master admins and co-pilots
- platform settings
- Email Center
- real-time email queue monitor

### Actions that automatically send email

| Action | Template |
|---|---|
| Suspend user | `account_suspended` |
| Reactivate user | `account_reactivated` |
| Suspend workspace | `account_suspended` to owner and members |
| Reactivate workspace | `account_reactivated` to owner and members |
| Delete user | `account_deleted` |
| Delete team member | `account_deleted` |
| Grant license | `workspace_licensed` |
| Renew license | `license_renewed` |
| Revoke license | `workspace_license_revoked` |

### Email Center restriction

The Email Center only composes and queues:

- promotional / announcement campaigns
- `custom_message` personal messages

It never exposes OTP, login, account, security, license, or system-alert templates for manual sending. Those are automatic.

---

## Automated email system

### Email stack

Entirely free:

- Google Apps Script Web App
- Google Sheets template repository
- MailApp for transactional/system mail
- GmailApp for promotional mail with native unsubscribe headers
- Firebase Realtime Database Spark plan for queues and logs
- free public IP lookup services

### Gateway

Canonical gateway source: `email-templates/mail-gateway-api.gs`

```text
Endpoint: https://script.google.com/macros/s/AKfycbx7NIHQPjtDxOxCh8hj2CrxV1EtuTM6DxJ-jowWDjWpcKd3-4GM6RFuJIObjDI12H92/exec
Health:   <endpoint>?action=health
Version:  mail-gateway-api.gs|2026-11-26-full-lifecycle-v6
```

Only these actions are called directly by the browser:

- `otp_send`
- `otp_verify`
- `preview`

`MAIL_GATEWAY_TOKEN` is never placed in browser code. All other sends are written to Firebase and processed server-side.

### Queue flow

```text
Application event
  -> UnitaxMail helper
  -> Firebase System/EmailQueue
  -> Apps Script processEmailQueue() every 1 minute
  -> render Google Sheet template
  -> MailApp or GmailApp
  -> System/EmailLogs and System/EmailStats
```

### Firebase email paths

| Path | Purpose |
|---|---|
| `System/EmailQueue` | Pending and completed send jobs |
| `System/EmailCampaigns` | Campaign records and status |
| `System/EmailLogs` | Per-recipient send and failure audit |
| `System/EmailStats` | Daily send count for quota guard |
| `System/EmailDedupe` | Idempotency keys |
| `System/OtpRequests` | Active OTP state |
| `System/OtpCooldown` | Resend throttling |
| `System/OtpLogs` | OTP send and verify audit |

### Sender names and transports

| Category | Transport | Sender name |
|---|---|---|
| Account, security, license, system | MailApp | `UniTax Pro` |
| Promotional | GmailApp + `List-Unsubscribe` | `UniTax Pro Notifications` |
| Promotional fallback | MailApp | `UniTax Pro Notifications` |

Promotional templates always include an in-body Unsubscribe button. One-click `List-Unsubscribe-Post` is opt-in through the `UNSUB_ONE_CLICK` Apps Script property.

Daily guard: 90 sends/day, leaving headroom under the free Gmail allowance.

### Templates

Current import file: `email-templates/UniTax_Email_Templates.no-logo.csv`

Google Sheet:

```text
ID:  1W_gdvBtS8oeQBvMvboMrq10Xa932O5K6I96o8o5n50E
Tab: Sheet1
```

Columns:

```text
templateId, category, sender, subject, htmlBody, textBody,
requiredKeys, active, updatedAt, description
```

Template groups:

| Group | Templates |
|---|---|
| OTP and password | `otp_login`, `otp_signup`, `otp_resend`, `otp_master_2fa`, `forgot_password`, `password_reset` |
| Account lifecycle | `account_created`, `account_deleted`, `account_suspended`, `account_reactivated` |
| Security | `password_changed`, `security_update`, `security_alert`, `suspicious_login_attempt`, `account_security` |
| License | `workspace_licensed`, `license_renewed`, `workspace_license_revoked`, `license_expiring`, `license_expiring_7day`, `license_expiring_3day`, `license_expiring_today`, `license_expired` |
| Promotional | `promotion_release`, `system_maintenance`, `broadcast_announcement` |
| Personal and system | `custom_message`, `system_alert` |

Format rules:

- dynamic `{{token}}` rendering
- ASCII-only text to avoid mojibake
- professional business-letter layout
- no date badge
- IP, approximate location, device, and browser badges on context templates
- no in-body logo image

The avatar shown beside emails in Gmail is controlled by the sending Google Account profile photo, not by Apps Script or HTML. Change the Google Account profile picture or use a dedicated Google Workspace brand account.

### Automatic vs admin-composable

Automatic:

- OTP and password reset
- account created, deleted, suspended, reactivated
- password changed and suspicious login
- security update, alert, overview
- license purchased, renewed, revoked
- license 7-day, 3-day, today, expired
- system alert

Admin-composable:

- promotional campaigns
- `custom_message`

---

## Data architecture

Firebase Realtime Database is the single data store.

### Global and workspace paths

| Path | Purpose |
|---|---|
| `Utilities/` | notifications, broadcasts, users, updates, help center, sessions, master audit log, platform master |
| `Workspaces/{id}/` | everything owned by a workspace: masters, transactions, members, settings, audit logs, requests |
| `Sessions/` / `Utilities/Sessions/` | live session registry, one record per open tab, expires after 60 seconds of silence |
| `Users/{id}/workspace/` | legacy account/workspace records still used by the master console and mail gateway |

`assets/js/schema.js` exposes `window.UniPaths` so modules do not hand-build paths.

It supports:

- workspace identity resolution
- global utility paths
- workspace-scoped paths
- path-aware transaction locations with legacy and v3 layouts
- legacy-to-new path migration map

### Real-time behavior

- Firebase `.on('value')` listeners drive background accounting sync.
- Notification and approval state are read from the server first, with local fallback.
- Bulk imports use a single atomic multi-path update.
- Critical mutations write audit records.

---

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript ES6+, Bootstrap 5 |
| Hosting | GitHub Pages, no build step |
| Router | Hash-based router in `assets/js/router.js` |
| Database | Firebase Realtime Database |
| Password hashing | Web Crypto SHA-256 with application salt |
| Session signing | Web Crypto ECDSA P-256 in IndexedDB |
| Email | Google Apps Script Web App |
| Email templates | Google Sheets tab `Sheet1` |
| Email transports | MailApp and GmailApp |
| IP context | ipwho.is, ipapi.co, freeipapi.com, ipify |
| Scheduled jobs | Apps Script time triggers |
| Styling | `variables.css`, `style.css`, `modules.css`, `print.css` |

---

## Repository structure

```text
.
├── index.html                       Main ERP shell and hash router host
├── login.html                       Authentication, OTP, password reset, master 2FA
├── admin.html                       Platform master control, licensing, Email Center
├── privacy.html                     Privacy policy
├── terms.html                       Terms of service
├── database.rules.json              Firebase RTDB rule snapshot
├── package.json                     Project metadata
├── robots.txt, sitemap.xml          Search metadata
├── README.md                        This feature and operations guide
├── PROJECT_ANALYSIS.md              Deep technical and security analysis
│
├── assets/
│   ├── css/
│   │   ├── variables.css            Design tokens
│   │   ├── style.css                High-density ERP styles
│   │   ├── modules.css              Module-specific styles
│   │   └── print.css                Print/PDF styling
│   ├── img/                         Logo and brand assets
│   ├── docs/                        Privacy and copyright text
│   └── js/
│       ├── api.js                   Data access and voucher posting
│       ├── app.js                   App lifecycle and error boundary
│       ├── approval-engine.js       Approval hierarchy and state machine
│       ├── auth.js                  Permission matrix and guards
│       ├── authz.js                 Role normalization and authorization policy
│       ├── accounting-engine.js     Live financial aggregation and cache
│       ├── bulk-validate.js         Bulk master import validation
│       ├── crud.js                  Central UniTaxCRUD service
│       ├── drilldown.js             Master record drill-down
│       ├── list-viewer.js           Utility list rendering
│       ├── paths.js                 Path helpers
│       ├── print-engine.js          Statutory print/PDF generation
│       ├── router.js                Hash router and breadcrumbs
│       ├── schema.js                Firebase path schema
│       ├── secure-session.js        Signed 7-day session store
│       ├── utils.js                 Crypto, formatting, Indian currency helpers
│       └── viewer.js                Criteria-first ERP data viewer
│
├── modules/
│   ├── dashboard.html               Executive dashboard
│   ├── settings.html                Workspace settings
│   ├── admin.html                   Admin module shell
│   ├── masters/                     Company, ledger, stock, project create/list/bulk forms
│   ├── transactions/                Sales, purchase, returns, receipts, payments, journals, tasks
│   ├── reports/                     GL, balance sheet, P&L, trial balance, cash flow, GST, approvals
│   ├── print/                       Invoice and voucher print templates
│   ├── utilities/                   User Admin panel, profile, notifications, list views, About/Updates
│   └── help/article.html            Help center article viewer
│
└── email-templates/
    ├── webapp-mail-client.js        Browser-side window.UnitaxMail API
    ├── mail-gateway-api.gs          Canonical Apps Script gateway
    ├── mail-gateway.gs              Deprecated reference; do not deploy
    ├── generate-templates.js        Template source generator
    ├── UniTax_Email_Templates.no-logo.csv  Current 28-template import file
    ├── templates.json               Template metadata backup
    └── README.md                    Email deployment and operations guide
```

---

## Setup and deployment

### 1. GitHub Pages

The app is static. Upload the repository to GitHub and enable Pages from the main branch.

Deep links work on refresh because routing uses URL hashes, for example:

```text
https://krshnaunitax05.github.io/UniTaxPro/index.html#/reports/gl-statement
```

A ready deployment archive is available locally as:

```text
UniTaxPro-deploy-final.zip
```

It contains:

```text
login.html
admin.html
index.html
email-templates/webapp-mail-client.js
```

After upload, verify that this URL returns JavaScript and not 404:

```text
https://krshnaunitax05.github.io/UniTaxPro/email-templates/webapp-mail-client.js
```

### 2. Firebase

Create a Firebase Realtime Database and set the URL in the client configuration. The current project uses:

```text
https://unitax-8d2e2-default-rtdb.asia-southeast1.firebasedatabase.app
```

For development only, `database.rules.json` currently contains open read/write rules. See [Security notes](#security-notes) before production use.

### 3. Google Sheet templates

Create a Sheet with tab name `Sheet1` and import:

```text
email-templates/UniTax_Email_Templates.no-logo.csv
```

Replace all existing rows. This is required for the `license_renewed` template.

### 4. Apps Script email gateway

1. Create or open the Apps Script project linked to the Web App URL.
2. Delete all existing code.
3. Paste **only** `email-templates/mail-gateway-api.gs`.
4. Save.
5. Run these functions once:
   ```js
   showGatewayVersion()
   diagnoseConfig()
   installUnitaxTriggers()
   ```
6. Deploy → Manage deployments → edit → **New version**.
7. Keep Web App settings:
   - Execute as: `Me`
   - Access: `Anyone`

Triggers installed:

| Trigger | Frequency | Purpose |
|---|---|---|
| `processEmailQueue()` | every 1 minute | drains `System/EmailQueue` |
| `checkLicenseExpiry()` | daily 06:00 IST | reminders and automatic revoke |

Do not paste `mail-gateway.gs` into the same project. It is deprecated and causes duplicate-function errors.

### 5. Sender avatar

To change the DP shown by Gmail:

1. Sign in to the sending Google account.
2. Open `myaccount.google.com`.
3. Go to Personal info → Profile picture.
4. Upload the UniTax Pro brand image.
5. Allow time for Gmail clients to refresh the cached avatar.

---

## Configuration reference

### Apps Script properties

| Property | Purpose |
|---|---|
| `MAIL_GATEWAY_TOKEN` | Protects admin-only Web App actions; never put in browser code |
| `FIREBASE_SECRET` | Optional if Firebase rules are later locked down |
| `FIREBASE_DB_URL` | Firebase RTDB endpoint |
| `UNSUB_ONE_CLICK` | Enables `List-Unsubscribe-Post` |
| `EMAIL_TEMPLATE_SHEET_ID` | Optional Sheet ID override |

### Hardcoded defaults

| Setting | Value |
|---|---|
| Firebase DB | `https://unitax-8d2e2-default-rtdb.asia-southeast1.firebasedatabase.app` |
| Template Sheet ID | `1W_gdvBtS8oeQBvMvboMrq10Xa932O5K6I96o8o5n50E` |
| Template tab | `Sheet1` |
| App key | `unitax-web-v5` |
| Support email | `prounitax@gmail.com` |
| Login URL | `https://krshnaunitax05.github.io/UniTaxPro/login.html` |
| Admin URL | `https://krshnaunitax05.github.io/UniTaxPro/admin.html` |
| OTP validity | 10 minutes |
| Max OTP attempts | 3 |
| Daily mail cap | 90 |

The mail endpoint can be overridden before the client script loads:

```html
<script>
  window.UNITAX_MAIL_ENDPOINT = 'https://script.google.com/.../exec';
</script>
```

---

## Verification checklist

### Gateway health

Open:

```text
https://script.google.com/macros/s/AKfycbx7NIHQPjtDxOxCh8hj2CrxV1EtuTM6DxJ-jowWDjWpcKd3-4GM6RFuJIObjDI12H92/exec?action=health
```

Expected version:

```text
mail-gateway-api.gs|2026-11-26-full-lifecycle-v6
```

### OTP

Test login, signup, forgot-password, resend, and master 2FA.

Check:

```text
System/OtpLogs
```

### Lifecycle email

Suspend or reactivate a user, then check:

```text
System/EmailQueue -> new record, status "sent" within 1 minute
System/EmailLogs  -> sent record for account_suspended / account_reactivated
```

### License lifecycle

Grant a license, then renew it.

Expected templates:

```text
workspace_licensed
license_renewed
```

Use a short test expiry and run `checkLicenseExpiry()`.

Expected:

```text
license_expiring_7day
license_expiring_3day
license_expiring_today
license_expired
```

After expiry, verify the owner is downgraded and `licenseAutoRevoked` is `true`.

### Promotional mail

Send a campaign from the Email Center.

Expected:

- sender name `UniTax Pro Notifications`
- `List-Unsubscribe` header
- in-body Unsubscribe button

---

## Security notes

### Current protections

- salted SHA-256 password hashing before storage
- ECDSA-signed 7-day sessions with non-extractable keys
- server-side OTP generation and verification
- role and license gating for admin screens
- audit logs for mutations
- daily email quota guard
- idempotency keys and dedupe records

### Risks to address before public production

| Risk | Severity | Recommendation |
|---|---|---|
| Firebase rules are fully open | High | Restrict reads/writes by authenticated UID and workspace |
| Password hashing is client-side | High | Move to Firebase Auth or server-side verification |
| Static master credentials in `login.html` | High | Move to a secure backend |
| Fallback gateway token in Apps Script | Medium | Keep token only in Script Properties and rotate it |
| Browser can write directly to the email queue | Medium | Add server-side proxy validation or App Check |

For a detailed review, see `PROJECT_ANALYSIS.md`.

---

## Documentation

| Document | Purpose |
|---|---|
| `README.md` | Feature guide, setup, and operations |
| `PROJECT_ANALYSIS.md` | Architecture, licensing, email system, security review, deployment status |
| `email-templates/README.md` | Email gateway deployment, templates, troubleshooting |

---

## Current status and next steps

Local code contains all requested behavior. The last live verification found stale deployments:

| Component | Last observed live status | Required action |
|---|---|---|
| GitHub Pages | old build | upload `UniTaxPro-deploy-final.zip` |
| `webapp-mail-client.js` | 404 | upload into `email-templates/` |
| Apps Script | `brand-logo-v3` | replace code and deploy `full-lifecycle-v6` |
| System email | not working live | fixed locally, needs deployment |
| License auto-revoke | present in v6 | install trigger and redeploy |

Remaining steps:

1. Publish the latest browser files.
2. Re-import the 28-template CSV into `Sheet1`.
3. Replace Apps Script code and deploy v6.
4. Run `installUnitaxTriggers()`.
5. Verify OTP, lifecycle email, license purchase/renewal/reminders/expiry revoke, and promotional mail.
6. Harden Firebase rules and authentication before public production use.

---

**UniTax Technologies Global**
