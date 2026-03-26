import fs from "node:fs";
import path from "node:path";

import { ROOT_DIR, allowedProtocols } from "./config.js";
import { classifyUrl } from "./url-classifier.js";

function ensureString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function stripFragment(value) {
  const fragmentIndex = value.indexOf("#");
  return fragmentIndex === -1 ? value : value.slice(0, fragmentIndex);
}

function stripQuery(value) {
  const queryIndex = value.indexOf("?");
  return queryIndex === -1 ? value : value.slice(0, queryIndex);
}

function resolveFileCandidate(filePath) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const nestedIndexPath = path.join(filePath, "index.html");
    if (fs.existsSync(nestedIndexPath) && fs.statSync(nestedIndexPath).isFile()) {
      return nestedIndexPath;
    }
  }

  return null;
}

function resolveRootRelativeUrl(url) {
  const sanitized = stripQuery(stripFragment(url)).replace(/^\/+/, "");
  const candidatePath = path.resolve(ROOT_DIR, sanitized);

  if (sanitized.endsWith("/")) {
    return resolveFileCandidate(path.join(candidatePath, "index.html"));
  }

  return resolveFileCandidate(candidatePath) ?? resolveFileCandidate(path.join(candidatePath, "index.html"));
}

function resolveLocalRelativeUrl(url, sourceFilePath) {
  const sourcePath = ensureString(sourceFilePath, "context.sourceFilePath");
  const sanitized = stripQuery(stripFragment(url));
  const baseDirectory = path.dirname(sourcePath);
  const candidatePath = path.resolve(baseDirectory, sanitized);

  if (sanitized.endsWith("/")) {
    return resolveFileCandidate(path.join(candidatePath, "index.html"));
  }

  return resolveFileCandidate(candidatePath) ?? resolveFileCandidate(path.join(candidatePath, "index.html"));
}

function fragmentExists(fragmentUrl, html) {
  const normalizedHtml = ensureString(html, "context.html");
  const fragmentId = fragmentUrl.slice(1);

  if (!fragmentId) {
    throw new Error("Fragment URL must include an id after '#'.");
  }

  const escapedId = fragmentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fragmentPattern = new RegExp(`id=["']${escapedId}["']`, "i");
  return fragmentPattern.test(normalizedHtml);
}

export function validateUrl(url, context = {}) {
  const normalizedUrl = ensureString(url, "url");
  const urlType = classifyUrl(normalizedUrl);

  if (/^javascript:/i.test(normalizedUrl)) {
    throw new Error(`JavaScript URLs are not allowed: ${normalizedUrl}`);
  }

  if (urlType === "external") {
    try {
      const parsedUrl = new URL(normalizedUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error(`Unsupported external URL protocol: ${parsedUrl.protocol}`);
      }
    } catch (error) {
      throw new Error(`Invalid external URL: ${normalizedUrl}. ${error.message}`);
    }

    return { type: urlType, url: normalizedUrl };
  }

  if (urlType === "protocol") {
    const matchingProtocol = allowedProtocols.find((protocol) => normalizedUrl.startsWith(protocol));
    if (!matchingProtocol) {
      throw new Error(`Protocol is not allowed: ${normalizedUrl}`);
    }

    return { type: urlType, url: normalizedUrl, protocol: matchingProtocol };
  }

  if (urlType === "fragment") {
    if (!fragmentExists(normalizedUrl, context.html)) {
      throw new Error(`Fragment target does not exist in page: ${normalizedUrl}`);
    }

    return { type: urlType, url: normalizedUrl, fragment: normalizedUrl.slice(1) };
  }

  const resolvedPath =
    urlType === "rootRelative"
      ? resolveRootRelativeUrl(normalizedUrl)
      : resolveLocalRelativeUrl(normalizedUrl, context.sourceFilePath);

  if (!resolvedPath) {
    throw new Error(`Resolved file does not exist for ${urlType} URL: ${normalizedUrl}`);
  }

  return {
    type: urlType,
    url: normalizedUrl,
    resolvedPath
  };
}

export function validateNoEmptyHref(html) {
  const normalizedHtml = ensureString(html, "html");
  const matches = [...normalizedHtml.matchAll(/href\s*=\s*(["'])\s*\1/gi)];

  if (matches.length > 0) {
    throw new Error(`Found ${matches.length} empty href attribute(s).`);
  }
}

export function validateNoJavascriptUrls(html) {
  const normalizedHtml = ensureString(html, "html");
  const matches = [...normalizedHtml.matchAll(/(?:href|src)\s*=\s*(["'])\s*javascript:[^"']*\1/gi)];

  if (matches.length > 0) {
    throw new Error(`Found ${matches.length} JavaScript URL(s) in HTML attributes.`);
  }
}