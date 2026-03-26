import path from "node:path";

import { ROOT_DIR } from "./config.js";

const INDEX_FILE_NAME = "index.html";

function assertSlug(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }

  const normalizedValue = value.trim();
  if (normalizedValue.includes("/") || normalizedValue.includes("\\")) {
    throw new Error(`${label} must not contain path separators: ${value}`);
  }

  return normalizedValue;
}

function toPosixPath(relativePath) {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    throw new Error("relativePath must be a non-empty string.");
  }

  return relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

function ensureIndexHtmlPath(relativePath) {
  const normalized = toPosixPath(relativePath);

  if (normalized.endsWith(`/${INDEX_FILE_NAME}`)) {
    return normalized;
  }

  const trimmed = normalized.replace(/\/+$/, "");

  if (trimmed.endsWith(".html")) {
    if (!trimmed.endsWith(INDEX_FILE_NAME)) {
      throw new Error(`Output path must use index.html structure: ${relativePath}`);
    }

    return trimmed;
  }

  return path.posix.join(trimmed, INDEX_FILE_NAME);
}

export function getServiceHubPath(serviceSlug) {
  return path.posix.join("services", assertSlug(serviceSlug, "serviceSlug"), INDEX_FILE_NAME);
}

export function getSuburbPagePath(serviceSlug, suburbSlug) {
  return path.posix.join(
    "services",
    assertSlug(serviceSlug, "serviceSlug"),
    assertSlug(suburbSlug, "suburbSlug"),
    INDEX_FILE_NAME
  );
}

export function getProblemPagePath(serviceSlug, suburbSlug, problemSlug) {
  return path.posix.join(
    "services",
    assertSlug(serviceSlug, "serviceSlug"),
    assertSlug(suburbSlug, "suburbSlug"),
    assertSlug(problemSlug, "problemSlug"),
    INDEX_FILE_NAME
  );
}

export function getIntentPagePath(serviceSlug, suburbSlug, intentSlug) {
  return path.posix.join(
    "services",
    assertSlug(serviceSlug, "serviceSlug"),
    assertSlug(suburbSlug, "suburbSlug"),
    assertSlug(intentSlug, "intentSlug"),
    INDEX_FILE_NAME
  );
}

export function resolveOutputPath(relativePath) {
  const normalized = ensureIndexHtmlPath(relativePath);
  return path.resolve(ROOT_DIR, normalized);
}

export function resolveUrlPath(relativePath) {
  const normalized = ensureIndexHtmlPath(relativePath);
  const directoryPath = normalized.slice(0, -INDEX_FILE_NAME.length);
  return `/${directoryPath}`;
}