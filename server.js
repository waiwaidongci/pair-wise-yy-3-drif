import http from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "data", "core-slices.json");
const port = Number(process.env.PORT || 3025);
const statuses = ["待切割", "制片中", "待观察", "已交付"];
const taskSteps = ["取样", "切割", "研磨", "染色", "观察"];

const seed = {
  samples: [
    {
      id: "CORE-001",
      project: "东岭铜矿薄片",
      borehole: "ZK-17",
      coreBox: "BX-09",
      depth: "128.4-128.8m",
      owner: "陆川",
      status: "制片中",
      delivery: "未交付",
      activeDeliveryId: null,
      deliveries: [],
      slices: [
        { id: "SL-001-A", method: "茜素红染色", observation: "", status: "研磨", logs: [{ at: "2026-06-12T10:00:00.000Z", step: "取样", note: "截取含矿化条带位置" }, { at: "2026-06-13T11:20:00.000Z", step: "切割", note: "完成粗切" }] }
      ]
    }
  ],
  idempotency: {}
};

function normalize(db) {
  if (!db || typeof db !== "object") db = { samples: [] };
  if (!Array.isArray(db.samples)) db.samples = [];
  if (!db.idempotency || typeof db.idempotency !== "object") db.idempotency = {};
  for (const sample of db.samples) {
    if (!Array.isArray(sample.slices)) sample.slices = [];
    if (!Array.isArray(sample.deliveries)) sample.deliveries = [];
    if (sample.delivery !== "已交付") { sample.delivery = "未交付"; sample.activeDeliveryId = null; }
    for (const slice of sample.slices) if (!Array.isArray(slice.logs)) slice.logs = [];
  }
  return db;
}

