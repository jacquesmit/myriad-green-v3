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
const SERVICE_CONTENT_CSV = path.join(DATA_DIR, "service-content.csv");
const PROBLEMS_CSV = path.join(DATA_DIR, "problems.csv");
const PROBLEM_CONTENT_CSV = path.join(DATA_DIR, "problem-content.csv");
const INTENTS_CSV = path.join(DATA_DIR, "intents.csv");
const INTENT_CONTENT_CSV = path.join(DATA_DIR, "intent-content.csv");
const TEMPLATE_FILE = path.join(TEMPLATES_DIR, "service-area-template.html");
const INTERNAL_LINKS_PARTIAL_FILE = path.join(TEMPLATES_DIR, "partials", "internal-links.html");

const REQUIRED_SERVICE_HEADERS = ["service", "service_slug", "category", "primary_cta"];
const REQUIRED_SUBURB_HEADERS = ["suburb", "suburb_slug", "city", "province", "priority"];
const REQUIRED_SERVICE_CONTENT_HEADERS = [
  "service_slug",
  "hero_intro",
  "overview",
  "benefit_1",
  "benefit_2",
  "benefit_3",
  "trust_experience",
  "trust_equipment",
  "trust_response_time",
  "trust_residential_and_estates",
  "cta_intro",
];
const REQUIRED_PROBLEM_HEADERS = ["service_slug", "problem", "problem_slug", "category", "priority"];
const REQUIRED_PROBLEM_CONTENT_HEADERS = [
  "problem_slug",
  "symptom_1",
  "symptom_2",
  "symptom_3",
  "step_1",
  "step_2",
  "step_3",
  "faq_1_q",
  "faq_1_a",
  "faq_2_q",
  "faq_2_a",
  "faq_3_q",
  "faq_3_a",
];
const REQUIRED_INTENT_HEADERS = ["intent", "intent_slug", "priority"];
const REQUIRED_INTENT_CONTENT_HEADERS = [
  "intent_slug",
  "hero_intro",
  "intent_overview",
  "reason_1",
  "reason_2",
  "reason_3",
  "step_1",
  "step_2",
  "step_3",
  "faq_1_q",
  "faq_1_a",
  "faq_2_q",
  "faq_2_a",
  "faq_3_q",
  "faq_3_a",
];
const SERVICE_PAGE_ALIASES = {
  "drain-camera-inspection": {
    slug: "drain-unblocking",
    name: "Drain Unblocking",
  },
  "irrigation-repair": {
    slug: "irrigation",
    name: "Irrigation Systems",
  },
  "borehole-pump-systems": {
    slug: "backup-water",
    name: "Backup Water Systems",
  },
};

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

