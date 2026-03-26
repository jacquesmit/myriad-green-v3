import fs from "node:fs/promises";
import path from "node:path";

import { MANIFEST_PATH, ROOT_DIR } from "./config.js";

function ensureManifestShape(manifest) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.pages)) {
    throw new Error("manifest must be created with createManifest().");
  }
}

function ensureEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Manifest entry must be a plain object.");
  }

  if (typeof entry.id !== "string" || entry.id.trim() === "") {
    throw new Error("Manifest entry must include a non-empty id.");
  }

  if (typeof entry.outputPath !== "string" || entry.outputPath.trim() === "") {
    throw new Error("Manifest entry must include a non-empty outputPath.");
  }

  return {
    ...entry,
    id: entry.id.trim(),
    outputPath: entry.outputPath.replace(/\\/g, "/").trim()
  };
}

export function createManifest() {
  return {
    generatedAt: new Date().toISOString(),
    pages: [],
    _pageIds: new Set(),
    _outputPaths: new Set()
  };
}

export function addManifestEntry(manifest, entry) {
  ensureManifestShape(manifest);
  const normalizedEntry = ensureEntry(entry);

  if (manifest._pageIds.has(normalizedEntry.id)) {
    throw new Error(`Duplicate manifest page id: ${normalizedEntry.id}`);
  }

  if (manifest._outputPaths.has(normalizedEntry.outputPath)) {
    throw new Error(`Duplicate manifest outputPath: ${normalizedEntry.outputPath}`);
  }

  manifest._pageIds.add(normalizedEntry.id);
  manifest._outputPaths.add(normalizedEntry.outputPath);
  manifest.pages.push(normalizedEntry);

  return manifest;
}

export async function writeManifest(manifest) {
  ensureManifestShape(manifest);

  const manifestFilePath = path.resolve(ROOT_DIR, MANIFEST_PATH);
  await fs.mkdir(path.dirname(manifestFilePath), { recursive: true });

  const serializableManifest = {
    generatedAt: manifest.generatedAt,
    pages: manifest.pages
  };

  await fs.writeFile(
    manifestFilePath,
    `${JSON.stringify(serializableManifest, null, 2)}\n`,
    "utf8"
  );

  return manifestFilePath;
}