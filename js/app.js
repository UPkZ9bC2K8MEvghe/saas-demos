const KEY = "dunner.v1";
const RATES_KEY = "dunner.rates";
const FALLBACK = { USD: 1, EUR: 1.087, GBP: 1.312, CNY: 0.138, JPY: 0.00672 };

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = (n, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(n || 0);

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { invoices: [], seq: 1040 };
  } catch {
    return { invoices: [], seq: 1040 };
  }
}
function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
function rates() {
  try {
    return JSON.parse(localStorage.getItem(RATES_KEY)) || FALLBACK;
  } catch {
    return FALLBACK;
  }
}
function toUsd(amount, currency, rate) {
  const r = rate || rates()[currency] || 1;
  return amount * r;
}
function daysFrom(iso) {
  const t = new Date(iso);
  t.setHours(0, 0, 0, 0);
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return Math.round((n - t) / 86400000);
}

async function fetchRates() {
  const hint = $("#fxHint");
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    if (data && data.rates) {
      const out = { USD: 1 };
      ["EUR", "GBP", "CNY", "JPY"].forEach((c) => {
        out[c] = 1 / data.rates[c];
      });
      localStorage.setItem(RATES_KEY, JSON.stringify(out));
      if (hint) hint.textContent = "Mid-market rate updated · locked on send";
      return out;
    }
  } catch (_) {}
  if (hint) hint.textContent = "Using built-in mid rate · locked on send";
  localStorage.setItem(RATES_KEY, JSON.stringify(FALLBACK));
  return FALLBACK;
}

const TEMPLATES = {
  0: (inv) => ({
    subject: `${inv.no} is due today — ${inv.client}`,
    body: `Hi ${inv.client.split(" ")[0]},\n\nThis is a friendly note that invoice ${inv.no} for ${money(
      inv.total,
      inv.currency
    )} is due today.\n\nPay here (takes about 20 seconds):\n${inv.payUrl}\n\nThanks for the work together.\n— sent automatically by Dunner`,
  }),
  7: (inv) => ({
    subject: `Quick nudge: ${inv.no} is 7 days overdue`,
    body: `Hi ${inv.client.split(" ")[0]},\n\nInvoice ${inv.no} (${money(
      inv.total,
      inv.currency
    )}) is now 7 days past due. I know things slip — here's the link again:\n\n${inv.payUrl}\n\nIf something's blocking payment, just reply to this email.\n— Dunner reminder 2 of 3`,
  }),
  14: (inv) => ({
    subject: `Final notice · ${inv.no} is 14 days overdue`,
    body: `Hi ${inv.client.split(" ")[0]},\n\nThis is the last automatic reminder for ${inv.no}, ${money(
      inv.total,
      inv.currency
    )}.\n\nPay now: ${inv.payUrl}\n\nAfter this I'll follow up personally. Happy to send a copy or split the payment if that helps.\n— Dunner final notice`,
  }),
};

function linesFromForm(form) {
  const rows = $$("#itemsTable tbody tr");
  return rows
    .map((tr) => {
      const desc = $("[name=desc]", tr).value.trim();
      const qty = Number($("[name=qty]", tr).value) || 0;
      const price = Number($("[name=price]", tr).value) || 0;
      return { desc, qty, price };
    })
    .filter((l) => l.desc && l.price >= 0);
}

function preview() {
  const form = $("#invoiceForm");
  if (!form) return;
  const client = form.client.value || "New client";
  const currency = form.currency.value;
  const terms = Number(form.terms.value);
  const lines = linesFromForm(form);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const r = rates()[currency] || 1;
  const due = new Date();
  due.setDate(due.getDate() + terms);
  $("#pClient").textContent = client;
  $("#pAmt").textContent = money(total, currency);
  $("#pDue").textContent = `Due ${due.toISOString().slice(0, 10)}`;
  $("#pFx").textContent = form.fxMode.value === "send" ? `1 ${currency} = ${r.toFixed(4)} USD` : "Settle at payday rate";
  $("#pUsd").textContent = money(toUsd(total, currency, r));
  $("#pLines").innerHTML = lines
    .map((l) => `<div class="row"><span>${l.desc} × ${l.qty}</span><span>${money(l.qty * l.price, currency)}</span></div>`)
    .join("");
}

function switchTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $$(".panel").forEach((p) => p.classList.toggle("show", p.id === `panel-${name}`));
  if (name === "io") location.hash = "io";
  render();
}

