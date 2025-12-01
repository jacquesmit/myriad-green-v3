const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const LOGO_PATH = path.join(__dirname, "..", "assets", "myriad_green_logo.png");
const TEMPLATE_TYPES = {
  BOOKING: "booking",
  QUOTE: "quote",
  INVOICE: "invoice",
};
const DEFAULT_THEME = "light";
const DEFAULT_CURRENCY = "ZAR";
const FOOTER_RESERVE = 160;
const CONTINUATION_NOTICE = "Continued on next page…";

const THEMES = {
  light: {
    pageBackground: "#FFFFFF",
    surfaceBackground: "#ffffff",
    surfaceBorder: "#e5e7eb",
    panelBackground: "#f6f8fb",
    panelBorder: "#e2e8f0",
    headerBackground: "#f7f9fc",
    headerBorder: "#e2e8f0",
    logoStrip: "#ffffff",
    textPrimary: "#222222",
    textSecondary: "#4b5563",
    label: "#5f6c7b",
    value: "#111827",
    accent: "#16a34a",
    footerPrimary: "#1f2937",
    footerSecondary: "#6b7280",
  },
  dark: {
    pageBackground: "#050608",
    surfaceBackground: "#0d1114",
    surfaceBorder: "#1f2a24",
    panelBackground: "#151c20",
    panelBorder: "#1f2a24",
    headerBackground: "#0f1519",
    headerBorder: "#1f2a24",
    logoStrip: "#fefefe",
    textPrimary: "#f8fafc",
    textSecondary: "#cbd5e1",
    label: "#a8b5c4",
    value: "#f8fafc",
    accent: "#8fd14f",
    footerPrimary: "#f8fafc",
    footerSecondary: "#cbd5e1",
  },
};

const TYPOGRAPHY = {
  baseFont: "Helvetica",
  bodySize: 11,
  labelSize: 10,
  sectionHeadingSize: 15,
  titleSize: 26,
  subtitleSize: 13,
  smallSize: 9,
};

const BODY_LINE_GAP = 2;

/**
 * @typedef {Object} QuoteLineItem
 * @property {string} description
 * @property {number|string} [quantity]
 * @property {number|string} [unitPrice]
 * @property {number|string} [total]
 */

/**
 * @typedef {Object} QuotePayload
 * @property {string} [quoteNumber]
 * @property {Date|string} [issueDate]
 * @property {Date|string} [validUntil]
 * @property {string} [clientName]
 * @property {string} [clientEmail]
 * @property {string} [clientPhone]
 * @property {string} [clientAddress]
 * @property {string} [serviceType]
 * @property {string} [location]
 * @property {Object} [project]
 * @property {QuoteLineItem[]} [lineItems]
 * @property {string} [currency]
 * @property {number} [subtotal]
 * @property {number} [vatAmount]
 * @property {string} [vatLabel]
 * @property {number} [total]
 * @property {string} [notes]
 * @property {string} [terms]
 * @property {string} [accountManager]
 */

/**
 * @typedef {Object} InvoicePayload
 * @property {string} [invoiceNumber]
 * @property {Date|string} [issueDate]
 * @property {Date|string} [dueDate]
 * @property {string} [clientName]
 * @property {string} [clientEmail]
 * @property {string} [clientPhone]
 * @property {string} [clientAddress]
 * @property {string} [serviceType]
 * @property {string} [location]
 * @property {Object} [project]
 * @property {QuoteLineItem[]} [lineItems]
 * @property {string} [currency]
 * @property {number} [subtotal]
 * @property {number} [vatAmount]
 * @property {string} [vatLabel]
 * @property {number} [total]
 * @property {string} [paymentTerms]
 * @property {string} [paymentInstructions]
 * @property {Object} [bankDetails]
 * @property {string} [terms]
 * @property {string} [accountManager]
 */

const formatValue = (value) => {
  if (value === undefined || value === null) {
    return "Not provided";
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : "Not provided";
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

const formatCurrency = (value, currency = DEFAULT_CURRENCY) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return currency === "ZAR" ? "R 0.00" : `${currency} 0.00`;
  }
  const prefix = currency === "ZAR" ? "R" : `${currency} `;
  return `${prefix}${numeric.toFixed(2)}`;
};

const createPdfBuffer = (renderFn) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks = [];

    doc.font(TYPOGRAPHY.baseFont).fontSize(TYPOGRAPHY.bodySize).lineGap(BODY_LINE_GAP);

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    renderFn(doc);
    doc.end();
  });

const resolveTheme = (themeName = DEFAULT_THEME) => THEMES[themeName] || THEMES[DEFAULT_THEME];

const getLayout = (doc) => {
  const { width, height } = doc.page;
  const { left, right, top, bottom } = doc.page.margins;
  return {
    pageWidth: width,
    pageHeight: height,
    marginLeft: left,
    marginRight: right,
    marginTop: top,
    marginBottom: bottom,
    contentWidth: width - left - right,
  };
};

