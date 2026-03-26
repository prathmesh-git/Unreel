const nodemailer = require('nodemailer');

let transporter;
let transporterConfig;

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTransporter() {
  if (transporter) return transporter;

  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number((process.env.SMTP_PORT || '587').trim());
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase().trim() === 'true' || port === 465;
  const requireTLS = String(process.env.SMTP_REQUIRE_TLS || '').toLowerCase().trim() === 'true';
  const ignoreTLS = String(process.env.SMTP_IGNORE_TLS || '').toLowerCase().trim() === 'true';
  const rejectUnauthorized = String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || '').toLowerCase().trim() !== 'false';

  if (!host || !user || !pass) {
    console.warn('[Unreel] SMTP_HOST, SMTP_USER, or SMTP_PASS is missing. Emails will be skipped.');
    return null;
  }

  transporterConfig = {
    host,
    port,
    secure,
    requireTLS,
    ignoreTLS,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000),
    auth: { user, pass },
    tls: {
      // Keep strict TLS by default; allow override for legacy SMTP providers.
      rejectUnauthorized,
    },
  };

  transporter = nodemailer.createTransport(transporterConfig);

  return transporter;
}

function resolveFrom(siteName) {
  const envFrom = (process.env.SMTP_FROM || process.env.MAIL_FROM || '').trim();
  if (envFrom) return envFrom;

  const smtpUser = (process.env.SMTP_USER || '').trim();
  // Many providers reject unauthenticated sender domains in production.
  return `"${siteName}" <${smtpUser}>`;
}

function buildSenderOptions(siteName) {
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const desiredFrom = resolveFrom(siteName);
  const useCustomFrom = Boolean(process.env.SMTP_FROM || process.env.MAIL_FROM);

  // For many SMTP providers (like Gmail), envelope/sender must align with authenticated user.
  if (useCustomFrom && smtpUser) {
    return {
      from: desiredFrom,
      sender: smtpUser,
      replyTo: desiredFrom,
      envelope: {
        from: smtpUser,
      },
    };
  }

  return {
    from: desiredFrom,
    replyTo: desiredFrom,
    envelope: smtpUser ? { from: smtpUser } : undefined,
  };
}

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
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  return {
    configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    hostConfigured: Boolean(process.env.SMTP_HOST),
    port,
    userConfigured: Boolean(process.env.SMTP_USER),
    passConfigured: Boolean(process.env.SMTP_PASS),
    fromConfigured: Boolean(process.env.SMTP_FROM || process.env.MAIL_FROM),
    secure,
    requireTLS: String(process.env.SMTP_REQUIRE_TLS || '').toLowerCase() === 'true',
    ignoreTLS: String(process.env.SMTP_IGNORE_TLS || '').toLowerCase() === 'true',
    tlsRejectUnauthorized: String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || '').toLowerCase() !== 'false',
    usingCustomFrom: Boolean(process.env.SMTP_FROM || process.env.MAIL_FROM),
  };
}

async function verifyMailTransport() {
  const mailer = getTransporter();
  if (!mailer) {
    return { ok: false, reason: 'SMTP is not configured.' };
  }

  try {
    await mailer.verify();
    return {
      ok: true,
      config: {
        host: transporterConfig?.host,
        port: transporterConfig?.port,
        secure: transporterConfig?.secure,
      },
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'SMTP verify failed.',
      error: serializeMailError(err),
    };
  }
}

