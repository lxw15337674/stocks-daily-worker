import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { chromium, request as playwrightRequest } from "playwright";

const RSS_ENDPOINT_PREFIX = "https://news.google.com/rss/search?q=";
const RSS_ENDPOINT_SUFFIX = "&hl=en-US&gl=US&ceid=US:en";
const ET_TIMEZONE = "America/New_York";
const STOCKS_FETCH_TIMEOUT_MS = 15_000;
const RSS_FETCH_TIMEOUT_MS = 8_000;
const IMPORT_FETCH_TIMEOUT_MS = 20_000;
const STOCK_CONCURRENCY = 6;
const MAX_SEARCH_REQUESTS_PER_STOCK = 2;
const MAX_NEWS_ITEMS_PER_STOCK = 5;
const BODY_SNIPPET_PER_STOCK_LIMIT = 2;
const BODY_SNIPPET_TIMEOUT_MS = 9_000;
const BODY_SNIPPET_MAX_CHARS = 900;

function assertEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function toEtDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

function withTrailingSlashRemoved(value) {
  return value.replace(/\/+$/, "");
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const context = init?.context;
  if (!context) {
    throw new Error("Playwright request context is required.");
  }

  const requestOptions = {
    method: init?.method,
    headers: init?.headers,
    timeout: timeoutMs
  };
  if (init?.body !== undefined) {
    requestOptions.data = init.body;
  }
  return context.fetch(url, requestOptions);
}

async function fetchJson(url, init, timeoutMs) {
  const response = await fetchWithTimeout(url, init, timeoutMs);
  if (!response.ok()) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status()}) ${url}: ${body.slice(0, 300)}`);
  }
  return response.json();
}

async function fetchTextOrNull(url, init, timeoutMs) {
  try {
    const response = await fetchWithTimeout(url, init, timeoutMs);
    if (!response.ok()) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

function normalizeText(input) {
  return String(input ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(input) {
  return normalizeText(input).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
}

function htmlDecode(input) {
  return String(input ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_full, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_full, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();
}

function extractTag(input, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = String(input ?? "").match(regex);
  return htmlDecode(match?.[1] ?? "");
}

function parseRss(xml) {
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const output = [];
  let match = itemRegex.exec(xml);
  while (match) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const source = extractTag(block, "source") || "Unknown";
    const publishedAt = new Date(extractTag(block, "pubDate"));
    if (title && link && !Number.isNaN(publishedAt.getTime())) {
      output.push({ title, link, source, publishedAt });
    }
    match = itemRegex.exec(xml);
  }
  return output.sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());
}

function collectAliasCandidates(stock) {
  const entries = [
    stock?.symbol,
    stock?.name,
    stock?.displayName,
    stock?.codes,
    ...(Array.isArray(stock?.aliases) ? stock.aliases : [])
  ];

  const deduped = new Set();
  for (const raw of entries) {
    const text = normalizeText(raw);
    if (!text) {
      continue;
    }
    deduped.add(text);
    for (const part of text.split(/[\/,，]/g)) {
      const normalized = normalizeText(part);
      if (normalized) {
        deduped.add(normalized);
      }
    }
  }
  return [...deduped];
}

function buildRssEndpoints(stock) {
  const aliases = collectAliasCandidates(stock);
  const prioritized = [];
  if (normalizeText(stock?.symbol)) {
    prioritized.push(`${normalizeText(stock.symbol)} stock`);
  }
  if (normalizeText(stock?.name)) {
    prioritized.push(normalizeText(stock.name));
  }
  for (const alias of aliases) {
    if (prioritized.length >= MAX_SEARCH_REQUESTS_PER_STOCK) {
      break;
    }
    if (!prioritized.includes(alias)) {
      prioritized.push(alias);
    }
  }

  return prioritized.slice(0, MAX_SEARCH_REQUESTS_PER_STOCK).map((query) => {
    return `${RSS_ENDPOINT_PREFIX}${encodeURIComponent(query)}${RSS_ENDPOINT_SUFFIX}`;
  });
}

function isRelevantNews(item, stock) {
  const title = normalizeTitle(item.title);
  if (!title) {
    return false;
  }
  const aliases = collectAliasCandidates(stock)
    .map((entry) => entry.toLowerCase())
    .filter((entry) => entry.length > 1);
  return aliases.some((alias) => title.includes(normalizeTitle(alias)));
}

function dedupeNewsItems(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = `${item.symbol}|${normalizeTitle(item.title)}|${String(item.link).toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }
  return output;
}

