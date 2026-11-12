/**
 * UNITAX PRO - Enterprise Centralized CRUD Engine
 * Architecture: Model Registry, Multi-Tier Permissions, Batching, Audit Tracking
 */

const UniTaxCRUD = {
    /**
     * CENTRAL MODULE REGISTRY
     * Defines schema, paths, primary keys, validation rules and permissions for all entities
     */
    Registry: {
        // --- MASTERS ---
        Companies: {
            id: 'Companies',
            entityType: 'Master',
            dbPath: 'Masters/Companies',
            primaryKey: 'CompanyCode',
            name: 'Company Master',
            requiredFields: ['CompanyCode', 'companyName'],
            uniqueFields: ['CompanyCode'],
            permittedFields: [
                'CompanyCode', 'companyName', 'incorporationDate', 'companyAddress1', 
                'companyAddress2', 'Company_State', 'Company_Pin', 'companyPhone', 
                'Email', 'Website', 'PAN', 'GSTIN', 'taxClassification', 'created_at', 'updated_at'
            ],
            searchFields: ['CompanyCode', 'companyName', 'GSTIN', 'Company_State']
        },
        LedgerCreation: {
            id: 'LedgerCreation',
            entityType: 'Master',
            dbPath: 'Masters/LedgerCreation',
            primaryKey: 'ledgerCode',
            name: 'Ledger Account Master',
            requiredFields: ['name', 'ledgerType'],
            uniqueFields: ['ledgerCode', 'name'],
            permittedFields: [
                'ledgerCode', 'name', 'ledgerType', 'ledgerNature', 'openingBalance',
                'balanceType', 'email', 'phone', 'address', 'state', 'pincode',
                'GST', 'pan', 'creditLimit', 'creditPeriod', 'isSystem', 'created_at', 'updated_at'
            ],
            searchFields: ['ledgerCode', 'name', 'ledgerType', 'GST', 'phone']
        },
        Stock: {
            id: 'Stock',
            entityType: 'Master',
            dbPath: 'Masters/Stock',
            primaryKey: 'Stock_Code',
            name: 'Stock Item Master',
            requiredFields: ['itemName'],
            uniqueFields: ['Stock_Code'],
            permittedFields: [
                'Stock_Code', 'stockCode', 'itemName', 'category', 'itemGroup', 'unit', 'ItemUnit',
                'hsnCode', 'itemHSN', 'ItemTax', 'taxRate', 'standardCost', 'sellingPrice',
                'openingQuantity', 'openingQty', 'openingRate', 'openingAmount', 'minLevel',
                'reorderQuantity', 'CompanyName', 'companyName & CompanyCode', 'companyName',
                'StockType', 'Description', 'created_at', 'updated_at'
            ],
            searchFields: ['Stock_Code', 'itemName', 'category', 'itemGroup', 'hsnCode', 'itemHSN']
        },
        Projects: {
            id: 'Projects',
            entityType: 'Master',
            dbPath: 'Masters/Projects',
            primaryKey: 'ProjectCode',
            name: 'Profit Center / Project Master',
            requiredFields: ['ProjectName'],
            uniqueFields: ['ProjectCode', 'ProjectName'],
            permittedFields: [
                'ProjectCode', 'ProjectName', 'projectManager', 'startDate', 
                'endDate', 'budgetAmount', 'status', 'created_at', 'updated_at'
            ],
            searchFields: ['ProjectCode', 'ProjectName', 'projectManager', 'status']
        },

        // --- TRANSACTIONS ---
        SalesInvoiceForm: {
            id: 'SalesInvoiceForm',
            entityType: 'Transaction',
            dbPath: 'Transactions/SalesInvoiceForm',
            primaryKey: 'doc_no',
            docPrefix: 'SL',
            name: 'Sales Invoice',
            debitLedgerDefault: 'customer_ledger',
            creditLedgerDefault: 'Sales Account',
            taxLedgerDefault: 'Duties and Taxes',
            requiredHeaderFields: ['doc_no', 'date', 'entity'],
            searchFields: ['header.doc_no', 'header.entity', 'header.CompanyCode', 'header.project']
        },
        PurchaseInvoiceForm: {
            id: 'PurchaseInvoiceForm',
            entityType: 'Transaction',
            dbPath: 'Transactions/PurchaseInvoiceForm',
            primaryKey: 'doc_no',
            docPrefix: 'PU',
            name: 'Purchase Voucher',
            debitLedgerDefault: 'Purchase Account',
            creditLedgerDefault: 'customer_ledger',
            taxLedgerDefault: 'Duties and Taxes',
            requiredHeaderFields: ['doc_no', 'date', 'entity'],
            searchFields: ['header.doc_no', 'header.entity', 'header.CompanyCode']
        },
        SalesReturnForm: {
            id: 'SalesReturnForm',
            entityType: 'Transaction',
            dbPath: 'Transactions/SalesReturnForm',
            primaryKey: 'doc_no',
            docPrefix: 'CN',
            name: 'Credit Note / Sales Return',
            debitLedgerDefault: 'Sales Return Account',
            creditLedgerDefault: 'customer_ledger',
            taxLedgerDefault: 'Duties and Taxes',
            requiredHeaderFields: ['doc_no', 'date', 'entity'],
            searchFields: ['header.doc_no', 'header.entity']
        },
        PurchaseReturnForm: {
            id: 'PurchaseReturnForm',
            entityType: 'Transaction',
            dbPath: 'Transactions/PurchaseReturnForm',
            primaryKey: 'doc_no',
            docPrefix: 'DN',
            name: 'Debit Note / Purchase Return',
            debitLedgerDefault: 'customer_ledger',
            creditLedgerDefault: 'Purchase Return Account',
            taxLedgerDefault: 'Duties and Taxes',
            requiredHeaderFields: ['doc_no', 'date', 'entity'],
            searchFields: ['header.doc_no', 'header.entity']
        },
        ReceiptVoucherForm: {
            id: 'ReceiptVoucherForm',
            entityType: 'Transaction',
            dbPath: 'Transactions/ReceiptVoucherForm',
            primaryKey: 'doc_no',
            docPrefix: 'RCT',
            name: 'Receipt Voucher',
            debitLedgerDefault: 'Bank / Cash Account',
            creditLedgerDefault: 'customer_ledger',
            requiredHeaderFields: ['doc_no', 'date', 'entity'],
            searchFields: ['header.doc_no', 'header.entity']
        },
        PaymentVoucherForm: {
            id: 'PaymentVoucherForm',
            entityType: 'Transaction',
            dbPath: 'Transactions/PaymentVoucherForm',
            primaryKey: 'doc_no',
            docPrefix: 'PAY',
            name: 'Payment Voucher',
            debitLedgerDefault: 'customer_ledger',
            creditLedgerDefault: 'Bank / Cash Account',
            requiredHeaderFields: ['doc_no', 'date', 'entity'],
            searchFields: ['header.doc_no', 'header.entity']
        },
        ReceiptPayForm: {
            id: 'ReceiptPayForm',
            entityType: 'Transaction',
            dbPath: 'Transactions/ReceiptPayForm',
            primaryKey: 'doc_no',
            docPrefix: 'BNK',
            name: 'Cash / Bank Movement',
            requiredHeaderFields: ['doc_no', 'date'],
            searchFields: ['header.doc_no']
        },
        JournalVoucherForm: {
            id: 'JournalVoucherForm',
            entityType: 'Transaction',
            dbPath: 'Transactions/JournalVoucherForm',
            primaryKey: 'doc_no',
            docPrefix: 'JV',
            name: 'General Journal Voucher',
            requiredHeaderFields: ['doc_no', 'date'],
            searchFields: ['header.doc_no', 'header.entity', 'header.CompanyCode']
        },
        ApprovalRequests: {
            id: 'ApprovalRequests',
            entityType: 'Governance',
            dbPath: 'Governance/Approvals',
            primaryKey: 'req_id',
            name: 'Approval Request',
            requiredFields: ['title', 'category'],
            searchFields: ['title', 'category', 'status', 'requester_id']
        }
    },

    /**
     * Resolve effective DB path for the active workspace
     */
    getResolvedPath(relativeDbPath) {
        const workspaceUserId = (typeof App !== 'undefined' && App.State && App.State.userId)
            ? App.State.userId
            : localStorage.getItem('workspaceUserId') || localStorage.getItem('userloginid');

        if (!workspaceUserId) {
            throw new Error("No active workspace user identified. Please re-authenticate.");
        }

        // Clean double-slashes and avoid repeating user ID
        const cleanRel = relativeDbPath.replace(/^\/+/, '');
        return cleanRel.startsWith(workspaceUserId) ? cleanRel : `${workspaceUserId}/${cleanRel}`;
    },

    /**
     * 1. CREATE ONE RECORD
     */
    async createOne(moduleKey, recordData, options = {}) {
        const def = this.Registry[moduleKey] || { dbPath: moduleKey, entityType: 'Dynamic' };
        const db = firebase.database();
        const fullPath = this.getResolvedPath(def.dbPath || moduleKey);

        // Alias Auto-Normalization for Stock and Masters
        if (recordData && typeof recordData === 'object') {
            if (recordData.ItemUnit && !recordData.unit) recordData.unit = recordData.ItemUnit;
            if (recordData.unit && !recordData.ItemUnit) recordData.ItemUnit = recordData.unit;
            if (recordData.itemHSN && !recordData.hsnCode) recordData.hsnCode = recordData.itemHSN;
            if (recordData.hsnCode && !recordData.itemHSN) recordData.itemHSN = recordData.hsnCode;
            if (recordData.openingQty && !recordData.openingQuantity) recordData.openingQuantity = recordData.openingQty;
            if (recordData.openingQuantity && !recordData.openingQty) recordData.openingQty = recordData.openingQuantity;
            if (recordData.Stock_Code && !recordData.stockCode) recordData.stockCode = recordData.Stock_Code;
            if (recordData.stockCode && !recordData.Stock_Code) recordData.Stock_Code = recordData.stockCode;
            if (recordData.itemGroup && !recordData.category) recordData.category = recordData.itemGroup;
            if (recordData.category && !recordData.itemGroup) recordData.itemGroup = recordData.category;
            if (recordData['companyName & CompanyCode'] && !recordData.CompanyName) recordData.CompanyName = recordData['companyName & CompanyCode'];
            if (recordData.CompanyName && !recordData['companyName & CompanyCode']) recordData['companyName & CompanyCode'] = recordData.CompanyName;
        }

        // Validation
        if (def.requiredFields) {
            for (const field of def.requiredFields) {
                if (!recordData[field] || String(recordData[field]).trim() === '') {
                    throw new Error(`Mandatory field '${field}' is required for ${def.name || moduleKey}`);
                }
            }
        }

        // Unique Constraint Check
        if (def.uniqueFields && !options.skipUniqueness) {
            for (const uField of def.uniqueFields) {
                const val = recordData[uField];
                if (val) {
                    const isDup = await API.CheckUniqueness(def.id || moduleKey, uField, val);
                    if (isDup) {
                        throw new Error(`Record with ${uField} '${val}' already exists in ${def.name || moduleKey}`);
                    }
                }
            }
        }

        // Audit & Timestamps
        const payload = {
            ...recordData,
            created_at: firebase.database.ServerValue.TIMESTAMP,
            created_by: (typeof App !== 'undefined' && App.State) ? App.State.currentuserId : 'system',
            is_deleted: false
        };

        const newRef = await db.ref(fullPath).push(payload);
        const generatedKey = newRef.key;

        // Invalidate master cache if applicable
        if (API && API._MasterCache) {
            delete API._MasterCache[moduleKey];
            delete API._MasterCache[def.id];
            delete API._MasterCache['Stock'];
            delete API._MasterCache['stock'];
        }

        // Audit Trail
        if (UniTaxAudit && typeof UniTaxAudit.Log === 'function') {
            UniTaxAudit.Log({
                action: 'CREATE',
                module: moduleKey,
                recordId: generatedKey,
                details: `Created record in ${def.name || moduleKey}`
            });
        }

        return {
            success: true,
            id: generatedKey,
            key: generatedKey,
            data: payload
        };
    },

    /**
     * 2. CREATE MANY RECORDS (Bulk Operation)
     * Validates row by row, reports detailed errors, respects limits
     */
    async createMany(moduleKey, recordsArray, options = {}) {
        if (!Array.isArray(recordsArray) || recordsArray.length === 0) {
            return { success: false, message: "No records supplied for bulk creation.", results: [] };
        }

        const maxBatchSize = options.batchSize || 100;
        if (recordsArray.length > maxBatchSize) {
            throw new Error(`Batch size limit exceeded. Maximum allowable: ${maxBatchSize} records.`);
        }

        const def = this.Registry[moduleKey] || { dbPath: moduleKey };
        const results = [];
        let successCount = 0;
        let failureCount = 0;

        for (let idx = 0; idx < recordsArray.length; idx++) {
            const row = recordsArray[idx];
            try {
                // Row-level validation
                if (def.requiredFields) {
                    for (const req of def.requiredFields) {
                        if (!row[req] || String(row[req]).trim() === '') {
                            throw new Error(`Row ${idx + 1}: Missing mandatory field '${req}'`);
                        }
                    }
                }

                const res = await this.createOne(moduleKey, row, { skipUniqueness: options.skipUniqueness });
                results.push({ row: idx + 1, success: true, id: res.id });
                successCount++;
            } catch (err) {
                failureCount++;
                results.push({ row: idx + 1, success: false, error: err.message });
                if (options.abortOnError) {
                    break;
                }
            }
        }

        return {
            success: failureCount === 0,
            total: recordsArray.length,
            successCount,
            failureCount,
            results
        };
    },

    /**
     * 3. READ ONE RECORD
     */
    async readOne(moduleKey, recordId, options = {}) {
        if (!recordId) throw new Error("Record ID required for readOne operation.");
        const def = this.Registry[moduleKey] || { dbPath: moduleKey };
        const fullPath = this.getResolvedPath(`${def.dbPath}/${recordId}`);
        const snap = await firebase.database().ref(fullPath).once('value');
        
        if (!snap.exists()) {
            return null;
        }

        const data = snap.val();
        if (data.is_deleted && !options.includeDeleted) {
            return null;
        }

        return { ID: snap.key, ...data };
    },

    /**
     * 4. READ (Bounded Criteria-Based Retrieval)
     * Supports: field projection, date ranges, filters, client pagination & sorting
     */
    async read(moduleKey, criteria = {}, options = {}) {
        const def = this.Registry[moduleKey] || { dbPath: moduleKey };
        const fullPath = this.getResolvedPath(def.dbPath);
        const db = firebase.database();
        let query = db.ref(fullPath);

        // Bounded ordering if specified
        if (options.orderBy) {
            query = query.orderByChild(options.orderBy);
            if (options.limitToLast) query = query.limitToLast(options.limitToLast);
            if (options.limitToFirst) query = query.limitToFirst(options.limitToFirst);
        }

        const snapshot = await query.once('value');
        const raw = snapshot.val();

        if (!raw || typeof raw !== 'object') {
            return { total: 0, data: [], page: 1, totalPages: 0 };
        }

        // Convert object to array with ID preservation
        let list = Object.entries(raw).map(([key, item]) => {
            if (typeof item === 'object' && item !== null) {
                return { ID: key, ...item };
            }
            return { ID: key, value: item };
        });

        // Filter out soft-deleted records unless asked
        if (!options.includeDeleted) {
            list = list.filter(item => !item.is_deleted);
        }

        // Apply Criteria-First Filtering
        if (criteria && Object.keys(criteria).length > 0) {
            list = list.filter(record => {
                for (const [critKey, critVal] of Object.entries(criteria)) {
                    if (critVal === undefined || critVal === null || critVal === '' || critVal === 'ALL') {
                        continue;
                    }

                    // Handle nested transaction fields (e.g. 'header.doc_no' or 'doc_no')
                    let recVal = record[critKey];
                    if (recVal === undefined && record.header) {
                        recVal = record.header[critKey];
                    }

                    // Date range handling (From / To)
                    if (critKey === 'fromDate' || critKey === 'dateFrom') {
                        const recDate = record.header ? record.header.date : record.date || record.created_at;
                        if (recDate && new Date(recDate) < new Date(critVal)) return false;
                        continue;
                    }
                    if (critKey === 'toDate' || critKey === 'dateTo') {
                        const recDate = record.header ? record.header.date : record.date || record.created_at;
                        if (recDate) {
                            const endOfTo = new Date(critVal);
                            endOfTo.setHours(23, 59, 59, 999);
                            if (new Date(recDate) > endOfTo) return false;
                        }
                        continue;
                    }

                    // Array of values (Multi-select)
                    if (Array.isArray(critVal)) {
                        if (critVal.length > 0 && !critVal.map(v => String(v).toLowerCase()).includes(String(recVal || '').toLowerCase())) {
                            return false;
                        }
                        continue;
                    }

                    // Exact / partial match
                    if (typeof critVal === 'string') {
                        const cleanCrit = critVal.trim().toLowerCase();
                        const cleanRec = String(recVal || '').trim().toLowerCase();
                        if (options.exactMatch ? cleanRec !== cleanCrit : !cleanRec.includes(cleanCrit)) {
                            return false;
                        }
                    }
                }
                return true;
            });
        }

        // Field Projection (Return only selected columns if requested)
        if (Array.isArray(options.selectedFields) && options.selectedFields.length > 0) {
            const fields = options.selectedFields;
            list = list.map(item => {
                const projected = { ID: item.ID };
                fields.forEach(f => {
                    if (f.includes('.')) {
                        const [parent, child] = f.split('.');
                        if (item[parent]) projected[f] = item[parent][child];
                    } else {
                        projected[f] = item[f];
                    }
                });
                return projected;
            });
        }

        // Sorting
        if (options.sortBy) {
            const sortKey = options.sortBy;
            const sortAsc = options.sortOrder !== 'desc';
            list.sort((a, b) => {
                const valA = a[sortKey] ?? (a.header ? a.header[sortKey] : '');
                const valB = b[sortKey] ?? (b.header ? b.header[sortKey] : '');
                if (typeof valA === 'number' && typeof valB === 'number') {
                    return sortAsc ? valA - valB : valB - valA;
                }
                return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            });
        }

        const totalRecords = list.length;
        const page = options.page || 1;
        const pageSize = options.pageSize || totalRecords || 50;
        const totalPages = Math.ceil(totalRecords / pageSize);
        
        // Paginate
        const startIndex = (page - 1) * pageSize;
        const paginatedData = list.slice(startIndex, startIndex + pageSize);

        return {
            total: totalRecords,
            page,
            pageSize,
            totalPages,
            data: paginatedData
        };
    },

    /**
     * 5. UPDATE ONE RECORD
     */
    async updateOne(moduleKey, recordId, patchData, options = {}) {
        if (!recordId) throw new Error("Record key required to perform update.");
        const def = this.Registry[moduleKey] || { dbPath: moduleKey };
        const fullPath = this.getResolvedPath(`${def.dbPath}/${recordId}`);
        const dbRef = firebase.database().ref(fullPath);

        // Verification: ensure record exists to prevent phantom creation
        const snap = await dbRef.once('value');
        if (!snap.exists()) {
            throw new Error(`Record ${recordId} does not exist in ${def.name || moduleKey}. Cannot update ghost record.`);
        }

        const existing = snap.val();
        if (existing.is_locked && !options.overrideLock) {
            throw new Error(`Record ${recordId} is locked against updates.`);
        }

        // Alias Auto-Normalization for Stock and Masters
        if (patchData && typeof patchData === 'object') {
            if (patchData.ItemUnit && !patchData.unit) patchData.unit = patchData.ItemUnit;
            if (patchData.unit && !patchData.ItemUnit) patchData.ItemUnit = patchData.unit;
            if (patchData.itemHSN && !patchData.hsnCode) patchData.hsnCode = patchData.itemHSN;
            if (patchData.hsnCode && !patchData.itemHSN) patchData.itemHSN = patchData.hsnCode;
            if (patchData.openingQty && !patchData.openingQuantity) patchData.openingQuantity = patchData.openingQty;
            if (patchData.openingQuantity && !patchData.openingQty) patchData.openingQty = patchData.openingQuantity;
            if (patchData.Stock_Code && !patchData.stockCode) patchData.stockCode = patchData.Stock_Code;
            if (patchData.stockCode && !patchData.Stock_Code) patchData.Stock_Code = patchData.stockCode;
            if (patchData.itemGroup && !patchData.category) patchData.category = patchData.itemGroup;
            if (patchData.category && !patchData.itemGroup) patchData.itemGroup = patchData.category;
            if (patchData['companyName & CompanyCode'] && !patchData.CompanyName) patchData.CompanyName = patchData['companyName & CompanyCode'];
            if (patchData.CompanyName && !patchData['companyName & CompanyCode']) patchData['companyName & CompanyCode'] = patchData.CompanyName;
        }

        const payload = {
            ...patchData,
            updated_at: firebase.database.ServerValue.TIMESTAMP,
            updated_by: (typeof App !== 'undefined' && App.State) ? App.State.currentuserId : 'system'
        };

        delete payload.ID;
        delete payload.key;

        await dbRef.update(payload);

        // Cache clear
        if (API && API._MasterCache) {
            delete API._MasterCache[moduleKey];
            delete API._MasterCache[def.id];
        }

        // Audit Trail
        if (UniTaxAudit && typeof UniTaxAudit.Log === 'function') {
            UniTaxAudit.Log({
                action: 'UPDATE',
                module: moduleKey,
                recordId,
                details: `Updated record fields in ${def.name || moduleKey}`
            });
        }

        return { success: true, id: recordId, data: payload };
    },

    /**
     * 6. UPDATE MANY
     */
    async updateMany(moduleKey, updatesArray) {
        if (!Array.isArray(updatesArray)) throw new Error("Expected array of updates.");
        const results = [];
        for (const item of updatesArray) {
            try {
                const res = await this.updateOne(moduleKey, item.id || item.ID, item.data || item);
                results.push({ id: item.id || item.ID, success: true });
            } catch (e) {
                results.push({ id: item.id || item.ID, success: false, error: e.message });
            }
        }
        return results;
    },

    /**
     * 7. DELETE ONE RECORD
     */
    async deleteOne(moduleKey, recordId, options = {}) {
        if (!recordId) throw new Error("Record key required for deletion.");
        const def = this.Registry[moduleKey] || { dbPath: moduleKey };
        const fullPath = this.getResolvedPath(`${def.dbPath}/${recordId}`);
        const dbRef = firebase.database().ref(fullPath);

        const snap = await dbRef.once('value');
        if (!snap.exists()) {
            throw new Error(`Record ${recordId} not found.`);
        }

        if (options.softDelete) {
            await dbRef.update({
                is_deleted: true,
                deleted_at: firebase.database.ServerValue.TIMESTAMP,
                deleted_by: (typeof App !== 'undefined' && App.State) ? App.State.currentuserId : 'system'
            });
        } else {
            await dbRef.remove();
        }

        if (API && API._MasterCache) {
            delete API._MasterCache[moduleKey];
            delete API._MasterCache[def.id];
        }

        // Audit Trail
        if (UniTaxAudit && typeof UniTaxAudit.Log === 'function') {
            UniTaxAudit.Log({
                action: 'DELETE',
                module: moduleKey,
                recordId,
                details: `Deleted record from ${def.name || moduleKey} (${options.softDelete ? 'Soft' : 'Hard'})`
            });
        }

        return { success: true, id: recordId };
    },

    /**
     * 8. DELETE MANY
     */
    async deleteMany(moduleKey, idList, options = {}) {
        if (!Array.isArray(idList)) throw new Error("Expected array of IDs to delete.");
        const results = [];
        for (const id of idList) {
            try {
                await this.deleteOne(moduleKey, id, options);
                results.push({ id, success: true });
            } catch (e) {
                results.push({ id, success: false, error: e.message });
            }
        }
        return results;
    }
};

window.UniTaxCRUD = UniTaxCRUD;
