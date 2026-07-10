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

    FormatTime(dateStr) {
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }).format(date);
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

        // Append the row FIRST
        tbody.appendChild(newRow);
        
        // THEN completely recalculate all serial numbers to guarantee perfection
        this.UpdateSerialNumbers(tbody);
        
        // Return the new row to allow App.js to re-bind datalists
        return newRow;
    },
    

    /**
     * Bulletproof Serial Number Recalculator
     * Call this after adding OR removing a row.
     */
    UpdateSerialNumbers(tbody) {
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const srNo = row.querySelector('.sr-no');
            if (srNo) srNo.innerText = index + 1;
        });
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

// Add this helper function to your utility script
window.NumberToWords = function(num) {
    const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
    
    if ((num = num.toString()).length > 9) return 'Overflow';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return 'Zero';
    
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    
    return str.trim() || 'Zero';
};

// Global Input Observers for Text Transformation
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('proper-case')) e.target.value = Utils.ToProperCase(e.target.value);
    if (e.target.classList.contains('upper-case')) e.target.value = e.target.value.toUpperCase();
});


window.editGoTransaction = function(formId, key, path) {
        localStorage.setItem('editContext', JSON.stringify({ type: formId, key: key, returnRoute:path }));
        if (typeof App !== 'undefined' && App.Router) App.Router('transactions/edit'); 
    };
