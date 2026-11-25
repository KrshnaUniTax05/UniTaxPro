/**
 * UniTax Pro - CANONICAL Google Apps Script mail gateway
 * ======================================================
 * Paste ONLY this file into the Apps Script project. The older
 * mail-gateway.gs is deprecated and must not be pasted alongside it.
 *
 * What it does
 *  - Reads the 28 templates from Google Sheet tab "Sheet1".
 *  - Replaces {{tokens}} with escaped dynamic values.
 *  - Sends system / account / security mail with MailApp as "UniTax Pro".
 *  - Sends promotional mail with GmailApp as "UniTax Pro Notifications" and
 *    a List-Unsubscribe header for Gmail's native unsubscribe button.
 *  - Generates and verifies OTP server-side (login, signup, forgot, master 2FA).
 *  - Processes Firebase System/EmailQueue (lifecycle events + admin campaigns).
 *  - Enforces per-send idempotency, attempt limits, a daily quota guard and
 *    structured logs in System/EmailLogs / System/EmailCampaigns.
 *  - Checks expiring licenses daily and queues renewal / expiry notices.
 *
 * Sheet columns:
 *   templateId, category, sender, subject, htmlBody, textBody,
 *   requiredKeys, active, updatedAt, description
 *
 * Script Properties (optional - defaults are already hardcoded):
 *   MAIL_GATEWAY_TOKEN, FIREBASE_SECRET, UNSUB_ONE_CLICK
 *
 * Run once from the editor: installUnitaxTriggers()
 * Deploy: Web app, Execute as Me, Access Anyone.
 */

/* ------------------------------------------------------------------ *
 * 1. CONFIG
 * ------------------------------------------------------------------ */

var HARDCODED_SHEET_ID = '1W_gdvBtS8oeQBvMvboMrq10Xa932O5K6I96o8o5n50E';
var HARDCODED_DB_URL = 'https://unitax-8d2e2-default-rtdb.asia-southeast1.firebasedatabase.app';

var CONFIG = (function () {
  var p = PropertiesService.getScriptProperties();
  return {
    sheetId: HARDCODED_SHEET_ID || p.getProperty('EMAIL_TEMPLATE_SHEET_ID'),
    sheetName: 'Sheet1',
    token: p.getProperty('MAIL_GATEWAY_TOKEN') || '9fdce5adf40993f9ecad643960d1deac6e04289c40c0bf1d',
    appKey: 'unitax-web-v5',
    dbUrl: (p.getProperty('FIREBASE_DB_URL') || HARDCODED_DB_URL).replace(/\/$/, ''),
    dbSecret: p.getProperty('FIREBASE_SECRET') || '',
    appName: 'UniTax Pro',
    supportEmail: 'prounitax@gmail.com',
    loginUrl: 'https://krshnaunitax05.github.io/UniTaxPro/login.html',
    adminUrl: 'https://krshnaunitax05.github.io/UniTaxPro/admin.html',
    transactionalFrom: 'prounitax@gmail.com',
    marketingFrom: 'prounitax@gmail.com',
    otpMinutes: 10,
    maxAttempts: 3,
    dailyCap: 90
  };
})();

var CONTEXT_KEYS = ['ipAddress', 'approxLocation', 'device', 'browser'];
var BREAK_KEYS = ['featureList', 'announcementMessage', 'updateMessage', 'reason',
  'impactMessage', 'actionRequired', 'securitySummary', 'alertMessage', 'updateTitle',
  'messageBody', 'announcementDetails'];

var CONTROL_KEYS = [
  'action', 'mode', 'token', 'appKey', 'templateId', 'to', 'cc', 'bcc', 'replyTo',
  'subjectOverride', 'previewOnly', 'strict', 'vars', 'requestedBy', 'email',
  'purpose', 'name', 'otp', 'ipAddress', 'approxLocation', 'device', 'browser'
];

function diagnoseConfig() {
  Logger.log('Effective sheet ID: [' + CONFIG.sheetId + ']');
  Logger.log('Sheet tab: [' + CONFIG.sheetName + ']');
  Logger.log('Firebase: [' + CONFIG.dbUrl + ']');
  Logger.log('Token configured: ' + !!CONFIG.token);
}

/* ------------------------------------------------------------------ *
 * 2. FIREBASE REST (no secret required because RTDB rules are open;
 *    a database secret is supported if you later lock the rules)
 * ------------------------------------------------------------------ */

function fbUrl(path, params) {
  var parts = [];
  if (CONFIG.dbSecret) parts.push('auth=' + encodeURIComponent(CONFIG.dbSecret));
  if (params) {
    Object.keys(params).forEach(function (k) {
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    });
  }
  return CONFIG.dbUrl + path + '.json' + (parts.length ? '?' + parts.join('&') : '');
}

