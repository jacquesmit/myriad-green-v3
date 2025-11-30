const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const LOGO_PATH = path.join(__dirname, "..", "assets", "myriad_green_logo.png");
const LABEL_COLOR = "#6b7280";
const VALUE_COLOR = "#0f172a";
const ACCENT_COLOR = "#8fd14f";
const FOOTER_PRIMARY = "#4b5563";
const FOOTER_SECONDARY = "#9ca3af";
const HEADER_BG = "#ffffff";
const HEADER_ACCENT = "#e2e8f0";
const SECTION_HEADING = "#041b13";
const MUTED_BG = "#f8fafc";

const formatValue = (value) => {
  if (value === undefined || value === null) {
    return "Not provided";
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : "Not provided";
};

const drawField = (doc, x, startY, label, value, width) => {
  const normalizedValue = formatValue(value);
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(LABEL_COLOR)
    .text(label, x, startY, { width });

  const valueY = startY + 12;
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(VALUE_COLOR)
    .text(normalizedValue, x, valueY, { width });

  const valueHeight = doc.heightOfString(normalizedValue, { width });
  return valueY + valueHeight + 14;
};

const formatDateTime = (value) => {
  if (!value) {
    return "Not available";
  }
  let dateCandidate = value;
  if (typeof value.toDate === "function") {
    dateCandidate = value.toDate();
  }
  const parsedDate = dateCandidate instanceof Date ? dateCandidate : new Date(dateCandidate);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }
  return parsedDate.toLocaleString("en-ZA", {
    dateStyle: "long",
    timeStyle: "short",
  });
};

function generateBookingPdf(bookingData = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { width: pageWidth, height: pageHeight } = doc.page;
    const marginLeft = doc.page.margins.left;
    const marginRight = doc.page.margins.right;
    const marginTop = doc.page.margins.top;
    const marginBottom = doc.page.margins.bottom;
    const contentWidth = pageWidth - marginLeft - marginRight;

    const headerHeight = 120;
    const headerY = marginTop;

    doc.save();
    doc.roundedRect(marginLeft, headerY, contentWidth, headerHeight, 12).fill(HEADER_BG);
    doc.restore();

    // Drop shadow effect
    doc.save();
    doc.rect(marginLeft, headerY + headerHeight, contentWidth, 1).fill(HEADER_ACCENT);
    doc.restore();

    const logoWidth = 110;
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, marginLeft + 18, headerY + 20, {
        fit: [logoWidth, 60],
        align: "left",
        valign: "center",
      });
    }

    const headerTextX = marginLeft + logoWidth + 44;
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(SECTION_HEADING)
      .text("Booking Summary", headerTextX, headerY + 26, {
        width: contentWidth - logoWidth - 70,
      });

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(LABEL_COLOR)
      .text("Myriad Green – Infinite Green Solutions", headerTextX, doc.y + 6, {
        width: contentWidth - logoWidth - 70,
      });

    doc
      .moveTo(marginLeft, headerY + headerHeight + 10)
      .lineTo(marginLeft + contentWidth, headerY + headerHeight + 10)
      .lineWidth(2)
      .strokeColor(ACCENT_COLOR)
      .stroke();

    let currentY = headerY + headerHeight + 32;

    const renderSectionHeading = (label, y) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(SECTION_HEADING)
        .text(label, marginLeft, y);
      doc
        .moveTo(marginLeft, doc.y + 6)
        .lineTo(marginLeft + 48, doc.y + 6)
        .lineWidth(2)
        .strokeColor(ACCENT_COLOR)
        .stroke();
      return doc.y + 14;
    };

    currentY = renderSectionHeading("Booking Details", currentY);

    const columnGap = 24;
    const columnWidth = (contentWidth - columnGap) / 2;
    const leftColumnX = marginLeft;
    const rightColumnX = marginLeft + columnWidth + columnGap;
    let leftY = currentY + 6;
    let rightY = currentY + 6;

    const leftFields = [
      { label: "Name", value: bookingData.name },
      { label: "Email", value: bookingData.email },
      { label: "Phone", value: bookingData.phone },
      { label: "Address", value: bookingData.address },
    ];

    const rightFields = [
      { label: "Service", value: bookingData.service },
      { label: "Preferred Date", value: bookingData.preferredDate },
      { label: "Preferred Time", value: bookingData.preferredTime },
      {
        label: "Total Price",
        value:
          bookingData.priceDisplay ||
          bookingData.totalPrice ||
          bookingData.basePrice ||
          "To be confirmed",
      },
    ];

    leftFields.forEach((field) => {
      leftY = drawField(doc, leftColumnX, leftY, field.label, field.value, columnWidth);
    });

    rightFields.forEach((field) => {
      rightY = drawField(doc, rightColumnX, rightY, field.label, field.value, columnWidth);
    });

    currentY = Math.max(leftY, rightY) + 6;

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(SECTION_HEADING)
      .text("Notes / Additional Info", marginLeft, currentY);

    const notesValue = formatValue(bookingData.notes);
    const notesHeight = doc.heightOfString(notesValue, { width: contentWidth - 24 });
    const notesBoxY = doc.y + 10;

    doc.save();
    doc
      .roundedRect(marginLeft, notesBoxY - 6, contentWidth, notesHeight + 24, 10)
      .fill(MUTED_BG);
    doc.restore();

    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(VALUE_COLOR)
      .text(notesValue, marginLeft + 12, notesBoxY, {
        width: contentWidth - 24,
      });

    currentY = notesBoxY + notesHeight + 30;

    currentY = renderSectionHeading("System Info", currentY);

    const infoFields = [
      {
        label: "Booking Reference",
        value: bookingData.bookingId || bookingData.id || "-",
      },
      {
        label: "Created",
        value: formatDateTime(bookingData.createdAt),
      },
      {
        label: "Source",
        value: bookingData.source || "website-v3",
      },
    ];

    const infoBoxY = currentY + 6;
    const infoValueWidth = contentWidth - 180;
    const infoLineHeights = infoFields.map((field) => {
      const textHeight = doc.heightOfString(field.value || "", { width: infoValueWidth });
      return Math.max(textHeight + 14, 24);
    });
    const infoBoxHeight = infoLineHeights.reduce((sum, h) => sum + h, 0) + 12;

    doc.save();
    doc
      .roundedRect(marginLeft, infoBoxY - 8, contentWidth, infoBoxHeight, 10)
      .fill(MUTED_BG)
      .strokeColor(HEADER_ACCENT)
      .lineWidth(1)
      .stroke();
    doc.restore();

    let infoY = infoBoxY;
    infoFields.forEach((field, index) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(LABEL_COLOR)
        .text(field.label, marginLeft + 12, infoY);
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor(VALUE_COLOR)
        .text(field.value, marginLeft + 160, infoY, {
          width: infoValueWidth,
        });
      infoY += infoLineHeights[index];
    });

    const footerY = pageHeight - marginBottom - 60;

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(FOOTER_PRIMARY)
      .text(
        "Myriad Green – Infinite Green Solutions · +27 81 721 6701 · irrigationsa@gmail.com",
        marginLeft,
        footerY,
        {
          width: contentWidth,
          align: "center",
        }
      );

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(FOOTER_SECONDARY)
      .text(
        "Gauteng, South Africa · This booking summary is for your records. Our team will confirm final dates and pricing with you directly.",
        marginLeft,
        footerY + 14,
        {
          width: contentWidth,
          align: "center",
        }
      );

    doc.end();
  });
}

module.exports = {
  generateBookingPdf,
};
