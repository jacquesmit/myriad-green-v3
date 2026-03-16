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

function getRelatedServices(services, currentServiceSlug) {
  return services
    .filter((service) => safeValue(service.service_slug).trim() !== currentServiceSlug)
    .slice(0, 3)
    .map((service) => ({
      slug: safeValue(service.service_slug).trim(),
      name: safeValue(service.service).trim(),
    }));
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
      const relatedServices = getRelatedServices(servicesCsv.records, serviceSlug);
      const related1 = relatedServices[0] || { slug: "", name: "" };
      const related2 = relatedServices[1] || { slug: "", name: "" };
      const related3 = relatedServices[2] || { slug: "", name: "" };
      if (!suburbSlug) {
        throw new Error("Encountered suburb row with empty suburb_slug.");
      }

      const canonicalPath = `/services/${serviceSlug}/${suburbSlug}/`;
      const pageName = `${serviceName} in ${suburbName}, ${city}`;
      const areaServed = `${suburbName}, ${city}, ${province}`;
      const outputFolder = path.join(OUTPUT_ROOT_DIR, serviceSlug, suburbSlug);
      const outputFile = path.join(outputFolder, "index.html");

      const templateValues = {
        service: serviceName,
        service_slug: serviceSlug,
        suburb: suburbName,
        suburb_slug: suburbSlug,
        city,
        province,
        primary_cta: primaryCta,
        hero_intro: `Professional ${serviceName} services in ${suburbName}, ${city}. Myriad Green provides fast diagnostics, repairs, and reliable local support.`,
        service_overview_description: `Myriad Green provides trusted ${serviceName} services in ${suburbName}, ${city}, helping homeowners, estates, and property managers solve water, drainage, and irrigation issues efficiently.`,
        benefit_1: `Fast local response in ${suburbName}`,
        benefit_2: "Professional diagnostics and repair",
        benefit_3: "Trusted service for homes and estates",
        problem_1_title: `Common ${serviceName} issue`,
        problem_1_description: `We identify and resolve common ${serviceName} issues in ${suburbName} quickly and professionally.`,
        problem_2_title: "Hidden system faults",
        problem_2_description: `Our diagnostics help uncover hidden ${serviceName} faults before they become expensive failures.`,
        problem_3_title: "Ongoing performance problems",
        problem_3_description: "We help restore reliable system performance with practical repair and maintenance solutions.",
        step_1: "Inspect and diagnose the issue",
        step_2: "Recommend the best repair solution",
        step_3: "Complete the repair and confirm system performance",
        trust_experience: "Experienced local service team",
        trust_equipment: "Professional tools and diagnostics",
        trust_response_time: `Fast response in ${suburbName} and nearby areas`,
        trust_residential_and_estates: "Trusted by homeowners, estates, and property managers",
        faq_1_q: `What does ${serviceName} cost in ${suburbName}?`,
        faq_1_a: "Pricing depends on the issue, access, and the work required. We provide clear quotes before major work begins.",
        faq_2_q: `Do you offer same-day ${serviceName} in ${suburbName}?`,
        faq_2_a: "We aim to respond quickly and offer same-day service where availability allows.",
        faq_3_q: "Do you work with homes and estates?",
        faq_3_a: `Yes. Myriad Green works with homeowners, estates, and property managers across ${city}.`,
        related_service_1_slug: related1.slug,
        related_service_1_name: related1.name,
        related_service_2_slug: related2.slug,
        related_service_2_name: related2.name,
        related_service_3_slug: related3.slug,
        related_service_3_name: related3.name,
        cta_intro: `Need professional ${serviceName} in ${suburbName}? Contact Myriad Green for fast local assistance.`,
        book_service_url: "#booking",
        contact_url: "#contact",
        title: `${pageName} | Myriad Green`,
        meta_description: `Professional ${serviceName} services in ${suburbName}, ${city}, ${province}. Fast diagnostics and repair by Myriad Green.`,
        canonical: canonicalPath,
        structured_data_json: buildStructuredData({
          name: pageName,
          areaServed,
          url: canonicalPath,
        }),
      };

      let renderedHtml = replaceVariables(template, templateValues);
      renderedHtml = renderedHtml.replace(/\{\{[^}]+\}\}/g, "");

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
