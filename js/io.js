const DunnerIO = (() => {
  const COLS = [
    "no",
    "client",
    "email",
    "currency",
    "total",
    "terms",
    "status",
    "issuedAt",
    "dueAt",
    "paidAt",
    "fxMode",
    "rate",
    "chased",
    "note",
    "lines",
  ];
  const ALIAS = {
    no: ["no", "invoice", "invoice_no", "invoice_number", "number", "id"],
    client: ["client", "customer", "customer_name", "name", "client_name"],
    email: ["email", "mail", "client_email", "customer_email"],
    currency: ["currency", "ccy", "curr"],
    total: ["total", "amount", "sum", "grand_total"],
    terms: ["terms", "net", "net_days"],
    status: ["status", "state", "paid"],
    issuedAt: ["issuedat", "issued", "issue_date", "date", "created"],
    dueAt: ["dueat", "due", "due_date"],
    paidAt: ["paidat", "paid_at", "paid_date"],
    fxMode: ["fxmode", "fx_mode", "fx"],
    rate: ["rate", "fx_rate", "exchange"],
    chased: ["chased", "reminders"],
    note: ["note", "notes", "memo", "remarks"],
    lines: ["lines", "items", "line_items"],
  };

  function xmlEsc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function yamlEsc(s) {
    const t = String(s ?? "");
    if (/^[\w.@+-]+$/.test(t) && t !== "") return t;
    return JSON.stringify(t);
  }
  function csvEsc(s) {
    const t = String(s ?? "");
    if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
    return t;
  }
  function linesPack(lines) {
    return (lines || []).map((l) => `${l.desc || ""}|${l.qty || 0}|${l.price || 0}`).join("; ");
  }
  function linesUnpack(raw) {
    if (Array.isArray(raw)) {
      return raw
        .map((l) => {
          if (typeof l === "string") return parseLineToken(l);
          return {
            desc: String(l.desc || l.description || l.name || "").trim(),
            qty: Number(l.qty || l.quantity || 1) || 1,
            price: Number(l.price || l.unit_price || l.amount || 0) || 0,
          };
        })
        .filter((l) => l.desc);
    }
    return String(raw || "")
      .split(";")
      .map(parseLineToken)
      .filter((l) => l.desc);
  }
  function parseLineToken(tok) {
    const p = String(tok).split("|").map((x) => x.trim());
    if (p.length >= 3) return { desc: p[0], qty: Number(p[1]) || 1, price: Number(p[2]) || 0 };
    if (p.length === 2) return { desc: p[0], qty: 1, price: Number(p[1]) || 0 };
    return { desc: p[0] || "", qty: 1, price: 0 };
  }
  function iso(v) {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) return String(v);
      return String(v);
    }
    return d.toISOString();
  }
  function flat(inv) {
    return {
      no: inv.no || "",
      client: inv.client || "",
      email: inv.email || "",
      currency: inv.currency || "USD",
      total: inv.total ?? 0,
      terms: inv.terms ?? 14,
      status: inv.status || "open",
      issuedAt: inv.issuedAt || "",
      dueAt: inv.dueAt || "",
      paidAt: inv.paidAt || "",
      fxMode: inv.fxMode || "send",
      rate: inv.rate ?? "",
      chased: Array.isArray(inv.chased) ? inv.chased.join("|") : inv.chased || "",
      note: inv.note || "",
      lines: linesPack(inv.lines),
    };
  }
  function mapKey(k) {
    const n = String(k || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    for (const [field, names] of Object.entries(ALIAS)) {
      if (names.some((x) => x.toLowerCase().replace(/[\s-]+/g, "_") === n)) return field;
    }
    return null;
  }
  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    const src = raw.invoice && typeof raw.invoice === "object" ? raw.invoice : raw;
    const out = {};
    Object.keys(src).forEach((k) => {
      const f = mapKey(k);
      if (f) out[f] = src[k];
    });
    if (!out.client && !out.no && out.total == null) return null;
    const lines = linesUnpack(out.lines || src.items || src.lineItems);
    const total =
      Number(out.total) ||
      lines.reduce((s, l) => s + Number(l.qty) * Number(l.price), 0) ||
      0;
    let chased = out.chased;
    if (typeof chased === "string") {
      chased = chased
        .split(/[|,]/)
        .map((x) => Number(x.trim()))
        .filter((n) => n === 0 || n === 7 || n === 14);
    }
    if (!Array.isArray(chased)) chased = [];
    let status = String(out.status || "").toLowerCase();
    if (status === "true" || status === "1" || status === "yes") status = "paid";
    if (!status) status = out.paidAt ? "paid" : "open";
    const no = String(out.no || "").trim();
    return {
      client: String(out.client || "Unnamed client").trim(),
      email: String(out.email || "").trim(),
      currency: String(out.currency || "USD").trim().toUpperCase() || "USD",
      total,
      terms: Number(out.terms) || 14,
      status,
      issuedAt: iso(out.issuedAt) || new Date().toISOString(),
      dueAt: iso(out.dueAt) || "",
      paidAt: status === "paid" ? iso(out.paidAt) || new Date().toISOString() : out.paidAt ? iso(out.paidAt) : null,
      fxMode: out.fxMode === "pay" ? "pay" : "send",
      rate: Number(out.rate) || 0,
      chased,
      note: String(out.note || ""),
      lines: lines.length ? lines : [{ desc: "Imported line", qty: 1, price: total }],
      _no: no,
    };
  }
  function fromList(list) {
    return (list || []).map(normalize).filter(Boolean);
  }

  function toJSON(state) {
    return JSON.stringify({ app: "dunner", version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2);
  }
  function toJSONL(state) {
    return (state.invoices || []).map((inv) => JSON.stringify(inv)).join("\n") + (state.invoices.length ? "\n" : "");
  }
  function toDelimited(state, sep) {
    const rows = [COLS.join(sep)];
    (state.invoices || []).forEach((inv) => {
      const f = flat(inv);
      rows.push(COLS.map((c) => csvEsc(f[c])).join(sep));
    });
    return rows.join("\r\n");
  }
  function toCSV(state) {
    return "\uFEFF" + toDelimited(state, ",");
  }
  function toTSV(state) {
    return toDelimited(state, "\t");
  }
  function toYAML(state) {
    const lines = ["app: dunner", "version: 1", `exportedAt: ${yamlEsc(new Date().toISOString())}`, `seq: ${state.seq || 0}`, "invoices:"];
    if (!state.invoices.length) {
      lines.push("  []");
      return lines.join("\n");
    }
    state.invoices.forEach((inv) => {
      lines.push(`  - no: ${yamlEsc(inv.no)}`);
      lines.push(`    client: ${yamlEsc(inv.client)}`);
      lines.push(`    email: ${yamlEsc(inv.email)}`);
      lines.push(`    currency: ${yamlEsc(inv.currency)}`);
      lines.push(`    total: ${inv.total}`);
      lines.push(`    terms: ${inv.terms ?? 14}`);
      lines.push(`    status: ${yamlEsc(inv.status)}`);
      lines.push(`    issuedAt: ${yamlEsc(inv.issuedAt || "")}`);
      lines.push(`    dueAt: ${yamlEsc(inv.dueAt || "")}`);
      lines.push(`    paidAt: ${yamlEsc(inv.paidAt || "")}`);
      lines.push(`    fxMode: ${yamlEsc(inv.fxMode || "send")}`);
      lines.push(`    rate: ${inv.rate ?? 0}`);
      lines.push(`    chased: [${(inv.chased || []).join(", ")}]`);
      lines.push(`    note: ${yamlEsc(inv.note || "")}`);
      lines.push("    lines:");
      (inv.lines || []).forEach((l) => {
        lines.push(`      - desc: ${yamlEsc(l.desc)}`);
        lines.push(`        qty: ${l.qty}`);
        lines.push(`        price: ${l.price}`);
      });
    });
    return lines.join("\n");
  }
  function toXML(state) {
    const body = (state.invoices || [])
      .map((inv) => {
        const ls = (inv.lines || [])
          .map(
            (l) =>
              `      <line desc="${xmlEsc(l.desc)}" qty="${l.qty}" price="${l.price}"/>`
          )
          .join("\n");
        return `  <invoice>
    <no>${xmlEsc(inv.no)}</no>
    <client>${xmlEsc(inv.client)}</client>
    <email>${xmlEsc(inv.email)}</email>
    <currency>${xmlEsc(inv.currency)}</currency>
    <total>${inv.total}</total>
    <terms>${inv.terms ?? 14}</terms>
    <status>${xmlEsc(inv.status)}</status>
    <issuedAt>${xmlEsc(inv.issuedAt || "")}</issuedAt>
    <dueAt>${xmlEsc(inv.dueAt || "")}</dueAt>
    <paidAt>${xmlEsc(inv.paidAt || "")}</paidAt>
    <fxMode>${xmlEsc(inv.fxMode || "send")}</fxMode>
    <rate>${inv.rate ?? 0}</rate>
    <chased>${xmlEsc((inv.chased || []).join(","))}</chased>
    <note>${xmlEsc(inv.note || "")}</note>
    <lines>
${ls}
    </lines>
  </invoice>`;
      })
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<dunner exportedAt="${xmlEsc(new Date().toISOString())}" seq="${state.seq || 0}">
${body}
</dunner>
`;
  }
  function toMarkdown(state) {
    const rows = (state.invoices || [])
      .map((inv) => {
        const items = (inv.lines || []).map((l) => `- ${l.desc} × ${l.qty} @ ${l.price}`).join("\n");
        return `## ${inv.no} · ${inv.client}

| Field | Value |
| --- | --- |
| Email | ${inv.email || "—"} |
| Amount | ${inv.total} ${inv.currency} |
| Status | ${inv.status} |
| Issued | ${(inv.issuedAt || "").slice(0, 10)} |
| Due | ${(inv.dueAt || "").slice(0, 10)} |
| Paid | ${inv.paidAt ? inv.paidAt.slice(0, 10) : "—"} |
| FX | ${inv.fxMode} ${inv.rate ?? ""} |
| Nudges | ${(inv.chased || []).join(", ") || "—"} |
| Notes | ${inv.note || "—"} |

${items || "- (no line items)"}
`;
      })
      .join("\n");
    return `# Dunner export ${new Date().toISOString().slice(0, 10)}

${state.invoices.length} invoices.

${rows || "_No invoices._"}
`;
  }
  function toHTML(state) {
    const cards = (state.invoices || [])
      .map((inv) => {
        const items = (inv.lines || [])
          .map((l) => `<li>${xmlEsc(l.desc)} × ${l.qty} — ${l.price} ${xmlEsc(inv.currency)}</li>`)
          .join("");
        return `<article>
<h2>${xmlEsc(inv.no)} · ${xmlEsc(inv.client)}</h2>
<p>${xmlEsc(inv.email)} · ${inv.total} ${xmlEsc(inv.currency)} · ${xmlEsc(inv.status)}</p>
<p>Issued ${(inv.issuedAt || "").slice(0, 10)} · due ${(inv.dueAt || "").slice(0, 10)}</p>
<ul>${items}</ul>
</article>`;
      })
      .join("\n");
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Dunner export</title>
<style>body{font-family:sans-serif;max-width:720px;margin:40px auto;color:#1b1712}article{border-bottom:1px solid #ddd;padding:12px 0}</style>
</head><body>
<h1>Dunner export</h1>
<p>${state.invoices.length} invoices · ${xmlEsc(new Date().toISOString())}</p>
${cards}
</body></html>`;
  }
  function toExcel(state) {
    const header = COLS.map((c) => `<Cell><Data ss:Type="String">${xmlEsc(c)}</Data></Cell>`).join("");
    const rows = (state.invoices || [])
      .map((inv) => {
        const f = flat(inv);
        const cells = COLS.map((c) => {
          const v = f[c];
          const num = c === "total" || c === "terms" || c === "rate";
          if (num && v !== "" && !Number.isNaN(Number(v))) {
            return `<Cell><Data ss:Type="Number">${Number(v)}</Data></Cell>`;
          }
          return `<Cell><Data ss:Type="String">${xmlEsc(v)}</Data></Cell>`;
        }).join("");
        return `<Row>${cells}</Row>`;
      })
      .join("");
    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="invoices">
<Table>
<Row>${header}</Row>
${rows}
</Table>
</Worksheet>
</Workbook>`;
  }

  function parseCSV(text, sep) {
    const rows = [];
    let row = [];
    let cell = "";
    let q = false;
    const src = text.replace(/^\uFEFF/, "");
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      const next = src[i + 1];
      if (q) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
        cell = "";
      } else if (ch !== "\r") cell += ch;
    }
    row.push(cell);
    if (row.some((x) => String(x).trim())) rows.push(row);
    if (!rows.length) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).map((r) => {
      const o = {};
      headers.forEach((h, i) => {
        o[h] = r[i] ?? "";
      });
      return o;
    });
  }
  function detectSep(text) {
    const line = text.split(/\r?\n/).find((l) => l.trim()) || "";
    const commas = (line.match(/,/g) || []).length;
    const tabs = (line.match(/\t/g) || []).length;
    const semis = (line.match(/;/g) || []).length;
    if (tabs > commas && tabs >= semis) return "\t";
    if (semis > commas) return ";";
    return ",";
  }
  function textOf(el) {
    return (el && el.textContent ? el.textContent : "").trim();
  }
  function parseXML(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("Could not parse XML");
    const ss = doc.getElementsByTagName("Worksheet")[0] || doc.getElementsByTagName("ss:Worksheet")[0];
    if (ss) {
      const rows = [...ss.getElementsByTagName("Row")];
      if (!rows.length) return [];
      const cellText = (row) =>
        [...row.getElementsByTagName("Cell")].map((c) => {
          const d = c.getElementsByTagName("Data")[0];
          return d ? d.textContent : c.textContent;
        });
      const headers = cellText(rows[0]).map((h) => h.trim());
      return rows.slice(1).map((row) => {
        const vals = cellText(row);
        const o = {};
        headers.forEach((h, i) => {
          o[h] = vals[i] ?? "";
        });
        return o;
      });
    }
    const nodes = [...doc.getElementsByTagName("invoice")];
    return nodes.map((n) => {
      const grab = (tag) => textOf(n.getElementsByTagName(tag)[0]);
      const lines = [...n.getElementsByTagName("line")].map((l) => ({
        desc: l.getAttribute("desc") || textOf(l.getElementsByTagName("desc")[0]),
        qty: Number(l.getAttribute("qty") || textOf(l.getElementsByTagName("qty")[0]) || 1),
        price: Number(l.getAttribute("price") || textOf(l.getElementsByTagName("price")[0]) || 0),
      }));
      return {
        no: grab("no"),
        client: grab("client"),
        email: grab("email"),
        currency: grab("currency"),
        total: grab("total"),
        terms: grab("terms"),
        status: grab("status"),
        issuedAt: grab("issuedAt"),
        dueAt: grab("dueAt"),
        paidAt: grab("paidAt"),
        fxMode: grab("fxMode"),
        rate: grab("rate"),
        chased: grab("chased"),
        note: grab("note"),
        lines,
      };
    });
  }
  function parseJSONLoose(text) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.invoices)) return data.invoices;
    if (data && data.invoice) return [data.invoice];
    if (data && typeof data === "object" && (data.client || data.no)) return [data];
    throw new Error("No invoice list found in JSON");
  }
  function parseJSONL(text) {
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }
  function parseYAML(text) {
    const trimmed = text.replace(/^\uFEFF/, "");
    if (trimmed.trim().startsWith("{") || trimmed.trim().startsWith("[")) return parseJSONLoose(trimmed);
    const items = [];
    let cur = null;
    let lineObj = null;
    const lines = trimmed.split(/\r?\n/);
    for (const raw of lines) {
      if (!raw.trim() || raw.trim().startsWith("#")) continue;
      const mItem = raw.match(/^\s*-\s+no:\s*(.*)$/);
      const mDash = raw.match(/^\s*-\s+desc:\s*(.*)$/);
      const mKey = raw.match(/^\s{2,}([A-Za-z_]+):\s*(.*)$/);
      if (mItem) {
        if (cur) items.push(cur);
        cur = { no: unquote(mItem[1]), lines: [] };
        lineObj = null;
        continue;
      }
      if (mDash && cur) {
        lineObj = { desc: unquote(mDash[1]), qty: 1, price: 0 };
        cur.lines.push(lineObj);
        continue;
      }
      if (mKey && cur) {
        const k = mKey[1];
        const v = unquote(mKey[2]);
        if (lineObj && (k === "qty" || k === "price" || k === "desc")) {
          lineObj[k] = k === "desc" ? v : Number(v) || 0;
        } else if (k === "lines") {
          lineObj = null;
        } else if (k === "chased") {
          cur.chased = v.replace(/[\[\]]/g, "");
        } else {
          cur[k] = v;
          lineObj = null;
        }
      }
    }
    if (cur) items.push(cur);
    if (!items.length) throw new Error("No invoices found in YAML");
    return items;
  }
  function unquote(v) {
    const t = String(v || "").trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      try {
        return JSON.parse(t.startsWith("'") ? `"${t.slice(1, -1)}"` : t);
      } catch {
        return t.slice(1, -1);
      }
    }
    return t;
  }
  function parseMarkdown(text) {
    const chunks = text.split(/^##\s+/m).slice(1);
    if (!chunks.length) throw new Error("No ## invoice headings found in Markdown");
    return chunks.map((chunk) => {
      const head = chunk.split("\n")[0] || "";
      const [no, ...rest] = head.split("·").map((x) => x.trim());
      const field = (label) => {
        const re = new RegExp(`\\|\\s*${label}\\s*\\|\\s*([^|]+)\\|`);
        const m = chunk.match(re);
        return m ? m[1].trim() : "";
      };
      const lines = [];
      chunk.split("\n").forEach((ln) => {
        const m = ln.match(/^-\s+(.+?)\s+×\s+([\d.]+)\s+@\s+([\d.]+)/);
        if (m) lines.push({ desc: m[1], qty: Number(m[2]), price: Number(m[3]) });
      });
      const amount = field("Amount").split(/\s+/);
      return {
        no,
        client: rest.join(" · ") || field("Client"),
        email: field("Email").replace("—", ""),
        total: amount[0],
        currency: amount[1] || "USD",
        status: field("Status"),
        issuedAt: field("Issued"),
        dueAt: field("Due"),
        paidAt: field("Paid").replace("—", ""),
        fxMode: field("FX").startsWith("pay") ? "pay" : "send",
        rate: field("FX").split(/\s+/)[1],
        chased: field("Nudges").replace("—", ""),
        note: field("Notes").replace("—", ""),
        lines,
      };
    });
  }

  const FORMATS = {
    json: { ext: "json", mime: "application/json", export: toJSON, label: "JSON full backup" },
    jsonl: { ext: "jsonl", mime: "application/x-ndjson", export: toJSONL, label: "JSONL one per line" },
    csv: { ext: "csv", mime: "text/csv;charset=utf-8", export: toCSV, label: "CSV for Excel" },
    tsv: { ext: "tsv", mime: "text/tab-separated-values", export: toTSV, label: "TSV" },
    xml: { ext: "xml", mime: "application/xml", export: toXML, label: "XML" },
    yaml: { ext: "yaml", mime: "text/yaml", export: toYAML, label: "YAML" },
    md: { ext: "md", mime: "text/markdown", export: toMarkdown, label: "Markdown" },
    html: { ext: "html", mime: "text/html", export: toHTML, label: "HTML report" },
    xls: { ext: "xls", mime: "application/vnd.ms-excel", export: toExcel, label: "Excel XML" },
  };

  function sniff(name, text) {
    const n = (name || "").toLowerCase();
    if (n.endsWith(".jsonl") || n.endsWith(".ndjson")) return "jsonl";
    if (n.endsWith(".json")) return "json";
    if (n.endsWith(".yaml") || n.endsWith(".yml")) return "yaml";
    if (n.endsWith(".xml") || n.endsWith(".xls")) {
      if (text.includes("urn:schemas-microsoft-com:office:spreadsheet")) return "xls";
      return "xml";
    }
    if (n.endsWith(".md") || n.endsWith(".markdown")) return "md";
    if (n.endsWith(".html") || n.endsWith(".htm")) return "html";
    if (n.endsWith(".tsv")) return "tsv";
    if (n.endsWith(".csv")) return "csv";
    const t = text.trim();
    if (t.startsWith("<?xml") || t.startsWith("<dunner") || t.startsWith("<Workbook")) {
      return t.includes("urn:schemas-microsoft-com:office:spreadsheet") ? "xls" : "xml";
    }
    if (t.startsWith("# ") || /^##\s+INV-/m.test(t)) return "md";
    if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) return "html";
    if (t.startsWith("{") || t.startsWith("[")) return "json";
    if (/^app:\s*dunner/m.test(t) || /^invoices:/m.test(t)) return "yaml";
    if (t.includes("\t") && t.split("\n")[0].includes("\t")) return "tsv";
    if (t.includes(",") && /client|invoice|email/i.test(t.split("\n")[0])) return "csv";
    const first = t.split(/\n/).find((l) => l.trim());
    if (first && first.startsWith("{") && first.endsWith("}")) return "jsonl";
    return "csv";
  }

  function parse(text, kind) {
    let rows;
    if (kind === "json") rows = parseJSONLoose(text);
    else if (kind === "jsonl") rows = parseJSONL(text);
    else if (kind === "yaml") rows = parseYAML(text);
    else if (kind === "xml" || kind === "xls") rows = parseXML(text);
    else if (kind === "md") rows = parseMarkdown(text);
    else if (kind === "html") {
      const doc = new DOMParser().parseFromString(text, "text/html");
      const articles = [...doc.querySelectorAll("article")];
      if (!articles.length) throw new Error("No invoice articles found in HTML");
      rows = articles.map((a) => {
        const h = (a.querySelector("h2")?.textContent || "").split("·").map((x) => x.trim());
        const p = a.querySelector("p")?.textContent || "";
        const parts = p.split("·").map((x) => x.trim());
        const amt = (parts[1] || "").split(/\s+/);
        return {
          no: h[0],
          client: h[1],
          email: parts[0],
          total: amt[0],
          currency: amt[1],
          status: parts[2],
          lines: [...a.querySelectorAll("li")].map((li) => {
            const m = li.textContent.match(/^(.*?)\s+×\s+([\d.]+)\s+—\s+([\d.]+)/);
            return m ? { desc: m[1], qty: Number(m[2]), price: Number(m[3]) } : { desc: li.textContent, qty: 1, price: 0 };
          }),
        };
      });
    } else if (kind === "tsv") rows = parseCSV(text, "\t");
    else rows = parseCSV(text, detectSep(text));
    const invoices = fromList(rows);
    if (!invoices.length) throw new Error("No invoice rows parsed");
    return invoices;
  }

  function download(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function stamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function csvTemplate() {
    return (
      "\uFEFF" +
      [
        COLS.join(","),
        "INV-2001,Northline Studio,ap@northline.test,USD,2480,14,overdue,2026-09-11,2026-09-25,,send,1,0,Brand work,Brand identity|1|1800; Landing page|1|680",
        "INV-2002,Atelier Mira,hello@mira.test,EUR,1920,14,paid,2026-09-07,2026-09-21,2026-09-26,send,1.087,0|7,Packaging,Packaging system|1|1920",
      ].join("\r\n")
    );
  }

  return { FORMATS, sniff, parse, download, stamp, csvTemplate, COLS };
})();
