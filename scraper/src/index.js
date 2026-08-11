const fs = require("fs");
const path = require("path");

const URL = "https://books.toscrape.com/";
const CACHE_DIR = path.join(__dirname, "..", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "catalogue-page-1.html");

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  if (fs.existsSync(CACHE_FILE)) {
    const size = fs.statSync(CACHE_FILE).size;
    console.log(`CACHE HIT - ${size} bytes`);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    console.log("FETCH");

    const response = await fetch(URL, {
      headers: {
        "User-Agent": "FlyRankInternship-A9/1.0 (+https://github.com/MOHAMED-556322/task-api-js)"
      },
      signal: controller.signal
    });

    if (response.status !== 200) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const html = await response.text();

    fs.writeFileSync(CACHE_FILE, html);

    console.log(`FETCHED - ${Buffer.byteLength(html, "utf8")} bytes`);
  } finally {
    clearTimeout(timeout);
  }
}
main();