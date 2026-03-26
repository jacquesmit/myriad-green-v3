function escapeReplacement(value) {
  return String(value).replace(/\$/g, "$$$$");
}

export function renderTemplate(templateString, tokens) {
  if (typeof templateString !== "string") {
    throw new Error("templateString must be a string.");
  }

  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) {
    throw new Error("tokens must be a plain object.");
  }

  return templateString.replace(/\{\{\s*([a-zA-Z0-9_\-]+)\s*\}\}/g, (match, tokenName) => {
    if (!Object.prototype.hasOwnProperty.call(tokens, tokenName)) {
      return match;
    }

    const value = tokens[tokenName];
    if (value === null || value === undefined) {
      return "";
    }

    return escapeReplacement(value);
  });
}

export function assertNoUnresolvedTokens(html, filePath = "unknown file") {
  if (typeof html !== "string") {
    throw new Error("html must be a string.");
  }

  const unresolvedTokens = [...html.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((match) => match[1]);

  if (unresolvedTokens.length > 0) {
    const uniqueTokens = [...new Set(unresolvedTokens)];
    throw new Error(
      `Unresolved template tokens found in ${filePath}: ${uniqueTokens.join(", ")}`
    );
  }
}

export function normalizeWhitespaceForValidation(html) {
  if (typeof html !== "string") {
    throw new Error("html must be a string.");
  }

  return html
    .replace(/\r\n/g, "\n")
    .replace(/>\s+</g, "><")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}