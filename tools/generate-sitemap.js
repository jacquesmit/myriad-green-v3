"use strict";

/*
  Sitemap generator for public static pages.

  Discovers pages from:
  - services/
  - blog/
  - root-level public HTML pages

  Excludes internal/non-public directories and files.
  Writes sitemap.xml to project root.
*/

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_SITEMAP = path.join(ROOT_DIR, "sitemap.xml");
const BASE_URL = (process.env.SITE_BASE_URL || "https://www.myriadgreen.co.za").replace(/\/+$/, "");

const EXCLUDED_DIRS = new Set([
  "node_modules",
  "docs",
  "templates",
  "tools",
  "data",
  "functions",
]);

const ROOT_HTML_ALLOWLIST = new Set([
  "index.html",
  "privacy.html",
  "terms.html",
  "thank-you-order.html",
]);

function isHiddenDirectory(name) {
  return name.startsWith(".");
}

function walkHtmlFiles(startDir, acc) {
  if (!fs.existsSync(startDir)) {
    return;
  }

  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      if (isHiddenDirectory(entry.name) || EXCLUDED_DIRS.has(entry.name)) {
        return;
      }
      walkHtmlFiles(fullPath, acc);
      return;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      acc.push(fullPath);
    }
  });
}

function toPosixPath(absoluteFilePath) {
  return path.relative(ROOT_DIR, absoluteFilePath).split(path.sep).join("/");
}

function toPublicPath(relativeFilePath) {
  // Root index maps to site root.
  if (relativeFilePath === "index.html") {
    return "/";
  }

  // Nested index files map to clean trailing-slash URLs.
  if (relativeFilePath.endsWith("/index.html")) {
    return `/${relativeFilePath.slice(0, -"index.html".length)}`;
  }

  // Other HTML pages keep their file path.
  return `/${relativeFilePath}`;
}

function isIncludedRelativePath(relativeFilePath) {
  if (relativeFilePath.includes("/")) {
    return relativeFilePath.startsWith("services/") || relativeFilePath.startsWith("blog/");
  }

  return ROOT_HTML_ALLOWLIST.has(relativeFilePath);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSitemapXml(urls) {
  const lines = [];
  lines.push("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
  lines.push("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");

  urls.forEach((url) => {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(url)}</loc>`);
    lines.push("  </url>");
  });

  lines.push("</urlset>");
  lines.push("");
  return lines.join("\n");
}

function collectCandidateHtmlFiles() {
  const files = [];

  // Root-level public pages.
  ROOT_HTML_ALLOWLIST.forEach((fileName) => {
    const absolute = path.join(ROOT_DIR, fileName);
    if (fs.existsSync(absolute)) {
      files.push(absolute);
    }
  });

  // Recursive service/blog pages.
  walkHtmlFiles(path.join(ROOT_DIR, "services"), files);
  walkHtmlFiles(path.join(ROOT_DIR, "blog"), files);

  return files;
}

function run() {
  const htmlFiles = collectCandidateHtmlFiles();
  const urlSet = new Set();

  htmlFiles.forEach((absoluteFilePath) => {
    const relative = toPosixPath(absoluteFilePath);
    if (!isIncludedRelativePath(relative)) {
      return;
    }

    const publicPath = toPublicPath(relative);
    const fullUrl = `${BASE_URL}${publicPath}`;
    urlSet.add(fullUrl);
  });

  const urls = Array.from(urlSet).sort((a, b) => a.localeCompare(b));
  const xml = buildSitemapXml(urls);
  fs.writeFileSync(OUTPUT_SITEMAP, xml, "utf8");

  console.log(`Total URLs included: ${urls.length}`);
  console.log(`Sitemap written to: ${OUTPUT_SITEMAP}`);
}

try {
  run();
} catch (error) {
  console.error(`[ERROR] ${error.message}`);
  process.exitCode = 1;
}
