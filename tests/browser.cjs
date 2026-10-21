// End-to-end checks use a fresh SQLite snapshot and a disposable Chromium profile.
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");
const base = "http://127.0.0.1:8765";
const temp = fs.mkdtempSync(path.resolve("tests/browser-"));
const db = path.join(temp, "demo.sqlite");
let server,
  browser,
  logs = "";
async function start() {
  server = spawn(
    process.env.TEST_PYTHON || "python",
    ["run.py", "--no-browser", "--port", "8765"],
    { stdio: "pipe", env: { ...process.env, CHUVA_DB: db } },
  );
  server.stdout.on("data", (d) => (logs += d));
  server.stderr.on("data", (d) => (logs += d));
  server.on("error", (e) => (logs += e.message));
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/api/catalog")).ok) return;
    } catch {}
    if (server.exitCode !== null) throw Error("Server exited: " + logs);
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("Server did not start: " + logs);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  await new Promise((resolve) => {
    server.once("exit", resolve);
    server.kill();
  });
}
async function main() {
  try {
    await start();
    const catalog = await (await fetch(base + "/api/catalog")).json();
    assert.equal(catalog.events.length, 25);
    assert.equal(
      catalog.stations.reduce((n, s) => n + s.samples, 0),
      5852,
    );
    assert.equal(
      catalog.stations.find((s) => s.kind === "river").samples,
      1314,
    );
    browser = await chromium.launch({
      headless: true,
      ...(process.env.TEST_BROWSER
        ? { executablePath: process.env.TEST_BROWSER }
        : {}),
    });
    const page = await browser.newPage();
    const errors = [],
      failed = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("requestfailed", (r) => {
      if (!r.failure()?.errorText.includes("ERR_ABORTED")) failed.push(r.url());
    });
    // Presentation must remain usable without third-party APIs, fonts or CDNs.
    await page.route("https://**/*", (route) => route.abort());
    fs.mkdirSync("output/screenshots", { recursive: true });
    const waitMetrics = (n) =>
      page.waitForFunction(
        (n) => document.querySelectorAll(".metric").length === n,
        n,
      );
    const change = async (action) => {
      const response = page.waitForResponse((r) =>
        r.url().includes("/api/compare?"),
      );
      await action();
      const result = await response;
      await page.waitForFunction(
        () =>
          !document
            .querySelector("#status")
            .textContent.includes("Consultando"),
      );
      assert.equal(result.status(), 200, await result.text());
      return result.json();
    };
    for (const width of [1366, 768, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base);
      await page.waitForSelector(".chart svg");
      await waitMetrics(2);
      assert.equal(
        await page.evaluate(
          () => getComputedStyle(document.querySelector(".hero")).display,
        ),
        "grid",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `overflow at ${width}`,
      );
      assert.equal(await page.locator(".chart .legend span").count(), 2);
      await page.screenshot({
        path: `output/screenshots/${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1366, height: 1000 });
    // Actual controls and response content, not only the existence of an SVG.
    const monthly = await change(() =>
      page.locator("#rain").selectOption("power-presidente"),
    );
    assert.ok(monthly.series.every((s) => s.station.id === "power-presidente"));
    assert.match(
      await page.locator(".chart").innerText(),
      /Presidente Getúlio/,
    );
    const daily = await change(() =>
      page.locator("#resolution").selectOption("daily"),
    );
    assert.ok(daily.series[0].points.length > monthly.series[0].points.length);
    assert.ok((await page.locator(".chart circle").count()) > 100);
    const original = await change(() => page.locator("#common").uncheck());
    assert.notEqual(
      original.series[0].points.length,
      original.series[1].points.length,
    );
    await change(() => page.locator("#common").check());
    await change(() => page.locator("#resolution").selectOption("monthly"));
    const current = await change(() => page.locator("#current").click());
    await waitMetrics(3);
    assert.equal(current.cutoffs["power-presidente"], "2026-10-18");
    assert.match(await page.locator("#alignment").innerText(), /2026-10-18/);
    const download = page.waitForEvent("download");
    await page.locator("#download").click();
    const csv = await download;
    assert.equal(csv.suggestedFilename(), "chuva-x-rio-comparacao.csv");
    const csvPath = path.join(temp, "export.csv");
    await csv.saveAs(csvPath);
    const contents = fs.readFileSync(csvPath, "utf8");
    assert.match(contents, /NASA POWER/);
    assert.match(contents, /"mm"/);
    assert.equal(
      contents.split("\r\n").length,
      1 + current.series.reduce((n, s) => n + s.points.length, 0),
    );
    await change(() => page.locator("#current").click());
    const events = catalog.events.filter((e) => e.samples);
    const event97 = events.find((e) => e.start.startsWith("1997"));
    const event14 = events.find((e) => e.start.startsWith("2014"));
    const event23 = events.find((e) => e.start.startsWith("2023"));
    await change(() => page.locator(`[data-event="${event23.id}"]`).click());
    await change(() => page.locator(`[data-event="${event97.id}"]`).click());
    await change(() => page.locator("#rain").selectOption("power-ibirama"));
    const both = await change(() =>
      page.locator("#variables").selectOption("both"),
    );
    await waitMetrics(4);
    assert.equal(await page.locator(".chart svg").count(), 2);
    assert.ok(
      both.series
        .filter((s) => s.station.kind === "river")
        .every((s) => s.valid > 0 && s.unit === "m"),
    );
    assert.match(await page.locator("#sources").innerText(), /83440000/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "output/screenshots/dashboard.png",
      fullPage: true,
    });
    await page
      .locator("#analysis")
      .screenshot({ path: "output/screenshots/comparacao.png" });
    await change(() => page.locator("#variables").selectOption("river"));
    await change(() => page.locator(`[data-event="${event14.id}"]`).click());
    // All series absent produces an explicit empty state.
    await change(() => page.locator(`[data-event="${event23.id}"]`).click());
    await change(() => page.locator(`[data-event="${event97.id}"]`).click());
    assert.match(await page.locator(".empty").innerText(), /Sem medições/);
    // Current joint cutoff cannot be invented when river data are missing.
    await change(() => page.locator("#variables").selectOption("both"));
    await change(() => page.locator("#current").click());
    assert.match(
      await page.locator(".empty").innerText(),
      /Sem cobertura atual/,
    );
    await change(() => page.locator("#current").click());
    // Custom date interval, independently of official episode boundaries.
    await page.locator(`[data-event="${event23.id}"]`).click();
    await page.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.includes("Selecione um período"),
    );
    await page.locator("#current-start").fill("2015-01-15");
    await page.locator("#current-end").fill("2015-02-15");
    await page.locator("#resolution").selectOption("daily");
    const custom = await change(() => page.locator("#custom").click());
    assert.equal(custom.series[0].expected, 32);
    assert.equal(custom.series[0].start, "2015-01-15");
    assert.ok(custom.series.every((s) => s.valid === 32));
    // Browser refresh and process restart both retain the persistent dataset.
    await page.reload();
    await page.waitForSelector(".chart svg");
    await waitMetrics(2);
    await stop();
    await start();
    assert.deepEqual(
      await (await fetch(base + "/api/catalog")).json(),
      catalog,
    );
    await page.reload();
    await page.waitForSelector(".chart svg");
    // Reproduce the original file:// problem: CSS now loads and startup guidance is visible.
    await page.goto(pathToFileURL(path.resolve("static/index.html")).href);
    assert.equal(await page.locator("#startup-help").isVisible(), true);
    assert.equal(await page.locator("main").isVisible(), false);
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.querySelector("header")).display,
      ),
      "flex",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(
      "PASS: fresh database 5852 records; restart persistence; CSS/file guidance; 1366/768/360; event selection; monthly/daily; station filter; common/full windows; current cutoff; real ANA charts; missing data; custom dates; CSV contents; refresh; zero JS/resource errors.",
    );
  } finally {
    if (browser) await browser.close();
    await stop();
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
