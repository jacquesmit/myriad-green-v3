"use strict";

/*
  Intent page generator

  Reads:
  - data/services.csv
  - data/suburbs.csv
  - data/intents.csv
  - data/intent-content.csv
  - data/service-content.csv
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
const INTENT_CONTENT_CSV = path.join(DATA_DIR, "intent-content.csv");
const SERVICE_CONTENT_CSV = path.join(DATA_DIR, "service-content.csv");
const PROBLEMS_CSV = path.join(DATA_DIR, "problems.csv");
const TEMPLATE_FILE = path.join(TEMPLATES_DIR, "intent-page-template.html");
const INTERNAL_LINKS_PARTIAL_FILE = path.join(TEMPLATES_DIR, "partials", "internal-links.html");

const REQUIRED_SERVICE_HEADERS = ["service", "service_slug", "category", "primary_cta"];
const REQUIRED_SUBURB_HEADERS = ["suburb", "suburb_slug", "city", "province", "priority"];
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

function buildServiceOverviewLabel(serviceName, suburbName) {
  return `${serviceName} service overview for ${suburbName}`;
}

function buildServiceOptionLabel(serviceName, intentName) {
  return `${intentName} for ${serviceName}`;
}

function buildIntentLead(intentName, serviceName) {
  const intentLower = safeValue(intentName).trim().toLowerCase();
  const serviceLower = safeValue(serviceName).trim().toLowerCase();

  if (intentLower.includes("24-hour") || intentLower.includes("24 hour")) {
    return `24-hour ${serviceLower}`;
  }

  if (intentLower.includes("same-day") || intentLower.includes("same day")) {
    return `same-day ${serviceLower}`;
  }

  if (intentLower.includes("emergency")) {
    return `emergency ${serviceLower}`;
  }

  if (intentLower.includes("urgent")) {
    return `urgent ${serviceLower}`;
  }

  if (intentLower.includes("inspection")) {
    return `${serviceLower} inspection`;
  }

  if (intentLower.includes("diagnosis")) {
    return `${serviceLower} diagnosis`;
  }

  if (intentLower.includes("repair")) {
    return serviceLower.includes("repair") ? `${serviceLower} work` : `${serviceLower} repair`;
  }

  if (intentLower.includes("professional")) {
    return `professional ${serviceLower} support`;
  }

  return `${serviceLower} service`;
}

function inferIntentFocus(intentName) {
  const intentLower = safeValue(intentName).trim().toLowerCase();

  if (intentLower.includes("emergency")) {
    return "rapid fault isolation";
  }

  if (intentLower.includes("same-day") || intentLower.includes("same day")) {
    return "fast diagnosis";
  }

  if (intentLower.includes("24-hour") || intentLower.includes("24 hour")) {
    return "immediate loss control";
  }

  if (intentLower.includes("urgent")) {
    return "fast risk control";
  }

  if (intentLower.includes("inspection")) {
    return "technical confirmation";
  }

  if (intentLower.includes("diagnosis")) {
    return "fault confirmation";
  }

  if (intentLower.includes("repair")) {
    return "controlled repair planning";
  }

  if (intentLower.includes("professional")) {
    return "experienced decision-making";
  }

  return "clear next-step planning";
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

function inferIntentCondition(intentName, serviceName, fallback) {
  const intentLower = safeValue(intentName).trim().toLowerCase();
  const serviceLower = safeValue(serviceName).trim().toLowerCase();
  const detail = stripTrailingPunctuation(fallback).toLowerCase();

  if (intentLower.includes("emergency")) {
    return "an active fault is already disrupting the property";
  }

  if (intentLower.includes("same-day") || intentLower.includes("same day")) {
    return "the issue needs attention before the day is over";
  }

  if (intentLower.includes("24-hour") || intentLower.includes("24 hour")) {
    return "the fault cannot wait for routine scheduling";
  }

  if (intentLower.includes("urgent")) {
    return "delay could make the situation worse";
  }

  if (intentLower.includes("inspection")) {
    return "the cause is still unclear";
  }

  if (intentLower.includes("diagnosis")) {
    return "repair planning still depends on isolating the fault";
  }

  if (intentLower.includes("repair")) {
    return "the issue has moved beyond a temporary workaround";
  }

  if (intentLower.includes("professional")) {
    return "a reliable, expert response is the safer option";
  }

  if (serviceLower.includes("leak")) {
    return "water loss is no longer behaving like normal usage";
  }

  if (serviceLower.includes("drain")) {
    return "a blockage or pipe defect is affecting the line";
  }

  if (serviceLower.includes("irrigation")) {
    return "coverage faults are disrupting scheduled watering";
  }

  if (serviceLower.includes("borehole") || serviceLower.includes("pump")) {
    return "pump wear or unstable water supply is affecting performance";
  }

  return detail || `the ${serviceLower} issue needs a clear diagnosis before the next step is chosen`;
}

function inferIntentMeaning(intentName) {
  const intentLower = safeValue(intentName).trim().toLowerCase();

  if (intentLower.includes("emergency")) {
    return "the next step needs to happen quickly";
  }

  if (intentLower.includes("same-day") || intentLower.includes("same day")) {
    return "speed matters as much as the diagnosis";
  }

  if (intentLower.includes("24-hour") || intentLower.includes("24 hour")) {
    return "the property cannot wait for a routine slot";
  }

  if (intentLower.includes("urgent")) {
    return "waiting longer could raise the repair cost or the damage";
  }

  if (intentLower.includes("inspection")) {
    return "answers are needed before any repair decision is made";
  }

  if (intentLower.includes("diagnosis")) {
    return "repair decisions depend on isolating the fault first";
  }

  if (intentLower.includes("repair")) {
    return "a proper fix is more useful than a short-term workaround";
  }

  if (intentLower.includes("professional")) {
    return "expert input is worth more than trial and error";
  }

  return "the next step needs to be clear and well judged";
}

function inferIntentVisibleSignal(serviceName) {
  const serviceLower = safeValue(serviceName).trim().toLowerCase();

  if (serviceLower.includes("leak")) {
    return "water loss is showing up in bills, pressure, or damp areas";
  }

  if (serviceLower.includes("drain")) {
    return "drainage is slowing down, backing up, or producing foul smells";
  }

  if (serviceLower.includes("irrigation")) {
    return "coverage is uneven and water use is becoming harder to control";
  }

  if (serviceLower.includes("borehole") || serviceLower.includes("pump")) {
    return "pressure is unstable and water supply is no longer reliable";
  }

  return "normal system performance is starting to slip";
}

function inferIntentTrigger(intentName, serviceName) {
  const intentLower = safeValue(intentName).trim().toLowerCase();
  const serviceLower = safeValue(serviceName).trim().toLowerCase();

  if (intentLower.includes("24-hour") || intentLower.includes("24 hour")) {
    return "The fault started outside normal working hours";
  }

  if (intentLower.includes("same-day") || intentLower.includes("same day")) {
    return "The fault appeared earlier in the day during normal use";
  }

  if (intentLower.includes("emergency")) {
    return "A live system failure has occurred";
  }

  if (intentLower.includes("urgent")) {
    return "The underlying fault is worsening over time";
  }

  if (intentLower.includes("inspection")) {
    return "The exact fault location is still unclear";
  }

  if (intentLower.includes("diagnosis")) {
    return "More than one fault could be creating the same failure";
  }

  if (intentLower.includes("repair")) {
    return "A confirmed component fault now needs corrective work";
  }

  if (intentLower.includes("professional")) {
    return "The system fault has more than one likely technical cause";
  }

  if (serviceLower.includes("leak")) {
    return "Water loss is no longer behaving like normal household use";
  }

  if (serviceLower.includes("irrigation")) {
    return "Coverage faults are disrupting scheduled watering";
  }

  if (serviceLower.includes("drain")) {
    return "Drainage failure is affecting normal wastewater flow";
  }

  if (serviceLower.includes("borehole") || serviceLower.includes("pump")) {
    return "Water supply performance has dropped below normal operating levels";
  }

  return "The property needs a technical response rather than further guesswork";
}

function inferIntentActionDriver(intentName) {
  const intentLower = safeValue(intentName).trim().toLowerCase();

  if (intentLower.includes("emergency")) {
    return "the fault needs to be contained before damage spreads further";
  }

  if (intentLower.includes("urgent")) {
    return "the issue needs attention before it turns into a bigger repair";
  }

  if (intentLower.includes("same-day") || intentLower.includes("same day")) {
    return "the property needs a response before the day is over";
  }

  if (intentLower.includes("24-hour") || intentLower.includes("24 hour")) {
    return "the site cannot wait for the next routine booking window";
  }

  if (intentLower.includes("inspection") || intentLower.includes("diagnosis")) {
    return "the owner needs evidence before approving repair work";
  }

  if (intentLower.includes("repair")) {
    return "a proper fix has become more useful than another temporary workaround";
  }

  return "a clear technical next step is needed";
}

function buildIntentActionLabel(intentName) {
  const intentLower = safeValue(intentName).trim().toLowerCase();

  if (intentLower.includes("24-hour") || intentLower.includes("24 hour")) {
    return "a 24-hour response";
  }

  if (intentLower.includes("same-day") || intentLower.includes("same day")) {
    return "same-day service";
  }

  if (intentLower.includes("emergency")) {
    return "an emergency response";
  }

  if (intentLower.includes("urgent")) {
    return "an urgent visit";
  }

  if (intentLower.includes("inspection")) {
    return "an inspection";
  }

  if (intentLower.includes("diagnosis")) {
    return "diagnostic testing";
  }

  if (intentLower.includes("repair")) {
    return "repair work";
  }

  return "professional service";
}

function buildIntentTriggerReason(intentName, serviceName) {
  return `${upperFirst(stripTrailingPunctuation(inferIntentTrigger(intentName, serviceName)))}.`;
}

function buildIntentSymptomReason(serviceName, suburbName) {
  const serviceLower = safeValue(serviceName).trim().toLowerCase();

  if (serviceLower.includes("leak")) {
    return `Homeowners in ${suburbName} notice damp areas, pressure changes, or unexplained water loss.`;
  }

  if (serviceLower.includes("irrigation")) {
    return `Homeowners in ${suburbName} see dry zones, overspray, or controller schedules failing to run correctly.`;
  }

  if (serviceLower.includes("drain")) {
    return `Homeowners in ${suburbName} notice slow drainage, foul smells, or wastewater backing up at fixtures.`;
  }

  if (serviceLower.includes("borehole") || serviceLower.includes("pump")) {
    return `Homeowners in ${suburbName} notice unstable pressure, weak flow, or water supply dropping out unexpectedly.`;
  }

  return `Homeowners in ${suburbName} notice performance changes that show the system is no longer operating normally.`;
}

function buildIntentDecisionReason(intentName) {
  const bookingLabel = buildIntentActionLabel(intentName);
  const intentLower = safeValue(intentName).trim().toLowerCase();

  if (intentLower.includes("24-hour") || intentLower.includes("24 hour")) {
    return `Booking ${bookingLabel} secures after-hours attendance before the fault sits unresolved overnight.`;
  }

  if (intentLower.includes("same-day") || intentLower.includes("same day")) {
    return `Booking ${bookingLabel} gets the system checked before the day ends.`;
  }

  if (intentLower.includes("emergency")) {
    return `Booking ${bookingLabel} helps contain the fault before damage spreads further.`;
  }

  if (intentLower.includes("urgent")) {
    return `Booking ${bookingLabel} shortens the delay before targeted repair work begins.`;
  }

  if (intentLower.includes("inspection")) {
    return `Booking ${bookingLabel} gives the owner clear evidence before repair work is approved.`;
  }

  if (intentLower.includes("diagnosis")) {
    return `Booking ${bookingLabel} isolates the fault so the next repair decision is based on testing.`;
  }

  if (intentLower.includes("repair")) {
    return `Booking ${bookingLabel} moves the property from diagnosis to a controlled repair plan.`;
  }

  return `Booking ${bookingLabel} gives the property an experienced repair strategy without trial and error.`;
}

function inferIntentAction(intentName, serviceName, suburbName, city) {
  const intentLower = safeValue(intentName).trim().toLowerCase();

  if (intentLower.includes("emergency") || intentLower.includes("urgent")) {
    return "Fast attendance helps contain the fault before damage spreads.";
  }

  if (intentLower.includes("inspection") || intentLower.includes("diagnosis")) {
    return "Targeted testing confirms the fault before repair work is approved.";
  }

  if (intentLower.includes("repair")) {
    return "A controlled repair visit turns the diagnosis into a workable repair plan.";
  }

  if (
    intentLower.includes("same-day") ||
    intentLower.includes("same day") ||
    intentLower.includes("24-hour") ||
    intentLower.includes("24 hour")
  ) {
    return "Fast scheduling limits delay and gives the property an immediate technical response.";
  }

  return "A measured assessment defines the safest next step for the property.";
}

function inferIntentLocalAreaNeeds(serviceName, intentName) {
  const serviceLower = safeValue(serviceName).trim().toLowerCase();
  const intentLower = safeValue(intentName).trim().toLowerCase();

  if (serviceLower.includes("leak")) {
    return intentLower.includes("24-hour") || intentLower.includes("24 hour")
      ? "after-hours water loss, falling pressure, and damp areas"
      : "hidden water loss, rising bills, damp areas, and pressure changes";
  }

  if (serviceLower.includes("irrigation")) {
    return intentLower.includes("24-hour") || intentLower.includes("24 hour")
      ? "overnight pressure loss, controller faults, and failed irrigation zones"
      : "pressure loss, controller faults, uneven coverage, and leaking zones";
  }

  if (serviceLower.includes("drain")) {
    return "slow drainage, backed-up waste lines, and recurring blockages";
  }

  if (serviceLower.includes("borehole") || serviceLower.includes("pump")) {
    return "pump failures, unstable pressure, and interrupted backup water supply";
  }

  return "faults that need clear diagnosis and practical repair planning";
}

function buildIntentLocalAreaCopy(serviceName, intentName, suburbName, city) {
  const actionLabel = buildIntentLead(intentName, serviceName);
  const needs = inferIntentLocalAreaNeeds(serviceName, intentName);
  return `Myriad Green provides ${actionLabel} across ${suburbName}, including surrounding estates and residential properties in ${city}, with practical on-site support for ${needs}.`;
}

function contextualizeParagraph(text, contextValues, contextSentence) {
  let output = safeValue(text).trim();

  if (!output) {
    return toSentence(contextSentence);
  }

  output = output.replace(
    /^Customers searching for\s+(.+?)\s+usually need\s+/i,
    (_, lead) => `${upperFirst(lead)} requires `
  );
  output = output.replace(
    /^Customers searching for\s+(.+?)\s+are usually looking for\s+/i,
    (_, lead) => `${upperFirst(lead)} calls for `
  );
  output = output.replace(
    /^Customers searching for\s+(.+?)\s+usually want\s+/i,
    (_, lead) => `${upperFirst(lead)} starts with `
  );
  output = output.replace(/\busually\s+points\s+to\b/gi, "indicates");
  output = output.replace(/\busually\s+means\b/gi, "shows");
  output = output.replace(/\bneeds\s+to\s+be\s+confirmed\b/gi, "requires targeted diagnosis");
  output = output.replace(/\bour\s+team\s+is\s+tracing\b/gi, "Myriad Green is isolating");
  output = output.replace(
    /The\s+source\s+still\s+needs\s+to\s+be\s+confirmed\s+before\s+repairs\s+begin\./gi,
    "Targeted testing identifies the fault before repair work begins."
  );
  output = output.replace(/^This page covers\s+/i, "This page focuses on ");

  if (!containsContext(output, contextValues)) {
    output = joinSentences(output, contextSentence);
  }

  return output;
}

function buildIntentHeroIntro(base, serviceName, intentName, suburbName, city) {
  const intentLead = buildIntentLead(intentName, serviceName);
  const triggerText = lowerFirst(stripTrailingPunctuation(inferIntentTrigger(intentName, serviceName)));
  const visibleSignal = upperFirst(stripTrailingPunctuation(inferIntentVisibleSignal(serviceName)));
  const decisionText = buildIntentDecisionReason(intentName);

  return joinSentences(
    `${upperFirst(intentLead)} in ${suburbName}, ${city} is used when ${triggerText}.`,
    `${visibleSignal}.`,
    decisionText
  );
}

function buildIntentOverview(base, serviceName, intentName, suburbName, city) {
  const focus = inferIntentFocus(intentName);
  const meaning = inferIntentMeaning(intentName);

  return joinSentences(
    `The first priority on site is ${focus}.`,
    `${upperFirst(meaning)}.`,
    `Myriad Green tests the system first and then confirms the most practical next step for the property.`
  );
}

function buildIntentReason(reason, serviceName, intentName, suburbName, city, variant, fallback) {
  if (variant === 0) {
    return buildIntentTriggerReason(intentName, serviceName);
  }

  if (variant === 1) {
    return buildIntentSymptomReason(serviceName, suburbName);
  }

  return buildIntentDecisionReason(intentName);
}

function buildIntentCtaIntro(base, serviceName, intentName, suburbName, city) {
  const fallback = joinSentences(
    `${upperFirst(buildIntentLead(intentName, serviceName))} in ${suburbName}, ${city} starts with a clear diagnosis.`,
    `Book Myriad Green to confirm the fault and define the next step.`
  );

  return contextualizeParagraph(
    base,
    [serviceName, intentName, suburbName, city],
    fallback
  );
}

function buildIntentFaqAnswer(answer, serviceName, intentName, suburbName, city, index) {
  let output = safeValue(answer).trim();
  const contextSentences = [
    `A clear first step matters when ${serviceName.toLowerCase()} work is needed in ${suburbName}, ${city}`,
    `${upperFirst(buildIntentLead(intentName, serviceName))} keeps the decision practical for the property`,
    `A clear answer in ${city} makes the next repair step easier to plan`,
  ];

  if (!output) {
    return `${contextSentences[index]}.`;
  }

  if (!containsContext(output, [serviceName, intentName, suburbName, city])) {
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

function buildSuburbServiceUrl(serviceSlug, suburbSlug) {
  return `/services/${serviceSlug}/${suburbSlug}/`;
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

function replaceIntentLocalAreaCopy(html, localAreaCopy) {
  return html.replace(
    /(<section id="local-area-service"[\s\S]*?<h2[^>]*>Local Area Service<\/h2>\s*)<p>[\s\S]*?<\/p>(\s*<\/section>)/,
    `$1<p>${localAreaCopy}</p>$2`
  );
}

function finalizeRenderedCopy(html) {
  return html
    .replace(/â€“|â€”|Ã¢â‚¬â€œ|Ã¢â‚¬â€|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â|&mdash;|&ndash;/g, "–")
    .replace(/\busually\s+points\s+to\b/gi, "indicates")
    .replace(/\busually\s+means\b/gi, "shows")
    .replace(/\bneeds\s+to\s+be\s+confirmed\b/gi, "requires targeted diagnosis")
    .replace(/\bour\s+team\s+is\s+tracing\b/gi, "Myriad Green is isolating")
    .replace(
      /The\s+source\s+still\s+needs\s+to\s+be\s+confirmed\s+before\s+repairs\s+begin\./gi,
      "Targeted testing identifies the fault before repair work begins."
    );
}

function finalizeRenderedCopy(html) {
  return html
    .replace(/Ã¢â‚¬â€œ|Ã¢â‚¬â€|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â|ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ|ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â|â€“|â€”|&mdash;|&ndash;/g, "–")
    .replace(/\busually\s+points\s+to\b/gi, "indicates")
    .replace(/\busually\s+means\b/gi, "shows")
    .replace(/\bneeds\s+to\s+be\s+confirmed\b/gi, "requires targeted diagnosis")
    .replace(/\bour\s+team\s+is\s+tracing\b/gi, "Myriad Green is isolating")
    .replace(/\bthis\s+request\s+becomes\s+relevant\b/gi, "This service is used")
    .replace(
      /The\s+source\s+still\s+needs\s+to\s+be\s+confirmed\s+before\s+repairs\s+begin\./gi,
      "Targeted testing identifies the fault before repair work begins."
    );
}

function generate() {
  const template = fs.readFileSync(TEMPLATE_FILE, "utf8");
  const internalLinksTemplate = fs.readFileSync(INTERNAL_LINKS_PARTIAL_FILE, "utf8");
  const servicesCsv = readCsv(SERVICES_CSV);
  const suburbsCsv = readCsv(SUBURBS_CSV);
  const intentsCsv = readCsv(INTENTS_CSV);
  const intentContentCsv = readCsv(INTENT_CONTENT_CSV);
  const serviceContentCsv = readCsv(SERVICE_CONTENT_CSV);
  const problemsCsv = readCsv(PROBLEMS_CSV);

  assertHeaders(servicesCsv.headers, REQUIRED_SERVICE_HEADERS, SERVICES_CSV);
  assertHeaders(suburbsCsv.headers, REQUIRED_SUBURB_HEADERS, SUBURBS_CSV);
  assertHeaders(intentsCsv.headers, REQUIRED_INTENT_HEADERS, INTENTS_CSV);
  assertHeaders(intentContentCsv.headers, REQUIRED_INTENT_CONTENT_HEADERS, INTENT_CONTENT_CSV);
  assertHeaders(serviceContentCsv.headers, REQUIRED_SERVICE_CONTENT_HEADERS, SERVICE_CONTENT_CSV);
  assertHeaders(problemsCsv.headers, REQUIRED_PROBLEM_HEADERS, PROBLEMS_CSV);

  if (servicesCsv.records.length === 0) {
    throw new Error("services.csv has no data rows.");
  }

  if (suburbsCsv.records.length === 0) {
    throw new Error("suburbs.csv has no data rows.");
  }
  if (intentsCsv.records.length === 0) {
    throw new Error("intents.csv has no data rows.");
  }
  if (intentContentCsv.records.length === 0) {
    throw new Error("intent-content.csv has no data rows.");
  }
  if (serviceContentCsv.records.length === 0) {
    throw new Error("service-content.csv has no data rows.");
  }
  if (problemsCsv.records.length === 0) {
    throw new Error("problems.csv has no data rows.");
  }

  const intentContentBySlug = indexRecordsByKey(
    intentContentCsv.records,
    "intent_slug",
    "intent-content.csv"
  );
  const serviceContentBySlug = indexRecordsByKey(
    serviceContentCsv.records,
    "service_slug",
    "service-content.csv"
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

    suburbsCsv.records.forEach((suburb) => {
      const suburbName = safeValue(suburb.suburb).trim();
      const suburbSlug = safeValue(suburb.suburb_slug).trim();
      const city = safeValue(suburb.city).trim();
      const province = safeValue(suburb.province).trim();
      const nearbySuburbs = getNearbySuburbs(suburbsCsv.records, suburb);
      const nearby1 = nearbySuburbs[0] || { slug: "", suburb: "", city: "" };
      const nearby2 = nearbySuburbs[1] || { slug: "", suburb: "", city: "" };
      const nearby3 = nearbySuburbs[2] || { slug: "", suburb: "", city: "" };
      const relatedProblems = problemsCsv.records
        .filter((problem) => safeValue(problem.service_slug).trim() === serviceSlug)
        .slice(0, 3)
        .map((problem) => ({
          slug: safeValue(problem.problem_slug).trim(),
          name: safeValue(problem.problem).trim(),
        }));
      const relatedProblem1 = relatedProblems[0] || { slug: "", name: "" };
      const relatedProblem2 = relatedProblems[1] || { slug: "", name: "" };
      const relatedProblem3 = relatedProblems[2] || { slug: "", name: "" };

      if (!suburbSlug) {
        throw new Error("Encountered suburb row with empty suburb_slug.");
      }

      intentsCsv.records.forEach((intent) => {
        const intentName = safeValue(intent.intent).trim();
        const intentSlug = safeValue(intent.intent_slug).trim();
        const siblingIntents = intentsCsv.records
          .filter((item) => safeValue(item.intent_slug).trim() !== intentSlug)
          .slice(0, 3)
          .map((item) => ({
            slug: safeValue(item.intent_slug).trim(),
            name: safeValue(item.intent).trim(),
          }));
        const relatedIntent1 = siblingIntents[0] || { slug: "", name: "" };
        const relatedIntent2 = siblingIntents[1] || { slug: "", name: "" };
        const relatedIntent3 = siblingIntents[2] || { slug: "", name: "" };

        if (!intentSlug) {
          throw new Error("Encountered intent row with empty intent_slug.");
        }

        const intentContent = intentContentBySlug.get(intentSlug);

        if (!intentContent) {
          throw new Error(
            `Missing intent-content.csv row for intent_slug '${intentSlug}'.`
          );
        }

        const canonicalPath = `/services/${serviceSlug}/${suburbSlug}/${intentSlug}/`;
        const pageName = `${upperFirst(buildIntentLead(intentName, serviceName))} in ${suburbName}, ${city}`;
        const areaServed = `${suburbName}, ${city}, ${province}`;
        const suburbServiceUrl = buildSuburbServiceUrl(serviceSlug, suburbSlug);
        const outputFolder = path.join(OUTPUT_ROOT_DIR, serviceSlug, suburbSlug, intentSlug);
        const outputFile = path.join(outputFolder, "index.html");
        const heroIntro = buildIntentHeroIntro(
          firstNonEmpty(intentContent.hero_intro, serviceContent.hero_intro),
          serviceName,
          intentName,
          suburbName,
          city
        );
        const intentOverview = buildIntentOverview(
          firstNonEmpty(intentContent.intent_overview, serviceContent.overview),
          serviceName,
          intentName,
          suburbName,
          city
        );
        const ctaIntro = buildIntentCtaIntro(
          firstNonEmpty(intentContent.cta_intro, serviceContent.cta_intro),
          serviceName,
          intentName,
          suburbName,
          city
        );
        const localAreaCopy = buildIntentLocalAreaCopy(serviceName, intentName, suburbName, city);
        const trust1 = firstNonEmpty(
          intentContent.trust_1,
          serviceContent.trust_experience,
          `${serviceName} support for residential properties and managed sites`
        );
        const trust2 = firstNonEmpty(
          intentContent.trust_2,
          serviceContent.trust_equipment,
          `Professional diagnostics and repair planning for ${serviceName}`
        );
        const trust3 = firstNonEmpty(
          intentContent.trust_3,
          serviceContent.trust_response_time,
          `Prompt scheduling for ${intentName.toLowerCase()} requests in ${city}`
        );
        const trust4 = firstNonEmpty(
          intentContent.trust_4,
          serviceContent.trust_residential_and_estates,
          `Trusted across ${city} by local property teams`
        );

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
          hero_intro: heroIntro,
          intent_overview: intentOverview,
          reason_1: buildIntentReason(
            intentContent.reason_1,
            serviceName,
            intentName,
            suburbName,
            city,
            0,
            "the issue is disrupting normal use at the property"
          ),
          reason_2: buildIntentReason(
            intentContent.reason_2,
            serviceName,
            intentName,
            suburbName,
            city,
            1,
            "delay could lead to wider damage, water loss, or downtime"
          ),
          reason_3: buildIntentReason(
            intentContent.reason_3,
            serviceName,
            intentName,
            suburbName,
            city,
            2,
            "a local response would make the next step easier to manage"
          ),
          step_1: firstNonEmpty(
            intentContent.step_1,
            `Review the issue in ${suburbName} and confirm the likely cause`
          ),
          step_2: firstNonEmpty(
            intentContent.step_2,
            `Explain the findings clearly and recommend the most practical next action`
          ),
          step_3: firstNonEmpty(
            intentContent.step_3,
            `Complete the agreed work or confirm the best follow-up step for the property`
          ),
          trust_1: trust1,
          trust_2: trust2,
          trust_3: trust3,
          trust_4: trust4,
          cta_intro: ctaIntro,
          primary_cta_url: firstNonEmpty(intentContent.primary_cta_url, suburbServiceUrl),
          faq_1_q: safeValue(intentContent.faq_1_q),
          faq_1_a: buildIntentFaqAnswer(
            intentContent.faq_1_a,
            serviceName,
            intentName,
            suburbName,
            city,
            0
          ),
          faq_2_q: safeValue(intentContent.faq_2_q),
          faq_2_a: buildIntentFaqAnswer(
            intentContent.faq_2_a,
            serviceName,
            intentName,
            suburbName,
            city,
            1
          ),
          faq_3_q: safeValue(intentContent.faq_3_q),
          faq_3_a: buildIntentFaqAnswer(
            intentContent.faq_3_a,
            serviceName,
            intentName,
            suburbName,
            city,
            2
          ),
          parent_service_url: suburbServiceUrl,
          parent_service_name: buildServiceOverviewLabel(serviceName, suburbName),
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
          title: `${pageName} | Myriad Green`,
          meta_description: `${upperFirst(buildIntentLead(intentName, serviceName))} in ${suburbName}, ${city}. ${upperFirst(inferIntentFocus(intentName))} and practical guidance from Myriad Green.`,
          canonical: canonicalPath,
          structured_data_json: buildStructuredData({
            name: pageName,
            areaServed,
            url: canonicalPath,
          }),
        };
        templateValues.internal_links = replaceVariables(internalLinksTemplate, templateValues);

        const renderedHtml = finalizeRenderedCopy(
          replaceIntentLocalAreaCopy(
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
