
const ReportEngine = (() => {
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = (v,d=2) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "—";

  function statusClass(s){ return String(s||"REVIEW").toLowerCase(); }

  function barChart(title, rows, maxOverride=null) {
    const vals = rows.flatMap(r => [Number(r.value)||0, Number(r.limit)||0]);
    const max = maxOverride || Math.max(1,...vals)*1.12;
    const W=720,H=95+rows.length*68,left=175,right=35,plot=W-left-right;
    const rowSvg = rows.map((r,i)=>{
      const y=58+i*68;
      const vw=Math.max(0,Math.min(plot,(Number(r.value)||0)/max*plot));
      const lw=Math.max(0,Math.min(plot,(Number(r.limit)||0)/max*plot));
      return `
        <text x="10" y="${y+19}" font-size="14" font-weight="700">${esc(r.label)}</text>
        <rect x="${left}" y="${y}" width="${plot}" height="19" rx="5" fill="#eef2f6"/>
        <rect x="${left}" y="${y}" width="${vw}" height="19" rx="5" fill="#175cd3"/>
        <line x1="${left+lw}" y1="${y-5}" x2="${left+lw}" y2="${y+25}" stroke="#d92d20" stroke-width="3"/>
        <text x="${left+Math.min(vw+7,plot-5)}" y="${y+15}" font-size="12" fill="#175cd3">${fmt(r.value,2)} ${esc(r.unit||"")}</text>
        <text x="${left+Math.min(lw+7,plot-5)}" y="${y+38}" font-size="11" fill="#b42318">limit ${fmt(r.limit,2)} ${esc(r.unit||"")}</text>`;
    }).join("");
    return `<div class="reportChart"><h3>${esc(title)}</h3><svg viewBox="0 0 ${W} ${H}" role="img">${rowSvg}</svg></div>`;
  }

  function windChart(dpt, used){
    if(!dpt) return "";
    const vals=[
      {label:"Reference q", value:dpt.q},
      {label:"|External p|", value:Math.abs(dpt.pext)},
      {label:"Suggested net", value:dpt.suggested},
      {label:"Design pressure used", value:used}
    ];
    const max=Math.max(1,...vals.map(x=>x.value))*1.15;
    const W=720,H=345,left=170,right=40,plot=W-left-right;
    const rows=vals.map((r,i)=>{
      const y=60+i*62,w=r.value/max*plot;
      return `<text x="10" y="${y+16}" font-size="14" font-weight="700">${esc(r.label)}</text>
      <rect x="${left}" y="${y}" width="${plot}" height="20" rx="5" fill="#eef2f6"/>
      <rect x="${left}" y="${y}" width="${w}" height="20" rx="5" fill="#067647"/>
      <text x="${left+Math.min(w+8,plot-8)}" y="${y+16}" font-size="12">${fmt(r.value,3)} kPa</text>`;
    }).join("");
    return `<div class="reportChart"><h3>DPT wind pressure build-up</h3><svg viewBox="0 0 ${W} ${H}" role="img">${rows}</svg></div>`;
  }

  function liteTable(r, used){
    const d=r.deflection||{};
    return `
      <section class="liteBlock">
        <h3>${esc(r.name)} Lite — ${esc(r.finalStatus)}</h3>
        <table>
          <tr><th>Glass structure</th><td>${esc(r.desc)}</td></tr>
          <tr><th>ASTM figure</th><td>Fig. A1.${esc(r.figure)}</td></tr>
          <tr><th>Dimensions</th><td>${Math.round(r.geom.long)} × ${Math.round(r.geom.short)} mm · AR ${fmt(r.geom.ar,2)}</td></tr>
          <tr><th>NFL</th><td>${r.ok?fmt(r.nfl,2)+" kPa":"REVIEW"}</td></tr>
          <tr><th>GTF</th><td>${r.gtfReview?"REVIEW":fmt(r.gtf,2)}</td></tr>
          <tr><th>LSF</th><td>${r.lsf==null?"N/A":fmt(r.lsf,3)}</td></tr>
          <tr><th>Load Resistance LR</th><td>${r.lr==null?"—":fmt(r.lr,2)+" kPa"} · <b class="${statusClass(r.strengthStatus)}">${esc(r.strengthStatus)}</b></td></tr>
          <tr><th>Strength check</th><td>${esc(r.strengthReason)}</td></tr>
          <tr><th>Applied load to lite</th><td>${fmt(d.appliedLoad,3)} kPa</td></tr>
          <tr><th>Maximum deflection</th><td>${d.ok?fmt(d.w,1)+" mm":"REVIEW"}</td></tr>
          <tr><th>Deflection criterion</th><td>${esc(r.deflectionLimit?.label)}${r.deflectionLimit?.limit!=null?" · "+fmt(r.deflectionLimit.limit,1)+" mm":""}</td></tr>
          <tr><th>Deflection check</th><td><b class="${statusClass(r.deflectionStatus)}">${esc(r.deflectionStatus)}</b> · ${esc(r.deflectionReason)}</td></tr>
          <tr><th>Deflection method</th><td>${esc(d.method||"—")}</td></tr>
        </table>
      </section>`;
  }

  function finalStatus(arr){
    if(arr.some(r=>r.finalStatus==="FAIL")) return "FAIL";
    if(arr.some(r=>r.finalStatus==="REVIEW")) return "REVIEW";
    return "PASS";
  }

  function generate(latest){
    const arr=[latest.outer,latest.inner].filter(Boolean);
    if(!arr.length){ alert("Please calculate ASTM results first."); return; }

    const employee=localStorage.getItem("glassEmployee")||"—";
    const dpt=DPTWind.getLast();
    const used=DPTWind.getUsedPressure();
    const final=finalStatus(arr);
    const project=document.getElementById("projectName")?.value||"";
    const client=document.getElementById("clientName")?.value||"";
    const ref=document.getElementById("reportRef")?.value||"";
    const assembly=document.getElementById("assembly")?.selectedOptions?.[0]?.textContent||"";
    const support=document.getElementById("support")?.selectedOptions?.[0]?.textContent||"";
    const duration=document.getElementById("duration")?.selectedOptions?.[0]?.textContent||"";
    const criterion=document.getElementById("deflectionCriterion")?.selectedOptions?.[0]?.textContent||"";
    const width=document.getElementById("width")?.value;
    const height=document.getElementById("height")?.value;
    const dt=new Date();
    const stamp=dt.toLocaleString();
    const reportId=`CSG-${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,"0")}${String(dt.getDate()).padStart(2,"0")}-${String(dt.getHours()).padStart(2,"0")}${String(dt.getMinutes()).padStart(2,"0")}`;

    const strengthRows=arr.map(r=>({label:`${r.name} Lite`,value:r.lr||0,limit:used,unit:"kPa"}));
    const deflRows=arr.filter(r=>r.deflection?.ok && r.deflectionLimit?.limit!=null)
                      .map(r=>({label:`${r.name} Lite`,value:r.deflection.w,limit:r.deflectionLimit.limit,unit:"mm"}));

    const chartImgs=arr.map(r=>{
      const src=new URL(`A1_${String(r.figure).padStart(2,"0")}.png`, location.href).href;
      return `<div class="sourceChart"><h4>${esc(r.name)} Lite · ASTM Fig. A1.${r.figure}</h4><img src="${src}" alt="ASTM Fig. A1.${r.figure}"></div>`;
    }).join("");

    const report = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${esc(reportId)} Glass Wind Design Report</title>
      <style>
      @page{size:A4;margin:13mm}*{box-sizing:border-box}body{font-family:Arial,system-ui,sans-serif;color:#101828;margin:0;background:#fff;font-size:11px;line-height:1.45}
      .top{border-bottom:4px solid #175cd3;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;gap:20px}.brand{font-weight:900;color:#175cd3;letter-spacing:.08em}.title{font-size:23px;font-weight:900;margin:3px 0}.meta{text-align:right;color:#475467}
      h2{font-size:15px;border-bottom:1px solid #d0d5dd;padding-bottom:5px;margin-top:18px}h3{font-size:13px;margin:8px 0}h4{font-size:11px;margin:6px 0}
      table{width:100%;border-collapse:collapse;margin:7px 0 12px}th,td{border:1px solid #d0d5dd;padding:6px 7px;text-align:left;vertical-align:top}th{background:#f2f4f7;width:33%}
      .final{padding:12px 14px;border:2px solid;border-radius:10px;margin:12px 0}.final.PASS{border-color:#12b76a;background:#ecfdf3}.final.FAIL{border-color:#f04438;background:#fef3f2}.final.REVIEW{border-color:#f79009;background:#fffaeb}.final strong{font-size:27px}
      .pass,.PASS{color:#067647}.fail,.FAIL{color:#b42318}.review,.REVIEW{color:#b54708}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.reportChart{break-inside:avoid;border:1px solid #e4e7ec;border-radius:9px;padding:8px;margin:10px 0}.reportChart svg{width:100%;height:auto}
      .liteBlock{break-inside:avoid}.sourceCharts{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sourceChart{break-inside:avoid}.sourceChart img{width:100%;border:1px solid #d0d5dd}
      .note{padding:8px;background:#fffaeb;border:1px solid #fedf89;border-radius:8px}.actions{position:sticky;top:0;background:#fff;padding:8px 0;border-bottom:1px solid #e4e7ec;margin-bottom:12px}.actions button{padding:8px 12px;border:0;border-radius:7px;background:#175cd3;color:#fff;font-weight:700;margin-right:6px}.small{color:#667085;font-size:9.5px}
      @media print{.actions{display:none}.sourceCharts{grid-template-columns:1fr 1fr}a{color:inherit;text-decoration:none}}
      @media(max-width:700px){.grid2,.sourceCharts{grid-template-columns:1fr}.top{display:block}.meta{text-align:left;margin-top:8px}}
      </style></head><body>
      <div class="actions"><button onclick="window.print()">Print / Save PDF</button><button onclick="downloadHtml()">Download HTML</button></div>
      <div class="top"><div><div class="brand">CS ECO GLASS</div><div class="title">Glass Wind Design Report</div><div>Thailand DPT + ASTM E1300</div></div><div class="meta"><b>${esc(reportId)}</b><br>${esc(stamp)}<br>Prepared by: <b>${esc(employee)}</b></div></div>

      <table><tr><th>Project</th><td>${esc(project||"—")}</td><th>Client</th><td>${esc(client||"—")}</td></tr>
      <tr><th>Reference</th><td>${esc(ref||"—")}</td><th>Panel size</th><td>${esc(width)} × ${esc(height)} mm</td></tr>
      <tr><th>Assembly</th><td>${esc(assembly)}</td><th>Support</th><td>${esc(support)}</td></tr>
      <tr><th>Load duration</th><td>${esc(duration)}</td><th>Deflection criterion</th><td>${esc(criterion)}</td></tr></table>

      <div class="final ${final}"><div>FINAL RESULT</div><strong>${final}</strong><div>Design Wind Pressure Used: <b>${fmt(used,2)} kPa</b></div></div>

      <h2>1. DPT Wind Design</h2>
      ${dpt?`<table>
        <tr><th>Location</th><td>${esc(dpt.province)}</td><th>DPT Group</th><td>${esc(dpt.group)}</td></tr>
        <tr><th>Installation height</th><td>${fmt(dpt.z,1)} m</td><th>Terrain used</th><td>${esc(dpt.terrainUsed)}</td></tr>
        <tr><th>V50</th><td>${fmt(dpt.v50,0)} m/s</td><th>TF / V used</th><td>${fmt(dpt.tf,2)} / ${fmt(dpt.V,2)} m/s</td></tr>
        <tr><th>q</th><td>${fmt(dpt.q,3)} kPa</td><th>Ce / Iw</th><td>${fmt(dpt.Ce,3)} / ${fmt(dpt.Iw,2)}</td></tr>
        <tr><th>Cg / Cgi</th><td>${fmt(dpt.Cg,2)} / ${fmt(dpt.Cgi,2)}</td><th>Cp / Cpi</th><td>${fmt(dpt.Cp,2)} / ${fmt(dpt.cpiMin,2)} to ${fmt(dpt.cpiMax,2)}</td></tr>
        <tr><th>DPT suggested pressure</th><td>${fmt(dpt.suggested,2)} kPa</td><th>Pressure used</th><td><b>${fmt(used,2)} kPa</b></td></tr>
      </table>${windChart(dpt,used)}`:"<p>DPT calculation not available.</p>"}

      <h2>2. ASTM E1300 Strength & Deflection</h2>
      ${arr.map(r=>liteTable(r,used)).join("")}

      <h2>3. Engineering Charts</h2>
      ${barChart("Load resistance vs design pressure", strengthRows)}
      ${deflRows.length?barChart("Calculated deflection vs allowable limit",deflRows):'<div class="note">Deflection comparison chart unavailable because one or more lites require REVIEW or no numeric allowable limit is selected.</div>'}

      <h2>4. ASTM Source Figures</h2>
      <div class="sourceCharts">${chartImgs}</div>

      <h2>5. Basis & Notes</h2>
      <div class="note">
      <b>Wind:</b> DPT มยผ.1311-50 simple-method pre-check. The final Design Wind Pressure Used may be manually overridden by the user.<br>
      <b>Strength:</b> PASS when ASTM Load Resistance LR ≥ Design Wind Pressure Used; FAIL when LR is lower.<br>
      <b>Deflection:</b> the selected Thailand Typical criterion is a project criterion: allowable = min(short dimension / 90, 20 mm). ASTM E1300 itself requires deflection review and does not establish this as a universal glass limit.<br>
      <b>Review:</b> any configuration outside the implemented/digitized calculation range is reported as REVIEW rather than extrapolated.
      </div>
      <p class="small">Generated by CS ECO GLASS internal calculation tool V8.5. This report records the inputs and implemented calculation logic at the time of generation and should be reviewed against project-specific specifications and authority requirements.</p>
      <script>
      function downloadHtml(){const b=new Blob([document.documentElement.outerHTML],{type:"text/html"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="${esc(reportId)}.html";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
      <\/script></body></html>`;

    const w=window.open("","_blank");
    if(!w){ alert("Popup blocked. Please allow popups for this site."); return; }
    w.document.open(); w.document.write(report); w.document.close();
  }

  return {generate};
})();
