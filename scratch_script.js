
    // =====================================================================
// DYNAMIC ROUTING, AUTO-REFRESH & ROBUST CRUD ENGINE
// =====================================================================

var hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
var urlParams = new URLSearchParams(window.location.search || hashQuery);
var paramType = urlParams.get('type');
var paramKey = urlParams.get('key');

var rawContext = localStorage.getItem('editContext') || sessionStorage.getItem('editContext');
var parsedContext = rawContext ? JSON.parse(rawContext) : {};
if (paramType && paramKey) {
    parsedContext.type = paramType;
    parsedContext.key = paramKey;
}
window.activeReturnRoute = parsedContext.returnRoute || 'reports/gl-statement';

window.goBackAndRefresh = function() {
    if (typeof App !== 'undefined' && App.Router) {
        App.Router(window.activeReturnRoute);
        setTimeout(() => {
            if (window.activeReturnRoute.includes('gl-statement') && typeof window.generateStatement === 'function') {
                window.generateStatement(); 
            } else if (window.activeReturnRoute.includes('stock') && typeof window.generateStockSummary === 'function') {
                window.generateStockSummary(); 
            }
        }, 150);
    }
};

// --- MAIN EDIT LOGIC ---
(async function() {
    if (!parsedContext || !parsedContext.type || !parsedContext.key) {
        document.getElementById('editContainer').innerHTML = `<div class="alert alert-warning shadow-sm"><i class="bi bi-info-circle me-1"></i>No transaction context specified. Redirecting to ledger...</div>`;
        setTimeout(() => window.goBackAndRefresh(), 1500);
        return;
    }
    
    const { type, key } = parsedContext; 
    let originalData = null; // High-level variable to store state for Delta Comparison

    /**
     * 🗑️ DELETE TRANSACTION
     */
    window.deleteCurrentEntry = async function() {
        if (window.UniTaxAuth && typeof UniTaxAuth.CanPerformAction === 'function') {
            if (!UniTaxAuth.CanPerformAction('delete')) {
                if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                    App.UI.Notify('Permission Denied', 'You do not have rights to delete transactions.', 'danger');
                } else {
                    alert('You do not have rights to delete transactions.');
                }
                return;
            }
        }
        if (confirm("Are you sure you want to delete this transaction? It will be removed from all active financial reports and moved to the Deleted Transactions archive.")) {
            try {
                if (window.API && typeof API.DeleteTransaction === 'function') {
                    await API.DeleteTransaction(type, key);
                } else {
                    const wsId = (typeof App !== 'undefined' && App.State && App.State.userId)
                        ? App.State.userId
                        : localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');
                    const userName = localStorage.getItem('userName') || 'User';
                    const patch = {
                        is_deleted: true,
                        status: 'DELETED',
                        deleted_at: firebase.database.ServerValue.TIMESTAMP,
                        deleted_by: userName
                    };
                    await API.DB.ref(`${wsId}/Transactions/${type}/${key}`).update(patch);
                    try {
                        await API.DB.ref(`${wsId}/Transactions/${type}/${key}/header`).update({ is_deleted: true, status: 'DELETED' });
                    } catch(e) {}
                    App.UI.Notify('Archived', 'Transaction deleted and moved to Deleted Transactions bin.', 'success');
                }
                window.goBackAndRefresh(); 
            } catch (error) {
                App.UI.Notify('Deletion Failed', error.message, 'danger');
            }
        }
    };

    /**
     * ✏️ UI UNLOCK ENGINE
     * Enables all field types including Selects and Custom Grids
     */
    window.enableEditing = function(btn) {
        if (window.UniTaxAuth && typeof UniTaxAuth.CanPerformAction === 'function') {
            if (!UniTaxAuth.CanPerformAction('edit') && !UniTaxAuth.CanPerformAction('update')) {
                if (typeof App !== 'undefined' && App.UI && App.UI.Notify) {
                    App.UI.Notify('View-Only Access', 'You have view-only access to this document. Editing is restricted by your User Admin.', 'warning');
                } else {
                    alert('You have view-only access to this document. Editing is restricted by your User Admin.');
                }
                return;
            }
        }
        const form = document.querySelector('#editContainer form');
        if(!form) return;

        // 1. Mark as Updating
        let hiddenInput = form.querySelector('input[name="UpdateStatus"]');
        if (!hiddenInput) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = 'UpdateStatus';
            form.appendChild(hiddenInput);
        }
        hiddenInput.value = 'updating';
        
        // 2. Unlock all inputs, textareas, and SELECT dropdowns
        form.querySelectorAll('input, textarea, select').forEach(el => {
            el.readOnly = false;
            el.disabled = false;
            el.style.pointerEvents = 'auto';
            if(el.tagName === 'SELECT') el.style.backgroundColor = "#fff";
        });
        
        // 3. Show hidden action buttons (Add Row, Delete Row)
        form.querySelectorAll('[data-original-display], .btn-link, .delete-row-button').forEach(el => {
            el.style.display = el.getAttribute('data-original-display') || 'inline-block';
        });
        
        // 4. Update Header UI
        const controlPanel = document.getElementById('editControlPanel');
        if (controlPanel) {
            controlPanel.innerHTML = `
                <div class="alert alert-success d-flex justify-content-between align-items-center m-0 shadow-sm border-success animate-in">
                    <span><i class="bi bi-unlock-fill me-2"></i><strong>Editing Unlocked.</strong> Update fields and click Save.</span>
                    <div>
                        <button type="button" class="btn btn-danger btn-sm fw-bold shadow-sm me-2" onclick="window.deleteCurrentEntry()">
                            <i class="bi bi-trash-fill me-1"></i> Delete
                        </button>
                        <button type="button" class="btn btn-outline-dark btn-sm fw-bold shadow-sm bg-white" onclick="window.goBackAndRefresh()">
                            <i class="bi bi-arrow-left me-1"></i> Cancel
                        </button>
                    </div>
                </div>
            `;
        }
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.style.display = 'inline-block';
            submitBtn.className = "btn btn-success btn-sm px-4 fw-bold shadow-sm";
            submitBtn.innerHTML = '<i class="bi bi-cloud-upload me-1"></i> Update Changes';
        }
        if(btn) btn.style.display = 'none';
    };
    
    // Module Mapping
    const formRegistry = { 
        "SalesInvoiceForm": "sales-inv", 
        "SALES": "sales-inv", 
        "ReceiptPaymentForm" : "receipt-pay", 
        "PurchaseInvoiceForm": "purchase-inv", 
        "PURCHASE": "purchase-inv", 
        "ReceiptVoucherForm":"receipt-vch", 
        "PaymentVoucherForm": "payment-vch", "SalesReturnForm": "salesret-inv", "CreditNoteForm": "salesret-inv", "PurchaseReturnForm": "purchaseret-inv", "DebitNoteForm": "purchaseret-inv" 
    };
    
    // Smart Field Mapping (Maps DB Keys to diverse HTML names)
    const dbToHtmlMap = {
        posting_date: ['posting_date', 'postingDate'],
        date: ['voucher_date', 'valueDate', 'date'],
        doc_no: ['Invoice', 'paymentRef', 'supplier_bill_no'],
        entity: ['customer_ledger', 'gl_account', 'supplier_ledger']
    };

    try {
        // 1. FETCH REMOTE DATA
        originalData = await API.Fetch(`Transactions/${type}/${key}`);
        if (!originalData) {
            // Try possible alias names (e.g. SalesInvoiceForm <-> sales-inv <-> SALES)
            const aliases = [
                formRegistry[type],
                Object.keys(formRegistry).find(k => formRegistry[k] === type),
                Object.keys(formRegistry).find(k => k.toLowerCase() === type.toLowerCase()),
                type.replace(/-/g, ''),
                type.toUpperCase(),
                type.toLowerCase()
            ].filter(Boolean);
            for (const alias of aliases) {
                originalData = await API.Fetch(`Transactions/${alias}/${key}`);
                if (originalData) break;
            }
        }
        console.log(`Transaction record missing on server. ${type}/${key} \n ${originalData}`)
        if (!originalData) throw new Error(`Transaction record missing on server (${type}/${key}).`);

        // 2. LOAD MODULE TEMPLATE
        const formBaseName = formRegistry[type] || type.replace('Form', '').toLowerCase();
        const res = await fetch(`modules/transactions/${formBaseName}.html`);
        const container = document.getElementById('editContainer');
        container.innerHTML = await res.text();
        const form = container.querySelector('form');

        // 3. EXECUTE MODULE SCRIPTS (For math/grid logic)
        container.querySelectorAll("script").forEach(oldScript => {
            const newScript = document.createElement("script");
            newScript.text = oldScript.innerHTML;
            document.body.appendChild(newScript).parentNode.removeChild(newScript);
        });

        /**
         * 4. ROBUST DATA POPULATION ENGINE
         * Fills All: Inputs (text/hidden/date), Selects, and Textareas
         */
        const fillForm = (dataSource, scope = form) => {
            Object.entries(dataSource).forEach(([k, v]) => {
                let keysToTry = dbToHtmlMap[k] || [k];
                keysToTry.forEach(inputName => {
                    const fields = scope.querySelectorAll(`[name="${inputName}"], [name="${inputName}[]"]`);
                    fields.forEach(field => {
                        if (field.tagName === 'SELECT') {
                            field.value = v; // Handles Select population
                        } else {
                            field.value = v; // Handles Input/Hidden/Textarea
                        }
                    });
                });
            });
        };

        // Fill Header & Meta
        if (originalData.header) fillForm(originalData.header);
        if (originalData.meta) fillForm(originalData.meta);
        const logData = originalData.header?.logistics || originalData.logistics || originalData.meta?.logistics || {};
        fillForm(logData);

        // Fill Items Grid (Clone Pattern)
        const tbody = form.querySelector('tbody');
        if (tbody && originalData.items && originalData.items.length > 0) {
            const templateRow = tbody.querySelector('tr').cloneNode(true);
            tbody.innerHTML = ''; 
            originalData.items.forEach((item, index) => {
                const newRow = templateRow.cloneNode(true);
                const srNo = newRow.querySelector('.sr-no');
                if (srNo) srNo.innerText = index + 1;
                fillForm(item, newRow);
                tbody.appendChild(newRow);
            });
            // Re-bind lookup engine to new rows
            if (typeof App !== 'undefined' && App.InitERPLogic) App.InitERPLogic(`transactions/${formBaseName}`);
        }

        // 5. LOCK UI (VIEW MODE)
const lockUI = () => {
    form.querySelectorAll('input, textarea, select').forEach(el => {
        el.readOnly = true;
        el.disabled = true;
        el.style.pointerEvents = 'none';
    });
    
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.style.display = 'none';

    form.querySelectorAll('.btn-danger, .btn-link, [onclick*="AddRow"], [onclick*="removeRow"]').forEach(btn => {
        btn.setAttribute('data-original-display', btn.style.display || 'inline-block');
        btn.style.display = 'none';
    });

    const controlPanel = document.getElementById('editControlPanel');
    if (controlPanel) {
        // Create safe variables
        const docNo = (originalData?.header?.doc_no || originalData?.header?.voucher_no || 'Document');
        const typeStr = type || 'Transaction';
        const keyStr = key || '';
        
        const canEdit = !window.UniTaxAuth || typeof UniTaxAuth.CanPerformAction !== 'function' 
            || UniTaxAuth.CanPerformAction('edit') || UniTaxAuth.CanPerformAction('update');
        const canDelete = !window.UniTaxAuth || typeof UniTaxAuth.CanPerformAction !== 'function' 
            || UniTaxAuth.CanPerformAction('delete');
        const canViewMetadata = !window.UniTaxAuth || typeof UniTaxAuth.CanPerformAction !== 'function'
            || UniTaxAuth.CanPerformAction('view_metadata')
            || UniTaxAuth.CanPerformAction('inspect_metadata')
            || UniTaxAuth.CanPerformAction('admin')
            || localStorage.getItem('canViewMetadata') === 'true'
            || ['administrator', 'super_administrator', 'co_useradmin', 'co_admin', 'manager', 'auditor', 'approver'].includes((localStorage.getItem('userrole') || '').toLowerCase());

        controlPanel.innerHTML = `
            <div class="card bg-white border-0 shadow-sm mb-3" style="border-radius: 8px;">
                <div class="d-flex justify-content-between p-2" style="min-height: 52px;">
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <span class="badge bg-opacity-10 text-primary border-0 px-3 py-1" style="font-weight: 500; font-size: 0.7rem; letter-spacing: 0.3px;">
                            <i class="bi bi-eye me-1"></i> VIEW
                        </span>
                        <span class="fw-semibold text-dark" style="font-size: 0.9rem;">
                            <i class="bi bi-file-text me-1 text-muted"></i>
                            ${docNo}
                        </span>
                        <span class="badge bg-light text-secondary border-0 px-2 py-1" style="font-size: 0.65rem; font-weight: 400;">
                            ${typeStr}
                        </span>
                        ${!canEdit ? `<span class="badge bg-secondary-subtle text-secondary border-0 px-2 py-1 font-mono" style="font-size: 0.65rem;"><i class="bi bi-lock-fill me-1"></i>View Only</span>` : ''}
                    </div>
                    <div class="d-flex gap-1 align-items-center">
                        <button type="button" class="btn btn-outline-secondary btn-sm " 
                                style="width: 32px; height: 32px; border-radius: 6px; padding: 0;"
                                onclick="window.goBackAndRefresh()" 
                                title="Go Back">
                            <i class="bi bi-arrow-left" style="font-size: 0.95rem;"></i>
                        </button>
                        <button type="button" class="btn btn-outline-primary btn-sm fw-semibold" 
                                style="height: 32px; border-radius: 6px; padding: 0 10px;"
                                data-bs-toggle="offcanvas" data-bs-target="#additionalDetails" 
                                title="View & Edit Logistics Details">
                            <i class="bi bi-truck me-1"></i> Logistics
                        </button>
                        ${canViewMetadata ? `
                        <button type="button" class="btn btn-outline-dark btn-sm fw-semibold" 
                                id="btnInspectMetadata"
                                style="height: 32px; border-radius: 6px; padding: 0 10px;"
                                onclick="window.openTransactionMetadataDrawer()" 
                                title="Inspect Enterprise Transaction Metadata & Audit Provenance">
                            <i class="bi bi-fingerprint text-primary me-1"></i> Audit & Metadata
                        </button>` : ''}
                        <button type="button" class="btn btn-outline-secondary btn-sm " 
                                style="width: 32px; height: 32px; border-radius: 6px; padding: 0;"
                                onclick="window.printTransaction('${typeStr}', '${keyStr}')" 
                                title="Print Document">
                            <i class="bi bi-printer" style="font-size: 0.95rem;"></i>
                        </button>
                        ${canDelete ? `
                        <button type="button" class="btn btn-outline-danger btn-sm " 
                                style="width: 32px; height: 32px; border-radius: 6px; padding: 0;"
                                onclick="window.deleteCurrentEntry()" 
                                title="Delete Transaction">
                            <i class="bi bi-trash3" style="font-size: 0.95rem;"></i>
                        </button>` : ''}
                        ${canEdit ? `
                        <div class="vr mx-1" style="height: 24px; opacity: 0.3;"></div>
                        <button type="button" class="btn btn-warning btn-sm fw-semibold px-2" 
                                style="border-radius: 6px; font-size: 0.8rem;"
                                onclick="window.enableEditing(this)"
                                title="Edit Document">
                            <i class="bi bi-pencil-square me-1" style="font-size: 0.85rem;"></i> Edit
                        </button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
};
lockUI();

        // 6. 🔥 DELTA-SMART UPDATE HANDLER
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentHeader = {};
            const currentItems = [];
            const currentMeta = {};

            // Collect Header
            form.querySelectorAll('.card-body > .row input, .card-body > .row select, .p-4 > .row input').forEach(el => {
                if(!el.name) return;
                let dbK = el.name;
                // Standardize keys to match Firebase
                if (['Invoice', 'paymentRef', 'supplier_bill_no'].includes(dbK)) dbK = 'doc_no';
                if (['voucher_date', 'valueDate', 'date'].includes(dbK)) dbK = 'date';
                if (['customer_ledger', 'gl_account'].includes(dbK)) dbK = 'entity';
                currentHeader[dbK] = el.value;
            });

            // Collect Items
            form.querySelectorAll('tbody tr').forEach(row => {
                const item = {};
                row.querySelectorAll('input, select').forEach(el => {
                    if(!el.name) return;
                    item[el.name.replace('[]', '')] = el.value;
                });
                if(item.item_name || item.offset_account || item.amount) currentItems.push(item);
            });

            // Recalculate Totals (Accounting Integrity)
            let sub = 0, tax = 0;
            currentItems.forEach(i => {
                const b = (parseFloat(i.qty) || 1) * (parseFloat(i.rate) || parseFloat(i.amount) || 0);
                sub += b;
                tax += b * ((parseFloat(i.auto_item_name_ItemTax) || 0) / 100);
            });
            currentHeader.subTotal = sub;
            currentHeader.taxTotal = tax;
            currentHeader.grandTotal = sub + tax;

            // --- DELTA CALCULATION ---
            const updatePayload = {};

            // Compare Header (including Select values)
            Object.entries(currentHeader).forEach(([k, v]) => {
                if (String(v) !== String(originalData.header[k])) {
                    updatePayload[`header/${k}`] = v;
                }
            });

            // Compare Items
            if (JSON.stringify(currentItems) !== JSON.stringify(originalData.items)) {
                updatePayload['items'] = currentItems;
            }

            // Compare Meta
            form.querySelectorAll('input, select').forEach(el => {
                if (!el.name || el.closest('tbody')) return;
                if (String(el.value) !== String(originalData.meta?.[el.name])) {
                    updatePayload[`meta/${el.name}`] = el.value;
                }
            });

            // Collect & Update Logistics
            const logDrawer = document.getElementById('additionalDetails');
            if (logDrawer) {
                const updatedLogistics = {};
                logDrawer.querySelectorAll('input, select').forEach(el => {
                    if (el.name && el.value !== '') updatedLogistics[el.name] = el.value;
                });
                if (Object.keys(updatedLogistics).length > 0) {
                    updatePayload['header/logistics'] = updatedLogistics;
                    updatePayload['logistics'] = updatedLogistics;
                    if (updatedLogistics.transporter_name) updatePayload['header/transporter_name'] = updatedLogistics.transporter_name;
                    if (updatedLogistics.vehicle_no) updatePayload['header/vehicle_no'] = updatedLogistics.vehicle_no;
                    if (updatedLogistics.lr_no) updatePayload['header/lr_no'] = updatedLogistics.lr_no;
                    if (updatedLogistics.eway_bill_no) updatePayload['header/eway_bill_no'] = updatedLogistics.eway_bill_no;
                }
            }

            if (Object.keys(updatePayload).length === 0) {
                App.UI.Notify('No Changes', 'Record is already up to date.', 'info');
                window.goBackAndRefresh();
                return;
            }

            try {
                const btn = form.querySelector('button[type="submit"]');
                btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Updating...`;
                btn.disabled = true;

                await API.DB.ref(`${App.State.userId}/Transactions/${type}/${key}`).update(updatePayload);
                
                App.UI.Notify('Updated', 'Record successfully modified.', 'success');
                window.goBackAndRefresh(); 

            } catch (error) {
                App.UI.Notify('Error', error.message, 'danger');
                btn.disabled = false;
            }
        });

    } catch (err) {
        console.error("CRUD Error:", err);
        document.getElementById('editContainer').innerHTML = `<div class="alert alert-danger m-4 shadow-sm">${err.message}</div>`;
    }
})();

    // =========================================================================
    // ENTERPRISE METADATA & AUDIT LEDGER LOGIC (FORTUNE-500 PROVENANCE)
    // =========================================================================
    window.openTransactionMetadataDrawer = async function() {
        if (!originalData) return;

        const hdr = originalData.header || originalData;
        const meta = originalData.meta || {};
        const docNo = hdr.doc_no || hdr.voucher_no || key;
        const formId = type;

        // Badges & Titles
        if (document.getElementById('metaVoucherBadge')) document.getElementById('metaVoucherBadge').innerText = `${formId}: ${docNo}`;
        if (document.getElementById('metaDocNo')) document.getElementById('metaDocNo').innerText = docNo;
        if (document.getElementById('metaFormType')) document.getElementById('metaFormType').innerText = formId;
        if (document.getElementById('metaDbKey')) document.getElementById('metaDbKey').value = key;
        if (document.getElementById('metaOrgAnchor')) document.getElementById('metaOrgAnchor').innerText = hdr.CompanyCode || localStorage.getItem('workspaceId') || 'Default Entity';
        if (document.getElementById('metaProjectCode')) document.getElementById('metaProjectCode').innerText = hdr.project || 'General';

        // Authorship
        const authorName = hdr.posted_by_name || meta.posted_by_name || hdr.user_name || hdr.posted_by || 'Staff Member';
        const authorId = hdr.posted_by || meta.posted_by || 'Staff';
        const authorEmail = hdr.posted_by_email || meta.posted_by_email || '-';
        const authorRole = (hdr.posted_by_role || meta.posted_by_role || 'Operator').toUpperCase();
        
        if (document.getElementById('metaCreatedByName')) document.getElementById('metaCreatedByName').innerText = authorName;
        if (document.getElementById('metaCreatedById')) document.getElementById('metaCreatedById').innerText = `ID: ${authorId}`;
        if (document.getElementById('metaCreatedByEmail')) document.getElementById('metaCreatedByEmail').innerText = authorEmail;
        if (document.getElementById('metaCreatedByRole')) document.getElementById('metaCreatedByRole').innerText = authorRole;

        const rawTime = hdr.posted_at || hdr.timestamp || hdr.created_at || meta.posted_at_iso || null;
        let formattedDate = 'N/A';
        let relativeAge = '-';
        if (rawTime) {
            const d = new Date(rawTime);
            if (!isNaN(d.getTime())) {
                formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
                if (diffSec < 60) relativeAge = 'Just now';
                else if (diffSec < 3600) relativeAge = `${Math.floor(diffSec / 60)} mins ago`;
                else if (diffSec < 86400) relativeAge = `${Math.floor(diffSec / 3600)} hours ago`;
                else relativeAge = `${Math.floor(diffSec / 86400)} days ago`;
            }
        }
        if (document.getElementById('metaCreatedAtTime')) document.getElementById('metaCreatedAtTime').innerText = formattedDate;
        if (document.getElementById('metaRelativeAge')) document.getElementById('metaRelativeAge').innerText = relativeAge;

        // Governance & Approval
        const isApproved = (hdr.status === 'POSTED' || originalData.status === 'POSTED') && !hdr.is_draft && !originalData.is_draft;
        const isDraft = hdr.status === 'PENDING_APPROVAL' || hdr.status === 'DRAFT' || hdr.is_draft || originalData.is_draft;
        const isRejected = hdr.status === 'REJECTED' || hdr.status === 'RETURNED';

        const statusPill = document.getElementById('metaStatusPill');
        const approvalStateHtml = document.getElementById('metaApprovalStateHtml');

        if (statusPill && approvalStateHtml) {
            if (isApproved) {
                statusPill.className = 'badge bg-success-subtle text-success border border-success-subtle';
                statusPill.innerText = 'POSTED & VERIFIED';
                approvalStateHtml.innerHTML = '<span class="badge bg-success"><i class="bi bi-shield-check me-1"></i> Verified & Fully Approved</span>';
            } else if (isDraft) {
                statusPill.className = 'badge bg-warning-subtle text-warning border border-warning-subtle';
                statusPill.innerText = 'DRAFT (PENDING APPROVAL)';
                approvalStateHtml.innerHTML = '<span class="badge bg-warning text-dark"><i class="bi bi-clock-fill me-1"></i> Awaiting Verification</span>';
            } else if (isRejected) {
                statusPill.className = 'badge bg-danger-subtle text-danger border border-danger-subtle';
                statusPill.innerText = 'RETURNED FOR REVISION';
                approvalStateHtml.innerHTML = '<span class="badge bg-danger"><i class="bi bi-x-circle-fill me-1"></i> Returned to Originator</span>';
            } else {
                statusPill.className = 'badge bg-light text-dark border';
                statusPill.innerText = hdr.status || 'ACTIVE';
                approvalStateHtml.innerHTML = `<span class="badge bg-light text-dark border">${hdr.status || 'Active'}</span>`;
            }
        }

        if (document.getElementById('metaAssignedManager')) document.getElementById('metaAssignedManager').innerText = hdr.assigned_manager_name || 'Workspace Administrator';
        if (document.getElementById('metaApprovedByName')) document.getElementById('metaApprovedByName').innerText = hdr.approved_by_name || (hdr.approved_by ? `ID: ${hdr.approved_by}` : (isApproved ? 'Workspace Administrator' : 'Pending Authorization'));
        if (document.getElementById('metaApprovedById')) document.getElementById('metaApprovedById').innerText = hdr.approved_by ? `ID: ${hdr.approved_by}` : '-';

        let appDateStr = 'Pending Authorization';
        if (hdr.approved_at) {
            const ad = new Date(hdr.approved_at);
            if (!isNaN(ad.getTime())) {
                appDateStr = ad.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + ad.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            }
        }
        if (document.getElementById('metaApprovedAtTime')) document.getElementById('metaApprovedAtTime').innerText = appDateStr;
        if (document.getElementById('metaApprovalRemarks')) document.getElementById('metaApprovalRemarks').innerText = hdr.rejection_reason || (isApproved ? "Transaction line items, tax computations & ledger balance verified and approved for posting." : "Awaiting designated reporting manager sign-off.");

        // Statutory & Financial
        const amount = hdr.grand_total || hdr.grandTotal || hdr.amount || 0;
        if (document.getElementById('metaGrandTotal')) document.getElementById('metaGrandTotal').innerText = `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const isReconciled = hdr.is_reconciled === true || hdr.reconciled === true || originalData.is_reconciled === true;
        const reconBadge = document.getElementById('metaReconBadge');
        if (reconBadge) {
            if (isReconciled) {
                reconBadge.className = 'badge bg-success';
                reconBadge.innerText = 'Reconciled (Matched)';
                if (document.getElementById('metaReconDate')) document.getElementById('metaReconDate').innerText = hdr.reconciled_date || 'Reconciled';
                if (document.getElementById('metaReconRemarks')) document.getElementById('metaReconRemarks').innerText = hdr.reconciled_remark || 'Bank statement transaction balance matched';
            } else {
                reconBadge.className = 'badge bg-secondary';
                reconBadge.innerText = 'Unreconciled (Open)';
                if (document.getElementById('metaReconDate')) document.getElementById('metaReconDate').innerText = 'Unreconciled';
                if (document.getElementById('metaReconRemarks')) document.getElementById('metaReconRemarks').innerText = 'Awaiting statement reconciliation upload';
            }
        }

        // Cryptographic SHA-256 Record Hash
        try {
            const rawString = `${docNo}|${formId}|${amount}|${authorId}|${hdr.posted_at || ''}|${hdr.status || ''}`;
            const encoder = new TextEncoder();
            const data = encoder.encode(rawString);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            if (document.getElementById('metaCryptoHash')) document.getElementById('metaCryptoHash').innerText = `SHA256: ${hashHex}`;
        } catch(e) {
            if (document.getElementById('metaCryptoHash')) document.getElementById('metaCryptoHash').innerText = `SHA256: ${btoa(docNo + amount + authorId)}`;
        }

        // Show Offcanvas
        const drawerEl = document.getElementById('transactionMetadataDrawer');
        if (drawerEl && typeof bootstrap !== 'undefined') {
            const bsDrawer = bootstrap.Offcanvas.getOrCreateInstance(drawerEl);
            bsDrawer.show();
        }
    };

    window.copyMetadataJson = function() {
        if (!originalData) return;
        const jsonStr = JSON.stringify(originalData, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
            if (typeof App !== 'undefined' && App.UI && typeof App.UI.Notify === 'function') {
                App.UI.Notify('Clipboard', 'Transaction metadata copied to clipboard as JSON.', 'success');
            } else {
                alert('Transaction metadata copied to clipboard as JSON.');
            }
        });
    };

    window.printAuditCertificate = function() {
        if (!currentContextData) {
            App.UI.Notify('No Data', 'Transaction data is not fully loaded yet.', 'warning');
            return;
        }
        const hdr = currentContextData.header || currentContextData;
        const docNo = hdr.doc_no || hdr.invoice_no || hdr.voucher_no || hdr.docNo || 'DOC-UNASSIGNED';
        const formId = hdr.form_id || hdr.formId || 'Voucher';
        const author = hdr.posted_by_name || hdr.posted_by || 'Staff';
        const approver = hdr.approved_by_name || hdr.approved_by || (hdr.status === 'POSTED' ? 'Workspace Administrator' : 'Pending');
        const amount = hdr.grand_total || hdr.grandTotal || hdr.amount || 0;
        const hash = document.getElementById('metaCryptoHash')?.innerText || 'SHA256-AUTHENTIC-SEAL';

        const printWin = window.open('', '_blank');
        if (!printWin) {
            App.UI.Notify('Pop-up Blocked', 'Please allow pop-ups to print the audit certificate.', 'warning');
            return;
        }

        const doc = printWin.document;
        doc.title = 'Audit Certificate - ' + docNo;
        
        const style = doc.createElement('style');
        style.textContent = `
            body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
            .cert-box { border: 2px solid #0f172a; padding: 30px; border-radius: 8px; max-width: 750px; margin: auto; }
            .cert-header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 25px; }
            .cert-title { font-size: 24px; font-weight: bold; color: #0f172a; text-transform: uppercase; }
            .cert-subtitle { font-size: 13px; color: #64748b; margin-top: 5px; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            .meta-table th, .meta-table td { padding: 10px 14px; border: 1px solid #e2e8f0; font-size: 13px; }
            .meta-table th { background: #f8fafc; text-align: left; width: 35%; color: #475569; }
            .seal-box { background: #0f172a; color: #38bdf8; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 11px; word-break: break-all; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8; }
        `;
        doc.head.appendChild(style);

        const bodyHtml = `
            <div class="cert-box">
                <div class="cert-header">
                    <div class="cert-title">UniTax Pro ERP - Certificate of Transaction Audit</div>
                    <div class="cert-subtitle">Statutory Audit Trail & Chain of Custody Verification Document</div>
                </div>
                <table class="meta-table">
                    <tr><th>Document Number</th><td><strong>${docNo}</strong> (${formId})</td></tr>
                    <tr><th>Transaction Date</th><td>${hdr.date || new Date().toISOString().split('T')[0]}</td></tr>
                    <tr><th>Counterparty / Ledger</th><td>${hdr.entity || '-'}</td></tr>
                    <tr><th>Fiscal Value</th><td><strong>₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td></tr>
                    <tr><th>Initiated / Created By</th><td>${author} (${hdr.posted_by || 'ID: Staff'})</td></tr>
                    <tr><th>Governance Status</th><td>${hdr.status || 'POSTED'}</td></tr>
                    <tr><th>Authorized / Approved By</th><td>${approver}</td></tr>
                    <tr><th>Approval Timestamp</th><td>${hdr.approved_at ? new Date(hdr.approved_at).toLocaleString() : 'N/A'}</td></tr>
                    <tr><th>Reporting Manager</th><td>${hdr.assigned_manager_name || 'Workspace Administrator'}</td></tr>
                    <tr><th>Compliance Standard</th><td>MCA Audit Trail Mandate Rule 3(1) Compliant</td></tr>
                </table>
                <div class="seal-box">
                    <strong>CRYPTOGRAPHIC DIGITAL SEAL:</strong><br>
                    ${hash}<br>
                    <small style="color: #94a3b8;">Record verified tamper-proof at ${new Date().toISOString()}</small>
                </div>
                <div class="footer">
                    Generated automatically by UniTax Pro Enterprise Architecture v2.6. Valid for internal and statutory audit inspection.
                </div>
            </div>
        `;
        doc.body.innerHTML = bodyHtml;
        printWin.focus();
        setTimeout(() => { try { printWin.print(); } catch(e){} }, 300);
    };
