/*
 * UniTax Pro - Professional email template generator
 * ---------------------------------------------------
 * Produces:
 *   UniTax_Email_Templates.csv  -> import into Google Sheets (tab: Templates or Sheet1)
 *   templates.json              -> backup / source of truth
 *
 * CONTENT IS ASCII-ONLY. Curly quotes, em dashes, middle dots, emoji and the
 * copyright sign are the cause of mojibake (for example "A-circumflex")
 * when a CSV is imported into Google Sheets.
 *
 * Run: node email-templates/generate-templates.js
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

const NAVY = '#1e3a5f';
const INK = '#1f2937';
const BODY = '#4b5563';
const MUTED = '#6b7280';
const LINE = '#e2e8f0';
const PANEL = '#f8fafc';

/* --------------------------- shared blocks --------------------------- */

function contextStrip() {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 6px;">
    <tr>
      <td style="padding:13px 15px;background:${PANEL};border:1px solid ${LINE};border-radius:6px;font-family:${SANS};font-size:12px;line-height:1.8;color:${MUTED};">
        <span style="display:inline-block;padding:4px 10px;margin:0 6px 6px 0;background:#ffffff;border:1px solid #dbe3ec;border-radius:4px;">Location: <strong style="color:${INK};">{{approxLocation}}</strong></span>
        <span style="display:inline-block;padding:4px 10px;margin:0 6px 6px 0;background:#ffffff;border:1px solid #dbe3ec;border-radius:4px;">IP: <strong style="color:${INK};font-family:${MONO};">{{ipAddress}}</strong></span>
        <span style="display:inline-block;padding:4px 10px;margin:0 6px 6px 0;background:#ffffff;border:1px solid #dbe3ec;border-radius:4px;">{{device}} / {{browser}}</span>
      </td>
    </tr>
  </table>`;
}

function button(url, label, accent) {
  if (!url || !label) return '';
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;">
    <tr>
      <td bgcolor="${accent}" style="border-radius:5px;">
        <a href="${url}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:.01em;color:#ffffff;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function footerBlock(t) {
  const promo = t.category === 'promotional';
  const identity = promo ? 'UniTax Pro Notifications' : 'UniTax Pro';

  const note = promo
    ? `<div style="margin-bottom:14px;">You are receiving this because you subscribed to UniTax Pro Notifications.</div>
       <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 14px;">
         <tr>
           <td bgcolor="#ffffff" style="border:1px solid #cbd5e0;border-radius:5px;">
             <a href="{{unsubscribeUrl}}" style="display:inline-block;padding:9px 20px;font-family:${SANS};font-size:12px;font-weight:600;color:${BODY};text-decoration:none;">Unsubscribe</a>
           </td>
         </tr>
       </table>`
    : t.category === 'custom'
      ? `<div style="margin-bottom:10px;">This is a personal message sent to you by the UniTax Pro team. You may reply to this email.</div>`
      : `<div style="margin-bottom:10px;">This is an automated account or security notification from UniTax Pro. Please do not reply.</div>`;

  return `
        <td style="border-top:1px solid ${LINE};padding:24px 44px 28px 44px;background:#fbfcfe;font-family:${SANS};font-size:11px;line-height:1.9;color:${MUTED};">
          <div style="font-weight:700;color:${BODY};letter-spacing:.02em;">${identity}</div>
          ${note}
          <div style="margin-top:10px;">{{appName}} | <a href="mailto:{{supportEmail}}" style="color:${MUTED};text-decoration:underline;">{{supportEmail}}</a></div>
          <div>Copyright {{year}} UniTax Pro. All rights reserved.</div>
        </td>`;
}

function wrap(t) {
  const accent = t.accent || NAVY;
  const context = t.context ? contextStrip() : '';
  const cta = button(t.ctaUrl, t.ctaLabel, accent);
  const tag = t.category === 'promotional' ? 'PRODUCT UPDATES' : (t.category === 'custom' ? 'PERSONAL MESSAGE' : 'SECURE NOTIFICATION');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${t.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:34px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid ${LINE};border-radius:9px;">
        <tr>
          <td height="4" bgcolor="${accent}" style="font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:26px 44px 20px 44px;border-bottom:1px solid ${LINE};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family:${SANS};font-size:19px;font-weight:700;color:${NAVY};letter-spacing:-.01em;">UniTax Pro</td>
                <td align="right" style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:.12em;color:${MUTED};text-transform:uppercase;">${tag}</td>
              </tr>
            </table>
            <div style="margin-top:10px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${accent};">${t.eyebrow}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 44px 36px 44px;">
            <p style="margin:0 0 22px 0;font-family:${SANS};font-size:15px;line-height:1.8;color:${BODY};">Dear {{userName}},</p>
            <p style="margin:0 0 6px 0;font-family:${SANS};font-size:15px;line-height:1.85;color:${BODY};">${t.intro}</p>
            ${context}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
              <tr>
                <td style="padding:20px 22px;background:${PANEL};border:1px solid ${LINE};border-left:3px solid ${accent};border-radius:5px;font-family:${SANS};font-size:14px;line-height:1.85;color:${BODY};">
                  ${t.content}
                </td>
              </tr>
            </table>
            ${cta}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:34px;">
              <tr><td width="34" height="1" bgcolor="${LINE}" style="font-size:0;line-height:0;">&nbsp;</td><td>&nbsp;</td></tr>
            </table>
            <p style="margin:14px 0 4px 0;font-family:${SANS};font-size:15px;line-height:1.7;color:${BODY};">Sincerely,</p>
            <p style="margin:0;font-family:${SANS};font-size:15px;font-weight:700;color:${INK};">The UniTax Pro Team</p>
          </td>
        </tr>
        <tr>
${footerBlock(t)}
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function textBody(t) {
  const context = t.context
    ? `\nRequest context:\nLocation: {{approxLocation}}\nIP: {{ipAddress}}\nDevice: {{device}} / {{browser}}\n`
    : '';
  const cta = t.ctaUrl && t.ctaLabel ? `\n${t.ctaLabel}: ${t.ctaUrl}\n` : '';
  const sign = t.category === 'promotional'
    ? `\nUniTax Pro Notifications\nUnsubscribe: {{unsubscribeUrl}}`
    : '\nUniTax Pro\nThis is an automated notification. Please do not reply.';
  return `Dear {{userName}},\n\n${t.intro}\n${context}\n${t.text}\n${cta}\nSincerely,\nThe UniTax Pro Team\n---\n{{appName}} | {{supportEmail}}\nCopyright {{year}} UniTax Pro. All rights reserved.${sign}`;
}

/* --------------------------- definitions --------------------------- */

const COMMON_KEYS = ['appName', 'supportEmail', 'year', 'loginUrl'];
const CONTEXT_KEYS = ['ipAddress', 'approxLocation', 'device', 'browser'];

function def(t) {
  return {
    templateId: t.id,
    active: 'TRUE',
    updatedAt: '2026-11-26',
    category: t.category,
    sender: t.category === 'promotional' ? 'marketing' : 'transactional',
    requiredKeys: Array.from(new Set([...COMMON_KEYS, ...(t.keys || []), ...(t.context ? CONTEXT_KEYS : [])])),
    htmlBody: wrap(t),
    textBody: textBody(t),
    ...t
  };
}

const templates = [
  def({
    id: 'otp_login', category: 'transactional', accent: NAVY, context: true,
    eyebrow: 'One-time password', title: 'Your sign-in code',
    subject: '{{appName}} login OTP: {{otp}}',
    intro: 'We received a request to sign in to your UniTax Pro account. Use the code below to complete verification.',
    content: `<p style="margin:0 0 12px 0;">Your one-time password is:</p>
      <div style="font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:7px;color:${INK};background:#ffffff;border:1px dashed #b8c4d2;border-radius:6px;padding:18px;text-align:center;">{{otp}}</div>
      <p style="margin:14px 0 0 0;font-size:13px;color:${MUTED};">Valid for {{expiryMinutes}} minutes. Never share this code with anyone, including UniTax Pro staff.</p>`,
    text: `Your one-time password is {{otp}}. Valid for {{expiryMinutes}} minutes. Never share this code with anyone.`,
    ctaUrl: '{{loginUrl}}', ctaLabel: 'Open secure sign-in',
    keys: ['userName', 'otp', 'expiryMinutes', 'userEmail'],
    description: 'Login OTP with location and IP badges.'
  }),
  def({
    id: 'otp_signup', category: 'transactional', accent: NAVY, context: true,
    eyebrow: 'Verify your account', title: 'Welcome to UniTax Pro',
    subject: 'Verify your new {{appName}} account',
    intro: 'Your workspace has been created. Confirm the request using the verification code below.',
    content: `<div style="font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:7px;color:${INK};background:#ffffff;border:1px dashed #b8c4d2;border-radius:6px;padding:18px;text-align:center;">{{otp}}</div>
      <p style="margin:14px 0 0 0;font-size:13px;color:${MUTED};">Workspace: {{workspaceName}} ({{workspaceId}}). Code expires in {{expiryMinutes}} minutes.</p>`,
    text: `Your signup verification code is {{otp}} for workspace {{workspaceName}} ({{workspaceId}}). Expires in {{expiryMinutes}} minutes.`,
    ctaUrl: '{{loginUrl}}', ctaLabel: 'Verify your account',
    keys: ['userName', 'otp', 'expiryMinutes', 'workspaceName', 'workspaceId'],
    description: 'Signup verification OTP with request context.'
  }),
  def({
    id: 'otp_resend', category: 'transactional', accent: NAVY, context: true,
    eyebrow: 'New verification code', title: 'Your new code',
    subject: 'New {{appName}} OTP: {{otp}}',
    intro: 'You requested a fresh one-time password for your UniTax Pro account.',
    content: `<div style="font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:7px;color:${INK};background:#ffffff;border:1px dashed #b8c4d2;border-radius:6px;padding:18px;text-align:center;">{{otp}}</div>
      <p style="margin:14px 0 0 0;font-size:13px;color:${MUTED};">This code replaces any earlier code and is valid for {{expiryMinutes}} minutes.</p>`,
    text: `Your new one-time password is {{otp}}. It replaces earlier codes and expires in {{expiryMinutes}} minutes.`,
    ctaUrl: '{{loginUrl}}', ctaLabel: 'Verify now',
    keys: ['userName', 'otp', 'expiryMinutes'],
    description: 'Resend OTP; older codes are invalidated.'
  }),
  def({
    id: 'otp_master_2fa', category: 'transactional', accent: NAVY, context: true,
    eyebrow: 'Master console verification', title: 'Second-factor code required',
    subject: '{{appName}} master console code: {{otp}}',
    intro: 'A second-factor code was requested for the UniTax Pro master console.',
    content: `<div style="font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:7px;color:${INK};background:#ffffff;border:1px dashed #b8c4d2;border-radius:6px;padding:18px;text-align:center;">{{otp}}</div>
      <p style="margin:14px 0 0 0;font-size:13px;color:${MUTED};">Valid for {{expiryMinutes}} minutes. If you did not request this, contact {{supportEmail}} immediately.</p>`,
    text: `Master console verification code: {{otp}}. Valid for {{expiryMinutes}} minutes.`,
    ctaUrl: '{{adminUrl}}', ctaLabel: 'Open master console',
    keys: ['adminName', 'otp', 'expiryMinutes', 'adminUrl'],
    description: 'Master admin 2FA with request context.'
  }),
  def({
    id: 'account_created', category: 'transactional', accent: '#2f6f4f', context: true,
    eyebrow: 'Account created', title: 'Your workspace is ready',
    subject: 'Welcome to {{appName}}, {{userName}}',
    intro: 'Your UniTax Pro account has been provisioned successfully. Your workspace details are below.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Email</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{userEmail}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Workspace</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{workspaceName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Workspace ID</td><td style="padding:5px 0;font-family:${MONO};font-weight:600;color:${NAVY};">{{workspaceId}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Role</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{roleName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Created</td><td style="padding:5px 0;color:${BODY};">{{createdAt}} by {{createdBy}}</td></tr>
      </table>`,
    text: `Your UniTax Pro account was created for {{userName}} ({{userEmail}}). Workspace: {{workspaceName}} / {{workspaceId}}. Role: {{roleName}}. Created {{createdAt}} by {{createdBy}}.`,
    ctaUrl: '{{loginUrl}}', ctaLabel: 'Sign in to your workspace',
    keys: ['userName', 'userEmail', 'workspaceName', 'workspaceId', 'roleName', 'createdAt', 'createdBy'],
    description: 'Sent after signup or master provisioning.'
  }),
  def({
    id: 'account_deleted', category: 'transactional', accent: '#9b2c2c', context: true,
    eyebrow: 'Account deleted', title: 'Account removal confirmation',
    subject: 'Account deleted: {{workspaceId}}',
    intro: 'Your UniTax Pro account and workspace access have been permanently removed.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Workspace</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{workspaceName}} ({{workspaceId}})</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Deleted</td><td style="padding:5px 0;color:${BODY};">{{deletedAt}} by {{deletedBy}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Reason</td><td style="padding:5px 0;color:${BODY};">{{reason}}</td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:13px;color:${MUTED};">If you did not request this, contact {{supportEmail}} immediately.</p>`,
    text: `Your UniTax Pro account {{workspaceId}} was deleted on {{deletedAt}} by {{deletedBy}}. Reason: {{reason}}.`,
    ctaUrl: 'mailto:{{supportEmail}}', ctaLabel: 'Contact support',
    keys: ['userName', 'workspaceName', 'workspaceId', 'deletedAt', 'deletedBy', 'reason'],
    description: 'Permanent deletion confirmation.'
  }),
  def({
    id: 'account_suspended', category: 'transactional', accent: '#8a5a12', context: true,
    eyebrow: 'Account suspended', title: 'Your access is temporarily paused',
    subject: '{{appName}} account suspended',
    intro: 'Access to your UniTax Pro workspace has been temporarily suspended by an administrator.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Workspace</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{workspaceName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Suspended</td><td style="padding:5px 0;color:${BODY};">{{suspendedAt}} by {{suspendedBy}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Reason</td><td style="padding:5px 0;color:${BODY};">{{reason}}</td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:13px;color:${MUTED};">Your data is safe. You can sign in again once access is restored.</p>`,
    text: `Access to your UniTax Pro workspace was suspended on {{suspendedAt}} by {{suspendedBy}}. Reason: {{reason}}.`,
    ctaUrl: '{{reactivationUrl}}', ctaLabel: 'Check reactivation status',
    keys: ['userName', 'workspaceName', 'workspaceId', 'suspendedAt', 'suspendedBy', 'reason', 'reactivationUrl'],
    description: 'Suspension notice with request context.'
  }),
  def({
    id: 'account_reactivated', category: 'transactional', accent: '#2f6f4f', context: true,
    eyebrow: 'Access restored', title: 'Welcome back',
    subject: '{{appName}} access restored',
    intro: 'Your UniTax Pro workspace access has been reactivated and is ready to use.',
    content: `<p style="margin:0 0 12px 0;">Workspace <strong style="color:${INK};">{{workspaceName}}</strong> ({{workspaceId}}) is active again as of {{reactivatedAt}}.</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">Reactivated by {{reactivatedBy}}. We recommend reviewing your recent account activity.</p>`,
    text: `Your UniTax Pro workspace {{workspaceId}} was reactivated on {{reactivatedAt}} by {{reactivatedBy}}.`,
    ctaUrl: '{{loginUrl}}', ctaLabel: 'Sign in securely',
    keys: ['userName', 'workspaceName', 'workspaceId', 'reactivatedAt', 'reactivatedBy'],
    description: 'Reactivation confirmation.'
  }),
  def({
    id: 'forgot_password', category: 'transactional', accent: NAVY, context: true,
    eyebrow: 'Password reset', title: 'Reset your password',
    subject: 'Password reset OTP: {{otp}}',
    intro: 'We received a request to reset the password for your UniTax Pro account.',
    content: `<div style="font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:7px;color:${INK};background:#ffffff;border:1px dashed #b8c4d2;border-radius:6px;padding:18px;text-align:center;">{{otp}}</div>
      <p style="margin:14px 0 0 0;font-size:13px;color:${MUTED};">Enter this code on the reset page. Valid for {{expiryMinutes}} minutes. If you did not request this, ignore this message.</p>`,
    text: `Your password reset code is {{otp}}. Valid for {{expiryMinutes}} minutes. Ignore this message if you did not request it.`,
    ctaUrl: '{{resetUrl}}', ctaLabel: 'Set a new password',
    keys: ['userName', 'userEmail', 'otp', 'expiryMinutes', 'resetUrl'],
    description: 'Forgot-password OTP with request context.'
  }),
  def({
    id: 'password_reset', category: 'transactional', accent: NAVY, context: true,
    eyebrow: 'Password reset', title: 'Reset your password',
    subject: 'Reset your {{appName}} password',
    intro: 'Use the verification code below to choose a new password for your UniTax Pro account.',
    content: `<div style="font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:7px;color:${INK};background:#ffffff;border:1px dashed #b8c4d2;border-radius:6px;padding:18px;text-align:center;">{{otp}}</div>
      <p style="margin:14px 0 0 0;font-size:13px;color:${MUTED};">Code expires in {{expiryMinutes}} minutes.</p>`,
    text: `Your password reset code is {{otp}}. Expires in {{expiryMinutes}} minutes.`,
    ctaUrl: '{{resetUrl}}', ctaLabel: 'Reset password',
    keys: ['userName', 'otp', 'expiryMinutes', 'resetUrl'],
    description: 'Legacy alias for forgot_password.'
  }),
  def({
    id: 'password_changed', category: 'transactional', accent: '#2f6f4f', context: true,
    eyebrow: 'Security confirmation', title: 'Your password was changed',
    subject: 'Your {{appName}} password was changed',
    intro: 'The password for your UniTax Pro account was updated successfully.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Changed</td><td style="padding:5px 0;color:${BODY};">{{changedAt}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Device</td><td style="padding:5px 0;color:${BODY};">{{device}} / {{browser}}</td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:13px;color:${MUTED};">If this was not you, secure your account immediately.</p>`,
    text: `Your UniTax Pro password was changed on {{changedAt}} from {{device}}. Contact support if unexpected.`,
    ctaUrl: '{{securityUrl}}', ctaLabel: 'Review account security',
    keys: ['userName', 'changedAt', 'securityUrl'],
    description: 'Post-change confirmation.'
  }),
  def({
    id: 'security_update', category: 'transactional', accent: '#9b2c2c', context: true,
    eyebrow: 'Security update', title: 'Important security information',
    subject: 'Security update: {{updateTitle}}',
    intro: 'We made a security change that affects your UniTax Pro account. Please review the details below.',
    content: `<p style="margin:0 0 10px 0;font-weight:600;color:${INK};">{{updateTitle}}</p>
      <p style="margin:0 0 12px 0;">{{updateMessage}}</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">{{actionRequired}}</p>`,
    text: `Security update: {{updateTitle}}. {{updateMessage}} {{actionRequired}}`,
    ctaUrl: '{{securityUrl}}', ctaLabel: 'Review security details',
    keys: ['userName', 'updateTitle', 'updateMessage', 'actionRequired', 'securityUrl'],
    description: 'Security policy or change notification.'
  }),
  def({
    id: 'security_alert', category: 'transactional', accent: '#9b2c2c', context: true,
    eyebrow: 'Security alert', title: 'Security notice for your account',
    subject: 'Security alert: {{updateTitle}}',
    intro: 'A security event was recorded for your UniTax Pro account. Please review it promptly.',
    content: `<p style="margin:0 0 12px 0;">{{updateMessage}}</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">{{actionRequired}}</p>`,
    text: `Security alert: {{updateMessage}} {{actionRequired}}`,
    ctaUrl: '{{securityUrl}}', ctaLabel: 'Secure my account',
    keys: ['userName', 'updateTitle', 'updateMessage', 'actionRequired', 'securityUrl'],
    description: 'Urgent security notice.'
  }),
  def({
    id: 'suspicious_login_attempt', category: 'transactional', accent: '#9b2c2c', context: true,
    eyebrow: 'Suspicious activity', title: 'We blocked a sign-in attempt',
    subject: 'Suspicious sign-in from {{approxLocation}}',
    intro: 'Someone attempted to sign in to your UniTax Pro workspace. The attempt did not succeed.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Workspace</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{workspaceName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Attempted</td><td style="padding:5px 0;color:${BODY};">{{attemptedAt}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Result</td><td style="padding:5px 0;font-weight:600;color:#9b2c2c;">{{blocked}}</td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:13px;color:${MUTED};">If this was you, no action is needed. Otherwise, reset your password now.</p>`,
    text: `A sign-in attempt was blocked for your UniTax Pro workspace from {{ipAddress}} ({{approxLocation}}) at {{attemptedAt}}. Result: {{blocked}}.`,
    ctaUrl: '{{secureAccountUrl}}', ctaLabel: 'Secure my account',
    keys: ['userName', 'workspaceName', 'attemptedAt', 'blocked', 'secureAccountUrl'],
    description: 'Blocked login alert with location and IP badges.'
  }),
  def({
    id: 'account_security', category: 'transactional', accent: '#2b6b63', context: true,
    eyebrow: 'Account security', title: 'Your security overview',
    subject: 'Account security summary for {{workspaceName}}',
    intro: 'Here is the latest security state for your UniTax Pro account.',
    content: `<p style="margin:0 0 12px 0;">{{securitySummary}}</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">Last successful sign-in: {{lastLoginAt}}</p>`,
    text: `Security summary: {{securitySummary}} Last sign-in: {{lastLoginAt}}.`,
    ctaUrl: '{{securityUrl}}', ctaLabel: 'Open security settings',
    keys: ['userName', 'workspaceName', 'securitySummary', 'lastLoginAt', 'securityUrl'],
    description: 'Periodic or on-request security summary.'
  }),
  def({
    id: 'workspace_licensed', category: 'transactional', accent: '#2f6f4f', context: true,
    eyebrow: 'License activated', title: 'Your workspace is now licensed',
    subject: 'Multi-user license active: {{workspaceName}}',
    intro: 'Your UniTax Pro workspace has been upgraded successfully. Team provisioning is now available.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Plan</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{planName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Member limit</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{memberLimit}} users</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Activated</td><td style="padding:5px 0;color:${BODY};">{{licensedAt}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Period</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{periodLabel}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Expires</td><td style="padding:5px 0;color:${BODY};">{{expiryDate}}</td></tr>
      </table>`,
    text: `Your workspace {{workspaceName}} was licensed on {{licensedAt}}. Plan: {{planName}}. Period: {{periodLabel}}. Expires: {{expiryDate}}. Member limit: {{memberLimit}}.`,
    ctaUrl: '{{adminUrl}}', ctaLabel: 'Open User Admin panel',
    keys: ['userName', 'workspaceName', 'workspaceId', 'planName', 'memberLimit', 'licensedAt', 'adminUrl', 'periodLabel', 'expiryDate'],
    description: 'Sent when a multi-user license is granted.'
  }),
  def({
    id: 'license_renewed', category: 'transactional', accent: '#2f6f4f', context: true,
    eyebrow: 'License renewed', title: 'Your license has been extended',
    subject: 'License renewed: {{workspaceName}}',
    intro: 'Your UniTax Pro multi-user license has been renewed and remains active.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Plan</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{planName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Period</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{periodLabel}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Renewed</td><td style="padding:5px 0;color:${BODY};">{{renewedAt}} by {{changedBy}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Previous expiry</td><td style="padding:5px 0;color:${BODY};">{{previousExpiryDate}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">New expiry</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{expiryDate}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Validity</td><td style="padding:5px 0;color:${BODY};">{{daysValid}} days</td></tr>
      </table>`,
    text: `Your workspace {{workspaceName}} license was renewed on {{renewedAt}} for {{periodLabel}} ({{daysValid}} days). New expiry: {{expiryDate}}. Previous expiry: {{previousExpiryDate}}.`,
    ctaUrl: '{{adminUrl}}', ctaLabel: 'Open User Admin panel',
    keys: ['userName', 'workspaceName', 'workspaceId', 'planName', 'periodLabel', 'renewedAt', 'changedBy', 'previousExpiryDate', 'expiryDate', 'daysValid', 'adminUrl'],
    description: 'Sent when an existing license is renewed or extended.'
  }),
  def({
    id: 'workspace_license_revoked', category: 'transactional', accent: '#8a5a12', context: true,
    eyebrow: 'License changed', title: 'License update for your workspace',
    subject: 'License revoked: {{workspaceName}}',
    intro: 'The multi-user license for your UniTax Pro workspace was revoked.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Workspace</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{workspaceName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Revoked</td><td style="padding:5px 0;color:${BODY};">{{revokedAt}} by {{revokedBy}}</td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:13px;color:${MUTED};">{{impactMessage}}</p>`,
    text: `The license for {{workspaceName}} was revoked on {{revokedAt}} by {{revokedBy}}. {{impactMessage}}`,
    ctaUrl: 'mailto:{{supportEmail}}', ctaLabel: 'Contact administrator',
    keys: ['userName', 'workspaceName', 'workspaceId', 'revokedAt', 'revokedBy', 'impactMessage'],
    description: 'Sent when a license is revoked.'
  }),
  def({
    id: 'promotion_release', category: 'promotional', accent: NAVY, context: false,
    eyebrow: 'What is new', title: '{{headline}}',
    subject: '{{appName}} {{version}}: {{headline}}',
    intro: 'We are pleased to share the latest updates to UniTax Pro.',
    content: `<p style="margin:0 0 10px 0;font-weight:600;color:${INK};">Release {{version}}</p>
      <div style="font-size:14px;line-height:1.9;">{{featureList}}</div>`,
    text: `Release {{version}}: {{headline}}. {{featureList}}`,
    ctaUrl: '{{releaseUrl}}', ctaLabel: 'Read release notes',
    keys: ['userName', 'version', 'headline', 'featureList', 'releaseUrl', 'unsubscribeUrl'],
    description: 'Release announcement with unsubscribe button.'
  }),
  def({
    id: 'system_maintenance', category: 'promotional', accent: NAVY, context: false,
    eyebrow: 'System notice', title: 'Scheduled maintenance',
    subject: 'Maintenance: {{appName}} on {{maintenanceDate}}',
    intro: 'UniTax Pro will be briefly unavailable for scheduled maintenance.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Date</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{maintenanceDate}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Window</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{startTime}} to {{endTime}}</td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:13px;color:${MUTED};">{{impactMessage}}</p>`,
    text: `Scheduled maintenance on {{maintenanceDate}}, {{startTime}} to {{endTime}}. {{impactMessage}}`,
    ctaUrl: '{{statusUrl}}', ctaLabel: 'Check service status',
    keys: ['userName', 'maintenanceDate', 'startTime', 'endTime', 'impactMessage', 'statusUrl', 'unsubscribeUrl'],
    description: 'Planned downtime notice with unsubscribe button.'
  }),
  def({
    id: 'broadcast_announcement', category: 'promotional', accent: NAVY, context: false,
    eyebrow: 'Announcement', title: '{{announcementTitle}}',
    subject: '{{announcementTitle}}',
    intro: 'A new announcement is available from the UniTax Pro team.',
    content: `<div style="font-size:14px;line-height:1.9;">{{announcementMessage}}</div>`,
    text: `{{announcementTitle}} - {{announcementMessage}}`,
    ctaUrl: '{{readUrl}}', ctaLabel: 'Read announcement',
    keys: ['userName', 'announcementTitle', 'announcementMessage', 'readUrl', 'unsubscribeUrl'],
    description: 'Master-admin broadcast with unsubscribe button.'
  }),
  def({
    id: 'license_expiring', category: 'transactional', accent: '#8a5a12', context: true,
    eyebrow: 'License renewal', title: 'Your license is expiring soon',
    subject: 'Action needed: {{appName}} license expires in {{daysRemaining}} days',
    intro: 'Your UniTax Pro multi-user license is approaching its renewal date. Please review it to avoid interruption.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Workspace</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{workspaceName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Plan</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{planName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Expires</td><td style="padding:5px 0;color:${BODY};">{{expiryDate}} ({{daysRemaining}} days left)</td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:13px;color:${MUTED};">Renew early so your team keeps full access without interruption.</p>`,
    text: `Your UniTax Pro license for {{workspaceName}} expires on {{expiryDate}} ({{daysRemaining}} days left). Renew at {{renewalUrl}}.`,
    ctaUrl: '{{renewalUrl}}', ctaLabel: 'Renew license',
    keys: ['userName', 'workspaceName', 'workspaceId', 'planName', 'expiryDate', 'daysRemaining', 'renewalUrl'],
    description: 'Pre-expiry renewal reminder for licensed workspaces (7/3/1 day schedule).'
  }),
  def({
    id: 'license_expiring_7day', category: 'transactional', accent: '#8a5a12', context: true,
    eyebrow: 'License renewal - 7 days', title: 'Your license expires in 7 days',
    subject: '7 days left: renew your {{appName}} license',
    intro: 'Your UniTax Pro multi-user license will expire in 7 days. Renew now to avoid any interruption for your team.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Workspace</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{workspaceName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Plan</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{planName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Expires</td><td style="padding:5px 0;color:${BODY};">{{expiryDate}}</td></tr>
      </table>`,
    text: `Your UniTax Pro license for {{workspaceName}} expires in 7 days on {{expiryDate}}. Renew at {{renewalUrl}}.`,
    ctaUrl: '{{renewalUrl}}', ctaLabel: 'Renew license now',
    keys: ['userName', 'workspaceName', 'workspaceId', 'planName', 'expiryDate', 'renewalUrl'],
    description: 'Automatic first reminder: exactly 7 days before expiry.'
  }),
  def({
    id: 'license_expiring_3day', category: 'transactional', accent: '#8a5a12', context: true,
    eyebrow: 'License renewal - 3 days', title: 'Your license expires in 3 days',
    subject: '3 days left: renew your {{appName}} license',
    intro: 'This is a second reminder that your UniTax Pro multi-user license expires in 3 days.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Workspace</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{workspaceName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Plan</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{planName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Expires</td><td style="padding:5px 0;color:${BODY};">{{expiryDate}}</td></tr>
      </table>`,
    text: `Your UniTax Pro license for {{workspaceName}} expires in 3 days on {{expiryDate}}. Renew at {{renewalUrl}}.`,
    ctaUrl: '{{renewalUrl}}', ctaLabel: 'Renew license now',
    keys: ['userName', 'workspaceName', 'workspaceId', 'planName', 'expiryDate', 'renewalUrl'],
    description: 'Automatic second reminder: exactly 3 days before expiry.'
  }),
  def({
    id: 'license_expiring_today', category: 'transactional', accent: '#a13b12', context: true,
    eyebrow: 'License renewal - today', title: 'Your license expires today',
    subject: 'Final notice: {{appName}} license expires today',
    intro: 'Your UniTax Pro multi-user license expires today. Renew today to keep your team active without interruption.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Workspace</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{workspaceName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Plan</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{planName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Expires</td><td style="padding:5px 0;color:${BODY};">{{expiryDate}}</td></tr>
      </table>`,
    text: `Your UniTax Pro license for {{workspaceName}} expires today ({{expiryDate}}). Renew at {{renewalUrl}}.`,
    ctaUrl: '{{renewalUrl}}', ctaLabel: 'Renew license today',
    keys: ['userName', 'workspaceName', 'workspaceId', 'planName', 'expiryDate', 'renewalUrl'],
    description: 'Automatic final reminder: on the expiry date.'
  }),
  def({
    id: 'license_expired', category: 'transactional', accent: '#9b2c2c', context: true,
    eyebrow: 'License expired', title: 'Your license has expired',
    subject: 'License expired: {{workspaceName}}',
    intro: 'The multi-user license for your UniTax Pro workspace has expired and the workspace is now on the free plan.',
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:5px 0;color:${MUTED};width:150px;">Workspace</td><td style="padding:5px 0;font-weight:600;color:${INK};">{{workspaceName}}</td></tr>
        <tr><td style="padding:5px 0;color:${MUTED};">Expired</td><td style="padding:5px 0;color:${BODY};">{{expiredAt}}</td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:13px;color:${MUTED};">{{impactMessage}}</p>`,
    text: `The UniTax Pro license for {{workspaceName}} expired on {{expiredAt}}. {{impactMessage}}`,
    ctaUrl: '{{renewalUrl}}', ctaLabel: 'Restore your license',
    keys: ['userName', 'workspaceName', 'workspaceId', 'expiredAt', 'impactMessage', 'renewalUrl'],
    description: 'Sent when a license reaches its expiry date.'
  }),
  def({
    id: 'system_alert', category: 'transactional', accent: NAVY, context: true,
    eyebrow: 'System alert', title: '{{alertTitle}}',
    subject: '{{appName}} alert: {{alertTitle}}',
    intro: 'This is an important system notification about your UniTax Pro account.',
    content: `<p style="margin:0 0 12px 0;">{{alertMessage}}</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">{{actionRequired}}</p>`,
    text: `{{alertTitle}}: {{alertMessage}} {{actionRequired}}`,
    ctaUrl: '{{detailsUrl}}', ctaLabel: 'View details',
    keys: ['userName', 'alertTitle', 'alertMessage', 'actionRequired', 'detailsUrl'],
    description: 'Generic system / platform alert sent by master administrators.'
  }),
  def({
    id: 'custom_message', category: 'custom', accent: NAVY, context: false,
    eyebrow: 'Personal message', title: '{{messageTitle}}',
    subject: '{{messageTitle}}',
    intro: 'The UniTax Pro team has sent you a personal message.',
    content: `<p style="margin:0 0 12px 0;">{{messageBody}}</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">{{actionRequired}}</p>`,
    text: `{{messageTitle}} {{messageBody}} {{actionRequired}}`,
    ctaUrl: '{{detailsUrl}}', ctaLabel: 'Read more',
    keys: ['userName', 'messageTitle', 'messageBody', 'actionRequired', 'detailsUrl'],
    description: 'Admin-composed personal message to connect with a user or audience.'
  })
];

/* --------------------------- output --------------------------- */

const headers = ['templateId', 'category', 'sender', 'subject', 'htmlBody', 'textBody', 'requiredKeys', 'active', 'updatedAt', 'description'];
const csvCell = value => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
const csv = '\uFEFF' + [
  headers.join(','),
  ...templates.map(t => headers.map(h => csvCell(t[h])).join(','))
].join('\r\n');

fs.writeFileSync(path.join(OUT_DIR, 'UniTax_Email_Templates.csv'), csv, 'utf8');
fs.writeFileSync(
  path.join(OUT_DIR, 'templates.json'),
  JSON.stringify(templates.map(({ htmlBody, textBody, ...rest }) => rest), null, 2) + '\n',
  'utf8'
);

console.log('Generated ' + templates.length + ' professional templates.');
console.log('- UniTax_Email_Templates.csv (import into Google Sheets)');
console.log('- templates.json (source / backup)');
