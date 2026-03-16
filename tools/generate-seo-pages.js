"use strict";

/*
  SEO page generator

  Reads:
  - data/services.csv
  - data/suburbs.csv
  - templates/service-area-template.html

  Generates one page per service x suburb combination to:
  - services/{service_slug}/{suburb_slug}/index.html

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
const TEMPLATE_FILE = path.join(TEMPLATES_DIR, "service-area-template.html");

const REQUIRED_SERVICE_HEADERS = ["service", "service_slug", "category", "primary_cta"];
const REQUIRED_SUBURB_HEADERS = ["suburb", "suburb_slug", "city", "province", "priority"];

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
    rows,
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

function replaceVariables(template, values) {
  let output = template;

  // Replace all known keys safely. Unknown placeholders remain untouched.
  Object.keys(values).forEach((key) => {
    const token = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    output = output.replace(token, safeValue(values[key]));
  });

  return output;
}

function generate() {
  const template = fs.readFileSync(TEMPLATE_FILE, "utf8");
  const servicesCsv = readCsv(SERVICES_CSV);
  const suburbsCsv = readCsv(SUBURBS_CSV);

  assertHeaders(servicesCsv.headers, REQUIRED_SERVICE_HEADERS, SERVICES_CSV);
  assertHeaders(suburbsCsv.headers, REQUIRED_SUBURB_HEADERS, SUBURBS_CSV);

  if (servicesCsv.records.length === 0) {
    throw new Error("services.csv has no data rows.");
  }

  if (suburbsCsv.records.length === 0) {
    throw new Error("suburbs.csv has no data rows.");
  }

  let generatedCount = 0;

  servicesCsv.records.forEach((service) => {
    const serviceSlug = safeValue(service.service_slug).trim();
    if (!serviceSlug) {
      throw new Error("Encountered service row with empty service_slug.");
    }

    suburbsCsv.records.forEach((suburb) => {
      const suburbSlug = safeValue(suburb.suburb_slug).trim();
      if (!suburbSlug) {
        throw new Error("Encountered suburb row with empty suburb_slug.");
      }

      const outputFolder = path.join(OUTPUT_ROOT_DIR, serviceSlug, suburbSlug);
      const outputFile = path.join(outputFolder, "index.html");

      const templateValues = {
        service: safeValue(service.service),
        service_slug: serviceSlug,
        suburb: safeValue(suburb.suburb),
        suburb_slug: suburbSlug,
        city: safeValue(suburb.city),
        province: safeValue(suburb.province),
        primary_cta: safeValue(service.primary_cta),
        // Optional values with safe fallbacks.
        title: "",
        meta_description: "",
        canonical: "",
        structured_data_json: "",
      };

      const renderedHtml = replaceVariables(template, templateValues);

      fs.mkdirSync(outputFolder, { recursive: true });
      fs.writeFileSync(outputFile, renderedHtml, "utf8");

      generatedCount += 1;
      console.log(`[GENERATED] services/${serviceSlug}/${suburbSlug}/index.html`);
    });
  });

  console.log(`\nGenerated ${generatedCount} page(s).`);
}

try {
  generate();
} catch (error) {
  console.error(`[ERROR] ${error.message}`);
  process.exitCode = 1;
}
