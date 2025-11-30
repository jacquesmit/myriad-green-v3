const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const nodemailer = require("nodemailer");
const path = require("path");
const { buildEmailTemplate } = require("./email/sharedTemplate");
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

    const { name, email: contactEmail, phone, subject, message } = req.body || {};
    if (![contactEmail, message].every((value) => typeof value === "string" && value.trim().length)) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const user = GMAIL_USER.value();
    const pass = GMAIL_PASS.value();
    const recipient = GMAIL_TO.value() || user;

    if (!user || !pass) {
      logger.error("sendContactEmail error: missing Gmail credentials");
      res.status(500).json({ error: "Internal error" });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass }
    });

    const contactName = displayValue(name, "Not provided");
    const greetingName = displayValue(name, "there");
    const safeSubject = displayValue(subject, "General enquiry");
    const safePhone = displayValue(phone, "Not provided");
    const safeMessage = displayValue(message, "No message provided.");

    const adminHtml = buildEmailTemplate({
      title: "New Contact Form Submission",
      intro: "A new enquiry has just arrived via the Myriad Green website.",
      rows: [
        { label: "Name", value: contactName },
        { label: "Email", value: contactEmail },
        { label: "Phone", value: safePhone },
        { label: "Subject", value: safeSubject },
        { label: "Message", value: safeMessage },
      ],
      footerNote: "Log this enquiry in your CRM and respond as soon as possible.",
    });

    const clientIntro = [
      `Hi ${greetingName === "there" ? "there" : greetingName},`,
      "Thank you for contacting Myriad Green. Our team has received your enquiry and will follow up shortly.",
    ].join("\n\n");

    const clientHtml = buildEmailTemplate({
      title: "We've Received Your Message",
      intro: clientIntro,
      rows: [
        { label: "Subject", value: safeSubject },
        { label: "Message", value: safeMessage },
      ],
      footerNote: "We will reply as soon as possible. You can reply directly to this email if you need urgent help.",
    });

    const adminText = [
      "New enquiry from the Myriad Green website:",
      `Name: ${contactName}`,
      `Email: ${contactEmail}`,
      `Phone: ${safePhone}`,
      `Subject: ${safeSubject}`,
      "",
      "Message:",
      safeMessage,
    ].join("\n");

    const clientText = [
      `Hi ${greetingName === "there" ? "there" : greetingName},`,
      "Thanks for contacting Myriad Green. We have your message and will reply shortly.",
      "",
      `Subject: ${safeSubject}`,
      "Message:",
      safeMessage,
      "",
      "You can reply to this email if you need urgent help.",
    ].join("\n");

    try {
      await Promise.all([
        transporter.sendMail({
          from: `"Myriad Green" <${user}>`,
          to: recipient,
          replyTo: contactEmail,
          subject: `New Contact Form Submission – ${safeSubject}`,
          text: adminText,
          html: adminHtml,
          attachments: [buildLogoAttachment()],
        }),
        transporter.sendMail({
          from: `"Myriad Green" <${user}>`,
          to: contactEmail,
          replyTo: user,
          subject: "Myriad Green – We've Received Your Message",
          text: clientText,
          html: clientHtml,
          attachments: [buildLogoAttachment()],
        }),
      ]);

      res.status(200).json({ ok: true });
    } catch (error) {
      logger.error("sendContactEmail error", error);
      res.status(500).json({ error: "Internal error" });
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

        const adminHtml = buildEmailTemplate({
          title: "New booking captured",
          intro: [
            "A new booking was submitted via the Myriad Green website.",
            "Review the summary below and continue the scheduling workflow."
          ].join("\n\n"),
          rows: [
            { label: "Name", value: bookingData.name },
            { label: "Email", value: bookingData.email },
            { label: "Phone", value: bookingData.phone },
            { label: "Address", value: bookingData.address || "Not provided" },
            { label: "Service", value: serviceName },
            { label: "Preferred Date", value: bookingData.preferredDate || "Not provided" },
            { label: "Preferred Time", value: bookingData.preferredTime || "Not provided" },
            { label: "Total Price", value: priceDisplayValue },
            { label: "Notes", value: bookingData.notes || "No additional notes provided." },
            { label: "Booking Reference", value: bookingData.bookingId || docRef.id || "-" },
            { label: "Source", value: bookingData.source || "website-v3" },
            { label: "Submitted", value: new Date().toLocaleString("en-ZA") },
          ],
          footerNote: "The detailed PDF summary is attached to this email.",
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

        const clientHtml = buildEmailTemplate({
          title: "We’ve received your booking",
          intro: [
            `Hi ${greetingName},`,
            `Thank you for booking ${serviceName} with Myriad Green. One of our technicians will reach out shortly to confirm the appointment details and finalize pricing.`
          ].join("\n\n"),
          rows: [
            { label: "Name", value: bookingData.name },
            { label: "Email", value: bookingData.email },
            { label: "Phone", value: bookingData.phone },
            { label: "Address", value: bookingData.address || "To be confirmed" },
            { label: "Service", value: serviceName },
            { label: "Preferred Date", value: bookingData.preferredDate || "To be confirmed" },
            { label: "Preferred Time", value: bookingData.preferredTime || "To be confirmed" },
            { label: "Total Price", value: priceDisplayValue },
            { label: "Notes", value: bookingData.notes || "No additional notes were provided." },
            { label: "Reference", value: bookingData.bookingId || docRef.id || "-" },
          ],
          footerNote: "We’ve attached a PDF summary for your records. If anything looks incorrect, reply to this email or contact us on +27 81 72 16701.",
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