function fbRequest(method, path, payload, params) {
  var options = {
    method: method,
    contentType: 'application/json',
    muteHttpExceptions: true
  };
  if (payload != null) options.payload = JSON.stringify(payload);
  var res = UrlFetchApp.fetch(fbUrl(path, params), options);
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code < 200 || code >= 300) throw new Error('Firebase ' + code + ': ' + text);
  return text && text !== 'null' ? JSON.parse(text) : null;
}

function fbGet(path, params) { return fbRequest('get', path, null, params); }
function fbPut(path, value) { return fbRequest('put', path, value); }
function fbPatch(path, value) { return fbRequest('patch', path, value); }
function fbPost(path, value) { return fbRequest('post', path, value); }
function fbDelete(path) { return fbRequest('delete', path, null); }

function fireKey(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ''))
    .map(function (b) { return ('0' + ((b & 0xff).toString(16))).slice(-2); })
    .join('');
}

/* ------------------------------------------------------------------ *
 * 3. TEMPLATE STORAGE + RENDERING
 * ------------------------------------------------------------------ */

function getTemplateRows() {
  if (!CONFIG.sheetId) throw new Error('EMAIL_TEMPLATE_SHEET_ID is not configured.');
  var ss = SpreadsheetApp.openById(CONFIG.sheetId);
  var sheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sheet) throw new Error('Sheet tab "' + CONFIG.sheetName + '" was not found.');
  var values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error('Template sheet is empty.');
  var headers = values[0].map(function (h) { return String(h).trim(); });
  return values.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function getTemplate(templateId) {
  var wanted = String(templateId || '').trim();
  if (!wanted) throw new Error('templateId is required.');
  var row = getTemplateRows().find(function (r) {
    return String(r.templateId || '').trim() === wanted &&
      String(r.active == null ? 'TRUE' : r.active).toUpperCase() !== 'FALSE';
  });
  if (!row) throw new Error('Unknown or inactive templateId: ' + wanted);
  return row;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveVars(vars, depth) {
  depth = depth || 0;
  if (depth > 3) return vars;
  var changed = false;
  var out = {};
  Object.keys(vars || {}).forEach(function (k) {
    var v = vars[k];
    if (typeof v === 'string') {
      v = v.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (match, key) {
        if (key !== k && vars[key] != null && vars[key] !== '') {
          changed = true;
          return String(vars[key]);
        }
        return match;
      });
    }
    out[k] = v;
  });
  return changed ? resolveVars(out, depth + 1) : out;
}

function fillTokens(str, vars) {
  return String(str || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (match, key) {
    var value = vars[key];
    if (value == null || value === '') value = 'Not available';
    var safe = escapeHtml(value);
    if (BREAK_KEYS.indexOf(key) !== -1) safe = safe.replace(/\r?\n/g, '<br>');
    return safe;
  });
}

function renderTemplate(templateId, inputVars, strict) {
  var t = getTemplate(templateId);
  var base = {
    appName: CONFIG.appName,
    supportEmail: CONFIG.supportEmail,
    year: new Date().getFullYear(),
    loginUrl: CONFIG.loginUrl,
    adminUrl: CONFIG.adminUrl
  };
  var vars = resolveVars(Object.assign(base, inputVars || {}));
  CONTEXT_KEYS.forEach(function (k) {
    if (vars[k] == null || vars[k] === '') vars[k] = 'Not available';
  });

  if (strict === true || strict === 'true' || strict === '1') {
    var required = String(t.requiredKeys || '').split(',').map(function (s) {
      return s.trim();
    }).filter(Boolean);
    var missing = required.filter(function (k) {
      return vars[k] == null || vars[k] === '' || vars[k] === 'Not available';
    });
    if (missing.length) throw new Error('Missing required dynamic keys: ' + missing.join(', '));
  }

  return {
    templateId: String(t.templateId).trim(),
    sender: String(t.sender || 'transactional'),
    subject: fillTokens(t.subject, vars),
    htmlBody: fillTokens(t.htmlBody, vars),
    textBody: fillTokens(t.textBody, vars)
  };
}

/* ------------------------------------------------------------------ *
 * 4. SENDING
 * ------------------------------------------------------------------ */

function sendViaMailApp(to, subject, body, options) {
  try {
    MailApp.sendEmail(to, subject, body, options);
  } catch (err) {
    var fallback = {};
    Object.keys(options || {}).forEach(function (k) {
      if (k !== 'from') fallback[k] = options[k];
    });
    MailApp.sendEmail(to, subject, body, fallback);
  }
}

