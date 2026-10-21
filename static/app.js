"use strict";
const $ = (id) => document.getElementById(id);
const colors = ["#087f79", "#2865c5", "#a46021"];
const selected = new Set();
let catalog,
  displayed = [],
  generation = 0;
const fmt = (n) =>
  n == null
    ? "Sem dado"
    : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const collected = (s) =>
  s
    ? new Date(s).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }) + " (Brasília)"
    : "indisponível";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function api(url) {
  const r = await fetch(url);
  if (!(r.headers.get("content-type") || "").includes("application/json"))
    throw new Error(
      "API indisponível. Inicie com python run.py e abra http://127.0.0.1:8000/.",
    );
  const body = await r.json();
  if (!r.ok)
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : "Revise os filtros e as datas.",
    );
  return body;
}
function status(message, error = false) {
  $("status").textContent = message;
  $("status").className = error ? "error" : "";
}
function toggle(id) {
  if (selected.has(id)) selected.delete(id);
  else if (selected.size < 3) selected.add(id);
  else {
    status(
      "Selecione no máximo três períodos. Remova um antes de adicionar outro.",
      true,
    );
    return;
  }
  document
    .querySelectorAll("[data-event]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", selected.has(b.dataset.event)),
    );
  $("current").setAttribute("aria-pressed", selected.has("current"));
  $("custom").setAttribute("aria-pressed", selected.has("custom"));
  refresh();
}
function eventButton(e) {
  const b = document.createElement("button");
  b.dataset.event = e.id;
  b.setAttribute("aria-pressed", selected.has(e.id));
  b.innerHTML = `${esc(e.start.slice(0, 4))} — ${esc(e.end.slice(0, 4))}<span>${esc(e.start.slice(5, 7))}/${e.start.slice(0, 4)} a ${e.end.slice(5, 7)}/${e.end.slice(0, 4)}</span><span>${e.samples ? "Série local disponível" : "Sem série local carregada"}</span>`;
  b.onclick = () => toggle(e.id);
  return b;
}
async function init() {
  try {
    catalog = await api("./api/catalog");
    $("overview").innerHTML =
      `<span>Calendário NOAA <b>${catalog.events.length} episódios</b></span><span>Precipitação real <b>${fmt(catalog.stations.filter((s) => s.kind === "grid").reduce((n, s) => n + s.samples, 0))} medições</b></span><span>Nível real · ANA <b>${fmt(catalog.stations.filter((s) => s.kind === "river").reduce((n, s) => n + s.samples, 0))} medições</b></span>`;
    const available = catalog.events.filter((e) => e.samples);
    available.slice(-2).forEach((e) => selected.add(e.id));
    if (!selected.size && catalog.events.length)
      selected.add(catalog.events.at(-1).id);
    catalog.events.forEach((e) =>
      $(e.samples ? "timeline" : "older").append(eventButton(e)),
    );
    const active = $("timeline").querySelector("[aria-pressed=true]");
    if (active)
      $("timeline").scrollLeft = active.offsetLeft - $("timeline").offsetLeft;
    if (!catalog.events.length)
      $("timeline").textContent =
        "Calendário indisponível. Execute a carga NOAA.";
    catalog.stations
      .filter((s) => s.kind === "grid")
      .forEach((s) => $("rain").add(new Option(s.name, s.id)));
    const rivers = catalog.stations.filter((s) => s.kind === "river");
    if (rivers.length) {
      $("river").innerHTML = "";
      rivers.forEach((s) => $("river").add(new Option(s.name, s.id)));
    }
    const last = catalog.indices.at(-1);
    $("enso-note").textContent = last
      ? `Última temporada disponível: mês central ${last.date.slice(0, 7)} · RONI ${fmt(last.value)} °C. Fonte: ERSSTv6. Não inferimos novos episódios a partir do valor do índice.`
      : "Índices ENSO ainda não carregados.";
    $("sources").innerHTML =
      `<article><h3>01 · Referência climática</h3><p>NOAA/CPC · RONI ERSSTv6. Os episódios reproduzem as marcações da tabela oficial; início e fim usam os meses centrais das temporadas.</p><a href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/" target="_blank" rel="noreferrer">Consultar NOAA ↗</a></article><article><h3>02 · Precipitação</h3><p>NASA POWER · PRECTOTCORR. Produto em grade, consultado em coordenadas aproximadas das sedes municipais; não é estação física. Datas civis em LST. Pontos próximos podem compartilhar a mesma célula.</p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noreferrer">Consultar NASA POWER ↗</a></article><article><h3>03 · Nível dos rios</h3><p>ANA/SNIRH · estação 83440000, Ibirama, rio Itajaí do Norte / Hercílio. Médias diárias consistidas, de escala (status real), convertidas de cm para m. Cobertura em 1997–1998 e 2014–2016; sem série importada em 2023–2024 ou 2026. ${rivers.length ? "Referencial altimétrico não informado; as cotas não são altitude absoluta." : "Nenhuma série de rio validada foi carregada. Não são geradas medições para preencher essa ausência."}</p><a href="https://www.snirh.gov.br/hidroweb/" target="_blank" rel="noreferrer">Consultar HidroWeb ↗</a></article>`;
    $("runs").innerHTML = catalog.runs
      .map(
        (r) =>
          `<tr><td>${esc(r.source_id)}</td><td>${esc(r.finished)}</td><td title="${esc(r.message)}">${esc(r.status)}</td><td>${r.inserted} / ${r.updated} / ${r.duplicates} / ${r.rejected}</td></tr>`,
      )
      .join("");
    const now = new Date();
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    $("current-start").value = `${now.getFullYear()}-01-01`;
    $("current-end").value = local;
    $("current-end").max = local;
    await refresh();
  } catch (e) {
    status("Não foi possível carregar a aplicação: " + e.message, true);
  }
}
async function refresh() {
  renderSelection();
  const request = ++generation;
  displayed = [];
  $("charts").innerHTML = "";
  $("values").innerHTML = "";
  $("metrics").innerHTML = "";
  $("alignment").textContent = "";
  $("download").disabled = true;
  if (!selected.size) {
    status(
      "Selecione um período para visualizar ou dois a três para comparar.",
    );
    return;
  }
  const mode = $("variables").value;
  const stations = [];
  if (mode !== "river") stations.push($("rain").value);
  if (mode !== "rain" && $("river").value) stations.push($("river").value);
  if (mode === "river" && !$("river").value) {
    $("charts").innerHTML =
      '<div class="empty">Nível indisponível: importe uma série de rio com origem e estação documentadas.</div>';
    status("Nenhuma medição de rio carregada.");
    return;
  }
  status("Consultando as séries persistidas…");
  try {
    const params = new URLSearchParams({
      events: [...selected].join(","),
      stations: stations.join(","),
      resolution: $("resolution").value,
      common: $("common").checked,
      current_start: $("current-start").value,
      current_end: $("current-end").value,
    });
    const result = await api("./api/compare?" + params);
    if (request !== generation) return;
    displayed = result.series;
    const daily = $("resolution").value === "daily";
    $("alignment").textContent =
      `${selected.size === 1 ? "Visualização individual. Selecione outro período para comparar." : "Comparação por " + (daily ? "dia" : "mês") + " relativo ao início de cada período."} ${$("common").checked ? "Trecho comum ativado." : "Comprimentos originais preservados."} Datas originais na tabela e nos pontos. ${
        result.cutoffs && Object.keys(result.cutoffs).length
          ? "Último dado atual por série: " +
            Object.entries(result.cutoffs)
              .map(([s, d]) => s + ": " + (d || "indisponível"))
              .join(" · ")
          : ""
      }`;
    if (result.reason)
      $("charts").innerHTML = `<div class="empty">${esc(result.reason)}</div>`;
    if (mode === "both" && !$("river").value)
      $("charts").innerHTML +=
        '<div class="notice">Nível de rio indisponível. Exibindo somente precipitação; não há corte conjunto chuva/nível.</div>';
    for (const s of displayed) {
      const total = s.points
        .filter((p) => p.value != null)
        .reduce((a, p) => a + p.value, 0);
      const metric =
        s.station.kind === "grid"
          ? s.valid
            ? fmt(total) + " mm"
            : "Sem dados"
          : `${s.coverage}%`;
      $("metrics").innerHTML +=
        `<article class="metric" style="border-color:${colors[[...selected].indexOf(s.window_id) % colors.length]}">${esc(s.label)} · ${esc(s.station.name)}<strong>${metric}</strong><p>${s.station.kind === "grid" ? "Acumulado no trecho exibido" : "Cobertura do nível"}</p><p>${s.valid}/${s.expected} dias válidos · ${s.missing} ausentes</p><p>${s.coverage}% de cobertura · ${esc(s.start)} a ${esc(s.end)}</p><p>Último dado: ${esc(s.last_valid || "indisponível")}</p></article>`;
    }
    for (const station of stations) {
      const ss = displayed.filter((s) => s.station.id === station);
      if (ss.length) draw(ss, daily);
    }
    $("values").innerHTML = displayed
      .flatMap((s) =>
        s.points.map(
          (p) =>
            `<tr><td>${esc(s.label)}</td><td>${esc(s.station.name)}</td><td>${p.date}</td><td>${p.end}</td><td>${fmt(p.value)}${p.partial ? " (parcial)" : ""}</td><td>${s.unit}</td><td>${p.valid}/${p.expected}</td></tr>`,
        ),
      )
      .join("");
    $("download").disabled = !displayed.length;
    status("");
  } catch (e) {
    if (request === generation) status(e.message, true);
  }
}
function draw(ss, daily) {
  const s = ss[0],
    rain = s.station.kind === "grid";
  const values = ss
    .flatMap((x) => x.points.map((p) => p.value))
    .filter((v) => v != null);
  const box = document.createElement("div");
  box.className = "chart";
  box.innerHTML = `<h3>${rain ? "Precipitação" : "Nível do rio"} · ${rain ? (daily ? "diária" : "acumulado mensal") : daily ? "média diária" : "média mensal"} (${s.unit})</h3><p class="muted">${esc(s.station.name)} · ${s.station.latitude}, ${s.station.longitude} · ${esc(s.station.source_name)}${rain ? " · ponto em grade" : " · referencial: " + esc(s.station.datum || "não informado")}</p>`;
  if (!values.length) {
    box.innerHTML +=
      '<div class="empty">Sem medições neste intervalo. A ausência de dados não significa ausência de chuva ou nível zero.</div>';
    $("charts").append(box);
    return;
  }
  const W = 1000,
    H = 310,
    L = 62,
    R = 20,
    T = 20,
    B = 48,
    n = Math.max(...ss.map((s) => s.points.length));
  let lo = Math.min(0, ...values),
    hi = Math.max(...values);
  if (hi === lo) hi = lo + 1;
  hi += (hi - lo) * 0.1;
  const x = (i) => L + ((i + 0.5) * (W - L - R)) / n,
    y = (v) => H - B - ((v - lo) / (hi - lo)) * (H - T - B);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${rain ? "Precipitação" : "Nível"} por ${daily ? "dia" : "mês"} relativo. Valores completos disponíveis na tabela abaixo.">`;
  for (let k = 0; k < 5; k++) {
    const v = lo + ((hi - lo) * k) / 4;
    svg += `<line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="#e1e9eb"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="#536e79">${fmt(v)}</text>`;
  }
  const step = Math.max(1, Math.ceil(n / 12));
  for (let i = 0; i < n; i += step)
    svg += `<text x="${x(i)}" y="${H - 27}" text-anchor="middle" font-size="12" fill="#536e79">${i + 1}</text>`;
  svg += `<text x="${W / 2}" y="${H - 5}" text-anchor="middle" font-size="12" fill="#536e79">${daily ? "Dia" : "Mês"} relativo ao início do período</text>`;
  ss.forEach((series, j) => {
    const color = colors[j % 3];
    let previous = null;
    series.points.forEach((p, i) => {
      if (p.value == null) {
        previous = null;
        return;
      }
      const tip = esc(
        `${series.label} | ${p.date} a ${p.end} | ${fmt(p.value)} ${series.unit} | ${p.valid}/${p.expected} dias${p.partial ? " · PARCIAL" : ""}`,
      );
      if (rain && !daily) {
        const bw = Math.max(1, (W - L - R) / n / (ss.length + 1));
        svg += `<rect x="${x(i) + (j - ss.length / 2) * bw}" y="${y(p.value)}" width="${bw * 0.85}" height="${Math.max(1, y(0) - y(p.value))}" fill="${color}" opacity="${p.partial ? 0.45 : 0.85}"><title>${tip}</title></rect>`;
      } else {
        if (previous && !p.partial && !previous.p.partial)
          svg += `<line x1="${x(previous.i)}" y1="${y(previous.p.value)}" x2="${x(i)}" y2="${y(p.value)}" stroke="${color}" stroke-width="2" stroke-dasharray="${j === 1 ? "7 4" : j === 2 ? "2 4" : ""}"/>`;
        svg += `<circle cx="${x(i)}" cy="${y(p.value)}" r="${n > 100 ? 2 : 4}" fill="${p.partial ? "white" : color}" stroke="${color}"><title>${tip}</title></circle>`;
        previous = { p, i };
      }
    });
  });
  svg += "</svg>";
  box.innerHTML +=
    '<div class="plot-scroll">' +
    svg +
    '</div><p class="mobile-hint muted">Deslize o gráfico para ver todo o período.</p>';
  box.innerHTML += `<div class="legend">${ss.map((s, j) => `<span><i class="swatch" style="background:${colors[j % 3]}"></i>${j + 1}. ${esc(s.label)}</span>`).join("")}</div><p class="muted">${ss.map((s) => `${esc(s.label)}: ${esc(s.start)} a ${esc(s.end)} · coleta ${esc(collected(s.collected_at))}`).join("<br>")}</p>`;
  $("charts").append(box);
}
$("download").onclick = () => {
  const cells = (v) => {
    let value = String(v ?? "");
    if (typeof v === "string" && /^[=+@\-\t\r]/.test(value))
      value = "'" + value;
    return '"' + value.replaceAll('"', '""') + '"';
  };
  const rows = [
    [
      "periodo",
      "estacao",
      "fonte",
      "latitude",
      "longitude",
      "inicio",
      "fim",
      "valor",
      "unidade",
      "dias_validos",
      "dias_esperados",
      "periodo_parcial",
      "coletado_em",
    ],
  ];
  displayed.forEach((s) =>
    s.points.forEach((p) =>
      rows.push([
        s.label,
        s.station.name,
        s.station.source_name,
        s.station.latitude,
        s.station.longitude,
        p.date,
        p.end,
        p.value,
        s.unit,
        p.valid,
        p.expected,
        p.partial ? "sim" : "não",
        s.collected_at,
      ]),
    ),
  );
  const url = URL.createObjectURL(
    new Blob(
      ["\ufeff" + rows.map((r) => r.map(cells).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "chuva-x-rio-comparacao.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("current").onclick = () => toggle("current");
$("custom").onclick = () => toggle("custom");
[
  "rain",
  "river",
  "resolution",
  "variables",
  "common",
  "current-start",
  "current-end",
].forEach((id) => $(id).addEventListener("change", refresh));
if (location.protocol !== "file:") init();
else {
  status("Execute iniciar.cmd ou python run.py para acessar os dados.");
  document
    .querySelectorAll("main button,main select,main input")
    .forEach((el) => (el.disabled = true));
}

function renderSelection() {
  $("selection-summary").innerHTML = "";
  const label = document.createElement("span");
  label.textContent = `${selected.size}/3 períodos selecionados`;
  $("selection-summary").append(label);
  for (const id of selected) {
    const event = catalog?.events.find((e) => e.id === id);
    const b = document.createElement("button");
    b.textContent =
      (event?.label ||
        (id === "current" ? "Período atual" : "Intervalo personalizado")) +
      " ×";
    b.setAttribute("aria-label", "Remover " + (event?.label || id));
    b.onclick = () => toggle(id);
    $("selection-summary").append(b);
  }
}
