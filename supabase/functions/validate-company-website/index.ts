import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Origin": "*",
};

const MAX_URL_LENGTH = 300;
const MAX_NOTE_LENGTH = 700;
const MAX_REASON_LENGTH = 180;
const MAX_COMPANY_DOMAINS = 3;
const MAX_FETCHED_PAGES = 4;
const MAX_HTML_LENGTH = 150_000;
const MAX_PAGE_TEXT_LENGTH = 2_200;
const MAX_OPENAI_CONTEXT_LENGTH = 12_000;
const PAGE_FETCH_TIMEOUT_MS = 2_500;
const PRIORITY_PATH_SEGMENTS = ["/about", "/company", "/team", "/contact", "/products", "/services", "/privacy", "/terms"];

type ValidateCompanyWebsiteRequest = {
  websiteUrl?: string;
  companyDomains?: string[];
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type WebsitePageEvidence = {
  url: string;
  title: string;
  description: string;
  text: string;
  linkCandidates: string[];
};

type WebsiteVerificationResponse = {
  status: "approved" | "rejected" | "pending";
  reviewNotes: string;
  checkedAt: string;
  checkedUrl: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
};

class InputValidationError extends Error {}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeCompanyDomains(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .map((item) => normalizeText(item, 60))
    .filter(Boolean)
    .filter((item) => {
      const normalized = item.toLowerCase();

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    })
    .slice(0, MAX_COMPANY_DOMAINS);
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }

  const ipv4Match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);

  if (!ipv4Match) {
    return false;
  }

  const octets = ipv4Match.slice(1).map(Number);

  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return true;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function normalizeWebsiteUrl(value: unknown) {
  const trimmedValue = normalizeText(value, MAX_URL_LENGTH);

  if (!trimmedValue) {
    throw new InputValidationError("A company website URL is required.");
  }

  const candidateUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(candidateUrl);
  } catch {
    throw new InputValidationError("Enter a valid company website URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new InputValidationError("Only public HTTP or HTTPS website URLs are supported.");
  }

  if (isPrivateHostname(parsedUrl.hostname)) {
    throw new InputValidationError("Private or local network website URLs are not supported.");
  }

  parsedUrl.hash = "";

  return parsedUrl.toString().slice(0, MAX_URL_LENGTH);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return normalizeText(match?.[1] ?? "", 160);
}

function extractMetaDescription(html: string) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i);
  return normalizeText(match?.[1] ?? "", 240);
}

function prioritizeLinks(links: string[]) {
  return [...links].sort((first, second) => {
    const firstRank = PRIORITY_PATH_SEGMENTS.findIndex((segment) => first.toLowerCase().includes(segment));
    const secondRank = PRIORITY_PATH_SEGMENTS.findIndex((segment) => second.toLowerCase().includes(segment));
    const safeFirstRank = firstRank === -1 ? PRIORITY_PATH_SEGMENTS.length : firstRank;
    const safeSecondRank = secondRank === -1 ? PRIORITY_PATH_SEGMENTS.length : secondRank;

    if (safeFirstRank !== safeSecondRank) {
      return safeFirstRank - safeSecondRank;
    }

    return first.length - second.length;
  });
}

function extractCandidateLinks(html: string, currentUrl: string) {
  const baseUrl = new URL(currentUrl);
  const matches = html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi);
  const seen = new Set<string>();
  const collected: string[] = [];

  for (const match of matches) {
    const href = normalizeText(match[1], MAX_URL_LENGTH);

    if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    try {
      const resolved = new URL(href, baseUrl);

      if (resolved.origin !== baseUrl.origin) {
        continue;
      }

      resolved.hash = "";

      const candidate = resolved.toString();
      const pathname = resolved.pathname.toLowerCase();

      if (
        pathname === "/" ||
        pathname.startsWith("/cdn-cgi") ||
        pathname.includes(".jpg") ||
        pathname.includes(".jpeg") ||
        pathname.includes(".png") ||
        pathname.includes(".gif") ||
        pathname.includes(".svg") ||
        pathname.includes(".pdf")
      ) {
        continue;
      }

      if (seen.has(candidate)) {
        continue;
      }

      seen.add(candidate);
      collected.push(candidate);
    } catch {
      continue;
    }
  }

  return prioritizeLinks(collected).slice(0, MAX_FETCHED_PAGES - 1);
}

