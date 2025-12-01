const { generateBookingPdfV2 } = require("./index");
const fs = require("fs");
const path = require("path");

const booking = {
  bookingId: "MG-BOOK-2025-001",
  reference: "MG-BOOK-2025-001",
  name: "Naledi Mokoena",
  customerName: "Naledi Mokoena",
  email: "naledi.mokoena@example.com",
  phone: "+27 82 555 0101",
  address: "54 Jacaranda Avenue, Midrand, Gauteng",
  location: "Midrand, Gauteng",
  service: "Smart Irrigation Tune-Up",
  serviceType: "Smart Irrigation Tune-Up",
  preferredDate: "2025-12-15",
  preferredTime: "09:30",
  notes: "Please inspect the back garden drip lines and advise on water savings.",
  pricingNotes: "Customer approved provisional pricing over the phone.",
  priceDisplay: "R 2,350.00",
  basePrice: 2100,
  calloutFee: 250,
  totalPrice: 2350,
  depositDue: "R 500.00",
  balanceDue: "R 1,850.00",
  outstanding: "R 1,850.00",
  accountManager: "Jacques Mit",
  createdAt: new Date().toISOString(),
  source: "manual-test",
};

generateBookingPdfV2(booking)
  .then((buffer) => {
    const outPath = path.join(__dirname, "tmp-booking-v2-test.pdf");
    fs.writeFileSync(outPath, buffer);
    console.log("PDF written to", outPath);
  })
  .catch((error) => {
    console.error("Failed to generate booking PDF v2", error);
    process.exitCode = 1;
  });
