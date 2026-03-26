import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(MODULE_DIR, "../../..");
export const BUILD_DIR = ".build";
export const MANIFEST_PATH = ".build/build-manifest.json";
export const VALIDATION_REPORT_PATH = ".build/validation-report.json";

export const siteBaseUrl = "https://www.myriadgreen.co.za";

export const allowedProtocols = ["mailto:", "tel:"];

export const sharedAssetPrefixes = [
  "/assets/css/",
  "/assets/js/",
  "/assets/images/"
];

export const linkSubsetLimits = {
  serviceHub: {
    featuredSuburbs: 12,
    relatedServices: 6
  },
  serviceArea: {
    relatedProblems: 6,
    relatedIntents: 6,
    nearbySuburbs: 8,
    siblingServices: 6
  },
  problemPage: {
    siblingProblems: 6,
    relatedIntents: 6,
    nearbySuburbs: 6,
    siblingServices: 4
  },
  intentPage: {
    siblingIntents: 6,
    relatedProblems: 6,
    nearbySuburbs: 6,
    siblingServices: 4
  }
};