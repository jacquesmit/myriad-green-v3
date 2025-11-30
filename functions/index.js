const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const path = require("path");
const { generateBookingPdf } = require("./pdf");

const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_PASS = defineSecret("GMAIL_PASS");
const GMAIL_TO = defineSecret("GMAIL_TO");

const LOGO_CID = "myriadgreenlogo@inline";
const LOGO_PATH = path.join(__dirname, "assets", "myriad_green_logo.png");
const buildLogoAttachment = () => ({
  filename: "myriad_green_logo.png",
  path: LOGO_PATH,
  cid: LOGO_CID,
});

const escapeHtml = (input = "") =>
  String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const displayValue = (value, fallback = "Not provided") => {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized.length ? normalized : fallback;
};

const htmlValue = (value, fallback) => escapeHtml(displayValue(value, fallback));
const htmlMultiline = (value, fallback) => htmlValue(value, fallback).replace(/\n/g, "<br/>");

const buildDetailRows = (rows) =>
  rows
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:8px 12px; font-size:12px; color:#6b7280; width:40%;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px; font-size:12px; color:#0f172a; font-weight:600;">${htmlValue(
            value
          )}</td>
        </tr>`
    )
    .join("");

const buildDetailTable = (rows) => `
  <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; border-collapse:collapse;">
    ${buildDetailRows(rows)}
  </table>
