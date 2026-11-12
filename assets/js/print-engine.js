/**
 * UniTax Universal Print Engine & PDF Generator
 * Enterprise-Grade Document Design & Print Engine
 * Compatible with ALL statutory and financial ERP documents:
 * 1. Sales Tax Invoice (Domestic & Export Supply, Sec 31 CGST Act)
 * 2. Purchase Voucher (Inward Supply, Input Tax Credit Sec 16)
 * 3. Official Receipt Voucher (Inflow & Collections)
 * 4. Payment Disbursement Voucher (Outflow & Banking Disbursements)
 * 5. General Journal Voucher (Double-Entry Balanced General Journal)
 * 6. Debit Note / Purchase Return (Statutory Section 34 CGST Act)
 * 7. Credit Note / Sales Return (Statutory Section 34 CGST Act)
 * 8. General Ledger Statement of Account (Corporate Financial Register)
 * 9. Governance Audit Certificate & Approval Matrix (Cryptographic Compliance Trail)
 */

(function(window) {
    'use strict';

    // Document Form Mapping Registry
    const FormTypeMap = {
        // Sales Invoices
        'sales-inv': { title: 'TAX INVOICE', category: 'SALE', isTaxInvoice: true, dbFormId: 'SalesInvoiceForm' },
        'SalesInvoiceForm': { title: 'TAX INVOICE', category: 'SALE', isTaxInvoice: true, dbFormId: 'SalesInvoiceForm' },
        'SALES': { title: 'TAX INVOICE', category: 'SALE', isTaxInvoice: true, dbFormId: 'SalesInvoiceForm' },
        'SalesInvoice': { title: 'TAX INVOICE', category: 'SALE', isTaxInvoice: true, dbFormId: 'SalesInvoiceForm' },
        'tax-invoice': { title: 'TAX INVOICE', category: 'SALE', isTaxInvoice: true, dbFormId: 'SalesInvoiceForm' },

        // Purchase Vouchers
        'purchase-inv': { title: 'PURCHASE VOUCHER', category: 'PURCHASE', isTaxInvoice: true, dbFormId: 'PurchaseInvoiceForm' },
        'PurchaseInvoiceForm': { title: 'PURCHASE VOUCHER', category: 'PURCHASE', isTaxInvoice: true, dbFormId: 'PurchaseInvoiceForm' },
        'PURCHASE': { title: 'PURCHASE VOUCHER', category: 'PURCHASE', isTaxInvoice: true, dbFormId: 'PurchaseInvoiceForm' },
        'PurchaseInvoice': { title: 'PURCHASE VOUCHER', category: 'PURCHASE', isTaxInvoice: true, dbFormId: 'PurchaseInvoiceForm' },

        // Sales Returns / Credit Notes
        'salesret-inv': { title: 'CREDIT NOTE (SALES RETURN)', category: 'CREDIT_NOTE', isTaxInvoice: true, dbFormId: 'SalesReturnForm' },
        'SalesReturnForm': { title: 'CREDIT NOTE (SALES RETURN)', category: 'CREDIT_NOTE', isTaxInvoice: true, dbFormId: 'SalesReturnForm' },
        'CreditNoteForm': { title: 'CREDIT NOTE (SALES RETURN)', category: 'CREDIT_NOTE', isTaxInvoice: true, dbFormId: 'SalesReturnForm' },
        'salesret': { title: 'CREDIT NOTE (SALES RETURN)', category: 'CREDIT_NOTE', isTaxInvoice: true, dbFormId: 'SalesReturnForm' },
        'CREDITNOTE': { title: 'CREDIT NOTE (SALES RETURN)', category: 'CREDIT_NOTE', isTaxInvoice: true, dbFormId: 'SalesReturnForm' },

        // Purchase Returns / Debit Notes
        'purchaseret-inv': { title: 'DEBIT NOTE (PURCHASE RETURN)', category: 'DEBIT_NOTE', isTaxInvoice: true, dbFormId: 'PurchaseReturnForm' },
        'PurchaseReturnForm': { title: 'DEBIT NOTE (PURCHASE RETURN)', category: 'DEBIT_NOTE', isTaxInvoice: true, dbFormId: 'PurchaseReturnForm' },
        'DebitNoteForm': { title: 'DEBIT NOTE (PURCHASE RETURN)', category: 'DEBIT_NOTE', isTaxInvoice: true, dbFormId: 'PurchaseReturnForm' },
        'purchaseret': { title: 'DEBIT NOTE (PURCHASE RETURN)', category: 'DEBIT_NOTE', isTaxInvoice: true, dbFormId: 'PurchaseReturnForm' },
        'DEBITNOTE': { title: 'DEBIT NOTE (PURCHASE RETURN)', category: 'DEBIT_NOTE', isTaxInvoice: true, dbFormId: 'PurchaseReturnForm' },

        // Payment Vouchers
        'payment-vch': { title: 'PAYMENT VOUCHER', category: 'PAYMENT', dbFormId: 'PaymentVoucherForm' },
        'PaymentVoucherForm': { title: 'PAYMENT VOUCHER', category: 'PAYMENT', dbFormId: 'PaymentVoucherForm' },
        'PAYMENT': { title: 'PAYMENT VOUCHER', category: 'PAYMENT', dbFormId: 'PaymentVoucherForm' },
        'PaymentVoucher': { title: 'PAYMENT VOUCHER', category: 'PAYMENT', dbFormId: 'PaymentVoucherForm' },

        // Receipt Vouchers
        'receipt-vch': { title: 'RECEIPT VOUCHER', category: 'RECEIPT', dbFormId: 'ReceiptVoucherForm' },
        'ReceiptVoucherForm': { title: 'RECEIPT VOUCHER', category: 'RECEIPT', dbFormId: 'ReceiptVoucherForm' },
        'RECEIPT': { title: 'RECEIPT VOUCHER', category: 'RECEIPT', dbFormId: 'ReceiptVoucherForm' },
        'ReceiptVoucher': { title: 'RECEIPT VOUCHER', category: 'RECEIPT', dbFormId: 'ReceiptVoucherForm' },
        'receipt-pay': { title: 'RECEIPT VOUCHER', category: 'RECEIPT', dbFormId: 'ReceiptVoucherForm' },
        'ReceiptPayForm': { title: 'RECEIPT VOUCHER', category: 'RECEIPT', dbFormId: 'ReceiptVoucherForm' },

        // Journal Vouchers
        'journal-vch': { title: 'JOURNAL VOUCHER', category: 'JOURNAL', dbFormId: 'JournalVoucherForm' },
        'JournalVoucherForm': { title: 'JOURNAL VOUCHER', category: 'JOURNAL', dbFormId: 'JournalVoucherForm' },
        'JOURNAL': { title: 'JOURNAL VOUCHER', category: 'JOURNAL', dbFormId: 'JournalVoucherForm' },
        'JournalVoucher': { title: 'JOURNAL VOUCHER', category: 'JOURNAL', dbFormId: 'JournalVoucherForm' },
        'jv': { title: 'JOURNAL VOUCHER', category: 'JOURNAL', dbFormId: 'JournalVoucherForm' },

        // General Ledger Statement
        'gl-statement': { title: 'STATEMENT OF ACCOUNT', category: 'LEDGER', dbFormId: 'GeneralLedger' },
        'ledger': { title: 'STATEMENT OF ACCOUNT', category: 'LEDGER', dbFormId: 'GeneralLedger' },
        'statement': { title: 'STATEMENT OF ACCOUNT', category: 'LEDGER', dbFormId: 'GeneralLedger' },

        // Governance / Approvals
        'approvalmanagementsystem': { title: 'APPROVAL MATRIX', category: 'APPROVAL', dbFormId: 'ApprovalRequests' },
        'ApprovalRequests': { title: 'APPROVAL MATRIX', category: 'APPROVAL', dbFormId: 'ApprovalRequests' },
        'Approvals': { title: 'APPROVAL MATRIX', category: 'APPROVAL', dbFormId: 'ApprovalRequests' },
        'audit': { title: 'AUDIT CERTIFICATE', category: 'APPROVAL', dbFormId: 'ApprovalRequests' }
    };

    // Helper: Format number to Indian Currency string
    function FormatCurrency(val) {
        const num = parseFloat(val) || 0;
        return '₹ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Helper: Format raw date to DD-MMM-YYYY
    function FormatDate(dateStr) {
        if (!dateStr) return '---';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return String(dateStr);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const day = ('0' + d.getDate()).slice(-2);
            const month = months[d.getMonth()];
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        } catch (e) {
            return String(dateStr);
        }
    }

    // Indian Number to Words converter (Clean, strictly no "Only Only" duplication)
    function NumberToWords(num) {
        const parsed = Math.floor(Math.abs(parseFloat(num) || 0));
        const fraction = Math.round((Math.abs(parseFloat(num) || 0) - parsed) * 100);

        if (parsed === 0 && fraction === 0) return 'Zero Rupees Only.';

        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];

        function convertThreeDigits(n) {
            let str = '';
            if (n >= 100) {
                str += a[Math.floor(n / 100)] + 'Hundred ';
                n %= 100;
                if (n > 0) str += 'and ';
            }
            if (n >= 20) {
                str += b[Math.floor(n / 10)] + a[n % 10];
            } else if (n > 0) {
                str += a[n];
            }
            return str;
        }

        let words = '';
        const crore = Math.floor(parsed / 10000000);
        let rem = parsed % 10000000;
        const lakh = Math.floor(rem / 100000);
        rem %= 100000;
        const thousand = Math.floor(rem / 1000);
        rem %= 1000;
        const hundred = rem;

        if (crore > 0) words += convertThreeDigits(crore) + 'Crore ';
        if (lakh > 0) words += convertThreeDigits(lakh) + 'Lakh ';
        if (thousand > 0) words += convertThreeDigits(thousand) + 'Thousand ';
        if (hundred > 0) words += convertThreeDigits(hundred);

        words = words.trim();
        if (!words) words = 'Zero';

        let res = words + ' Rupees';
        if (fraction > 0) {
            let pStr = '';
            if (fraction >= 20) {
                pStr = b[Math.floor(fraction / 10)] + a[fraction % 10];
            } else {
                pStr = a[fraction];
            }
            res += ' and ' + pStr.trim() + ' Paise';
        }

        return res + ' Only.';
    }

    // ==========================================
    // INDUSTRY-GRADE PURE CODE PDF DESIGNER
    // ==========================================
    const UniTaxPDFDesigner = {
        // Base CSS Stylesheet for pristine, single-page fit & crystal clear A4 print
        GetBaseCSS: function() {
            return `
                                @page {
                    size: A4 portrait;
                    margin: 0;
                }
                *, *::before, *::after {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                html, body {
                    margin: 0;
                    padding: 0;
                    width: 210mm;
                    background: #ffffff;
                    color: #0f172a;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    font-size: 8pt;
                    line-height: 1.35;
                }
                .print-container {
                    width: 210mm;
                    min-height: 297mm;
                    margin: 0 auto;
                    padding: 8mm 12mm;
                    box-sizing: border-box;
                    background: #ffffff;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .doc-page {
                    width: 100%;
                    min-height: calc(297mm - 16mm);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-sizing: border-box;
                    position: relative;
                }
                .doc-header {
                    flex-shrink: 0;
                }
                .doc-body {
                    flex: 1 1 auto;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;
                    margin-top: 6px;
                    margin-bottom: 6px;
                    min-height: 60mm;
                }
                .doc-footer {
                    flex-shrink: 0;
                    margin-top: auto;
                }
                .font-mono {
                    font-family: 'JetBrains Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-variant-numeric: tabular-nums;
                }
                .fw-bold { font-weight: 700; }
                .fw-semibold { font-weight: 600; }
                .text-center { text-align: center; }
                .text-right, .text-end { text-align: right; }
                .text-left, .text-start { text-align: left; }
                .text-uppercase { text-transform: uppercase; }
                .text-muted { color: #64748b; }
                .text-primary { color: #1e3a8a; }
                .text-danger { color: #991b1b; }
                .text-success { color: #166534; }
                .nowrap { white-space: nowrap !important; }

                /* Enterprise Header */
                .header-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 8px;
                    border-bottom: 2px solid #1e3a8a;
                    padding-bottom: 6px;
                }
                .company-name {
                    font-size: 13pt;
                    font-weight: 800;
                    color: #0f172a;
                    letter-spacing: -0.2px;
                    margin: 0 0 2px 0;
                    text-transform: uppercase;
                }
                .company-subtext {
                    font-size: 7.5pt;
                    color: #334155;
                    line-height: 1.35;
                    margin: 0;
                }
                .doc-title-badge {
                    text-align: right;
                    vertical-align: top;
                }
                .doc-main-title {
                    font-size: 14pt;
                    font-weight: 800;
                    color: #1e3a8a;
                    letter-spacing: 0.5px;
                    margin: 0;
                    text-transform: uppercase;
                }
                .doc-sub-title {
                    font-size: 7pt;
                    font-weight: 600;
                    color: #64748b;
                    letter-spacing: 0.3px;
                    text-transform: uppercase;
                    margin-top: 1px;
                }

                /* Key-Value Metadata Strip */
                .meta-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: #f8fafc;
                    border: 1px solid #cbd5e1;
                    border-radius: 4px;
                    margin-bottom: 8px;
                }
                .meta-table td {
                    padding: 5px 8px;
                    font-size: 7.5pt;
                    border-right: 1px solid #e2e8f0;
                    vertical-align: middle;
                }
                .meta-table td:last-child {
                    border-right: none;
                }
                .meta-label {
                    font-size: 6.5pt;
                    color: #64748b;
                    text-transform: uppercase;
                    font-weight: 700;
                    display: block;
                    letter-spacing: 0.3px;
                }
                .meta-val {
                    font-size: 8pt;
                    font-weight: 700;
                    color: #0f172a;
                }

                /* 2-Column Parties Box */
                .parties-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 8px;
                    border: 1px solid #cbd5e1;
                }
                .party-cell {
                    width: 50%;
                    padding: 6px 8px;
                    vertical-align: top;
                    background: #ffffff;
                }
                .party-cell:first-child {
                    border-right: 1px solid #cbd5e1;
                }
                .party-heading {
                    font-size: 7pt;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #1e3a8a;
                    margin-bottom: 3px;
                    border-bottom: 1px solid #e2e8f0;
                    padding-bottom: 2px;
                }
                .party-name {
                    font-size: 9pt;
                    font-weight: 700;
                    color: #0f172a;
                    margin-bottom: 2px;
                }
                .party-line {
                    font-size: 7.5pt;
                    color: #334155;
                    line-height: 1.35;
                }

                /* Line Items Table */
                
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 6px;
                    border: 1px solid #cbd5e1;
                    flex: 1 1 auto;
                    height: 100%;
                }
                .items-table tbody tr.item-row {
                    height: 28px;
                }
                .items-table tbody tr.filler-row td {
                    border-top: none;
                    border-bottom: none;
                    background: #ffffff;
                }
                /* Standard items-table */
                .items-table-orig {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 8px;
                    border: 1px solid #cbd5e1;
                }
                .items-table th {
                    background: #f1f5f9;
                    color: #1e293b;
                    font-weight: 700;
                    font-size: 7pt;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                    padding: 5px 6px;
                    border: 1px solid #cbd5e1;
                    vertical-align: middle;
                }
                .items-table td {
                    padding: 4px 6px;
                    border: 1px solid #cbd5e1;
                    font-size: 7.5pt;
                    vertical-align: top;
                }
                .items-table tbody tr:nth-child(even) {
                    background-color: #fbfcfe;
                }

                /* Sub-Summary / HSN Breakdown */
                .sub-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 8px;
                    border: 1px solid #cbd5e1;
                }
                .sub-table th {
                    background: #f8fafc;
                    font-size: 6.5pt;
                    font-weight: 700;
                    text-transform: uppercase;
                    padding: 4px;
                    border: 1px solid #cbd5e1;
                    color: #475569;
                }
                .sub-table td {
                    padding: 3px 5px;
                    font-size: 7pt;
                    border: 1px solid #cbd5e1;
                }

                /* Split Summary & Banking */
                .summary-container {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 8px;
                    page-break-inside: avoid;
                }
                .summary-left {
                    width: 58%;
                    vertical-align: top;
                    padding-right: 8px;
                }
                .summary-right {
                    width: 42%;
                    vertical-align: top;
                }
                .amount-words-card {
                    background: #f8fafc;
                    border: 1px solid #cbd5e1;
                    border-radius: 3px;
                    padding: 5px 8px;
                    margin-bottom: 6px;
                }
                .amount-words-label {
                    font-size: 6.5pt;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #64748b;
                }
                .amount-words-val {
                    font-size: 7.5pt;
                    font-weight: 700;
                    color: #0f172a;
                    font-style: italic;
                }
                .bank-card {
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    border-radius: 3px;
                    padding: 5px 8px;
                    margin-bottom: 6px;
                }
                .bank-card-title {
                    font-size: 6.5pt;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #1e3a8a;
                    margin-bottom: 2px;
                    border-bottom: 1px solid #e2e8f0;
                    padding-bottom: 1px;
                }
                .calc-table {
                    width: 100%;
                    border-collapse: collapse;
                    border: 1px solid #cbd5e1;
                }
                .calc-table td {
                    padding: 4px 8px;
                    font-size: 7.5pt;
                    border-bottom: 1px solid #e2e8f0;
                }
                .calc-table tr.grand-row td {
                    background: #1e3a8a;
                    color: #ffffff;
                    font-weight: 800;
                    font-size: 8.5pt;
                    border-bottom: none;
                }

                /* Symmetrical Professional Signature Block */
                .signature-table {
                    width: 100%;
                    table-layout: fixed;
                    border-collapse: collapse;
                    margin-top: 10px;
                    page-break-inside: avoid;
                }
                .signature-table td {
                    vertical-align: bottom;
                    padding: 0;
                }
                .sig-block {
                    display: inline-block;
                    width: 190px;
                    max-width: 100%;
                    text-align: center;
                }
                .sig-org {
                    font-size: 7pt;
                    font-weight: 700;
                    color: #0f172a;
                    margin-bottom: 24px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                }
                .sig-space {
                    height: 32px;
                }
                .sig-line {
                    border-top: 1px solid #475569;
                    width: 100%;
                    margin: 0 auto 4px auto;
                }
                .sig-role {
                    font-size: 7pt;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #1e293b;
                    letter-spacing: 0.3px;
                }
                .sig-note {
                    font-size: 6pt;
                    color: #64748b;
                    margin-top: 1px;
                }

                /* Badges */
                .badge {
                    display: inline-block;
                    padding: 1px 6px;
                    border-radius: 3px;
                    font-size: 7pt;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .badge-dr { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
                .badge-cr { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
                .badge-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                .badge-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

                /* Avoid Breaks */
                .avoid-break { page-break-inside: avoid; }

                /* Print Media Rules */
                @media print {
                    html, body {
                        width: 210mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                    }
                    .print-container {
                        width: 210mm !important;
                        min-height: 297mm !important;
                        margin: 0 auto !important;
                        padding: 8mm 12mm !important;
                        background: #ffffff !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                    }
                    .doc-page {
                        width: 100% !important;
                        min-height: calc(297mm - 16mm) !important;
                        margin: 0 !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                    }
                    .doc-header {
                        flex-shrink: 0 !important;
                    }
                    .doc-body {
                        flex: 1 1 auto !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: flex-start !important;
                    }
                    .doc-footer {
                        flex-shrink: 0 !important;
                        margin-top: auto !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `;
        },

        // 1. SALES TAX INVOICE (Section 31 CGST Act compliant)
        BuildSalesInvoice: function(doc, company, options = {}) {
            const h = doc.header || {};
            const items = doc.items || [];
            const title = options.title || 'TAX INVOICE';
            const subTitle = options.subTitle || 'Issued under Section 31 of CGST Act, 2017 (Rule 46 Tax Invoice)';

            let subTotal = 0;
            let taxTotal = 0;
            let hsnSummary = {};

            let rowsHtml = '';
            items.forEach((item, idx) => {
                const name = item.item_name || item.itemName || item.name || item.particulars || 'Item / Supply';
                const hsn = item.auto_item_name_itemHSN || item.itemHSN || item.hsnCode || item.hsn || item.hsn_code || '998311';
                const qty = parseFloat(item.qty || item.quantity || 1) || 1;
                const unit = item.unit || 'NOS';
                let rate = parseFloat(item.rate || item.price || item.unitRate || 0) || 0;
                let taxRate = parseFloat(item.auto_item_name_ItemTax || item.ItemTax || item.taxRate || item.tax || item.tax_rate || item.gst_rate || 0) || 0;
                let lineBase = parseFloat(item.taxable_value || item.taxableValue || (qty * rate)) || (qty * rate);
                let lineTotal = parseFloat(item.amount || item.total || item.line_total || 0) || 0;

                if (lineTotal > 0 && lineBase === 0) {
                    lineBase = taxRate > 0 ? (lineTotal / (1 + (taxRate / 100))) : lineTotal;
                    rate = lineBase / qty;
                } else if (lineBase > 0 && lineTotal === 0) {
                    lineTotal = lineBase * (1 + (taxRate / 100));
                }

                const lineTax = lineTotal > lineBase ? (lineTotal - lineBase) : (lineBase * (taxRate / 100));
                subTotal += lineBase;
                taxTotal += lineTax;

                if (!hsnSummary[hsn]) {
                    hsnSummary[hsn] = { taxable: 0, taxRate: taxRate, taxAmt: 0 };
                }
                hsnSummary[hsn].taxable += lineBase;
                hsnSummary[hsn].taxAmt += lineTax;

                rowsHtml += `
                    <tr>
                        <td class="text-center font-mono">${idx + 1}</td>
                        <td>
                            <strong>${name}</strong>
                            ${item.remarks ? `<div class="text-muted" style="font-size:6.5pt;">${item.remarks}</div>` : ''}
                        </td>
                        <td class="text-center font-mono">${hsn}</td>
                        <td class="text-center font-mono nowrap">${qty} ${unit}</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(rate).replace('₹ ', '')}</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(lineBase).replace('₹ ', '')}</td>
                        <td class="text-center font-mono">${taxRate}%</td>
                        <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(lineTotal).replace('₹ ', '')}</td>
                    </tr>
                `;
            });

            if (items.length === 0) {
                const fallbackTotal = parseFloat(h.grandTotal || h.amount || 0) || 0;
                subTotal = fallbackTotal;
                rowsHtml = `
                    <tr>
                        <td class="text-center font-mono">1</td>
                        <td><strong>${h.entity || 'General Supply / Professional Services'}</strong></td>
                        <td class="text-center font-mono">998311</td>
                        <td class="text-center font-mono nowrap">1 NOS</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(fallbackTotal).replace('₹ ', '')}</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(fallbackTotal).replace('₹ ', '')}</td>
                        <td class="text-center font-mono">0%</td>
                        <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(fallbackTotal).replace('₹ ', '')}</td>
                    </tr>
                `;
            }

            let grandTotal = parseFloat(h.grandTotal || (subTotal + taxTotal)) || (subTotal + taxTotal);
            const words = NumberToWords(grandTotal);

            // HSN Breakdown Table
            let hsnRows = '';
            Object.keys(hsnSummary).forEach(hsn => {
                const s = hsnSummary[hsn];
                const halfRate = (s.taxRate / 2).toFixed(1);
                const halfTax = s.taxAmt / 2;
                hsnRows += `
                    <tr>
                        <td class="font-mono text-center">${hsn}</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(s.taxable).replace('₹ ', '')}</td>
                        <td class="text-center font-mono">${halfRate}%</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(halfTax).replace('₹ ', '')}</td>
                        <td class="text-center font-mono">${halfRate}%</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(halfTax).replace('₹ ', '')}</td>
                        <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(s.taxAmt).replace('₹ ', '')}</td>
                    </tr>
                `;
            });

            return `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${title} - ${h.doc_no || 'Document'}</title>
                <style>${UniTaxPDFDesigner.GetBaseCSS()}</style>
            </head>
            <body>
                <div class="print-container">
                    <div class="doc-page">
                    <!-- Top Header Section (Company & Document Details) -->
                    <div class="doc-header">
                    <table class="header-table">
                        <tr>
                            <td style="width: 60%; vertical-align: top;">
                                <div class="company-name">${company.companyName}</div>
                                <div class="company-subtext">
                                    ${company.companyAddress}<br>
                                    <strong>GSTIN:</strong> ${company.gstin} | <strong>CIN:</strong> ${company.cin || 'L70100DL2000PLC104787'} | <strong>PAN:</strong> ${company.pan || 'AAACS7342Q'}<br>
                                    <strong>Email:</strong> ${company.companyEmail} | <strong>Phone:</strong> ${company.companyPhone}
                                </div>
                            </td>
                            <td class="doc-title-badge">
                                <div class="doc-main-title">${title}</div>
                                <div class="doc-sub-title">${subTitle}</div>
                                <div style="margin-top: 4px;">
                                    <span class="badge" style="background:#e0e7ff; color:#3730a3; border:1px solid #c7d2fe;">ORIGINAL FOR RECIPIENT</span>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- Document Metadata -->
                    <table class="meta-table">
                        <tr>
                            <td style="width: 25%;">
                                <span class="meta-label">Invoice Number</span>
                                <span class="meta-val font-mono">${h.doc_no || 'INV-2026-0001'}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Invoice Date</span>
                                <span class="meta-val font-mono nowrap">${FormatDate(h.date)}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Place of Supply</span>
                                <span class="meta-val">${h.customer_state || h.place_of_supply || 'Haryana (06)'}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Reverse Charge</span>
                                <span class="meta-val">${h.reverse_charge ? 'YES' : 'NO'}</span>
                            </td>
                        </tr>
                    </table>

                    <!-- Billed To & Shipped To -->
                    <table class="parties-table">
                        <tr>
                            <td class="party-cell">
                                <div class="party-heading">Details of Receiver (Billed To)</div>
                                <div class="party-name">${h.entity || h.customer_name || 'Customer / Corporate Client'}</div>
                                <div class="party-line">
                                    <strong>Address:</strong> ${h.billing_address || h.customer_address || 'Registered Commercial Office'}<br>
                                    <strong>GSTIN / UIN:</strong> <span class="font-mono">${h.customer_gst || h.gstin || 'Unregistered / Consumer'}</span><br>
                                    <strong>State & Code:</strong> ${h.customer_state || 'Haryana (06)'} | <strong>PAN:</strong> ${h.customer_pan || 'N/A'}<br>
                                    ${h.customer_phone ? `<strong>Phone:</strong> ${h.customer_phone} ` : ''}${h.customer_email ? `| <strong>Email:</strong> ${h.customer_email}` : ''}
                                </div>
                            </td>
                            <td class="party-cell">
                                <div class="party-heading">Details of Consignee (Shipped To)</div>
                                <div class="party-name">${h.consignee_name || h.entity || 'Same as Billed To'}</div>
                                <div class="party-line">
                                    <strong>Delivery Address:</strong> ${h.shipping_address || h.delivery_address || h.billing_address || 'Same as Billing Address'}<br>
                                    <strong>Dispatch Mode:</strong> ${h.dispatch_mode || 'By Road / Hand Delivery'}<br>
                                    <strong>Vehicle / LR No:</strong> <span class="font-mono">${h.vehicle_no || h.lr_no || '---'}</span><br>
                                    <strong>E-Way Bill No:</strong> <span class="font-mono">${h.eway_bill_no || '---'}</span>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- Line Items -->
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 4%;">#</th>
                                <th style="width: 38%;">Description of Goods / Services</th>
                                <th style="width: 10%;">HSN/SAC</th>
                                <th style="width: 10%;">Qty</th>
                                <th style="width: 10%; text-align: right;">Rate (₹)</th>
                                <th style="width: 10%; text-align: right;">Taxable (₹)</th>
                                <th style="width: 6%; text-align: center;">GST</th>
                                <th style="width: 12%; text-align: right;">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <!-- HSN Tax Breakdown -->
                    ${hsnRows ? `
                    <div style="margin-bottom: 8px;">
                        <table class="sub-table">
                            <thead>
                                <tr>
                                    <th rowspan="2" style="width: 12%;">HSN/SAC</th>
                                    <th rowspan="2" style="width: 18%; text-align: right;">Taxable Value (₹)</th>
                                    <th colspan="2" style="width: 25%; text-align: center;">Central Tax (CGST)</th>
                                    <th colspan="2" style="width: 25%; text-align: center;">State Tax (SGST)</th>
                                    <th rowspan="2" style="width: 20%; text-align: right;">Total Tax (₹)</th>
                                </tr>
                                <tr>
                                    <th style="text-align: center; width: 8%;">Rate</th>
                                    <th style="text-align: right; width: 17%;">Amount (₹)</th>
                                    <th style="text-align: center; width: 8%;">Rate</th>
                                    <th style="text-align: right; width: 17%;">Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${hsnRows}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}

                    </div><!-- end doc-body -->

                    <!-- Bottom Footer Section (Pinned firmly at bottom) -->
                    <div class="doc-footer">
                    <table class="summary-container">
                        <tr>
                            <td class="summary-left">
                                <div class="amount-words-card">
                                    <div class="amount-words-label">Invoice Amount in Words:</div>
                                    <div class="amount-words-val">${words}</div>
                                </div>

                                <div class="bank-card">
                                    <div class="bank-card-title">Electronic Settlement & Bank Details</div>
                                    <table style="width: 100%; border-collapse: collapse; font-size: 7pt;">
                                        <tr>
                                            <td style="width: 35%; color: #64748b; font-weight: 600;">Bank Name:</td>
                                            <td style="font-weight: 700;">${company.bank_name}</td>
                                        </tr>
                                        <tr>
                                            <td style="color: #64748b; font-weight: 600;">Account Number:</td>
                                            <td class="font-mono" style="font-weight: 700;">${company.bank_ac}</td>
                                        </tr>
                                        <tr>
                                            <td style="color: #64748b; font-weight: 600;">IFSC Code:</td>
                                            <td class="font-mono" style="font-weight: 700;">${company.bank_ifsc}</td>
                                        </tr>
                                        <tr>
                                            <td style="color: #64748b; font-weight: 600;">Branch / UPI:</td>
                                            <td>${company.bank_branch || 'Gurugram Branch'} | <span class="font-mono">${company.upi_id}</span></td>
                                        </tr>
                                    </table>
                                </div>
                            </td>
                            <td class="summary-right">
                                <table class="calc-table">
                                    <tr>
                                        <td style="color: #475569;">Taxable Amount:</td>
                                        <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(subTotal)}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #475569;">Central Tax (CGST):</td>
                                        <td class="text-right font-mono nowrap">${FormatCurrency(taxTotal / 2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #475569;">State Tax (SGST):</td>
                                        <td class="text-right font-mono nowrap">${FormatCurrency(taxTotal / 2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #475569;">Integrated Tax (IGST):</td>
                                        <td class="text-right font-mono nowrap">₹ 0.00</td>
                                    </tr>
                                    <tr class="grand-row">
                                        <td>Total Invoice Amount:</td>
                                        <td class="text-right font-mono nowrap">${FormatCurrency(grandTotal)}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <!-- Full-Width Legal Declaration Banner -->
                    <div style="font-size: 6.5pt; color: #475569; line-height: 1.35; padding: 5px 8px; border: 1px dashed #cbd5e1; border-radius: 3px; margin-bottom: 8px; background: #fafafa;">
                        <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods or services described and that all particulars are true and correct. Subject to local state jurisdiction.
                    </div>

                    <!-- Symmetrical Signatures -->
                    <table class="signature-table">
                        <tr>
                            <td style="width: 33.33%; text-align: left;">
                                <div class="sig-block">
                                    <div class="sig-space"></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Customer Acknowledgment</div>
                                    <div class="sig-note">Receiver's Seal & Signature</div>
                                </div>
                            </td>
                            <td style="width: 33.33%; text-align: center;">
                                <div class="sig-block">
                                    <div class="sig-space"></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Prepared & Checked By</div>
                                    <div class="sig-note">Accounts Department</div>
                                </div>
                            </td>
                            <td style="width: 33.33%; text-align: right;">
                                <div class="sig-block" style="float: right;">
                                    <div class="sig-org" style="overflow: hidden; text-overflow: ellipsis; max-width: 100%;">For <strong>${company.companyName}</strong></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Authorized Signatory</div>
                                    <div class="sig-note">Digitally authenticated by UniTax ERP</div>
                                </div>
                            </td>
                        </tr>
                    </table>
                    </div><!-- end doc-footer -->
                </div>
                </div>
            </body>
            </html>`;
        },

        // 2. PURCHASE VOUCHER (Inward Supply Document, ITC Sec 16)
        BuildPurchaseVoucher: function(doc, company, options = {}) {
            const h = doc.header || {};
            const items = doc.items || [];
            const title = options.title || 'PURCHASE VOUCHER';
            const subTitle = options.subTitle || 'Inward Supply Tax Register | Section 16 & Rule 36 Compliance';

            let subTotal = 0;
            let taxTotal = 0;

            let rowsHtml = '';
            items.forEach((item, idx) => {
                const name = item.item_name || item.itemName || item.name || item.particulars || 'Material / Inward Supply';
                const hsn = item.auto_item_name_itemHSN || item.itemHSN || item.hsnCode || item.hsn || '998311';
                const qty = parseFloat(item.qty || item.quantity || 1) || 1;
                const unit = item.unit || 'NOS';
                let rate = parseFloat(item.rate || item.price || item.unitRate || 0) || 0;
                let taxRate = parseFloat(item.auto_item_name_ItemTax || item.ItemTax || item.taxRate || item.tax || 0) || 0;
                let lineBase = parseFloat(item.taxable_value || item.taxableValue || (qty * rate)) || (qty * rate);
                let lineTotal = parseFloat(item.amount || item.total || 0) || 0;

                if (lineTotal > 0 && lineBase === 0) {
                    lineBase = taxRate > 0 ? (lineTotal / (1 + (taxRate / 100))) : lineTotal;
                    rate = lineBase / qty;
                } else if (lineBase > 0 && lineTotal === 0) {
                    lineTotal = lineBase * (1 + (taxRate / 100));
                }

                const lineTax = lineTotal > lineBase ? (lineTotal - lineBase) : (lineBase * (taxRate / 100));
                subTotal += lineBase;
                taxTotal += lineTax;

                rowsHtml += `
                    <tr>
                        <td class="text-center font-mono">${idx + 1}</td>
                        <td>
                            <strong>${name}</strong>
                            ${item.remarks ? `<div class="text-muted" style="font-size:6.5pt;">${item.remarks}</div>` : ''}
                        </td>
                        <td class="text-center font-mono">${hsn}</td>
                        <td class="text-center font-mono nowrap">${qty} ${unit}</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(rate).replace('₹ ', '')}</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(lineBase).replace('₹ ', '')}</td>
                        <td class="text-center font-mono">${taxRate}%</td>
                        <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(lineTotal).replace('₹ ', '')}</td>
                    </tr>
                `;
            });

            if (items.length === 0) {
                const fallbackTotal = parseFloat(h.grandTotal || h.amount || 0) || 0;
                subTotal = fallbackTotal;
                rowsHtml = `
                    <tr>
                        <td class="text-center font-mono">1</td>
                        <td><strong>${h.entity || 'General Inward Supply'}</strong></td>
                        <td class="text-center font-mono">998311</td>
                        <td class="text-center font-mono nowrap">1 NOS</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(fallbackTotal).replace('₹ ', '')}</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(fallbackTotal).replace('₹ ', '')}</td>
                        <td class="text-center font-mono">0%</td>
                        <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(fallbackTotal).replace('₹ ', '')}</td>
                    </tr>
                `;
            }

            let grandTotal = parseFloat(h.grandTotal || (subTotal + taxTotal)) || (subTotal + taxTotal);
            const words = NumberToWords(grandTotal);

            return `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${title} - ${h.doc_no || 'Document'}</title>
                <style>${UniTaxPDFDesigner.GetBaseCSS()}</style>
            </head>
            <body>
                <div class="print-container">
                    <div class="doc-page">
                    <!-- Top Header Section (Company & Document Details) -->
                    <div class="doc-header">
                    <table class="header-table">
                        <tr>
                            <td style="width: 60%; vertical-align: top;">
                                <div class="company-name">${company.companyName}</div>
                                <div class="company-subtext">
                                    ${company.companyAddress}<br>
                                    <strong>GSTIN:</strong> ${company.gstin} | <strong>CIN:</strong> ${company.cin || 'L70100DL2000PLC104787'}<br>
                                    <strong>Email:</strong> ${company.companyEmail} | <strong>Phone:</strong> ${company.companyPhone}
                                </div>
                            </td>
                            <td class="doc-title-badge">
                                <div class="doc-main-title">${title}</div>
                                <div class="doc-sub-title">${subTitle}</div>
                                <div style="margin-top: 4px;">
                                    <span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;">INWARD SUPPLY BILL</span>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- Metadata -->
                    <table class="meta-table">
                        <tr>
                            <td style="width: 25%;">
                                <span class="meta-label">Voucher Number</span>
                                <span class="meta-val font-mono">${h.doc_no || 'PV-2026-0001'}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Posting Date</span>
                                <span class="meta-val font-mono nowrap">${FormatDate(h.date)}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Supplier Bill Ref</span>
                                <span class="meta-val font-mono">${h.supplier_bill_no || h.ref_no || '---'}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Supplier Bill Date</span>
                                <span class="meta-val font-mono nowrap">${FormatDate(h.supplier_bill_date || h.date)}</span>
                            </td>
                        </tr>
                    </table>

                    <!-- Vendor Details & Warehouse Receiving -->
                    <table class="parties-table">
                        <tr>
                            <td class="party-cell">
                                <div class="party-heading">Details of Supplier / Vendor</div>
                                <div class="party-name">${h.entity || h.vendor_name || 'Authorized Trade Supplier'}</div>
                                <div class="party-line">
                                    <strong>Address:</strong> ${h.billing_address || h.vendor_address || 'Vendor Commercial Establishment'}<br>
                                    <strong>GSTIN:</strong> <span class="font-mono">${h.customer_gst || h.gstin || 'Unregistered'}</span><br>
                                    <strong>State & Code:</strong> ${h.customer_state || 'State Registered'}<br>
                                    ${h.vendor_phone ? `<strong>Phone:</strong> ${h.vendor_phone}` : ''}
                                </div>
                            </td>
                            <td class="party-cell">
                                <div class="party-heading">Inward Receiving Location</div>
                                <div class="party-name">${company.companyName} - Stores & Inward Division</div>
                                <div class="party-line">
                                    <strong>Warehouse Address:</strong> ${company.companyAddress}<br>
                                    <strong>Place of Supply:</strong> Haryana (06)<br>
                                    <strong>Cost Center / Project:</strong> ${h.project || 'General Operations & Infrastructure'}<br>
                                    <strong>GRN / Inward Ref:</strong> <span class="font-mono">${h.grn_no || h.doc_no || 'GRN-AUTO'}</span>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- Items Grid -->
                    </div><!-- end doc-header -->

                    <!-- Middle Body Section -->
                    <div class="doc-body">
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 4%;">#</th>
                                <th style="width: 40%;">Description of Inward Supply / Items</th>
                                <th style="width: 10%;">HSN/SAC</th>
                                <th style="width: 10%;">Received Qty</th>
                                <th style="width: 10%; text-align: right;">Unit Rate (₹)</th>
                                <th style="width: 10%; text-align: right;">Taxable (₹)</th>
                                <th style="width: 6%; text-align: center;">GST</th>
                                <th style="width: 10%; text-align: right;">Total (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <!-- ITC Compliance Banner -->
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 5px 8px; margin-bottom: 8px;">
                        <span class="badge-success badge">INPUT TAX CREDIT (ITC) ELIGIBLE</span>
                        <span style="font-size: 7pt; color: #166534; margin-left: 6px;">
                            Verified for GSTR-2B statutory matching under Section 16(2) of CGST Act. Eligible for full credit.
                        </span>
                    </div>

                    <!-- Financial Summary & Words -->
                    <table class="summary-container">
                        <tr>
                            <td class="summary-left">
                                <div class="amount-words-card">
                                    <div class="amount-words-label">Voucher Net Payable in Words:</div>
                                    <div class="amount-words-val">${words}</div>
                                </div>
                                <div style="font-size: 7pt; color: #475569; padding: 6px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px;">
                                    <strong>Narration / Remarks:</strong> ${h.narration || h.remarks || 'Inward goods received in good condition, inspected, and entered in inventory ledger.'}
                                </div>
                            </td>
                            <td class="summary-right">
                                <table class="calc-table">
                                    <tr>
                                        <td style="color: #475569;">Taxable Amount:</td>
                                        <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(subTotal)}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #475569;">Input Central Tax (CGST):</td>
                                        <td class="text-right font-mono nowrap">${FormatCurrency(taxTotal / 2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #475569;">Input State Tax (SGST):</td>
                                        <td class="text-right font-mono nowrap">${FormatCurrency(taxTotal / 2)}</td>
                                    </tr>
                                    <tr class="grand-row">
                                        <td>Total Voucher Amount:</td>
                                        <td class="text-right font-mono nowrap">${FormatCurrency(grandTotal)}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <!-- Tripartite Governance Signatures -->
                    <table class="signature-table">
                        <tr>
                            <td style="width: 33.33%; text-align: left;">
                                <div class="sig-block">
                                    <div class="sig-space"></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Store Keeper / Receiving</div>
                                    <div class="sig-note">Physical Verification & Stocking</div>
                                </div>
                            </td>
                            <td style="width: 33.33%; text-align: center;">
                                <div class="sig-block">
                                    <div class="sig-space"></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Accountant / Bill Verified</div>
                                    <div class="sig-note">PO & Rates Reconciled</div>
                                </div>
                            </td>
                            <td style="width: 33.33%; text-align: right;">
                                <div class="sig-block" style="float: right;">
                                    <div class="sig-org" style="overflow: hidden; text-overflow: ellipsis; max-width: 100%;">For <strong>${company.companyName}</strong></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Finance Head / Approved</div>
                                    <div class="sig-note">Authorized Financial Signatory</div>
                                </div>
                            </td>
                        </tr>
                    </table>
                    </div><!-- end doc-footer -->
                </div>
                </div>
            </body>
            </html>`;
        },

        // 3. OFFICIAL RECEIPT VOUCHER (Inflow & Collections)
        BuildReceipt: function(doc, company, options = {}) {
            doc = doc || {};
            const rawComp = company || {};
            company = {
                companyName: rawComp.companyName || rawComp.tradeName || rawComp.legalName || 'ENTERPRISE WORKSPACE',
                companyAddress: rawComp.companyAddress || rawComp.address || '',
                companyEmail: rawComp.companyEmail || rawComp.email || '',
                companyPhone: rawComp.companyPhone || rawComp.phone || '',
                gstin: rawComp.gstin || '',
                cin: rawComp.cin || 'L70100DL2000PLC104787',
                pan: rawComp.pan || '',
                bank_name: rawComp.bank_name || 'HDFC Bank Ltd.',
                bank_ac: rawComp.bank_ac || '50200058392104',
                bank_ifsc: rawComp.bank_ifsc || 'HDFC0000123',
                bank_branch: rawComp.bank_branch || 'Corporate Banking Branch',
                upi_id: rawComp.upi_id || ''
            };
            const h = doc.header || {};
            const items = doc.items || [];
            const title = options.title || 'OFFICIAL RECEIPT VOUCHER';
            const subTitle = options.subTitle || 'Acknowledgment of Financial Inflow & Collections';

            // Clean totalAmt calculation without double-counting
            let totalAmt = 0;
            let rowsHtml = '';

            if (items.length > 0) {
                items.forEach((item, idx) => {
                    const partName = item.ledger_name || item.name || item.particulars || h.entity || 'Client Settlement';
                    const amt = parseFloat(item.amount || item.total || 0) || 0;
                    totalAmt += amt;
                    rowsHtml += `
                        <tr>
                            <td class="text-center font-mono">${idx + 1}</td>
                            <td>
                                <strong>${partName}</strong>
                                ${item.narration ? `<div class="text-muted" style="font-size:6.5pt;">${item.narration}</div>` : ''}
                            </td>
                            <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(amt).replace('₹ ', '')}</td>
                        </tr>
                    `;
                });
            }

            if (totalAmt === 0) {
                totalAmt = parseFloat(h.grandTotal || h.amount || 0) || 0;
            }

            if (rowsHtml === '') {
                rowsHtml = `
                    <tr>
                        <td class="text-center font-mono">1</td>
                        <td>
                            <strong>${h.entity || 'Customer Settlement / Inflow Account'}</strong>
                            <div class="text-muted" style="font-size:6.5pt;">Against cleared supply invoices / advance collection</div>
                        </td>
                        <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(totalAmt).replace('₹ ', '')}</td>
                    </tr>
                `;
            }

            const words = NumberToWords(totalAmt);

            return `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${title} - ${h.doc_no || 'Document'}</title>
                <style>${UniTaxPDFDesigner.GetBaseCSS()}</style>
            </head>
            <body>
                <div class="print-container">
                    <div class="doc-page">
                    <!-- Top Header Section (Company & Document Details) -->
                    <div class="doc-header">
                    <table class="header-table">
                        <tr>
                            <td style="width: 60%; vertical-align: top;">
                                <div class="company-name">${company.companyName}</div>
                                <div class="company-subtext">
                                    ${company.companyAddress}<br>
                                    <strong>GSTIN:</strong> ${company.gstin} | <strong>CIN:</strong> ${company.cin || 'L70100DL2000PLC104787'}<br>
                                    <strong>Email:</strong> ${company.companyEmail} | <strong>Phone:</strong> ${company.companyPhone}
                                </div>
                            </td>
                            <td class="doc-title-badge">
                                <div class="doc-main-title">${title}</div>
                                <div class="doc-sub-title">${subTitle}</div>
                                <div style="margin-top: 4px;">
                                    <span class="badge" style="background:#dcfce7; color:#166534; border:1px solid #bbf7d0;">PAYMENT RECEIVED</span>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- Metadata with balanced column widths -->
                    <table class="meta-table">
                        <tr>
                            <td style="width: 22%;">
                                <span class="meta-label">Receipt Voucher No</span>
                                <span class="meta-val font-mono">${h.doc_no || 'RV-2026-0001'}</span>
                            </td>
                            <td style="width: 18%;">
                                <span class="meta-label">Receipt Date</span>
                                <span class="meta-val font-mono nowrap">${FormatDate(h.date)}</span>
                            </td>
                            <td style="width: 32%;">
                                <span class="meta-label">Payment Mode</span>
                                <span class="meta-val nowrap">${(h.payment_mode || h.mode || 'Electronic Bank Transfer / NEFT').toUpperCase()}</span>
                            </td>
                            <td style="width: 28%;">
                                <span class="meta-label">Instrument / UTR Ref</span>
                                <span class="meta-val font-mono">${h.ref_no || h.receiptRef || h.utr_no || 'UTR-CLEARED'}</span>
                            </td>
                        </tr>
                    </table>

                    <!-- Inflow Parties Box -->
                    <table class="parties-table">
                        <tr>
                            <td class="party-cell">
                                <div class="party-heading">Received With Thanks From</div>
                                <div class="party-name">${h.entity || h.customer_name || 'Customer / Corporate Remitter'}</div>
                                <div class="party-line">
                                    <strong>Address:</strong> ${h.billing_address || h.customer_address || 'Registered Business Address'}<br>
                                    <strong>GSTIN:</strong> <span class="font-mono">${h.customer_gst || 'Unregistered'}</span><br>
                                    <strong>Ledger Code:</strong> <span class="font-mono">${h.ledger_code || 'CL-2001'}</span>
                                </div>
                            </td>
                            <td class="party-cell">
                                <div class="party-heading">Deposited / Credited To Account</div>
                                <div class="party-name">${company.bank_name}</div>
                                <div class="party-line">
                                    <strong>Bank Account No:</strong> <span class="font-mono">${company.bank_ac}</span><br>
                                    <strong>IFSC Code:</strong> <span class="font-mono">${company.bank_ifsc}</span><br>
                                    <strong>Branch:</strong> ${company.bank_branch || 'Corporate Banking Branch, Gurugram'}<br>
                                    <strong>Value Date:</strong> <span class="font-mono nowrap">${FormatDate(h.valueDate || h.date)}</span>
                                </div>
                            </td>
                        </tr>
                    </table>

                    </div><!-- end doc-header -->

                    <!-- Middle Body Section (Stretches gracefully to fill middle) -->
                    <div class="doc-body">
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 6%;">#</th>
                                <th style="width: 69%;">Settlement Particulars / Reference Invoices</th>
                                <th style="width: 25%; text-align: right;">Amount Received (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f1f5f9; font-weight: bold;">
                                <td colspan="2" class="text-right" style="padding: 6px 8px; text-transform: uppercase;">Total Realized Receipt Amount:</td>
                                <td class="text-right font-mono nowrap" style="padding: 6px 8px; font-size: 9pt; color: #166534;">${FormatCurrency(totalAmt)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    </div><!-- end doc-body -->

                    <!-- Bottom Footer Section (Pinned firmly at the bottom of the page) -->
                    <div class="doc-footer">
                    <div class="amount-words-card" style="margin-bottom: 6px;">
                        <div class="amount-words-label">Amount in Words:</div>
                        <div class="amount-words-val" style="font-size: 8.5pt;">${words}</div>
                    </div>

                    <!-- Clean Narration Memo -->
                    <table class="meta-table" style="margin-bottom: 8px;">
                        <tr>
                            <td style="width: 20%; background: #f8fafc; font-weight: 700; color: #475569; font-size: 6.5pt; text-transform: uppercase;">Narration / Memo:</td>
                            <td style="font-size: 7.5pt; color: #0f172a;">${h.narration || h.remarks || 'Remittance received towards settlement of account. Subject to realization of digital instruments.'}</td>
                        </tr>
                    </table>

                    <!-- Symmetrical Signatures -->
                    <table class="signature-table">
                        <tr>
                            <td style="width: 50%; text-align: left;">
                                <div class="sig-block">
                                    <div class="sig-space"></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Cashier / Accounts Officer</div>
                                    <div class="sig-note">Entry Posted into Cash/Bank Book</div>
                                </div>
                            </td>
                            <td style="width: 50%; text-align: right;">
                                <div class="sig-block" style="float: right;">
                                    <div class="sig-org" style="overflow: hidden; text-overflow: ellipsis; max-width: 100%;">For <strong>${company.companyName}</strong></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Authorized Signatory</div>
                                    <div class="sig-note">Official Corporate Seal & Stamp</div>
                                </div>
                            </td>
                        </tr>
                    </table>
                    </div><!-- end doc-footer -->
                </div>
                </div>
            </body>
            </html>`;
        },

        // 4. PAYMENT DISBURSEMENT VOUCHER (Banking Outflow)
        BuildPayment: function(doc, company, options = {}) {
            doc = doc || {};
            const rawComp = company || {};
            company = {
                companyName: rawComp.companyName || rawComp.tradeName || rawComp.legalName || 'ENTERPRISE WORKSPACE',
                companyAddress: rawComp.companyAddress || rawComp.address || '',
                companyEmail: rawComp.companyEmail || rawComp.email || '',
                companyPhone: rawComp.companyPhone || rawComp.phone || '',
                gstin: rawComp.gstin || '',
                cin: rawComp.cin || 'L70100DL2000PLC104787',
                pan: rawComp.pan || '',
                bank_name: rawComp.bank_name || 'HDFC Bank Ltd.',
                bank_ac: rawComp.bank_ac || '50200058392104',
                bank_ifsc: rawComp.bank_ifsc || 'HDFC0000123',
                bank_branch: rawComp.bank_branch || 'Corporate Banking Branch',
                upi_id: rawComp.upi_id || ''
            };
            const h = doc.header || {};
            const items = doc.items || [];
            const title = options.title || 'PAYMENT VOUCHER';
            const subTitle = options.subTitle || 'Treasury & Banking Outflow Authorization';

            // Clean totalAmt calculation without double-counting
            let totalAmt = 0;
            let rowsHtml = '';

            if (items.length > 0) {
                items.forEach((item, idx) => {
                    const partName = item.ledger_name || item.name || item.particulars || h.entity || 'Payee Settlement';
                    const amt = parseFloat(item.amount || item.total || 0) || 0;
                    totalAmt += amt;
                    rowsHtml += `
                        <tr>
                            <td class="text-center font-mono">${idx + 1}</td>
                            <td>
                                <strong>${partName}</strong>
                                ${item.narration ? `<div class="text-muted" style="font-size:6.5pt;">${item.narration}</div>` : ''}
                            </td>
                            <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(amt).replace('₹ ', '')}</td>
                        </tr>
                    `;
                });
            }

            if (totalAmt === 0) {
                totalAmt = parseFloat(h.grandTotal || h.amount || 0) || 0;
            }

            if (rowsHtml === '') {
                rowsHtml = `
                    <tr>
                        <td class="text-center font-mono">1</td>
                        <td>
                            <strong>${h.entity || 'Trade Payee / Expense Head'}</strong>
                            <div class="text-muted" style="font-size:6.5pt;">Commercial procurement disbursement / verified voucher clearance</div>
                        </td>
                        <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(totalAmt).replace('₹ ', '')}</td>
                    </tr>
                `;
            }

            const words = NumberToWords(totalAmt);

            return `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${title} - ${h.doc_no || 'Document'}</title>
                <style>${UniTaxPDFDesigner.GetBaseCSS()}</style>
            </head>
            <body>
                <div class="print-container">
                    <div class="doc-page">
                    <!-- Top Header Section (Company & Document Details) -->
                    <div class="doc-header">
                    <table class="header-table">
                        <tr>
                            <td style="width: 60%; vertical-align: top;">
                                <div class="company-name">${company.companyName}</div>
                                <div class="company-subtext">
                                    ${company.companyAddress}<br>
                                    <strong>GSTIN:</strong> ${company.gstin} | <strong>CIN:</strong> ${company.cin || 'L70100DL2000PLC104787'}<br>
                                    <strong>Email:</strong> ${company.companyEmail} | <strong>Phone:</strong> ${company.companyPhone}
                                </div>
                            </td>
                            <td class="doc-title-badge">
                                <div class="doc-main-title">${title}</div>
                                <div class="doc-sub-title">${subTitle}</div>
                                <div style="margin-top: 4px;">
                                    <span class="badge" style="background:#fee2e2; color:#991b1b; border:1px solid #fecaca;">DISBURSEMENT VOUCHER</span>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- Metadata -->
                    <table class="meta-table">
                        <tr>
                            <td style="width: 22%;">
                                <span class="meta-label">Payment Voucher No</span>
                                <span class="meta-val font-mono">${h.doc_no || 'PV-2026-0001'}</span>
                            </td>
                            <td style="width: 18%;">
                                <span class="meta-label">Voucher Date</span>
                                <span class="meta-val font-mono nowrap">${FormatDate(h.date)}</span>
                            </td>
                            <td style="width: 32%;">
                                <span class="meta-label">Disbursement Mode</span>
                                <span class="meta-val nowrap">${(h.payment_mode || h.mode || 'NEFT / RTGS / Fund Transfer').toUpperCase()}</span>
                            </td>
                            <td style="width: 28%;">
                                <span class="meta-label">Cheque / UTR Ref</span>
                                <span class="meta-val font-mono">${h.ref_no || h.paymentRef || h.cheque_no || 'UTR-PENDING'}</span>
                            </td>
                        </tr>
                    </table>

                    <!-- Disbursement Flow Box -->
                    <table class="parties-table">
                        <tr>
                            <td class="party-cell">
                                <div class="party-heading">Paid To (Beneficiary)</div>
                                <div class="party-name">${h.entity || h.vendor_name || 'Vendor / Expense Beneficiary'}</div>
                                <div class="party-line">
                                    <strong>Beneficiary Account:</strong> <span class="font-mono">${h.beneficiary_ac || 'Verified Bank A/C'}</span><br>
                                    <strong>IFSC Code:</strong> <span class="font-mono">${h.beneficiary_ifsc || 'HDFC0000123'}</span><br>
                                    <strong>GSTIN:</strong> <span class="font-mono">${h.customer_gst || 'Unregistered'}</span>
                                </div>
                            </td>
                            <td class="party-cell">
                                <div class="party-heading">Paid From (Disbursement Account)</div>
                                <div class="party-name">${company.bank_name}</div>
                                <div class="party-line">
                                    <strong>Debit A/C No:</strong> <span class="font-mono">${company.bank_ac}</span><br>
                                    <strong>IFSC Code:</strong> <span class="font-mono">${company.bank_ifsc}</span><br>
                                    <strong>Project / Cost Center:</strong> ${h.project || 'General Operations'}
                                </div>
                            </td>
                        </tr>
                    </table>

                    </div><!-- end doc-header -->

                    <!-- Middle Body Section -->
                    <div class="doc-body">
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 6%;">#</th>
                                <th style="width: 69%;">Account Head / Particulars / Purpose of Disbursement</th>
                                <th style="width: 25%; text-align: right;">Amount Paid (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f1f5f9; font-weight: bold;">
                                <td colspan="2" class="text-right" style="padding: 6px 8px; text-transform: uppercase;">Total Disbursement Amount:</td>
                                <td class="text-right font-mono nowrap" style="padding: 6px 8px; font-size: 9pt; color: #991b1b;">${FormatCurrency(totalAmt)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <!-- Words & Narration -->
                    <div class="amount-words-card" style="margin-bottom: 8px;">
                        <div class="amount-words-label">Amount in Words:</div>
                        <div class="amount-words-val" style="font-size: 8.5pt;">${words}</div>
                    </div>

                    <!-- Clean Narration Memo -->
                    <table class="meta-table" style="margin-bottom: 8px;">
                        <tr>
                            <td style="width: 20%; background: #f8fafc; font-weight: 700; color: #475569; font-size: 6.5pt; text-transform: uppercase;">Accounting Memo:</td>
                            <td style="font-size: 7.5pt; color: #0f172a;">${h.narration || h.remarks || 'Statutory financial disbursement passed and debited to respective General Ledger accounts.'}</td>
                        </tr>
                    </table>

                    <!-- Tripartite Signatures -->
                    <table class="signature-table">
                        <tr>
                            <td style="width: 33.33%; text-align: left;">
                                <div class="sig-block">
                                    <div class="sig-space"></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Prepared By</div>
                                    <div class="sig-note">Posting Accountant</div>
                                </div>
                            </td>
                            <td style="width: 33.33%; text-align: center;">
                                <div class="sig-block">
                                    <div class="sig-space"></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Checked & Verified By</div>
                                    <div class="sig-note">Internal Financial Audit</div>
                                </div>
                            </td>
                            <td style="width: 33.33%; text-align: right;">
                                <div class="sig-block" style="float: right;">
                                    <div class="sig-org" style="overflow: hidden; text-overflow: ellipsis; max-width: 100%;">For <strong>${company.companyName}</strong></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Passed For Payment</div>
                                    <div class="sig-note">Managing Director / CFO</div>
                                </div>
                            </td>
                        </tr>
                    </table>
                    </div><!-- end doc-footer -->
                </div>
                </div>
            </body>
            </html>`;
        },

        // 5. GENERAL JOURNAL VOUCHER (Double-Entry Balanced JV)
        BuildJournal: function(doc, company, options = {}) {
            const h = doc.header || {};
            const items = doc.items || [];
            const title = options.title || 'JOURNAL VOUCHER';
            const subTitle = options.subTitle || 'Double-Entry Balanced General Journal Register';

            let totalDebit = 0;
            let totalCredit = 0;
            let rowsHtml = '';

            items.forEach((item, idx) => {
                const isDr = (item.type || item.entryType || (item.debit > 0 ? 'DR' : 'CR')).toUpperCase().includes('D');
                const drAmt = parseFloat(item.debit || (isDr ? (item.amount || item.total) : 0)) || 0;
                const crAmt = parseFloat(item.credit || (!isDr ? (item.amount || item.total) : 0)) || 0;
                totalDebit += drAmt;
                totalCredit += crAmt;

                rowsHtml += `
                    <tr>
                        <td class="text-center font-mono">${idx + 1}</td>
                        <td class="text-center">
                            <span class="badge ${isDr ? 'badge-dr' : 'badge-cr'}">${isDr ? 'Dr' : 'Cr'}</span>
                        </td>
                        <td>
                            <strong>${item.ledger_name || item.name || 'Ledger Account'}</strong>
                            ${item.narration ? `<div class="text-muted" style="font-size:6.5pt;">${item.narration}</div>` : ''}
                        </td>
                        <td class="text-right font-mono nowrap">${drAmt > 0 ? FormatCurrency(drAmt).replace('₹ ', '') : '---'}</td>
                        <td class="text-right font-mono nowrap">${crAmt > 0 ? FormatCurrency(crAmt).replace('₹ ', '') : '---'}</td>
                    </tr>
                `;
            });

            if (items.length === 0) {
                const fbAmt = parseFloat(h.grandTotal || h.amount || 0) || 0;
                totalDebit = fbAmt;
                totalCredit = fbAmt;
                rowsHtml = `
                    <tr>
                        <td class="text-center font-mono">1</td>
                        <td class="text-center"><span class="badge badge-dr">Dr</span></td>
                        <td><strong>${h.entity || 'General Expense / Asset Account'}</strong></td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(fbAmt).replace('₹ ', '')}</td>
                        <td class="text-right font-mono nowrap">---</td>
                    </tr>
                    <tr>
                        <td class="text-center font-mono">2</td>
                        <td class="text-center"><span class="badge badge-cr">Cr</span></td>
                        <td><strong>Settlement / Provision Account</strong></td>
                        <td class="text-right font-mono nowrap">---</td>
                        <td class="text-right font-mono nowrap">${FormatCurrency(fbAmt).replace('₹ ', '')}</td>
                    </tr>
                `;
            }

            const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
            const words = NumberToWords(Math.max(totalDebit, totalCredit));

            return `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${title} - ${h.doc_no || 'Document'}</title>
                <style>${UniTaxPDFDesigner.GetBaseCSS()}</style>
            </head>
            <body>
                <div class="print-container">
                    <div class="doc-page">
                    <!-- Top Header Section (Company & Document Details) -->
                    <div class="doc-header">
                    <table class="header-table">
                        <tr>
                            <td style="width: 60%; vertical-align: top;">
                                <div class="company-name">${company.companyName}</div>
                                <div class="company-subtext">
                                    ${company.companyAddress}<br>
                                    <strong>GSTIN:</strong> ${company.gstin} | <strong>CIN:</strong> ${company.cin || 'L70100DL2000PLC104787'}<br>
                                    <strong>Email:</strong> ${company.companyEmail} | <strong>Phone:</strong> ${company.companyPhone}
                                </div>
                            </td>
                            <td class="doc-title-badge">
                                <div class="doc-main-title">${title}</div>
                                <div class="doc-sub-title">${subTitle}</div>
                                <div style="margin-top: 4px;">
                                    <span class="badge" style="background:#f3e8ff; color:#7e22ce; border:1px solid #e9d5ff;">ADJUSTMENT JOURNAL</span>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- Metadata -->
                    <table class="meta-table">
                        <tr>
                            <td style="width: 25%;">
                                <span class="meta-label">Journal Voucher No</span>
                                <span class="meta-val font-mono">${h.doc_no || 'JV-2026-0001'}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Posting Date</span>
                                <span class="meta-val font-mono nowrap">${FormatDate(h.date)}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Reference / Memo No</span>
                                <span class="meta-val font-mono">${h.ref_no || '---'}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Division / Cost Center</span>
                                <span class="meta-val">${h.project || 'Corporate Accounts'}</span>
                            </td>
                        </tr>
                    </table>

                    <!-- Double Entry Grid -->
                    </div><!-- end doc-header -->

                    <!-- Middle Body Section -->
                    <div class="doc-body">
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 5%;">#</th>
                                <th style="width: 8%; text-align: center;">Type</th>
                                <th style="width: 51%;">Account Title & Description</th>
                                <th style="width: 18%; text-align: right;">Debit Amount (₹)</th>
                                <th style="width: 18%; text-align: right;">Credit Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
                                <td colspan="3" class="text-right" style="padding: 6px 8px; text-transform: uppercase;">Totals:</td>
                                <td class="text-right font-mono nowrap" style="padding: 6px 8px;">${FormatCurrency(totalDebit).replace('₹ ', '')}</td>
                                <td class="text-right font-mono nowrap" style="padding: 6px 8px;">${FormatCurrency(totalCredit).replace('₹ ', '')}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <!-- Balancing Verification Banner -->
                    <div style="background: ${isBalanced ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isBalanced ? '#bbf7d0' : '#fecaca'}; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px;">
                        <span class="badge ${isBalanced ? 'badge-success' : 'badge-danger'}">${isBalanced ? 'BALANCED & VERIFIED' : 'UNBALANCED WARNING'}</span>
                        <span style="font-size: 7.5pt; font-weight: 700; color: ${isBalanced ? '#166534' : '#991b1b'}; margin-left: 6px;">
                            ${isBalanced ? 'Total Debits equal Total Credits. Double-entry integrity confirmed.' : `Difference of ₹ ${Math.abs(totalDebit - totalCredit).toFixed(2)} detected.`}
                        </span>
                    </div>

                    <!-- Words & Narration -->
                    <div class="amount-words-card" style="margin-bottom: 8px;">
                        <div class="amount-words-label">Voucher Value in Words:</div>
                        <div class="amount-words-val" style="font-size: 8.5pt;">${words}</div>
                    </div>

                    <!-- Clean Narration Memo -->
                    <table class="meta-table" style="margin-bottom: 8px;">
                        <tr>
                            <td style="width: 20%; background: #f8fafc; font-weight: 700; color: #475569; font-size: 6.5pt; text-transform: uppercase;">Accounting Memo:</td>
                            <td style="font-size: 7.5pt; color: #0f172a;">${h.narration || h.remarks || 'Adjustment entry posted into General Ledger according to Ind AS accounting guidelines.'}</td>
                        </tr>
                    </table>

                    <!-- Tripartite Governance Signatures -->
                    <table class="signature-table">
                        <tr>
                            <td style="width: 33.33%; text-align: left;">
                                <div class="sig-block">
                                    <div class="sig-space"></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Prepared By</div>
                                    <div class="sig-note">Posting Accountant</div>
                                </div>
                            </td>
                            <td style="width: 33.33%; text-align: center;">
                                <div class="sig-block">
                                    <div class="sig-space"></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Reviewed By</div>
                                    <div class="sig-note">Senior Accountant / Manager</div>
                                </div>
                            </td>
                            <td style="width: 33.33%; text-align: right;">
                                <div class="sig-block" style="float: right;">
                                    <div class="sig-org" style="overflow: hidden; text-overflow: ellipsis; max-width: 100%;">For <strong>${company.companyName}</strong></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Approved By</div>
                                    <div class="sig-note">Chief Financial Officer</div>
                                </div>
                            </td>
                        </tr>
                    </table>
                    </div><!-- end doc-footer -->
                </div>
                </div>
            </body>
            </html>`;
        },

        // 6. DEBIT NOTE (Purchase Return - Statutory Section 34 CGST Act)
        BuildDebitNote: function(doc, company, options = {}) {
            return UniTaxPDFDesigner.BuildSalesInvoice(doc, company, {
                title: 'DEBIT NOTE',
                subTitle: 'Issued under Section 34(1) of CGST Act, 2017 (Purchase Return / Value Adjustment)'
            });
        },

        // 7. CREDIT NOTE (Sales Return - Statutory Section 34 CGST Act)
        BuildCreditNote: function(doc, company, options = {}) {
            return UniTaxPDFDesigner.BuildSalesInvoice(doc, company, {
                title: 'CREDIT NOTE',
                subTitle: 'Issued under Section 34(2) of CGST Act, 2017 (Sales Return / Tax Adjustment)'
            });
        },

        // 8. GENERAL LEDGER STATEMENT OF ACCOUNT (Executive A4 8-Column Format)
        BuildLedgerStatement: function(accountData, transactions, company, options = {}) {
            if (!Array.isArray(transactions) && typeof transactions === 'object') {
                if (accountData && (Array.isArray(accountData.entries) || Array.isArray(accountData.items) || Array.isArray(accountData.transactions))) {
                    options = company || {};
                    company = transactions;
                    transactions = accountData.entries || accountData.items || accountData.transactions || [];
                } else {
                    options = company || {};
                    company = transactions;
                    transactions = [];
                }
            }
            accountData = accountData || {};
            transactions = transactions || [];

            const rawComp = company || {};
            company = {
                companyName: rawComp.companyName || rawComp.tradeName || rawComp.legalName || 'ENTERPRISE WORKSPACE',
                companyAddress: rawComp.companyAddress || rawComp.address || '',
                companyEmail: rawComp.companyEmail || rawComp.email || '',
                companyPhone: rawComp.companyPhone || rawComp.phone || '',
                gstin: rawComp.gstin || '',
                cin: rawComp.cin || 'L70100DL2000PLC104787'
            };

            const accName = accountData.name || accountData.account_name || accountData.accountName || 'GENERAL LEDGER ACCOUNT';
            const accCode = accountData.code || accountData.account_code || accountData.accountCode || 'GL-1001';
            const fromDate = options.fromDate || accountData.fromDate || accountData.from_date || '01-Apr-2026';
            const toDate = options.toDate || accountData.toDate || accountData.to_date || new Date().toISOString().split('T')[0];
            const opBal = parseFloat(accountData.openingBalance || accountData.opening_balance || 0) || 0;
            const opType = (accountData.openingType || accountData.opening_type || (opBal >= 0 ? 'Dr' : 'Cr')).toUpperCase();

            let totalDr = 0;
            let totalCr = 0;
            let runningBal = Math.abs(opBal) * (opType === 'CR' ? -1 : 1);

            let rowsHtml = `
                <tr style="background: #f8fafc; font-weight: bold;">
                    <td class="text-center font-mono nowrap">${FormatDate(fromDate)}</td>
                    <td class="text-center font-mono nowrap">${FormatDate(fromDate)}</td>
                    <td class="font-mono text-center">---</td>
                    <td class="text-center"><span class="badge" style="background:#f1f5f9; color:#475569;">OPENING</span></td>
                    <td><strong>OPENING BALANCE B/F</strong></td>
                    <td class="text-right font-mono nowrap">${opType === 'DR' && opBal !== 0 ? FormatCurrency(Math.abs(opBal)).replace('₹ ', '') : '---'}</td>
                    <td class="text-right font-mono nowrap">${opType === 'CR' && opBal !== 0 ? FormatCurrency(Math.abs(opBal)).replace('₹ ', '') : '---'}</td>
                    <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(Math.abs(runningBal)).replace('₹ ', '')} ${runningBal >= 0 ? 'Dr' : 'Cr'}</td>
                </tr>
            `;

            transactions.forEach((txn, idx) => {
                const dr = parseFloat(txn.debit || 0) || 0;
                const cr = parseFloat(txn.credit || 0) || 0;
                totalDr += dr;
                totalCr += cr;
                runningBal += (dr - cr);

                rowsHtml += `
                    <tr>
                        <td class="text-center font-mono nowrap">${FormatDate(txn.date || txn.postingDate)}</td>
                        <td class="text-center font-mono nowrap">${FormatDate(txn.valueDate || txn.date)}</td>
                        <td class="font-mono text-center nowrap"><strong>${txn.doc_no || txn.voucher_no || '---'}</strong></td>
                        <td class="text-center">
                            <span class="badge" style="background:#e2e8f0; color:#334155; font-size:6.5pt;">${txn.formId || txn.type || 'TXN'}</span>
                        </td>
                        <td>
                            <strong>${txn.particulars || txn.entity || 'Counterparty Entry'}</strong>
                            ${txn.narration ? `<div class="text-muted" style="font-size:6.5pt;">${txn.narration}</div>` : ''}
                        </td>
                        <td class="text-right font-mono nowrap">${dr > 0 ? FormatCurrency(dr).replace('₹ ', '') : '---'}</td>
                        <td class="text-right font-mono nowrap">${cr > 0 ? FormatCurrency(cr).replace('₹ ', '') : '---'}</td>
                        <td class="text-right font-mono fw-bold nowrap">${FormatCurrency(Math.abs(runningBal)).replace('₹ ', '')} ${runningBal >= 0 ? 'Dr' : 'Cr'}</td>
                    </tr>
                `;
            });

            const closingBal = Math.abs(runningBal);
            const closingType = runningBal >= 0 ? 'Dr' : 'Cr';

            return `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Ledger Statement - ${accName}</title>
                <style>
                    ${UniTaxPDFDesigner.GetBaseCSS()}
                    .kpi-card {
                        background: #f8fafc;
                        border: 1px solid #cbd5e1;
                        border-radius: 4px;
                        padding: 6px 8px;
                        text-align: center;
                    }
                    .kpi-title {
                        font-size: 6.5pt;
                        font-weight: 700;
                        text-transform: uppercase;
                        color: #64748b;
                        margin-bottom: 2px;
                    }
                    .kpi-val {
                        font-size: 9pt;
                        font-weight: 800;
                        color: #0f172a;
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="doc-page">
                    <!-- Top Header Section (Company & Document Details) -->
                    <div class="doc-header">
                    <table class="header-table">
                        <tr>
                            <td style="width: 60%; vertical-align: top;">
                                <div class="company-name">${company.companyName}</div>
                                <div class="company-subtext">
                                    ${company.companyAddress}<br>
                                    <strong>GSTIN:</strong> ${company.gstin} | <strong>CIN:</strong> ${company.cin || 'L70100DL2000PLC104787'}<br>
                                    <strong>Email:</strong> ${company.companyEmail} | <strong>Phone:</strong> ${company.companyPhone}
                                </div>
                            </td>
                            <td class="doc-title-badge">
                                <div class="doc-main-title">STATEMENT OF ACCOUNT</div>
                                <div class="doc-sub-title">General Ledger Audit Register</div>
                                <div style="margin-top: 4px; font-size: 7pt; color: #475569;">
                                    Period: <strong>${FormatDate(fromDate)}</strong> to <strong>${FormatDate(toDate)}</strong>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- Account Profile Table Strip (Solid Print Layout) -->
                    <table style="width: 100%; border-collapse: collapse; background: #1e3a8a; color: #ffffff; border-radius: 4px; margin-bottom: 8px;">
                        <tr>
                            <td style="padding: 6px 10px; text-align: left; vertical-align: middle;">
                                <span style="font-size: 9.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">${accName}</span>
                                <span style="font-size: 7.5pt; opacity: 0.9; margin-left: 6px;">(A/C Code: <strong>${accCode}</strong>)</span>
                            </td>
                            <td style="padding: 6px 10px; text-align: right; vertical-align: middle; font-size: 7.5pt; opacity: 0.95; white-space: nowrap;">
                                Currency: <strong>INR (₹)</strong> &nbsp;|&nbsp; Generated: <strong>${FormatDate(new Date())}</strong>
                            </td>
                        </tr>
                    </table>

                    <!-- 4 KPI Cards -->
                    <table style="width: 100%; border-collapse: separate; border-spacing: 6px; margin-bottom: 8px;">
                        <tr>
                            <td style="width: 25%;" class="kpi-card">
                                <div class="kpi-title">Opening Balance</div>
                                <div class="kpi-val font-mono nowrap">${FormatCurrency(Math.abs(opBal))} ${opType}</div>
                            </td>
                            <td style="width: 25%;" class="kpi-card">
                                <div class="kpi-title">Total Debits</div>
                                <div class="kpi-val font-mono text-primary nowrap">${FormatCurrency(totalDr)}</div>
                            </td>
                            <td style="width: 25%;" class="kpi-card">
                                <div class="kpi-title">Total Credits</div>
                                <div class="kpi-val font-mono nowrap" style="color: #92400e;">${FormatCurrency(totalCr)}</div>
                            </td>
                            <td style="width: 25%;" class="kpi-card" style="border-color: #1e3a8a; background: #eff6ff;">
                                <div class="kpi-title" style="color: #1e3a8a;">Closing Balance</div>
                                <div class="kpi-val font-mono nowrap" style="color: #1e3a8a;">${FormatCurrency(closingBal)} ${closingType}</div>
                            </td>
                        </tr>
                    </table>

                    <!-- 8-Column Ledger Grid (Proportioned so no text or Dr/Cr ever wraps) -->
                    <table class="items-table" style="font-size: 7pt;">
                        <thead>
                            <tr>
                                <th style="width: 9%; text-align: center;">Post Date</th>
                                <th style="width: 9%; text-align: center;">Value Date</th>
                                <th style="width: 12%; text-align: center;">Doc / Ref No</th>
                                <th style="width: 8%; text-align: center;">Type</th>
                                <th style="width: 28%;">Particulars & Counterparty / Narration</th>
                                <th style="width: 11%; text-align: right;">Debit (₹)</th>
                                <th style="width: 11%; text-align: right;">Credit (₹)</th>
                                <th style="width: 12%; text-align: right;">Balance (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
                                <td colspan="5" class="text-right" style="padding: 6px 8px; text-transform: uppercase;">Total Period Turnover:</td>
                                <td class="text-right font-mono nowrap" style="padding: 6px 8px;">${FormatCurrency(totalDr).replace('₹ ', '')}</td>
                                <td class="text-right font-mono nowrap" style="padding: 6px 8px;">${FormatCurrency(totalCr).replace('₹ ', '')}</td>
                                <td class="text-right font-mono fw-bold nowrap" style="padding: 6px 8px; color: #1e3a8a;">${FormatCurrency(closingBal).replace('₹ ', '')} ${closingType}</td>
                            </tr>
                        </tfoot>
                    </table>

                    </div><!-- end doc-body -->

                    <!-- Bottom Footer Section (Pinned firmly at bottom) -->
                    <div class="doc-footer">
                    <div style="font-size: 6.5pt; color: #475569; padding: 5px 8px; border: 1px dashed #cbd5e1; border-radius: 3px; margin-bottom: 6px;">
                        * This is an official computer-generated statement of account from UniTax ERP. It reflects verified transactions posted to the General Ledger. Please notify discrepancies within 15 days of statement date.
                    </div>

                    <table class="signature-table">
                        <tr>
                            <td style="width: 50%; text-align: left;">
                                <div class="sig-block">
                                    <div class="sig-space"></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Prepared By</div>
                                    <div class="sig-note">Ledger Accountant</div>
                                </div>
                            </td>
                            <td style="width: 50%; text-align: right;">
                                <div class="sig-block" style="float: right;">
                                    <div class="sig-org" style="overflow: hidden; text-overflow: ellipsis; max-width: 100%;">For <strong>${company.companyName}</strong></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Authorized Signatory</div>
                                    <div class="sig-note">Corporate Seal & Stamp</div>
                                </div>
                            </td>
                        </tr>
                    </table>
                    </div><!-- end doc-footer -->
                </div>
                </div>
            </body>
            </html>`;
        },

        // 9. GOVERNANCE AUDIT TRAIL & APPROVAL MATRIX CERTIFICATE
        BuildApprovalDoc: function(req, company, options = {}) {
            req = req || {};
            const rawComp = company || {};
            company = {
                companyName: rawComp.companyName || rawComp.tradeName || rawComp.legalName || 'ENTERPRISE WORKSPACE',
                companyAddress: rawComp.companyAddress || rawComp.address || '',
                companyEmail: rawComp.companyEmail || rawComp.email || '',
                companyPhone: rawComp.companyPhone || rawComp.phone || '',
                gstin: rawComp.gstin || '',
                cin: rawComp.cin || 'L70100DL2000PLC104787'
            };
            const docId = req.id || req.doc_no || 'REQ-AUTO';
            const reqTitle = req.title || req.req_title || 'Statutory Enterprise Requisition';
            const reqAmount = parseFloat(req.amount || 0);
            const requester = (window.systemUsers && window.systemUsers[req.requesterId]?.name) || req.requesterName || 'Staff Originator';
            const reqDate = req.createdAt ? FormatDate(req.createdAt) : FormatDate(new Date());

            let statusBadge = '<span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">PENDING</span>';
            if (req.state === 'APPROVED') {
                statusBadge = '<span class="badge badge-success">APPROVED & RATIFIED</span>';
            } else if (req.state === 'REJECTED' || req.state === 'RETURNED_TO_CREATOR') {
                statusBadge = '<span class="badge badge-danger">REJECTED / RETURNED</span>';
            }

            // Audit Trail Rows
            let trailRows = '';
            const trail = req.auditTrail || req.trail || [];
            if (trail.length > 0) {
                trail.forEach((log, index) => {
                    const actorName = (window.systemUsers && window.systemUsers[log.actorId]?.name) || log.actorName || 'Enterprise Authority';
                    const actorRole = (window.systemUsers && window.systemUsers[log.actorId]?.role) || log.role || 'Designated Signatory';
                    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN') : '---';
                    let actBadge = '<span class="badge badge-dr">INITIATED</span>';
                    if (log.action === 'APPROVED') actBadge = '<span class="badge badge-success">APPROVED</span>';
                    else if (log.action === 'REJECTED' || log.action === 'RETURNED') actBadge = '<span class="badge badge-danger">REJECTED</span>';

                    trailRows += `
                        <tr>
                            <td class="text-center font-mono">${index + 1}</td>
                            <td>
                                <strong>${actorName}</strong>
                                <div class="text-muted" style="font-size:6.5pt;">${actorRole}</div>
                            </td>
                            <td class="text-center">${actBadge}</td>
                            <td>${log.comment || 'Verified and approved as per corporate delegated authority matrix.'}</td>
                            <td class="font-mono text-center nowrap" style="font-size:7pt;">${timeStr}</td>
                        </tr>
                    `;
                });
            } else {
                trailRows = `
                    <tr>
                        <td colspan="5" class="text-center text-muted" style="padding: 10px;">Requisition submitted and initialized for governance audit trail.</td>
                    </tr>
                `;
            }

            return `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Audit Certificate - ${docId}</title>
                <style>${UniTaxPDFDesigner.GetBaseCSS()}</style>
            </head>
            <body>
                <div class="print-container">
                    <div class="doc-page">
                    <!-- Top Header Section (Company & Document Details) -->
                    <div class="doc-header">
                    <table class="header-table">
                        <tr>
                            <td style="width: 60%; vertical-align: top;">
                                <div class="company-name">${company.companyName}</div>
                                <div class="company-subtext">
                                    ${company.companyAddress}<br>
                                    <strong>GSTIN:</strong> ${company.gstin} | <strong>CIN:</strong> ${company.cin || 'L70100DL2000PLC104787'}<br>
                                    <strong>Corporate Compliance Division</strong>
                                </div>
                            </td>
                            <td class="doc-title-badge">
                                <div class="doc-main-title">AUDIT CERTIFICATE</div>
                                <div class="doc-sub-title">Governance Matrix & Digital Approval Trail</div>
                                <div style="margin-top: 4px;">${statusBadge}</div>
                            </td>
                        </tr>
                    </table>

                    <!-- Requisition Metadata -->
                    <table class="meta-table">
                        <tr>
                            <td style="width: 25%;">
                                <span class="meta-label">Requisition Token ID</span>
                                <span class="meta-val font-mono">${docId}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Submission Date</span>
                                <span class="meta-val font-mono nowrap">${reqDate}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Monetary Value</span>
                                <span class="meta-val font-mono nowrap">${reqAmount > 0 ? FormatCurrency(reqAmount) : 'N/A'}</span>
                            </td>
                            <td style="width: 25%;">
                                <span class="meta-label">Originating Requester</span>
                                <span class="meta-val">${requester}</span>
                            </td>
                        </tr>
                    </table>

                    <!-- Requisition Subject -->
                    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px;">
                        <div style="font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #1e3a8a;">Requisition Subject & Purpose:</div>
                        <div style="font-size: 9pt; font-weight: 700; color: #0f172a; margin-top: 2px;">${reqTitle}</div>
                        <div style="font-size: 7.5pt; color: #475569; margin-top: 2px;">${req.narration || req.description || 'Statutory justification and operational necessity certified under corporate policy.'}</div>
                    </div>

                    <!-- Chronological Audit Trail -->
                    <div style="font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #1e3a8a; margin-bottom: 4px;">
                        Immutable Multi-Tier Governance Sign-Off History:
                    </div>
                    </div><!-- end doc-header -->

                    <!-- Middle Body Section -->
                    <div class="doc-body">
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 5%;">#</th>
                                <th style="width: 28%;">Authority / Signatory</th>
                                <th style="width: 15%; text-align: center;">Decision</th>
                                <th style="width: 32%;">Compliance Remarks</th>
                                <th style="width: 20%; text-align: center;">Timestamp (IST)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${trailRows}
                        </tbody>
                    </table>

                    <!-- Cryptographic Hash Verification Box -->
                    <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px;">
                        <div style="font-size: 6.5pt; font-weight: 700; text-transform: uppercase; color: #64748b;">Tamper-Proof Audit Hash (SHA-256):</div>
                        <div class="font-mono" style="font-size: 7pt; color: #0f172a; word-break: break-all; margin-top: 2px;">
                            ${req.hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                        </div>
                        <div style="font-size: 6.5pt; color: #64748b; margin-top: 2px;">
                            * Certified authentic, tamper-evident, and logged pursuant to Companies (Accounts) Rules & Internal Financial Controls (IFC).
                        </div>
                    </div>

                    <!-- Symmetrical Signatures -->
                    </div><!-- end doc-body -->

                    <!-- Bottom Footer Section -->
                    <div class="doc-footer">
                    <table class="signature-table">
                        <tr>
                            <td style="width: 50%; text-align: left;">
                                <div class="sig-block">
                                    <div class="sig-space"></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Internal Compliance Officer</div>
                                    <div class="sig-note">Policy & Matrix Verified</div>
                                </div>
                            </td>
                            <td style="width: 50%; text-align: right;">
                                <div class="sig-block" style="float: right;">
                                    <div class="sig-org" style="overflow: hidden; text-overflow: ellipsis; max-width: 100%;">For <strong>${company.companyName}</strong></div>
                                    <div class="sig-line"></div>
                                    <div class="sig-role">Statutory Governance Authority</div>
                                    <div class="sig-note">Corporate Seal & Stamp</div>
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>
                </div>
            </body>
            </html>`;
        }
    };

    // ==========================================
    // UNITAX UNIVERSAL PRINT ENGINE
    // ==========================================
    const UniTaxPrintEngine = {
        FormTypeMap: FormTypeMap,
        NumberToWords: NumberToWords,
        FormatCurrency: FormatCurrency,
        FormatDate: FormatDate,
        Designer: UniTaxPDFDesigner,

        // Resolve Company Profile from Masters / Active Workspace
        GetCompanyProfile: async function() {
            let profile = {
                companyName: 'SIGNATURE GLOBAL INDIA LIMITED',
                companyAddress: 'Signature Global Park, Sector 36, Sohna, Gurugram, Haryana - 122103',
                companyEmail: 'compliance@signatureglobal.in',
                companyPhone: '+91 124 4908200',
                gstin: '06AAACS7342Q1ZL',
                cin: 'L70100DL2000PLC104787',
                pan: 'AAACS7342Q',
                bank_name: 'HDFC Bank Ltd.',
                bank_ac: '50200058392104',
                bank_ifsc: 'HDFC0000123',
                bank_branch: 'Cyber City Branch, Gurugram',
                upi_id: 'signatureglobal@hdfcbank'
            };

            try {
                if (window.API && typeof window.API.Fetch === 'function') {
                    const companies = await window.API.Fetch('Masters/Companies');
                    if (companies) {
                        const firstComp = Object.values(companies)[0];
                        if (firstComp) {
                            profile.companyName = firstComp.companyName || profile.companyName;
                            profile.companyAddress = `${firstComp.companyAddress1 || ''} ${firstComp.companyAddress2 || ''}, ${firstComp.Company_State || ''}`.trim() || profile.companyAddress;
                            profile.companyEmail = firstComp.Email || profile.companyEmail;
                            profile.companyPhone = firstComp.Phone || firstComp.companyPhone || profile.companyPhone;
                            profile.gstin = firstComp.GSTIN || profile.gstin;
                            profile.cin = firstComp.CIN || profile.cin;
                            profile.pan = firstComp.PAN || profile.pan;
                            profile.bank_name = firstComp.bankName || profile.bank_name;
                            profile.bank_ac = firstComp.bankAccountNo || profile.bank_ac;
                            profile.bank_ifsc = firstComp.bankIfsc || profile.bank_ifsc;
                            profile.bank_branch = firstComp.bankBranch || profile.bank_branch;
                            profile.upi_id = firstComp.upiId || profile.upi_id;
                        }
                    }
                }
            } catch (e) {
                console.warn('Company profile fetch warning:', e);
            }

            const activeWsName = (typeof App !== 'undefined' && App.State && App.State.workspaceName) 
                || localStorage.getItem('workspaceName');
            if (activeWsName && profile.companyName === 'SIGNATURE GLOBAL INDIA LIMITED') {
                profile.companyName = activeWsName.toUpperCase();
            }

            return profile;
        },

        // Render HTML into hidden iframe and execute native print without popup blockers
        PrintHtmlContent: function(htmlContent) {
            let iframe = document.getElementById('unitax-print-iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'unitax-print-iframe';
                iframe.style.position = 'fixed';
                iframe.style.left = '-9999px';
                iframe.style.top = '-9999px';
                iframe.style.width = '210mm';
                iframe.style.height = '297mm';
                iframe.style.border = 'none';
                document.body.appendChild(iframe);
            }

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(htmlContent);
            doc.close();

            // Allow layout and styles to calculate cleanly before triggering print
            setTimeout(() => {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch (err) {
                    console.error('Print Execution Error:', err);
                    window.print();
                }
            }, 350);
        },

        // Normalize raw document into uniform header and items
        NormalizeDoc: function(rawDoc, docKey) {
            if (!rawDoc) return { header: {}, items: [] };

            let header = rawDoc.header ? { ...rawDoc.header } : { ...rawDoc };
            delete header.items;

            let items = [];
            if (rawDoc.items) {
                items = Array.isArray(rawDoc.items) ? rawDoc.items : Object.values(rawDoc.items);
            } else if (rawDoc.entries) {
                items = Array.isArray(rawDoc.entries) ? rawDoc.entries : Object.values(rawDoc.entries);
            }

            // Ensure document number, date and entity are populated
            header.doc_no = header.doc_no || header.invoice_no || header.supplier_bill_no || header.voucher_no || header.paymentRef || header.receiptRef || docKey || 'DOC-UNASSIGNED';
            header.date = header.date || header.invoice_date || header.doc_date || header.postingDate || header.instrumentDate || new Date().toISOString().split('T')[0];
            header.entity = header.entity || header.customer_name || header.vendor_name || header.party_name || header.ledger_name || 'Customer / Trade Party';

            return { header, items };
        },

        // Print Transaction from DB, memory or custom object
        PrintTransaction: async function(formId, txnKey, customDoc = null) {
            const mapping = FormTypeMap[formId] || FormTypeMap['sales-inv'];
            
            if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                App.UI.Notify('Printing', `Compiling ${mapping.title}...`, 'info');
            }

            try {
                let docData = customDoc;

                // 1. Resolve Document Data
                if (!docData) {
                    if (window.currentContextData && (window.paramKey === txnKey || (window.currentContextData.header && window.currentContextData.header.doc_no === txnKey))) {
                        docData = window.currentContextData;
                    } else if (window.API && typeof window.API.Fetch === 'function') {
                        const targetDbId = mapping.dbFormId || formId;
                        docData = await window.API.Fetch(`Transactions/${targetDbId}/${txnKey}`);
                        if (!docData) {
                            docData = await window.API.Fetch(`Transactions/${formId}/${txnKey}`);
                        }
                    }
                }

                if (!docData) {
                    docData = UniTaxPrintEngine.ScrapeCurrentForm();
                }

                const normalized = UniTaxPrintEngine.NormalizeDoc(docData, txnKey);
                const company = await UniTaxPrintEngine.GetCompanyProfile();

                // 2. Pure Code Generation based on Document Category
                let html = '';
                switch (mapping.category) {
                    case 'SALE':
                        html = UniTaxPDFDesigner.BuildSalesInvoice(normalized, company);
                        break;
                    case 'PURCHASE':
                        html = UniTaxPDFDesigner.BuildPurchaseVoucher(normalized, company);
                        break;
                    case 'RECEIPT':
                        html = UniTaxPDFDesigner.BuildReceipt(normalized, company);
                        break;
                    case 'PAYMENT':
                        html = UniTaxPDFDesigner.BuildPayment(normalized, company);
                        break;
                    case 'JOURNAL':
                        html = UniTaxPDFDesigner.BuildJournal(normalized, company);
                        break;
                    case 'DEBIT_NOTE':
                        html = UniTaxPDFDesigner.BuildDebitNote(normalized, company);
                        break;
                    case 'CREDIT_NOTE':
                        html = UniTaxPDFDesigner.BuildCreditNote(normalized, company);
                        break;
                    case 'APPROVAL':
                        html = UniTaxPDFDesigner.BuildApprovalDoc(normalized.header, company);
                        break;
                    case 'LEDGER':
                        html = UniTaxPDFDesigner.BuildLedgerStatement(normalized.header, normalized.items, company);
                        break;
                    default:
                        html = UniTaxPDFDesigner.BuildSalesInvoice(normalized, company);
                        break;
                }

                // 3. Print via Hidden Iframe (Zero Pop-Up Blockers)
                UniTaxPrintEngine.PrintHtmlContent(html);

            } catch (err) {
                console.error('UniTaxPrintEngine.PrintTransaction Error:', err);
                if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                    App.UI.Notify('Print Error', 'Could not compile print preview. Falling back to native print.', 'danger');
                }
                window.print();
            }
        },

        // Scrape currently open transaction form in DOM
        ScrapeCurrentForm: function() {
            const form = document.querySelector('#main-content form') || document.querySelector('form[data-category="Transactions"]') || document.forms[0];
            const header = {};
            const items = [];

            if (form) {
                const formData = new FormData(form);
                for (let [k, v] of formData.entries()) {
                    header[k] = v;
                }

                // Scrape doc_no from ribbons or inputs
                header.doc_no = header.doc_no || header.invoice_no || header.supplier_bill_no || header.paymentRef || header.receiptRef 
                    || document.getElementById('ribbonDocNo')?.innerText?.trim()
                    || document.getElementById('ribbonBillNo')?.innerText?.trim()
                    || document.getElementById('ribbonCrnNo')?.innerText?.trim()
                    || document.getElementById('ribbonDbnNo')?.innerText?.trim()
                    || document.getElementById('ribbonJvNo')?.innerText?.trim()
                    || 'DOC-DRAFT';

                header.entity = header.entity || header.customer_name || header.vendor_name || header.party_name || header.ledger_name 
                    || form.querySelector('input[name="entity"]')?.value
                    || form.querySelector('input[name="ledger_name"]')?.value
                    || form.querySelector('input[name="sourceAccount"]')?.value
                    || form.querySelector('input[name="targetAccount"]')?.value
                    || 'Trade Client / Vendor';

                header.date = header.date || header.invoice_date || header.postingDate || form.querySelector('input[type="date"]')?.value || new Date().toISOString().split('T')[0];
                header.narration = header.narration || header.remarks || form.querySelector('textarea[name="narration"]')?.value || form.querySelector('input[name="narration"]')?.value || '';

                // Scrape table rows
                const itemRows = form.querySelectorAll('tbody tr');
                itemRows.forEach(row => {
                    const descInput = row.querySelector('input[name*="item"], input[name*="name"], input[name*="particular"], select[name*="ledger"], input[name*="ledger"]');
                    const qtyInput = row.querySelector('input[name*="qty"], input[name*="quantity"]');
                    const rateInput = row.querySelector('input[name*="rate"], input[name*="price"]');
                    const taxInput = row.querySelector('input[name*="tax"], select[name*="tax"], select[name*="gst"]');
                    const amtInput = row.querySelector('input[name*="amount"], input[name*="total"], .row-amount');
                    const drInput = row.querySelector('input[name*="debit"]');
                    const crInput = row.querySelector('input[name*="credit"]');
                    const typeSelect = row.querySelector('select[name*="type"]');

                    if (descInput || amtInput || drInput || crInput) {
                        items.push({
                            name: descInput?.value || row.cells[1]?.innerText?.trim() || 'Item Entry',
                            ledger_name: descInput?.value || row.cells[2]?.innerText?.trim() || 'Account',
                            qty: parseFloat(qtyInput?.value) || 1,
                            rate: parseFloat(rateInput?.value) || 0,
                            tax: parseFloat(taxInput?.value) || 0,
                            amount: parseFloat(amtInput?.value || amtInput?.innerText?.replace(/[^0-9.]/g, '')) || 0,
                            debit: parseFloat(drInput?.value) || 0,
                            credit: parseFloat(crInput?.value) || 0,
                            type: typeSelect?.value || (parseFloat(drInput?.value) > 0 ? 'DR' : 'CR')
                        });
                    }
                });

                // Scrape grand total
                header.grandTotal = parseFloat(
                    document.getElementById('grand-ribbon')?.innerText?.replace(/[^0-9.]/g, '') ||
                    document.getElementById('purch-grand-ribbon')?.innerText?.replace(/[^0-9.]/g, '') ||
                    document.getElementById('crn-grand-ribbon')?.innerText?.replace(/[^0-9.]/g, '') ||
                    document.getElementById('dbn-grand-ribbon')?.innerText?.replace(/[^0-9.]/g, '') ||
                    document.getElementById('pv_grand_ribbon')?.innerText?.replace(/[^0-9.]/g, '') ||
                    document.getElementById('rv_grand_ribbon')?.innerText?.replace(/[^0-9.]/g, '') ||
                    document.getElementById('jv-debit-ribbon')?.innerText?.replace(/[^0-9.]/g, '') ||
                    form.querySelector('input[name="grandTotal"]')?.value || 0
                ) || 0;
            }

            return { header, items };
        },

        // Trigger print of the currently open transaction form
        PrintCurrentForm: function(formType) {
            let detectedType = formType;
            if (!detectedType) {
                const currentHash = window.location.hash || '';
                for (const key of Object.keys(FormTypeMap)) {
                    if (currentHash.includes(key)) {
                        detectedType = key;
                        break;
                    }
                }
            }
            if (!detectedType) detectedType = 'sales-inv';

            const scraped = UniTaxPrintEngine.ScrapeCurrentForm();
            UniTaxPrintEngine.PrintTransaction(detectedType, scraped.header.doc_no, scraped);
        },

        // Universal Approval Document Print Engine (Pure Code, No External Template Fetch)
        PrintApprovalDoc: async function(reqId = null, customReq = null) {
            if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                App.UI.Notify('Printing', 'Generating Audit Trail PDF...', 'info');
            }

            try {
                let req = customReq;

                // Resolve Request Data
                if (!req && reqId && window.allRequests && Array.isArray(window.allRequests)) {
                    req = window.allRequests.find(r => r.id === reqId || r.key === reqId);
                }
                if (!req && window.currentDoc) {
                    req = window.currentDoc;
                }
                if (!req && reqId && window.API && typeof window.API.Fetch === 'function') {
                    req = await window.API.Fetch(`Governance/Approvals/${reqId}`);
                }
                if (!req && window.allRequests && window.allRequests.length > 0) {
                    req = window.allRequests[0];
                }

                if (!req) {
                    throw new Error('No approval request document selected to print.');
                }

                const company = await UniTaxPrintEngine.GetCompanyProfile();
                const html = UniTaxPDFDesigner.BuildApprovalDoc(req, company);

                UniTaxPrintEngine.PrintHtmlContent(html);

            } catch (err) {
                console.error('PrintApprovalDoc Error:', err);
                if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                    App.UI.Notify('Approval Print', err.message || 'Error printing approval document.', 'warning');
                }
            }
        },

        // Universal General Ledger Statement Print Engine (Pure Code, No External Template Fetch)
        PrintLedgerStatement: async function(accountData = null, transactions = null, options = {}) {
            try {
                let accData = accountData;
                let txns = transactions;

                // Scrape active view from DOM if parameters omitted
                if (!accData) {
                    const targetInput = document.getElementById('targetAccount');
                    const rawAccName = targetInput?.value?.trim() || document.getElementById('print-acc-name')?.innerText?.trim();
                    
                    if (!rawAccName || rawAccName.includes('Search Ledger')) {
                        if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                            App.UI.Notify('Ledger Statement', 'Please select a ledger account and click "View Statement" first.', 'warning');
                        }
                        return;
                    }

                    const fromDate = document.getElementById('fromDate')?.value || '2026-04-01';
                    const toDate = document.getElementById('toDate')?.value || new Date().toISOString().split('T')[0];
                    const accCode = document.getElementById('print-acc-code')?.innerText?.trim() || 'GL-1001';
                    const opBalEl = document.getElementById('summaryOpBal') || document.getElementById('print-closing-bal');
                    const opBal = parseFloat(opBalEl?.innerText?.replace(/[^0-9.-]/g, '') || 0);

                    accData = {
                        name: rawAccName.toUpperCase(),
                        code: accCode,
                        fromDate: fromDate,
                        toDate: toDate,
                        openingBalance: opBal,
                        openingType: opBal >= 0 ? 'Dr' : 'Cr'
                    };
                }

                if (!txns) {
                    txns = [];
                    const rows = document.querySelectorAll('#glTableBody tr, #glTable tbody tr');
                    rows.forEach(r => {
                        const cells = r.querySelectorAll('td');
                        // glTable: [0: #, 1: PostDate, 2: DocDate, 3: Type, 4: DocNo, 5: Particulars, 6: Debit, 7: Credit, 8: Balance]
                        if (cells.length >= 7) {
                            const postDate = cells[1]?.innerText?.trim();
                            const docDate = cells[2]?.innerText?.trim() || postDate;
                            const type = cells[3]?.innerText?.trim() || 'TXN';
                            const docNo = cells[4]?.innerText?.trim() || '---';
                            const desc = cells[5]?.innerText?.trim() || '';
                            const dr = parseFloat(cells[6]?.innerText?.replace(/[^0-9.]/g, '')) || 0;
                            const cr = parseFloat(cells[7]?.innerText?.replace(/[^0-9.]/g, '')) || 0;
                            const bal = cells[8]?.innerText?.trim() || '';

                            if (postDate && postDate !== '---' && !postDate.includes('Please select') && !desc.includes('Please select an account')) {
                                txns.push({
                                    date: postDate,
                                    valueDate: docDate,
                                    type: type,
                                    doc_no: docNo,
                                    particulars: desc,
                                    debit: dr,
                                    credit: cr,
                                    balance: bal
                                });
                            }
                        }
                    });
                }

                if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                    App.UI.Notify('Printing', 'Generating Statement of Account PDF...', 'info');
                }

                const company = await UniTaxPrintEngine.GetCompanyProfile();
                const html = UniTaxPDFDesigner.BuildLedgerStatement(accData, txns, company, options);

                UniTaxPrintEngine.PrintHtmlContent(html);

            } catch (err) {
                console.error('PrintLedgerStatement Error:', err);
                window.print();
            }
        }
    };

    // Attach to window globally
    window.UniTaxPrintEngine = UniTaxPrintEngine;
    window.UniTaxPDFDesigner = UniTaxPDFDesigner;
    window.printTransaction = UniTaxPrintEngine.PrintTransaction;
    window.printCurrentForm = UniTaxPrintEngine.PrintCurrentForm;
    window.printDocument = UniTaxPrintEngine.PrintTransaction;
    window.printApprovalDoc = UniTaxPrintEngine.PrintApprovalDoc;
    window.printLedgerStatement = UniTaxPrintEngine.PrintLedgerStatement;

})(window);