const drawPageBackground = (doc, theme, layout) => {
  doc.save();
  doc.rect(0, 0, layout.pageWidth, layout.pageHeight).fill(theme.pageBackground);
  doc.restore();
};

const drawSurface = (doc, theme, layout) => {
  const padding = 12;
  doc.save();
  doc
    .roundedRect(
      layout.marginLeft - padding,
      layout.marginTop - padding,
      layout.contentWidth + padding * 2,
      layout.pageHeight - layout.marginTop - layout.marginBottom + padding * 2,
      18
    )
    .lineWidth(1)
    .fillAndStroke(theme.surfaceBackground, theme.surfaceBorder || theme.panelBorder);
  doc.restore();
};

const drawHeader = (doc, theme, layout, { title, subtitle }) => {
  const headerHeight = 140;
  const headerX = layout.marginLeft;
  const headerY = layout.marginTop;
  const headerWidth = layout.contentWidth;
  const logoStripWidth = 220;

  doc.save();
  doc
    .roundedRect(headerX, headerY, headerWidth, headerHeight, 18)
    .lineWidth(1)
    .fillAndStroke(theme.headerBackground, theme.headerBorder);
  doc.restore();

  doc.save();
  doc
    .rect(headerX, headerY, logoStripWidth, headerHeight)
    .fillAndStroke(theme.logoStrip, theme.headerBorder);
  doc.restore();

  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, headerX + 32, headerY + 24, {
      fit: [150, 70],
      align: "left",
    });
  }

  const brandTextX = headerX + 32;
  const brandTextY = headerY + 96;
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#1f2937")
    .text("Myriad Green", brandTextX, brandTextY, { width: logoStripWidth - 64 });
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor("#6b7280")
    .text("Infinite Green Solutions", brandTextX, doc.y + 2, { width: logoStripWidth - 64 });

  const titleX = headerX + logoStripWidth + 24;
  const titleWidth = headerWidth - logoStripWidth - 36;
  doc
    .font("Helvetica-Bold")
    .fontSize(TYPOGRAPHY.titleSize)
    .fillColor(theme.textPrimary)
    .text(title, titleX, headerY + 28, { width: titleWidth, align: "right", lineGap: BODY_LINE_GAP });
  doc
    .font("Helvetica")
    .fontSize(TYPOGRAPHY.subtitleSize)
    .fillColor(theme.textSecondary)
    .text(subtitle || "Prepared by Myriad Green", titleX, doc.y + 6, {
      width: titleWidth,
      align: "right",
      lineGap: BODY_LINE_GAP,
    });

  return headerY + headerHeight;
};

const addPageWithSurface = (doc, theme, previousLayout) => {
  doc.addPage();
  const newLayout = getLayout(doc);
  drawPageBackground(doc, theme, newLayout);
  drawSurface(doc, theme, newLayout);
  doc.y = newLayout.marginTop;
  return { ...previousLayout, ...newLayout, headerBottom: newLayout.marginTop };
};

const ensureSpace = (doc, theme, layout, requiredHeight, options = {}) => {
  const reserve = options.reserve ?? FOOTER_RESERVE;
  const limit = layout.pageHeight - layout.marginBottom - reserve;
  if (doc.y + requiredHeight <= limit) {
    return layout;
  }
  if (typeof options.beforeAddPage === "function") {
    options.beforeAddPage();
  }
  return addPageWithSurface(doc, theme, layout);
};

const drawSectionHeading = (doc, theme, layout, label, y) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(TYPOGRAPHY.sectionHeadingSize)
    .fillColor(theme.textPrimary)
    .text(label, layout.marginLeft, y, { lineGap: BODY_LINE_GAP });
  doc
    .moveTo(layout.marginLeft, doc.y + 6)
    .lineTo(layout.marginLeft + 80, doc.y + 6)
    .lineWidth(2)
    .strokeColor(theme.accent)
    .stroke();
  return doc.y + 24;
};

const drawField = (doc, theme, { x, y, width, label, value }) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(TYPOGRAPHY.labelSize)
    .fillColor(theme.label)
    .text(label, x, y, { width });
  const valueY = doc.y + 4;
  const normalized = formatValue(value);
  doc
    .font("Helvetica")
    .fontSize(TYPOGRAPHY.bodySize)
    .fillColor(theme.value)
    .text(normalized, x, valueY, { width, lineGap: BODY_LINE_GAP });
  const valueHeight = doc.heightOfString(normalized, { width, lineGap: BODY_LINE_GAP });
  return valueY + valueHeight + 14;
};