`;

const buildEmailShell = ({ headerRightTop, headerRightBottom, bodyHtml }) => `
  <div style="background:#f1f5f9; padding:24px 0;">
    <table width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0; font-family:'Segoe UI', Arial, sans-serif;">
      <tr>
        <td style="padding:20px 24px; background:#ffffff; border-bottom:1px solid #e2e8f0;">
          <table width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="width:170px;">
                <img src="cid:${LOGO_CID}" alt="Myriad Green" style="display:block; width:150px; max-width:100%; height:auto;" />
              </td>
              <td style="text-align:right;">
                <div style="font-size:12px; color:#16a34a; font-weight:600;">${escapeHtml(headerRightTop)}</div>
                <div style="font-size:11px; color:#6b7280; margin-top:4px;">${escapeHtml(headerRightBottom)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px; background:#f8fafc; text-align:center; font-size:11px; color:#6b7280;">
          Myriad Green · +27 81 721 6701 · irrigationsa@gmail.com · Gauteng, South Africa
        </td>
      </tr>
    </table>
  </div>
`;

// Gmail credentials are provided via Firebase secrets
// (set with `firebase functions:secrets:set` in each project/region).
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.sendContactEmail = onRequest(
  { region: "africa-south1", cors: true, secrets: [GMAIL_USER, GMAIL_PASS, GMAIL_TO] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { name, phone, email, service, message } = req.body || {};
    const user = GMAIL_USER.value();
    const pass = GMAIL_PASS.value();
    const recipient = GMAIL_TO.value() || user;
    if (![name, phone, email, service, message].every((value) => typeof value === "string" && value.trim().length)) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (!user || !pass) {
      console.error("sendContactEmail error: missing Gmail credentials");
      res.status(500).json({ ok: false, error: "Email failed to send" });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass }
    });

    const textBody = `
New enquiry from the Myriad Green website:

Name: ${name}
Phone: ${phone}
Email: ${email}
Service: ${service}

Message:
${message}
    `.trim();

    const clientTextBody = `
Hi ${name || "there"},

Thank you for reaching out to Myriad Green about ${service || "your enquiry"}. Our team has your message and will be in touch shortly.

Message summary:
${message}

If you need urgent assistance, call +27 81 72 16701.

— Myriad Green
    `.trim();

    const mailOptions = {
      from: `"Myriad Green" <${user}>`,
      to: recipient,
      replyTo: email,
      subject: `New Contact Form Submission – ${name}`,
      text: textBody,
    };

    const safeService = displayValue(service, "General enquiry");
    const safeName = displayValue(name, "there");

    const adminBody = `
      <h1 style="margin:0 0 12px; font-size:20px; color:#0f172a;">New contact request</h1>
      <p style="margin:0 0 16px; font-size:13px; color:#4b5563;">
        A new message has been submitted via the Myriad Green website.
      </p>
      ${buildDetailTable([
        { label: "Name", value: name },
        { label: "Email", value: email },
        { label: "Phone", value: phone || "Not provided" },
        { label: "Service", value: safeService },
      ])}
      <h3 style="margin:20px 0 8px; font-size:13px; color:#16a34a;">Message</h3>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; font-size:12px; color:#0f172a;">
        ${htmlMultiline(message, "No message provided.")}
      </div>
      <p style="margin:20px 0 0; font-size:11px; color:#6b7280;">Submitted ${new Date().toLocaleString("en-ZA")}</p>
    `;

    const contactAdminHtml = buildEmailShell({
      headerRightTop: "Website contact",
      headerRightBottom: `Service: ${safeService}`,
      bodyHtml: adminBody,
    });

    const clientBody = `
      <h1 style="margin:0 0 12px; font-size:20px; color:#0f172a;">We received your message</h1>
      <p style="margin:0 0 16px; font-size:13px; color:#4b5563;">
        Hi ${htmlValue(safeName, "there")},<br/>
        Thank you for contacting Myriad Green about <strong style="color:#16a34a;">${htmlValue(safeService)}</strong>. One of our team members will get back to you as soon as possible.
      </p>
      ${buildDetailTable([
        { label: "Email", value: email },
        { label: "Phone", value: phone || "Not provided" },
        { label: "Service", value: safeService },
      ])}
      <h3 style="margin:20px 0 8px; font-size:13px; color:#16a34a;">Your message</h3>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; font-size:12px; color:#0f172a;">
        ${htmlMultiline(message, "No message provided.")}
      </div>
      <p style="margin:20px 0 0; font-size:12px; color:#4b5563;">
        If anything changes, reply to this email or call <strong>+27 81 72 16701</strong>.
      </p>
    `;

    const contactClientHtml = buildEmailShell({
      headerRightTop: "We received your message",
      headerRightBottom: "Myriad Green Support",
      bodyHtml: clientBody,
    });

    try {
      console.log("sendContactEmail: about to send", {
        to: recipient,
        from: user,
      });

      const info = await transporter.sendMail({
        ...mailOptions,
        html: contactAdminHtml,
        attachments: [buildLogoAttachment()],
      });

      console.log("sendContactEmail: sent", {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      });

      await transporter.sendMail({
        from: `"Myriad Green" <${user}>`,
        to: email,
        replyTo: user,
        subject: "Myriad Green – We Received Your Message",
        text: clientTextBody,
        html: contactClientHtml,
        attachments: [buildLogoAttachment()],
      });

      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("sendContactEmail error:", error);
      res.status(500).json({ ok: false, error: "Email failed to send" });
    }
  }
);

exports.createBooking = onRequest(
  { region: "africa-south1", cors: true, secrets: [GMAIL_USER, GMAIL_PASS, GMAIL_TO] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const {
      name,
      email,
      phone,
      service,
      preferredDate,
      preferredTime,
      address,
      notes,
    } = req.body || {};

    const required = [name, email, phone, service];
    const allFieldsPresent = required.every((value) => typeof value === "string" && value.trim().length > 0);

    if (!allFieldsPresent) {
      res.status(400).json({
        ok: false,
        error: "Missing required fields: name, email, phone, service",
      });
      return;
    }

    try {
      const bookingRecord = {
        name: String(name).trim(),
        email: String(email).trim(),
        phone: String(phone).trim(),
        service: String(service).trim(),
        preferredDate: preferredDate || null,
        preferredTime: preferredTime || null,
        address: address || null,
        notes: notes || null,
        status: "pending",
        source: "website-v3",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await admin.firestore().collection("bookings").add(bookingRecord);

      const toNumberOrNull = (value) => {
        if (value === undefined || value === null || value === "") {
          return null;
        }
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };

      const basePrice = toNumberOrNull(req.body?.basePrice);
      const calloutFee = toNumberOrNull(req.body?.calloutFee);
      const providedTotal = toNumberOrNull(req.body?.totalPrice);
      const totalPrice =
        providedTotal !== null
          ? providedTotal
          : basePrice !== null && calloutFee !== null
            ? basePrice + calloutFee
            : null;

      const bookingData = {
        id: docRef.id,
        ...bookingRecord,
        basePrice,
        calloutFee,
        totalPrice,
      };

      let pdfBuffer = null;
      try {
        pdfBuffer = await generateBookingPdf(bookingData);
      } catch (pdfErr) {
        console.error("createBooking pdf generation error:", pdfErr);
      }

      const pdfAttachment = pdfBuffer
        ? {
            filename: "myriad-green-booking-summary.pdf",
            content: pdfBuffer,
            contentType: "application/pdf",
          }
        : null;

      const user = GMAIL_USER.value();
      const pass = GMAIL_PASS.value();
      const internalRecipient = GMAIL_TO.value() || user;

      if (!user || !pass) {
        console.error("createBooking email skipped: missing Gmail credentials");
      } else {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user, pass }
        });

        const formatLine = (label, value) => `${label}: ${value || "N/A"}`;
        const internalText = [
          "A new booking has been captured via the website.",
          "",
          formatLine("Name", bookingData.name),
          formatLine("Email", bookingData.email),
          formatLine("Phone", bookingData.phone),
          formatLine("Service", bookingData.service),
          formatLine("Preferred Date", bookingData.preferredDate || "Not provided"),
          formatLine("Preferred Time", bookingData.preferredTime || "Not provided"),
          formatLine("Address", bookingData.address || "Not provided"),
          formatLine("Notes", bookingData.notes || "None"),
          "",
          `Firestore Document ID: ${docRef.id}`
        ].join("\n");

        const priceDisplayValue = bookingData.priceDisplay || (() => {
          const numericTotal = Number(bookingData.totalPrice);
          if (Number.isFinite(numericTotal)) {
            return `R ${numericTotal.toFixed(2)}`;
          }
          return "To be confirmed";
        })();

        const serviceName = displayValue(bookingData.service, "General Consultation");
        const greetingName = displayValue(bookingData.name, "there");

        const twoColumnLayout = (leftRows, rightRows) => `
          <table width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 8px;">
            <tr>
              <td style="width:50%; padding-right:12px; vertical-align:top;">
                ${buildDetailTable(leftRows)}
              </td>
              <td style="width:50%; padding-left:12px; vertical-align:top;">
                ${buildDetailTable(rightRows)}
              </td>
            </tr>
          </table>
        `;

        const adminBody = `
          <h1 style="margin:0 0 12px; font-size:20px; color:#0f172a;">New booking captured</h1>
          <p style="margin:0 0 16px; font-size:13px; color:#4b5563;">
            A new booking was submitted via the Myriad Green website. Review the summary below and continue the scheduling workflow.
          </p>
          ${twoColumnLayout(
            [
              { label: "Name", value: bookingData.name },
              { label: "Email", value: bookingData.email },
              { label: "Phone", value: bookingData.phone },
              { label: "Address", value: bookingData.address },
            ],
            [
              { label: "Service", value: serviceName },
              { label: "Preferred Date", value: bookingData.preferredDate || "Not provided" },
              { label: "Preferred Time", value: bookingData.preferredTime || "Not provided" },
              { label: "Total Price", value: priceDisplayValue },
            ]
          )}
          <h3 style="margin:20px 0 8px; font-size:13px; color:#16a34a;">Notes</h3>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; font-size:12px; color:#0f172a;">
            ${htmlMultiline(bookingData.notes, "No additional notes provided.")}
          </div>
          <h3 style="margin:24px 0 8px; font-size:13px; color:#16a34a;">System info</h3>
          ${buildDetailTable([
            { label: "Booking Reference", value: bookingData.bookingId || docRef.id || "-" },
            { label: "Source", value: bookingData.source || "website-v3" },
            { label: "Submitted", value: new Date().toLocaleString("en-ZA") },
          ])}
          <p style="margin:20px 0 0; font-size:12px; color:#4b5563;">The detailed PDF summary is attached to this email.</p>
        `;

        const adminHtml = buildEmailShell({
          headerRightTop: "Internal notification",
          headerRightBottom: `Service: ${serviceName}`,
          bodyHtml: adminBody,
        });

        const clientText = [
          "We’ve received your booking request.",
          "",
          formatLine("Service", bookingData.service || "General Consultation"),
          formatLine("Preferred Date", bookingData.preferredDate || "To be confirmed"),
          formatLine("Preferred Time", bookingData.preferredTime || "To be confirmed"),
          formatLine("Address", bookingData.address || "To be confirmed"),
          "",
          "A PDF summary is attached for your records.",
          "If you need to make changes, reply to this email or call +27 81 72 16701.",
        ].join("\n");

        const clientBody = `
          <h1 style="margin:0 0 12px; font-size:20px; color:#0f172a;">We’ve received your booking</h1>
          <p style="margin:0 0 16px; font-size:13px; color:#4b5563;">
            Hi ${htmlValue(greetingName, "there")},<br/>
            Thank you for booking <strong style="color:#16a34a;">${htmlValue(serviceName)}</strong> with Myriad Green. One of our technicians will reach out shortly to confirm the appointment details and finalize pricing.
          </p>
          ${twoColumnLayout(
            [
              { label: "Name", value: bookingData.name },
              { label: "Email", value: bookingData.email },
              { label: "Phone", value: bookingData.phone },
              { label: "Address", value: bookingData.address || "To be confirmed" },
            ],
            [
              { label: "Service", value: serviceName },
              { label: "Preferred Date", value: bookingData.preferredDate || "To be confirmed" },
              { label: "Preferred Time", value: bookingData.preferredTime || "To be confirmed" },
              { label: "Total Price", value: priceDisplayValue },
            ]
          )}
          <h3 style="margin:24px 0 8px; font-size:13px; color:#16a34a;">Notes</h3>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; font-size:12px; color:#0f172a;">
            ${htmlMultiline(bookingData.notes, "No additional notes were provided.")}
          </div>
          <p style="margin:20px 0 0; font-size:12px; color:#4b5563;">
            We’ve attached a PDF summary for your records. If anything looks incorrect, reply to this email or contact us on <strong>+27 81 72 16701</strong>.
          </p>
        `;

        const clientHtml = buildEmailShell({
          headerRightTop: "Booking received",
          headerRightBottom: `Reference: ${displayValue(bookingData.bookingId || docRef.id || "-")}`,
          bodyHtml: clientBody,
        });

        const buildBookingAttachments = () => {
          const attachments = [buildLogoAttachment()];
          if (pdfAttachment) {
            attachments.push({ ...pdfAttachment });
          }
          return attachments;
        };

        try {
          await transporter.sendMail({
            from: `"Myriad Green" <${user}>`,
            to: internalRecipient,
            subject: `New Booking – ${serviceName}`,
            text: internalText,
            html: adminHtml,
            attachments: buildBookingAttachments(),
          });

          await transporter.sendMail({
            from: `"Myriad Green" <${user}>`,
            to: bookingData.email,
            replyTo: user,
            subject: "Myriad Green – Booking Received",
            text: clientText,
            html: clientHtml,
            attachments: buildBookingAttachments(),
          });
        } catch (emailErr) {
          console.error("createBooking email error:", emailErr);
        }
      }

      res.status(200).json({ ok: true, id: docRef.id });
    } catch (err) {
      console.error("createBooking error:", err);
      res.status(500).json({
        ok: false,
        error: "Failed to create booking",
      });
    }
  }
);
