import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import nodemailer from "nodemailer";

const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_PASS = defineSecret("GMAIL_PASS");
const GMAIL_TO = defineSecret("GMAIL_TO");

export const sendContactEmail = onRequest(
  {
    region: "us-central1",
    cors: true,
    secrets: [GMAIL_USER, GMAIL_PASS, GMAIL_TO]
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const { name, email, phone, service, message } = req.body || {};
    const requiredFields = [name, email, phone, service, message];
    const allFieldsPresent = requiredFields.every(
      (value) => typeof value === "string" && value.trim().length > 0
    );

    if (!allFieldsPresent) {
      res.status(400).json({ ok: false, error: "Missing required fields" });
      return;
    }

    const user = GMAIL_USER.value();
    const pass = GMAIL_PASS.value();
    const to = GMAIL_TO.value() || user;

    if (!user || !pass || !to) {
      console.error("sendContactEmail error: Missing Gmail secret values");
      res.status(500).json({ ok: false, error: "Email failed to send" });
      return;
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass }
    });

    const mailOptions = {
      from: `"Myriad Green" <${user}>`,
      to,
      replyTo: email,
      subject: `New contact form enquiry – ${service}`,
      text: [
        "New enquiry from the Myriad Green contact form:",
        "",
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        `Service: ${service}`,
        "",
        "Message:",
        message
      ].join("\n")
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("sendContactEmail error:", err);
      res.status(500).json({ ok: false, error: "Email failed to send" });
    }
  }
);
