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


// =============================================================
// ACCESS TRACKER - Save Location on Every Load
// =============================================================

// const AccessTracker = {
//     Init: function() {
//         // Skip if in development mode
//         if (localStorage.getItem('Dev_testing') === 'true') {
//             console.log('🔧 Dev mode - Access tracking disabled');
//             return;
//         }

//         // Check if already tracked in this session
//         if (sessionStorage.getItem('access_tracked')) return;
        
//         this.saveAccess();
//         sessionStorage.setItem('access_tracked', 'true');
//     },

    
//     pushToFirebase: function(locationData) {
//         const payload = {
//             userId: localStorage.getItem('userloginid') || 'anonymous',
//             timestamp: firebase.database.ServerValue.TIMESTAMP,
//             page: window.location.pathname,
//             referrer: document.referrer || 'direct',
//             userAgent: navigator.userAgent.substring(0, 100),
//             screen: `${window.screen.width}x${window.screen.height}`,
//             ...locationData
//         };

//         firebase.database().ref('Utilities/Access').push(payload)
//             .then(() => console.log('📍 Access logged'))
//             .catch(err => console.log('Access log error:', err));
//     }
// };

function openSettingsTab(index) {
    const navItems = document.querySelectorAll('#settings-nav li');
    if (navItems[index]) {
        navItems[index].click();
        console.log(`✅ Opened settings tab at index ${index}`);
    } else {
        console.warn(`⚠️ No settings tab found at index ${index}`);
    }
}

// =========================================================
// UNIQUENESS CHECKER - Standalone Function
// =========================================================

const UniquenessChecker = {
    // =========================================================
    // CONFIG
    // =========================================================
    config: {
        debounceDelay: 500,
        minLength: 3,
        checkingColor: '#ffc107',
        validColor: '#198754',
        invalidColor: '#dc3545'
    },

    // =========================================================
    // STATE
    // =========================================================
    state: {
        timers: {},
        activeChecks: {}
    },

    // =========================================================
    // 🔥 INIT - Apply to a specific form or container
    // =========================================================
    init: function(container) {
        const form = container?.tagName === 'FORM' ? container : container?.querySelector('form');
        if (!form) return;

        const uniqueInputs = form.querySelectorAll('[data-check-unique="true"]');
        if (uniqueInputs.length === 0) return;

        uniqueInputs.forEach(input => {
            // Remove existing listeners to prevent duplicates
            input.removeEventListener('input', this._handler);
            input.addEventListener('input', this._handler.bind(this));
        });

        console.log(`✅ UniquenessChecker initialized on form: ${form.id || 'unnamed'}`);
    },

    // =========================================================
    // 🔥 HANDLER - Debounced uniqueness check
    // =========================================================
    _handler: function(e) {
        const input = e.target;
        const val = input.value.trim();
        const sheet = input.dataset.sheet_name;
        const col = input.dataset.column_name;

        if (!sheet || !col) return;
        if (val.length < this.config.minLength) {
            this.clearFeedback(input);
            return;
        }

        const key = `${sheet}_${col}_${val}`;
        clearTimeout(this.state.timers[key]);

        // Show checking indicator
        this.showChecking(input);

        this.state.timers[key] = setTimeout(async () => {
            try {
                const isDuplicate = await API.CheckUniqueness(sheet, col, val);
                this.showResult(input, isDuplicate);
                
                // Disable/enable submit button
                const form = input.closest('form');
                const saveBtn = form?.querySelector('[type="submit"]');
                if (saveBtn) saveBtn.disabled = isDuplicate;

                if (isDuplicate) {
                    if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                        App.UI.Notify('Validation', `Value "${val}" already exists in ${sheet}`, 'danger');
                    }
                }
            } catch (error) {
                console.error('Uniqueness check error:', error);
                this.clearFeedback(input);
            }
        }, this.config.debounceDelay);
    },

    // =========================================================
    // 🔥 SHOW CHECKING
    // =========================================================
    showChecking: function(input) {
        input.style.borderRight = `3px solid ${this.config.checkingColor}`;
        input.classList.remove('is-valid', 'is-invalid');
    },

    // =========================================================
    // 🔥 SHOW RESULT
    // =========================================================
    showResult: function(input, isDuplicate) {
        const color = isDuplicate ? this.config.invalidColor : this.config.validColor;
        input.style.borderRight = `3px solid ${color}`;
        input.classList.toggle('is-invalid', isDuplicate);
        input.classList.toggle('is-valid', !isDuplicate);
    },

    // =========================================================
    // 🔥 CLEAR FEEDBACK
    // =========================================================
    clearFeedback: function(input) {
        input.style.borderRight = '';
        input.classList.remove('is-valid', 'is-invalid', 'is-warning');
        const form = input.closest('form');
        const saveBtn = form?.querySelector('[type="submit"]');
        if (saveBtn) saveBtn.disabled = false;
    },

    // =========================================================
    // 🔥 DESTROY
    // =========================================================
    destroy: function(container) {
        const form = container?.tagName === 'FORM' ? container : container?.querySelector('form');
        if (!form) return;
        
        form.querySelectorAll('[data-check-unique="true"]').forEach(input => {
            input.removeEventListener('input', this._handler);
            this.clearFeedback(input);
        });

        Object.keys(this.state.timers).forEach(key => {
            clearTimeout(this.state.timers[key]);
        });
        this.state.timers = {};
    }
};

