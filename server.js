import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "data", "core-slices.json");
const port = Number(process.env.PORT || 3025);
const statuses = ["待切割", "制片中", "待观察", "已交付"];
const taskSteps = ["取样", "切割", "研磨", "染色", "观察"];
const unspecified = "未指定";

const seed = {
  seq: { delivery: 2 },
  samples: [
    {
      id: "CORE-003",
      project: "北坡铅锌矿勘查片",
      borehole: "ZK-411",
      coreBox: "BX-21",
      depth: "312.05-312.40m",
      owner: "韩森",
      status: "已交付",
      delivery: "已交付",
      slices: [
        {
          id: "SL-003-A",
          method: "茜素红-S 染色",
          observation: "碎屑粒间胶结物均染红，为微晶方解石；裂隙未见铁白云石环带。",
          status: "观察",
          logs: [
            { at: "2026-06-28T09:10:00.000Z", step: "取样", note: "矿脉顶界位置取样" },
            { at: "2026-06-28T14:30:00.000Z", step: "切割", note: "沿层理方向粗切" },
            { at: "2026-06-29T08:50:00.000Z", step: "研磨", note: "磨至标准薄片厚度" },
            { at: "2026-06-30T10:05:00.000Z", step: "染色", note: "茜素红-S 全覆盖染色 60 秒" },
            { at: "2026-07-01T16:40:00.000Z", step: "观察", note: "碎屑粒间胶结物均染红，为微晶方解石；裂隙未见铁白云石环带。" }
          ]
        }
      ],
      deliveries: [
        {
          id: "DLV-0002",
          at: "2026-07-02T02:00:00.000Z",
          requestId: null,
          state: "有效",
          revokedAt: null,
          revokeReason: null,
          snapshot: [
            {
              id: "SL-003-A",
              method: "茜素红-S 染色",
              observation: "碎屑粒间胶结物均染红，为微晶方解石；裂隙未见铁白云石环带。",
              status: "观察",
              completedSteps: ["取样", "切割", "研磨", "染色", "观察"],
              logCount: 5
            }
          ]
        }
      ]
    },
    {
      id: "CORE-002",
      project: "南缘金矿钻孔薄片",
      borehole: "ZK-302",
      coreBox: "BX-12",
      depth: "205.10-205.50m",
      owner: "沈澄",
      status: "待观察",
      delivery: "未交付",
      slices: [
        {
          id: "SL-002-A",
          method: "茜素红+铁氰化钾复合染色",
          observation: "石英脉切穿黄铁矿化蚀变带；碳酸盐仅染红未见蓝染，判定为成矿后期方解石脉。",
          status: "观察",
          logs: [
            { at: "2026-09-08T09:00:00.000Z", step: "取样", note: "石英脉与蚀变带接触面取样" },
            { at: "2026-09-09T10:20:00.000Z", step: "切割", note: "垂直脉体切制定向片" },
            { at: "2026-09-10T11:05:00.000Z", step: "研磨", note: "研磨至 0.03mm" },
            { at: "2026-09-12T15:30:00.000Z", step: "染色", note: "茜素红后铁氰化钾套染" },
            { at: "2026-09-15T17:10:00.000Z", step: "观察", note: "石英脉切穿黄铁矿化蚀变带；碳酸盐仅染红未见蓝染，判定为成矿后期方解石脉。" }
          ]
        }
      ],
      deliveries: []
    },
    {
      id: "CORE-004",
      project: "西断层角砾岩复查片",
      borehole: "ZK-188",
      coreBox: "BX-07",
      depth: "88.60-88.95m",
      owner: "陆川",
      status: "制片中",
      delivery: "未交付",
      slices: [
        {
          id: "SL-004-A",
          method: "铁氰化钾染色",
          observation: "角砾间碳酸盐胶结物局部蓝染，疑含铁白云石，待复片确认。",
          status: "染色",
          logs: [
            { at: "2026-06-18T09:40:00.000Z", step: "取样", note: "断层角砾岩带取样" },
            { at: "2026-06-19T11:10:00.000Z", step: "切割", note: "粗切两枚备用" },
            { at: "2026-06-20T13:25:00.000Z", step: "研磨", note: "磨至标准厚度" },
            { at: "2026-06-22T10:00:00.000Z", step: "染色", note: "铁氰化钾染色 45 秒" },
            { at: "2026-06-24T16:00:00.000Z", step: "观察", note: "角砾间碳酸盐胶结物局部蓝染，疑含铁白云石，待复片确认。" },
            { at: "2026-06-26T09:30:00.000Z", step: "染色", note: "复片补染：铁氰化钾复查铁白云石环带" }
          ]
        }
      ],
      deliveries: [
        {
          id: "DLV-0001",
          at: "2026-06-25T01:30:00.000Z",
          requestId: null,
          state: "已撤回",
          revokedAt: "2026-06-26T09:30:00.000Z",
          revokeReason: "补录切片 SL-004-A 步骤「染色」",
          snapshot: [
            {
              id: "SL-004-A",
              method: "铁氰化钾染色",
              observation: "角砾间碳酸盐胶结物局部蓝染，疑含铁白云石，待复片确认。",
              status: "观察",
              completedSteps: ["取样", "切割", "研磨", "染色", "观察"],
              logCount: 5
            }
          ]
        }
      ]
    },
    {
      id: "CORE-001",
      project: "东岭铜矿薄片",
      borehole: "ZK-17",
      coreBox: "BX-09",
      depth: "128.4-128.8m",
      owner: "陆川",
      status: "制片中",
      delivery: "未交付",
      slices: [
        {
          id: "SL-001-A",
          method: "茜素红染色",
          observation: "",
          status: "研磨",
          logs: [
            { at: "2026-06-12T10:00:00.000Z", step: "取样", note: "截取含矿化条带位置" },
            { at: "2026-06-13T11:20:00.000Z", step: "切割", note: "完成粗切" }
          ]
        }
      ],
      deliveries: []
    }
  ]
};

