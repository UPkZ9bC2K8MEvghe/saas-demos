(function () {
  const MAX = 80;
  const BOARDS = {
    lab: {
      key: "guestbook.lab.v1",
      title: "Lab guestbook",
      sub: "Notes for the three-product hub. Tenflow, Dunner, and Warmly each keep their own board.",
      seed: [
        { name: "Sam Ortiz", msg: "Opened all three. Dunner is the one I would ship first.", at: daysAgo(2) },
        { name: "Elena Park", msg: "Need a hub like this when I send demos to overseas buyers.", at: daysAgo(1) }
      ]
    },
    dunner: {
      key: "guestbook.dunner.v1",
      title: "Dunner guestbook",
      sub: "Notes for Dunner only. Invoice, dunning, and FX feedback stays on this board.",
      seed: [
        { name: "Ava Chen", msg: "Sent three invoices this morning. The day-7 nudge is the whole product for me.", at: daysAgo(3) },
        { name: "Jonas Klein", msg: "Locked EUR on send. Payday moved and I still got the USD I quoted.", at: daysAgo(1) }
      ]
    },
    tenflow: {
      key: "guestbook.tenflow.v1",
      title: "Tenflow guestbook",
      sub: "Notes for Tenflow only. Workflow billing and run-replay feedback stays on this board.",
      seed: [
        { name: "Marcus Reed", msg: "Six workflows, unlimited runs. I am done counting Zapier tasks.", at: daysAgo(2) },
        { name: "Lina Ortiz", msg: "Replay showed the Slack step dying. That debug view is the reason I stayed.", at: daysAgo(1) }
      ]
    },
    warmly: {
      key: "guestbook.warmly.v1",
      title: "Warmly guestbook",
      sub: "Notes for Warmly only. Booking-page and reschedule feedback stays on this board.",
      seed: [
        { name: "Priya Shah", msg: "The page feels like a person, not a grid. Guests actually write a note.", at: daysAgo(2) },
        { name: "Chris Bell", msg: "Rescheduled myself. No new link, no email ping-pong.", at: daysAgo(1) }
      ]
    }
  };

  function daysAgo(n) {
    return Date.now() - 86400000 * n;
  }

  function boardId() {
    const path = (location.pathname || "/").replace(/\\/g, "/").toLowerCase();
    if (path.indexOf("/tenflow/") !== -1) return "tenflow";
    if (path.indexOf("/warmly/") !== -1) return "warmly";
    if (/(^|\/)lab\.html$/.test(path) || path.endsWith("/lab")) return "lab";
    return "dunner";
  }

  const board = BOARDS[boardId()] || BOARDS.dunner;
  const site = boardId();

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(board.key));
      if (raw && Array.isArray(raw.notes)) return raw;
    } catch (e) {}
    const state = { notes: board.seed.map(function (n) { return Object.assign({}, n); }) };
    save(state);
    return state;
  }

  function save(state) {
    localStorage.setItem(board.key, JSON.stringify(state));
  }

  function when(ts) {
    return new Date(ts).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  }

  function pageLabel() {
    const t = (document.title || "").replace(/\s+/g, " ").trim();
    return t || location.pathname;
  }

  function rootEl() {
    let el = document.getElementById("guestbook");
    if (el) return el;
    el = document.createElement("section");
    el.id = "guestbook";
    el.className = "gb";
    const footer = document.querySelector("footer");
    const main = document.querySelector("main");
    if (footer && footer.parentNode) footer.parentNode.insertBefore(el, footer);
    else if (main && main.parentNode) main.parentNode.insertBefore(el, main.nextSibling);
    else document.body.appendChild(el);
    return el;
  }

  function renderList(box, notes) {
    if (!notes.length) {
      box.innerHTML = '<div class="gb-empty">No notes yet. Be the first on this board.</div>';
      return;
    }
    box.innerHTML = notes
      .slice()
      .sort(function (a, b) { return b.at - a.at; })
      .map(function (n) {
        const where = n.page ? '<span class="gb-page">' + esc(n.page) + "</span>" : "";
        return (
          '<article class="gb-item">' +
            '<header class="gb-meta"><strong>' + esc(n.name) + "</strong>" + where +
            "<time>" + esc(when(n.at)) + "</time></header>" +
            "<p>" + esc(n.msg) + "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function mount() {
    const el = rootEl();
    el.classList.add("gb");
    el.innerHTML =
      '<div class="gb-inner">' +
        '<div class="gb-kicker">Guestbook</div>' +
        "<h2>" + esc(board.title) + "</h2>" +
        '<p class="gb-sub">' + esc(board.sub) + "</p>" +
        '<div class="gb-grid">' +
          '<form class="gb-form" id="gbForm">' +
            "<label>Name</label>" +
            '<input name="name" required maxlength="40" placeholder="Your name" autocomplete="name" />' +
            "<label>Note</label>" +
            '<textarea name="msg" required maxlength="500" placeholder="Write for this product only."></textarea>' +
            '<div class="gb-actions">' +
              '<button type="submit" class="btn gb-btn">Post note</button>' +
              '<span class="gb-hint" id="gbHint"></span>' +
            "</div>" +
          "</form>" +
          '<div class="gb-list" id="gbList"></div>' +
        "</div>" +
      "</div>";

    const state = load();
    const list = el.querySelector("#gbList");
    renderList(list, state.notes);

    el.querySelector("#gbForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = String(fd.get("name") || "").trim();
      const msg = String(fd.get("msg") || "").trim();
      const hint = el.querySelector("#gbHint");
      if (!name || !msg) {
        hint.textContent = "Name and note are required.";
        return;
      }
      state.notes.unshift({ name: name, msg: msg, at: Date.now(), page: pageLabel() });
      if (state.notes.length > MAX) state.notes.length = MAX;
      save(state);
      e.target.reset();
      hint.textContent = "Posted to this board only.";
      renderList(list, state.notes);
    });
  }

  function formatCount(n) {
    return Number(n).toLocaleString("en-US");
  }

  function injectBadge(label) {
    let badge = document.getElementById("visitorBadge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "visitorBadge";
      badge.className = "visitor-badge";
      const bar = document.querySelector(".app-bar");
      const header = document.querySelector("header.top") || document.querySelector("header");
      const hub = document.querySelector(".w");
      if (bar) bar.appendChild(badge);
      else if (header) header.appendChild(badge);
      else if (hub) hub.appendChild(badge);
      else document.body.appendChild(badge);
    }
    badge.textContent = label;
  }

  function countVisitors() {
    const seenKey = "visitor.seen." + site + ".v1";
    const localKey = "visitor.count." + site + ".v1";
    const firstVisit = localStorage.getItem(seenKey) !== "1";
    let local = parseInt(localStorage.getItem(localKey) || "0", 10) || 0;
    if (firstVisit) {
      local += 1;
      localStorage.setItem(seenKey, "1");
      localStorage.setItem(localKey, String(local));
    }
    injectBadge(formatCount(local) + " visitors");

    const path = firstVisit ? "/hit/" : "/get/";
    fetch("https://abacus.jasoncameron.dev" + path + "saas-demos/" + site, { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
      .then(function (data) {
        const n = Number(data && (data.value != null ? data.value : data.count));
        if (!n) return;
        if (n > local) localStorage.setItem(localKey, String(n));
        injectBadge(formatCount(n) + " visitors");
      })
      .catch(function () {});
  }

  function boot() {
    countVisitors();
    mount();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