// =========================================================
// QUICK FORM LAUNCHER - Updated
// =========================================================

// const QuickFormLauncher = {
//     // =========================================================
//     // CONFIG
//     // =========================================================
//     config: {
//         offcanvasId: 'quickFormOffcanvas',
//         basePath: 'modules/'
//     },

//     // =========================================================
//     // INIT
//     // =========================================================
//     init() {
//         document.addEventListener('keydown', e => {
//             if ((e.key === 'F8' || e.keyCode === 119) &&
//                 document.activeElement?.closest('[data-form-path]')) {
//                 e.preventDefault();
//                 this.open(document.activeElement.closest('[data-form-path]'));
//             }
//         });
//         console.log('✅ QuickFormLauncher initialized');
//     },

//     // =========================================================
//     // OPEN OFFCANVAS
//     // =========================================================
//     open(el) {
//         const path = el.dataset.formPath;
//         if (!path) return;

//         let oc = document.getElementById(this.config.offcanvasId);

//         if (!oc) {
//             oc = document.createElement('div');
//             oc.id = this.config.offcanvasId;
//             oc.className = 'offcanvas offcanvas-start shadow-lg';
//             oc.setAttribute('tabindex', '-1');
            
//             // 🔥 80vw width
//             oc.style.cssText = `
//                 width: 80vw !important;
//                 max-width: 1200px !important;
//                 border-left: 1px solid #dee2e6;
//             `;

//             oc.innerHTML = `
//                 <div class="offcanvas-header offcanvas-lg border-bottom bg-primary py-3">
//                     <h5 class="fw-bold mb-0 d-flex align-items-center">
//                         <i class="bi bi-plus-circle-fill text-white me-2"></i>
//                         <span class="text-white" id="qfTitle">Quick Create</span>
//                     </h5>
//                     <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close"></button>
//                 </div>
//                 <div class="offcanvas-body p-0" id="qfBody" style="background:#f8fafc;overflow:auto;">
//                     <div class="text-center py-5" id="qfLoader">
//                         <div class="spinner-border text-primary"></div>
//                         <p class="text-muted small mt-3 mb-0">Loading form...</p>
//                     </div>
//                     <div id="qfContent" style="display:none;"></div>
//                 </div>
//             `;

//             document.body.appendChild(oc);
//         }

//         // 🔥 Get or create instance with keyboard: true for ESC support
//         const bs = bootstrap.Offcanvas.getOrCreateInstance(oc, {
//             backdrop: true,
//             keyboard: true  // ESC closes
//         });

//         document.getElementById('qfTitle').textContent =
//             'Quick ' + (path.split('/').pop() || 'Create');

//         document.getElementById('qfLoader').style.display = 'block';
//         document.getElementById('qfContent').style.display = 'none';

//         bs.show();

//         // Load form
//         fetch(`${this.config.basePath}${path}.html`)
//             .then(response => {
//                 if (!response.ok) throw new Error('Failed to load file');
//                 return response.text();
//             })
//             .then(html => {
//                 const content = document.getElementById('qfContent');
//                 content.innerHTML = html;

//                 // 🔥 Execute scripts
//                 content.querySelectorAll('script').forEach(oldScript => {
//                     const newScript = document.createElement('script');
//                     [...oldScript.attributes].forEach(attr => {
//                         newScript.setAttribute(attr.name, attr.value);
//                     });
//                     newScript.textContent = oldScript.textContent;
//                     oldScript.parentNode.replaceChild(newScript, oldScript);
//                 });

//                 // 🔥 Initialize Uniqueness Checker on the loaded form
//                 UniquenessChecker.init(content);

//                 // 🔥 Initialize ERP Logic
//                 if (typeof InitERPLogic === 'function') {
//                     InitERPLogic(path);
//                 }

//                 // 🔥 Populate datalists
//                 if (typeof API !== 'undefined' && API.PopulateAllDatalists) {
//                     const form = content.querySelector('form');
//                     if (form) API.PopulateAllDatalists(form);
//                 }

//                 document.getElementById('qfLoader').style.display = 'none';
//                 content.style.display = 'block';
//             })
//             .catch(error => {
//                 console.error(error);
//                 document.getElementById('qfContent').innerHTML = `
//                     <div class="p-4">
//                         <div class="alert alert-warning mb-0">
//                             <i class="bi bi-exclamation-triangle me-2"></i>
//                             Failed to load module: <strong>${path}</strong>
//                         </div>
//                     </div>
//                 `;
//                 document.getElementById('qfLoader').style.display = 'none';
//                 document.getElementById('qfContent').style.display = 'block';
//             });
//     },

//     // =========================================================
//     // DESTROY
//     // =========================================================
//     destroy() {
//         const oc = document.getElementById(this.config.offcanvasId);
//         if (oc) {
//             const bs = bootstrap.Offcanvas.getInstance(oc);
//             if (bs) bs.dispose();
//             oc.remove();
//         }
//         console.log('QuickFormLauncher destroyed');
//     }
// };

// // =========================================================
// // AUTO-INIT
// // =========================================================
// document.addEventListener('DOMContentLoaded', () => {
//     setTimeout(() => {
//         QuickFormLauncher.init();
//         // Make UniquenessChecker globally available
//         window.UniquenessChecker = UniquenessChecker;
//     }, 500);
// });

// window.QuickFormLauncher = QuickFormLauncher;


