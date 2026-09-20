import crypto from "node:crypto";
import { defineSecret } from "firebase-functions/params";

export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
export const WORDPRESS_USERNAME = defineSecret("WORDPRESS_USERNAME");
export const WORDPRESS_APP_PASSWORD = defineSecret("WORDPRESS_APP_PASSWORD");
export const GOOGLE_SERVICE_ACCOUNT_JSON = defineSecret("GOOGLE_SERVICE_ACCOUNT_JSON");
export const MAGOS_SOCIAL_WEBHOOK_SECRET = defineSecret("MAGOS_SOCIAL_WEBHOOK_SECRET");

export const SOCIAL_WORKER_SECRETS = [
  OPENAI_API_KEY,
  WORDPRESS_USERNAME,
  WORDPRESS_APP_PASSWORD,
  GOOGLE_SERVICE_ACCOUNT_JSON,
  MAGOS_SOCIAL_WEBHOOK_SECRET
];

export const AUTOMATION_ID = "MGOS-SOCIAL-BLOG-01";
export const PROMPT_VERSION = "mg-social-v1.0.0";
export const OPENAI_MODEL = "gpt-5.6-luna";
export const WORDPRESS_BASE_URL = "https://myriadgreen.co.za";
export const SEO_SPREADSHEET_ID = "1fsX82j4eZDoRcP_jHdbXSN0GDMfPHEdlHlO_Iq0fF-A";
export const AUDIT_SPREADSHEET_ID = "1Y4iP2mVCIph8MrIL51mo-KpzgUkZbWW7ZUIlkH8lOTw";
export const SOCIAL_QUEUE_TAB = "Social Content Queue";
export const AUTOMATION_RUN_LOG_TAB = "Automation_Run_Log";

export const DEFAULT_CHANNELS = [
  "FACEBOOK",
  "LINKEDIN",
  "INSTAGRAM",
  "GOOGLE_BUSINESS"
];

const ALLOWED_CHANNELS = new Set([
  "FACEBOOK",
  "LINKEDIN",
  "INSTAGRAM",
  "GOOGLE_BUSINESS",
  "TIKTOK",
  "YOUTUBE"
]);

const CHANNEL_GUIDANCE = {
  FACEBOOK:
    "Useful hook, practical homeowner context, concise explanation, one CTA. Natural local-service tone.",
  LINKEDIN:
    "Educational/authority-led. Explain the trade or infrastructure insight without sounding like an advert. One CTA.",
  INSTAGRAM:
    "Visual, concise caption with short paragraphs, one CTA and a small set of relevant hashtags. No hashtag stuffing.",
  GOOGLE_BUSINESS:
    "Direct local service/update post with useful factual context and one action. Avoid unsupported superlatives.",
  TIKTOK:
    "20–45 second short-video script: hook, problem, what to check/do, CTA. Avoid unsafe DIY instructions.",
  YOUTUBE:
    "20–45 second Shorts script: hook, problem, what to check/do, CTA. Avoid unsafe DIY instructions."
};

function nowIso() {
  return new Date().toISOString();
}

function ymdCompact(date = new Date()) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export function normalizeChannels(input) {
  const requested = Array.isArray(input) && input.length ? input : DEFAULT_CHANNELS;
  const normalized = [...new Set(requested.map((value) => String(value).trim().toUpperCase()))];
  const invalid = normalized.filter((channel) => !ALLOWED_CHANNELS.has(channel));
  if (invalid.length) {
    throw new Error(`Unsupported channel(s): ${invalid.join(", ")}`);
  }
  return normalized;
}

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildSourceHash(post) {
  return sha256Hex(
    JSON.stringify({
      id: post.id,
      link: post.link,
      title: post.titleRaw,
      content: post.contentRaw,
      excerpt: post.excerptRaw
    })
  );
}

