# UniTax Pro — Professional Email System

One consistent, formal business-letter design for every transactional, account, security, lifecycle, and promotional email. Templates live in Google Sheets, are rendered by Google Apps Script, and are delivered with `MailApp` / `GmailApp` — no paid email provider.

## Files

| File | Use |
|---|---|
| `UniTax_Email_Templates.csv` | **Import this into Google Sheets** (27 templates). |
| `templates.json` | Template metadata, `requiredKeys`, and backup source. |
| `mail-gateway-api.gs` | **The ONLY Apps Script file to paste.** Renders, sends, generates/verifies OTP, processes the queue, checks license milestones, and auto-revokes expired licenses. |
| `mail-gateway.gs` | **Deprecated.** Do not paste it into the same project (duplicate function names). |
| `webapp-mail-client.js` | Browser handler: `window.UnitaxMail`. Queues events, calls OTP/preview, tracks campaigns. |
| `generate-templates.js` | Regenerates the CSV + JSON. Run `node email-templates/generate-templates.js`. |

## Design rules

- Formal letter structure: `Dear {{userName}},` -> body -> `Sincerely,` / `The UniTax Pro Team`.
- ASCII-only content: no curly quotes, em dashes, bullets, emoji, or copyright sign. This prevents `Â` mojibake after CSV import.
- **No date badge.** Context badges show only Location, IP, and Device / Browser.
- Sender name: `UniTax Pro` for system / account / security / lifecycle / personal mail; `UniTax Pro Notifications` for promotional mail.
- Promotional templates contain a visible **Unsubscribe** button plus a `List-Unsubscribe` header. Promotional sends use `GmailApp` with a `MailApp` fallback; everything else stays on `MailApp`.

---

## 1. Google Sheet

1. Open your existing template Sheet.
2. File -> Import -> Upload -> select `UniTax_Email_Templates.csv`.
3. Choose **Replace spreadsheet**. Keep the tab named `Sheet1` (hardcoded in the script).
4. Re-import whenever you regenerate the CSV. **This build has 27 templates** (was 23).

Headers:

```text
templateId | category | sender | subject | htmlBody | textBody | requiredKeys | active | updatedAt | description
```

Set `active = FALSE` to disable a template without deleting it.

---

## 2. Apps Script deployment

1. Create a new Apps Script project (or clear the old one).
2. Paste **only** `mail-gateway-api.gs`.
3. Run `diagnoseConfig()` once to authorize and confirm the Sheet ID / tab.
4. Run `installUnitaxTriggers()` once. It installs:
   - `processEmailQueue()` — every 1 minute
   - `checkLicenseExpiry()` — daily at 06:00 IST
5. Deploy -> Manage deployments -> **edit -> New version** so your existing URL stays the same.
6. Use the `/exec` URL as `UnitaxMail.endpoint` in `webapp-mail-client.js` (already set to the current deployment).

### If lifecycle emails do not arrive

After a suspend / reactivate / delete action, check Firebase:

```text
System/EmailQueue   -> should contain a new record with status "queued"
System/EmailLogs    -> should contain a "sent" record within 1 minute
```

- No `System/EmailQueue` record: the browser is still running an old `admin.html` or `webapp-mail-client.js`. Upload both and hard-refresh.
- Queue record stays `queued`: `installUnitaxTriggers()` was not run in Apps Script, or the daily cap was reached.
- Queue record is `sent` but no email arrives: check spam and the sending account's Gmail quota.

### Confirm the correct code is deployed

Open this URL (no token needed):

```text
https://script.google.com/macros/s/AKfycbx7NIHQPjtDxOxCh8hj2CrxV1EtuTM6DxJ-jowWDjWpcKd3-4GM6RFuJIObjDI12H92/exec?action=health
```

Expected response contains:

```text
"version": "mail-gateway-api.gs|2026-11-26-full-lifecycle-v6"
```

If it says **"Unauthorized mail gateway request."** or **"DEPRECATED mail-gateway.gs"**, the Web App is still running the old script. Replace the script code and create a **New version** in Deploy -> Manage deployments. The old `?mode=send` OTP format is still accepted by the new script so cached pages do not break, but the new client already uses `otp_send` / `otp_verify`.

Optional Script Properties:

| Property | Default in code |
|---|---|
| `MAIL_GATEWAY_TOKEN` | hardcoded test token (replace in production) |
| `FIREBASE_SECRET` | empty (rules are currently open) |
| `FIREBASE_DB_URL` | `https://unitax-8d2e2-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `UNSUB_ONE_CLICK` | unset (do not advertise one-click POST unless you have a real endpoint) |

Quota guard: the queue processor stops at 90 sends/day (Gmail `MailApp` free allowance is about 100/day), leaving the rest queued for the next day.

### Sender avatar / DP

The avatar shown next to emails in Gmail is controlled by the sending Google account, not by Apps Script or the email HTML. To replace a personal DP with your app DP:

1. Sign in to `prounitax@gmail.com`.
2. Open `myaccount.google.com` -> **Personal info** -> **Profile picture**.
3. Upload the UniTax Pro app DP.
4. Wait a few hours for Gmail clients to refresh the cached avatar.

For the cleanest branding, use a dedicated Google Workspace user with the UniTax Pro DP and set `transactionalFrom` / `marketingFrom` in `mail-gateway-api.gs` to that address. A verified Gmail "Send mail as" alias changes the From name/address, but Gmail can still show the underlying account's profile photo.

---

## 3. Who sends what (important)

### Fully automatic — never composed by an admin

| Event | Template |
|---|---|
| Login / signup / forgot / resend / master 2FA OTP | `otp_login`, `otp_signup`, `forgot_password`, `otp_resend`, `otp_master_2fa` |
| Account created / deleted / suspended / reactivated | `account_created`, `account_deleted`, `account_suspended`, `account_reactivated` |
| Password changed / suspicious login | `password_changed`, `suspicious_login_attempt` |
| Security update / alert / overview | `security_update`, `security_alert`, `account_security` |
| License purchased / renewed / revoked | `workspace_licensed`, `license_renewed`, `workspace_license_revoked` |
| License 7-day / 3-day / today / expired | `license_expiring_7day`, `license_expiring_3day`, `license_expiring_today`, `license_expired`, `license_expiring` |
| Failed system check fallback | `system_alert` |

Activity-driven system emails (OTP, account, security, license, expiry) are generated automatically. They are **not** composed or queued from the admin activity screens.

The admin **Email Center** queues only:

- promotional / announcement campaigns
- `custom_message` personal messages

System broadcasts from the **System Broadcasts** tab remain in-app only.

### Admin-composable — only these two kinds

| Category | Templates |
|---|---|
| Promotional | `promotion_release`, `system_maintenance`, `broadcast_announcement` |
| Personal message | `custom_message` |

The **Email Center** loads only these categories from `templates.json`. Promotions created in the Promotions tab are also delivered through `UnitaxMail.promotion`.

OTP is generated and verified **server-side** in Apps Script (SHA-256 hash stored in `System/OtpRequests`, 10-minute expiry, 45-second resend cooldown, 5 attempt limit). Nothing OTP-related trusts the browser.

All browser writes go to `System/EmailQueue` — **the Apps Script token is never exposed in client code**. If Firebase is unreachable, jobs are cached in `localStorage` (`unitax_mail_outbox_v1`) and retried on the next page load.

---

## 4. License activation and expiry

### Admin activation flow

Admin console -> **Paid & Multi-User Licensed Workspaces** -> **Grant Multi-User**.

A modal asks for the period:

- 1 month (30 days)
- 3 months (90 days)
- 6 months (180 days)
- 1 year (365 days, default)
- Custom — enter number of days

On activation the following are written to both `Users/<ownerId>` and
`Users/<ownerId>/workspace/WorkspaceSettings`:

```text
multiUserLicensed: true
workspacePlan: "multi_user"
multiUserQuota: 25
role: "administrator"              (top-level owner record only)
masterControl: "administration"    (top-level owner record only)
licenseValidUntil: <epoch ms>
licenseValidityDays: <number>
periodLabel: "1 year" / "45 days (custom)"
licenseAutoRevoked: false
```

The workspace table shows the expiry date and a color-coded days-remaining badge. The activation email includes the selected period and expiry date.

### Automatic reminder schedule

`checkLicenseExpiry()` runs daily at 06:00 IST and computes the difference in **IST calendar days** (so an expiry at any time on the same date is handled correctly).

| Days remaining | Template | Action |
|---|---|---|
| 7 | `license_expiring_7day` | One first reminder |
| 3 | `license_expiring_3day` | One second reminder |
| 0 (expiry date) | `license_expiring_today` | Final reminder |
| < 0 | `license_expired` | Expiry notice + automatic downgrade |
| 1-6 but not 3/0 (missed trigger) | `license_expiring` | Catch-up reminder |

Rules:

- One email job per **workspace**, sent to the owner and all workspace members (max 25 recipients, deduplicated by email).
- Idempotency key: `license|<workspaceId>|<milestone>|<yyyy-MM-dd>`. A second manual run on the same day will not duplicate the email.
- At expiry the owner is downgraded once to `standard_user` / `masterControl: "operations"` / `multiUserLicensed: false` / `multiUserQuota: 1`, with `licenseAutoRevoked: true` so it happens only once.
- To restore access, grant a new license period; this clears `licenseAutoRevoked` and starts a fresh reminder cycle.

Manual triggers (token required):

```text
?action=check_licenses&token=<MAIL_GATEWAY_TOKEN>
?action=process_queue&token=<MAIL_GATEWAY_TOKEN>
```

---

## 5. Admin Email Center

Admin console -> **Platform Communications -> Email Center**.

- Template list is restricted to promotional + `custom_message`.
- Recipients: individual addresses, audience group, or conditions (license, status, role, days-to-expiry, workspace, user).
- Preview the fully rendered HTML before queueing.
- Count matching recipients before sending.
- Optional subject override, reply-to, and scheduled send time.
- Campaign history, queue status, attempts, and errors are visible in the same tab.

For `custom_message`, fill `messageTitle` and `messageBody`. `actionRequired` and `detailsUrl` default automatically. The recipient may reply to the message.

---

## 6. Template IDs (27)

### Automatic

`otp_login`, `otp_signup`, `otp_resend`, `otp_master_2fa`, `account_created`, `account_deleted`, `account_suspended`, `account_reactivated`, `forgot_password`, `password_reset`, `password_changed`, `security_update`, `security_alert`, `suspicious_login_attempt`, `account_security`, `workspace_licensed`, `license_renewed`, `workspace_license_revoked`, `license_expiring`, `license_expiring_7day`, `license_expiring_3day`, `license_expiring_today`, `license_expired`, `system_alert`

### Admin-composable

`promotion_release`, `system_maintenance`, `broadcast_announcement`, `custom_message`

---

## 7. Dynamic keys

Injected automatically: `appName`, `supportEmail`, `year`, `loginUrl`.

Context badges (account/security/license templates): `ipAddress`, `approxLocation`, `device`, `browser`. Missing values render as `Not available`.

Per-template keys are stored in `requiredKeys` and in `templates.json`. Add `&strict=1` to an API call to fail instead of writing `Not available` when a key is missing.

Newline-friendly keys: `featureList`, `announcementMessage`, `updateMessage`, `reason`, `impactMessage`, `actionRequired`, `securitySummary`, `alertMessage`, `updateTitle`, `messageBody`, `announcementDetails`.

---

## 8. API actions

Base URL: `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`

| Action | Auth | Purpose |
|---|---|---|
| `otp_send` | `appKey` | Generate + email a server-side OTP |
| `otp_verify` | `appKey` | Verify OTP server-side |
| `preview` | `appKey` | Render HTML without sending |
| `send` | `token` | Immediate single send (admin/test links) |
| `test_send` / `enqueue` | `token` | Queue a single job |
| `process_queue` | `token` | Manually run one queue batch |
| `check_licenses` | `token` | Manually run milestone check |

Example OTP send (no secret in browser):

```text
?action=otp_send&appKey=unitax-web-v5&templateId=otp_login&email=user@example.com&purpose=login&name=User&ipAddress=103.24.5.9&approxLocation=New+Delhi,+India&device=Desktop&browser=Chrome
```

Example preview:

```text
?action=preview&appKey=unitax-web-v5&templateId=custom_message&userName=Test+User&messageTitle=Hello&messageBody=This+is+a+personal+message.
```

---

## 9. Operational rules

- Keep `MAIL_GATEWAY_TOKEN` secret. It is only for direct admin API calls.
- Promotional templates include unsubscribe; transactional/security/personal templates intentionally do not.
- `{{messageBody}}`, `{{featureList}}`, `{{announcementMessage}}` etc. are HTML-escaped and newlines become `<br>`. Do not pass raw HTML.
- IP + location are approximate, derived from `https://ipwho.is/` public-IP lookup. No browser geolocation permission or click is used. Lookup failure never blocks OTP.
- Gmail may only show its native unsubscribe button for authenticated bulk senders; the in-body button always appears.