async function loadDb() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
  }
  return JSON.parse(await readFile(dbPath, "utf8"));
}
async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return Object.assign(new Error("invalid_json"), { invalidJson: true });
  }
}
function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

// ---- 复核规则 ----
function completedStepsOf(slice) {
  return taskSteps.filter(step => slice.logs.some(log => log.step === step));
}
function hasMethod(slice) {
  return Boolean(slice.method && slice.method.trim() && slice.method !== unspecified);
}
function deliveryIssues(sample) {
  const issues = [];
  if (!sample.slices.length) {
    issues.push("样本尚无切片，无法交付");
    return issues;
  }
  for (const slice of sample.slices) {
    if (!hasMethod(slice)) issues.push(`切片 ${slice.id}：缺少染色方法`);
    if (!slice.observation || !slice.observation.trim()) issues.push(`切片 ${slice.id}：缺少观察结论`);
    const done = new Set(slice.logs.map(log => log.step));
    const missing = taskSteps.filter(step => !done.has(step));
    if (missing.length) issues.push(`切片 ${slice.id}：未完成步骤（${missing.join("、")}）`);
  }
  return issues;
}
function snapshotOf(sample) {
  return sample.slices.map(slice => ({
    id: slice.id,
    method: slice.method,
    observation: slice.observation,
    status: slice.status,
    completedSteps: completedStepsOf(slice),
    logCount: slice.logs.length
  }));
}
function activeDelivery(sample) {
  return sample.deliveries.find(record => record.state === "有效") || null;
}
function updateSampleStatus(sample) {
  if (sample.delivery === "已交付") { sample.status = "已交付"; return; }
  const sliceStatuses = sample.slices.map(slice => slice.status);
  if (!sliceStatuses.length) { sample.status = "待切割"; return; }
  if (sliceStatuses.every(step => step === "观察")) { sample.status = "待观察"; return; }
  if (sliceStatuses.some(step => ["取样", "切割", "研磨", "染色"].includes(step))) sample.status = "制片中";
  else sample.status = "待切割";
}
function revokeDelivery(sample, reason) {
  if (sample.delivery !== "已交付") return null;
  const record = activeDelivery(sample);
  const at = new Date().toISOString();
  if (record) {
    record.state = "已撤回";
    record.revokedAt = at;
    record.revokeReason = reason;
  }
  sample.delivery = "未交付";
  updateSampleStatus(sample);
  return record;
}

