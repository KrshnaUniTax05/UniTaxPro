/**
 * Google Apps Script — UniTax Pro OTP Server
 * Deploy as Web App (Execute as: Me, Who has access: Anyone)
 *
 * Supports `purpose` query param so the same endpoint can serve:
 *   - Admin login          (purpose=Admin+login)
 *   - User/Useradmin login (purpose=User%2FUseradmin+login)
 *   - Forgot password      (purpose=forgot+password+login)
 *
 * Returns JSON: { status, email, otp, message } so the client can verify the OTP.
 */
function doGet(e) {
  // 1. Get email and purpose from URL parameters
  var email = e.parameter.email || "universaltechz786@gmail.com";
  var purpose = (e.parameter.purpose || "User/Useradmin login").trim();

  // 2. Validate email
  if (!email || !email.includes("@")) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: "Please provide a valid email using ?email=your@email.com"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Normalise purpose into a friendly label
  var purposeLabel = purpose;
  var lower = purpose.toLowerCase();
  if (lower.indexOf("admin") !== -1) {
    purposeLabel = "Admin Login";
  } else if (lower.indexOf("forgot") !== -1) {
    purposeLabel = "Password Reset";
  } else {
    purposeLabel = "Account Login";
  }

  // 4. Generate OTP
  var otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 5. Build professional HTML email body
  var htmlBody = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { margin:0; padding:0; background:#f4f7fc; font-family:'Segoe UI',Roboto,Arial,sans-serif; color:#1a2b4c; }
      .wrapper { width:100%; background:#f4f7fc; padding:40px 0; }
      .container { max-width:600px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.05); border:1px solid #e6ecf3; }
      .header { background:linear-gradient(135deg,#0b2b5c 0%,#1a4a8a 100%); padding:32px 40px; }
      .header h1 { margin:0; color:#fff; font-size:24px; font-weight:700; }
      .header .subtitle { color:#a8c4e8; font-size:13px; margin-top:4px; }
      .content { padding:40px; }
      .content h2 { font-size:22px; color:#0b2b5c; margin:0 0 8px 0; }
      .content p { font-size:15px; line-height:1.6; color:#4a5b73; margin:0 0 24px 0; }
      .purpose-badge { display:inline-block; background:#e8f0fa; color:#0b2b5c; font-size:12px; font-weight:600; padding:6px 14px; border-radius:20px; margin-bottom:20px; }
      .otp-box { background:#f0f5fc; border-radius:12px; padding:24px; text-align:center; margin:28px 0; border:1px dashed #b8cde0; }
      .otp-code { font-size:42px; font-weight:800; letter-spacing:8px; color:#0b2b5c; font-family:'Courier New',monospace; margin:0; }
      .otp-note { font-size:13px; color:#7a8ba3; margin-top:12px; }
      .footer { padding:24px 40px; border-top:1px solid #e6ecf3; background:#fafcff; }
      .footer p { font-size:12px; color:#8a9bb5; margin:4px 0; }
      .footer a { color:#1a4a8a; text-decoration:none; font-weight:500; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <h1>UniTax Pro</h1>
          <div class="subtitle">Intelligence for Modern Enterprise</div>
        </div>
        <div class="content">
          <h2>Your One-Time Password</h2>
          <p>Use the verification code below to complete your secure sign-in.</p>
          <div class="purpose-badge">${purposeLabel}</div>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="otp-note">Enter this code to verify your identity</div>
          </div>
          <p style="font-size:14px; color:#7a8ba3;">If you did not request this code, please ignore this email.</p>
        </div>
        <div class="footer">
          <p><strong>UniTax Technologies Global</strong></p>
          <p>© 2026 UniTax Technologies Global. All rights reserved.</p>
          <p>Reply to: <a href="mailto:universaltechz786@gmail.com">universaltechz786@gmail.com</a></p>
        </div>
      </div>
    </div>
  </body>
  </html>`;

  // 6. Send email
  try {
    MailApp.sendEmail({
      to: email,
      subject: "UniTax Pro – Your One-Time Password (OTP) for " + purposeLabel,
      htmlBody: htmlBody,
      replyTo: "universaltechz786@gmail.com",
      name: "UniTax Pro"
    });
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: "Email failed: " + err.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 7. Return OTP back to the requesting URL person
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "success",
      email: email,
      purpose: purpose,
      otp: otp,
      message: "OTP sent to " + email + " and returned here."
    }))
    .setMimeType(ContentService.MimeType.JSON);
}