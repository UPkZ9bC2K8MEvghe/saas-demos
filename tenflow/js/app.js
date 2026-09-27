const KEY = "tenflow.v2";
const LIMIT = 10;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const TEMPLATES = [
  {
    name: "Form → CRM",
    trigger: { type: "form", label: "Typeform submitted", app: "Typeform" },
    action: { type: "crm", label: "Write to HubSpot", app: "HubSpot", channel: "Contacts" },
  },
  {
    name: "New order → Slack",
    trigger: { type: "shop", label: "Shopify new order", app: "Shopify" },
    action: { type: "slack", label: "Post to #orders", app: "Slack", channel: "#orders" },
  },
  {
    name: "Lead → email sequence",
    trigger: { type: "crm", label: "New lead", app: "HubSpot" },
    action: { type: "mail", label: "Start 3-email sequence", app: "Email", channel: "sequence-welcome" },
  },
  {
    name: "Webhook relay",
    trigger: { type: "hook", label: "Incoming POST", app: "Webhook" },
    action: { type: "hook", label: "Forward to target URL", app: "Webhook", channel: "https://hooks.example/lead" },
  },
];

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { flows: [], runs: [] };
  } catch {
    return { flows: [], runs: [] };
  }
}
function save(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

let state = load();
let currentId = null;

function switchTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $$(".panel").forEach((p) => p.classList.toggle("show", p.id === `panel-${name}`));
  render();
}

function ensureSeed() {
  if (state.flows.length) return;
  TEMPLATES.slice(0, 3).forEach((t, i) => {
    state.flows.push({
      id: crypto.randomUUID(),
      name: t.name,
      on: i !== 2,
      trigger: { ...t.trigger },
      action: { ...t.action },
    });
  });
  const broken = state.flows[2];
  const now = Date.now();
  state.runs = [
    runRecord(state.flows[0], true, now - 3600e3, ["Typeform payload ok", "HubSpot 201 Created"]),
    runRecord(state.flows[1], true, now - 1800e3, ["Order #1842", "Slack ts=171000"]),
    runRecord(broken, false, now - 600e3, ["New lead ok", "SMTP 535 auth failed at sequence step 2"]),
  ];
  save(state);
}

function runRecord(flow, ok, at, logs) {
  return {
    id: crypto.randomUUID(),
    flowId: flow.id,
    name: flow.name,
    ok,
    at,
    steps: [
      { name: flow.trigger.label, ok: true, detail: logs[0] },
      { name: flow.action.label, ok, detail: logs[1] },
    ],
    tasks: 2,
  };
}

function selectFlow(id) {
  currentId = id;
  render();
}

function addFlow(tpl) {
  if (state.flows.length >= LIMIT) {
    $("#runHint").textContent = "Hit the 10-workflow cap. Lifetime pricing is per workflow, not per run.";
    return;
  }
  const t = tpl || {
    name: "Untitled workflow",
    trigger: { type: "hook", label: "Webhook", app: "Webhook" },
    action: { type: "slack", label: "Post to Slack", app: "Slack", channel: "#general" },
  };
  const f = {
    id: crypto.randomUUID(),
    name: t.name,
    on: true,
    trigger: { ...t.trigger },
    action: { ...t.action },
  };
  state.flows.push(f);
  save(state);
  currentId = f.id;
  render();
}

function current() {
  return state.flows.find((f) => f.id === currentId) || state.flows[0];
}

function runOnce(forceFail) {
  const f = current();
  if (!f) return;
  const fail = forceFail || (f.action.app === "Email" && Math.random() < 0.35);
  const logs = fail
    ? [`${f.trigger.app} event received`, `${f.action.app} failed: timeout at ${f.action.channel || "action"}`]
    : [`${f.trigger.app} event received`, `${f.action.app} ok → ${f.action.channel || "done"}`];
  const rec = runRecord(f, !fail, Date.now(), logs);
  state.runs.unshift(rec);
  save(state);
  $("#runHint").textContent = fail ? "This run failed. Open Run replay to see the step." : "It ran. Task volume is not billed.";
  render();
}

function zapEstimate() {
  const tasks = state.runs.reduce((s, r) => s + (r.tasks || 2), 0);
  let usd = 19.99;
  if (tasks > 750) usd = 49;
  if (tasks > 2000) usd = 99;
  return { tasks, usd };
}

function renderList() {
  $("#quota").textContent = `${state.flows.length} / ${LIMIT} workflows`;
  $("#wfList").innerHTML =
    state.flows
      .map(
        (f) => `<button class="wf ${f.id === current()?.id ? "active" : ""}" data-id="${f.id}">
        <b>${f.name}</b><span>${f.trigger.app} → ${f.action.app} · ${f.on ? "on" : "off"}</span>
      </button>`
      )
      .join("") +
    `<div class="hint" style="margin:10px 0 6px">Templates</div>` +
    TEMPLATES.map(
      (t) => `<button class="wf" data-tpl="${t.name}"><b>${t.name}</b><span>Add in one click</span></button>`
    ).join("");
  $("#wfList").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.id) selectFlow(b.dataset.id);
    if (b.dataset.tpl) addFlow(TEMPLATES.find((t) => t.name === t.name && t.name === b.dataset.tpl));
  };
}