export function buildIdempotencyKey({ postId, sourceHash, channel, variant = "default" }) {
  return [
    "MGOS_SOCIAL",
    `WP:${postId}`,
    `HASH:${sourceHash}`,
    `PROMPT:${PROMPT_VERSION}`,
    `CHANNEL:${channel}`,
    `VARIANT:${variant}`
  ].join("|");
}

export function buildSocialContentId({ postId, sourceHash, channel }) {
  return `SOC-${ymdCompact()}-WP-${postId}-${channel}-${sourceHash.slice(0, 8)}`;
}

export function htmlToText(html = "") {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8211;|&#x2013;/gi, "–")
    .replace(/&#8212;|&#x2014;/gi, "—")
    .replace(/&#8217;|&#x2019;/gi, "’")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titleFromWp(post) {
  return String(post?.title?.rendered ?? post?.title?.raw ?? "").trim();
}

function contentFromWp(post) {
  return String(post?.content?.rendered ?? post?.content?.raw ?? "");
}

function excerptFromWp(post) {
  return String(post?.excerpt?.rendered ?? post?.excerpt?.raw ?? "");
}

function wpAuthHeader(username, appPassword) {
  return `Basic ${Buffer.from(`${username}:${appPassword}`, "utf8").toString("base64")}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw;
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload?.message
        ? payload.message
        : typeof payload === "string"
          ? payload.slice(0, 500)
          : response.statusText;
    throw new Error(`${response.status} ${response.statusText}: ${message}`);
  }
  return payload;
}

function slugFromSourceUrl(sourceUrl) {
  if (!sourceUrl) return "";
  try {
    const url = new URL(sourceUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1) || "";
  } catch {
    return "";
  }
}

export async function fetchWordPressPost({
  postId,
  sourceUrl,
  slug,
  username,
  appPassword
}) {
  if (!username || !appPassword) {
    throw new Error("WordPress server-side credentials are missing");
  }

  const auth = wpAuthHeader(username, appPassword);
  const fields = [
    "id",
    "link",
    "slug",
    "status",
    "title",
    "content",
    "excerpt",
    "modified_gmt",
    "featured_media"
  ].join(",");

  let post;

  if (postId) {
    const url =
      `${WORDPRESS_BASE_URL}/wp-json/wp/v2/posts/${encodeURIComponent(postId)}` +
      `?context=edit&_fields=${encodeURIComponent(fields)}`;
    post = await fetchJson(url, { headers: { Authorization: auth } });
  } else {
    const resolvedSlug = String(slug || slugFromSourceUrl(sourceUrl)).trim();
    if (!resolvedSlug) {
      throw new Error("Provide post_id, slug, or source_url");
    }

    const url =
      `${WORDPRESS_BASE_URL}/wp-json/wp/v2/posts` +
      `?context=edit&slug=${encodeURIComponent(resolvedSlug)}&per_page=1&_fields=${encodeURIComponent(fields)}`;
    const posts = await fetchJson(url, { headers: { Authorization: auth } });
    post = Array.isArray(posts) ? posts[0] : null;
  }

  if (!post?.id) {
    throw new Error("WordPress post not found");
  }

  if (post.status !== "publish") {
    throw new Error(`WordPress post ${post.id} is not published (status=${post.status || "unknown"})`);
  }

  const normalized = {
    id: Number(post.id),
    link: String(post.link || sourceUrl || "").trim(),
    slug: String(post.slug || "").trim(),
    status: post.status,
    titleRaw: titleFromWp(post),
    contentRaw: contentFromWp(post),
    excerptRaw: excerptFromWp(post),
    modifiedGmt: String(post.modified_gmt || "").trim(),
    featuredMediaId: Number(post.featured_media || 0) || 0
  };

  if (!normalized.link || !normalized.titleRaw || !normalized.contentRaw) {
    throw new Error("WordPress post is missing required canonical source fields");
  }

  normalized.titleText = htmlToText(normalized.titleRaw);
  normalized.contentText = htmlToText(normalized.contentRaw);
  normalized.excerptText = htmlToText(normalized.excerptRaw);
  normalized.sourceHash = buildSourceHash(normalized);

  return normalized;
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function parseServiceAccountJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  if (!parsed?.client_email || !parsed?.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON requires client_email and private_key");
  }

  return parsed;
}

async function googleSheetsAccessToken(serviceAccountJson) {
  const credentials = parseServiceAccountJson(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  );

  const unsigned = `${header}.${claims}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();

  const signature = signer
    .sign(credentials.private_key)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  const assertion = `${unsigned}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const payload = await response.json();
  if (!response.ok || !payload?.access_token) {
    throw new Error(
      `Google OAuth failed: ${payload?.error_description || payload?.error || response.statusText}`
    );
  }

  return { accessToken: payload.access_token, clientEmail: credentials.client_email };
}

function sheetsRangeUrl(spreadsheetId, range) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
}

async function sheetsGetValues({ spreadsheetId, range, accessToken }) {
  const payload = await fetchJson(sheetsRangeUrl(spreadsheetId, range), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return Array.isArray(payload?.values) ? payload.values : [];
}

async function sheetsAppendValues({
  spreadsheetId,
  range,
  values,
  accessToken
}) {
  const url =
    `${sheetsRangeUrl(spreadsheetId, range)}:append` +
    "?valueInputOption=RAW&insertDataOption=INSERT_ROWS&includeValuesInResponse=true";

  return fetchJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      majorDimension: "ROWS",
      values
    })
  });
}

async function readQueueKeys(accessToken) {
  const rows = await sheetsGetValues({
    spreadsheetId: SEO_SPREADSHEET_ID,
    range: `'${SOCIAL_QUEUE_TAB}'!A2:X1000`,
    accessToken
  });

  const records = rows.map((row, index) => ({
    rowNumber: index + 2,
    socialContentId: row[0] || "",
    sourceWpPostId: row[1] || "",
    channel: row[6] || "",
    approvalState: row[12] || "",
    publishState: row[13] || "",
    idempotencyKey: row[21] || ""
  }));

  return {
    rows: records,
    keys: new Set(records.map((row) => row.idempotencyKey).filter(Boolean))
  };
}

function buildUtmUrl(sourceUrl, postId, sourceHash, channel) {
  const url = new URL(sourceUrl);
  url.searchParams.set("utm_source", channel.toLowerCase());
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", "magos_wp_repurpose");
  url.searchParams.set("utm_content", `wp_${postId}_${sourceHash.slice(0, 8)}`);
  return url.toString();
}

function buildOpenAiPrompt(post, channels) {
  const guidance = channels
    .map((channel) => `- ${channel}: ${CHANNEL_GUIDANCE[channel]}`)
    .join("\n");

  const sourceText = post.contentText.slice(0, 24000);
  const excerpt = post.excerptText.slice(0, 3000);

  return [
    "Create channel-specific social-media drafts for Myriad Green from the canonical WordPress source below.",
    "",
    "Hard rules:",
    "- Use only facts supported by the source text.",
    "- Do not invent prices, guarantees, certifications, ratings, testimonials, savings, project outcomes, locations, or technical claims.",
    "- Practical local expert tone; no hype, clickbait, fear, or generic AI filler.",
    "- One primary CTA per post.",
    "- Do not include a URL in draft_text; MAGOS adds the tracked URL separately.",
    "- If the source does not support a claim, omit it.",
    "- Return exactly one post for every requested channel.",
    "",
    "Channel guidance:",
    guidance,
    "",
    "Return JSON only, with this shape:",
    '{"posts":[{"channel":"FACEBOOK","variant":"default","draft_text":"..."}]}',
    "",
    `Source title: ${post.titleText}`,
    `Canonical URL: ${post.link}`,
    `WordPress post ID: ${post.id}`,
    `Modified GMT: ${post.modifiedGmt}`,
    excerpt ? `Excerpt:\n${excerpt}` : "",
    "",
    "Source body:",
    sourceText
  ]
    .filter(Boolean)
    .join("\n");
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if (
        (part?.type === "output_text" || part?.type === "text") &&
        typeof part?.text === "string" &&
        part.text.trim()
      ) {
        return part.text.trim();
      }
    }
  }

  return "";
}

function parseJsonOnly(text) {
  const cleaned = String(text)
    .trim()
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

async function generateDrafts({ post, channels, apiKey }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: "none" },
      instructions:
        "You are the MAGOS social-content drafting worker. Follow the source-grounding and output-contract rules exactly.",
      input: buildOpenAiPrompt(post, channels),
      max_output_tokens: 5000
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || response.statusText;
    throw new Error(`OpenAI generation failed: ${message}`);
  }

  const text = extractResponseText(payload);
  if (!text) {
    throw new Error("OpenAI response contained no output text");
  }

  let parsed;
  try {
    parsed = parseJsonOnly(text);
  } catch (error) {
    throw new Error(`OpenAI output was not valid JSON: ${error.message}`);
  }

  const posts = Array.isArray(parsed?.posts) ? parsed.posts : [];
  const byChannel = new Map();

  for (const item of posts) {
    const channel = String(item?.channel || "").trim().toUpperCase();
    const variant = String(item?.variant || "default").trim() || "default";
    const draftText = String(item?.draft_text || "").trim();

    if (!channels.includes(channel)) continue;
    if (!draftText || draftText.length < 40) {
      throw new Error(`Generated draft for ${channel} is empty or too short`);
    }
    if (byChannel.has(channel)) {
      throw new Error(`OpenAI returned duplicate channel ${channel}`);
    }

    byChannel.set(channel, {
      channel,
      variant,
      draftText
    });
  }

  const missing = channels.filter((channel) => !byChannel.has(channel));
  if (missing.length) {
    throw new Error(`OpenAI omitted channel(s): ${missing.join(", ")}`);
  }

  return {
    drafts: channels.map((channel) => byChannel.get(channel)),
    responseId: payload?.id || "",
    model: payload?.model || OPENAI_MODEL
  };
}

function queueRow({ post, draft, model }) {
  const idempotencyKey = buildIdempotencyKey({
    postId: post.id,
    sourceHash: post.sourceHash,
    channel: draft.channel,
    variant: draft.variant
  });

  return {
    idempotencyKey,
    values: [
      buildSocialContentId({
        postId: post.id,
        sourceHash: post.sourceHash,
        channel: draft.channel
      }),
      String(post.id),
      post.link,
      post.titleText,
      post.modifiedGmt,
      post.sourceHash,
      draft.channel,
      draft.variant,
      draft.draftText,
      post.link,
      buildUtmUrl(post.link, post.id, post.sourceHash, draft.channel),
      post.featuredMediaId ? `wordpress:media:${post.featuredMediaId}` : "",
      "REVIEW_REQUIRED",
      "NOT_READY",
      "",
      "",
      "",
      PROMPT_VERSION,
      model || OPENAI_MODEL,
      "REVIEW",
      "PASS",
      idempotencyKey,
      "",
      nowIso()
    ]
  };
}

function safeEquals(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function appendAndVerifyQueue({ rows, accessToken }) {
  const append = await sheetsAppendValues({
    spreadsheetId: SEO_SPREADSHEET_ID,
    range: `'${SOCIAL_QUEUE_TAB}'!A:X`,
    values: rows.map((row) => row.values),
    accessToken
  });

  const updatedRange = append?.updates?.updatedRange;
  if (!updatedRange) {
    throw new Error("Sheets queue append returned no updatedRange");
  }

  const readBack = await sheetsGetValues({
    spreadsheetId: SEO_SPREADSHEET_ID,
    range: updatedRange,
    accessToken
  });

  if (readBack.length !== rows.length) {
    throw new Error(
      `Queue read-back row count mismatch: expected ${rows.length}, got ${readBack.length}`
    );
  }

  for (let i = 0; i < rows.length; i += 1) {
    const expected = rows[i];
    const actual = readBack[i] || [];
    if (actual[0] !== expected.values[0] || actual[21] !== expected.idempotencyKey) {
      throw new Error(`Queue read-back mismatch at ${updatedRange}, row offset ${i}`);
    }
    if (actual[12] !== "REVIEW_REQUIRED" || actual[13] !== "NOT_READY") {
      throw new Error(`Queue approval/publish gate mismatch at ${updatedRange}, row offset ${i}`);
    }
  }

  return { updatedRange, readBack };
}

async function appendAutomationRun({
  accessToken,
  providerRunId,
  runState,
  startedAt,
  completedAt,
  idempotencyKey,
  inputScope,
  affectedIds = [],
  writesSummary = "",
  readbackSummary = "",
  errorOrBlocker = "",
  evidenceLink = ""
}) {
  const runLogId = `ARL-${ymdCompact()}-SOCIAL-${providerRunId.slice(0, 8).toUpperCase()}`;
  const row = [
    runLogId,
    AUTOMATION_ID,
    providerRunId,
    runState,
    "EVENT_DRIVEN",
    startedAt,
    completedAt,
    idempotencyKey,
    inputScope,
    affectedIds.join("; "),
    writesSummary,
    readbackSummary,
    errorOrBlocker,
    evidenceLink,
    completedAt
  ];

  const append = await sheetsAppendValues({
    spreadsheetId: AUDIT_SPREADSHEET_ID,
    range: `'${AUTOMATION_RUN_LOG_TAB}'!A:O`,
    values: [row],
    accessToken
  });

  const updatedRange = append?.updates?.updatedRange;
  if (!updatedRange) {
    throw new Error("Automation_Run_Log append returned no updatedRange");
  }

  const readBack = await sheetsGetValues({
    spreadsheetId: AUDIT_SPREADSHEET_ID,
    range: updatedRange,
    accessToken
  });

  if (readBack?.[0]?.[0] !== runLogId || readBack?.[0]?.[2] !== providerRunId) {
    throw new Error("Automation_Run_Log read-back failed");
  }

  return { runLogId, updatedRange };
}

export async function processSocialBlogEvent({
  payload,
  secretValues,
  providerRunId = crypto.randomUUID()
}) {
  const startedAt = nowIso();
  const channels = normalizeChannels(payload?.channels);
  const {
    openAiApiKey,
    wordpressUsername,
    wordpressAppPassword,
    googleServiceAccountJson
  } = secretValues;

  const { accessToken, clientEmail } = await googleSheetsAccessToken(
    googleServiceAccountJson
  );

  let post;
  let runKey = `${AUTOMATION_ID}|${providerRunId}`;

  try {
    post = await fetchWordPressPost({
      postId: payload?.post_id,
      sourceUrl: payload?.source_url,
      slug: payload?.slug,
      username: wordpressUsername,
      appPassword: wordpressAppPassword
    });

    runKey = [
      AUTOMATION_ID,
      `WP:${post.id}`,
      `HASH:${post.sourceHash}`,
      `CHANNELS:${channels.join(",")}`
    ].join("|");

    const queue = await readQueueKeys(accessToken);
    const pendingChannels = channels.filter((channel) => {
      const key = buildIdempotencyKey({
        postId: post.id,
        sourceHash: post.sourceHash,
        channel,
        variant: "default"
      });
      return !queue.keys.has(key);
    });

    if (!pendingChannels.length) {
      const completedAt = nowIso();
      const audit = await appendAutomationRun({
        accessToken,
        providerRunId,
        runState: "SUCCEEDED",
        startedAt,
        completedAt,
        idempotencyKey: runKey,
        inputScope: `WordPress post ${post.id} — no-op duplicate replay`,
        writesSummary: "No social queue rows written; all channel idempotency keys already exist.",
        readbackSummary: "Existing Social Content Queue keys confirmed before model call.",
        evidenceLink: post.link
      });

      return {
        ok: true,
        state: "NOOP_DUPLICATE",
        providerRunId,
        wordpressPostId: post.id,
        sourceHash: post.sourceHash,
        channels,
        generatedChannels: [],
        skippedChannels: channels,
        googleServiceAccount: clientEmail,
        audit
      };
    }

    const generated = await generateDrafts({
      post,
      channels: pendingChannels,
      apiKey: openAiApiKey
    });

    const rows = generated.drafts.map((draft) =>
      queueRow({ post, draft, model: generated.model })
    );

    const queueWrite = await appendAndVerifyQueue({
      rows,
      accessToken
    });

    const completedAt = nowIso();
    const affectedIds = rows.map((row) => row.values[0]);

    const audit = await appendAutomationRun({
      accessToken,
      providerRunId,
      runState: "SUCCEEDED",
      startedAt,
      completedAt,
      idempotencyKey: runKey,
      inputScope: `WordPress post ${post.id}: ${post.titleText}`,
      affectedIds,
      writesSummary:
        `Created ${rows.length} draft-only Social Content Queue row(s); approval_state=REVIEW_REQUIRED; publish_state=NOT_READY.`,
      readbackSummary:
        `Verified ${queueWrite.updatedRange}; social_content_id and idempotency_key matched; publication remains blocked.`,
      evidenceLink: post.link
    });

    return {
      ok: true,
      state: "DRAFTS_QUEUED",
      providerRunId,
      openAiResponseId: generated.responseId,
      model: generated.model,
      wordpressPostId: post.id,
      sourceUrl: post.link,
      sourceHash: post.sourceHash,
      sourceModifiedGmt: post.modifiedGmt,
      requestedChannels: channels,
      generatedChannels: pendingChannels,
      skippedChannels: channels.filter((channel) => !pendingChannels.includes(channel)),
      queueRange: queueWrite.updatedRange,
      socialContentIds: affectedIds,
      approvalState: "REVIEW_REQUIRED",
      publishState: "NOT_READY",
      googleServiceAccount: clientEmail,
      audit
    };
  } catch (error) {
    const completedAt = nowIso();
    let audit = null;
    try {
      audit = await appendAutomationRun({
        accessToken,
        providerRunId,
        runState: "FAILED",
        startedAt,
        completedAt,
        idempotencyKey: runKey,
        inputScope: post
          ? `WordPress post ${post.id}: ${post.titleText}`
          : "WordPress source resolution/generation",
        writesSummary: "No successful terminal social-content transaction.",
        readbackSummary: "Failure retained; no publication action is permitted.",
        errorOrBlocker: error.message,
        evidenceLink: post?.link || payload?.source_url || ""
      });
    } catch (auditError) {
      console.error("MAGOS social worker audit-log failure", auditError);
    }

    error.audit = audit;
    throw error;
  }
}

export async function magosSocialHttpHandler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      automation_id: AUTOMATION_ID,
      mode: "DRAFT_ONLY",
      auto_publish: false,
      model: OPENAI_MODEL,
      prompt_version: PROMPT_VERSION,
      queue: `${SEO_SPREADSHEET_ID}#${SOCIAL_QUEUE_TAB}`
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const suppliedSecret =
    req.get("x-magos-webhook-secret") ||
    String(req.body?.webhook_secret || "");

  const expectedSecret = MAGOS_SOCIAL_WEBHOOK_SECRET.value();
  if (!expectedSecret || !safeEquals(suppliedSecret, expectedSecret)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  const providerRunId = crypto.randomUUID();

  try {
    const result = await processSocialBlogEvent({
      payload: req.body || {},
      providerRunId,
      secretValues: {
        openAiApiKey: OPENAI_API_KEY.value(),
        wordpressUsername: WORDPRESS_USERNAME.value(),
        wordpressAppPassword: WORDPRESS_APP_PASSWORD.value(),
        googleServiceAccountJson: GOOGLE_SERVICE_ACCOUNT_JSON.value()
      }
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("MAGOS social worker failed", {
      providerRunId,
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({
      ok: false,
      providerRunId,
      error: error.message,
      audit: error.audit || null,
      auto_publish: false
    });
  }
}
