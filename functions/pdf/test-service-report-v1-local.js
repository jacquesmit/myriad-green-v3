const fs = require("fs");
const path = require("path");
const { generateServiceReportPdfV1 } = require("./index");

(async () => {
  try {
    const report = {
      reportNumber: "SR-2025-001",
      reference: "MG-BOOKING-TEST-001",
      serviceName: "Leak Detection – Residential",
      clientName: "Naledi Mokoena",
      clientEmail: "naledi.mokoena@example.com",
      clientPhone: "082 456 7890",
      clientAddress: "123 Jacaranda Street, Faerie Glen, Pretoria",
      suburb: "Faerie Glen",
      city: "Pretoria",
      province: "Gauteng",

      technicianName: "J. Smit",
      visitDate: new Date(),
      arrivalTime: "09:15",
      departureTime: "11:00",
      propertyType: "Residential",
      siteNotes:
        "Single-storey home, access via side gate. Municipal supply with JoJo backup tank.",

      findings:
        "Detected a significant underground leak on the main irrigation line between zones 3 and 4. Pressure drop observed on test, acoustic detection confirmed location near eastern boundary wall.",
      actionsTaken:
        "Isolated the affected section, exposed pipe at the leak position, replaced damaged section of 25mm LDPE, re-pressurised system, and tested all affected zones for additional leaks.",
      recommendations:
        "Install a master isolation valve and pressure regulation valve at the tank outlet. Recommend follow-up pressure test in 6 months, or sooner if water usage spikes.",

      materialsUsed: [
        { name: "25mm LDPE pipe", quantity: 3, notes: "Metres replaced" },
        { name: "25mm joiners and clamps", quantity: 4 },
        { name: "Teflon tape", quantity: 1, notes: "For threaded fittings" },
      ],

      followUpRequired: true,
      followUpNotes:
        "Client approved quote for master valve and PRV install. Schedule follow-up visit within 2–3 weeks.",
    };

    const pdfBuffer = await generateServiceReportPdfV1(report);
    const outputPath = path.join(__dirname, "tmp-service-report-v1-test.pdf");
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(`Service Report PDF generated: ${outputPath}`);
  } catch (error) {
    console.error("Failed to generate service report PDF", error);
    process.exitCode = 1;
  }
})();
