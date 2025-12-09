const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const nodemailer = require("nodemailer");
const path = require("path");
const { buildEmailTemplate } = require("./email/sharedTemplate");
const {
  generateBookingPdf,
  generateBookingPdfV2,
  generateQuotePdfV1,
  generateInvoicePdfV1,
  generateServiceReportPdfV1,
} = require("./pdf");

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

const sendEmailWithRetry = async (transporter, mailOptions, options = {}) => {
  const rawMaxAttempts = Number(options?.maxAttempts);
  const rawBaseDelay = Number(options?.baseDelayMs);
  const maxAttempts = Number.isFinite(rawMaxAttempts) && rawMaxAttempts > 0 ? Math.floor(rawMaxAttempts) : 3;
  const baseDelayMs = Number.isFinite(rawBaseDelay) && rawBaseDelay >= 0 ? rawBaseDelay : 1000;

  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const result = await transporter.sendMail(mailOptions);
      logger.info("Email sent", {
        to: mailOptions?.to,
        subject: mailOptions?.subject,
        attempt,
      });
      return result;
    } catch (error) {
      lastError = error;
      logger.error("Email send failed", {
        to: mailOptions?.to,
        subject: mailOptions?.subject,
        attempt,
        error: error?.message || String(error),
      });

      if (attempt >= maxAttempts) {
        break;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

// Gmail credentials are provided via Firebase secrets
// (set with `firebase functions:secrets:set` in each project/region).
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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
        sendEmailWithRetry(transporter, {
          from: `"Myriad Green" <${user}>`,
          to: recipient,
          replyTo: contactEmail,
          subject: `New Contact Form Submission – ${safeSubject}`,
          text: adminText,
          html: adminHtml,
          attachments: [buildLogoAttachment()],
        }),
        sendEmailWithRetry(transporter, {
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
        pdfBuffer = await generateBookingPdfV2(bookingData);
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

exports.sendQuote = onRequest(
  { region: "africa-south1", cors: true, secrets: [GMAIL_USER, GMAIL_PASS, GMAIL_TO] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const quotePayload = req.body?.quote || req.body || {};
    const {
      reference: providedReference,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      serviceName,
      propertyType,
      suburb,
      city,
      province,
      items,
      subtotal,
      vatAmount,
      totalAmount,
      notes,
      preparedAt,
    } = quotePayload;

    const hasRequiredFields = [clientName, clientEmail, serviceName, items, totalAmount].every((value, index) => {
      if (index === 3) {
        return Array.isArray(value) && value.length > 0;
      }
      if (index === 4) {
        return Number.isFinite(Number(value));
      }
      return typeof value === "string" && value.trim().length > 0;
    });

    if (!hasRequiredFields) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const preparedDate = (() => {
      if (!preparedAt) {
        return new Date();
      }
      const candidate = new Date(preparedAt);
      return Number.isNaN(candidate.getTime()) ? new Date() : candidate;
    })();

    try {
      const quoteDoc = {
        reference: providedReference || null,
        serviceName: String(serviceName).trim(),
        client: {
          name: String(clientName).trim(),
          email: String(clientEmail).trim(),
          phone: clientPhone ? String(clientPhone).trim() : null,
          address: clientAddress || null,
          suburb: suburb || null,
          city: city || null,
          province: province || null,
        },
        items: Array.isArray(items) ? items : [],
        subtotal: Number(subtotal) || 0,
        vatAmount: vatAmount != null ? Number(vatAmount) : null,
        totalAmount: Number(totalAmount) || 0,
        notes: notes || null,
        status: "sent",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        preparedAt: preparedDate,
      };

      const docRef = await admin.firestore().collection("quotes").add(quoteDoc);
      const reference = providedReference && providedReference.trim().length ? providedReference.trim() : docRef.id;
      if (!providedReference) {
        await docRef.update({ reference });
      }

      const quoteForPdf = {
        reference,
        preparedAt: preparedDate,
        serviceName: quoteDoc.serviceName,
        clientName: quoteDoc.client.name,
        clientEmail: quoteDoc.client.email,
        clientPhone: quoteDoc.client.phone,
        clientAddress: quoteDoc.client.address,
        propertyType,
        suburb,
        city,
        province,
        items: quoteDoc.items,
        subtotal: quoteDoc.subtotal,
        vatAmount: quoteDoc.vatAmount,
        totalAmount: quoteDoc.totalAmount,
        notes: quoteDoc.notes,
      };

      let pdfBuffer = null;
      try {
        pdfBuffer = await generateQuotePdfV1(quoteForPdf);
      } catch (pdfError) {
        logger.error("sendQuote pdf generation error", pdfError);
      }

      const user = GMAIL_USER.value();
      const pass = GMAIL_PASS.value();
      const internalRecipient = GMAIL_TO.value() || user;

      const formatCurrency = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? `R ${numeric.toFixed(2)}` : formatValue(value);
      };

      const pdfAttachment = pdfBuffer
        ? {
            filename: `MG-QUOTE-${reference}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          }
        : null;

      if (!user || !pass) {
        logger.error("sendQuote email skipped: missing Gmail credentials");
      } else {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user, pass },
        });

        const attachments = [buildLogoAttachment()];
        if (pdfAttachment) {
          attachments.push(pdfAttachment);
        }

        const adminHtml = buildEmailTemplate({
          title: "New Quote Sent",
          intro: "A new quote has been prepared and emailed to the client.",
          rows: [
            { label: "Client", value: quoteDoc.client.name },
            { label: "Service", value: quoteDoc.serviceName },
            { label: "Total", value: formatCurrency(quoteDoc.totalAmount) },
            { label: "Reference", value: reference },
          ],
          footerNote: "Follow up with the client to confirm acceptance and next steps.",
        });

        const clientHtml = buildEmailTemplate({
          title: "Your Quote from Myriad Green",
          intro: [
            `Hi ${quoteDoc.client.name},`,
            "Thank you for considering Myriad Green. Review the quote summary below and open the attached PDF for full details. Reply directly to accept or request adjustments.",
          ].join("\n\n"),
          rows: [
            { label: "Client", value: quoteDoc.client.name },
            { label: "Service", value: quoteDoc.serviceName },
            { label: "Total", value: formatCurrency(quoteDoc.totalAmount) },
            { label: "Reference", value: reference },
            { label: "Prepared", value: preparedDate.toLocaleString("en-ZA") },
          ],
          footerNote: "To approve this quote, reply to this email or call +27 81 72 16701.",
        });

        const adminText = [
          "New quote sent to client.",
          `Client: ${quoteDoc.client.name}`,
          `Service: ${quoteDoc.serviceName}`,
          `Total: ${formatCurrency(quoteDoc.totalAmount)}`,
          `Reference: ${reference}`,
        ].join("\n");

        const clientText = [
          `Hi ${quoteDoc.client.name},`,
          "Thank you for considering Myriad Green. We've attached your quote as a PDF.",
          `Service: ${quoteDoc.serviceName}`,
          `Total: ${formatCurrency(quoteDoc.totalAmount)}`,
          `Reference: ${reference}`,
          "Reply to this email to accept or ask questions.",
        ].join("\n");

        try {
          await Promise.all([
            sendEmailWithRetry(transporter, {
              from: `"Myriad Green" <${user}>`,
              to: internalRecipient,
              subject: `New Quote Sent – ${quoteDoc.client.name} (${quoteDoc.serviceName})`,
              text: adminText,
              html: adminHtml,
              attachments,
            }),
            sendEmailWithRetry(transporter, {
              from: `"Myriad Green" <${user}>`,
              to: quoteDoc.client.email,
              replyTo: user,
              subject: `Your Quote from Myriad Green – ${quoteDoc.serviceName}`,
              text: clientText,
              html: clientHtml,
              attachments,
            }),
          ]);
        } catch (mailError) {
          logger.error("sendQuote email error", mailError);
        }
      }

      res.status(200).json({ ok: true, reference });
    } catch (error) {
      logger.error("sendQuote error", error);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

exports.sendInvoice = onRequest(
  { region: "africa-south1", cors: true, secrets: [GMAIL_USER, GMAIL_PASS, GMAIL_TO] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const invoicePayload = req.body?.invoice || req.body || {};
    const {
      invoiceNumber: providedInvoiceNumber,
      reference,
      issuedAt: issuedAtInput,
      dueAt: dueAtInput,
      serviceName,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      suburb,
      city,
      province,
      items,
      subtotal,
      vatAmount,
      totalAmount,
      notes,
      paymentInstructions,
    } = invoicePayload;

    const requiredFieldsPresent =
      [clientName, clientEmail, serviceName].every((value) => typeof value === "string" && value.trim().length > 0) &&
      Array.isArray(items) &&
      items.length > 0 &&
      Number.isFinite(Number(totalAmount));

    if (!requiredFieldsPresent) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const normalizeDate = (input, fallback = null) => {
      if (!input) {
        return fallback;
      }
      const candidate = typeof input.toDate === "function" ? input.toDate() : new Date(input);
      return Number.isNaN(candidate.getTime()) ? fallback : candidate;
    };

    const issuedAt = normalizeDate(issuedAtInput, new Date());
    const dueAt = dueAtInput ? normalizeDate(dueAtInput) : undefined;

    try {
      const invoiceDoc = {
        invoiceNumber: providedInvoiceNumber ? String(providedInvoiceNumber).trim() : null,
        reference: reference ? String(reference).trim() : null,
        serviceName: String(serviceName).trim(),
        client: {
          name: String(clientName).trim(),
          email: String(clientEmail).trim(),
          phone: clientPhone ? String(clientPhone).trim() : null,
          address: clientAddress || null,
          suburb: suburb || null,
          city: city || null,
          province: province || null,
        },
        items: Array.isArray(items) ? items : [],
        subtotal: Number(subtotal) || 0,
        vatAmount: vatAmount != null ? Number(vatAmount) : null,
        totalAmount: Number(totalAmount) || 0,
        notes: notes || null,
        paymentInstructions: paymentInstructions || null,
        status: "sent",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        issuedAt,
        dueAt: dueAt || null,
      };

      const docRef = await admin.firestore().collection("invoices").add(invoiceDoc);
      let invoiceNumber = invoiceDoc.invoiceNumber;
      if (!invoiceNumber) {
        invoiceNumber = docRef.id;
        await docRef.update({ invoiceNumber });
      }

      const invoiceForPdf = {
        invoiceNumber,
        reference,
        serviceName: invoiceDoc.serviceName,
        clientName: invoiceDoc.client.name,
        clientEmail: invoiceDoc.client.email,
        clientPhone: invoiceDoc.client.phone,
        clientAddress: invoiceDoc.client.address,
        suburb,
        city,
        province,
        issuedAt,
        dueAt,
        items: invoiceDoc.items,
        subtotal: invoiceDoc.subtotal,
        vatAmount: invoiceDoc.vatAmount,
        totalAmount: invoiceDoc.totalAmount,
        notes: invoiceDoc.notes,
        paymentInstructions: invoiceDoc.paymentInstructions,
      };

      let pdfBuffer = null;
      try {
        pdfBuffer = await generateInvoicePdfV1(invoiceForPdf);
      } catch (pdfError) {
        logger.error("sendInvoice pdf generation error", pdfError);
      }

      const user = GMAIL_USER.value();
      const pass = GMAIL_PASS.value();
      const internalRecipient = GMAIL_TO.value() || user;

      const formatCurrency = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? `R ${numeric.toFixed(2)}` : displayValue(value);
      };

      const pdfAttachment = pdfBuffer
        ? {
            filename: `MG-INVOICE-${invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          }
        : null;

      if (!user || !pass) {
        logger.error("sendInvoice email skipped: missing Gmail credentials");
      } else {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user, pass },
        });

        const attachments = [buildLogoAttachment()];
        if (pdfAttachment) {
          attachments.push(pdfAttachment);
        }

        const adminHtml = buildEmailTemplate({
          title: "New Invoice Sent",
          intro: "A new invoice has been generated and emailed to the client.",
          rows: [
            { label: "Client", value: invoiceDoc.client.name },
            { label: "Service", value: invoiceDoc.serviceName },
            { label: "Total", value: formatCurrency(invoiceDoc.totalAmount) },
            { label: "Invoice #", value: invoiceNumber },
          ],
          footerNote: "Log this invoice and follow up on payment before the due date.",
        });

        const clientHtml = buildEmailTemplate({
          title: "Your Invoice from Myriad Green",
          intro: "Thank you for your business. Please find your invoice attached.",
          rows: [
            { label: "Invoice #", value: invoiceNumber },
            { label: "Service", value: invoiceDoc.serviceName },
            { label: "Total", value: formatCurrency(invoiceDoc.totalAmount) },
            { label: "Issued", value: issuedAt.toLocaleString("en-ZA") },
            { label: "Due", value: dueAt ? dueAt.toLocaleString("en-ZA") : "On receipt" },
          ],
          footerNote: invoiceDoc.paymentInstructions || "Please settle this invoice at your earliest convenience.",
        });

        const adminText = [
          "New invoice sent.",
          `Client: ${invoiceDoc.client.name}`,
          `Service: ${invoiceDoc.serviceName}`,
          `Total: ${formatCurrency(invoiceDoc.totalAmount)}`,
          `Invoice #: ${invoiceNumber}`,
        ].join("\n");

        const clientText = [
          `Hi ${invoiceDoc.client.name},`,
          "Thank you for your business with Myriad Green. Your invoice is attached as a PDF.",
          `Service: ${invoiceDoc.serviceName}`,
          `Total: ${formatCurrency(invoiceDoc.totalAmount)}`,
          `Invoice #: ${invoiceNumber}`,
          `Due: ${dueAt ? dueAt.toLocaleDateString("en-ZA") : "On receipt"}`,
          "Please refer to the payment instructions inside the attachment.",
        ].join("\n");

        try {
          await Promise.all([
            transporter.sendMail({
              from: `"Myriad Green" <${user}>`,
              to: internalRecipient,
              subject: `New Invoice Sent – ${invoiceDoc.client.name} (${invoiceDoc.serviceName})`,
              text: adminText,
              html: adminHtml,
              attachments,
            }),
            transporter.sendMail({
              from: `"Myriad Green" <${user}>`,
              to: invoiceDoc.client.email,
              replyTo: user,
              subject: `Your Invoice – ${invoiceDoc.serviceName}`,
              text: clientText,
              html: clientHtml,
              attachments,
            }),
          ]);
        } catch (mailError) {
          logger.error("sendInvoice email error", mailError);
        }
      }

      res.status(200).json({ ok: true, invoiceNumber });
    } catch (error) {
      logger.error("sendInvoice error", error);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

exports.sendServiceReport = onRequest(
  { region: "africa-south1", cors: true, secrets: [GMAIL_USER, GMAIL_PASS, GMAIL_TO] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const reportPayload = req.body?.report || req.body || {};
    const {
      reportNumber: providedReportNumber,
      reference,
      serviceName,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      suburb,
      city,
      province,
      propertyType,
      siteNotes,
      technicianName,
      technicianNotes,
      visitDate: visitDateInput,
      arrivalTime,
      departureTime,
      findings,
      actionsTaken,
      recommendations,
      followUpRequired,
      followUpNotes,
      materialsUsed,
    } = reportPayload;

    const normalizeDate = (input) => {
      if (!input) {
        return null;
      }
      const candidate = typeof input.toDate === "function" ? input.toDate() : new Date(input);
      return Number.isNaN(candidate.getTime()) ? null : candidate;
    };

    const visitDate = normalizeDate(visitDateInput);
    const requiredFields = [
      { label: "serviceName", value: serviceName },
      { label: "clientName", value: clientName },
      { label: "clientEmail", value: clientEmail },
      { label: "visitDate", value: visitDateInput },
    ];
    const missingCoreFields = requiredFields.filter(({ value }) => {
      if (value === undefined || value === null) {
        return true;
      }
      if (typeof value === "string") {
        return !value.trim().length;
      }
      return false;
    });

    if (missingCoreFields.length) {
      res.status(400).json({ error: `Missing required fields: ${missingCoreFields.map((f) => f.label).join(", ")}` });
      return;
    }

    const normalizedMaterials = Array.isArray(materialsUsed)
      ? materialsUsed
          .map((material) => ({
            name: material?.name ? String(material.name).trim() : null,
            quantity:
              material?.quantity === undefined || material?.quantity === null
                ? null
                : material.quantity,
            notes: material?.notes ? String(material.notes).trim() : null,
          }))
          .filter((entry) => entry.name)
      : [];

    const followUpFlag = typeof followUpRequired === "string"
      ? followUpRequired.toLowerCase() === "true"
      : Boolean(followUpRequired);

    try {
      const reportDoc = {
        reportNumber: providedReportNumber ? String(providedReportNumber).trim() : null,
        reference: reference ? String(reference).trim() : null,
        serviceName: String(serviceName).trim(),
        client: {
          name: String(clientName).trim(),
          email: String(clientEmail).trim(),
          phone: clientPhone ? String(clientPhone).trim() : null,
          address: clientAddress ? String(clientAddress).trim() : null,
          suburb: suburb ? String(suburb).trim() : null,
          city: city ? String(city).trim() : null,
          province: province ? String(province).trim() : null,
        },
        propertyType: propertyType ? String(propertyType).trim() : null,
        siteNotes: siteNotes ? String(siteNotes).trim() : null,
        technicianName: technicianName ? String(technicianName).trim() : null,
        technicianNotes: technicianNotes ? String(technicianNotes).trim() : null,
        visitDate: visitDate || new Date(),
        arrivalTime: arrivalTime ? String(arrivalTime).trim() : null,
        departureTime: departureTime ? String(departureTime).trim() : null,
        findings: findings ? String(findings).trim() : null,
        actionsTaken: actionsTaken ? String(actionsTaken).trim() : null,
        recommendations: recommendations ? String(recommendations).trim() : null,
        followUpRequired: followUpFlag,
        followUpNotes: followUpNotes ? String(followUpNotes).trim() : null,
        materialsUsed: normalizedMaterials,
        status: "sent",
        createdAt: FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("serviceReports").add(reportDoc);
      let reportNumber = reportDoc.reportNumber;
      if (!reportNumber) {
        reportNumber = docRef.id;
        await docRef.update({ reportNumber });
      }

      const pdfPayload = {
        reportNumber,
        reference: reportDoc.reference,
        serviceName: reportDoc.serviceName,
        clientName: reportDoc.client.name,
        clientEmail: reportDoc.client.email,
        clientPhone: reportDoc.client.phone,
        clientAddress: reportDoc.client.address,
        suburb: reportDoc.client.suburb,
        city: reportDoc.client.city,
        province: reportDoc.client.province,
        propertyType: reportDoc.propertyType,
        siteNotes: reportDoc.siteNotes,
        technicianName: reportDoc.technicianName,
        technicianNotes: reportDoc.technicianNotes,
        visitDate: reportDoc.visitDate,
        arrivalTime: reportDoc.arrivalTime,
        departureTime: reportDoc.departureTime,
        findings: reportDoc.findings,
        actionsTaken: reportDoc.actionsTaken,
        recommendations: reportDoc.recommendations,
        followUpRequired: reportDoc.followUpRequired,
        followUpNotes: reportDoc.followUpNotes,
        materialsUsed: reportDoc.materialsUsed,
      };

      let pdfBuffer = null;
      try {
        pdfBuffer = await generateServiceReportPdfV1(pdfPayload, { theme: "light" });
      } catch (pdfError) {
        logger.error("sendServiceReport pdf generation error", pdfError);
      }

      const user = GMAIL_USER.value();
      const pass = GMAIL_PASS.value();
      const internalRecipient = GMAIL_TO.value() || user;

      const formatDateForEmail = (value) => {
        if (!value) {
          return "Not recorded";
        }
        const candidate = typeof value.toDate === "function" ? value.toDate() : new Date(value);
        return Number.isNaN(candidate.getTime()) ? "Not recorded" : candidate.toLocaleString("en-ZA");
      };

      const followUpStatusLabel = reportDoc.followUpRequired ? "Yes" : "No";
      const followUpNotesSummary = reportDoc.followUpRequired
        ? displayValue(reportDoc.followUpNotes, "Follow-up required – details pending.")
        : "No follow-up required";

      const pdfAttachment = pdfBuffer
        ? {
            filename: `${reportNumber || "service-report"}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          }
        : null;

      if (!user || !pass) {
        logger.error("sendServiceReport email skipped: missing Gmail credentials");
      } else {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user, pass },
        });

        const attachmentBuilder = () => {
          const files = [buildLogoAttachment()];
          if (pdfAttachment) {
            files.push(pdfAttachment);
          }
          return files;
        };

        const adminHtml = buildEmailTemplate({
          title: "Service Report Filed",
          intro: "Internal copy for records. The attached PDF mirrors the client-facing report.",
          rows: [
            { label: "Service", value: reportDoc.serviceName },
            { label: "Client", value: displayValue(reportDoc.client.name, "Client") },
            { label: "Visit Date", value: formatDateForEmail(reportDoc.visitDate) },
            { label: "Technician", value: displayValue(reportDoc.technicianName, "Not recorded") },
            { label: "Follow-Up Required", value: followUpStatusLabel },
            { label: "Follow-Up Notes", value: followUpNotesSummary },
          ],
          footerNote: `Report #: ${reportNumber}`,
        });

        const adminText = [
          "Internal copy of service report.",
          `Service: ${reportDoc.serviceName}`,
          `Client: ${displayValue(reportDoc.client.name, "Client")}`,
          `Visit Date: ${formatDateForEmail(reportDoc.visitDate)}`,
          `Technician: ${displayValue(reportDoc.technicianName, "Not recorded")}`,
          `Follow-Up Required: ${followUpStatusLabel}`,
          `Follow-Up Notes: ${followUpNotesSummary}`,
          `Report #: ${reportNumber}`,
        ].join("\n");

        const adminMailOptions = {
          from: `"Myriad Green" <${user}>`,
          to: internalRecipient,
          subject: `Service Report – ${reportDoc.serviceName} – ${displayValue(
            reportDoc.client.name,
            "Client"
          )} – ${reportNumber}`,
          text: adminText,
          html: adminHtml,
          attachments: attachmentBuilder(),
        };

        const hasClientEmail = typeof reportDoc.client.email === "string" && reportDoc.client.email.trim().length > 0;
        const mailPromises = [sendEmailWithRetry(transporter, adminMailOptions)];

        const clientIntro = [
          `Hi ${displayValue(reportDoc.client.name, "there")},<br><br>`,
          "Thank you for allowing Myriad Green to assist you on site today.<br>",
          "It was a pleasure working with you and assessing your irrigation system.<br>",
          "Your detailed service report is attached for easy reference, including our findings,<br>",
          "actions taken, and recommended next steps tailored specifically to your property.<br><br>",
        ].join("");

        if (hasClientEmail) {
          const clientHtml = buildEmailTemplate({
            title: "Your Service Report",
            intro: clientIntro,
            rows: [
              { label: "Service", value: reportDoc.serviceName },
              { label: "Visit Date", value: formatDateForEmail(reportDoc.visitDate) },
              { label: "Technician", value: displayValue(reportDoc.technicianName, "Not recorded") },
              { label: "Follow-Up", value: `${followUpStatusLabel} – ${followUpNotesSummary}` },
              { label: "Report #", value: reportNumber },
            ],
            footerNote:
              "If you have any questions or would like to schedule follow-up assistance,<br>" +
              "we’re here to help anytime. Thank you again for choosing Myriad Green —<br>" +
              "we truly appreciate the opportunity to support your home’s water systems.<br><br>",
          });

          const clientText = [
            `Hi ${displayValue(reportDoc.client.name, "there")},`,
            "Thanks for choosing Myriad Green. Your full service report is attached as a PDF.",
            `Service: ${reportDoc.serviceName}`,
            `Visit Date: ${formatDateForEmail(reportDoc.visitDate)}`,
            `Technician: ${displayValue(reportDoc.technicianName, "Not recorded")}`,
            `Follow-Up: ${followUpStatusLabel} – ${followUpNotesSummary}`,
            `Report #: ${reportNumber}`,
            "Reply to this email if you have any questions or updates.",
          ].join("\n");

          const clientMailOptions = {
            from: `"Myriad Green" <${user}>`,
            to: reportDoc.client.email,
            replyTo: user,
            subject: `Your Service Report – ${reportDoc.serviceName} – ${reportNumber}`,
            text: clientText,
            html: clientHtml,
            attachments: attachmentBuilder(),
          };

          mailPromises.push(sendEmailWithRetry(transporter, clientMailOptions));
        }

        try {
          await Promise.all(mailPromises);
        } catch (mailError) {
          logger.error("sendServiceReport email error", mailError);
        }
      }

      res.status(200).json({ success: true, reportId: docRef.id, reportNumber, message: "Service report sent" });
    } catch (error) {
      logger.error("sendServiceReport error", error);
      res.status(500).json({ error: "Internal error" });
    }
  }
);