function sanitizeParagraph(input) {
  return String(input ?? "")
    .replace(/^[>\s]+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateByChars(input, maxChars) {
  const normalized = sanitizeParagraph(input);
  const chars = Array.from(normalized);
  if (chars.length <= maxChars) {
    return normalized;
  }
  return `${chars.slice(0, maxChars).join("")}...`;
}

function stripHtmlTags(input) {
  return String(input ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
}

function extractMetaDescription(html) {
  const patterns = [
    /<meta[^>]+(?:name|property)\s*=\s*["'](?:description|og:description|twitter:description)["'][^>]+content\s*=\s*["']([\s\S]*?)["'][^>]*>/i,
    /<meta[^>]+content\s*=\s*["']([\s\S]*?)["'][^>]+(?:name|property)\s*=\s*["'](?:description|og:description|twitter:description)["'][^>]*>/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const content = sanitizeParagraph(htmlDecode(stripHtmlTags(match?.[1] ?? "")));
    if (content) {
      return content;
    }
  }
  return null;
}

function extractArticleText(html) {
  const match = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (!match) {
    return null;
  }
  const content = sanitizeParagraph(htmlDecode(stripHtmlTags(match[1])));
  return content || null;
}

function extractParagraphText(html) {
  const paragraphMatches = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  if (paragraphMatches.length === 0) {
    return null;
  }

  const joined = paragraphMatches
    .slice(0, 12)
    .map((match) => sanitizeParagraph(htmlDecode(stripHtmlTags(match[1]))))
    .filter((text) => text.length > 40)
    .slice(0, 6)
    .join(" ");

  return joined || null;
}

function isLowValueSnippet(input) {
  const normalized = String(input ?? "").toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized.length < 30) {
    return true;
  }
  if (normalized.includes("comprehensive up-to-date news coverage") && normalized.includes("google news")) {
    return true;
  }
  return false;
}

function extractReadabilityText(html, _sourceUrl) {
  try {
    const { document } = parseHTML(html);
    const parsed = new Readability(document).parse();
    const content = sanitizeParagraph(parsed?.textContent ?? "");
    return content || null;
  } catch {
    return null;
  }
}

function extractNewsBodySnippetFromHtml(html, maxChars, sourceUrl) {
  const readabilityText = extractReadabilityText(html, sourceUrl);
  if (readabilityText && !isLowValueSnippet(readabilityText)) {
    return truncateByChars(readabilityText, maxChars);
  }

  const metaDescription = extractMetaDescription(html);
  if (metaDescription && !isLowValueSnippet(metaDescription)) {
    return truncateByChars(metaDescription, maxChars);
  }

  const articleText = extractArticleText(html);
  if (articleText && !isLowValueSnippet(articleText)) {
    return truncateByChars(articleText, maxChars);
  }

  const paragraphText = extractParagraphText(html);
  if (paragraphText && !isLowValueSnippet(paragraphText)) {
    return truncateByChars(paragraphText, maxChars);
  }

  return null;
}

function isGoogleNewsHost(hostname) {
  const normalized = String(hostname ?? "").trim().toLowerCase();
  return normalized === "news.google.com" || normalized.endsWith(".news.google.com");
}

function isGoogleNewsUrl(url) {
  try {
    return isGoogleNewsHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function fetchNewsBodySnippetWithPlaywright(context, url, options) {
  const page = await context.newPage();
  const redirectTimeoutMs = Math.max(1000, Math.floor(options.timeoutMs / 2));
  const settleTimeoutMs = Math.max(600, Math.floor(options.timeoutMs / 3));

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs
    });

    if (isGoogleNewsUrl(page.url())) {
      await page
        .waitForURL((nextUrl) => !isGoogleNewsHost(nextUrl.hostname), {
          timeout: redirectTimeoutMs
        })
        .catch(() => undefined);
    }

    await page.waitForLoadState("domcontentloaded", { timeout: settleTimeoutMs }).catch(() => undefined);

    const finalUrl = page.url();
    if (isGoogleNewsUrl(finalUrl)) {
      return null;
    }

    return extractNewsBodySnippetFromHtml(await page.content(), options.maxChars, finalUrl);
  } catch {
    return null;
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const outputs = new Array(items.length);
  let cursor = 0;
  async function runWorker() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      outputs[current] = await worker(items[current], current);
    }
  }
  const runners = Array.from({ length: Math.max(1, concurrency) }, () => runWorker());
  await Promise.all(runners);
  return outputs;
}

async function crawlStockNews(stock, requestContext, browserContext) {
  const endpoints = buildRssEndpoints(stock);
  const rssBodies = await Promise.all(
    endpoints.map((endpoint) =>
      fetchTextOrNull(
        endpoint,
        {
          context: requestContext,
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; stocks-news-ci/1.0)"
          }
        },
        RSS_FETCH_TIMEOUT_MS
      )
    )
  );

  const parsed = rssBodies
    .flatMap((body) => (body ? parseRss(body) : []))
    .filter((item) => isRelevantNews(item, stock))
    .map((item) => ({
      symbol: String(stock.symbol).toUpperCase(),
      title: normalizeText(item.title),
      link: normalizeText(item.link),
      source: normalizeText(item.source) || "Unknown",
      publishedAt: item.publishedAt.toISOString()
    }))
    .filter((item) => item.title && item.link && item.source)
    .slice(0, MAX_NEWS_ITEMS_PER_STOCK);

  const deduped = dedupeNewsItems(parsed);
  if (deduped.length === 0 || !browserContext) {
    return deduped;
  }

  const enriched = [];
  for (let index = 0; index < deduped.length; index += 1) {
    const item = deduped[index];
    if (index >= BODY_SNIPPET_PER_STOCK_LIMIT) {
      enriched.push(item);
      continue;
    }

    const bodySnippet = await fetchNewsBodySnippetWithPlaywright(browserContext, item.link, {
      timeoutMs: BODY_SNIPPET_TIMEOUT_MS,
      maxChars: BODY_SNIPPET_MAX_CHARS
    });
    enriched.push(bodySnippet ? { ...item, bodySnippet } : item);
  }

  return enriched;
}

