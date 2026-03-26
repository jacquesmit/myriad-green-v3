import { allowedProtocols } from "./config.js";

export function classifyUrl(url) {
  if (typeof url !== "string" || url.trim() === "") {
    throw new Error("url must be a non-empty string.");
  }

  const normalizedUrl = url.trim();

  if (normalizedUrl.startsWith("/")) {
    return "rootRelative";
  }

  if (/^https?:/i.test(normalizedUrl)) {
    return "external";
  }

  if (allowedProtocols.some((protocol) => normalizedUrl.startsWith(protocol))) {
    return "protocol";
  }

  if (normalizedUrl.startsWith("#")) {
    return "fragment";
  }

  return "localRelative";
}