const drawPanel = (doc, theme, layout, { y, body = "Not provided", minHeight = 0 }) => {
  doc.font("Helvetica").fontSize(TYPOGRAPHY.bodySize);
  const innerWidth = layout.contentWidth - 36;
  const bodyHeight = doc.heightOfString(body, { width: innerWidth, lineGap: BODY_LINE_GAP });
  const panelHeight = Math.max(bodyHeight + 32, minHeight);
  const panelY = y + 8;

  doc.save();
  doc
    .roundedRect(layout.marginLeft, panelY, layout.contentWidth, panelHeight, 12)
    .fill(theme.panelBackground)
    .strokeColor(theme.panelBorder)
    .lineWidth(1)
    .stroke();
  doc.restore();

  doc
    .font("Helvetica")
    .fontSize(TYPOGRAPHY.bodySize)
    .fillColor(theme.value)
    .text(body, layout.marginLeft + 18, panelY + 14, {
      width: innerWidth,
      lineGap: BODY_LINE_GAP,
    });

  return panelY + panelHeight + 12;
};

const drawInfoTable = (doc, theme, layout, rows, startY) => {
  const columnGap = 24;
  const columnWidth = (layout.contentWidth - columnGap) / 2;
  const leftX = layout.marginLeft;
  const rightX = layout.marginLeft + columnWidth + columnGap;
  let leftY = startY;
  let rightY = startY;

  rows.left.forEach((field) => {
    leftY = drawField(doc, theme, { x: leftX, y: leftY, width: columnWidth, ...field });
  });

  rows.right.forEach((field) => {
    rightY = drawField(doc, theme, { x: rightX, y: rightY, width: columnWidth, ...field });
  });

  return Math.max(leftY, rightY);
};

const drawSystemInfo = (doc, theme, layout, startY, infoFields) => {
  const infoY = startY + 6;
  const labelX = layout.marginLeft + 16;
  const valueX = layout.marginLeft + 180;
  const valueWidth = layout.contentWidth - 200;

  const heights = infoFields.map((field) => {
    const height = doc.heightOfString(field.value || "-", { width: valueWidth, lineGap: BODY_LINE_GAP });
    return Math.max(height + 16, 28);
  });
  const totalHeight = heights.reduce((sum, h) => sum + h, 0) + 16;

  doc.save();
  doc
    .roundedRect(layout.marginLeft, infoY - 10, layout.contentWidth, totalHeight, 12)
    .fill(theme.panelBackground)
    .strokeColor(theme.panelBorder)
    .lineWidth(1)
    .stroke();
  doc.restore();

  let cursor = infoY;
  infoFields.forEach((field, index) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(TYPOGRAPHY.labelSize)
      .fillColor(theme.label)
      .text(field.label, labelX, cursor);
    doc
      .font("Helvetica")
      .fontSize(TYPOGRAPHY.bodySize)
      .fillColor(theme.value)
      .text(field.value || "-", valueX, cursor, { width: valueWidth, lineGap: BODY_LINE_GAP });
    cursor += heights[index];
  });

  return infoY - 10 + totalHeight + 12;
};

const drawContinuationNotice = (doc, theme, layout, text = CONTINUATION_NOTICE) => {
  doc
    .font("Helvetica-Oblique")
    .fontSize(TYPOGRAPHY.labelSize)
    .fillColor(theme.textSecondary)
    .text(text, layout.marginLeft, layout.pageHeight - layout.marginBottom - 100, {
      width: layout.contentWidth,
      align: "center",
    });
};

const drawFooterOnAllPages = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const currentLayout = getLayout(doc);
    const footerHeight = 120;
    const footerWidth = currentLayout.contentWidth;
    const footerX = currentLayout.marginLeft;
    const footerY = currentLayout.pageHeight - currentLayout.marginBottom - footerHeight;
    const footerPaddingX = 24;
    const footerPaddingY = 24;
    const textWidth = footerWidth - footerPaddingX * 2;

    doc.save();
    doc.rect(footerX, footerY, footerWidth, footerHeight).fill("#0B1120");
    doc
      .moveTo(footerX, footerY)
      .lineTo(footerX + footerWidth, footerY)
      .lineWidth(1)
      .strokeColor("rgba(255,255,255,0.08)")
      .stroke();
    doc.restore();

    let textY = footerY + footerPaddingY;
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#FFFFFF")
      .text("Myriad Green – Infinite Green Solutions", footerX + footerPaddingX, textY, {
        width: textWidth,
        align: "center",
      });

    textY = doc.y + 6;
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#FFFFFF")
      .opacity(0.9)
      .text(
        "Website: www.myriadgreen.co.za\nEmail: irrigationsa@gmail.com\nPhone/WhatsApp: +27 81 721 6701",
        footerX + footerPaddingX,
        textY,
        {
          width: textWidth,
          align: "center",
          lineGap: 4,
        }
      );
    doc.opacity(1);
  }
};

