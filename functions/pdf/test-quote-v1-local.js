const { generateQuotePdfV1 } = require("./index");
const fs = require("fs");
const path = require("path");

const quote = {
  reference: "MG-QUOTE-2025-001",
  preparedAt: new Date(),
  serviceName: "Smart Irrigation System Installation",
  clientName: "Naledi Mokoena",
  clientEmail: "naledi.mokoena@example.com",
  clientPhone: "082 456 7890",
  clientAddress: "123 Jacaranda Street, Faerie Glen, Pretoria",
  propertyType: "Residential",
  suburb: "Faerie Glen",
  city: "Pretoria",
  province: "Gauteng",
  items: [
    { description: "Smart Irrigation Controller (Rain Bird ESP-TM2)", quantity: 1, unitPrice: 2800, total: 2800 },
    { description: "Sprinkler Zone Reconfiguration + Labour", quantity: 1, unitPrice: 4200, total: 4200 },
    { description: "Pressure Regulator + Filter Kit", quantity: 1, unitPrice: 650, total: 650 }
  ],
  subtotal: 7650,
  vatAmount: 1147.5,
  totalAmount: 8797.5,
  notes: "Includes complete system flush, programming, and recommended watering schedule."
};

(async () => {
  try {
    const buffer = await generateQuotePdfV1(quote);
    const outPath = path.join(__dirname, "tmp-quote-v1-test.pdf");
    fs.writeFileSync(outPath, buffer);
    console.log("Quote v1 test PDF written to", outPath);
  } catch (error) {
    console.error("Failed to generate quote PDF v1", error);
    process.exitCode = 1;
  }
})();