function seed() {
  const r = rates();
  const today = new Date();
  const iso = (offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString();
  };
  const state = load();
  const samples = [
    {
      client: "Northline Studio",
      email: "ap@northline.test",
      currency: "USD",
      total: 2480,
      terms: 14,
      issuedAt: iso(-16),
      dueAt: iso(-2),
      fxMode: "send",
      rate: 1,
      status: "overdue",
      chased: [0],
      lines: [
        { desc: "Brand identity", qty: 1, price: 1800 },
        { desc: "Landing page", qty: 1, price: 680 },
      ],
    },
    {
      client: "Atelier Mira",
      email: "hello@mira.test",
      currency: "EUR",
      total: 1920,
      terms: 14,
      issuedAt: iso(-20),
      dueAt: iso(-6),
      fxMode: "send",
      rate: r.EUR,
      status: "paid",
      paidAt: iso(-1),
      chased: [0, 7],
      lines: [{ desc: "Packaging system", qty: 1, price: 1920 }],
    },
    {
      client: "Helix Labs",
      email: "ops@helix.test",
      currency: "GBP",
      total: 640,
      terms: 7,
      issuedAt: iso(-22),
      dueAt: iso(-15),
      fxMode: "send",
      rate: r.GBP,
      status: "overdue",
      chased: [0, 7],
      lines: [{ desc: "Sprint illustration", qty: 4, price: 160 }],
    },
  ];
  samples.forEach((s) => {
    state.seq += 1;
    const no = `INV-${state.seq}`;
    state.invoices.push({
      id: crypto.randomUUID(),
      no,
      payUrl: `pay.html?id=${encodeURIComponent(no)}`,
      ...s,
    });
  });
  save(state);
  switchTab("owed");
}

function addInvoice(data) {
  const state = load();
  state.seq += 1;
  const no = `INV-${state.seq}`;
  const issued = new Date();
  const due = new Date();
  due.setDate(due.getDate() + data.terms);
  const inv = {
    id: crypto.randomUUID(),
    no,
    payUrl: `pay.html?id=${encodeURIComponent(no)}`,
    status: data.terms === 0 ? "due" : "open",
    chased: [],
    issuedAt: issued.toISOString(),
    dueAt: due.toISOString(),
    paidAt: null,
    ...data,
  };
  state.invoices.push(inv);
  save(state);
  return inv;
}

function updateInvoice(no, patch) {
  const state = load();
  const i = state.invoices.findIndex((x) => x.no === no);
  if (i >= 0) {
    state.invoices[i] = { ...state.invoices[i], ...patch };
    save(state);
  }
}

function statusOf(inv) {
  if (inv.status === "paid") return "paid";
  const overdue = daysFrom(inv.dueAt);
  if (overdue > 0) return "overdue";
  if (overdue === 0) return "due";
  return "open";
}

function nextStage(inv) {
  const overdue = daysFrom(inv.dueAt);
  if (overdue >= 14 && !inv.chased.includes(14)) return 14;
  if (overdue >= 7 && !inv.chased.includes(7)) return 7;
  if (overdue >= 0 && !inv.chased.includes(0)) return 0;
  return null;
}

let pendingMail = null;
function openMail(inv, stage) {
  const t = TEMPLATES[stage](inv);
  pendingMail = { no: inv.no, stage };
  $("#mailKicker").textContent = `Day ${stage} nudge · ${inv.email}`;
  $("#mailTitle").textContent = t.subject;
  $("#mailBody").textContent = t.body;
  $("#mailHint").textContent = "Demo does not send real email. Marking sent records the nudge on this invoice.";
  $("#mailModal").classList.add("show");
}

