/**
 * DEPRECATED - DO NOT PASTE THIS FILE.
 * The canonical gateway is mail-gateway-api.gs, which now contains the
 * template renderer, OTP handlers, queue processing, campaigns and license
 * expiry checks. Keeping both files in one Apps Script project causes
 * duplicate-function errors.
 *
 * UniTax Pro — Google Apps Script Mail Gateway (legacy reference)
 *
 * 1. Create a Google Sheet named "UniTax Email Templates".
 * 2. Import UniTax_Email_Templates.csv into that sheet (tab name: Templates).
 * 3. Set Script Properties:
 *      EMAIL_TEMPLATE_SHEET_ID  = <sheet id>
 *      FIREBASE_DB_URL          = https://<project>.firebaseio.com
 *      FIREBASE_SECRET          = <database secret / service credential token>
 *      APP_NAME                 = UniTax Pro
 *      SUPPORT_EMAIL            = support@unitax.pro
 *      TRANSACTIONAL_FROM       = no-reply@unitax.pro   (Gmail alias must exist)
 *      MARKETING_FROM           = updates@unitax.pro    (Gmail alias must exist)
 *      MAIL_GATEWAY_TOKEN       = <long random token shared with the web app>
 *      LOGIN_URL                = https://your-domain/login.html
 * 4. Add a time-driven trigger for processEmailQueue() every 1 minute.
 * 5. Deploy as Web App. Existing OTP code can call sendTemplate('otp_login', ...).
 * Sending uses MailApp (not GmailApp) with an alias fallback.
 */

const PROPS = PropertiesService.getScriptProperties();
const SHEET_ID = PROPS.getProperty('EMAIL_TEMPLATE_SHEET_ID');
const DB_URL = String(PROPS.getProperty('FIREBASE_DB_URL') || '').replace(/\/$/, '');
const DB_SECRET = PROPS.getProperty('FIREBASE_SECRET') || '';
const APP_NAME = PROPS.getProperty('APP_NAME') || 'UniTax Pro';
const SUPPORT_EMAIL = PROPS.getProperty('SUPPORT_EMAIL') || 'support@unitax.pro';
const MAIL_TOKEN = PROPS.getProperty('MAIL_GATEWAY_TOKEN') || '';
const YEAR = new Date().getFullYear();

const CONTEXT_KEYS = ['ipAddress', 'approxLocation', 'requestedAt', 'device', 'browser'];
const COMMON_KEYS = ['appName', 'supportEmail', 'year', 'loginUrl'];

/* ------------------------------------------------------------------ *
 * TEMPLATE STORAGE (Google Sheet)
 * ------------------------------------------------------------------ */

function getTemplateRows() {
  if (!SHEET_ID) throw new Error('EMAIL_TEMPLATE_SHEET_ID is not configured.');
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Templates') ||
                SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function getTemplate(templateId) {
  const row = getTemplateRows().find(r =>
    String(r.templateId).trim() === String(templateId).trim() &&
    String(r.active || 'TRUE').toUpperCase() !== 'FALSE'
  );
  if (!row) throw new Error('Unknown or inactive template: ' + templateId);
  return row;
}

/* ------------------------------------------------------------------ *
 * RENDERING
 * ------------------------------------------------------------------ */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fillTokens(str, vars) {
  return String(str || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const value = vars[key];
    return value == null || value === '' ? 'Not available' : escapeHtml(value);
  });
}

function renderTemplate(templateId, vars) {
  const t = getTemplate(templateId);
  const merged = Object.assign({
    appName: APP_NAME,
    supportEmail: SUPPORT_EMAIL,
    year: YEAR,
    loginUrl: PROPS.getProperty('LOGIN_URL') || ''
  }, vars || {});

  CONTEXT_KEYS.forEach(k => {
    if (merged[k] == null || merged[k] === '') merged[k] = 'Not available';
  });

  return {
    subject: fillTokens(t.subject, merged),
    htmlBody: fillTokens(t.htmlBody, merged),
    textBody: fillTokens(t.textBody, merged),
    sender: String(t.sender || 'transactional')
  };
}

/* ------------------------------------------------------------------ *
 * SENDING
 * ------------------------------------------------------------------ */

