// Real browser acceptance checks. No remote data or synthetic measurements are used.
// Run from the repository root; TEST_PYTHON and TEST_BROWSER may select local runtimes.
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(root, "tests", "browser-"));
const db = path.join(temp, "demo.sqlite");
const screenshots = path.join(root, "output", "screenshots");
let server, browser, base, port, logs = "";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const number = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return number;
}
async function start() {
  logs = "";
  server = spawn(process.env.TEST_PYTHON || "python", ["run.py", "--no-browser", "--port", String(port)], {
    cwd: root, windowsHide: true, stdio: "pipe", env: { ...process.env, CHUVA_DB: db },
  });
  server.stdout.on("data", (d) => (logs += d));
  server.stderr.on("data", (d) => (logs += d));
  server.on("error", (e) => (logs += e.message));
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error("Server exited: " + logs);
    try {
      if ((await fetch(base + "/api/catalog", { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {}
    await pause(250);
  }
  throw Error("Server did not start: " + logs);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  await new Promise((resolve) => { server.once("exit", resolve); server.kill(); });
}
async function json(url) {
  const response = await fetch(base + url);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
function log(message) { console.log("PASS: " + message); }
async function main() {
  try {
    port = await freePort();
    base = `http://127.0.0.1:${port}`;
    await start();
    const catalog = await json("/api/catalog");
    assert.equal(catalog.stations.reduce((n, s) => n + s.samples, 0), 5852);
    assert.equal(catalog.stations.find((s) => s.kind === "river").samples, 1314);
    assert.equal(catalog.events.filter((e) => e.phase === "warm").length, 25);
    for (const phase of ["warm", "cold", "neutral"]) {
      assert.ok(catalog.events.some((e) => e.phase === phase && e.samples > 0), phase + " has real local observations");
    }
    assert.ok(catalog.indices.every((i) => ["warm", "cold", "neutral"].includes(i.phase)));
    log("fresh SQLite: 5,852 real observations and all three NOAA phases");
    await checkPhaseContract(catalog);
    browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER ? { executablePath: process.env.TEST_BROWSER } : {}) });
    const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, locale: "pt-BR" });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [], failed = [], external = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => {
      if (!request.failure()?.errorText.includes("ERR_ABORTED")) failed.push(request.url());
    });
    // All non-local traffic is blocked. The snapshot must be enough for the demo.
    await context.route(/^https?:\/\//, (route) => {
      if (new URL(route.request().url()).origin === base) return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    fs.mkdirSync(screenshots, { recursive: true });
    await page.goto(base);
    await page.locator("#tab-history").waitFor();
    await page.waitForFunction(() => document.querySelector("#tab-history")?.disabled === false);
    await runInterfaceChecks(page, catalog);
    await stop();
    await start();
    assert.deepEqual(await json("/api/catalog"), catalog);
    await page.reload();
    await page.locator("#tab-history").waitFor();
    log("refresh and process restart preserve the complete catalog");
    await page.goto(pathToFileURL(path.join(root, "static", "index.html")).href);
    assert.equal(await page.locator("#startup-help").isVisible(), true);
    assert.equal(await page.locator("main").isVisible(), false);
    assert.notEqual(await page.locator("header").evaluate((element) => getComputedStyle(element).fontFamily), "Times New Roman");
    log("file:// opening loads local styling and explains how to start the server");
    assert.deepEqual(errors, [], "unexpected JavaScript errors");
    assert.deepEqual(failed, [], "unexpected failed resource requests");
    assert.deepEqual(external, [], "the application must not need a CDN or live remote API");
    log("zero JavaScript errors or failed assets; all external network access blocked");
  } finally {
    if (browser) await browser.close();
    await stop();
    // Only remove this test's verified disposable directory, never the user's DB.
    assert.ok(temp.startsWith(path.join(root, "tests", "browser-")));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
async function checkPhaseContract(catalog) {
  assert.equal(catalog.events.length, 94);
  assert.equal(catalog.events.filter((e) => e.phase === "cold").length, 22);
  assert.equal(catalog.events.filter((e) => e.phase === "neutral").length, 47);
  const byPhase = {};
  for (const phase of ["all", "warm", "cold", "neutral"]) {
    const result = await json(`/api/series?station=power-ibirama&start=1998-01-01&end=1998-12-31&phase=${phase}`);
    byPhase[phase] = result;
    assert.equal(result.points.length, 12);
    assert.equal(result.valid + result.missing, result.expected);
    assert.ok(result.points.filter((p) => p.value !== null).every((p) => phase === "all" || p.phase === phase));
    assert.ok(result.points.filter((p) => p.excluded).every((p) => p.value === null && p.expected === 0));
  }
  assert.equal(byPhase.all.valid, 365);
  assert.equal(byPhase.cold.valid, 214);
  assert.equal(byPhase.neutral.valid, 31);
  assert.equal(byPhase.warm.valid + byPhase.cold.valid + byPhase.neutral.valid, byPhase.all.valid);
  const absent = await json("/api/series?station=ana-83440000&start=2023-01-01&end=2023-12-31");
  assert.equal(absent.valid, 0);
  assert.ok(absent.points.every((p) => p.value === null));
  const noCold = await json("/api/series?station=power-ibirama&start=2015-01-01&end=2015-12-31&phase=cold");
  assert.equal(noCold.expected, 0);
  assert.equal(noCold.coverage, null);
  assert.match(noCold.reason, /Nenhum dia/);
  const unknown = await json("/api/series?station=power-ibirama&start=2026-09-01&end=2026-10-18&phase=neutral");
  assert.equal(unknown.expected, 0);
  assert.equal(unknown.valid, 0);
  assert.equal(unknown.unclassified, 48);
  assert.ok(unknown.points.every((p) => p.unclassified && p.phase === null && p.value === null));
  const invalid = await fetch(base + "/api/series?station=power-ibirama&start=2015-02-01&end=2015-01-01");
  assert.equal(invalid.status, 422);
  log("phase filtering partitions 1998 correctly; missing river and unpublished ENSO months stay absent; invalid interval rejected");
}
async function runInterfaceChecks(page, catalog) {
  const settle = (id) => page.waitForFunction((id) => document.getElementById(id)?.getAttribute("aria-busy") === "false", id);
  const seriesResponse = (station = "power-ibirama", extra = () => true) => page.waitForResponse((r) => {
    const url = new URL(r.url());
    return url.pathname === "/api/series" && url.searchParams.get("station") === station && extra(url);
  });
  const historyChange = async (action, station = "power-ibirama", extra) => {
    const pending = seriesResponse(station, extra);
    await action();
    const response = await pending;
    assert.equal(response.status(), 200, await response.text());
    await settle("h-results");
    return response.json();
  };
  const compareChange = async (action, expected = 200) => {
    const pending = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/compare");
    await action();
    const response = await pending;
    assert.equal(response.status(), expected, await response.text());
    await settle("comparison-results");
    return response.json();
  };
  const date = async (id, value) => { await page.locator(id).fill(value); await page.locator(id).press("Tab"); };
  await page.locator("#overview-chart svg").waitFor();
  assert.equal(await page.getByRole("tab").count(), 4);
  assert.equal(await page.getByRole("tabpanel").count(), 1);
  assert.match(await page.locator("#overview-kpis").innerText(), /4[.\s]?538/);
  assert.match(await page.locator("#overview-kpis").innerText(), /1[.\s]?314/);
  await page.locator("#tab-overview").focus();
  await page.keyboard.press("ArrowRight");
  if (await page.locator("#tab-history").getAttribute("aria-selected") !== "true") await page.keyboard.press("Enter");
  await page.locator("#h-charts svg").first().waitFor();
  assert.equal(await page.locator("#tab-history").getAttribute("aria-selected"), "true");
  assert.equal(await page.locator("#panel-overview").isVisible(), false);
  assert.equal(await page.locator("#h-charts svg").count(), 2);
  log("four accessible tabs, keyboard navigation and real overview/history charts");

  const whole = await historyChange(() => page.locator("#h-year").selectOption("1998"));
  assert.equal(whole.valid, 365);
  const fullChart = await page.locator("#h-charts svg").first().innerHTML();
  const cold = await historyChange(() => page.locator("#h-phase").selectOption("cold"));
  assert.equal(cold.valid, 214);
  assert.notEqual(await page.locator("#h-charts svg").first().innerHTML(), fullChart);
  const warm = await historyChange(() => page.locator("#h-phase").selectOption("warm"));
  const neutral = await historyChange(() => page.locator("#h-phase").selectOption("neutral"));
  assert.equal(neutral.valid, 31);
  assert.equal(warm.valid + cold.valid + neutral.valid, whole.valid);
  const otherStation = await historyChange(() => page.locator("#h-rain").selectOption("power-presidente"), "power-presidente");
  assert.equal(otherStation.station.id, "power-presidente");
  assert.match(await page.locator("#h-charts").innerText(), /Presidente Getúlio/);
  await historyChange(() => page.locator("#h-rain").selectOption("power-ibirama"));
  await historyChange(() => page.locator("#h-phase").selectOption("all"));
  const daily = await historyChange(() => page.locator("#h-resolution").selectOption("daily"));
  assert.equal(daily.points.length, 365);
  assert.ok(await page.locator("#h-charts circle").count() > 300);
  log("year, all ENSO phases, station and daily/monthly filters update the data and charts");

  // Check that changing mode does not quietly discard the selected calendar year.
  await historyChange(() => page.locator("#h-mode").selectOption("custom"));
  assert.equal(await page.locator("#h-start").inputValue(), "1998-01-01");
  assert.equal(await page.locator("#h-end").inputValue(), "1998-12-31");
  await date("#h-end", "2015-02-15");
  const custom = await historyChange(() => date("#h-start", "2015-01-15"));
  assert.equal(custom.expected, 32);
  assert.equal(custom.valid, 32);
  assert.equal(custom.start, "2015-01-15");
  assert.equal(custom.end, "2015-02-15");
  await date("#h-end", "2015-01-01");
  await page.waitForFunction(() => document.getElementById("h-status").textContent.length > 0 && !document.getElementById("h-status").textContent.includes("Consultando"));
  assert.equal(await page.locator("#h-download").isDisabled(), true);
  await historyChange(() => date("#h-end", "2015-02-15"));
  await historyChange(() => page.locator("#h-phase").selectOption("cold"));
  assert.match(await page.locator("#h-charts").innerText(), /Nenhum dia|Sem (dados|medições)|Nenhuma medição/);
  await historyChange(() => page.locator("#h-reset").click());
  const absentRiver = await historyChange(() => page.locator("#h-year").selectOption("2023"));
  assert.ok(absentRiver.valid > 0);
  assert.equal(await page.locator("#h-charts svg").count(), 1);
  assert.match(await page.locator("#h-charts").innerText(), /Sem (dados|medições)|Nenhuma medição/);
  await historyChange(() => page.locator("#h-reset").click());
  log("year-to-custom keeps dates; exact inclusive interval, invalid dates, absent phase and missing river have explicit states");

  await checkChartInteraction(page, "#h-charts");
  const historyCsv = await downloadCsv(page, "#h-download", "historico.csv");
  assert.match(historyCsv, /NASA POWER/);
  assert.match(historyCsv, /ANA/);
  assert.match(historyCsv, /"mm"/);
  assert.match(historyCsv, /"m"/);
  assert.match(historyCsv, /fase/i);
  assert.equal(historyCsv.trimEnd().split(/\r?\n/).length - 1, await page.locator("#h-values tr").count());
  log("keyboard/pointer chart readings and historical CSV with actual source, unit, phase and row count");

  let comparison = await compareChange(() => page.locator("#tab-comparison").click());
  assert.equal(comparison.series.length, 2);
  assert.deepEqual(new Set(comparison.series.map((s) => s.window_phase)), new Set(["warm", "cold"]));
  await page.locator("#event-phase").selectOption("neutral");
  const neutralEvent = catalog.events.find((e) => e.phase === "neutral" && e.start === "2016-05-01");
  await page.locator("#event-select").selectOption(neutralEvent.id);
  comparison = await compareChange(() => page.locator("#add-period").click());
  assert.equal(comparison.series.length, 3);
  assert.deepEqual(new Set(comparison.series.map((s) => s.window_phase)), new Set(["warm", "cold", "neutral"]));
  assert.equal(await page.locator("#selection-summary [data-remove]").count(), 3);
  if (await page.locator("#add-period").isEnabled()) await page.locator("#add-period").click();
  assert.equal(await page.locator("#selection-summary [data-remove]").count(), 3);
  comparison = await compareChange(() => page.locator("#variables").selectOption("both"));
  assert.equal(comparison.series.length, 6);
  assert.equal(await page.locator("#charts svg").count(), 2);
  assert.ok(comparison.series.filter((s) => s.station.kind === "river").every((s) => s.unit === "m"));
  assert.match(await page.locator("#panel-comparison").innerText(), /não é causalidade/);
  const original = await compareChange(() => page.locator("#common").uncheck());
  assert.ok(new Set(original.series.map((s) => s.points.length)).size > 1);
  await compareChange(() => page.locator("#common").check());
  await checkChartInteraction(page, "#charts");
  const comparisonCsv = await downloadCsv(page, "#download", "comparacao.csv");
  assert.equal(comparisonCsv.trimEnd().split(/\r?\n/).length - 1, await page.locator("#values tr").count());
  assert.match(comparisonCsv, /La Niña/);
  assert.match(comparisonCsv, /Neutro/);
  log("three-phase comparison, limit of three, common/original duration, separate rain/river units and complete CSV");

  // Period builder: compare arbitrary calendar years and custom date windows.
  while (await page.locator("#selection-summary [data-remove]").count()) {
    const count = await page.locator("#selection-summary [data-remove]").count();
    if (count > 1) await compareChange(() => page.locator("#selection-summary [data-remove]").first().click());
    else await page.locator("#selection-summary [data-remove]").first().click();
  }
  assert.equal(await page.locator("#download").isDisabled(), true);
  await page.locator("#period-kind").selectOption("year");
  await page.locator("#compare-year").selectOption("2015");
  comparison = await compareChange(() => page.locator("#add-period").click());
  assert.ok(comparison.series.every((s) => s.start === "2015-01-01" && s.end === "2015-12-31"));
  await page.locator("#period-kind").selectOption("custom");
  await date("#current-start", "1998-06-01");
  await date("#current-end", "1998-12-31");
  comparison = await compareChange(() => page.locator("#add-period").click());
  assert.equal(comparison.series.length, 4);
  assert.ok(comparison.series.some((s) => s.start === "1998-06-01"));
  await compareChange(() => page.locator("#preset-enso").click());
  log("remove-to-empty, year selection, custom periods and restore ENSO comparison");
  for (const target of ["history", "comparison", "methodology"]) {
    await page.locator("#tab-overview").click();
    await page.locator(`[data-go="${target}"]`).click();
    assert.equal(await page.locator("#tab-" + target).getAttribute("aria-selected"), "true");
  }
  await page.locator("#tab-overview").click();
  await historyChange(() => page.locator("#open-recent").click());
  assert.equal(await page.locator("#h-mode").inputValue(), "custom");
  assert.equal(await page.locator("#h-start").inputValue(), "2026-01-01");
  assert.equal(await page.locator("#h-end").inputValue(), "2026-10-18");
  await historyChange(() => page.locator("#h-reset").click());
  log("overview shortcuts open the intended tab and latest historical year");
  await checkResilience(page, historyChange, settle);
  await checkLayouts(page);
}

async function downloadCsv(page, selector, filename) {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  const download = await pending;
  assert.match(download.suggestedFilename(), /\.csv$/);
  const destination = path.join(temp, filename);
  await download.saveAs(destination);
  return fs.readFileSync(destination, "utf8");
}

async function checkChartInteraction(page, container) {
  const chart = page.locator(container + " .chart").first();
  const cursor = chart.locator(".chart-cursor");
  const readout = chart.locator(".chart-readout");
  await cursor.focus();
  const before = await readout.innerText();
  await cursor.press("ArrowRight");
  assert.notEqual(await readout.innerText(), before);
  assert.match(await readout.innerText(), /mm|m\b/);
  const keyboardReading = await readout.innerText();
  const bounds = await chart.locator("svg").boundingBox();
  await chart.locator("svg").hover({ position: { x: bounds.width * .08, y: Math.min(110, bounds.height / 2) } });
  await page.waitForFunction(({ selector, before }) => document.querySelector(selector)?.innerText !== before, { selector: container + " .chart .chart-readout", before: keyboardReading });
  assert.notEqual(await readout.innerText(), keyboardReading);
}

async function checkResilience(page, historyChange, settle) {
  await page.locator("#tab-history").click();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const delay = async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("start") === "1997-01-01") await held;
    await route.continue();
  };
  await page.route("**/api/series?**", delay);
  const cancelledRequest = page.waitForEvent("requestfailed", { predicate: (r) => r.url().includes("/api/series?") && new URL(r.url()).searchParams.get("start") === "1997-01-01" });
  await page.locator("#h-year").selectOption("1997");
  await page.waitForFunction(() => document.getElementById("h-results").getAttribute("aria-busy") === "true");
  assert.equal(await page.locator("#h-download").isDisabled(), true);
  await historyChange(() => page.locator("#h-year").selectOption("2016"));
  const latest = await page.locator("#h-charts").innerHTML();
  release();
  assert.match((await cancelledRequest).failure().errorText, /ERR_ABORTED/);
  await pause(150);
  assert.equal(await page.locator("#h-year").inputValue(), "2016");
  assert.equal(await page.locator("#h-charts").innerHTML(), latest, "stale result must not overwrite latest filter selection");
  await page.unroute("**/api/series?**", delay);
  const fail = (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Falha controlada de QA: tente novamente." }) });
  await page.route("**/api/series?**", fail);
  await page.locator("#h-year").selectOption("2015");
  await settle("h-results");
  await page.waitForFunction(() => document.getElementById("h-status").textContent.includes("Falha controlada de QA"));
  assert.equal(await page.locator("#h-download").isDisabled(), true);
  await page.unroute("**/api/series?**", fail);
  await historyChange(() => page.locator("#h-reset").click());
  assert.equal(await page.locator("#h-charts svg").count(), 2);
  log("visible loading, disabled stale download, out-of-order responses ignored, API error displayed and recovery works");
}

async function checkLayouts(page) {
  const names = { overview: "dashboard", history: "historico", comparison: "comparacao", methodology: "metodologia" };
  for (const width of [1366, 768, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [tab, filename] of Object.entries(names)) {
      await page.locator("#tab-" + tab).click();
      await page.waitForFunction(() => !document.querySelector('.tab-panel:not([hidden]) [aria-busy="true"]'));
      assert.equal(await page.getByRole("tabpanel").count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `page overflow at ${width}, ${tab}`);
      await page.screenshot({ path: path.join(screenshots, `${filename}-${width}.png`), fullPage: true });
      for (const summary of await page.locator(`#panel-${tab} details summary`).all()) {
        await summary.click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `expanded table overflow at ${width}, ${tab}`);
        await summary.click();
      }
    }
  }
  assert.match(await page.locator("#sources").innerText(), /NOAA/);
  assert.match(await page.locator("#sources").innerText(), /NASA/);
  assert.match(await page.locator("#sources").innerText(), /ANA/);
  log("all four tabs at 1366/768/360 px, including expanded tables, have no horizontal page overflow; screenshots saved");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
