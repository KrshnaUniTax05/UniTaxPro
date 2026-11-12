/**
 * UNITAX PRO - Enterprise Global Utility Library
 * Standardizes: Formatting, Security, ID Generation, Grid Operations, Export & Validation
 */

const Utils = {
    /**
     * 1. Cryptographic SHA-256 Password Hash (Client-side salted)
     * Protects passwords from being stored or transmitted in plain text.
     */
    async HashPassword(password, salt = "_unitax_enterprise_salt_2026") {
        if (!password) return "";
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(String(password) + salt);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.error("Hash calculation failed, using fallback hash:", e);
            // Fallback simple hash if SubtleCrypto is unavailable (e.g. insecure contexts)
            let hash = 0;
            const str = String(password) + salt;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0;
            }
            return 'h_' + Math.abs(hash).toString(16);
        }
    },

    /**
     * 2. XSS Protection: HTML Escaping
     */
    EscapeHTML(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Deep sanitize object fields to prevent XSS
     */
    SanitizeObject(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => this.SanitizeObject(item));
        const clean = {};
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string') {
                clean[k] = this.EscapeHTML(v.trim());
            } else if (typeof v === 'object' && v !== null) {
                clean[k] = this.SanitizeObject(v);
            } else {
                clean[k] = v;
            }
        }
        return clean;
    },

    /**
     * 3. Professional Document ID Generator
     * Formats: PREFIX/YYYY/XXXX or custom sequential format
     */
    GenerateDocID(prefix = 'VCH') {
        const year = new Date().getFullYear();
        const random = Math.random().toString(16).substring(2, 6).toUpperCase();
        return `${prefix.toUpperCase()}/${year}/${random}`;
    },

    /**
     * 4. Global UUID Generator (RFC-4122 v4 compliant)
     */
    GenerateGUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID().toUpperCase();
        }
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        ).toUpperCase();
    },

    /**
     * 5. Safe Number Parser
     */
    ParseNumber(val) {
        if (val === null || val === undefined || val === '') return 0;
        const num = parseFloat(String(val).replace(/,/g, '').trim());
        return isNaN(num) ? 0 : num;
    },

    /**
     * 6. Indian Currency Formatter (₹)
     * Converts 1234567.89 -> "12,34,567.89"
     */
    FormatINR(amount, includeSymbol = false) {
        const num = this.ParseNumber(amount);
        const formatted = new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
        return includeSymbol ? `₹ ${formatted}` : formatted;
    },

    /**
     * 7. Date Formatter (e.g. 20-Nov-2026)
     */
    FormatDate(dateStr) {
        if (!dateStr) return "-";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return String(dateStr);
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) {
            return String(dateStr);
        }
    },

    /**
     * Standard ISO Date (YYYY-MM-DD)
     */
    FormatDateISO(dateInput) {
        if (!dateInput) return "";
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return "";
            return date.toISOString().split('T')[0];
        } catch (e) {
            return "";
        }
    },

    /**
     * Date + Time Formatter
     */
    FormatDateTime(dateStr) {
        if (!dateStr) return "-";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return String(dateStr);
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
                   date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) {
            return String(dateStr);
        }
    },

    /**
     * Time Formatter
     */
    FormatTime(dateStr) {
        if (!dateStr) return "-";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return "";
            return new Intl.DateTimeFormat('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }).format(date);
        } catch (e) {
            return "";
        }
    },

    /**
     * 8. Input Normalization
     */
    ToProperCase(str) {
        if (!str) return "";
        return String(str).toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    },

    /**
     * 9. Debounce Function
     */
    Debounce(func, wait = 300) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    /**
     * 10. Throttle Function
     */
    Throttle(func, limit = 200) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * 11. PROFESSIONAL GRID ROW MANAGEMENT
     */
    AddGridRow(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return null;
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return null;
        const firstRow = tbody.querySelector('tr');
        if (!firstRow) return null;

        const newRow = firstRow.cloneNode(true);
        
        // Reset all inputs in cloned row
        newRow.querySelectorAll('input, select, textarea').forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else {
                input.value = "";
            }
            input.style.borderLeft = "";
            input.style.borderRight = "";
            input.classList.remove('is-valid', 'is-invalid');
            if (input.classList.contains('line-total')) input.innerText = "0.00";
        });

        // Reset non-input display fields
        newRow.querySelectorAll('.line-total, .row-amount').forEach(el => el.innerText = "0.00");

        tbody.appendChild(newRow);
        this.UpdateSerialNumbers(tbody);
        return newRow;
    },

    RemoveGridRow(btn, tableId, recalculateFn) {
        const table = document.getElementById(tableId);
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        if (rows.length > 1) {
            const tr = btn.closest('tr');
            if (tr) tr.remove();
            this.UpdateSerialNumbers(tbody);
            if (typeof recalculateFn === 'function') recalculateFn();
        }
    },

    /**
     * Bulletproof Serial Number Recalculator
     */
    UpdateSerialNumbers(tbody) {
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const srNo = row.querySelector('.sr-no');
            if (srNo) srNo.innerText = index + 1;
        });
    },

    /**
     * 12. Line Calculation Logic (GST Breakdown)
     */
    CalculateLine(qty, rate, taxPercent = 0, discountPercent = 0) {
        const q = this.ParseNumber(qty);
        const r = this.ParseNumber(rate);
        const t = this.ParseNumber(taxPercent);
        const d = this.ParseNumber(discountPercent);

        const gross = q * r;
        const discountAmount = gross * (d / 100);
        const taxable = Math.max(0, gross - discountAmount);
        const tax = taxable * (t / 100);
        const total = taxable + tax;

        return {
            gross: parseFloat(gross.toFixed(2)),
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            base: parseFloat(taxable.toFixed(2)),
            tax: parseFloat(tax.toFixed(2)),
            total: parseFloat(total.toFixed(2))
        };
    },

    /**
     * 13. Export Data to CSV (RFC-4180 Compliant)
     */
    ExportToCSV(filename, rows, columnDefs) {
        if (!rows || !rows.length) {
            alert('No records available to export.');
            return;
        }

        // Format CSV cells with quotes and escaping
        const escapeCell = (val) => {
            if (val === null || val === undefined) return '""';
            let str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const headers = columnDefs.map(c => escapeCell(c.label || c.key));
        const csvRows = [headers.join(',')];

        rows.forEach(row => {
            const values = columnDefs.map(col => {
                const rawVal = row[col.key];
                const formatted = col.formatter ? col.formatter(rawVal, row) : rawVal;
                return escapeCell(formatted);
            });
            csvRows.push(values.join(','));
        });

        const csvContent = "\uFEFF" + csvRows.join('\r\n'); // Include BOM for Excel UTF-8 support
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename || 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

/**
 * Helper: Indian Number to Words (e.g. 150000 -> "One Lakh Fifty Thousand Only")
 */
window.NumberToWords = function(num) {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];
    
    const parsed = Math.floor(Math.abs(Utils.ParseNumber(num)));
    if (parsed === 0) return 'Zero Rupees Only';
    if (parsed > 999999999) return 'Amount Exceeds Support';

    const n = ('000000000' + parsed).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + a[n[5][1]]) : '';
    
    return str.trim() + ' Rupees Only';
};

