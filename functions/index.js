const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const nodemailer = require("nodemailer");

// Gmail credentials must be provided via environment variables:
// GMAIL_USER (email address), GMAIL_PASS (app password), GMAIL_TO (optional override).
// Use `firebase functions:config:set` or the Firebase console to store these securely.
initializeApp();

exports.sendContactEmail = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { name, phone, email, service, message } = req.body || {};
  if (![name, phone, email, service, message].every((value) => typeof value === "string" && value.trim().length)) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });

  const to = process.env.GMAIL_TO || process.env.GMAIL_USER;

  const mailOptions = {
    from: `"Myriad Green Website" <${process.env.GMAIL_USER}>`,
    to,
    replyTo: email,
    subject: `[Myriad Green] New contact enquiry - ${service || "General"}`,
    text: `
New enquiry from the Myriad Green website:

Name: ${name}
Phone: ${phone}
Email: ${email}
Service: ${service}

Message:
${message}
    `.trim(),
    html: `
      <h2>New enquiry from the Myriad Green website</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Service:</strong> ${service}</p>
      <p><strong>Message:</strong></p>
      <p>${(message || "").replace(/\n/g, "<br>")}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("sendContactEmail error:", error);
    res.status(500).json({ ok: false, error: "Email failed to send" });
  }
});