// ---- 串行化与并发去重 ----
const chains = new Map();
function withLock(key, task) {
  const prev = chains.get(key) || Promise.resolve();
  let release;
  const next = new Promise(resolve => { release = resolve; });
  chains.set(key, prev.then(() => next));
  return prev.then(() => Promise.resolve().then(task).finally(release));
}
const inflight = new Map();
function runOnce(key, task) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = Promise.resolve().then(task).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function migrate() {
  const db = await loadDb();
  let changed = false;
  if (!Array.isArray(db.samples)) { db.samples = []; changed = true; }
  if (!db.seq || typeof db.seq.delivery !== "number") { db.seq = { delivery: 0 }; changed = true; }
  for (const sample of db.samples) {
    if (!Array.isArray(sample.deliveries)) { sample.deliveries = []; changed = true; }
    if (sample.delivery === "已交付" && !activeDelivery(sample)) {
      sample.delivery = "未交付";
      changed = true;
    }
    const before = sample.status;
    updateSampleStatus(sample);
    if (before !== sample.status) changed = true;
  }
  if (changed) await saveDb(db);
}

const page = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>岩芯样本交付复核台</title>
  <style>
    :root { --bg:#f1f3ef; --panel:#fff; --ink:#242822; --muted:#687062; --line:#d7ddd1; --accent:#526f43; --warn:#9a6a1f; --warnbg:#faf2e0; --err:#9c3b32; --errbg:#fbeae8; --okbg:#eef4e8; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; gap:16px; }
    h1 { margin:0; font-size:26px; } main { display:grid; grid-template-columns:390px 1fr; gap:22px; padding:22px 28px; }
    form,.panel,.card,.stat { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; } h2 { margin:0 0 12px; font-size:18px; }
    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; } input,select,textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; background:#fff; } textarea { min-height:60px; }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:9px 12px; font-weight:700; cursor:pointer; } button.ghost { background:#eef0ea; color:var(--ink); border:1px solid var(--line); }
    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; margin-bottom:14px; } .stat strong { display:block; font-size:24px; } .stat.dlv { border-left:4px solid var(--accent); }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(360px,1fr)); gap:12px; } .card { display:grid; gap:8px; }
    .card-head { display:flex; justify-content:space-between; align-items:center; gap:8px; } .card-head h3 { margin:0; font-size:17px; }
    .meta { color:var(--muted); font-size:13px; } .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 9px; font-size:12px; background:#f6f7f3; white-space:nowrap; }
    .pill-on { background:#e3efe0; border-color:#b7cfac; color:#33502a; } .pill-off { background:#f0f0ee; color:var(--muted); } .pill-now { background:#eef3f8; border-color:#c2d2e2; color:#2f4d6b; } .pill-err { background:var(--errbg); border-color:#e0bcb6; color:var(--err); }
    .slice { border-top:1px solid var(--line); padding-top:10px; display:grid; gap:6px; } .slice-head { display:flex; justify-content:space-between; align-items:center; }
    .row { display:flex; gap:6px; align-items:center; } .row input { flex:1; } .row button { white-space:nowrap; }
    .chips { display:flex; gap:5px; flex-wrap:wrap; } .chip { font-size:12px; border:1px solid var(--line); border-radius:999px; padding:2px 8px; color:var(--muted); background:#fafaf8; } .chip.on { background:#e3efe0; border-color:#b7cfac; color:#33502a; font-weight:700; }
    .box { border-radius:6px; padding:9px 11px; font-size:13px; } .box.warn { background:var(--warnbg); color:var(--warn); border:1px solid #e6d3a8; } .box.ok { background:var(--okbg); color:#33502a; border:1px solid #c4d8b8; } .box.err { background:var(--errbg); color:var(--err); border:1px solid #e0bcb6; }
    .box ul { margin:6px 0 0; padding-left:18px; } .deliver-row { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
    .history { border-top:1px solid var(--line); padding-top:8px; } .history h4 { margin:6px 0; font-size:14px; }
    details.rec { border:1px solid var(--line); border-radius:6px; padding:7px 10px; margin-top:6px; background:#fcfcfb; } details.rec[open] { background:#fff; }
    details.rec summary { cursor:pointer; font-size:13px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .snap { border-top:1px dashed var(--line); margin-top:8px; padding-top:8px; font-size:13px; display:grid; gap:3px; }
    .logline { font-size:12px; color:var(--muted); } .addrow { display:grid; grid-template-columns:1fr 1fr auto; gap:6px; align-items:end; } .addrow label { margin:0; }
    @media (max-width:950px){ header{display:block;padding:18px 16px;} main{grid-template-columns:1fr;padding:16px;} }
  </style>
</head>
<body>
  <header><div><h1>岩芯样本交付复核台</h1><div class="meta">切片唯一性 · 交付前复核 · 变更即撤回 · 快照留痕</div></div><button id="reload">刷新</button></header>
  <main>
    <form id="form">
      <h2>创建岩芯样本</h2>
      <label>项目</label><input name="project" required>
      <label>钻孔编号</label><input name="borehole" required>
      <label>岩芯箱号</label><input name="coreBox" required>
      <label>取样深度</label><input name="depth" required>
      <label>负责人</label><input name="owner" required>
      <label>初始切片编号</label><input name="sliceId" required>
      <label>染色方法</label><input name="method" required>
      <button>保存样本</button>
    </form>
    <section>
      <div class="stats" id="stats"></div>
      <div class="grid" id="samples"></div>
    </section>
  </main>
  <script>
    const statuses = ${JSON.stringify(statuses)};
    const steps = ${JSON.stringify(taskSteps)};
    const unspecified = ${JSON.stringify(unspecified)};
    const form = document.querySelector("#form");
    const statsEl = document.querySelector("#stats");
    const samplesEl = document.querySelector("#samples");
    let samples = [];
    let stats = null;
    const feedback = {};
    const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
    const fmt = at => at ? new Date(at).toLocaleString("zh-CN", { hour12:false }) : "";
    async function api(path, options) {
      const res = await fetch(path, options && options.body ? { ...options, headers: { "Content-Type":"application/json" } } : options);
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error || "请求失败"), { data, status:res.status });
      return data;
    }
    function issuesOf(sample) {
      const issues = [];
      if (!sample.slices.length) return ["样本尚无切片，无法交付"];
      for (const slice of sample.slices) {
        if (!slice.method || !slice.method.trim() || slice.method === unspecified) issues.push("切片 " + slice.id + "：缺少染色方法");
        if (!slice.observation || !slice.observation.trim()) issues.push("切片 " + slice.id + "：缺少观察结论");
        const done = new Set(slice.logs.map(log => log.step));
        const missing = steps.filter(step => !done.has(step));
        if (missing.length) issues.push("切片 " + slice.id + "：未完成步骤（" + missing.join("、") + "）");
      }
      return issues;
    }
    function renderStats() {
      const delivery = stats.delivery || { active:0, total:0, revoked:0 };
      const cards = statuses.map(s => '<div class="stat"><span>'+s+'</span><strong>'+(stats.byStatus ? stats.byStatus[s] || 0 : 0)+'</strong></div>');
      statsEl.innerHTML = cards.join("")
        + '<div class="stat dlv"><span>有效交付</span><strong>'+delivery.active+'</strong></div>'
        + '<div class="stat dlv"><span>累计交付</span><strong>'+delivery.total+'</strong></div>'
        + '<div class="stat dlv"><span>已撤回快照</span><strong>'+delivery.revoked+'</strong></div>';
    }
    function renderSlice(sample, slice) {
      const done = new Set(slice.logs.map(log => log.step));
      const chips = '<div class="chips">' + steps.map(step => '<span class="chip' + (done.has(step) ? " on" : "") + '">'+step+"</span>").join("") + '</div>';
      const logs = slice.logs.map(log => '<div class="logline">'+fmt(log.at)+' · '+esc(log.step)+'：'+esc(log.note || "（无备注）")+'</div>').join("");
      return '<div class="slice">'
        + '<div class="slice-head"><b>'+esc(slice.id)+'</b><span class="meta">当前步骤：'+esc(slice.status)+'</span></div>'
        + '<div class="row"><span class="meta" style="white-space:nowrap">染色方法</span><input data-method="'+sample.id+'|'+esc(slice.id)+'" value="'+esc(slice.method)+'"><button class="ghost" data-change="'+sample.id+'|'+esc(slice.id)+'">改方法</button></div>'
        + '<div class="meta">观察结论：'+(slice.observation ? esc(slice.observation) : "（未填写，在「观察」步骤记录备注）")+'</div>'
        + chips
        + '<select data-step="'+sample.id+'|'+esc(slice.id)+'">'+steps.map(step => '<option>'+step+'</option>').join("")+'</select>'
        + '<textarea data-note="'+sample.id+'|'+esc(slice.id)+'" placeholder="步骤备注；记录「观察」时将作为观察结论"></textarea>'
        + '<button data-log="'+sample.id+'|'+esc(slice.id)+'">记录步骤</button>'
        + logs + '</div>';
    }
    function renderHistory(sample) {
      const records = (sample.deliveries || []).slice().reverse();
      if (!records.length) return '<div class="history"><h4>交付记录</h4><div class="meta">暂无交付快照</div></div>';
      return '<div class="history"><h4>交付记录（'+records.length+'）</h4>' + records.map(rec => {
        const valid = rec.state === "有效";
        const head = '<span class="pill ' + (valid ? "pill-on" : "pill-err") + '">'+rec.state+'</span>'
          + '<span>'+(valid ? "交付于 " : "曾交付于 ")+fmt(rec.at)+'</span><span class="meta">'+esc(rec.id)+'</span>';
        const revoke = valid ? "" : '<div class="meta" style="margin-top:6px">撤回于 '+fmt(rec.revokedAt)+' · '+esc(rec.revokeReason || "变更撤回")+'</div>';
        const snaps = (rec.snapshot || []).map(snap => '<div class="snap"><b>'+esc(snap.id)+'</b>'
          + '<div>染色方法：'+esc(snap.method)+'</div>'
          + '<div>观察结论：'+esc(snap.observation || "（空）")+'</div>'
          + '<div>交付时步骤：'+esc((snap.completedSteps || []).join("、"))+' · 记录 '+snap.logCount+' 条</div></div>').join("");
        return '<details class="rec"><summary>'+head+' 查看快照</summary>'+revoke+snaps+'</details>';
      }).join("") + '</div>';
    }
    function renderSample(sample) {
      const issues = issuesOf(sample);
      const delivered = sample.delivery === "已交付";
      const active = sample.deliveries && sample.deliveries.find(d => d.state === "有效");
      const check = delivered
        ? '<div class="box ok">交付有效中。任何新增切片、修改染色方法或补录步骤都会立即撤回本交付。</div>'
        : issues.length
          ? '<div class="box warn"><b>暂不可交付，缺项：</b><ul>'+issues.map(i => '<li>'+esc(i)+'</li>').join("")+'</ul></div>'
          : '<div class="box ok">复核通过：染色方法、观察结论与全部步骤齐备，可交付。</div>';
      const fb = feedback[sample.id];
      const fbHtml = fb ? '<div class="box '+(fb.kind === "err" ? "err" : "ok")+'">'+esc(fb.text)+'</div>' : "";
      return '<article class="card">'
        + '<div class="card-head"><h3>'+esc(sample.project)+'</h3><span class="pill pill-now">'+esc(sample.status)+'</span></div>'
        + '<div class="meta">'+esc(sample.borehole)+' · '+esc(sample.coreBox)+' · '+esc(sample.depth)+' · '+esc(sample.owner)+'</div>'
        + '<div class="deliver-row"><span class="pill '+(delivered ? "pill-on" : "pill-off")+'">'+(delivered ? "已交付 "+fmt(active && active.at) : "未交付")+'</span>'
        + '<button data-deliver="'+sample.id+'">'+(delivered ? "重复交付（沿用首次）" : "复核并交付")+'</button></div>'
        + check + fbHtml
        + '<div class="addrow"><div><label>新增切片编号</label><input data-new-slice="'+sample.id+'" placeholder="切片编号"></div>'
        + '<div><label>染色方法</label><input data-method-new="'+sample.id+'" placeholder="如：茜素红染色"></div>'
        + '<button data-add="'+sample.id+'">添加切片</button></div>'
        + sample.slices.map(slice => renderSlice(sample, slice)).join("")
        + renderHistory(sample)
        + '</article>';
    }
    function render() {
      renderStats();
      samplesEl.innerHTML = samples.map(renderSample).join("");
      bind();
    }
    function bind() {
      document.querySelectorAll("[data-step]").forEach(sel => {
        const [sampleId, sliceId] = sel.dataset.step.split("|");
        sel.value = samples.find(s => s.id === sampleId).slices.find(s => s.id === sliceId).status;
      });
      document.querySelectorAll("[data-add]").forEach(btn => btn.onclick = async () => {
        const id = btn.dataset.add;
        const sliceId = document.querySelector('[data-new-slice="'+id+'"]').value.trim();
        const method = document.querySelector('[data-method-new="'+id+'"]').value.trim();
        if (!sliceId) { feedback[id] = { kind:"err", text:"切片编号不能为空" }; render(); return; }
        try {
          await api("/api/samples/"+id+"/slices", { method:"POST", body: JSON.stringify({ id: sliceId, method: method || unspecified }) });
          feedback[id] = { kind:"ok", text:"切片 "+sliceId+" 已添加" + (samples.find(s=>s.id===id).delivery === "已交付" ? "，原交付已撤回" : "") };
        } catch (e) { feedback[id] = { kind:"err", text: e.data && e.data.message ? e.data.message : "添加失败" }; }
        await load();
      });
      document.querySelectorAll("[data-change]").forEach(btn => btn.onclick = async () => {
        const [sampleId, sliceId] = btn.dataset.change.split("|");
        const method = document.querySelector('[data-method="'+sampleId+'|'+sliceId+'"]').value.trim();
        if (!method) { feedback[sampleId] = { kind:"err", text:"染色方法不能为空" }; render(); return; }
        try {
          await api("/api/samples/"+sampleId+"/slices/"+encodeURIComponent(sliceId), { method:"PATCH", body: JSON.stringify({ method }) });
          const wasDelivered = samples.find(s => s.id === sampleId).delivery === "已交付";
          feedback[sampleId] = { kind:"ok", text:"切片 "+sliceId+" 染色方法已更新" + (wasDelivered ? "，原交付已撤回" : "") };
        } catch (e) { feedback[sampleId] = { kind:"err", text:"修改失败：" + e.message }; }
        await load();
      });
      document.querySelectorAll("[data-log]").forEach(btn => btn.onclick = async () => {
        const [sampleId, sliceId] = btn.dataset.log.split("|");
        const step = document.querySelector('[data-step="'+sampleId+'|'+sliceId+'"]').value;
        const noteEl = document.querySelector('[data-note="'+sampleId+'|'+sliceId+'"]');
        const note = noteEl.value.trim();
        if (step === "观察" && !note) { feedback[sampleId] = { kind:"err", text:"观察步骤必须填写观察结论" }; render(); return; }
        try {
          await api("/api/samples/"+sampleId+"/slices/"+encodeURIComponent(sliceId)+"/logs", { method:"POST", body: JSON.stringify({ step, note: note || "步骤完成" }) });
          const wasDelivered = samples.find(s => s.id === sampleId).delivery === "已交付";
          feedback[sampleId] = { kind:"ok", text:"切片 "+sliceId+" 步骤「"+step+"」已记录" + (wasDelivered ? "，原交付已撤回" : "") };
        } catch (e) { feedback[sampleId] = { kind:"err", text:"记录失败：" + e.message }; }
        await load();
      });
      document.querySelectorAll("[data-deliver]").forEach(btn => btn.onclick = async () => {
        const id = btn.dataset.deliver;
        btn.disabled = true;
        try {
          const data = await api("/api/samples/"+id+"/deliver", { method:"POST", headers:{ "Content-Type":"application/json", "Idempotency-Key":"ui-"+id+"-"+Date.now() }, body: JSON.stringify({}) });
          feedback[id] = data.reused
            ? { kind:"ok", text:"该样本已交付，沿用首次交付记录 " + data.delivery.id + "（" + fmt(data.delivery.at) + "），未重复生成交付。" }
            : { kind:"ok", text:"复核通过，已生成交付记录 " + data.delivery.id + "。" };
        } catch (e) {
          if (e.data && e.data.error === "delivery_not_ready") {
            feedback[id] = { kind:"err", text:"交付被驳回：" + (e.data.missing || []).join("；") };
          } else feedback[id] = { kind:"err", text:"交付失败：" + e.message };
        }
        await load();
      });
    }
    async function load() {
      const [list, statsData] = await Promise.all([api("/api/samples"), api("/api/stats")]);
      samples = list; stats = statsData; render();
    }
    document.querySelector("#reload").onclick = () => load();
    form.onsubmit = async event => {
      event.preventDefault();
      const entry = Object.fromEntries(new FormData(form).entries());
      await api("/api/samples", { method:"POST", body: JSON.stringify(entry) });
      form.reset();
      await load();
    };
    load();
  </script>
</body>
</html>`;

function buildStats(db) {
  const byStatus = {};
  for (const status of statuses) byStatus[status] = 0;
  let active = 0;
  let total = 0;
  let revoked = 0;
  for (const sample of db.samples) {
    byStatus[sample.status] = (byStatus[sample.status] || 0) + 1;
    for (const record of sample.deliveries || []) {
      total += 1;
      if (record.state === "有效") active += 1;
      if (record.state === "已撤回") revoked += 1;
    }
  }
  return { samples: db.samples.length, byStatus, delivery: { active, total, revoked } };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(page);
    }
    const db = await loadDb();
    if (req.method === "GET" && url.pathname === "/api/samples") return sendJson(res, 200, db.samples);
    if (req.method === "GET" && url.pathname === "/api/stats") return sendJson(res, 200, buildStats(db));

    const sampleOnly = url.pathname.match(/^\/api\/samples\/([^/]+)$/);
    if (sampleOnly && req.method === "GET") {
      const sample = db.samples.find(item => item.id === decodeURIComponent(sampleOnly[1]));
      if (!sample) return sendJson(res, 404, { error: "sample_not_found", message: "样本不存在" });
      return sendJson(res, 200, sample);
    }

    if (req.method === "POST" && url.pathname === "/api/samples") {
      const input = await readBody(req);
      if (input.invalidJson) return sendJson(res, 400, { error: "invalid_json" });
      return withLock("samples", async () => {
        const fresh = await loadDb();
        const now = new Date().toISOString();
        const sliceId = String(input.sliceId || "").trim();
        if (!sliceId) return sendJson(res, 400, { error: "slice_id_required", message: "切片编号不能为空" });
        const sample = {
          id: `CORE-${Date.now()}`,
          project: input.project, borehole: input.borehole, coreBox: input.coreBox, depth: input.depth, owner: input.owner,
          status: "待切割", delivery: "未交付",
          slices: [{ id: sliceId, method: (input.method || "").trim() || unspecified, observation: "", status: "取样", logs: [{ at: now, step: "取样", note: "创建初始切片任务" }] }],
          deliveries: []
        };
        updateSampleStatus(sample);
        fresh.samples.unshift(sample);
        await saveDb(fresh);
        return sendJson(res, 201, sample);
      });
    }

    const addSlice = url.pathname.match(/^\/api\/samples\/([^/]+)\/slices$/);
    if (addSlice && req.method === "POST") {
      const sampleId = decodeURIComponent(addSlice[1]);
      const input = await readBody(req);
      if (input.invalidJson) return sendJson(res, 400, { error: "invalid_json" });
      return withLock(`sample:${sampleId}`, async () => {
        const fresh = await loadDb();
        const sample = fresh.samples.find(item => item.id === sampleId);
        if (!sample) return sendJson(res, 404, { error: "sample_not_found", message: "样本不存在" });
        const sliceId = String(input.id || "").trim();
        if (!sliceId) return sendJson(res, 400, { error: "slice_id_required", message: "切片编号不能为空" });
        if (sample.slices.some(item => item.id === sliceId)) {
          return sendJson(res, 409, { error: "slice_id_conflict", message: `切片编号 ${sliceId} 在该样本下已存在，不能重复` });
        }
        const wasDelivered = sample.delivery === "已交付";
        sample.slices.push({ id: sliceId, method: (input.method || "").trim() || unspecified, observation: "", status: "取样", logs: [{ at: new Date().toISOString(), step: "取样", note: "新增切片任务" }] });
        const revoked = wasDelivered ? revokeDelivery(sample, `新增切片 ${sliceId}`) : null;
        updateSampleStatus(sample);
        await saveDb(fresh);
        return sendJson(res, 201, { sample, revoked: revoked && { id: revoked.id, reason: revoked.revokeReason } });
      });
    }

    const sliceItem = url.pathname.match(/^\/api\/samples\/([^/]+)\/slices\/([^/]+)$/);
    if (sliceItem && req.method === "PATCH") {
      const sampleId = decodeURIComponent(sliceItem[1]);
      const sliceId = decodeURIComponent(sliceItem[2]);
      const input = await readBody(req);
      if (input.invalidJson) return sendJson(res, 400, { error: "invalid_json" });
      return withLock(`sample:${sampleId}`, async () => {
        const fresh = await loadDb();
        const sample = fresh.samples.find(item => item.id === sampleId);
        if (!sample) return sendJson(res, 404, { error: "sample_not_found", message: "样本不存在" });
        const slice = sample.slices.find(item => item.id === sliceId);
        if (!slice) return sendJson(res, 404, { error: "slice_not_found", message: "切片不存在" });
        const next = String(input.method || "").trim();
        if (!next) return sendJson(res, 400, { error: "method_required", message: "染色方法不能为空" });
        if (next === (slice.method || "").trim()) return sendJson(res, 200, { sample, revoked: null });
        const wasDelivered = sample.delivery === "已交付";
        const previous = slice.method;
        slice.method = next;
        const revoked = wasDelivered ? revokeDelivery(sample, `修改切片 ${sliceId} 染色方法：${previous || unspecified} → ${next}`) : null;
        updateSampleStatus(sample);
        await saveDb(fresh);
        return sendJson(res, 200, { sample, revoked: revoked && { id: revoked.id, reason: revoked.revokeReason } });
      });
    }

    const logMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/slices\/([^/]+)\/logs$/);
    if (logMatch && req.method === "POST") {
      const sampleId = decodeURIComponent(logMatch[1]);
      const sliceId = decodeURIComponent(logMatch[2]);
      const input = await readBody(req);
      if (input.invalidJson) return sendJson(res, 400, { error: "invalid_json" });
      return withLock(`sample:${sampleId}`, async () => {
        const fresh = await loadDb();
        const sample = fresh.samples.find(item => item.id === sampleId);
        if (!sample) return sendJson(res, 404, { error: "sample_not_found", message: "样本不存在" });
        const slice = sample.slices.find(item => item.id === sliceId);
        if (!slice) return sendJson(res, 404, { error: "slice_not_found", message: "切片不存在" });
        if (!taskSteps.includes(input.step)) return sendJson(res, 400, { error: "unknown_step", message: `未知步骤：${input.step}` });
        const wasDelivered = sample.delivery === "已交付";
        slice.status = input.step;
        if (input.step === "观察" && input.note) slice.observation = String(input.note).trim();
        slice.logs.push({ at: new Date().toISOString(), step: input.step, note: input.note || "" });
        const revoked = wasDelivered ? revokeDelivery(sample, `补录切片 ${sliceId} 步骤「${input.step}」`) : null;
        updateSampleStatus(sample);
        await saveDb(fresh);
        return sendJson(res, 200, { sample, revoked: revoked && { id: revoked.id, reason: revoked.revokeReason } });
      });
    }

    const deliveriesMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/deliveries$/);
    if (deliveriesMatch && req.method === "GET") {
      const sample = db.samples.find(item => item.id === decodeURIComponent(deliveriesMatch[1]));
      if (!sample) return sendJson(res, 404, { error: "sample_not_found", message: "样本不存在" });
      return sendJson(res, 200, sample.deliveries || []);
    }

    const deliverMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/deliver$/);
    if (deliverMatch && req.method === "POST") {
      const sampleId = decodeURIComponent(deliverMatch[1]);
      await readBody(req);
      const requestId = req.headers["idempotency-key"] ? String(req.headers["idempotency-key"]) : null;
      const execute = () => withLock(`sample:${sampleId}`, async () => {
        const fresh = await loadDb();
        const sample = fresh.samples.find(item => item.id === sampleId);
        if (!sample) return { status: 404, payload: { error: "sample_not_found", message: "样本不存在" } };
        // 已交付：重复交付沿用首次记录
        if (sample.delivery === "已交付") {
          return { status: 200, payload: { reused: true, delivery: activeDelivery(sample), sample } };
        }
        // 同一请求键重放（含已被撤回的首次记录）
        if (requestId) {
          const previous = (sample.deliveries || []).find(record => record.requestId === requestId);
          if (previous) return { status: 200, payload: { reused: true, delivery: previous, sample } };
        }
        // 复核：缺项驳回并逐项指出
        const missing = deliveryIssues(sample);
        if (missing.length) return { status: 422, payload: { error: "delivery_not_ready", missing, sample } };
        fresh.seq.delivery += 1;
        const record = {
          id: `DLV-${String(fresh.seq.delivery).padStart(4, "0")}`,
          at: new Date().toISOString(),
          requestId,
          state: "有效",
          revokedAt: null,
          revokeReason: null,
          snapshot: snapshotOf(sample)
        };
        sample.deliveries.push(record);
        sample.delivery = "已交付";
        updateSampleStatus(sample);
        await saveDb(fresh);
        return { status: 201, payload: { reused: false, delivery: record, sample } };
      });
      const outcome = requestId
        ? await runOnce(`deliver:${sampleId}:${requestId}`, execute)
        : await execute();
      return sendJson(res, outcome.status, outcome.payload);
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

migrate()
  .catch(error => console.warn("启动迁移失败：", error.message))
  .then(() => {
    server.listen(port, () => console.log(`Core delivery review app listening on http://localhost:${port}`));
  });
