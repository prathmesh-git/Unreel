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
  const plainName = (name || 'there').trim();
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
      <body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
        <div style="padding:30px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:28px 34px 20px;border-bottom:1px solid #e6edf6;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${logoUrl}" alt="${siteName}" style="display:block;max-width:118px;height:auto;" />
                    </td>
                    <td style="vertical-align:middle;text-align:right;">
                      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(13,110,253,0.08);color:${brandColor};font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Welcome</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:30px 34px 14px;">
                <h1 style="margin:0 0 12px;font-size:30px;line-height:1.2;letter-spacing:-0.02em;font-weight:800;color:#111827;">Welcome to ${siteName}, ${safeName}</h1>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">Your account is active and ready. ${siteName} helps you evaluate fast-moving video claims with transparent analysis so you can separate facts from noise.</p>
              </td>
            </tr>

            <tr>
              <td style="padding:10px 34px 4px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 10px;">
                  <tr>
                    <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0f172a;">Analyze short-form videos quickly</p>
                      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Paste a public URL to assess bias signals and claim credibility in one report.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0f172a;">Track your analysis history</p>
                      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Revisit previous checks, compare narratives over time, and keep an evidence trail.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0f172a;">Get concise summaries by email</p>
                      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Enable result emails in account settings to receive analysis updates automatically.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 34px 34px;">
                <a href="${ctaUrl}" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.01em;">Open ${siteName}</a>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 34px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#64748b;">Need help getting started? Reply to this email and our team will assist you.</p>
                <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; ${new Date().getFullYear()} ${siteName} &middot; <a href="${siteUrl}/privacy" style="color:#64748b;text-decoration:underline;">Privacy</a></p>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;

  await sendMail({
    from: fromAddr,
    to: email,
    subject: `Welcome to ${siteName}`,
    text: `Welcome to ${siteName}, ${plainName}!\n\nYour account is now active. You can start analyzing short-form videos, reviewing claim checks, and tracking your history from one dashboard.\n\nOpen your dashboard: ${ctaUrl}\n\nNeed support? Reply to this email and we will help.\n\n- The ${siteName} Team`,
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
        <div style="margin-bottom:10px;padding:13px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;">
          <div style="display:inline-block;padding:2px 8px;border-radius:999px;background-color:${color};color:#ffffff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">${label}</div>
          <p style="margin:0;font-size:13px;line-height:1.55;color:#1f2937;">${claim}</p>
        </div>
      `;
    }).join('')
    : '<p style="margin:0;color:#64748b;font-size:13px;font-style:italic;">No specific claims were extracted from this content.</p>';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Analysis Ready - ${siteName}</title>
      </head>
      <body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
        <div style="padding:30px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:24px 30px;border-bottom:1px solid #e6edf6;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;"><img src="${logoUrl}" alt="${siteName}" style="display:block;max-width:104px;height:auto;" /></td>
                    <td style="text-align:right;vertical-align:middle;"><span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(13,110,253,0.08);color:${brandColor};font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Analysis Ready</span></td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:26px 30px 16px;">
                <p style="margin:0 0 6px;font-size:13px;color:#64748b;">Hi ${safeName},</p>
                <h1 style="margin:0 0 12px;font-size:27px;line-height:1.25;letter-spacing:-0.02em;font-weight:800;color:#111827;">Your analysis report is ready</h1>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">We completed the review for <strong style="color:#0f172a;">${escapedTitle}</strong> on ${escapedPlatform}. Here is a quick summary.</p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 30px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:8px 0;">
                  <tr>
                    <td style="width:33.33%;padding:14px 10px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;text-align:center;">
                      <p style="margin:0;font-size:10px;color:#64748b;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Bias Score</p>
                      <p style="margin:7px 0 0;font-size:22px;font-weight:800;color:#0f172a;">${biasScore ?? 'N/A'}</p>
                    </td>
                    <td style="width:33.33%;padding:14px 10px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;text-align:center;">
                      <p style="margin:0;font-size:10px;color:#64748b;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Bias Level</p>
                      <p style="margin:7px 0 0;font-size:14px;font-weight:800;color:#0f172a;">${escapeHtml(biasLevel)}</p>
                    </td>
                    <td style="width:33.33%;padding:14px 10px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;text-align:center;">
                      <p style="margin:0;font-size:10px;color:#64748b;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Claims</p>
                      <p style="margin:7px 0 0;font-size:22px;font-weight:800;color:#0f172a;">${totalClaims}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 30px 4px;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Top Findings</p>
                ${claimsHtml}
              </td>
            </tr>

            <tr>
              <td style="padding:20px 30px 30px;">
                <a href="${resultUrl}" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;">View Full Report</a>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 30px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#64748b;">You received this email because analysis-result emails are enabled for your account.</p>
                <p style="margin:0;font-size:12px;color:#94a3b8;">Manage preferences in <a href="${siteUrl}/history" style="color:#64748b;text-decoration:underline;">Account Settings</a>.</p>
              </td>
            </tr>
          </table>
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
