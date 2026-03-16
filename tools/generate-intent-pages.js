"use strict";

/*
  Intent page generator

  Reads:
  - data/services.csv
  - data/suburbs.csv
  - data/intents.csv
  - templates/intent-page-template.html

  Generates one page per service x suburb x intent combination:
  - services/{service_slug}/{suburb_slug}/{intent_slug}/index.html

  Uses only built-in Node.js modules.
*/

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const TEMPLATES_DIR = path.join(ROOT_DIR, "templates");
const OUTPUT_ROOT_DIR = path.join(ROOT_DIR, "services");

const SERVICES_CSV = path.join(DATA_DIR, "services.csv");
const SUBURBS_CSV = path.join(DATA_DIR, "suburbs.csv");
const INTENTS_CSV = path.join(DATA_DIR, "intents.csv");
const TEMPLATE_FILE = path.join(TEMPLATES_DIR, "intent-page-template.html");

const REQUIRED_SERVICE_HEADERS = ["service", "service_slug", "category", "primary_cta"];
const REQUIRED_SUBURB_HEADERS = ["suburb", "suburb_slug", "city", "province", "priority"];
const REQUIRED_INTENT_HEADERS = ["intent", "intent_slug", "priority"];

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing input file: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error(`CSV has no content: ${filePath}`);
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);

  return {
    headers,
    records: rows.map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = typeof row[index] === "string" ? row[index] : "";
      });
      return record;
    }),
  };
}

function assertHeaders(actualHeaders, requiredHeaders, filePath) {
  const missing = requiredHeaders.filter((header) => !actualHeaders.includes(header));
  if (missing.length > 0) {
    throw new Error(
      `CSV header mismatch in ${filePath}. Missing required header(s): ${missing.join(", ")}`
    );
  }
}

function safeValue(value) {
  return typeof value === "string" ? value : "";
}

function buildStructuredData({ name, areaServed, url }) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name,
      areaServed,
      provider: {
        name: "Myriad Green",
      },
      url,
    },
    null,
    2
  );
}

function replaceVariables(template, values) {
  let output = template;

  Object.keys(values).forEach((key) => {
    const token = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    output = output.replace(token, safeValue(values[key]));
  });

  // Any placeholders not explicitly populated get safe empty-string fallback.
  output = output.replace(/\{\{[^}]+\}\}/g, "");

  return output;
}

function generate() {
  const template = fs.readFileSync(TEMPLATE_FILE, "utf8");
  const servicesCsv = readCsv(SERVICES_CSV);
  const suburbsCsv = readCsv(SUBURBS_CSV);
  const intentsCsv = readCsv(INTENTS_CSV);

  assertHeaders(servicesCsv.headers, REQUIRED_SERVICE_HEADERS, SERVICES_CSV);
  assertHeaders(suburbsCsv.headers, REQUIRED_SUBURB_HEADERS, SUBURBS_CSV);
  assertHeaders(intentsCsv.headers, REQUIRED_INTENT_HEADERS, INTENTS_CSV);

  if (servicesCsv.records.length === 0) {
    throw new Error("services.csv has no data rows.");
  }

  if (suburbsCsv.records.length === 0) {
    throw new Error("suburbs.csv has no data rows.");
  }
  if (intentsCsv.records.length === 0) {
    throw new Error("intents.csv has no data rows.");
  }

  let generatedCount = 0;

  servicesCsv.records.forEach((service) => {
    const serviceName = safeValue(service.service).trim();
    const serviceSlug = safeValue(service.service_slug).trim();
    const primaryCta = safeValue(service.primary_cta).trim();

    if (!serviceSlug) {
      throw new Error("Encountered service row with empty service_slug.");
    }

    suburbsCsv.records.forEach((suburb) => {
      const suburbName = safeValue(suburb.suburb).trim();
      const suburbSlug = safeValue(suburb.suburb_slug).trim();
      const city = safeValue(suburb.city).trim();
      const province = safeValue(suburb.province).trim();

      if (!suburbSlug) {
        throw new Error("Encountered suburb row with empty suburb_slug.");
      }

      intentsCsv.records.forEach((intent) => {
        const intentName = safeValue(intent.intent).trim();
        const intentSlug = safeValue(intent.intent_slug).trim();

        if (!intentSlug) {
          throw new Error("Encountered intent row with empty intent_slug.");
        }

        const canonicalPath = `/services/${serviceSlug}/${suburbSlug}/${intentSlug}/`;
        const pageName = `${serviceName} in ${suburbName}, ${city} – ${intentName}`;
        const areaServed = `${suburbName}, ${city}, ${province}`;
        const outputFolder = path.join(OUTPUT_ROOT_DIR, serviceSlug, suburbSlug, intentSlug);
        const outputFile = path.join(outputFolder, "index.html");

        const templateValues = {
          service: serviceName,
          service_slug: serviceSlug,
          suburb: suburbName,
          suburb_slug: suburbSlug,
          city,
          province,
          intent: intentName,
          intent_slug: intentSlug,
          primary_cta: primaryCta,
          title: `${pageName} | Myriad Green`,
          meta_description: `Professional ${serviceName} in ${suburbName}, ${city}. ${intentName} by Myriad Green.`,
          canonical: canonicalPath,
          structured_data_json: buildStructuredData({
            name: pageName,
            areaServed,
            url: canonicalPath,
          }),
        };

        const renderedHtml = replaceVariables(template, templateValues);

        fs.mkdirSync(outputFolder, { recursive: true });
        fs.writeFileSync(outputFile, renderedHtml, "utf8");

        generatedCount += 1;
        console.log(`[GENERATED] services/${serviceSlug}/${suburbSlug}/${intentSlug}/index.html`);
      });
    });
  });

  console.log(`Generated ${generatedCount} intent pages`);
}

try {
  generate();
} catch (error) {
  console.error(`[ERROR] ${error.message}`);
  process.exitCode = 1;
}
