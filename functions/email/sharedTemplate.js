const BUSINESS_CONTACT = require("../shared/businessContact");

const escapeHtml = (input = "") =>
  String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const displayValue = (value, fallback = "") => {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized.length ? normalized : fallback;
};

const htmlValue = (value, fallback) => escapeHtml(displayValue(value, fallback));
const htmlMultiline = (value, fallback) => {
  const raw = String(displayValue(value, fallback) ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  return raw
    .split("\n")
    .map((line) => htmlValue(line))
    .join("<br/>");
};

const buildDetailRows = (rows) =>
  rows
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:8px 12px; font-size:12px; color:#6b7280; width:40%;">${escapeHtml(displayValue(label, "Label"))}</td>
          <td style="padding:8px 12px; font-size:12px; color:#0f172a; font-weight:600;">${htmlMultiline(
            value,
            "Not provided"
          )}</td>
        </tr>`
    )
    .join("");

const buildDetailTable = (rows) => {
  if (!Array.isArray(rows) || !rows.length) {
    return "";
  }

  return `
    <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; border-collapse:collapse;">
      ${buildDetailRows(rows)}
    </table>
  `;
};

function buildEmailTemplate({ title, intro, rows = [], footerNote, cta } = {}) {
  const titleBlock = `<h1 style="margin:0 0 12px; font-size:20px; color:#0f172a;">${htmlValue(
    title,
    "Myriad Green Update"
  )}</h1>`;

  const introBlock = intro
    ? `<p style="margin:0 0 16px; font-size:13px; color:#4b5563;">${htmlMultiline(intro, "")}</p>`
    : "";

  const rowsBlock = buildDetailTable(rows);

  const ctaBlock =
    cta && typeof cta.url === "string" && /^(https?:\/\/)/i.test(cta.url)
      ? `
      <!-- SR_CTA_RENDERED -->
      <table cellspacing="0" cellpadding="0" style="margin:16px 0 0;">
        <tr>
          <td style="border-radius:12px;" bgcolor="#16a34a">
            <a href="${cta.url}" target="_blank" rel="noopener noreferrer"
              style="display:inline-block; padding:12px 16px; font-size:13px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:12px;">
              ${htmlValue(cta.label, "View service")}
            </a>
          </td>
        </tr>
      </table>`
      : "";

  const footerBlock = footerNote
    ? `<p style="margin:20px 0 0; font-size:12px; color:#4b5563;">${htmlMultiline(footerNote, "")}</p>`
    : "";

  const content = [titleBlock, introBlock, rowsBlock, ctaBlock, footerBlock]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Myriad Green</title>
</head>
<body style="margin:0; padding:0; background:#f1f5f9;">
  <!-- SR_CTA_STAMP_V1 -->
  <div style="background:#f1f5f9; padding:24px 0;">
    <table width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0; font-family:'Segoe UI', Arial, sans-serif;">
      <tr>
        <td style="padding:20px 24px; background:#ffffff; border-bottom:1px solid #e2e8f0;">
          <table width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="width:170px;">
                <img src="cid:myriadgreenlogo@inline" alt="Myriad Green" style="display:block; width:150px; max-width:100%; height:auto;" />
              </td>
              <td style="text-align:right;">
                <div style="font-size:12px; color:#16a34a; font-weight:600;">Myriad Green</div>
                <div style="font-size:11px; color:#6b7280; margin-top:4px;">Smart Irrigation Specialists</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          ${content}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px; background:#f8fafc; text-align:center; font-size:11px; color:#6b7280;">
          Myriad Green · <a href="${BUSINESS_CONTACT.phoneTel}" style="color:inherit; text-decoration:none;">${BUSINESS_CONTACT.phoneDisplay}</a> · ${BUSINESS_CONTACT.email} · ${BUSINESS_CONTACT.location}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

module.exports = {
  buildEmailTemplate,
};
