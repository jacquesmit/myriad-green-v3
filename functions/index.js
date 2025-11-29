const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_PASS = defineSecret("GMAIL_PASS");
const GMAIL_TO = defineSecret("GMAIL_TO");

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

    const htmlBody = `
        <h2>New enquiry from the Myriad Green website</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Message:</strong></p>
        <p>${(message || "").replace(/\n/g, "<br>")}</p>
      `;

    const mailOptions = {
      from: `"Myriad Green" <${user}>`,
      to: recipient,
      replyTo: email,
      subject: `New contact form enquiry – ${service}`,
      text: textBody,
    };

    try {
      console.log("sendContactEmail: about to send", {
        to: recipient,
        from: user,
      });

      const info = await transporter.sendMail(mailOptions);

      console.log("sendContactEmail: sent", {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
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
      const bookingData = {
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

      const docRef = await admin.firestore().collection("bookings").add(bookingData);

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

        const clientText = `Hi ${bookingData.name},

Thank you for booking ${bookingData.service} with Myriad Green. Our team has received your request and will confirm the appointment shortly.

Details we received:
- Service: ${bookingData.service}
- Preferred Date: ${bookingData.preferredDate || "Not specified"}
- Preferred Time: ${bookingData.preferredTime || "Not specified"}
- Phone: ${bookingData.phone}
- Email: ${bookingData.email}

If any of these details are incorrect, just reply to this email and we will update your booking.

The Myriad Green Team`;

        try {
          await transporter.sendMail({
            from: `"Myriad Green" <${user}>`,
            to: internalRecipient,
            subject: `New Booking – ${bookingData.service}`,
            text: internalText
          });

          await transporter.sendMail({
            from: `"Myriad Green" <${user}>`,
            to: bookingData.email,
            replyTo: internalRecipient,
            subject: `Myriad Green booking received – ${bookingData.service}`,
            text: clientText
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