const drawLineItemsTable = ({ doc, theme, layout, items = [], currency = DEFAULT_CURRENCY }) => {
  const tableX = layout.marginLeft;
  const tableWidth = layout.contentWidth;
  const columns = [
    { key: "description", label: "Description", width: 0.46, align: "left" },
    { key: "quantity", label: "Qty", width: 0.12, align: "center" },
    { key: "unitPrice", label: "Unit Price", width: 0.2, align: "right" },
    { key: "total", label: "Line Total", width: 0.22, align: "right" },
  ];
  const headerHeight = 34;
  const minRowHeight = 30;
  const normalizedItems = items.length
    ? items
    : [
        {
          description: "No line items supplied",
          quantity: "-",
          unitPrice: "-",
          total: "-",
          placeholder: true,
        },
      ];

  let workingLayout = layout;

  const drawHeaderRow = () => {
    workingLayout = ensureSpace(doc, theme, workingLayout, headerHeight + 12);
    const headerY = doc.y;
    doc.save();
    doc
      .rect(tableX, headerY, tableWidth, headerHeight)
      .fillAndStroke(theme.panelBackground, theme.panelBorder);
    doc.restore();

    let xCursor = tableX + 14;
    columns.forEach((column) => {
      const colWidth = tableWidth * column.width - 24;
      doc
        .font("Helvetica-Bold")
        .fontSize(TYPOGRAPHY.labelSize)
        .fillColor(theme.label)
        .text(column.label, xCursor, headerY + 9, {
          width: colWidth,
          align: column.align,
          lineGap: BODY_LINE_GAP,
        });
      xCursor += tableWidth * column.width;
    });

    doc.y = headerY + headerHeight;
  };

  const displayValue = (column, item) => {
    if (column.key === "description") {
      return item.description || "–";
    }
    if (column.key === "quantity") {
      return item.quantity !== undefined ? item.quantity : "–";
    }
    if (column.key === "unitPrice") {
      const numeric = Number(item.unitPrice);
      if (!Number.isFinite(numeric)) {
        return item.unitPrice || "–";
      }
      return formatCurrency(numeric, currency);
    }
    if (column.key === "total") {
      if (item.placeholder) {
        return item.total;
      }
      const explicitTotal = Number(item.total);
      if (Number.isFinite(explicitTotal)) {
        return formatCurrency(explicitTotal, currency);
      }
      const computed = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      return formatCurrency(computed, currency);
    }
    return item[column.key] || "–";
  };

  drawHeaderRow();

  normalizedItems.forEach((item, index) => {
    const rowTop = doc.y;
    const columnHeights = columns.map((column) => {
      const colWidth = tableWidth * column.width - 24;
      return doc.heightOfString(displayValue(column, item), {
        width: colWidth,
        align: column.align,
        lineGap: BODY_LINE_GAP,
      });
    });
    const rowHeight = Math.max(minRowHeight, Math.max(...columnHeights) + 10);
    const available = workingLayout.pageHeight - workingLayout.marginBottom - FOOTER_RESERVE - doc.y;

    if (rowHeight > available) {
      drawContinuationNotice(doc, theme, workingLayout);
      workingLayout = addPageWithSurface(doc, theme, workingLayout);
      drawHeaderRow();
    }

    const fillColor = index % 2 === 0 ? theme.panelBackground : null;
    if (fillColor) {
      doc.save();
      doc.rect(tableX, doc.y, tableWidth, rowHeight).fill(fillColor);
      doc.restore();
    }

    let columnX = tableX + 14;
    columns.forEach((column) => {
      const colWidth = tableWidth * column.width - 24;
      doc
        .font("Helvetica")
        .fontSize(TYPOGRAPHY.bodySize)
        .fillColor(theme.value)
        .text(displayValue(column, item), columnX, rowTop + 8, {
          width: colWidth,
          align: column.align,
          lineGap: BODY_LINE_GAP,
        });
      columnX += tableWidth * column.width;
    });

    doc.y = rowTop + rowHeight;
    doc
      .lineWidth(0.5)
      .strokeColor(theme.panelBorder)
      .moveTo(tableX, doc.y)
      .lineTo(tableX + tableWidth, doc.y)
      .stroke();
  });

  return { y: doc.y, layout: workingLayout };
};

const drawTotalsBlock = (doc, theme, layout, startY, { subtotal, vatAmount, vatLabel, total, currency }) => {
  layout = ensureSpace(doc, theme, layout, 150);
  const blockY = drawSectionHeading(doc, theme, layout, "Totals", startY) + 6;
  const vatRow =
    vatAmount != null
      ? { label: vatLabel || "VAT", value: formatCurrency(vatAmount, currency) }
      : { label: "VAT", value: "VAT Included / Not Applicable" };
  const rows = [
    { label: "Subtotal", value: formatCurrency(subtotal || 0, currency) },
    vatRow,
    { label: "Grand Total", value: formatCurrency(total || subtotal || 0, currency) },
  ];

  doc.save();
  doc
    .roundedRect(layout.marginLeft, blockY, layout.contentWidth, 140, 12)
    .fill(theme.panelBackground)
    .strokeColor(theme.panelBorder)
    .lineWidth(1)
    .stroke();
  doc.restore();

  let cursor = blockY + 16;
  rows.forEach((row, index) => {
    const isGrandTotal = index === rows.length - 1;
    doc
      .font(isGrandTotal ? "Helvetica-Bold" : "Helvetica")
      .fontSize(isGrandTotal ? 12 : 10.5)
      .fillColor(isGrandTotal ? theme.accent : theme.label)
      .text(row.label, layout.marginLeft + 16, cursor);
    doc
      .font(isGrandTotal ? "Helvetica-Bold" : "Helvetica")
      .fontSize(isGrandTotal ? 13 : 11)
      .fillColor(theme.value)
      .text(row.value, layout.marginLeft + layout.contentWidth / 2, cursor, {
        width: layout.contentWidth / 2 - 24,
        align: "right",
      });
    cursor += isGrandTotal ? 36 : 28;
  });

  doc.y = blockY + 140 + 12;
  return layout;
};