function firstNonEmpty(...values) {
  for (const value of values) {
    const trimmed = safeValue(value).trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function toSentence(value) {
  const trimmed = safeValue(value).trim();
  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function joinSentences(...values) {
  return values
    .map(toSentence)
    .filter((value) => value.length > 0)
    .join(" ");
}

function lowerFirst(value) {
  const trimmed = safeValue(value).trim();
  if (!trimmed) {
    return "";
  }

  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

function upperFirst(value) {
  const trimmed = safeValue(value).trim();
  if (!trimmed) {
    return "";
  }

  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function lowerCaseWords(value) {
  return safeValue(value).trim().toLowerCase();
}

function withIndefiniteArticle(value) {
  const trimmed = safeValue(value).trim();
  if (!trimmed) {
    return "";
  }

  if (/^(a|an|the)\s+/i.test(trimmed)) {
    return trimmed;
  }

  if (/\b(issues|problems|systems|services)\b/i.test(trimmed)) {
    return trimmed;
  }

  const article = /^[aeiou]/i.test(trimmed) ? "an" : "a";
  return `${article} ${trimmed}`;
}

function stripTrailingPunctuation(value) {
  const trimmed = safeValue(value).trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/[.!?]+$/, "");
}

function buildCoverageLinkLabel(serviceName, suburbName) {
  return `${serviceName} coverage in ${suburbName}`;
}

function buildServiceOptionLabel(serviceName, intentName) {
  return `${intentName} for ${serviceName}`;
}

function formatList(values, conjunction = "and") {
  const items = values
    .map(stripTrailingPunctuation)
    .filter((value) => value.length > 0);

  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} ${conjunction} ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, ${conjunction} ${items[items.length - 1]}`;
}

function pickListItems(values, limit = 2) {
  return values
    .map(stripTrailingPunctuation)
    .filter((value) => value.length > 0)
    .slice(0, limit);
}

function pickSignalByVariant(values, variant) {
  const items = values.filter(Boolean);
  if (items.length === 0) {
    return "";
  }

  return items[Math.min(variant, items.length - 1)];
}

function splitCauseParts(value) {
  const cause = stripTrailingPunctuation(value);
  if (!cause) {
    return [];
  }

  if (/\s+or\s+/i.test(cause)) {
    return cause.split(/\s+or\s+/i).map(stripTrailingPunctuation).filter(Boolean);
  }

  if (/\s+and\s+/i.test(cause)) {
    return cause.split(/\s+and\s+/i).map(stripTrailingPunctuation).filter(Boolean);
  }

  return [cause];
}

function looksLikeClause(value) {
  const text = safeValue(value).trim().toLowerCase();
  if (!text) {
    return false;
  }

  return /\b(is|are|was|were|does|do|can|rises?|drops?|fails?|appears?|responds?|runs?|needs?|shows?|starts?|stops?|becomes?|feels?|backs?)\b/.test(
    text
  );
}

function containsContext(text, values) {
  const haystack = safeValue(text).trim().toLowerCase();
  if (!haystack) {
    return false;
  }

  return values.some((value) => {
    const needle = safeValue(value).trim().toLowerCase();
    return needle && haystack.includes(needle);
  });
}

function replaceLeadingPhrase(text, words, replacement) {
  const pattern = new RegExp(`^${words.join("\\s+")}\\s+`, "i");
  return safeValue(text).replace(pattern, replacement);
}

function buildLocalServiceHeroIntro(base, serviceName, suburbName, city) {
  const serviceLead = stripTrailingPunctuation(base)
    .split(/\s+with\s+/i)[0]
    .trim();
  if (serviceLead) {
    return joinSentences(
      `Myriad Green delivers ${lowerFirst(serviceLead)} across ${suburbName}, ${city}`,
      `Each visit is built around clear fault isolation and practical repair guidance`
    );
  }

  return joinSentences(
    `Myriad Green provides ${serviceName.toLowerCase()} support across ${suburbName}, ${city}`,
    `Each visit is built around clear fault isolation and practical repair guidance`
  );
}

function buildLocalServiceOverview(base, serviceName, suburbName, city) {
  const overviewLead = stripTrailingPunctuation(base)
    .split(/,\s+helping\s+/i)[0]
    .replace(/^Myriad Green\b/i, "Our team");
  if (overviewLead) {
    return joinSentences(
      `${overviewLead} across ${suburbName}, ${city}`,
      `Findings are explained clearly before any repair work is recommended`
    );
  }

  return joinSentences(
    `Our team handles ${serviceName.toLowerCase()} work across ${suburbName}, ${city}`,
    `Findings are explained clearly before any repair work is recommended`
  );
}

function inferProblemCause(problemName, serviceName, primaryStep) {
  const problemLower = safeValue(problemName).trim().toLowerCase();
  const serviceLower = safeValue(serviceName).trim().toLowerCase();
  const stepLower = stripTrailingPunctuation(primaryStep).toLowerCase();

  if (problemLower.includes("slab")) {
    return "hidden water loss below the slab";
  }

  if (problemLower.includes("pool")) {
    return "a leak around the pool shell or pipework";
  }

  if (problemLower.includes("underground")) {
    return "damaged pipework below the surface";
  }

  if (problemLower.includes("wall")) {
    return "moisture escaping from concealed pipework";
  }

  if (problemLower.includes("water bill")) {
    return "hidden water loss somewhere in the system";
  }

  if (problemLower.includes("blocked") || problemLower.includes("blockage")) {
    return "a build-up restricting the line";
  }

  if (problemLower.includes("controller")) {
    return "wiring faults or unstable controller power";
  }

  if (problemLower.includes("sprinkler")) {
    return "damaged sprinkler components or uneven pressure";
  }

  if (problemLower.includes("valve")) {
    return "a faulty valve or an electrical issue";
  }

  if (problemLower.includes("pressure")) {
    return "supply instability or restriction in the line";
  }

  if (problemLower.includes("pump")) {
    return "pump wear or a pressure-control fault";
  }

  if (problemLower.includes("pipe")) {
    return "damaged pipework or a failing fitting";
  }

  if (stepLower.includes("water loss")) {
    return "hidden water loss inside the system";
  }

  return `an underlying ${serviceLower} fault`;
}

function buildProblemSubject(problemName, suburbName) {
  const label = upperFirst(withIndefiniteArticle(problemName.toLowerCase()));
  return suburbName ? `${label} in ${suburbName}` : label;
}

function buildProblemSymptomSentence(problemName, suburbName, symptomText, variant, index) {
  return buildProblemObservationSentence(problemName, suburbName, symptomText, (variant + index) % 3);
}

function buildProblemSymptomSentences(problemName, suburbName, symptoms, variant) {
  const symptomItems = symptoms.filter(Boolean);
  if (symptomItems.length === 0) {
    return [`${problemName} can stay hidden on ${suburbName} properties until the wider fault becomes obvious.`];
  }

  return symptomItems.map((symptom, index) =>
    buildProblemSymptomSentence(problemName, suburbName, symptom, variant, index)
  );
}

function buildProblemCauseSentences(problemName, cause, variant) {
  const parts = splitCauseParts(cause).slice(0, 2);
  if (parts.length === 0) {
    return [];
  }

  return parts
    .map((part, index) => buildProblemTriggerSentence(problemName, part, "", (variant + index) % 3))
    .filter(Boolean);
}

function buildProblemUrgencySentence(serviceName, suburbName, city, variant) {
  const serviceLower = serviceName.toLowerCase();

  if (variant === 0) {
    return `Early ${serviceLower} in ${suburbName} keeps the repair scope clear.`;
  }

  if (variant === 1) {
    return `A prompt ${serviceLower} visit in ${city} helps prevent wider damage.`;
  }

  return `Accurate diagnosis in ${suburbName} keeps the next repair step targeted.`;
}

function buildProblemTriggerSentence(problemName, cause, suburbName, variant) {
  const causeText = stripTrailingPunctuation(cause);
  if (!causeText) {
    return "";
  }

  const baseProblem = lowerFirst(withIndefiniteArticle(problemName.toLowerCase()));

  if (variant === 0) {
    return `${upperFirst(causeText)} is a common cause of ${baseProblem}${suburbName ? ` in ${suburbName}` : ""}.`;
  }

  if (variant === 1) {
    return suburbName
      ? `${upperFirst(causeText)} is one of the main faults behind ${baseProblem} on ${suburbName} properties.`
      : `${upperFirst(causeText)} is one of the main faults behind ${baseProblem}.`;
  }

  return `${upperFirst(causeText)} can keep the fault active and increase repair work if it is left unresolved.`;
}

function buildProblemObservationSentence(problemName, suburbName, symptomText, variant) {
  const symptom = stripTrailingPunctuation(symptomText);
  if (!symptom) {
    return "";
  }

  if (looksLikeClause(symptom)) {
    if (variant === 0) {
      return `${upperFirst(symptom)}.`;
    }

    if (variant === 1) {
      return `Homeowners in ${suburbName} notice when ${lowerFirst(symptom)}.`;
    }

    return `One clear sign is that ${lowerFirst(symptom)}.`;
  }

  if (variant === 0) {
    return `A visible warning sign is ${lowerFirst(symptom)}.`;
  }

  if (variant === 1) {
    return `Homeowners in ${suburbName} notice ${lowerFirst(symptom)}.`;
  }

  return `One sign on the property is ${lowerFirst(symptom)}.`;
}

function inferServiceLocalAreaNeeds(serviceName) {
  const serviceLower = safeValue(serviceName).trim().toLowerCase();

  if (serviceLower.includes("leak")) {
    return "hidden leaks, rising water bills, damp patches, and pressure changes";
  }

  if (serviceLower.includes("irrigation")) {
    return "pressure loss, controller faults, leaking zones, and uneven coverage";
  }

  if (serviceLower.includes("drain")) {
    return "slow drainage, recurring blockages, and backed-up waste lines";
  }

  if (serviceLower.includes("borehole") || serviceLower.includes("pump")) {
    return "pump faults, unstable pressure, and interrupted backup water supply";
  }

  return "faults that need accurate diagnosis and practical repair planning";
}

function buildServiceLocalAreaCopy(serviceName, suburbName, city) {
  return `Myriad Green provides ${serviceName.toLowerCase()} across ${suburbName} and surrounding ${city} areas, with fast response and practical on-site support.`;
}

function buildProblemDecisionSentence(serviceName, suburbName, city, variant) {
  const serviceLower = serviceName.toLowerCase();

  if (variant === 0) {
    return `A focused ${serviceLower} visit in ${suburbName} keeps repair work limited to the affected area.`;
  }

  if (variant === 1) {
    return `Targeted testing in ${city} confirms what needs repair before extra costs build up.`;
  }

  return `Professional diagnosis gives the property a clear repair decision before the issue spreads further.`;
}

function buildCommonProblemDescription(problemName, problemContent, serviceName, suburbName, city, variant) {
  const symptoms = pickListItems(
    [problemContent.symptom_1, problemContent.symptom_2, problemContent.symptom_3].map(safeValue),
    3
  );
  const symptom = firstNonEmpty(
    pickSignalByVariant(symptoms, variant),
    `disruption linked to ${problemName.toLowerCase()}`
  );
  const cause = inferProblemCause(
    problemName,
    serviceName,
    firstNonEmpty(problemContent.step_1, problemContent.step_2)
  );
  return joinSentences(
    buildProblemObservationSentence(problemName, suburbName, symptom, variant),
    buildProblemTriggerSentence(problemName, cause, suburbName, variant),
    buildProblemDecisionSentence(serviceName, suburbName, city, variant)
  );
}

function buildLocalCtaIntro(base, serviceName, suburbName, city) {
  const trailingCopy = safeValue(base).split("?").slice(1).join("?").trim();
  const ctaLead = stripTrailingPunctuation(
    firstNonEmpty(trailingCopy, "book with Myriad Green or contact us for practical local assistance")
  );

  return joinSentences(
    `${upperFirst(serviceName.toLowerCase())} work in ${suburbName}, ${city} starts with a clear diagnosis`,
    `You can ${lowerFirst(ctaLead)}`
  );
}

function buildSuburbFaqAnswer(answer, serviceName, suburbName, city, index) {
  let output = safeValue(answer).trim();
  const contextSentences = [
    `Local ${serviceName.toLowerCase()} work in ${suburbName}, ${city} confirms the fault before repair work starts`,
    `Early diagnosis in ${suburbName}, ${city} helps limit wider disruption`,
    `A prompt assessment in ${suburbName}, ${city} keeps the repair plan clear`,
  ];

  if (!output) {
    return `${contextSentences[index]}.`;
  }

  output = replaceLeadingPhrase(
    output,
    ["Common", "signs", "include"],
    `Typical signs that ${serviceName.toLowerCase()} is needed on ${suburbName} properties include `
  );

  if (!containsContext(output, [suburbName, city, serviceName])) {
    output = joinSentences(output, contextSentences[index]);
  }

  return output;
}

function indexRecordsByKey(records, keyName, label) {
  const recordMap = new Map();

  records.forEach((record) => {
    const key = safeValue(record[keyName]).trim();

    if (!key) {
      throw new Error(`Encountered ${label} row with empty ${keyName}.`);
    }

    if (recordMap.has(key)) {
      throw new Error(`Duplicate ${keyName} '${key}' found in ${label}.`);
    }

    recordMap.set(key, record);
  });

  return recordMap;
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

function getNearbySuburbs(suburbs, currentSuburb) {
  const currentSuburbSlug = safeValue(currentSuburb.suburb_slug).trim();
  const currentCity = safeValue(currentSuburb.city).trim().toLowerCase();
  const currentProvince = safeValue(currentSuburb.province).trim().toLowerCase();

  return suburbs
    .filter((suburb) => safeValue(suburb.suburb_slug).trim() !== currentSuburbSlug)
    .sort((left, right) => {
      const leftCity = safeValue(left.city).trim().toLowerCase();
      const rightCity = safeValue(right.city).trim().toLowerCase();
      const leftProvince = safeValue(left.province).trim().toLowerCase();
      const rightProvince = safeValue(right.province).trim().toLowerCase();
      const leftScore = leftCity === currentCity ? 0 : leftProvince === currentProvince ? 1 : 2;
      const rightScore = rightCity === currentCity ? 0 : rightProvince === currentProvince ? 1 : 2;

      return leftScore - rightScore;
    })
    .slice(0, 3)
    .map((suburb) => ({
      slug: safeValue(suburb.suburb_slug).trim(),
      suburb: safeValue(suburb.suburb).trim(),
      city: safeValue(suburb.city).trim(),
    }));
}

function getServiceLandingPage(service) {
  const serviceSlug = safeValue(service.service_slug).trim();
  const serviceName = safeValue(service.service).trim();
  const alias = SERVICE_PAGE_ALIASES[serviceSlug];
  const candidateSlug = alias ? alias.slug : serviceSlug;
  const candidateName = alias ? alias.name : serviceName;
  const candidateFile = path.join(OUTPUT_ROOT_DIR, `${candidateSlug}.html`);

  if (!fs.existsSync(candidateFile)) {
    throw new Error(`Missing top-level service page for service_slug '${serviceSlug}'.`);
  }

  return {
    url: `/services/${candidateSlug}.html`,
    name: candidateName,
  };
}

function stripSlugDebugCopy(template) {
  return template.replace(
    /\s*<p>\s*Location slug:\s*\{\{suburb_slug\}\}\s*\|\s*Service slug:\s*\{\{service_slug\}\}\s*<\/p>\s*/m,
    "\n"
  );
}

function buildFaqPairs(records) {
  const faqPairs = [];

  records.forEach((record) => {
    ["faq_1", "faq_2", "faq_3"].forEach((prefix) => {
      const question = safeValue(record[`${prefix}_q`]).trim();
      const answer = safeValue(record[`${prefix}_a`]).trim();

      if (question && answer) {
        faqPairs.push({ question, answer });
      }
    });
  });

  return faqPairs;
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

function normalizeBookingCta(html, serviceSlug) {
  const normalizedHtml = html.replace(
    /(<section id="cta"[\s\S]*?<a\b)([^>]*)(>)/,
    (match, anchorStart, anchorAttributes, anchorEnd) => {
      let nextAttributes = anchorAttributes;

      if (/\bhref="[^"]*"/.test(nextAttributes)) {
        nextAttributes = nextAttributes.replace(/\bhref="[^"]*"/, ' href="#booking-modal-root"');
      } else {
        nextAttributes += ' href="#booking-modal-root"';
      }

      if (/\bdata-book-service="[^"]*"/.test(nextAttributes)) {
        nextAttributes = nextAttributes.replace(
          /\bdata-book-service="[^"]*"/,
          `data-book-service="${serviceSlug}"`
        );
      } else {
        nextAttributes += ` data-book-service="${serviceSlug}"`;
      }

      return `${anchorStart}${nextAttributes}${anchorEnd}`;
    }
  );

  if (normalizedHtml === html) {
    throw new Error(`Unable to normalize booking CTA for service_slug '${serviceSlug}'.`);
  }

  return normalizedHtml;
}

function normalizeRenderedCopy(html) {
  return finalizeRenderedCopy(html);
}

function replaceServiceLocalAreaCopy(html, localAreaCopy) {
  return html.replace(
    /(<section id="local-service-area"[\s\S]*?<h2[^>]*>Local Service Area<\/h2>\s*)<p>[\s\S]*?<\/p>(\s*<\/section>)/,
    `$1<p>${localAreaCopy}</p>$2`
  );
}

function applyServiceLocalAreaCopy(html, localAreaCopy) {
  return html.replace(
    /(<section id="local-service-area"[\s\S]*?<h2[^>]*>Local Service Area<\/h2>[\s\S]*?<p>)[\s\S]*?(<\/p>\s*<\/section>)/,
    `$1${localAreaCopy}$2`
  );
}

function finalizeRenderedCopy(html) {
  return html
    .replace(/â€“|â€”|Ã¢â‚¬â€œ|Ã¢â‚¬â€|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â|&mdash;|&ndash;/g, "–")
    .replace(/\busually points to\b/gi, "is driven by")
    .replace(/\busually means\b/gi, "shows")
    .replace(/\bneeds to be confirmed\b/gi, "requires targeted diagnosis")
    .replace(
      /The source still needs to be confirmed before repairs begin\./gi,
      "Targeted testing identifies the fault before repair work begins."
    );
}

function generate() {
  const template = stripSlugDebugCopy(fs.readFileSync(TEMPLATE_FILE, "utf8"));
  const internalLinksTemplate = fs.readFileSync(INTERNAL_LINKS_PARTIAL_FILE, "utf8");
  const servicesCsv = readCsv(SERVICES_CSV);
  const suburbsCsv = readCsv(SUBURBS_CSV);
  const serviceContentCsv = readCsv(SERVICE_CONTENT_CSV);
  const problemsCsv = readCsv(PROBLEMS_CSV);
  const problemContentCsv = readCsv(PROBLEM_CONTENT_CSV);
  const intentsCsv = readCsv(INTENTS_CSV);
  const intentContentCsv = readCsv(INTENT_CONTENT_CSV);

  assertHeaders(servicesCsv.headers, REQUIRED_SERVICE_HEADERS, SERVICES_CSV);
  assertHeaders(suburbsCsv.headers, REQUIRED_SUBURB_HEADERS, SUBURBS_CSV);
  assertHeaders(serviceContentCsv.headers, REQUIRED_SERVICE_CONTENT_HEADERS, SERVICE_CONTENT_CSV);
  assertHeaders(problemsCsv.headers, REQUIRED_PROBLEM_HEADERS, PROBLEMS_CSV);
  assertHeaders(problemContentCsv.headers, REQUIRED_PROBLEM_CONTENT_HEADERS, PROBLEM_CONTENT_CSV);
  assertHeaders(intentsCsv.headers, REQUIRED_INTENT_HEADERS, INTENTS_CSV);
  assertHeaders(intentContentCsv.headers, REQUIRED_INTENT_CONTENT_HEADERS, INTENT_CONTENT_CSV);

  if (servicesCsv.records.length === 0) {
    throw new Error("services.csv has no data rows.");
  }

  if (suburbsCsv.records.length === 0) {
    throw new Error("suburbs.csv has no data rows.");
  }

  if (serviceContentCsv.records.length === 0) {
    throw new Error("service-content.csv has no data rows.");
  }

  if (problemsCsv.records.length === 0) {
    throw new Error("problems.csv has no data rows.");
  }

  if (problemContentCsv.records.length === 0) {
    throw new Error("problem-content.csv has no data rows.");
  }

  if (intentsCsv.records.length === 0) {
    throw new Error("intents.csv has no data rows.");
  }

  if (intentContentCsv.records.length === 0) {
    throw new Error("intent-content.csv has no data rows.");
  }

  const serviceContentBySlug = indexRecordsByKey(
    serviceContentCsv.records,
    "service_slug",
    "service-content.csv"
  );
  const problemContentBySlug = indexRecordsByKey(
    problemContentCsv.records,
    "problem_slug",
    "problem-content.csv"
  );
  const intentContentBySlug = indexRecordsByKey(
    intentContentCsv.records,
    "intent_slug",
    "intent-content.csv"
  );

  let generatedCount = 0;

  servicesCsv.records.forEach((service) => {
    const serviceName = safeValue(service.service).trim();
    const serviceSlug = safeValue(service.service_slug).trim();
    const primaryCta = safeValue(service.primary_cta).trim();
    if (!serviceSlug) {
      throw new Error("Encountered service row with empty service_slug.");
    }

    const serviceContent = serviceContentBySlug.get(serviceSlug);

    if (!serviceContent) {
      throw new Error(
        `Missing service-content.csv row for service_slug '${serviceSlug}'.`
      );
    }

    const landingPage = getServiceLandingPage(service);
    const serviceProblems = problemsCsv.records.filter(
      (problem) => safeValue(problem.service_slug).trim() === serviceSlug
    );

    if (serviceProblems.length === 0) {
      throw new Error(`No problems.csv rows found for service_slug '${serviceSlug}'.`);
    }

    suburbsCsv.records.forEach((suburb) => {
      const suburbName = safeValue(suburb.suburb).trim();
      const suburbSlug = safeValue(suburb.suburb_slug).trim();
      const city = safeValue(suburb.city).trim();
      const province = safeValue(suburb.province).trim();
      const nearbySuburbs = getNearbySuburbs(suburbsCsv.records, suburb);
      const nearby1 = nearbySuburbs[0] || { slug: "", suburb: "", city: "" };
      const nearby2 = nearbySuburbs[1] || { slug: "", suburb: "", city: "" };
      const nearby3 = nearbySuburbs[2] || { slug: "", suburb: "", city: "" };
      const relatedProblems = serviceProblems
        .slice(0, 3)
        .map((problem) => ({
          slug: safeValue(problem.problem_slug).trim(),
          name: safeValue(problem.problem).trim(),
        }));
      const relatedProblem1 = relatedProblems[0] || { slug: "", name: "" };
      const relatedProblem2 = relatedProblems[1] || { slug: "", name: "" };
      const relatedProblem3 = relatedProblems[2] || { slug: "", name: "" };
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

      const canonicalPath = `/services/${serviceSlug}/${suburbSlug}/`;
      const pageName = `${serviceName} in ${suburbName}, ${city}`;
      const areaServed = `${suburbName}, ${city}, ${province}`;
      const outputFolder = path.join(OUTPUT_ROOT_DIR, serviceSlug, suburbSlug);
      const outputFile = path.join(outputFolder, "index.html");
      const primaryProblemContent = problemContentBySlug.get(relatedProblem1.slug) || {};
      const secondaryProblemContent = problemContentBySlug.get(relatedProblem2.slug) || {};
      const tertiaryProblemContent = problemContentBySlug.get(relatedProblem3.slug) || {};
      const inspectionIntentContent = intentContentBySlug.get("inspection-service") || {};
      const repairIntentContent = intentContentBySlug.get("repair-service") || {};
      const emergencyIntentContent = intentContentBySlug.get("emergency-repair") || {};
      const faqSources = [
        primaryProblemContent,
        secondaryProblemContent,
        tertiaryProblemContent,
        inspectionIntentContent,
        repairIntentContent,
        emergencyIntentContent,
      ];
      const serviceFaqs = buildFaqPairs(faqSources);
      const relatedProblemSummary = formatList(
        [relatedProblem1.name, relatedProblem2.name, relatedProblem3.name].map((name) =>
          withIndefiniteArticle(safeValue(name).trim().toLowerCase())
        ),
        "and"
      );
      const faq1 = serviceFaqs[0] || {
        question: `What does ${serviceName} involve in ${suburbName}?`,
        answer: joinSentences(
          `Our ${serviceName.toLowerCase()} team in ${suburbName}, ${city} isolates the fault quickly`,
          `The next repair step is explained before unnecessary work starts`
        ),
      };
      const faq2 = serviceFaqs[1] || {
        question: `Which ${serviceName.toLowerCase()} issues are common in ${city}?`,
        answer: relatedProblemSummary
          ? `${upperFirst(relatedProblemSummary)} are three of the ${serviceName.toLowerCase()} issues we handle most often in ${suburbName}, ${city}.`
          : joinSentences(
              `Our ${serviceName.toLowerCase()} team in ${suburbName}, ${city} handles hidden faults`,
              `Recurring symptoms still need proper diagnosis`,
              `Urgent repair work stays part of the response`
            ),
      };
      const faq3 = serviceFaqs[2] || {
        question: `How do I get help with ${serviceName.toLowerCase()} in ${suburbName}?`,
        answer: joinSentences(
          `Book Myriad Green when ${serviceName.toLowerCase()} needs attention in ${suburbName}, ${city}`,
          `The team can isolate the fault and explain the next repair step`
        ),
      };
      const commonProblem1Description = buildCommonProblemDescription(
        relatedProblem1.name,
        primaryProblemContent,
        serviceName,
        suburbName,
        city,
        0
      );
      const commonProblem2Description = buildCommonProblemDescription(
        relatedProblem2.name,
        secondaryProblemContent,
        serviceName,
        suburbName,
        city,
        1
      );
      const commonProblem3Description = buildCommonProblemDescription(
        relatedProblem3.name,
        tertiaryProblemContent,
        serviceName,
        suburbName,
        city,
        2
      );
      const localAreaCopy = buildServiceLocalAreaCopy(serviceName, suburbName, city);

      const templateValues = {
        service: serviceName,
        service_slug: serviceSlug,
        suburb: suburbName,
        suburb_slug: suburbSlug,
        city,
        province,
        primary_cta: primaryCta,
        hero_intro: buildLocalServiceHeroIntro(serviceContent.hero_intro, serviceName, suburbName, city),
        service_overview_description: buildLocalServiceOverview(
          serviceContent.overview,
          serviceName,
          suburbName,
          city
        ),
        benefit_1: safeValue(serviceContent.benefit_1),
        benefit_2: safeValue(serviceContent.benefit_2),
        benefit_3: safeValue(serviceContent.benefit_3),
        problem_1_title: firstNonEmpty(relatedProblem1.name, `${serviceName} support`),
        problem_1_description: firstNonEmpty(
          commonProblem1Description,
          joinSentences(
            serviceContent.overview,
            `${serviceName} support is available in ${suburbName}, ${city}`
          )
        ),
        problem_2_title: firstNonEmpty(relatedProblem2.name, relatedProblem1.name, `${serviceName} assessment`),
        problem_2_description: firstNonEmpty(
          commonProblem2Description,
          commonProblem1Description,
          joinSentences(serviceContent.overview, serviceContent.cta_intro)
        ),
        problem_3_title: firstNonEmpty(relatedProblem3.name, relatedProblem2.name, `${serviceName} repair planning`),
        problem_3_description: firstNonEmpty(
          commonProblem3Description,
          commonProblem2Description,
          joinSentences(serviceContent.overview, serviceContent.cta_intro)
        ),
        step_1: firstNonEmpty(
          inspectionIntentContent.step_1,
          primaryProblemContent.step_1,
          `Inspect the property in ${suburbName} and identify where the ${serviceName.toLowerCase()} issue is starting`
        ),
        step_2: firstNonEmpty(
          inspectionIntentContent.step_2,
          repairIntentContent.step_2,
          primaryProblemContent.step_2,
          `Explain the findings clearly and recommend the most practical repair option`
        ),
        step_3: firstNonEmpty(
          repairIntentContent.step_3,
          emergencyIntentContent.step_3,
          primaryProblemContent.step_3,
          `Complete the work or arrange the right follow-up to restore reliable performance`
        ),
        trust_experience: safeValue(serviceContent.trust_experience),
        trust_equipment: safeValue(serviceContent.trust_equipment),
        trust_response_time: safeValue(serviceContent.trust_response_time),
        trust_residential_and_estates: safeValue(serviceContent.trust_residential_and_estates),
        faq_1_q: faq1.question,
        faq_1_a: buildSuburbFaqAnswer(faq1.answer, serviceName, suburbName, city, 0),
        faq_2_q: faq2.question,
        faq_2_a: buildSuburbFaqAnswer(faq2.answer, serviceName, suburbName, city, 1),
        faq_3_q: faq3.question,
        faq_3_a: buildSuburbFaqAnswer(faq3.answer, serviceName, suburbName, city, 2),
        parent_service_url: landingPage.url,
        parent_service_name: landingPage.name,
        nearby_link_1_url: nearby1.slug ? `/services/${serviceSlug}/${nearby1.slug}/` : "",
        nearby_link_1_name: nearby1.suburb ? buildCoverageLinkLabel(serviceName, nearby1.suburb) : "",
        nearby_link_2_url: nearby2.slug ? `/services/${serviceSlug}/${nearby2.slug}/` : "",
        nearby_link_2_name: nearby2.suburb ? buildCoverageLinkLabel(serviceName, nearby2.suburb) : "",
        nearby_link_3_url: nearby3.slug ? `/services/${serviceSlug}/${nearby3.slug}/` : "",
        nearby_link_3_name: nearby3.suburb ? buildCoverageLinkLabel(serviceName, nearby3.suburb) : "",
        related_problem_1_url: relatedProblem1.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedProblem1.slug}/` : "",
        related_problem_1_name: relatedProblem1.name,
        related_problem_2_url: relatedProblem2.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedProblem2.slug}/` : "",
        related_problem_2_name: relatedProblem2.name,
        related_problem_3_url: relatedProblem3.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedProblem3.slug}/` : "",
        related_problem_3_name: relatedProblem3.name,
        related_intent_1_url: relatedIntent1.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedIntent1.slug}/` : "",
        related_intent_1_name: relatedIntent1.name ? buildServiceOptionLabel(serviceName, relatedIntent1.name) : "",
        related_intent_2_url: relatedIntent2.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedIntent2.slug}/` : "",
        related_intent_2_name: relatedIntent2.name ? buildServiceOptionLabel(serviceName, relatedIntent2.name) : "",
        related_intent_3_url: relatedIntent3.slug ? `/services/${serviceSlug}/${suburbSlug}/${relatedIntent3.slug}/` : "",
        related_intent_3_name: relatedIntent3.name ? buildServiceOptionLabel(serviceName, relatedIntent3.name) : "",
        cta_intro: buildLocalCtaIntro(serviceContent.cta_intro, serviceName, suburbName, city),
        book_service_url: "#booking-modal-root",
        contact_url: "/index.html#contact",
        title: `${pageName} | Myriad Green`,
        meta_description: `${serviceName} in ${suburbName}, ${city}, ${province} with accurate fault diagnosis, practical repair planning, and local support from Myriad Green.`,
        canonical: canonicalPath,
        structured_data_json: buildStructuredData({
          name: pageName,
          areaServed,
          url: canonicalPath,
        }),
      };
      templateValues.internal_links = replaceVariables(internalLinksTemplate, templateValues);

      const renderedHtml = finalizeRenderedCopy(
        applyServiceLocalAreaCopy(
          normalizeBookingCta(
            replaceVariables(template, templateValues),
            serviceSlug
          ),
          localAreaCopy
        )
      );

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
