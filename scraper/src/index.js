const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { z } = require("zod");

const BASE_URL = "https://books.toscrape.com/";
const CACHE_DIR = path.join(__dirname, "..", "cache");
const OUTPUT_DIR = path.join(__dirname, "..", "output");

function getBookCacheFile(bookUrl) {
  const safeName = encodeURIComponent(bookUrl);
  return path.join(
    CACHE_DIR,
    `book-${safeName}.html`
  );
}
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

// ----------------------------------------
// Fetch book page with retry
// ----------------------------------------

async function fetchBookPage(url, retries = 1) {
  const cacheFile = getBookCacheFile(url);

  if (fs.existsSync(cacheFile)) {
    console.log(
      `BOOK CACHE HIT: ${path.basename(cacheFile)}`
    );

    return fs.readFileSync(cacheFile, "utf8");
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 5000);

    try {
      console.log(
        `FETCH BOOK: ${url} (attempt ${attempt + 1}/${retries + 1})`
      );

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "FlyRankInternship-A9/1.0 (+https://github.com/MOHAMED-556322/task-api-js)",
        },
        signal: controller.signal,
      });

      if (response.status === 404) {
        throw new Error(
          "Book fetch failed with status 404"
        );
      }

      if (response.status === 403) {
        throw new Error(
          "Book fetch failed with status 403"
        );
      }

      if (
        response.status >= 500 &&
        response.status <= 599
      ) {
        throw new Error(
          `Book fetch failed with status ${response.status}`
        );
      }

      if (response.status !== 200) {
        throw new Error(
          `Book fetch failed with status ${response.status}`
        );
      }

      const html = await response.text();

      fs.writeFileSync(
        cacheFile,
        html,
        "utf8"
      );

      console.log(
        `BOOK SAVED: ${path.basename(cacheFile)}`
      );

      return html;
    } catch (error) {
      const isTimeout =
        error.name === "AbortError";

      const isServerError =
        error.message.includes("status 5");

      const shouldRetry =
        (isTimeout || isServerError) &&
        attempt < retries;

      console.error(
        `BOOK ATTEMPT FAILED: ${url}`
      );

      console.error(
        `Reason: ${error.message}`
      );

      if (!shouldRetry) {
        throw error;
      }

      console.log("Retrying...");

      await sleep(1000);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractBookData(
  html,
  productUrl,
  sourcePage
) {
  const $ = cheerio.load(html);

  const title = $("h1")
    .text()
    .trim();

  const priceText = $(".price_color")
    .first()
    .text()
    .trim();

  const availabilityText = $(".availability")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const ratingClass = $(".star-rating")
    .first()
    .attr("class");

  let ratingText = null;

  if (ratingClass) {
    const parts = ratingClass.split(/\s+/);

    if (parts.length > 1) {
      ratingText = parts[1];
    }
  }

  const description =
    $("#product_description")
      .next("p")
      .text()
      .trim() || null;

  return {
    title,
    product_url: productUrl,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: new Date().toISOString(),
  };
}

// ----------------------------------------
// Zod schema
// ----------------------------------------

const bookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_text: z.string().min(1),
  price_gbp: z.number().nonnegative(),
  availability_text: z.string().min(1),
  rating_text: z.string().nullable(),
  description: z.string().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string().datetime(),
});

