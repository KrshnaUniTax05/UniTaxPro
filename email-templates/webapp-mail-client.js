/**
 * UniTax Pro - Web App Mail Client (industry-grade handlers)
 * ----------------------------------------------------------
 * Browser code NEVER contains the Apps Script MAIL_GATEWAY_TOKEN.
 *
 * - Transactional / lifecycle events are written to Firebase `System/EmailQueue`.
 *   The Apps Script time trigger drains the queue with MailApp.
 * - OTP send / verify call the Apps Script Web App directly because OTP must be
 *   generated and verified server-side. No secret is required for those actions.
 * - Preview is read-only and also needs no secret.
 * - Admin campaigns are queued to Firebase with an explicit recipient list or
 *   audience conditions and get a campaign record for status tracking.
 */
(function () {
  'use strict';

  // Public Web App URL from Deploy -> Manage deployments -> Web app.
  // Override before this script loads with: window.UNITAX_MAIL_ENDPOINT = '...'
  var ENDPOINT = window.UNITAX_MAIL_ENDPOINT ||
    'https://script.google.com/macros/s/AKfycbx7NIHQPjtDxOxCh8hj2CrxV1EtuTM6DxJ-jowWDjWpcKd3-4GM6RFuJIObjDI12H92/exec';
  // Public app identifier (NOT a secret). Only gates non-sensitive actions.
  var APP_KEY = 'unitax-web-v5';
  var CLIENT_VERSION = '2026-11-26-full-lifecycle-v6';
  var OUTBOX_KEY = 'unitax_mail_outbox_v1';
  var SUPPORT_EMAIL = 'prounitax@gmail.com';
  var LOGIN_URL = 'https://krshnaunitax05.github.io/UniTaxPro/login.html';
  var ADMIN_URL = 'https://krshnaunitax05.github.io/UniTaxPro/admin.html';

  function db() {
    if (typeof window.db !== 'undefined' && window.db) return window.db;
    if (typeof firebase !== 'undefined' && firebase.database) return firebase.database();
    throw new Error('Firebase database is not available.');
  }

  function nowIst() {
    return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  }

  function browserName(ua) {
    ua = ua || navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Microsoft Edge';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
    return 'Browser';
  }

  function deviceName(ua) {
    ua = ua || navigator.userAgent;
    if (/ipad|tablet/i.test(ua)) return 'Tablet';
    if (/mobile|android|iphone|ipod/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  var IP_CACHE_KEY = 'unitax_ip_context_v1';

  function readGeoCache() {
    try {
      var raw = sessionStorage.getItem(IP_CACHE_KEY);
      if (!raw) return null;
      var cached = JSON.parse(raw);
      if (cached && cached.ip && cached.cachedAt && Date.now() - cached.cachedAt < 6 * 60 * 60 * 1000) {
        return cached;
      }
    } catch (e) { /* storage may be disabled */ }
    return null;
  }

  function saveGeoCache(ctx) {
    try {
      sessionStorage.setItem(IP_CACHE_KEY, JSON.stringify(Object.assign({ cachedAt: Date.now() }, ctx)));
    } catch (e) { /* storage may be disabled */ }
  }

  function fetchGeoJson(url, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 2500);
    return fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .finally(function () { clearTimeout(timer); });
  }

  function normaliseGeo(geo, source) {
    if (!geo) return null;
    var ip = geo.ip || geo.ipAddress || '';
    if (!ip) return null;
    var city = geo.city || geo.cityName || '';
    var region = geo.region || geo.state || geo.regionName || '';
    var country = geo.country || geo.country_name || geo.countryName || '';
    var lat = geo.latitude != null ? String(geo.latitude) : (geo.lat != null ? String(geo.lat) : '');
    var lon = geo.longitude != null ? String(geo.longitude) : (geo.lon != null ? String(geo.lon) : '');
    return {
      ip: String(ip),
      location: [city, region, country].filter(Boolean).join(', ') ||
        (lat && lon ? lat + ', ' + lon : 'Approximate location unavailable'),
      source: source || 'geo'
    };
  }

  async function lookupIpWho() {
    var g = await fetchGeoJson('https://ipwho.is/', 2500);
    if (g.success === false || !g.ip) throw new Error(g.message || 'ipwho.is lookup failed');
    return normaliseGeo(g, 'ipwho.is');
  }

  async function lookupIpApi() {
    var g = await fetchGeoJson('https://ipapi.co/json/', 2500);
    if (g.error || !g.ip) throw new Error(g.reason || 'ipapi.co lookup failed');
    return normaliseGeo(g, 'ipapi.co');
  }

  async function lookupFreeIpApi() {
    var g = await fetchGeoJson('https://freeipapi.com/api/json', 2500);
    if (!g.ipAddress) throw new Error('freeipapi lookup failed');
    return normaliseGeo(g, 'freeipapi.com');
  }

  async function lookupIpify() {
    var g = await fetchGeoJson('https://api.ipify.org?format=json', 2500);
    if (!g.ip) throw new Error('ipify lookup failed');
    return normaliseGeo(g, 'ipify');
  }

  async function context() {
    var c = null;
    if (typeof window.getOtpContext === 'function') {
      try { c = await window.getOtpContext(); } catch (e) { /* ignore */ }
    }
    if (!c || !c.ip) c = readGeoCache();
    if (!c || !c.ip) {
      var providers = [lookupIpWho, lookupIpApi, lookupFreeIpApi, lookupIpify];
      for (var i = 0; i < providers.length; i++) {
        try {
          var found = await providers[i]();
          if (found && found.ip) {
            saveGeoCache(found);
            c = found;
            break;
          }
        } catch (e) { /* never block mail on a failed lookup */ }
      }
    }
    return {
      ipAddress: (c && c.ip) || 'Not available',
      approxLocation: (c && c.location) || 'Not available',
      device: deviceName(),
      browser: browserName()
    };
  }

  async function baseVars(extra) {
    var ctx = await context();
    return Object.assign({
      appName: 'UniTax Pro',
      supportEmail: SUPPORT_EMAIL,
      year: new Date().getFullYear(),
      loginUrl: LOGIN_URL,
      ipAddress: ctx.ipAddress,
      approxLocation: ctx.approxLocation,
      device: ctx.device,
      browser: ctx.browser
    }, extra || {});
  }

  function hashKey(text) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    text = String(text || '');
    for (var i = 0; i < text.length; i++) {
      h1 ^= text.charCodeAt(i); h1 = (h1 * 16777619) >>> 0;
      h2 ^= text.charCodeAt(i); h2 = (h2 * 65599 + 7) >>> 0;
    }
    return h1.toString(36) + '-' + h2.toString(36);
  }

  function readOutbox() {
    try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function writeOutbox(items) {
    try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(0, 100))); }
    catch (e) { /* storage full / disabled */ }
  }

  /** Retry anything that failed while the browser was offline. */
  async function flushOutbox() {
    var items = readOutbox();
    if (!items.length) return 0;
    var remaining = [];
    for (var i = 0; i < items.length; i++) {
      try {
        await db().ref('System/EmailQueue').push(items[i]);
      } catch (e) { remaining.push(items[i]); }
    }
    writeOutbox(remaining);
    return items.length - remaining.length;
  }

  /** Write a queue job; keep a local copy if Firebase is unreachable. */
  async function enqueue(job) {
    var record = Object.assign({
      status: 'queued',
      attempts: 0,
      createdAt: Date.now(),
      requestedBy: 'system',
      category: 'transactional'
    }, job);
    if (!record.idempotencyKey) {
      record.idempotencyKey = hashKey((record.event || record.templateId) + '|' +
        (record.to || '') + '|' + (record.vars && record.vars.userEmail || '') + '|' + Date.now());
    }
    try {
      var ref = await db().ref('System/EmailQueue').push(record);
      return { queued: true, key: ref.key };
    } catch (e) {
      var box = readOutbox();
      box.push(record);
      writeOutbox(box);
      return { queued: false, local: true, error: e.message };
    }
  }

  function friendlyGatewayError(message) {
    var m = String(message || '').toLowerCase();
    if (m.indexOf('unauthorized') !== -1 || m.indexOf('invalid app key') !== -1) {
      return new Error('The deployed Apps Script is still using the OLD gateway. ' +
        'Paste mail-gateway-api.gs into the script, save, then Deploy -> Manage deployments -> New version. ' +
        'Then hard-refresh this page. (' + message + ')');
    }
    return new Error(message || 'Mail gateway request failed.');
  }

  function gatewayCall(params) {
    var clean = {};
    Object.keys(Object.assign({ appKey: APP_KEY, clientVersion: CLIENT_VERSION }, params || {}))
      .forEach(function (k) {
        var v = (params || {})[k];
        if (v !== undefined && v !== null) clean[k] = v;
        else if (k === 'appKey') clean[k] = APP_KEY;
        else if (k === 'clientVersion') clean[k] = CLIENT_VERSION;
      });
    var query = new URLSearchParams(clean);
    return fetch(ENDPOINT + '?' + query.toString(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('Mail gateway returned HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data || data.status === 'error') {
          throw friendlyGatewayError((data && data.message) || 'Mail gateway request failed.');
        }
        return data;
      });
  }

  /* ------------------------------------------------------------------ *
   * EVENT HELPERS
   * ------------------------------------------------------------------ */

  function oneRecipient(templateId, payload, event) {
    payload = payload || {};
    if (!payload.email) return Promise.resolve({ queued: false, skipped: 'no recipient email' });
    return enqueue({
      templateId: templateId,
      event: event || templateId,
      category: payload.category || 'transactional',
      recipients: [{ email: payload.email, name: payload.name || 'User', vars: payload }],
      audience: 'custom',
      vars: payload,
      requestedBy: payload.requestedBy || 'system',
      replyTo: payload.replyTo || SUPPORT_EMAIL
    });
  }

  function resolvePurposeTemplate(purpose) {
    switch (String(purpose || '').toLowerCase()) {
      case 'signup': return 'otp_signup';
      case 'forgot': return 'forgot_password';
      case 'master-admin': return 'otp_master_2fa';
      case 'resend': return 'otp_resend';
      case 'login':
      default: return 'otp_login';
    }
  }

  var UnitaxMail = {
    endpoint: ENDPOINT,
    version: CLIENT_VERSION,

    /** Verify which Apps Script version is actually deployed. */
    health: function () {
      return gatewayCall({ action: 'health' });
    },

    /** Change the Web App URL without editing this file. */
    setEndpoint: function (url) {
      if (!url) throw new Error('Endpoint URL is required.');
      ENDPOINT = String(url).replace(/\/$/, '');
      UnitaxMail.endpoint = ENDPOINT;
      return ENDPOINT;
    },

    /* --- OTP: generated and verified server-side by Apps Script --- */
    otp: {
      send: async function (email, purpose, extra) {
        var vars = await baseVars(extra || {});
        return gatewayCall({
          action: 'otp_send',
          templateId: (extra && extra.templateId) || resolvePurposeTemplate(purpose),
          email: email,
          purpose: purpose || 'login',
          name: vars.userName || 'User',
          ipAddress: vars.ipAddress,
          approxLocation: vars.approxLocation,
          device: vars.device,
          browser: vars.browser
        });
      },
      verify: function (email, otp, purpose) {
        return gatewayCall({
          action: 'otp_verify',
          email: email,
          otp: otp,
          purpose: purpose || 'login'
        });
      }
    },

    /* --- Read-only preview for the admin Email Center --- */
    preview: function (templateId, vars) {
      return gatewayCall({
        action: 'preview',
        templateId: templateId,
        vars: JSON.stringify(vars || {})
      });
    },

    /** Test send: queued (never exposes the Apps Script token in the browser). */
    testSend: function (templateId, to, vars) {
      return UnitaxMail.campaign({
        templateId: templateId,
        category: 'transactional',
        recipients: [{ email: to, name: (vars && vars.userName) || 'Test User', vars: vars || {} }],
        campaignTitle: 'Test send: ' + templateId,
        requestedBy: 'Master Administrator'
      });
    },

    /** Admin-authored personal message (the only non-promotional manual send). */
    customMessage: function (p) {
      p = p || {};
      return UnitaxMail.campaign({
        templateId: 'custom_message',
        category: 'custom',
        recipients: p.recipients || null,
        audience: p.audience || 'all',
        conditions: p.conditions || null,
        varMap: {
          userName: p.userName || 'User',
          messageTitle: p.messageTitle || 'A message from UniTax Pro',
          messageBody: p.messageBody || '',
          actionRequired: p.actionRequired || 'You may reply to this email if you need any assistance.',
          detailsUrl: p.detailsUrl || LOGIN_URL
        },
        subjectOverride: p.subjectOverride || p.messageTitle || '',
        replyTo: p.replyTo || SUPPORT_EMAIL,
        campaignTitle: p.campaignTitle || 'Personal message from UniTax Pro',
        requestedBy: p.requestedBy || 'Master Administrator',
        scheduledAt: p.scheduledAt || null
      });
    },

    /* --- Lifecycle events --- */
    accountCreated: function (p) {
      return oneRecipient('account_created', Object.assign({
        roleName: 'Standard User',
        createdBy: 'system',
        createdAt: nowIst()
      }, p), 'account_created');
    },

    accountDeleted: function (p) {
      return oneRecipient('account_deleted', Object.assign({
        deletedBy: 'Master Administrator',
        deletedAt: nowIst(),
        reason: 'Account removed by administrator'
      }, p), 'account_deleted');
    },

    userStatusChanged: function (p) {
      var suspended = String(p.status || '').toLowerCase() === 'suspended';
      return oneRecipient(suspended ? 'account_suspended' : 'account_reactivated', Object.assign({
        changedBy: 'Master Administrator',
        changedAt: nowIst(),
        reason: 'Changed by administrator',
        suspendedAt: nowIst(),
        suspendedBy: p.changedBy || 'Master Administrator',
        reactivatedAt: nowIst(),
        reactivatedBy: p.changedBy || 'Master Administrator',
        reactivationUrl: LOGIN_URL
      }, p), 'user_status_changed');
    },

    /** Workspace-wide suspension / reactivation: notify owner and all members. */
    workspaceStatusChanged: function (p) {
      p = p || {};
      var suspended = String(p.status || '').toLowerCase() === 'suspended';
      var stamp = nowIst();
      var changedBy = p.changedBy || 'Master Administrator';
      var recipients = (p.recipients || []).filter(function (r) {
        return r && r.email;
      });
      if (!recipients.length) {
        return Promise.resolve({ queued: false, skipped: 'no workspace recipients' });
      }
      return UnitaxMail.campaign({
        templateId: suspended ? 'account_suspended' : 'account_reactivated',
        category: 'transactional',
        recipients: recipients,
        audience: 'custom',
        varMap: Object.assign({
          changedBy: changedBy,
          changedAt: stamp,
          reason: suspended
            ? 'Workspace suspended by Master Administrator'
            : 'Workspace access restored by Master Administrator',
          suspendedAt: stamp,
          suspendedBy: changedBy,
          reactivatedAt: stamp,
          reactivatedBy: changedBy,
          reactivationUrl: LOGIN_URL,
          workspaceName: p.workspaceName || '',
          workspaceId: p.workspaceId || '',
          securityUrl: LOGIN_URL
        }, p.vars || {}),
        campaignTitle: (suspended ? 'Workspace suspension: ' : 'Workspace reactivation: ') +
          (p.workspaceName || p.workspaceId || 'workspace'),
        requestedBy: changedBy
      });
    },

    licenseChanged: function (p) {
      p = p || {};
      var renewed = p.renewal === true;
      var templateId = renewed
        ? 'license_renewed'
        : (p.grant ? 'workspace_licensed' : 'workspace_license_revoked');
      var stamp = nowIst();
      return oneRecipient(templateId, Object.assign({
        changedBy: 'Master Administrator',
        changedAt: stamp,
        planName: p.grant ? 'Multi-User Enterprise' : 'Standard User',
        memberLimit: p.grant ? 25 : 1,
        licensedAt: stamp,
        periodLabel: p.periodLabel || (p.grant ? 'Standard license period' : ''),
        expiryDate: p.expiryDate || 'Not available',
        daysValid: p.daysValid || p.licenseValidityDays || 0,
        previousExpiryDate: p.previousExpiryDate || 'Not available',
        renewedAt: stamp,
        renewalUrl: p.renewalUrl || LOGIN_URL + '#/utilities/aboutus',
        adminUrl: ADMIN_URL,
        revokedAt: stamp,
        revokedBy: p.changedBy || 'Master Administrator',
        impactMessage: p.impactMessage || 'Team provisioning is now unavailable until a license is granted again.'
      }, p), 'license_changed');
    },

    licenseExpiring: function (p) {
      return oneRecipient('license_expiring', Object.assign({
        planName: 'Multi-User Enterprise',
        renewalUrl: p.renewalUrl || LOGIN_URL + '#/utilities/aboutus'
      }, p), 'license_expiring');
    },

    licenseExpired: function (p) {
      return oneRecipient('license_expired', Object.assign({
        expiredAt: nowIst(),
        impactMessage: 'Team provisioning is disabled until the license is restored.',
        renewalUrl: p.renewalUrl || LOGIN_URL + '#/utilities/aboutus'
      }, p), 'license_expired');
    },

    passwordChanged: function (p) {
      return oneRecipient('password_changed', Object.assign({
        changedAt: nowIst(),
        securityUrl: LOGIN_URL + '#/utilities/profile'
      }, p), 'password_changed');
    },

    securityUpdate: function (p) {
      return oneRecipient(p.urgent ? 'security_alert' : 'security_update', Object.assign({
        actionRequired: 'No action is required.',
        securityUrl: LOGIN_URL + '#/utilities/profile'
      }, p), 'security_update');
    },

    suspiciousLogin: function (p) {
      return oneRecipient('suspicious_login_attempt', Object.assign({
        attemptedAt: nowIst(),
        blocked: 'Blocked',
        secureAccountUrl: LOGIN_URL + '#/utilities/profile'
      }, p), 'suspicious_login_attempt');
    },

    systemAlert: function (p) {
      return oneRecipient('system_alert', Object.assign({
        actionRequired: 'No action is required.',
        detailsUrl: LOGIN_URL + '#/utilities/aboutus'
      }, p), 'system_alert');
    },

    /* --- Promotional handler (admin-composable) --- */
    promotion: function (p) {
      return UnitaxMail.campaign({
        templateId: 'promotion_release',
        category: 'promotional',
        audience: p.audience || 'licensed',
        conditions: p.conditions || null,
        varMap: {
          version: p.version,
          headline: p.headline,
          featureList: p.featureList,
          releaseUrl: p.releaseUrl || LOGIN_URL,
          unsubscribeUrl: p.unsubscribeUrl || LOGIN_URL + 'unsubscribe.html'
        },
        requestedBy: p.requestedBy || 'Master Administrator'
      });
    },

    /**
     * Admin Email Center entry point.
     * payload = {
     *   templateId, category, recipients:[{email,name,vars}],
     *   audience, conditions, varMap, subjectOverride, replyTo, requestedBy,
     *   scheduledAt, campaignTitle
     * }
     */
    campaign: async function (payload) {
      payload = payload || {};
      if (!payload.templateId) throw new Error('templateId is required.');
      var hasList = Array.isArray(payload.recipients) && payload.recipients.length > 0;
      if (!hasList && !payload.audience && !payload.conditions) {
        throw new Error('Provide recipients, an audience, or audience conditions.');
      }
      var campaignId = 'CMP-' + Date.now() + '-' + hashKey(payload.templateId + (payload.campaignTitle || '')).slice(0, 6);
      var vars = await baseVars(payload.varMap || {});
      var job = {
        templateId: payload.templateId,
        event: 'campaign',
        category: payload.category || 'transactional',
        campaignId: campaignId,
        campaignTitle: payload.campaignTitle || payload.templateId,
        recipients: hasList ? payload.recipients : null,
        audience: hasList ? 'custom' : (payload.audience || 'conditions'),
        conditions: hasList ? null : (payload.conditions || null),
        vars: vars,
        subjectOverride: payload.subjectOverride || '',
        replyTo: payload.replyTo || SUPPORT_EMAIL,
        requestedBy: payload.requestedBy || 'Master Administrator',
        scheduledAt: payload.scheduledAt || null,
        status: payload.scheduledAt ? 'scheduled' : 'queued',
        createdAt: Date.now(),
        attempts: 0
      };

      await db().ref('System/EmailCampaigns/' + campaignId).set({
        id: campaignId,
        title: job.campaignTitle,
        templateId: job.templateId,
        audience: job.audience,
        requestedBy: job.requestedBy,
        status: job.status,
        scheduledAt: job.scheduledAt,
        createdAt: job.createdAt,
        recipientCount: hasList ? payload.recipients.length : null
      });

      var result = await enqueue(job);
      await db().ref('System/EmailCampaigns/' + campaignId).update({ queueKey: result.key || null });
      return Object.assign({ campaignId: campaignId }, result);
    },

    /* --- Queue monitoring for the admin Email Center --- */
    queueStats: async function () {
      var snap = await db().ref('System/EmailQueue').once('value');
      var all = snap.val() || {};
      var stats = { total: 0, queued: 0, processing: 0, sent: 0, partial: 0, failed: 0, skipped: 0, scheduled: 0 };
      Object.keys(all).forEach(function (k) {
        var s = String(all[k].status || 'queued');
        stats.total++;
        if (stats[s] != null) stats[s]++;
      });
      return stats;
    },

    watchQueue: function (callback) {
      return db().ref('System/EmailQueue').on('value', function (snap) {
        var all = snap.val() || {};
        var stats = { total: 0, queued: 0, processing: 0, sent: 0, partial: 0, failed: 0, skipped: 0, scheduled: 0 };
        Object.keys(all).forEach(function (k) {
          var s = String(all[k].status || 'queued');
          stats.total++;
          if (stats[s] != null) stats[s]++;
        });
        callback(stats);
      });
    },

    /** Client-side count only; Apps Script applies the same rules when sending. */
    previewAudience: async function (conditions) {
      conditions = conditions || {};
      var snap = await db().ref('Users').once('value');
      var rows = [];
      (snap.val() || {}) && Object.keys(snap.val() || {}).forEach(function (id) {
        var u = snap.val()[id];
        if (u && typeof u === 'object') rows.push(Object.assign({ userId: id }, u));
      });
      return rows.filter(function (u) {
        if (!u.email) return false;
        var licensed = u.multiUserLicensed === true ||
          ['multi_user', 'enterprise'].indexOf(String(u.workspacePlan || '').toLowerCase()) !== -1;
        if (conditions.license === 'licensed' && !licensed) return false;
        if (conditions.license === 'free' && licensed) return false;
        if (conditions.role && String(u.role || '') !== conditions.role) return false;
        if (conditions.status && String(u.status || 'active') !== conditions.status) return false;
        if (conditions.workspaceId && u.workspaceOwnerId !== conditions.workspaceId && u.userId !== conditions.workspaceId) return false;
        if (conditions.userId && u.userId !== conditions.userId) return false;
        if (conditions.daysToExpiry) {
          var until = u.licenseValidUntil || u.licenseExpiresAt || u.workspaceLicenseExpiry;
          if (!until) return false;
          var days = (new Date(until).getTime() - Date.now()) / 86400000;
          if (days < 0 || days > Number(conditions.daysToExpiry)) return false;
        }
        return true;
      });
    },

    flushOutbox: flushOutbox
  };

  window.UnitaxMail = UnitaxMail;
  window.flushUnitaxMailOutbox = flushOutbox;
})();
