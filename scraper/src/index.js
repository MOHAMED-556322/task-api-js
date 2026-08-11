const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE_URL = "https://books.toscrape.com/";
const CACHE_DIR = path.join(__dirname, "..", "cache");

function getCacheFile(pageNumber) {
  return path.join(
    CACHE_DIR,
    `catalogue-page-${pageNumber}.html`
  );
}

function extractBookUrls(html, pageUrl) {
  const $ = cheerio.load(html);
  const urls = [];

  $(".product_pod h3 a").each((_, element) => {
    const href = $(element).attr("href");

    if (href) {
      urls.push(new URL(href, pageUrl).href);
    }
  });

  return urls;
}

function getNextUrl(html, pageUrl) {
  const $ = cheerio.load(html);
  const nextHref = $(".next a").attr("href");

  if (!nextHref) {
    return null;
  }

  return new URL(nextHref, pageUrl).href;
}

async function fetchPage(url, cacheFile) {
  if (fs.existsSync(cacheFile)) {
    const html = fs.readFileSync(cacheFile, "utf8");

    console.log(
      `CACHE HIT: ${path.basename(cacheFile)}`
    );

    return html;
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    console.log(`FETCH: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "FlyRankInternship-A9/1.0 (+https://github.com/MOHAMED-556322/task-api-js)",
      },
      signal: controller.signal,
    });

    if (response.status !== 200) {
      throw new Error(
        `Fetch failed with status ${response.status}`
      );
    }

    const html = await response.text();

    fs.writeFileSync(cacheFile, html);

    console.log(
      `SAVED: ${path.basename(cacheFile)} - ${Buffer.byteLength(
        html,
        "utf8"
      )} bytes`
    );

    return html;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const allBookUrls = new Set();

  let currentUrl = BASE_URL;
  let cataloguePages = 0;

  while (cataloguePages < 3 && currentUrl) {
    cataloguePages++;

    const cacheFile = getCacheFile(cataloguePages);

    const html = await fetchPage(
      currentUrl,
      cacheFile
    );

    const bookUrls = extractBookUrls(
      html,
      currentUrl
    );

    console.log(
      `Page ${cataloguePages}: ${bookUrls.length} books`
    );

    for (const bookUrl of bookUrls) {
      allBookUrls.add(bookUrl);
    }

    if (cataloguePages < 3) {
      const nextUrl = getNextUrl(
        html,
        currentUrl
      );

      console.log(
        `Next URL: ${nextUrl}`
      );

      currentUrl = nextUrl;

      if (currentUrl) {
        await sleep(1000);
      }
    } else {
      currentUrl = null;
    }
  }

  console.log(
    `catalogue_pages=${cataloguePages}`
  );

  console.log(
    `discovered=${allBookUrls.size}`
  );

  console.log(
    `unique_urls=${allBookUrls.size}`
  );
}

main().catch((error) => {
  console.error("ERROR:", error.message);
  process.exitCode = 1;
});