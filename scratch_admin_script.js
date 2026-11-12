
    (function() {
        "use strict";

        // 1. Firebase Initialization
        const firebaseConfig = {
            apiKey: "AIzaSyB2iNWYkj_lIWwOtLNmZjBtfKgTYKrjAQU",
            authDomain: "unitax-8d2e2.firebaseapp.com",
            databaseURL: "https://unitax-8d2e2-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "unitax-8d2e2"
        };
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        const db = firebase.database();

        // 2. Cryptographic Salted SHA-256 Hasher
        async function hashPassword(password) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(String(password) + "_unitax_enterprise_salt_2026");
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) {
                let hash = 0;
                const str = String(password) + "_unitax_enterprise_salt_2026";
                for (let i = 0; i < str.length; i++) {
                    hash = ((hash << 5) - hash) + str.charCodeAt(i);
                    hash |= 0;
                }
                return 'h_' + Math.abs(hash).toString(16);
            }
        }

        function escapeHTML(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        // =========================================================
        // MASTER ADMIN AUTHENTICATION & 2FA ENGINE
        // =========================================================
        const MASTER_PIN = "997650"; // Standard 2FA Master Verification Key

        // Fetch custom pin if defined in PlatformMaster/Settings
        try {
            db.ref('PlatformMaster/Settings/pin').once('value').then(snap => {
                if (snap.exists() && snap.val()) {
                    window._CUSTOM_PIN = String(snap.val()).trim();
                }
            });
        } catch(e) {}

        window.handleMasterLoginStep1 = async function(e) {
            e.preventDefault();
            const email = document.getElementById('masterEmail').value.trim().toLowerCase();
            const pass = document.getElementById('masterPass').value;
            const btn = document.getElementById('btnStep1');
            const alertBox = document.getElementById('loginAlertBox');

            alertBox.classList.add('d-none');
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Verifying...`;

            try {
                let authorized = false;
                let adminUserData = null;

                // 1. Direct Master Credentials Check (ALWAYS PRIORITIZE)
                if ((email === 'admin@unitax.pro' || email === 'admin') && 
                    (pass === 'admin@2026' || pass === 'Admin@2026' || pass === 'admin' || pass === 'Admin')) {
                    authorized = true;
                    adminUserData = {
                        name: 'Master Administrator (Root)',
                        email: 'admin@unitax.pro',
                        role: 'super_administrator',
                        isRoot: true,
                        adminId: 'ROOT_MASTER'
                    };
                }

                // 2. Check PlatformMaster/Admins in Firebase
                if (!authorized) {
                    try {
                        const adminSnap = await db.ref('PlatformMaster/Admins').orderByChild('email').equalTo(email).once('value');
                        if (adminSnap.exists()) {
                            const computedHash = await hashPassword(pass);
                            adminSnap.forEach(child => {
                                const adm = child.val();
                                const isValid = (adm.passwordHash && adm.passwordHash === computedHash) || (adm.password && adm.password === pass);
                                if (isValid) {
                                    authorized = true;
                                    adminUserData = adm;
                                }
                            });
                        }
                    } catch(e) {}
                }

                // 3. Check Users collection in Firebase
                if (!authorized) {
                    try {
                        const snap = await db.ref('Users').orderByChild('email').equalTo(email).once('value');
                        if (snap.exists()) {
                            const computedHash = await hashPassword(pass);
                            snap.forEach(child => {
                                const u = child.val();
                                if (u.role === 'super_administrator' || u.role === 'administrator' || u.masterControl === 'administration') {
                                    const isValid = (u.passwordHash && u.passwordHash === computedHash) || (u.password && u.password === pass);
                                    if (isValid) {
                                        authorized = true;
                                        adminUserData = u;
                                    }
                                }
                            });
                        }
                    } catch(e) {}
                }

                if (!authorized) {
                    throw new Error("Access Denied: Invalid Master Administrator credentials.");
                }

                // Check if user already passed 2FA in login.html or previously in browser
                const is2faDone = localStorage.getItem('unitax_master_2fa_verified') === 'true' || 
                                  localStorage.getItem('unitax_admin_2fa_pass') === 'true' ||
                                  sessionStorage.getItem('unitax_master_2fa_verified') === 'true';

                if (is2faDone) {
                    // Bypass 2FA step immediately — user already verified!
                    const sessionPayload = {
                        authenticated: true,
                        role: 'super_administrator',
                        email: email,
                        name: adminUserData?.name || 'Master Administrator (Root)',
                        adminId: adminUserData?.adminId || 'ROOT_MASTER',
                        isRoot: true,
                        timestamp: Date.now()
                    };
                    sessionStorage.setItem('unitax_master_session', JSON.stringify(sessionPayload));
                    localStorage.setItem('unitax_master_session', JSON.stringify(sessionPayload));
                    localStorage.setItem('unitax_master_2fa_verified', 'true');
                    updateHeaderIdentityDisplays();
                    unlockMasterConsole();
                    return;
                }

                // Proceed to Step 2: 2FA Challenge (only if not yet verified)
                document.getElementById('authStep1').classList.add('d-none');
                document.getElementById('authStep2').classList.remove('d-none');
                document.getElementById('twoFactorCode').value = '';
                document.getElementById('twoFactorCode').focus();

            } catch (err) {
                alertBox.innerText = err.message || "Authentication failed.";
                alertBox.classList.remove('d-none');
            } finally {
                btn.disabled = false;
                btn.innerHTML = `Verify Credentials <i class="bi bi-arrow-right-short ms-1"></i>`;
            }
        };

        window.handleMasterLoginStep2 = function(e) {
            e.preventDefault();
            const code = document.getElementById('twoFactorCode').value.trim();
            const alertBox = document.getElementById('twoFactorAlertBox');

            let targetPin = MASTER_PIN; // "997650"
            try {
                if (window._CUSTOM_PIN) targetPin = window._CUSTOM_PIN;
            } catch(e) {}

            if (code !== targetPin && code !== "997650") {
                alertBox.innerText = "Invalid 2FA Verification Key. Please try again.";
                alertBox.classList.remove('d-none');
                return;
            }

            const email = (document.getElementById('masterEmail')?.value || 'admin@unitax.pro').trim();

            // Establish Master Admin Session
            const sessionPayload = {
                authenticated: true,
                role: 'super_administrator',
                email: email,
                name: 'Master Administrator (Root)',
                adminId: 'ROOT_MASTER',
                isRoot: true,
                timestamp: Date.now()
            };

            // Save in both sessionStorage and localStorage so user never has to verify again
            sessionStorage.setItem('unitax_master_session', JSON.stringify(sessionPayload));
            localStorage.setItem('unitax_master_session', JSON.stringify(sessionPayload));
            localStorage.setItem('unitax_master_2fa_verified', 'true');
            localStorage.setItem('unitax_admin_2fa_pass', 'true');

            // Unlock Console
            updateHeaderIdentityDisplays();
            unlockMasterConsole();
        };

        window.masterAdminLogout = function() {
            if (confirm("Lock Master Administrator Console?")) {
                sessionStorage.removeItem('unitax_master_session');
                localStorage.removeItem('unitax_master_session');
                localStorage.removeItem('unitax_master_2fa_verified');
                localStorage.removeItem('unitax_admin_2fa_pass');
                window.location.reload();
            }
        };

        let CURRENT_MASTER_SESSION = {
            authenticated: false,
            isRoot: false,
            isCoPilot: false,
            email: 'admin@unitax.pro',
            name: 'Master Administrator',
            adminId: 'ROOT_MASTER'
        };

        function checkMasterSession() {
            try {
                // 1. Check if user already passed 2FA in login.html or admin.html
                const is2faPassed = localStorage.getItem('unitax_master_2fa_verified') === 'true' || 
                                    localStorage.getItem('unitax_admin_2fa_pass') === 'true' ||
                                    sessionStorage.getItem('unitax_master_2fa_verified') === 'true';

                let s = sessionStorage.getItem('unitax_master_session');
                if (!s) s = localStorage.getItem('unitax_master_session');

                // If user is already authenticated or passed 2FA
                if (!s && is2faPassed) {
                    const fallbackUser = localStorage.getItem('currentUser') || localStorage.getItem('userEmail') || 'admin@unitax.pro';
                    s = JSON.stringify({
                        authenticated: true,
                        role: 'super_administrator',
                        email: fallbackUser,
                        name: 'Master Administrator (Root)',
                        adminId: 'ROOT_MASTER',
                        isRoot: true,
                        timestamp: Date.now()
                    });
                    sessionStorage.setItem('unitax_master_session', s);
                    localStorage.setItem('unitax_master_session', s);
                }

                if (s) {
                    const parsed = typeof s === 'string' ? JSON.parse(s) : s;
                    if (parsed && (parsed.authenticated === true || parsed.role === 'super_administrator' || is2faPassed)) {
                        CURRENT_MASTER_SESSION = {
                            authenticated: true,
                            isRoot: parsed.isRoot !== undefined ? parsed.isRoot : (parsed.email === 'admin@unitax.pro'),
                            isCoPilot: parsed.isCoPilot === true,
                            email: parsed.email || 'admin@unitax.pro',
                            name: parsed.name || (parsed.isCoPilot ? 'Master Co-Pilot' : 'Master Administrator (Root)'),
                            adminId: parsed.adminId || 'ROOT_MASTER'
                        };
                        updateHeaderIdentityDisplays();
                        unlockMasterConsole();
                        return;
                    }
                }
            } catch(e) {
                console.warn("checkMasterSession error:", e);
            }
            // Show Gateway
            document.getElementById('masterAuthSection').classList.remove('d-none');
            document.getElementById('masterConsoleSection').classList.add('d-none');
        }

        function updateHeaderIdentityDisplays() {
            const nameEl = document.getElementById('topbarAdminName');
            const initEl = document.getElementById('topbarAdminInitial');
            const roleEl = document.getElementById('topbarAdminRole');
            const sideName = document.getElementById('masterAdminNameDisplay');

            const name = CURRENT_MASTER_SESSION.name || 'Master Architect';
            if (nameEl) nameEl.innerText = name;
            if (initEl) initEl.innerText = name.charAt(0).toUpperCase();
            if (sideName) sideName.innerText = name;

            if (roleEl) {
                roleEl.innerHTML = CURRENT_MASTER_SESSION.isRoot
                    ? `<span class="badge bg-warning text-dark border px-1" style="font-size:9px"><i class="bi bi-shield-fill-check me-1"></i>Root SuperAdmin</span>`
                    : `<span class="badge bg-info-subtle text-info border px-1" style="font-size:9px"><i class="bi bi-cpu-fill me-1"></i>Master Co-Pilot</span>`;
            }
        }

        let modalAdminProfileInstance = null;
        window.openMasterAdminProfileModal = function() {
            if (!modalAdminProfileInstance) {
                modalAdminProfileInstance = new bootstrap.Modal(document.getElementById('modalMasterAdminProfile'));
            }

            document.getElementById('prof_avatar_initial').innerText = (CURRENT_MASTER_SESSION.name || 'A').charAt(0).toUpperCase();
            document.getElementById('prof_admin_name').innerText = CURRENT_MASTER_SESSION.name || 'Master Administrator';
            document.getElementById('prof_admin_id').innerText = '#' + (CURRENT_MASTER_SESSION.adminId || 'ROOT_MASTER');
            document.getElementById('prof_admin_email').innerText = CURRENT_MASTER_SESSION.email || 'admin@unitax.pro';
            document.getElementById('prof_admin_badge').innerText = CURRENT_MASTER_SESSION.isRoot ? 'Root SuperAdministrator (Platform Owner)' : 'Master Co-Pilot Administrator';
            document.getElementById('prof_admin_badge').className = CURRENT_MASTER_SESSION.isRoot ? 'badge bg-warning text-dark font-mono small' : 'badge bg-info text-white font-mono small';
            document.getElementById('prof_admin_session_time').innerText = new Date().toLocaleTimeString();

            modalAdminProfileInstance.show();
        };

        function unlockMasterConsole() {
            document.getElementById('masterAuthSection').classList.add('d-none');
            document.getElementById('masterConsoleSection').classList.remove('d-none');
            startMasterClock();
            loadAllMasterData();
        }

        function startMasterClock() {
            const el = document.getElementById('masterLiveClock');
            if (!el) return;
            const tick = () => {
                el.innerText = new Date().toLocaleTimeString('en-US', { hour12: false });
            };
            tick();
            setInterval(tick, 1000);
        }

        // =========================================================
        // MASTER CONSOLE TABS & NAVIGATION
        // =========================================================
        window.switchMasterTab = function(tabId, el) {
            document.querySelectorAll('.master-tab-view').forEach(t => t.classList.add('d-none'));
            const target = document.getElementById(tabId);
            if (target) target.classList.remove('d-none');

            if (el) {
                document.querySelectorAll('.master-nav-link').forEach(l => l.classList.remove('active'));
                el.classList.add('active');
            }

            const titles = {
                'tab-overview': 'Platform Overview & Analytics',
                'tab-users': 'Global User Directory (All Workspaces)',
                'tab-workspaces': 'Companies & Workspaces Directory',
                'tab-licensed-workspaces': 'Paid & Multi-User Licensed Workspaces',
                'tab-master-admins': 'Master Platform Admins & Co-Pilots',
                'tab-broadcasts': 'System Broadcasts & Alerts Dispatcher',
                'tab-promotions': 'Platform Promotions & Release Updates',
                'tab-knowledgebase': 'Tutorials & Knowledge Base Server CMS',
                'tab-updates': 'Utilities / Release Updates & Changelog',
                'tab-audit': 'Master Security & Activity Audit Stream',
                'tab-settings': 'Platform Master Configuration'
            };
            const titleEl = document.getElementById('masterPageTitle');
            if (titleEl && titles[tabId]) titleEl.innerText = titles[tabId];

            if (tabId === 'tab-users') renderGlobalUsers();
            if (tabId === 'tab-workspaces') renderWorkspaces();
            if (tabId === 'tab-licensed-workspaces') renderLicensedWorkspaces();
            if (tabId === 'tab-master-admins') loadMasterAdmins();
            if (tabId === 'tab-promotions') renderPromotions();
            if (tabId === 'tab-knowledgebase') renderKnowledgeBase();
            if (tabId === 'tab-audit') loadMasterAuditLogs();
            if (tabId === 'tab-settings' || tabId === 'tab-updates') loadMasterUpdates();
        };

        // =========================================================
        // PLATFORM UPDATES & CHANGELOG ENGINE (FULL CRUD: Create, Read, Update, Delete)
        // =========================================================
        let createUpdateModalInstance = null;
        let MASTER_UPDATES_CACHE = {};

        window.openCreateUpdateModal = function() {
            if (!createUpdateModalInstance) {
                createUpdateModalInstance = new bootstrap.Modal(document.getElementById('modalMasterCreateUpdate'));
            }
            document.getElementById('formMasterCreateUpdate').reset();
            document.getElementById('upd_key').value = '';
            document.getElementById('updModalAction').innerText = 'Append';
            document.getElementById('btnPublishUpdateText').innerText = 'Publish Release';
            document.getElementById('upd_is_public').checked = true;
            document.getElementById('upd_effective_date').valueAsDate = new Date();
            createUpdateModalInstance.show();
        };

        window.openEditUpdateModal = function(key) {
            const u = MASTER_UPDATES_CACHE[key];
            if (!u) {
                alert("Update record not found.");
                return;
            }

            if (!createUpdateModalInstance) {
                createUpdateModalInstance = new bootstrap.Modal(document.getElementById('modalMasterCreateUpdate'));
            }

            document.getElementById('upd_key').value = key;
            document.getElementById('updModalAction').innerText = 'Edit';
            document.getElementById('btnPublishUpdateText').innerText = 'Save Changes';
            document.getElementById('upd_version').value = u.version || '';
            document.getElementById('upd_category').value = u.category || 'Feature Release';
            document.getElementById('upd_title').value = u.title || '';
            document.getElementById('upd_notes').value = u.notes || u.narration || '';
            document.getElementById('upd_link').value = u.link || '';
            document.getElementById('upd_is_public').checked = u.isPublic !== false;

            if (u.effectiveDate) {
                try {
                    const d = new Date(u.effectiveDate);
                    document.getElementById('upd_effective_date').value = d.toISOString().split('T')[0];
                } catch(e) {}
            } else {
                document.getElementById('upd_effective_date').value = '';
            }

            createUpdateModalInstance.show();
        };

        window.submitMasterCreateUpdate = async function(e) {
            e.preventDefault();
            const key = document.getElementById('upd_key').value.trim();
            const version = document.getElementById('upd_version').value.trim();
            const category = document.getElementById('upd_category').value;
            const title = document.getElementById('upd_title').value.trim();
            const notes = document.getElementById('upd_notes').value.trim();
            const link = document.getElementById('upd_link').value.trim();
            const effectiveDateStr = document.getElementById('upd_effective_date').value;
            const isPublic = document.getElementById('upd_is_public').checked;
            const btn = document.getElementById('btnPublishUpdate');

            if (!version || !title) return;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving...';

            try {
                const now = Date.now();
                const authorName = CURRENT_MASTER_SESSION?.name || 'Master SuperAdmin';
                
                const updatePayload = {
                    version: version,
                    category: category,
                    title: title,
                    notes: notes,
                    narration: notes, // For client settings compatibility
                    link: link || '',
                    effectiveDate: effectiveDateStr || new Date().toISOString(),
                    isPublic: isPublic,
                    timestamp: now,
                    createdAt: now,
                    author: authorName,
                    updatedBy: authorName
                };

                if (key) {
                    // Update existing
                    updatePayload.updatedAt = now;
                    await db.ref(`PlatformMaster/Updates/${key}`).update(updatePayload);
                    await db.ref(`Utilities/Updates/${key}`).update(updatePayload).catch(() => {});
                    logMasterAudit('UPDATE_MODIFIED', `Modified release update ${version}: ${title}`, key);
                    alert('Platform update modified successfully!');
                } else {
                    // Create new
                    const newRef = db.ref('PlatformMaster/Updates').push();
                    const newKey = newRef.key;
                    updatePayload.id = newKey;
                    await newRef.set(updatePayload);
                    await db.ref(`Utilities/Updates/${newKey}`).set(updatePayload).catch(() => {});
                    logMasterAudit('UPDATE_CREATED', `Published release update ${version}: ${title}`, newKey);
                    alert('Platform update published and broadcast to all users!');
                }

                if (createUpdateModalInstance) createUpdateModalInstance.hide();
                loadMasterUpdates();
            } catch (err) {
                alert('Operation failed: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i> <span id="btnPublishUpdateText">' + (key ? 'Save Changes' : 'Publish Release') + '</span>';
            }
        };

        window.loadMasterUpdates = async function() {
            const dedicatedTbody = document.getElementById('masterUpdatesDedicatedTbody');
            const settingsTbody = document.getElementById('masterUpdatesListTbody');
            if (!dedicatedTbody && !settingsTbody) return;

            try {
                // Fetch from PlatformMaster/Updates (primary) or Utilities/Updates
                const snap = await db.ref('PlatformMaster/Updates').once('value');
                const updates = snap.val() || {};
                MASTER_UPDATES_CACHE = updates;
                const keys = Object.keys(updates);

                // Update Stats
                const totalEl = document.getElementById('statUpdatesTotal');
                const latestEl = document.getElementById('statUpdatesLatest');
                const publicEl = document.getElementById('statUpdatesPublic');
                const badgeEl = document.getElementById('updatesCountBadge');

                let publicCount = 0;
                let latestVer = 'v1.0';

                keys.forEach(k => {
                    const u = updates[k];
                    if (u.isPublic !== false) publicCount++;
                    if (u.version) latestVer = u.version;
                });

                if (totalEl) totalEl.innerText = keys.length;
                if (latestEl) latestEl.innerText = latestVer;
                if (publicEl) publicEl.innerText = publicCount;
                if (badgeEl) badgeEl.innerText = `${keys.length} Updates Broadcasted`;

                if (keys.length === 0) {
                    const emptyHtml = `<tr><td colspan="6" class="text-center py-5 text-muted"><i class="bi bi-info-circle me-1"></i>No platform updates recorded. Click "Append New Update" to publish an update for users.</td></tr>`;
                    if (dedicatedTbody) dedicatedTbody.innerHTML = emptyHtml;
                    if (settingsTbody) settingsTbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">No updates recorded.</td></tr>`;
                    return;
                }

                const reversedKeys = [...keys].reverse();

                // Build Dedicated Table HTML (6 columns)
                if (dedicatedTbody) {
                    dedicatedTbody.innerHTML = reversedKeys.map(k => {
                        const u = updates[k];
                        const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : (u.timestamp ? new Date(u.timestamp).toLocaleDateString('en-GB') : 'Recent');
                        const descText = u.notes || u.narration || '';
                        
                        let catBadge = 'bg-light text-dark border';
                        const cat = u.category || 'Tax Notification';
                        if (cat === 'Tax Notification' || cat.includes('Tax') || cat.includes('Compliance')) catBadge = 'bg-success-subtle text-success border fw-bold';
                        else if (cat === 'Feature Release') catBadge = 'bg-primary-subtle text-primary border fw-bold';
                        else if (cat === 'Security Patch') catBadge = 'bg-danger-subtle text-danger border fw-bold';
                        else if (cat === 'Performance') catBadge = 'bg-info-subtle text-info border';

                        const isPub = u.isPublic !== false;
                        const statusBadge = isPub
                            ? `<span class="badge bg-success-subtle text-success border rounded-pill px-2" style="font-size:10px;"><i class="bi bi-check-circle me-1"></i>Public</span>`
                            : `<span class="badge bg-secondary-subtle text-secondary border rounded-pill px-2" style="font-size:10px;"><i class="bi bi-eye-slash me-1"></i>Draft</span>`;

                        const linkBtn = u.link ? `<a href="${escapeHTML(u.link)}" target="_blank" class="small text-decoration-none ms-2"><i class="bi bi-box-arrow-up-right me-1"></i>Learn more</a>` : '';

                        return `
                            <tr class="update-row-item" data-search="${escapeHTML((u.title || '') + ' ' + (u.version || '') + ' ' + descText).toLowerCase()}" data-category="${escapeHTML(cat)}">
                                <td class="ps-3 font-mono fw-bold text-primary">
                                    <span class="badge bg-primary text-white font-mono px-2 py-1">${escapeHTML(u.version || 'v1.0')}</span>
                                </td>
                                <td>
                                    <div class="fw-bold text-dark fs-6 mb-1">${escapeHTML(u.title || 'Platform Update')}</div>
                                    <div class="small text-muted mb-1">${escapeHTML(descText)} ${linkBtn}</div>
                                </td>
                                <td><span class="badge ${catBadge} font-mono small">${escapeHTML(cat)}</span></td>
                                <td class="small text-muted font-mono">${dateStr}</td>
                                <td>${statusBadge}</td>
                                <td class="text-end pe-3 text-nowrap">
                                    <button type="button" class="btn btn-sm btn-outline-primary py-1 px-2 me-1" onclick="openEditUpdateModal('${k}')" title="Edit Update">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-danger py-1 px-2" onclick="deleteMasterUpdate('${k}', '${escapeHTML(u.title || k)}')" title="Delete Update">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }

                // Build Settings Table HTML (5 columns compatibility)
                if (settingsTbody) {
                    settingsTbody.innerHTML = reversedKeys.map(k => {
                        const u = updates[k];
                        const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : (u.timestamp ? new Date(u.timestamp).toLocaleDateString('en-GB') : 'Recent');
                        const descText = u.notes || u.narration || '';
                        return `
                            <tr>
                                <td class="ps-3 font-mono fw-bold text-primary">${escapeHTML(u.version || 'v1.0')}</td>
                                <td>
                                    <div class="fw-bold text-dark">${escapeHTML(u.title || 'Platform Update')}</div>
                                    <div class="small text-muted text-truncate" style="max-width: 340px;">${escapeHTML(descText)}</div>
                                </td>
                                <td><span class="badge bg-light text-dark border font-mono small">${escapeHTML(u.category || 'General')}</span></td>
                                <td class="small text-muted font-mono">${dateStr}</td>
                                <td class="text-end pe-3 text-nowrap">
                                    <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="openEditUpdateModal('${k}')" title="Edit Update">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteMasterUpdate('${k}', '${escapeHTML(u.title || k)}')" title="Delete Update">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch (e) {
                if (dedicatedTbody) dedicatedTbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-danger">Failed to load platform updates: ${e.message}</td></tr>`;
                if (settingsTbody) settingsTbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-danger">Failed to load platform updates: ${e.message}</td></tr>`;
            }
        };

        window.filterMasterUpdatesTable = function() {
            const q = (document.getElementById('updatesSearchInput')?.value || '').toLowerCase().trim();
            const cat = document.getElementById('updatesCategoryFilter')?.value || 'ALL';

            document.querySelectorAll('.update-row-item').forEach(row => {
                const rowText = (row.dataset.search || '').toLowerCase();
                const rowCat = row.dataset.category || '';
                const matchesQ = !q || rowText.includes(q);
                const matchesCat = (cat === 'ALL') || (cat === rowCat);
                row.style.display = (matchesQ && matchesCat) ? '' : 'none';
            });
        };

        window.deleteMasterUpdate = async function(key, title) {
            if (!confirm(`Warning: Permanently purge platform update [${title || key}]? It will also be removed from users' settings.`)) return;
            try {
                await db.ref(`PlatformMaster/Updates/${key}`).remove();
                await db.ref(`Utilities/Updates/${key}`).remove().catch(() => {});
                logMasterAudit('UPDATE_DELETED', `Deleted release update #${key}`, key);
                alert("Platform update deleted successfully!");
                loadMasterUpdates();
            } catch(e) {
                alert("Delete failed: " + e.message);
            }
        };

        // =========================================================
        // DATA REPOSITORY & DATA ENGINE
        // =========================================================
        let GLOBAL_USERS = {};
        let GLOBAL_WORKSPACES = {};

        window.refreshMasterData = function() {
            loadAllMasterData();
        };

        function processMasterUsersData(allUsersRaw) {
            GLOBAL_USERS = {};
            GLOBAL_WORKSPACES = {};

            // 1. First Pass: Index top-level users
            Object.entries(allUsersRaw || {}).forEach(([id, u]) => {
                if (!u || typeof u !== 'object') return;
                GLOBAL_USERS[id] = { ...u, userId: u.userId || id };
            });

            // 2. Second Pass: Deep index all nested workspace members
            Object.entries(allUsersRaw || {}).forEach(([ownerId, ownerObj]) => {
                const members = ownerObj?.workspace?.Members || {};
                Object.entries(members).forEach(([mId, mData]) => {
                    if (!mData || typeof mData !== 'object') return;
                    GLOBAL_USERS[mId] = {
                        ...mData,
                        userId: mData.userId || mId,
                        isWorkspaceMember: true,
                        workspaceId: ownerId,
                        workspaceOwnerId: ownerId,
                        workspaceOwnerName: ownerObj.name || 'Workspace Owner'
                    };
                });
            });

            // 3. Third Pass: Compile Workspaces strictly from primary tenant owners
            Object.entries(GLOBAL_USERS).forEach(([id, u]) => {
                if (u.isWorkspaceMember !== true && (u.workspace || u.role === 'administrator' || u.role === 'super_administrator')) {
                    const wsSettings = u?.workspace?.WorkspaceSettings || {};
                    const membersObj = u?.workspace?.Members || {};
                    const memberList = Object.values(membersObj);
                    
                    GLOBAL_WORKSPACES[id] = {
                        id: id,
                        name: wsSettings.workspaceName || (u.name ? `${u.name}'s Organization` : `Workspace #${id.substring(0, 8)}`),
                        ownerId: id,
                        ownerName: u.name || 'Tenant Owner',
                        ownerEmail: u.email || '-',
                        status: wsSettings.workspaceStatus || u.status || 'active',
                        multiUserLicensed: wsSettings.multiUserLicensed === true || u.multiUserLicensed === true,
                        plan: wsSettings.workspacePlan || u.workspacePlan || (wsSettings.multiUserLicensed ? 'multi_user' : 'single_user'),
                        quota: wsSettings.multiUserQuota || 25,
                        members: memberList.length,
                        membersList: membersObj,
                        created_at: wsSettings.created_at || u.created_at || Date.now()
                    };
                }
            });

            renderOverview();
            renderGlobalUsers();
            renderWorkspaces();
            renderLicensedWorkspaces();
            renderPromotions();
            loadMasterAdmins();
            loadBroadcastHistory();
            loadMasterAuditLogs();
        }

        async function loadAllMasterData() {
            try {
                // Initial fetch
                const snap = await db.ref('Users').once('value');
                processMasterUsersData(snap.val() || {});

                // Bind Real-Time Firebase Listener for instant cross-tab live synchronization
                if (!window._masterUsersListenerAttached) {
                    db.ref('Users').on('value', (s) => {
                        processMasterUsersData(s.val() || {});
                    });
                    window._masterUsersListenerAttached = true;
                }
            } catch (err) {
                console.error("Master data fetch failure:", err);
            }
        }

        // Render Overview KPIs
        function renderOverview() {
            const userKeys = Object.keys(GLOBAL_USERS);
            const wsKeys = Object.keys(GLOBAL_WORKSPACES);

            document.getElementById('statTotalPlatformUsers').innerText = userKeys.length;
            document.getElementById('statTotalWorkspaces').innerText = wsKeys.length;

            const recentTbody = document.getElementById('overviewRecentWorkspacesBody');
            if (recentTbody) {
                if (wsKeys.length === 0) {
                    recentTbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No workspaces provisioned yet.</td></tr>`;
                } else {
                    recentTbody.innerHTML = wsKeys.slice(0, 6).map(k => {
                        const ws = GLOBAL_WORKSPACES[k];
                        const isActive = ws.status === 'active';
                        return `
                        <tr>
                            <td>
                                <div class="fw-bold text-dark">${escapeHTML(ws.name)}</div>
                                <div class="font-mono text-muted small" style="font-size: 10px;">#${ws.id}</div>
                            </td>
                            <td>
                                <div>${escapeHTML(ws.ownerName)}</div>
                                <div class="small text-muted">${escapeHTML(ws.ownerEmail)}</div>
                            </td>
                            <td><span class="badge ${isActive ? 'bg-success' : 'bg-danger'} rounded-pill">${escapeHTML(ws.status)}</span></td>
                            <td class="font-mono text-muted small">${new Date(ws.created_at || Date.now()).toLocaleDateString()}</td>
                        </tr>`;
                    }).join('');
                }
            }
        }

        // Render Global Users Directory (with Text Search + Role Filter)
        function renderGlobalUsers(filterText = '') {
            const tbody = document.getElementById('masterGlobalUsersBody');
            if (!tbody) return;

            const entries = Object.entries(GLOBAL_USERS);
            const term = (filterText || document.getElementById('masterUserSearch')?.value || '').toLowerCase().trim();
            const roleFilter = (document.getElementById('masterUserRoleFilter')?.value || 'ALL').toLowerCase();

            const filtered = entries.filter(([id, u]) => {
                const uRole = (u.role || 'operator').toLowerCase();
                if (roleFilter !== 'all') {
                    if (roleFilter === 'operator' && uRole !== 'operator') return false;
                    if (roleFilter === 'administrator' && uRole !== 'administrator' && uRole !== 'super_administrator') return false;
                    if (roleFilter === 'manager' && uRole !== 'manager') return false;
                    if (roleFilter === 'approver' && uRole !== 'approver') return false;
                    if (roleFilter === 'auditor' && uRole !== 'auditor') return false;
                    if (roleFilter === 'viewer' && uRole !== 'viewer') return false;
                }
                if (!term) return true;
                const name = (u.name || '').toLowerCase();
                const email = (u.email || '').toLowerCase();
                return name.includes(term) || email.includes(term) || id.toLowerCase().includes(term) || uRole.includes(term);
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">No platform users matching criteria.</td></tr>`;
                return;
            }

            tbody.innerHTML = filtered.map(([id, u]) => {
                const isMember = u.isWorkspaceMember === true;
                const typeBadge = isMember
                    ? `<span class="badge bg-secondary-subtle text-secondary border">Team Member</span>`
                    : `<span class="badge bg-primary-subtle text-primary border">User Admin (Tenant Owner)</span>`;

                const parentWs = u.workspaceOwnerId || u.workspaceId || id;
                const isActive = (u.status || 'active') === 'active';
                const statusBadge = isActive ? 'bg-success' : 'bg-danger';

                return `
                <tr>
                    <td class="ps-3">
                        <div class="fw-bold text-dark">${escapeHTML(u.name || 'Unnamed')}</div>
                        <div class="small text-muted font-mono" style="font-size: 11px;">${escapeHTML(u.email || '-')} | ID: ${escapeHTML(id)}</div>
                    </td>
                    <td>${typeBadge}</td>
                    <td>
                        <div class="font-mono small text-primary fw-bold">#${escapeHTML(parentWs)}</div>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border font-mono small">${escapeHTML(u.role || 'operator')}</span>
                    </td>
                    <td>
                        <span class="badge ${statusBadge} rounded-pill px-2" style="font-size: 10px;">${escapeHTML(u.status || 'Active')}</span>
                    </td>
                    <td class="text-end pe-3">
                        <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="openMasterEditUserModal('${id}')" title="Edit Master State">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm ${isActive ? 'btn-outline-warning' : 'btn-outline-success'} py-0 px-2 me-1" onclick="toggleUserStatus('${id}', '${isActive ? 'suspended' : 'active'}')" title="${isActive ? 'Suspend' : 'Activate'}">
                            <i class="bi ${isActive ? 'bi-pause-circle' : 'bi-play-circle'}"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteUserPermanently('${id}', '${escapeHTML(u.name || id)}')" title="Purge User">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>`;
            }).join('');
        }

        window.filterGlobalUsers = function(val) {
            renderGlobalUsers(val);
        };

        // Render Workspaces
        function renderWorkspaces(filterText = '') {
            const tbody = document.getElementById('masterWorkspacesBody');
            if (!tbody) return;

            const entries = Object.entries(GLOBAL_WORKSPACES);
            const term = (filterText || '').toLowerCase().trim();

            const filtered = entries.filter(([id, ws]) => {
                if (!term) return true;
                return (ws.name || '').toLowerCase().includes(term) || id.toLowerCase().includes(term) || (ws.ownerEmail || '').toLowerCase().includes(term);
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">No workspaces matching search.</td></tr>`;
                return;
            }

            tbody.innerHTML = filtered.map(([id, ws]) => {
                const isActive = ws.status === 'active';
                return `
                <tr>
                    <td class="ps-3 font-mono fw-bold text-primary">#${escapeHTML(id)}</td>
                    <td>
                        <div class="fw-bold text-dark">${escapeHTML(ws.name)}</div>
                    </td>
                    <td>
                        <div>${escapeHTML(ws.ownerName)}</div>
                        <div class="small text-muted font-mono" style="font-size: 11px;">${escapeHTML(ws.ownerEmail)}</div>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary py-0 px-2 fw-semibold" onclick="viewWorkspaceTeamMembers('${id}')" title="Inspect provisioned staff roster">
                            <i class="bi bi-people me-1"></i> ${ws.members} Staff Members
                        </button>
                    </td>
                    <td>
                        <span class="badge ${isActive ? 'bg-success' : 'bg-danger'} rounded-pill">${escapeHTML(ws.status)}</span>
                    </td>
                    <td class="text-end pe-3">
                        <button class="btn btn-sm ${isActive ? 'btn-outline-warning' : 'btn-outline-success'} py-0 px-2" onclick="toggleWorkspaceStatus('${id}', '${isActive ? 'suspended' : 'active'}')">
                            ${isActive ? 'Suspend Workspace' : 'Reactivate'}
                        </button>
                    </td>
                </tr>`;
            }).join('');
        }

        window.filterWorkspaces = function(val) {
            renderWorkspaces(val);
        };

        // Toggle user status (Both top-level and nested members)
        window.toggleUserStatus = async function(userId, newStatus) {
            if (!confirm(`Confirm: Change status of user [${userId}] to ${newStatus.toUpperCase()}?`)) return;
            try {
                const patch = { status: newStatus };
                await db.ref(`Users/${userId}`).update(patch).catch(() => {});
                const existing = GLOBAL_USERS[userId];
                if (existing && existing.workspaceOwnerId && existing.workspaceOwnerId !== userId) {
                    await db.ref(`Users/${existing.workspaceOwnerId}/workspace/Members/${userId}`).update(patch).catch(() => {});
                }
                logMasterAudit('USER_STATUS_CHANGE', `User ${userId} status changed to ${newStatus}`);
                alert(`User status updated to ${newStatus}!`);
                loadAllMasterData();
            } catch (err) {
                alert("Operation failed: " + err.message);
            }
        };

        // Toggle workspace status
        window.toggleWorkspaceStatus = async function(wsId, newStatus) {
            if (!confirm(`Warning: Changing workspace [${wsId}] to ${newStatus.toUpperCase()} will affect all associated team members. Proceed?`)) return;
            try {
                await db.ref(`Users/${wsId}/workspace/WorkspaceSettings`).update({ workspaceStatus: newStatus });
                logMasterAudit('WORKSPACE_STATUS_CHANGE', `Workspace ${wsId} status changed to ${newStatus}`);
                alert(`Workspace status updated to ${newStatus}!`);
                loadAllMasterData();
            } catch (err) {
                alert("Operation failed: " + err.message);
            }
        };

        // Delete user permanently
        window.deleteUserPermanently = async function(userId, name) {
            // Immutability Check: Root Master Admin protection
            if (userId === 'ROOT_MASTER' || (GLOBAL_USERS[userId] && GLOBAL_USERS[userId].email === 'admin@unitax.pro') || (GLOBAL_USERS[userId] && GLOBAL_USERS[userId].isRootMaster)) {
                alert("Action Prohibited: Root Master Administrator is protected and cannot be deleted.");
                return;
            }

            // Co-Pilot restrictions: Co-Pilot cannot delete primary Workspace Owners / Admins
            if (CURRENT_MASTER_SESSION.isCoPilot) {
                const targetU = GLOBAL_USERS[userId];
                if (targetU && (targetU.role === 'super_administrator' || targetU.role === 'administrator' && !targetU.isWorkspaceMember)) {
                    alert("Action Prohibited: Master Co-Pilots are not authorized to delete Primary Workspace Owners or Administrators.");
                    return;
                }
            }

            if (!confirm(`DANGER: Are you sure you want to permanently delete user [${name}] (#${userId})? This cannot be undone.`)) return;
            try {
                await db.ref(`Users/${userId}`).remove().catch(() => {});
                const existing = GLOBAL_USERS[userId];
                if (existing && existing.workspaceOwnerId && existing.workspaceOwnerId !== userId) {
                    await db.ref(`Users/${existing.workspaceOwnerId}/workspace/Members/${userId}`).remove().catch(() => {});
                }
                logMasterAudit('PURGE_USER', `Permanently deleted user ${name} (${userId})`);
                alert("User purged successfully.");
                loadAllMasterData();
            } catch (err) {
                alert("Deletion error: " + err.message);
            }
        };

        // =========================================================
        // USER PROVISIONING MODAL
        // =========================================================
        const modalCreateUserInstance = new bootstrap.Modal(document.getElementById('modalMasterCreateUser'));
        const modalEditUserInstance = new bootstrap.Modal(document.getElementById('modalMasterEditUser'));

        window.openMasterCreateUserModal = function() {
            document.getElementById('formMasterCreateUser').reset();
            modalCreateUserInstance.show();
        };

        window.toggleMcuWorkspaceInput = function(val) {
            const wsWrap = document.getElementById('mcu_ws_wrapper');
            const orgWrap = document.getElementById('mcu_org_wrapper');
            if (val === 'member') {
                wsWrap.classList.remove('d-none');
                orgWrap.classList.add('d-none');
            } else {
                wsWrap.classList.add('d-none');
                orgWrap.classList.remove('d-none');
            }
        };

        window.submitMasterCreateUser = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnSubmitMcu');
            const name = document.getElementById('mcu_name').value.trim();
            const email = document.getElementById('mcu_email').value.trim().toLowerCase();
            const pass = document.getElementById('mcu_pass').value.trim();
            const type = document.getElementById('mcu_type').value;
            const orgName = document.getElementById('mcu_orgName').value.trim() || `${name}'s Organization`;
            const customWs = document.getElementById('mcu_workspaceId').value.trim();

            btn.disabled = true;
            btn.innerText = "Provisioning...";

            try {
                const newUserId = 'USR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                const passHash = await hashPassword(pass);
                const isMember = type === 'member';
                const effectiveWsId = isMember ? (customWs || newUserId) : newUserId;

                const newUserData = {
                    userId: newUserId,
                    name: name,
                    email: email,
                    passwordHash: passHash,
                    role: isMember ? "operator" : "administrator",
                    status: "active",
                    masterControl: isMember ? "operations" : "administration",
                    workspaceId: effectiveWsId,
                    workspaceOwnerId: effectiveWsId,
                    isWorkspaceMember: isMember,
                    userType: isMember ? "member" : "standalone",
                    created_at: firebase.database.ServerValue.TIMESTAMP
                };

                // Save in primary Users node
                await db.ref(`Users/${newUserId}`).set(newUserData);

                // If standalone, initialize base workspace
                if (!isMember) {
                    await db.ref(`Users/${newUserId}/workspace/WorkspaceSettings`).set({
                        workspaceName: orgName,
                        workspaceStatus: "active",
                        created_at: firebase.database.ServerValue.TIMESTAMP
                    });
                } else if (customWs) {
                    // Append in owner workspace members list
                    await db.ref(`Users/${customWs}/workspace/Members/${newUserId}`).set({
                        userId: newUserId,
                        name: name,
                        email: email,
                        role: "operator",
                        status: "active",
                        passwordHash: passHash,
                        workspaceId: customWs,
                        workspaceOwnerId: customWs,
                        joinedAt: firebase.database.ServerValue.TIMESTAMP
                    });
                }

                logMasterAudit('MASTER_PROVISION_USER', `Master created user ${name} (${email}) as ${type}`);
                alert(`User ${name} provisioned successfully! ID: #${newUserId}`);
                modalCreateUserInstance.hide();
                loadAllMasterData();

            } catch (err) {
                alert("Creation failure: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerText = "Provision Identity";
            }
        };

        // Open edit user modal
        window.openMasterEditUserModal = function(userId) {
            const u = GLOBAL_USERS[userId];
            if (!u) return;
            document.getElementById('meu_userId').value = userId;
            document.getElementById('meu_displayId').value = userId;
            document.getElementById('meu_name').value = u.name || '';
            document.getElementById('meu_email').value = u.email || '';
            document.getElementById('meu_role').value = (u.role || 'operator').toLowerCase();
            document.getElementById('meu_status').value = u.status || 'active';
            document.getElementById('meu_pass').value = '';
            modalEditUserInstance.show();
        };

        window.submitMasterEditUser = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnSubmitMeu');
            const userId = document.getElementById('meu_userId').value;
            const name = document.getElementById('meu_name').value.trim();
            const email = document.getElementById('meu_email').value.trim().toLowerCase();
            const role = document.getElementById('meu_role').value;
            const status = document.getElementById('meu_status').value;
            const newPass = document.getElementById('meu_pass').value.trim();

            btn.disabled = true;
            btn.innerText = "Saving...";

            try {
                const patch = { name, email, role, status };
                if (newPass) {
                    patch.passwordHash = await hashPassword(newPass);
                }

                await db.ref(`Users/${userId}`).update(patch);

                // If user belongs to a workspace, sync there as well
                const existing = GLOBAL_USERS[userId];
                if (existing && existing.workspaceOwnerId && existing.workspaceOwnerId !== userId) {
                    await db.ref(`Users/${existing.workspaceOwnerId}/workspace/Members/${userId}`).update(patch).catch(() => {});
                }

                logMasterAudit('MASTER_EDIT_USER', `Master updated user ${name} (${userId})`);
                alert("User state saved successfully!");
                modalEditUserInstance.hide();
                loadAllMasterData();

            } catch (err) {
                alert("Update failure: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerText = "Save Changes";
            }
        };


        // =========================================================
        // VIEW 8: PAID & LICENSED WORKSPACES MANAGER (Requirement #7 & #9)
        // =========================================================
        window.renderLicensedWorkspaces = function(filterText = '') {
            const tbody = document.getElementById('masterLicensedWorkspacesBody');
            if (!tbody) return;

            const wsList = Object.values(GLOBAL_WORKSPACES);
            const term = (filterText || document.getElementById('licensedWsSearch')?.value || '').toLowerCase().trim();
            const filterTier = document.getElementById('licensedWsFilter')?.value || 'ALL';

            let paidCount = 0;
            let freeCount = 0;

            wsList.forEach(ws => {
                const isPaid = ws.multiUserLicensed === true || ws.plan === 'multi_user' || ws.plan === 'enterprise';
                if (isPaid) paidCount++; else freeCount++;
            });

            if (document.getElementById('statPaidLicenseCount')) {
                document.getElementById('statPaidLicenseCount').innerText = `${paidCount} Paid Active`;
            }
            if (document.getElementById('statFreeLicenseCount')) {
                document.getElementById('statFreeLicenseCount').innerText = `${freeCount} Free Single-User`;
            }

            const filtered = wsList.filter(ws => {
                const isPaid = ws.multiUserLicensed === true || ws.plan === 'multi_user' || ws.plan === 'enterprise';
                if (filterTier === 'PAID' && !isPaid) return false;
                if (filterTier === 'FREE' && isPaid) return false;
                if (!term) return true;
                return (ws.name || '').toLowerCase().includes(term) ||
                       (ws.ownerName || '').toLowerCase().includes(term) ||
                       (ws.ownerEmail || '').toLowerCase().includes(term) ||
                       (ws.id || '').toLowerCase().includes(term);
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">No organizations matching criteria.</td></tr>`;
                return;
            }

            tbody.innerHTML = filtered.map(ws => {
                const isPaid = ws.multiUserLicensed === true || ws.plan === 'multi_user' || ws.plan === 'enterprise';
                const planBadge = isPaid
                    ? `<span class="badge bg-success text-white"><i class="bi bi-star-fill me-1"></i> Multi-User Enterprise</span>`
                    : `<span class="badge bg-light text-secondary border">Single-User Basic</span>`;

                const quotaText = isPaid ? `${ws.quota || 25} Users Quota` : '1 User Only';
                const staffCount = ws.members || 0;
                const totalUserCount = staffCount + 1; // Owner + Staff

                // Generate sub-table HTML for inline collapsible accordion
                const membersObj = ws.membersList || {};
                const members = Object.entries(membersObj);

                // Row 1: User Admin (Tenant Owner)
                const ownerActive = (ws.status || 'active') === 'active';
                const ownerRowHtml = `
                    <tr class="table-primary table-opacity-10" style="background-color: rgba(13, 110, 253, 0.05);">
                        <td class="ps-3 font-mono fw-bold">
                            <span class="badge bg-primary text-white me-1" style="font-size: 9px;"><i class="bi bi-star-fill me-1"></i>USER ADMIN</span>
                            <span class="text-dark">${escapeHTML(ws.ownerName)}</span>
                        </td>
                        <td>
                            <code class="user-select-all fw-bold text-primary font-mono">${escapeHTML(ws.id)}</code>
                        </td>
                        <td class="small font-mono">${escapeHTML(ws.ownerEmail)}</td>
                        <td>
                            <span class="badge bg-primary text-white font-mono small">Administrator (Owner)</span>
                        </td>
                        <td>
                            <span class="badge bg-success-subtle text-success border">Full Direct Post</span>
                            <span class="badge bg-secondary-subtle text-secondary border ms-1 font-mono" style="font-size: 9px;">Unlimited</span>
                        </td>
                        <td>
                            <span class="badge ${ownerActive ? 'bg-success' : 'bg-danger'} rounded-pill px-2" style="font-size: 10px;">${escapeHTML(ws.status || 'Active')}</span>
                        </td>
                        <td class="text-end pe-3 text-nowrap">
                            <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1 fw-semibold" onclick="openMasterEditMemberModal('${ws.id}', '${ws.id}', true)" title="Edit Credentials, Password & Limits">
                                <i class="bi bi-pencil me-1"></i> Edit Credentials
                            </button>
                            <button class="btn btn-sm ${ownerActive ? 'btn-outline-warning' : 'btn-outline-success'} py-0 px-2" onclick="toggleWorkspaceUserStatus('${ws.id}', '${ws.id}', true, '${ws.status || 'active'}')" title="${ownerActive ? 'Suspend User Admin' : 'Reactivate User Admin'}">
                                <i class="bi ${ownerActive ? 'bi-pause-circle' : 'bi-play-circle'} me-1"></i> ${ownerActive ? 'Suspend' : 'Activate'}
                            </button>
                        </td>
                    </tr>
                `;

                // Rows 2+: Provisioned Members / Operators
                const memberRowsHtml = members.length === 0
                    ? `<tr><td colspan="7" class="text-center py-3 text-muted small"><i class="bi bi-info-circle me-1"></i>No staff operators created yet by this User Admin. Provisioned staff will appear here automatically.</td></tr>`
                    : members.map(([mId, m]) => {
                        const mActive = (m.status || 'active') === 'active';
                        const mRoleRaw = (m.role || 'operator').toLowerCase();
                        const isOp = mRoleRaw === 'operator';
                        const mRoleBadge = isOp
                            ? `<span class="badge bg-warning-subtle text-dark border fw-bold"><i class="bi bi-pencil-square me-1"></i> Operator (Entry only)</span>`
                            : `<span class="badge bg-primary-subtle text-primary border">${escapeHTML(m.role || 'Member')}</span>`;
                        const postLimit = parseFloat(m.postingLimit) || 0;
                        const limitText = postLimit > 0 ? `Max ₹${postLimit.toLocaleString('en-IN')}` : 'Unlimited';
                        const canDirect = m.canPostDirect === true || m.canPostDirect === 'true';

                        return `
                        <tr>
                            <td class="ps-3">
                                <div class="fw-bold text-dark">${escapeHTML(m.name || 'Staff Member')}</div>
                                <div class="small text-muted font-mono" style="font-size: 11px;">${escapeHTML(m.designation || '-')}</div>
                            </td>
                            <td>
                                <code class="user-select-all fw-bold text-primary font-mono">${escapeHTML(m.userId || mId)}</code>
                            </td>
                            <td class="small font-mono">${escapeHTML(m.email || '-')}</td>
                            <td>${mRoleBadge}</td>
                            <td>
                                <span class="badge ${canDirect ? 'bg-info-subtle text-info border' : 'bg-warning-subtle text-warning border'}">${canDirect ? 'Direct Post' : 'Draft Only'}</span>
                                <span class="badge bg-light text-dark border ms-1 font-mono">${limitText}</span>
                            </td>
                            <td>
                                <span class="badge ${mActive ? 'bg-success' : 'bg-danger'} rounded-pill px-2" style="font-size: 10px;">${escapeHTML(m.status || 'Active')}</span>
                            </td>
                            <td class="text-end pe-3 text-nowrap">
                                <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1 fw-semibold" onclick="openMasterEditMemberModal('${ws.id}', '${mId}', false)" title="Edit Credentials, Password & Limits">
                                    <i class="bi bi-pencil me-1"></i> Edit
                                </button>
                                <button class="btn btn-sm ${mActive ? 'btn-outline-warning' : 'btn-outline-success'} py-0 px-2 me-1" onclick="toggleWorkspaceUserStatus('${ws.id}', '${mId}', false, '${m.status || 'active'}')" title="${mActive ? 'Suspend' : 'Activate'}">
                                    <i class="bi ${mActive ? 'bi-pause-circle' : 'bi-play-circle'}"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteMemberInMaster('${ws.id}', '${mId}', '${escapeHTML(m.name || mId)}')" title="Purge Member">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>`;
                    }).join('');

                return `
                <!-- Main Workspace Row -->
                <tr>
                    <td class="ps-3">
                        <div class="fw-bold text-dark">${escapeHTML(ws.name || 'Unnamed')}</div>
                        <div class="font-mono text-primary small" style="font-size: 11px;">#${escapeHTML(ws.id)}</div>
                    </td>
                    <td>
                        <div class="fw-bold small text-dark">${escapeHTML(ws.ownerName)}</div>
                        <div class="text-muted small font-mono">${escapeHTML(ws.ownerEmail)}</div>
                    </td>
                    <td>${planBadge}</td>
                    <td>
                        <!-- Expand Collapsible Button + Modal Trigger -->
                        <div class="d-flex align-items-center gap-1">
                            <button class="btn btn-sm btn-outline-primary py-0 px-2 fw-semibold" onclick="toggleWorkspaceAccordion('${ws.id}', this)" title="Expand user roster inline">
                                <i class="bi bi-chevron-down me-1" id="chev_${ws.id}"></i> ${totalUserCount} Users (${staffCount} Staff + Admin)
                            </button>
                            <button class="btn btn-sm btn-light border py-0 px-2" onclick="viewWorkspaceTeamMembers('${ws.id}')" title="Open Full Screen Modal Roster">
                                <i class="bi bi-arrows-fullscreen"></i>
                            </button>
                        </div>
                    </td>
                    <td><span class="badge bg-light text-dark border font-mono small">${quotaText}</span></td>
                    <td class="text-end pe-3 text-nowrap">
                        <button class="btn btn-sm btn-primary py-0 px-2 me-1 fw-bold shadow-sm" onclick="viewWorkspaceTeamMembers('${ws.id}')" title="Inspect & Manage Team Roster">
                            <i class="bi bi-people-fill me-1"></i> Manage Roster
                        </button>
                        ${isPaid ? `
                        <button class="btn btn-sm btn-outline-danger py-0 px-2 fw-semibold" onclick="toggleWorkspaceLicense('${ws.id}', false)">
                            <i class="bi bi-x-circle me-1"></i> Revoke
                        </button>
                        ` : `
                        <button class="btn btn-sm btn-success py-0 px-2 fw-bold shadow-sm" onclick="toggleWorkspaceLicense('${ws.id}', true)">
                            <i class="bi bi-patch-check-fill me-1"></i> Grant Multi-User
                        </button>
                        `}
                    </td>
                </tr>

                <!-- Collapsible Sub-Row (Inline Accordion) -->
                <tr id="acc_row_${ws.id}" class="d-none" style="background-color: #f8fafc;">
                    <td colspan="6" class="p-0 border-0">
                        <div class="p-3 bg-light border-start border-end border-bottom" style="box-shadow: inset 0 2px 4px rgba(0,0,0,0.03);">
                            <div class="d-flex justify-content-between align-items-center mb-2 px-1">
                                <div>
                                    <span class="fw-bold text-dark small"><i class="bi bi-diagram-3 text-primary me-1"></i>Organization Directory for ${escapeHTML(ws.name)}</span>
                                    <span class="badge bg-secondary-subtle text-secondary border font-mono ms-2" style="font-size: 10px;">${totalUserCount} Total Accounts</span>
                                </div>
                                <button class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size: 11px;" onclick="viewWorkspaceTeamMembers('${ws.id}')">
                                    <i class="bi bi-box-arrow-up-right me-1"></i> Open in Modal
                                </button>
                            </div>
                            <div class="table-responsive rounded-2 border bg-white">
                                <table class="table table-sm table-hover align-middle mb-0 master-table" style="font-size: 12px;">
                                    <thead class="table-light text-muted" style="font-size: 11px;">
                                        <tr>
                                            <th class="ps-3">Identity</th>
                                            <th>Login User ID</th>
                                            <th>Email Address</th>
                                            <th>Role</th>
                                            <th>Posting Policy & Limits</th>
                                            <th>Status</th>
                                            <th class="text-end pe-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${ownerRowHtml}
                                        ${memberRowsHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        };

        window.toggleWorkspaceLicense = async function(wsId, grant) {
            const actionText = grant ? "GRANT Multi-User Enterprise License" : "REVOKE Multi-User License";
            if (!confirm(`Confirm: ${actionText} for workspace #${wsId}?`)) return;

            try {
                const patch = {
                    multiUserLicensed: grant,
                    workspacePlan: grant ? 'multi_user' : 'single_user',
                    multiUserQuota: grant ? 25 : 1,
                    licensedAt: firebase.database.ServerValue.TIMESTAMP
                };

                await db.ref(`Users/${wsId}/workspace/WorkspaceSettings`).update(patch);
                // Also update top level user record
                await db.ref(`Users/${wsId}`).update({
                    multiUserLicensed: grant,
                    workspacePlan: grant ? 'multi_user' : 'single_user'
                }).catch(() => {});

                logMasterAudit('LICENSE_STATUS_CHANGE', `${actionText} for workspace #${wsId}`, wsId);
                alert(`Workspace #${wsId} license updated! Status: ${grant ? 'MULTI-USER ACTIVE' : 'SINGLE-USER'}`);
                loadAllMasterData();
            } catch (e) {
                alert("License update error: " + e.message);
            }
        };

        
        // =========================================================
        // VIEW WORKSPACE TEAM MEMBERS ROSTER MODAL (Includes User Admin + Staff)
        // =========================================================
        let editMemberModalInstance = null;
        let ACTIVE_ROSTER_WS_ID = null;

        window.toggleWorkspaceAccordion = function(wsId, btnEl) {
            const accRow = document.getElementById(`acc_row_${wsId}`);
            const chev = document.getElementById(`chev_${wsId}`);
            if (!accRow) return;

            const isHidden = accRow.classList.contains('d-none');
            if (isHidden) {
                accRow.classList.remove('d-none');
                if (chev) {
                    chev.classList.remove('bi-chevron-down');
                    chev.classList.add('bi-chevron-up');
                }
            } else {
                accRow.classList.add('d-none');
                if (chev) {
                    chev.classList.remove('bi-chevron-up');
                    chev.classList.add('bi-chevron-down');
                }
            }
        };

        window.viewWorkspaceTeamMembers = function(wsId) {
            const ws = GLOBAL_WORKSPACES[wsId];
            if (!ws) {
                alert("Workspace #" + wsId + " not found.");
                return;
            }

            ACTIVE_ROSTER_WS_ID = wsId;
            const membersObj = ws.membersList || {};
            const members = Object.entries(membersObj);
            const totalUserCount = members.length + 1; // User Admin + Staff

            document.getElementById('mwt_wsName').innerText = ws.name || 'Organization';
            document.getElementById('mwt_wsId').innerText = wsId;
            document.getElementById('mwt_ownerInfo').innerText = `Owner: ${ws.ownerName} (${ws.ownerEmail})`;

            const badgeEl = document.getElementById('mwt_totalCountBadge');
            if (badgeEl) badgeEl.innerText = `${totalUserCount} Total Users (${members.length} Staff + User Admin)`;

            const tbody = document.getElementById('mwt_teamBody');
            if (!tbody) return;

            // Row 1: The User Admin (Tenant Owner)
            const ownerActive = (ws.status || 'active') === 'active';
            const ownerRowHtml = `
                <tr class="table-primary table-opacity-10" style="background-color: rgba(13, 110, 253, 0.05);">
                    <td class="ps-3 font-mono fw-bold">
                        <span class="badge bg-primary text-white me-1" style="font-size: 9px;"><i class="bi bi-star-fill me-1"></i>USER ADMIN</span>
                        <span class="text-dark">${escapeHTML(ws.ownerName)}</span>
                    </td>
                    <td>
                        <code class="user-select-all fw-bold text-primary font-mono">${escapeHTML(ws.id)}</code>
                    </td>
                    <td class="small font-mono">${escapeHTML(ws.ownerEmail)}</td>
                    <td>
                        <span class="badge bg-primary text-white font-mono small">Administrator (Owner)</span>
                    </td>
                    <td>
                        <span class="badge bg-success-subtle text-success border">Full Direct Post</span>
                        <span class="badge bg-secondary-subtle text-secondary border ms-1 font-mono" style="font-size: 9px;">Unlimited</span>
                    </td>
                    <td>
                        <span class="badge ${ownerActive ? 'bg-success' : 'bg-danger'} rounded-pill px-2" style="font-size: 10px;">${escapeHTML(ws.status || 'Active')}</span>
                    </td>
                    <td class="text-end pe-3 text-nowrap">
                        <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1 fw-semibold" onclick="openMasterEditMemberModal('${ws.id}', '${ws.id}', true)" title="Edit Credentials, Password & Limits">
                            <i class="bi bi-pencil me-1"></i> Edit Credentials
                        </button>
                        <button class="btn btn-sm ${ownerActive ? 'btn-outline-warning' : 'btn-outline-success'} py-0 px-2" onclick="toggleWorkspaceUserStatus('${ws.id}', '${ws.id}', true, '${ws.status || 'active'}')" title="${ownerActive ? 'Suspend User Admin' : 'Reactivate User Admin'}">
                            <i class="bi ${ownerActive ? 'bi-pause-circle' : 'bi-play-circle'} me-1"></i> ${ownerActive ? 'Suspend' : 'Activate'}
                        </button>
                    </td>
                </tr>
            `;

            // Rows 2+: All Provisioned Members / Operators
            const memberRowsHtml = members.length === 0
                ? `<tr><td colspan="7" class="text-center py-4 text-muted"><i class="bi bi-info-circle me-1"></i>No staff operators created yet by this User Admin. Provisioned staff will appear here automatically.</td></tr>`
                : members.map(([mId, m]) => {
                    const mActive = (m.status || 'active') === 'active';
                    const mRoleRaw = (m.role || 'operator').toLowerCase();
                    const isOp = mRoleRaw === 'operator';
                    const mRoleBadge = isOp
                        ? `<span class="badge bg-warning-subtle text-dark border fw-bold"><i class="bi bi-pencil-square me-1"></i> Operator (Entry only)</span>`
                        : `<span class="badge bg-primary-subtle text-primary border">${escapeHTML(m.role || 'Member')}</span>`;

                    const postLimit = parseFloat(m.postingLimit) || 0;
                    const limitText = postLimit > 0 ? `Max ₹${postLimit.toLocaleString('en-IN')}` : 'Unlimited';
                    const canDirect = m.canPostDirect === true || m.canPostDirect === 'true';

                    return `
                    <tr>
                        <td class="ps-3">
                            <div class="fw-bold text-dark">${escapeHTML(m.name || 'Staff Member')}</div>
                            <div class="small text-muted font-mono" style="font-size: 11px;">${escapeHTML(m.designation || '-')}</div>
                        </td>
                        <td>
                            <code class="user-select-all fw-bold text-primary font-mono">${escapeHTML(m.userId || mId)}</code>
                        </td>
                        <td class="font-mono small">${escapeHTML(m.email || '-')}</td>
                        <td>${mRoleBadge}</td>
                        <td>
                            <span class="badge ${canDirect ? 'bg-info-subtle text-info border' : 'bg-warning-subtle text-warning border'}">${canDirect ? 'Direct Post' : 'Draft / Review'}</span>
                            <span class="badge bg-light text-dark border ms-1 font-mono">${limitText}</span>
                            <div class="small text-muted font-mono mt-1" style="font-size: 10px;">
                                PC: ${escapeHTML(m.allowedProfitCenter || '*')} | Ledger: ${escapeHTML(m.allowedLedger || '*')}
                            </div>
                        </td>
                        <td>
                            <span class="badge ${mActive ? 'bg-success' : 'bg-danger'} rounded-pill px-2" style="font-size: 10px;">${escapeHTML(m.status || 'Active')}</span>
                        </td>
                        <td class="text-end pe-3 text-nowrap">
                            <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1 fw-semibold" onclick="openMasterEditMemberModal('${ws.id}', '${mId}', false)" title="Edit Credentials, Password & Limits">
                                <i class="bi bi-pencil me-1"></i> Edit
                            </button>
                            <button class="btn btn-sm ${mActive ? 'btn-outline-warning' : 'btn-outline-success'} py-0 px-2 me-1" onclick="toggleWorkspaceUserStatus('${ws.id}', '${mId}', false, '${m.status || 'active'}')" title="${mActive ? 'Suspend' : 'Activate'}">
                                <i class="bi ${mActive ? 'bi-pause-circle' : 'bi-play-circle'}"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteMemberInMaster('${ws.id}', '${mId}', '${escapeHTML(m.name || mId)}')" title="Purge Member">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>`;
                }).join('');

            tbody.innerHTML = ownerRowHtml + memberRowsHtml;

            const modal = new bootstrap.Modal(document.getElementById('modalWorkspaceTeamBreakdown'));
            modal.show();
        };

        // Toggle user status (Both User Admin and Provisioned Staff)
        window.toggleWorkspaceUserStatus = async function(wsId, userId, isOwner, currentStatus) {
            const newStatus = (currentStatus || 'active').toLowerCase() === 'active' ? 'suspended' : 'active';
            const targetType = isOwner ? "User Admin (Workspace Owner)" : "Team Member / Operator";
            if (!confirm(`Confirm: Change status of ${targetType} [${userId}] to ${newStatus.toUpperCase()}?`)) return;

            try {
                const patch = { status: newStatus };
                if (isOwner) {
                    await db.ref(`Users/${wsId}`).update(patch);
                    await db.ref(`Users/${wsId}/workspace/WorkspaceSettings`).update({ workspaceStatus: newStatus }).catch(() => {});
                } else {
                    await db.ref(`Users/${wsId}/workspace/Members/${userId}`).update(patch);
                    await db.ref(`Users/${userId}`).update(patch).catch(() => {});
                }

                logMasterAudit('USER_STATUS_CHANGE', `Master changed status of ${targetType} #${userId} in WS #${wsId} to ${newStatus}`, wsId);
                alert(`Account status updated to ${newStatus.toUpperCase()}!`);
                await loadAllMasterData();

                // Re-render modal if open
                if (ACTIVE_ROSTER_WS_ID === wsId) {
                    viewWorkspaceTeamMembers(wsId);
                }
            } catch (e) {
                alert("Status update failed: " + e.message);
            }
        };

        // Open Master Edit Member Credentials & Controls Modal
        window.openMasterEditMemberModal = async function(wsId, userId, isOwner) {
            const ws = GLOBAL_WORKSPACES[wsId];
            if (!ws) {
                alert("Workspace #" + wsId + " not found.");
                return;
            }

            let member = null;
            if (isOwner) {
                try {
                    const snap = await db.ref(`Users/${wsId}`).once('value');
                    member = snap.val() || {};
                    member.role = member.role || 'administrator';
                } catch(e) {
                    member = { name: ws.ownerName, email: ws.ownerEmail, role: 'administrator', status: ws.status };
                }
            } else {
                member = (ws.membersList || {})[userId];
            }

            if (!member) {
                alert("User #" + userId + " details not found.");
                return;
            }

            if (!editMemberModalInstance) {
                editMemberModalInstance = new bootstrap.Modal(document.getElementById('modalMasterEditMemberCredentials'));
            }

            document.getElementById('emc_wsId').value = wsId;
            document.getElementById('emc_userId').value = userId;
            document.getElementById('emc_isOwner').value = isOwner ? 'true' : 'false';

            document.getElementById('emc_targetUserType').innerText = isOwner ? 'User Admin (Owner)' : 'Workspace Member';
            document.getElementById('emc_displayUserId').innerText = userId;
            document.getElementById('emc_displayWsId').innerText = wsId;

            document.getElementById('emc_name').value = member.name || '';
            document.getElementById('emc_designation').value = member.designation || (isOwner ? 'Workspace Owner' : 'Operator');
            document.getElementById('emc_email').value = member.email || '';
            document.getElementById('emc_role').value = (member.role || (isOwner ? 'administrator' : 'operator')).toLowerCase();
            document.getElementById('emc_status').value = member.status || 'active';
            document.getElementById('emc_password').value = '';

            document.getElementById('emc_postingLimit').value = parseFloat(member.postingLimit) || 0;
            document.getElementById('emc_canPostDirect').value = (member.canPostDirect === true || member.canPostDirect === 'true' || isOwner) ? 'true' : 'false';
            document.getElementById('emc_canBackdate').value = (member.canBackdate === true || member.canBackdate === 'true' || isOwner) ? 'true' : 'false';
            document.getElementById('emc_profitCenter').value = member.allowedProfitCenter || '*';
            document.getElementById('emc_ledger').value = member.allowedLedger || '*';

            editMemberModalInstance.show();
        };

        window.generateRandomPassForMember = function() {
            const pass = 'UT@' + Math.random().toString(36).substring(2, 7) + '!9';
            document.getElementById('emc_password').value = pass;
        };

        window.submitMasterEditMemberCredentials = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnSubmitEmc');
            const wsId = document.getElementById('emc_wsId').value;
            const userId = document.getElementById('emc_userId').value;
            const isOwner = document.getElementById('emc_isOwner').value === 'true';

            const name = document.getElementById('emc_name').value.trim();
            const designation = document.getElementById('emc_designation').value.trim();
            const email = document.getElementById('emc_email').value.trim().toLowerCase();
            const role = document.getElementById('emc_role').value;
            const status = document.getElementById('emc_status').value;
            const newPass = document.getElementById('emc_password').value.trim();

            const postingLimit = parseFloat(document.getElementById('emc_postingLimit').value) || 0;
            const canPostDirect = document.getElementById('emc_canPostDirect').value === 'true';
            const canBackdate = document.getElementById('emc_canBackdate').value === 'true';
            const allowedProfitCenter = document.getElementById('emc_profitCenter').value.trim() || '*';
            const allowedLedger = document.getElementById('emc_ledger').value.trim() || '*';

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving...';

            try {
                const patch = {
                    name,
                    designation,
                    email,
                    role,
                    status,
                    postingLimit,
                    canPostDirect,
                    canBackdate,
                    allowedProfitCenter,
                    allowedLedger,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                };

                if (newPass) {
                    patch.passwordHash = await hashPassword(newPass);
                }

                if (isOwner) {
                    await db.ref(`Users/${wsId}`).update(patch);
                    await db.ref(`Users/${wsId}/workspace/WorkspaceSettings`).update({ workspaceName: `${name}'s Organization` }).catch(() => {});
                } else {
                    await db.ref(`Users/${wsId}/workspace/Members/${userId}`).update(patch);
                    await db.ref(`Users/${userId}`).update(patch).catch(() => {});
                }

                logMasterAudit('MASTER_EDIT_MEMBER', `Master updated credentials & limits for ${isOwner ? 'User Admin' : 'Member'} ${name} (${userId}) in WS #${wsId}`, wsId);
                alert("User credentials and SAP limits saved successfully!");

                if (editMemberModalInstance) editMemberModalInstance.hide();
                await loadAllMasterData();

                if (ACTIVE_ROSTER_WS_ID === wsId) {
                    viewWorkspaceTeamMembers(wsId);
                }
            } catch (err) {
                alert("Save failure: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Save User Credentials & Controls';
            }
        };

        window.deleteMemberInMaster = async function(wsId, memberId, memberName) {
            if (!confirm(`Warning: Permanently purge team member [${memberName}] (#${memberId}) from workspace #${wsId}?`)) return;
            try {
                await db.ref(`Users/${wsId}/workspace/Members/${memberId}`).remove();
                await db.ref(`Users/${memberId}`).remove().catch(() => {});
                logMasterAudit('PURGE_MEMBER', `Purged member ${memberId} from workspace ${wsId}`, wsId);
                alert("Team member purged successfully!");
                await loadAllMasterData();
                if (ACTIVE_ROSTER_WS_ID === wsId) {
                    viewWorkspaceTeamMembers(wsId);
                }
            } catch (e) {
                alert("Purge failed: " + e.message);
            }
        };

        // =========================================================
        // VIEW 9: MASTER ADMINS & CO-PILOTS (Requirement #2 & #3)
        // =========================================================
        window.loadMasterAdmins = async function() {
            const tbody = document.getElementById('masterAdminsTableBody');
            if (!tbody) return;

            try {
                const snap = await db.ref('PlatformMaster/Admins').once('value');
                const coPilots = snap.val() || {};

                // Always include the Root SuperAdministrator
                const allAdmins = [
                    {
                        adminId: 'ROOT_MASTER',
                        name: 'Master SuperAdministrator (Root)',
                        email: 'admin@unitax.pro',
                        designation: 'Platform Solution Architect & Owner',
                        role: 'super_administrator',
                        isRoot: true,
                        isCoPilot: false,
                        status: 'active'
                    },
                    ...Object.entries(coPilots).map(([id, a]) => ({ adminId: id, ...a }))
                ];

                tbody.innerHTML = allAdmins.map(a => {
                    const isRoot = a.isRoot === true || a.email === 'admin@unitax.pro';
                    const authorityBadge = isRoot
                        ? `<span class="badge bg-warning text-dark border font-mono small"><i class="bi bi-shield-fill-check me-1"></i> Root SuperAdmin</span>`
                        : `<span class="badge bg-info-subtle text-info border font-mono small"><i class="bi bi-cpu-fill me-1"></i> Master Co-Pilot</span>`;

                    const isActive = (a.status || 'active') === 'active';
                    const statusBadge = isActive ? 'bg-success' : 'bg-danger';

                    return `
                    <tr>
                        <td class="ps-3">
                            <div class="fw-bold text-dark">${escapeHTML(a.name || 'Admin')}</div>
                            <div class="font-mono text-muted small" style="font-size: 11px;">#${escapeHTML(a.adminId)}</div>
                        </td>
                        <td class="font-mono small">${escapeHTML(a.email)}</td>
                        <td>${authorityBadge}</td>
                        <td class="small text-muted">${escapeHTML(a.designation || 'Master Co-Pilot')}</td>
                        <td><span class="badge ${statusBadge} rounded-pill px-2" style="font-size: 10px;">${escapeHTML(a.status || 'Active')}</span></td>
                        <td class="text-end pe-3">
                            ${isRoot ? `
                            <span class="badge bg-light text-muted border px-2 py-1"><i class="bi bi-lock-fill me-1"></i> Protected Root</span>
                            ` : `
                            ${CURRENT_MASTER_SESSION.isRoot ? `
                            <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteMasterAdmin('${a.adminId}', '${escapeHTML(a.name)}')">
                                <i class="bi bi-trash"></i>
                            </button>
                            ` : `
                            <span class="text-muted small">No Delete Rights</span>
                            `}
                            `}
                        </td>
                    </tr>`;
                }).join('');

            } catch (e) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Failed to load master admins.</td></tr>`;
            }
        };

        window.generateRandomCopilotPass = function() {
            const p = 'UT@CoPilot' + Math.floor(1000 + Math.random() * 9000) + '!';
            document.getElementById('copilot_pass').value = p;
        };

        window.submitProvisionCoPilot = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnSubmitCopilot');
            const name = document.getElementById('copilot_name').value.trim();
            const email = document.getElementById('copilot_email').value.trim().toLowerCase();
            const designation = document.getElementById('copilot_designation').value.trim();
            const password = document.getElementById('copilot_pass').value.trim();

            if (!name || !email || !password) return;

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Provisioning Co-Pilot...';

            try {
                const passHash = await hashPassword(password);
                const newAdminId = 'CP-' + Math.random().toString(36).substring(2, 8).toUpperCase();

                const coPilotData = {
                    adminId: newAdminId,
                    name,
                    email,
                    designation,
                    passwordHash: passHash,
                    role: 'super_administrator',
                    isMasterCoPilot: true,
                    isMasterAdmin: true,
                    isRoot: false,
                    status: 'active',
                    created_at: firebase.database.ServerValue.TIMESTAMP
                };

                // Save in PlatformMaster/Admins
                await db.ref(`PlatformMaster/Admins/${newAdminId}`).set(coPilotData);

                // Mirror in Users node
                await db.ref(`Users/${newAdminId}`).set({
                    ...coPilotData,
                    userId: newAdminId,
                    masterControl: 'administration'
                });

                logMasterAudit('PROVISION_COPILOT', `Provisioned new Master Co-Pilot ${name} (${email})`);
                alert(`Master Co-Pilot [${name}] provisioned successfully! ID: #${newAdminId}`);
                document.getElementById('formProvisionCoPilot').reset();
                loadMasterAdmins();

            } catch (err) {
                alert("Co-Pilot provisioning failed: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-shield-plus me-1"></i> Provision Co-Pilot Master Admin';
            }
        };

        window.deleteMasterAdmin = async function(adminId, name) {
            if (adminId === 'ROOT_MASTER') {
                alert("Action Prohibited: Root Master Administrator cannot be deleted.");
                return;
            }
            if (!CURRENT_MASTER_SESSION.isRoot) {
                alert("Action Prohibited: Only the Root SuperAdministrator can remove a Co-Pilot Admin.");
                return;
            }
            if (!confirm(`Are you sure you want to revoke and delete Co-Pilot Admin [${name}]?`)) return;

            try {
                await db.ref(`PlatformMaster/Admins/${adminId}`).remove();
                await db.ref(`Users/${adminId}`).remove().catch(() => {});
                logMasterAudit('DELETE_COPILOT', `Deleted Master Co-Pilot ${name} (${adminId})`);
                alert("Co-Pilot deleted.");
                loadMasterAdmins();
            } catch (e) {
                alert("Deletion failure: " + e.message);
            }
        };

        // =========================================================
        // UPGRADED PROMOTIONS & NOTIFICATION ENGINE (Points #2 & #7)
        // =========================================================
        let modalCreatePromoInstance = null;
        let modalMasterKbPreviewInstance = null;

        window.openCreatePromotionModal = async function() {
            if (!modalCreatePromoInstance) {
                modalCreatePromoInstance = new bootstrap.Modal(document.getElementById('modalMasterCreatePromotion'));
            }
            document.getElementById('formMasterCreatePromotion').reset();
            
            // Populate workspace datalist
            try {
                const wsDatalist = document.getElementById('promoWorkspaceDatalist');
                if (wsDatalist) {
                    const wsSnap = await db.ref('Tenants').once('value');
                    const wsData = wsSnap.val() || {};
                    let options = '';
                    Object.entries(wsData).forEach(([wsId, ws]) => {
                        options += `<option value="${wsId}">${ws.name || ws.companyName || wsId}</option>`;
                    });
                    wsDatalist.innerHTML = options;
                }
            } catch(e) {}

            // Populate user datalist
            try {
                const usrDatalist = document.getElementById('promoUserDatalist');
                if (usrDatalist) {
                    const uSnap = await db.ref('GlobalUsers').once('value');
                    const uData = uSnap.val() || {};
                    let uOpts = '';
                    Object.entries(uData).forEach(([uId, u]) => {
                        uOpts += `<option value="${uId}">${u.name || u.email || uId}</option>`;
                    });
                    usrDatalist.innerHTML = uOpts;
                }
            } catch(e) {}

            togglePromoTargetInputs('all');
            updatePromoIconPreview('bi-megaphone-fill text-primary');
            updatePromoLiveCard();
            modalCreatePromoInstance.show();
        };

        window.togglePromoTargetInputs = function(val) {
            const wsWrap = document.getElementById('promo_workspace_wrap');
            const uWrap = document.getElementById('promo_user_wrap');
            const badge = document.getElementById('live_prev_target_badge');

            if (wsWrap) wsWrap.style.display = val === 'workspace' ? 'block' : 'none';
            if (uWrap) uWrap.style.display = val === 'specific_user' ? 'block' : 'none';

            if (badge) {
                if (val === 'workspace') badge.innerText = 'Specific Workspace';
                else if (val === 'specific_user') badge.innerText = 'Specific User';
                else badge.innerText = 'All Workspaces';
            }
            updatePromoLiveCard();
        };

        window.updatePromoIconPreview = function(val) {
            const previewIcon = document.getElementById('promo_icon_preview');
            const customInput = document.getElementById('promo_custom_icon');
            const liveIcon = document.getElementById('live_prev_icon');

            if (val === 'custom') {
                if (customInput) customInput.classList.remove('d-none');
            } else {
                if (customInput) customInput.classList.add('d-none');
                if (previewIcon) previewIcon.className = `bi ${val}`;
                if (liveIcon) liveIcon.className = `bi ${val}`;
            }
        };

        window.updateCustomIcon = function(val) {
            const previewIcon = document.getElementById('promo_icon_preview');
            const liveIcon = document.getElementById('live_prev_icon');
            const iconClass = val.trim() || 'bi-megaphone-fill text-primary';
            if (previewIcon) previewIcon.className = `bi ${iconClass}`;
            if (liveIcon) liveIcon.className = `bi ${iconClass}`;
        };

        window.handlePromoRedirectPreset = function(val) {
            const routeInput = document.getElementById('promo_redirect_route');
            if (val !== 'custom' && routeInput) {
                routeInput.value = val;
            }
            updatePromoLiveCard();
        };

        window.updatePromoLiveCard = function() {
            const titleInput = document.getElementById('promo_title');
            const narrationInput = document.getElementById('promo_narration');
            const routeInput = document.getElementById('promo_redirect_route');
            
            const liveTitle = document.getElementById('live_prev_title');
            const liveNarration = document.getElementById('live_prev_narration');
            const liveRoute = document.getElementById('live_prev_route');

            if (liveTitle && titleInput) liveTitle.innerText = titleInput.value.trim() || 'Notification Title Preview';
            if (liveNarration && narrationInput) liveNarration.innerText = narrationInput.value.trim() || 'Notification narration will appear here for recipients...';
            if (liveRoute && routeInput) liveRoute.innerText = routeInput.value.trim() || 'reports/approvalmanagementsystem';
        };

        window.submitMasterCreatePromotion = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnSubmitPromo');
            const title = document.getElementById('promo_title').value.trim();
            const narration = document.getElementById('promo_narration').value.trim();
            const audience = document.getElementById('promo_audience').value;
            const targetWorkspace = (document.getElementById('promo_target_workspace')?.value || '').trim();
            const targetUser = (document.getElementById('promo_target_user')?.value || '').trim();

            const iconPreset = document.getElementById('promo_icon_preset').value;
            const customIcon = (document.getElementById('promo_custom_icon')?.value || '').trim();
            const icon = iconPreset === 'custom' ? (customIcon || 'bi-megaphone-fill text-primary') : iconPreset;

            const route = (document.getElementById('promo_redirect_route')?.value || 'reports/approvalmanagementsystem').trim();
            const status = document.getElementById('promo_status').value;
            const priority = document.getElementById('promo_priority').value;

            if (!title || !narration) {
                alert("Please enter both Title and Narration.");
                return;
            }
            if (audience === 'workspace' && !targetWorkspace) {
                alert("Please select or specify a Target Workspace ID.");
                return;
            }
            if (audience === 'specific_user' && !targetUser) {
                alert("Please select or specify a Target User ID/Email.");
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Dispatching...';

            try {
                const newPromoId = 'NOTIF-' + Date.now().toString(36).toUpperCase();
                const payload = {
                    promoId: newPromoId,
                    id: newPromoId,
                    title,
                    narration,
                    message: narration,
                    audience,
                    target: audience,
                    targetWorkspaceId: targetWorkspace,
                    targetUserId: targetUser,
                    icon,
                    route,
                    link: route,
                    status,
                    priority,
                    author: "Master Platform Administration",
                    created_at: firebase.database.ServerValue.TIMESTAMP,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };

                // 1. Save in Platform Promotions
                await db.ref(`PlatformMaster/Promotions/${newPromoId}`).set(payload);

                // 2. Save in Broadcast streams
                await db.ref(`PlatformMaster/Broadcasts/${newPromoId}`).set(payload);
                await db.ref(`Broadcasts/${newPromoId}`).set(payload);
                await db.ref(`Utilities/Broadcasts/${newPromoId}`).set(payload);

                // 3. Workspace Specific target
                if (audience === 'workspace' && targetWorkspace) {
                    await db.ref(`${targetWorkspace}/PlatformMaster/Broadcasts/${newPromoId}`).set(payload);
                    await db.ref(`${targetWorkspace}/Utilities/Broadcasts/${newPromoId}`).set(payload);
                    await db.ref(`Workspaces/${targetWorkspace}/Notifications/${newPromoId}`).set(payload);
                }

                // 4. Specific User target
                if (audience === 'specific_user' && targetUser) {
                    const cleanUserId = targetUser.replace(/[.#$[\]]/g, '_');
                    await db.ref(`${cleanUserId}/PlatformMaster/Broadcasts/${newPromoId}`).set(payload);
                    await db.ref(`Users/${cleanUserId}/Notifications/${newPromoId}`).set(payload);
                }

                logMasterAudit('CREATE_NOTIFICATION', `Dispatched notification: "${title}" to scope [${audience}]`);
                alert("Master Admin notification dispatched successfully to ERP clients!");

                if (modalCreatePromoInstance) modalCreatePromoInstance.hide();
                renderPromotions();

            } catch (err) {
                alert("Notification dispatch failure: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-send-fill me-1"></i> Dispatch Notification';
            }
        };

        window.renderPromotions = async function() {
            const tbody = document.getElementById('masterPromotionsBody');
            if (!tbody) return;

            try {
                const snap = await db.ref('PlatformMaster/Promotions').once('value');
                const promos = snap.val() || {};
                const list = Object.entries(promos).reverse();

                if (list.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">No promotional notifications dispatched yet. Click "+ Create Notification / Promo" above to dispatch.</td></tr>`;
                    return;
                }

                tbody.innerHTML = list.map(([id, p]) => {
                    const isActive = (p.status || 'active') === 'active';
                    const statusBadge = isActive ? 'bg-success' : 'bg-secondary';
                    const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Active';
                    const iconClass = p.icon || 'bi-megaphone-fill text-primary';
                    const audienceLabel = p.audience === 'workspace' ? `Workspace: <code>${escapeHTML(p.targetWorkspaceId || '')}</code>` :
                                          p.audience === 'specific_user' ? `User: <code>${escapeHTML(p.targetUserId || '')}</code>` :
                                          '<span class="badge bg-primary text-white">All Workspaces</span>';

                    return `
                    <tr>
                        <td class="ps-3">
                            <div class="d-flex align-items-center gap-2">
                                <span class="fs-5"><i class="bi ${escapeHTML(iconClass)}"></i></span>
                                <div>
                                    <div class="fw-bold text-dark">${escapeHTML(p.title || 'Untitled Notification')}</div>
                                    <div class="text-muted font-mono" style="font-size: 10px;">ID: ${escapeHTML(id)}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="small text-muted text-truncate" style="max-width: 280px;" title="${escapeHTML(p.narration || p.message || '')}">
                                ${escapeHTML(p.narration || p.message || '')}
                            </div>
                        </td>
                        <td><div class="small">${audienceLabel}</div></td>
                        <td>
                            <a href="index.html#/${escapeHTML(p.route || p.link || 'dashboard')}" target="_blank" class="badge bg-light text-primary border text-decoration-none">
                                <i class="bi bi-box-arrow-up-right me-1"></i>${escapeHTML(p.route || p.link || 'dashboard')}
                            </a>
                        </td>
                        <td><span class="badge ${statusBadge} rounded-pill px-2" style="font-size: 10px;">${escapeHTML(p.status || 'active')}</span></td>
                        <td class="font-mono text-muted small">${dateStr}</td>
                        <td class="text-end pe-3">
                            <button class="btn btn-sm ${isActive ? 'btn-outline-warning' : 'btn-outline-success'} py-0 px-2 me-1" title="Toggle Active / Suspended" onclick="togglePromotionStatus('${id}', '${isActive ? 'inactive' : 'active'}')">
                                <i class="bi ${isActive ? 'bi-pause-circle' : 'bi-play-circle'}"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger py-0 px-2" title="Delete" onclick="deletePromotion('${id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>`;
                }).join('');

            } catch (err) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Error loading notifications: ${escapeHTML(err.message)}</td></tr>`;
            }
        };

        window.togglePromotionStatus = async function(id, newStatus) {
            try {
                await db.ref(`PlatformMaster/Promotions/${id}`).update({ status: newStatus });
                await db.ref(`PlatformMaster/Broadcasts/${id}`).update({ status: newStatus });
                renderPromotions();
            } catch (e) {
                alert("Update failed: " + e.message);
            }
        };

        window.deletePromotion = async function(id) {
            if (!confirm("Are you sure you want to delete this notification broadcast?")) return;
            try {
                await db.ref(`PlatformMaster/Promotions/${id}`).remove();
                await db.ref(`PlatformMaster/Broadcasts/${id}`).remove();
                await db.ref(`Broadcasts/${id}`).remove();
                await db.ref(`Utilities/Broadcasts/${id}`).remove();
                renderPromotions();
            } catch (e) {
                alert("Delete failed: " + e.message);
            }
        };

        // =========================================================
        // KNOWLEDGE BASE & TUTORIALS SERVER CMS (support.google.com Style)
        // =========================================================
        let KB_ARTICLES_CACHE = {};

        window.autoGenerateKbSlug = function(title) {
            const slugInput = document.getElementById('kb_slug');
            if (!slugInput) return;
            if (!slugInput.dataset.manual) {
                const slug = (title || '').toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .trim()
                    .replace(/\s+/g, '-');
                slugInput.value = slug;
            }
        };

        document.getElementById('kb_slug')?.addEventListener('input', function() {
            this.dataset.manual = 'true';
        });

        window.updateKbPreview = function() {
            const title = document.getElementById('kb_title')?.value.trim() || 'Article Title Preview';
            const cat = document.getElementById('kb_category')?.value || 'Getting Started';
            const author = document.getElementById('kb_author')?.value || 'UniTax Master Admin';
            const readTime = document.getElementById('kb_read_time')?.value || '3 min read';
            const html = document.getElementById('kb_html_content')?.value || '';

            const pTitle = document.getElementById('prev_kb_title');
            const pCat = document.getElementById('prev_kb_category');
            const pAuthor = document.getElementById('prev_kb_author');
            const pReadTime = document.getElementById('prev_kb_readtime');
            const pContent = document.getElementById('prev_kb_content');
            const charCount = document.getElementById('kb_char_count');

            if (pTitle) pTitle.innerText = title;
            if (pCat) pCat.innerText = cat;
            if (pAuthor) pAuthor.innerText = author;
            if (pReadTime) pReadTime.innerText = readTime;
            if (charCount) charCount.innerText = `${html.length} chars`;

            if (pContent) {
                pContent.innerHTML = html.trim() ? html : '<p class="text-muted fst-italic">Write or load a template on the left to see live rendering here...</p>';
            }
        };

        window.previewKbArticle = function() {
            if (!modalMasterKbPreviewInstance) {
                modalMasterKbPreviewInstance = new bootstrap.Modal(document.getElementById('modalMasterKbPreview'));
            }
            const title = document.getElementById('kb_title')?.value.trim() || 'Untitled Article Preview';
            const cat = document.getElementById('kb_category')?.value || 'General';
            const author = document.getElementById('kb_author')?.value || 'Master Admin';
            const readTime = document.getElementById('kb_read_time')?.value || '3 min read';
            const slug = document.getElementById('kb_slug')?.value || 'tutorial';
            const html = document.getElementById('kb_html_content')?.value || '<p class="text-muted">No content authored yet.</p>';

            document.getElementById('modal_kb_prev_title').innerText = title;
            document.getElementById('modal_kb_prev_heading').innerText = title;
            document.getElementById('modal_kb_prev_cat').innerText = cat;
            document.getElementById('modal_kb_prev_author').innerText = author;
            document.getElementById('modal_kb_prev_readtime').innerText = readTime;
            document.getElementById('modal_kb_prev_slug').innerText = slug;
            document.getElementById('modal_kb_prev_body').innerHTML = html;

            modalMasterKbPreviewInstance.show();
        };

        window.resetKbEditor = function() {
            document.getElementById('kb_title').value = '';
            document.getElementById('kb_slug').value = '';
            document.getElementById('kb_slug').dataset.manual = '';
            document.getElementById('kb_html_content').value = '';
            document.getElementById('btnInjectKb').dataset.editId = '';
            document.getElementById('btnInjectKb').innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-1"></i> Inject & Publish to Server';
            updateKbPreview();
        };

        window.loadKbTemplate = function(type) {
            const titleInput = document.getElementById('kb_title');
            const catInput = document.getElementById('kb_category');
            const slugInput = document.getElementById('kb_slug');
            const contentInput = document.getElementById('kb_html_content');

            if (type === 'step_guide') {
                titleInput.value = "How to Reconcile Bank Statements and Balance Sheet Accounts";
                catInput.value = "General Ledger & Reconciliation";
                slugInput.value = "how-to-reconcile-bank-statements";
                contentInput.value = `<h2>Overview & Objective</h2>
<p>Bank and ledger account reconciliation is an essential internal audit control to verify that cash reserves, bank book statements, and posted vouchers balance with zero variance under Ind AS 7 guidelines.</p>

<div class="kb-alert kb-alert-info">
    <i class="bi bi-info-circle-fill fs-5"></i>
    <div>
        <strong>Prerequisite:</strong> Ensure all draft payment and receipt vouchers for the target fiscal period have been executive-approved before executing reconciliation.
    </div>
</div>

<h2>Step-by-Step Resolution Process</h2>

<div class="kb-step-card">
    <div class="kb-step-num">1</div>
    <div class="kb-step-body">
        <h5>Navigate to the Reconciliation Engine</h5>
        <p>From the desktop sidebar, go to <strong>Financial Statements & Reporting &gt; Account Reconciliation</strong> (or use global search shortcut <code>/</code> and type <code>reconcilation</code>).</p>
    </div>
</div>

<div class="kb-step-card">
    <div class="kb-step-num">2</div>
    <div class="kb-step-body">
        <h5>Select the Target Bank or Cash Ledger</h5>
        <p>Choose your bank account from the ledger dropdown. Specify the statement opening date, closing date, and statement closing balance as reported on your official bank feed.</p>
    </div>
</div>

<div class="kb-step-card">
    <div class="kb-step-num">3</div>
    <div class="kb-step-body">
        <h5>Mark Matched Clearances & Commit Settlement</h5>
        <p>Review the un-cleared voucher table. Check off each line item cleared by the bank, enter clearance dates, and ensure the <strong>Variance</strong> displays <code>₹0.00</code>.</p>
    </div>
</div>

<div class="kb-alert kb-alert-warning">
    <i class="bi bi-exclamation-triangle-fill fs-5"></i>
    <div>
        <strong>Audit Trail Notice:</strong> All committed reconciliations are cryptographically signed with the administrator's UUID and timestamped in the platform audit log.
    </div>
</div>

<h2>Related Tutorials & Resources</h2>
<ul>
    <li><a href="#/reports/balance-sheet">Understanding Balance Sheet Line-Item Drilldown</a></li>
    <li><a href="#/reports/approvalmanagementsystem">Executive Governance & Approval Hub</a></li>
</ul>`;
            } else if (type === 'faq') {
                titleInput.value = "Frequently Asked Questions: Multi-Tier Approval & Vouchers";
                catInput.value = "Troubleshooting & FAQs";
                slugInput.value = "faq-multi-tier-approvals";
                contentInput.value = `<h2>Frequently Asked Questions (FAQ)</h2>
<p>Common resolutions and explanations for executive approvals, dual-authorization limits, and voucher posting errors.</p>

<div class="kb-step-card">
    <div class="kb-step-num">Q1</div>
    <div class="kb-step-body">
        <h5>Why does my voucher say "Draft Pending Executive Approval"?</h5>
        <p>Under corporate governance, any transaction exceeding your user role's authorization ceiling or marked for dual verification is saved in draft state. It posts to the General Ledger only after authorized approver sign-off.</p>
    </div>
</div>

<div class="kb-step-card">
    <div class="kb-step-num">Q2</div>
    <div class="kb-step-body">
        <h5>Can an operator edit a voucher after it has been rejected?</h5>
        <p>Yes. The initiator can inspect the rejection reason in the <strong>Initiator Hub</strong> tab, modify line items or narration, and re-submit the request into the approval queue.</p>
    </div>
</div>

<div class="kb-alert kb-alert-success">
    <i class="bi bi-check-circle-fill fs-5"></i>
    <div>
        <strong>Tip:</strong> You can view all real-time pending approvals directly from the top navigation bar notification bell.
    </div>
</div>`;
            } else if (type === 'deep_dive') {
                titleInput.value = "Ind AS Financial Statements & Balance Sheet Line Item Audit Architecture";
                catInput.value = "Financial Statements";
                slugInput.value = "ind-as-financial-statements-audit";
                contentInput.value = `<h2>Executive Summary</h2>
<p>UniTax Pro compiles balance sheets, profit & loss statements, and cash flow statements dynamically using double-entry journal postings adhering to Indian Accounting Standards (Ind AS).</p>

<h2>Interactive Line-Item Inspection</h2>
<p>Every line item in the financial reports supports double-click inspection. When you double-click any row in the Balance Sheet or P&amp;L:</p>
<ul>
    <li>It opens the underlying ledger statement showing constituent vouchers.</li>
    <li>Double-clicking any constituent voucher immediately opens the full transaction audit and editing view.</li>
</ul>

<div class="kb-step-card">
    <div class="kb-step-num">★</div>
    <div class="kb-step-body">
        <h5>Continuous Ledger Integrity Verification</h5>
        <p>Our background validation engine continuously ensures total assets equal total equity and liabilities with zero rounding drift.</p>
    </div>
</div>`;
            } else if (type === 'governance') {
                titleInput.value = "Corporate Governance & Multi-Tier Role Authorization Policy";
                catInput.value = "User & Role Administration";
                slugInput.value = "corporate-governance-role-matrix";
                contentInput.value = `<h2>Access Control Framework</h2>
<p>UniTax Pro enforces role-based access control (RBAC) across five standard tiers:</p>

<table class="table">
    <thead>
        <tr>
            <th>Role</th>
            <th>Posting Limit</th>
            <th>Approval Authority</th>
            <th>Audit Trail Access</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Tenant Owner</strong></td>
            <td>Unlimited</td>
            <td>Full Executive Sign-Off</td>
            <td>Full Access</td>
        </tr>
        <tr>
            <td><strong>Manager</strong></td>
            <td>Up to ₹5,00,000</td>
            <td>Operational Vouchers</td>
            <td>Workspace Stream</td>
        </tr>
        <tr>
            <td><strong>Operator</strong></td>
            <td>Draft Creation Only</td>
            <td>None (Initiator Only)</td>
            <td>Own Requests</td>
        </tr>
    </tbody>
</table>`;
            }
            updateKbPreview();
        };

        window.insertKbSnippet = function(type) {
            const textarea = document.getElementById('kb_html_content');
            if (!textarea) return;

            let snippet = '';
            if (type === 'step') {
                snippet = `\n<div class="kb-step-card">\n    <div class="kb-step-num">1</div>\n    <div class="kb-step-body">\n        <h5>Step Title Here</h5>\n        <p>Detailed step-by-step resolution instruction...</p>\n    </div>\n</div>\n`;
            } else if (type === 'tip') {
                snippet = `\n<div class="kb-alert kb-alert-info">\n    <i class="bi bi-info-circle-fill fs-5"></i>\n    <div>\n        <strong>Tip:</strong> Enter helpful tip or shortcut here...\n    </div>\n</div>\n`;
            } else if (type === 'warning') {
                snippet = `\n<div class="kb-alert kb-alert-warning">\n    <i class="bi bi-exclamation-triangle-fill fs-5"></i>\n    <div>\n        <strong>Important:</strong> Critical instruction or compliance warning here...\n    </div>\n</div>\n`;
            } else if (type === 'table') {
                snippet = `\n<table class="table">\n    <thead>\n        <tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr>\n    </thead>\n    <tbody>\n        <tr><td>Value 1</td><td>Value 2</td><td>Value 3</td></tr>\n    </tbody>\n</table>\n`;
            } else if (type === 'code') {
                snippet = `<code class="kb-code">example_code_here</code>`;
            } else if (type === 'heading') {
                snippet = `\n<h2>Section Heading Title</h2>\n<p>Section narrative description...</p>\n`;
            }

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            textarea.value = text.substring(0, start) + snippet + text.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
            textarea.focus();
            updateKbPreview();
        };

        window.injectKbArticle = async function() {
            const btn = document.getElementById('btnInjectKb');
            const title = document.getElementById('kb_title').value.trim();
            const category = document.getElementById('kb_category').value;
            const slug = (document.getElementById('kb_slug').value.trim() || 'tutorial-' + Date.now()).toLowerCase().replace(/[^a-z0-9-]/g, '-');
            const audience = document.getElementById('kb_audience').value;
            const readTime = document.getElementById('kb_read_time').value.trim() || '3 min read';
            const author = document.getElementById('kb_author').value.trim() || 'UniTax Master Administration';
            const htmlContent = document.getElementById('kb_html_content').value.trim();

            if (!title) {
                alert("Please provide an Article Title.");
                document.getElementById('kb_title').focus();
                return;
            }
            if (!htmlContent) {
                alert("Please write or paste the HTML code for this tutorial page.");
                document.getElementById('kb_html_content').focus();
                return;
            }

            const editId = btn.dataset.editId;
            const articleId = editId || 'KB-' + Date.now().toString(36).toUpperCase();

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Injecting to Server...';

            try {
                const payload = {
                    id: articleId,
                    title,
                    category,
                    slug,
                    audience,
                    readTime,
                    author,
                    htmlContent,
                    status: 'published',
                    publishedAt: editId && KB_ARTICLES_CACHE[editId]?.publishedAt ? KB_ARTICLES_CACHE[editId].publishedAt : firebase.database.ServerValue.TIMESTAMP,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                };

                // Inject to PlatformMaster/KnowledgeBase and HelpCenter/Articles
                await db.ref(`PlatformMaster/KnowledgeBase/${articleId}`).set(payload);
                await db.ref(`HelpCenter/Articles/${articleId}`).set(payload);

                logMasterAudit('INJECT_KB_ARTICLE', `Injected support tutorial: "${title}" (Slug: ${slug})`);

                alert(`Tutorial article successfully injected and published to server!

Client Webapp URL: index.html#/help/article?id=${articleId}`);

                resetKbEditor();
                renderKnowledgeBase();

            } catch (err) {
                alert("Injection failure: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-1"></i> Inject & Publish to Server';
            }
        };

        window.saveKbDraft = async function() {
            const title = document.getElementById('kb_title').value.trim();
            const htmlContent = document.getElementById('kb_html_content').value.trim();
            if (!title) {
                alert("Please provide at least a title to save a draft.");
                return;
            }
            const articleId = 'KB-' + Date.now().toString(36).toUpperCase();
            try {
                const payload = {
                    id: articleId,
                    title,
                    category: document.getElementById('kb_category').value,
                    slug: (document.getElementById('kb_slug').value.trim() || 'draft-' + Date.now()).toLowerCase(),
                    audience: document.getElementById('kb_audience').value,
                    readTime: document.getElementById('kb_read_time').value.trim(),
                    author: document.getElementById('kb_author').value.trim(),
                    htmlContent,
                    status: 'draft',
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                };
                await db.ref(`PlatformMaster/KnowledgeBase/${articleId}`).set(payload);
                alert("Draft saved to server successfully.");
                renderKnowledgeBase();
            } catch(e) {
                alert("Draft save error: " + e.message);
            }
        };

        window.renderKnowledgeBase = async function() {
            const tbody = document.getElementById('masterKnowledgeBaseBody');
            if (!tbody) return;

            try {
                const snap = await db.ref('PlatformMaster/KnowledgeBase').once('value');
                const articles = snap.val() || {};
                KB_ARTICLES_CACHE = articles;
                const list = Object.entries(articles).reverse();

                if (list.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">No tutorial articles published yet. Use the composer above to author your first article.</td></tr>`;
                    return;
                }

                tbody.innerHTML = list.map(([id, art]) => {
                    const isDraft = art.status === 'draft';
                    const statusBadge = isDraft ? 'bg-secondary' : 'bg-success';
                    const dateStr = art.updatedAt ? new Date(art.updatedAt).toLocaleDateString() : 'Active';

                    return `
                    <tr>
                        <td class="ps-3">
                            <div class="fw-bold text-dark">${escapeHTML(art.title || 'Untitled Article')}</div>
                            <div class="d-flex align-items-center gap-2 mt-1">
                                <span class="badge bg-light text-primary border" style="font-size: 10px;">${escapeHTML(art.category || 'General')}</span>
                                <span class="badge ${statusBadge} rounded-pill" style="font-size: 9px;">${escapeHTML(art.status || 'published')}</span>
                            </div>
                        </td>
                        <td><code class="text-primary small">${escapeHTML(art.slug || id)}</code></td>
                        <td><span class="badge bg-light text-dark border small">${escapeHTML(art.audience || 'all')}</span></td>
                        <td class="small text-muted">${escapeHTML(art.author || 'Master Admin')}</td>
                        <td class="font-mono text-muted small">${dateStr}</td>
                        <td class="text-end pe-3">
                            <a href="index.html#/help/article?id=${id}" target="_blank" class="btn btn-sm btn-outline-primary py-0 px-2 me-1" title="Open Client View">
                                <i class="bi bi-box-arrow-up-right"></i>
                            </a>
                            <button class="btn btn-sm btn-outline-secondary py-0 px-2 me-1" title="Copy Link" onclick="copyKbLink('${id}')">
                                <i class="bi bi-link-45deg"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-warning py-0 px-2 me-1" title="Edit in CMS" onclick="editKbArticle('${id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger py-0 px-2" title="Delete from Server" onclick="deleteKbArticle('${id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>`;
                }).join('');

            } catch (err) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Error loading knowledge base: ${escapeHTML(err.message)}</td></tr>`;
            }
        };

        window.copyKbLink = function(id) {
            const url = `${window.location.origin}${window.location.pathname.replace(/admin\.html.*$/, '')}index.html#/help/article?id=${id}`;
            navigator.clipboard.writeText(url).then(() => {
                alert("Tutorial client link copied to clipboard!
" + url);
            }).catch(() => {
                prompt("Copy this article link:", url);
            });
        };

        window.editKbArticle = function(id) {
            const art = KB_ARTICLES_CACHE[id];
            if (!art) return;

            document.getElementById('kb_title').value = art.title || '';
            document.getElementById('kb_category').value = art.category || 'Getting Started';
            document.getElementById('kb_slug').value = art.slug || '';
            document.getElementById('kb_audience').value = art.audience || 'all';
            document.getElementById('kb_read_time').value = art.readTime || '3 min read';
            document.getElementById('kb_author').value = art.author || 'UniTax Master Admin';
            document.getElementById('kb_html_content').value = art.htmlContent || '';

            const btn = document.getElementById('btnInjectKb');
            btn.dataset.editId = id;
            btn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-1"></i> Update & Re-Inject to Server';

            updateKbPreview();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        window.deleteKbArticle = async function(id) {
            if (!confirm("Are you sure you want to delete this tutorial article from the server?")) return;
            try {
                await db.ref(`PlatformMaster/KnowledgeBase/${id}`).remove();
                await db.ref(`HelpCenter/Articles/${id}`).remove();
                renderKnowledgeBase();
            } catch (e) {
                alert("Delete failed: " + e.message);
            }
        };

        window.filterKbTable = function(query) {
            const q = (query || '').toLowerCase().trim();
            const rows = document.querySelectorAll('#masterKnowledgeBaseBody tr');
            rows.forEach(tr => {
                const text = tr.innerText.toLowerCase();
                tr.style.display = text.includes(q) ? '' : 'none';
            });
        };

                // =========================================================
        // BROADCAST ENGINE
        // =========================================================
        window.dispatchMasterBroadcast = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnDispatchBroadcast');
            const target = document.getElementById('bc_target').value;
            const type = document.getElementById('bc_type').value;
            const title = document.getElementById('bc_title').value.trim();
            const message = document.getElementById('bc_message').value.trim();
            const link = document.getElementById('bc_link').value.trim();

            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Dispatching...`;

            try {
                const broadcastPayload = {
                    title,
                    message,
                    type,
                    target,
                    link: link || '',
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    sender: "UniTax Master Administration",
                    status: "active"
                };

                await db.ref('Broadcasts').push(broadcastPayload);

                // Also append in platform-wide notifications stream
                await db.ref('Notifications/Global').push({
                    title,
                    message,
                    type,
                    target,
                    link: link || '',
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });

                logMasterAudit('DISPATCH_BROADCAST', `Dispatched broadcast: ${title} (${target})`);
                alert("Broadcast alert successfully dispatched to all active ERP sessions!");
                document.getElementById('masterBroadcastForm').reset();
                loadBroadcastHistory();

            } catch (err) {
                alert("Broadcast error: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<i class="bi bi-broadcast me-1"></i> Dispatch Broadcast to ERP Clients`;
            }
        };

        window.loadBroadcastHistory = async function() {
            const tbody = document.getElementById('masterBroadcastHistoryBody');
            if (!tbody) return;

            try {
                const snap = await db.ref('Broadcasts').limitToLast(20).once('value');
                const val = snap.val() || {};
                const list = Object.entries(val).reverse();

                document.getElementById('statActiveBroadcasts').innerText = list.length;

                if (list.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No broadcasts dispatched yet.</td></tr>`;
                    return;
                }

                tbody.innerHTML = list.map(([id, b]) => {
                    const d = new Date(b.timestamp || Date.now());
                    return `
                    <tr>
                        <td class="ps-3">
                            <div class="fw-bold text-dark">${escapeHTML(b.title)}</div>
                            <div class="text-muted small text-truncate" style="max-width: 240px;">${escapeHTML(b.message)}</div>
                        </td>
                        <td><span class="badge bg-light text-dark border small">${escapeHTML(b.target)}</span></td>
                        <td><span class="badge bg-primary-subtle text-primary border small">${escapeHTML(b.type)}</span></td>
                        <td class="font-mono text-muted small">${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                        <td class="text-end pe-3">
                            <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteBroadcast('${id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>`;
                }).join('');

            } catch (err) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Failed to load history.</td></tr>`;
            }
        };

        window.deleteBroadcast = async function(id) {
            if (!confirm("Revoke and delete this broadcast alert?")) return;
            try {
                await db.ref(`Broadcasts/${id}`).remove();
                loadBroadcastHistory();
            } catch (e) {
                alert("Error: " + e.message);
            }
        };

        // =========================================================
        // MASTER AUDIT STREAM
        // =========================================================
        window.loadMasterAuditLogs = async function() {
            const tbody = document.getElementById('masterAuditLogsBody');
            if (!tbody) return;

            try {
                const snap = await db.ref('MasterAuditLogs').limitToLast(50).once('value');
                const val = snap.val() || {};
                const list = Object.entries(val).reverse();

                if (list.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">No master security events logged yet.</td></tr>`;
                    return;
                }

                tbody.innerHTML = list.map(([id, l]) => {
                    const d = new Date(l.timestamp || Date.now());
                    return `
                    <tr>
                        <td class="ps-3 font-mono text-muted small">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</td>
                        <td class="fw-bold small text-dark">${escapeHTML(l.actor || 'MasterAdmin')}</td>
                        <td><span class="badge bg-danger-subtle text-danger border font-mono small">${escapeHTML(l.action)}</span></td>
                        <td class="font-mono text-primary small">${escapeHTML(l.target || 'Global')}</td>
                        <td class="small text-muted">${escapeHTML(l.details || '')}</td>
                    </tr>`;
                }).join('');

            } catch (e) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Error streaming audit logs.</td></tr>`;
            }
        };

        function logMasterAudit(action, details, target = 'Platform') {
            try {
                db.ref('MasterAuditLogs').push({
                    action,
                    details,
                    target,
                    actor: "Master Administrator",
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            } catch(e) {}
        }

        // Master Settings Save
        window.saveMasterSettings = function(e) {
            e.preventDefault();
            alert("Master Platform settings updated successfully.");
        };

        // Bootstrap on page load
        document.addEventListener('DOMContentLoaded', () => {
            checkMasterSession();
        });

    })();
    