function sendTemplate(templateId, to, vars, options) {
  const opts = options || {};
  const rendered = renderTemplate(templateId, vars);
  // System mail: "UniTax Pro". Promotional mail: "UniTax Pro Notifications".
  const defaultName = rendered.sender === 'marketing'
    ? 'UniTax Pro Notifications'
    : 'UniTax Pro';
  const mailOptions = {
    htmlBody: rendered.htmlBody,
    name: opts.senderName || defaultName,
    replyTo: opts.replyTo || SUPPORT_EMAIL
  };

  const isPromo = rendered.sender === 'marketing';
  const fromAlias = isPromo
    ? PROPS.getProperty('MARKETING_FROM')
    : PROPS.getProperty('TRANSACTIONAL_FROM');
  if (fromAlias) mailOptions.from = fromAlias;

  const unsubscribeUrl = (vars && vars.unsubscribeUrl) || '';
  if (isPromo && unsubscribeUrl) {
    // Gmail-native unsubscribe button via List-Unsubscribe header.
    var headers = { 'List-Unsubscribe': '<' + unsubscribeUrl + '>' };
    if (String(PROPS.getProperty('UNSUB_ONE_CLICK') || '').toUpperCase() === 'TRUE') {
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    mailOptions.headers = headers;
  }

  try {
    if (isPromo && unsubscribeUrl) {
      // Promotional mail uses GmailApp for the native unsubscribe header.
      GmailApp.sendEmail(to, rendered.subject, rendered.textBody, mailOptions);
    } else {
      // System / account / security mail stays on MailApp.
      MailApp.sendEmail(to, rendered.subject, rendered.textBody, mailOptions);
    }
  } catch (err) {
    // Alias/header issue — retry with MailApp without custom headers.
    const fallback = Object.assign({}, mailOptions);
    delete fallback.from;
    delete fallback.headers;
    MailApp.sendEmail(to, rendered.subject, rendered.textBody, fallback);
  }
  return { templateId, to, subject: rendered.subject };
}

/* ------------------------------------------------------------------ *
 * FIREBASE QUEUE (bulk / promotional / deferred system mail)
 * ------------------------------------------------------------------ */

function fbUrl(path, params) {
  const base = DB_URL + path + '.json?auth=' + encodeURIComponent(DB_SECRET);
  if (!params) return base;
  return base + '&' + Object.keys(params)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');
}

function fbRequest(url, method, payload) {
  const options = {
    method: method || 'get',
    contentType: 'application/json',
    muteHttpExceptions: true
  };
  if (payload != null) options.payload = JSON.stringify(payload);
  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code < 200 || code >= 300) throw new Error('Firebase ' + code + ': ' + text);
  return text ? JSON.parse(text) : null;
}

function enqueueEmail(job) {
  if (!DB_URL || !DB_SECRET) throw new Error('Firebase is not configured.');
  return fbRequest(fbUrl('/System/EmailQueue'), 'post', Object.assign({
    status: 'queued',
    attempts: 0,
    createdAt: Date.now()
  }, job));
}

function fetchQueuedJobs(limit) {
  const url = fbUrl('/System/EmailQueue', {
    orderBy: '"status"',
    equalTo: '"queued"',
    limitToFirst: limit || 20
  });
  const data = fbRequest(url, 'get');
  return data ? Object.keys(data).map(id => Object.assign({ id }, data[id])) : [];
}

function updateJob(id, patch) {
  return fbRequest(fbUrl('/System/EmailQueue/' + id), 'patch', patch);
}

function flattenUsers(usersRaw) {
  const out = [];
  Object.keys(usersRaw || {}).forEach(id => {
    const u = usersRaw[id];
    if (!u || typeof u !== 'object') return;
    out.push(Object.assign({ userId: id }, u));
    const members = (u.workspace && u.workspace.Members) || {};
    Object.keys(members).forEach(mid => {
      const m = members[mid];
      if (m && typeof m === 'object') {
        out.push(Object.assign({ userId: mid, workspaceOwnerId: id }, m));
      }
    });
  });
  return out;
}

function resolveAudience(audience) {
  const usersRaw = fbRequest(fbUrl('/Users'), 'get') || {};
  const all = flattenUsers(usersRaw);
  const isLicensed = u => u.multiUserLicensed === true ||
    ['multi_user', 'enterprise'].includes(String(u.workspacePlan || '').toLowerCase());

  switch (String(audience || '').toLowerCase()) {
    case 'owners':
      return all.filter(u => ['administrator', 'super_administrator'].includes(String(u.role || '').toLowerCase()));
    case 'licensed':
      return all.filter(isLicensed);
    case 'standard':
      return all.filter(u => !isLicensed(u));
    case 'operators':
      return all.filter(u => String(u.role || '').toLowerCase() === 'operator');
    case 'all':
    default:
      return all.filter(u => !!u.email);
  }
}

function processEmailQueue() {
  if (!DB_URL || !DB_SECRET) return;
  const jobs = fetchQueuedJobs(20);

  jobs.forEach(job => {
    try {
      updateJob(job.id, { status: 'processing', attempts: Number(job.attempts || 0) + 1 });
      const recipients = (job.to && job.to.length)
        ? job.to
        : resolveAudience(job.audience).map(u => ({
            email: u.email,
            name: u.name || 'User',
            vars: { workspaceName: u.workspaceName || '', workspaceId: u.workspaceOwnerId || u.userId }
          }));

      recipients.forEach(r => {
        if (!r || !r.email) return;
        sendTemplate(job.templateId, r.email, Object.assign({}, job.vars || {}, r.vars || {}, {
          userName: r.name || (job.vars && job.vars.userName) || 'User'
        }), { replyTo: job.replyTo });
      });

      updateJob(job.id, { status: 'sent', sentAt: Date.now(), sentCount: recipients.length, error: null });
    } catch (err) {
      updateJob(job.id, { status: 'failed', error: String(err && err.message ? err.message : err), failedAt: Date.now() });
    }
  });
}

/* ------------------------------------------------------------------ *
 * WEB APP ENTRY POINTS
 * ------------------------------------------------------------------ */

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function migrationNotice() {
  return json({
    status: 'error',
    deprecated: true,
    message: 'This Web App is running the DEPRECATED mail-gateway.gs. ' +
      'Delete this code, paste ONLY email-templates/mail-gateway-api.gs, save, ' +
      'then Deploy -> Manage deployments -> New version. ' +
      'Use ?action=health on the new deployment to confirm.'
  });
}

function doGet(e) {
  return migrationNotice();
}

function doPost(e) {
  return migrationNotice();
}