async function loadDb() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
  }
  return normalize(JSON.parse(await readFile(dbPath, "utf8")));
}
async function saveDb(db) {
  const tmp = `${dbPath}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, dbPath);
}
async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}
function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

// 所有读写串行执行，并发请求逐一落盘，不会互相覆盖
let queue = Promise.resolve();
function withLock(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}

// 变更统一入口：携带相同 Idempotency-Key 的请求只执行一次，后续直接返回首个结果
async function mutate(req, res, handler) {
  const key = req.headers["idempotency-key"];
  const outcome = await withLock(async () => {
    const db = await loadDb();
    if (key && db.idempotency[key]) return db.idempotency[key];
    const result = await handler(db);
    if (key && result.status < 300) {
      db.idempotency[key] = { status: result.status, body: result.body };
      const keys = Object.keys(db.idempotency);
      if (keys.length > 200) delete db.idempotency[keys[0]];
    }
    await saveDb(db);
    return result;
  });
  sendJson(res, outcome.status, outcome.body);
}

function updateSampleStatus(sample) {
  if (sample.delivery === "已交付") { sample.status = "已交付"; return; }
  const sliceStatuses = sample.slices.map(slice => slice.status);
  if (sliceStatuses.length && sliceStatuses.every(step => step === "观察")) sample.status = "待观察";
  else if (sliceStatuses.some(step => ["取样", "切割", "研磨", "染色"].includes(step))) sample.status = "制片中";
  else sample.status = "待切割";
}

// 交付后任何变更都会撤回当前交付：快照保留并标记撤回，状态按现有切片重算
function revokeDelivery(sample, reason) {
  if (sample.delivery !== "已交付") return null;
  const active = sample.deliveries.find(d => d.id === sample.activeDeliveryId && !d.revokedAt)
    || sample.deliveries.find(d => !d.revokedAt);
  if (active) {
    active.revokedAt = new Date().toISOString();
    active.revokeReason = reason;
  }
  sample.delivery = "未交付";
  sample.activeDeliveryId = null;
  return active;
}

function deliveryBlockers(sample) {
  const blockers = [];
  if (!sample.slices.length) blockers.push("样本下没有切片");
  for (const slice of sample.slices) {
    if (!slice.method || !String(slice.method).trim()) blockers.push(`切片 ${slice.id} 缺少染色方法`);
    if (!slice.observation || !String(slice.observation).trim()) blockers.push(`切片 ${slice.id} 缺少观察结论`);
    const done = new Set((slice.logs || []).map(log => log.step));
    const undone = taskSteps.filter(step => !done.has(step));
    if (undone.length) blockers.push(`切片 ${slice.id} 步骤未完成：${undone.join("、")}`);
  }
  return blockers;
}

const page = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>岩芯样本交付复核台</title>
  <style>
    :root { --bg:#f1f3ef; --panel:#fff; --ink:#242822; --muted:#687062; --line:#d7ddd1; --accent:#526f43; --danger:#a4372a; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; gap:16px; }
    h1 { margin:0; font-size:26px; } main { display:grid; grid-template-columns:390px 1fr; gap:22px; padding:22px 28px; }
    form,.panel,.card,.stat { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; } h2 { margin:0 0 12px; font-size:18px; } h4 { margin:12px 0 6px; font-size:15px; }
    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; } input,select,textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; background:#fff; } textarea { min-height:60px; }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:10px 13px; font-weight:700; cursor:pointer; white-space:nowrap; }
    button:disabled { opacity:.6; cursor:default; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; margin-bottom:14px; } .stat strong { display:block; font-size:24px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:12px; } .card { display:grid; gap:8px; align-content:start; }
    .meta { color:var(--muted); font-size:13px; } .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; }
    .pill.ok { background:var(--accent); color:#fff; border-color:var(--accent); }
    .slice { border-top:1px solid var(--line); padding-top:10px; display:grid; gap:6px; }
    .row { display:flex; gap:8px; align-items:center; } .row button { flex:none; }
    .steps { display:flex; gap:6px; flex-wrap:wrap; }
    .step { border:1px solid var(--line); border-radius:999px; padding:2px 8px; font-size:12px; color:var(--muted); }
    .step.done { background:#e7f0e2; color:#3c5a2e; border-color:#b9cfb0; }
    .msg { color:var(--danger); font-size:13px; white-space:pre-line; } .msg:empty { display:none; } .msg.ok { color:var(--accent); }
    .deliv { border-top:1px dashed var(--line); padding:6px 0; font-size:13px; } .deliv summary { cursor:pointer; }
    @media (max-width:950px){ header{display:block;padding:18px 16px;} main{grid-template-columns:1fr;padding:16px;} }
  </style>
</head>
<body>
  <header><div><h1>岩芯样本交付复核台</h1><div class="meta">切片编号查重 · 交付缺项校验 · 变更即撤回 · 快照历史可查</div></div><button id="reload">刷新</button></header>
  <main>
    <form id="form">
      <h2>创建岩芯样本</h2>
      <label>项目</label><input name="project" required>
      <label>钻孔编号</label><input name="borehole" required>
      <label>岩芯箱号</label><input name="coreBox" required>
      <label>取样深度</label><input name="depth" required>
      <label>负责人</label><input name="owner" required>
      <label>初始切片编号</label><input name="sliceId" required>
      <label>染色方法（可后补）</label><input name="method">
      <button>保存样本</button>
      <div class="msg" id="formMsg"></div>
    </form>
    <section>
      <div class="stats" id="stats"></div>
      <div class="grid" id="samples"></div>
    </section>
  </main>
  <script>
    const statuses = ${JSON.stringify(statuses)};
    const steps = ${JSON.stringify(taskSteps)};
    const form = document.querySelector("#form");
    const formMsg = document.querySelector("#formMsg");
    const stats = document.querySelector("#stats");
    const samplesEl = document.querySelector("#samples");
    let samples = [];
    function esc(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    }
    function fmt(iso) {
      if (!iso) return "-";
      const d = new Date(iso);
      return isNaN(d) ? iso : d.toLocaleString("zh-CN", { hour12: false });
    }
    async function api(path, options) {
      const res = await fetch(path, options && options.body ? { ...options, headers: { "Content-Type": "application/json" } } : options);
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || data.error || "请求失败");
        err.missing = data.missing || [];
        throw err;
      }
      return data;
    }
    function statHtml(label, count) {
      return '<div class="stat"><span>' + label + '</span><strong>' + count + '</strong></div>';
    }
    function stepBadges(slice) {
      const done = new Set((slice.logs || []).map(log => log.step));
      return '<div class="steps">' + steps.map(step => '<span class="step ' + (done.has(step) ? "done" : "todo") + '">' + step + (done.has(step) ? " ✓" : " ✗") + '</span>').join("") + '</div>';
    }
    function sliceHtml(sample, slice) {
      const key = sample.id + "|" + slice.id;
      let html = '<div class="slice"><div><b>' + esc(slice.id) + '</b> <span class="pill">当前步骤：' + esc(slice.status) + '</span></div>';
      html += stepBadges(slice);
      html += '<div class="meta">染色方法：' + (slice.method ? esc(slice.method) : "未填写") + ' · 观察结论：' + (slice.observation ? esc(slice.observation) : "未填写") + '</div>';
      html += '<div class="row"><input data-method-edit="' + esc(key) + '" value="' + esc(slice.method) + '" placeholder="填写或修改染色方法"><button data-save-method="' + esc(key) + '">保存方法</button></div>';
      html += '<select data-step="' + esc(key) + '">' + steps.map(step => '<option>' + step + '</option>').join("") + '</select>';
      html += '<textarea data-note="' + esc(key) + '" placeholder="步骤备注；记录观察步骤时在此填写观察结论"></textarea>';
      html += '<button data-log="' + esc(key) + '">记录步骤</button>';
      html += '<div class="meta">' + (slice.logs || []).map(log => esc(log.step) + "：" + esc(log.note)).join(" / ") + '</div></div>';
      return html;
    }
    function deliveriesHtml(sample) {
      const list = sample.deliveries || [];
      if (!list.length) return '<div class="meta">暂无交付记录</div>';
      return list.map(d => {
        const state = d.revokedAt ? '已撤回（' + esc(d.revokeReason || "未注明原因") + '）' : '当前有效';
        let html = '<details class="deliv"><summary>' + esc(d.id) + ' · ' + fmt(d.at) + ' · ' + state + '</summary>';
        html += '<div class="meta">快照时间：' + fmt(d.at) + (d.revokedAt ? ' · 撤回时间：' + fmt(d.revokedAt) : '') + '</div>';
        html += (d.slices || []).map(s => '<div class="meta">切片 ' + esc(s.id) + ' · ' + esc(s.method || "未填写染色方法") + ' · 结论：' + esc(s.observation || "无") + '</div>').join("");
        return html + '</details>';
      }).join("");
    }
    function cardHtml(sample) {
      const delivered = sample.delivery === "已交付";
      const active = (sample.deliveries || []).find(d => !d.revokedAt);
      let html = '<article class="card"><h3>' + esc(sample.project) + '</h3>';
      html += '<div><span class="pill">' + esc(sample.status) + '</span> <span class="pill ' + (delivered ? "ok" : "") + '">' + esc(sample.delivery) + '</span></div>';
      html += '<div class="meta">' + esc(sample.id) + ' · ' + esc(sample.borehole) + ' · ' + esc(sample.coreBox) + ' · ' + esc(sample.depth) + ' · ' + esc(sample.owner) + '</div>';
      if (delivered && active) html += '<div class="meta">本次交付：' + esc(active.id) + ' · ' + fmt(active.at) + '（再次提交将沿用该记录）</div>';
      html += '<div class="msg" data-msg="' + esc(sample.id) + '"></div>';
      html += '<label>新增切片（编号不可重复）</label><div class="row"><input data-new-slice="' + esc(sample.id) + '" placeholder="切片编号"><input data-method="' + esc(sample.id) + '" placeholder="染色方法"><button data-add="' + esc(sample.id) + '">添加</button></div>';
      html += sample.slices.map(slice => sliceHtml(sample, slice)).join("");
      html += '<button data-deliver="' + esc(sample.id) + '">' + (delivered ? "再次交付（沿用首次记录）" : "交付复核") + '</button>';
      html += '<h4>交付历史（含已撤回快照）</h4>' + deliveriesHtml(sample);
      return html + '</article>';
    }
    function showMsg(sampleId, text, ok) {
      const el = document.querySelector('[data-msg="' + sampleId + '"]');
      if (el) { el.textContent = text; el.classList.toggle("ok", !!ok); }
    }
    function render() {
      const deliveredCount = samples.filter(s => s.delivery === "已交付").length;
      const snapshots = samples.flatMap(s => s.deliveries || []);
      stats.innerHTML = statuses.map(s => statHtml(s, samples.filter(item => item.status === s).length)).join("")
        + statHtml("未交付", samples.length - deliveredCount)
        + statHtml("交付记录", snapshots.length)
        + statHtml("已撤回", snapshots.filter(d => d.revokedAt).length);
      samplesEl.innerHTML = samples.map(cardHtml).join("");
      document.querySelectorAll("[data-step]").forEach(sel => {
        const parts = sel.dataset.step.split("|");
        const sample = samples.find(s => s.id === parts[0]);
        const slice = sample && sample.slices.find(s => s.id === parts[1]);
        if (slice) sel.value = slice.status;
      });
      document.querySelectorAll("[data-add]").forEach(btn => btn.onclick = async () => {
        const id = btn.dataset.add;
        try {
          await api("/api/samples/" + id + "/slices", { method: "POST", body: JSON.stringify({
            id: document.querySelector('[data-new-slice="' + id + '"]').value,
            method: document.querySelector('[data-method="' + id + '"]').value
          }) });
          await load();
        } catch (err) { showMsg(id, err.message); }
      });
      document.querySelectorAll("[data-save-method]").forEach(btn => btn.onclick = async () => {
        const parts = btn.dataset.saveMethod.split("|");
        try {
          await api("/api/samples/" + parts[0] + "/slices/" + parts[1] + "/method", { method: "POST", body: JSON.stringify({
            method: document.querySelector('[data-method-edit="' + parts[0] + "|" + parts[1] + '"]').value
          }) });
          await load();
        } catch (err) { showMsg(parts[0], err.message); }
      });
      document.querySelectorAll("[data-log]").forEach(btn => btn.onclick = async () => {
        const parts = btn.dataset.log.split("|");
        try {
          await api("/api/samples/" + parts[0] + "/slices/" + parts[1] + "/logs", { method: "POST", body: JSON.stringify({
            step: document.querySelector('[data-step="' + parts[0] + "|" + parts[1] + '"]').value,
            note: document.querySelector('[data-note="' + parts[0] + "|" + parts[1] + '"]').value || "步骤完成"
          }) });
          await load();
        } catch (err) { showMsg(parts[0], err.message); }
      });
      document.querySelectorAll("[data-deliver]").forEach(btn => btn.onclick = async () => {
        const id = btn.dataset.deliver;
        btn.disabled = true;
        try {
          const result = await api("/api/samples/" + id + "/deliver", { method: "POST", body: JSON.stringify({}) });
          await load();
          showMsg(id, result.reused ? "样本此前已交付，沿用首次交付记录 " + result.delivery.id : "交付成功，快照 " + result.delivery.id + " 已存档", true);
        } catch (err) {
          showMsg(id, err.missing && err.missing.length ? "不得交付，缺项如下：\\n· " + err.missing.join("\\n· ") : err.message);
        }
      });
    }
    async function load() { samples = await api("/api/samples"); render(); }
    document.querySelector("#reload").onclick = load;
    form.onsubmit = async event => {
      event.preventDefault();
      formMsg.textContent = "";
      try {
        await api("/api/samples", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
        form.reset();
        await load();
      } catch (err) { formMsg.textContent = err.message; }
    };
    load();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(page);
    }
    if (req.method === "GET" && url.pathname === "/api/samples") {
      const samples = await withLock(async () => (await loadDb()).samples);
      return sendJson(res, 200, samples);
    }
    const deliveriesMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/deliveries$/);
    if (deliveriesMatch && req.method === "GET") {
      const result = await withLock(async () => {
        const db = await loadDb();
        const sample = db.samples.find(item => item.id === deliveriesMatch[1]);
        return sample
          ? { status: 200, body: sample.deliveries }
          : { status: 404, body: { error: "sample_not_found", message: "样本不存在" } };
      });
      return sendJson(res, result.status, result.body);
    }
    if (req.method === "POST" && url.pathname === "/api/samples") {
      const input = await body(req);
      return mutate(req, res, db => {
        const sliceId = String(input.sliceId || "").trim();
        if (!sliceId) return { status: 400, body: { error: "slice_id_required", message: "初始切片编号不能为空" } };
        const sample = {
          id: `CORE-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          project: input.project, borehole: input.borehole, coreBox: input.coreBox,
          depth: input.depth, owner: input.owner,
          status: "待切割", delivery: "未交付", activeDeliveryId: null, deliveries: [],
          slices: [{ id: sliceId, method: String(input.method || "").trim(), observation: "", status: "取样", logs: [{ at: new Date().toISOString(), step: "取样", note: "创建初始切片任务" }] }]
        };
        updateSampleStatus(sample);
        db.samples.unshift(sample);
        return { status: 201, body: sample };
      });
    }
    const addSlice = url.pathname.match(/^\/api\/samples\/([^/]+)\/slices$/);
    if (addSlice && req.method === "POST") {
      const input = await body(req);
      return mutate(req, res, db => {
        const sample = db.samples.find(item => item.id === addSlice[1]);
        if (!sample) return { status: 404, body: { error: "sample_not_found", message: "样本不存在" } };
        const sliceId = String(input.id || "").trim();
        if (!sliceId) return { status: 400, body: { error: "slice_id_required", message: "切片编号不能为空" } };
        if (sample.slices.some(slice => slice.id === sliceId)) {
          return { status: 409, body: { error: "duplicate_slice_id", message: `切片编号 ${sliceId} 在该样本下已存在` } };
        }
        sample.slices.push({ id: sliceId, method: String(input.method || "").trim(), observation: "", status: "取样", logs: [{ at: new Date().toISOString(), step: "取样", note: "新增切片任务" }] });
        revokeDelivery(sample, "新增切片");
        updateSampleStatus(sample);
        return { status: 201, body: sample };
      });
    }
    const methodMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/slices\/([^/]+)\/method$/);
    if (methodMatch && req.method === "POST") {
      const input = await body(req);
      return mutate(req, res, db => {
        const sample = db.samples.find(item => item.id === methodMatch[1]);
        if (!sample) return { status: 404, body: { error: "sample_not_found", message: "样本不存在" } };
        const slice = sample.slices.find(item => item.id === methodMatch[2]);
        if (!slice) return { status: 404, body: { error: "slice_not_found", message: "切片不存在" } };
        const method = String(input.method || "").trim();
        if (!method) return { status: 400, body: { error: "method_required", message: "染色方法不能为空" } };
        if (method !== slice.method) {
          slice.method = method;
          slice.logs.push({ at: new Date().toISOString(), step: "改方法", note: `染色方法调整为：${method}` });
          revokeDelivery(sample, "修改染色方法");
          updateSampleStatus(sample);
        }
        return { status: 200, body: sample };
      });
    }
    const logMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/slices\/([^/]+)\/logs$/);
    if (logMatch && req.method === "POST") {
      const input = await body(req);
      return mutate(req, res, db => {
        const sample = db.samples.find(item => item.id === logMatch[1]);
        if (!sample) return { status: 404, body: { error: "sample_not_found", message: "样本不存在" } };
        const slice = sample.slices.find(item => item.id === logMatch[2]);
        if (!slice) return { status: 404, body: { error: "slice_not_found", message: "切片不存在" } };
        const step = String(input.step || "");
        if (!taskSteps.includes(step)) return { status: 400, body: { error: "invalid_step", message: "步骤无效" } };
        const note = String(input.note || "").trim();
        slice.status = step;
        if (step === "观察" && note) slice.observation = note;
        slice.logs.push({ at: new Date().toISOString(), step, note });
        revokeDelivery(sample, "补录步骤");
        updateSampleStatus(sample);
        return { status: 200, body: sample };
      });
    }
    const deliverMatch = url.pathname.match(/^\/api\/samples\/([^/]+)\/deliver$/);
    if (deliverMatch && req.method === "POST") {
      return mutate(req, res, db => {
        const sample = db.samples.find(item => item.id === deliverMatch[1]);
        if (!sample) return { status: 404, body: { error: "sample_not_found", message: "样本不存在" } };
        // 重复交付沿用首次记录，不新建快照
        const active = sample.deliveries.find(d => !d.revokedAt);
        if (sample.delivery === "已交付" && active) {
          return { status: 200, body: { sample, delivery: active, reused: true } };
        }
        const missing = deliveryBlockers(sample);
        if (missing.length) {
          return { status: 409, body: { error: "delivery_blocked", message: "存在缺项，不得交付", missing } };
        }
        const snapshot = {
          id: `DEL-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          at: new Date().toISOString(),
          slices: JSON.parse(JSON.stringify(sample.slices)),
          revokedAt: null,
          revokeReason: null
        };
        sample.deliveries.push(snapshot);
        sample.activeDeliveryId = snapshot.id;
        sample.delivery = "已交付";
        updateSampleStatus(sample);
        return { status: 201, body: { sample, delivery: snapshot, reused: false } };
      });
    }
    sendJson(res, 404, { error: "not_found", message: "接口不存在" });
  } catch (error) {
    sendJson(res, 500, { error: "server_error", message: error.message });
  }
});

server.listen(port, () => console.log(`Core slice delivery review app listening on http://localhost:${port}`));