async function main() {
  const apiBaseUrl = withTrailingSlashRemoved(assertEnv("STOCKS_API_BASE_URL"));
  const adminToken = assertEnv("STOCKS_ADMIN_TOKEN");
  const requestContext = await playwrightRequest.newContext({
    userAgent: "Mozilla/5.0 (compatible; stocks-news-ci/1.0)"
  });
  const browser = await chromium.launch({
    headless: true
  });
  const browserContext = await browser.newContext({
    userAgent: "Mozilla/5.0 (compatible; stocks-news-ci/1.0)"
  });

  try {
    const stocksResponse = await fetchJson(
      `${apiBaseUrl}/api/v1/stocks/stocks`,
      {
        context: requestContext,
        headers: {
          accept: "application/json"
        }
      },
      STOCKS_FETCH_TIMEOUT_MS
    );
    const stocks = Array.isArray(stocksResponse?.items) ? stocksResponse.items : [];
    if (stocks.length === 0) {
      console.log("[stocks-news-ci] no stocks found, skip.");
      return;
    }

    console.log(`[stocks-news-ci] crawling ${stocks.length} stocks`);
    const crawledGroups = await mapWithConcurrency(stocks, STOCK_CONCURRENCY, (stock) =>
      crawlStockNews(stock, requestContext, browserContext)
    );
    const items = dedupeNewsItems(crawledGroups.flat());
    if (items.length === 0) {
      console.log("[stocks-news-ci] no news items collected, skip import.");
      return;
    }

    const importPayload = {
      reportDateEt: toEtDate(),
      items
    };

    const importResponse = await fetchJson(
      `${apiBaseUrl}/api/v1/stocks/news/admin/import`,
      {
        context: requestContext,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": adminToken
        },
        body: JSON.stringify(importPayload)
      },
      IMPORT_FETCH_TIMEOUT_MS
    );

    console.log(
      `[stocks-news-ci] imported runId=${importResponse.runId}, received=${importResponse.received}, inserted=${importResponse.inserted}, deduped=${importResponse.deduped}, skippedInvalid=${importResponse.skippedInvalid}`
    );
  } finally {
    await requestContext.dispose();
    await browserContext.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[stocks-news-ci] failed: ${message}`);
  process.exit(1);
});
