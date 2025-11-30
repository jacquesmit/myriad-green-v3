const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TITLE_SIZE = 24;
const LABEL_SIZE = 12;
const BODY_SIZE = 11;
const SECTION_TITLE_SIZE = 14;
const LINE_HEIGHT = 16;
const SECTION_GAP = 18;
const LABEL_COLUMN_WIDTH = 140;
const LOGO_WIDTH = 120;
const TEXT_COLOR = rgb(40 / 255, 40 / 255, 40 / 255);
const ACCENT_COLOR = rgb(27 / 255, 94 / 255, 32 / 255);
const SEPARATOR_COLOR = rgb(210 / 255, 210 / 255, 210 / 255);
const LOGO_PATH = path.resolve(__dirname, "..", "assets", "myriad_green_logo.png");

const formatValue = (value, fallback = "") => {
  if (value === undefined || value === null) {
    return fallback;
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : fallback;
};

const formatDate = (input) => {
  const date = input instanceof Date ? input : new Date(input || Date.now());
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatTimestamp = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value.toDate === "function") {
    return formatDate(value.toDate());
  }
  return formatDate(value);
};

async function loadLogoBytes() {
  try {
    return await fs.promises.readFile(LOGO_PATH);
  } catch (error) {
    return null;
  }
}

async function embedLogo(pdfDoc) {
  const logoBytes = await loadLogoBytes();
  if (!logoBytes) {
    return null;
  }

  try {
    return await pdfDoc.embedPng(logoBytes);
  } catch (error) {
    return null;
  }
}

async function generateBookingPdf(bookingData) {
  const booking = bookingData || {};
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const logoImage = await embedLogo(pdfDoc);

  let cursorY = PAGE_HEIGHT - MARGIN;

  if (logoImage) {
    const aspectRatio = logoImage.height / logoImage.width;
    const logoHeight = LOGO_WIDTH * aspectRatio;
    page.drawImage(logoImage, {
      x: (PAGE_WIDTH - LOGO_WIDTH) / 2,
      y: cursorY - logoHeight,
      width: LOGO_WIDTH,
      height: logoHeight,
    });
    cursorY -= logoHeight + 12;
  }

  page.drawText("Booking Confirmation", {
    x: MARGIN,
    y: cursorY,
    size: LABEL_SIZE,
    font: helvetica,
    color: TEXT_COLOR,
  });

  cursorY -= LINE_HEIGHT;

  page.drawText("Myriad Green – Booking Summary", {
    x: MARGIN,
    y: cursorY,
    size: TITLE_SIZE,
    font: helveticaBold,
    color: ACCENT_COLOR,
  });

  cursorY -= LINE_HEIGHT + 4;

  const todayLabel = formatDate(Date.now());
  const idLabel = formatValue(booking.id, "");
  const subheadingParts = [
    todayLabel ? `Generated ${todayLabel}` : null,
    idLabel ? `Booking ID: ${idLabel}` : null,
  ].filter(Boolean);

  if (subheadingParts.length) {
    page.drawText(subheadingParts.join("   •   "), {
      x: MARGIN,
      y: cursorY,
      size: BODY_SIZE,
      font: helvetica,
      color: TEXT_COLOR,
    });
    cursorY -= SECTION_GAP;
  }

  const drawSeparator = () => {
    page.drawLine({
      start: { x: MARGIN, y: cursorY },
      end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
      thickness: 0.5,
      color: SEPARATOR_COLOR,
    });
    cursorY -= 10;
  };

  const wrapText = (text) => {
    const content = text && text.trim().length ? text : "—";
    const lines = [];
    content.split(/\r?\n/).forEach((paragraph, idx, arr) => {
      const words = paragraph.split(/\s+/);
      let line = "";
      words.forEach((word) => {
        const testLine = line.length ? `${line} ${word}` : word;
        const width = helvetica.widthOfTextAtSize(testLine, BODY_SIZE);
        if (width > CONTENT_WIDTH - LABEL_COLUMN_WIDTH && line.length) {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      });
      if (line.length) {
        lines.push(line);
      }
      if (!words.length && idx < arr.length - 1) {
        lines.push(" ");
      }
    });
    return lines.length ? lines : [content];
  };

  const drawField = (label, value) => {
    const lines = wrapText(value);
    lines.forEach((line, index) => {
      if (index === 0) {
        page.drawText(`${label}:`, {
          x: MARGIN,
          y: cursorY,
          size: LABEL_SIZE,
          font: helveticaBold,
          color: TEXT_COLOR,
        });
      }
      page.drawText(line, {
        x: MARGIN + LABEL_COLUMN_WIDTH,
        y: cursorY,
        size: BODY_SIZE,
        font: helvetica,
        color: TEXT_COLOR,
      });
      cursorY -= LINE_HEIGHT;
    });
  };

  const drawSection = (title, fields) => {
    page.drawText(title, {
      x: MARGIN,
      y: cursorY,
      size: SECTION_TITLE_SIZE,
      font: helveticaBold,
      color: ACCENT_COLOR,
    });
    cursorY -= LINE_HEIGHT;
    drawSeparator();

    fields.forEach(({ label, value }) => {
      drawField(label, value);
    });

    cursorY -= SECTION_GAP / 2;
  };

  drawSection("Client Details", [
    { label: "Name", value: formatValue(booking.name, "") },
    { label: "Email", value: formatValue(booking.email, "") },
    { label: "Phone", value: formatValue(booking.phone, "") },
  ]);

  drawSection("Service Details", [
    { label: "Service", value: formatValue(booking.service, "") },
    {
      label: "Preferred Date",
      value: [formatValue(booking.preferredDate, ""), formatValue(booking.preferredTime, "")]
        .filter(Boolean)
        .join(" at "),
    },
    { label: "Address", value: formatValue(booking.address, "") },
    { label: "Notes", value: formatValue(booking.notes, "") },
  ]);

  drawSection("System Info", [
    { label: "Firestore ID", value: formatValue(booking.id, "") },
    { label: "Created", value: formatTimestamp(booking.createdAt) },
  ]);

  cursorY = Math.max(cursorY, 2 * MARGIN);

  const footerText = [
    "Myriad Green • Infinite Green Solutions",
    "WhatsApp: +27 81 721 6701 • Email: irrigationsa@gmail.com",
    "This document is auto-generated from the Myriad Green booking system.",
  ];

  footerText.forEach((line, index) => {
    page.drawText(line, {
      x: MARGIN,
      y: MARGIN + index * 12,
      size: 10,
      font: helvetica,
      color: TEXT_COLOR,
    });
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
module.exports = {
  generateBookingPdf,
};
