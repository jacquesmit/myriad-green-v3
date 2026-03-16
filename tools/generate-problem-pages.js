"use strict";

/*
  Problem page generator

  Reads:
  - data/services.csv
  - data/suburbs.csv
  - data/problems.csv
  - templates/problem-page-template.html

  Generates one page per matching service/problem row and each suburb row:
  - services/{service_slug}/{suburb_slug}/{problem_slug}/index.html

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
const PROBLEMS_CSV = path.join(DATA_DIR, "problems.csv");
const INTENTS_CSV = path.join(DATA_DIR, "intents.csv");
const TEMPLATE_FILE = path.join(TEMPLATES_DIR, "problem-page-template.html");

const REQUIRED_SERVICE_HEADERS = ["service", "service_slug", "category", "primary_cta"];
const REQUIRED_SUBURB_HEADERS = ["suburb", "suburb_slug", "city", "province", "priority"];
const REQUIRED_PROBLEM_HEADERS = ["service_slug", "problem", "problem_slug", "category", "priority"];
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

function getNearbySuburbs(suburbs, currentSuburbSlug) {
  return suburbs
    .filter((suburb) => safeValue(suburb.suburb_slug).trim() !== currentSuburbSlug)
    .slice(0, 3)
    .map((suburb) => ({
      slug: safeValue(suburb.suburb_slug).trim(),
      suburb: safeValue(suburb.suburb).trim(),
      city: safeValue(suburb.city).trim(),
    }));
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
  const problemsCsv = readCsv(PROBLEMS_CSV);
  const intentsCsv = readCsv(INTENTS_CSV);

  assertHeaders(servicesCsv.headers, REQUIRED_SERVICE_HEADERS, SERVICES_CSV);
  assertHeaders(suburbsCsv.headers, REQUIRED_SUBURB_HEADERS, SUBURBS_CSV);
  assertHeaders(problemsCsv.headers, REQUIRED_PROBLEM_HEADERS, PROBLEMS_CSV);
  assertHeaders(intentsCsv.headers, REQUIRED_INTENT_HEADERS, INTENTS_CSV);

  if (servicesCsv.records.length === 0) {
    throw new Error("services.csv has no data rows.");
  }
  if (suburbsCsv.records.length === 0) {
    throw new Error("suburbs.csv has no data rows.");
  }
  if (problemsCsv.records.length === 0) {
    throw new Error("problems.csv has no data rows.");
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

    const matchingProblems = problemsCsv.records.filter(
      (problem) => safeValue(problem.service_slug).trim() === serviceSlug
    );

    matchingProblems.forEach((problem) => {
      const problemName = safeValue(problem.problem).trim();
      const problemSlug = safeValue(problem.problem_slug).trim();

      if (!problemSlug) {
        throw new Error(`Encountered problem row with empty problem_slug for service '${serviceSlug}'.`);
      }

      suburbsCsv.records.forEach((suburb) => {
        const suburbName = safeValue(suburb.suburb).trim();
        const suburbSlug = safeValue(suburb.suburb_slug).trim();
        const city = safeValue(suburb.city).trim();
        const province = safeValue(suburb.province).trim();
        const nearbySuburbs = getNearbySuburbs(suburbsCsv.records, suburbSlug);
        const nearby1 = nearbySuburbs[0] || { slug: "", suburb: "", city: "" };
        const nearby2 = nearbySuburbs[1] || { slug: "", suburb: "", city: "" };
        const nearby3 = nearbySuburbs[2] || { slug: "", suburb: "", city: "" };
        const siblingProblems = matchingProblems
          .filter((item) => safeValue(item.problem_slug).trim() !== problemSlug)
          .slice(0, 3)
          .map((item) => ({
            slug: safeValue(item.problem_slug).trim(),
            name: safeValue(item.problem).trim(),
          }));
        const relatedProblem1 = siblingProblems[0] || { slug: "", name: "" };
        const relatedProblem2 = siblingProblems[1] || { slug: "", name: "" };
        const relatedProblem3 = siblingProblems[2] || { slug: "", name: "" };
        const relatedIntents = intentsCsv.records.slice(0, 3).map((intent) => ({
          slug: safeValue(intent.intent_slug).trim(),
          name: safeValue(intent.intent).trim(),
        }));
        const relatedIntent1 = relatedIntents[0] || { slug: "", name: "" };
        const relatedIntent2 = relatedIntents[1] || { slug: "", name: "" };
        const relatedIntent3 = relatedIntents[2] || { slug: "", name: "" };

        if (!suburbSlug) {
          throw new Error("Encountered suburb row with empty suburb_slug.");
        }

        const canonicalPath = `/services/${serviceSlug}/${suburbSlug}/${problemSlug}/`;
        const pageName = `${serviceName} for ${problemName} in ${suburbName}, ${city}`;
        const areaServed = `${suburbName}, ${city}, ${province}`;
        const outputFolder = path.join(OUTPUT_ROOT_DIR, serviceSlug, suburbSlug, problemSlug);
        const outputFile = path.join(outputFolder, "index.html");

        const templateValues = {
          service: serviceName,
          service_slug: serviceSlug,
          suburb: suburbName,
          suburb_slug: suburbSlug,
          city,
          province,
          problem: problemName,
          problem_slug: problemSlug,
          primary_cta: primaryCta,
          parent_service_url: `/services/${serviceSlug}/${suburbSlug}/`,
          parent_service_name: `${serviceName} in ${suburbName}, ${city}`,
          nearby_link_1_url: nearby1.slug ? `/services/${serviceSlug}/${nearby1.slug}/` : "",
          nearby_link_1_name: nearby1.suburb ? `${serviceName} in ${nearby1.suburb}, ${nearby1.city}` : "",
          nearby_link_2_url: nearby2.slug ? `/services/${serviceSlug}/${nearby2.slug}/` : "",
          nearby_link_2_name: nearby2.suburb ? `${serviceName} in ${nearby2.suburb}, ${nearby2.city}` : "",
          nearby_link_3_url: nearby3.slug ? `/services/${serviceSlug}/${nearby3.slug}/` : "",
          nearby_link_3_name: nearby3.suburb ? `${serviceName} in ${nearby3.suburb}, ${nearby3.city}` : "",
          related_problem_1_url: relatedProblem1.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedProblem1.slug}/` : "",
          related_problem_1_name: relatedProblem1.name,
          related_problem_2_url: relatedProblem2.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedProblem2.slug}/` : "",
          related_problem_2_name: relatedProblem2.name,
          related_problem_3_url: relatedProblem3.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedProblem3.slug}/` : "",
          related_problem_3_name: relatedProblem3.name,
          related_intent_1_url: relatedIntent1.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedIntent1.slug}/` : "",
          related_intent_1_name: relatedIntent1.name,
          related_intent_2_url: relatedIntent2.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedIntent2.slug}/` : "",
          related_intent_2_name: relatedIntent2.name,
          related_intent_3_url: relatedIntent3.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedIntent3.slug}/` : "",
          related_intent_3_name: relatedIntent3.name,
          title: `${pageName} | Myriad Green`,
          meta_description: `Professional ${serviceName} for ${problemName} in ${suburbName}, ${city}, ${province}. Fast diagnostics and repair by Myriad Green.`,
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
        console.log(`[GENERATED] services/${serviceSlug}/${suburbSlug}/${problemSlug}/index.html`);
      });
    });
  });

  console.log(`Generated ${generatedCount} problem pages`);
}

try {
  generate();
} catch (error) {
  console.error(`[ERROR] ${error.message}`);
  process.exitCode = 1;
}
