"use strict";
const $ = id => document.getElementById(id);
const fmt = n => n == null || !Number.isFinite(Number(n)) ? "Sem dado" : Number(n).toLocaleString("pt-BR", {maximumFractionDigits:2});
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const phases = {warm:"El Niño",cold:"La Niña",neutral:"Neutro / sem episódio"};
const palette = ["#087c76","#376bb0","#a9662d"];
const phaseColors = {warm:"#ae602d",cold:"#326db6",neutral:"#5b8070"};
const monthNames = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const dateLabel = s => s ? s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4) : "Indisponível";
const monthLabel = s => s ? monthNames[Number(s.slice(5,7))-1]+"/"+s.slice(2,4) : "";
const collected = s => s ? new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}) : "Indisponível";
const today = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const currentYear = Number(today.slice(0,4));
let catalog, activeTab="overview", recentWindow=null, historyLoaded=false, comparisonLoaded=false;
let selected=[], displayed={history:[],comparison:[]}, requestIds={history:0,comparison:0}, controllers={};
function setStatus(id,message,error=false,loading=false){$(id).textContent=message;$(id).className="status"+(error?" error":"")+(loading?" loading-state":"");}
async function api(url,signal){const response=await fetch(url,{signal});if(!(response.headers.get("content-type")||"").includes("application/json"))throw new Error("API indisponível. Abra iniciar.cmd ou execute python run.py para acessar os dados locais.");const data=await response.json();if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"Não foi possível consultar os dados. Revise os filtros e tente novamente.");return data;}
function phasePill(phase){return `<span class="phase-pill ${esc(phase||"unknown")}">${esc(phases[phase]||"Não classificado")}</span>`;}
function phaseOf(e){return e.phase||null;}
function navigate(name,focus=false){if(!["overview","history","comparison","methodology"].includes(name))name="overview";activeTab=name;document.querySelectorAll("[data-tab]").forEach(b=>{const chosen=b.dataset.tab===name;b.setAttribute("aria-selected",chosen);b.tabIndex=chosen?0:-1;$("panel-"+b.dataset.tab).hidden=!chosen;});if(location.hash!=="#"+name)history.replaceState(null,"","#"+name);if(focus)$("tab-"+name).focus();if(catalog&&name==="history"&&!historyLoaded){historyLoaded=true;refreshHistory();}if(catalog&&name==="comparison"&&!comparisonLoaded){comparisonLoaded=true;refreshComparison();}}
function bindNavigation(){const tabs=[...document.querySelectorAll("[data-tab]")];tabs.forEach((b,i)=>{b.onclick=()=>navigate(b.dataset.tab);b.onkeydown=e=>{let target;if(e.key==="ArrowRight")target=(i+1)%tabs.length;if(e.key==="ArrowLeft")target=(i+tabs.length-1)%tabs.length;if(e.key==="Home")target=0;if(e.key==="End")target=tabs.length-1;if(target!==undefined){e.preventDefault();navigate(tabs[target].dataset.tab,true);}};});document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{navigate(b.dataset.go);$("app-main").scrollIntoView({block:"start"});});window.addEventListener("hashchange",()=>navigate(location.hash.slice(1)));}
function fillSelect(id,stations){$(id).replaceChildren();if(!stations.length)$(id).add(new Option("Nenhuma série importada",""));stations.forEach(s=>$(id).add(new Option(s.name,s.id)));}
function rangeForYear(year){return {start:year+"-01-01",end:year===String(currentYear)?today:year+"-12-31"};}
function validRange(start,end){if(!start||!end)throw new Error("Preencha a data inicial e a data final.");const span=(Date.parse(end)-Date.parse(start))/86400000;if(span<0)throw new Error("A data final deve ser igual ou posterior à inicial.");if(span>366*5)throw new Error("Selecione um intervalo de até cinco anos.");if(end>today)throw new Error("Selecione datas até hoje; o acervo não contém previsões.");}
function stationsFor(prefix){const mode=$(prefix+"variables").value;const result=[];if(mode!=="river"&&$(prefix+"rain").value)result.push($(prefix+"rain").value);if(mode!=="rain"&&$(prefix+"river").value)result.push($(prefix+"river").value);return result;}
function syncStationControls(prefix){
  const mode=$(prefix+"variables").value;
  $(prefix+"rain").disabled=mode==="river";
  $(prefix+"river").disabled=mode==="rain";
  const context=$(prefix==="h-"?"h-context":"comparison-context");
  if(context){
    const names=["rain","river"].filter(kind=>!$(prefix+kind).disabled&&$(prefix+kind).value).map(kind=>$(prefix+kind).selectedOptions[0].textContent);
    context.textContent=[$(prefix+"resolution").value==="daily"?"Diário":"Mensal",...names].join(" · ");
  }
}
function historyMode(){const custom=$("h-mode").value==="custom";$("h-year-field").hidden=custom;$("h-start-field").hidden=!custom;$("h-end-field").hidden=!custom;}
function periodMode(){const kind=$("period-kind").value;["event-phase-field","event-select-field"].forEach(id=>$(id).hidden=kind!=="event");$("compare-year-field").hidden=kind!=="year";["compare-start-field","compare-end-field"].forEach(id=>$(id).hidden=kind!=="custom");}
function resetHistory(){const availableYear=catalog.stations.find(s=>s.kind==="river"&&s.last_valid)?.last_valid?.slice(0,4)||recentWindow?.end.slice(0,4)||String(currentYear);$("h-mode").value="year";$("h-year").value=$("h-year").querySelector('option[value="2015"]')?"2015":availableYear;$("h-phase").value="all";$("h-resolution").value="monthly";$("h-variables").value=$("h-river").value?"both":"rain";$("h-rain").selectedIndex=0;$("h-river").selectedIndex=0;const range=rangeForYear($("h-year").value);$("h-start").value=range.start;$("h-end").value=range.end;historyMode();syncStationControls("h-");}
function eventOptions(){
  const phase=$("event-phase").value,previous=$("event-select").value;
  $("event-select").replaceChildren();
  const events=[...catalog.events].filter(e=>phase==="all"||phaseOf(e)===phase).sort((a,b)=>(Boolean(b.samples)-Boolean(a.samples))||b.start.localeCompare(a.start));
  for(const event of events){
    const label=`${phases[phaseOf(event)]||event.label} · ${monthLabel(event.start)}–${monthLabel(event.end)}${event.samples?"":" · sem dados locais"}`;
    const option=new Option(label,event.id);
    option.title=`${event.label} · ${dateLabel(event.start)} a ${dateLabel(event.end)}`;
    $("event-select").add(option);
  }
  if(events.some(e=>e.id===previous))$("event-select").value=previous;
  if(!events.length)$("event-select").add(new Option("Nenhum período classificado",""));
}
function eventWindow(e){return {id:e.id,label:e.label,start:e.start,end:e.end,phase:phaseOf(e)};}
function preset(){const available=catalog.events.filter(e=>e.samples);const find=(phase,preferred)=>available.find(e=>phaseOf(e)===phase&&e.start.startsWith(preferred))||available.filter(e=>phaseOf(e)===phase).sort((a,b)=>b.samples-a.samples)[0];const warm=find("warm","2014"),cold=find("cold","2016");selected=[warm,cold].filter(Boolean).map(eventWindow);if(!selected.length)selected=available.slice(-2).map(eventWindow);renderSelection();}
function windowLabel(window){
  const phase=window.window_phase||window.phase;
  const label=phase==="neutral"?"Neutro":phases[phase];
  return label||(window.id?.startsWith("custom-")||window.window_id?.startsWith("custom-")?"Intervalo personalizado":window.label);
}
function renderSelection(){
  const box=$("selection-summary");
  box.innerHTML=`<span class="selection-count">${selected.length} de 3 períodos</span>`+selected.map((window,index)=>`<div class="selection-chip" style="border-left-color:${colorFor(window.id,index)}"><div><strong title="${esc(window.label)}">${esc(windowLabel(window))}</strong><small>${dateLabel(window.start)} — ${dateLabel(window.end)}</small></div><button type="button" data-remove="${esc(window.id)}" aria-label="Remover ${esc(window.label)}">×</button></div>`).join("");
  if($("add-period")){
    $("add-period").disabled=selected.length>=3;
    $("add-period").title=selected.length>=3?"Limite de 3 períodos. Remova um para adicionar outro.":"Adicionar à comparação";
  }
  if(!selected.length&&$("period-editor"))$("period-editor").open=true;
  box.querySelectorAll("[data-remove]").forEach(button=>button.onclick=()=>{
    selected=selected.filter(window=>window.id!==button.dataset.remove);
    renderSelection();
    refreshComparison();
  });
}
function colorFor(id,index){const w=selected.find(w=>w.id===id);const selectedIndex=selected.findIndex(item=>item.id===id);if(!w?.phase)return palette[(selectedIndex<0?index:selectedIndex)%palette.length];const shades={warm:["#ae602d","#cc9541","#8f4353"],cold:["#326db6","#6c66a8","#28878e"],neutral:["#5b8070","#668d9d","#9b854c"]};const offset=selected.filter(item=>item.phase===w.phase).findIndex(item=>item.id===id);return shades[w.phase]?.[Math.max(0,offset)]||palette[index%palette.length];}
function addPeriod(e){e.preventDefault();try{if(selected.length>=3)throw new Error("Você já selecionou três períodos. Remova um para adicionar outro.");const kind=$("period-kind").value;let window;if(kind==="event"){const event=catalog.events.find(e=>e.id===$("event-select").value);if(!event)throw new Error("Escolha um episódio disponível no catálogo.");window=eventWindow(event);}else if(kind==="year"){const year=$("compare-year").value;window={id:"year-"+year,label:"Ano "+year,...rangeForYear(year)};}else{const start=$("current-start").value,end=$("current-end").value;validRange(start,end);window={id:"custom-"+start+"-"+end,label:dateLabel(start)+" a "+dateLabel(end),start,end};}if(selected.some(w=>w.id===window.id||w.start===window.start&&w.end===window.end))throw new Error("Esse período já está na comparação.");selected.push(window);renderSelection();refreshComparison();}catch(error){setStatus("status",error.message,true);}}
function resultIds(kind){return kind==="history"?{status:"h-status",results:"h-results",charts:"h-charts",metrics:"h-metrics",values:"h-values",insights:"h-insights",download:"h-download"}:{status:"status",results:"comparison-results",charts:"charts",metrics:"metrics",values:"values",insights:"insights",download:"download"};}
function beginRequest(kind){controllers[kind]?.abort();controllers[kind]=new AbortController();const ids=resultIds(kind);const id=++requestIds[kind];displayed[kind]=[];["charts","metrics","values","insights"].forEach(key=>$(ids[key]).replaceChildren());$(ids.download).disabled=true;$(ids.results).setAttribute("aria-busy","true");setStatus(ids.status,"Consultando as séries persistidas…",false,true);return {id,signal:controllers[kind].signal,ids};}
async function refreshHistory(){if(!catalog)return;const req=beginRequest("history");syncStationControls("h-");try{const range=$("h-mode").value==="year"?rangeForYear($("h-year").value):{start:$("h-start").value,end:$("h-end").value};validRange(range.start,range.end);const stationIds=stationsFor("h-");if(!stationIds.length)throw new Error("Nenhuma série disponível para a variável selecionada.");const phase=$("h-phase").value,resolution=$("h-resolution").value;const label=$("h-mode").value==="year"?"Ano "+$("h-year").value:dateLabel(range.start)+" a "+dateLabel(range.end);$("h-heading").textContent=label+(phase==="all"?"":" · "+phases[phase]);const series=await Promise.all(stationIds.map(async station=>{const s=await api("./api/series?"+new URLSearchParams({station,...range,resolution,phase}),req.signal);return {...s,label,window_id:"history"};}));if(req.id!==requestIds.history)return;renderResults("history",series,{daily:resolution==="daily",relative:false});setStatus(req.ids.status,series.every(s=>!s.valid)?"Não há observações disponíveis para esse recorte e fase climática.":"");}catch(error){if(error.name!=="AbortError"&&req.id===requestIds.history){setStatus(req.ids.status,error.message,true);$(req.ids.charts).innerHTML='<div class="empty">A consulta não foi concluída. Ajuste os filtros ou tente novamente.</div>';}}finally{if(req.id===requestIds.history)$(req.ids.results).setAttribute("aria-busy","false");}}
async function refreshComparison(){if(!catalog)return;const req=beginRequest("comparison");syncStationControls("");$("alignment").textContent="";try{if(!selected.length){setStatus("status","Selecione um período para visualizar ou até três para comparar.");$("charts").innerHTML='<div class="empty"><strong>Sua comparação começa aqui</strong>Adicione um episódio, um ano ou um intervalo de datas.</div>';return;}const stationIds=stationsFor("");if(!stationIds.length)throw new Error("Nenhuma série disponível para a variável selecionada.");const resolution=$("resolution").value;const result=await api("./api/compare?"+new URLSearchParams({windows:JSON.stringify(selected),stations:stationIds.join(","),resolution,common:$("common").checked,phase:"all"}),req.signal);if(req.id!==requestIds.comparison)return;renderResults("comparison",result.series,{daily:resolution==="daily",relative:true});$("alignment").textContent=`${selected.length} período(s) · ${resolution==="daily"?"dias":"meses"} relativos ao início · ${$("common").checked?"mesma duração no trecho exibido":"durações originais"}. Datas originais nos pontos e na tabela.`;if(result.reason)$("charts").innerHTML=`<div class="empty">${esc(result.reason)}</div>`;setStatus("status","");}catch(error){if(error.name!=="AbortError"&&req.id===requestIds.comparison){setStatus("status",error.message,true);$("charts").innerHTML='<div class="empty">A comparação não foi concluída. Revise as datas e a opção de trecho comum.</div>';}}finally{if(req.id===requestIds.comparison)$(req.ids.results).setAttribute("aria-busy","false");}}
function summaryFor(s){if(s.summary)return s.summary;const points=s.points.filter(p=>p.value!=null);const rain=s.station.kind==="grid";const total=points.reduce((n,p)=>n+p.value,0);return {mean_daily:s.valid?(rain?total/s.valid:points.reduce((n,p)=>n+p.value*p.valid,0)/s.valid):null,mean_unit:rain?"mm/dia":"m",total:rain&&s.valid?total:null,maximum:null,maximum_date:null};}
function pointState(p){if(p.unclassified&&p.excluded)return "Sem classificação ENSO";if(p.excluded)return "Fora da fase selecionada";if(p.value==null)return "Sem medição";return p.partial?"Parcial":"Completo";}
function renderResults(kind,series,options){
  displayed[kind]=series;
  const ids=resultIds(kind),groups=new Map();
  $(ids.download).disabled=!series.some(s=>s.points.length);
  for(const item of series){
    if(!groups.has(item.window_id))groups.set(item.window_id,[]);
    groups.get(item.window_id).push(item);
  }
  $(ids.metrics).innerHTML=[...groups.values()].map((items,index)=>{
    const first=items[0],color=kind==="comparison"?colorFor(first.window_id,index):phaseColors[first.window_phase]||palette[0];
    const metrics=items.map(item=>{
      const rain=item.station.kind==="grid",summary=summaryFor(item);
      return `<div class="metric-variable"><span class="metric-label" title="${esc(item.station.name)}">${rain?"Chuva média":"Nível médio"}</span><strong class="metric-value">${fmt(summary.mean_daily)} <small>${summary.mean_daily==null?"":esc(summary.mean_unit||item.unit)}</small></strong>${rain?`<p class="metric-caption">Acumulado: <b>${fmt(summary.total)}${summary.total==null?"":" mm"}</b></p>`:'<p class="metric-caption">Nos dias observados</p>'}<div class="coverage-bar" aria-hidden="true"><span style="width:${item.coverage||0}%"></span></div><p class="metric-coverage">${item.coverage==null?"Sem dias elegíveis":fmt(item.coverage)+"% de cobertura"}</p></div>`;
    }).join("");
    const details=items.map(item=>`<div><strong>${esc(item.station.name)}</strong><p>${dateLabel(item.start)} — ${dateLabel(item.end)}</p><p>${fmt(item.valid)} de ${fmt(item.expected)} dias elegíveis observados · ${fmt(item.missing)} sem medição${item.excluded?" · "+fmt(item.excluded)+" fora da fase":""}${item.unclassified?" · "+fmt(item.unclassified)+" sem índice ENSO":""}.</p></div>`).join("");
    return `<article class="metric" style="border-top-color:${color}"><div class="metric-title" title="${esc(first.label)}">${esc(windowLabel(first))}</div><div class="metric-grid">${metrics}</div><details class="metric-details"><summary>Datas e amostra</summary>${details}</details></article>`;
  }).join("");
  const stationIds=[...new Set(series.map(item=>item.station.id))];
  for(const station of stationIds)drawChart($(ids.charts),series.filter(item=>item.station.id===station),options);
  $(ids.values).innerHTML=series.flatMap(item=>item.points.map(point=>`<tr><td>${esc(item.label)}</td><td>${esc(item.station.name)}</td><td>${dateLabel(point.date)}</td><td>${dateLabel(point.end)}</td><td>${fmt(point.value)}</td><td>${esc(item.unit)}</td><td>${esc(phases[point.phase]||"Não classificado")}</td><td>${point.valid}/${point.expected}</td><td class="${point.partial?"partial-label":""}">${pointState(point)}</td></tr>`)).join("")||'<tr><td colspan="9" class="table-empty">Nenhum valor neste recorte.</td></tr>';
  $(ids.insights).innerHTML=series.filter(item=>summaryFor(item).maximum!=null).map(item=>{
    const summary=summaryFor(item);
    return `<div class="insight"><strong>Máximo diário · ${esc(windowLabel(item))}</strong>${esc(item.station.name)}: <b>${fmt(summary.maximum)} ${esc(item.unit)}</b> em ${dateLabel(summary.maximum_date)}.<small>Entre ${fmt(item.valid)} dias observados; não é um limiar de risco.</small></div>`;
  }).join("");
}
function drawChart(target,series,{daily=false,relative=false,compact=false}={}){
  const first=series[0],rain=first.station.kind==="grid";
  const values=series.flatMap(item=>item.points.map(point=>point.value)).filter(value=>value!=null);
  const box=document.createElement("div");
  box.className="chart";
  const heading=`${rain?"Precipitação":"Nível do rio"} · ${daily?rain?"diária":"média diária":rain?"acumulado mensal":"média mensal"} (${first.unit})`;
  const provenance=`<details class="chart-provenance"><summary>Fonte e coleta</summary><p>${esc(first.station.source_name)} · ${rain?"produto em grade · datas civis em LST":"referencial: "+esc(first.station.datum||"não informado")}</p>${series.map(item=>`<p><strong>${esc(item.label)}</strong> · ${dateLabel(item.start)}–${dateLabel(item.end)}<br>Coleta: ${esc(collected(item.collected_at))}</p>`).join("")}</details>`;
  box.innerHTML=`<h3>${heading}</h3><p class="chart-description">${esc(first.station.name)}</p>`;
  target.append(box);
  if(!values.length){
    box.innerHTML+='<div class="empty"><strong>Sem medições neste recorte</strong>Ausência de dados não significa valor zero. Experimente outro período ou fase.</div>'+provenance;
    return;
  }
  const W=760,H=compact?310:340,L=65,R=22,T=20,B=58;
  const n=Math.max(...series.map(item=>item.points.length)),usable=W-L-R;
  let lo=Math.min(0,...values),hi=Math.max(...values);
  if(hi===lo)hi=lo+1;
  hi+=(hi-lo)*.12;
  const x=index=>L+(index+.5)*usable/n,y=value=>H-B-(value-lo)/(hi-lo)*(H-T-B);
  const pointColor=(item,point,index)=>relative?colorFor(item.window_id,index):phaseColors[point.phase]||"#899397";
  let svg=`<svg class="chart-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(heading)}. Explore os pontos pelo controle abaixo; valores também disponíveis na tabela.">`;
  for(let tick=0;tick<5;tick++){
    const value=lo+(hi-lo)*tick/4;
    svg+=`<line x1="${L}" y1="${y(value)}" x2="${W-R}" y2="${y(value)}" stroke="#e5ecef"/><text x="${L-10}" y="${y(value)+4}" text-anchor="end" font-size="13" fill="#526873">${fmt(value)}</text>`;
  }
  const step=Math.max(1,Math.ceil(n/6));
  for(let index=0;index<n;index+=step){
    const point=first.points[index];
    const label=relative?String(index+1):daily?point?.date.slice(8,10)+"/"+point?.date.slice(5,7):monthLabel(point?.date);
    svg+=`<text x="${x(index)}" y="${H-33}" text-anchor="middle" font-size="13" fill="#526873">${esc(label)}</text>`;
  }
  svg+=`<text x="${W/2}" y="${H-8}" text-anchor="middle" font-size="12" fill="#526873">${relative?(daily?"Dia":"Mês")+" desde o início do período":daily?"Data":"Mês"}</text>`;
  series.forEach((item,seriesIndex)=>{
    let previous=null;
    for(let index=0;index<item.points.length;index++){
      const point=item.points[index];
      if(point.value==null){previous=null;continue;}
      const color=pointColor(item,point,seriesIndex);
      const tip=esc(`${item.label} | ${dateLabel(point.date)} a ${dateLabel(point.end)} | ${fmt(point.value)} ${item.unit} | ${point.valid}/${point.expected} dias | ${phases[point.phase]||"Não classificado"} | ${pointState(point)}`);
      if(rain&&!daily){
        const width=Math.max(1,usable/n/(series.length+1)),left=x(index)+(seriesIndex-series.length/2)*width;
        svg+=`<rect x="${left}" y="${y(point.value)}" width="${width*.83}" height="${Math.max(1,y(0)-y(point.value))}" rx="1.5" fill="${color}" opacity="${point.partial?.42:.86}"${point.partial?` stroke="${color}" stroke-dasharray="3 2"`:""}><title>${tip}</title></rect>`;
      }else{
        if(previous&&!point.partial&&!previous.point.partial)svg+=`<line x1="${x(previous.index)}" y1="${y(previous.point.value)}" x2="${x(index)}" y2="${y(point.value)}" stroke="${color}" stroke-width="2"${seriesIndex?` stroke-dasharray="${seriesIndex===1?"7 4":"2 3"}"`:""}/>`;
        svg+=`<circle cx="${x(index)}" cy="${y(point.value)}" r="${n>100?2:3.7}" fill="${point.partial?"white":color}" stroke="${color}"><title>${tip}</title></circle>`;
        previous={point,index};
      }
    }
  });
  svg+=`<line class="cursor-line" x1="${x(0)}" x2="${x(0)}" y1="${T}" y2="${H-B}" stroke="#678894" stroke-width="1" stroke-dasharray="4 4"/></svg>`;
  const observedPhases=[...new Set(series.flatMap(item=>item.points.filter(point=>point.value!=null).map(point=>point.phase)))];
  const legend=relative?series.map((item,index)=>`<span title="${esc(item.label)} · ${dateLabel(item.start)}–${dateLabel(item.end)}"><i class="swatch" style="background:${colorFor(item.window_id,index)}"></i>${esc(windowLabel(item))} · ${monthLabel(item.start)}–${monthLabel(item.end)}</span>`).join(""):observedPhases.map(phase=>`<span><i class="swatch" style="background:${phaseColors[phase]||"#899397"}"></i>${esc(phases[phase]||"Não classificado")}</span>`).join("");
  box.innerHTML+=`<div class="plot-scroll" tabindex="0" role="region" aria-label="Gráfico com rolagem horizontal">${svg}</div><p class="mobile-hint">Deslize para ver o período completo.</p><div class="legend">${legend}<span class="legend-note">Vazio / transparente: parcial · lacuna: sem dado</span></div><div class="chart-controls"><label>Explorar data <input class="chart-cursor" type="range" min="0" max="${n-1}" value="0" step="1" aria-label="Explorar datas de ${esc(heading)}" /></label><span>Arraste ou use as setas.</span></div><div class="chart-readout" role="status" aria-live="polite"></div>${provenance}`;
  const cursor=box.querySelector(".chart-cursor"),line=box.querySelector(".cursor-line"),readout=box.querySelector(".chart-readout"),plot=box.querySelector("svg");
  function inspect(index){
    index=Math.max(0,Math.min(n-1,index));
    cursor.value=index;
    line.setAttribute("x1",x(index));
    line.setAttribute("x2",x(index));
    const texts=series.map(item=>{
      const point=item.points[index],label=relative?`${windowLabel(item)} · `:"";
      if(!point)return `${label}fora da duração.`;
      return `${label}${dateLabel(point.date)}${point.end!==point.date?"–"+dateLabel(point.end):""} · ${fmt(point.value)}${point.value==null?"":" "+item.unit} · ${phases[point.phase]||"Não classificado"} · ${pointState(point)}`;
    });
    readout.innerHTML=texts.map(text=>`<span>${esc(text)}</span>`).join("");
    cursor.setAttribute("aria-valuetext",texts.join("; "));
  }
  cursor.oninput=()=>inspect(Number(cursor.value));
  let frame;
  plot.addEventListener("pointermove",event=>{
    if(frame)cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const rect=plot.getBoundingClientRect();
      inspect(Math.floor(((event.clientX-rect.left)/rect.width*W-L)/usable*n));
    });
  });
  plot.addEventListener("click",event=>{
    const rect=plot.getBoundingClientRect();
    inspect(Math.floor(((event.clientX-rect.left)/rect.width*W-L)/usable*n));
  });
  inspect(0);
}
function download(kind){const series=displayed[kind];if(!series.length)return;const cells=v=>{let s=String(v??"");if(typeof v==="string"&&/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const rows=[["periodo","estacao","fonte","latitude","longitude","inicio","fim","valor","unidade","fase_enso","dias_validos","dias_elegiveis","situacao","coletado_em"]];for(const s of series)for(const p of s.points)rows.push([s.label,s.station.name,s.station.source_name,s.station.latitude,s.station.longitude,p.date,p.end,p.value,s.unit,phases[p.phase]||"não classificado",p.valid,p.expected,pointState(p),s.collected_at]);const url=URL.createObjectURL(new Blob(["\ufeff"+rows.map(row=>row.map(cells).join(";")).join("\r\n")],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=kind==="history"?"chuva-x-rio-historico.csv":"chuva-x-rio-comparacao.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderCatalog(){
  const rain=catalog.stations.filter(station=>station.kind==="grid"),rivers=catalog.stations.filter(station=>station.kind==="river");
  ["rain","h-rain"].forEach(id=>fillSelect(id,rain));
  ["river","h-river"].forEach(id=>fillSelect(id,rivers));
  const starts=catalog.stations.map(station=>station.first_valid).filter(Boolean).sort();
  const ends=catalog.stations.map(station=>station.last_valid).filter(Boolean).sort();
  const indices=catalog.indices||[],episodes=catalog.events.filter(event=>["warm","cold"].includes(phaseOf(event)));
  const counts=phase=>catalog.events.filter(event=>phaseOf(event)===phase).length;
  $("overview-kpis").innerHTML=[
    {label:"Precipitação",value:fmt(rain.reduce((total,station)=>total+station.samples,0)),detail:`Registros diários · ${rain.length} pontos em grade`,icon:"↧"},
    {label:"Nível do rio",value:fmt(rivers.reduce((total,station)=>total+station.samples,0)),detail:`Registros diários · ${rivers.length} ${rivers.length===1?"estação":"estações"} ANA`,icon:"≈"},
    {label:"Período do acervo",value:starts.length?starts[0].slice(0,4)+"–"+ends.at(-1).slice(0,4):"Sem dados",detail:"Disponibilidade descontínua",icon:"◷"},
    {label:"Episódios ENSO",value:fmt(episodes.length),detail:`${counts("warm")} El Niño · ${counts("cold")} La Niña`,icon:"◌"}
  ].map(item=>`<article class="kpi"><span class="kpi-icon" aria-hidden="true">${item.icon}</span><span class="kpi-label">${item.label}</span><strong class="kpi-value">${item.value}</strong><p>${item.detail}</p></article>`).join("");
  $("phase-counts").innerHTML=["warm","cold","neutral"].map(phase=>`<div>${phasePill(phase)}<span>${fmt(indices.filter(index=>index.phase===phase).length)} meses</span></div>`).join("");
  const firstIndex=indices[0],last=indices.at(-1);
  $("enso-note").textContent=last?`${monthLabel(firstIndex.date)}–${monthLabel(last.date)} · Último RONI: ${fmt(last.value)} °C (${phases[last.phase]||"não classificado"}). Base: 1991–2020; sujeito a revisão pela NOAA.`:"Índices ENSO ainda não carregados.";
  $("enso-note").title="Classificação pelo mês central de cada temporada. Referência climatológica do RONI: 1991–2020.";
  $("sources").innerHTML=`<article class="panel"><span class="source-number">01 / CLIMA</span><h3>NOAA / CPC</h3><span class="phase-pill">RONI · ERSSTv6</span><p>Classificação oficial dos episódios ENSO, por mês central da temporada.</p><details><summary>Sobre a classificação</summary><p>Marcações de El Niño, La Niña e meses sem episódio confirmado, sujeitas a revisão pela NOAA.</p></details><a class="source-link" href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/" target="_blank" rel="noreferrer">Consultar NOAA ↗</a></article><article class="panel"><span class="source-number">02 / PRECIPITAÇÃO</span><h3>NASA POWER</h3><span class="phase-pill">PRECTOTCORR · mm/dia</span><p>Estimativas em grade para Ibirama e Presidente Getúlio.</p><details><summary>Sobre os pontos</summary><p>Coordenadas aproximadas, com datas civis em LST. Pontos próximos podem compartilhar a mesma célula; não são pluviômetros locais.</p></details><a class="source-link" href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noreferrer">Consultar NASA POWER ↗</a></article><article class="panel"><span class="source-number">03 / NÍVEL DOS RIOS</span><h3>ANA / SNIRH</h3><span class="phase-pill">83440000 · Ibirama</span><p>Nível médio diário do rio Itajaí do Norte / Hercílio.</p><details><summary>Sobre as medições</summary><p>Médias diárias consistidas, de escala, convertidas de centímetros para metros. Referencial altimétrico não informado: a cota não é altitude absoluta. ${rivers.length?"Datas carregadas na tabela de cobertura.":"Não há série validada carregada."}</p></details><a class="source-link" href="https://www.snirh.gov.br/hidroweb/" target="_blank" rel="noreferrer">Consultar HidroWeb ↗</a></article>`;
  $("coverage").innerHTML=catalog.stations.map(station=>`<tr><td>${esc(station.name)} · ${station.kind==="grid"?"precipitação em grade":"nível do rio"}</td><td>${dateLabel(station.first_valid)}</td><td>${dateLabel(station.last_valid)}</td><td>${fmt(station.samples)}</td></tr>`).join("");
  $("runs").innerHTML=catalog.runs.map(run=>`<tr><td>${esc(run.source_id)}</td><td>${esc(collected(run.finished))}</td><td title="${esc(run.message)}">${esc(run.status)}</td><td>${run.inserted} / ${run.updated} / ${run.duplicates} / ${run.rejected}</td></tr>`).join("");
  const firstYear=Math.min(1950,Number(starts[0]?.slice(0,4)||1950));
  for(const id of ["h-year","compare-year"]){
    $(id).replaceChildren();
    for(let year=currentYear;year>=firstYear;year--)$(id).add(new Option(String(year),String(year)));
  }
  $("compare-year").value="2015";
  for(const id of ["h-start","h-end","current-start","current-end"])$(id).max=today;
  $("current-start").value="2015-01-01";
  $("current-end").value="2015-12-31";
  eventOptions();preset();resetHistory();syncStationControls("");
}
async function renderOverview(){const station=catalog.stations.find(s=>s.kind==="grid"&&s.last_valid);const box=$("overview-chart");box.innerHTML="";if(!station){box.innerHTML='<div class="empty">Nenhuma série de precipitação carregada.</div>';box.setAttribute("aria-busy","false");$("open-recent").disabled=true;return;}recentWindow={station:station.id,start:station.last_valid.slice(0,4)+"-01-01",end:station.last_valid};$("overview-period").textContent=monthLabel(recentWindow.start)+" — "+monthLabel(recentWindow.end);$("overview-note").textContent=station.name+" · soma mensal dos dias disponíveis. Última observação: "+dateLabel(station.last_valid)+".";try{const s=await api("./api/series?"+new URLSearchParams({...recentWindow,resolution:"monthly",phase:"all"}));drawChart(box,[{...s,label:"Observações de "+recentWindow.end.slice(0,4),window_id:"overview"}],{compact:true});}catch(error){box.innerHTML=`<div class="empty">${esc(error.message)}</div>`;}finally{box.setAttribute("aria-busy","false");}}
async function init(){setStatus("app-status","Carregando o acervo local…",false,true);$("retry").hidden=true;try{catalog=await api("./api/catalog");renderCatalog();setStatus("app-status","");navigate(location.hash.slice(1)||activeTab);await renderOverview();}catch(error){setStatus("app-status","Não foi possível carregar o acervo: "+error.message,true);$("retry").hidden=false;$("overview-chart").setAttribute("aria-busy","false");$("overview-chart").innerHTML='<div class="empty">O acervo local está indisponível. Tente carregar novamente.</div>';}}
bindNavigation();$("retry").onclick=init;$("h-reset").onclick=()=>{if(catalog){resetHistory();refreshHistory();}};$("h-mode").onchange=()=>{historyMode();refreshHistory();};["h-year","h-start","h-end","h-phase","h-rain","h-river","h-resolution","h-variables"].forEach(id=>$(id).addEventListener("change",()=>{if(id==="h-year"){const range=rangeForYear($("h-year").value);$("h-start").value=range.start;$("h-end").value=range.end;}refreshHistory();}));["rain","river","resolution","variables","common"].forEach(id=>$(id).addEventListener("change",refreshComparison));$("period-kind").onchange=periodMode;$("event-phase").onchange=()=>{if(catalog)eventOptions();};$("period-form").onsubmit=addPeriod;$("preset-enso").onclick=()=>{if(catalog){preset();refreshComparison();}};$("h-download").onclick=()=>download("history");$("download").onclick=()=>download("comparison");$("open-recent").onclick=()=>{if(!recentWindow)return;$("h-mode").value="custom";$("h-year").value=recentWindow.end.slice(0,4);$("h-start").value=recentWindow.start;$("h-end").value=recentWindow.end;$("h-phase").value="all";$("h-rain").value=recentWindow.station;$("h-variables").value="rain";$("h-resolution").value="monthly";historyMode();historyLoaded=true;navigate("history");refreshHistory();$("app-main").scrollIntoView({block:"start"});};
if(location.protocol!=="file:")init();else document.querySelectorAll("main button,main input,main select").forEach(el=>el.disabled=true);