const drawTermsSection = (doc, theme, layout, startY, terms) => {
  const content = terms && terms.trim().length ? terms : null;
  if (!content) {
    return layout;
  }
  layout = ensureSpace(doc, theme, layout, 140);
  let cursor = drawSectionHeading(doc, theme, layout, "Terms & Conditions", startY);
  cursor = drawPanel(doc, theme, layout, {
    y: cursor,
    body: content,
    minHeight: 100,
  });
  doc.y = cursor;
  return layout;
};

const drawSignatureBlock = (doc, theme, layout, startY, { clientName, companyContact }) => {
  layout = ensureSpace(doc, theme, layout, 200);
  const blockY = drawSectionHeading(doc, theme, layout, "Signatures", startY) + 6;
  const blockHeight = 150;
  const columnWidth = (layout.contentWidth - 24) / 2;

  doc.save();
  doc
    .roundedRect(layout.marginLeft, blockY, layout.contentWidth, blockHeight, 12)
    .fill(theme.panelBackground)
    .strokeColor(theme.panelBorder)
    .lineWidth(1)
    .stroke();
  doc.restore();

  const drawColumn = (x, title, hint) => {
    const lineSpacing = 32;
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(theme.value)
      .text(title, x, blockY + 16, { width: columnWidth });

    ["Signature", "Name", "Date"].forEach((label, idx) => {
      const lineY = blockY + 44 + idx * lineSpacing;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(theme.label)
        .text(label, x, lineY - 4);
      doc
        .moveTo(x, lineY + 8)
        .lineTo(x + columnWidth - 16, lineY + 8)
        .lineWidth(1)
        .strokeColor(theme.panelBorder)
        .stroke();
    });

    if (hint) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(theme.textSecondary)
        .text(hint, x, blockY + blockHeight - 28, { width: columnWidth });
    }
  };

  drawColumn(layout.marginLeft + 12, "Client", clientName ? `(${clientName})` : "");
  drawColumn(
    layout.marginLeft + columnWidth + 24,
    "For Myriad Green",
    companyContact ? `(${companyContact})` : ""
  );

  doc.y = blockY + blockHeight + 16;
  return layout;
};

