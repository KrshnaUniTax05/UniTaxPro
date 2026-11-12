# UniTax Pro — Enterprise ERP & Financial Operations Platform

UniTax Pro is a production-oriented Enterprise Resource Planning (ERP) platform designed for practical accounting, double-entry bookkeeping, GST taxation compliance, inventory management, multi-tier organizational approvals, and user access governance.

---

## 🏛️ Architectural Overview

- **Frontend Core:** HTML5, CSS3, Vanilla JavaScript (ES6+), Bootstrap 5.
- **Routing Engine:** Centralized URL Hash Router (`assets/js/router.js`) compatible with GitHub Pages and static hosting.
- **Data Access Layer & CRUD:** Centralized `UniTaxCRUD` service (`assets/js/crud.js`) supporting master and transaction entities, row-level validation, batching, and soft deletion.
- **Role-Based Access Control (RBAC):** Multi-tier permission matrix (`assets/js/auth.js`) supporting 7 enterprise security roles, action capabilities, data scopes, sensitive field restrictions, and immutable audit logging.
- **Data Viewer & Reporting Engine:** SAP FBL3N inspired dynamic viewer (`assets/js/viewer.js`) providing criteria-first retrieval, dynamic column choosers, multi-select popovers, client/server pagination, in-table filters, and export capabilities.
- **Database Engine:** Firebase Realtime Database with double-entry ledger routing and master cache invalidation.

---

## 📁 Repository Structure

```text
├── index.html                  # Main application gateway and enterprise shell
├── login.html                  # Secure authentication portal (SHA-256 password hashing)
├── assets/
│   ├── css/
│   │   ├── variables.css       # Enterprise design system CSS variables
│   │   └── style.css           # High-density ERP styles and responsive overrides
│   ├── js/
│   │   ├── utils.js            # Cryptography, formatting, Indian currency (₹), grid helpers
│   │   ├── crud.js             # Centralized UniTaxCRUD service & module registry
│   │   ├── auth.js             # Multi-tier RBAC permission matrix & audit trail
│   │   ├── viewer.js           # Criteria-first ERP data viewer (SAP FBL3N style)
│   │   ├── router.js           # Central URL Hash Router & breadcrumb generator
│   │   ├── api.js              # Data access layer, voucher posting & master management
│   │   └── app.js              # Application core lifecycle & global error boundary
│   └── img/                    # Brand icons and visual assets
├── modules/
│   ├── dashboard.html          # Executive OS Financial Dashboard
│   ├── settings.html           # System, company, and workspace settings
│   ├── admin.html              # Super-admin broadcast & maintenance portal
│   ├── masters/                # Legal entity, ledger, stock, and project masters
│   ├── transactions/           # Sales, purchases, debit/credit notes, payment/receipts
│   ├── reports/                # GL statement, GSTR-1, stock summary, approvals
│   ├── print/                  # Formatted print documents (invoices, vouchers)
│   └── utilities/              # User Admin Control Panel, profile, notifications
├── .gitignore                  # Git tracking rules excluding secrets and env files
└── package.json                # Project descriptor and metadata
```

---

## 🔒 Security Best Practices

1. **Client-Side SHA-256 Password Hashing:** Passwords are cryptographically salted and hashed prior to persistence, preventing plaintext credential storage in the database.
2. **Administrative Access Guards:** Navigation to `#utilities/useradmincontrolpanel` enforces role verification (`administrator`, `workspaceowner`).
3. **Audit Trails:** Critical mutations (user provisioning, rights modification, voucher deletions) write to `${workspaceId}/AuditLogs`.
4. **Firebase Security Rules:** In Firebase Console, configure database rules restricting read/write permissions per workspace user node:
   ```json
   {
     "rules": {
       "Users": {
         "$uid": {
           ".read": "auth != null",
           ".write": "auth != null"
         }
       }
     }
   }
   ```

---

## 🚀 Deployment

The project runs directly on **GitHub Pages** without requiring a Node.js runtime or build step:
- Open `https://krshnaunitax05.github.io/UniTaxPro/`
- Direct URLs (e.g. `index.html#/reports/gl-statement`) function properly on page refresh.
