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
      <div style="font-family: Arial, sans-serif; background:#f3f3f3; padding:24px;">
        <div style="max-width:600px; margin:auto; background:white; padding:24px; border-radius:8px;">
          
          <h2 style="color:#3a7d1c; font-size:22px; margin-bottom:16px;">
            New Contact Request Received
          </h2>

          <p style="font-size:15px; color:#333; line-height:1.5;">
            A new message has been submitted through the Myriad Green website.
          </p>

          <ul style="list-style:none; padding:0; margin:0; font-size:14px; color:#444;">
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Phone:</strong> ${phone}</li>
            <li><strong>Message:</strong><br>${(message || "").replace(/\n/g, "<br>")}</li>
          </ul>

          <p style="margin-top:24px; font-size:13px; color:#777;">
            — Myriad Green Website Notification
          </p>

        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Myriad Green" <${user}>`,
      to: recipient,
      replyTo: email,
      subject: `New Contact Form Submission – ${name}`,
      text: textBody,
      html: htmlBody,
    };

    const clientHtml = `
      <div style="background:#eef2ee; padding:30px; font-family:'Segoe UI', Arial, sans-serif;">
        <div style="
          max-width:600px;
          margin:auto;
          background:white;
          border-radius:12px;
          padding:32px;
          box-shadow:0 4px 20px rgba(0,0,0,0.08);
        ">
          <h2 style="color:#3a7d1c; font-size:22px; margin-bottom:20px;">
            Thank You, ${name}! We Received Your Message
          </h2>

          <p style="font-size:15px; color:#444; line-height:1.6;">
            Thank you for contacting Myriad Green. One of our team members will review
            your message and get back to you shortly.
          </p>

          <h3 style="font-size:16px; color:#3a7d1c; margin-top:24px;">Your Message Details</h3>

          <div style="
            background:#f9faf9;
            padding:18px;
            border-radius:8px;
            border:1px solid #dfe9df;
            margin-bottom:20px;
          ">
            <p style="margin:0; font-size:14px; color:#333;"><strong>Name:</strong> ${name}</p>
            <p style="margin:0; font-size:14px; color:#333;"><strong>Email:</strong> ${email}</p>
            <p style="margin:0; font-size:14px; color:#333;"><strong>Phone:</strong> ${phone}</p>
            <p style="margin-top:12px; font-size:14px; color:#333;"><strong>Message:</strong><br>${(message || "").replace(/\n/g, "<br>")}</p>
          </div>

          <p style="font-size:13px; color:#666;">
            If you need urgent assistance, feel free to reply directly to this email.
          </p>

          <p style="font-size:12px; color:#777; margin-top:28px;">
            — Myriad Green Team
          </p>
        </div>
      </div>
    `;

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

      await transporter.sendMail({
        from: `"Myriad Green" <${user}>`,
        to: email,
        replyTo: user,
        subject: "Myriad Green – We Received Your Message",
        html: clientHtml
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

        const clientHtml = `
          <div style="font-family: Arial, sans-serif; background:#f7f7f7; padding:24px;">
            <div style="max-width:600px; margin:auto; background:white; padding:24px; border-radius:8px;">
              
              <h2 style="color:#3a7d1c; font-size:22px; margin-bottom:16px; text-align:left;">
                Thank you, ${bookingData.name} — we’ve received your booking!
              </h2>

              <p style="font-size:15px; color:#333; line-height:1.5;">
                We’ve received your request for <strong>${bookingData.service}</strong>.
                One of our technicians will contact you shortly to confirm details.
              </p>

              <h3 style="margin-top:24px; font-size:18px; color:#3a7d1c;">Booking Details</h3>

              <ul style="list-style:none; padding:0; margin:0; font-size:14px; color:#444;">
                <li><strong>Name:</strong> ${bookingData.name}</li>
                <li><strong>Email:</strong> ${bookingData.email}</li>
                <li><strong>Phone:</strong> ${bookingData.phone}</li>
                <li><strong>Service:</strong> ${bookingData.service}</li>
                <li><strong>Preferred Date:</strong> ${bookingData.preferredDate || "Not specified"}</li>
                <li><strong>Preferred Time:</strong> ${bookingData.preferredTime || "Not specified"}</li>
                <li><strong>Address:</strong> ${bookingData.address || "Not specified"}</li>
                <li><strong>Notes:</strong> ${bookingData.notes || "None"}</li>
              </ul>

              <p style="margin-top:24px; font-size:14px; color:#555;">
                If anything changes or you need immediate assistance, reply directly to this email.
              </p>

              <p style="margin-top:16px; font-size:13px; color:#777;">
                — Myriad Green Team
              </p>

            </div>
          </div>
        `;

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
            replyTo: user,
            subject: "Myriad Green – Booking Received",
            html: clientHtml
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