const drawPaymentInstructions = (doc, theme, layout, startY, paymentInfo = {}) => {
  const { bankDetails = {}, paymentInstructions, paymentTerms } = paymentInfo;
  const body = [
    paymentTerms ? `Payment terms: ${paymentTerms}` : null,
    paymentInstructions || null,
    bankDetails.accountName ? `Account Name: ${bankDetails.accountName}` : null,
    bankDetails.bankName ? `Bank: ${bankDetails.bankName}` : null,
    bankDetails.accountNumber ? `Account Number: ${bankDetails.accountNumber}` : null,
    bankDetails.branchCode ? `Branch Code: ${bankDetails.branchCode}` : null,
    bankDetails.reference ? `Payment Reference: ${bankDetails.reference}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (!body) {
    return layout;
  }

  layout = ensureSpace(doc, theme, layout, 150);
  let cursor = drawSectionHeading(doc, theme, layout, "Payment Instructions", startY);
  cursor = drawPanel(doc, theme, layout, {
    y: cursor,
    body,
    minHeight: 100,
  });
  doc.y = cursor;
  return layout;
};

const renderV2SectionDivider = (doc, theme, layout) => {
  doc
    .moveTo(layout.marginLeft, doc.y)
    .lineTo(layout.marginLeft + layout.contentWidth, doc.y)
    .lineWidth(0.6)
    .strokeColor(theme.panelBorder)
    .stroke();
  doc.moveDown(0.8);
};

const renderV2Section = (doc, theme, layout, { title, estimate = 140, body, divider = true }) => {
  const nextLayout = ensureSpace(doc, theme, layout, estimate);
  const headingY = doc.y;
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(theme.textPrimary)
    .text(title, nextLayout.marginLeft, headingY, {
      width: nextLayout.contentWidth,
      lineGap: BODY_LINE_GAP,
    });
  doc
    .moveTo(nextLayout.marginLeft, doc.y + 4)
    .lineTo(nextLayout.marginLeft + 80, doc.y + 4)
    .lineWidth(2)
    .strokeColor(theme.accent)
    .stroke();
  doc.moveDown(0.8);

  if (typeof body === "function") {
    body(nextLayout);
  }

  doc.moveDown(0.8);
  if (divider) {
    renderV2SectionDivider(doc, theme, nextLayout);
  }
  doc.moveDown(0.4);
  return nextLayout;
};

const renderV2KeyValueList = (doc, theme, layout, entries = []) => {
  entries.forEach(({ label, value }) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(theme.label)
      .text(`${label}: `, layout.marginLeft, doc.y, {
        continued: true,
        width: layout.contentWidth,
      });
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor(theme.value)
      .text(formatValue(value), { continued: false, width: layout.contentWidth, lineGap: BODY_LINE_GAP });
    doc.moveDown(0.1);
  });
};

const renderV2NotesBlock = (doc, theme, layout, notes) => {
  doc.save();
  doc
    .roundedRect(layout.marginLeft, doc.y - 4, layout.contentWidth, 90, 12)
    .fill(theme.panelBackground)
    .strokeColor(theme.panelBorder)
    .lineWidth(1)
    .stroke();
  doc.restore();
  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor(theme.value)
    .text(formatValue(notes), layout.marginLeft + 14, doc.y + 12, {
      width: layout.contentWidth - 28,
      lineGap: BODY_LINE_GAP,
    });
  doc.y += 70;
};

const renderV2SignatureBlock = (doc, theme, layout, booking) => {
  const blockHeight = 160;
  doc.save();
  doc
    .roundedRect(layout.marginLeft, doc.y, layout.contentWidth, blockHeight, 12)
    .fill(theme.panelBackground)
    .strokeColor(theme.panelBorder)
    .lineWidth(1)
    .stroke();
  doc.restore();

  const columnWidth = (layout.contentWidth - 32) / 2;
  const startY = doc.y + 16;

  const drawSignatureColumn = (x, title, lines) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(theme.textPrimary)
      .text(title, x, startY, { width: columnWidth });
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(theme.value)
      .text(lines.join("\n"), x, doc.y + 6, {
        width: columnWidth,
        lineGap: BODY_LINE_GAP + 2,
      });
  };

  drawSignatureColumn(layout.marginLeft + 16, "Client", [
    `Name: ${formatValue(booking.name)}`,
    "Signature: ________________________________",
    "Date: _____________________",
  ]);

  drawSignatureColumn(layout.marginLeft + columnWidth + 32, "Myriad Green", [
    `Representative: ${formatValue(booking.accountManager || "Myriad Green Operations")}`,
    "Signature: ________________________________",
    "Date: _____________________",
  ]);

  doc.y += blockHeight + 12;
};

const renderBookingHeroV2 = (doc, theme, layout, booking) => {
  const heroHeight = 150;
  const heroX = layout.marginLeft;
  const heroY = layout.marginTop;
  doc.save();
  doc
    .roundedRect(heroX, heroY, layout.contentWidth, heroHeight, 16)
    .fillAndStroke(theme.headerBackground, theme.headerBorder);
  doc
    .rect(heroX, heroY, layout.contentWidth, 6)
    .fill(theme.accent);
  doc.restore();

  const textWidth = layout.contentWidth - 200;
  const contentX = heroX + 28;
  const contentY = heroY + 24;

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor(theme.textPrimary)
    .text("Booking Summary", contentX, contentY, { width: textWidth });
  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor(theme.textSecondary)
    .text(`Reference: ${formatValue(booking.bookingId || booking.id || "Pending")}`, contentX, doc.y + 6, {
      width: textWidth,
    });
  doc
    .text(`Prepared: ${formatDateTime(booking.createdAt)}`, contentX, doc.y + 4, {
      width: textWidth,
    })
    .text(`Service: ${formatValue(booking.service)}`, contentX, doc.y + 4, { width: textWidth })
    .text(`Client: ${formatValue(booking.name)}`, contentX, doc.y + 4, { width: textWidth });

  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, heroX + layout.contentWidth - 150, heroY + 26, {
      fit: [110, 60],
      align: "right",
    });
  }

  return heroY + heroHeight + 24;
};

const renderBookingTemplateV2 = ({ doc, theme, layout, booking }) => {
  const heroBottom = renderBookingHeroV2(doc, theme, layout, booking);
  doc.y = heroBottom;

  let workingLayout = { ...layout };

  workingLayout = renderV2Section(doc, theme, workingLayout, {
    title: "Client Details",
    estimate: 180,
    body: (currentLayout) =>
      renderV2KeyValueList(doc, theme, currentLayout, [
        { label: "Name", value: booking.name },
        { label: "Email", value: booking.email },
        { label: "Phone", value: booking.phone },
        { label: "Address", value: booking.address },
      ]),
  });

  workingLayout = renderV2Section(doc, theme, workingLayout, {
    title: "Booking Details",
    estimate: 180,
    body: (currentLayout) =>
      renderV2KeyValueList(doc, theme, currentLayout, [
        { label: "Service", value: booking.service },
        { label: "Preferred Date", value: booking.preferredDate },
        { label: "Preferred Time", value: booking.preferredTime },
        { label: "Location", value: booking.location || booking.address },
      ]),
  });

  workingLayout = renderV2Section(doc, theme, workingLayout, {
    title: "Pricing",
    estimate: 180,
    body: (currentLayout) => {
      const priceSummary = [
        { label: "Quoted Amount", value: booking.priceDisplay || booking.totalPrice || booking.basePrice },
        { label: "Deposit Due", value: booking.depositDue },
        { label: "Balance Outstanding", value: booking.balanceDue || booking.outstanding },
        { label: "Notes", value: booking.pricingNotes || "Awaiting confirmation" },
      ];
      renderV2KeyValueList(doc, theme, currentLayout, priceSummary);
    },
  });

  workingLayout = renderV2Section(doc, theme, workingLayout, {
    title: "Notes",
    estimate: 200,
    body: (currentLayout) => renderV2NotesBlock(doc, theme, currentLayout, booking.notes),
  });

  renderV2Section(doc, theme, workingLayout, {
    title: "Signatures",
    estimate: 220,
    divider: false,
    body: (currentLayout) => renderV2SignatureBlock(doc, theme, currentLayout, booking),
  });
};

const renderBookingTemplate = ({ doc, theme, layout, data }) => {
  const booking = data.booking || {};
  let cursor = drawSectionHeading(doc, theme, layout, "Booking Details", layout.headerBottom + 28);

  cursor = drawInfoTable(
    doc,
    theme,
    layout,
    {
      left: [
        { label: "Name", value: booking.name },
        { label: "Email", value: booking.email },
        { label: "Phone", value: booking.phone },
        { label: "Address", value: booking.address },
      ],
      right: [
        { label: "Service", value: booking.service },
        { label: "Preferred Date", value: booking.preferredDate },
        { label: "Preferred Time", value: booking.preferredTime },
        {
          label: "Total Price",
          value:
            booking.priceDisplay ||
            booking.totalPrice ||
            booking.basePrice ||
            "To be confirmed",
        },
      ],
    },
    cursor + 6
  );

  cursor = drawSectionHeading(doc, theme, layout, "Notes / Additional Info", cursor + 18);
  cursor = drawPanel(doc, theme, layout, {
    y: cursor,
    body: formatValue(booking.notes),
    minHeight: 110,
  });

  cursor = drawSectionHeading(doc, theme, layout, "System Info", cursor + 6);
  cursor = drawSystemInfo(doc, theme, layout, cursor, [
    { label: "Booking Reference", value: booking.bookingId || booking.id || "-" },
    { label: "Created", value: formatDateTime(booking.createdAt) },
    { label: "Source", value: booking.source || "website-v3" },
  ]);

  return cursor;
};

const renderQuoteTemplate = (context) => renderCommercialDocument(context, { mode: "quote" });
const renderInvoiceTemplate = (context) => renderCommercialDocument(context, { mode: "invoice" });

const renderCommercialDocument = ({ doc, theme, layout, data }, { mode }) => {
  const isQuote = mode === "quote";
  const payload = isQuote ? data.quote || {} : data.invoice || {};
  const currency = payload.currency || DEFAULT_CURRENCY;
  const title = isQuote ? "Quote" : "Tax Invoice";

  layout = ensureSpace(doc, theme, layout, 220);
  let cursor = drawSectionHeading(doc, theme, layout, `${title} Details`, layout.headerBottom + 24);
  cursor = drawInfoTable(
    doc,
    theme,
    layout,
    {
      left: [
        { label: "Client", value: payload.clientName || "Client" },
        { label: "Email", value: payload.clientEmail || "client@example.com" },
        { label: "Phone", value: payload.clientPhone || "+27 81 721 6701" },
        { label: "Address", value: payload.clientAddress || "Gauteng" },
      ],
      right: [
        { label: "Service", value: payload.serviceType || payload.project?.serviceType || "Irrigation" },
        { label: "Location", value: payload.project?.location || payload.location || "Gauteng" },
        {
          label: isQuote ? "Quote Number" : "Invoice Number",
          value: payload.quoteNumber || payload.invoiceNumber || payload.reference || "Pending",
        },
        {
          label: isQuote ? "Issue Date" : "Invoice Date",
          value: formatDateTime(payload.issueDate || payload.date || new Date()),
        },
        {
          label: isQuote ? "Valid Until" : "Due Date",
          value: formatDateTime(payload.validUntil || payload.dueDate || new Date(Date.now() + 7 * 86400000)),
        },
      ],
    },
    cursor + 6
  );

  if (payload.project?.notes || payload.notes) {
    layout = ensureSpace(doc, theme, layout, 140);
    cursor = drawSectionHeading(doc, theme, layout, "Project Notes", cursor + 16);
    cursor = drawPanel(doc, theme, layout, {
      y: cursor,
      body: payload.project?.notes || payload.notes,
      minHeight: 90,
    });
  }

  cursor = drawSectionHeading(doc, theme, layout, "Line Items", cursor + 24);
  doc.y = cursor + 6;
  const tableResult = drawLineItemsTable({
    doc,
    theme,
    layout,
    items: payload.lineItems || [],
    currency,
  });
  layout = tableResult.layout;
  cursor = tableResult.y + 12;

  const subtotal = payload.subtotal ?? (payload.lineItems || []).reduce((acc, item) => {
    const explicitTotal = Number(item.total);
    if (Number.isFinite(explicitTotal)) {
      return acc + explicitTotal;
    }
    return acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }, 0);
  const vatAmount = typeof payload.vatAmount === "number" ? payload.vatAmount : null;
  const vatLabel = payload.vatLabel || "VAT";
  const total = payload.total ?? (subtotal + (vatAmount || 0));
  layout = drawTotalsBlock(doc, theme, layout, cursor + 6, {
    subtotal,
    vatAmount,
    vatLabel,
    total,
    currency,
  });
  cursor = doc.y;

  if (!isQuote) {
    layout = drawPaymentInstructions(doc, theme, layout, cursor + 6, {
      paymentTerms: payload.paymentTerms,
      paymentInstructions: payload.paymentInstructions,
      bankDetails: payload.bankDetails,
    });
    cursor = doc.y;
  }

  const fallbackTerms = payload.terms || (isQuote ? "This quote is valid for 7 days unless otherwise stated." : "Payment is due according to the terms agreed with Myriad Green.");
  layout = drawTermsSection(doc, theme, layout, cursor + 6, fallbackTerms);
  cursor = doc.y;

  layout = drawSignatureBlock(doc, theme, layout, cursor + 12, {
    clientName: payload.clientName,
    companyContact: payload.accountManager || "Myriad Green Operations",
  });

  return layout;
};

const TEMPLATE_RENDERERS = {
  [TEMPLATE_TYPES.BOOKING]: renderBookingTemplate,
  [TEMPLATE_TYPES.QUOTE]: renderQuoteTemplate,
  [TEMPLATE_TYPES.INVOICE]: renderInvoiceTemplate,
};

/**
 * Renders a PDF document based on the provided type and data payloads.
 * @param {Object} options
 * @param {"booking"|"quote"|"invoice"} options.type
 * @param {"light"|"dark"} [options.theme]
 * @param {Object} [options.booking]
 * @param {QuotePayload} [options.quote]
 * @param {InvoicePayload} [options.invoice]
 * @returns {Promise<Buffer>}
 */
async function generatePdfDocument({
  type = TEMPLATE_TYPES.BOOKING,
  theme = DEFAULT_THEME,
  booking = null,
  quote = null,
  invoice = null,
} = {}) {
  const resolvedTheme = resolveTheme(theme);
  return createPdfBuffer((doc) => {
    const baseLayout = getLayout(doc);
    drawPageBackground(doc, resolvedTheme, baseLayout);
    drawSurface(doc, resolvedTheme, baseLayout);

    const headerBottom = drawHeader(doc, resolvedTheme, baseLayout, {
      title:
        type === TEMPLATE_TYPES.QUOTE
          ? "Quote"
          : type === TEMPLATE_TYPES.INVOICE
            ? "Tax Invoice"
            : "Booking Summary",
      subtitle:
        type === TEMPLATE_TYPES.BOOKING
          ? "Booking summary prepared for client"
          : type === TEMPLATE_TYPES.QUOTE
            ? "Official quotation from Myriad Green"
            : "Official tax invoice from Myriad Green",
    });

    const renderer = TEMPLATE_RENDERERS[type] || TEMPLATE_RENDERERS[TEMPLATE_TYPES.BOOKING];
    renderer({
      doc,
      theme: resolvedTheme,
      layout: { ...baseLayout, headerBottom },
      data: { booking, quote, invoice },
    });

    drawFooterOnAllPages(doc);
  });
}

function generateBookingPdf(bookingData = {}, options = {}) {
  const themeOption = typeof options === "string" ? options : options.theme;
  return generatePdfDocument({
    type: TEMPLATE_TYPES.BOOKING,
    theme: themeOption || DEFAULT_THEME,
    booking: bookingData,
  });
}

function generateBookingPdfV2(bookingData = {}, options = {}) {
  const themeOption = typeof options === "string" ? options : options.theme;
  const resolvedTheme = resolveTheme(themeOption || DEFAULT_THEME);
  return createPdfBuffer((doc) => {
    const baseLayout = getLayout(doc);
    drawPageBackground(doc, resolvedTheme, baseLayout);
    drawSurface(doc, resolvedTheme, baseLayout);
    renderBookingTemplateV2({
      doc,
      theme: resolvedTheme,
      layout: baseLayout,
      booking: bookingData,
    });
    drawFooterOnAllPages(doc);
  });
}

module.exports = {
  generateBookingPdf,
  generateBookingPdfV2,
  generatePdfDocument,
};