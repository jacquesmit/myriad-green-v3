"use strict";

/*
  Dataset validator for SEO generation inputs.

  Validates:
  - Required headers exactly (name + order)
  - Row count > 0
  - Empty required fields
  - Duplicate service_slug (services.csv)
  - Duplicate suburb_slug (suburbs.csv)

  Uses only built-in Node.js modules.
*/

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "..", "data");

const DATASETS = [
  {
    fileName: "services.csv",
    requiredHeaders: ["service", "service_slug", "category", "primary_cta"],
    duplicateField: "service_slug",
  },
  {
    fileName: "suburbs.csv",
    requiredHeaders: ["suburb", "suburb_slug", "city", "province", "priority"],
    duplicateField: "suburb_slug",
  },
];

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  values.push(current);
  return values;
}

function readCsvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { error: `File not found: ${filePath}` };
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { error: `File is empty: ${filePath}` };
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);

  return { headers, rows };
}

function validateHeaders(actual, expected, fileName) {
  const actualJoined = actual.join(",");
  const expectedJoined = expected.join(",");
  if (actualJoined === expectedJoined) {
    return [];
  }

  return [
    `${fileName}: header mismatch`,
    `  expected: ${expectedJoined}`,
    `  actual:   ${actualJoined}`,
  ];
}

function validateRowCount(rows, fileName) {
  if (rows.length > 0) {
    return [];
  }
  return [`${fileName}: must contain at least 1 data row`];
}

function validateEmptyRequiredFields(rows, headers, fileName) {
  const errors = [];

  rows.forEach((row, rowIndex) => {
    headers.forEach((header, colIndex) => {
      const value = row[colIndex];
      if (typeof value !== "string" || value.trim() === "") {
        errors.push(
          `${fileName}: row ${rowIndex + 2} has empty required field '${header}'`
        );
      }
    });
  });

  return errors;
}

function validateDuplicateField(rows, headers, fieldName, fileName) {
  const errors = [];
  const fieldIndex = headers.indexOf(fieldName);

  if (fieldIndex === -1) {
    errors.push(`${fileName}: duplicate check field not found in header: ${fieldName}`);
    return errors;
  }

  const seen = new Map();
  rows.forEach((row, rowIndex) => {
    const raw = row[fieldIndex] || "";
    const value = raw.trim();
    if (!value) {
      return;
    }

    if (seen.has(value)) {
      errors.push(
        `${fileName}: duplicate ${fieldName} '${value}' at rows ${seen.get(value)} and ${rowIndex + 2}`
      );
      return;
    }

    seen.set(value, rowIndex + 2);
  });

  return errors;
}

function run() {
  const allErrors = [];
  console.log("\n=== Dataset Validation ===\n");

  DATASETS.forEach((dataset) => {
    const filePath = path.join(DATA_DIR, dataset.fileName);
    const loaded = readCsvFile(filePath);
    const datasetErrors = [];

    if (loaded.error) {
      datasetErrors.push(loaded.error);
    } else {
      datasetErrors.push(
        ...validateHeaders(loaded.headers, dataset.requiredHeaders, dataset.fileName)
      );

      // Row-level checks are only meaningful when header is valid.
      const headerOk = datasetErrors.length === 0;
      if (headerOk) {
        datasetErrors.push(...validateRowCount(loaded.rows, dataset.fileName));
        datasetErrors.push(
          ...validateEmptyRequiredFields(loaded.rows, loaded.headers, dataset.fileName)
        );
        datasetErrors.push(
          ...validateDuplicateField(
            loaded.rows,
            loaded.headers,
            dataset.duplicateField,
            dataset.fileName
          )
        );
      }
    }

    if (datasetErrors.length === 0) {
      console.log(`[PASS] ${dataset.fileName}`);
    } else {
      console.log(`[FAIL] ${dataset.fileName}`);
      datasetErrors.forEach((err) => console.log(`  - ${err}`));
      allErrors.push(...datasetErrors);
    }
  });

  if (allErrors.length === 0) {
    console.log("\nRESULT: PASS - all dataset checks passed.\n");
    return;
  }

  console.log(`\nRESULT: FAIL - ${allErrors.length} issue(s) found.\n`);
  process.exitCode = 1;
}

run();
