const EMULATOR_URL = "http://127.0.0.1:5001/myriad-green-v3/africa-south1/sendServiceReport";

const reportPayload = {
  reportNumber: "SR-2025-LOCAL-TEST",
  reference: "MG-SERVICE-2025-012",
  serviceName: "Irrigation System Diagnostics",
  clientName: "Nomsa Khumalo",
  clientEmail: "nomsa.khumalo@example.com",
  clientPhone: "+27 82 111 2233",
  clientAddress: "12 Protea Crescent, Randpark Ridge, Johannesburg",
  suburb: "Randpark Ridge",
  city: "Johannesburg",
  province: "Gauteng",
  propertyType: "Residential",
  siteNotes:
    "Client has a 6-zone Hunter system fed from municipal supply with JoJo backup tank. Access via side gate. Controller located in garage.",
  technicianName: "S. van der Merwe",
  technicianNotes:
    "System was bypassed due to continuous pressure loss. Existing controller schedule disabled pending repairs.",
  visitDate: "2025-12-04T08:30:00+02:00",
  arrivalTime: "08:30",
  departureTime: "11:45",
  findings:
    "Detected air ingress on main manifold and two seized solenoids on zones 4 and 5. Flow meter indicates 22% variance compared to baseline.",
  actionsTaken:
    "Replaced faulty solenoids, reseated manifold seals, flushed main line, recalibrated controller schedule, and verified pressure at 3.2 bar across all zones.",
  recommendations:
    "Install surge protection on controller, replace inline filter quarterly, and monitor flow readings weekly for the next month.",
  followUpRequired: true,
  followUpNotes:
    "Book follow-up pressure and flow verification in 14 days. Client interested in smart controller upgrade—prepare proposal.",
  materialsUsed: [
    { name: "25mm manifold seal kit", quantity: 1, notes: "Full kit used" },
    { name: "Hunter 24VAC solenoid", quantity: 2, notes: "Zones 4 and 5" },
    { name: "Inline filter cartridge", quantity: 1 },
  ],
};

function ensureFetchAvailable() {
  if (typeof fetch === "function") {
    return fetch;
  }
  console.error("Global fetch is not available. Please run this script with Node.js 18 or newer.");
  process.exit(1);
}

async function run() {
  const safeFetch = ensureFetchAvailable();
  const requestBody = { report: reportPayload };

  try {
    const response = await safeFetch(EMULATOR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody, null, 2),
    });

    console.log("HTTP Status:", response.status, response.statusText);

    const rawText = await response.text();
    console.log("Raw Response:\n", rawText);

    try {
      const parsed = JSON.parse(rawText);
      console.log("Parsed JSON:", parsed);
    } catch (parseError) {
      console.log("Response could not be parsed as JSON.");
    }
  } catch (error) {
    console.error("Request failed:", error);
    process.exitCode = 1;
  }
}

run();