async function fetchWebsitePage(url: string): Promise<WebsitePageEvidence> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
      "User-Agent": "LuminasCompanyVerificationBot/1.0",
    },
    signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`The website responded with HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new Error("The website did not return readable HTML content.");
  }

  const html = (await response.text()).slice(0, MAX_HTML_LENGTH);
  const text = stripHtml(html).slice(0, MAX_PAGE_TEXT_LENGTH);

  if (!text) {
    throw new Error("The website page did not contain readable text.");
  }

  return {
    description: extractMetaDescription(html),
    linkCandidates: contentType.includes("text/html") ? extractCandidateLinks(html, response.url) : [],
    text,
    title: extractTitle(html),
    url: response.url,
  };
}

async function collectWebsiteEvidence(websiteUrl: string) {
  const homepage = await fetchWebsitePage(websiteUrl);
  const visited = new Set<string>([homepage.url]);
  const followUpLinks = homepage.linkCandidates.filter((candidate) => !visited.has(candidate)).slice(0, MAX_FETCHED_PAGES - 1);
  const followUpPages = await Promise.all(
    followUpLinks.map(async (candidate) => {
      try {
        const page = await fetchWebsitePage(candidate);
        visited.add(page.url);
        return page;
      } catch {
        return null;
      }
    }),
  );

  return [homepage, ...followUpPages.filter((page): page is WebsitePageEvidence => Boolean(page))];
}

function buildEvidenceSummary(pages: WebsitePageEvidence[]) {
  return pages
    .map((page, index) =>
      [
        `Page ${index + 1}: ${page.url}`,
        page.title ? `Title: ${page.title}` : "Title: none",
        page.description ? `Description: ${page.description}` : "Description: none",
        `Visible text excerpt: ${page.text}`,
      ].join("\n"),
    )
    .join("\n\n")
    .slice(0, MAX_OPENAI_CONTEXT_LENGTH);
}

function cleanJsonResponse(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function buildFallbackResult({
  checkedUrl,
  confidence,
  reasons,
  reviewNotes,
  status,
}: WebsiteVerificationResponse): WebsiteVerificationResponse {
  return {
    checkedAt: new Date().toISOString(),
    checkedUrl,
    confidence,
    reasons: reasons.map((reason) => normalizeText(reason, MAX_REASON_LENGTH)).filter(Boolean).slice(0, 4),
    reviewNotes: normalizeText(reviewNotes, MAX_NOTE_LENGTH),
    status,
  };
}

function normalizeModelDecision(value: unknown): WebsiteVerificationResponse["status"] {
  return value === "approved" || value === "rejected" || value === "pending" ? value : "pending";
}

function normalizeModelConfidence(value: unknown): WebsiteVerificationResponse["confidence"] {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

async function validateWithOpenAi({
  companyDomains,
  evidenceSummary,
  websiteUrl,
}: {
  companyDomains: string[];
  evidenceSummary: string;
  websiteUrl: string;
}) {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();

  if (!openAiApiKey) {
    throw new Error('Missing "OPENAI_API_KEY" secret for the website verification service.');
  }

  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You validate whether a public website looks like a real company or organization site for a professional profile.",
            "Review the supplied website excerpts thoroughly but conservatively.",
            "Prefer 'approved' only when the site clearly looks legitimate and complete enough for business identity checks.",
            "Use 'rejected' for broken, placeholder, parked, unrelated, empty, suspicious, or obviously non-business websites.",
            "Use 'pending' when the site may be real but the available evidence is inconclusive.",
            "Return JSON only with keys: status, confidence, summary, reasons.",
            "The reasons value must be an array of 1 to 4 short strings.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Submitted website: ${websiteUrl}`,
            `Claimed company domains/focus areas: ${companyDomains.length > 0 ? companyDomains.join(", ") : "none provided"}`,
            "",
            "Website evidence:",
            evidenceSummary,
            "",
            "Decide whether this website should be approved, rejected, or left pending for manual follow-up.",
            "The summary should mention the strongest evidence and the main concern, if any.",
          ].join("\n"),
        },
      ],
    }),
  });

  const payload = (await openAiResponse.json()) as OpenAiChatCompletionResponse;

  if (!openAiResponse.ok) {
    throw new Error(payload.error?.message || "OpenAI returned an unexpected error.");
  }

  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenAI did not return a verification result.");
  }

  const parsed = JSON.parse(cleanJsonResponse(content)) as {
    confidence?: unknown;
    reasons?: unknown;
    status?: unknown;
    summary?: unknown;
  };

  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.map((reason) => normalizeText(reason, MAX_REASON_LENGTH)).filter(Boolean).slice(0, 4)
    : [];

  return buildFallbackResult({
    checkedAt: new Date().toISOString(),
    checkedUrl: websiteUrl,
    confidence: normalizeModelConfidence(parsed.confidence),
    reasons: reasons.length > 0 ? reasons : ["The site needs a manual follow-up review."],
    reviewNotes: normalizeText(
      typeof parsed.summary === "string" ? parsed.summary : "The site needs a manual follow-up review.",
      MAX_NOTE_LENGTH,
    ),
    status: normalizeModelDecision(parsed.status),
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let checkedUrl = "";

  try {
    const body = (await request.json()) as ValidateCompanyWebsiteRequest;
    checkedUrl = normalizeWebsiteUrl(body.websiteUrl);
    const companyDomains = normalizeCompanyDomains(body.companyDomains);
    const pages = await collectWebsiteEvidence(checkedUrl);
    const evidenceSummary = buildEvidenceSummary(pages);

    return json(
      await validateWithOpenAi({
        companyDomains,
        evidenceSummary,
        websiteUrl: checkedUrl,
      }),
    );
  } catch (error) {
    if (error instanceof InputValidationError) {
      return json({ error: error.message }, 400);
    }

    const message = error instanceof Error ? error.message : "Unable to validate this website right now.";
    const loweredMessage = message.toLowerCase();
    const fallbackStatus: WebsiteVerificationResponse["status"] =
      loweredMessage.includes("openai") || loweredMessage.includes("secret") ? "pending" : "rejected";

    return json(
      buildFallbackResult({
        checkedAt: new Date().toISOString(),
        checkedUrl,
        confidence: fallbackStatus === "pending" ? "low" : "medium",
        reasons: [message],
        reviewNotes:
          fallbackStatus === "pending"
            ? `The website was fetched, but the AI verification step could not finish automatically: ${message}`
            : `We could not verify this website automatically: ${message}`,
        status: fallbackStatus,
      }),
    );
  }
});