function normalizeBook(book) {
  const price_gbp = Number(
    book.price_text
      .replace("£", "")
      .trim()
  );

  return {
    ...book,
    price_gbp,
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const runStartedAt = new Date();

  fs.mkdirSync(CACHE_DIR, {
    recursive: true,
  });

  fs.mkdirSync(OUTPUT_DIR, {
    recursive: true,
  });

  // ----------------------------------------
  // Discover book URLs
  // ----------------------------------------

  const allBookUrls = new Map();

  let currentUrl = BASE_URL;
  let cataloguePages = 0;
  let cacheHits = 0;

  while (cataloguePages < 3 && currentUrl) {
    cataloguePages++;

    const cacheFile =
      getCacheFile(cataloguePages);

    if (fs.existsSync(cacheFile)) {
      cacheHits++;
    }

    const html = await fetchPage(
      currentUrl,
      cacheFile
    );

    const bookUrls =
      extractBookUrls(
        html,
        currentUrl
      );

    console.log(
      `Page ${cataloguePages}: ${bookUrls.length} books`
    );

    const sourcePage =
  currentUrl === BASE_URL
    ? "https://books.toscrape.com/catalogue/page-1.html"
    : currentUrl;

for (const bookUrl of bookUrls) {
  allBookUrls.set(
    bookUrl,
    sourcePage
  );
}

    if (cataloguePages < 3) {
      const nextUrl =
        getNextUrl(
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

  // ----------------------------------------
  // Extract book records
  // ----------------------------------------

  const books = [];
  const failedUrls = [];

  let detailPages = 0;

  // Intentional broken URL test
  const testBrokenUrl =
    "https://books.toscrape.com/catalogue/this-book-does-not-exist_999999/index.html";

  try {
    await fetchBookPage(
      testBrokenUrl,
      1
    );
  } catch (error) {
    console.log(
      "EXPECTED BROKEN URL FAILURE"
    );

    failedUrls.push({
      product_url: testBrokenUrl,
      error: error.message,
    });
  }

  for (const [
    bookUrl,
    sourcePage,
  ] of allBookUrls) {
    try {
      const bookHtml =
        await fetchBookPage(
          bookUrl
        );

      const bookData =
        extractBookData(
          bookHtml,
          bookUrl,
          sourcePage
        );

      books.push(bookData);

      detailPages++;

      console.log(
        `Book ${detailPages}/${allBookUrls.size}: ${bookData.title}`
      );

      if (
        detailPages <
        allBookUrls.size
      ) {
        await sleep(1000);
      }
    } catch (error) {
      console.error(
        `FAILED BOOK: ${bookUrl}`
      );

      console.error(
        `Reason: ${error.message}`
      );

      failedUrls.push({
        product_url: bookUrl,
        error: error.message,
      });
    }
  }

  console.log(
    `detail_pages=${detailPages}`
  );

  // ----------------------------------------
  // Normalize + Validate
  // ----------------------------------------

  const validBooks = [];
  const errors = [];

  for (const book of books) {
    const normalizedBook =
      normalizeBook(book);

    const result =
      bookSchema.safeParse(
        normalizedBook
      );

    if (result.success) {
      validBooks.push(
        result.data
      );
    } else {
      errors.push({
        product_url:
          book.product_url,
        error:
          result.error.issues,
        record: book,
      });
    }
  }

  // ----------------------------------------
  // Save output
  // ----------------------------------------

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      "books.json"
    ),
    JSON.stringify(
      validBooks,
      null,
      2
    ),
    "utf8"
  );

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      "errors.json"
    ),
    JSON.stringify(
      errors,
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `valid_records=${validBooks.length}`
  );

  console.log(
    `invalid_records=${errors.length}`
  );

  // ----------------------------------------
  // Run report
  // ----------------------------------------

  const runFinishedAt =new Date();

  const durationMs =
    runFinishedAt.getTime() -
    runStartedAt.getTime();

const runReport = {
  started_at: runStartedAt.toISOString(),

  finished_at: runFinishedAt.toISOString(),

  duration_ms: durationMs,

  pages_fetched:
    cataloguePages + detailPages,

  catalogue_pages:
    cataloguePages,

  detail_pages:
    detailPages,

  discovered:
    allBookUrls.size,

  unique_urls:
    allBookUrls.size,

  cache_hits:
    cacheHits,

  valid_records:
    validBooks.length,

  invalid_records:
    errors.length,

  failed_pages:
    failedUrls.length,

  failed_urls:
    failedUrls,
};

fs.writeFileSync(
  path.join(
    OUTPUT_DIR,
    "run-report.json"
  ),
  JSON.stringify(
    runReport,
    null,
    2
  ),
  "utf8"
);

console.log("run-report.json saved");

  if (validBooks.length > 0) {
    console.log(
      "First normalized record:"
    );

    console.log(
      validBooks[0]
    );
  }
}

main().catch((error) => {
  console.error(
    "ERROR:",
    error.message
  );

  process.exitCode = 1;
});