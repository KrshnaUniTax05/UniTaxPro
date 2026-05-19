/**
 * UNITAX PRO - Global Utility Library
 * Standardizes: Formatting, ID Generation, and DOM Helpers
 */

const Utils = {
    /**
     * 1. Professional Document ID Generator
     * Pattern: [PREFIX]/[YEAR]/[RANDOM_HEX]
     * Example: SALE/2024/A9B2
     */
    GenerateDocID(prefix = 'VCH') {
        const year = new Date().getFullYear();
        const random = Math.random().toString(16).substring(2, 6).toUpperCase();
        return `${prefix.toUpperCase()}/${year}/${random}`;
    },

    /**
     * 2. Global UUID Generator
     * Used for database keys and unique identifiers
     */
    GenerateGUID() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        ).toUpperCase();
    },

    /**
     * 3. Indian Currency Formatter (₹)
     * Handles the 2,2,3 digit grouping standard
     */
    FormatINR(amount) {
        const num = parseFloat(amount);
        if (isNaN(num)) return "0.00";
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(num);
    },

    /**
     * 4. Date Formatter
     * Converts ISO dates to readable accounting format
     * Input: 2024-05-20 -> Output: 20 May 2024
     */
    FormatDate(dateStr) {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    },

    /**
     * 5. Input Normalization (Proper Case)
     * Used for Names and Descriptions
     */
    ToProperCase(str) {
        if (!str) return "";
        return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    },

    /**
     * 6. Debounce Function
     * Used for real-time search/lookups to prevent API spamming
     */
    Debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    /**
     * 7. Table Row Operations
     * Standard logic to add a new row to any ERP-style grid
     */
    AddGridRow(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        const firstRow = tbody.querySelector('tr');
        if (!firstRow) return;

        const newRow = firstRow.cloneNode(true);
        
        // Clear all inputs in the cloned row
        newRow.querySelectorAll('input').forEach(input => {
            input.value = "";
            if (input.classList.contains('line-total')) input.innerText = "0.00";
        });

        // Update Serial Numbers
        const rowCount = tbody.querySelectorAll('tr').length + 1;
        const srNo = newRow.querySelector('.sr-no');
        if (srNo) srNo.innerText = rowCount;

        tbody.appendChild(newRow);
        
        // Return the new row for further binding if needed
        return newRow;
    },

    /**
     * 8. Line Calculation Logic
     * Standard qty * rate - discount + tax
     */
    CalculateLine(qty, rate, taxPercent = 0) {
        const base = (parseFloat(qty) || 0) * (parseFloat(rate) || 0);
        const tax = base * (parseFloat(taxPercent) / 100);
        return {
            base: base,
            tax: tax,
            total: base + tax
        };
    },

    /**
     * 9. DOM Value Scraper
     * Gets value from ID or innerText reliably
     */
    GetVal(id) {
        const el = document.getElementById(id);
        if (!el) return 0;
        const val = el.value || el.innerText || "0";
        return parseFloat(val.replace(/[^0-9.-]+/g, "")) || 0;
    }
};

// Auto-register Case transforms on all inputs with special classes
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('proper-case')) {
        e.target.value = Utils.ToProperCase(e.target.value);
    }
    if (e.target.classList.contains('upper-case')) {
        e.target.value = e.target.value.toUpperCase();
    }
});