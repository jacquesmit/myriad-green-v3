"use strict";

/*
  Problem page generator

  Reads:
  - data/services.csv
  - data/suburbs.csv
  - data/problems.csv
  - data/problem-content.csv
  - data/service-content.csv
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
const PROBLEM_CONTENT_CSV = path.join(DATA_DIR, "problem-content.csv");
const SERVICE_CONTENT_CSV = path.join(DATA_DIR, "service-content.csv");
const INTENTS_CSV = path.join(DATA_DIR, "intents.csv");
const TEMPLATE_FILE = path.join(TEMPLATES_DIR, "problem-page-template.html");
const INTERNAL_LINKS_PARTIAL_FILE = path.join(TEMPLATES_DIR, "partials", "internal-links.html");

const REQUIRED_SERVICE_HEADERS = ["service", "service_slug", "category", "primary_cta"];
const REQUIRED_SUBURB_HEADERS = ["suburb", "suburb_slug", "city", "province", "priority"];
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

function buildProblemSubject(problemName, suburbName) {
  const label = upperFirst(withIndefiniteArticle(problemName.toLowerCase()));
  return suburbName ? `${label} in ${suburbName}` : label;
}

function buildServiceOverviewLabel(serviceName, suburbName) {
  return `${serviceName} service overview for ${suburbName}`;
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

function looksLikeClause(value) {
  const text = safeValue(value).trim().toLowerCase();
  if (!text) {
    return false;
  }

  return /\b(is|are|was|were|does|do|can|rises?|drops?|fails?|appears?|responds?|runs?|needs?|shows?|starts?|stops?|becomes?|feels?|backs?)\b/.test(
    text
  );
}

function toGerund(word) {
  const lower = safeValue(word).trim().toLowerCase();
  const irregular = {
    assess: "assessing",
    check: "checking",
    complete: "completing",
    confirm: "confirming",
    diagnose: "diagnosing",
    explain: "explaining",
    identify: "identifying",
    inspect: "inspecting",
    prioritise: "prioritising",
    prioritize: "prioritizing",
    recommend: "recommending",
    repair: "repairing",
    replace: "replacing",
    reset: "resetting",
    restore: "restoring",
    review: "reviewing",
    stabilise: "stabilising",
    stabilize: "stabilizing",
    test: "testing",
    trace: "tracing",
    verify: "verifying",
  };

  if (irregular[lower]) {
    return irregular[lower];
  }

  if (lower.endsWith("ie")) {
    return `${lower.slice(0, -2)}ying`;
  }

  if (lower.endsWith("e") && !lower.endsWith("ee")) {
    return `${lower.slice(0, -1)}ing`;
  }

  return `${lower}ing`;
}

function toGerundPhrase(text) {
  const stepText = safeValue(text).trim();
  if (!stepText) {
    return "";
  }

  const [firstWord, ...rest] = stepText.split(/\s+/);
  return [toGerund(firstWord), ...rest].join(" ");
}

function inferProblemCause(problemName, serviceName, step1, step2) {
  const problemLower = safeValue(problemName).trim().toLowerCase();
  const serviceLower = safeValue(serviceName).trim().toLowerCase();
  const diagnosticFocus = stripTrailingPunctuation(firstNonEmpty(step1, step2)).toLowerCase();

  if (problemLower.includes("leak")) {
    return "hidden pipe damage or a failing joint";
  }

  if (problemLower.includes("blocked") || problemLower.includes("blockage")) {
    return "a blockage building up in the line";
  }

  if (problemLower.includes("controller")) {
    return "wiring faults or unstable power at the controller";
  }

  if (problemLower.includes("sprinkler")) {
    return "damage at the sprinkler head or uneven pressure";
  }

  if (problemLower.includes("valve")) {
    return "a valve fault or an electrical control issue";
  }

  if (problemLower.includes("pressure")) {
    return "supply instability or a restriction in the line";
  }

  if (problemLower.includes("pump")) {
    return "pump wear or a pressure-control fault";
  }

  if (problemLower.includes("pipe")) {
    return "damaged pipework or a failing fitting";
  }

  if (diagnosticFocus.includes("water loss")) {
    return "hidden water loss inside the system";
  }

  if (diagnosticFocus.includes("fault")) {
    return diagnosticFocus;
  }

  return `underlying faults that need accurate ${serviceLower} diagnosis`;
}

function buildProblemSignalSentence(problemName, suburbName, symptomText, variant, index) {
  return buildProblemObservationSentence(problemName, suburbName, symptomText, (variant + index) % 3);
}

function buildProblemSignalSentences(problemName, suburbName, symptoms, variant) {
  const symptomItems = symptoms.filter(Boolean);
  if (symptomItems.length === 0) {
    return [`${upperFirst(withIndefiniteArticle(problemName.toLowerCase()))} can remain hidden in ${suburbName} until the wider fault becomes obvious.`];
  }

  return symptomItems.map((symptom, index) =>
    buildProblemSignalSentence(problemName, suburbName, symptom, variant, index)
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

function buildProblemUrgencySentence(serviceName, problemName, suburbName, city, variant) {
  if (variant === 0) {
    return `A focused visit in ${suburbName} isolates the fault before repair work begins.`;
  }

  if (variant === 1) {
    return `Targeted testing in ${city} shows where the repair needs to start.`;
  }

  return `A technician can narrow the repair scope before the issue spreads further.`;
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

function buildProblemCauseExplanation(problemName, cause, suburbName) {
  const causeText = stripTrailingPunctuation(cause);
  const problemLower = safeValue(problemName).trim().toLowerCase();

  if (!causeText) {
    return "";
  }

  if (problemLower.includes("bill")) {
    return `${upperFirst(causeText)} can push monthly water charges above normal use in ${suburbName}.`;
  }

  return `${upperFirst(causeText)} can trigger ${lowerFirst(withIndefiniteArticle(problemLower))} on ${suburbName} properties.`;
}

function buildProblemImpactSentence(problemName, symptomText, suburbName) {
  const symptom = stripTrailingPunctuation(symptomText);

  if (!symptom) {
    return "Normal use on the property can keep deteriorating while the fault stays active.";
  }

  if (/^no\s+/i.test(symptom)) {
    return `A lack of ${lowerCaseWords(symptom).replace(/^no\s+/i, "")} makes the real fault harder to spot while the issue keeps disrupting the property.`;
  }

  if (looksLikeClause(symptom)) {
    return `When ${lowerFirst(symptom)}, normal use on the property is already being disrupted.`;
  }

  return `When the property shows ${lowerFirst(symptom)}, the fault is already affecting normal use and needs targeted diagnosis.`;
}

function buildProblemNextStepSentence(stepText) {
  const step = stripTrailingPunctuation(stepText);

  if (!step) {
    return "The next step is targeted testing to isolate the fault.";
  }

  return `The next step is to ${lowerFirst(step)}.`;
}

function buildActionSentence(subject, action) {
  const stepText = stripTrailingPunctuation(action);
  if (!stepText) {
    return "";
  }

  return `${subject} ${lowerFirst(stepText)}.`;
}

function contextualizeParagraph(text, contextValues, contextSentence) {
  let output = safeValue(text).trim();

  if (!output) {
    return toSentence(contextSentence);
  }

  output = replaceLeadingPhrase(output, ["Common", "signs", "include"], "Typical signs include ");
  if (/^A\s+first\s+visit\s+usually\s+starts\s+by\s+/i.test(output)) {
    const remainder = output.replace(/^A\s+first\s+visit\s+usually\s+starts\s+by\s+/i, "");
    output = `Our first visit focuses on ${toGerundPhrase(remainder)}`;
  }
  output = output.replace(/\busually points to\b/gi, "is driven by");
  output = output.replace(/\busually means\b/gi, "shows");
  output = output.replace(/\bneeds to be confirmed\b/gi, "requires targeted diagnosis");
  output = output.replace(/\bour team is tracing\b/gi, "we are isolating");
  output = output.replace(
    /The source still needs to be confirmed before repairs begin\./gi,
    "Targeted testing identifies the fault before repair work begins."
  );
  output = output.replace(/^This page covers\s+/i, "This page focuses on ");

  if (!containsContext(output, contextValues)) {
    output = joinSentences(output, contextSentence);
  }

  return output;
}

function buildProblemHeroIntro(base, serviceName, problemName, suburbName, city, symptomValues) {
  const cause = inferProblemCause(problemName, serviceName, base, firstNonEmpty(...symptomValues));
  const symptom = pickSignalByVariant(pickListItems(symptomValues, 3), 0);

  return joinSentences(
    buildProblemObservationSentence(problemName, suburbName, symptom, 0),
    buildProblemTriggerSentence(problemName, cause, suburbName, 0),
    buildProblemUrgencySentence(serviceName, problemName, suburbName, city, 0)
  );
}

function buildProblemOverview(base, serviceName, problemName, suburbName, city, symptomValues, step1, step2) {
  const cause = inferProblemCause(problemName, serviceName, step1, step2);
  const firstStep = firstNonEmpty(step1, "inspect the visible symptoms and narrow down the likely cause");
  const symptom = pickSignalByVariant(pickListItems(symptomValues, 3), 1);

  return joinSentences(
    buildProblemCauseExplanation(problemName, cause, suburbName),
    buildProblemImpactSentence(problemName, symptom, suburbName),
    buildProblemNextStepSentence(firstStep)
  );
}

function buildProblemSymptomsDescription(rawText, serviceName, problemName, suburbName, city, symptomValues) {
  const symptomItems = pickListItems(symptomValues, 3);
  const symptom = pickSignalByVariant(symptomItems, 0);
  const cause = inferProblemCause(problemName, serviceName, rawText, firstNonEmpty(...symptomValues));
  const fallback = joinSentences(
    buildProblemObservationSentence(problemName, suburbName, symptom, 0),
    buildProblemTriggerSentence(problemName, cause, suburbName, 0),
    buildProblemUrgencySentence(serviceName, problemName, suburbName, city, 1)
  );

  return contextualizeParagraph(
    rawText,
    [serviceName, problemName, suburbName, city],
    fallback
  );
}

function buildProblemAssessmentDescription(rawText, serviceName, problemName, suburbName, city, step1, step2) {
  const openingStep = firstNonEmpty(step1, "inspect the visible symptoms and narrow down the likely cause");
  const followUpStep = firstNonEmpty(step2, "explain what the testing shows and recommend the most practical repair option");
  const cause = inferProblemCause(problemName, serviceName, step1, step2);
  const fallback = joinSentences(
    buildProblemTriggerSentence(problemName, cause, suburbName, 1),
    `The first job is to ${lowerFirst(stripTrailingPunctuation(openingStep))}.`,
    `The follow-up step is to ${lowerFirst(stripTrailingPunctuation(followUpStep))}.`
  );

  return contextualizeParagraph(
    rawText,
    [serviceName, problemName, suburbName, city],
    fallback
  );
}

function buildProblemResolutionDescription(rawText, serviceName, problemName, suburbName, city, step3) {
  const completionStep = firstNonEmpty(
    step3,
    "complete the most practical repair step and confirm stable system performance"
  );
  const fallback = joinSentences(
    `The next step is to ${lowerFirst(stripTrailingPunctuation(completionStep))}.`,
    `That response limits further disruption on the property in ${suburbName}.`,
    `It also gives the owner in ${city} a clearer path back to normal performance.`
  );

  return contextualizeParagraph(
    rawText,
    [serviceName, problemName, suburbName, city],
    fallback
  );
}

function buildProblemCtaIntro(base, serviceName, problemName, suburbName, city) {
  const fallback = joinSentences(
    `${upperFirst(problemName.toLowerCase())} in ${suburbName}, ${city} needs a clear diagnosis`,
    `Book Myriad Green to isolate the fault and define the repair path`
  );

  return contextualizeParagraph(
    base,
    [serviceName, problemName, suburbName, city],
    fallback
  );
}

function buildProblemFaqAnswer(answer, serviceName, problemName, suburbName, city, index) {
  let output = safeValue(answer).trim();
  const contextSentences = [
    `That symptom should be checked before a repair plan is agreed in ${suburbName}, ${city}`,
    `A local ${serviceName.toLowerCase()} visit in ${suburbName} separates the real fault from similar symptoms`,
    `Early diagnosis in ${suburbName}, ${city} keeps the next repair step practical`,
  ];

  if (!output) {
    return `${contextSentences[index]}.`;
  }

  output = replaceLeadingPhrase(
    output,
    ["Common", "signs", "include"],
    `Typical signs of ${problemName.toLowerCase()} include `
  );

  if (!containsContext(output, [serviceName, problemName, suburbName, city])) {
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

function buildProblemLocalAreaIntro(serviceName, problemName, suburbName, city) {
  return `Myriad Green provides ${serviceName.toLowerCase()} across ${suburbName} and surrounding ${city} areas, with fast response and practical on-site support.`;
}

function buildProblemLocalAreaDetail(serviceName, problemName, suburbName, city) {
  return `${upperFirst(withIndefiniteArticle(lowerCaseWords(problemName)))} needs targeted diagnosis before repair work starts. Our ${serviceName.toLowerCase()} process isolates the fault and defines the right next step for the property.`;
}

function replaceProblemLocalAreaCopy(html, introCopy, detailCopy) {
  return html.replace(
    /(<section id="local-area"[\s\S]*?<h2[^>]*>Local Area Service<\/h2>\s*<p>)[\s\S]*?(<\/p>\s*<p>)[\s\S]*?(<\/p>\s*<\/section>)/,
    `$1\n        ${introCopy}\n      $2\n        ${detailCopy}\n      $3`
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
  const template = fs.readFileSync(TEMPLATE_FILE, "utf8");
  const internalLinksTemplate = fs.readFileSync(INTERNAL_LINKS_PARTIAL_FILE, "utf8");
  const servicesCsv = readCsv(SERVICES_CSV);
  const suburbsCsv = readCsv(SUBURBS_CSV);
  const problemsCsv = readCsv(PROBLEMS_CSV);
  const problemContentCsv = readCsv(PROBLEM_CONTENT_CSV);
  const serviceContentCsv = readCsv(SERVICE_CONTENT_CSV);
  const intentsCsv = readCsv(INTENTS_CSV);

  assertHeaders(servicesCsv.headers, REQUIRED_SERVICE_HEADERS, SERVICES_CSV);
  assertHeaders(suburbsCsv.headers, REQUIRED_SUBURB_HEADERS, SUBURBS_CSV);
  assertHeaders(problemsCsv.headers, REQUIRED_PROBLEM_HEADERS, PROBLEMS_CSV);
  assertHeaders(problemContentCsv.headers, REQUIRED_PROBLEM_CONTENT_HEADERS, PROBLEM_CONTENT_CSV);
  assertHeaders(serviceContentCsv.headers, REQUIRED_SERVICE_CONTENT_HEADERS, SERVICE_CONTENT_CSV);
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
  if (problemContentCsv.records.length === 0) {
    throw new Error("problem-content.csv has no data rows.");
  }
  if (serviceContentCsv.records.length === 0) {
    throw new Error("service-content.csv has no data rows.");
  }
  if (intentsCsv.records.length === 0) {
    throw new Error("intents.csv has no data rows.");
  }

  const problemContentBySlug = indexRecordsByKey(
    problemContentCsv.records,
    "problem_slug",
    "problem-content.csv"
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

    const matchingProblems = problemsCsv.records.filter(
      (problem) => safeValue(problem.service_slug).trim() === serviceSlug
    );

    matchingProblems.forEach((problem) => {
      const problemName = safeValue(problem.problem).trim();
      const problemSlug = safeValue(problem.problem_slug).trim();

      if (!problemSlug) {
        throw new Error(`Encountered problem row with empty problem_slug for service '${serviceSlug}'.`);
      }

      const problemContent = problemContentBySlug.get(problemSlug);

      if (!problemContent) {
        throw new Error(
          `Missing problem-content.csv row for problem_slug '${problemSlug}'.`
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
        const pageName = `${problemName} ${serviceName} in ${suburbName}, ${city}`;
        const areaServed = `${suburbName}, ${city}, ${province}`;
        const suburbServiceUrl = buildSuburbServiceUrl(serviceSlug, suburbSlug);
        const outputFolder = path.join(OUTPUT_ROOT_DIR, serviceSlug, suburbSlug, problemSlug);
        const outputFile = path.join(outputFolder, "index.html");
        const symptom1 = safeValue(problemContent.symptom_1);
        const symptom2 = safeValue(problemContent.symptom_2);
        const symptom3 = safeValue(problemContent.symptom_3);
        const step1 = safeValue(problemContent.step_1);
        const step2 = safeValue(problemContent.step_2);
        const step3 = safeValue(problemContent.step_3);
        const symptomValues = [symptom1, symptom2, symptom3];
        const ctaIntro = buildProblemCtaIntro(
          firstNonEmpty(problemContent.cta_intro, serviceContent.cta_intro),
          serviceName,
          problemName,
          suburbName,
          city
        );
        const heroIntro = buildProblemHeroIntro(
          firstNonEmpty(problemContent.hero_intro, serviceContent.hero_intro),
          serviceName,
          problemName,
          suburbName,
          city,
          symptomValues
        );
        const problemOverview = buildProblemOverview(
          firstNonEmpty(problemContent.problem_overview, serviceContent.overview),
          serviceName,
          problemName,
          suburbName,
          city,
          symptomValues,
          step1,
          step2
        );
        const localAreaIntro = buildProblemLocalAreaIntro(serviceName, problemName, suburbName, city);
        const localAreaDetail = buildProblemLocalAreaDetail(serviceName, problemName, suburbName, city);
        const trust1 = firstNonEmpty(
          problemContent.trust_1,
          serviceContent.trust_experience,
          `${serviceName} support for residential properties and managed sites`
        );
        const trust2 = firstNonEmpty(
          problemContent.trust_2,
          serviceContent.trust_equipment,
          `Professional diagnostics and repair planning for ${serviceName}`
        );
        const trust3 = firstNonEmpty(
          problemContent.trust_3,
          serviceContent.trust_response_time,
          `Prompt scheduling for ${problemName.toLowerCase()} issues in ${city}`
        );
        const trust4 = firstNonEmpty(
          problemContent.trust_4,
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
          problem: problemName,
          problem_slug: problemSlug,
          primary_cta: primaryCta,
          hero_intro: heroIntro,
          problem_overview: problemOverview,
          symptom_1: firstNonEmpty(symptom1, `${upperFirst(problemName.toLowerCase())} may already be affecting normal system performance`),
          symptom_2: firstNonEmpty(symptom2, `The fault can continue causing disruption if it is not diagnosed properly`),
          symptom_3: firstNonEmpty(symptom3, `A practical inspection helps confirm the true cause before repair work begins`),
          step_1: firstNonEmpty(step1, `Inspect the issue and confirm the likely cause`),
          step_2: firstNonEmpty(step2, `Recommend the most practical repair approach`),
          step_3: firstNonEmpty(step3, `Complete the next repair step and confirm system performance`),
          problem_1_title: firstNonEmpty(problemContent.problem_1_title, `${problemName} signs to look for`),
          problem_1_description: buildProblemSymptomsDescription(
            problemContent.problem_1_description,
            serviceName,
            problemName,
            suburbName,
            city,
            symptomValues
          ),
          problem_2_title: firstNonEmpty(problemContent.problem_2_title, `How ${problemName.toLowerCase()} is assessed`),
          problem_2_description: buildProblemAssessmentDescription(
            problemContent.problem_2_description,
            serviceName,
            problemName,
            suburbName,
            city,
            step1,
            step2
          ),
          problem_3_title: firstNonEmpty(problemContent.problem_3_title, `Recommended ${serviceName.toLowerCase()} next step`),
          problem_3_description: buildProblemResolutionDescription(
            problemContent.problem_3_description,
            serviceName,
            problemName,
            suburbName,
            city,
            step3
          ),
          trust_1: trust1,
          trust_2: trust2,
          trust_3: trust3,
          trust_4: trust4,
          cta_intro: ctaIntro,
          primary_cta_url: firstNonEmpty(problemContent.primary_cta_url, suburbServiceUrl),
          faq_1_q: safeValue(problemContent.faq_1_q),
          faq_1_a: buildProblemFaqAnswer(
            problemContent.faq_1_a,
            serviceName,
            problemName,
            suburbName,
            city,
            0
          ),
          faq_2_q: safeValue(problemContent.faq_2_q),
          faq_2_a: buildProblemFaqAnswer(
            problemContent.faq_2_a,
            serviceName,
            problemName,
            suburbName,
            city,
            1
          ),
          faq_3_q: safeValue(problemContent.faq_3_q),
          faq_3_a: buildProblemFaqAnswer(
            problemContent.faq_3_a,
            serviceName,
            problemName,
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
          meta_description: `${problemName} support from Myriad Green in ${suburbName}, ${city}, ${province}. Accurate diagnosis, repair planning, and local response.`,
          canonical: canonicalPath,
          structured_data_json: buildStructuredData({
            name: pageName,
            areaServed,
            url: canonicalPath,
          }),
        };
        templateValues.internal_links = replaceVariables(internalLinksTemplate, templateValues);

        const renderedHtml = finalizeRenderedCopy(
          replaceProblemLocalAreaCopy(
            normalizeBookingCta(
              replaceVariables(template, templateValues),
              serviceSlug
            ),
            localAreaIntro,
            localAreaDetail
          )
        );

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