function sendViaGmailApp(to, subject, body, options, unsubscribeUrl) {
  var opts = Object.assign({}, options);
  var headersSet = false;
  if (unsubscribeUrl) {
    var headers = { 'List-Unsubscribe': '<' + unsubscribeUrl + '>' };
    if (String(PropertiesService.getScriptProperties().getProperty('UNSUB_ONE_CLICK') || '').toUpperCase() === 'TRUE') {
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    opts.headers = headers;
    headersSet = true;
  }
  try {
    GmailApp.sendEmail(to, subject, body, opts);
    return { transport: 'GmailApp', listUnsubscribe: headersSet };
  } catch (err) {
    delete opts.headers;
    MailApp.sendEmail(to, subject, body, opts);
    return {
      transport: 'MailApp (GmailApp fallback)',
      listUnsubscribe: false,
      error: String(err && err.message ? err.message : err)
    };
  }
}

/** Returns structured send information used for logging/auditing. */
function sendRenderedEmail(rendered, params, vars) {
  var isPromo = rendered.sender === 'marketing';
  var defaultName = isPromo ? 'UniTax Pro Notifications' : 'UniTax Pro';
  var options = {
    htmlBody: rendered.htmlBody,
    name: (vars && vars.senderName) || defaultName,
    replyTo: params.replyTo || (vars && vars.replyTo) || CONFIG.supportEmail
  };
  if (params.cc) options.cc = params.cc;
  if (params.bcc) options.bcc = params.bcc;

  var alias = isPromo ? CONFIG.marketingFrom : CONFIG.transactionalFrom;
  if (alias) options.from = alias;

  var unsubscribeUrl = (vars && vars.unsubscribeUrl) || '';
  var subject = params.subjectOverride || rendered.subject;

  if (isPromo && unsubscribeUrl) {
    return sendViaGmailApp(params.to, subject, rendered.textBody, options, unsubscribeUrl);
  }
  sendViaMailApp(params.to, subject, rendered.textBody, options);
  return {
    transport: 'MailApp',
    listUnsubscribe: false,
    skippedBecause: isPromo ? 'unsubscribeUrl was not supplied' : 'template is not promotional'
  };
}

/* ------------------------------------------------------------------ *
 * 5. SERVER-SIDE OTP
 * ------------------------------------------------------------------ */

function generateOtp() {
  var u = Utilities.getUuid().replace(/-/g, '');
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, u + CONFIG.appKey);
  var digits = '';
  for (var i = 0; i < digest.length && digits.length < 6; i++) {
    var n = ((digest[i] & 0xff) % 10);
    digits += String(n);
  }
  while (digits.length < 6) digits += '0';
  return digits.slice(0, 6);
}

function otpKey(email, purpose) {
  return fireKey(String(purpose || 'login') + '|' + String(email || '').toLowerCase() + '|' + CONFIG.appKey);
}

function otpHash(code, email) {
  return fireKey(String(code) + '|' + String(email || '').toLowerCase());
}

function findUserVars(email) {
  var users = fbGet('/Users') || {};
  var found = null;
  Object.keys(users).forEach(function (id) {
    var u = users[id];
    if (found || !u || typeof u !== 'object') return;
    if (String(u.email || '').toLowerCase() === String(email || '').toLowerCase()) {
      found = Object.assign({ userId: id }, u);
      return;
    }
    var members = (u.workspace && u.workspace.Members) || u.Members || {};
    Object.keys(members).forEach(function (mid) {
      var m = members[mid];
      if (!found && m && String(m.email || '').toLowerCase() === String(email || '').toLowerCase()) {
        found = Object.assign({ userId: mid, workspaceId: id }, m);
      }
    });
  });
  if (!found) return { userName: 'User', workspaceName: '', workspaceId: '' };
  return {
    userName: found.name || 'User',
    workspaceName: found.workspaceName || (found.workspace && found.workspace.WorkspaceSettings && found.workspace.WorkspaceSettings.workspaceName) || '',
    workspaceId: found.workspaceId || found.userId || ''
  };
}

