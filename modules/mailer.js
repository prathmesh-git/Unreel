const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// ── Transport singletons ─────────────────────────────────────────────────────
let _resend;
let _nodemailerTransporter;
let _nodemailerConfig;

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Resend (HTTP API – works on Render free tier) ────────────────────────────
function getResend() {
  if (_resend) return _resend;
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return null;
  _resend = new Resend(apiKey);
  return _resend;
}

// ── Nodemailer (SMTP – fallback for local dev / paid hosts) ──────────────────
function getNodemailerTransporter() {
  if (_nodemailerTransporter) return _nodemailerTransporter;

  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number((process.env.SMTP_PORT || '587').trim());
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase().trim() === 'true' || port === 465;
  const requireTLS = String(process.env.SMTP_REQUIRE_TLS || '').toLowerCase().trim() === 'true';
  const ignoreTLS = String(process.env.SMTP_IGNORE_TLS || '').toLowerCase().trim() === 'true';
  const rejectUnauthorized = String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || '').toLowerCase().trim() !== 'false';

  if (!host || !user || !pass) return null;

  _nodemailerConfig = {
    host,
    port,
    secure,
    requireTLS,
    ignoreTLS,
    family: 4,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000),
    auth: { user, pass },
    tls: { rejectUnauthorized },
  };

  _nodemailerTransporter = nodemailer.createTransport(_nodemailerConfig);
  return _nodemailerTransporter;
}

// ── Which transport is active? ───────────────────────────────────────────────
function useResend() {
  return Boolean(getResend());
}

// ── Sender helpers ───────────────────────────────────────────────────────────
function resolveFrom(siteName) {
  const envFrom = (process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.MAIL_FROM || '').trim();
  if (envFrom) return envFrom;
  const smtpUser = (process.env.SMTP_USER || '').trim();
  return `"${siteName}" <${smtpUser}>`;
}

function buildSenderOptions(siteName) {
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const desiredFrom = resolveFrom(siteName);
  const useCustomFrom = Boolean(process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.MAIL_FROM);

  if (useCustomFrom && smtpUser) {
    return {
      from: desiredFrom,
      sender: smtpUser,
      replyTo: desiredFrom,
      envelope: { from: smtpUser },
    };
  }

  return {
    from: desiredFrom,
    replyTo: desiredFrom,
    envelope: smtpUser ? { from: smtpUser } : undefined,
  };
}

// ── Diagnostics & verification ───────────────────────────────────────────────
function serializeMailError(err) {
  if (!err) return { message: 'Unknown mail error' };
  return {
    message: err.message,
    code: err.code || null,
    command: err.command || null,
    responseCode: err.responseCode || null,
    response: err.response || null,
  };
}

function getMailDiagnostics() {
  const isResend = useResend();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  return {
    transport: isResend ? 'resend' : 'smtp',
    configured: isResend
      ? Boolean(process.env.RESEND_API_KEY)
      : Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    hostConfigured: Boolean(process.env.SMTP_HOST),
    port,
    userConfigured: Boolean(process.env.SMTP_USER),
    passConfigured: Boolean(process.env.SMTP_PASS),
    fromConfigured: Boolean(process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.MAIL_FROM),
    secure,
    requireTLS: String(process.env.SMTP_REQUIRE_TLS || '').toLowerCase() === 'true',
    ignoreTLS: String(process.env.SMTP_IGNORE_TLS || '').toLowerCase() === 'true',
    tlsRejectUnauthorized: String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || '').toLowerCase() !== 'false',
    usingCustomFrom: Boolean(process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.MAIL_FROM),
  };
}

async function verifyMailTransport() {
  // Resend: send a lightweight API call to confirm the key is valid.
  if (useResend()) {
    try {
      const resend = getResend();
      await resend.domains.list();
      return { ok: true, transport: 'resend' };
    } catch (err) {
      return { ok: false, transport: 'resend', reason: 'Resend API verification failed.', error: serializeMailError(err) };
    }
  }

  // Nodemailer fallback
  const mailer = getNodemailerTransporter();
  if (!mailer) {
    return { ok: false, reason: 'No email transport configured. Set RESEND_API_KEY or SMTP_HOST/USER/PASS.' };
  }

  try {
    await mailer.verify();
    return {
      ok: true,
      transport: 'smtp',
      config: {
        host: _nodemailerConfig?.host,
        port: _nodemailerConfig?.port,
        secure: _nodemailerConfig?.secure,
      },
    };
  } catch (err) {
    return { ok: false, transport: 'smtp', reason: 'SMTP verify failed.', error: serializeMailError(err) };
  }
}