// Global text transformation listeners
document.addEventListener('input', (e) => {
    if (e.target && e.target.classList) {
        if (e.target.classList.contains('proper-case')) {
            e.target.value = Utils.ToProperCase(e.target.value);
        }
        if (e.target.classList.contains('upper-case')) {
            e.target.value = e.target.value.toUpperCase();
        }
    }
});

// Edit context navigation helper
window.editGoTransaction = function(formId, key, path) {
    localStorage.setItem('editContext', JSON.stringify({ type: formId, key: key, returnRoute: path }));
    if (typeof App !== 'undefined' && App.Router) {
        App.Router(`transactions/edit?type=${encodeURIComponent(formId)}&key=${encodeURIComponent(key)}`);
    }
};

/**
 * Uniqueness Checker Engine
 */
const UniquenessChecker = {
    config: {
        debounceDelay: 400,
        minLength: 2,
        checkingColor: '#ffc107',
        validColor: '#10b981',
        invalidColor: '#ef4444'
    },
    timers: {},

    init(container) {
        const form = container?.tagName === 'FORM' ? container : container?.querySelector('form');
        if (!form) return;

        const uniqueInputs = form.querySelectorAll('[data-check-unique="true"]');
        uniqueInputs.forEach(input => {
            input.removeEventListener('input', this._handler);
            input.addEventListener('input', this._handler.bind(this));
        });
    },

    async _handler(e) {
        const input = e.target;
        const val = input.value.trim();
        const sheet = input.dataset.sheet_name;
        const col = input.dataset.column_name;

        if (!sheet || !col) return;
        if (val.length < this.config.minLength) {
            this.clearFeedback(input);
            return;
        }

        const key = `${sheet}_${col}`;
        clearTimeout(this.timers[key]);

        input.style.borderRight = `3px solid ${this.config.checkingColor}`;
        input.classList.remove('is-valid', 'is-invalid');

        this.timers[key] = setTimeout(async () => {
            try {
                const isDuplicate = await API.CheckUniqueness(sheet, col, val);
                const color = isDuplicate ? this.config.invalidColor : this.config.validColor;
                input.style.borderRight = `3px solid ${color}`;
                input.classList.toggle('is-invalid', isDuplicate);
                input.classList.toggle('is-valid', !isDuplicate);

                const form = input.closest('form');
                const saveBtn = form?.querySelector('[type="submit"]');
                if (saveBtn) saveBtn.disabled = isDuplicate;

                if (isDuplicate && typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                    App.UI.Notify('Validation', `"${val}" already exists in ${sheet}`, 'warning');
                }
            } catch (error) {
                console.error('Uniqueness check error:', error);
                this.clearFeedback(input);
            }
        }, this.config.debounceDelay);
    },

    clearFeedback(input) {
        input.style.borderRight = '';
        input.classList.remove('is-valid', 'is-invalid');
        const form = input.closest('form');
        const saveBtn = form?.querySelector('[type="submit"]');
        if (saveBtn) saveBtn.disabled = false;
    }
};

window.Utils = Utils;
window.UniquenessChecker = UniquenessChecker;