function handleOtpSend(p) {
  var email = String(p.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required.');
  var purpose = String(p.purpose || 'login');
  if (['login', 'signup', 'forgot', 'resend', 'master-admin'].indexOf(purpose) === -1) {
    throw new Error('Unsupported OTP purpose.');
  }

  var key = otpKey(email, purpose);
  var cooldownKey = fireKey('cooldown|' + email);
  var cooldownRec = fbGet('/System/OtpCooldown/' + cooldownKey) || {};
  var cooldown = purpose === 'resend' ? 15000 : 45000;
  if (cooldownRec.lastSentAt && Date.now() - Number(cooldownRec.lastSentAt) < cooldown) {
    var wait = Math.ceil((cooldown - (Date.now() - Number(cooldownRec.lastSentAt))) / 1000);
    throw new Error('Please wait ' + wait + ' seconds before requesting another code.');
  }

  var code = generateOtp();
  var userVars = findUserVars(email);
  var vars = {
    userName: p.name || userVars.userName,
    userEmail: email,
    otp: code,
    expiryMinutes: CONFIG.otpMinutes,
    workspaceName: userVars.workspaceName,
    workspaceId: userVars.workspaceId,
    ipAddress: p.ipAddress || 'Not available',
    approxLocation: p.approxLocation || 'Not available',
    device: p.device || 'Not available',
    browser: p.browser || 'Not available'
  };

  var rendered = renderTemplate(p.templateId || resolveOtpTemplate(purpose), vars);
  var info = sendRenderedEmail(rendered, { to: email, replyTo: CONFIG.supportEmail }, vars);

  fbPut('/System/OtpCooldown/' + cooldownKey, { lastSentAt: Date.now(), purpose: purpose });
  fbPut('/System/OtpRequests/' + key, {
    otpHash: otpHash(code, email),
    purpose: purpose,
    expiresAt: Date.now() + CONFIG.otpMinutes * 60 * 1000,
    attempts: 0,
    createdAt: Date.now(),
    lastSentAt: Date.now(),
    ipAddress: vars.ipAddress,
    approxLocation: vars.approxLocation
  });
  fbPost('/System/OtpLogs', {
    email: email,
    purpose: purpose,
    event: 'sent',
    ipAddress: vars.ipAddress,
    approxLocation: vars.approxLocation,
    transport: info.transport,
    timestamp: Date.now()
  });

  return {
    status: 'success',
    sent: true,
    purpose: purpose,
    expiresInMinutes: CONFIG.otpMinutes,
    transport: info.transport
  };
}

function resolveOtpTemplate(purpose) {
  switch (String(purpose || '').toLowerCase()) {
    case 'signup': return 'otp_signup';
    case 'forgot': return 'forgot_password';
    case 'master-admin': return 'otp_master_2fa';
    case 'resend': return 'otp_resend';
    default: return 'otp_login';
  }
}

function handleOtpVerify(p) {
  var email = String(p.email || '').trim().toLowerCase();
  var code = String(p.otp || '').trim();
  var purpose = String(p.purpose || 'login');
  if (!email || !code) throw new Error('Email and OTP are required.');

  var key = otpKey(email, purpose);
  var rec = fbGet('/System/OtpRequests/' + key);
  if (!rec) throw new Error('No active verification code. Request a new one.');
  if (Date.now() > Number(rec.expiresAt || 0)) {
    fbDelete('/System/OtpRequests/' + key);
    throw new Error('Verification code expired. Request a new one.');
  }
  if (Number(rec.attempts || 0) >= 5) {
    fbDelete('/System/OtpRequests/' + key);
    throw new Error('Too many incorrect attempts. Request a new code.');
  }

  if (String(rec.otpHash) === otpHash(code, email)) {
    fbDelete('/System/OtpRequests/' + key);
    fbPost('/System/OtpLogs', { email: email, purpose: purpose, event: 'verified', timestamp: Date.now() });
    return { status: 'success', verified: true };
  }

  fbPatch('/System/OtpRequests/' + key, { attempts: Number(rec.attempts || 0) + 1 });
  fbPost('/System/OtpLogs', { email: email, purpose: purpose, event: 'failed_attempt', timestamp: Date.now() });
  throw new Error('Invalid verification code.');
}

/* ------------------------------------------------------------------ *
 * 6. AUDIENCE RESOLUTION
 * ------------------------------------------------------------------ */

function flattenUsers() {
  var raw = fbGet('/Users') || {};
  var out = [];
  Object.keys(raw).forEach(function (id) {
    var u = raw[id];
    if (!u || typeof u !== 'object') return;
    out.push(Object.assign({ userId: id }, u));
    var members = (u.workspace && u.workspace.Members) || u.Members || {};
    Object.keys(members).forEach(function (mid) {
      var m = members[mid];
      if (m && typeof m === 'object') {
        out.push(Object.assign({ userId: mid, workspaceOwnerId: id }, m));
      }
    });
  });
  return out;
}

function isLicensedUser(u) {
  return u.multiUserLicensed === true ||
    ['multi_user', 'enterprise'].indexOf(String(u.workspacePlan || '').toLowerCase()) !== -1;
}

function resolveAudience(audience, conditions) {
  var all = flattenUsers();
  var c = conditions || {};
  var list = all.filter(function (u) {
    if (!u.email) return false;
    var licensed = isLicensedUser(u);
    switch (String(audience || '').toLowerCase()) {
      case 'owners':
        if (['administrator', 'super_administrator'].indexOf(String(u.role || '').toLowerCase()) === -1) return false;
        break;
      case 'licensed': if (!licensed) return false; break;
      case 'standard': if (licensed) return false; break;
      case 'operators': if (String(u.role || '').toLowerCase() !== 'operator') return false; break;
      default: break;
    }
    if (c.license === 'licensed' && !licensed) return false;
    if (c.license === 'free' && licensed) return false;
    if (c.role && String(u.role || '') !== c.role) return false;
    if (c.status && String(u.status || 'active') !== c.status) return false;
    if (c.workspaceId && u.workspaceOwnerId !== c.workspaceId && u.userId !== c.workspaceId) return false;
    if (c.userId && u.userId !== c.userId) return false;
    if (c.daysToExpiry) {
      var until = u.licenseValidUntil || u.licenseExpiresAt || u.workspaceLicenseExpiry;
      if (!until) return false;
      var days = (new Date(until).getTime() - Date.now()) / 86400000;
      if (days < 0 || days > Number(c.daysToExpiry)) return false;
    }
    return true;
  });

  var seen = {};
  return list.filter(function (u) {
    var key = String(u.email).toLowerCase();
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).map(function (u) {
    return {
      email: u.email,
      name: u.name || 'User',
      vars: {
        workspaceName: u.workspaceName || (u.workspace && u.workspace.WorkspaceSettings && u.workspace.WorkspaceSettings.workspaceName) || '',
        workspaceId: u.workspaceId || u.workspaceOwnerId || u.userId,
        roleName: u.role || 'Standard User'
      }
    };
  });
}

/* ------------------------------------------------------------------ *
 * 7. QUEUE PROCESSING
 * ------------------------------------------------------------------ */

function todayKey() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
}

function sentToday() {
  var stats = fbGet('/System/EmailStats/' + todayKey()) || {};
  return Number(stats.sent || 0);
}

function bumpSent(count) {
  fbPatch('/System/EmailStats/' + todayKey(), { sent: sentToday() + Number(count || 0) });
}

function fetchPendingJobs() {
  var queued = fbGet('/System/EmailQueue', {
    orderBy: '"status"', equalTo: '"queued"', limitToFirst: 12
  }) || {};
  var scheduled = fbGet('/System/EmailQueue', {
    orderBy: '"status"', equalTo: '"scheduled"', limitToFirst: 8
  }) || {};
  var jobs = [];
  Object.keys(queued).forEach(function (k) { jobs.push(Object.assign({ id: k }, queued[k])); });
  Object.keys(scheduled).forEach(function (k) {
    var j = scheduled[k];
    if (!j.scheduledAt || Number(j.scheduledAt) <= Date.now()) {
      jobs.push(Object.assign({ id: k }, j));
    }
  });
  return jobs;
}

function enqueueSystemJob(job) {
  return fbPost('/System/EmailQueue', Object.assign({
    status: 'queued', attempts: 0, createdAt: Date.now(), requestedBy: 'system'
  }, job));
}

function processEmailQueue() {
  var remaining = CONFIG.dailyCap - sentToday();
  if (remaining <= 0) {
    Logger.log('Daily MailApp cap reached. Queue untouched.');
    return 'daily-cap-reached';
  }

  var jobs = fetchPendingJobs();
  var processed = 0;

  for (var i = 0; i < jobs.length && remaining > 0; i++) {
    var job = jobs[i];
    try {
      if (Number(job.attempts || 0) >= CONFIG.maxAttempts) {
        fbPatch('/System/EmailQueue/' + job.id, {
          status: 'failed', error: 'Exceeded maximum attempts', failedAt: Date.now()
        });
        markCampaign(job.campaignId, 'failed', 'Exceeded maximum attempts');
        continue;
      }

      var dedupeKey = job.idempotencyKey ? fireKey(job.idempotencyKey) : '';
      if (dedupeKey && fbGet('/System/EmailDedupe/' + dedupeKey)) {
        fbPatch('/System/EmailQueue/' + job.id, { status: 'skipped', error: 'Duplicate', skippedAt: Date.now() });
        continue;
      }

      fbPatch('/System/EmailQueue/' + job.id, {
        status: 'processing', attempts: Number(job.attempts || 0) + 1, startedAt: Date.now()
      });

      var recipients = (Array.isArray(job.recipients) && job.recipients.length)
        ? job.recipients
        : (Array.isArray(job.to) && job.to.length)
          ? job.to
          : resolveAudience(job.audience, job.conditions);

      if (!recipients.length) {
        fbPatch('/System/EmailQueue/' + job.id, {
          status: 'skipped', error: 'No recipients matched', skippedAt: Date.now()
        });
        markCampaign(job.campaignId, 'skipped', 'No recipients matched');
        continue;
      }

      var sentCount = 0;
      var errors = [];
      for (var r = 0; r < recipients.length && remaining > 0; r++) {
        var rec = recipients[r];
        if (!rec || !rec.email) continue;
        var vars = Object.assign({}, job.vars || {}, rec.vars || {}, {
          userName: rec.name || (job.vars && job.vars.userName) || 'User',
          userEmail: rec.email
        });
        try {
          var rendered = renderTemplate(job.templateId, vars);
          var info = sendRenderedEmail(rendered, {
            to: rec.email,
            replyTo: job.replyTo,
            subjectOverride: job.subjectOverride
          }, vars);
          fbPost('/System/EmailLogs', {
            jobId: job.id,
            campaignId: job.campaignId || '',
            templateId: job.templateId,
            to: rec.email,
            subject: rendered.subject,
            sender: rendered.sender,
            transport: info.transport,
            listUnsubscribe: !!info.listUnsubscribe,
            status: 'sent',
            timestamp: Date.now()
          });
          sentCount++;
          remaining--;
        } catch (sendErr) {
          errors.push(String(sendErr && sendErr.message ? sendErr.message : sendErr));
          fbPost('/System/EmailLogs', {
            jobId: job.id,
            campaignId: job.campaignId || '',
            templateId: job.templateId,
            to: rec.email,
            status: 'failed',
            error: String(sendErr && sendErr.message ? sendErr.message : sendErr),
            timestamp: Date.now()
          });
        }
      }

      bumpSent(sentCount);
      if (dedupeKey) fbPut('/System/EmailDedupe/' + dedupeKey, { createdAt: Date.now(), jobId: job.id });

      var failed = sentCount < recipients.length;
      fbPatch('/System/EmailQueue/' + job.id, {
        status: failed ? 'partial' : 'sent',
        sentCount: sentCount,
        recipientCount: recipients.length,
        error: errors.length ? errors.slice(0, 3).join(' | ') : null,
        sentAt: Date.now()
      });
      markCampaign(job.campaignId, failed ? 'partial' : 'sent', errors[0] || '', sentCount, recipients.length);
      processed++;
    } catch (jobErr) {
      fbPatch('/System/EmailQueue/' + job.id, {
        status: 'failed',
        error: String(jobErr && jobErr.message ? jobErr.message : jobErr),
        failedAt: Date.now()
      });
      markCampaign(job.campaignId, 'failed', String(jobErr && jobErr.message ? jobErr.message : jobErr));
    }
  }

  return 'processed:' + processed;
}

function markCampaign(campaignId, status, error, sentCount, total) {
  if (!campaignId) return;
  var patch = { status: status, error: error || '', updatedAt: Date.now() };
  if (sentCount != null) patch.sentCount = sentCount;
  if (total != null) patch.recipientCount = total;
  try { fbPatch('/System/EmailCampaigns/' + campaignId, patch); } catch (e) { /* non-blocking */ }
}

/* ------------------------------------------------------------------ *
 * 8. LICENSE EXPIRY WATCHER
 * ------------------------------------------------------------------ */

/**
 * License lifecycle engine.
 * Runs daily and sends EXACTLY ONE notice per milestone:
 *   7 days before, 3 days before, on the expiry date, and after expiry.
 * A missed milestone (for example the trigger was paused) falls back to the
 * generic license_expiring template so the user is still informed.
 * On expiry the workspace is also moved back to the free plan once.
 */
function istDayNumber(dateValue) {
  var d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  var ymd = Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd');
  return new Date(ymd + 'T00:00:00Z').getTime();
}

function licenseMilestone(days) {
  if (days < 0) return { id: 'license_expired', key: 'expired', days: days };
  if (days === 7) return { id: 'license_expiring_7day', key: '7day', days: 7 };
  if (days === 3) return { id: 'license_expiring_3day', key: '3day', days: 3 };
  if (days === 0) return { id: 'license_expiring_today', key: 'today', days: 0 };
  if (days > 0 && days < 7) return { id: 'license_expiring', key: 'generic-' + days, days: days };
  return null;
}

function revokeExpiredLicense(owner, expiryValue) {
  if (!owner || !owner.userId || owner.licenseAutoRevoked === true) return false;
  var ownerPath = '/Users/' + owner.userId;
  try {
    fbPatch(ownerPath, {
      multiUserLicensed: false,
      workspacePlan: 'single_user',
      role: 'standard_user',
      masterControl: 'operations',
      multiUserQuota: 1,
      licenseAutoRevoked: true,
      licenseExpiredAt: Date.now()
    });
    fbPatch(ownerPath + '/workspace/WorkspaceSettings', {
      multiUserLicensed: false,
      workspacePlan: 'single_user',
      multiUserQuota: 1,
      licenseAutoRevoked: true,
      licenseExpiredAt: Date.now()
    });
    return true;
  } catch (e) {
    Logger.log('Could not auto-revoke expired license for ' + owner.userId + ': ' + e.message);
    return false;
  }
}

function checkLicenseExpiry() {
  var users = flattenUsers();
  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  var renewalUrl = CONFIG.loginUrl + '#/utilities/aboutus';
  var byWorkspace = {};
  var queued = 0;
  var revoked = 0;

  users.forEach(function (u) {
    var isOwner = !u.workspaceOwnerId;
    var groupId = isOwner ? u.userId : u.workspaceOwnerId;
    if (!groupId) return;
    if (!isOwner && !u.email) return;

    if (!byWorkspace[groupId]) {
      byWorkspace[groupId] = {
        owner: isOwner ? u : null,
        until: isOwner ? (u.licenseValidUntil || u.licenseExpiresAt || u.workspaceLicenseExpiry) : null,
        recipients: []
      };
    }
    if (u.email) {
      byWorkspace[groupId].recipients.push({
        email: String(u.email).toLowerCase(),
        name: u.name || 'User'
      });
    }
  });

  Object.keys(byWorkspace).forEach(function (groupId) {
    var group = byWorkspace[groupId];
    var owner = group.owner;
    if (!owner || !isLicensedUser(owner)) return;
    if (!group.until) return;

    var days = Math.round((istDayNumber(group.until) - istDayNumber(new Date())) / 86400000);
    var milestone = licenseMilestone(days);
    if (!milestone) return;

    // Deduplicate recipients while keeping the workspace owner first.
    var seen = {};
    var recipients = group.recipients.filter(function (r) {
      if (seen[r.email]) return false;
      seen[r.email] = true;
      return true;
    }).sort(function (a, b) {
      var ao = String(owner.email || '').toLowerCase() === a.email ? -1 : 1;
      var bo = String(owner.email || '').toLowerCase() === b.email ? -1 : 1;
      return ao - bo;
    }).slice(0, 25);
    if (!recipients.length) return;

    var expiryDate = new Date(group.until).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    var vars = {
      workspaceName: owner.workspaceName || (owner.workspace && owner.workspace.WorkspaceSettings && owner.workspace.WorkspaceSettings.workspaceName) || 'Your workspace',
      workspaceId: owner.userId,
      planName: owner.workspacePlan || 'Multi-User Enterprise',
      expiryDate: expiryDate,
      daysRemaining: Math.max(0, days),
      renewalUrl: renewalUrl
    };
    if (milestone.key === 'expired') {
      vars.expiredAt = new Date(group.until).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      vars.impactMessage = 'Team provisioning is disabled until the license is restored.';
    }

    enqueueSystemJob({
      templateId: milestone.id,
      event: 'license_' + milestone.key,
      category: 'transactional',
      recipients: recipients,
      audience: 'custom',
      vars: vars,
      idempotencyKey: 'license|' + groupId + '|' + milestone.key + '|' + today
    });
    queued++;

    if (milestone.key === 'expired' && revokeExpiredLicense(owner, group.until)) revoked++;
  });

  return 'license-notices-queued:' + queued + '|auto-revoked:' + revoked;
}

/* ------------------------------------------------------------------ *
 * 9. WEB APP ENTRY POINTS
 * ------------------------------------------------------------------ */

function parseInput(e) {
  var p = (e && e.parameter) || {};
  var vars = {};
  if (typeof p.vars === 'string' && p.vars.trim()) {
    try { vars = JSON.parse(p.vars); }
    catch (err) { throw new Error('vars must be valid JSON.'); }
  } else if (p.vars && typeof p.vars === 'object') {
    vars = p.vars;
  }
  Object.keys(p).forEach(function (k) {
    if (CONTROL_KEYS.indexOf(k) === -1 && !(k in vars)) vars[k] = p[k];
  });
  // These are control parameters for the gateway but also real {{tokens}} in
  // templates. Keep them available for preview/test rendering.
  ['name', 'email', 'otp', 'purpose', 'ipAddress', 'approxLocation',
    'device', 'browser'].forEach(function (k) {
    if (p[k] != null && p[k] !== '') vars[k] = p[k];
  });
  return { params: p, vars: vars };
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Accept parameter names used by the deprecated OTP endpoint. */
function normalizeLegacyParams(p) {
  p.appKey = p.appKey || p.app_key || '';
  p.ipAddress = p.ipAddress || p.ip || '';
  p.approxLocation = p.approxLocation || p.location ||
    [p.city, p.region, p.country].filter(Boolean).join(', ');
  return p;
}

function gatewayVersion() {
  return 'mail-gateway-api.gs|2026-11-26-full-lifecycle-v6';
}

/** Run this in the Apps Script editor to verify the EDITOR has the new code. */
function showGatewayVersion() {
  return gatewayVersion();
}

function handleRequest(e) {
  try {
    var input = parseInput(e);
    var p = normalizeLegacyParams(input.params);
    var action = String(p.action || p.mode || 'send').toLowerCase();
    var legacyMode = String(p.mode || '').toLowerCase();

    // Backward compatibility for browsers still holding the old cached page:
    // old OTP used ?mode=send / ?mode=verify with ip/location parameters.
    if (!p.action && legacyMode === 'send' && p.email && (p.purpose || p.templateId)) {
      action = 'otp_send';
    }
    if (!p.action && legacyMode === 'verify' && p.email && p.otp) {
      action = 'otp_verify';
    }
    if (action === 'sendtemplate') action = 'send';

    // Public health check: use it to confirm WHICH gateway is actually deployed.
    if (action === 'health' || action === 'diag' || action === 'version') {
      return jsonResponse({
        status: 'success',
        health: true,
        version: gatewayVersion(),
        appKey: CONFIG.appKey,
        sheetId: CONFIG.sheetId,
        sheetTab: CONFIG.sheetName,
        tokenConfigured: !!CONFIG.token,
        supports: ['otp_send', 'otp_verify', 'preview', 'send', 'test_send',
          'enqueue', 'process_queue', 'check_licenses', 'health']
      });
    }

    // OTP and preview are public-but-safe: no secret, server-generated OTP,
    // cooldown + attempt limits. Sends are capped by the queue daily guard.
    if (String(p.appKey || '') !== CONFIG.appKey && String(p.token || '') !== CONFIG.token) {
      return jsonResponse({ status: 'error', message: 'Invalid app key.' });
    }

    if (action === 'otp_send') return jsonResponse(handleOtpSend(p));
    if (action === 'otp_verify') return jsonResponse(handleOtpVerify(p));

    if (action === 'preview') {
      var preview = renderTemplate(p.templateId, input.vars, p.strict);
      return jsonResponse({
        status: 'success',
        preview: true,
        templateId: preview.templateId,
        sender: preview.sender,
        subject: preview.subject,
        htmlBody: preview.htmlBody,
        textBody: preview.textBody
      });
    }

    // Admin-only actions require the secret token.
    if (String(p.token || '') !== CONFIG.token) {
      return jsonResponse({ status: 'error', message: 'Unauthorized mail gateway request.' });
    }

    if (action === 'send') {
      var rendered = renderTemplate(p.templateId, input.vars, p.strict);
      if (!p.to) throw new Error('to is required to send email.');
      var info = sendRenderedEmail(rendered, p, input.vars);
      fbPost('/System/EmailLogs', {
        templateId: rendered.templateId,
        to: p.to,
        subject: rendered.subject,
        sender: rendered.sender,
        transport: info.transport,
        status: 'sent',
        source: 'direct-api',
        timestamp: Date.now()
      });
      return jsonResponse({
        status: 'success',
        templateId: rendered.templateId,
        sender: rendered.sender,
        to: p.to,
        subject: rendered.subject,
        transport: info.transport,
        listUnsubscribeHeader: !!info.listUnsubscribe,
        note: info.error || info.skippedBecause || ''
      });
    }

    if (action === 'test_send' || action === 'enqueue') {
      var key = enqueueSystemJob({
        templateId: p.templateId,
        event: action,
        category: String(p.category || 'transactional'),
        recipients: [{ email: p.to, name: (input.vars && input.vars.userName) || 'User' }],
        audience: 'custom',
        vars: input.vars,
        requestedBy: p.requestedBy || 'Master Administrator'
      });
      return jsonResponse({ status: 'success', queued: true, queueKey: key });
    }

    if (action === 'process_queue') {
      return jsonResponse({ status: 'success', result: processEmailQueue() });
    }

    if (action === 'check_licenses') {
      return jsonResponse({ status: 'success', result: checkLicenseExpiry() });
    }

    return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: String(err && err.message ? err.message : err) });
  }
}

function doGet(e) { return handleRequest(e); }

function doPost(e) {
  var body = {};
  try {
    body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  } catch (err) {
    return jsonResponse({ status: 'error', message: 'Invalid JSON body.' });
  }
  return handleRequest({ parameter: body });
}

/** Run once from the Apps Script editor to install the two time triggers. */
function installUnitaxTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processEmailQueue' || t.getHandlerFunction() === 'checkLicenseExpiry') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('processEmailQueue').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('checkLicenseExpiry').timeBased().everyDays(1).atHour(6).create();
  return 'Triggers installed: processEmailQueue (1 min), checkLicenseExpiry (daily 06:00 IST - 7/3/1 day and expiry notices).';
}