async function sendWelcomeEmail({ name, email }) {
  const mailer = getTransporter();
  if (!mailer) {
    return { skipped: true, reason: 'SMTP is not configured.' };
  }

  const siteName = process.env.MAIL_BRAND_NAME || 'Unreel';
  const siteUrl = (process.env.SITE_URL || 'https://www.unreeled.in').replace(/\/$/, '');
  const brandColor = process.env.MAIL_BRAND_COLOR || '#7c3aed';
  const logoUrl = process.env.MAIL_LOGO_URL || `${siteUrl}/og-image.png`;
  const senderOptions = buildSenderOptions(siteName);
  const safeName = escapeHtml((name || 'there').trim());

  const ctaUrl = siteUrl;
  const html = `
    <div style="background:#f4f4f8;padding:28px 10px;font-family:Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ececf5;">
        <tr>
          <td style="background:${brandColor};padding:22px 24px;text-align:center;">
            <img src="${logoUrl}" alt="${siteName} banner" style="display:block;max-width:100%;height:auto;border-radius:10px;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:24px 24px 8px;color:#111827;">
            <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;">Welcome to ${siteName}, ${safeName}!</h1>
            <p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:#374151;">Your account is live and ready to use.</p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#374151;">You can now analyze viral videos, save your history, and keep track of truth checks in one place.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 4px;">
            <a href="${ctaUrl}" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:999px;font-size:14px;font-weight:700;">Open ${siteName}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px 24px;">
            <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;">If you did not create this account, you can safely ignore this email.</p>
            <p style="margin:14px 0 0;font-size:13px;color:#9ca3af;">- The ${siteName} Team</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  await mailer.sendMail({
    ...senderOptions,
    to: email,
    subject: `Welcome to ${siteName}`,
    text: `Hi ${safeName},\n\nWelcome to ${siteName}. Your account is ready, and you can now analyze videos, save history, and continue where you left off.\n\nIf you did not create this account, please ignore this email.\n\n- The ${siteName} Team`,
    html,
  });

  return { skipped: false };
}

function verdictToLabel(verdict = 'UNVERIFIED') {
  if (verdict === 'TRUE') return 'True';
  if (verdict === 'FALSE') return 'False';
  if (verdict === 'MISLEADING') return 'Misleading';
  return 'Unverified';
}

async function sendAnalysisResultEmail({ name, email, analysisData, resultId }) {
  const mailer = getTransporter();
  if (!mailer) {
    return { skipped: true, reason: 'SMTP is not configured.' };
  }

  const siteName = process.env.MAIL_BRAND_NAME || 'Unreel';
  const siteUrl = (process.env.SITE_URL || 'https://www.unreeled.in').replace(/\/$/, '');
  const brandColor = process.env.MAIL_BRAND_COLOR || '#7c3aed';
  const logoUrl = process.env.MAIL_LOGO_URL || `${siteUrl}/og-image.png`;
  const senderOptions = buildSenderOptions(siteName);

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

  const claimsHtml = topClaims.length
    ? topClaims.map((item) => {
      const verdict = verdictToLabel(item?.verdict);
      const claim = escapeHtml(item?.claim || 'Claim');
      return `<li style="margin:0 0 8px;color:#374151;"><strong>${verdict}:</strong> ${claim}</li>`;
    }).join('')
    : '<li style="margin:0;color:#6b7280;">No specific claims were extracted.</li>';

  const textSummary = topClaims.length
    ? topClaims.map((item, idx) => `${idx + 1}. ${verdictToLabel(item?.verdict)} - ${item?.claim || 'Claim'}`).join('\n')
    : 'No specific claims were extracted.';

  const html = `
    <div style="background:#f4f4f8;padding:28px 10px;font-family:Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ececf5;">
        <tr>
          <td style="background:${brandColor};padding:22px 24px;text-align:center;">
            <img src="${logoUrl}" alt="${siteName} banner" style="display:block;max-width:100%;height:auto;border-radius:10px;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:24px 24px 4px;color:#111827;">
            <h2 style="margin:0 0 10px;font-size:24px;line-height:1.25;">Your analysis is ready, ${safeName}</h2>
            <p style="margin:0 0 8px;font-size:15px;color:#374151;"><strong>${escapedTitle}</strong> (${escapedPlatform})</p>
            <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">Bias score: <strong>${biasScore ?? 'N/A'}</strong> · Level: <strong>${escapeHtml(biasLevel)}</strong> · Claims checked: <strong>${totalClaims}</strong></p>
          </td>
        </tr>
        <tr>
          <td style="padding:4px 24px 6px;">
            <p style="margin:0 0 8px;font-size:14px;color:#111827;font-weight:700;">Top findings</p>
            <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6;">${claimsHtml}</ul>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 24px 24px;">
            <a href="${resultUrl}" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:999px;font-size:14px;font-weight:700;">View Full Analysis</a>
            <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">You can turn these emails off anytime in your account history settings.</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  await mailer.sendMail({
    ...senderOptions,
    to: email,
    subject: `Your ${siteName} analysis result is ready`,
    text: `Hi ${safeName},\n\nYour analysis is ready for \"${title}\" (${platform}).\nBias score: ${biasScore ?? 'N/A'}\nBias level: ${biasLevel}\nClaims checked: ${totalClaims}\n\nTop findings:\n${textSummary}\n\nView full analysis: ${resultUrl}`,
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