function renderOwed() {
  const list = $("#owedList");
  const invoices = load().invoices.filter((i) => statusOf(i) !== "paid");
  const r = rates();
  const total = invoices.reduce((s, i) => s + toUsd(i.total, i.currency, i.rate || r[i.currency]), 0);
  $("#owedTotal").textContent = money(total);
  $("#overdueCount").textContent = invoices.filter((i) => statusOf(i) === "overdue").length;
  const upcoming = invoices.map(nextStage).filter((x) => x !== null);
  $("#nextChase").textContent = upcoming.length ? `Day ${Math.min(...upcoming)}` : "None";
  if (!invoices.length) {
    list.innerHTML = `<div class="empty">Nothing outstanding. Create an invoice, or load sample data top-right.</div>`;
    return;
  }
  list.innerHTML = invoices
    .map((inv) => {
      const st = statusOf(inv);
      const overdue = daysFrom(inv.dueAt);
      const stage = nextStage(inv);
      const chase = [0, 7, 14]
        .map((d) => `<span class="step ${inv.chased.includes(d) ? "on" : ""}">Day ${d}</span>`)
        .join("");
      return `<article class="card">
        <div>
          <p class="client">${inv.client}</p>
          <div class="meta">${inv.no} · due ${inv.dueAt.slice(0, 10)} · ${
        st === "overdue" ? `${overdue} days overdue` : st === "due" ? "due today" : "not due yet"
      }</div>
          <div class="chase">${chase}</div>
        </div>
        <div>
          <div class="amt">${money(inv.total, inv.currency)}</div>
          <div class="meta">${inv.fxMode === "send" ? `locked ${inv.rate.toFixed(4)}` : "payday rate"} · ${inv.email}</div>
        </div>
        <div class="actions">
          <a class="btn ghost" href="${inv.payUrl}">Checkout</a>
          <button class="btn ${stage === null ? "ghost" : "warn"}" data-chase="${inv.no}" ${
        stage === null ? "disabled" : ""
      }>${stage === null ? "Nudges done" : `Send day ${stage} nudge`}</button>
        </div>
      </article>`;
    })
    .join("");
  list.onclick = (e) => {
    const btn = e.target.closest("[data-chase]");
    if (!btn) return;
    const inv = load().invoices.find((x) => x.no === btn.dataset.chase);
    const stage = nextStage(inv);
    if (inv && stage !== null) openMail(inv, stage);
  };
}

