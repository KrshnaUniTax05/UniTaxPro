/**
 * UNITAX PRO - Global Utility Library
 * Standardizes: Formatting, ID Generation, and Grid Operations
 */

const Utils = {
    /**
     * 1. Professional Document ID Generator
     */
    GenerateDocID(prefix = 'VCH') {
        const year = new Date().getFullYear();
        const random = Math.random().toString(16).substring(2, 6).toUpperCase();
        return `${prefix.toUpperCase()}/${year}/${random}`;
    },

    /**
     * 2. Global UUID Generator
     */
    GenerateGUID() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        ).toUpperCase();
    },

    /**
     * 3. Indian Currency Formatter (₹)
     */
    FormatINR(amount) {
        const num = parseFloat(amount);
        if (isNaN(num)) return "0.00";
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    },

    /**
     * 4. Date Formatter (e.g., 20 May 2024)
     */
    FormatDate(dateStr) {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    /**
     * 5. Input Normalization
     */
    ToProperCase(str) {
        if (!str) return "";
        return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    },

    /**
     * 6. Debounce Function for Uniqueness Check
     */
    Debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    /**
     * 7. PROFESSIONAL GRID ADDER
     * Clones the first row and re-binds the ERP logic to new elements
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
            input.style.borderLeft = ""; // Reset validation colors
            if (input.classList.contains('line-total')) input.innerText = "0.00";
        });

        // Update Serial Numbers
        const rowCount = tbody.querySelectorAll('tr').length + 1;
        const srNo = newRow.querySelector('.sr-no');
        if (srNo) srNo.innerText = rowCount;

        tbody.appendChild(newRow);
        
        // Return the new row to allow App.js to re-bind datalists
        return newRow;
    },

    /**
     * 8. Line Calculation Logic
     */
    CalculateLine(qty, rate, taxPercent = 0) {
        const base = (parseFloat(qty) || 0) * (parseFloat(rate) || 0);
        const tax = base * (parseFloat(taxPercent) / 100);
        return { base, tax, total: base + tax };
    }
};

// Global Input Observers for Text Transformation
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('proper-case')) e.target.value = Utils.ToProperCase(e.target.value);
    if (e.target.classList.contains('upper-case')) e.target.value = e.target.value.toUpperCase();
});