// ── Core send helper ─────────────────────────────────────────────────────────
async function sendMail({ from, to, replyTo, subject, text, html }) {
  console.log(`[Unreel] sendMail → transport=${useResend() ? 'resend' : 'smtp'} from="${from}" to="${to}" subject="${subject}"`);

  if (useResend()) {
    const resend = getResend();
    const { data, error } = await resend.emails.send({ from, to: Array.isArray(to) ? to : [to], replyTo, subject, text, html });
    if (error) {
      console.error('[Unreel] Resend API error:', JSON.stringify(error));
      throw new Error(error.message || JSON.stringify(error));
    }
    console.log('[Unreel] Resend sent OK:', JSON.stringify(data));
    return data;
  }

  const mailer = getNodemailerTransporter();
  if (!mailer) throw new Error('No email transport configured.');
  return mailer.sendMail({ from, to, replyTo, subject, text, html });
}

// ── Welcome email ────────────────────────────────────────────────────────────
async function sendWelcomeEmail({ name, email }) {
  if (!useResend() && !getNodemailerTransporter()) {
    return { skipped: true, reason: 'No email transport configured.' };
  }

  const siteName = process.env.MAIL_BRAND_NAME || 'Unreel';
  const siteUrl = (process.env.SITE_URL || 'https://www.unreeled.in').replace(/\/$/, '');
  const brandColor = process.env.MAIL_BRAND_COLOR || '#7c3aed';
  const logoUrl = process.env.MAIL_LOGO_URL || `${siteUrl}/og-image.png`;
  const safeName = escapeHtml((name || 'there').trim());
  const fromAddr = resolveFrom(siteName);
  const ctaUrl = siteUrl;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${siteName}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f4f7fa;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div style="background-color:#f4f7fa;padding:40px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.06);border:1px solid #e5e9f0;">
            <!-- Top Accent Bar -->
            <tr><td style="height:6px;background-color:${brandColor};"></td></tr>
            
            <!-- White Modern Header -->
            <tr>
              <td style="padding:48px 40px 32px;text-align:center;">
                <img src="${logoUrl}" alt="${siteName}" style="display:inline-block;max-width:140px;height:auto;border-radius:12px;" />
                <p style="margin:16px 0 0;font-size:12px;font-weight:700;color:${brandColor};text-transform:uppercase;letter-spacing:0.1em;">Reveal the truth behind every reel</p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 48px 48px;">
                <h1 style="margin:0 0 16px;font-size:32px;font-weight:800;line-height:1.2;color:#1a202c;letter-spacing:-0.03em;">Welcome to the fold, ${safeName}</h1>
                <p style="margin:0 0 32px;font-size:17px;line-height:1.7;color:#4a5568;">Your account is ready. We're here to help you navigate through viral misinformation with precision and clarity.</p>
                
                <div style="background-color:#f8faff;border-radius:20px;padding:32px;margin-bottom:40px;border:1px solid #edf2f7;">
                  <h2 style="margin:0 0 20px;font-size:14px;font-weight:800;color:${brandColor};text-transform:uppercase;letter-spacing:0.06em;">Getting Started</h2>
                  <div style="margin-bottom:16px;">
                    <p style="margin:0;font-size:16px;font-weight:700;color:#2d3748;">🎬 Paste any URL</p>
                    <p style="margin:4px 0 0 28px;font-size:14px;color:#718096;">Analyze YouTube Shorts, Instagram Reels, or TikToks in seconds.</p>
                  </div>
                  <div style="margin-bottom:16px;">
                    <p style="margin:0;font-size:16px;font-weight:700;color:#2d3748;">⚖️ Check for Bias</p>
                    <p style="margin:4px 0 0 28px;font-size:14px;color:#718096;">Get objective scores on narrative sentiment and political leaning.</p>
                  </div>
                  <div>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#2d3748;">✅ Verify Claims</p>
                    <p style="margin:4px 0 0 28px;font-size:14px;color:#718096;">Real-time fact-checking powered by advanced AI modules.</p>
                  </div>
                </div>

                <div style="text-align:center;">
                  <a href="${ctaUrl}" style="display:inline-block;background-color:${brandColor};color:#ffffff;text-decoration:none;padding:18px 48px;border-radius:16px;font-size:16px;font-weight:800;box-shadow:0 8px 20px -4px rgba(124,58,237,0.4);">Launch Dashboard</a>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 48px 48px;text-align:center;">
                <hr style="border:0;border-top:1px solid #edf2f7;margin:0 0 32px;">
                <p style="margin:0;font-size:13px;color:#a0aec0;line-height:1.6;">Build your personal history of truth with Unreel.</p>
                <div style="margin:20px 0 0;">
                  <span style="font-size:14px;font-weight:700;color:#4a5568;">The ${siteName} Team</span>
                </div>
              </td>
            </tr>
          </table>
          <div style="max-width:600px;margin:32px auto 0;text-align:center;">
            <p style="font-size:12px;color:#a0aec0;">&copy; ${new Date().getFullYear()} ${siteName} &middot; <a href="${siteUrl}/privacy" style="color:#a0aec0;text-decoration:underline;">Privacy Policy</a></p>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendMail({
    from: fromAddr,
    to: email,
    subject: `Welcome to ${siteName}`,
    text: `Welcome to ${siteName}, ${safeName}!\n\nYour account is live and ready to use. You can now analyze viral videos, track fact-checks, and build your history of truth.\n\nGet started here: ${ctaUrl}\n\n- The ${siteName} Team`,
    html,
  });

  return { skipped: false };
}

