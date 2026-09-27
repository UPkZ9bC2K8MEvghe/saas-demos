const KEY = "dunner.v1";
const $ = (s) => document.querySelector(s);
const money = (n, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(n || 0);

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { invoices: [] };
  } catch {
    return { invoices: [] };
  }
}
function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

const params = new URLSearchParams(location.search);
const id = params.get("id");
const state = load();
const inv = state.invoices.find((x) => x.no === id);
const box = $("#content");

if (!inv) {
  box.innerHTML = `<h2>Invoice not found</h2><p class="hint">Create the invoice in the workspace first, then open this pay link. Data lives in this browser.</p><p><a class="btn teal" href="app.html">Back to workspace</a></p>`;
} else if (inv.status === "paid") {
  box.innerHTML = `<h2>Already paid</h2>
    <p class="inv-client">${inv.client}</p>
    <p class="amt">${money(inv.total, inv.currency)}</p>
    <p class="hint">${inv.no} · ${inv.paidAt ? inv.paidAt.slice(0, 10) : ""}</p>
    <p><a class="btn" href="app.html">View money in</a></p>`;
} else {
  box.innerHTML = `
    <div class="inv-top"><span>${inv.no}</span><span>Due ${inv.dueAt.slice(0, 10)}</span></div>
    <h2 class="inv-client">${inv.client}</h2>
    <div class="amt">${money(inv.total, inv.currency)}</div>
    <p class="hint">${inv.fxMode === "send" ? `Rate locked at ${inv.rate.toFixed(4)} USD` : "Settles at payday rate"}</p>
    ${(inv.lines || [])
      .map((l) => `<div class="row"><span>${l.desc} × ${l.qty}</span><span>${money(l.qty * l.price, inv.currency)}</span></div>`)
      .join("")}
    <form id="payForm">
      <div class="card-form">
        <div style="grid-column:1/-1">
          <label>Card number (demo)</label>
          <input value="4242 4242 4242 4242" maxlength="19" />
        </div>
        <div>
          <label>Expiry</label>
          <input value="12 / 28" />
        </div>
        <div>
          <label>CVC</label>
          <input value="123" />
        </div>
      </div>
      <button class="btn teal full" style="margin-top:16px" type="submit">Pay ${money(inv.total, inv.currency)}</button>
    </form>`;
  $("#payForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const s = load();
    const i = s.invoices.findIndex((x) => x.no === inv.no);
    s.invoices[i] = { ...s.invoices[i], status: "paid", paidAt: new Date().toISOString() };
    save(s);
    box.innerHTML = `<h2>Payment received</h2><p>Thanks, ${inv.client}. This is now on the freelancer's money-in list.</p><p class="hint">Demo checkout — not connected to live Stripe.</p><p><a class="btn" href="app.html">Done</a></p>`;
  });
}