function renderPaid() {
  const paid = load().invoices.filter((i) => i.status === "paid");
  const usd = paid.reduce((s, i) => s + toUsd(i.total, i.currency, i.rate), 0);
  $("#paidUsd").textContent = money(usd);
  $("#paidCount").textContent = paid.length;
  const live = rates();
  const saved = paid.reduce((s, i) => {
    if (i.fxMode !== "send" || i.currency === "USD") return s;
    const now = toUsd(i.total, i.currency, live[i.currency]);
    const locked = toUsd(i.total, i.currency, i.rate);
    return s + Math.max(0, locked - now);
  }, 0);
  $("#fxSaved").textContent = money(saved);
  const tb = $("#paidTable tbody");
  tb.innerHTML = paid.length
    ? paid
        .map(
          (i) => `<tr>
          <td>${i.no}</td><td>${i.client}</td>
          <td>${money(i.total, i.currency)}</td>
          <td>${i.rate ? i.rate.toFixed(4) : "—"}</td>
          <td>${money(toUsd(i.total, i.currency, i.rate))}</td>
          <td>${(i.paidAt || "").slice(0, 10)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="hint">No payments yet. Clients use checkout, or open checkout from Who owes you.</td></tr>`;
}

function renderIo() {
  const state = load();
  const count = $("#ioCount");
  if (count) count.textContent = state.invoices.length;
}

function exportAs(kind) {
  const spec = DunnerIO.FORMATS[kind];
  if (!spec) return;
  const state = load();
  DunnerIO.download(`dunner-${DunnerIO.stamp()}.${spec.ext}`, spec.mime, spec.export(state));
  const msg = $("#ioMsg");
  if (msg) msg.textContent = `Exported ${state.invoices.length} invoices · ${spec.label}`;
}

function applyImport(rows, mode) {
  const state = load();
  const r = rates();
  let added = 0;
  let updated = 0;
  if (mode === "replace") {
    state.invoices = [];
    state.seq = 1040;
  }
  rows.forEach((row) => {
    let no = row._no;
    if (!no) {
      state.seq += 1;
      no = `INV-${state.seq}`;
    } else {
      const num = Number(String(no).replace(/\D/g, ""));
      if (num > (state.seq || 0)) state.seq = num;
    }
    const existing = state.invoices.findIndex((x) => x.no === no);
    const inv = {
      id: existing >= 0 ? state.invoices[existing].id : crypto.randomUUID(),
      no,
      payUrl: `pay.html?id=${encodeURIComponent(no)}`,
      client: row.client,
      email: row.email,
      currency: row.currency,
      total: row.total,
      terms: row.terms,
      status: row.status,
      issuedAt: row.issuedAt,
      dueAt: row.dueAt || row.issuedAt,
      paidAt: row.paidAt,
      fxMode: row.fxMode,
      rate: row.rate || r[row.currency] || 1,
      chased: row.chased,
      note: row.note,
      lines: row.lines,
    };
    if (existing >= 0) {
      state.invoices[existing] = { ...state.invoices[existing], ...inv };
      updated += 1;
    } else {
      state.invoices.push(inv);
      added += 1;
    }
  });
  save(state);
  const last = $("#ioLast");
  if (last) last.textContent = `${added + updated}`;
  const msg = $("#ioMsg");
  if (msg) msg.textContent = mode === "replace" ? `Replaced ledger with ${state.invoices.length} invoices` : `Added ${added} · updated ${updated} · now ${state.invoices.length}`;
  render();
}

async function importFrom(text, filename, mode) {
  const msg = $("#ioMsg");
  try {
    const kind = DunnerIO.sniff(filename || "", text);
    const rows = DunnerIO.parse(text, kind);
    applyImport(rows, mode);
  } catch (err) {
    if (msg) msg.textContent = `Import failed: ${err.message || err}`;
  }
}

function render() {
  preview();
  renderOwed();
  renderPaid();
  renderIo();
}

function bind() {
  $$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  const ioBtn = $("#ioBtn");
  if (ioBtn) ioBtn.addEventListener("click", () => switchTab("io"));
  $$(".io-jump").forEach((b) => b.addEventListener("click", () => switchTab("io")));
  document.addEventListener("click", (e) => {
    const q = e.target.closest("[data-quick-export]");
    if (q) exportAs(q.dataset.quickExport);
  });
  $("#seedBtn").addEventListener("click", seed);
  $("#addLine").addEventListener("click", () => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><input name="desc" placeholder="Another line" /></td>
      <td><input name="qty" type="number" min="1" value="1" /></td>
      <td><input name="price" type="number" min="0" step="0.01" /></td>`;
    $("#itemsTable tbody").appendChild(tr);
  });
  $("#invoiceForm").addEventListener("input", preview);
  $("#invoiceForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const lines = linesFromForm(form);
    const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const currency = form.currency.value;
    const inv = addInvoice({
      client: form.client.value.trim(),
      email: form.email.value.trim(),
      currency,
      terms: Number(form.terms.value),
      fxMode: form.fxMode.value,
      rate: rates()[currency],
      total,
      note: form.note.value,
      lines,
    });
    openMail(inv, 0);
    $("#mailKicker").textContent = `Invoice ready · ${inv.email}`;
    $("#mailTitle").textContent = `Invoice ${inv.no} from you`;
    $("#mailBody").textContent = `Hi ${inv.client},\n\nInvoice ${inv.no} for ${money(
      inv.total,
      inv.currency
    )} is ready. Due ${inv.dueAt.slice(0, 10)}.\n\nPay here:\n${location.origin}/${inv.payUrl}\n\n${
      inv.fxMode === "send" ? `Rate locked: 1 ${inv.currency} = ${inv.rate.toFixed(4)} USD\n` : ""
    }\nThanks.`;
    pendingMail = { no: inv.no, stage: "send" };
  });
  $("#mailClose").addEventListener("click", () => $("#mailModal").classList.remove("show"));
  $("#mailSend").addEventListener("click", () => {
    if (pendingMail && pendingMail.stage !== "send") {
      const inv = load().invoices.find((x) => x.no === pendingMail.no);
      updateInvoice(pendingMail.no, { chased: [...(inv.chased || []), pendingMail.stage] });
    }
    $("#mailModal").classList.remove("show");
    switchTab("owed");
  });
  const exportBox = $("#exportBtns");
  if (exportBox) {
    exportBox.innerHTML = Object.entries(DunnerIO.FORMATS)
      .map(([k, spec]) => `<button type="button" class="btn ghost" data-export="${k}">${spec.label}</button>`)
      .join("");
    exportBox.addEventListener("click", (e) => {
      const b = e.target.closest("[data-export]");
      if (b) exportAs(b.dataset.export);
    });
  }
  const fileInput = $("#importFile");
  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const text = await f.text();
      $("#importPaste").value = text;
      $("#ioMsg").textContent = `Read ${f.name} · ${text.length} chars. Choose merge or replace.`;
      fileInput.value = "";
    });
  }
  const runImport = (mode) => {
    const pasted = ($("#importPaste") && $("#importPaste").value) || "";
    if (!pasted.trim()) {
      $("#ioMsg").textContent = "Choose a file or paste content first.";
      return;
    }
    importFrom(pasted, "", mode);
  };
  const mergeBtn = $("#importMerge");
  const replaceBtn = $("#importReplace");
  const tplBtn = $("#tplCsv");
  if (mergeBtn) mergeBtn.addEventListener("click", () => runImport("merge"));
  if (replaceBtn) replaceBtn.addEventListener("click", () => runImport("replace"));
  if (tplBtn) {
    tplBtn.addEventListener("click", () => {
      DunnerIO.download("dunner-template.csv", "text/csv;charset=utf-8", DunnerIO.csvTemplate());
    });
  }
}

bind();
fetchRates().then(render);
render();
if (location.hash === "#io") switchTab("io");