// ── Analysis result email ────────────────────────────────────────────────────
function verdictToLabel(verdict = 'UNVERIFIED') {
  if (verdict === 'TRUE') return 'True';
  if (verdict === 'FALSE') return 'False';
  if (verdict === 'MISLEADING') return 'Misleading';
  return 'Unverified';
}

async function sendAnalysisResultEmail({ name, email, analysisData, resultId }) {
  if (!useResend() && !getNodemailerTransporter()) {
    return { skipped: true, reason: 'No email transport configured.' };
  }

  const siteName = process.env.MAIL_BRAND_NAME || 'Unreel';
  const siteUrl = (process.env.SITE_URL || 'https://www.unreeled.in').replace(/\/$/, '');
  const brandColor = process.env.MAIL_BRAND_COLOR || '#7c3aed';
  const logoUrl = process.env.MAIL_LOGO_URL || `${siteUrl}/og-image.png`;
  const fromAddr = resolveFrom(siteName);

  const safeName = escapeHtml((name || 'there').trim());
  const title = analysisData?.videoInfo?.title || 'Video';
  const platform = analysisData?.videoInfo?.platform || 'Unknown';
  const biasScore = Number.isFinite(analysisData?.bias?.score) ? analysisData.bias.score : null;
  const biasLevel = analysisData?.bias?.level || 'N/A';
  const factChecks = Array.isArray(analysisData?.factChecks) ? analysisData.factChecks : [];
  const totalClaims = factChecks.length;
  const topClaims = factChecks.slice(0, 3);

  const resultUrl = resultId ? `${siteUrl}/results/${resultId}` : siteUrl;
  const escapedTitle = escapeHtml(title);
  const escapedPlatform = escapeHtml(platform);

  const verdictColorMap = {
    'TRUE': '#10b981',
    'FALSE': '#ef4444',
    'MISLEADING': '#f59e0b',
    'UNVERIFIED': '#6b7280'
  };

  const claimsHtml = topClaims.length
    ? topClaims.map((item) => {
      const verdict = item?.verdict || 'UNVERIFIED';
      const label = verdictToLabel(verdict);
      const color = verdictColorMap[verdict] || '#6b7280';
      const claim = escapeHtml(item?.claim || 'Claim');
      return `
        <div style="margin-bottom:16px;padding:16px;border-radius:12px;background-color:#f9fafb;border-left:4px solid ${color};">
          <div style="display:inline-block;padding:2px 8px;border-radius:9999px;background-color:${color};color:#ffffff;font-size:10px;font-weight:800;text-transform:uppercase;margin-bottom:8px;">${label}</div>
          <p style="margin:0;font-size:14px;line-height:1.5;color:#1f2937;">${claim}</p>
        </div>
      `;
    }).join('')
    : '<p style="margin:0;color:#6b7280;font-style:italic;">No specific claims were extracted.</p>';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Analysis Ready - ${siteName}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f4f7fa;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div style="background-color:#f4f7fa;padding:40px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.06);border:1px solid #e5e9f0;">
            <!-- Top Accent Bar -->
            <tr><td style="height:6px;background-color:${brandColor};"></td></tr>

            <!-- White Modern Header -->
            <tr>
              <td style="padding:40px 40px 24px;text-align:center;">
                <img src="${logoUrl}" alt="${siteName}" style="display:inline-block;max-width:110px;height:auto;border-radius:8px;" />
              </td>
            </tr>

            <tr>
              <td style="padding:0 48px 48px;">
                <div style="text-align:center;margin-bottom:32px;">
                  <p style="margin:0 0 8px;font-size:13px;font-weight:800;color:${brandColor};text-transform:uppercase;letter-spacing:0.1em;">Analysis Report</p>
                  <h1 style="margin:0;font-size:26px;font-weight:800;line-height:1.3;color:#1a202c;letter-spacing:-0.03em;">${escapedTitle}</h1>
                </div>
                
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:40px;">
                  <tr>
                    <td style="width:33.33%;padding-right:12px;">
                      <div style="background-color:#f8f9ff;padding:16px 8px;border-radius:16px;text-align:center;border:1px solid #edf2f7;">
                        <p style="margin:0;font-size:10px;font-weight:800;color:#718096;text-transform:uppercase;letter-spacing:0.05em;">Bias Score</p>
                        <p style="margin:6px 0 0;font-size:24px;font-weight:900;color:#1a202c;">${biasScore ?? 'N/A'}</p>
                      </div>
                    </td>
                    <td style="width:33.33%;padding:0 6px;">
                      <div style="background-color:#f8f9ff;padding:16px 8px;border-radius:16px;text-align:center;border:1px solid #edf2f7;">
                        <p style="margin:0;font-size:10px;font-weight:800;color:#718096;text-transform:uppercase;letter-spacing:0.05em;">Level</p>
                        <p style="margin:6px 0 0;font-size:16px;font-weight:800;color:#1a202c;white-space:nowrap;">${escapeHtml(biasLevel)}</p>
                      </div>
                    </td>
                    <td style="width:33.33%;padding-left:12px;">
                      <div style="background-color:#f8f9ff;padding:16px 8px;border-radius:16px;text-align:center;border:1px solid #edf2f7;">
                        <p style="margin:0;font-size:10px;font-weight:800;color:#718096;text-transform:uppercase;letter-spacing:0.05em;">Claims</p>
                        <p style="margin:6px 0 0;font-size:24px;font-weight:900;color:#1a202c;">${totalClaims}</p>
                      </div>
                    </td>
                  </tr>
                </table>

                <h2 style="margin:0 0 20px;font-size:15px;font-weight:800;color:#2d3748;text-transform:uppercase;letter-spacing:0.05em;">Key Findings</h2>
                <div style="margin-bottom:40px;">
                  ${claimsHtml}
                </div>

                <div style="text-align:center;margin-bottom:12px;">
                  <a href="${resultUrl}" style="display:inline-block;background-color:${brandColor};color:#ffffff;text-decoration:none;padding:18px 44px;border-radius:16px;font-size:16px;font-weight:800;box-shadow:0 8px 20px -4px rgba(124,58,237,0.4);">View Full Assessment</a>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 48px 48px;text-align:center;">
                <hr style="border:0;border-top:1px solid #edf2f7;margin:0 0 32px;">
                <p style="margin:0;font-size:12px;color:#a0aec0;line-height:1.7;">You received this because you requested a fact-check on Unreel. We help you reveal the narrative behind every reel.</p>
                <p style="margin:20px 0 0;font-size:14px;font-weight:700;color:#4a5568;">The ${siteName} Team</p>
              </td>
            </tr>
          </table>
          <div style="max-width:600px;margin:32px auto 0;text-align:center;">
            <p style="font-size:12px;color:#a0aec0;">&copy; ${new Date().getFullYear()} ${siteName} &middot; <a href="${siteUrl}/history" style="color:#a0aec0;text-decoration:underline;">Account Settings</a></p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textSummary = topClaims.length
    ? topClaims.map((item, idx) => `${idx + 1}. ${verdictToLabel(item?.verdict)} - ${item?.claim || 'Claim'}`).join('\n')
    : 'No specific claims were extracted.';

  await sendMail({
    from: fromAddr,
    to: email,
    subject: `Your ${siteName} analysis result is ready`,
    text: `Your analysis is ready: ${title}\n\nBias Score: ${biasScore ?? 'N/A'}\nLevel: ${biasLevel}\nClaims Checked: ${totalClaims}\n\nTop Findings:\n${textSummary}\n\nView Full Report: ${resultUrl}`,
    html,
  });

  return { skipped: false };
}

module.exports = {
  sendWelcomeEmail,
  sendAnalysisResultEmail,
  getMailDiagnostics,
  verifyMailTransport,
  serializeMailError,
};