function renderEditor() {
  const f = current();
  const stage = $("#stage");
  const cfg = $("#cfg");
  if (!f) {
    stage.innerHTML = `<div class="empty">No workflows yet. Use a template on the left.</div>`;
    cfg.innerHTML = "";
    return;
  }
  $("#edKicker").textContent = f.on ? "Running" : "Paused";
  $("#edTitle").textContent = f.name;
  stage.innerHTML = `
    <div class="node trigger"><div class="t">TRIGGER</div><h3>${f.trigger.label}</h3><div class="hint">${f.trigger.app}</div></div>
    <div class="pipe"></div>
    <div class="node"><div class="t">NO CODE</div><h3>Pass fields through</h3></div>
    <div class="pipe"></div>
    <div class="node action"><div class="t">ACTION</div><h3>${f.action.label}</h3><div class="hint">${f.action.app} · ${f.action.channel || ""}</div></div>
  `;
  cfg.innerHTML = `
    <label>Name</label><input id="fName" value="${f.name}" />
    <label>Trigger</label>
    <select id="fTrig">
      ${["Typeform submitted|form|Typeform", "Shopify new order|shop|Shopify", "Incoming POST|hook|Webhook", "New lead|crm|HubSpot"]
        .map((x) => {
          const [label, type, app] = x.split("|");
          return `<option value="${type}|${app}|${label}" ${f.trigger.type === type ? "selected" : ""}>${label}</option>`;
        })
        .join("")}
    </select>
    <label>Action</label>
    <select id="fAct">
      ${["Write to HubSpot|crm|HubSpot|Contacts", "Post to Slack|slack|Slack|#leads", "Start email sequence|mail|Email|sequence-welcome", "Forward webhook|hook|Webhook|https://hooks.example/out"]
        .map((x) => {
          const [label, type, app, ch] = x.split("|");
          return `<option value="${type}|${app}|${label}|${ch}" ${f.action.type === type ? "selected" : ""}>${label}</option>`;
        })
        .join("")}
    </select>
    <label>Target / channel</label><input id="fCh" value="${f.action.channel || ""}" />
  `;
}

function saveEditor() {
  const f = current();
  if (!f) return;
  f.name = $("#fName").value.trim() || f.name;
  const [tt, ta, tl] = $("#fTrig").value.split("|");
  const [at, aa, al] = $("#fAct").value.split("|");
  f.trigger = { type: tt, app: ta, label: tl };
  f.action = { type: at, app: aa, label: al, channel: $("#fCh").value };
  save(state);
  render();
}

function renderRuns() {
  const zap = zapEstimate();
  $("#runCount").textContent = state.runs.length;
  $("#failCount").textContent = state.runs.filter((r) => !r.ok).length;
  $("#zapCost").textContent = `~$${zap.usd}/mo`;
  const list = $("#runList");
  if (!state.runs.length) {
    list.innerHTML = `<div class="empty">No runs yet. Hit Run once on a workflow.</div>`;
    return;
  }
  list.innerHTML = state.runs
    .map((r) => {
      const t = new Date(r.at).toLocaleString();
      return `<article class="run">
        <div><b>${r.name}</b><div class="hint">${t}</div>
          ${r.steps
            .map(
              (s) =>
                `<div class="step"><span class="dot ${s.ok ? "" : "fail"}"></span><div><div>${s.name}</div><div class="hint">${s.detail}</div></div></div>`
            )
            .join("")}
        </div>
        <div>${r.ok ? '<span class="ok">OK</span>' : '<span class="bad">Failed · stopped on action</span>'}<div class="hint">${r.tasks} Zapier tasks equivalent</div></div>
        <button class="btn ghost" data-replay="${r.id}">Rerun</button>
      </article>`;
    })
    .join("");
  list.onclick = (e) => {
    const b = e.target.closest("[data-replay]");
    if (!b) return;
    const rec = state.runs.find((x) => x.id === b.dataset.replay);
    currentId = rec.flowId;
    switchTab("flow");
    runOnce(false);
  };
}

function renderBilling() {
  const zap = zapEstimate();
  $("#billWf").textContent = `${state.flows.length} / ${LIMIT}`;
  $("#billTen").textContent = state.flows.length ? "$149 lifetime" : "$0";
  $("#billZap").textContent = `~$${zap.usd}/mo`;
  $("#billLog").textContent = [
    `${state.flows.length} workflows (cap ${LIMIT})`,
    `${state.runs.length} runs logged`,
    `${zap.tasks} Zapier-equivalent tasks (1 per step)`,
    `Zapier estimate $${zap.usd}/mo (task-tier jumps)`,
    `Tenflow: ${state.flows.length} workflows, unlimited runs → $29/mo or $149 lifetime`,
    `Move these ${state.flows.length} Zaps over. Stop paying per task.`,
  ].join("\n");
}

function render() {
  if (!currentId && state.flows[0]) currentId = state.flows[0].id;
  renderList();
  renderEditor();
  renderRuns();
  renderBilling();
}

$("#newWf").addEventListener("click", () => addFlow());
$("#saveBtn").addEventListener("click", saveEditor);
$("#runBtn").addEventListener("click", () => runOnce());
$$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

ensureSeed();
const want = new URLSearchParams(location.search).get("tpl");
if (want) {
  const t = TEMPLATES.find((x) => x.name === want);
  if (t && !state.flows.some((f) => f.name === t.name)) addFlow(t);
}
render();
